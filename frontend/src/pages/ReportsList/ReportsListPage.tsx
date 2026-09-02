import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileText, Calendar, School, CheckCircle, Search, Trash2 } from 'lucide-react';
import { reportApi } from '../../services/api';
import type { ReportListItem } from '../../types';

export const ReportsListPage: React.FC = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');

    const { data: reports, isLoading } = useQuery({
        queryKey: ['reports'],
        queryFn: () => reportApi.getAllReports(),
    });

    const deleteMutation = useMutation({
        mutationFn: (reportId: string) => reportApi.deleteReport(reportId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['reports'] });
        },
    });

    const handleDelete = (e: React.MouseEvent, reportId: string) => {
        e.stopPropagation(); // Prevent navigating to detail
        if (window.confirm('Bạn có chắc muốn xóa báo cáo này không?')) {
            deleteMutation.mutate(reportId);
        }
    };


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

    // Group reports by trip
    const groupedReports = React.useMemo(() => {
        if (!reports) return new Map<string, ReportListItem[]>();

        const filtered = reports.filter((report) =>
            report.trip_name.toLowerCase().includes(searchQuery.toLowerCase())
        );

        const grouped = new Map<string, ReportListItem[]>();
        filtered.forEach((report) => {
            const existing = grouped.get(report.trip_id) || [];
            grouped.set(report.trip_id, [...existing, report]);
        });

        return grouped;
    }, [reports, searchQuery]);

    if (isLoading) {
        return (
            <div className="h-screen flex items-center justify-center">
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-primary-500 text-white px-4 py-6">
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center gap-3 mb-4">
                        <button
                            onClick={() => navigate('/')}
                            className="p-2 rounded-full hover:bg-primary-600"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="flex-1">
                            <h1 className="text-2xl font-bold">Danh Sách Báo Cáo</h1>
                            <p className="text-primary-100">Tất cả báo cáo chuyến đi</p>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Tìm kiếm theo tên chuyến đi..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-300"
                        />
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-4xl mx-auto px-4 py-6">
                {!reports || reports.length === 0 ? (
                    <div className="text-center py-12">
                        <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                        <p className="text-gray-600 text-lg mb-2">Chưa có báo cáo nào</p>
                        <p className="text-gray-500 text-sm">Tạo báo cáo từ menu chuyến đi</p>
                    </div>
                ) : groupedReports.size === 0 ? (
                    <div className="text-center py-12">
                        <Search className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                        <p className="text-gray-600 text-lg">Không tìm thấy báo cáo nào</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {Array.from(groupedReports.entries()).map(([tripId, tripReports]) => {
                            const tripName = tripReports[0].trip_name;

                            return (
                                <div key={tripId} className="bg-white rounded-xl shadow-sm overflow-hidden">
                                    {/* Trip Header */}
                                    <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-4">
                                        <h2 className="text-xl font-bold text-white">{tripName}</h2>
                                        <p className="text-primary-100 text-sm">{tripReports.length} báo cáo</p>
                                    </div>

                                    {/* Reports List */}
                                    <div className="divide-y divide-gray-200">
                                        {tripReports.map((report) => (
                                            <div
                                                key={report.id}
                                                onClick={() => navigate(`/reports/${report.id}`)}
                                                className="p-6 hover:bg-gray-50 cursor-pointer transition-colors relative group"
                                            >
                                                <div className="flex items-start gap-4">
                                                    {/* Icon */}
                                                    <div className="p-3 bg-blue-100 rounded-lg flex-shrink-0">
                                                        <FileText className="w-6 h-6 text-blue-600" />
                                                    </div>

                                                    {/* Content */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between gap-4 mb-3">
                                                            <div>
                                                                <h3 className="font-semibold text-gray-900 mb-1">
                                                                    Báo cáo chuyến đi
                                                                </h3>
                                                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                                                    <Calendar className="w-4 h-4" />
                                                                    <span>{formatDate(report.created_at)}</span>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    className="text-primary-500 font-medium text-sm hover:text-primary-600 flex-shrink-0"
                                                                >
                                                                    Xem chi tiết →
                                                                </button>
                                                                <button
                                                                    onClick={(e) => handleDelete(e, report.id)}
                                                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100 sm:opacity-100"
                                                                    title="Xóa báo cáo"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Stats */}
                                                        <div className="grid grid-cols-3 gap-4">
                                                            <div className="flex items-center gap-2">
                                                                <School className="w-4 h-4 text-blue-600" />
                                                                <div>
                                                                    <p className="text-xs text-gray-500">Tổng số trường</p>
                                                                    <p className="font-semibold text-gray-900">{report.total_schools}</p>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-2">
                                                                <CheckCircle className="w-4 h-4 text-green-600" />
                                                                <div>
                                                                    <p className="text-xs text-gray-500">Đã đi</p>
                                                                    <p className="font-semibold text-gray-900">{report.schools_visited}</p>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-2">
                                                                <span className="text-lg">🎫</span>
                                                                <div>
                                                                    <p className="text-xs text-gray-500">Tổng phiếu</p>
                                                                    <p className="font-semibold text-gray-900">{report.total_tickets}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Summary */}
                {reports && reports.length > 0 && (
                    <div className="mt-6 text-center text-gray-500 text-sm">
                        Tổng cộng {reports.length} báo cáo từ {groupedReports.size} chuyến đi
                    </div>
                )}
            </main>
        </div>
    );
};

export default ReportsListPage;
