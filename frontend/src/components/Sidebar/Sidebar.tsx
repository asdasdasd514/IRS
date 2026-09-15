import { NavLink } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { NAV_GROUPS, BOTTOM_NAV_ITEMS } from './sidebarNavConfig';

interface SidebarProps {
  onCloseMobile?: () => void;
}

export function Sidebar({ onCloseMobile }: SidebarProps) {
  const { user } = useAppStore();

  const userRole = user?.role || (user?.is_admin ? 'admin' : 'staff');

  const filteredNavGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.includes(userRole)),
  })).filter((group) => group.items.length > 0);

  const filteredBottomItems = BOTTOM_NAV_ITEMS.filter((item) =>
    item.roles.includes(userRole)
  );

  return (
    <aside className="w-64 bg-white h-screen flex flex-col border-r border-slate-200/80 select-none shrink-0 transition-all duration-300">
      {/* Brand Header */}
      <div className="px-6 pt-6 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0f3b7d] to-[#2563eb] flex items-center justify-center text-white shadow-sm font-black text-sm tracking-wider">
            IRS
          </div>
          <div>
            <h1 className="text-xl font-black text-[#0f3b7d] tracking-tight leading-none">
              IRS
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Hệ thống Tuyển sinh
            </p>
          </div>
        </div>
      </div>

      {/* Grouped Navigation Items */}
      <nav className="flex-1 px-3 py-2 space-y-4 overflow-y-auto">
        {filteredNavGroups.map((group) => (
          <div key={group.id} className="space-y-1">
            <div className="px-3.5 pt-1 pb-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {group.title}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    onClick={onCloseMobile}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all duration-200 group ${
                        isActive
                          ? 'bg-[#dbeafe]/80 text-[#0f3b7d] font-semibold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          className={`w-5 h-5 transition-colors ${
                            isActive
                              ? 'text-[#0f3b7d]'
                              : 'text-slate-400 group-hover:text-slate-700'
                          }`}
                        />
                        <span className="flex-1 text-[13.5px]">{item.label}</span>
                        {item.badge && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom Section */}
      <div className="p-3 border-t border-slate-100 space-y-1">
        {filteredBottomItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.id}
              to={item.path}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm transition-all duration-200 group ${
                  isActive
                    ? 'bg-[#dbeafe]/80 text-[#0f3b7d] font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`w-5 h-5 transition-colors ${
                      isActive
                        ? 'text-[#0f3b7d]'
                        : 'text-slate-400 group-hover:text-slate-700'
                    }`}
                  />
                  <span className="text-[13.5px]">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </aside>
  );
}
