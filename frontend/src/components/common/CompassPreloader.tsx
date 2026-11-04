import { useState, useEffect, useRef } from 'react';
import { systemApi } from '../../services/api';

interface CompassPreloaderProps {
  onFinished?: () => void;
}

export function CompassPreloader({ onFinished }: CompassPreloaderProps) {
  const [progress, setProgress] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [hidden, setHidden] = useState(false);

  const targetProgressRef = useRef(15);
  const currentProgressRef = useRef(0);

  useEffect(() => {
    let isMounted = true;

    // 1. Đo lường tiến độ tải thực tế của trình duyệt (Real Loading Metrics)
    const evaluateRealProgress = () => {
      let score = 20;

      // Trạng thái phân tích DOM
      if (document.readyState === 'interactive') {
        score = Math.max(score, 50);
      } else if (document.readyState === 'complete') {
        score = Math.max(score, 75);
      }

      // Performance Navigation Timing API
      try {
        const navEntries = performance.getEntriesByType('navigation');
        if (navEntries.length > 0) {
          const nav = navEntries[0] as PerformanceNavigationTiming;
          if (nav.domContentLoadedEventEnd > 0) {
            score = Math.max(score, 60);
          }
          if (nav.loadEventEnd > 0) {
            score = Math.max(score, 85);
          }
        }
      } catch {
        // Fallback an toàn nếu trình duyệt cũ
      }

      // Kiểm tra tài nguyên hình ảnh
      const images = Array.from(document.images);
      if (images.length > 0) {
        const loadedCount = images.filter((img) => img.complete).length;
        score += Math.round((loadedCount / images.length) * 15);
      } else {
        score += 15;
      }

      // Font Loading API
      if (document.fonts && document.fonts.status === 'loaded') {
        score += 10;
      }

      if (isMounted) {
        targetProgressRef.current = Math.min(Math.max(targetProgressRef.current, score), 95);
      }
    };

    evaluateRealProgress();

    // Theo dõi Font tải xong
    if (document.fonts) {
      document.fonts.ready.then(() => {
        if (isMounted) evaluateRealProgress();
      });
    }

    // DOMContentLoaded
    const handleDomContentLoaded = () => {
      if (isMounted) evaluateRealProgress();
    };
    document.addEventListener('DOMContentLoaded', handleDomContentLoaded);

    // Window load (toàn bộ CSS, script, assets đã nạp xong)
    const handleWindowLoad = () => {
      if (isMounted) {
        evaluateRealProgress();
        targetProgressRef.current = Math.max(targetProgressRef.current, 90);
      }
    };
    if (document.readyState === 'complete') {
      handleWindowLoad();
    } else {
      window.addEventListener('load', handleWindowLoad);
    }

    // Kiểm tra kết nối backend API thực tế
    const checkBackend = async () => {
      try {
        await systemApi.getHealth();
      } catch {
        // Vẫn tiếp tục nếu server chưa phản hồi kịp
      } finally {
        if (isMounted) {
          targetProgressRef.current = 100;
        }
      }
    };
    checkBackend();

    // Vòng lặp chuyển động mượt mà 60fps cho kim la bàn bám sát thanh loading
    let animId: number;
    let timer1: ReturnType<typeof setTimeout> | null = null;
    let timer2: ReturnType<typeof setTimeout> | null = null;

    const animate = () => {
      const target = targetProgressRef.current;
      const current = currentProgressRef.current;

      if (current < target) {
        const diff = target - current;
        // Bước nhảy mượt mà (Lerp) theo khoảng cách thực tế
        const step = Math.max(diff * 0.08, 0.4);
        const next = Math.min(current + step, target);
        currentProgressRef.current = next;
        setProgress(Math.round(next));
      }

      if (currentProgressRef.current >= 100) {
        setProgress(100);
        setIsDone(true);

        // Giữ trạng thái Done trong 700ms để người dùng nhìn thấy rõ
        timer1 = setTimeout(() => {
          if (isMounted) setFadeOut(true);
        }, 700);

        // Mờ dần và hoàn tất chuyển sang trang đăng nhập
        timer2 = setTimeout(() => {
          if (isMounted) {
            setHidden(true);
            if (onFinished) onFinished();
          }
        }, 1300);

        return;
      }

      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);

    return () => {
      isMounted = false;
      cancelAnimationFrame(animId);
      if (timer1) clearTimeout(timer1);
      if (timer2) clearTimeout(timer2);
      document.removeEventListener('DOMContentLoaded', handleDomContentLoaded);
      window.removeEventListener('load', handleWindowLoad);
    };
  }, [onFinished]);

  if (hidden) return null;

  // Bán kính R = 70 => Chu vi C = 2 * PI * 70 ≈ 439.82
  const RADIUS = 70;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress / 100);

  // Góc quay của kim la bàn: 0% = 0 độ (12h), 25% = 90 độ (3h), 50% = 180 độ (6h), 100% = 360 độ (12h)
  const needleAngle = (progress / 100) * 360;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-md transition-opacity duration-600 ease-out ${
        fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Vầng sáng ambient phía sau */}
      <div className="absolute w-96 h-96 rounded-full bg-blue-600/20 blur-3xl pointer-events-none animate-pulse-soft" />

      <div className="relative flex flex-col items-center select-none">
        {/* Khung cố định chiều cao cho Badge phía trên - Không gây rung giật hay xê dịch màn hình */}
        <div className="h-10 flex items-center justify-center mb-5">
          {isDone ? (
            <div className="h-8 inline-flex items-center gap-1.5 px-4 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-xs sm:text-sm font-black tracking-widest uppercase drop-shadow-[0_0_16px_rgba(52,211,153,0.8)]">
              <svg className="w-4 h-4 stroke-[3]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>DONE</span>
            </div>
          ) : (
            <div className="h-8 inline-flex items-center gap-2 px-4 rounded-full bg-blue-500/15 border border-blue-400/30 text-blue-300 text-xs font-semibold tracking-wider uppercase">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
              <span>Đang tải hệ thống</span>
            </div>
          )}
        </div>

        {/* Khung Vòng Tròn La Bàn Cố Định Kích Thước */}
        <div className="relative w-48 h-48 sm:w-52 sm:h-52 shrink-0 flex items-center justify-center">
          {/* Vòng tròn SVG chứa thanh loading (Không còn 4 gạch chia độ) */}
          <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 200 200">
            <defs>
              <linearGradient id="compassLoadingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="40%" stopColor="#3b82f6" />
                <stop offset="80%" stopColor="#818cf8" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>

              <filter id="progressGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="4.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Vòng ray mờ nền sạch sẽ */}
            <circle
              cx="100"
              cy="100"
              r={RADIUS}
              stroke="rgba(255, 255, 255, 0.1)"
              strokeWidth="5.5"
              fill="none"
            />

            {/* VÒNG TIẾN TRÌNH ĐANG TẢI DẦN DẦN (Phát sáng neon) */}
            <circle
              cx="100"
              cy="100"
              r={RADIUS}
              stroke="url(#compassLoadingGrad)"
              strokeWidth="6"
              strokeLinecap="round"
              fill="none"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={strokeDashoffset}
              filter="url(#progressGlow)"
              style={{
                transition: 'stroke-dashoffset 0.08s linear',
              }}
            />
          </svg>

          {/* CÂY KIM LA BÀN - Thu nhỏ lại để nằm gọn trong lòng vòng tròn, không chạm hay đè lên viền */}
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{
              transform: `rotate(${needleAngle}deg)`,
              transformOrigin: '50% 50%',
              transition: 'transform 0.08s linear',
            }}
          >
            <svg
              className="w-full h-full drop-shadow-[0_0_10px_rgba(255,255,255,0.85)]"
              viewBox="0 0 200 200"
              fill="none"
            >
              {/* Mũi kim Bắc (Màu đỏ cam 3D - Thu nhỏ xuống Y=52, cách vòng tròn R=70 một khoảng trống đẹp mắt) */}
              <polygon
                points="100,52 94.5,100 100,93"
                fill="#dc2626"
                stroke="rgba(255,255,255,0.7)"
                strokeWidth="0.5"
              />
              <polygon
                points="100,52 105.5,100 100,93"
                fill="#ef4444"
                stroke="rgba(255,255,255,0.7)"
                strokeWidth="0.5"
              />

              {/* Mũi kim Nam (Màu trắng bạc thanh lịch - Y=148) */}
              <polygon
                points="100,148 94.5,100 100,107"
                fill="#94a3b8"
                stroke="rgba(255,255,255,0.5)"
                strokeWidth="0.5"
              />
              <polygon
                points="100,148 105.5,100 100,107"
                fill="#f1f5f9"
                stroke="rgba(255,255,255,0.5)"
                strokeWidth="0.5"
              />

              {/* Trục tâm kim la bàn mạ chrome */}
              <circle
                cx="100"
                cy="100"
                r="6.5"
                fill="#0f172a"
                stroke="#ffffff"
                strokeWidth="2"
              />
              <circle cx="100" cy="100" r="2.5" fill="#38bdf8" />
            </svg>
          </div>
        </div>

        {/* HIỂN THỊ % DƯỚI CÁI LA BÀN - Khung cố định chiều cao h-20 để tuyệt đối không nhảy giật màn hình */}
        <div className="h-20 flex flex-col items-center justify-center mt-5 select-none text-center">
          {isDone ? (
            <div className="flex flex-col items-center space-y-1">
              <span className="text-3xl font-black text-emerald-400 font-mono tracking-wider leading-none drop-shadow-[0_0_16px_rgba(52,211,153,0.9)]">
                100%
              </span>
              <span className="text-xs font-semibold text-emerald-300 tracking-wide leading-tight mt-1">
                Hệ thống đã sẵn sàng truy cập!
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-1">
              <span className="text-3xl font-black text-white font-mono tracking-wider leading-none drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]">
                {progress}%
              </span>
              <span className="text-xs font-medium text-slate-400 tracking-wide leading-tight mt-1">
                Đang tải và đồng bộ tài nguyên...
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CompassPreloader;
