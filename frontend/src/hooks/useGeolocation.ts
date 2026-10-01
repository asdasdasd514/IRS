import { useState, useEffect, useCallback, useRef } from 'react';
import type { Location } from '../types';

interface UseGeolocationResult {
  location: Location | null;
  error: string | null;
  isLoading: boolean;
  accuracy: number | null;
  refresh: () => void;
}

export function useGeolocation(options?: PositionOptions): UseGeolocationResult {
  const [location, setLocation] = useState<Location | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const getPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Trình duyệt không hỗ trợ định vị GPS');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const acc = Math.round(position.coords.accuracy);
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: acc,
        });
        setAccuracy(acc);
        setIsLoading(false);
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError('Vui lòng cấp quyền truy cập vị trí (GPS) trên trình duyệt');
            break;
          case err.POSITION_UNAVAILABLE:
            setError('Không thể xác định vị trí GPS hiện tại');
            break;
          case err.TIMEOUT:
            setError('Hết thời gian chờ phản hồi GPS');
            break;
          default:
            setError('Lỗi định vị vị trí');
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

  return { location, error, isLoading, accuracy, refresh: getPosition };
}

// Watch position hook for continuous real-time GPS tracking
export function useWatchPosition(options?: PositionOptions): UseGeolocationResult {
  const [location, setLocation] = useState<Location | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const watchIdRef = useRef<number | null>(null);

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Trình duyệt không hỗ trợ định vị GPS');
      setIsLoading(false);
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setIsLoading(true);
    setError(null);

    const id = navigator.geolocation.watchPosition(
      (position) => {
        const newLat = position.coords.latitude;
        const newLng = position.coords.longitude;
        const acc = Math.round(position.coords.accuracy);

        setLocation((prev) => {
          if (!prev) {
            return { lat: newLat, lng: newLng, accuracy: acc };
          }
          // Lọc rung lắc GPS (chỉ cập nhật nếu di chuyển thực tế >= 3 mét)
          const R = 6371000;
          const dLat = (newLat - prev.lat) * (Math.PI / 180);
          const dLng = (newLng - prev.lng) * (Math.PI / 180);
          const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(prev.lat * (Math.PI / 180)) * Math.cos(newLat * (Math.PI / 180)) * Math.sin(dLng / 2) ** 2;
          const distM = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

          if (distM >= 3 || Math.abs((prev.accuracy || 0) - acc) > 15) {
            return { lat: newLat, lng: newLng, accuracy: acc };
          }
          return prev;
        });
        setAccuracy(acc);
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError('Vui lòng cấp quyền vị trí (GPS) để tự động định vị');
            break;
          case err.POSITION_UNAVAILABLE:
            setError('Tín hiệu GPS đang yếu hoặc chưa sẵn sàng');
            break;
          case err.TIMEOUT:
            setError('Tín hiệu GPS phản hồi chậm');
            break;
          default:
            setError(err.message || 'Lỗi tín hiệu GPS');
        }
        setIsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 2000,
        ...options,
      }
    );

    watchIdRef.current = id;
  }, [options]);

  useEffect(() => {
    startWatching();
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [startWatching]);

  return { location, error, isLoading, accuracy, refresh: startWatching };
}

