
import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { User, UserRole, Store, Permission, Employee, ActiveSession, RolePermissionConfig } from './types';
import { db, SyncStatus } from './services/db';
import { 
  LayoutDashboard, 
  Store as StoreIcon, 
  ChefHat, 
  LogOut, 
  Menu as MenuIcon, 
  ShoppingCart, 
  Users,
  BarChart3,
  UserSquare,
  Printer,
  History,
  ChevronDown,
  ChevronRight,
  FileText,
  UserCircle,
  AlertCircle,
  CheckCircle,
  Loader2,
  Cloud,
  CloudOff,
  RefreshCw,
  Zap,
  Package,
  Globe,
  Settings2,
  Database,
  Terminal,
  Activity,
  Unplug,
  ShieldCheck,
  UploadCloud,
  ArrowUpRight,
  CloudDownload,
  Settings,
  X,
  Lock,
  User as UserIcon,
  Save,
  Key,
  ScrollText,
  Phone,
  Mail,
  FastForward,
  Eraser,
  Tag
} from 'lucide-react';

import Login from './pages/Login';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import GlobalUsers from './pages/GlobalUsers';
import StaffManagement from './pages/StaffManagement';
import StoreMenu from './pages/StoreMenu';
import StoreCustomers from './pages/StoreCustomers';
import StoreInventory from './pages/StoreInventory';
import POS from './pages/POS';
import KOT from './pages/KOT';
import StoreReports from './pages/StoreReports';
import PrintDesigner from './pages/PrintDesigner';
import StoreHistory from './pages/StoreHistory';
import Quotations from './pages/Quotations';
import EmployeeManagement from './pages/EmployeeManagement';
import SystemLogs from './pages/SystemLogs';

interface AuthContextType {
  user: User | null;
  currentStoreId: number | null; 
  login: (u: User, storeId?: number) => void;
  logout: () => Promise<void>;
  switchStore: (storeId: number) => void;
  hasPermission: (permission: Permission) => boolean;
  openProfile: () => void;
}

const AuthContext = createContext<AuthContextType>(null!);

export const useAuth = () => useContext(AuthContext);

