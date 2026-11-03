import { NavLink } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { NAV_GROUPS, BOTTOM_NAV_ITEMS } from './sidebarNavConfig';
import { BrandLogo } from '../BrandLogo/BrandLogo';

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
      } bg-[#0b132b] text-slate-300 h-screen flex flex-col border-r border-slate-800/80 select-none shrink-0 transition-all duration-300 ease-in-out shadow-xl z-20`}
    >
      {/* Brand Header: Click directly on IRS logo/title to toggle expand/collapse */}
      {isCollapsed ? (
        <div className="pt-5 pb-4 px-2 flex flex-col items-center justify-center border-b border-slate-800/80">
          <div
            role="button"
            onClick={toggleSidebar}
            className="cursor-pointer hover:scale-105 transition active:scale-95"
            title="Bấm vào logo để mở rộng sidebar"
          >
            <BrandLogo size="md" showText={false} variant="concept1" />
          </div>
        </div>
      ) : (
        <div className="px-5 pt-5 pb-4 flex items-center border-b border-slate-800/80">
          <div
            role="button"
            onClick={!onCloseMobile ? toggleSidebar : undefined}
            className={`flex items-center min-w-0 select-none ${
              !onCloseMobile ? 'cursor-pointer group' : ''
            }`}
            title={!onCloseMobile ? 'Bấm vào logo để thu gọn sidebar' : undefined}
          >
            <BrandLogo size="md" showText={true} textColor="text-white" variant="concept1" />
          </div>
        </div>
      )}

      {/* Grouped Navigation Items */}
      <nav className={`flex-1 ${isCollapsed ? 'px-2 py-3' : 'px-3 py-3'} space-y-4 overflow-y-auto overflow-x-hidden`}>
        {filteredNavGroups.map((group, gIdx) => (
          <div key={group.id} className="space-y-1">
            {isCollapsed ? (
              gIdx > 0 && <div className="my-2 border-t border-slate-800/80 mx-2" title={group.title} />
            ) : (
              <div className="px-3.5 pt-1 pb-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
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
                          : 'gap-3 px-3.5 py-2.5 rounded-xl text-xs'
                      } transition-all duration-200 group relative ${
                        isActive
                          ? 'bg-gradient-to-r from-blue-600/25 to-indigo-600/25 text-blue-400 border border-blue-500/35 font-bold shadow-sm shadow-indigo-950/40'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/60 font-medium'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          className={`w-4.5 h-4.5 shrink-0 transition-colors ${
                            isActive
                              ? 'text-blue-400'
                              : 'text-slate-400 group-hover:text-slate-200'
                          }`}
                        />
                        {!isCollapsed && (
                          <>
                            <span className="flex-1 text-[13px] truncate">{item.label}</span>
                            {item.badge ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-semibold shrink-0">
                                {item.badge}
                              </span>
                            ) : isActive ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-xs shadow-blue-400 shrink-0" />
                            ) : null}
                          </>
                        )}
                        {isCollapsed && item.badge && (
                          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500 ring-2 ring-[#0b132b]" />
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
      <div className={`p-3 border-t border-slate-800/80 space-y-1.5 shrink-0 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
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
                    : 'gap-3 px-3.5 py-2.5 rounded-xl text-xs'
                } transition-all duration-200 group ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600/25 to-indigo-600/25 text-blue-400 border border-blue-500/35 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60 font-medium'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`w-4.5 h-4.5 shrink-0 transition-colors ${
                      isActive
                        ? 'text-blue-400'
                        : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  {!isCollapsed && <span className="text-[13px] truncate">{item.label}</span>}
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </aside>
  );
}
