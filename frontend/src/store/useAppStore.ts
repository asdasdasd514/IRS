import { create } from 'zustand';
import type { Trip, Waypoint, NextHopCandidate, Location } from '../types';

interface User {
  id: string;
  username: string;
  is_admin: boolean;
  is_active: boolean;
}

interface AppState {
  // Auth state
  user: User | null;
  token: string | null;
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
  user: null,
  token: localStorage.getItem('token'),
  setAuth: (user, token) => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
    set({ user, token });
  },
  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null, currentTrip: null });
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
