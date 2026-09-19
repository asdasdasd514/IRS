import { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  ShieldCheck,
  UserCheck,
  Lock,
  Unlock,
  Trash2,
  Mail,
  Phone,
  CheckCircle2
} from 'lucide-react';
import { authApi } from '../../../services/api';
import { User, UserRole } from '../../../types';
import { useAppStore } from '../../../store/useAppStore';

export function AdminMembersPage() {
  const currentUser = useAppStore((state) => state.user);
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'staff'>('all');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New Member Form
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    full_name: '',
    email: '',
    phone: '',
    role: 'staff' as UserRole,
  });

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await authApi.listUsers();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username || !formData.password) return;
    try {
      await authApi.createUser({
        username: formData.username.trim(),
        password: formData.password,
        full_name: formData.full_name.trim() || undefined,
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        role: formData.role,
      });

      setIsModalOpen(false);
      setFormData({
        username: '',
        password: '',
        full_name: '',
        email: '',
        phone: '',
        role: 'staff',
      });
      setSuccessMsg('Cấp tài khoản thành viên mới thành công!');
      setTimeout(() => setSuccessMsg(null), 3000);
      loadUsers();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Không thể tạo tài khoản');
    }
  };

  const handleToggleActive = async (targetUser: User) => {
    if (targetUser.id === currentUser?.id) {
      alert('Bạn không thể tự vô hiệu hóa tài khoản quản trị của chính mình.');
      return;
    }
    try {
      await authApi.updateUser(targetUser.id, {
        is_active: !targetUser.is_active,
      });
      loadUsers();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Lỗi khi cập nhật trạng thái');
    }
  };

  const handleDeleteUser = async (targetUser: User) => {
    if (targetUser.id === currentUser?.id) {
      alert('Bạn không thể tự xóa tài khoản quản trị của chính mình.');
      return;
    }
    if (!window.confirm(`Bạn có chắc muốn xóa tài khoản '${targetUser.username}'?`)) {
      return;
    }
    try {
      await authApi.deleteUser(targetUser.id);
      loadUsers();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Lỗi khi xóa tài khoản');
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesRole =
      roleFilter === 'all' ||
      (roleFilter === 'admin' && (u.role === 'admin' || u.is_admin)) ||
      (roleFilter === 'staff' && u.role === 'staff' && !u.is_admin);

    const term = searchTerm.toLowerCase();
    const matchesSearch =
      u.username.toLowerCase().includes(term) ||
      (u.full_name && u.full_name.toLowerCase().includes(term)) ||
      (u.email && u.email.toLowerCase().includes(term));

    return matchesRole && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Quản Lý Thành Viên & Phân Quyền
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Quản trị danh sách nhân sự, phân cấp quyền hạn (Admin / Staff) và trạng thái hoạt động.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-[#0f3b7d] hover:bg-[#0c2f64] text-white font-semibold py-2.5 px-4 rounded-[5px] transition duration-200 flex items-center justify-center gap-2 text-sm shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm thành viên</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-[5px] flex items-center gap-3 text-emerald-800 text-sm animate-slide-up">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-[5px] border border-slate-200/80 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm theo username, họ tên, email..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-300 rounded-[5px] focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-[#0f3b7d] outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {(['all', 'admin', 'staff'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3.5 py-1.5 rounded-[5px] text-xs font-semibold capitalize transition ${
                roleFilter === r
                  ? 'bg-[#0f3b7d] text-white'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              {r === 'all' ? 'Tất cả' : r === 'admin' ? 'Quản trị viên' : 'Cán bộ'}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table / Grid */}
      <div className="bg-white rounded-[5px] border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="text-center py-16">
            <div className="w-8 h-8 border-3 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-500 font-medium">Đang tải danh sách thành viên...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-16">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-base font-bold text-slate-700">Không tìm thấy thành viên phù hợp</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200/80">
                <tr>
                  <th className="px-6 py-3.5">Họ tên & Tài khoản</th>
                  <th className="px-6 py-3.5">Email / Liên hệ</th>
                  <th className="px-6 py-3.5">Vai trò (RBAC)</th>
                  <th className="px-6 py-3.5">Trạng thái</th>
                  <th className="px-6 py-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => {
                  const isAdmin = u.role === 'admin' || u.is_admin;
                  const isCurrent = u.id === currentUser?.id;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#0f3b7d] text-white flex items-center justify-center font-bold text-xs uppercase shrink-0">
                            {u.full_name
                              ? u.full_name.charAt(0)
                              : u.username.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 leading-tight">
                              {u.full_name || u.username}
                              {isCurrent && (
                                <span className="ml-1.5 text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-medium">
                                  Bạn
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5 font-mono">
                              @{u.username}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-xs">
                        <div className="space-y-1">
                          {u.email && (
                            <div className="flex items-center gap-1.5 text-slate-600">
                              <Mail className="w-3.5 h-3.5 text-slate-400" />
                              <span>{u.email}</span>
                            </div>
                          )}
                          {u.phone && (
                            <div className="flex items-center gap-1.5 text-slate-500">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              <span>{u.phone}</span>
                            </div>
                          )}
                          {!u.email && !u.phone && (
                            <span className="text-slate-400 italic">Chưa có liên hệ</span>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            isAdmin
                              ? 'bg-amber-50 text-amber-800 border border-amber-200/60'
                              : 'bg-blue-50 text-[#0f3b7d] border border-blue-200/60'
                          }`}
                        >
                          {isAdmin ? (
                            <>
                              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                              <span>Quản trị viên</span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3.5 h-3.5 text-[#0f3b7d]" />
                              <span>Cán bộ</span>
                            </>
                          )}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-semibold ${
                            u.is_active
                              ? 'text-emerald-600'
                              : 'text-red-500 line-through'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              u.is_active ? 'bg-emerald-500' : 'bg-red-500'
                            }`}
                          />
                          <span>{u.is_active ? 'Hoạt động' : 'Đã khóa'}</span>
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isCurrent && (
                            <>
                              <button
                                onClick={() => handleToggleActive(u)}
                                title={u.is_active ? 'Khóa tài khoản' : 'Kích hoạt lại'}
                                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                              >
                                {u.is_active ? (
                                  <Lock className="w-4 h-4" />
                                ) : (
                                  <Unlock className="w-4 h-4 text-emerald-600" />
                                )}
                              </button>
                              <button
                                onClick={() => handleDeleteUser(u)}
                                title="Xóa tài khoản"
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Thêm Thành Viên Mới */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-[5px] max-w-md w-full p-6 shadow-xl border border-slate-200 animate-slide-up">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              Cấp Tài Khoản Thành Viên Mới
            </h3>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Họ và tên
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Ví dụ: Trần Văn Nam"
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-[5px] focus:bg-white outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Tên đăng nhập *
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="namtv"
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-[5px] focus:bg-white outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Mật khẩu *
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-[5px] focus:bg-white outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Địa chỉ Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="namtv@domain.com"
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-[5px] focus:bg-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Vai trò (Phân quyền)
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-[5px] focus:bg-white outline-none"
                >
                  <option value="staff">Cán bộ tuyển sinh (Staff)</option>
                  <option value="admin">Quản trị viên (Admin)</option>
                </select>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2 px-4 rounded-[5px] border border-slate-300 text-slate-600 font-semibold text-xs hover:bg-slate-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-4 rounded-[5px] bg-[#0f3b7d] text-white font-semibold text-xs hover:bg-[#0c2f64]"
                >
                  Tạo tài khoản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
