import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { Ticket, TicketFormData } from '../../types';
import { ticketApi } from '../../services/api';
import { Trash2, Plus } from 'lucide-react';

interface TicketTabProps {
  waypointId: string;
  tickets: Ticket[];
  isLoading: boolean;
  onUpdate: () => void;
}

export const TicketTab: React.FC<TicketTabProps> = ({ waypointId, tickets, isLoading, onUpdate }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState<TicketFormData>({
    visit_number: 1,
    tickets_collected: 0,
    notes: '',
  });
  const [ticketsInput, setTicketsInput] = useState<string>('0');

  const createMutation = useMutation({
    mutationFn: (data: TicketFormData) => ticketApi.create(waypointId, data),
    onSuccess: () => {
      onUpdate();
      setIsAdding(false);
      setFormData({ visit_number: 1, tickets_collected: 0, notes: '' });
      setTicketsInput('0');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (ticketId: string) => ticketApi.delete(ticketId),
    onSuccess: () => {
      onUpdate();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ticketsCollected = parseInt(ticketsInput) || 0;
    createMutation.mutate({ ...formData, tickets_collected: ticketsCollected });
  };

  // Calculate totals
  const totalTickets = tickets.reduce((sum, t) => sum + t.tickets_collected, 0);
  const totalVisits = tickets.length;

  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">Đang tải...</div>;
  }

  return (
    <div className="space-y-4 h-[500px] pb-8 overflow-y-auto">
      {/* Summary */}
      {tickets.length > 0 && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-600 mb-1">Tổng số lần đến</p>
            <p className="text-3xl font-bold text-blue-700">{totalVisits}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-green-600 mb-1">Tổng số phiếu</p>
            <p className="text-3xl font-bold text-green-700">{totalTickets}</p>
          </div>
        </div>
      )}

      {/* Add button */}
      {!isAdding && (
        <button
          onClick={() => {
            // Auto-increment visit number
            const nextVisit = tickets.length > 0 
              ? Math.max(...tickets.map(t => t.visit_number)) + 1 
              : 1;
            setFormData({ ...formData, visit_number: nextVisit });
            setTicketsInput('');
            setIsAdding(true);
          }}
          className="w-full bg-primary-500 text-white py-3 rounded-lg hover:bg-primary-600 font-medium flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Thêm phiếu thu
        </button>
      )}

      {/* Add form */}
      {isAdding && (
        <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded-lg space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Lần đến thứ *
              </label>
              <input
                type="number"
                value={formData.visit_number}
                onChange={(e) => setFormData({ ...formData, visit_number: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                min="1"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Số phiếu thu được *
              </label>
              <input
                type="number"
                value={ticketsInput}
                onChange={(e) => setTicketsInput(e.target.value)}
                onFocus={(e) => e.target.select()}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                min="0"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ghi chú
            </label>
            <input
              type="text"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="Ghi chú ngắn..."
              maxLength={500}
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setFormData({ visit_number: 1, tickets_collected: 0, notes: '' });
                setTicketsInput('0');
              }}
              className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 bg-primary-500 text-white py-2 rounded-lg hover:bg-primary-600 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </form>
      )}

      {/* List */}
      {tickets.length === 0 && !isAdding && (
        <div className="text-center py-8 text-gray-500">
          Chưa có phiếu thu
        </div>
      )}

      <div className="space-y-2">
        {tickets.map((ticket) => (
          <div key={ticket.id} className="bg-white border rounded-lg p-4 flex items-center justify-between hover:bg-gray-50">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <div className="bg-primary-100 text-primary-700 px-3 py-1 rounded-full font-semibold text-sm">
                  Lần {ticket.visit_number}
                </div>
                <div>
                  <p className="font-bold text-lg text-gray-800">{ticket.tickets_collected} phiếu</p>
                  <p className="text-xs text-gray-500">
                    {new Date(ticket.collection_date).toLocaleDateString('vi-VN')}
                  </p>
                </div>
              </div>
              {ticket.notes && (
                <p className="text-sm text-gray-600 mt-2">{ticket.notes}</p>
              )}
            </div>

            <button
              onClick={() => {
                if (window.confirm('Xóa phiếu này?')) {
                  deleteMutation.mutate(ticket.id);
                }
              }}
              className="text-red-500 hover:text-red-700 p-2"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
