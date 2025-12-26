import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout/Layout';

// Pages
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import DepartmentDashboard from './pages/DepartmentDashboard';
import HODDashboard from './pages/HODDashboard';
import ConsolidatedDashboard from './pages/ConsolidatedDashboard';
import GraphicalDashboard from './pages/GraphicalDashboard';
import DepartmentDetail from './pages/DepartmentDetail';
import BudgetAllocations from './pages/BudgetAllocations';
import SubmitExpenditure from './pages/SubmitExpenditure';
import Expenditures from './pages/Expenditures';
import ApprovalsQueue from './pages/ApprovalsQueue';
import YearComparison from './pages/YearComparison';
import Reports from './pages/Reports';
import AuditLogs from './pages/AuditLogs';
import Notifications from './pages/Notifications';
import Settings from './pages/Settings';
import Users from './pages/Users';
import UserForm from './pages/UserForm';
import AllocationForm from './pages/AllocationForm';
import Departments from './pages/Departments';
import DepartmentForm from './pages/DepartmentForm';
import BudgetHeads from './pages/BudgetHeads';
import BudgetHeadForm from './pages/BudgetHeadForm';
import Categories from './pages/Categories';
import CategoryForm from './pages/CategoryForm';
import ResubmitExpenditure from './pages/ResubmitExpenditure';
import BulkUpload from './pages/BulkUpload';
import DepartmentUsers from './pages/DepartmentUsers';
import Profile from './pages/Profile';
import BudgetProposals from './pages/BudgetProposals';
import BudgetProposalForm from './pages/BudgetProposalForm';
import ConsolidatedBudgetReport from './pages/ConsolidatedBudgetReport';
import BudgetUtilizationDashboard from './pages/BudgetUtilizationDashboard';
import BudgetProposalReport from './pages/BudgetProposalReport';
import './App.css';

// Dashboard Wrapper Component
const DashboardWrapper = () => {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" />;

  if (user.role === 'department') {
    return <DepartmentDashboard />;
  }

  if (user.role === 'hod') {
    return <HODDashboard />;
  }

  return <Dashboard />;
};

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Router>
          <div className="App">
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              {/* Protected Routes */}
              <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardWrapper />} />

                {/* Admin Routes */}
                <Route path="users" element={<Users />} />
                <Route path="users/add" element={<UserForm />} />
                <Route path="users/edit/:id" element={<UserForm />} />
                <Route path="departments" element={<Departments />} />
                <Route path="departments/add" element={<DepartmentForm />} />
                <Route path="departments/edit/:id" element={<DepartmentForm />} />
                <Route path="budget-heads" element={<BudgetHeads />} />
                <Route path="budget-heads/add" element={<BudgetHeadForm />} />
                <Route path="budget-heads/edit/:id" element={<BudgetHeadForm />} />
                <Route path="categories" element={<Categories />} />
                <Route path="categories/add" element={<CategoryForm />} />
                <Route path="categories/edit/:id" element={<CategoryForm />} />
                <Route path="settings" element={<Settings />} />

                {/* Office Routes */}
                <Route path="allocations" element={<BudgetAllocations />} />
                <Route path="allocations/add" element={<AllocationForm />} />
                <Route path="allocations/edit/:id" element={<AllocationForm />} />
                <Route path="bulk-upload" element={<BulkUpload />} />
                <Route path="budget-proposals" element={<BudgetProposals />} />
                <Route path="budget-proposals/add" element={<BudgetProposalForm />} />
                <Route path="budget-proposals/edit/:id" element={<BudgetProposalForm />} />
                <Route path="budget-proposals/:id" element={<BudgetProposalForm />} />
                <Route path="consolidated-budget-report" element={<ConsolidatedBudgetReport />} />
                <Route path="budget-utilization-dashboard" element={<BudgetUtilizationDashboard />} />
                <Route path="budget-proposal-report" element={<BudgetProposalReport />} />
                <Route path="approvals" element={<ApprovalsQueue />} />
                <Route path="reports" element={<Reports />} />

                {/* Department Routes */}
                <Route path="expenditures" element={<Expenditures />} />
                <Route path="submit-expenditure" element={<SubmitExpenditure />} />
                <Route path="resubmit-expenditure/:id" element={<ResubmitExpenditure />} />

                {/* HOD Routes */}
                <Route path="department-expenditures" element={<HODDashboard />} />
                <Route path="department-users" element={<DepartmentUsers />} />

                {/* Management Routes */}
                <Route path="consolidated-view" element={<ConsolidatedDashboard />} />
                <Route path="year-comparison" element={<YearComparison />} />

                {/* Auditor Routes */}
                <Route path="audit-logs" element={<AuditLogs />} />

                {/* Common Routes */}
                <Route path="notifications" element={<Notifications />} />
                <Route path="graphical-dashboard" element={<GraphicalDashboard />} />
                <Route path="department-detail/:id" element={<DepartmentDetail />} />
                <Route path="profile" element={<Profile />} />
              </Route>

              {/* Password Reset Routes (Public) */}
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password/:token" element={<ResetPassword />} />

              {/* Catch all route */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </Router>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
