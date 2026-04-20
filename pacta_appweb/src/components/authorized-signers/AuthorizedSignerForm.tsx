

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AuthorizedSigner } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { clientsAPI } from '@/lib/clients-api';
import { suppliersAPI } from '@/lib/suppliers-api';
import { upload } from '@/lib/upload';
import { toast } from 'sonner';
import { Upload, FileText, X } from 'lucide-react';

interface AuthorizedSignerFormProps {
  signer?: AuthorizedSigner;
  onSubmit: (data: Omit<AuthorizedSigner, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

export default function AuthorizedSignerForm({ signer, onSubmit, onCancel }: AuthorizedSignerFormProps) {
  const { t } = useTranslation('signers');
  const { t: tCommon } = useTranslation('common');
  const [clients, setClients] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [formData, setFormData] = useState<any>({
    companyId: signer?.company_id || '',
    companyType: signer?.company_type || 'client',
    firstName: signer?.first_name || '',
    lastName: signer?.last_name || '',
    position: signer?.position || '',
    phone: signer?.phone || '',
    email: signer?.email || '',
    documentUrl: signer?.document_url || '',
    documentKey: signer?.document_key || '',
    documentName: signer?.document_name || '',
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [clientsData, suppliersData] = await Promise.all([
          clientsAPI.list(),
          suppliersAPI.list(),
        ]);
        setClients(clientsData as any[]);
        setSuppliers(suppliersData as any[]);
      } catch {
        toast.error('Failed to load form data');
      }
    };
    loadData();
  }, []);

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
        toast.success('Document uploaded successfully');
      } else {
        toast.error(result.error || 'Upload failed');
      }
    } catch (error) {
      toast.error('Failed to upload document');
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

  const companies = formData.companyType === 'client' ? clients : suppliers;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{signer ? t('editSigner') : t('addNew')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="companyType">{t('role')} *</Label>
              <Select 
                value={formData.companyType} 
                onValueChange={(value) => setFormData({ ...formData, companyType: value as 'client' | 'supplier', companyId: '' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">{t('client', { ns: 'common' })}</SelectItem>
                  <SelectItem value="supplier">{t('supplier', { ns: 'common' })}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="companyId">{t('selectCompany', { ns: 'common' })} *</Label>
              <Select 
                value={formData.companyId} 
                onValueChange={(value) => setFormData({ ...formData, companyId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id.toString()}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">{t('name')} *</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">{t('role')} *</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="position">{t('role')} *</Label>
            <Input
              id="position"
              value={formData.position}
              onChange={(e) => setFormData({ ...formData, position: e.target.value })}
              placeholder="e.g., Director, CEO, Legal Representative"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('email')} *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">{t('phone')} *</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('authDocument')} (PDF, DOC, DOCX) *</Label>
            <p className="text-xs text-muted-foreground">
              Document signed by the Director authorizing this person to sign contracts
            </p>
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
                    {uploading ? t('uploading', { ns: 'common' }) : t('uploadClick', { ns: 'common' })}
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
              {signer ? t('updateSigner') : t('createSigner')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
