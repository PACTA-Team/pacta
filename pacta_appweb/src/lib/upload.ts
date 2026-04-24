export const upload = {
  /**
   * Upload a file to temporary storage (not yet associated with a contract).
   * Returns { url: string, key: string } for later verification and cleanup.
   */
  uploadWithPresignedUrl: async (file: File, options: { maxSize: number, allowedExtensions: string[] }) => {
    // Client-side validation
    if (file.size > options.maxSize) {
      throw new Error('File size exceeds limit');
    }

    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!options.allowedExtensions.includes(ext)) {
      throw new Error('Invalid file extension');
    }

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/upload/temp', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error || `HTTP ${response.status}`);
    }

    return response.json(); // { url: "/api/documents/temp/{key}", key: "{uuid}" }
  },

  /**
   * Clean up a temporary uploaded file by its storage key.
   * Used to discard orphaned temp files when form is cancelled or component unmounts.
   */
  cleanupTemporary: async (key: string) => {
    try {
      const response = await fetch(`/api/documents/temp/${encodeURIComponent(key)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        console.warn(`cleanupTemporary: failed for key ${key}: HTTP ${response.status}`);
      }
      return response.ok;
    } catch (err) {
      console.error('cleanupTemporary error:', err);
      return false;
    }
  }
};