import { getPresignedUploadUrl, uploadFileToS3 } from '../api/upload';
export async function uploadFiles(files = [], onProgress) {
  const urls = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    const presigned = await getPresignedUploadUrl(file.name, file.type);

    await uploadFileToS3(presigned.uploadUrl, file, file.type, (percent) => {
      onProgress?.({
        fileIndex: i + 1,
        fileCount: files.length,
        percent,
      });
    });

    urls.push(presigned.fileUrl);
  }

  return urls;
}

export async function normalizeMediaArray(media = [], onProgress) {
  const existingUrls = media.filter((v) => typeof v === 'string');
  const newFiles = media.filter((v) => v instanceof File);

  if (newFiles.length === 0) return existingUrls;

  const uploadedUrls = await uploadFiles(newFiles, onProgress);

  return [...existingUrls, ...uploadedUrls];
}
