import { create } from 'zustand';
import type { Trip, Waypoint, NextHopCandidate, Location, User } from '../types';

const getInitialUser = (): User | null => {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

interface AppState {

  // Auth state
  user: User | null;
  token: string | null;
  authChecked: boolean;
  setAuthChecked: (checked: boolean) => void;
  setAuth: (user: User | null, token: string | null) => void;
  logout: () => void;

  // Current trip
  currentTrip: Trip | null;
  setCurrentTrip: (trip: Trip | null) => void;

  // Current location
  currentLocation: Location | null;
  setCurrentLocation: (location: Location | null) => void;

  // Next hop recommendation
  nextHop: NextHopCandidate | null;
  alternatives: NextHopCandidate[];
  setNextHop: (next: NextHopCandidate | null, alts: NextHopCandidate[]) => void;

  // Selected waypoint (for viewing details)
  selectedWaypoint: Waypoint | null;
  setSelectedWaypoint: (waypoint: Waypoint | null) => void;

  // Bottom sheet state
  bottomSheetExpanded: boolean;
  setBottomSheetExpanded: (expanded: boolean) => void;

  // Loading states
  isLoadingNextHop: boolean;
  setIsLoadingNextHop: (loading: boolean) => void;

  // Map state
  mapCenter: Location | null;
  setMapCenter: (center: Location | null) => void;

  // Sidebar state
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Split Shutter Transition state
  // 'open': khi đăng nhập (tách đôi ra để lộ trang chính)
  // 'close': khi đăng xuất (quay ngược lại, 2 bên khép lại để về trang đăng nhập)
  isSplitTransition: boolean;
  splitDirection: 'open' | 'close';
  splitUsername: string;
  startSplitTransition: (username?: string, direction?: 'open' | 'close') => void;
  finishSplitTransition: () => void;

  // Theo dõi trạng thái đã tải CompassPreloader xong trong phiên làm việc
  isPreloadCompleted: boolean;
  setPreloadCompleted: (completed: boolean) => void;

  // Reset all state
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Auth
  user: getInitialUser(),
  token: localStorage.getItem('token'),
  authChecked: false,
  setAuthChecked: (checked) => set({ authChecked: checked }),
  setAuth: (user, token) => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
    set({ user, token, authChecked: true });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null, authChecked: true, currentTrip: null });
  },

  // Split Shutter Transition
  isSplitTransition: false,
  splitDirection: 'open',
  splitUsername: 'admin',
  startSplitTransition: (username, direction = 'open') =>
    set({
      isSplitTransition: true,
      splitUsername: username || 'admin',
      splitDirection: direction,
    }),
  finishSplitTransition: () => set({ isSplitTransition: false }),

  // Preload state (lưu trạng thái để khi đăng xuất không bị tải lại animation la bàn)
  isPreloadCompleted:
    typeof window !== 'undefined' && sessionStorage.getItem('irs_preloaded') === '1',
  setPreloadCompleted: (completed) => {
    if (typeof window !== 'undefined') {
      if (completed) {
        sessionStorage.setItem('irs_preloaded', '1');
      } else {
        sessionStorage.removeItem('irs_preloaded');
      }
    }
    set({ isPreloadCompleted: completed });
  },

  // Current trip
  currentTrip: null,
  setCurrentTrip: (trip) => set({ currentTrip: trip }),

  // Current location
  currentLocation: null,
  setCurrentLocation: (location) => set({ currentLocation: location }),

  // Next hop
  nextHop: null,
  alternatives: [],
  setNextHop: (next, alts) => set({ nextHop: next, alternatives: alts }),

  // Selected waypoint
  selectedWaypoint: null,
  setSelectedWaypoint: (waypoint) => set({ selectedWaypoint: waypoint }),

  // Bottom sheet
  bottomSheetExpanded: false,
  setBottomSheetExpanded: (expanded) => set({ bottomSheetExpanded: expanded }),

  // Loading
  isLoadingNextHop: false,
  setIsLoadingNextHop: (loading) => set({ isLoadingNextHop: loading }),

  // Map center
  mapCenter: null,
  setMapCenter: (center) => set({ mapCenter: center }),

  // Sidebar state
  sidebarCollapsed: (() => {
    try {
      return localStorage.getItem('irs_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  })(),
  toggleSidebar: () =>
    set((state) => {
      const next = !state.sidebarCollapsed;
      try {
        localStorage.setItem('irs_sidebar_collapsed', String(next));
      } catch (e) {
        console.error('Error saving sidebar state:', e);
      }
      return { sidebarCollapsed: next };
    }),
  setSidebarCollapsed: (collapsed) => {
    try {
      localStorage.setItem('irs_sidebar_collapsed', String(collapsed));
    } catch (e) {
      console.error('Error saving sidebar state:', e);
    }
    set({ sidebarCollapsed: collapsed });
  },

  // Reset
  reset: () =>
    set({
      currentTrip: null,
      currentLocation: null,
      nextHop: null,
      alternatives: [],
      selectedWaypoint: null,
      bottomSheetExpanded: false,
      isLoadingNextHop: false,
      mapCenter: null,
    }),
}));
