import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Compass, CheckCircle } from 'lucide-react';

const queryClient = new QueryClient();

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mb-4 border border-indigo-500/30">
          <Compass className="w-8 h-8" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold mb-2">
          IRS Mobile Admissions Platform
        </h1>

        <p className="text-sm text-slate-400 max-w-md mb-6">
          Dự án đã được khởi tạo cấu trúc chuẩn và cài đặt đầy đủ các thư viện phụ thuộc (Zustand, React Query, Tailwind CSS, Vite PWA, heic2any).
        </p>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-left space-y-2 text-xs max-w-md w-full">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold">
            <CheckCircle className="w-4 h-4" /> Đã sẵn sàng phát triển giao diện!
          </div>
          <p className="text-slate-400">• Thư mục <code>src/pages/</code> đã được dọn dẹp sạch sẽ.</p>
          <p className="text-slate-400">• Đã xóa toàn bộ thư mục <code>dist/</code>.</p>
        </div>
      </div>
    </QueryClientProvider>
  );
};
