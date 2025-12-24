
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
    const [diagResult, setDiagResult] = useState<{success: boolean, message: string, hint?: string, is404?: boolean, trace?: string} | null>(null);
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
        setDiagResult(null);
        try {
            const res = await db.verifyWriteAccess();
            setDiagResult(res as any);
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
            const result = await response.json().catch(() => ({ success: false, error: "Cloud connection timed out or failed to return valid JSON." }));
            if (result.success) {
                alert("Database schema verified and migrated! Sync will restart.");
                window.location.reload();
            } else {
                alert("Repair failed: " + (result.error || "Unknown server error"));
            }
        } catch (e: any) {
            alert("Connection error during repair: " + e.message);
        } finally {
            setIsRepairing(false);
        }
    };

    const handleClearQueue = () => {
        if (confirm("This will delete all PENDING outgoing syncs from this device. Local data remains unchanged, but recent changes might not reach the server. Proceed?")) {
            db.clearSyncQueue();
        }
    };

    const handleSkipTask = () => {
        if (confirm("Skip the currently failing task? This might cause data inconsistency if the record is important.")) {
            db.skipFailedTask();
        }
    };

    const handleBootstrap = async () => {
        if (!confirm("This will scan ALL local data and push missing or conflicting records to the cloud. Proceed?")) return;
        setIsBootstrapping(true);
        setSyncMessage("Resolving Conflicts...");
        try {
            const ok = await db.testConnection();
            if (!ok) {
                alert("Sync failed: Cloud backend is offline.");
                return;
            }
            await db.syncAllLocalToCloud();
            setSyncMessage("Queued!");
            setTimeout(() => {
                setSyncMessage(null);
                setIsBootstrapping(false);
            }, 2000);
        } catch (e: any) {
            alert("Error during sync: " + e.message);
            setIsBootstrapping(false);
            setSyncMessage(null);
        }
    };

    const handlePull = async () => {
        if (!confirm("This will download all data from the central server. Proceed?")) return;
        setIsPulling(true);
        setSyncMessage("Downloading Cloud Data...");
        try {
            const ok = await db.pullAllFromCloud();
            if (ok) {
                setSyncMessage("Hydration Complete!");
                setTimeout(() => window.location.reload(), 1000);
            } else {
                alert("Hydration failed. Check your connection.");
            }
        } finally {
            setIsPulling(false);
            setSyncMessage(null);
        }
    };

    const toggleSync = () => {
        const current = db.isSyncEnabled();
        db.setSyncEnabled(!current);
    };

    const getStatusConfig = () => {
        if (status.status === 'DISABLED') return { icon: Database, text: 'Local', color: 'text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800' };
        switch(status.status) {
            case 'CONNECTED': return { icon: Cloud, text: 'Synced', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/10' };
            case 'SYNCING': return { icon: RefreshCw, text: `Syncing`, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/10', spin: true };
            case 'TESTING': return { icon: Zap, text: 'Handshake', color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/10', spin: true };
            case 'MOCKED': return { icon: Unplug, text: 'Error', color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' };
            case 'OFFLINE': return { icon: CloudOff, text: 'Offline', color: 'text-orange-500', bg: 'bg-orange-900/10' };
            case 'ERROR': return { icon: AlertCircle, text: 'Sync Error', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/10' };
            default: return { icon: Cloud, text: 'Init', color: 'text-gray-500', bg: 'bg-gray-50' };
        }
    };

    const config = getStatusConfig();
    const Icon = config.icon;

    const isSchemaError = status.error?.toLowerCase().includes("sql") || 
                        status.error?.toLowerCase().includes("column") || 
                        status.error?.toLowerCase().includes("table") ||
                        status.error?.toLowerCase().includes("500") ||
                        status.error?.toLowerCase().includes("mismatch");

    return (
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-transparent transition-all group relative cursor-help ${config.bg}`}>
            <Icon size={12} className={`${config.color} ${config.spin ? 'animate-spin' : ''}`} />
            <span className={`text-[10px] font-black uppercase tracking-tight ${config.color}`}>{config.text}</span>
            
            <div className="absolute top-full right-0 mt-3 p-4 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-2xl shadow-2xl z-[100] w-80 hidden group-hover:block animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="flex justify-between items-center mb-4">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Database Sync</p>
                    <button 
                        onClick={(e) => { e.stopPropagation(); toggleSync(); }}
                        className={`text-[10px] font-black px-2 py-1 rounded transition-colors ${db.isSyncEnabled() ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                    >
                        {db.isSyncEnabled() ? 'STOP' : 'START'}
                    </button>
                </div>
                
                <div className="space-y-3">
                    {!db.isSyncEnabled() ? (
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-700 text-center">
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">Local-First Mode Active</p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={handleBootstrap} disabled={isBootstrapping || isPulling} className="flex flex-col items-center justify-center gap-1 py-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-70">
                                    {isBootstrapping ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                                    <span className="text-[9px] font-black uppercase">Push All</span>
                                </button>
                                <button onClick={handlePull} disabled={isPulling || isBootstrapping} className="flex flex-col items-center justify-center gap-1 py-3 bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-70">
                                    {isPulling ? <Loader2 size={16} className="animate-spin" /> : <CloudDownload size={16} />}
                                    <span className="text-[9px] font-black uppercase">Pull All</span>
                                </button>
                            </div>
                            
                            {syncMessage && <p className="text-[9px] text-center text-blue-600 font-black uppercase italic animate-pulse">{syncMessage}</p>}

                            {status.error && (
                                <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-900/30 overflow-hidden">
                                    <p className="text-[10px] font-black text-red-500 uppercase mb-1">Last Error:</p>
                                    <p className="text-[11px] text-gray-600 dark:text-gray-300 font-medium leading-tight break-words">{status.error}</p>
                                    
                                    <div className="grid grid-cols-1 gap-2 mt-3">
                                        {isSchemaError && (
                                            <button onClick={handleRepairSchema} disabled={isRepairing} className="w-full flex items-center justify-center gap-2 py-1.5 bg-red-600 text-white text-[10px] font-black uppercase rounded hover:bg-red-700 transition-colors">
                                                {isRepairing ? <Loader2 size={12} className="animate-spin"/> : <Terminal size={12}/>} Repair DB Schema
                                            </button>
                                        )}
                                        <button onClick={handleSkipTask} className="w-full flex items-center justify-center gap-2 py-1.5 bg-orange-100 text-orange-700 text-[10px] font-black uppercase rounded hover:bg-orange-200 transition-colors">
                                            <FastForward size={12}/> Skip This Task
                                        </button>
                                        <button onClick={handleClearQueue} className="w-full flex items-center justify-center gap-2 py-1.5 bg-gray-100 text-gray-700 text-[10px] font-black uppercase rounded hover:bg-gray-200 transition-colors">
                                            <Eraser size={12}/> Clear Pending Queue
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-2 border-t dark:border-gray-700 pt-3">
                                <button onClick={(e) => { e.stopPropagation(); db.testConnection(); }} className="flex-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-[9px] font-black uppercase rounded hover:bg-gray-200 transition-colors">Ping</button>
                                <button onClick={(e) => { e.stopPropagation(); runDiagnostic(); }} disabled={isTesting} className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-[9px] font-black uppercase rounded hover:bg-blue-700 flex items-center justify-center gap-1">
                                    {isTesting ? <Loader2 size={10} className="animate-spin"/> : <Settings2 size={10}/>} Diag
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const ProtectedRoute = ({ children, permission }: { children: React.ReactNode, permission?: Permission }) => {
  const { user, hasPermission } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (permission && !hasPermission(permission)) {
    return <div className="p-8 text-center text-red-500 font-bold">Access Denied: Missing Permission {permission}</div>;
  }

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
      if (user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.ADMIN) {
          setStores(data);
      } else if (user) {
          setStores(data.filter(s => user.storeIds.includes(s.id)));
      }
    };
    loadStores();
  }, [user]);

  const sidebarItems = [
    { label: 'Global Overview', icon: LayoutDashboard, path: '/dashboard', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
    { label: 'POS Terminal', icon: ShoppingCart, path: '/pos', permission: 'POS_ACCESS' },
    { label: 'Kitchen Tickets', icon: ChefHat, path: '/kot', permission: 'VIEW_KOT' },
    { label: 'Inventory', icon: Package, path: currentStoreId ? `/store/${currentStoreId}/inventory` : null, permission: 'MANAGE_INVENTORY' },
    { label: 'Menu Editor', icon: MenuIcon, path: currentStoreId ? `/store/${currentStoreId}/menu` : null, permission: 'MANAGE_INVENTORY' },
    { label: 'Customers', icon: UserSquare, path: currentStoreId ? `/store/${currentStoreId}/customers` : null, permission: 'MANAGE_CUSTOMERS' },
    { label: 'Sales History', icon: History, path: currentStoreId ? `/store/${currentStoreId}/history` : null, permission: 'VIEW_HISTORY' },
    { label: 'Quotations', icon: FileText, path: currentStoreId ? `/store/${currentStoreId}/quotations` : null, permission: 'VIEW_QUOTATIONS' },
    { label: 'Reports', icon: BarChart3, path: '/reports', permission: 'VIEW_REPORTS' },
    { label: 'User Accounts', icon: Lock, path: '/users', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
    { label: 'Employee Registry', icon: UserCircle, path: '/employees', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
    { label: 'Audit Logs', icon: ScrollText, path: '/logs', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
    { label: 'Print Templates', icon: Printer, path: currentStoreId ? `/store/${currentStoreId}/designer` : null, permission: 'MANAGE_PRINT_DESIGNER' },
  ];

  const currentStore = stores.find(s => s.id === currentStoreId);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col shrink-0">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
          <h1 className="text-xl font-black text-blue-600 italic tracking-tighter">OmniPOS</h1>
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">Enterprise Solution</p>
        </div>

        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Location Context</label>
          <select 
            value={currentStoreId || ''} 
            onChange={(e) => switchStore(Number(e.target.value))}
            className="w-full p-2 text-xs font-bold bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="" disabled>Select Store...</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
          {sidebarItems.map((item, idx) => {
            if (item.path === null) return null;
            const hasRole = !item.roles || item.roles.includes(user?.role as UserRole);
            const hasPerm = !item.permission || hasPermission(item.permission as Permission);
            if (!hasRole || !hasPerm) return null;

            const isActive = location.pathname.startsWith(item.path);
            return (
              <button 
                key={idx}
                onClick={() => navigate(item.path!)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              >
                <item.icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100 dark:border-gray-700">
            <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all">
              <LogOut size={18} /> Sign Out
            </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-8 shrink-0">
            <div className="flex items-center gap-4">
                {currentStore && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-full border border-blue-100 dark:border-blue-800">
                        <StoreIcon size={14} className="text-blue-600" />
                        <span className="text-xs font-black text-blue-700 dark:text-blue-300 uppercase">{currentStore.name}</span>
                    </div>
                )}
            </div>
            <div className="flex items-center gap-6">
                <SyncIndicator />
                <div className="flex items-center gap-3 pl-6 border-l dark:border-gray-700">
                    <div className="text-right hidden sm:block">
                        <p className="text-xs font-black text-gray-900 dark:text-white uppercase leading-tight">{user?.name}</p>
                        <p className="text-[9px] font-bold text-blue-600 uppercase tracking-widest">{user?.role}</p>
                    </div>
                    <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center text-gray-400 border border-gray-200 dark:border-gray-600">
                        <UserIcon size={20} />
                    </div>
                </div>
            </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8 bg-gray-50 dark:bg-gray-950 custom-scrollbar">
          {children}
        </main>
      </div>
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
      // Global Activity Heartbeat
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
    db.logActivity({
        storeId: storeId || null,
        userId: u.id,
        userName: u.name,
        action: 'LOGIN',
        description: `User ${u.username} signed in successfully.`
    });
  };

  const logout = async () => {
    if (user) {
        await db.removeSession(user.id);
        db.logActivity({
            storeId: currentStoreId,
            userId: user.id,
            userName: user.name,
            action: 'LOGOUT',
            description: `User ${user.username} signed out.`
        });
    }
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

  if (isLoading) {
      return (
          <div className="h-screen w-screen flex flex-col items-center justify-center bg-white">
              <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
              <p className="font-black uppercase tracking-[0.4em] text-gray-400 text-[10px]">Initializing Session</p>
          </div>
      );
  }

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
