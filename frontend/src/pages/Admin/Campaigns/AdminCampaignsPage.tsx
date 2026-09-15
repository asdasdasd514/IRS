import { useState, useEffect } from 'react';
import {
  Compass,
  Plus,
  Play,
  Building2,
  Zap,
  Clock,
  Sparkles
} from 'lucide-react';
import { campaignApi } from '../../../services/api';

export function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // New Campaign Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNotes, setNewNotes] = useState('');

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const data = await campaignApi.getAll();
      setCampaigns(data);
    } catch (err) {
      console.error('Error fetching campaigns:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, []);

  const handleOptimizeRoute = async (campaignId: string) => {
    try {
      setActionLoading(`opt-${campaignId}`);
      const res = await campaignApi.optimizeRoute(campaignId);
      setActionMessage(
        `Đã tính toán thành công lộ trình Next-Hop cho chiến dịch! Tổng quãng đường: ${res.estimated_distance_km} km (${res.total_destinations} trường).`
      );
      loadCampaigns();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Lỗi khi tối ưu đường đi');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeploy = async (campaignId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn triển khai chiến dịch này thành chuyến đi thực tế?')) {
      return;
    }
    try {
      setActionLoading(`deploy-${campaignId}`);
      await campaignApi.deploy(campaignId);
      setActionMessage('Đã triển khai chiến dịch thành công! Chuyến đi thực tế đã sẵn sàng.');
      loadCampaigns();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Lỗi khi triển khai chiến dịch');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await campaignApi.create({
        name: newName.trim(),
        notes: newNotes.trim() || undefined,
        destinations: [],
      });
      setIsModalOpen(false);
      setNewName('');
      setNewNotes('');
      loadCampaigns();
      setActionMessage('Tạo chiến dịch tuyển sinh mới thành công!');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Không thể tạo chiến dịch');
    }
  };

  const filteredCampaigns = campaigns.filter((c) => {
    if (selectedStatus === 'all') return true;
    return c.status === selectedStatus;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Quản Lý Chiến Dịch Tuyển Sinh
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Quy hoạch lộ trình, áp dụng thuật toán Dynamic Next-Hop và triển khai các đoàn công tác.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-[#0f3b7d] hover:bg-[#0c2f64] text-white font-semibold py-2.5 px-4 rounded-xl transition duration-200 flex items-center justify-center gap-2 text-sm shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Tạo chiến dịch mới</span>
        </button>
      </div>

      {/* Action Notification */}
      {actionMessage && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-between gap-3 text-blue-900 text-sm animate-slide-up">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-blue-600 shrink-0" />
            <span className="font-semibold">{actionMessage}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-xs text-blue-700 hover:underline"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {['all', 'draft', 'active', 'deployed', 'completed'].map((st) => (
          <button
            key={st}
            onClick={() => setSelectedStatus(st)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold capitalize transition ${
              selectedStatus === st
                ? 'bg-[#0f3b7d] text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            {st === 'all'
              ? 'Tất cả'
              : st === 'draft'
              ? 'Bản nháp'
              : st === 'active'
              ? 'Đang hoạt động'
              : st === 'deployed'
              ? 'Đã triển khai'
              : 'Đã hoàn tất'}
          </button>
        ))}
      </div>

      {/* Campaigns Grid */}
      {loading ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/80">
          <div className="w-8 h-8 border-3 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500 font-medium">Đang tải danh sách chiến dịch...</p>
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/80">
          <Compass className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-base font-bold text-slate-700">Chưa có chiến dịch nào</p>
          <p className="text-xs text-slate-400 mt-1">
            Nhấn "Tạo chiến dịch mới" để bắt đầu quy hoạch đợt tuyển sinh.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCampaigns.map((camp) => (
            <div
              key={camp.id || camp._id}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="text-base font-bold text-slate-900 leading-snug">
                    {camp.name}
                  </h3>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      camp.status === 'deployed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : camp.status === 'active'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {camp.status || 'draft'}
                  </span>
                </div>

                <p className="text-xs text-slate-500 mb-4 line-clamp-2">
                  {camp.notes || 'Chưa có ghi chú chiến dịch'}
                </p>

                <div className="space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>Số trường mục tiêu: </span>
                    <strong className="text-slate-800">
                      {camp.destinations?.length || 0} trường
                    </strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Thuật toán: </span>
                    <span className="font-semibold text-blue-700">Dynamic Next-Hop</span>
                  </div>
                </div>
              </div>

              {/* Card Actions */}
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center gap-2">
                <button
                  onClick={() => handleOptimizeRoute(camp.id)}
                  disabled={actionLoading === `opt-${camp.id}`}
                  className="flex-1 py-2 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#0f3b7d] text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                >
                  <Zap className="w-3.5 h-3.5 text-[#0f3b7d]" />
                  <span>Tối ưu Next-Hop</span>
                </button>

                {camp.status !== 'deployed' && (
                  <button
                    onClick={() => handleDeploy(camp.id)}
                    disabled={actionLoading === `deploy-${camp.id}`}
                    className="flex-1 py-2 px-3 rounded-xl bg-[#0f3b7d] hover:bg-[#0c2f64] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Triển khai</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Tạo Chiến Dịch */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 animate-slide-up">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              Tạo Chiến Dịch Tuyển Sinh Mới
            </h3>

            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                  Tên chiến dịch *
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ví dụ: Tuyển sinh Đồng Nai 2026 Đợt 1"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-[#0f3b7d] outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                  Ghi chú & Mục tiêu
                </label>
                <textarea
                  rows={3}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Ghi chú về đoàn xe, mục tiêu tiếp cận học sinh..."
                  className="w-full p-3 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-[#0f3b7d] outline-none resize-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-600 font-semibold text-xs hover:bg-slate-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#0f3b7d] text-white font-semibold text-xs hover:bg-[#0c2f64]"
                >
                  Xác nhận tạo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
