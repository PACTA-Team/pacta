'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Supplement, SupplementStatus, Contract } from '@/types';
import { upload } from '@/lib/upload';
import { toast } from 'sonner';
import { Upload, FileText, X } from 'lucide-react';

type SupplementFormData = {
  contractId: string;
  supplementNumber: string;
  description: string;
  effectiveDate: string;
  modifications: string;
  status: SupplementStatus;
  documentUrl?: string;
  documentKey?: string;
  documentName?: string;
};

interface SupplementFormProps {
  onSubmit: (data: Omit<Supplement, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>) => void;
  editingSupplement?: Supplement;
  contracts: Contract[];
  formData: SupplementFormData;
  setFormData: (data: SupplementFormData) => void;
}

export default function SupplementForm({
  onSubmit,
  editingSupplement,
  contracts,
  formData,
  setFormData
}: SupplementFormProps) {
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
    const selectedContract = contracts.find(c => c.id === formData.contractId);
    const data: Omit<Supplement, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'> = {
      ...formData,
      clientSignerId: selectedContract?.clientSignerId || '',
      supplierSignerId: selectedContract?.supplierSignerId || '',
    };
    onSubmit(data);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{editingSupplement ? 'Edit Supplement' : 'Add New Supplement'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contractId">Parent Contract *</Label>
            <Select
              value={formData.contractId}
              onValueChange={(value) => setFormData({ ...formData, contractId: value })}
              disabled={!!editingSupplement}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select contract" />
              </SelectTrigger>
              <SelectContent>
                {contracts.map((contract) => (
                  <SelectItem key={contract.id} value={contract.id}>
                    {contract.contractNumber} - {contract.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplementNumber">Supplement Number *</Label>
              <Input
                id="supplementNumber"
                value={formData.supplementNumber}
                onChange={(e) => setFormData({ ...formData, supplementNumber: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="effectiveDate">Effective Date *</Label>
              <Input
                id="effectiveDate"
                type="date"
                value={formData.effectiveDate}
                onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status *</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value as SupplementStatus })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="active">Active</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="modifications">Modifications Summary *</Label>
            <Textarea
              id="modifications"
              value={formData.modifications}
              onChange={(e) => setFormData({ ...formData, modifications: e.target.value })}
              rows={4}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Supplement Document (PDF, DOC, DOCX)</Label>
            <p className="text-xs text-muted-foreground">
              Upload the supplement document
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
                    {uploading ? 'Uploading...' : 'Click to upload supplement document'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, DOC, DOCX (max 5MB)
                  </p>
                </Label>
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="submit">
              {editingSupplement ? 'Update Supplement' : 'Create Supplement'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}