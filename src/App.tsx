import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { ToastProvider } from './components/ui/Toast';
import ProtectedShell from './components/ProtectedShell';
import RequireRole from './components/RequireRole';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Courses from './pages/Courses';
import Students from './pages/Students';
import Payments from './pages/Payments';
import Attendance from './pages/Attendance';
import Reports from './pages/Reports';
import Users from './pages/Users';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import StudentPortal from './pages/StudentPortal';
import Import from './pages/Import';

export default function App() {
  return (
    <BrowserRouter>
      <SettingsProvider>
        <ToastProvider>
          <AuthProvider>
            <Routes>
              <Route path="/login"   element={<Login />} />
              <Route path="/student" element={<StudentPortal />} />
              <Route element={<ProtectedShell />}>
                <Route path="/dashboard"  element={<Dashboard />} />
                <Route path="/students"   element={<Students />} />
                <Route path="/courses"    element={<Courses />} />
                <Route path="/payments"   element={<Payments />} />
                <Route path="/attendance" element={<Attendance />} />
                <Route path="/reports"    element={<Reports />} />
                <Route path="/users"      element={<RequireRole role="owner"><Users /></RequireRole>} />
                <Route path="/settings"   element={<RequireRole role="owner"><Settings /></RequireRole>} />
                <Route path="/profile"    element={<Profile />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
                <Route path="/import" element={<RequireRole role="owner"><Import /></RequireRole>} />
              </Route>
            </Routes>
          </AuthProvider>
        </ToastProvider>
      </SettingsProvider>
    </BrowserRouter>
  );
}