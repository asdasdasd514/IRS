// Trip Types
export interface Trip {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'completed';
  current_lat: number | null;
  current_lng: number | null;
  hotel_lat: number | null;
  hotel_lng: number | null;
  hotel_name: string | null;
  created_at: string;
  updated_at: string;
  waypoints: Waypoint[];
  total_waypoints: number;
  visited_count: number;
}

export interface TripListItem {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'completed';
  total_waypoints: number;
  visited_count: number;
  school_count: number;  // Tổng số trường (chỉ SCHOOL)
  school_visited_count: number;  // Số trường đã đi
  total_tickets: number;  // Tổng số phiếu thật thu được
  created_at: string;
}

export interface CreateTripInput {
  name: string;
  current_lat?: number;
  current_lng?: number;
  hotel_lat?: number;
  hotel_lng?: number;
  hotel_name?: string;
  waypoints: CreateWaypointInput[];
}

// Waypoint Types
export interface Waypoint {
  id: string;
  trip_id: string;
  google_place_id: string | null;
  school_id?: string | null;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  type: 'SCHOOL' | 'HOTEL' | 'HQ' | 'REST_STOP';
  visit_order: number | null;
  is_visited: boolean;
  visited_at: string | null;
  notes?: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  created_at: string;
}

export interface School {
  id: string;
  code: string;
  name: string;
  address: string;
  description?: string;
  lat: number;
  lng: number;
  tier: number;
  grade12_students_count: number;
  preferred_visit_hours?: string;
  created_at?: string;
}

export interface CreateWaypointInput {
  name: string;
  lat: number;
  lng: number;
  google_place_id?: string;
  address?: string;
  type?: 'SCHOOL' | 'HOTEL' | 'HQ' | 'REST_STOP';
  notes?: string;
  contact_name?: string;
  contact_phone?: string;
}

// Waypoint History Types - DEPRECATED - Thay bằng 3 phần mới
// export interface WaypointHistory { ... }

// ==================== 3 PHẦN THÔNG TIN WAYPOINT MỚI ====================

// PHẦN 1: Thông tin chi tiết trường
export interface WaypointDetail {
  id: string;
  waypoint_id: string;
  principal_name?: string;
  principal_phone?: string;
  vice_principal_name?: string;
  vice_principal_phone?: string;
  our_contact_person?: string;
  our_contact_role?: string;
  contact_process?: string;
  total_contact_attempts: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface WaypointDetailFormData {
  principal_name?: string;
  principal_phone?: string;
  vice_principal_name?: string;
  vice_principal_phone?: string;
  our_contact_person?: string;
  our_contact_role?: string;
  contact_process?: string;
  total_contact_attempts?: number;
  notes?: string;
}

// Image Type
export interface WaypointImage {
  id: string;
  filename?: string;
  content_type?: string;
  created_at: string;
}

// PHẦN 2: Lịch sử
export interface VisitLog {
  id: string;
  waypoint_id: string;
  visit_content: string;
  image_urls?: string;  // DEPRECATED - for backward compatibility
  images: WaypointImage[];  // New: images from database
  visit_date: string;
  created_at: string;
}

export interface VisitLogFormData {
  visit_content: string;
  image_urls?: string;  // DEPRECATED
}

// PHẦN 3: Phiếu thu
export interface Ticket {
  id: string;
  waypoint_id: string;
  visit_number: number;
  tickets_collected: number;
  collection_date: string;
  notes?: string;
  created_at: string;
}

export interface TicketFormData {
  visit_number: number;
  tickets_collected: number;
  notes?: string;
}

// Next Hop Types
export interface NextHopRequest {
  current_lat: number;
  current_lng: number;
}

export interface NextHopCandidate {
  waypoint: Waypoint;
  duration_seconds: number;
  duration_text: string;
  distance_meters: number;
  distance_text: string;
  is_recommended: boolean;
}

export interface NextHopResponse {
  recommended: NextHopCandidate | null;
  alternatives: NextHopCandidate[];
  total_unvisited: number;
  message: string;
}

// Check-in Types
export interface CheckInRequest {
  waypoint_id: string;
  lat?: number;
  lng?: number;
  remote?: boolean;  // Allow check-in from far away
  visited_at?: string;  // ISO timestamp from device
}

export interface CheckInResponse {
  success: boolean;
  waypoint: Waypoint;
  message: string;
}

// Location Type
export interface Location {
  lat: number;
  lng: number;
}

// Report Types
export interface Report {
  id: string;
  trip_id: string;
  report_content: string;  // Markdown content
  total_schools: number;
  schools_visited: number;
  total_tickets: number;
  created_at: string;
}

export interface ReportListItem {
  id: string;
  trip_id: string;
  trip_name: string;
  total_schools: number;
  schools_visited: number;
  total_tickets: number;
  created_at: string;
}
