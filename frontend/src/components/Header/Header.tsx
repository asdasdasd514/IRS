import { Menu, HelpCircle, ShieldCheck } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

interface HeaderProps {
  onOpenMobileMenu?: () => void;
  title?: string;
  subtitle?: string;
}

export function Header({ onOpenMobileMenu, title, subtitle }: HeaderProps) {
  const user = useAppStore((state) => state.user);
  const userRole = user?.role || (user?.is_admin ? 'admin' : 'staff');

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between shrink-0">
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
                {userRole === 'admin' ? 'Bảng Quản Trị Hệ Thống' : 'Cổng Cán Bộ Thực Địa'}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Role badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200/60 text-[#0f3b7d] text-xs font-semibold">
          <ShieldCheck className="w-3.5 h-3.5 text-[#0f3b7d]" />
          <span>{userRole === 'admin' ? 'Quyền Quản Trị Viên' : 'Quyền Cán Bộ'}</span>
        </div>

        {/* Help circle icon as seen in provided UI screenshot */}
        <button
          title="Trợ giúp & Hướng dẫn"
          className="w-9 h-9 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
        >
          <HelpCircle className="w-5 h-5" />
        </button>

        {/* User avatar display */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-[#0f3b7d] text-white flex items-center justify-center font-bold text-xs uppercase shadow-xs">
            {user?.full_name
              ? user.full_name.charAt(0)
              : user?.username
              ? user.username.charAt(0)
              : 'U'}
          </div>
          <span className="hidden md:inline-block text-xs font-medium text-slate-700">
            {user?.full_name || user?.username}
          </span>
        </div>
      </div>
    </header>
  );
}
