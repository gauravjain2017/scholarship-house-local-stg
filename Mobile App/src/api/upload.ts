// expo-file-system's legacy module exposes `uploadAsync` which is the only
// reliable way to PUT a file:// URI as a raw binary body in React Native.
// React Native's `new Blob([arrayBuffer])` throws "Creating blobs from
// 'ArrayBuffer' and 'ArrayBufferView' are not supported", and the lazy blob
// from `fetch(uri).blob()` can serialize as 0 bytes on some Android builds.
// `expo-file-system` is a direct dep of the `expo` SDK 54 package — always
// autolinked, no extra install needed.
import * as FileSystem from 'expo-file-system/legacy';
import { api } from './client';
import type { PresignedUrlRequest, PresignedUrlResponse } from '@/types';

export async function getPresignedUrl(req: PresignedUrlRequest): Promise<PresignedUrlResponse> {
  const { data } = await api.post<PresignedUrlResponse>('/upload/presigned-url', req);
  return data;
}

export async function getBatchPresignedUrls(
  files: PresignedUrlRequest[],
): Promise<PresignedUrlResponse[]> {
  const { data } = await api.post<PresignedUrlResponse[]>('/upload/batch-presigned-urls', { files });
  return data;
}

export async function deleteUploadedFile(key: string): Promise<void> {
  await api.delete('/upload/file', { data: { key } });
}

/**
 * Uploads a local file (file:// URI) to S3 via a presigned URL.
 * Returns the public S3 URL the backend should reference.
 *
 * Backend `POST /upload/presigned-url` returns `{ uploadUrl, fileUrl, key }`
 * (see `backend/src/controllers/uploadController.js`). Older client code read
 * `publicUrl`, which is undefined — that's why interior/exterior/additional
 * images previously submitted as empty arrays.
 */
export async function uploadLocalFile(
  localUri: string,
  fileType: string,
  folder = 'properties',
): Promise<string> {
  const fileName = localUri.split('/').pop() || `upload-${Date.now()}`;
  const presigned = await getPresignedUrl({ fileName, fileType, folder });

  // Stream the file straight from disk to S3 as a raw binary PUT. Bypasses
  // RN's flaky Blob/ArrayBuffer support entirely.
  const result = await FileSystem.uploadAsync(presigned.uploadUrl, localUri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    // Must EXACTLY match the Content-Type the presigned URL was signed for,
    // otherwise S3 returns 403 SignatureDoesNotMatch.
    headers: { 'Content-Type': fileType },
  });

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`S3 upload failed (${result.status})`);
  }

  // Single-file endpoint returns `fileUrl`; batch endpoint returns `publicUrl`.
  // We hit the single endpoint here, but accept either to stay forward-safe.
  const url = presigned.fileUrl || presigned.publicUrl;
  if (!url) {
    throw new Error('Upload succeeded but server did not return a file URL');
  }
  return url;
}
