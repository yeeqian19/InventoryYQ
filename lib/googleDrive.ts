import { google } from 'googleapis';
import { Readable } from 'stream';

function getCredentials() {
  // Preferred: full service account JSON stored as base64 (no newline/format issues)
  const jsonB64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (jsonB64) {
    const json = JSON.parse(Buffer.from(jsonB64, 'base64').toString('utf8'));
    return {
      client_email: json.client_email as string,
      private_key: json.private_key as string,
    };
  }

  // Fallback: individual env vars
  const client_email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const b64 = process.env.GOOGLE_PRIVATE_KEY_B64;
  const raw = process.env.GOOGLE_PRIVATE_KEY;

  if (!client_email) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL');

  if (b64) return { client_email, private_key: Buffer.from(b64, 'base64').toString('utf8') };
  if (raw) return { client_email, private_key: raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw };

  throw new Error('Missing Google Drive private key env var');
}

const { client_email, private_key } = getCredentials();

if (!process.env.GOOGLE_DRIVE_FOLDER_ID && !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
  throw new Error('Missing GOOGLE_DRIVE_FOLDER_ID');
}

const auth = new google.auth.GoogleAuth({
  credentials: { client_email, private_key },
  scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive = google.drive({ version: 'v3', auth });

export async function uploadToGoogleDrive(
  base64Data: string,
  fileName: string
): Promise<{ fileId: string; webViewLink: string }> {
  try {
    console.log(`🚀 Starting Drive upload for: ${fileName}`);

    const cleaned = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleaned, 'base64');
    const stream = Readable.from(buffer);

    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [process.env.GOOGLE_DRIVE_FOLDER_ID!.trim()],
      },
      media: {
        mimeType: 'image/jpeg',
        body: stream,
      },
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    });

    const fileId = response.data.id!;
    const webViewLink = response.data.webViewLink!;

    console.log(`✅ Upload successful! File ID: ${fileId}`);

    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
      supportsAllDrives: true,
    });

    return { fileId, webViewLink };

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    const detail = (error as { response?: { data?: unknown } })?.response?.data;
    console.error('🔥 Google Drive Upload Error:', msg, detail ? JSON.stringify(detail) : '');
    throw new Error(`Failed to upload image to Google Drive. Reason: ${msg}`);
  }
}
