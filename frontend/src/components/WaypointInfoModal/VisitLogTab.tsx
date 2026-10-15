import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { VisitLog } from '../../types';
import { visitLogApi, uploadApi } from '../../services/api';
import { Trash2, Eye, Download, Clock, Navigation, UserCheck, Users } from 'lucide-react';

interface VisitLogTabProps {
  waypointId?: string;
  logs: VisitLog[];
  isLoading: boolean;
  onUpdate: () => void;
}

const parseSafeDate = (dateVal?: string | Date | null): Date | null => {
  if (!dateVal) return null;
  if (dateVal instanceof Date) return dateVal;
  const str = String(dateVal);
  const hasTimezone = str.endsWith('Z') || str.includes('+') || (str.includes('T') && str.lastIndexOf('-') > str.indexOf('T'));
  const normalized = hasTimezone ? str : `${str}Z`;
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? new Date(str) : d;
};

export const VisitLogTab: React.FC<VisitLogTabProps> = ({ logs, isLoading, onUpdate }) => {
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

  const deleteMutation = useMutation({
    mutationFn: (logId: string) => visitLogApi.delete(logId),
    onSuccess: () => {
      onUpdate();
    },
  });

  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">Đang tải...</div>;
  }

  return (
    <div className="space-y-4 h-[500px] pb-8 overflow-y-auto">
      {logs.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-sm font-medium">Chưa có lịch sử ghé thăm</p>
          <p className="text-xs text-gray-400 mt-1">Lịch sử sẽ tự động được ghi nhận khi cán bộ thực hiện Check-in tại trường.</p>
        </div>
      )}

      {logs.map((log) => (
        <div key={log.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 shadow-2xs hover:border-gray-300 transition-colors">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 space-y-1.5">
              {/* Giờ tới & Chuyến đi */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    {(() => {
                      const d = parseSafeDate(log.visit_date || log.created_at);
                      return d ? (
                        <>Đã tới lúc: <strong>{d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</strong>, {d.toLocaleDateString('vi-VN')}</>
                      ) : (
                        <>Đã tới trường</>
                      );
                    })()}
                  </span>
                </span>

                {(log.trip_code || log.trip_name) && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-800 border border-blue-200 text-xs font-semibold">
                    <Navigation className="w-3.5 h-3.5 text-blue-600" />
                    <span>Chuyến: <strong>{log.trip_code || log.trip_name}</strong></span>
                  </span>
                )}
              </div>

              {/* Trưởng đoàn & Thành viên đoàn (Tuyệt đối KHÔNG có tài xế) */}
              {(log.leader_name || log.members_names) && (
                <div className="flex items-center gap-2 flex-wrap text-xs text-gray-600 pt-0.5">
                  {log.leader_name && (
                    <span className="inline-flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                      <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Trưởng đoàn: <strong className="text-gray-900">{log.leader_name}</strong></span>
                    </span>
                  )}
                  {log.members_names && (
                    <span className="inline-flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                      <Users className="w-3.5 h-3.5 text-purple-600" />
                      <span>Thành viên: <strong className="text-gray-900">{log.members_names}</strong></span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {!log.id.startsWith('auto-visit-') && (
              <button
                onClick={() => {
                  if (window.confirm('Xóa lịch sử này?')) {
                    deleteMutation.mutate(log.id);
                  }
                }}
                className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0"
                title="Xóa lịch sử"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <p className="whitespace-pre-wrap text-gray-700 text-sm leading-relaxed">{log.visit_content}</p>

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
