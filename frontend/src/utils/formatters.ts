/**
 * Định dạng thời gian dạng chuẩn hiển thị
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}
