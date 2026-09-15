import {
  Map,
  Compass,
  Building2,
  Users,
  ClipboardList,
  Settings,
  LucideIcon
} from 'lucide-react';
import { UserRole } from '../../types';

export interface NavItemConfig {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  badge?: string | number;
  roles: UserRole[]; // Phân quyền: vai trò nào được thấy mục này
}

export interface NavGroupConfig {
  id: string;
  title: string;
  items: NavItemConfig[];
}

export const NAV_GROUPS: NavGroupConfig[] = [
  {
    id: 'overview',
    title: 'Tổng quan',
    items: [
      {
        id: 'map',
        label: 'Bản đồ',
        path: '/admin/map',
        icon: Map,
        roles: ['admin', 'staff'],
      },
    ],
  },
  {
    id: 'management',
    title: 'Quản lý',
    items: [
      {
        id: 'campaigns',
        label: 'Chiến dịch',
        path: '/admin/campaigns',
        icon: Compass,
        roles: ['admin'],
      },
      {
        id: 'locations',
        label: 'Địa điểm',
        path: '/admin/locations',
        icon: Building2,
        roles: ['admin'],
      },
      {
        id: 'accounts',
        label: 'Tài khoản',
        path: '/admin/members',
        icon: Users,
        roles: ['admin'],
      },
    ],
  },
  {
    id: 'system',
    title: 'Hệ thống',
    items: [
      {
        id: 'logs',
        label: 'Nhật ký hệ thống',
        path: '/admin/logs',
        icon: ClipboardList,
        roles: ['admin', 'staff'],
      },
    ],
  },
];

export const MAIN_NAV_ITEMS: NavItemConfig[] = NAV_GROUPS.flatMap((group) => group.items);

export const BOTTOM_NAV_ITEMS: NavItemConfig[] = [
  {
    id: 'settings',
    label: 'Cài đặt',
    path: '/admin/settings',
    icon: Settings,
    roles: ['admin', 'staff'],
  },
];
