import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, HelpCircle, ShieldCheck, ChevronDown, LogOut, Bell } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

interface HeaderProps {
  onOpenMobileMenu?: () => void;
  title?: string;
  subtitle?: string;
}

export function Header({ onOpenMobileMenu, title, subtitle }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAppStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const userRole = user?.role || (user?.is_admin ? 'admin' : 'staff');

  const getBreadcrumbTitle = () => {
    if (title) return title;
    if (location.pathname.startsWith('/admin/campaigns')) return 'Quản Lý Chiến Dịch Tuyển Sinh';
    if (location.pathname.startsWith('/admin/locations')) return 'Quản Lý Địa Điểm Trường';
    if (location.pathname.startsWith('/admin/members')) return 'Quản Lý Tài Khoản Nhân Sự';
    if (location.pathname.startsWith('/admin/logs')) return 'Nhật Ký Hệ Thống';
    if (location.pathname.startsWith('/admin/map')) return 'Bản Đồ Tuyển Sinh';
    return userRole === 'admin' ? 'Bảng Quản Trị Hệ Thống' : 'Cổng Cán Bộ Thực Địa';
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 flex items-center justify-between shrink-0 relative z-30">
      <div className="flex items-center gap-3">
        {/* Mobile toggle button */}
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
          aria-label="Mở menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          {title ? (
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                {title}
              </h2>
              {subtitle && (
                <p className="text-xs text-slate-500 hidden sm:block">
                  {subtitle}
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-[#0f3b7d]">IRS Admissions</span>
              <span>/</span>
              <span className="text-slate-700 font-medium capitalize">
                {getBreadcrumbTitle()}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Role badge */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200/60 text-[#0f3b7d] text-xs font-semibold">
          <ShieldCheck className="w-3.5 h-3.5 text-[#0f3b7d]" />
          <span>{userRole === 'admin' ? 'Quyền Quản Trị Viên' : 'Quyền Cán Bộ'}</span>
        </div>

        {/* Help circle icon */}
        <button
          title="Trợ giúp & Hướng dẫn"
          className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
        >
          <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* Notification Bell */}
        <button
          title="Thông báo"
          className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
        >
          <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* User Account Menu with Logout Dropdown in Top-Right Corner */}
        <div className="relative pl-1 sm:pl-2 border-l border-slate-200" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="flex items-center gap-2 sm:gap-2.5 p-1 sm:p-1.5 rounded-xl hover:bg-slate-100 transition duration-150 border border-transparent hover:border-slate-200 group"
          >
            <div className="w-8 h-8 rounded-full bg-[#0f3b7d] text-white flex items-center justify-center font-bold text-xs uppercase shadow-xs shrink-0 group-hover:scale-105 transition-transform">
              {user?.full_name
                ? user.full_name.charAt(0)
                : user?.username
                ? user.username.charAt(0)
                : 'U'}
            </div>

            <div className="hidden sm:block text-left min-w-0">
              <p className="text-xs font-bold text-slate-800 leading-tight truncate max-w-[140px]">
                {user?.full_name || user?.username || 'Người dùng'}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <span
                  className={`inline-block w-1.5 h-1.5 rounded-full ${
                    userRole === 'admin' ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                />
                <span className="text-[10.5px] text-slate-500 capitalize">
                  {userRole === 'admin' ? 'Quản Trị Viên' : 'Cán Bộ'}
                </span>
              </div>
            </div>

            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                dropdownOpen ? 'rotate-180 text-slate-700' : ''
              }`}
            />
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-60 bg-white rounded-[5px] shadow-xl border border-slate-200/80 py-1.5 z-50 animate-scale-in">
              {/* User summary */}
              <div className="px-4 py-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-[#0f3b7d] text-white flex items-center justify-center font-bold text-sm uppercase shadow-xs shrink-0">
                    {user?.full_name
                      ? user.full_name.charAt(0)
                      : user?.username
                      ? user.username.charAt(0)
                      : 'U'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {user?.full_name || user?.username || 'Người dùng'}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {user?.email || (user?.username ? `@${user.username}` : '')}
                    </p>
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-50 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Vai trò:</span>
                  <span className="font-semibold text-[#0f3b7d]">
                    {userRole === 'admin' ? 'Quản trị viên' : 'Cán bộ tuyển sinh'}
                  </span>
                </div>
              </div>

              {/* Logout button */}
              <div className="p-1.5">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-xl transition duration-150"
                >
                  <LogOut className="w-4 h-4 text-red-500" />
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
