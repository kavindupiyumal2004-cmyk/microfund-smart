import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/public/HomePage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import VerifyEmailPage from './pages/auth/VerifyEmailPage';
import ResendVerificationPage from './pages/auth/ResendVerificationPage';
import ProtectedRoute from './components/ProtectedRoute';
import GuestRoute from './components/GuestRoute';
import DashboardLayout from './components/DashboardLayout';
import DashboardHome from './pages/dashboard/DashboardHome';
import NotificationsPage from './pages/dashboard/NotificationsPage';
import ApplyLoanPage from './pages/customer/ApplyLoanPage';
import MyApplicationsPage from './pages/customer/MyApplicationsPage';
import MyLoansPage from './pages/customer/MyLoansPage';
import CustomerDocumentsPage from './pages/customer/CustomerDocumentsPage';
import PaymentSlipsPage from './pages/customer/PaymentSlipsPage';
import AdminApplicationsPage from './pages/admin/AdminApplicationsPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import UserDetailsPage from './pages/admin/UserDetailsPage';
import AdminCatalogPage from './pages/admin/AdminCatalogPage';
import AuditLogsPage from './pages/admin/AuditLogsPage';
import FieldVisitsPage from './pages/field/FieldVisitsPage';
import PaymentsPage from './pages/cashier/PaymentsPage';
import PaymentReviewsPage from './pages/cashier/PaymentReviewsPage';
import ReportsPage from './pages/dashboard/ReportsPage';
import CollectionsPage from './pages/collections/CollectionsPage';
import NotFoundPage from './pages/common/NotFoundPage';

export default function App() {
  return <Routes>
    <Route path="/" element={<HomePage />} />
    <Route element={<GuestRoute />}>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
    </Route>
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route path="/verify-email" element={<VerifyEmailPage />} />
    <Route path="/resend-verification" element={<ResendVerificationPage />} />
    <Route element={<ProtectedRoute />}>
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<DashboardHome />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route element={<ProtectedRoute roles={['CUSTOMER']} />}>
          <Route path="apply" element={<ApplyLoanPage />} />
          <Route path="my-applications" element={<MyApplicationsPage />} />
          <Route path="my-loans" element={<MyLoansPage />} />
          <Route path="documents" element={<CustomerDocumentsPage />} />
          <Route path="payment-slips" element={<PaymentSlipsPage />} />
        </Route>
        <Route element={<ProtectedRoute roles={['OWNER', 'MANAGER']} />}>
          <Route path="applications" element={<AdminApplicationsPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="users/:id" element={<UserDetailsPage />} />
          <Route path="catalog" element={<AdminCatalogPage />} />
          <Route path="audit" element={<AuditLogsPage />} />
        </Route>
        <Route element={<ProtectedRoute roles={['AGENT']} />}>
          <Route path="visits" element={<FieldVisitsPage />} />
        </Route>
        <Route element={<ProtectedRoute roles={['OWNER', 'MANAGER', 'AGENT']} />}>
          <Route path="collections" element={<CollectionsPage />} />
        </Route>
        <Route element={<ProtectedRoute roles={['OWNER', 'MANAGER', 'CASHIER']} />}>
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="payment-reviews" element={<PaymentReviewsPage />} />
          <Route path="reports" element={<ReportsPage />} />
        </Route>
      </Route>
    </Route>
    <Route path="*" element={<NotFoundPage />} />
  </Routes>;
}
