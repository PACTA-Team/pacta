import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, Download, Eye, Trash2, Search, FileText } from 'lucide-react';
import { documentsAPI, APIDocument } from '@/lib/documents-api';
import { contractsAPI } from '@/lib/contracts-api';
import { toast } from 'sonner';
import { Link, useSearchParams } from 'react-router-dom';

export default function DocumentsPage() {
  const { t } = useTranslation('documents');
  const { t: tCommon } = useTranslation('common');
  const [documents, setDocuments] = useState<APIDocument[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<APIDocument[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploading, setUploading] = useState(false);
  const [searchParams] = useSearchParams();

  const contractId = searchParams.get('contractId');
  const action = searchParams.get('action');

  useEffect(() => {
    loadDocuments();
  }, [contractId]);

  useEffect(() => {
    let filtered = [...documents];
    if (searchTerm) {
      filtered = filtered.filter(d =>
        d.filename.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    setFilteredDocuments(filtered);
  }, [documents, searchTerm]);

  const loadDocuments = async () => {
    try {
      const entityId = contractId ? parseInt(contractId) : 0;
      if (entityId > 0) {
        const docs = await documentsAPI.list(entityId, 'contract');
        setDocuments(docs);
      } else {
        // Load all contracts and fetch docs for each
        const contracts = await contractsAPI.list() as any[];
        const allDocs: APIDocument[] = [];
        for (const c of contracts) {
          const docs = await documentsAPI.list(c.id, 'contract');
          allDocs.push(...docs);
        }
        setDocuments(allDocs);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load documents');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await documentsAPI.delete(id);
      toast.success('Document deleted successfully');
      loadDocuments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete document');
    }
  };

  const handleDownload = (id: number) => {
    documentsAPI.download(id);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const entityId = contractId ? parseInt(contractId) : 0;
    if (entityId <= 0) {
      toast.error('Please select a contract first');
      return;
    }

    setUploading(true);
    try {
      await documentsAPI.upload(file, entityId, 'contract');
      toast.success('Document uploaded successfully');
      e.target.value = '';
      loadDocuments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <label>
            <input
              type="file"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading || !contractId}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
            />
            <span className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md cursor-pointer ${uploading || !contractId ? 'opacity-50 cursor-not-allowed' : ''} bg-primary text-primary-foreground hover:bg-primary/90`}>
              <Upload className="h-4 w-4" />
              {uploading ? 'Uploading...' : 'Upload Document'}
            </span>
          </label>
        </div>
      </div>

      {!contractId && (
        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900 dark:text-blue-100">Select a Contract</h3>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  Navigate to a contract's detail page to upload documents, or use the contract filter to view all documents.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Document Repository</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDocuments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No documents found
                  </TableCell>
                </TableRow>
              ) : (
                filteredDocuments.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {doc.filename}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{doc.mime_type || '—'}</TableCell>
                    <TableCell>{formatFileSize(doc.size_bytes)}</TableCell>
                    <TableCell>{new Date(doc.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleDownload(doc.id)} aria-label={`Download ${doc.filename}`}>
                          <Download className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(doc.id)} aria-label={`Delete ${doc.filename}`}>
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
