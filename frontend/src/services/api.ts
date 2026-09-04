import axios from 'axios';
import type {
  Trip,
  TripListItem,
  CreateTripInput,
  Waypoint,
  CreateWaypointInput,
  NextHopRequest,
  NextHopResponse,
  CheckInRequest,
  CheckInResponse,
  Report,
  ReportListItem,
} from '../types';

// Auto-detect API URL based on browser location
const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && envUrl !== '') {
    return envUrl;
  }

  // Auto-detect from window location
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  return `${protocol}//${hostname}:8000/api`;
};

const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth API
export const authApi = {
  login: async (username: string, password: string): Promise<{ access_token: string; token_type: string }> => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    const { data } = await axios.post(`${API_BASE_URL}/auth/login`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  getMe: async (): Promise<any> => {
    const token = localStorage.getItem('token');
    const { data } = await axios.get(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data;
  },

  createUser: async (username: string, password: string): Promise<any> => {
    const token = localStorage.getItem('token');
    const { data } = await axios.post(
      `${API_BASE_URL}/auth/admin/users`,
      { username, password },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return data;
  },

  listUsers: async (): Promise<any[]> => {
    const token = localStorage.getItem('token');
    const { data } = await axios.get(`${API_BASE_URL}/auth/admin/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data;
  },
};

// Upload API
export const uploadApi = {
  // Upload images to database for a visit log
  uploadImages: async (visitLogId: string, files: File[]): Promise<string[]> => {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    const { data } = await api.post(
      `/upload/images/${visitLogId}`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );

    return data.image_ids;
  },

  // Get image URL by ID
  getImageUrl: (imageId: string): string => {
    return `${API_BASE_URL}/upload/images/${imageId}`;
  },

  // Delete image
  deleteImage: async (imageId: string): Promise<void> => {
    await api.delete(`/upload/images/${imageId}`);
  },
};

// Trip APIs
export const tripApi = {
  // Get all trips
  getTrips: async (status?: string): Promise<TripListItem[]> => {
    const params = status ? { status } : {};
    const { data } = await api.get('/trips', { params });
    return data;
  },

  // Get single trip
  getTrip: async (tripId: string): Promise<Trip> => {
    const { data } = await api.get(`/trips/${tripId}`);
    return data;
  },

  // Create trip
  createTrip: async (input: CreateTripInput): Promise<Trip> => {
    const { data } = await api.post('/trips', input);
    return data;
  },

  // Update trip
  updateTrip: async (tripId: string, input: Partial<CreateTripInput>): Promise<Trip> => {
    const { data } = await api.patch(`/trips/${tripId}`, input);
    return data;
  },

  // Delete trip
  deleteTrip: async (tripId: string): Promise<void> => {
    await api.delete(`/trips/${tripId}`);
  },

  // Add waypoint
  addWaypoint: async (tripId: string, input: CreateWaypointInput): Promise<Waypoint> => {
    const { data } = await api.post(`/trips/${tripId}/waypoints`, input);
    return data;
  },

  // Update waypoint
  updateWaypoint: async (
    tripId: string,
    waypointId: string,
    input: Partial<CreateWaypointInput & { is_visited?: boolean }>
  ): Promise<Waypoint> => {
    const { data } = await api.patch(`/trips/${tripId}/waypoints/${waypointId}`, input);
    return data;
  },

  // Delete waypoint
  deleteWaypoint: async (tripId: string, waypointId: string): Promise<void> => {
    await api.delete(`/trips/${tripId}/waypoints/${waypointId}`);
  },

  // Get next hop recommendation
  getNextHop: async (tripId: string, request: NextHopRequest): Promise<NextHopResponse> => {
    const { data } = await api.post(`/trips/${tripId}/next-hop`, request);
    return data;
  },

  // Check-in at waypoint
  checkIn: async (tripId: string, request: CheckInRequest): Promise<CheckInResponse> => {
    const { data } = await api.post(`/trips/${tripId}/check-in`, request);
    return data;
  },

  // Undo check-in at waypoint
  undoCheckIn: async (tripId: string, waypointId: string): Promise<CheckInResponse> => {
    const { data } = await api.post(`/trips/${tripId}/undo-check-in`, null, {
      params: { waypoint_id: waypointId }
    });
    return data;
  },

  // Reset day (start from hotel)
  resetDay: async (tripId: string, hotelLat?: number, hotelLng?: number): Promise<Trip> => {
    const params: Record<string, number> = {};
    if (hotelLat) params.hotel_lat = hotelLat;
    if (hotelLng) params.hotel_lng = hotelLng;
    const { data } = await api.post(`/trips/${tripId}/reset-day`, null, { params });
    return data;
  },

  // Go to hotel
  goToHotel: async (
    tripId: string,
    currentLat: number,
    currentLng: number
  ): Promise<{
    hotel_name: string;
    hotel_lat: number;
    hotel_lng: number;
    directions: {
      polyline: string;
      duration_text: string;
      distance_text: string;
    } | null;
  }> => {
    const { data } = await api.post(`/trips/${tripId}/go-hotel`, null, {
      params: { current_lat: currentLat, current_lng: currentLng },
    });
    return data;
  },

  // Get directions (for drawing route)
  getDirections: async (
    tripId: string,
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number
  ): Promise<{
    polyline?: string;
    duration_text?: string;
    distance_text?: string;
  } | null> => {
    try {
      const { data } = await api.get(`/trips/${tripId}/directions`, {
        params: {
          origin_lat: originLat,
          origin_lng: originLng,
          dest_lat: destLat,
          dest_lng: destLng,
        },
      });
      return data;
    } catch {
      return null;
    }
  },

  // Search nearby places (restaurants, hotels, etc.)
  searchNearbyPlaces: async (
    lat: number,
    lng: number,
    query: string = 'quán ăn nhà hàng khách sạn',
    radius: number = 5000
  ): Promise<{
    success: boolean;
    total: number;
    places: Array<{
      place_id: string;
      name: string;
      address: string;
      lat: number;
      lng: number;
      rating?: number;
      reviews?: number;
      type?: string;
      price?: string;
      thumbnail?: string;
    }>;
  }> => {
    const { data } = await api.get('/trips/search-nearby-places', {
      params: { lat, lng, query, radius },
    });
    return data;
  },
};

// ==================== 3 PHẦN THÔNG TIN WAYPOINT MỚI ====================
import type { WaypointDetail, WaypointDetailFormData, VisitLog, VisitLogFormData, Ticket, TicketFormData } from '../types';

// PHẦN 1: Thông tin chi tiết
export const waypointDetailApi = {
  get: async (waypointId: string): Promise<WaypointDetail> => {
    const { data } = await api.get(`/waypoints/${waypointId}/detail`);
    return data;
  },

  create: async (waypointId: string, formData: WaypointDetailFormData): Promise<WaypointDetail> => {
    const { data } = await api.post(`/waypoints/${waypointId}/detail`, formData);
    return data;
  },

  update: async (waypointId: string, formData: Partial<WaypointDetailFormData>): Promise<WaypointDetail> => {
    const { data } = await api.patch(`/waypoints/${waypointId}/detail`, formData);
    return data;
  },
};

// PHẦN 2: Lịch sử
export const visitLogApi = {
  getAll: async (waypointId: string): Promise<VisitLog[]> => {
    const { data } = await api.get(`/waypoints/${waypointId}/visit-logs`);
    return data;
  },

  create: async (waypointId: string, formData: VisitLogFormData): Promise<VisitLog> => {
    const { data } = await api.post(`/waypoints/${waypointId}/visit-logs`, formData);
    return data;
  },

  update: async (logId: string, formData: Partial<VisitLogFormData>): Promise<VisitLog> => {
    const { data } = await api.patch(`/waypoints/visit-logs/${logId}`, formData);
    return data;
  },

  delete: async (logId: string): Promise<void> => {
    await api.delete(`/waypoints/visit-logs/${logId}`);
  },
};

// PHẦN 3: Phiếu thu
export const ticketApi = {
  getAll: async (waypointId: string): Promise<Ticket[]> => {
    const { data } = await api.get(`/waypoints/${waypointId}/tickets`);
    return data;
  },

  create: async (waypointId: string, formData: TicketFormData): Promise<Ticket> => {
    const { data } = await api.post(`/waypoints/${waypointId}/tickets`, formData);
    return data;
  },

  update: async (ticketId: string, formData: Partial<TicketFormData>): Promise<Ticket> => {
    const { data } = await api.patch(`/waypoints/tickets/${ticketId}`, formData);
    return data;
  },

  delete: async (ticketId: string): Promise<void> => {
    await api.delete(`/waypoints/tickets/${ticketId}`);
  },
};

// ==================== QUẢN LÝ ĐIỂM DỪNG (WAYPOINT CRUD API) ====================
export const waypointApi = {
  getAll: async (params?: { trip_id?: string; school_id?: string; type?: string; search?: string }): Promise<Waypoint[]> => {
    const { data } = await api.get('/waypoints', { params });
    return data;
  },

  getById: async (id: string): Promise<Waypoint> => {
    const { data } = await api.get(`/waypoints/${id}`);
    return data;
  },

  create: async (waypointData: CreateWaypointInput): Promise<Waypoint> => {
    const { data } = await api.post('/waypoints', waypointData);
    return data;
  },

  update: async (id: string, waypointData: Partial<CreateWaypointInput>): Promise<Waypoint> => {
    const { data } = await api.patch(`/waypoints/${id}`, waypointData);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/waypoints/${id}`);
  },
};


// Maps Parser API
export const mapsApi = {
  parseLink: async (link: string): Promise<{ latitude: number; longitude: number }> => {
    const { data } = await api.post('/trips/utils/parse-maps-link', { link });
    return data;
  },
};

// Report API
export const reportApi = {
  // Generate new report for a trip
  generateReport: async (tripId: string, createdAt?: string): Promise<{ job_id: string }> => {
    const { data } = await api.post(`/trips/${tripId}/reports`, { created_at: createdAt });
    return data;
  },


  // Get job status for polling
  getJobStatus: async (jobId: string) => {
    const { data } = await api.get(`/trips/reports/jobs/${jobId}`);
    return data as {
      id: string;
      trip_id: string;
      status: 'pending' | 'processing' | 'completed' | 'failed';
      progress: number;
      result_report_id: string | null;
      error_message: string | null;
    };
  },
  // Get all reports for a trip
  getTripReports: async (tripId: string): Promise<Report[]> => {
    const { data } = await api.get(`/trips/${tripId}/reports`);
    return data;
  },

  // Get all reports across all trips
  getAllReports: async (): Promise<ReportListItem[]> => {
    const { data } = await api.get('/trips/reports/all');
    return data;
  },

  // Get single report by ID
  getReport: async (reportId: string): Promise<Report> => {
    const { data } = await api.get(`/trips/reports/${reportId}`);
    return data;
  },

  // Delete report
  deleteReport: async (reportId: string): Promise<void> => {
    await api.delete(`/trips/reports/${reportId}`);
  },
};

export default api;
