import imageCompression from 'browser-image-compression';

/**
 * Tự động kiểm tra file xem có phải định dạng HEIC/HEIF không,
 * chuyển đổi sang JPEG nếu cần, và thực hiện nén kích thước ảnh.
 */
export async function processAndCompressImage(file: File): Promise<File> {
  let targetFile = file;

  // 1. Chuyển đổi HEIC / HEIF -> JPEG
  const fileNameLower = file.name.toLowerCase();
  if (fileNameLower.endsWith('.heic') || fileNameLower.endsWith('.heif') || file.type === 'image/heic') {
    try {
      console.log('🔄 Đang chuyển đổi định dạng ảnh HEIC -> JPEG...');
      const heic2anyModule = await import('heic2any');
      const heic2any = heic2anyModule.default || heic2anyModule;
      
      const convertedBlob = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.85
      }) as Blob;
      
      const newName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
      targetFile = new File([convertedBlob], newName, { type: 'image/jpeg' });
      console.log('✅ Chuyển đổi HEIC thành công!');
    } catch (error) {
      console.warn('Cảnh báo: Không thể convert HEIC tự động, tiếp tục nén ảnh gốc:', error);
    }
  }

  // 2. Nén kích thước và dung lượng ảnh trước khi Upload
  const compressionOptions = {
    maxSizeMB: 1.2,           // Giới hạn tối đa 1.2MB
    maxWidthOrHeight: 1920,   // Max Full HD
    useWebWorker: true,
    fileType: 'image/jpeg'
  };

  try {
    console.log('⚡ Đang nén dung lượng hình ảnh...');
    const compressedBlob = await imageCompression(targetFile, compressionOptions);
    const compressedFile = new File(
      [compressedBlob], 
      targetFile.name.replace(/\.[^/.]+$/, "") + "_compressed.jpg",
      { type: 'image/jpeg' }
    );
    console.log(`✅ Nén ảnh thành công! Dung lượng giảm từ ${(file.size / 1024 / 1024).toFixed(2)}MB xuống ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);
    return compressedFile;
  } catch (error) {
    console.error('Lỗi khi nén ảnh:', error);
    return targetFile;
  }
}
