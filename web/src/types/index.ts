export type Role = 'HOST' | 'ADMIN' | 'USER';

export interface User {
  id: string;
  username: string;
  role: Role;
  email: string | null;
  fullName: string | null;
  createdAt?: string;
  lastLogin?: string | null;
  isActive?: boolean;
  mustChangePassword?: boolean;
  createdBy?: { username: string } | null;
}

export interface Expense {
  id: string;
  type: 'DAILY' | 'RECURRING';
  name: string;
  description: string | null;
  category: string;
  amount: number;
  date: string;
  dueDate: string | null;
  paymentMethod: string | null;
  receiptUrl: string | null;
  isPaid: boolean;
  isRecurring: boolean;
  sourceType: string | null;
  sourceId: string | null;
  createdAt: string;
  addedBy?: { id: string; username: string; fullName: string | null } | null;
}

export interface Revenue {
  id: string;
  clientName: string;
  source: string | null;
  description: string | null;
  amount: number;
  projectedDate: string;
  receivedDate: string | null;
  receivedAmount: number | null;
  status: 'PROJECTED' | 'RECEIVED';
  isOverdue?: boolean;
  daysLate?: number;
  displayStatus?: 'PROJECTED' | 'RECEIVED' | 'OVERDUE';
  addedBy?: { id: string; username: string } | null;
}

export interface Partner {
  id: string;
  name: string;
  email: string | null;
  percentage: number;
  shareAmount: number;
  paymentStatus: 'PENDING' | 'PAID';
  notes: string | null;
}

export interface Distribution {
  partners: Partner[];
  profit: number;
  totalPercentage: number;
  remainingPercentage: number;
  isValid: boolean;
  totalDistributed: number;
  paidAmount: number;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  email: string | null;
  monthlySalary: number;
  bonus: number;
  totalMonthlyCost: number;
  isSpecial: boolean;
  isActive: boolean;
}

export interface SpecialProject {
  id: string;
  employeeId: string;
  projectName: string;
  totalAmount: number;
  percentage: number;
  payoutAmount: number;
  date: string;
  isPaid: boolean;
  employee: { id: string; name: string; role: string };
}

export interface BudgetSnapshot {
  date: string;
  budgetAmount: number;
  spentAmount: number;
  remaining: number;
  percentUsed: number;
  status: 'HEALTHY' | 'WARNING' | 'DANGER';
  exceeded?: boolean;
  isDefault?: boolean;
}

export interface DashboardData {
  stats: {
    totalRevenueProjected: number;
    totalRevenueReceived: number;
    revenueThisMonth: number;
    revenueChangePct: number;
    monthlyExpenses: number;
    expenseChangePct: number;
    expenseCount: number;
    netProfit: number;
    cashOnHand: number | null;
    projectionAccuracy: number;
    overdueCount: number;
  };
  budget: BudgetSnapshot;
  charts: {
    expenseTrend: { date: string; label: string; amount: number }[];
    revenueVsExpenses: { month: string; label: string; revenue: number; expenses: number }[];
    expenseByCategory: { category: string; amount: number }[];
  };
  activity: {
    id: string;
    kind: 'EXPENSE' | 'REVENUE';
    title: string;
    subtitle: string;
    amount: number;
    at: string;
    by: string;
  }[];
}

export interface AuditLog {
  id: string;
  username: string;
  role: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  timestamp: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  level: 'info' | 'warning' | 'danger' | 'success';
  link?: string;
  createdAt: string;
  isRead: boolean;
}

export interface Paged<T> {
  data: T[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
}

export interface Settings {
  company: { name: string; legalName?: string; address?: string; email?: string; tagline?: string };
  currency: string;
  dailyBudget: number;
  overdueGraceDays: number;
  categories: string[];
  paymentMethods: string[];
  distributableProfit: number;
}
