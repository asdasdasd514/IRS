import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { VisitLog, VisitLogFormData } from '../../types';
import { visitLogApi, uploadApi } from '../../services/api';
import { Trash2, Plus, Upload, X, Eye, Download } from 'lucide-react';
import heic2any from 'heic2any';

interface VisitLogTabProps {
  waypointId: string;
  logs: VisitLog[];
  isLoading: boolean;
  onUpdate: () => void;
}

export const VisitLogTab: React.FC<VisitLogTabProps> = ({ waypointId, logs, isLoading, onUpdate }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState<VisitLogFormData>({
    visit_content: '',
    image_urls: '',
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showAllImages, setShowAllImages] = useState<{[key: string]: boolean}>({});

  const handleDownloadImage = async (imageId: string, filename?: string) => {
    try {
      const imageUrl = uploadApi.getImageUrl(imageId);
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || `image-${imageId}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading image:', error);
      alert('Lỗi khi tải ảnh. Vui lòng thử lại.');
    }
  };

  const createMutation = useMutation({
    mutationFn: (data: VisitLogFormData) => visitLogApi.create(waypointId, data),
    onSuccess: () => {
      onUpdate();
      setIsAdding(false);
      setFormData({ visit_content: '', image_urls: '' });
      setSelectedFiles([]);
      setPreviewUrls([]);
    },
  });

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles = Array.from(files);
    const processedFiles: File[] = [];
    
    // Process each file (convert HEIC if needed)
    for (const file of newFiles) {
      try {
        let processedFile = file;
        
        // Check if file is HEIC/HEIF
        if (file.type === 'image/heic' || file.type === 'image/heif' || 
            file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
          
          console.log('Converting HEIC file:', file.name);
          
          // Convert HEIC to JPEG
          const convertedBlob = await heic2any({
            blob: file,
            toType: 'image/jpeg',
            quality: 0.9
          });
          
          // heic2any may return Blob or Blob[]
          const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
          
          // Create new File from converted blob
          const newFileName = file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg');
          processedFile = new File([blob], newFileName, { type: 'image/jpeg' });
          
          console.log('Converted successfully:', newFileName);
        }
        
        processedFiles.push(processedFile);
        
        // Create preview
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreviewUrls(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(processedFile);
        
      } catch (error) {
        console.error('Error processing file:', file.name, error);
        alert(`Lỗi khi xử lý file ${file.name}. Vui lòng thử lại.`);
      }
    }
    
    setSelectedFiles(prev => [...prev, ...processedFiles]);
  };

  const removeImage = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const deleteMutation = useMutation({
    mutationFn: (logId: string) => visitLogApi.delete(logId),
    onSuccess: () => {
      onUpdate();
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.visit_content.trim()) {
      alert('Vui lòng nhập nội dung');
      return;
    }
    
    setIsUploading(true);
    try {
      // Tạo visit log trước (không có ảnh)
      const newLog = await createMutation.mutateAsync({ 
        visit_content: formData.visit_content,
        image_urls: '' 
      });
      
      // Nếu có ảnh, upload sau
      if (selectedFiles.length > 0 && newLog.id) {
        console.log('Uploading files:', selectedFiles.map(f => ({ name: f.name, size: f.size, type: f.type })));
        
        // Validate files before upload
        const invalidFiles = selectedFiles.filter(f => {
          const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
          const maxSize = 10 * 1024 * 1024; // 10MB
          return !validTypes.includes(f.type) || f.size > maxSize;
        });
        
        if (invalidFiles.length > 0) {
          alert(`File không hợp lệ: ${invalidFiles.map(f => `${f.name} (${f.type || 'unknown type'}, ${(f.size / 1024 / 1024).toFixed(2)}MB)`).join(', ')}\n\nChỉ hỗ trợ: JPG, PNG, GIF, WebP (tối đa 10MB/ảnh)`);
          setIsUploading(false);
          return;
        }
        
        try {
          await uploadApi.uploadImages(newLog.id, selectedFiles);
        } catch (uploadError: any) {
          console.error('Upload error details:', uploadError.response?.data || uploadError);
          throw new Error(uploadError.response?.data?.detail || 'Lỗi upload ảnh');
        }
      }
      
      // Reload để lấy data mới kèm ảnh
      onUpdate();
    } catch (error: any) {
      console.error('Error uploading:', error);
      alert(error.message || 'Lỗi khi upload ảnh. Vui lòng thử lại.');
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">Đang tải...</div>;
  }

  return (
    <div className="space-y-4 h-[500px] pb-8 overflow-y-auto">
      {!isAdding && (
        <button
          onClick={() => setIsAdding(true)}
          className="w-full bg-primary-500 text-white py-3 rounded-lg hover:bg-primary-600 font-medium flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Thêm lịch sử
        </button>
      )}

      {isAdding && (
        <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded-lg space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nội dung *
            </label>
            <textarea
              value={formData.visit_content}
              onChange={(e) => setFormData({ ...formData, visit_content: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              rows={6}
              placeholder="Mô tả chi tiết...&#10;- Đã gặp ai&#10;- Nội dung trao đổi&#10;- Kết quả đạt được"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ảnh
            </label>
            <div className="space-y-2">
              <input
                type="file"
                accept="image/*,.heic,.heif"
                multiple
                onChange={handleImageSelect}
                className="hidden"
                id="image-upload"
              />
              <label
                htmlFor="image-upload"
                className="flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-500 hover:bg-primary-50 transition-colors"
              >
                <Upload className="w-5 h-5 text-gray-500" />
                <span className="text-sm text-gray-600">Chọn ảnh (JPG, PNG, HEIC - max 10MB/ảnh)</span>
              </label>
              
              {previewUrls.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {previewUrls.map((url, idx) => (
                    <div key={idx} className="relative group">
                      <img src={url} alt={`Preview ${idx + 1}`} className="w-full h-24 object-cover rounded-lg" />
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setFormData({ visit_content: '', image_urls: '' });
                setSelectedFiles([]);
                setPreviewUrls([]);
              }}
              className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || isUploading}
              className="flex-1 bg-primary-500 text-white py-2 rounded-lg hover:bg-primary-600 disabled:opacity-50"
            >
              {isUploading ? 'Đang upload...' : createMutation.isPending ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </form>
      )}

      {logs.length === 0 && !isAdding && (
        <div className="text-center py-8 text-gray-500">
          Chưa có lịch sử
        </div>
      )}

      {logs.map((log) => (
        <div key={log.id} className="bg-white border rounded-lg p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm text-gray-500">
                {new Date(log.visit_date).toLocaleString('vi-VN')}
              </p>
            </div>
            <button
              onClick={() => {
                if (window.confirm('Xóa lịch sử này?')) {
                  deleteMutation.mutate(log.id);
                }
              }}
              className="text-red-500 hover:text-red-700 p-1"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <p className="whitespace-pre-wrap text-gray-700">{log.visit_content}</p>

          {/* Hiển thị ảnh từ database */}
          {log.images && log.images.length > 0 && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {log.images
                  .slice(0, showAllImages[log.id] ? undefined : 2)
                  .map((image) => (
                    <div key={image.id} className="relative group">
                      <img 
                        src={uploadApi.getImageUrl(image.id)}
                        alt={image.filename || 'Ảnh'}
                        className="w-full h-32 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => window.open(uploadApi.getImageUrl(image.id), '_blank')}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          handleDownloadImage(image.id, image.filename);
                        }}
                        title="Click: Xem full | Chuột phải: Tải về"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all rounded-lg flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(uploadApi.getImageUrl(image.id), '_blank');
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 hover:bg-white p-2 rounded-full shadow-lg"
                          title="Xem ảnh"
                        >
                          <Eye className="w-4 h-4 text-gray-700" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadImage(image.id, image.filename);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 hover:bg-white p-2 rounded-full shadow-lg"
                          title="Tải ảnh về"
                        >
                          <Download className="w-4 h-4 text-gray-700" />
                        </button>
                      </div>
                      {image.filename && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-2 py-1 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity truncate">
                          {image.filename}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
              
              {log.images.length > 2 && (
                <button
                  onClick={() => setShowAllImages(prev => ({ ...prev, [log.id]: !prev[log.id] }))}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                >
                  {showAllImages[log.id] ? '← Thu gọn' : `+ Xem thêm ${log.images.length - 2} ảnh`}
                </button>
              )}
            </div>
          )}

          {/* Backward compatibility: Hiển thị ảnh cũ từ image_urls nếu có */}
          {(!log.images || log.images.length === 0) && log.image_urls && log.image_urls.trim() && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {log.image_urls.split(',')
                  .filter(url => url.trim())
                  .slice(0, showAllImages[log.id] ? undefined : 2)
                  .map((url, idx) => (
                    <div key={idx} className="relative group">
                      <img 
                        src={url.trim()} 
                        alt={`Ảnh ${idx + 1}`}
                        className="w-full h-32 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => window.open(url.trim(), '_blank')}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          const link = document.createElement('a');
                          link.href = url.trim();
                          link.download = `image-${idx + 1}.jpg`;
                          link.click();
                        }}
                        title="Click: Xem full | Chuột phải: Tải về"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all rounded-lg flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(url.trim(), '_blank');
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 hover:bg-white p-2 rounded-full shadow-lg"
                          title="Xem ảnh"
                        >
                          <Eye className="w-4 h-4 text-gray-700" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const link = document.createElement('a');
                            link.href = url.trim();
                            link.download = `image-${idx + 1}.jpg`;
                            link.click();
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 hover:bg-white p-2 rounded-full shadow-lg"
                          title="Tải ảnh về"
                        >
                          <Download className="w-4 h-4 text-gray-700" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
              
              {log.image_urls.split(',').filter(url => url.trim()).length > 2 && (
                <button
                  onClick={() => setShowAllImages(prev => ({ ...prev, [log.id]: !prev[log.id] }))}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                >
                  {showAllImages[log.id] ? '← Thu gọn' : `+ Xem thêm ${log.image_urls.split(',').filter(url => url.trim()).length - 2} ảnh`}
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
