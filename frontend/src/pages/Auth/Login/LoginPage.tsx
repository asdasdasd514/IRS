import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Lock, User, LogIn, AlertCircle } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { authApi } from '../../../services/api';

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAppStore((state) => state.setAuth);

  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Gửi yêu cầu đăng nhập bằng Username HOẶC Email
      const loginRes = await authApi.login(usernameOrEmail.trim(), password);
      const token = loginRes.access_token;

      localStorage.setItem('token', token);

      // 2. Lấy thông tin user đầy đủ (Role, Permissions)
      const user = loginRes.user || (await authApi.getMe());
      setAuth(user, token);

      // 3. Phân quyền chuyển hướng (RBAC)
      const isAdmin = user.is_admin || user.role === 'admin';
      if (isAdmin) {
        navigate('/admin/map');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      const msg =
        err.response?.data?.detail ||
        'Tài khoản hoặc mật khẩu không chính xác. Vui lòng thử lại.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-[5px] shadow-sm border border-slate-200/80 p-8 sm:p-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-[5px] bg-gradient-to-tr from-[#0f3b7d] to-[#2563eb] text-white font-black text-2xl mb-3 shadow-md tracking-wider">
            IRS
          </div>
          <h1 className="text-2xl font-black text-[#0f3b7d] tracking-tight">
            IRS Admissions
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Hệ thống Tuyển sinh & Định tuyến Lộ trình
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-3.5 bg-red-50 border border-red-200/80 rounded-[5px] flex items-start gap-2.5 text-red-700 text-sm animate-slide-up">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Username or Email Input */}
          <div>
            <label
              htmlFor="usernameOrEmail"
              className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2"
            >
              Tài khoản hoặc Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                id="usernameOrEmail"
                type="text"
                autoComplete="username"
                value={usernameOrEmail}
                onChange={(e) => setUsernameOrEmail(e.target.value)}
                placeholder="admin hoặc email@domain.com"
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50/50 border border-slate-300 rounded-[5px] focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-[#0f3b7d] outline-none transition"
                required
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2"
            >
              Mật khẩu
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50/50 border border-slate-300 rounded-[5px] focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-[#0f3b7d] outline-none transition"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-[#0f3b7d] hover:bg-[#0c2f64] text-white font-semibold py-2.5 px-4 rounded-[5px] transition duration-200 flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Đang kiểm tra thông tin...</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Đăng nhập hệ thống</span>
              </>
            )}
          </button>
        </form>

        {/* Link to Register */}
        <div className="mt-6 pt-6 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-500">
            Chưa có tài khoản tham gia tuyển sinh?{' '}
            <Link
              to="/register"
              className="text-[#0f3b7d] font-semibold hover:underline"
            >
              Đăng ký ngay
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
