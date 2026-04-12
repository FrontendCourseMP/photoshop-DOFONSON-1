export const getImageColorDepth = (imageData: ImageData): number => {
  const data = imageData.data;
  let hasAlpha = false;

  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) {
      hasAlpha = true;
      break;
    }
  }

  return hasAlpha ? 32 : 24;
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const isValidImageType = (fileType: string): boolean => {
  return fileType.match(/image\/(png|jpeg|jpg)/) !== null;
};
