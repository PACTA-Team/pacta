

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Supplier } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { upload } from '../../lib/upload';
import { toast } from 'sonner';
import { Upload, FileText, X } from 'lucide-react';

 interface SupplierFormProps {
   supplier?: Supplier;
   onSubmit: (data: Omit<Supplier, 'id' | 'created_by' | 'created_at' | 'updated_at'>) => void;
   onCancel: () => void;
 }

export default function SupplierForm({ supplier, onSubmit, onCancel }: SupplierFormProps) {
  const { t } = useTranslation('suppliers');
  const { t: tCommon } = useTranslation('common');
  const [formData, setFormData] = useState<any>({
    name: supplier?.name || '',
    address: supplier?.address || '',
    reuCode: supplier?.reu_code || '',
    contacts: supplier?.contacts || '',
    documentUrl: supplier?.document_url || '',
    documentKey: supplier?.document_key || '',
    documentName: supplier?.document_name || '',
  });
  const [uploading, setUploading] = useState(false);

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
        setFormData({
          ...formData,
          documentUrl: result.url,
          documentKey: result.fileKey,
          documentName: file.name,
        });
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
    setFormData({
      ...formData,
      documentUrl: '',
      documentKey: '',
      documentName: '',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{supplier ? t('editSupplier') : t('addNew')}</CardTitle>
      </CardHeader>
      <CardContent>
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
            <Label htmlFor="reuCode">REU Code *</Label>
            <Input
              id="reuCode"
              value={formData.reuCode}
              onChange={(e) => setFormData({ ...formData, reuCode: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">{t('address')} *</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={3}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contacts">{t('name')} Contacts *</Label>
            <Textarea
              id="contacts"
              value={formData.contacts}
              onChange={(e) => setFormData({ ...formData, contacts: e.target.value })}
              rows={3}
              placeholder={t('phone') + ', ' + t('email') + ', contact person, etc.'}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>{t('officialDocument')} (PDF, DOC, DOCX)</Label>
            {formData.documentUrl ? (
              <div className="flex items-center gap-2 p-3 border rounded-lg">
                <FileText className="h-5 w-5 text-green-600" />
                <span className="flex-1 text-sm">{formData.documentName}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveDocument}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                  id="document-upload"
                />
                <Label htmlFor="document-upload" className="cursor-pointer">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {uploading ? t('uploading') : t('uploadClick')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, DOC, DOCX (max 5MB)
                  </p>
                </Label>
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onCancel}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit">
              {supplier ? t('updateSupplier') : t('createSupplier')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
