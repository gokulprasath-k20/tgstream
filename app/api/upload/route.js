import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { getAuthUser } from '@/lib/auth';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Allowed MIME types → category mapping
const MIME_MAP = {
  'image/jpeg':   'image',
  'image/png':    'image',
  'image/webp':   'image',
  'image/gif':    'image',
  'video/mp4':    'video',
  'video/webm':   'video',
  'audio/webm':   'audio',
  'audio/ogg':    'audio',
  'audio/mpeg':   'audio',
  'audio/wav':    'audio',
  'audio/mp4':    'audio',
  'application/pdf': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'application/msword': 'document',
};

const MAX_SIZE = 25 * 1024 * 1024; // 25 MB

// Cloudinary resource_type for each category
const RESOURCE_TYPE = { image: 'image', video: 'video', audio: 'video', document: 'raw' };

export async function POST(req) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await req.formData();
    const file     = formData.get('file');

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const mimeType = file.type;
    const category = MIME_MAP[mimeType];
    if (!category) {
      return NextResponse.json({ error: `Unsupported file type: ${mimeType}` }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 25 MB)' }, { status: 400 });
    }

    // Convert Web File to Node Buffer
    const bytes  = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const resourceType = RESOURCE_TYPE[category];

    // Upload to Cloudinary via upload_stream (works in serverless)
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder:        'tgstream',
          resource_type: resourceType,
          use_filename:  true,
          unique_filename: true,
        },
        (err, res) => (err ? reject(err) : resolve(res))
      );
      stream.end(buffer);
    });

    return NextResponse.json({
      url:          result.secure_url,
      publicId:     result.public_id,
      resourceType: category,
      fileName:     file.name,
      fileSize:     file.size,
      duration:     result.duration ?? null,  // Cloudinary returns duration for audio/video
    });

  } catch (err) {
    console.error('[Upload API]', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

// Must disable bodyParser for FormData
export const runtime = 'nodejs';
