import { NavLink } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { NAV_GROUPS, BOTTOM_NAV_ITEMS } from './sidebarNavConfig';
import { BrandLogo } from '../BrandLogo/BrandLogo';

interface SidebarProps {
  onCloseMobile?: () => void;
}

// Icon La Bàn Định Hướng Trắng Sáng với Kim Xoay 360 Độ Liên Tục
function AnimatedCompass() {
  return (
    <div
      className="relative flex items-center justify-center shrink-0 ml-auto"
      style={{ width: '26px', height: '26px' }}
      title="Đang kích hoạt"
    >
      {/* Vành la bàn tròn trắng sáng tinh tế - KHÔNG có thanh dài nhô ra */}
      <svg
        style={{ width: '26px', height: '26px' }}
        viewBox="0 0 28 28"
        fill="none"
        className="drop-shadow-[0_0_8px_rgba(255,255,255,0.7)]"
      >
        <circle
          cx="14"
          cy="14"
          r="11.5"
          stroke="#ffffff"
          strokeWidth="2"
          strokeOpacity="0.9"
        />
      </svg>

      {/* Cây kim la bàn trắng sáng nét xoay 360 độ liên tục */}
      <div
        className="absolute inset-0 flex items-center justify-center animate-compass-spin"
        style={{ transformOrigin: 'center center' }}
      >
        <svg
          style={{ width: '20px', height: '20px' }}
          viewBox="0 0 28 28"
          fill="none"
          className="drop-shadow-[0_0_10px_rgba(255,255,255,0.95)]"
        >
          {/* Mũi kim Bắc nhọn màu trắng tinh khiết */}
          <polygon points="14,3.5 17.5,14 14,11.5 10.5,14" fill="#ffffff" />
          {/* Mũi kim Nam nhọn màu trắng bạc */}
          <polygon points="14,24.5 17.5,14 14,16.5 10.5,14" fill="#cbd5e1" />
          {/* Trục tâm kim la bàn */}
          <circle cx="14" cy="14" r="2.8" fill="#ffffff" stroke="#0b132b" strokeWidth="1" />
        </svg>
      </div>
    </div>
  );
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
      } bg-[#0b132b] text-slate-300 h-screen flex flex-col border-r border-slate-800/80 select-none shrink-0 transition-all duration-300 ease-in-out shadow-xl z-20 relative`}
    >
      {/* Brand Header */}
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

      {/* Main Navigation Container */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {/* Navigation scroll area */}
        <nav
          className={`h-full ${
            isCollapsed ? 'px-2 py-3' : 'px-3 py-3'
          } space-y-4 overflow-y-auto overflow-x-hidden`}
        >
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
                            : 'gap-3 px-3.5 py-2.5 rounded-xl text-xs hover:translate-x-1'
                        } transition-all duration-200 group relative ${
                          isActive
                            ? 'bg-white/[0.09] hover:bg-white/[0.12] border border-white/20 text-white font-bold shadow-lg shadow-black/25'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/60 font-medium'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {/* Nguyên cột trắng ở trang đã chọn - Bắt đầu từ sát mép màn hình bên trái */}
                          {isActive && (
                            <span
                              className={`absolute ${
                                isCollapsed ? '-left-2' : '-left-3'
                              } inset-y-0 w-1.5 bg-white rounded-r-md shadow-[0_0_14px_rgba(255,255,255,0.95),0_0_24px_rgba(255,255,255,0.4)] z-30 transition-all duration-300 animate-fade-in`}
                            />
                          )}

                          <Icon
                            className={`w-4.5 h-4.5 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                              isActive
                                ? 'text-white'
                                : 'text-slate-400 group-hover:text-slate-200'
                            }`}
                          />

                          {!isCollapsed && (
                            <>
                              <span className="flex-1 text-[13px] truncate font-medium">
                                {item.label}
                              </span>

                              {item.badge ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-semibold shrink-0 animate-pulse-soft">
                                  {item.badge}
                                </span>
                              ) : isActive ? (
                                /* La bàn trắng sáng với kim xoay liên tục khi trang được chọn */
                                <AnimatedCompass />
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
      </div>

      {/* Bottom Section */}
      <div
        className={`p-3 border-t border-slate-800/80 space-y-1.5 shrink-0 relative ${
          isCollapsed ? 'flex flex-col items-center' : ''
        }`}
      >
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
                    : 'gap-3 px-3.5 py-2.5 rounded-xl text-xs hover:translate-x-1'
                } transition-all duration-200 group relative ${
                  isActive
                    ? 'bg-white/[0.09] hover:bg-white/[0.12] border border-white/20 text-white font-bold shadow-lg shadow-black/25'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60 font-medium'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {/* Nguyên cột trắng ở trang đã chọn từ sát mép màn hình bên trái */}
                  {isActive && (
                    <span
                      className={`absolute ${
                        isCollapsed ? '-left-2' : '-left-3'
                      } inset-y-0 w-1.5 bg-white rounded-r-md shadow-[0_0_14px_rgba(255,255,255,0.95),0_0_24px_rgba(255,255,255,0.4)] z-30 transition-all duration-300 animate-fade-in`}
                    />
                  )}

                  <Icon
                    className={`w-4.5 h-4.5 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                      isActive
                        ? 'text-white'
                        : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  {!isCollapsed && (
                    <>
                      <span className="flex-1 text-[13px] truncate font-medium">
                        {item.label}
                      </span>
                      {isActive && (
                        /* La bàn trắng sáng với kim xoay liên tục khi trang được chọn */
                        <AnimatedCompass />
                      )}
                    </>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </aside>
  );
}
export default Sidebar;
