import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ContractDocumentUpload } from '../ContractDocumentUpload';
import { upload } from '@/lib/upload';
import { toast } from 'sonner';

// Mock dependencies
vi.mock('@/lib/upload', () => ({
  upload: {
    uploadWithPresignedUrl: vi.fn(),
    cleanupTemporary: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ContractDocumentUpload', () => {
  const mockOnUpload = vi.fn();
  const mockOnRemove = vi.fn();
  const mockPendingDocument = {
    url: 'https://example.com/temp/doc',
    key: 'test-key',
    file: new File(['test'], 'test.pdf', { type: 'application/pdf' }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows required indicator (*) when required=true', () => {
    render(
      <ContractDocumentUpload
        required
        pendingDocument={null}
        onUpload={mockOnUpload}
        onRemove={mockOnRemove}
      />
    );
    expect(screen.getByText('*')).toBeInTheDocument();
    expect(screen.getByText('Contract Document')).toBeInTheDocument();
  });

  it('does NOT show required indicator when required=false', () => {
    render(
      <ContractDocumentUpload
        required={false}
        pendingDocument={null}
        onUpload={mockOnUpload}
        onRemove={mockOnRemove}
      />
    );
    const stars = screen.queryAllByText('*');
    // Should only be the asterisk if required; none expected
    expect(stars.length).toBe(0);
  });

  it('displays upload button with correct text when not uploading', () => {
    render(
      <ContractDocumentUpload
        required
        pendingDocument={null}
        onUpload={mockOnUpload}
        onRemove={mockOnRemove}
      />
    );
    expect(screen.getByText('Upload required document')).toBeInTheDocument();
  });

  it('displays uploading state when uploading', () => {
    render(
      <ContractDocumentUpload
        required
        pendingDocument={null}
        onUpload={mockOnUpload}
        onRemove={mockOnRemove}
      />
    );
    // Simulate uploading via internal state? Can't directly; need to trigger file change and mock upload to be async
    // Instead, we can test that the button shows uploading when component's uploading state is true
    // But we need to trigger file input change and then wait.
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);
    // uploadWithPresignedUrl is async; will take a tick
    expect(upload.uploadWithPresignedUrl).toHaveBeenCalled();
    // After call, uploading state becomes true; we can check that the label shows 'Uploading...'
    // However the button text changes based on uploading state
    expect(screen.getByText('Uploading...')).toBeInTheDocument();
  });

  it('rejects files >50MB', async () => {
    render(
      <ContractDocumentUpload
        required
        pendingDocument={null}
        onUpload={mockOnUpload}
        onRemove={mockOnRemove}
      />
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const bigFile = new File(['a'.repeat(51 * 1024 * 1024)], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(input, 'files', { value: [bigFile] });
    fireEvent.change(input);
    expect(toast.error).toHaveBeenCalledWith('File size exceeds 50MB limit');
  });

  it('rejects files with invalid extension', async () => {
    render(
      <ContractDocumentUpload
        required
        pendingDocument={null}
        onUpload={mockOnUpload}
        onRemove={mockOnRemove}
      />
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);
    expect(toast.error).toHaveBeenCalledWith('Invalid file extension. Allowed: PDF, Word, Excel, images');
  });

  it('successful upload calls onUpload with url, key, file', async () => {
    const mockResult = { url: 'https://s3.amazonaws.com/bucket/key', key: 'key123' };
    (upload.uploadWithPresignedUrl as any).mockResolvedValue(mockResult);
    render(
      <ContractDocumentUpload
        required
        pendingDocument={null}
        onUpload={mockOnUpload}
        onRemove={mockOnRemove}
      />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(upload.uploadWithPresignedUrl).toHaveBeenCalledWith(file, expect.any(Object));
    });

    expect(mockOnUpload).toHaveBeenCalledWith({
      url: mockResult.url,
      key: mockResult.key,
      file,
    });
    expect(toast.success).toHaveBeenCalledWith('Document uploaded successfully');
  });

  it('Remove button calls onRemove and deletes temp file', async () => {
    render(
      <ContractDocumentUpload
        required
        pendingDocument={mockPendingDocument}
        onUpload={mockOnUpload}
        onRemove={mockOnRemove}
      />
    );

    // Ensure pendingDocument preview shows
    expect(screen.getByText(mockPendingDocument.file.name)).toBeInTheDocument();

    // Click remove
    const removeBtn = screen.getByRole('button', { name: /remove document/i });
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        `/api/documents/temp/${encodeURIComponent(mockPendingDocument.key)}`,
        expect.objectContaining({ method: 'DELETE', credentials: 'include' })
      );
    });
    expect(mockOnRemove).toHaveBeenCalled();
  });

  it('cleanup effect calls upload.cleanupTemporary on unmount if document not associated', () => {
    const cleanupSpy = vi.spyOn(upload, 'cleanupTemporary');
    const { unmount } = render(
      <ContractDocumentUpload
        required
        pendingDocument={mockPendingDocument}
        onUpload={mockOnUpload}
        onRemove={mockOnRemove}
      />
    );
    unmount();
    expect(cleanupSpy).toHaveBeenCalledWith(mockPendingDocument.key);
  });

  it('does NOT cleanup if document is already associated (existingDocuments match)', () => {
    const cleanupSpy = vi.spyOn(upload, 'cleanupTemporary');
    const existingDocs = [{ id: 1, filename: 'doc.pdf', url: mockPendingDocument.url }];
    const { unmount } = render(
      <ContractDocumentUpload
        required
        existingDocuments={existingDocs}
        pendingDocument={mockPendingDocument}
        onUpload={mockOnUpload}
        onRemove={mockOnRemove}
      />
    );
    unmount();
    expect(cleanupSpy).not.toHaveBeenCalled();
  });
});
