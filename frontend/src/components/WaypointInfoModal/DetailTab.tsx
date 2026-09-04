import React, { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Phone, MessageCircle, Globe, GraduationCap, School, ExternalLink } from 'lucide-react';
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
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '84' + cleaned.substring(1);
  }
  return cleaned;
};

export const DetailTab: React.FC<DetailTabProps> = ({ waypointId, detail, isLoading, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<WaypointDetailFormData>({
    description: '',
    image_url: '',
    website: '',
    admissions_info: '',
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
        description: detail.description || '',
        image_url: detail.image_url || '',
        website: detail.website || '',
        admissions_info: detail.admissions_info || '',
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
        {/* Ảnh & Giới thiệu trường */}
        {(detail.image_url || detail.description || detail.website) && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2 text-base">
              <School className="w-5 h-5 text-indigo-600" /> Thông tin trường học
            </h3>
            
            {detail.image_url && (
              <div className="rounded-lg overflow-hidden border border-gray-200 max-h-48 bg-gray-50">
                <img
                  src={detail.image_url}
                  alt="Ảnh trường"
                  className="w-full h-48 object-cover hover:scale-105 transition-transform duration-300"
                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                />
              </div>
            )}

            {detail.description && (
              <div className="bg-indigo-50/60 p-3 rounded-lg border border-indigo-100">
                <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-1">Giới thiệu</p>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{detail.description}</p>
              </div>
            )}

            {detail.website && (
              <div className="flex items-center gap-2 pt-1">
                <Globe className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <a
                  href={detail.website.startsWith('http') ? detail.website : `https://${detail.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 truncate font-medium"
                >
                  {detail.website}
                  <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                </a>
              </div>
            )}
          </div>
        )}

        {/* Thông tin tuyển sinh Card */}
        {detail.admissions_info && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2 text-base">
              <GraduationCap className="w-5 h-5 text-emerald-600" /> Thông tin tuyển sinh
            </h3>
            <div className="bg-emerald-50/60 p-3 rounded-lg border border-emerald-100">
              <p className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">{detail.admissions_info}</p>
            </div>
          </div>
        )}

        {/* Ban giám hiệu Card */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2 text-base">
            <span className="text-xl">👤</span> Ban giám hiệu & Người đại diện
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 p-3 rounded-lg border border-blue-200">
              <p className="text-xs font-medium text-blue-600 mb-1.5">Hiệu trưởng / Đại diện</p>
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
          ✏️ Chỉnh sửa thông tin trường
        </button>
      </div>
    );
  }

  // Editing form
  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-6 h-[500px] overflow-y-auto px-1">
      {/* Thông tin trường học */}
      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2 text-sm">
          <School className="w-4 h-4 text-indigo-600" /> Giới thiệu & Website trường
        </h3>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Phần giới thiệu trường</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 text-sm bg-white"
            rows={3}
            placeholder="Mô tả tóm tắt về trường THPT..."
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Website trường</label>
            <input
              type="url"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 text-sm bg-white"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Link ảnh đại diện trường</label>
            <input
              type="url"
              value={formData.image_url}
              onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 text-sm bg-white"
              placeholder="https://..."
            />
          </div>
        </div>
      </div>

      {/* Thông tin tuyển sinh */}
      <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 space-y-2">
        <h3 className="font-semibold text-emerald-900 flex items-center gap-2 text-sm">
          <GraduationCap className="w-4 h-4 text-emerald-600" /> Thông tin tuyển sinh
        </h3>
        <textarea
          value={formData.admissions_info}
          onChange={(e) => setFormData({ ...formData, admissions_info: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 text-sm bg-white"
          rows={3}
          placeholder="Chỉ tiêu, phương thức tuyển sinh, ngành đào tạo trọng điểm, ghi chú tuyển sinh..."
        />
      </div>

      {/* Ban giám hiệu */}
      <div>
        <h3 className="font-semibold text-gray-700 mb-3 text-sm">👤 Thông tin Ban giám hiệu / Người đại diện</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Hiệu trưởng / Đại diện</label>
            <input
              type="text"
              value={formData.principal_name}
              onChange={(e) => setFormData({ ...formData, principal_name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
              placeholder="Họ và tên"
            />
            <input
              type="tel"
              value={formData.principal_phone}
              onChange={(e) => setFormData({ ...formData, principal_phone: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 mt-2 text-sm"
              placeholder="Số điện thoại"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Phó hiệu trưởng</label>
            <input
              type="text"
              value={formData.vice_principal_name}
              onChange={(e) => setFormData({ ...formData, vice_principal_name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
              placeholder="Họ và tên"
            />
            <input
              type="tel"
              value={formData.vice_principal_phone}
              onChange={(e) => setFormData({ ...formData, vice_principal_phone: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 mt-2 text-sm"
              placeholder="Số điện thoại"
            />
          </div>
        </div>
      </div>

      {/* Người liên hệ */}
      <div>
        <h3 className="font-semibold text-gray-700 mb-3 text-sm">🤝 Người liên hệ (bên mình)</h3>
        <input
          type="text"
          value={formData.our_contact_person}
          onChange={(e) => setFormData({ ...formData, our_contact_person: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 mb-2 text-sm"
          placeholder="Tên người liên hệ"
        />
        <input
          type="text"
          value={formData.our_contact_role}
          onChange={(e) => setFormData({ ...formData, our_contact_role: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
          placeholder="Vai trò (VD: Trưởng nhóm, Nhân viên)"
        />
      </div>

      {/* Quá trình liên lạc */}
      <div>
        <h3 className="font-semibold text-gray-700 mb-3 text-sm">📞 Quá trình liên lạc</h3>
        <input
          type="number"
          value={formData.total_contact_attempts}
          onChange={(e) => setFormData({ ...formData, total_contact_attempts: parseInt(e.target.value) || 0 })}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 mb-2 text-sm"
          placeholder="Tổng số lần liên lạc"
          min="0"
        />
        <textarea
          value={formData.contact_process}
          onChange={(e) => setFormData({ ...formData, contact_process: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
          rows={3}
          placeholder="Mô tả quá trình liên lạc..."
        />
      </div>

      {/* Ghi chú */}
      <div>
        <h3 className="font-semibold text-gray-700 mb-3 text-sm">📝 Ghi chú</h3>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
          rows={3}
          placeholder="Ghi chú thêm..."
        />
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={() => {
            setIsEditing(false);
            if (detail) {
              setFormData({
                description: detail.description || '',
                image_url: detail.image_url || '',
                website: detail.website || '',
                admissions_info: detail.admissions_info || '',
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
          className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg hover:bg-gray-200 font-medium"
        >
          Hủy
        </button>
        <button
          type="submit"
          disabled={createMutation.isPending || updateMutation.isPending}
          className="flex-1 bg-primary-500 text-white py-2.5 rounded-lg hover:bg-primary-600 font-medium disabled:opacity-50"
        >
          {createMutation.isPending || updateMutation.isPending ? 'Đang lưu...' : 'Lưu thông tin'}
        </button>
      </div>
    </form>
  );
};

