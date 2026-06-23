import apiClient from './client';
import api from './api';

// Get presigned PUT URL for uploading an image
export async function getPresignedUploadUrl(filename, contentType) {
  const { data } = await apiClient.post('/upload/presigned-url', {
    fileName: filename,
    fileType: contentType,
  });
  return data; // { uploadUrl, fileUrl }
}

// Upload the file to S3 using the presigned URL (no progress)
export async function uploadFileToS3(uploadUrl, file) {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type, // MUST match backend fileType
    },
    body: file,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`S3 upload failed: ${res.status} ${text}`);
  }
}

/**
 * Upload file to S3 with progress tracking
 * @param {string} uploadUrl - The presigned S3 URL
 * @param {File} file - The file to upload
 * @param {function} onProgress - Progress callback (percent: number) => void
 * @returns {Promise<void>}
 */
export function uploadFileToS3WithProgress(uploadUrl, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        onProgress(percentComplete);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`S3 upload failed: ${xhr.status} ${xhr.statusText}`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload aborted'));
    });

    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });
}
