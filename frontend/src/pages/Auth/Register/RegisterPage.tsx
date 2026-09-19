import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Mail, Lock, Shield, UserCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { authApi } from '../../../services/api';
import { UserRole } from '../../../types';

export function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAppStore((state) => state.setAuth);

  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    email: '',
    phone: '',
    role: 'staff' as UserRole,
    password: '',
    confirmPassword: '',
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (formData.password.length < 6) {
      setError('Mật khẩu phải có độ dài tối thiểu từ 6 ký tự trở lên.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp. Vui lòng kiểm tra lại.');
      return;
    }

    setLoading(true);

    try {
      // Gọi API đăng ký và nhận token trực tiếp
      const response = await authApi.register({
        username: formData.username.trim(),
        password: formData.password,
        email: formData.email.trim() || undefined,
        full_name: formData.fullName.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        role: formData.role,
      });

      const token = response.access_token;
      localStorage.setItem('token', token);

      const user = response.user || (await authApi.getMe());
      setAuth(user, token);

      // Phân quyền chuyển hướng
      if (formData.role === 'admin' || user.is_admin) {
        navigate('/admin/map');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      const msg =
        err.response?.data?.detail ||
        'Đăng ký tài khoản không thành công. Vui lòng thử lại.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-lg bg-white rounded-[5px] shadow-sm border border-slate-200/80 p-8 sm:p-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-[5px] bg-gradient-to-tr from-[#0f3b7d] to-[#2563eb] text-white font-black text-2xl mb-3 shadow-md tracking-wider">
            IRS
          </div>
          <h1 className="text-2xl font-black text-[#0f3b7d] tracking-tight">
            Đăng Ký Tài Khoản IRS
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Gia nhập nền tảng điều phối & quản trị tuyển sinh lưu động
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-3.5 bg-red-50 border border-red-200/80 rounded-[5px] flex items-start gap-2.5 text-red-700 text-sm animate-slide-up">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Họ và tên
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                name="fullName"
                type="text"
                value={formData.fullName}
                onChange={handleChange}
                placeholder="Nguyễn Văn A"
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50/50 border border-slate-300 rounded-[5px] focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-[#0f3b7d] outline-none transition"
                required
              />
            </div>
          </div>

          {/* Username & Email in a 2-col grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Tên đăng nhập
              </label>
              <input
                name="username"
                type="text"
                value={formData.username}
                onChange={handleChange}
                placeholder="nguyenvana"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50/50 border border-slate-300 rounded-[5px] focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-[#0f3b7d] outline-none transition"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Địa chỉ Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="vana@domain.com"
                  className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-slate-50/50 border border-slate-300 rounded-[5px] focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-[#0f3b7d] outline-none transition"
                />
              </div>
            </div>
          </div>

          {/* Role Selection (RBAC) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Phân quyền tài khoản
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex items-center gap-2.5 p-3 rounded-[5px] border cursor-pointer transition ${
                  formData.role === 'staff'
                    ? 'border-[#0f3b7d] bg-blue-50/60 text-[#0f3b7d] font-semibold'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value="staff"
                  checked={formData.role === 'staff'}
                  onChange={handleChange}
                  className="hidden"
                />
                <UserCheck className="w-4 h-4 shrink-0" />
                <div className="text-left">
                  <p className="text-xs font-bold leading-tight">Cán bộ tuyển sinh</p>
                  <p className="text-[10px] text-slate-500 font-normal">Thực địa & check-in</p>
                </div>
              </label>

              <label
                className={`flex items-center gap-2.5 p-3 rounded-[5px] border cursor-pointer transition ${
                  formData.role === 'admin'
                    ? 'border-[#0f3b7d] bg-blue-50/60 text-[#0f3b7d] font-semibold'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value="admin"
                  checked={formData.role === 'admin'}
                  onChange={handleChange}
                  className="hidden"
                />
                <Shield className="w-4 h-4 shrink-0" />
                <div className="text-left">
                  <p className="text-xs font-bold leading-tight">Quản trị viên</p>
                  <p className="text-[10px] text-slate-500 font-normal">Toàn quyền hệ thống</p>
                </div>
              </label>
            </div>
          </div>

          {/* Password & Confirm Password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Mật khẩu
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Tối thiểu 6 ký tự"
                  className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-slate-50/50 border border-slate-300 rounded-[5px] focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-[#0f3b7d] outline-none transition"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Xác nhận mật khẩu
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Nhập lại mật khẩu"
                  className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-slate-50/50 border border-slate-300 rounded-[5px] focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-[#0f3b7d] outline-none transition"
                  required
                />
              </div>
            </div>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 bg-[#0f3b7d] hover:bg-[#0c2f64] text-white font-semibold py-2.5 px-4 rounded-[5px] transition duration-200 flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Đang khởi tạo tài khoản...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Hoàn tất Đăng ký & Đăng nhập</span>
              </>
            )}
          </button>
        </form>

        {/* Link to Login */}
        <div className="mt-6 pt-6 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-500">
            Đã có tài khoản IRS?{' '}
            <Link
              to="/login"
              className="text-[#0f3b7d] font-semibold hover:underline"
            >
              Đăng nhập ngay
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
