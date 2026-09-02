import React, { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Phone, MessageCircle } from 'lucide-react';
import type { WaypointDetail, WaypointDetailFormData } from '../../types';
import { waypointDetailApi } from '../../services/api';

interface DetailTabProps {
  waypointId: string;
  detail: WaypointDetail | undefined;
  isLoading: boolean;
  onUpdate: () => void;
}

// Helper function to format phone for Zalo
const formatPhoneForZalo = (phone: string): string => {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  // If starts with 0, replace with 84
  if (cleaned.startsWith('0')) {
    cleaned = '84' + cleaned.substring(1);
  }
  return cleaned;
};

export const DetailTab: React.FC<DetailTabProps> = ({ waypointId, detail, isLoading, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<WaypointDetailFormData>({
    principal_name: '',
    principal_phone: '',
    vice_principal_name: '',
    vice_principal_phone: '',
    our_contact_person: '',
    our_contact_role: '',
    contact_process: '',
    total_contact_attempts: 0,
    notes: '',
  });

  useEffect(() => {
    if (detail) {
      setFormData({
        principal_name: detail.principal_name || '',
        principal_phone: detail.principal_phone || '',
        vice_principal_name: detail.vice_principal_name || '',
        vice_principal_phone: detail.vice_principal_phone || '',
        our_contact_person: detail.our_contact_person || '',
        our_contact_role: detail.our_contact_role || '',
        contact_process: detail.contact_process || '',
        total_contact_attempts: detail.total_contact_attempts || 0,
        notes: detail.notes || '',
      });
    }
  }, [detail]);

  const createMutation = useMutation({
    mutationFn: (data: WaypointDetailFormData) => waypointDetailApi.create(waypointId, data),
    onSuccess: () => {
      onUpdate();
      setIsEditing(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<WaypointDetailFormData>) => waypointDetailApi.update(waypointId, data),
    onSuccess: () => {
      onUpdate();
      setIsEditing(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (detail) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">Đang tải...</div>;
  }

  if (!detail && !isEditing) {
    return (
      <div className="text-center py-8 h-[500px] flex flex-col items-center justify-center">
        <p className="text-gray-500 mb-4">Chưa có thông tin chi tiết</p>
        <button
          onClick={() => setIsEditing(true)}
          className="bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600"
        >
          Thêm thông tin
        </button>
      </div>
    );
  }

  if (!isEditing && detail) {
    return (
      <div className="space-y-4 pb-8 h-[500px] overflow-y-auto">
        {/* Ban giám hiệu Card */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2 text-base">
            <span className="text-xl">👤</span> Thông tin Ban giám hiệu
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 p-3 rounded-lg border border-blue-200">
              <p className="text-xs font-medium text-blue-600 mb-1.5">Hiệu trưởng</p>
              <p className="font-semibold text-gray-800 mb-0.5">{detail.principal_name || '---'}</p>
              {detail.principal_phone && (
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-gray-600">📞 {detail.principal_phone}</p>
                  <div className="flex gap-2">
                    <a
                      href={`tel:${detail.principal_phone}`}
                      className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      Gọi
                    </a>
                    <a
                      href={`https://zalo.me/${formatPhoneForZalo(detail.principal_phone)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      Zalo
                    </a>
                  </div>
                </div>
              )}
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 p-3 rounded-lg border border-purple-200">
              <p className="text-xs font-medium text-purple-600 mb-1.5">Phó hiệu trưởng</p>
              <p className="font-semibold text-gray-800 mb-0.5">{detail.vice_principal_name || '---'}</p>
              {detail.vice_principal_phone && (
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-gray-600">📞 {detail.vice_principal_phone}</p>
                  <div className="flex gap-2">
                    <a
                      href={`tel:${detail.vice_principal_phone}`}
                      className="flex-1 bg-purple-500 hover:bg-purple-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      Gọi
                    </a>
                    <a
                      href={`https://zalo.me/${formatPhoneForZalo(detail.vice_principal_phone)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      Zalo
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Người liên hệ Card */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2 text-base">
            <span className="text-xl">🤝</span> Người liên hệ (bên mình)
          </h3>
          <div className="bg-gradient-to-br from-green-50 to-green-100/50 p-3 rounded-lg border border-green-200">
            <p className="font-semibold text-gray-800">{detail.our_contact_person || '---'}</p>
            {detail.our_contact_role && (
              <p className="text-sm text-gray-600 mt-1">{detail.our_contact_role}</p>
            )}
          </div>
        </div>

        {/* Quá trình liên lạc Card */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2 text-base">
            <span className="text-xl">📞</span> Quá trình liên lạc
          </h3>
          <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 px-3 py-2 rounded-lg border border-orange-200 mb-3 inline-block">
            <p className="text-sm font-medium text-gray-700">
              Tổng số lần: <span className="font-bold text-orange-600 text-lg">{detail.total_contact_attempts}</span>
            </p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <p className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
              {detail.contact_process || 'Chưa có thông tin'}
            </p>
          </div>
        </div>

        {/* Ghi chú Card */}
        {detail.notes && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2 text-base">
              <span className="text-xl">📝</span> Ghi chú
            </h3>
            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
              <p className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">{detail.notes}</p>
            </div>
          </div>
        )}

        <button
          onClick={() => setIsEditing(true)}
          className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-2.5 rounded-xl hover:from-blue-600 hover:to-blue-700 font-medium shadow-sm transition-all"
        >
          ✏️ Chỉnh sửa
        </button>
      </div>
    );
  }

  // Editing form
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Ban giám hiệu */}
      <div>
        <h3 className="font-semibold text-gray-700 mb-3">👤 Thông tin Ban giám hiệu</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Hiệu trưởng</label>
            <input
              type="text"
              value={formData.principal_name}
              onChange={(e) => setFormData({ ...formData, principal_name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="Họ tên"
            />
            <input
              type="tel"
              value={formData.principal_phone}
              onChange={(e) => setFormData({ ...formData, principal_phone: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 mt-2"
              placeholder="SĐT"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Phó hiệu trưởng</label>
            <input
              type="text"
              value={formData.vice_principal_name}
              onChange={(e) => setFormData({ ...formData, vice_principal_name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="Họ tên"
            />
            <input
              type="tel"
              value={formData.vice_principal_phone}
              onChange={(e) => setFormData({ ...formData, vice_principal_phone: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 mt-2"
              placeholder="SĐT"
            />
          </div>
        </div>
      </div>

      {/* Người liên hệ */}
      <div>
        <h3 className="font-semibold text-gray-700 mb-3">🤝 Người liên hệ (bên mình)</h3>
        <input
          type="text"
          value={formData.our_contact_person}
          onChange={(e) => setFormData({ ...formData, our_contact_person: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 mb-2"
          placeholder="Tên người liên hệ"
        />
        <input
          type="text"
          value={formData.our_contact_role}
          onChange={(e) => setFormData({ ...formData, our_contact_role: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
          placeholder="Vai trò (VD: Trưởng nhóm, Nhân viên)"
        />
      </div>

      {/* Quá trình liên lạc */}
      <div>
        <h3 className="font-semibold text-gray-700 mb-3">📞 Quá trình liên lạc</h3>
        <input
          type="number"
          value={formData.total_contact_attempts}
          onChange={(e) => setFormData({ ...formData, total_contact_attempts: parseInt(e.target.value) || 0 })}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 mb-2"
          placeholder="Tổng số lần liên lạc"
          min="0"
        />
        <textarea
          value={formData.contact_process}
          onChange={(e) => setFormData({ ...formData, contact_process: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
          rows={4}
          placeholder="Mô tả quá trình liên lạc..."
        />
      </div>

      {/* Ghi chú */}
      <div>
        <h3 className="font-semibold text-gray-700 mb-3">📝 Ghi chú</h3>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
          rows={3}
          placeholder="Ghi chú thêm..."
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setIsEditing(false);
            if (detail) {
              setFormData({
                principal_name: detail.principal_name || '',
                principal_phone: detail.principal_phone || '',
                vice_principal_name: detail.vice_principal_name || '',
                vice_principal_phone: detail.vice_principal_phone || '',
                our_contact_person: detail.our_contact_person || '',
                our_contact_role: detail.our_contact_role || '',
                contact_process: detail.contact_process || '',
                total_contact_attempts: detail.total_contact_attempts || 0,
                notes: detail.notes || '',
              });
            }
          }}
          className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200"
        >
          Hủy
        </button>
        <button
          type="submit"
          disabled={createMutation.isPending || updateMutation.isPending}
          className="flex-1 bg-primary-500 text-white py-2 rounded-lg hover:bg-primary-600 disabled:opacity-50"
        >
          {createMutation.isPending || updateMutation.isPending ? 'Đang lưu...' : 'Lưu'}
        </button>
      </div>
    </form>
  );
};
