import axios, { InternalAxiosRequestConfig } from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = '/api';

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// --- React Query Hooks for Server State Management ---

export function useCampaigns() {
  return useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const res = await api.get('/campaigns/');
      return res.data;
    }
  });
}

export function useOptimizeRoute() {
  return useMutation({
    mutationFn: async (payload: { origin: any; waypoints: any[] }) => {
      const res = await api.post('/routes/optimize', payload);
      return res.data;
    }
  });
}

export function useUploadImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, campaignId }: { file: File; campaignId?: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      if (campaignId) {
        formData.append('campaign_id', campaignId);
      }
      const res = await api.post('/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    }
  });
}
