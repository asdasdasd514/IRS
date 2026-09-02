import { useState, useEffect, useCallback } from 'react';
import type { Location } from '../types';

interface UseGeolocationResult {
  location: Location | null;
  error: string | null;
  isLoading: boolean;
  refresh: () => void;
}

export function useGeolocation(options?: PositionOptions): UseGeolocationResult {
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const getPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Trình duyệt không hỗ trợ định vị');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setIsLoading(false);
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError('Vui lòng cho phép truy cập vị trí');
            break;
          case err.POSITION_UNAVAILABLE:
            setError('Không thể xác định vị trí');
            break;
          case err.TIMEOUT:
            setError('Hết thời gian chờ định vị');
            break;
          default:
            setError('Lỗi không xác định');
        }
        setIsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
        ...options,
      }
    );
  }, [options]);

  useEffect(() => {
    getPosition();
  }, [getPosition]);

  return { location, error, isLoading, refresh: getPosition };
}

// Watch position hook for continuous tracking
export function useWatchPosition(): UseGeolocationResult {
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [watchId, setWatchId] = useState<number | null>(null);

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Trình duyệt không hỗ trợ định vị');
      setIsLoading(false);
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setIsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    setWatchId(id);
  }, []);

  const stopWatching = useCallback(() => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
  }, [watchId]);

  useEffect(() => {
    startWatching();
    return () => stopWatching();
  }, [startWatching, stopWatching]);

  return { location, error, isLoading, refresh: startWatching };
}
