import {
  LayoutDashboard,
  Receipt,
  TrendingUp,
  Users2,
  UserSquare2,
  Wallet,
  FileBarChart,
  ShieldCheck,
  Settings as SettingsIcon,
  CalendarDays,
  CalendarRange,
  CalendarClock,
  Repeat,
  Briefcase,
  Percent,
  ScrollText,
  type LucideIcon,
} from 'lucide-react';
import type { Permission } from '../../store/AuthProvider';

export interface NavChild {
  label: string;
  to: string;
  icon: LucideIcon;
  permission?: Permission;
}

export interface NavItem {
  label: string;
  to?: string;
  icon: LucideIcon;
  permission?: Permission;
  children?: NavChild[];
}

export const NAVIGATION: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard, permission: 'view:dashboard' },
  {
    label: 'Expenses',
    icon: Receipt,
    permission: 'manage:expenses',
    children: [
      { label: 'Daily', to: '/expenses/daily', icon: CalendarDays },
      { label: 'Weekly', to: '/expenses/weekly', icon: CalendarRange },
      { label: 'Monthly', to: '/expenses/monthly', icon: CalendarClock },
      { label: 'Recurring', to: '/expenses/recurring', icon: Repeat, permission: 'manage:recurring' },
    ],
  },
  { label: 'Revenue', to: '/revenue', icon: TrendingUp, permission: 'view:revenue' },
  { label: 'Partners', to: '/partners', icon: Users2, permission: 'view:partners' },
  {
    label: 'Employees',
    icon: UserSquare2,
    permission: 'view:employees',
    children: [
      { label: 'Regular', to: '/employees/regular', icon: Briefcase },
      { label: 'Special', to: '/employees/special', icon: Percent },
    ],
  },
  { label: 'Daily Budget', to: '/budget', icon: Wallet, permission: 'view:dashboard' },
  { label: 'Reports', to: '/reports', icon: FileBarChart, permission: 'view:reports' },
  { label: 'Users', to: '/users', icon: ShieldCheck, permission: 'manage:users' },
  { label: 'Audit Log', to: '/audit', icon: ScrollText, permission: 'view:audit' },
  { label: 'Settings', to: '/settings', icon: SettingsIcon },
];
