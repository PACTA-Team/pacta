
'use client';

import { useState } from 'react';
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
  onSubmit: (data: Omit<Supplier, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

export default function SupplierForm({ supplier, onSubmit, onCancel }: SupplierFormProps) {
  const [formData, setFormData] = useState({
    name: supplier?.name || '',
    address: supplier?.address || '',
    reuCode: supplier?.reuCode || '',
    contacts: supplier?.contacts || '',
    documentUrl: supplier?.documentUrl || '',
    documentKey: supplier?.documentKey || '',
    documentName: supplier?.documentName || '',
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{supplier ? 'Edit Supplier' : 'Add New Supplier'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Company Name *</Label>
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
            <Label htmlFor="address">Address *</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={3}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contacts">Company Contacts *</Label>
            <Textarea
              id="contacts"
              value={formData.contacts}
              onChange={(e) => setFormData({ ...formData, contacts: e.target.value })}
              rows={3}
              placeholder="Phone, email, contact person, etc."
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Official Company Document (PDF, DOC, DOCX)</Label>
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
                    {uploading ? 'Uploading...' : 'Click to upload document'}
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
              Cancel
            </Button>
            <Button type="submit">
              {supplier ? 'Update Supplier' : 'Create Supplier'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
