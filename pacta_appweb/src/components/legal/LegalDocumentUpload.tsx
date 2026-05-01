"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";
import { DOCUMENT_TYPES } from "@/lib/legal-utils";

interface LegalDocumentUploadProps {
  onSuccess?: () => void;
}

export function LegalDocumentUpload({ onSuccess }: LegalDocumentUploadProps) {
  const { t } = useTranslation("settings");
  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [tags, setTags] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title || !documentType || !file) {
      toast.error(t('legalSettings.errors.required_fields') || "All fields are required");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error(t('legalSettings.errors.file_too_large') || "File too large (max 50MB)");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title);
      formData.append("document_type", documentType);
      formData.append("jurisdiction", "Cuba");
      if (effectiveDate) {
        formData.append("effective_date", effectiveDate);
      }
      if (tags) {
        formData.append("tags", JSON.stringify(tags.split(',').map(t => t.trim()).filter(Boolean)));
      }

      // Don't set Content-Type header - browser will set it with boundary for FormData
      await api.post('/api/ai/legal/documents/upload', formData);
      
      toast.success(t('legalSettings.uploadSuccess') || "Document uploaded successfully");
      setTitle("");
      setDocumentType("");
      setEffectiveDate("");
      setTags("");
      setFile(null);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || t('legalSettings.uploadError') || "Upload failed");
    } finally {
      setLoading(false);
    }
  };
   
   return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>{t('legalSettings.documentTitle') || "Title"}</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('legalSettings.titlePlaceholder') || "e.g., Ley de Inversión Extranjera"}
          required
        />
      </div>

      <div className="space-y-2">
        <Label>{t('legalSettings.documentType') || "Document Type"}</Label>
        <Select value={documentType} onValueChange={setDocumentType}>
          <SelectTrigger>
            <SelectValue placeholder={t('legalSettings.selectType') || "Select type..."} />
          </SelectTrigger>
          <SelectContent>
            {DOCUMENT_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>{t('legalSettings.effectiveDate') || "Effective Date"}</Label>
        <Input
          type="date"
          value={effectiveDate}
          onChange={(e) => setEffectiveDate(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>{t('legalSettings.tags') || "Tags (comma-separated)"}</Label>
        <Input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder={t('legalSettings.tagsPlaceholder') || "e.g., inversión, extranjera"}
        />
      </div>

      <div className="space-y-2">
        <Label>{t('legalSettings.file') || "File (PDF)"}</Label>
        <Input
          type="file"
          onChange={handleFileChange}
          accept=".pdf,.txt,.docx"
          required
        />
        {file && (
          <p className="text-xs text-muted-foreground">
            {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
          </p>
        )}
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Upload className="h-4 w-4 mr-2" />
        )}
        {loading ? t('legalSettings.uploading') || "Uploading..." : t('legalSettings.upload') || "Upload Document"}
      </Button>
    </form>
  );
}
