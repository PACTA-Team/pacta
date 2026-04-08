import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import fs from 'fs';
import path from 'path';

// Magic byte validation
const FILE_SIGNATURES: Record<string, string[]> = {
  '.pdf': ['25504446'],
  '.docx': ['504b0304'],
  '.doc': ['d0cf11e0'],
  '.jpg': ['ffd8ff'],
  '.png': ['89504e47'],
  '.txt': [],
};

function validateFileContent(buffer: Buffer, ext: string): boolean {
  const signatures = FILE_SIGNATURES[ext];
  if (!signatures) return false;
  if (signatures.length === 0) return true;

  const fileHeader = buffer.slice(0, 4).toString('hex');
  return signatures.some(sig => fileHeader.startsWith(sig));
}

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ success: false, error: 'File size exceeds 10MB' }, { status: 400 });
    }

    const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt', '.jpg', '.png'];
    const ext = path.extname(file.name).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      return NextResponse.json({ success: false, error: 'Invalid file extension' }, { status: 400 });
    }

    // Validate magic bytes
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!validateFileContent(buffer, ext)) {
      return NextResponse.json({ success: false, error: 'Invalid file content' }, { status: 400 });
    }

    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueName = `${Date.now()}-${sanitizedName}`;

    // Store outside public directory
    const uploadDir = path.join(process.cwd(), 'data', 'uploads');
    fs.mkdirSync(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, uniqueName);
    fs.writeFileSync(filePath, buffer);

    return NextResponse.json({
      success: true,
      fileId: uniqueName,
      fileName: sanitizedName,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 });
  }
});