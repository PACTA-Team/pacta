import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, FileText, X } from 'lucide-react';
import { toast } from 'sonner';
import { upload } from '@/lib/upload';

interface ContractDocumentUploadProps {
  required?: boolean;
  existingDocuments?: Array<{id: number; filename: string; url?: string}>;
  pendingDocument: { url: string; key: string; file: File } | null;
  onUpload: (doc: {url:string; key:string; file:File}) => void;
  onRemove: () => void;
}

/**
 * ContractDocumentUpload — Handles document upload with required validation.
 *
 * Features:
 * - Required document enforcement (visual indicator)
 * - Inline cleanup effect on unmount (removes orphaned temp files)
 * - Existing documents listing + removal
 * - Pending document preview with remove option
 */
export function ContractDocumentUpload({
  required = true,
  existingDocuments = [],
  pendingDocument,
  onUpload,
  onRemove,
}: ContractDocumentUploadProps) {
  const [uploading, setUploading] = useState(false);

  // Cleanup temp file on unmount if not associated with a saved contract
  useEffect(() => {
    return () => {
      if (pendingDocument) {
        const isAlreadyAssociated = existingDocuments.some(doc => doc.url === pendingDocument.url);
        if (!isAlreadyAssociated) {
          upload.cleanupTemporary(pendingDocument.key).catch(console.error);
        }
      }
    };
  }, [pendingDocument, existingDocuments]);

   const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (!file) return;

     // Client-side validation
     if (file.size > 50 * 1024 * 1024) {
       toast.error('File size exceeds 50MB limit');
       return;
     }

     const ext = '.' + file.name.split('.').pop()?.toLowerCase();
     const allowed = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg'];
     if (!allowed.includes(ext)) {
       toast.error('Invalid file extension. Allowed: PDF, Word, Excel, images');
       return;
     }

     setUploading(true);
     try {
       const result = await upload.uploadWithPresignedUrl(file, {
         maxSize: 50 * 1024 * 1024,
         allowedExtensions: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg'],
       });
       onUpload({
         url: result.url,
         key: result.key,
         file,
       });
       toast.success('Document uploaded successfully');
     } catch (err) {
       toast.error(err instanceof Error ? err.message : 'Failed to upload document');
     } finally {
       setUploading(false);
     }
   };

  const handleRemovePending = async () => {
    if (pendingDocument) {
      try {
        await fetch(`/api/documents/temp/${encodeURIComponent(pendingDocument.key)}`, {
          method: 'DELETE',
          credentials: 'include',
        });
      } catch (err) {
        console.error('Failed to cleanup temp document:', err);
      }
    }
    onRemove();
  };

  return (
    <div className="space-y-2">
      <Label>
        {required && <span className="text-destructive mr-1">*</span>}
        Contract Document
      </Label>

      {/* Pending Document Preview */}
      {pendingDocument && (
        <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/50">
          <FileText className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm truncate flex-1 min-w-0">{pendingDocument.file.name}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive"
            onClick={handleRemovePending}
            aria-label="Remove document"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Upload Button */}
      {!pendingDocument && (
        <label className="flex items-center gap-2 text-sm cursor-pointer text-muted-foreground hover:text-foreground">
          <input
            type="file"
            className="hidden"
            onChange={handleFileChange}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
            disabled={uploading}
          />
          <Plus className="h-4 w-4" />
          {uploading ? 'Uploading...' : required ? 'Upload required document' : 'Attach document'}
        </label>
      )}

      <p className="text-xs text-muted-foreground">
        {required 
          ? 'Required. Formats: PDF, Word, Excel, images (max 50MB)'
          : 'Optional. Formats: PDF, Word, Excel, images (max 50MB)'}
      </p>
    </div>
  );
}
