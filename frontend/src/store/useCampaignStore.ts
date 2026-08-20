import { create } from 'zustand';

export interface SchoolTarget {
  school_name: string;
  address: string;
  location: { lat: number; lng: number; address: string };
  estimated_students: number;
  priority: number;
}

interface CampaignUIState {
  selectedCampaignId: string | null;
  activeTab: 'dashboard' | 'campaigns' | 'planner' | 'login';
  setSelectedCampaignId: (id: string | null) => void;
  setActiveTab: (tab: 'dashboard' | 'campaigns' | 'planner' | 'login') => void;
}

export const useCampaignStore = create<CampaignUIState>((set: any) => ({
  selectedCampaignId: null,
  activeTab: 'dashboard',
  setSelectedCampaignId: (id: string | null) => set({ selectedCampaignId: id }),
  setActiveTab: (tab: 'dashboard' | 'campaigns' | 'planner' | 'login') => set({ activeTab: tab })
}));
