import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'hero';
  showText?: boolean;
  layout?: 'horizontal' | 'vertical';
  textColor?: string;
  subtextColor?: string;
  className?: string;
  variant?: 'concept1' | string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  showText = true,
  layout = 'horizontal',
  textColor = 'text-white',
  subtextColor = 'text-slate-400',
  className = '',
}) => {
  const sizeMap = {
    sm: {
      img: 'w-8 h-8',
      title: 'text-sm',
      sub: 'text-[9.5px]',
      badge: 'text-[8px] px-1 py-0.2',
    },
    md: {
      img: 'w-11 h-11',
      title: 'text-base',
      sub: 'text-[11px]',
      badge: 'text-[9px] px-1.5 py-0.5',
    },
    lg: {
      img: 'w-14 h-14',
      title: 'text-lg',
      sub: 'text-xs',
      badge: 'text-[10px] px-2 py-0.5',
    },
    xl: {
      img: 'w-24 h-24',
      title: 'text-2xl',
      sub: 'text-sm',
      badge: 'text-xs px-2.5 py-1',
    },
    '2xl': {
      img: 'w-32 h-32',
      title: 'text-2xl font-black',
      sub: 'text-xs',
      badge: 'text-[10px] px-2 py-0.5',
    },
    hero: {
      img: 'w-36 h-36',
      title: 'text-2xl font-black',
      sub: 'text-xs',
      badge: 'text-[10px] px-2 py-0.5',
    },
  };

  const s = sizeMap[size];

  return (
    <div
      className={`flex ${
        layout === 'vertical' ? 'flex-col items-center text-center gap-3' : 'items-center gap-3'
      } min-w-0 ${className}`}
    >
      {/* Square Centered Concept 1 Logo (Pure White Background with Micro-interaction) */}
      <div className="relative shrink-0 flex items-center justify-center group/logo">
        <div className="absolute inset-0 rounded-2xl bg-cyan-500/25 blur-md opacity-0 group-hover/logo:opacity-100 transition-opacity duration-300 pointer-events-none" />
        <img
          src="/irs-logo.png"
          alt="IRS Admissions Compass & Waypoint Logo"
          className={`${s.img} aspect-square object-contain shrink-0 select-none rounded-xl relative z-10 transition-all duration-300 group-hover/logo:scale-105 group-hover/logo:rotate-1 drop-shadow-sm`}
          draggable={false}
        />
      </div>

      {showText && (
        <div
          className={`min-w-0 flex flex-col ${
            layout === 'vertical' ? 'items-center text-center' : 'justify-center'
          } leading-none`}
        >
          <div className="flex items-center gap-2">
            <span className={`${s.title} font-black tracking-tight ${textColor} leading-tight`}>
              IRS Admissions
            </span>
            <span
              className={`${s.badge} font-black uppercase rounded-md bg-gradient-to-r from-blue-500/20 via-indigo-500/20 to-purple-500/20 text-cyan-600 border border-cyan-500/30 tracking-wider shrink-0`}
            >
              System
            </span>
          </div>
          <span className={`${s.sub} ${subtextColor} font-medium tracking-wide truncate mt-1.5`}>
            Hệ Thống Tuyển Sinh &amp; Định Tuyến Thực Địa
          </span>
        </div>
      )}
    </div>
  );
};

export default BrandLogo;
