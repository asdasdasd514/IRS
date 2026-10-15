import React, { useState } from 'react';
import { X, Navigation, ExternalLink } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Waypoint } from '../../types';
import { waypointDetailApi, visitLogApi, ticketApi } from '../../services/api';
import { DetailTab } from './DetailTab';
import { VisitLogTab } from './VisitLogTab';
import { TicketTab } from './TicketTab';

interface WaypointInfoModalProps {
  waypoint: Waypoint | null;
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'detail' | 'visits' | 'tickets';

export const WaypointInfoModal: React.FC<WaypointInfoModalProps> = ({
  waypoint,
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('detail');
  const queryClient = useQueryClient();

  // Quán ăn / điểm dừng chân không hiển thị modal này
  const isRestStop = waypoint?.type === 'REST_STOP';

  // Fetch data for all 3 parts
  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['waypoint-detail', waypoint?.id],
    queryFn: () => waypointDetailApi.get(waypoint!.id),
    enabled: !!waypoint && !isRestStop && isOpen,
  });

  const { data: visitLogs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['visit-logs', waypoint?.id],
    queryFn: () => visitLogApi.getAll(waypoint!.id),
    enabled: !!waypoint && !isRestStop && isOpen,
  });

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ['tickets', waypoint?.id],
    queryFn: () => ticketApi.getAll(waypoint!.id),
    enabled: !!waypoint && !isRestStop && isOpen,
  });

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  const invalidateAll = () => {
    if (waypoint) {
      queryClient.invalidateQueries({ queryKey: ['waypoint-detail', waypoint.id] });
      queryClient.invalidateQueries({ queryKey: ['visit-logs', waypoint.id] });
      queryClient.invalidateQueries({ queryKey: ['tickets', waypoint.id] });
    }
  };

  if (!isOpen || !waypoint || isRestStop) return null;

  // Chỉ SCHOOL mới có tab Tickets
  const showTicketsTab = waypoint.type === 'SCHOOL';

  return (
    <div className="fixed inset-0 z-[9999] bg-black bg-opacity-50 flex items-end sm:items-center sm:justify-center">
      <div className="bg-white w-full sm:max-w-3xl sm:rounded-[5px] rounded-t-[5px] max-h-[90vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex-shrink-0 flex items-start justify-between gap-3 p-4 border-b border-slate-200">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">{waypoint.name}</h2>
              {waypoint.code && (
                <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded-[3px] font-bold shrink-0">
                  {waypoint.code}
                </span>
              )}
            </div>
            {waypoint.address && (
              <p className="text-xs text-slate-500 mt-1">{waypoint.address}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {waypoint.lat && waypoint.lng && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${waypoint.lat},${waypoint.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] bg-[#0f3b7d] hover:bg-[#0c2f64] text-white text-xs font-bold transition shadow-xs cursor-pointer"
                title="Mở Google Maps chỉ đường"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Chỉ đường Google Maps</span>
                <span className="sm:hidden">Chỉ đường</span>
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-100 rounded-[5px] text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              title="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0 flex border-b border-slate-200 bg-slate-50 text-xs sm:text-sm">
          <button
            onClick={() => handleTabChange('detail')}
            className={`flex-1 py-3 px-4 font-bold transition-colors cursor-pointer ${
              activeTab === 'detail'
                ? 'text-[#0f3b7d] border-b-2 border-[#0f3b7d] bg-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📋 Thông tin chi tiết
          </button>
          <button
            onClick={() => handleTabChange('visits')}
            className={`flex-1 py-3 px-4 font-bold transition-colors cursor-pointer ${
              activeTab === 'visits'
                ? 'text-[#0f3b7d] border-b-2 border-[#0f3b7d] bg-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🏫 Lịch sử ({visitLogs.length})
          </button>
          {showTicketsTab && (
            <button
              onClick={() => handleTabChange('tickets')}
              className={`flex-1 py-3 px-4 font-bold transition-colors cursor-pointer ${
                activeTab === 'tickets'
                  ? 'text-[#0f3b7d] border-b-2 border-[#0f3b7d] bg-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🎫 Phiếu ({tickets.length})
            </button>
          )}
        </div>

        {/* Tab Content - Fixed height để không bị nhảy khi chuyển tab */}
        <div className="flex-1 overflow-y-auto p-4 min-h-[500px] max-h-[60vh]">
          {activeTab === 'detail' && (
            <DetailTab
              waypoint={waypoint}
              waypointId={waypoint.id}
              detail={detail}
              isLoading={detailLoading}
              onUpdate={invalidateAll}
            />
          )}
          {activeTab === 'visits' && (
            <VisitLogTab
              waypointId={waypoint.id}
              logs={visitLogs}
              isLoading={logsLoading}
              onUpdate={invalidateAll}
            />
          )}
          {activeTab === 'tickets' && showTicketsTab && (
            <TicketTab
              waypointId={waypoint.id}
              tickets={tickets}
              isLoading={ticketsLoading}
              onUpdate={invalidateAll}
            />
          )}
        </div>
      </div>
    </div>
  );
};
