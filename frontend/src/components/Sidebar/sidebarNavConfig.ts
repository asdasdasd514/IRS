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

export const MAIN_NAV_ITEMS: NavItemConfig[] = [
  {
    id: 'map',
    label: 'Map',
    path: '/admin/map',
    icon: Map,
    roles: ['admin', 'staff'],
  },
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
    id: 'members',
    label: 'Thành viên',
    path: '/admin/members',
    icon: Users,
    roles: ['admin'],
  },
  {
    id: 'logs',
    label: 'Nhật ký log',
    path: '/admin/logs',
    icon: ClipboardList,
    roles: ['admin', 'staff'],
  },
];

export const BOTTOM_NAV_ITEMS: NavItemConfig[] = [
  {
    id: 'settings',
    label: 'Cài đặt',
    path: '/admin/settings',
    icon: Settings,
    roles: ['admin', 'staff'],
  },
];
