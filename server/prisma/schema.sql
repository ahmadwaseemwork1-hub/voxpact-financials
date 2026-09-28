-- ---------------------------------------------------------------------------
-- Voxpact Financials — fallback schema
--
-- You normally do NOT need this file. Use:
--     npm run db:push        (quick, for development)
--     npm run db:migrate     (versioned migrations, for real environments)
--
-- Both of those need Prisma's migration engine, which the CLI downloads from
-- binaries.prisma.sh on first use. If that host is blocked (locked-down
-- corporate network, offline machine), apply this file directly instead:
--     psql "$DATABASE_URL" -f server/prisma/schema.sql
--
-- It is kept in sync with prisma/schema.prisma by hand, so prefer the Prisma
-- commands whenever they work.
-- ---------------------------------------------------------------------------

CREATE TYPE "Role" AS ENUM ('HOST','ADMIN','USER');
CREATE TYPE "ExpenseType" AS ENUM ('DAILY','RECURRING');
CREATE TYPE "RevenueStatus" AS ENUM ('PROJECTED','RECEIVED');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING','PAID');

CREATE TABLE "users" (
  "id" TEXT PRIMARY KEY, "username" TEXT NOT NULL UNIQUE, "passwordHash" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'USER', "email" TEXT, "fullName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  "lastLogin" TIMESTAMP(3), "isActive" BOOLEAN NOT NULL DEFAULT true,
  "mustChangePassword" BOOLEAN NOT NULL DEFAULT false, "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT REFERENCES "users"("id") ON DELETE SET NULL);
CREATE INDEX ON "users"("role"); CREATE INDEX ON "users"("isActive");

CREATE TABLE "expenses" (
  "id" TEXT PRIMARY KEY, "type" "ExpenseType" NOT NULL DEFAULT 'DAILY', "name" TEXT NOT NULL,
  "description" TEXT, "category" TEXT NOT NULL, "amount" DECIMAL(14,2) NOT NULL,
  "date" TIMESTAMP(3) NOT NULL, "dueDate" TIMESTAMP(3), "paymentMethod" TEXT, "receiptUrl" TEXT,
  "isPaid" BOOLEAN NOT NULL DEFAULT true, "isRecurring" BOOLEAN NOT NULL DEFAULT false,
  "sourceType" TEXT, "sourceId" TEXT, "addedById" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX ON "expenses"("type","date"); CREATE INDEX ON "expenses"("category");
CREATE INDEX ON "expenses"("date"); CREATE INDEX ON "expenses"("sourceType","sourceId");

CREATE TABLE "receipt_files" (
  "id" TEXT PRIMARY KEY, "mimeType" TEXT NOT NULL, "size" INTEGER NOT NULL, "data" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "revenues" (
  "id" TEXT PRIMARY KEY, "clientName" TEXT NOT NULL, "source" TEXT, "description" TEXT,
  "amount" DECIMAL(14,2) NOT NULL, "projectedDate" TIMESTAMP(3) NOT NULL, "receivedDate" TIMESTAMP(3),
  "receivedAmount" DECIMAL(14,2), "status" "RevenueStatus" NOT NULL DEFAULT 'PROJECTED',
  "addedById" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX ON "revenues"("status"); CREATE INDEX ON "revenues"("projectedDate"); CREATE INDEX ON "revenues"("receivedDate");

CREATE TABLE "partners" (
  "id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "email" TEXT, "percentage" DECIMAL(6,3) NOT NULL,
  "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING', "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);

CREATE TABLE "employees" (
  "id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "role" TEXT NOT NULL, "email" TEXT,
  "monthlySalary" DECIMAL(14,2) NOT NULL DEFAULT 0, "bonus" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "isSpecial" BOOLEAN NOT NULL DEFAULT false, "isActive" BOOLEAN NOT NULL DEFAULT true,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX ON "employees"("isSpecial","isActive");

CREATE TABLE "special_employee_projects" (
  "id" TEXT PRIMARY KEY, "employeeId" TEXT NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "projectName" TEXT NOT NULL, "totalAmount" DECIMAL(14,2) NOT NULL, "percentage" DECIMAL(6,3) NOT NULL,
  "payoutAmount" DECIMAL(14,2) NOT NULL, "date" TIMESTAMP(3) NOT NULL,
  "isPaid" BOOLEAN NOT NULL DEFAULT false, "expenseId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX ON "special_employee_projects"("employeeId"); CREATE INDEX ON "special_employee_projects"("date");

CREATE TABLE "daily_budgets" (
  "id" TEXT PRIMARY KEY, "date" DATE NOT NULL UNIQUE, "budgetAmount" DECIMAL(14,2) NOT NULL,
  "spentAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);

CREATE TABLE "audit_logs" (
  "id" TEXT PRIMARY KEY, "userId" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "username" TEXT NOT NULL, "role" TEXT, "action" TEXT NOT NULL, "entityType" TEXT NOT NULL,
  "entityId" TEXT, "details" JSONB, "ipAddress" TEXT, "userAgent" TEXT,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX ON "audit_logs"("timestamp"); CREATE INDEX ON "audit_logs"("entityType"); CREATE INDEX ON "audit_logs"("userId");

CREATE TABLE "notifications" (
  "id" TEXT PRIMARY KEY, "userId" TEXT REFERENCES "users"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL, "message" TEXT NOT NULL, "level" TEXT NOT NULL DEFAULT 'info',
  "isRead" BOOLEAN NOT NULL DEFAULT false, "link" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX ON "notifications"("userId","isRead");

CREATE TABLE "settings" ("key" TEXT PRIMARY KEY, "value" JSONB NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL);

CREATE TABLE "login_attempts" (
  "id" TEXT PRIMARY KEY, "username" TEXT NOT NULL, "ipAddress" TEXT, "success" BOOLEAN NOT NULL,
  "reason" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX ON "login_attempts"("username","createdAt");
