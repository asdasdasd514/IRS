import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2, School, Loader } from 'lucide-react';

import { tripApi, mapsApi } from '../../services/api';
import { useGeolocation } from '../../hooks';
import type { CreateWaypointInput, CreateTripInput } from '../../types';

export const CreateTripPage: React.FC = () => {
  const navigate = useNavigate();
  const { location } = useGeolocation();

  const [name, setName] = useState('');
  const [waypoints, setWaypoints] = useState<CreateWaypointInput[]>([]);
  const [isParsingLink, setIsParsingLink] = useState(false);
  const [linkInput, setLinkInput] = useState('');

  // New waypoint form
  const [newWaypoint, setNewWaypoint] = useState<CreateWaypointInput>({
    name: '',
    lat: 0,
    lng: 0,
    type: 'SCHOOL',
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateTripInput) => tripApi.createTrip(data),
    onSuccess: (trip) => {
      navigate(`/trips/${trip.id}`);
    },
  });

  const handleAddWaypoint = () => {
    if (!newWaypoint.name || !newWaypoint.lat || !newWaypoint.lng) {
      alert('Vui lòng nhập tên và tọa độ của điểm dừng');
      return;
    }

    setWaypoints([...waypoints, { ...newWaypoint }]);
    setNewWaypoint({
      name: '',
      lat: 0,
      lng: 0,
      type: 'SCHOOL',
    });
  };

  const handlePasteGoogleMapsLink = async () => {
    if (!linkInput.trim()) {
      alert('Vui lòng dán link Google Maps');
      return;
    }

    setIsParsingLink(true);
    try {
      const result = await mapsApi.parseLink(linkInput);
      
      if (result) {
        setNewWaypoint({
          ...newWaypoint,
          lat: result.latitude,
          lng: result.longitude,
        });
        
        setLinkInput('');
        alert('Lấy tọa độ thành công!');
      }
    } catch (error) {
      console.error('Error parsing link:', error);
      alert('Lỗi khi xử lý link. Vui lòng kiểm tra link và thử lại');
    } finally {
      setIsParsingLink(false);
    }
  };

  const handleRemoveWaypoint = (index: number) => {
    setWaypoints(waypoints.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('Vui lòng nhập tên chuyến đi');
      return;
    }

    if (waypoints.length === 0) {
      alert('Vui lòng thêm ít nhất một điểm dừng');
      return;
    }

    const tripData: CreateTripInput = {
      name: name.trim(),
      current_lat: location?.lat,
      current_lng: location?.lng,
      waypoints,
    };

    createMutation.mutate(tripData);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-4 py-4 flex items-center gap-4 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-1">
          <ArrowLeft className="w-6 h-6 text-gray-700" />
        </button>
        <h1 className="text-xl font-bold text-gray-800">Tạo chuyến đi mới</h1>
      </header>

      <form onSubmit={handleSubmit} className="p-4 space-y-6">
        {/* Trip name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tên chuyến đi *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="VD: Tuyển sinh Đồng Nai đợt 1"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* Waypoints list */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800">
              Danh sách điểm dừng ({waypoints.length})
            </h3>
          </div>

          {waypoints.length === 0 && (
            <div className="text-center py-8 text-gray-400 border-2 border-dashed rounded-xl">
              <School className="w-8 h-8 mx-auto mb-2" />
              <p>Chưa có điểm dừng nào</p>
            </div>
          )}

          <div className="space-y-2 mb-4">
            {waypoints.map((wp, index) => (
              <div
                key={index}
                className="bg-white border rounded-lg p-3 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-gray-800">{wp.name}</p>
                  <p className="text-sm text-gray-500">
                    {wp.lat.toFixed(6)}, {wp.lng.toFixed(6)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveWaypoint(index)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Add waypoint form */}
        <div className="bg-blue-50 rounded-xl p-4">
          <h4 className="font-medium text-gray-800 mb-3">Thêm điểm dừng</h4>

          <div className="space-y-3">
            <input
              type="text"
              value={newWaypoint.name}
              onChange={(e) =>
                setNewWaypoint({ ...newWaypoint, name: e.target.value })
              }
              placeholder="Tên trường / điểm dừng *"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />

            {/* Google Maps Link Input */}
            <div className="bg-white border-2 border-blue-300 rounded-lg p-3">
              <p className="text-xs font-medium text-gray-600 mb-2">📍 Paste link Google Maps</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  placeholder="Dán link từ Google Maps (https://maps.app.goo.gl/...)"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isParsingLink}
                />
                <button
                  type="button"
                  onClick={handlePasteGoogleMapsLink}
                  disabled={isParsingLink}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:bg-gray-400 flex items-center gap-2 whitespace-nowrap"
                >
                  {isParsingLink ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Đang xử lý
                    </>
                  ) : (
                    'Lấy tọa độ'
                  )}
                </button>
              </div>
            </div>

            {/* Manual coordinates input */}
            <div className="border-t border-blue-200 pt-3">
              <p className="text-xs text-gray-600 mb-2">Hoặc nhập tọa độ thủ công</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={newWaypoint.lat || ''}
                  onChange={(e) => {
                    const value = e.target.value.replace(/,/g, '.');
                    setNewWaypoint({
                      ...newWaypoint,
                      lat: parseFloat(value) || 0,
                    });
                  }}
                  placeholder="Latitude *"
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  value={newWaypoint.lng || ''}
                  onChange={(e) => {
                    const value = e.target.value.replace(/,/g, '.');
                    setNewWaypoint({
                      ...newWaypoint,
                      lng: parseFloat(value) || 0,
                    });
                  }}
                  placeholder="Longitude *"
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <select
              value={newWaypoint.type}
              onChange={(e) =>
                setNewWaypoint({ ...newWaypoint, type: e.target.value as 'SCHOOL' | 'HOTEL' | 'HQ' | 'REST_STOP' })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="SCHOOL">Trường học</option>
              <option value="HOTEL">Khách sạn</option>
              <option value="HQ">Trụ sở</option>
              <option value="REST_STOP">Điểm dừng chân</option>
            </select>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-800">
                💡 Thông tin chi tiết (liên hệ, ghi chú, ảnh...) sẽ được thêm trên bản đồ khi đến điểm.
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddWaypoint}
              className="w-full bg-primary-500 text-white py-2 rounded-lg font-medium flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Thêm
            </button>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="w-full bg-green-500 text-white py-4 rounded-xl font-bold text-lg disabled:opacity-50"
        >
          {createMutation.isPending ? 'Đang tạo...' : 'Tạo chuyến đi'}
        </button>
      </form>
    </div>
  );
};

export default CreateTripPage;
