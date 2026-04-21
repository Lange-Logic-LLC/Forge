import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import { getApi } from './api.js';

export async function zipAndUploadProject(orgSlug: string): Promise<string> {
  const api = await getApi();
  const zipPath = path.join('/tmp', `forge-upload-${Date.now()}.zip`);

  // Zip the project directory
  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 6 } });

    output.on('close', resolve);
    archive.on('error', reject);

    archive.pipe(output);

    // Add project files, excluding common ignore patterns
    archive.glob('**/*', {
      cwd: process.cwd(),
      ignore: [
        'node_modules/**',
        '.git/**',
        'ios/Pods/**',
        'android/.gradle/**',
        'android/app/build/**',
        '.expo/**',
        'dist/**',
        '*.zip',
      ],
    });

    archive.finalize();
  });

  // Get presigned upload URL
  const { data } = await api.post(`/orgs/${orgSlug}/builds/upload-url`, {
    filename: path.basename(zipPath),
    contentType: 'application/zip',
  });

  // Upload to presigned URL
  const fileBuffer = fs.readFileSync(zipPath);
  await fetch(data.uploadUrl, {
    method: 'PUT',
    body: fileBuffer,
    headers: { 'Content-Type': 'application/zip' },
  });

  // Cleanup
  fs.unlinkSync(zipPath);

  return data.sourceUrl;
}
