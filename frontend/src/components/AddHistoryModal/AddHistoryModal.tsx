import React, { useState } from 'react';
import { X, Save } from 'lucide-react';

interface AddHistoryModalProps {
  waypointId: string;
  waypointName: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: HistoryFormData) => void;
}

export interface HistoryFormData {
  principal_name?: string;
  principal_phone?: string;
  contact_person?: string;
  contact_phone?: string;
  contact_attempts: number;
  success_attempt?: number;
  tickets_collected: number;
  notes?: string;
}

export const AddHistoryModal: React.FC<AddHistoryModalProps> = ({
  waypointName,
  isOpen,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<HistoryFormData>({
    principal_name: '',
    principal_phone: '',
    contact_person: '',
    contact_phone: '',
    contact_attempts: 0,
    success_attempt: undefined,
    tickets_collected: 0,
    notes: '',
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    // Reset form
    setFormData({
      principal_name: '',
      principal_phone: '',
      contact_person: '',
      contact_phone: '',
      contact_attempts: 0,
      success_attempt: undefined,
      tickets_collected: 0,
      notes: '',
    });
  };

  const handleChange = (field: keyof HistoryFormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-end sm:items-center justify-center">
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-xl shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white sm:rounded-t-xl">
          <h2 className="font-bold text-lg">Thêm lịch sử</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4">
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">Trường:</p>
            <p className="font-medium">{waypointName}</p>
          </div>

          <div className="space-y-4">
            {/* Ban giám hiệu */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold mb-3 text-gray-700">Thông tin Ban giám hiệu</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Họ tên
                  </label>
                  <input
                    type="text"
                    value={formData.principal_name}
                    onChange={(e) => handleChange('principal_name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="VD: Thầy Nguyễn Văn A"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Số điện thoại
                  </label>
                  <input
                    type="tel"
                    value={formData.principal_phone}
                    onChange={(e) => handleChange('principal_phone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="0901234567"
                  />
                </div>
              </div>
            </div>

            {/* Người liên hệ */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold mb-3 text-gray-700">Người liên hệ (nếu khác BGH)</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Họ tên
                  </label>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={(e) => handleChange('contact_person', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="VD: Cô Trần Thị B"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Số điện thoại
                  </label>
                  <input
                    type="tel"
                    value={formData.contact_phone}
                    onChange={(e) => handleChange('contact_phone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="0901234567"
                  />
                </div>
              </div>
            </div>

            {/* Thông tin liên lạc */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold mb-3 text-gray-700">Quá trình liên lạc</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Số lần liên lạc
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.contact_attempts}
                    onChange={(e) => handleChange('contact_attempts', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lần thành công
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.success_attempt || ''}
                    onChange={(e) =>
                      handleChange('success_attempt', e.target.value ? parseInt(e.target.value) : 0)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="VD: 3"
                  />
                </div>
              </div>
            </div>

            {/* Kết quả */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold mb-3 text-gray-700">Kết quả</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Số vé thu được 🎫
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.tickets_collected}
                  onChange={(e) => handleChange('tickets_collected', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Ghi chú */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ghi chú
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Ghi chú thêm..."
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6 pt-4 border-t sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="flex-1 bg-primary-500 text-white px-4 py-3 rounded-lg font-medium hover:bg-primary-600 flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              Lưu
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddHistoryModal;
