import React, { useState } from 'react';
import { X } from 'lucide-react';
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

  // Fetch data for all 3 parts
  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['waypoint-detail', waypoint?.id],
    queryFn: () => waypointDetailApi.get(waypoint!.id),
    enabled: !!waypoint && isOpen,
  });

  const { data: visitLogs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['visit-logs', waypoint?.id],
    queryFn: () => visitLogApi.getAll(waypoint!.id),
    enabled: !!waypoint && isOpen,
  });

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ['tickets', waypoint?.id],
    queryFn: () => ticketApi.getAll(waypoint!.id),
    enabled: !!waypoint && isOpen,
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

  if (!isOpen || !waypoint) return null;

  // Chỉ SCHOOL mới có tab Tickets
  const showTicketsTab = waypoint.type === 'SCHOOL';

  return (
    <div className="fixed inset-0 z-[9999] bg-black bg-opacity-50 flex items-end sm:items-center sm:justify-center">
      <div className="bg-white w-full sm:max-w-3xl sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-800">{waypoint.name}</h2>
            {waypoint.address && (
              <p className="text-sm text-gray-500 mt-1">{waypoint.address}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0 flex border-b bg-gray-50">
          <button
            onClick={() => handleTabChange('detail')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'detail'
                ? 'text-primary-600 border-b-2 border-primary-600 bg-white'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            📋 Thông tin chi tiết
          </button>
          <button
            onClick={() => handleTabChange('visits')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'visits'
                ? 'text-primary-600 border-b-2 border-primary-600 bg-white'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            🏫 Lịch sử ({visitLogs.length})
          </button>
          {showTicketsTab && (
            <button
              onClick={() => handleTabChange('tickets')}
              className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                activeTab === 'tickets'
                  ? 'text-primary-600 border-b-2 border-primary-600 bg-white'
                  : 'text-gray-600 hover:text-gray-800'
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
