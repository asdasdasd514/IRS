import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2, Save, X, MapPin, Coffee, School, Hotel, Building2, Edit2, Loader } from 'lucide-react';
import { tripApi, mapsApi } from '../../services/api';
import { useGeolocation } from '../../hooks';
import type { Waypoint, CreateWaypointInput } from '../../types';

export const EditTripPage: React.FC = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { location } = useGeolocation();

  const [tripName, setTripName] = useState('');
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [showAddWaypointModal, setShowAddWaypointModal] = useState(false);
  const [showAddRestStopModal, setShowAddRestStopModal] = useState(false);
  const [editingWaypoint, setEditingWaypoint] = useState<Waypoint | null>(null); // Track waypoint being edited
  const [newWaypoint, setNewWaypoint] = useState<Partial<CreateWaypointInput>>({
    name: '',
    lat: undefined,
    lng: undefined,
    address: '',
    type: 'SCHOOL',
  });
  const [newRestStop, setNewRestStop] = useState<Partial<CreateWaypointInput>>({
    name: '',
    lat: undefined,
    lng: undefined,
    type: 'REST_STOP',
  });
  
  // Separate state for coordinate input strings to handle user input properly
  const [latInput, setLatInput] = useState('');
  const [lngInput, setLngInput] = useState('');
  const [coordinateError, setCoordinateError] = useState('');
  const [linkInput, setLinkInput] = useState('');
  const [isParsingLink, setIsParsingLink] = useState(false);

  // Helper function to get waypoint type info
  const getWaypointTypeInfo = (type: string) => {
    switch (type) {
      case 'SCHOOL':
        return { icon: School, label: 'Trường học', color: 'bg-blue-100 text-blue-700' };
      case 'HOTEL':
        return { icon: Hotel, label: 'Khách sạn', color: 'bg-purple-100 text-purple-700' };
      case 'HQ':
        return { icon: Building2, label: 'Trụ sở', color: 'bg-gray-100 text-gray-700' };
      case 'REST_STOP':
        return { icon: Coffee, label: 'Dừng chân', color: 'bg-amber-100 text-amber-700' };
      default:
        return { icon: MapPin, label: 'Khác', color: 'bg-gray-100 text-gray-700' };
    }
  };

  // Fetch trip data
  const { data: trip, isLoading } = useQuery({
    queryKey: ['trip', tripId],
    queryFn: () => tripApi.getTrip(tripId!),
    enabled: !!tripId,
  });

  // Initialize form when trip data loads
  useEffect(() => {
    if (trip) {
      setTripName(trip.name);
      setWaypoints(trip.waypoints || []);
    }
  }, [trip]);

  // Update trip mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      await tripApi.updateTrip(tripId!, {
        name: tripName,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
      navigate(`/trips/${tripId}`);
    },
  });

  // Delete waypoint mutation
  const deleteWaypointMutation = useMutation({
    mutationFn: (waypointId: string) => tripApi.deleteWaypoint(tripId!, waypointId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
    },
  });

  // Add waypoint mutation
  const addWaypointMutation = useMutation({
    mutationFn: async (waypointData: CreateWaypointInput) => {
      console.log('Mutation function called with:', waypointData);
      if (editingWaypoint) {
        // Update existing waypoint
        return tripApi.updateWaypoint(tripId!, editingWaypoint.id, waypointData);
      } else {
        // Add new waypoint
        return tripApi.addWaypoint(tripId!, waypointData);
      }
    },
    onSuccess: (data) => {
      console.log('Mutation success:', data);
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
      setShowAddWaypointModal(false);
      setShowAddRestStopModal(false);
      setEditingWaypoint(null);
      // Reset form
      setNewWaypoint({
        name: '',
        lat: undefined,
        lng: undefined,
        address: '',
        type: 'SCHOOL',
      });
      setNewRestStop({
        name: '',
        lat: undefined,
        lng: undefined,
        type: 'REST_STOP',
      });
      setLatInput('');
      setLngInput('');
      setCoordinateError('');
    },
    onError: (error) => {
      console.error('Mutation error:', error);
      setCoordinateError((editingWaypoint ? 'Lỗi khi cập nhật điểm dừng: ' : 'Lỗi khi thêm điểm dừng: ') + (error as any).message);
    },
  });

  const handleDeleteWaypoint = (waypointId: string) => {
    if (window.confirm('Xóa điểm dừng này?')) {
      setWaypoints(waypoints.filter((w) => w.id !== waypointId));
      deleteWaypointMutation.mutate(waypointId);
    }
  };

  const handleEditWaypoint = (waypoint: Waypoint) => {
    // Pre-fill form with waypoint data
    setEditingWaypoint(waypoint);
    setNewWaypoint({
      name: waypoint.name,
      lat: waypoint.lat,
      lng: waypoint.lng,
      address: waypoint.address || '',
      type: waypoint.type,
    });
    setLatInput(waypoint.lat.toString());
    setLngInput(waypoint.lng.toString());
    setCoordinateError('');
    setShowAddWaypointModal(true);
  };

  const handlePasteGoogleMapsLink = async () => {
    if (!linkInput.trim()) {
      setCoordinateError('Vui lòng dán link Google Maps');
      return;
    }

    setIsParsingLink(true);
    setCoordinateError('');
    try {
      const result = await mapsApi.parseLink(linkInput);
      
      if (result) {
        setLatInput(result.latitude.toString());
        setLngInput(result.longitude.toString());
        setNewWaypoint({
          ...newWaypoint,
          lat: result.latitude,
          lng: result.longitude,
        });
        
        setLinkInput('');
        setCoordinateError('');
      }
    } catch (error) {
      console.error('Error parsing link:', error);
      setCoordinateError('Lỗi khi xử lý link. Vui lòng kiểm tra link và thử lại');
    } finally {
      setIsParsingLink(false);
    }
  };

  const validateAndParseCoordinate = (value: string, type: 'lat' | 'lng'): number | null => {
    if (!value.trim()) return null;
    
    const parsed = parseFloat(value.replace(/,/g, '.'));
    
    if (isNaN(parsed)) {
      return null;
    }
    
    // Validate ranges
    if (type === 'lat' && (parsed < -90 || parsed > 90)) {
      return null;
    }
    if (type === 'lng' && (parsed < -180 || parsed > 180)) {
      return null;
    }
    
    return parsed;
  };

  const handleAddWaypoint = () => {
    console.log('handleAddWaypoint called', newWaypoint);
    
    // Validate name
    if (!newWaypoint.name?.trim()) {
      setCoordinateError('Vui lòng nhập tên điểm dừng');
      return;
    }
    
    // Validate coordinates
    const lat = validateAndParseCoordinate(latInput, 'lat');
    const lng = validateAndParseCoordinate(lngInput, 'lng');
    
    if (lat === null || lng === null) {
      if (!latInput.trim() || !lngInput.trim()) {
        setCoordinateError('Vui lòng nhập đầy đủ tọa độ');
      } else if (lat === null && lng !== null) {
        setCoordinateError('Vĩ độ không hợp lệ (phải từ -90 đến 90)');
      } else if (lng === null && lat !== null) {
        setCoordinateError('Kinh độ không hợp lệ (phải từ -180 đến 180)');
      } else {
        setCoordinateError('Tọa độ không hợp lệ. Vui lòng kiểm tra lại định dạng');
      }
      return;
    }
    
    setCoordinateError('');
    
    const waypointData: CreateWaypointInput = {
      name: newWaypoint.name.trim(),
      lat: lat,
      lng: lng,
      address: newWaypoint.address?.trim() || undefined,
      type: (newWaypoint.type as 'SCHOOL' | 'HOTEL' | 'HQ' | 'REST_STOP') || 'SCHOOL',
    };
    
    console.log('Calling mutation with:', waypointData);
    addWaypointMutation.mutate(waypointData);
  };

  const handleAddRestStop = () => {
    if (!newRestStop.name?.trim()) {
      alert('Vui lòng nhập tên điểm dừng chân');
      return;
    }
    
    const restStopData: CreateWaypointInput = {
      name: newRestStop.name.trim(),
      lat: location?.lat || 0,
      lng: location?.lng || 0,
      type: 'REST_STOP',
    };
    
    addWaypointMutation.mutate(restStopData);
  };

  const handleSave = () => {
    if (!tripName.trim()) {
      alert('Vui lòng nhập tên chuyến đi');
      return;
    }
    updateMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p>Không tìm thấy chuyến đi</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate(`/trips/${tripId}`)}
            className="p-2 rounded-full hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-lg">Chỉnh sửa chuyến đi</h1>
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="bg-primary-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-primary-600 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            Lưu
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Trip Name */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold mb-3">Thông tin chuyến đi</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tên chuyến đi
            </label>
            <input
              type="text"
              value={tripName}
              onChange={(e) => setTripName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="VD: Tuyển sinh Tây Ninh đợt 1"
            />
          </div>
        </div>

        {/* Waypoints List */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Danh sách điểm dừng ({waypoints.length})</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddRestStopModal(true)}
                className="text-amber-600 text-sm font-medium flex items-center gap-1 px-3 py-1.5 border border-amber-300 rounded-lg hover:bg-amber-50"
                disabled={!location}
                title={!location ? 'Đang lấy vị trí...' : 'Thêm điểm dừng chân'}
              >
                <Coffee className="w-4 h-4" />
                Dừng chân
              </button>
              <button
                onClick={() => setShowAddWaypointModal(true)}
                className="text-primary-500 text-sm font-medium flex items-center gap-1 px-3 py-1.5 border border-primary-300 rounded-lg hover:bg-primary-50"
              >
                <Plus className="w-4 h-4" />
                Thêm điểm
              </button>
            </div>
          </div>

          {waypoints.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Chưa có điểm dừng nào</p>
          ) : (
            <div className="space-y-2">
              {waypoints.map((waypoint, index) => {
                const typeInfo = getWaypointTypeInfo(waypoint.type);
                const TypeIcon = typeInfo.icon;
                
                return (
                  <div
                    key={waypoint.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-semibold text-sm">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{waypoint.name}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${typeInfo.color}`}>
                            <TypeIcon className="w-3 h-3" />
                            {typeInfo.label}
                          </span>
                        </div>
                        {waypoint.address && (
                          <p className="text-sm text-gray-500">{waypoint.address}</p>
                        )}
                        {waypoint.notes && waypoint.type === 'REST_STOP' && (
                          <p className="text-sm text-gray-600 italic">💬 {waypoint.notes}</p>
                        )}
                        <p className="text-xs text-gray-400">
                          {waypoint.lat.toFixed(6)}, {waypoint.lng.toFixed(6)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {waypoint.is_visited && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                          ✓ Đã đến
                        </span>
                      )}
                      <button
                        onClick={() => handleEditWaypoint(waypoint)}
                        className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"
                        title="Sửa thông tin"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteWaypoint(waypoint.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                        disabled={waypoint.is_visited}
                        title={waypoint.is_visited ? 'Không thể xóa điểm đã đến' : 'Xóa'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => navigate(`/trips/${tripId}`)}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="flex-1 bg-primary-500 text-white px-4 py-3 rounded-lg font-medium hover:bg-primary-600 disabled:opacity-50"
          >
            {updateMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>

      {/* Add/Edit Waypoint Modal */}
      {showAddWaypointModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">
                {editingWaypoint ? 'Sửa thông tin điểm dừng' : 'Thêm điểm dừng mới'}
              </h2>
              <button
                onClick={() => {
                  setShowAddWaypointModal(false);
                  setEditingWaypoint(null);
                  // Reset form when closing
                  setLatInput('');
                  setLngInput('');
                  setCoordinateError('');
                  setNewWaypoint({
                    name: '',
                    lat: undefined,
                    lng: undefined,
                    address: '',
                    type: 'SCHOOL',
                  });
                }}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {editingWaypoint?.is_visited && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-800">
                    ✓ <strong>Điểm này đã được đến.</strong> Bạn có thể chỉnh sửa thông tin nhưng không thể xóa.
                  </p>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tên điểm dừng *
                </label>
                <input
                  type="text"
                  value={newWaypoint.name}
                  onChange={(e) => setNewWaypoint({ ...newWaypoint, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="VD: Trường THPT Nguyễn Du"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Địa chỉ
                </label>
                <input
                  type="text"
                  value={newWaypoint.address}
                  onChange={(e) => setNewWaypoint({ ...newWaypoint, address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="VD: 123 Đường ABC, Quận 1"
                />
              </div>

              {/* Google Maps Link Input */}
              <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-3">
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
              <div className="border-t border-gray-200 pt-3">
                <p className="text-xs text-gray-600 mb-2">Hoặc nhập tọa độ thủ công</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vĩ độ (Latitude) *
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={latInput}
                    onChange={(e) => {
                      const value = e.target.value;
                      setLatInput(value);
                      setCoordinateError(''); // Clear error when user types
                      const parsed = validateAndParseCoordinate(value, 'lat');
                      if (parsed !== null || !value.trim()) {
                        setNewWaypoint({ ...newWaypoint, lat: parsed ?? undefined });
                      }
                    }}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                      coordinateError && (latInput.trim() === '' || validateAndParseCoordinate(latInput, 'lat') === null)
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-300'
                    }`}
                    placeholder="10.762622"
                  />
                  {latInput && validateAndParseCoordinate(latInput, 'lat') === null && (
                    <p className="text-xs text-red-600 mt-1">
                      Vĩ độ phải từ -90 đến 90
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Kinh độ (Longitude) *
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={lngInput}
                    onChange={(e) => {
                      const value = e.target.value;
                      setLngInput(value);
                      setCoordinateError(''); // Clear error when user types
                      const parsed = validateAndParseCoordinate(value, 'lng');
                      if (parsed !== null || !value.trim()) {
                        setNewWaypoint({ ...newWaypoint, lng: parsed ?? undefined });
                      }
                    }}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                      coordinateError && (lngInput.trim() === '' || validateAndParseCoordinate(lngInput, 'lng') === null)
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-300'
                    }`}
                    placeholder="106.682317"
                  />
                  {lngInput && validateAndParseCoordinate(lngInput, 'lng') === null && (
                    <p className="text-xs text-red-600 mt-1">
                      Kinh độ phải từ -180 đến 180
                    </p>
                  )}
                </div>
              </div>

              {coordinateError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-800">
                    ⚠️ {coordinateError}
                  </p>
                </div>
              )}
              
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-xs text-gray-600">
                  <strong>💡 Mẹo:</strong> Bạn có thể paste link Google Maps ở trên hoặc nhập tọa độ thủ công.
                  <br />
                  <strong>Cách lấy link:</strong> Mở Google Maps → Nhấn giữ vị trí → Bấm "Chia sẻ" → Copy link
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Loại điểm dừng
                </label>
                <select
                  value={newWaypoint.type}
                  onChange={(e) => setNewWaypoint({ ...newWaypoint, type: e.target.value as 'SCHOOL' | 'HOTEL' | 'HQ' | 'REST_STOP' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="SCHOOL">Trường học</option>
                  <option value="HOTEL">Khách sạn</option>
                  <option value="HQ">Trụ sở</option>
                  <option value="REST_STOP">Điểm dừng chân</option>
                </select>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  💡 <strong>Mẹo:</strong> Thông tin chi tiết (liên hệ, ghi chú, ảnh...) sẽ được bổ sung sau khi đến điểm này trên bản đồ.
                </p>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex gap-3">
              <button
                onClick={() => {
                  setShowAddWaypointModal(false);
                  setEditingWaypoint(null);
                  // Reset form when closing
                  setLatInput('');
                  setLngInput('');
                  setCoordinateError('');
                  setNewWaypoint({
                    name: '',
                    lat: undefined,
                    lng: undefined,
                    address: '',
                    type: 'SCHOOL',
                  });
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                onClick={handleAddWaypoint}
                disabled={addWaypointMutation.isPending}
                className="flex-1 bg-primary-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-600 disabled:opacity-50"
              >
                {addWaypointMutation.isPending 
                  ? (editingWaypoint ? 'Đang cập nhật...' : 'Đang thêm...') 
                  : (editingWaypoint ? 'Cập nhật' : 'Thêm điểm dừng')
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Rest Stop Modal */}
      {showAddRestStopModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Coffee className="w-5 h-5 text-amber-600" />
                Thêm điểm dừng chân
              </h2>
              <button
                onClick={() => setShowAddRestStopModal(false)}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800 flex items-start gap-2">
                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>
                    Tọa độ hiện tại sẽ được tự động sử dụng: 
                    <br />
                    <strong>{location ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}` : 'Đang lấy vị trí...'}</strong>
                  </span>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tên điểm dừng *
                </label>
                <input
                  type="text"
                  value={newRestStop.name}
                  onChange={(e) => setNewRestStop({ ...newRestStop, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  placeholder="VD: Quán cơm Bà Hai, Quán cafe..."
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  💡 <strong>Mẹo:</strong> Thông tin chi tiết (ghi chú, ảnh...) sẽ được bổ sung sau khi ấn vào điểm này trên bản đồ.
                </p>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex gap-3">
              <button
                onClick={() => setShowAddRestStopModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                onClick={handleAddRestStop}
                disabled={addWaypointMutation.isPending || !location}
                className="flex-1 bg-amber-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-amber-600 disabled:opacity-50"
              >
                {addWaypointMutation.isPending ? 'Đang thêm...' : 'Thêm điểm dừng'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditTripPage;
