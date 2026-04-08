export const upload = {
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

    const response = await fetch('/next_api/upload', {
      method: 'POST',
      body: formData,
    });

    return response.json();
  }
};