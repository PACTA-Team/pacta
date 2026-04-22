'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { clientsAPI } from '@/lib/clients-api';
import { toast } from 'sonner';
import { Upload, X } from 'lucide-react';
import { upload } from '@/lib/upload';

interface ClientInlineModalProps {
  companyId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ClientInlineModal({ companyId, open, onOpenChange, onSuccess }: ClientInlineModalProps) {
  const { t } = useTranslation('clients');
  const { t: tCommon } = useTranslation('common');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    reu_code: '',
    contacts: '',
  });
  const [uploading, setUploading] = useState(false);
  const [documentUrl, setDocumentUrl] = useState('');
  const [documentKey, setDocumentKey] = useState('');
  const [documentName, setDocumentName] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await upload.uploadWithPresignedUrl(file, {
        maxSize: 5 * 1024 * 1024,
        allowedExtensions: ['.pdf', '.doc', '.docx'],
      });
      if (result.success && result.url && result.fileKey) {
        setDocumentUrl(result.url);
        setDocumentKey(result.fileKey);
        setDocumentName(file.name);
        toast.success(t('createSuccess'));
      } else {
        toast.error(result.error || tCommon('error'));
      }
    } catch (error) {
      toast.error(tCommon('error'));
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveDocument = () => {
    setDocumentUrl('');
    setDocumentKey('');
    setDocumentName('');
  };

  const resetForm = () => {
    setFormData({ name: '', address: '', reu_code: '', contacts: '' });
    setDocumentUrl('');
    setDocumentKey('');
    setDocumentName('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await clientsAPI.create({
        ...formData,
        document_url: documentUrl,
        document_key: documentKey,
      }, undefined, companyId);
      toast.success(t('createSuccess'));
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tCommon('error'));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) resetForm();
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('addNew')}</DialogTitle>
          <DialogDescription>
            Crear un nuevo cliente para este contrato.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t('name')} *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reu_code">REU Code *</Label>
            <Input
              id="reu_code"
              value={formData.reu_code}
              onChange={(e) => setFormData({ ...formData, reu_code: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">{t('address')} *</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={2}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contacts">{t('contacts')} *</Label>
            <Textarea
              id="contacts"
              value={formData.contacts}
              onChange={(e) => setFormData({ ...formData, contacts: e.target.value })}
              rows={2}
              placeholder={t('phone') + ', ' + t('email') + ', contact person, etc.'}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>{t('officialDocument')} (PDF, DOC, DOCX)</Label>
            {documentUrl ? (
              <div className="flex items-center gap-2 p-3 border rounded-lg">
                <span className="flex-1 text-sm truncate">{documentName}</span>
                <Button type="button" variant="ghost" size="sm" onClick={handleRemoveDocument}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="border-2 border-dashed rounded-lg p-4 text-center">
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                  id="client-document-upload"
                />
                <Label htmlFor="client-document-upload" className="cursor-pointer">
                  <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    {uploading ? t('uploading') : t('uploadClick')}
                  </p>
                </Label>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? tCommon('saving') : t('createClient')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}