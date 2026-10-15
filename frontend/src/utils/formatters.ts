/**
 * Tiện ích chuẩn hóa và định dạng ngày giờ cho toàn bộ hệ thống (Múi giờ Việt Nam GMT+7 / Asia/Ho_Chi_Minh)
 */

export const parseSafeDate = (dateVal?: string | Date | null): Date | null => {
  if (!dateVal) return null;
  if (dateVal instanceof Date) return dateVal;
  const str = String(dateVal).trim();
  if (!str) return null;
  const hasTimezone =
    str.endsWith('Z') ||
    str.includes('+') ||
    (str.includes('T') && str.lastIndexOf('-') > str.indexOf('T'));
  const normalized = hasTimezone ? str : `${str.replace(' ', 'T')}Z`;
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? new Date(str) : d;
};

export function formatDateTime(dateVal?: string | Date | null): string {
  if (!dateVal) return '';
  const str = String(dateVal).trim();
  if (/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/.test(str)) return str;
  const d = parseSafeDate(dateVal);
  if (!d || isNaN(d.getTime())) return str;

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);

  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';
  return `${getPart('day')}/${getPart('month')}/${getPart('year')} ${getPart('hour')}:${getPart('minute')}`;
}

export function formatDate(dateVal?: string | Date | null): string {
  if (!dateVal) return '';
  const str = String(dateVal).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;
  const d = parseSafeDate(dateVal);
  if (!d || isNaN(d.getTime())) return str;

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(d);

  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';
  return `${getPart('day')}/${getPart('month')}/${getPart('year')}`;
}

export function formatTime(dateVal?: string | Date | null): string {
  if (!dateVal) return '';
  const d = parseSafeDate(dateVal);
  if (!d || isNaN(d.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);

  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';
  return `${getPart('hour')}:${getPart('minute')}`;
}
