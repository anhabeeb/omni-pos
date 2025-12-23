
import React, { useState, useEffect, createContext, useContext } from 'react';
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
  Circle,
  CalendarCheck,
  X,
  Layout,
  IdCard,
  Phone,
  UserCircle,
  AlertCircle,
  CheckCircle,
  Hash,
  Loader2,
  Lock,
  Cloud,
  CloudOff,
  RefreshCw,
  Zap,
  Package,
  Wrench,
  Globe,
  Settings2,
  Database,
  Terminal,
  Activity,
  Unplug
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

interface AuthContextType {
  user: User | null;
  currentStoreId: string | null; 
  login: (u: User, storeId?: string) => void;
  logout: () => void;
  switchStore: (storeId: string) => void;
  hasPermission: (permission: Permission) => boolean;
  openProfile: () => void;
}

const AuthContext = createContext<AuthContextType>(null!);

export const useAuth = () => useContext(AuthContext);

const SyncIndicator = () => {
    const [status, setStatus] = useState<{ status: SyncStatus, pendingCount: number, error?: string | null, isBackendMissing?: boolean }>(db.getSyncStatus());
    const [diagResult, setDiagResult] = useState<{success: boolean, message: string, hint?: string, is404?: boolean, trace?: string} | null>(null);
    const [isTesting, setIsTesting] = useState(false);
    const [isRepairing, setIsRepairing] = useState(false);

    useEffect(() => {
        const handleSyncUpdate = (e: any) => {
            setStatus(e.detail);
        };
        window.addEventListener('db_sync_update', handleSyncUpdate);
        return () => window.removeEventListener('db_sync_update', handleSyncUpdate);
    }, []);

    const runDiagnostic = async () => {
        setIsTesting(true);
        setDiagResult(null);
        try {
            const res = await db.verifyWriteAccess();
            setDiagResult(res);
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
            const result = await response.json();
            if (result.success) {
                alert("Database schema initialized! Please refresh the page.");
                window.location.reload();
            } else {
                alert("Repair failed: " + result.error);
            }
        } catch (e: any) {
            alert("Connection error during repair: " + e.message);
        } finally {
            setIsRepairing(false);
        }
    };

    const toggleSync = () => {
        const current = db.isSyncEnabled();
        db.setSyncEnabled(!current);
    };

    const getStatusConfig = () => {
        if (status.status === 'DISABLED') return {
            icon: Database,
            text: 'Local Mode',
            color: 'text-gray-400',
            bg: 'bg-gray-100 dark:bg-gray-800'
        };

        switch(status.status) {
            case 'CONNECTED': return { 
                icon: Cloud, 
                text: 'Cloud Synced', 
                color: 'text-green-500', 
                bg: 'bg-green-50 dark:bg-green-900/10' 
            };
            case 'SYNCING': return { 
                icon: RefreshCw, 
                text: `Syncing (${status.pendingCount})`, 
                color: 'text-blue-500', 
                bg: 'bg-blue-50 dark:bg-blue-900/10',
                spin: true 
            };
            case 'TESTING': return { 
                icon: Zap, 
                text: 'Handshaking...', 
                color: 'text-purple-500', 
                bg: 'bg-purple-50 dark:bg-purple-900/10',
                spin: true 
            };
            case 'MOCKED': return { 
                icon: Unplug, 
                text: 'Placeholder API', 
                color: 'text-red-600', 
                bg: 'bg-red-50 dark:bg-red-900/20' 
            };
            case 'OFFLINE': return { 
                icon: CloudOff, 
                text: status.pendingCount > 0 ? `${status.pendingCount} Unsynced` : 'Offline Mode', 
                color: 'text-orange-500', 
                bg: 'bg-orange-50 dark:bg-orange-900/10' 
            };
            case 'ERROR': return { 
                icon: AlertCircle, 
                text: status.isBackendMissing ? 'Backend Missing' : 'Sync Error', 
                color: 'text-red-500', 
                bg: 'bg-red-50 dark:bg-red-900/10' 
            };
            default: return { 
                icon: Cloud, 
                text: 'Initializing...', 
                color: 'text-gray-500', 
                bg: 'bg-gray-50' 
            };
        }
    };

    const config = getStatusConfig();
    const Icon = config.icon;

    return (
        <div 
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border border-transparent transition-all group relative cursor-help ${config.bg}`}
        >
            <Icon size={14} className={`${config.color} ${config.spin ? 'animate-spin' : ''}`} />
            <span className={`text-[10px] font-black uppercase tracking-wider ${config.color}`}>{config.text}</span>
            
            <div className="absolute top-full right-0 mt-2 p-4 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl shadow-2xl z-[100] w-80 hidden group-hover:block animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="flex justify-between items-center mb-3">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Database Sync</p>
                    <button 
                        onClick={(e) => { e.stopPropagation(); toggleSync(); }}
                        className={`text-[10px] font-black px-2 py-1 rounded transition-colors ${db.isSyncEnabled() ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                    >
                        {db.isSyncEnabled() ? 'DISABLE SYNC' : 'ENABLE SYNC'}
                    </button>
                </div>
                
                <div className="space-y-3">
                    {!db.isSyncEnabled() ? (
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-700">
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                                System is currently in <span className="font-bold">Local-First Mode</span>. All data is saved to your browser's persistent storage. Cloud synchronization is paused.
                            </p>
                        </div>
                    ) : (
                        <>
                            {status.status === 'MOCKED' && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/30 rounded-xl border border-red-200 dark:border-red-900/50 mb-2">
                                    <div className="flex items-center gap-2 mb-1 text-red-600">
                                        <AlertCircle size={16}/>
                                        <p className="text-[11px] font-black uppercase">Infrastructure Issue</p>
                                    </div>
                                    <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-tight">
                                        Your backend returned <span className="font-mono font-bold">"Hello world"</span>. This means you have a default Cloudflare worker intercepting the <span className="font-mono">/api</span> route. 
                                    </p>
                                    <p className="text-[10px] text-red-500 font-bold mt-2 italic">Check: Functions &gt; Settings in Cloudflare Pages dashboard.</p>
                                </div>
                            )}

                            {status.error && status.status !== 'MOCKED' && (
                                <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-900/30">
                                    <p className="text-[10px] font-black text-red-500 uppercase mb-1">Status Report:</p>
                                    <p className="text-[11px] text-gray-600 dark:text-gray-300 font-medium leading-tight">{status.error}</p>
                                    {status.error.includes("schema") && (
                                        <button 
                                            onClick={handleRepairSchema}
                                            disabled={isRepairing}
                                            className="mt-2 w-full flex items-center justify-center gap-2 py-1.5 bg-red-600 text-white text-[10px] font-black uppercase rounded hover:bg-red-700 transition-colors"
                                        >
                                            {isRepairing ? <Loader2 size={12} className="animate-spin"/> : <Terminal size={12}/>}
                                            Initialize Tables
                                        </button>
                                    )}
                                </div>
                            )}

                            {diagResult && (
                                <div className={`p-2 rounded-lg border ${diagResult.success ? 'bg-green-50 border-green-100 dark:bg-green-900/10' : (diagResult.is404 ? 'bg-orange-50 border-orange-100 dark:bg-orange-900/10' : 'bg-red-50 border-red-100 dark:bg-red-900/10')}`}>
                                    <div className="flex items-center gap-2 mb-1">
                                        {diagResult.success ? <CheckCircle size={12} className="text-green-600"/> : (diagResult.is404 ? <Globe size={12} className="text-orange-600"/> : <AlertCircle size={12} className="text-red-600"/>)}
                                        <p className={`text-[10px] font-black uppercase ${diagResult.success ? 'text-green-600' : (diagResult.is404 ? 'text-orange-600' : 'text-red-600')}`}>
                                            {diagResult.success ? 'Database Online' : (diagResult.is404 ? 'Backend Not Detected' : 'Write Access Denied')}
                                        </p>
                                    </div>
                                    <p className="text-[11px] text-gray-600 dark:text-gray-300 font-medium leading-tight">{diagResult.message}</p>
                                    
                                    {diagResult.trace && (
                                        <div className="mt-1 flex items-center gap-1.5 text-[9px] text-gray-400 font-mono italic">
                                            <Activity size={10} /> {diagResult.trace}
                                        </div>
                                    )}

                                    {!diagResult.success && diagResult.message.includes("no such table") && (
                                        <button 
                                            onClick={handleRepairSchema}
                                            disabled={isRepairing}
                                            className="mt-2 w-full flex items-center justify-center gap-2 py-1.5 bg-blue-600 text-white text-[10px] font-black uppercase rounded hover:bg-blue-700 transition-colors"
                                        >
                                            {isRepairing ? <Loader2 size={12} className="animate-spin"/> : <Terminal size={12}/>}
                                            Repair Schema
                                        </button>
                                    )}

                                    {diagResult.hint && (
                                        <div className="mt-2 pt-2 border-t border-black/5">
                                            <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold italic uppercase mb-1">Setup Steps:</p>
                                            <p className="text-[10px] text-blue-500/80 dark:text-blue-300 font-medium">{diagResult.hint}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex gap-2 border-t dark:border-gray-700 pt-3">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); db.testConnection(); }}
                                    className="flex-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-[9px] font-black uppercase rounded hover:bg-gray-200 transition-colors"
                                >
                                    Retry Ping
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); runDiagnostic(); }}
                                    disabled={isTesting}
                                    className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-[9px] font-black uppercase rounded hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
                                >
                                    {isTesting ? <Loader2 size={10} className="animate-spin"/> : <Settings2 size={10}/>}
                                    Run Diagnostic
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const LayoutWrapper = ({ children }: { children: React.ReactNode }) => {
  const { user, logout, currentStoreId, switchStore, hasPermission } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [stores, setStores] = useState<Store[]>([]);

  useEffect(() => {
    const loadStores = async () => {
      const allStores = await db.getStores();
      if (user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.ADMIN) {
        setStores(allStores);
      } else if (user?.storeIds) {
        setStores(allStores.filter(s => user.storeIds.includes(s.id)));
      }
    };
    loadStores();
  }, [user]);

  const currentStore = stores.find(s => s.id === currentStoreId);

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
    { icon: ShoppingCart, label: 'POS System', path: '/pos', permission: 'POS_ACCESS' },
    { icon: ChefHat, label: 'Kitchen (KOT)', path: '/kot', permission: 'VIEW_KOT' },
    { icon: History, label: 'History', path: '/history', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER] },
    { icon: FileText, label: 'Quotations', path: '/quotations', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER] },
    { icon: BarChart3, label: 'Reports', path: '/reports', permission: 'VIEW_REPORTS' },
    { icon: Users, label: 'Users', path: '/users', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
    { icon: IdCard, label: 'Employees', path: '/employees', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
  ];

  const storeMenuItems = [
    { icon: MenuIcon, label: 'Menu', path: `/store/${currentStoreId}/menu`, permission: 'MANAGE_INVENTORY' },
    { icon: Package, label: 'Inventory', path: `/store/${currentStoreId}/inventory`, permission: 'MANAGE_INVENTORY' },
    { icon: UserSquare, label: 'Customers', path: `/store/${currentStoreId}/customers`, permission: 'MANAGE_CUSTOMERS' },
    { icon: Printer, label: 'Designer', path: `/print-designer/${currentStoreId}`, permission: 'MANAGE_PRINT_DESIGNER' },
  ];

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Reverted Sidebar UI */}
      <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col shadow-lg z-30">
        <div className="p-8">
          <h1 className="text-2xl font-black text-blue-600 tracking-tighter italic">OmniPOS</h1>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Multi-Store Suite</p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 space-y-1 custom-scrollbar">
          {menuItems.filter(item => {
            if (item.roles && !item.roles.includes(user?.role as UserRole)) return false;
            if (item.permission && !hasPermission(item.permission as Permission)) return false;
            return true;
          }).map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${location.pathname === item.path ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 hover:translate-x-1'}`}
            >
              <item.icon size={20} className={location.pathname === item.path ? 'text-white' : 'text-gray-400'} />
              <span className="font-bold text-sm">{item.label}</span>
            </button>
          ))}

          {currentStoreId && (
            <>
              <div className="pt-6 pb-2 px-4">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Management</span>
              </div>
              {storeMenuItems.filter(item => !item.permission || hasPermission(item.permission as Permission)).map((item) => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${location.pathname === item.path ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 hover:translate-x-1'}`}
                >
                  <item.icon size={20} className={location.pathname === item.path ? 'text-white' : 'text-gray-400'} />
                  <span className="font-bold text-sm">{item.label}</span>
                </button>
              ))}
            </>
          )}
        </div>

        <div className="p-4 mt-auto">
          <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-4 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-2xl transition-all font-black text-xs uppercase tracking-widest border border-transparent hover:border-red-100">
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-8 z-20">
          <div className="flex items-center gap-4">
            {stores.length > 1 && (
              <select 
                value={currentStoreId || ''} 
                onChange={(e) => switchStore(e.target.value)}
                className="bg-gray-100 dark:bg-gray-700 border-none rounded-lg px-4 py-1.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="" disabled>Select Store</option>
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
            {currentStore && <span className="text-sm font-black text-gray-400 uppercase tracking-[0.2em]">{currentStore.name}</span>}
          </div>

          <div className="flex items-center gap-4">
            <SyncIndicator />
            <div className="flex items-center gap-3 pl-4 border-l border-gray-200 dark:border-gray-700">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-black dark:text-white leading-tight uppercase">{user?.name}</p>
                <p className="text-[10px] font-black text-blue-500 uppercase tracking-tighter">{user?.role}</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600">
                <UserCircle size={24} />
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentStoreId, setCurrentStoreId] = useState<string | null>(null);
  const [rolePermissions, setRolePermissions] = useState<RolePermissionConfig[]>([]);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const savedStoreId = localStorage.getItem('currentStoreId');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      if (savedStoreId) setCurrentStoreId(savedStoreId);
    }
    
    const loadPermissions = async () => {
        const perms = await db.getRolePermissions();
        setRolePermissions(perms);
    };
    loadPermissions();
    window.addEventListener('db_change_global_permissions', loadPermissions);
    return () => window.removeEventListener('db_change_global_permissions', loadPermissions);
  }, []);

  useEffect(() => {
      if (user) {
          db.updateHeartbeat(user.id, currentStoreId);
          const interval = setInterval(() => db.updateHeartbeat(user.id, currentStoreId), 60000);
          return () => clearInterval(interval);
      }
  }, [user, currentStoreId]);

  const login = (u: User, storeId?: string) => {
    setUser(u);
    localStorage.setItem('user', JSON.stringify(u));
    if (storeId) {
      setCurrentStoreId(storeId);
      localStorage.setItem('currentStoreId', storeId);
    }
  };

  const logout = () => {
    if (user) db.removeSession(user.id);
    setUser(null);
    setCurrentStoreId(null);
    localStorage.removeItem('user');
    localStorage.removeItem('currentStoreId');
  };

  const switchStore = (storeId: string) => {
    setCurrentStoreId(storeId);
    localStorage.setItem('currentStoreId', storeId);
  };

  const hasPermission = (permission: Permission): boolean => {
      if (!user) return false;
      if (user.role === UserRole.SUPER_ADMIN) return true;
      const config = rolePermissions.find(p => p.role === user.role);
      return config ? config.permissions.includes(permission) : false;
  };

  const openProfile = () => {};

  return (
    <AuthContext.Provider value={{ user, currentStoreId, login, logout, switchStore, hasPermission, openProfile }}>
      <HashRouter>
        <Routes>
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
          <Route path="/" element={user ? (
              <LayoutWrapper>
                  {user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN || user.role === UserRole.MANAGER ? (
                    <Navigate to="/dashboard" />
                  ) : (
                    <Navigate to="/pos" />
                  )}
              </LayoutWrapper>
            ) : <Navigate to="/login" />} 
          />
          <Route path="/dashboard" element={user ? <LayoutWrapper><SuperAdminDashboard /></LayoutWrapper> : <Navigate to="/login" />} />
          <Route path="/users" element={user ? <LayoutWrapper><GlobalUsers /></LayoutWrapper> : <Navigate to="/login" />} />
          <Route path="/employees" element={user ? <LayoutWrapper><EmployeeManagement /></LayoutWrapper> : <Navigate to="/login" />} />
          <Route path="/pos" element={user ? <LayoutWrapper><POS /></LayoutWrapper> : <Navigate to="/login" />} />
          <Route path="/kot" element={user ? <LayoutWrapper><KOT /></LayoutWrapper> : <Navigate to="/login" />} />
          <Route path="/history" element={user ? <LayoutWrapper><StoreHistory /></LayoutWrapper> : <Navigate to="/login" />} />
          <Route path="/quotations" element={user ? <LayoutWrapper><Quotations /></LayoutWrapper> : <Navigate to="/login" />} />
          <Route path="/reports" element={user ? <LayoutWrapper><StoreReports /></LayoutWrapper> : <Navigate to="/login" />} />
          <Route path="/store/:storeId/staff" element={user ? <LayoutWrapper><StaffManagement /></LayoutWrapper> : <Navigate to="/login" />} />
          <Route path="/store/:storeId/menu" element={user ? <LayoutWrapper><StoreMenu /></LayoutWrapper> : <Navigate to="/login" />} />
          <Route path="/store/:storeId/inventory" element={user ? <LayoutWrapper><StoreInventory /></LayoutWrapper> : <Navigate to="/login" />} />
          <Route path="/store/:storeId/customers" element={user ? <LayoutWrapper><StoreCustomers /></LayoutWrapper> : <Navigate to="/login" />} />
          <Route path="/print-designer/:storeId" element={user ? <LayoutWrapper><PrintDesigner /></LayoutWrapper> : <Navigate to="/login" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </HashRouter>
    </AuthContext.Provider>
  );
}