const SyncIndicator = () => {
    const [status, setStatus] = useState<{ status: SyncStatus, pendingCount: number, error?: string | null, isBackendMissing?: boolean }>(db.getSyncStatus());
    const [isTesting, setIsTesting] = useState(false);
    const [isRepairing, setIsRepairing] = useState(false);
    const [isBootstrapping, setIsBootstrapping] = useState(false);
    const [isPulling, setIsPulling] = useState(false);
    const [syncMessage, setSyncMessage] = useState<string | null>(null);

    useEffect(() => {
        const handleSyncUpdate = (e: any) => {
            setStatus(e.detail as { status: SyncStatus, pendingCount: number, error?: string | null, isBackendMissing?: boolean });
        };
        window.addEventListener('db_sync_update', handleSyncUpdate);
        return () => window.removeEventListener('db_sync_update', handleSyncUpdate);
    }, []);

    const runDiagnostic = async () => {
        setIsTesting(true);
        try {
            await db.verifyWriteAccess();
        } finally {
            setIsTesting(false);
        }
    };

    const handleRepairSchema = async () => {
        setIsRepairing(true);
        try {
            const response = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'INIT_SCHEMA' })
            });
            const result = await response.json().catch(() => ({ success: false, error: "Cloud connection failed." }));
            if (result.success) {
                alert("Database schema verified and migrated!");
                window.location.reload();
            } else {
                alert("Repair failed: " + (result.error || "Unknown error"));
            }
        } finally {
            setIsRepairing(false);
        }
    };

    const handleClearQueue = () => {
        if (confirm("Clear pending sync queue?")) db.clearSyncQueue();
    };

    const handleSkipTask = () => {
        if (confirm("Skip current failed task?")) db.skipFailedTask();
    };

    const handleBootstrap = async () => {
        if (!confirm("Push all local data to cloud?")) return;
        setIsBootstrapping(true);
        setSyncMessage("Syncing...");
        try {
            await db.syncAllLocalToCloud();
            setSyncMessage("Queued!");
            setTimeout(() => setSyncMessage(null), 2000);
        } finally {
            setIsBootstrapping(false);
        }
    };

    const handlePull = async () => {
        if (!confirm("Download all data from cloud?")) return;
        setIsPulling(true);
        try {
            const ok = await db.pullAllFromCloud();
            if (ok) window.location.reload();
        } finally {
            setIsPulling(false);
        }
    };

    const toggleSync = () => db.setSyncEnabled(!db.isSyncEnabled());

    const getStatusConfig = () => {
        if (status.status === 'DISABLED') return { icon: Database, text: 'Local', color: 'text-gray-400', bg: 'bg-gray-100' };
        switch(status.status) {
            case 'CONNECTED': return { icon: Cloud, text: 'Synced', color: 'text-green-500', bg: 'bg-green-50' };
            case 'SYNCING': return { icon: RefreshCw, text: `Syncing`, color: 'text-blue-500', bg: 'bg-blue-50', spin: true };
            case 'ERROR': return { icon: AlertCircle, text: 'Error', color: 'text-red-500', bg: 'bg-red-50' };
            default: return { icon: Cloud, text: 'Init', color: 'text-gray-500', bg: 'bg-gray-50' };
        }
    };

    const config = getStatusConfig();
    const Icon = config.icon;

    const isSchemaError = status.error?.toLowerCase().includes("sql") || 
                        status.error?.toLowerCase().includes("500") ||
                        status.error?.toLowerCase().includes("mismatch");

    return (
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full border border-transparent transition-all group relative cursor-help ${config.bg}`}>
            <Icon size={12} className={`${config.color} ${config.spin ? 'animate-spin' : ''}`} />
            <span className={`text-[10px] font-black uppercase tracking-tight ${config.color}`}>{config.text}</span>
            
            <div className="absolute top-full right-0 mt-2 p-4 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl shadow-2xl z-[200] w-72 hidden group-hover:block animate-in fade-in slide-in-from-top-1">
                <div className="flex justify-between items-center mb-3">
                    <p className="text-[10px] font-black text-gray-400 uppercase">Cloud Sync</p>
                    <button onClick={toggleSync} className={`text-[10px] font-black px-2 py-0.5 rounded ${db.isSyncEnabled() ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                        {db.isSyncEnabled() ? 'STOP' : 'START'}
                    </button>
                </div>
                
                {db.isSyncEnabled() && (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={handleBootstrap} className="flex flex-col items-center gap-1 py-2 bg-blue-600 text-white rounded-lg text-[9px] font-black uppercase">
                                <UploadCloud size={14} /> Push
                            </button>
                            <button onClick={handlePull} className="flex flex-col items-center gap-1 py-2 bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase">
                                <CloudDownload size={14} /> Pull
                            </button>
                        </div>
                        {status.error && (
                            <div className="p-2 bg-red-50 rounded-lg text-[10px]">
                                <p className="font-bold text-red-500 mb-1">Last Error:</p>
                                <p className="text-gray-600 truncate">{status.error}</p>
                                <div className="flex flex-col gap-1 mt-2">
                                    {isSchemaError && <button onClick={handleRepairSchema} className="bg-red-600 text-white p-1 rounded uppercase font-black">Repair Schema</button>}
                                    <button onClick={handleSkipTask} className="bg-gray-100 text-gray-700 p-1 rounded uppercase font-black">Skip Task</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

const ProtectedRoute = ({ children, permission }: { children: React.ReactNode, permission?: Permission }) => {
  const { user, hasPermission } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (permission && !hasPermission(permission)) return <div className="p-20 text-center text-red-500 font-black uppercase">Access Denied</div>;
  return <>{children}</>;
};

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { user, logout, switchStore, currentStoreId, hasPermission } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const loadStores = async () => {
      const data = await db.getStores();
      if (user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.ADMIN) setStores(data);
      else if (user) setStores(data.filter(s => user.storeIds.includes(s.id)));
    };
    loadStores();
  }, [user]);

  const navItems = [
    { label: 'Overview', icon: LayoutDashboard, path: '/dashboard', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
    { label: 'POS Terminal', icon: ShoppingCart, path: '/pos', permission: 'POS_ACCESS' },
    { label: 'Kitchen', icon: ChefHat, path: '/kot', permission: 'VIEW_KOT' },
    { label: 'Inventory', icon: Package, path: currentStoreId ? `/store/${currentStoreId}/inventory` : null, permission: 'MANAGE_INVENTORY' },
    { label: 'Menu', icon: MenuIcon, path: currentStoreId ? `/store/${currentStoreId}/menu` : null, permission: 'MANAGE_INVENTORY' },
    { label: 'Customers', icon: UserSquare, path: currentStoreId ? `/store/${currentStoreId}/customers` : null, permission: 'MANAGE_CUSTOMERS' },
    { label: 'History', icon: History, path: currentStoreId ? `/store/${currentStoreId}/history` : null, permission: 'VIEW_HISTORY' },
    { label: 'Quotations', icon: FileText, path: currentStoreId ? `/store/${currentStoreId}/quotations` : null, permission: 'VIEW_QUOTATIONS' },
    { label: 'Reports', icon: BarChart3, path: '/reports', permission: 'VIEW_REPORTS' },
    { label: 'Users', icon: Lock, path: '/users', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
    { label: 'Employees', icon: UserCircle, path: '/employees', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
    { label: 'Logs', icon: ScrollText, path: '/logs', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
    { label: 'Design', icon: Printer, path: currentStoreId ? `/store/${currentStoreId}/designer` : null, permission: 'MANAGE_PRINT_DESIGNER' },
  ];

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950">
      {/* Top Header Bar */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 z-50">
        <div className="px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex flex-col cursor-pointer" onClick={() => navigate('/dashboard')}>
              <h1 className="text-xl font-black text-blue-600 italic tracking-tighter leading-none">OmniPOS</h1>
              <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest mt-1">Enterprise</span>
            </div>

            <div className="hidden lg:flex items-center gap-3 pl-8 border-l border-gray-100 dark:border-gray-800">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Store Context</label>
              <select 
                value={currentStoreId || ''} 
                onChange={(e) => switchStore(Number(e.target.value))}
                className="bg-gray-50 dark:bg-gray-800 border-none rounded-lg text-xs font-bold py-1.5 px-3 outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
              >
                <option value="" disabled>Select...</option>
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <SyncIndicator />
            <div className="flex items-center gap-3 pl-4 border-l border-gray-100 dark:border-gray-800">
                <div className="text-right hidden sm:block">
                    <p className="text-[10px] font-black text-gray-900 dark:text-white uppercase leading-none">{user?.name}</p>
                    <p className="text-[8px] font-bold text-blue-600 uppercase tracking-widest mt-1">{user?.role}</p>
                </div>
                <button onClick={logout} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                    <LogOut size={20} />
                </button>
            </div>
          </div>
        </div>

        {/* Secondary Navigation Row */}
        <nav className="px-6 h-12 flex items-center gap-1 overflow-x-auto custom-scrollbar bg-gray-50/50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800">
          {navItems.map((item, idx) => {
            if (item.path === null) return null;
            const hasRole = !item.roles || item.roles.includes(user?.role as UserRole);
            const hasPerm = !item.permission || hasPermission(item.permission as Permission);
            if (!hasRole || !hasPerm) return null;

            const isActive = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path.split('/').slice(0, 3).join('/')));
            
            return (
              <button 
                key={idx}
                onClick={() => navigate(item.path!)}
                className={`flex items-center gap-2 px-4 h-full text-xs font-bold transition-all border-b-2 whitespace-nowrap ${isActive ? 'text-blue-600 border-blue-600 bg-blue-50/50' : 'text-gray-500 border-transparent hover:text-gray-800 dark:hover:text-gray-300'}`}
              >
                <item.icon size={16} className={isActive ? 'text-blue-600' : 'text-gray-400'} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-8">
        <div className="max-w-[1600px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentStoreId, setCurrentStoreId] = useState<number | null>(null);
  const [rolePerms, setRolePerms] = useState<RolePermissionConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initSession = async () => {
      const savedUser = localStorage.getItem('user');
      const savedStore = localStorage.getItem('currentStoreId');
      if (savedUser) {
          const parsedUser = JSON.parse(savedUser);
          setUser(parsedUser);
          if (savedStore) setCurrentStoreId(Number(savedStore));
      }
      const perms = await db.getRolePermissions();
      setRolePerms(perms);
      setIsLoading(false);
    };
    initSession();
  }, []);

  useEffect(() => {
      if (!user) return;
      const beat = () => db.updateHeartbeat(user.id, currentStoreId);
      beat();
      const interval = setInterval(beat, 30000);
      return () => clearInterval(interval);
  }, [user, currentStoreId]);

  const login = (u: User, storeId?: number) => {
    setUser(u);
    localStorage.setItem('user', JSON.stringify(u));
    if (storeId) {
      setCurrentStoreId(storeId);
      localStorage.setItem('currentStoreId', storeId.toString());
    }
  };

  const logout = async () => {
    if (user) await db.removeSession(user.id);
    setUser(null);
    setCurrentStoreId(null);
    localStorage.removeItem('user');
    localStorage.removeItem('currentStoreId');
  };

  const switchStore = (storeId: number) => {
    setCurrentStoreId(storeId);
    localStorage.setItem('currentStoreId', storeId.toString());
  };

  const hasPermission = (permission: Permission) => {
    if (!user) return false;
    if (user.role === UserRole.SUPER_ADMIN) return true;
    const config = rolePerms.find(rp => rp.role === user.role);
    return config?.permissions.includes(permission) || false;
  };

  if (isLoading) return null;

  return (
    <AuthContext.Provider value={{ user, currentStoreId, login, logout, switchStore, hasPermission, openProfile: () => {} }}>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Layout><Navigate to="/dashboard" replace /></Layout></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Layout><SuperAdminDashboard /></Layout></ProtectedRoute>} />
          <Route path="/pos" element={<ProtectedRoute permission="POS_ACCESS"><POS /></ProtectedRoute>} />
          <Route path="/kot" element={<ProtectedRoute permission="VIEW_KOT"><Layout><KOT /></Layout></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute permission="VIEW_REPORTS"><Layout><StoreReports /></Layout></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute><Layout><GlobalUsers /></Layout></ProtectedRoute>} />
          <Route path="/employees" element={<ProtectedRoute><Layout><EmployeeManagement /></Layout></ProtectedRoute>} />
          <Route path="/logs" element={<ProtectedRoute><Layout><SystemLogs /></Layout></ProtectedRoute>} />
          <Route path="/store/:storeId/inventory" element={<ProtectedRoute permission="MANAGE_INVENTORY"><Layout><StoreInventory /></Layout></ProtectedRoute>} />
          <Route path="/store/:storeId/menu" element={<ProtectedRoute permission="MANAGE_INVENTORY"><Layout><StoreMenu /></Layout></ProtectedRoute>} />
          <Route path="/store/:storeId/customers" element={<ProtectedRoute permission="MANAGE_CUSTOMERS"><Layout><StoreCustomers /></Layout></ProtectedRoute>} />
          <Route path="/store/:storeId/staff" element={<ProtectedRoute permission="MANAGE_STAFF"><Layout><StaffManagement /></Layout></ProtectedRoute>} />
          <Route path="/store/:storeId/history" element={<ProtectedRoute permission="VIEW_HISTORY"><Layout><StoreHistory /></Layout></ProtectedRoute>} />
          <Route path="/store/:storeId/quotations" element={<ProtectedRoute permission="VIEW_QUOTATIONS"><Layout><Quotations /></Layout></ProtectedRoute>} />
          <Route path="/store/:storeId/designer" element={<ProtectedRoute permission="MANAGE_PRINT_DESIGNER"><Layout><PrintDesigner /></Layout></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </HashRouter>
    </AuthContext.Provider>
  );
};
