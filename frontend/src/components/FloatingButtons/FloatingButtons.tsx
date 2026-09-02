import React from 'react';
import { RefreshCw, Hotel, MapPin, Menu, Utensils } from 'lucide-react';

interface FloatingButtonsProps {
  onRecalculate: () => void;
  onGoHotel: () => void;
  onCenterLocation: () => void;
  onOpenMenu: () => void;
  onFindRestaurants: () => void;
  isRecalculating: boolean;
  isSearchingRestaurants?: boolean;
}

export const FloatingButtons: React.FC<FloatingButtonsProps> = ({
  onRecalculate,
  onGoHotel,
  onCenterLocation,
  onOpenMenu,
  onFindRestaurants,
  isRecalculating,
  isSearchingRestaurants = false,
}) => {
  return (
    <>
      {/* Menu button - top left */}
      <button
        onClick={onOpenMenu}
        className="absolute top-4 left-4 z-40 bg-white p-3 rounded-full shadow-lg hover:bg-gray-50 active:bg-gray-100"
        title="Menu"
      >
        <Menu className="w-6 h-6 text-gray-700" />
      </button>

      {/* Right side buttons */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-3">
        {/* Recalculate button */}
        <button
          onClick={onRecalculate}
          disabled={isRecalculating}
          className={`bg-white p-3 rounded-full shadow-lg hover:bg-gray-50 active:bg-gray-100 ${
            isRecalculating ? 'animate-spin' : ''
          }`}
          title="Tính lại lộ trình"
        >
          <RefreshCw className={`w-6 h-6 text-primary-500 ${isRecalculating ? '' : ''}`} />
        </button>

        {/* Center on location */}
        <button
          onClick={onCenterLocation}
          className="bg-white p-3 rounded-full shadow-lg hover:bg-gray-50 active:bg-gray-100"
          title="Về vị trí của tôi"
        >
          <MapPin className="w-6 h-6 text-gray-700" />
        </button>

        {/* Go to hotel */}
        <button
          onClick={onGoHotel}
          className="bg-amber-500 p-3 rounded-full shadow-lg hover:bg-amber-600 active:bg-amber-700"
          title="Về khách sạn"
        >

        {/* Find nearby restaurants */}
        <button
          onClick={onFindRestaurants}
          disabled={isSearchingRestaurants}
          className={`bg-orange-500 p-3 rounded-full shadow-lg hover:bg-orange-600 active:bg-orange-700 ${
            isSearchingRestaurants ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          title="Tìm quán ăn gần đây"
        >
          <Utensils className="w-6 h-6 text-white" />
        </button>
          <Hotel className="w-6 h-6 text-white" />
        </button>
      </div>
    </>
  );
};

export default FloatingButtons;
