import React, { useState } from 'react';
import { X, History, Plus, Phone, User, Ticket, Calendar, Award } from 'lucide-react';
import type { Waypoint } from '../../types';

interface WaypointHistory {
  id: string;
  visit_date: string;
  visit_number: number;
  principal_name?: string;
  principal_phone?: string;
  contact_person?: string;
  contact_phone?: string;
  contact_attempts: number;
  success_attempt?: number;
  tickets_collected: number;
  notes?: string;
}

interface WaypointDetailModalProps {
  waypoint: Waypoint;
  histories: WaypointHistory[];
  isOpen: boolean;
  onClose: () => void;
  onAddHistory: () => void;
}

export const WaypointDetailModal: React.FC<WaypointDetailModalProps> = ({
  waypoint,
  histories,
  isOpen,
  onClose,
  onAddHistory,
}) => {
  const [showAllHistory, setShowAllHistory] = useState(false);

  if (!isOpen) return null;

  const displayHistories = showAllHistory ? histories : histories.slice(0, 2);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-end sm:items-center justify-center">
      <div 
        className="bg-white w-full sm:max-w-2xl sm:rounded-xl shadow-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white sm:rounded-t-xl">
          <div className="flex-1">
            <h2 className="font-bold text-lg">{waypoint.name}</h2>
            {waypoint.address && (
              <p className="text-sm text-gray-500">{waypoint.address}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Basic Info */}
          <div className="mb-6">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
              <span>📍 {waypoint.lat.toFixed(6)}, {waypoint.lng.toFixed(6)}</span>
            </div>
            {waypoint.is_visited && waypoint.visited_at && (
              <div className="flex items-center gap-2 text-sm">
                <span className="bg-green-100 text-green-700 px-2 py-1 rounded">
                  ✓ Đã check-in
                </span>
                <span className="text-gray-500">
                  {new Date(waypoint.visited_at).toLocaleString('vi-VN')}
                </span>
              </div>
            )}
          </div>

          {/* History Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <History className="w-5 h-5 text-primary-500" />
                Lịch sử ({histories.length})
              </h3>
              <button
                onClick={onAddHistory}
                className="flex items-center gap-1 text-primary-500 text-sm font-medium hover:bg-primary-50 px-3 py-1.5 rounded-lg"
              >
                <Plus className="w-4 h-4" />
                Thêm mới
              </button>
            </div>

            {histories.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <History className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>Chưa có lịch sử</p>
                <button
                  onClick={onAddHistory}
                  className="mt-3 text-primary-500 font-medium"
                >
                  Thêm lịch sử đầu tiên
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {displayHistories.map((history) => (
                  <div
                    key={history.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="bg-primary-100 text-primary-700 px-2 py-1 rounded text-sm font-semibold">
                          Lần {history.visit_number}
                        </span>
                        <span className="text-sm text-gray-500 flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(history.visit_date).toLocaleString('vi-VN')}
                        </span>
                      </div>
                      {history.tickets_collected > 0 && (
                        <div className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded">
                          <Ticket className="w-4 h-4" />
                          <span className="font-semibold">{history.tickets_collected}</span>
                        </div>
                      )}
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {history.principal_name && (
                        <div>
                          <div className="text-gray-500 flex items-center gap-1 mb-1">
                            <User className="w-3.5 h-3.5" />
                            Ban giám hiệu
                          </div>
                          <div className="font-medium">{history.principal_name}</div>
                          {history.principal_phone && (
                            <div className="text-gray-600 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3" />
                              {history.principal_phone}
                            </div>
                          )}
                        </div>
                      )}

                      {history.contact_person && (
                        <div>
                          <div className="text-gray-500 flex items-center gap-1 mb-1">
                            <User className="w-3.5 h-3.5" />
                            Người liên hệ
                          </div>
                          <div className="font-medium">{history.contact_person}</div>
                          {history.contact_phone && (
                            <div className="text-gray-600 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3" />
                              {history.contact_phone}
                            </div>
                          )}
                        </div>
                      )}

                      {history.contact_attempts > 0 && (
                        <div>
                          <div className="text-gray-500 mb-1">Số lần liên lạc</div>
                          <div className="font-medium">{history.contact_attempts} lần</div>
                        </div>
                      )}

                      {history.success_attempt && (
                        <div>
                          <div className="text-gray-500 flex items-center gap-1 mb-1">
                            <Award className="w-3.5 h-3.5" />
                            Thành công
                          </div>
                          <div className="font-medium text-green-600">Lần thứ {history.success_attempt}</div>
                        </div>
                      )}
                    </div>

                    {/* Notes */}
                    {history.notes && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="text-gray-500 text-xs mb-1">Ghi chú:</div>
                        <div className="text-sm text-gray-700">{history.notes}</div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Show more button */}
                {histories.length > 2 && !showAllHistory && (
                  <button
                    onClick={() => setShowAllHistory(true)}
                    className="w-full text-center text-primary-500 font-medium py-2 hover:bg-primary-50 rounded-lg"
                  >
                    Xem thêm {histories.length - 2} lần
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WaypointDetailModal;
