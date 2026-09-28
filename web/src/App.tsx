import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { FullPageLoader, ProtectedRoute } from './components/layout/ProtectedRoute';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const DailyExpenses = lazy(() => import('./pages/expenses/DailyExpenses'));
const WeeklyExpenses = lazy(() => import('./pages/expenses/WeeklyExpenses'));
const MonthlyExpenses = lazy(() => import('./pages/expenses/MonthlyExpenses'));
const RecurringExpenses = lazy(() => import('./pages/expenses/RecurringExpenses'));
const RevenuePage = lazy(() => import('./pages/Revenue'));
const Partners = lazy(() => import('./pages/Partners'));
const RegularEmployees = lazy(() => import('./pages/employees/RegularEmployees'));
const SpecialEmployees = lazy(() => import('./pages/employees/SpecialEmployees'));
const DailyBudget = lazy(() => import('./pages/DailyBudget'));
const Reports = lazy(() => import('./pages/Reports'));
const Users = lazy(() => import('./pages/Users'));
const AuditLog = lazy(() => import('./pages/AuditLog'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const NotFound = lazy(() => import('./pages/NotFound'));

export default function App() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<Dashboard />} />

            <Route path="expenses" element={<Navigate to="/expenses/daily" replace />} />
            <Route path="expenses/daily" element={<DailyExpenses />} />
            <Route path="expenses/weekly" element={<WeeklyExpenses />} />
            <Route path="expenses/monthly" element={<MonthlyExpenses />} />

            <Route element={<ProtectedRoute permission="manage:recurring" />}>
              <Route path="expenses/recurring" element={<RecurringExpenses />} />
            </Route>

            <Route path="revenue" element={<RevenuePage />} />
            <Route path="budget" element={<DailyBudget />} />

            <Route element={<ProtectedRoute permission="view:partners" />}>
              <Route path="partners" element={<Partners />} />
            </Route>

            <Route element={<ProtectedRoute permission="view:employees" />}>
              <Route path="employees" element={<Navigate to="/employees/regular" replace />} />
              <Route path="employees/regular" element={<RegularEmployees />} />
              <Route path="employees/special" element={<SpecialEmployees />} />
            </Route>

            <Route element={<ProtectedRoute permission="view:reports" />}>
              <Route path="reports" element={<Reports />} />
            </Route>

            <Route element={<ProtectedRoute permission="manage:users" />}>
              <Route path="users" element={<Users />} />
            </Route>

            <Route element={<ProtectedRoute permission="view:audit" />}>
              <Route path="audit" element={<AuditLog />} />
            </Route>

            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
