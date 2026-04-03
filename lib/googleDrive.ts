import { google } from 'googleapis';
import { Readable } from 'stream';

// 1. Safety check to ensure keys are loaded
if (!process.env.GOOGLE_PRIVATE_KEY || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_DRIVE_FOLDER_ID) {
  console.warn("⚠️ Missing Google Drive environment variables in .env!");
}

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/drive.file'],
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
    
    // 2. Create stream (Modern approach)
    const stream = Readable.from(buffer);

    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [process.env.GOOGLE_DRIVE_FOLDER_ID!],
      },
      media: {
        mimeType: 'image/jpeg',
        body: stream,
      },
      fields: 'id, webViewLink',
      // 👇 THIS BYPASSES THE 0-BYTE QUOTA LIMIT
      supportsAllDrives: true, 
    });

    const fileId = response.data.id!;
    const webViewLink = response.data.webViewLink!;

    console.log(`✅ Upload successful! File ID: ${fileId}`);

    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
      // 👇 ALSO REQUIRED HERE FOR SHARED DRIVES
      supportsAllDrives: true, 
    });

    return { fileId, webViewLink };

  } catch (error) {
    // 3. Catch and log exact errors
    console.error("🔥 Google Drive Upload Error:", error);
    throw new Error("Failed to upload image to Google Drive.");
  }
}