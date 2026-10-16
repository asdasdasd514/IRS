import React from 'react';
import { useMutation } from '@tanstack/react-query';
import type { Ticket } from '../../types';
import { ticketApi } from '../../services/api';
import { Trash2, User, Phone, GraduationCap, Calendar, FileText, CheckCircle2 } from 'lucide-react';

interface TicketTabProps {
  waypointId: string;
  tickets: Ticket[];
  isLoading: boolean;
  onUpdate: () => void;
}

export const TicketTab: React.FC<TicketTabProps> = ({ tickets, isLoading, onUpdate }) => {
  const deleteMutation = useMutation({
    mutationFn: (ticketId: string) => ticketApi.delete(ticketId),
    onSuccess: () => {
      onUpdate();
    },
  });

  // Calculate totals
  const totalTickets = tickets.reduce((sum, t) => sum + (t.tickets_collected || 1), 0);
  const totalStudents = tickets.length;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <div className="w-8 h-8 border-3 border-blue-600/30 border-t-[#0f3b7d] rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold">Đang tải danh sách phiếu thu...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 h-[500px] pb-6 overflow-y-auto pr-1">
      {/* Thống kê phiếu */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gradient-to-br from-blue-50 to-slate-50 p-4 rounded-[5px] border border-blue-100/80">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-1">
            Tổng số phiếu khảo sát
          </p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-[#0f3b7d]">{totalTickets}</span>
            <span className="text-xs font-medium text-slate-500">phiếu</span>
          </div>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-slate-50 p-4 rounded-[5px] border border-emerald-100/80">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-1">
            Học sinh đăng ký
          </p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-emerald-800">{totalStudents}</span>
            <span className="text-xs font-medium text-slate-500">học sinh</span>
          </div>
        </div>
      </div>

      {/* Danh sách phiếu */}
      {tickets.length === 0 ? (
        <div className="text-center py-16 bg-slate-50/60 rounded-[5px] border border-dashed border-slate-200">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700">Chưa có phiếu thu thập nào</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Phiếu tuyển sinh sẽ tự động cập nhật khi cán bộ tiếp cận thực địa hoặc học sinh quét mã QR khảo sát.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket, index) => {
            const studentDisplayName =
              ticket.student_name && ticket.student_name.trim()
                ? ticket.student_name.trim()
                : `Phiếu khảo sát tuyển sinh #${index + 1}`;

            const dateStr = ticket.collection_date || ticket.created_at;
            let formattedDate = '';
            if (dateStr) {
              try {
                const d = new Date(dateStr);
                formattedDate = `${d.toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}, ${d.toLocaleDateString('vi-VN')}`;
              } catch {
                formattedDate = String(dateStr);
              }
            }

            return (
              <div
                key={ticket.id}
                className="bg-white border border-slate-200/80 rounded-[5px] p-4 shadow-xs hover:border-blue-200 hover:shadow-sm transition space-y-3"
              >
                {/* Header phiếu: Tên học sinh, Lần đến, Nguồn & Nút Xóa */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-blue-50 text-[#0f3b7d] flex items-center justify-center shrink-0 font-bold">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-900 text-sm truncate flex items-center gap-2">
                        <span>{studentDisplayName}</span>
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {ticket.grade && (
                          <span className="text-[10.5px] px-2 py-0.5 rounded bg-blue-50 font-semibold text-[#0f3b7d]">
                            Lớp: {ticket.grade}
                          </span>
                        )}
                        <span className="text-[10.5px] px-2 py-0.5 rounded bg-slate-100 font-semibold text-slate-600">
                          Lần đến thứ {ticket.visit_number || 1}
                        </span>
                        {ticket.source && (
                          <span className="text-[10.5px] px-2 py-0.5 rounded bg-purple-50 font-semibold text-purple-700">
                            {ticket.source === 'QR_ONLINE' ? 'Khảo sát QR Online' : ticket.source}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (window.confirm(`Xác nhận xóa phiếu của "${studentDisplayName}"?`)) {
                        deleteMutation.mutate(ticket.id);
                      }
                    }}
                    title="Xóa phiếu này"
                    className="text-slate-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded transition shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* SĐT Học sinh */}
                {ticket.phone && (
                  <div className="flex items-center gap-2 text-xs text-slate-600 pl-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Số điện thoại:</span>
                    <a
                      href={`tel:${ticket.phone}`}
                      className="font-mono font-bold text-[#0f3b7d] hover:underline"
                    >
                      {ticket.phone}
                    </a>
                  </div>
                )}

                {/* Ngành học quan tâm */}
                {ticket.interested_majors && ticket.interested_majors.length > 0 && (
                  <div className="space-y-1.5 pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      <GraduationCap className="w-3.5 h-3.5 text-[#0f3b7d]" />
                      <span>Ngành học quan tâm</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {ticket.interested_majors.map((major, mIdx) => (
                        <span
                          key={mIdx}
                          className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/60 text-xs font-medium"
                        >
                          {major}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Nội dung phiếu / Ghi chú / Nguyện vọng */}
                {ticket.notes && (
                  <div className="space-y-1 pt-1 border-t border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Nội dung phiếu & Ghi chú:
                    </span>
                    <div className="p-3 bg-slate-50 rounded-[5px] border border-slate-200/60 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {ticket.notes}
                    </div>
                  </div>
                )}

                {/* Footer: Thời gian thu */}
                {formattedDate && (
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      Ngày thu: {formattedDate}
                    </span>
                    <span className="flex items-center gap-1 text-emerald-600 font-medium">
                      <CheckCircle2 className="w-3 h-3" />
                      Đã ghi nhận
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
