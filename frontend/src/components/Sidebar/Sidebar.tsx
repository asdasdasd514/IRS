import { NavLink } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { NAV_GROUPS, BOTTOM_NAV_ITEMS } from './sidebarNavConfig';

interface SidebarProps {
  onCloseMobile?: () => void;
}

export function Sidebar({ onCloseMobile }: SidebarProps) {
  const { user, sidebarCollapsed, toggleSidebar } = useAppStore();

  const isCollapsed = Boolean(sidebarCollapsed && !onCloseMobile);

  const userRole = user?.role || (user?.is_admin ? 'admin' : 'staff');

  const filteredNavGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.includes(userRole)),
  })).filter((group) => group.items.length > 0);

  const filteredBottomItems = BOTTOM_NAV_ITEMS.filter((item) =>
    item.roles.includes(userRole)
  );

  return (
    <aside
      className={`${
        isCollapsed ? 'w-20' : 'w-64'
      } bg-white h-screen flex flex-col border-r border-slate-200/80 select-none shrink-0 transition-all duration-300 ease-in-out`}
    >
      {/* Brand Header: Click directly on IRS logo/title to toggle expand/collapse */}
      {isCollapsed ? (
        <div className="pt-5 pb-4 px-2 flex flex-col items-center justify-center border-b border-slate-100">
          <div
            role="button"
            onClick={toggleSidebar}
            className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0f3b7d] to-[#2563eb] flex items-center justify-center text-white shadow-sm font-black text-sm tracking-wider shrink-0 cursor-pointer hover:scale-105 hover:shadow-md transition active:scale-95"
            title="Bấm vào logo để mở rộng sidebar"
          >
            IRS
          </div>
        </div>
      ) : (
        <div className="px-5 pt-6 pb-5 flex items-center border-b border-slate-100/60">
          <div
            role="button"
            onClick={!onCloseMobile ? toggleSidebar : undefined}
            className={`flex items-center gap-3 min-w-0 select-none ${
              !onCloseMobile ? 'cursor-pointer group' : ''
            }`}
            title={!onCloseMobile ? 'Bấm vào logo để thu gọn sidebar' : undefined}
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0f3b7d] to-[#2563eb] flex items-center justify-center text-white shadow-sm font-black text-sm tracking-wider shrink-0 group-hover:scale-105 group-hover:shadow-md transition active:scale-95">
              IRS
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-black text-[#0f3b7d] tracking-tight leading-none group-hover:text-blue-700 transition">
                IRS
              </h1>
            </div>
          </div>
        </div>
      )}

      {/* Grouped Navigation Items */}
      <nav className={`flex-1 ${isCollapsed ? 'px-2 py-3' : 'px-3 py-2'} space-y-3 overflow-y-auto overflow-x-hidden`}>
        {filteredNavGroups.map((group, gIdx) => (
          <div key={group.id} className="space-y-1">
            {isCollapsed ? (
              gIdx > 0 && <div className="my-2 border-t border-slate-100 mx-2" title={group.title} />
            ) : (
              <div className="px-3.5 pt-1 pb-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {group.title}
              </div>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    onClick={onCloseMobile}
                    title={isCollapsed ? `${group.title}: ${item.label}` : undefined}
                    className={({ isActive }) =>
                      `flex items-center ${
                        isCollapsed
                          ? 'justify-center p-2.5 rounded-xl'
                          : 'gap-3 px-3.5 py-2.5 rounded-xl text-sm'
                      } transition-all duration-200 group relative ${
                        isActive
                          ? 'bg-[#dbeafe]/80 text-[#0f3b7d] font-semibold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          className={`w-5 h-5 shrink-0 transition-colors ${
                            isActive
                              ? 'text-[#0f3b7d]'
                              : 'text-slate-400 group-hover:text-slate-700'
                          }`}
                        />
                        {!isCollapsed && (
                          <>
                            <span className="flex-1 text-[13.5px] truncate">{item.label}</span>
                            {item.badge && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold shrink-0">
                                {item.badge}
                              </span>
                            )}
                          </>
                        )}
                        {isCollapsed && item.badge && (
                          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600" />
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
      <div className={`p-2.5 border-t border-slate-100 space-y-1.5 shrink-0 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
        {filteredBottomItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.id}
              to={item.path}
              onClick={onCloseMobile}
              title={isCollapsed ? item.label : undefined}
              className={({ isActive }) =>
                `flex items-center ${
                  isCollapsed
                    ? 'justify-center p-2.5 rounded-xl w-full'
                    : 'gap-3 px-3.5 py-2 rounded-xl text-sm'
                } transition-all duration-200 group ${
                  isActive
                    ? 'bg-[#dbeafe]/80 text-[#0f3b7d] font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`w-5 h-5 shrink-0 transition-colors ${
                      isActive
                        ? 'text-[#0f3b7d]'
                        : 'text-slate-400 group-hover:text-slate-700'
                    }`}
                  />
                  {!isCollapsed && <span className="text-[13.5px] truncate">{item.label}</span>}
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </aside>
  );
}
