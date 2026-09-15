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
