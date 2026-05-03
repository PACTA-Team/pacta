#!/usr/bin/env python3
"""
Train linear adapter to align BGE-small-en-v1.5 embeddings to Spanish legal domain.
"""
import argparse, sqlite3, os, sys, json, random
from pathlib import Path
from sentence_transformers import SentenceTransformer
import torch
import torch.nn as nn
import torch.optim as optim
import re

# Regex topic extraction for Spanish legal
TOPIC_PATTERNS = {
    'indemnizacion': [r'indemnizaci[oó]n', r'compensaci[oó]n', r'da[oó]s? y perjuicios'],
    'confidencialidad': [r'confiden', r'reserva', r'secreto'],
    'renovacion': [r'renovaci[oó]n', r'pr[oó]rroga', r'extensi[oó]n'],
    'terminacion': [r'terminaci[oó]n', r'rescisi[oó]n', r'cancelaci[oó]n'],
    'pago': [r'pago', r'facturaci[oó]n', r'honorarios', r'tarifa'],
    'responsabilidad': [r'responsabilidad', r'garant[ií]a', r'vicios? ocultos?'],
}

TEMPLATES = {
    'indemnizacion': [
        "¿Qué incluye la indemnización por incumplimiento?",
        "¿Cuál es el monto de la indemnización?",
        "Indemnización por daños y perjuicios",
        "¿Quién paga la indemnización?",
    ],
    'confidencialidad': [
        "¿Qué información es confidencial?",
        "¿Cuánto tiempo dura la confidencialidad?",
        "Consecuencias por violar confidencialidad",
    ],
    'renovacion': [
        "¿Cómo se renueva el contrato?",
        "Plazo para renovar",
        "Renovación automática",
    ],
    'terminacion': [
        "¿Cómo se termina el contrato?",
        "Causas de rescisión",
        "Aviso de terminación",
    ],
    'pago': [
        "Plazo de pago",
        "¿Cuándo se factura?",
        "Método de pago",
    ],
    'responsabilidad': [
        "¿Qué cubre la garantía?",
        "Responsabilidad por vicios ocultos",
        "Exclusión de responsabilidad",
    ],
}

def detect_topics(text):
    topics = []
    for topic, patterns in TOPIC_PATTERNS.items():
        for pat in patterns:
            if re.search(pat, text, re.IGNORECASE):
                topics.append(topic)
                break
    return topics

def generate_queries(text):
    topics = detect_topics(text)
    queries = []
    for topic in topics:
        for templ in TEMPLATES.get(topic, []):
            queries.append(templ)
    return queries

class LegalDataset(torch.utils.data.Dataset):
    def __init__(self, db_path, model, neg_samples=5):
        self.db_path = db_path
        self.model = model
        self.neg_samples = neg_samples
        self.chunks = self._load_chunks()
        self.queries = self._build_queries()
        
    def _load_chunks(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("SELECT rowid as id, content FROM minirag_chunks")
        rows = cur.fetchall()
        conn.close()
        return rows
        
    def _build_queries(self):
        pairs = []
        for chunk in self.chunks:
            queries = generate_queries(chunk['content'])
            for q in queries:
                pairs.append((q, chunk['id'], chunk['content']))
        return pairs
    
    def __len__(self):
        return len(self.queries)
    
    def __getitem__(self, idx):
        query, chunk_id, positive = self.queries[idx]
        # Sample negatives from other chunks
        neg_indices = random.sample([i for i in range(len(self.chunks)) if self.chunks[i]['id'] != chunk_id], min(self.neg_samples, len(self.chunks)-1))
        negatives = [self.chunks[i]['content'] for i in neg_indices]
        if len(negatives) < self.neg_samples:
            negatives += [positive] * (self.neg_samples - len(negatives))
        return query, positive, negatives

class LinearAdapter(nn.Module):
    def __init__(self, dim=384):
        super().__init__()
        self.W = nn.Linear(dim, dim, bias=False)
    def forward(self, x):
        return self.W(x)

def info_nce_loss(q, p, negatives, temperature=0.05):
    all_vecs = torch.cat([p.unsqueeze(0), negatives], dim=0)  # [1+N, dim]
    sims = torch.matmul(q.unsqueeze(0), all_vecs.T) / temperature  # [1, 1+N]
    labels = torch.zeros(1, dtype=torch.long, device=q.device)
    return nn.CrossEntropyLoss()(sims, labels)

def train(args):
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    
    model = SentenceTransformer('BAAI/bge-small-en-v1.5')
    model.to(device)
    adapter = LinearAdapter().to(device)
    
    dataset = LegalDataset(args.db, model)
    loader = torch.utils.data.DataLoader(dataset, batch_size=args.batch, shuffle=True)
    
    optimizer = optim.AdamW(adapter.parameters(), lr=args.lr)
    
    for epoch in range(args.epochs):
        total_loss = 0
        for batch in loader:
            queries, positives, negatives = batch
            # Encode with BGE
            with torch.no_grad():
                q_emb = model.encode(queries, convert_to_tensor=True, device=device)
                p_emb = model.encode(positives, convert_to_tensor=True, device=device)
                n_emb = torch.stack([model.encode(neg, convert_to_tensor=True, device=device) for neg in negatives])
            
            # Adapter forward
            q_adapt = adapter(q_emb)
            p_adapt = adapter(p_emb)
            n_adapt = adapter(n_emb.view(-1, 384)).view(n_emb.shape)
            
            # Contrastive loss (mean over batch)
            loss = torch.mean(torch.stack([
                info_nce_loss(q_adapt[i], p_adapt[i], n_adapt[i], args.temp)
                for i in range(q_adapt.size(0))
            ]))
            
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
        print(f"Epoch {epoch+1} loss: {total_loss/len(loader)}")
    
    # Save weights as float32 row-major
    weights = adapter.W.weight.detach().cpu().numpy().astype('float32')
    output_path = Path(args.output_dir) / 'adapter_weights.bin'
    weights.tofile(output_path)
    print(f"Saved adapter to {output_path}")
    
    # Metadata
    meta = {
        'epochs': args.epochs,
        'batch_size': args.batch,
        'learning_rate': args.lr,
        'temperature': args.temp,
        'final_loss': total_loss/len(loader),
        'samples': len(dataset)
    }
    with open(Path(args.output_dir) / 'adapter_metadata.json', 'w') as f:
        json.dump(meta, f, indent=2)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default="minirag.db", help="Path to SQLite DB")
    parser.add_argument("--output-dir", default="models", help="Where to save adapter_weights.bin")
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch", type=int, default=32)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--temp", type=float, default=0.05)
    args = parser.parse_args()
    train(args)
