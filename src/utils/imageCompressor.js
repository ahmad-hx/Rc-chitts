/**
 * Client-Side Image Compressor for Raghavendra Chitts
 * Resizes excessively large images (max 1920x1920) and compresses JPEGs/WebPs (quality 0.82).
 * Preserves PNG transparency if present; converts non-transparent PNGs to JPEG for max speed and compression.
 */

export const compressImage = async (file, options = {}) => {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.82,
  } = options;

  if (!file || !file.type || !file.type.startsWith('image/')) {
    return file;
  }

  // SVG images should remain uncompressed
  if (file.type === 'image/svg+xml') {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const { width, height } = img;

      // Do not resize if already smaller than max dimensions
      let targetWidth = width;
      let targetHeight = height;

      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          targetWidth = maxWidth;
          targetHeight = Math.round((height * maxWidth) / width);
        } else {
          targetHeight = maxHeight;
          targetWidth = Math.round((width * maxHeight) / height);
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve(file);
        return;
      }

      let isTransparent = false;

      // Check PNG transparency
      if (file.type === 'image/png') {
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        try {
          const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
          const data = imageData.data;
          for (let i = 3; i < data.length; i += 4) {
            if (data[i] < 255) {
              isTransparent = true;
              break;
            }
          }
        } catch (_) {
          // Security/taint error fallback
        }
      }

      // Fill white background for non-transparent canvas renders
      if (!isTransparent) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetWidth, targetHeight);
      }

      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      let outputMimeType = file.type;
      if (file.type === 'image/png' && !isTransparent) {
        outputMimeType = 'image/jpeg';
      } else if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
        outputMimeType = 'image/jpeg';
      } else if (file.type === 'image/webp') {
        outputMimeType = 'image/webp';
      }

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }

          // Use optimized file if size is smaller, otherwise keep original
          if (blob.size < file.size) {
            let newName = file.name;
            if (outputMimeType === 'image/jpeg' && !newName.toLowerCase().endsWith('.jpg') && !newName.toLowerCase().endsWith('.jpeg')) {
              newName = newName.replace(/\.[^/.]+$/, '') + '.jpg';
            }

            const optimizedFile = new File([blob], newName, {
              type: outputMimeType,
              lastModified: Date.now(),
            });
            resolve(optimizedFile);
          } else {
            resolve(file);
          }
        },
        outputMimeType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
};
