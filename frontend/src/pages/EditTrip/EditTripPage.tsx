import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2, Save, X, MapPin, Coffee, School, Building2, Edit2, Loader, Search, Check } from 'lucide-react';
import { tripApi, mapsApi, schoolApi } from '../../services/api';
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

  // Danh sách trường học từ hệ thống & Quản lý chọn trường
  const { data: availableSchools = [], isLoading: isLoadingSchools } = useQuery({
    queryKey: ['schools'],
    queryFn: () => schoolApi.getAll(),
    staleTime: 60000,
  });

  const [selectedSchool, setSelectedSchool] = useState<any | null>(null);
  const [schoolSearchQuery, setSchoolSearchQuery] = useState('');
  const [modalTab, setModalTab] = useState<'SELECT_SCHOOL' | 'CUSTOM'>('SELECT_SCHOOL');

  // Lọc danh sách trường học theo từ khóa tìm kiếm
  const filteredSchools = React.useMemo(() => {
    if (!availableSchools || !Array.isArray(availableSchools)) return [];
    if (!schoolSearchQuery.trim()) return availableSchools;
    const q = schoolSearchQuery.toLowerCase().trim();
    return availableSchools.filter((s: any) =>
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.code && s.code.toLowerCase().includes(q)) ||
      (s.address && s.address.toLowerCase().includes(q))
    );
  }, [availableSchools, schoolSearchQuery]);

  // Helper function to get waypoint type info
  const getWaypointTypeInfo = (type: string) => {
    switch (type) {
      case 'SCHOOL':
        return { icon: School, label: 'Trường học', color: 'bg-blue-100 text-blue-700' };
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
      closeWaypointModal();
      setShowAddRestStopModal(false);
      setNewRestStop({
        name: '',
        lat: undefined,
        lng: undefined,
        type: 'REST_STOP',
      });
    },
    onError: (error) => {
      console.error('Mutation error:', error);
      setCoordinateError((editingWaypoint ? 'Lỗi khi cập nhật điểm dừng: ' : 'Lỗi khi thêm điểm dừng: ') + (error as any).message);
    },
  });

  const closeWaypointModal = () => {
    setShowAddWaypointModal(false);
    setEditingWaypoint(null);
    setSelectedSchool(null);
    setSchoolSearchQuery('');
    setModalTab('SELECT_SCHOOL');
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
  };

  const handleSelectSchool = (school: any) => {
    setSelectedSchool(school);
    const lat = Number(school.lat ?? school.latitude ?? 0);
    const lng = Number(school.lng ?? school.longitude ?? 0);
    setNewWaypoint((prev) => ({
      ...prev,
      name: school.name,
      school_id: school.id || school._id || school.code,
      lat,
      lng,
      address: school.address || '',
      type: 'SCHOOL',
    }));
    setLatInput(lat ? lat.toString() : '');
    setLngInput(lng ? lng.toString() : '');
    setCoordinateError('');
  };

  const handleDeleteWaypoint = (waypointId: string) => {
    if (window.confirm('Xóa điểm dừng này?')) {
      setWaypoints(waypoints.filter((w) => w.id !== waypointId));
      deleteWaypointMutation.mutate(waypointId);
    }
  };

  const handleEditWaypoint = (waypoint: Waypoint) => {
    // Pre-fill form with waypoint data
    setEditingWaypoint(waypoint);
    const sId = waypoint.school_id;
    const foundSchool = availableSchools.find(
      (s: any) => s.id === sId || s._id === sId || s.code === sId || s.name === waypoint.name
    );
    if (foundSchool) {
      setSelectedSchool(foundSchool);
      setModalTab('SELECT_SCHOOL');
    } else if (waypoint.type === 'SCHOOL') {
      setSelectedSchool(null);
      setModalTab('SELECT_SCHOOL');
    } else {
      setSelectedSchool(null);
      setModalTab('CUSTOM');
    }

    setNewWaypoint({
      name: waypoint.name,
      school_id: waypoint.school_id,
      lat: waypoint.lat,
      lng: waypoint.lng,
      address: waypoint.address || '',
      type: waypoint.type,
      notes: waypoint.notes || '',
      preferred_visit_time: (waypoint as any).preferred_visit_time || '',
    } as any);
    setLatInput(waypoint.lat ? waypoint.lat.toString() : '');
    setLngInput(waypoint.lng ? waypoint.lng.toString() : '');
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

    if (modalTab === 'SELECT_SCHOOL') {
      const chosenSchool = selectedSchool || availableSchools.find((s: any) => (s.id && s.id === newWaypoint.school_id) || s.name === newWaypoint.name);
      const targetName = (newWaypoint.name || chosenSchool?.name || '').trim();
      if (!targetName) {
        setCoordinateError('Vui lòng chọn một trường học từ danh sách');
        return;
      }

      const lat = Number(newWaypoint.lat ?? chosenSchool?.lat ?? chosenSchool?.latitude ?? 0);
      const lng = Number(newWaypoint.lng ?? chosenSchool?.lng ?? chosenSchool?.longitude ?? 0);

      if (!lat || !lng) {
        setCoordinateError('Trường này chưa có tọa độ GPS hợp lệ. Vui lòng kiểm tra lại');
        return;
      }

      setCoordinateError('');
      const waypointData: CreateWaypointInput = {
        name: targetName,
        lat,
        lng,
        school_id: newWaypoint.school_id || chosenSchool?.id || chosenSchool?._id || chosenSchool?.code,
        address: (newWaypoint.address || chosenSchool?.address || '').trim() || undefined,
        type: 'SCHOOL',
        notes: newWaypoint.notes?.trim() || undefined,
        preferred_visit_time: (newWaypoint as any).preferred_visit_time || undefined,
      } as any;

      addWaypointMutation.mutate(waypointData);
      return;
    }

    // Modal tab CUSTOM:
    if (!newWaypoint.name?.trim()) {
      setCoordinateError('Vui lòng nhập tên điểm dừng');
      return;
    }

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
      type: (newWaypoint.type as 'SCHOOL' | 'HQ' | 'REST_STOP') || 'SCHOOL',
      notes: newWaypoint.notes?.trim() || undefined,
      preferred_visit_time: (newWaypoint as any).preferred_visit_time || undefined,
    } as any;

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
      <div className="bg-white shadow-sm sticky top-0 z-10 border-b border-slate-200/80">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate(`/trips/${tripId}`)}
            className="p-2 rounded-[5px] hover:bg-slate-100 text-slate-700 transition cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-lg text-slate-900">Chỉnh sửa chuyến đi</h1>
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="bg-blue-600 text-white px-4 py-2 rounded-[5px] text-xs font-bold flex items-center gap-1.5 hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer shadow-xs"
          >
            <Save className="w-4 h-4" />
            Lưu
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {/* Trip Name */}
        <div className="bg-white rounded-[5px] shadow-sm border border-slate-200/80 p-5">
          <h2 className="font-bold text-sm text-slate-900 mb-2">Thông tin chuyến đi</h2>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Tên chuyến đi
            </label>
            <input
              type="text"
              value={tripName}
              onChange={(e) => setTripName(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-[5px] focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="VD: Tuyển sinh Tây Ninh đợt 1"
            />
          </div>
        </div>

        {/* Waypoints List */}
        <div className="bg-white rounded-[5px] shadow-sm border border-slate-200/80 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-sm text-slate-900">Danh sách điểm dừng ({waypoints.length})</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddRestStopModal(true)}
                className="text-amber-700 text-xs font-bold flex items-center gap-1.5 px-3 py-1.5 border border-amber-300 bg-amber-50/60 rounded-[5px] hover:bg-amber-100 transition cursor-pointer shadow-2xs"
                disabled={!location}
                title={!location ? 'Đang lấy vị trí...' : 'Thêm điểm dừng chân'}
              >
                <Coffee className="w-3.5 h-3.5 text-amber-600" />
                Dừng chân
              </button>
              <button
                onClick={() => setShowAddWaypointModal(true)}
                className="bg-blue-600 text-white text-xs font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] hover:bg-blue-700 transition cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Thêm điểm
              </button>
            </div>
          </div>

          {waypoints.length === 0 ? (
            <div className="text-slate-400 text-center py-8 border border-dashed border-slate-200 rounded-[5px] text-xs">
              Chưa có điểm dừng nào trong chuyến đi
            </div>
          ) : (
            <div className="space-y-2">
              {waypoints.map((waypoint, index) => {
                const typeInfo = getWaypointTypeInfo(waypoint.type);
                const TypeIcon = typeInfo.icon;
                
                return (
                  <div
                    key={waypoint.id}
                    className="flex items-center justify-between p-3.5 border border-slate-200/90 rounded-[5px] bg-white hover:bg-slate-50/70 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 bg-blue-50 text-blue-700 border border-blue-200 rounded-[5px] flex items-center justify-center font-bold text-xs shrink-0">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-xs sm:text-sm text-slate-900 truncate">{waypoint.name}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-[5px] font-semibold flex items-center gap-1 ${typeInfo.color}`}>
                            <TypeIcon className="w-3 h-3" />
                            {typeInfo.label}
                          </span>
                        </div>
                        {waypoint.address && (
                          <p className="text-xs text-slate-500 truncate mt-0.5">{waypoint.address}</p>
                        )}
                        {waypoint.notes && waypoint.type === 'REST_STOP' && (
                          <p className="text-xs text-slate-600 italic mt-0.5">💬 {waypoint.notes}</p>
                        )}
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {waypoint.lat.toFixed(6)}, {waypoint.lng.toFixed(6)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {waypoint.is_visited && (
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-[5px] font-bold">
                          ✓ Đã đến
                        </span>
                      )}
                      <button
                        onClick={() => handleEditWaypoint(waypoint)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-[5px] transition cursor-pointer"
                        title="Sửa thông tin"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteWaypoint(waypoint.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-[5px] transition cursor-pointer disabled:opacity-40"
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
            className="flex-1 px-4 py-2.5 border border-slate-300 rounded-[5px] text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-[5px] text-xs font-bold hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer shadow-xs"
          >
            {updateMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>

      {/* Add/Edit Waypoint Modal */}
      {showAddWaypointModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[9999] p-3 sm:p-4">
          <div className="bg-white rounded-[5px] max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/90 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[5px] bg-[#E8F1FC] text-[#1A56DB] flex items-center justify-center shrink-0">
                  <School className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                    {editingWaypoint ? 'Sửa thông tin điểm dừng' : 'Thêm điểm dừng vào chuyến đi'}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Chọn trường học từ danh mục có sẵn trên hệ thống
                  </p>
                </div>
              </div>
              <button
                onClick={closeWaypointModal}
                className="p-1.5 rounded-[5px] hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                title="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switch Tabs */}
            <div className="px-5 pt-3 pb-0 bg-white border-b border-slate-100 flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setModalTab('SELECT_SCHOOL')}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                  modalTab === 'SELECT_SCHOOL'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <School className="w-3.5 h-3.5" />
                <span>Chọn trường có sẵn ({availableSchools.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setModalTab('CUSTOM')}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                  modalTab === 'CUSTOM'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Nhập điểm tùy chỉnh khác</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
              {modalTab === 'SELECT_SCHOOL' ? (
                <>
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={schoolSearchQuery}
                      onChange={(e) => setSchoolSearchQuery(e.target.value)}
                      placeholder="Tìm trường theo tên, mã trường, địa chỉ..."
                      className="w-full pl-9 pr-9 py-2 text-xs bg-slate-50 border border-slate-200 rounded-[5px] focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none"
                    />
                    {schoolSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setSchoolSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* School List */}
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {isLoadingSchools ? (
                      <div className="py-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                        <Loader className="w-4 h-4 animate-spin text-blue-600" />
                        <span>Đang tải danh mục trường học...</span>
                      </div>
                    ) : filteredSchools.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-500">
                        Không tìm thấy trường nào phù hợp với từ khóa "{schoolSearchQuery}"
                      </div>
                    ) : (
                      filteredSchools.map((school: any) => {
                        const sId = school.id || school._id || school.code;
                        const isSelected = selectedSchool?.id === sId || selectedSchool?._id === sId || newWaypoint.school_id === sId || newWaypoint.name === school.name;
                        const alreadyInTrip = waypoints.some((w) => w.school_id === sId || w.name === school.name);

                        return (
                          <div
                            key={sId}
                            onClick={() => handleSelectSchool(school)}
                            className={`p-3 rounded-[5px] border transition cursor-pointer flex items-center justify-between gap-3 ${
                              isSelected
                                ? 'bg-blue-50/80 border-blue-500 ring-1 ring-blue-400'
                                : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50/60'
                            }`}
                          >
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                              <div
                                className={`w-8 h-8 rounded-[5px] flex items-center justify-center shrink-0 mt-0.5 ${
                                  isSelected ? 'bg-blue-600 text-white' : 'bg-[#E8F1FC] text-[#1A56DB]'
                                }`}
                              >
                                <School className="w-4 h-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h4 className="text-xs font-bold text-slate-900 truncate">
                                    {school.name}
                                  </h4>
                                  {school.code && (
                                    <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-[5px]">
                                      {school.code}
                                    </span>
                                  )}
                                  {alreadyInTrip && (
                                    <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded-[5px]">
                                      Đã có trong chuyến
                                    </span>
                                  )}
                                </div>
                                {school.address && (
                                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                    📍 {school.address}
                                  </p>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectSchool(school);
                              }}
                              className={`px-3 py-1.5 text-xs font-bold rounded-[5px] shrink-0 transition cursor-pointer ${
                                isSelected
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : 'bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-600 border border-slate-200/80'
                              }`}
                            >
                              {isSelected ? (
                                <span className="flex items-center gap-1">
                                  <Check className="w-3.5 h-3.5" /> Đã chọn
                                </span>
                              ) : (
                                'Chọn'
                              )}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Selected School Card & Optional Time/Notes */}
                  {selectedSchool ? (
                    <div className="bg-blue-50/70 border border-blue-200 rounded-[5px] p-3.5 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wide">
                            ⭐ Trường được chọn
                          </span>
                          <h4 className="text-xs font-bold text-slate-900 truncate mt-0.5">
                            {selectedSchool.name}
                          </h4>
                          {selectedSchool.address && (
                            <p className="text-[11px] text-slate-600 truncate mt-0.5">
                              📍 {selectedSchool.address}
                            </p>
                          )}
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Tọa độ: {Number(selectedSchool.lat ?? selectedSchool.latitude).toFixed(6)}, {Number(selectedSchool.lng ?? selectedSchool.longitude).toFixed(6)}
                          </p>
                        </div>
                        <span className="px-2 py-0.5 bg-blue-600 text-white rounded-[5px] text-[10px] font-bold shrink-0">
                          Sẵn sàng lưu
                        </span>
                      </div>

                      {/* Giờ ghé thăm dự kiến & Ghi chú */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-blue-200/60">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Giờ ghé thăm dự kiến (Tùy chọn)
                          </label>
                          <input
                            type="time"
                            value={(newWaypoint as any).preferred_visit_time || ''}
                            onChange={(e) =>
                              setNewWaypoint({ ...newWaypoint, preferred_visit_time: e.target.value } as any)
                            }
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-blue-200 rounded-[5px] focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Ghi chú cho điểm dừng
                          </label>
                          <input
                            type="text"
                            value={newWaypoint.notes || ''}
                            onChange={(e) => setNewWaypoint({ ...newWaypoint, notes: e.target.value })}
                            placeholder="VD: Gặp Ban giám hiệu..."
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-blue-200 rounded-[5px] focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-[5px] text-center text-xs text-slate-500">
                      Vui lòng nhấp vào một trường học ở danh sách trên để chọn vào chuyến đi.
                    </div>
                  )}
                </>
              ) : (
                /* TAB 2: NHẬP THỦ CÔNG */
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tên điểm dừng *
                    </label>
                    <input
                      type="text"
                      value={newWaypoint.name}
                      onChange={(e) => setNewWaypoint({ ...newWaypoint, name: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-[5px] focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      placeholder="VD: Trụ sở / Điểm dừng chân..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Địa chỉ
                    </label>
                    <input
                      type="text"
                      value={newWaypoint.address}
                      onChange={(e) => setNewWaypoint({ ...newWaypoint, address: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-[5px] focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      placeholder="VD: 123 Đường ABC..."
                    />
                  </div>

                  {/* Google Maps Link Input */}
                  <div className="bg-blue-50/70 border border-blue-200 rounded-[5px] p-3">
                    <p className="text-xs font-semibold text-slate-700 mb-1.5">📍 Lấy tọa độ từ Google Maps</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={linkInput}
                        onChange={(e) => setLinkInput(e.target.value)}
                        placeholder="Dán link từ Google Maps..."
                        className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-[5px] focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        disabled={isParsingLink}
                      />
                      <button
                        type="button"
                        onClick={handlePasteGoogleMapsLink}
                        disabled={isParsingLink}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-[5px] text-xs font-bold hover:bg-blue-700 disabled:bg-slate-400 flex items-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        {isParsingLink ? (
                          <>
                            <Loader className="w-3.5 h-3.5 animate-spin" />
                            Đang xử lý
                          </>
                        ) : (
                          'Lấy tọa độ'
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Manual coordinates */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Vĩ độ (Latitude) *
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={latInput}
                        onChange={(e) => {
                          const value = e.target.value;
                          setLatInput(value);
                          setCoordinateError('');
                          const parsed = validateAndParseCoordinate(value, 'lat');
                          if (parsed !== null || !value.trim()) {
                            setNewWaypoint({ ...newWaypoint, lat: parsed ?? undefined });
                          }
                        }}
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-[5px] focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="10.762622"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Kinh độ (Longitude) *
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={lngInput}
                        onChange={(e) => {
                          const value = e.target.value;
                          setLngInput(value);
                          setCoordinateError('');
                          const parsed = validateAndParseCoordinate(value, 'lng');
                          if (parsed !== null || !value.trim()) {
                            setNewWaypoint({ ...newWaypoint, lng: parsed ?? undefined });
                          }
                        }}
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-[5px] focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="106.682317"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Loại điểm dừng
                    </label>
                    <select
                      value={newWaypoint.type}
                      onChange={(e) => setNewWaypoint({ ...newWaypoint, type: e.target.value as 'SCHOOL' | 'HQ' | 'REST_STOP' })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-[5px] focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                    >
                      <option value="SCHOOL">Trường học</option>
                      <option value="HQ">Trụ sở</option>
                      <option value="REST_STOP">Điểm dừng chân</option>
                    </select>
                  </div>
                </>
              )}

              {coordinateError && (
                <div className="bg-red-50 border border-red-200 rounded-[5px] p-2.5">
                  <p className="text-xs text-red-700 font-medium">
                    ⚠️ {coordinateError}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white border-t border-slate-200 px-5 py-3.5 flex gap-2.5 shrink-0">
              <button
                type="button"
                onClick={closeWaypointModal}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-[5px] text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleAddWaypoint}
                disabled={addWaypointMutation.isPending}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-[5px] text-xs font-bold hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer shadow-xs"
              >
                {addWaypointMutation.isPending
                  ? (editingWaypoint ? 'Đang cập nhật...' : 'Đang thêm...')
                  : (editingWaypoint ? 'Cập nhật điểm dừng' : 'Thêm vào lộ trình')
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Rest Stop Modal */}
      {showAddRestStopModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-[5px] max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Coffee className="w-5 h-5 text-amber-600" />
                Thêm điểm dừng chân
              </h2>
              <button
                onClick={() => setShowAddRestStopModal(false)}
                className="p-2 rounded-[5px] hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-[5px] p-3">
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-[5px] focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  placeholder="VD: Quán cơm Bà Hai, Quán cafe..."
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-[5px] p-3">
                <p className="text-sm text-blue-800">
                  💡 <strong>Mẹo:</strong> Thông tin chi tiết (ghi chú, ảnh...) sẽ được bổ sung sau khi ấn vào điểm này trên bản đồ.
                </p>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex gap-3">
              <button
                onClick={() => setShowAddRestStopModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-[5px] font-medium hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                onClick={handleAddRestStop}
                disabled={addWaypointMutation.isPending || !location}
                className="flex-1 bg-amber-500 text-white px-4 py-2 rounded-[5px] font-medium hover:bg-amber-600 disabled:opacity-50"
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
