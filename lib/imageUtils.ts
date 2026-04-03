// lib/imageUtils.ts

/**
 * Compresses a base64 image string to a smaller size and lower quality.
 * @param base64Str The original large base64 image string from the camera/input
 * @param maxWidth The maximum width you want (800px is great for receipts/proofs)
 * @param quality A number between 0 and 1 (0.7 = 70% quality)
 * @returns A promise that resolves to the compressed base64 string
 */
export const compressImage = (base64Str: string, maxWidth: number = 800, quality: number = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Create a temporary image object
    const img = new Image();
    img.src = base64Str;
    
    img.onload = () => {
      // Create a temporary canvas
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Calculate the new dimensions while keeping the exact same aspect ratio
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      // Set canvas size and draw the image onto it
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        return reject(new Error('Failed to get canvas context'));
      }
      
      ctx.drawImage(img, 0, 0, width, height);

      // Export the drawn image as a highly compressed JPEG
      const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
      resolve(compressedBase64);
    };

    img.onerror = (error) => {
      reject(error);
    };
  });
};