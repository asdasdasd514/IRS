import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Pencil,
  Eye,
  Save,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  LayoutGrid,
  Building2,
  MapPin,
  Phone,
  User,
  Globe,
  ExternalLink,
  CheckCircle2,
  X,
  Palette,
  Layers,
  Sliders,
  Image as ImageIcon,
  FileText,
  Users,
  GraduationCap,
  Map,
  BarChart2,
  Sparkles,
  GripVertical,
  Database,
  Upload,
  FolderOpen,
  Cloud,
  Check,
  Compass,
  ChevronLeft,
  ChevronRight,
  Undo2,
  Redo2
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { schoolApi } from '../../../services/api';
import { useAppStore } from '../../../store/useAppStore';
import type { School, SchoolBlock } from '../../../types';

// Cấu hình các Theme giao diện (Tone màu nền và viền trang)
export const THEMES: Record<string, {
  id: string;
  name: string;
  desc: string;
  canvasBg: string;
  containerBorder: string;
  containerShadow: string;
  color: string;
}> = {
  slate: {
    id: 'slate',
    name: 'Slate Hiện Đại',
    desc: 'Tone xám trung tính, thanh lịch',
    canvasBg: 'bg-slate-100',
    containerBorder: 'border-slate-200',
    containerShadow: 'shadow-sm',
    color: 'bg-slate-100 border-slate-300',
  },
  blue: {
    id: 'blue',
    name: 'Navy Tuyển Sinh',
    desc: 'Sắc xanh dương thương hiệu',
    canvasBg: 'bg-gradient-to-br from-blue-100/70 via-slate-50 to-blue-50/80',
    containerBorder: 'border-blue-200/90',
    containerShadow: 'shadow-lg shadow-blue-900/10',
    color: 'bg-blue-50 border-blue-200',
  },
  warm: {
    id: 'warm',
    name: 'Ấm Áp Tươi Trẻ',
    desc: 'Sắc vàng cam phấn ấm cúng',
    canvasBg: 'bg-gradient-to-br from-amber-100/60 via-orange-50/40 to-amber-50/80',
    containerBorder: 'border-amber-200/90',
    containerShadow: 'shadow-lg shadow-amber-900/10',
    color: 'bg-amber-50 border-amber-200',
  },
  clean: {
    id: 'clean',
    name: 'Thuần Khiết Trắng',
    desc: 'Giao diện tối giản trắng tinh',
    canvasBg: 'bg-white',
    containerBorder: 'border-slate-200',
    containerShadow: 'shadow-xs',
    color: 'bg-white border-slate-300',
  },
};

const schoolMarkerIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Danh sách các mẫu khối sẵn có (Block Templates)
const BLOCK_TEMPLATES: Array<{
  type: SchoolBlock['type'];
  title: string;
  desc: string;
  icon: any;
  defaultBlock: (school?: School) => SchoolBlock;
}> = [
  {
    type: 'hero',
    title: 'Ảnh bìa & Tiêu đề (Hero)',
    desc: 'Banner lớn, tên trường, mã trường, địa chỉ và nút gọi nhanh',
    icon: ImageIcon,
    defaultBlock: () => ({
      id: `block-${Date.now()}-hero`,
      type: 'hero',
      title: '',
      subtitle: '',
      bgColor: 'white',
      data: {
        bannerUrl: '',
        code: '',
        badge: '',
        address: '',
        phone: '',
        website: '',
      },
    }),
  },
  {
    type: 'rich_text',
    title: 'Khối thông tin & giới thiệu',
    desc: 'Khối văn bản thông tin, bài viết giới thiệu do bạn tự nhập',
    icon: FileText,
    defaultBlock: () => ({
      id: `block-${Date.now()}-text`,
      type: 'rich_text',
      title: '',
      subtitle: '',
      content: '',
      bgColor: 'white',
      data: {},
    }),
  },
  {
    type: 'leadership',
    title: 'Ban Giám Hiệu & Liên Hệ',
    desc: 'Thông tin Hiệu trưởng, Hiệu phó và các đầu mối liên hệ',
    icon: Users,
    defaultBlock: () => ({
      id: `block-${Date.now()}-board`,
      type: 'leadership',
      title: '',
      subtitle: '',
      bgColor: 'white',
      data: {
        principalName: '',
        principalPhone: '',
        vicePrincipalName: '',
        vicePrincipalPhone: '',
        repName: '',
        repPhone: '',
        website: '',
      },
    }),
  },
  {
    type: 'map',
    title: 'Bản Đồ Tọa Độ Thực Địa',
    desc: 'Bản đồ tương tác Leaflet hiển thị tọa độ GPS chính xác và Google Maps',
    icon: Map,
    defaultBlock: () => ({
      id: `block-${Date.now()}-map`,
      type: 'map',
      title: '',
      subtitle: '',
      bgColor: 'white',
      data: {
        address: '',
        lat: undefined,
        lng: undefined,
        website: '',
      },
    }),
  },
  {
    type: 'admissions',
    title: 'Thông Tin Tuyển Sinh & Ghi Chú',
    desc: 'Ghi chú công tác tuyển sinh, hotline và thông báo tuyển sinh',
    icon: GraduationCap,
    defaultBlock: () => ({
      id: `block-${Date.now()}-admissions`,
      type: 'admissions',
      title: '',
      subtitle: '',
      bgColor: 'white',
      data: {
        targetGroups: '',
        notes: '',
        hotline: '',
        website: '',
      },
    }),
  },
  {
    type: 'gallery',
    title: 'Thư Viện Hình Ảnh',
    desc: 'Lưới ảnh chụp cơ sở vật chất và hoạt động thực tế',
    icon: LayoutGrid,
    defaultBlock: () => ({
      id: `block-${Date.now()}-gallery`,
      type: 'gallery',
      title: '',
      subtitle: '',
      bgColor: 'white',
      data: {
        images: [],
      },
    }),
  },
  {
    type: 'stats',
    title: 'Thông Số & Tọa Độ Tuyển Sinh',
    desc: 'Hộp số liệu tọa độ, mã định danh, tình trạng định vị GPS',
    icon: BarChart2,
    defaultBlock: () => ({
      id: `block-${Date.now()}-stats`,
      type: 'stats',
      title: '',
      subtitle: '',
      bgColor: 'white',
      data: {
        stats: [],
      },
    }),
  },
];

// Sinh bộ khối mặc định cho trường học mới
function generateInitialBlocks(school: School): SchoolBlock[] {
  return [
    {
      id: `block-${Date.now()}-hero`,
      type: 'hero',
      title: school.name,
      subtitle: school.description || `Hồ sơ thông tin chính thức của ${school.name}`,
      bgColor: 'white',
      data: {
        bannerUrl: school.banner_url || school.image_url || '',
        code: school.code || 'SCH',
        badge: '',
        address: school.address || '',
        phone: school.principal_phone || school.school_board?.principal_phone || '',
        website: school.website || '',
      },
    },
    {
      id: `block-${Date.now()}-text`,
      type: 'rich_text',
      title: 'Giới thiệu & Thông tin trường',
      subtitle: `Thông tin chi tiết về ${school.name}`,
      content: school.description || `Trường ${school.name} (Mã định danh: ${school.code || 'Đang cập nhật'}) tọa lạc tại địa chỉ ${school.address || 'chưa cập nhật'}. Trường nằm trong danh mục điểm đến trọng điểm phục vụ công tác tuyển sinh lưu động và định hướng nghề nghiệp cho học sinh, sinh viên.`,
      bgColor: 'white',
      data: {},
    },
    {
      id: `block-${Date.now()}-gallery`,
      type: 'gallery',
      title: 'Hình Ảnh Khuôn Viên & Thực Địa',
      subtitle: `Tư liệu hình ảnh thực tế ghi nhận tại ${school.name}`,
      bgColor: 'white',
      data: {
        images: school.images && school.images.length > 0
          ? school.images.map((url) => ({ url }))
          : [],
      },
    },
  ];
}

