import { useEffect, useState, useRef } from 'react';
import { User, Lock, Eye, LogIn } from 'lucide-react';
import { BrandLogo } from '../BrandLogo/BrandLogo';
import { useAppStore } from '../../store/useAppStore';

interface SplitShutterTransitionProps {
  direction?: 'open' | 'close';
  onComplete?: () => void;
}

export function SplitShutterTransition({
  direction = 'open',
  onComplete,
}: SplitShutterTransitionProps) {
  const splitUsername = useAppStore((state) => state.splitUsername);

  // Trạng thái kích hoạt chuyển động trượt
  const [isMoved, setIsMoved] = useState(false);
  // Trạng thái hai cánh đã chạm khít nhau (để làm mờ êm dịu viền laser, không gây nhấp sáng)
  const [isSealed, setIsSealed] = useState(false);

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    let raf1: number;
    let raf2: number;

    // Đảm bảo 2 animation frames để trình duyệt paint frame ban đầu
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setIsMoved(true);
      });
    });

    let sealTimer: any;
    if (direction === 'close') {
      // Ở 520ms (khi 2 cánh chuẩn bị chạm nhau), viền laser tự động tan biến êm dịu
      sealTimer = setTimeout(() => {
        setIsSealed(true);
      }, 520);
    }

    // Thời gian hoàn tất chuyển động
    const finishDuration = direction === 'close' ? 760 : 800;
    const finishTimer = setTimeout(() => {
      if (onCompleteRef.current) {
        onCompleteRef.current();
      }
    }, finishDuration);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(sealTimer);
      clearTimeout(finishTimer);
    };
  }, [direction]);

  // Giao diện đăng nhập "Y CHANG 100%"
  const renderExactLoginView = () => (
    <div className="w-screen h-screen bg-[#0b1329] flex items-center justify-center p-4 relative overflow-hidden pointer-events-none select-none">
      {/* Vầng sáng ambient phía sau */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-blue-600/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-indigo-600/20 blur-3xl pointer-events-none" />

      {/* Hộp đăng nhập hoàn chỉnh y chang trang thật */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-8 sm:p-10 relative z-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center justify-center text-center mb-6">
          <BrandLogo
            size="2xl"
            layout="vertical"
            textColor="text-slate-900"
            subtextColor="text-slate-500"
            className="mb-1"
          />
        </div>

        <div className="space-y-5">
          {/* Username Input y chang */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Tài khoản hoặc Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <div className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium flex items-center">
                {splitUsername || 'admin'}
              </div>
            </div>
          </div>

          {/* Password Input y chang */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Mật khẩu
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <div className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-400 flex items-center tracking-widest font-mono">
                ••••••••
              </div>
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400">
                <Eye className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Submit Button y chang */}
          <div className="w-full mt-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25">
            <LogIn className="w-4 h-4" />
            <span>Đăng nhập hệ thống</span>
          </div>
        </div>
      </div>
    </div>
  );

  // Tính toán vị trí trượt theo hướng 'open' (Đăng nhập) hoặc 'close' (Đăng xuất):
  // 'open':
  //   - Trái: 0% -> -100% (Trượt LÊN)
  //   - Phải: 0% -> 100% (Trượt XUỐNG)
  // 'close' (Quay ngược lại):
  //   - Trái: -100% -> 0% (Từ trên trượt XUỐNG)
  //   - Phải: 100% -> 0% (Từ dưới trượt LÊN, khép chặt lại ở giữa)
  const leftTransform =
    direction === 'open'
      ? isMoved
        ? 'translateY(-100%)'
        : 'translateY(0%)'
      : isMoved
      ? 'translateY(0%)'
      : 'translateY(-100%)';

  const rightTransform =
    direction === 'open'
      ? isMoved
        ? 'translateY(100%)'
        : 'translateY(0%)'
      : isMoved
      ? 'translateY(0%)'
      : 'translateY(100%)';

  return (
    <div
      className={`fixed inset-0 z-[99999] overflow-hidden select-none bg-transparent ${
        direction === 'close' ? 'pointer-events-auto cursor-wait' : 'pointer-events-none'
      }`}
    >
      {/* NỬA TRÁI (0 - 50vw): Trượt theo trục dọc */}
      <div
        className="absolute top-0 left-0 w-1/2 h-full overflow-hidden bg-[#0b1329]"
        style={{
          transform: leftTransform,
          transition: 'transform 0.72s cubic-bezier(0.22, 1, 0.36, 1)',
          willChange: 'transform',
        }}
      >
        <div className="absolute top-0 left-0 w-screen h-screen">
          {renderExactLoginView()}
        </div>

        {/* Viền laser phát sáng ở mép cắt bên phải (mờ dần khi 2 bên khép chặt để không bị nhấp sáng) */}
        <div
          className="absolute top-0 right-0 w-[2px] h-full bg-cyan-400 shadow-[2px_0_15px_rgba(56,189,248,0.85)] pointer-events-none transition-opacity duration-200"
          style={{
            opacity: direction === 'close' ? (isSealed ? 0 : 1) : 1,
          }}
        />
      </div>

      {/* NỬA PHẢI (50vw - 100vw): Trượt theo trục dọc */}
      <div
        className="absolute top-0 left-1/2 w-1/2 h-full overflow-hidden bg-[#0b1329]"
        style={{
          transform: rightTransform,
          transition: 'transform 0.72s cubic-bezier(0.22, 1, 0.36, 1)',
          willChange: 'transform',
        }}
      >
        <div className="absolute top-0 -left-[50vw] w-screen h-screen">
          {renderExactLoginView()}
        </div>

        {/* Viền laser phát sáng ở mép cắt bên trái (mờ dần khi 2 bên khép chặt để không bị nhấp sáng) */}
        <div
          className="absolute top-0 left-0 w-[2px] h-full bg-cyan-400 shadow-[-2px_0_15px_rgba(56,189,248,0.85)] pointer-events-none transition-opacity duration-200"
          style={{
            opacity: direction === 'close' ? (isSealed ? 0 : 1) : 1,
          }}
        />
      </div>

      {/* Tia laser neon trung tâm và điểm phát sáng (chỉ xuất hiện lúc cắt mở 'open') */}
      {direction === 'open' && (
        <div
          className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[2px] pointer-events-none z-30 transition-opacity duration-300"
          style={{
            opacity: isMoved ? 0 : 1,
          }}
        >
          <div className="w-full h-full bg-cyan-400 shadow-[0_0_15px_#38bdf8]" />
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-[0_0_15px_#38bdf8,0_0_25px_#06b6d4] border border-cyan-200" />
        </div>
      )}
    </div>
  );
}

export default SplitShutterTransition;
