
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { db } from './services/db';
import { User, UserRole, Permission, RolePermissionConfig } from './types';

// Pages
import Login from './pages/Login';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import GlobalUsers from './pages/GlobalUsers';
import EmployeeManagement from './pages/EmployeeManagement';
import SystemLogs from './pages/SystemLogs';
import POS from './pages/POS';
import KOT from './pages/KOT';
import StoreMenu from './pages/StoreMenu';
import StoreInventory from './pages/StoreInventory';
import StoreCustomers from './pages/StoreCustomers';
import StoreHistory from './pages/StoreHistory';
import StoreReports from './pages/StoreReports';
import StaffManagement from './pages/StaffManagement';
import PrintDesigner from './pages/PrintDesigner';
import Quotations from './pages/Quotations';

// Auth Interface
interface AuthContextType {
  user: User | null;
  currentStoreId: number | null;
  login: (user: User, storeId?: number) => void;
  logout: () => void;
  switchStore: (storeId: number) => void;
  hasPermission: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Fix: App.tsx must export useAuth and App as a module to fix the "not a module" error.
/**
 * useAuth hook for accessing authentication state and methods.
 * This export is critical to fix the "not a module" error in pages importing this hook.
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  
  const [currentStoreId, setCurrentStoreId] = useState<number | null>(() => {
    const saved = localStorage.getItem('currentStoreId');
    return saved ? Number(saved) : null;
  });

  const [rolePermissions, setRolePermissions] = useState<RolePermissionConfig[]>([]);

  useEffect(() => {
    const loadPerms = async () => {
      const perms = await db.getRolePermissions();
      setRolePermissions(perms);
    };
    loadPerms();
    window.addEventListener('db_change_global_permissions', loadPerms);
    return () => window.removeEventListener('db_change_global_permissions', loadPerms);
  }, []);

  // Update heartbeat for active session tracking
  useEffect(() => {
    if (user) {
      db.updateHeartbeat(user.id, currentStoreId);
      const interval = setInterval(() => {
        db.updateHeartbeat(user.id, currentStoreId);
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [user, currentStoreId]);

  const login = (userData: User, storeId?: number) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    if (storeId !== undefined) {
      setCurrentStoreId(storeId);
      localStorage.setItem('currentStoreId', storeId.toString());
    }
  };

  const logout = () => {
    if (user) db.removeSession(user.id);
    setUser(null);
    setCurrentStoreId(null);
    localStorage.removeItem('user');
    localStorage.removeItem('currentStoreId');
  };

  const switchStore = (storeId: number) => {
    setCurrentStoreId(storeId);
    localStorage.setItem('currentStoreId', storeId.toString());
  };

  const hasPermission = useCallback((permission: Permission): boolean => {
    if (!user) return false;
    if (user.role === UserRole.SUPER_ADMIN) return true;
    
    const config = rolePermissions.find(rp => rp.role === user.role);
    return config ? config.permissions.includes(permission) : false;
  }, [user, rolePermissions]);

  return (
    <AuthContext.Provider value={{ user, currentStoreId, login, logout, switchStore, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  return <>{children}</>;
};

/**
 * AppContent defines the main application layout and routing table.
 */
const AppContent: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';

  if (isLoginPage) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route path="/" element={<PrivateRoute><SuperAdminDashboard /></PrivateRoute>} />
            <Route path="/dashboard" element={<PrivateRoute><SuperAdminDashboard /></PrivateRoute>} />
            <Route path="/users" element={<PrivateRoute><GlobalUsers /></PrivateRoute>} />
            <Route path="/employees" element={<PrivateRoute><EmployeeManagement /></PrivateRoute>} />
            <Route path="/logs" element={<PrivateRoute><SystemLogs /></PrivateRoute>} />
            
            <Route path="/pos" element={<PrivateRoute><POS /></PrivateRoute>} />
            <Route path="/kot" element={<PrivateRoute><KOT /></PrivateRoute>} />
            
            <Route path="/store/:storeId/menu" element={<PrivateRoute><StoreMenu /></PrivateRoute>} />
            <Route path="/store/:storeId/inventory" element={<PrivateRoute><StoreInventory /></PrivateRoute>} />
            <Route path="/store/:storeId/customers" element={<PrivateRoute><StoreCustomers /></PrivateRoute>} />
            <Route path="/store/:storeId/history" element={<PrivateRoute><StoreHistory /></PrivateRoute>} />
            <Route path="/store/:storeId/reports" element={<PrivateRoute><StoreReports /></PrivateRoute>} />
            <Route path="/store/:storeId/staff" element={<PrivateRoute><StaffManagement /></PrivateRoute>} />
            <Route path="/store/:storeId/print-designer" element={<PrivateRoute><PrintDesigner /></PrivateRoute>} />
            <Route path="/store/:storeId/quotations" element={<PrivateRoute><Quotations /></PrivateRoute>} />
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

/**
 * The root App component.
 * Exported as a named export to match the requirement in index.tsx.
 */
export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
};