export function AdminSchoolDetailPage() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const navigate = useNavigate();
  const currentUser = useAppStore((state) => state.user);
  const isAdmin = currentUser?.role === 'admin' || currentUser?.is_admin;

  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Form State cho các thông tin Backend trường học
  const [schoolInfo, setSchoolInfo] = useState({
    name: '',
    code: '',
    address: '',
    lat: '',
    lng: '',
    principal_name: '',
    principal_phone: '',
    vice_principal_name: '',
    vice_principal_phone: '',
    website: '',
    description: '',
    notes: '',
  });

  // Chế độ Biên tập WordPress Style
  const [isEditing, setIsEditing] = useState(false);
  // Main tabs (khi KHÔNG chọn khối): 'info' (hồ sơ) | 'layers' (khối) | 'templates' (thêm) | 'media' (kho ảnh) | 'theme' (giao diện)
  const [activeMainTab, setActiveMainTab] = useState<'info' | 'layers' | 'templates' | 'media' | 'theme'>('info');
  // Khi chọn 1 khối, sidebar chuyển sang chế độ "Điều chỉnh khối"
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  // State khối chỉnh sửa và giao diện
  const [blocks, setBlocks] = useState<SchoolBlock[]>([]);
  const [bannerUrl, setBannerUrl] = useState('');
  const [themeBg, setThemeBg] = useState('slate'); // slate, blue, warm, clean

  // Lịch sử thao tác (Undo / Redo History)
  const [history, setHistory] = useState<Array<{ blocks: SchoolBlock[]; themeBg: string }>>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const debounceHistoryTimer = useRef<any>(null);

  const recordHistory = (newBlocks: SchoolBlock[], newTheme: string = themeBg) => {
    const cloneBlocks = JSON.parse(JSON.stringify(newBlocks));
    setHistory((prev) => {
      const next = prev.slice(0, historyIndex + 1);
      const updated = [...next, { blocks: cloneBlocks, themeBg: newTheme }];
      if (updated.length > 50) updated.shift();
      return updated;
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 49));
  };

  const debounceRecordHistory = (newBlocks: SchoolBlock[], newTheme: string = themeBg) => {
    if (debounceHistoryTimer.current) {
      clearTimeout(debounceHistoryTimer.current);
    }
    debounceHistoryTimer.current = setTimeout(() => {
      recordHistory(newBlocks, newTheme);
    }, 400);
  };

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex >= 0 && historyIndex < history.length - 1;

  const handleUndo = () => {
    if (!canUndo) return;
    const targetIndex = historyIndex - 1;
    const target = history[targetIndex];
    if (target) {
      setBlocks(JSON.parse(JSON.stringify(target.blocks)));
      setThemeBg(target.themeBg);
      setHistoryIndex(targetIndex);
    }
  };

  const handleRedo = () => {
    if (!canRedo) return;
    const targetIndex = historyIndex + 1;
    const target = history[targetIndex];
    if (target) {
      setBlocks(JSON.parse(JSON.stringify(target.blocks)));
      setThemeBg(target.themeBg);
      setHistoryIndex(targetIndex);
    }
  };

  // Lắng nghe phím tắt Ctrl+Z (Undo) và Ctrl+Y / Ctrl+Shift+Z (Redo)
  useEffect(() => {
    const handleUndoRedoShortcuts = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          if (!isInput) {
            e.preventDefault();
            handleUndo();
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        if (!isInput) {
          e.preventDefault();
          handleRedo();
        }
      }
    };

    window.addEventListener('keydown', handleUndoRedoShortcuts);
    return () => window.removeEventListener('keydown', handleUndoRedoShortcuts);
  }, [history, historyIndex, canUndo, canRedo]);

  // State Kéo & Thả (Drag and Drop)
  const [draggedBlockIndex, setDraggedBlockIndex] = useState<number | null>(null);
  const [dragOverBlockIndex, setDragOverBlockIndex] = useState<number | null>(null);

  // State Kho Ảnh Trường Học (Media Library)
  const [mediaLibrary, setMediaLibrary] = useState<Array<{ id: string; url: string; filename?: string; created_at?: string }>>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [mediaPickerTarget, setMediaPickerTarget] = useState<{
    type: 'banner' | 'theme_banner' | 'gallery_add' | 'gallery_replace';
    index?: number;
  } | null>(null);

  // State Lightbox xem ảnh to & thumbnail carousel
  const [lightboxData, setLightboxData] = useState<{
    images: Array<{ url: string; caption?: string }>;
    currentIndex: number;
  } | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!lightboxData) return;
      if (e.key === 'Escape') {
        setLightboxData(null);
      } else if (e.key === 'ArrowLeft') {
        setLightboxData((prev) =>
          prev
            ? {
                ...prev,
                currentIndex: (prev.currentIndex - 1 + prev.images.length) % prev.images.length,
              }
            : null
        );
      } else if (e.key === 'ArrowRight') {
        setLightboxData((prev) =>
          prev
            ? {
                ...prev,
                currentIndex: (prev.currentIndex + 1) % prev.images.length,
              }
            : null
        );
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxData]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const generalUploadRef = useRef<HTMLInputElement>(null);

  // Load School & Kho Ảnh từ Backend
  const loadSchool = async () => {
    if (!schoolId) return;
    try {
      setLoading(true);
      const data = await schoolApi.getById(schoolId);
      setSchool(data);
      setSchoolInfo({
        name: data.name || '',
        code: data.code || '',
        address: data.address || '',
        lat: data.lat != null ? String(data.lat) : '',
        lng: data.lng != null ? String(data.lng) : '',
        principal_name: data.principal_name || data.school_board?.principal_name || '',
        principal_phone: data.principal_phone || data.school_board?.principal_phone || '',
        vice_principal_name: data.school_board?.vice_principal_name || '',
        vice_principal_phone: data.school_board?.vice_principal_phone || '',
        website: data.website || '',
        description: data.description || '',
        notes: data.notes || '',
      });
      setBannerUrl(data.banner_url || data.image_url || '');
      const initialTheme = data.theme?.bgPattern || 'slate';
      setThemeBg(initialTheme);

      let initialBlocks: SchoolBlock[] = [];
      if (data.blocks && Array.isArray(data.blocks) && data.blocks.length > 0) {
        initialBlocks = data.blocks;
      } else {
        initialBlocks = generateInitialBlocks(data);
      }
      setBlocks(initialBlocks);
      setHistory([{ blocks: JSON.parse(JSON.stringify(initialBlocks)), themeBg: initialTheme }]);
      setHistoryIndex(0);

      // Tải kho ảnh của trường từ Cloudinary/MongoDB
      loadMediaLibrary(schoolId);
    } catch (err) {
      console.error('Error fetching school:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMediaLibrary = async (targetId: string) => {
    try {
      setLoadingMedia(true);
      const media = await schoolApi.getMediaLibrary(targetId);
      setMediaLibrary(media);
    } catch (err) {
      console.error('Error fetching media library:', err);
    } finally {
      setLoadingMedia(false);
    }
  };

  useEffect(() => {
    loadSchool();
  }, [schoolId]);

  // Upload ảnh từ máy tính lên Cloudinary trong thư mục tên trường
  const handleFileUpload = async (file: File, target?: typeof mediaPickerTarget) => {
    if (!schoolId || !file) return;
    try {
      setIsUploading(true);
      const res = await schoolApi.uploadImage(schoolId, file);
      if (res.success && res.url) {
        const newItem = {
          id: res.public_id || Date.now().toString(),
          url: res.url,
          filename: res.filename || file.name,
          created_at: new Date().toISOString(),
        };
        setMediaLibrary((prev) => [newItem, ...prev]);

        // Cập nhật trường tương ứng nếu có target
        if (target) {
          if (target.type === 'banner') {
            handleUpdateBlockData('bannerUrl', res.url);
          } else if (target.type === 'theme_banner') {
            setBannerUrl(res.url);
          } else if (target.type === 'gallery_add' && selectedBlock) {
            const currentImgs = selectedBlock.data?.images || [];
            handleUpdateBlockData('images', [...currentImgs, { url: res.url, caption: res.filename || 'Ảnh khuôn viên' }]);
          } else if (target.type === 'gallery_replace' && target.index !== undefined && selectedBlock) {
            const currentImgs = [...(selectedBlock.data?.images || [])];
            currentImgs[target.index] = { ...currentImgs[target.index], url: res.url };
            handleUpdateBlockData('images', currentImgs);
          }
          setMediaPickerTarget(null);
        }
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Lỗi khi tải ảnh lên Cloudinary');
    } finally {
      setIsUploading(false);
    }
  };

  // Chọn ảnh có sẵn trong Kho ảnh trường học
  const handleSelectFromMediaLibrary = (url: string) => {
    if (!mediaPickerTarget) return;

    if (mediaPickerTarget.type === 'banner') {
      handleUpdateBlockData('bannerUrl', url);
    } else if (mediaPickerTarget.type === 'theme_banner') {
      setBannerUrl(url);
    } else if (mediaPickerTarget.type === 'gallery_add' && selectedBlock) {
      const currentImgs = selectedBlock.data?.images || [];
      handleUpdateBlockData('images', [...currentImgs, { url, caption: 'Ảnh khuôn viên' }]);
    } else if (mediaPickerTarget.type === 'gallery_replace' && mediaPickerTarget.index !== undefined && selectedBlock) {
      const currentImgs = [...(selectedBlock.data?.images || [])];
      currentImgs[mediaPickerTarget.index] = { ...currentImgs[mediaPickerTarget.index], url };
      handleUpdateBlockData('images', currentImgs);
    }
    setMediaPickerTarget(null);
  };

  // Lưu cả thông tin trường trong Backend và cấu trúc khối vào MongoDB
  const handleSavePage = async () => {
    if (!schoolId || !school) return;
    try {
      setSaving(true);
      const targetId = school.id || (school as any)._id;

      const payload: any = {
        name: schoolInfo.name.trim(),
        code: schoolInfo.code.trim(),
        address: schoolInfo.address.trim(),
        lat: schoolInfo.lat ? parseFloat(schoolInfo.lat) : school.lat,
        lng: schoolInfo.lng ? parseFloat(schoolInfo.lng) : school.lng,
        principal_name: schoolInfo.principal_name.trim(),
        principal_phone: schoolInfo.principal_phone.trim(),
        school_board: {
          principal_name: schoolInfo.principal_name.trim(),
          principal_phone: schoolInfo.principal_phone.trim(),
          vice_principal_name: schoolInfo.vice_principal_name.trim(),
          vice_principal_phone: schoolInfo.vice_principal_phone.trim(),
        },
        website: schoolInfo.website.trim(),
        description: schoolInfo.description.trim(),
        notes: schoolInfo.notes.trim(),
        banner_url: bannerUrl.trim(),
        theme: {
          bgPattern: themeBg,
        },
        blocks: blocks,
      };

      const updated = await schoolApi.update(targetId, payload);
      setSchool(updated);
      setSaveSuccessMsg('Đã lưu thành công dữ liệu trường và cấu trúc các khối vào MongoDB!');
      setTimeout(() => setSaveSuccessMsg(null), 3500);
      setIsEditing(false);
      setSelectedBlockId(null);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Lỗi khi lưu thông tin trường học');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSchoolInfo = (field: string, value: string) => {
    setSchoolInfo((prev) => {
      const updated = { ...prev, [field]: value };
      setSchool((curr) => (curr ? { ...curr, [field]: value } : null));
      return updated;
    });
  };

  const handleAddBlock = (template: typeof BLOCK_TEMPLATES[0]) => {
    if (!school) return;
    const newBlock = template.defaultBlock(school);
    const nextBlocks = [...blocks, newBlock];
    setBlocks(nextBlocks);
    setSelectedBlockId(newBlock.id);
    recordHistory(nextBlocks);
  };

  const handleDeleteBlock = (blockId: string) => {
    const nextBlocks = blocks.filter((b) => b.id !== blockId);
    setBlocks(nextBlocks);
    if (selectedBlockId === blockId) {
      setSelectedBlockId(null);
    }
    recordHistory(nextBlocks);
  };

  const handleMoveBlockUp = (index: number) => {
    if (index <= 0) return;
    const next = [...blocks];
    const temp = next[index - 1];
    next[index - 1] = next[index];
    next[index] = temp;
    setBlocks(next);
    recordHistory(next);
  };

  const handleMoveBlockDown = (index: number) => {
    if (index >= blocks.length - 1) return;
    const next = [...blocks];
    const temp = next[index + 1];
    next[index + 1] = next[index];
    next[index] = temp;
    setBlocks(next);
    recordHistory(next);
  };

  // Kéo & Thả (Drag & Drop) Handler
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedBlockIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `block:${index}`);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedBlockIndex === null) return;
    if (dragOverBlockIndex !== index) {
      setDragOverBlockIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const templateType = e.dataTransfer.getData('template_type');

    if (templateType && school) {
      const tmpl = BLOCK_TEMPLATES.find((t) => t.type === templateType);
      if (tmpl) {
        const newBlock = tmpl.defaultBlock(school);
        const next = [...blocks];
        next.splice(targetIndex, 0, newBlock);
        setBlocks(next);
        setSelectedBlockId(newBlock.id);
        recordHistory(next);
      }
      setDraggedBlockIndex(null);
      setDragOverBlockIndex(null);
      return;
    }

    if (draggedBlockIndex === null || draggedBlockIndex === targetIndex) {
      setDraggedBlockIndex(null);
      setDragOverBlockIndex(null);
      return;
    }

    const updated = [...blocks];
    const [moved] = updated.splice(draggedBlockIndex, 1);
    updated.splice(targetIndex, 0, moved);
    setBlocks(updated);
    recordHistory(updated);

    setDraggedBlockIndex(null);
    setDragOverBlockIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedBlockIndex(null);
    setDragOverBlockIndex(null);
  };

  const handleUpdateBlockField = (field: keyof SchoolBlock, value: any) => {
    if (!selectedBlockId) return;
    const next = blocks.map((b) => (b.id === selectedBlockId ? { ...b, [field]: value } : b));
    setBlocks(next);
    debounceRecordHistory(next);
  };

  const handleUpdateBlockData = (key: string, value: any) => {
    if (!selectedBlockId) return;
    const next = blocks.map((b) =>
      b.id === selectedBlockId
        ? { ...b, data: { ...(b.data || {}), [key]: value } }
        : b
    );
    setBlocks(next);
    debounceRecordHistory(next);
  };

  const handleSelectTheme = (themeId: string) => {
    setThemeBg(themeId);
    recordHistory(blocks, themeId);
  };

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-3 border-blue-600/30 border-t-[#0f3b7d] rounded-full animate-spin mb-3" />
        <p className="text-sm font-semibold text-slate-500">Đang tải hồ sơ trường học từ máy chủ...</p>
      </div>
    );
  }

  if (!school) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20 bg-white rounded-2xl border border-slate-200">
        <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-800">Không tìm thấy thông tin trường học</h2>
        <button
          onClick={() => navigate('/admin/locations')}
          className="mt-4 px-4 py-2 bg-[#0f3b7d] text-white text-xs font-semibold rounded-xl"
        >
          Quay lại danh mục trường
        </button>
      </div>
    );
  }

  return (
    <div className="-m-4 sm:-m-6 lg:-m-8 flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-slate-100">
      {/* Input File ẩn phục vụ upload ảnh từ máy */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleFileUpload(file, mediaPickerTarget);
          }
          e.target.value = '';
        }}
      />

      <input
        type="file"
        ref={generalUploadRef}
        className="hidden"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleFileUpload(file);
          }
          e.target.value = '';
        }}
      />

      {/* 1. TOP HEADER TOOLBAR (KHÔNG CÓ SCROLLBAR NGANG) */}
      <div className="bg-white border-b border-slate-200/80 px-4 sm:px-6 py-2.5 flex items-center justify-between shrink-0 z-30 shadow-2xs overflow-x-hidden">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/admin/locations')}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition shrink-0"
            title="Quay lại danh mục trường"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 truncate">
                {school.name}
              </h1>
              {school.code && (
                <span className="text-[10.5px] font-mono font-bold bg-blue-50 text-[#0f3b7d] px-2 py-0.5 rounded-md shrink-0">
                  {school.code}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 truncate flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
              <span>{school.address || 'Chưa cập nhật địa chỉ'}</span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          {saveSuccessMsg && (
            <div className="hidden md:flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 font-medium animate-slide-up">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {isAdmin && (
            <>
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleUndo}
                    disabled={!canUndo}
                    title="Hoàn tác (Ctrl+Z)"
                    className="px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition flex items-center gap-1.5 shadow-2xs"
                  >
                    <Undo2 className="w-3.5 h-3.5 text-slate-600" />
                    <span className="hidden md:inline">Hoàn tác</span>
                  </button>

                  <button
                    onClick={handleRedo}
                    disabled={!canRedo}
                    title="Làm lại (Ctrl+Y)"
                    className="px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition flex items-center gap-1.5 shadow-2xs"
                  >
                    <Redo2 className="w-3.5 h-3.5 text-slate-600" />
                    <span className="hidden md:inline">Làm lại</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setSelectedBlockId(null);
                    }}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition flex items-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Xem trước</span>
                  </button>

                  <button
                    onClick={handleSavePage}
                    disabled={saving}
                    className="px-4 py-1.5 rounded-xl bg-[#0f3b7d] hover:bg-[#0c2f64] text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{saving ? 'Đang lưu...' : 'Lưu trang & Dữ liệu'}</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-1.5 rounded-xl bg-[#0f3b7d] hover:bg-[#0c2f64] text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Chỉnh sửa trang</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* 2. BODY WORKSPACE: LIVE CANVAS (LEFT) + WORDPRESS PANEL (RIGHT) */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* === LIVE CANVAS (KHU VỰC HIỂN THỊ TRANG TRƯỜNG & KÉO THẢ) === */}
        <div
          onClick={(e) => {
            // Khi nhấp ra nền canvas ngoài khối, thoát chế độ điều chỉnh khối
            if (e.target === e.currentTarget && selectedBlockId) {
              setSelectedBlockId(null);
            }
          }}
          className={`flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 no-scrollbar transition-colors duration-300 ${
            THEMES[themeBg]?.canvasBg || 'bg-slate-100'
          }`}
        >
          {isEditing && (
            <div className="w-full max-w-6xl xl:max-w-7xl mx-auto bg-blue-50/80 border border-blue-200/80 rounded-2xl p-3 text-xs text-blue-800 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  <strong>Chế độ kéo thả đang bật:</strong> Nhấp vào khối để điều chỉnh nội dung bên phải. Kéo thả để thay đổi vị trí.
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleUndo}
                  disabled={!canUndo}
                  title="Hoàn tác (Ctrl+Z)"
                  className="px-2 py-1 rounded-lg bg-white border border-blue-200 text-blue-800 hover:bg-blue-100 disabled:opacity-35 flex items-center gap-1 font-semibold text-[11px] transition"
                >
                  <Undo2 className="w-3 h-3" />
                  <span>Hoàn tác</span>
                </button>
                <button
                  onClick={handleRedo}
                  disabled={!canRedo}
                  title="Làm lại (Ctrl+Y)"
                  className="px-2 py-1 rounded-lg bg-white border border-blue-200 text-blue-800 hover:bg-blue-100 disabled:opacity-35 flex items-center gap-1 font-semibold text-[11px] transition"
                >
                  <Redo2 className="w-3 h-3" />
                  <span>Làm lại</span>
                </button>
                <span className="text-[11px] font-semibold bg-white text-blue-700 px-2.5 py-0.5 rounded-md border border-blue-200">
                  {blocks.length} khối
                </span>
              </div>
            </div>
          )}

          <div
            className={`w-full max-w-6xl xl:max-w-7xl mx-auto rounded-3xl border overflow-hidden transition-all duration-300 ${
              THEMES[themeBg]?.containerBorder || 'border-slate-200'
            } ${THEMES[themeBg]?.containerShadow || 'shadow-sm'}`}
          >
            {blocks.map((block, index) => {
              const isSelected = isEditing && selectedBlockId === block.id;
              const isDragging = draggedBlockIndex === index;
              const isOver = dragOverBlockIndex === index && draggedBlockIndex !== index;

              return (
                <div
                  key={block.id}
                  draggable={isEditing}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isEditing) {
                      setSelectedBlockId(block.id);
                    }
                  }}
                  className={`relative transition-all duration-200 ${
                    isEditing ? 'cursor-pointer group hover:ring-2 hover:ring-blue-400/80' : ''
                  } ${isSelected ? 'ring-3 ring-[#0f3b7d] shadow-md z-10' : ''} ${
                    isDragging ? 'opacity-30 scale-[0.99] border-2 border-dashed border-blue-500' : ''
                  } ${isOver ? 'border-t-4 border-t-blue-600 bg-blue-50/30' : ''}`}
                >
                  {/* Floating Action Controls on top of Block (Khi ở chế độ Edit) */}
                  {isEditing && (
                    <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5 bg-white/95 backdrop-blur-xs p-1 rounded-xl shadow-md border border-slate-200/80 opacity-90 group-hover:opacity-100 transition-opacity">
                      <div
                        className="cursor-grab active:cursor-grabbing p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg flex items-center gap-1 select-none"
                        title="Kéo để di chuyển khối này"
                      >
                        <GripVertical className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-semibold">Kéo</span>
                      </div>

                      <div className="w-px h-3.5 bg-slate-200" />

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveBlockUp(index);
                        }}
                        disabled={index === 0}
                        title="Di chuyển lên"
                        className="p-1 text-slate-500 hover:text-[#0f3b7d] hover:bg-slate-100 rounded-lg disabled:opacity-30"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveBlockDown(index);
                        }}
                        disabled={index === blocks.length - 1}
                        title="Di chuyển xuống"
                        className="p-1 text-slate-500 hover:text-[#0f3b7d] hover:bg-slate-100 rounded-lg disabled:opacity-30"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedBlockId(block.id);
                        }}
                        title="Điều chỉnh khối này"
                        className={`p-1 rounded-lg transition ${
                          isSelected ? 'bg-[#0f3b7d] text-white' : 'text-slate-500 hover:text-blue-600 hover:bg-slate-100'
                        }`}
                      >
                        <Sliders className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBlock(block.id);
                        }}
                        title="Xóa khối"
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Render khối */}
                  <BlockRenderer
                    block={block}
                    school={school}
                    isSelected={isSelected}
                    isEditing={isEditing}
                    onOpenLightbox={(imgs, idx) => setLightboxData({ images: imgs, currentIndex: idx })}
                  />
                </div>
              );
            })}

            {blocks.length === 0 && (
              <div className="py-20 text-center px-4">
                <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-700">Trang chưa có khối nội dung nào</p>
                <p className="text-xs text-slate-400 mt-1">
                  Chọn tab "Thêm khối" ở bảng công cụ bên phải để kéo hoặc thêm mẫu khối vào trang.
                </p>
                {isEditing && (
                  <button
                    onClick={() => setBlocks(generateInitialBlocks(school))}
                    className="mt-4 px-4 py-2 bg-[#0f3b7d] text-white text-xs font-semibold rounded-xl inline-flex items-center gap-2"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Nạp bộ khối mẫu mặc định</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* === RIGHT SIDEBAR: WORDPRESS-STYLE BUILDER PANEL === */}
        {isEditing && (
          <div className="w-96 bg-white border-l border-slate-200/90 flex flex-col h-full shrink-0 shadow-lg z-20 animate-slide-left overflow-x-hidden">
            {/* TRƯỜNG HỢP 1: ĐANG CHỌN 1 KHỐI -> HIỆN BỘ ĐIỀU CHỈNH KHỐI CÓ NÚT "← QUAY LẠI" */}
            {selectedBlock ? (
              <div className="flex flex-col h-full">
                {/* Header Điều Chỉnh Khối với Nút Quay Lại */}
                <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
                  <button
                    onClick={() => setSelectedBlockId(null)}
                    className="flex items-center gap-1.5 text-xs font-bold text-[#0f3b7d] hover:text-[#0c2f64] bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-2xs transition"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Quay lại danh sách</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase font-mono font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                      {selectedBlock.type}
                    </span>
                    <button
                      onClick={() => handleDeleteBlock(selectedBlock.id)}
                      title="Xóa khối này"
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Nội dung Tùy Chỉnh Khối */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs text-slate-700 no-scrollbar">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Điều chỉnh nội dung khối</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Chỉnh sửa thông tin, văn bản, màu nền và tải ảnh từ máy lên cho khối này.
                    </p>
                  </div>

                  {/* Tiêu đề & Phụ đề */}
                  <div className="space-y-3">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Tiêu đề chính</label>
                      <input
                        type="text"
                        value={selectedBlock.title || ''}
                        onChange={(e) => handleUpdateBlockField('title', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-[#0f3b7d]/20 focus:border-[#0f3b7d]"
                        placeholder="Nhập tiêu đề..."
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Tiêu đề phụ / Slogan</label>
                      <input
                        type="text"
                        value={selectedBlock.subtitle || ''}
                        onChange={(e) => handleUpdateBlockField('subtitle', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-[#0f3b7d]/20 focus:border-[#0f3b7d]"
                        placeholder="Nhập phụ đề..."
                      />
                    </div>

                    {/* Chi tiết cho khối Hero Banner */}
                    {selectedBlock.type === 'hero' && (
                      <div className="space-y-3 pt-2 border-t border-slate-200">
                        <label className="font-semibold text-slate-700 block mb-1">Hình ảnh Ảnh Bìa (Hero Banner)</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setMediaPickerTarget({ type: 'banner' });
                              fileInputRef.current?.click();
                            }}
                            className="flex-1 py-2 px-3 bg-blue-50 text-[#0f3b7d] hover:bg-blue-100 font-semibold rounded-xl flex items-center justify-center gap-1.5 transition text-xs"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Tải ảnh từ máy</span>
                          </button>

                          <button
                            onClick={() => {
                              setMediaPickerTarget({ type: 'banner' });
                            }}
                            className="py-2 px-3 border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold rounded-xl flex items-center gap-1.5 transition text-xs"
                          >
                            <FolderOpen className="w-3.5 h-3.5" />
                            <span>Kho ảnh</span>
                          </button>
                        </div>

                        {selectedBlock.data?.bannerUrl && (
                          <div className="relative rounded-xl overflow-hidden aspect-16/7 border border-slate-200 mt-2">
                            <img
                              src={selectedBlock.data.bannerUrl}
                              alt="Banner preview"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}

                        <div>
                          <label className="font-semibold text-slate-600 block text-[11px] mb-1">Hoặc dán URL ảnh</label>
                          <input
                            type="text"
                            value={selectedBlock.data?.bannerUrl || ''}
                            onChange={(e) => handleUpdateBlockData('bannerUrl', e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                            placeholder="https://..."
                          />
                        </div>

                        <div className="pt-2">
                          <label className="font-semibold text-slate-700 block text-[11px] mb-1">Mã trường (Code)</label>
                          <input
                            type="text"
                            value={selectedBlock.data?.code || ''}
                            onChange={(e) => handleUpdateBlockData('code', e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono font-semibold"
                            placeholder="Mã viết tắt trường..."
                          />
                        </div>

                        <div>
                          <label className="font-semibold text-slate-700 block text-[11px] mb-1">Địa chỉ</label>
                          <input
                            type="text"
                            value={selectedBlock.data?.address || ''}
                            onChange={(e) => handleUpdateBlockData('address', e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                            placeholder="Địa chỉ trường..."
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="font-semibold text-slate-700 block text-[11px] mb-1">Hotline / SĐT</label>
                            <input
                              type="text"
                              value={selectedBlock.data?.phone || ''}
                              onChange={(e) => handleUpdateBlockData('phone', e.target.value)}
                              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                              placeholder="028..."
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-slate-700 block text-[11px] mb-1">Website</label>
                            <input
                              type="text"
                              value={selectedBlock.data?.website || ''}
                              onChange={(e) => handleUpdateBlockData('website', e.target.value)}
                              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                              placeholder="https://..."
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Chi tiết cho khối Rich Text */}
                    {selectedBlock.type === 'rich_text' && (
                      <div className="pt-2 border-t border-slate-200 space-y-3">
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">
                            Nội dung thông tin / giới thiệu
                          </label>
                          <p className="text-[11px] text-slate-400 mb-1.5">
                            Nhập toàn bộ thông tin giới thiệu, lịch sử hình thành hoặc các ghi chú bạn muốn truyền tải.
                          </p>
                          <textarea
                            rows={8}
                            value={selectedBlock.content || ''}
                            onChange={(e) => handleUpdateBlockField('content', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-[#0f3b7d]/20 focus:border-[#0f3b7d] leading-relaxed"
                            placeholder="Nhập thông tin giới thiệu chi tiết về trường..."
                          />
                        </div>
                      </div>
                    )}

                    {/* Chi tiết cho khối Ban Giám Hiệu */}
                    {selectedBlock.type === 'leadership' && (
                      <div className="space-y-3 border-t border-slate-200 pt-2">
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">Họ tên Hiệu trưởng</label>
                          <input
                            type="text"
                            value={selectedBlock.data?.principalName || ''}
                            onChange={(e) => handleUpdateBlockData('principalName', e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                            placeholder="NGƯT.PGS.TS..."
                          />
                        </div>
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">SĐT Hiệu trưởng</label>
                          <input
                            type="text"
                            value={selectedBlock.data?.principalPhone || ''}
                            onChange={(e) => handleUpdateBlockData('principalPhone', e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                            placeholder="09..."
                          />
                        </div>
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">Họ tên Hiệu phó / Đại diện</label>
                          <input
                            type="text"
                            value={selectedBlock.data?.vicePrincipalName || ''}
                            onChange={(e) => handleUpdateBlockData('vicePrincipalName', e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                            placeholder="Thầy/Cô..."
                          />
                        </div>
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">SĐT Hiệu phó / Đại diện</label>
                          <input
                            type="text"
                            value={selectedBlock.data?.vicePrincipalPhone || ''}
                            onChange={(e) => handleUpdateBlockData('vicePrincipalPhone', e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                            placeholder="09..."
                          />
                        </div>
                      </div>
                    )}

                    {/* Chi tiết cho khối Bản Đồ */}
                    {selectedBlock.type === 'map' && (
                      <div className="space-y-2 border-t border-slate-200 pt-2">
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">Địa chỉ hiển thị</label>
                          <input
                            type="text"
                            value={selectedBlock.data?.address || ''}
                            onChange={(e) => handleUpdateBlockData('address', e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                            placeholder="Địa chỉ trường học..."
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="font-semibold text-slate-700 block mb-1">Vĩ độ (Lat)</label>
                            <input
                              type="number"
                              step="any"
                              value={selectedBlock.data?.lat != null ? selectedBlock.data.lat : ''}
                              onChange={(e) => handleUpdateBlockData('lat', e.target.value ? parseFloat(e.target.value) : undefined)}
                              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                              placeholder="10.8..."
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-slate-700 block mb-1">Kinh độ (Lng)</label>
                            <input
                              type="number"
                              step="any"
                              value={selectedBlock.data?.lng != null ? selectedBlock.data.lng : ''}
                              onChange={(e) => handleUpdateBlockData('lng', e.target.value ? parseFloat(e.target.value) : undefined)}
                              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                              placeholder="106.6..."
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Chi tiết cho khối Thư Viện Ảnh (Gallery) */}
                    {selectedBlock.type === 'gallery' && (
                      <div className="space-y-3 border-t border-slate-200 pt-2">
                        <div className="flex items-center justify-between">
                          <label className="font-semibold text-slate-700">Danh sách ảnh khuôn viên</label>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => {
                                setMediaPickerTarget({ type: 'gallery_add' });
                                fileInputRef.current?.click();
                              }}
                              className="px-2 py-1 bg-blue-50 text-[#0f3b7d] rounded-lg text-[11px] font-semibold flex items-center gap-1 hover:bg-blue-100"
                            >
                              <Upload className="w-3 h-3" />
                              <span>Tải từ máy</span>
                            </button>
                            <button
                              onClick={() => setMediaPickerTarget({ type: 'gallery_add' })}
                              className="px-2 py-1 border border-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold flex items-center gap-1 hover:bg-slate-50"
                            >
                              <FolderOpen className="w-3 h-3" />
                              <span>Kho ảnh</span>
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar pr-1">
                          {(selectedBlock.data?.images || []).map((img: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 p-1.5 bg-slate-50 rounded-xl border border-slate-200">
                              <img src={img.url} alt="" className="w-12 h-9 object-cover rounded-lg shrink-0" />
                              <input
                                type="text"
                                value={img.caption || ''}
                                onChange={(e) => {
                                  const next = [...(selectedBlock.data?.images || [])];
                                  next[i] = { ...next[i], caption: e.target.value };
                                  handleUpdateBlockData('images', next);
                                }}
                                className="flex-1 px-2 py-1 border border-slate-200 rounded text-[11px] bg-white"
                                placeholder="Chú thích ảnh..."
                              />
                              <button
                                onClick={() => {
                                  const next = (selectedBlock.data?.images || []).filter((_: any, idx: number) => idx !== i);
                                  handleUpdateBlockData('images', next);
                                }}
                                className="p-1 text-slate-400 hover:text-red-600 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                          {(!selectedBlock.data?.images || selectedBlock.data.images.length === 0) && (
                            <div className="py-4 text-center border border-dashed border-slate-200 rounded-xl">
                              <p className="text-[11px] text-slate-400">Chưa có ảnh nào. Bấm "Tải từ máy" hoặc "Kho ảnh" để thêm.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Chi tiết cho khối Thông Tin Tuyển Sinh */}
                    {selectedBlock.type === 'admissions' && (
                      <div className="space-y-3 border-t border-slate-200 pt-2">
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">Đối tượng tuyển sinh mục tiêu</label>
                          <input
                            type="text"
                            value={selectedBlock.data?.targetGroups || ''}
                            onChange={(e) => handleUpdateBlockData('targetGroups', e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                            placeholder="VD: Học sinh THPT lớp 12, phụ huynh..."
                          />
                        </div>
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">Ghi chú & Phương án phối hợp</label>
                          <textarea
                            rows={3}
                            value={selectedBlock.data?.notes || ''}
                            onChange={(e) => handleUpdateBlockData('notes', e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                            placeholder="VD: Lưu ý kiểm tra lịch học trước khi đến trường..."
                          />
                        </div>
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">Đường dây nóng tuyển sinh (Hotline)</label>
                          <input
                            type="text"
                            value={selectedBlock.data?.hotline || ''}
                            onChange={(e) => handleUpdateBlockData('hotline', e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                            placeholder="VD: 0909 123 456..."
                          />
                        </div>
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">Cổng thông tin tuyển sinh trực tuyến (URL)</label>
                          <input
                            type="text"
                            value={selectedBlock.data?.website || ''}
                            onChange={(e) => handleUpdateBlockData('website', e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                            placeholder="https://tuyensinh..."
                          />
                        </div>
                      </div>
                    )}

                    {/* Chi tiết cho khối Thống Kê / Chỉ Số */}
                    {selectedBlock.type === 'stats' && (
                      <div className="space-y-3 border-t border-slate-200 pt-2">
                        <div className="flex items-center justify-between">
                          <label className="font-semibold text-slate-700">Danh sách chỉ số</label>
                          <button
                            onClick={() => {
                              const currentStats = selectedBlock.data?.stats || [];
                              handleUpdateBlockData('stats', [...currentStats, { value: '', label: '' }]);
                            }}
                            className="px-2 py-1 bg-blue-50 text-[#0f3b7d] rounded-lg text-[11px] font-semibold flex items-center gap-1 hover:bg-blue-100"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Thêm chỉ số</span>
                          </button>
                        </div>

                        <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar pr-1">
                          {(selectedBlock.data?.stats || []).map((st: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200">
                              <input
                                type="text"
                                value={st.value || ''}
                                onChange={(e) => {
                                  const next = [...(selectedBlock.data?.stats || [])];
                                  next[i] = { ...next[i], value: e.target.value };
                                  handleUpdateBlockData('stats', next);
                                }}
                                className="w-24 px-2 py-1 border border-slate-200 rounded text-xs bg-white font-bold"
                                placeholder="Giá trị..."
                              />
                              <input
                                type="text"
                                value={st.label || ''}
                                onChange={(e) => {
                                  const next = [...(selectedBlock.data?.stats || [])];
                                  next[i] = { ...next[i], label: e.target.value };
                                  handleUpdateBlockData('stats', next);
                                }}
                                className="flex-1 px-2 py-1 border border-slate-200 rounded text-xs bg-white"
                                placeholder="Tên chỉ số..."
                              />
                              <button
                                onClick={() => {
                                  const next = (selectedBlock.data?.stats || []).filter((_: any, idx: number) => idx !== i);
                                  handleUpdateBlockData('stats', next);
                                }}
                                className="p-1 text-slate-400 hover:text-red-600 rounded"
                                title="Xóa chỉ số"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                          {(!selectedBlock.data?.stats || selectedBlock.data.stats.length === 0) && (
                            <p className="text-[11px] text-slate-400 italic text-center py-2">
                              Chưa có chỉ số nào. Bấm "+ Thêm chỉ số" bên trên để thêm.
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Chân bảng điều khiển khối */}
                <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
                  <button
                    onClick={() => setSelectedBlockId(null)}
                    className="px-3 py-1.5 text-slate-600 hover:text-slate-800 font-semibold"
                  >
                    Xong
                  </button>
                  <button
                    onClick={handleSavePage}
                    disabled={saving}
                    className="px-4 py-1.5 bg-[#0f3b7d] hover:bg-[#0c2f64] text-white font-semibold rounded-xl shadow-xs flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Lưu trang</span>
                  </button>
                </div>
              </div>
            ) : (
              /* TRƯỜNG HỢP 2: KHÔNG CHỌN KHỐI -> HIỂN THỊ CÁC TAB CHÍNH (KHÔNG CÓ SCROLLBAR NGANG) */
              <div className="flex flex-col h-full">
                {/* Thanh Tabs Chính Gọn Gàng, Không Scrollbar Ngang */}
                {/* Thanh Tabs Chính: Hồ sơ - Khối - Thêm - Kho ảnh - Theme */}
                <div className="grid grid-cols-5 border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 shrink-0">
                  <button
                    onClick={() => setActiveMainTab('info')}
                    className={`py-2.5 flex flex-col items-center gap-1 transition ${
                      activeMainTab === 'info'
                        ? 'text-[#0f3b7d] border-b-2 border-[#0f3b7d] bg-white font-bold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span>Hồ sơ</span>
                  </button>

                  <button
                    onClick={() => setActiveMainTab('layers')}
                    className={`py-2.5 flex flex-col items-center gap-1 transition ${
                      activeMainTab === 'layers'
                        ? 'text-[#0f3b7d] border-b-2 border-[#0f3b7d] bg-white font-bold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Khối</span>
                  </button>

                  <button
                    onClick={() => setActiveMainTab('templates')}
                    className={`py-2.5 flex flex-col items-center gap-1 transition ${
                      activeMainTab === 'templates'
                        ? 'text-[#0f3b7d] border-b-2 border-[#0f3b7d] bg-white font-bold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm</span>
                  </button>

                  <button
                    onClick={() => setActiveMainTab('media')}
                    className={`py-2.5 flex flex-col items-center gap-1 transition relative ${
                      activeMainTab === 'media'
                        ? 'text-[#0f3b7d] border-b-2 border-[#0f3b7d] bg-white font-bold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    <span>Kho ảnh</span>
                    {mediaLibrary.length > 0 && (
                      <span className="absolute top-1.5 right-2 w-1.5 h-1.5 bg-blue-600 rounded-full" />
                    )}
                  </button>

                  <button
                    onClick={() => setActiveMainTab('theme')}
                    className={`py-2.5 flex flex-col items-center gap-1 transition ${
                      activeMainTab === 'theme'
                        ? 'text-[#0f3b7d] border-b-2 border-[#0f3b7d] bg-white font-bold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Palette className="w-3.5 h-3.5" />
                    <span>Theme</span>
                  </button>
                </div>

                {/* Nội dung Tab Chính */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs text-slate-700 no-scrollbar">
                  {/* TAB 1: HỒ SƠ TRƯỜNG GỐC */}
                  {activeMainTab === 'info' && (
                    <div className="space-y-3">
                      <div>
                        <h3 className="font-bold text-slate-900 text-xs">Hồ sơ trường học</h3>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">Tên trường học *</label>
                          <input
                            type="text"
                            value={schoolInfo.name}
                            onChange={(e) => handleUpdateSchoolInfo('name', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="font-semibold text-slate-700 block mb-1">Mã trường (Code)</label>
                            <input
                              type="text"
                              value={schoolInfo.code}
                              onChange={(e) => handleUpdateSchoolInfo('code', e.target.value.toUpperCase())}
                              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono font-semibold"
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-slate-700 block mb-1">Website chính thức</label>
                            <input
                              type="text"
                              value={schoolInfo.website}
                              onChange={(e) => handleUpdateSchoolInfo('website', e.target.value)}
                              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">Địa chỉ thực địa</label>
                          <textarea
                            rows={2}
                            value={schoolInfo.address}
                            onChange={(e) => handleUpdateSchoolInfo('address', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="font-semibold text-slate-700 block mb-1">Vĩ độ GPS (Lat)</label>
                            <input
                              type="text"
                              value={schoolInfo.lat}
                              onChange={(e) => handleUpdateSchoolInfo('lat', e.target.value)}
                              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-slate-700 block mb-1">Kinh độ GPS (Lng)</label>
                            <input
                              type="text"
                              value={schoolInfo.lng}
                              onChange={(e) => handleUpdateSchoolInfo('lng', e.target.value)}
                              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono"
                            />
                          </div>
                        </div>

                        <div className="border-t border-slate-200 pt-3 space-y-3">
                          <p className="font-bold text-slate-800 text-xs">Ban Giám Hiệu & Liên Hệ Trực Tiếp</p>
                          <div>
                            <label className="font-semibold text-slate-700 block mb-1">Họ tên Hiệu trưởng</label>
                            <input
                              type="text"
                              value={schoolInfo.principal_name}
                              onChange={(e) => handleUpdateSchoolInfo('principal_name', e.target.value)}
                              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-slate-700 block mb-1">SĐT Hiệu trưởng / Hotline</label>
                            <input
                              type="text"
                              value={schoolInfo.principal_phone}
                              onChange={(e) => handleUpdateSchoolInfo('principal_phone', e.target.value)}
                              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: CẤU TRÚC KHỐI & KÉO THẢ */}
                  {activeMainTab === 'layers' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-slate-900 text-xs">Danh sách khối</p>
                        <span className="text-[11px] text-slate-500">{blocks.length} khối</span>
                      </div>

                      <div className="space-y-2 mt-2">
                        {blocks.map((b, idx) => {
                          const tmpl = BLOCK_TEMPLATES.find((t) => t.type === b.type);
                          const IconComponent = tmpl ? tmpl.icon : Layers;

                          return (
                            <div
                              key={b.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, idx)}
                              onDragOver={(e) => handleDragOver(e, idx)}
                              onDrop={(e) => handleDrop(e, idx)}
                              onDragEnd={handleDragEnd}
                              onClick={() => setSelectedBlockId(b.id)}
                              className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition select-none ${
                                selectedBlockId === b.id
                                  ? 'border-[#0f3b7d] bg-blue-50/70 ring-1 ring-[#0f3b7d]'
                                  : 'border-slate-200 bg-white hover:border-slate-300'
                              } ${draggedBlockIndex === idx ? 'opacity-30 border-dashed border-blue-500' : ''} ${
                                dragOverBlockIndex === idx ? 'border-t-4 border-t-blue-600' : ''
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-slate-700 rounded">
                                  <GripVertical className="w-4 h-4" />
                                </div>
                                <div className="w-7 h-7 rounded-lg bg-slate-100 text-[#0f3b7d] flex items-center justify-center shrink-0">
                                  <IconComponent className="w-3.5 h-3.5" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-800 truncate text-[11.5px]">
                                    {b.title || tmpl?.title}
                                  </p>
                                  <span className="text-[10px] text-slate-400 uppercase font-mono">
                                    #{idx + 1} • {b.type}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMoveBlockUp(idx);
                                  }}
                                  disabled={idx === 0}
                                  className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMoveBlockDown(idx);
                                  }}
                                  disabled={idx === blocks.length - 1}
                                  className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteBlock(b.id);
                                  }}
                                  className="p-1 text-slate-400 hover:text-red-600"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <button
                        onClick={() => setActiveMainTab('templates')}
                        className="w-full mt-3 py-2.5 rounded-xl border border-dashed border-blue-400 text-blue-700 font-semibold text-xs hover:bg-blue-50 transition flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Thêm khối mới vào trang</span>
                      </button>
                    </div>
                  )}

                  {/* TAB 3: THÊM KHỐI MỚI */}
                  {activeMainTab === 'templates' && (
                    <div className="space-y-3">
                      <div>
                        <h3 className="font-bold text-slate-900 text-xs">Thêm khối</h3>
                      </div>

                      <div className="grid grid-cols-1 gap-2.5">
                        {BLOCK_TEMPLATES.map((tmpl) => {
                          const Icon = tmpl.icon;
                          return (
                            <div
                              key={tmpl.type}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData('template_type', tmpl.type);
                              }}
                              onClick={() => handleAddBlock(tmpl)}
                              className="p-3 bg-white hover:bg-blue-50/50 border border-slate-200/90 hover:border-blue-300 rounded-2xl cursor-pointer transition shadow-2xs group flex items-start justify-between gap-3"
                            >
                              <div className="flex items-start gap-3">
                                <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#0f3b7d] group-hover:bg-[#0f3b7d] group-hover:text-white transition flex items-center justify-center shrink-0">
                                  <Icon className="w-4 h-4" />
                                </div>
                                <div>
                                  <p className="font-bold text-slate-800 group-hover:text-[#0f3b7d] transition text-xs">
                                    {tmpl.title}
                                  </p>
                                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                                    {tmpl.desc}
                                  </p>
                                </div>
                              </div>

                              <div className="shrink-0 pt-1">
                                <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg group-hover:bg-[#0f3b7d] group-hover:text-white transition inline-flex items-center gap-1">
                                  <Plus className="w-3 h-3" />
                                  <span>Thêm</span>
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* TAB 4: KHO ẢNH */}
                  {activeMainTab === 'media' && (
                    <div className="space-y-4">
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50/60 border border-blue-200/70 rounded-2xl p-3">
                        <div className="flex items-center justify-between mb-2.5">
                          <p className="font-bold text-blue-950 text-xs flex items-center gap-1.5">
                            <Cloud className="w-4 h-4 text-blue-600" />
                            <span>Kho ảnh</span>
                          </p>
                          <span className="text-[10.5px] font-semibold bg-white px-2 py-0.5 rounded-md text-blue-700 border border-blue-200">
                            {mediaLibrary.length} ảnh
                          </span>
                        </div>

                        <button
                          onClick={() => generalUploadRef.current?.click()}
                          disabled={isUploading}
                          className="w-full py-2 bg-[#0f3b7d] hover:bg-[#0c2f64] text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-2xs transition disabled:opacity-50"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>{isUploading ? 'Đang tải ảnh...' : 'Tải ảnh từ máy tính lên kho'}</span>
                        </button>
                      </div>

                      {/* Lưới ảnh trong kho */}
                      <div>
                        <p className="font-semibold text-slate-700 text-xs mb-2">Tất cả ảnh trong kho</p>
                        {loadingMedia ? (
                          <div className="py-8 text-center text-slate-400">
                            <div className="w-6 h-6 border-2 border-blue-600/30 border-t-[#0f3b7d] rounded-full animate-spin mx-auto mb-2" />
                            <span>Đang kiểm tra kho ảnh...</span>
                          </div>
                        ) : mediaLibrary.length === 0 ? (
                          <div className="py-8 text-center border border-dashed border-slate-200 rounded-2xl">
                            <FolderOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            <p className="font-semibold text-slate-600 text-xs">Chưa có ảnh nào trong kho</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">Nhấp nút tải ảnh bên trên để đưa ảnh đầu tiên lên.</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto no-scrollbar pr-1">
                            {mediaLibrary.map((item, idx) => (
                              <div
                                key={idx}
                                className="group relative rounded-xl overflow-hidden aspect-4/3 border border-slate-200 bg-slate-100 shadow-2xs"
                              >
                                <img src={item.url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex flex-col justify-between p-2 text-white">
                                  <p className="text-[10px] truncate font-medium">{item.filename || 'Ảnh'}</p>
                                  <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="self-end p-1 bg-white/20 hover:bg-white/40 rounded text-white"
                                    title="Mở xem kích thước đầy đủ"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 5: THEME & GIAO DIỆN */}
                  {activeMainTab === 'theme' && (
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-bold text-slate-900 text-xs">Giao diện</h3>
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-2">Tone màu nền trang</label>
                        <div className="grid grid-cols-2 gap-2.5">
                          {Object.values(THEMES).map((t) => (
                            <button
                              key={t.id}
                              onClick={() => handleSelectTheme(t.id)}
                              className={`p-3 rounded-2xl border text-left transition ${
                                themeBg === t.id
                                  ? 'border-[#0f3b7d] ring-2 ring-[#0f3b7d]/20 bg-blue-50/40 shadow-xs'
                                  : 'border-slate-200 hover:border-slate-300 bg-white'
                              }`}
                            >
                              <div className={`w-full h-8 rounded-lg mb-2 border ${t.color}`} />
                              <p className="font-bold text-slate-800 text-xs">{t.name}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">{t.desc}</p>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200 space-y-2">
                        <label className="font-semibold text-slate-700 block mb-1">Ảnh bìa mặc định của trường (Banner URL)</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setMediaPickerTarget({ type: 'theme_banner' });
                              fileInputRef.current?.click();
                            }}
                            className="flex-1 py-1.5 px-3 bg-blue-50 text-[#0f3b7d] rounded-xl text-xs font-semibold flex items-center justify-center gap-1 hover:bg-blue-100"
                          >
                            <Upload className="w-3 h-3" />
                            <span>Tải từ máy</span>
                          </button>
                          <button
                            onClick={() => setMediaPickerTarget({ type: 'theme_banner' })}
                            className="py-1.5 px-3 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1 hover:bg-slate-50"
                          >
                            <FolderOpen className="w-3 h-3" />
                            <span>Kho ảnh</span>
                          </button>
                        </div>
                        <input
                          type="text"
                          value={bannerUrl}
                          onChange={(e) => setBannerUrl(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Chân sidebar */}
                <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs shrink-0">
                  <span className="text-slate-500 font-medium">IRS Admissions</span>
                  <button
                    onClick={handleSavePage}
                    disabled={saving}
                    className="px-4 py-2 bg-[#0f3b7d] hover:bg-[#0c2f64] text-white font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{saving ? 'Đang lưu...' : 'Lưu tất cả'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL CHỌN ẢNH TỪ KHO ẢNH TRƯỜNG HỌC (MEDIA PICKER MODAL) */}
      {mediaPickerTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-scale-up">
            {/* Header modal */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#0f3b7d] flex items-center justify-center font-bold">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Kho ảnh</h3>
                  <p className="text-xs text-slate-500">Chọn ảnh có sẵn hoặc tải ảnh mới từ máy tính</p>
                </div>
              </div>

              <button
                onClick={() => setMediaPickerTarget(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nội dung kho ảnh */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 no-scrollbar space-y-4">
              <div className="flex items-center justify-between bg-blue-50/70 p-3 rounded-2xl border border-blue-200/70">
                <span className="text-xs text-blue-900 font-medium">
                  {mediaLibrary.length} ảnh trong kho
                </span>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="px-3 py-1.5 bg-[#0f3b7d] hover:bg-[#0c2f64] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isUploading ? 'Đang tải...' : 'Tải ảnh mới từ máy'}</span>
                </button>
              </div>

              {mediaLibrary.length === 0 ? (
                <div className="py-12 text-center">
                  <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                  <p className="font-bold text-slate-700 text-sm">Kho ảnh của trường hiện đang trống</p>
                  <p className="text-xs text-slate-400 mt-1">Bấm "Tải ảnh mới từ máy" bên trên để thêm ảnh đầu tiên.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {mediaLibrary.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleSelectFromMediaLibrary(item.url)}
                      className="group relative rounded-2xl overflow-hidden aspect-4/3 border-2 border-slate-200 hover:border-blue-600 bg-slate-100 cursor-pointer shadow-xs transition"
                    >
                      <img src={item.url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent opacity-0 group-hover:opacity-100 transition flex flex-col justify-end p-2.5">
                        <p className="text-white text-[11px] font-medium truncate mb-1">{item.filename || 'Ảnh'}</p>
                        <span className="self-start px-2 py-0.5 bg-blue-600 text-white rounded text-[10px] font-bold flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>Chọn ảnh này</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer modal */}
            <div className="p-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
              <button
                onClick={() => setMediaPickerTarget(null)}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. LIGHTBOX / PHOTO VIEWER MODAL VỚI THUMBNAIL CAROUSEL VÀ PHÍM ĐỔI ẢNH */}
      {lightboxData && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between select-none animate-fade-in">
          {/* Top Bar */}
          <div className="p-4 sm:p-5 flex items-center justify-between text-white border-b border-white/10 shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-sm sm:text-base font-bold text-white/90">
                {school.name}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white font-mono text-xs font-semibold">
                {lightboxData.currentIndex + 1} / {lightboxData.images.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden md:inline-block text-xs text-white/40 mr-2">
                Dùng phím &larr; &rarr; hoặc ESC
              </span>
              <button
                onClick={() => setLightboxData(null)}
                className="p-2 text-white/70 hover:text-white hover:bg-white/15 rounded-full transition"
                title="Đóng xem ảnh (ESC)"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Center Stage: Large Photo & Arrows */}
          <div className="flex-1 flex items-center justify-between px-2 sm:px-6 relative min-h-0">
            <button
              onClick={() =>
                setLightboxData((prev) =>
                  prev
                    ? {
                        ...prev,
                        currentIndex: (prev.currentIndex - 1 + prev.images.length) % prev.images.length,
                      }
                    : null
                )
              }
              className="p-3 sm:p-4 text-white/80 hover:text-white hover:bg-white/20 rounded-full transition shrink-0 z-10"
              title="Ảnh trước"
            >
              <ChevronLeft className="w-8 h-8 sm:w-10 sm:h-10" />
            </button>

            <div className="flex-1 flex items-center justify-center p-2 sm:p-4 max-h-full">
              <img
                src={lightboxData.images[lightboxData.currentIndex]?.url}
                alt=""
                className="max-h-[62vh] sm:max-h-[70vh] w-auto max-w-[85vw] object-contain rounded-2xl shadow-2xl transition duration-200"
              />
            </div>

            <button
              onClick={() =>
                setLightboxData((prev) =>
                  prev
                    ? {
                        ...prev,
                        currentIndex: (prev.currentIndex + 1) % prev.images.length,
                      }
                    : null
                )
              }
              className="p-3 sm:p-4 text-white/80 hover:text-white hover:bg-white/20 rounded-full transition shrink-0 z-10"
              title="Ảnh kế tiếp"
            >
              <ChevronRight className="w-8 h-8 sm:w-10 sm:h-10" />
            </button>
          </div>

          {/* Bottom Thumbnails Strip */}
          <div className="p-3 sm:p-4 border-t border-white/10 bg-black/60 shrink-0">
            <div className="flex items-center gap-2.5 overflow-x-auto justify-center no-scrollbar max-w-4xl mx-auto py-1">
              {lightboxData.images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setLightboxData((prev) => (prev ? { ...prev, currentIndex: idx } : null))}
                  className={`w-16 h-12 sm:w-20 sm:h-14 rounded-xl overflow-hidden shrink-0 transition-all duration-200 border-2 ${
                    lightboxData.currentIndex === idx
                      ? 'border-blue-500 ring-2 ring-white scale-108 opacity-100 shadow-lg'
                      : 'border-white/20 opacity-40 hover:opacity-85'
                  }`}
                >
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Bố cục thông minh tự căn cho Thư viện ảnh (Collage phong cách Facebook/Google Photos)
function GalleryCollage({
  images,
  onOpenLightbox,
}: {
  images: Array<{ url: string; caption?: string }>;
  onOpenLightbox: (index: number) => void;
}) {
  const count = images.length;
  if (count === 0) return null;

  // 1 Ảnh
  if (count === 1) {
    return (
      <div
        onClick={() => onOpenLightbox(0)}
        className="relative rounded-2xl overflow-hidden h-72 sm:h-96 w-full cursor-pointer group shadow-2xs border border-slate-200/80"
      >
        <img
          src={images[0].url}
          alt=""
          className="w-full h-full object-cover group-hover:scale-102 transition duration-300"
        />
      </div>
    );
  }

  // 2 Ảnh: 2 cột bằng nhau
  if (count === 2) {
    return (
      <div className="grid grid-cols-2 gap-2.5 h-64 sm:h-80 rounded-2xl overflow-hidden">
        {images.slice(0, 2).map((img, idx) => (
          <div
            key={idx}
            onClick={() => onOpenLightbox(idx)}
            className="relative overflow-hidden cursor-pointer group rounded-2xl border border-slate-200/80 h-full bg-slate-100"
          >
            <img
              src={img.url}
              alt=""
              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
            />
          </div>
        ))}
      </div>
    );
  }

  // 3 Ảnh: 1 ảnh lớn bên trái, 2 ảnh xếp dọc bên phải
  if (count === 3) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 h-72 sm:h-96 rounded-2xl overflow-hidden">
        <div
          onClick={() => onOpenLightbox(0)}
          className="relative overflow-hidden cursor-pointer group rounded-2xl border border-slate-200/80 h-full bg-slate-100"
        >
          <img
            src={images[0].url}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
          />
        </div>
        <div className="grid grid-rows-2 gap-2.5 h-full">
          {images.slice(1, 3).map((img, idx) => (
            <div
              key={idx}
              onClick={() => onOpenLightbox(idx + 1)}
              className="relative overflow-hidden cursor-pointer group rounded-2xl border border-slate-200/80 h-full bg-slate-100"
            >
              <img
                src={img.url}
                alt=""
                className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 4 Ảnh: Lưới đối xứng 2x2
  if (count === 4) {
    return (
      <div className="grid grid-cols-2 grid-rows-2 gap-2.5 h-72 sm:h-96 rounded-2xl overflow-hidden">
        {images.slice(0, 4).map((img, idx) => (
          <div
            key={idx}
            onClick={() => onOpenLightbox(idx)}
            className="relative overflow-hidden cursor-pointer group rounded-2xl border border-slate-200/80 h-full bg-slate-100"
          >
            <img
              src={img.url}
              alt=""
              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
            />
          </div>
        ))}
      </div>
    );
  }

  // 5 Ảnh hoặc >= 6 Ảnh (Bố cục chuẩn như Hình 2 đính kèm: Cột trái 2 ảnh, Cột phải 3 ảnh)
  const visibleImages = images.slice(0, 5);
  const remainingCount = images.length - 5;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 h-80 sm:h-[450px] rounded-2xl overflow-hidden">
      {/* Cột trái: 2 ảnh xếp dọc */}
      <div className="grid grid-rows-2 gap-2.5 h-full">
        {visibleImages.slice(0, 2).map((img, idx) => (
          <div
            key={idx}
            onClick={() => onOpenLightbox(idx)}
            className="relative overflow-hidden cursor-pointer group rounded-2xl border border-slate-200/80 h-full bg-slate-100"
          >
            <img
              src={img.url}
              alt=""
              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
            />
          </div>
        ))}
      </div>

      {/* Cột phải: 3 ảnh xếp dọc, ảnh cuối cùng hiển thị +N nếu còn ảnh */}
      <div className="grid grid-rows-3 gap-2.5 h-full">
        {visibleImages.slice(2, 4).map((img, idx) => (
          <div
            key={idx}
            onClick={() => onOpenLightbox(idx + 2)}
            className="relative overflow-hidden cursor-pointer group rounded-2xl border border-slate-200/80 h-full bg-slate-100"
          >
            <img
              src={img.url}
              alt=""
              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
            />
          </div>
        ))}

        {/* Ảnh thứ 5 (Góc dưới bên phải - Hiện +N nếu > 5 ảnh) */}
        <div
          onClick={() => onOpenLightbox(4)}
          className="relative overflow-hidden cursor-pointer group rounded-2xl border border-slate-200/80 h-full bg-slate-100"
        >
          <img
            src={visibleImages[4].url}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
          />
          {remainingCount > 0 && (
            <div className="absolute inset-0 bg-black/60 hover:bg-black/50 transition flex items-center justify-center backdrop-blur-2xs">
              <span className="text-white text-3xl sm:text-4xl font-black tracking-wider drop-shadow-md">
                +{remainingCount}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// MODULAR BLOCK RENDERER IMPLEMENTATIONS
// ==========================================
interface BlockRendererProps {
  block: SchoolBlock;
  school: School;
  isSelected: boolean;
  isEditing?: boolean;
  onOpenLightbox: (images: Array<{ url: string; caption?: string }>, index: number) => void;
}

function BlockRenderer({ block, school, isEditing, onOpenLightbox }: BlockRendererProps) {
  switch (block.type) {
    case 'hero': {
      const bannerUrl = block.data?.bannerUrl || '';
      const address = block.data?.address || '';
      const phone = block.data?.phone || '';
      const website = block.data?.website || '';
      const title = block.title || '';
      const subtitle = block.subtitle || '';
      const code = block.data?.code || '';

      return (
        <div className="relative overflow-hidden bg-white border-b border-slate-100">
          <div className="h-64 sm:h-80 w-full relative overflow-hidden bg-gradient-to-r from-slate-900 via-[#0f3b7d] to-slate-900 flex items-center justify-center">
            {bannerUrl ? (
              <>
                <img
                  src={bannerUrl}
                  alt={title || ''}
                  className="w-full h-full object-cover opacity-85"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/40 to-transparent" />
              </>
            ) : (
              <div className="text-center text-white/50 px-4">
                <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
                {isEditing ? (
                  <p className="text-xs text-white/70">Chưa có ảnh bìa hero (Nhấp vào khối để tải ảnh từ máy lên)</p>
                ) : (
                  <p className="text-xs text-white/40">Chưa có ảnh bìa</p>
                )}
              </div>
            )}

            {code && (
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-white/20 text-white backdrop-blur-xs border border-white/30">
                  {code}
                </span>
              </div>
            )}

            <div className="absolute bottom-6 left-6 right-6 text-white">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-snug drop-shadow-sm">
                {title || (isEditing ? 'Tiêu đề khối Hero Banner' : '')}
              </h1>
              {subtitle && (
                <p className="mt-1.5 text-xs sm:text-sm text-slate-200 max-w-2xl line-clamp-2">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {(address || phone || website) && (
            <div className="bg-white/95 border-b border-slate-200/80 px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-4 text-slate-600">
                {address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate max-w-sm">{address}</span>
                  </span>
                )}
                {phone && (
                  <a
                    href={`tel:${phone}`}
                    className="flex items-center gap-1 font-semibold text-[#0f3b7d] hover:underline"
                  >
                    <Phone className="w-3.5 h-3.5 text-[#0f3b7d] shrink-0" />
                    <span>{phone}</span>
                  </a>
                )}
              </div>

              {website && (
                <a
                  href={website.startsWith('http') ? website : `https://${website}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-blue-50 text-[#0f3b7d] hover:bg-blue-100 font-semibold flex items-center gap-1.5 transition"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Cổng thông tin</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}
        </div>
      );
    }

    case 'rich_text': {
      return (
        <div className="p-6 sm:p-8 bg-white border-b border-slate-100">
          <div className="max-w-3xl">
            {block.title && (
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
                {block.title}
              </h2>
            )}
            {block.subtitle && (
              <p className="text-xs text-slate-500 mt-0.5 font-medium">{block.subtitle}</p>
            )}

            {block.content ? (
              <div className="mt-4 text-xs sm:text-sm text-slate-700 leading-relaxed space-y-3 whitespace-pre-line">
                {block.content}
              </div>
            ) : (
              isEditing && (
                <div className="mt-3 p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 text-center">
                  <FileText className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                  <p className="text-xs font-semibold text-slate-600">Khối thông tin chưa có nội dung</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Nhấp vào khối để nhập tiêu đề và nội dung bài viết / giới thiệu</p>
                </div>
              )
            )}
          </div>
        </div>
      );
    }

    case 'leadership': {
      const pName = block.data?.principalName || '';
      const pPhone = block.data?.principalPhone || '';
      const vpName = block.data?.vicePrincipalName || '';
      const vpPhone = block.data?.vicePrincipalPhone || '';
      const hasData = pName || pPhone || vpName || vpPhone;

      return (
        <div className="p-6 sm:p-8 bg-white border-b border-slate-100">
          {(block.title || block.subtitle) && (
            <div className="mb-5">
              {block.title && (
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
                  {block.title}
                </h2>
              )}
              {block.subtitle && (
                <p className="text-xs text-slate-500 mt-0.5 font-medium">{block.subtitle}</p>
              )}
            </div>
          )}

          {hasData ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(pName || pPhone) && (
                <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 shadow-xs flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#0f3b7d] flex items-center justify-center shrink-0 font-bold">
                    <User className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10.5px] font-semibold text-blue-600 uppercase tracking-wider">
                      Hiệu trưởng nhà trường
                    </span>
                    {pName && (
                      <p className="text-sm font-bold text-slate-900 leading-snug mt-0.5">
                        {pName}
                      </p>
                    )}
                    {pPhone && (
                      <a
                        href={`tel:${pPhone}`}
                        className="mt-1.5 text-xs text-[#0f3b7d] font-semibold hover:underline inline-flex items-center gap-1.5"
                      >
                        <Phone className="w-3 h-3 text-[#0f3b7d]" />
                        <span>{pPhone}</span>
                      </a>
                    )}
                  </div>
                </div>
              )}

              {(vpName || vpPhone) && (
                <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 shadow-xs flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 font-bold">
                    <Users className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider">
                      Ban đại diện / Hiệu phó
                    </span>
                    {vpName && (
                      <p className="text-sm font-bold text-slate-900 leading-snug mt-0.5">
                        {vpName}
                      </p>
                    )}
                    {vpPhone && (
                      <p className="mt-1.5 text-xs text-slate-600 inline-flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{vpPhone}</span>
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            isEditing && (
              <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 text-center">
                <Users className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                <p className="text-xs font-semibold text-slate-600">Chưa có thông tin lãnh đạo</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Nhấp vào khối để nhập thông tin Ban Giám Hiệu</p>
              </div>
            )
          )}
        </div>
      );
    }

    case 'map': {
      const address = block.data?.address || '';
      const lat = block.data?.lat != null ? Number(block.data.lat) : null;
      const lng = block.data?.lng != null ? Number(block.data.lng) : null;

      return (
        <div className="p-6 sm:p-8 bg-white border-b border-slate-100">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              {block.title && (
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
                  {block.title}
                </h2>
              )}
              {block.subtitle && (
                <p className="text-xs text-slate-500 mt-0.5 font-medium">{block.subtitle}</p>
              )}
            </div>

            {lat != null && lng != null && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold flex items-center gap-1.5 transition shrink-0"
              >
                <span>Xem trên Google Maps</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          {address && (
            <div className="text-xs text-slate-600 mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#0f3b7d] shrink-0" />
              <span className="font-medium">{address}</span>
              {lat != null && lng != null && (
                <span className="font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-semibold ml-auto shrink-0">
                  GPS: {lat.toFixed(4)}, {lng.toFixed(4)}
                </span>
              )}
            </div>
          )}

          {lat != null && lng != null ? (
            <div className="h-64 w-full rounded-2xl overflow-hidden border border-slate-200/90 shadow-xs relative z-0">
              <MapContainer
                center={[lat, lng]}
                zoom={15}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={false}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={[lat, lng]} icon={schoolMarkerIcon}>
                  <Popup>
                    <div className="text-xs font-sans">
                      <p className="font-bold text-[#0f3b7d] text-sm">{school.name}</p>
                      {address && <p className="text-slate-600 mt-1">{address}</p>}
                      <p className="mt-1 font-mono text-[10.5px] text-emerald-700">
                        Tọa độ: {lat.toFixed(6)}, {lng.toFixed(6)}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              </MapContainer>
            </div>
          ) : (
            isEditing && (
              <div className="h-44 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center p-4 bg-slate-50/50">
                <Map className="w-8 h-8 text-slate-300 mb-1.5" />
                <p className="font-bold text-slate-700 text-xs">Chưa cấu hình tọa độ GPS</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Nhấp vào khối để nhập vĩ độ (Lat) và kinh độ (Lng)</p>
              </div>
            )
          )}
        </div>
      );
    }

    case 'admissions': {
      const notes = block.data?.notes || '';
      const hotline = block.data?.hotline || '';
      const website = block.data?.website || '';
      const targetGroups = block.data?.targetGroups || '';
      const hasContent = notes || hotline || website || targetGroups;

      return (
        <div className="p-6 sm:p-8 bg-white border-b border-slate-100">
          {(block.title || block.subtitle) && (
            <div className="mb-4">
              {block.title && (
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
                  {block.title}
                </h2>
              )}
              {block.subtitle && (
                <p className="text-xs text-slate-500 mt-0.5 font-medium">{block.subtitle}</p>
              )}
            </div>
          )}

          {hasContent ? (
            <div className="p-4 rounded-2xl bg-blue-50/40 border border-blue-200/70 text-xs text-slate-700 space-y-3">
              {targetGroups && (
                <div>
                  <p className="font-bold text-blue-900 text-xs">Đối tượng tuyển sinh mục tiêu:</p>
                  <p className="mt-0.5 text-slate-700">{targetGroups}</p>
                </div>
              )}

              {notes && (
                <div className="flex items-start gap-2 pt-2 border-t border-blue-100">
                  <Compass className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-blue-900">Ghi chú & Phương án phối hợp:</p>
                    <p className="mt-0.5 leading-relaxed text-slate-700">{notes}</p>
                  </div>
                </div>
              )}

              {(hotline || website) && (
                <div className="pt-3 border-t border-blue-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                  {hotline && (
                    <span className="text-slate-700 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-blue-600" />
                      <span>Đường dây nóng: <strong>{hotline}</strong></span>
                    </span>
                  )}

                  {website && (
                    <a
                      href={website.startsWith('http') ? website : `https://${website}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-700 font-semibold hover:underline inline-flex items-center gap-1"
                    >
                      <span>Cổng thông tin tuyển sinh</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}
            </div>
          ) : (
            isEditing && (
              <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 text-center">
                <GraduationCap className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                <p className="text-xs font-semibold text-slate-600">Chưa có thông tin tuyển sinh</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Nhấp vào khối để nhập ghi chú, hotline hoặc website tuyển sinh</p>
              </div>
            )
          )}
        </div>
      );
    }

    case 'gallery': {
      const images: Array<{ url: string; caption?: string }> = block.data?.images || [];

      return (
        <div className="p-6 sm:p-8 bg-white border-b border-slate-100">
          {(block.title || block.subtitle) && (
            <div className="mb-4">
              {block.title && (
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
                  {block.title}
                </h2>
              )}
              {block.subtitle && (
                <p className="text-xs text-slate-500 mt-0.5 font-medium">{block.subtitle}</p>
              )}
            </div>
          )}

          {images.length > 0 ? (
            <GalleryCollage
              images={images}
              onOpenLightbox={(idx) => onOpenLightbox(images, idx)}
            />
          ) : (
            isEditing && (
              <div className="py-8 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center text-center p-4 bg-slate-50/50">
                <ImageIcon className="w-8 h-8 text-slate-300 mb-2" />
                <p className="font-bold text-slate-700 text-xs">Thư viện ảnh chưa có ảnh nào</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Nhấp vào khối này để tải ảnh từ máy tính hoặc chọn từ Kho ảnh trường</p>
              </div>
            )
          )}
        </div>
      );
    }

    case 'stats': {
      const statsList: Array<{ value: string; label: string }> = block.data?.stats || [];

      return (
        <div className="p-6 sm:p-8 bg-white border-b border-slate-100">
          {(block.title || block.subtitle) && (
            <div className="text-center max-w-xl mx-auto mb-6">
              {block.title && (
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
                  {block.title}
                </h2>
              )}
              {block.subtitle && (
                <p className="text-xs text-slate-500 mt-0.5 font-medium">{block.subtitle}</p>
              )}
            </div>
          )}

          {statsList.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {statsList.map((stat, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 text-center shadow-2xs"
                >
                  <p className="text-xl sm:text-2xl font-black text-[#0f3b7d] tracking-tight">
                    {stat.value || '--'}
                  </p>
                  <p className="text-xs text-slate-600 mt-1 font-medium">{stat.label || 'Chỉ số'}</p>
                </div>
              ))}
            </div>
          ) : (
            isEditing && (
              <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 text-center">
                <BarChart2 className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                <p className="text-xs font-semibold text-slate-600">Chưa có chỉ số nào</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Nhấp vào khối để thêm các chỉ số và dữ liệu thống kê</p>
              </div>
            )
          )}
        </div>
      );
    }

    default:
      return null;
  }
}
