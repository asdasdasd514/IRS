import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Calendar, FileText, School, CheckCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { reportApi } from '../../services/api';

export const ReportPage: React.FC = () => {
  const { reportId } = useParams<{ reportId: string }>();
  const navigate = useNavigate();

  const { data: report, isLoading } = useQuery({
    queryKey: ['report', reportId],
    queryFn: () => reportApi.getReport(reportId!),
    enabled: !!reportId,
  });

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Không tìm thấy báo cáo</p>
          <button
            onClick={() => navigate('/reports')}
            className="mt-4 text-primary-500 font-medium"
          >
            Quay lại danh sách báo cáo
          </button>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh' // Vietnam timezone (UTC+7)
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Fixed */}
      <div className="bg-white shadow-sm sticky top-0 z-10 print:hidden">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/reports')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Quay lại</span>
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
              >
                <FileText className="w-4 h-4" />
                <span>In báo cáo</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Report Metadata */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 print:shadow-none">
          <div className="flex items-start gap-4 mb-4">
            <div className="p-3 bg-primary-100 rounded-lg">
              <FileText className="w-8 h-8 text-primary-600" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Báo Cáo Chuyến Đi</h1>
              <div className="flex items-center gap-2 text-gray-500">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(report.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <School className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">Tổng số trường</p>
                  <p className="text-2xl font-bold text-blue-600">{report.total_schools}</p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600">Trường đã đi</p>
                  <p className="text-2xl font-bold text-green-600">{report.schools_visited}</p>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎫</span>
                <div>
                  <p className="text-sm text-gray-600">Tổng số phiếu</p>
                  <p className="text-2xl font-bold text-purple-600">{report.total_tickets}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Report Content */}
        <div className="bg-white rounded-xl shadow-sm p-6 print:shadow-none">
          <div className="prose prose-slate max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-strong:text-gray-900">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // Custom styling for markdown elements
                h1: ({ ...props }) => <h1 className="text-3xl font-bold text-gray-900 mb-4 mt-8 border-b pb-2" {...props} />,
                h2: ({ ...props }) => <h2 className="text-2xl font-bold text-gray-800 mb-3 mt-6 border-b pb-2" {...props} />,
                h3: ({ ...props }) => <h3 className="text-xl font-semibold text-gray-800 mb-2 mt-4" {...props} />,
                h4: ({ ...props }) => <h4 className="text-lg font-semibold text-gray-700 mb-2 mt-3" {...props} />,
                p: ({ ...props }) => <p className="text-gray-700 mb-3 leading-relaxed" {...props} />,
                ul: ({ ...props }) => <ul className="list-disc pl-6 mb-4 space-y-2" {...props} />,
                ol: ({ ...props }) => <ol className="list-decimal pl-6 mb-4 space-y-2" {...props} />,
                li: ({ ...props }) => <li className="text-gray-700 leading-relaxed" {...props} />,
                strong: ({ ...props }) => <strong className="font-semibold text-gray-900" {...props} />,
                em: ({ ...props }) => <em className="italic text-gray-700" {...props} />,
                table: ({ ...props }) => (
                  <div className="overflow-x-auto my-6">
                    <table className="min-w-full border-collapse border border-gray-300 bg-white" {...props} />
                  </div>
                ),
                thead: ({ ...props }) => <thead className="bg-gray-100" {...props} />,
                tbody: ({ ...props }) => <tbody className="divide-y divide-gray-200" {...props} />,
                tr: ({ ...props }) => <tr className="hover:bg-gray-50" {...props} />,
                th: ({ ...props }) => <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-900 bg-gray-50" {...props} />,
                td: ({ ...props }) => <td className="border border-gray-300 px-4 py-3 text-gray-700" {...props} />,
                blockquote: ({ ...props }) => (
                  <blockquote className="border-l-4 border-primary-500 pl-4 italic text-gray-600 my-4 bg-gray-50 py-2" {...props} />
                ),
                code: ({ ...props }) => (
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-gray-800" {...props} />
                ),
                pre: ({ ...props }) => (
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-4" {...props} />
                ),
                hr: ({ ...props }) => <hr className="my-6 border-gray-300" {...props} />,
                a: ({ ...props }) => <a className="text-primary-600 hover:text-primary-700 underline" {...props} />,
              }}
            >
              {report.report_content}
            </ReactMarkdown>
          </div>
        </div>

        {/* Print Footer */}
        <div className="hidden print:block mt-8 pt-4 border-t border-gray-300">
          <p className="text-sm text-gray-600 text-center">
            Báo cáo được tạo tự động bởi EMCS - {formatDate(report.created_at)}
          </p>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            margin: 2cm;
          }
          body {
            background: white !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:block {
            display: block !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default ReportPage;
