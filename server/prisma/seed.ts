/**
 * Voxpact Financials — database seed
 *
 *   npm run db:seed
 *
 * Creates the default Host + Admin accounts (passwords bcrypt-hashed), core
 * settings, expense categories and — unless SEED_DEMO_DATA=false — a small set
 * of demo records so the dashboard is not empty on first login.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '../src/generated/prisma/client';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const ROUNDS = Number(process.env.BCRYPT_ROUNDS ?? 12);
const FORCE_CHANGE = String(process.env.SEED_FORCE_PASSWORD_CHANGE ?? 'true') !== 'false';
const DEMO = String(process.env.SEED_DEMO_DATA ?? 'true') !== 'false';

const DEFAULT_CATEGORIES = [
  'Operations',
  'Marketing',
  'Salary',
  'Utilities',
  'Rent',
  'Software',
  'Internet',
  'Travel',
  'Equipment',
  'Taxes',
  'Miscellaneous',
];

function daysAgo(n: number) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

async function upsertUser(opts: {
  username: string;
  password: string;
  role: Role;
  email?: string;
  fullName?: string;
}) {
  const passwordHash = await bcrypt.hash(opts.password, ROUNDS);
  const user = await prisma.user.upsert({
    where: { username: opts.username },
    update: {},
    create: {
      username: opts.username,
      passwordHash,
      role: opts.role,
      email: opts.email,
      fullName: opts.fullName,
      isActive: true,
      mustChangePassword: FORCE_CHANGE,
    },
  });
  return user;
}

async function main() {
  console.log('→ Seeding Voxpact Financials…');

  // -------------------------------------------------------------- accounts
  const host = await upsertUser({
    username: process.env.SEED_HOST_USERNAME || 'ahmad.waseem',
    password: process.env.SEED_HOST_PASSWORD || 'Host#2026',
    role: Role.HOST,
    email: process.env.SEED_HOST_EMAIL || 'host@voxpact.com',
    fullName: 'Ahmad Waseem',
  });
  console.log(`  ✓ HOST   ${host.username}`);

  const admin = await upsertUser({
    username: process.env.SEED_ADMIN_USERNAME || 'voxpactadmin',
    password: process.env.SEED_ADMIN_PASSWORD || 'voxpact123',
    role: Role.ADMIN,
    email: process.env.SEED_ADMIN_EMAIL || 'admin@voxpact.com',
    fullName: 'Voxpact Partner',
  });
  console.log(`  ✓ ADMIN  ${admin.username}`);

  // -------------------------------------------------------------- settings
  const settings: Record<string, unknown> = {
    company: {
      name: 'Voxpact Financials',
      legalName: 'Voxpact',
      address: 'Lahore, Pakistan',
      email: 'finance@voxpact.com',
      tagline: 'Financial Management Portal',
    },
    currency: process.env.CURRENCY || 'USD',
    dailyBudget: Number(process.env.DEFAULT_DAILY_BUDGET ?? 20000),
    overdueGraceDays: 3,
    categories: DEFAULT_CATEGORIES,
    paymentMethods: ['Cash', 'Bank Transfer', 'Credit Card', 'Debit Card', 'Wise', 'Payoneer', 'Other'],
    distributableProfit: 0,
  };

  for (const [key, value] of Object.entries(settings)) {
    await prisma.setting.upsert({
      where: { key },
      update: {},
      create: { key, value: value as any },
    });
  }
  console.log(`  ✓ ${Object.keys(settings).length} settings`);

  if (!DEMO) {
    console.log('→ Demo data skipped (SEED_DEMO_DATA=false)');
    return;
  }

  // -------------------------------------------------------------- demo data
  const existingExpenses = await prisma.expense.count();
  if (existingExpenses === 0) {
    await prisma.expense.createMany({
      data: [
        { type: 'RECURRING', name: 'Office Rent', category: 'Rent', amount: 1200, date: daysAgo(20), dueDate: daysAgo(-9), isRecurring: true, isPaid: true, paymentMethod: 'Bank Transfer', addedById: host.id },
        { type: 'RECURRING', name: 'Fiber Internet', category: 'Internet', amount: 180, date: daysAgo(18), dueDate: daysAgo(-11), isRecurring: true, isPaid: false, paymentMethod: 'Bank Transfer', addedById: host.id },
        { type: 'RECURRING', name: 'CRM Subscription', category: 'Software', amount: 349, date: daysAgo(15), dueDate: daysAgo(-14), isRecurring: true, isPaid: true, paymentMethod: 'Credit Card', addedById: host.id },
        { type: 'RECURRING', name: 'Dialer Minutes', category: 'Operations', amount: 900, date: daysAgo(15), dueDate: daysAgo(-6), isRecurring: true, isPaid: false, paymentMethod: 'Wise', addedById: host.id },
        { type: 'DAILY', name: 'Lead data purchase', description: 'Aged auto insurance data', category: 'Marketing', amount: 450, date: daysAgo(1), paymentMethod: 'Credit Card', addedById: admin.id },
        { type: 'DAILY', name: 'Team lunch', description: 'Floor 2 sales team', category: 'Operations', amount: 120, date: daysAgo(1), paymentMethod: 'Cash', addedById: admin.id },
        { type: 'DAILY', name: 'Headsets (x4)', description: 'Replacement headsets', category: 'Equipment', amount: 260, date: daysAgo(2), paymentMethod: 'Cash', addedById: admin.id },
        { type: 'DAILY', name: 'Electricity top-up', category: 'Utilities', amount: 310, date: daysAgo(3), paymentMethod: 'Bank Transfer', addedById: host.id },
        { type: 'DAILY', name: 'Facebook Ads', description: 'Lead gen campaign', category: 'Marketing', amount: 780, date: daysAgo(4), paymentMethod: 'Credit Card', addedById: host.id },
        { type: 'DAILY', name: 'Courier', category: 'Operations', amount: 45, date: daysAgo(5), paymentMethod: 'Cash', addedById: admin.id },
        { type: 'DAILY', name: 'Server hosting', category: 'Software', amount: 210, date: daysAgo(6), paymentMethod: 'Credit Card', addedById: host.id },
      ],
    });
    console.log('  ✓ demo expenses');
  }

  if ((await prisma.revenue.count()) === 0) {
    await prisma.revenue.createMany({
      data: [
        { clientName: 'Apex Insurance Group', amount: 12500, projectedDate: daysAgo(10), receivedDate: daysAgo(8), receivedAmount: 12500, status: 'RECEIVED', addedById: host.id },
        { clientName: 'Sunbelt Auto Agency', amount: 8400, projectedDate: daysAgo(5), receivedDate: daysAgo(4), receivedAmount: 8400, status: 'RECEIVED', addedById: host.id },
        { clientName: 'Midwest Home Cover', amount: 9600, projectedDate: daysAgo(-6), status: 'PROJECTED', addedById: host.id },
        { clientName: 'Blue Ridge Dispatch', amount: 5200, projectedDate: daysAgo(12), status: 'PROJECTED', addedById: admin.id },
        { clientName: 'Coastal Leads LLC', amount: 7300, projectedDate: daysAgo(-18), status: 'PROJECTED', addedById: admin.id },
      ],
    });
    console.log('  ✓ demo revenue');
  }

  if ((await prisma.partner.count()) === 0) {
    await prisma.partner.createMany({
      data: [
        { name: 'Ahmad Waseem', percentage: 60, paymentStatus: 'PENDING' },
        { name: 'Partner Two', percentage: 40, paymentStatus: 'PENDING' },
      ],
    });
    console.log('  ✓ demo partners');
  }

  if ((await prisma.employee.count()) === 0) {
    await prisma.employee.createMany({
      data: [
        { name: 'Dua Sajid', role: 'Sales Representative', monthlySalary: 420, bonus: 60, isSpecial: false, isActive: true },
        { name: 'Emaan', role: 'Sales Representative', monthlySalary: 420, bonus: 40, isSpecial: false, isActive: true },
        { name: 'Ops Lead', role: 'Operations Manager', monthlySalary: 650, bonus: 0, isSpecial: false, isActive: true },
        { name: 'Closer — Commission', role: 'Senior Closer', monthlySalary: 0, bonus: 0, isSpecial: true, isActive: true },
      ],
    });
    console.log('  ✓ demo employees');
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  await prisma.dailyBudget.upsert({
    where: { date: today },
    update: {},
    create: { date: today, budgetAmount: Number(process.env.DEFAULT_DAILY_BUDGET ?? 20000), spentAmount: 0 },
  });

  console.log('✔ Seed complete.');
  if (FORCE_CHANGE) {
    console.log('  ! Seeded accounts must change their password on first login.');
  }
}

main()
  .catch((e) => {
    console.error('✖ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
