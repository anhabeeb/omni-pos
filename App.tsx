
import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
// @ts-ignore - Fixing missing member errors in react-router-dom
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
        if (status.status === 'DISABLED') return { icon: Database, text: 'Local', color: 'text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800' };
        switch(status.status) {
            case 'CONNECTED': return { icon: Cloud, text: 'Synced', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/10' };
            case 'SYNCING': return { icon: RefreshCw, text: `Syncing`, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/10', spin: true };
            case 'ERROR': return { icon: AlertCircle, text: 'Error', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/10' };
            default: return { icon: Cloud, text: 'Init', color: 'text-gray-500', bg: 'bg-gray-50' };
        }
    };

    const config = getStatusConfig();
    const Icon = config.icon;

    const isSchemaError = status.error?.toLowerCase().includes("sql") || 
                        status.error?.toLowerCase().includes("500") ||
                        status.error?.toLowerCase().includes("mismatch");

    return (
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-transparent transition-all group relative cursor-help ${config.bg}`}>
            <Icon size={12} className={`${config.color} ${config.spin ? 'animate-spin' : ''}`} />
            <span className={`text-[10px] font-black uppercase tracking-tight ${config.color}`}>{config.text}</span>
            
            <div className="absolute top-full right-0 mt-2 p-4 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl shadow-2xl z-[200] w-80 hidden group-hover:block animate-in fade-in slide-in-from-top-1">
                <div className="flex justify-between items-center mb-3">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Database Sync</p>
                    <button onClick={toggleSync} className={`text-[10px] font-black px-2 py-0.5 rounded transition-colors ${db.isSyncEnabled() ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                        {db.isSyncEnabled() ? 'STOP' : 'START'}
                    </button>
                </div>
                
                {db.isSyncEnabled() && (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={handleBootstrap} className="flex flex-col items-center justify-center gap-1 py-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-70">
                                <UploadCloud size={16} />
                                <span className="text-[9px] font-black uppercase">Push All</span>
                            </button>
                            <button onClick={handlePull} className="flex flex-col items-center justify-center gap-1 py-3 bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-70">
                                <CloudDownload size={16} />
                                <span className="text-[9px] font-black uppercase">Pull All</span>
                            </button>
                        </div>
                        {status.error && (
                            <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-900/30 overflow-hidden text-[10px]">
                                <p className="font-black text-red-500 uppercase mb-1">Last Error:</p>
                                <p className="text-gray-600 dark:text-gray-300 font-medium leading-tight break-words">{status.error}</p>
                                <div className="grid grid-cols-1 gap-2 mt-3">
                                    {isSchemaError && <button onClick={handleRepairSchema} className="w-full flex items-center justify-center gap-2 py-1.5 bg-red-600 text-white text-[10px] font-black uppercase rounded hover:bg-red-700 transition-colors"><Terminal size={12}/> Repair Schema</button>}
                                    <button onClick={handleSkipTask} className="w-full flex items-center justify-center gap-2 py-1.5 bg-orange-100 text-orange-700 text-[10px] font-black uppercase rounded hover:bg-orange-200 transition-colors"><FastForward size={12}/> Skip Task</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

const ProfileModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const { user, login } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!user) return;
    if (newPassword && newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    if (newPassword && !currentPassword) {
      setError('Please provide current password to update it.');
      return;
    }

    if (currentPassword && currentPassword !== user.password) {
      setError('Invalid current password.');
      return;
    }

    setIsSaving(true);
    try {
      const updatedUser = {
        ...user,
        name: name,
        password: newPassword ? newPassword : user.password
      };

      await db.updateUser(updatedUser);
      login(updatedUser); 
      setSuccess('Profile updated successfully!');
      setTimeout(() => {
        onClose();
        setSuccess('');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }, 1500);
    } catch (e: any) {
      setError('Failed to update profile: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-700">
        <div className="p-6 border-b border-gray-50 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/30">
          <h2 className="text-xl font-black dark:text-white flex items-center gap-3">
            <UserCircle className="text-blue-600" /> User Profile
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleUpdateProfile} className="p-8 space-y-6">
          {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl text-xs font-bold flex items-center gap-3 border border-red-100"><AlertCircle size={16}/> {error}</div>}
          {success && <div className="bg-green-50 text-green-600 p-4 rounded-xl text-xs font-bold flex items-center gap-3 border border-green-100"><CheckCircle size={16}/> {success}</div>}

          <div className="grid grid-cols-2 gap-4 bg-blue-50/30 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30">
             <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Username</p>
                <p className="text-sm font-mono font-bold dark:text-blue-300">@{user?.username}</p>
             </div>
             <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">System Role</p>
                <p className="text-sm font-bold dark:text-white uppercase">{user?.role}</p>
             </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Display Name</label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-3 text-gray-400" size={16} />
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border-0 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold dark:text-white" 
                required
              />
            </div>
          </div>

          <div className="pt-4 border-t dark:border-gray-700 space-y-4">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Key size={12}/> Security (Update Password)
            </h3>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Current Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 text-gray-400" size={14} />
                  <input 
                    type="password" 
                    value={currentPassword} 
                    onChange={(e) => setCurrentPassword(e.target.value)} 
                    placeholder="Verification needed to change"
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border-0 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold dark:text-white" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">New Password</label>
                  <input 
                    type="password" 
                    value={newPassword} 
                    onChange={(e) => setNewPassword(e.target.value)} 
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border-0 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold dark:text-white" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Confirm New</label>
                  <input 
                    type="password" 
                    value={confirmPassword} 
                    onChange={(e) => setConfirmPassword(e.target.value)} 
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border-0 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold dark:text-white" 
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-6 border-t dark:border-gray-700">
            <button type="button" onClick={onClose} className="flex-1 py-3 text-sm font-bold text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-2xl transition-all">Cancel</button>
            <button 
              type="submit" 
              disabled={isSaving}
              className="flex-1 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              Save Changes
            </button>
          </div>
        </form>
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
  const [isStoreMenuOpen, setIsStoreMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const storeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadStores = async () => {
      const data = await db.getStores();
      if (user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.ADMIN) setStores(data);
      else if (user) setStores(data.filter(s => user.storeIds.includes(s.id)));
    };
    loadStores();

    const handleClickOutside = (event: MouseEvent) => {
      if (storeMenuRef.current && !storeMenuRef.current.contains(event.target as Node)) {
        setIsStoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [user]);

  const globalMenuItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT] },
    { label: 'System Logs', icon: ScrollText, path: '/logs', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
    { label: 'Employee Management', icon: UserSquare, path: '/employees', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
    { label: 'User & Access Management', icon: ShieldCheck, path: '/users', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
  ];

  const getStoreActions = (storeId: number) => [
    { label: 'POS Terminal', icon: ShoppingCart, path: '/pos', permission: 'POS_ACCESS' },
    { label: 'Kitchen Tickets', icon: ChefHat, path: '/kot', permission: 'VIEW_KOT' },
    { label: 'Sales History', icon: History, path: `/store/${storeId}/history`, permission: 'VIEW_HISTORY' },
    { label: 'Quotations', icon: FileText, path: `/store/${storeId}/quotations`, permission: 'VIEW_QUOTATIONS' },
    { label: 'Reports', icon: BarChart3, path: '/reports', permission: 'VIEW_REPORTS' },
    { label: 'Customers', icon: UserCircle, path: `/store/${storeId}/customers`, permission: 'MANAGE_CUSTOMERS' },
    { label: 'Inventory', icon: Package, path: `/store/${storeId}/inventory`, permission: 'MANAGE_INVENTORY' },
    { label: 'Menu Editor', icon: MenuIcon, path: `/store/${storeId}/menu`, permission: 'MANAGE_INVENTORY' },
    { label: 'Employee Registry', icon: Users, path: `/store/${storeId}/staff`, permission: 'MANAGE_STAFF' },
    { label: 'Print Templates', icon: Printer, path: `/store/${storeId}/designer`, permission: 'MANAGE_PRINT_DESIGNER' },
  ];

  const currentStore = stores.find(s => s.id === currentStoreId);
  const storeActions = currentStoreId ? getStoreActions(currentStoreId) : [];

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
      <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
      
      {/* Primary Top Bar */}
      <header className="h-16 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6 z-50 shrink-0">
        <div className="flex items-center gap-8">
          <div className="flex flex-col cursor-pointer" onClick={() => navigate('/dashboard')}>
            <h1 className="text-xl font-black text-blue-600 italic tracking-tighter leading-none">OmniPOS</h1>
            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest mt-1">Multi-Store Suite</span>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {globalMenuItems.filter(item => !item.roles || item.roles.includes(user?.role as UserRole)).map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all text-sm font-bold whitespace-nowrap ${location.pathname === item.path ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
              >
                <item.icon size={16} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <SyncIndicator />

          <div className="h-8 w-px bg-gray-200 dark:bg-gray-800 mx-2" />

          {/* Store Switcher Dropdown */}
          <div className="relative" ref={storeMenuRef}>
            <button
              onClick={() => setIsStoreMenuOpen(!isStoreMenuOpen)}
              className={`flex items-center gap-3 px-4 py-2 rounded-2xl border transition-all ${currentStore ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'}`}
            >
              <StoreIcon size={16} />
              <span className="text-xs font-black uppercase tracking-tight max-w-[150px] truncate">
                {currentStore?.name || 'Select Store'}
              </span>
              <ChevronDown size={14} className={isStoreMenuOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>

            {isStoreMenuOpen && (
              <div className="absolute top-full right-0 mt-3 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl shadow-2xl py-3 z-[60] animate-in slide-in-from-top-2 duration-200">
                <div className="px-4 pb-2 mb-2 border-b dark:border-gray-700 flex justify-between items-center">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Your Locations</span>
                    <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{stores.length}</span>
                </div>
                <div className="max-h-80 overflow-y-auto px-2 custom-scrollbar">
                  {stores.map((store) => (
                    <button
                      key={store.id}
                      onClick={() => {
                        switchStore(store.id);
                        setIsStoreMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-all ${currentStoreId === store.id ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    >
                      <div className={`p-2 rounded-lg ${currentStoreId === store.id ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}`}>
                        <StoreIcon size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-xs font-black uppercase truncate ${currentStoreId === store.id ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>{store.name}</p>
                        <p className="text-[9px] text-gray-400 truncate mt-0.5">{store.address}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 pl-4 border-l dark:border-gray-700">
            <button 
              onClick={() => setIsProfileModalOpen(true)}
              className="group flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800 p-1.5 pr-3 rounded-2xl transition-all"
              title="View Profile"
            >
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                <UserIcon size={18} />
              </div>
              <div className="text-right hidden sm:block">
                <p className="text-[10px] font-black dark:text-white leading-tight uppercase group-hover:text-blue-600 transition-colors">{user?.name}</p>
                <p className="text-[8px] font-black text-blue-500 uppercase tracking-tighter">{user?.role}</p>
              </div>
            </button>
            <button onClick={logout} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all border border-transparent hover:border-red-100" title="Logout">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Secondary Action Bar (Contextual to selected store) */}
      {currentStoreId && (
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-2 flex items-center justify-center gap-1 z-40 shrink-0 shadow-sm overflow-x-auto custom-scrollbar-hide">
          {storeActions.filter(a => {
              if (a.permission && !hasPermission(a.permission as Permission)) return false;
              return true;
          }).map((action) => {
            const isActive = location.pathname === action.path || (action.path !== '/dashboard' && location.pathname.startsWith(action.path.split('/').slice(0, 3).join('/')));
            return (
              <button
                key={action.path}
                onClick={() => navigate(action.path)}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl transition-all whitespace-nowrap ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 scale-105' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 font-bold'}`}
              >
                <action.icon size={14} className={isActive ? 'text-white' : 'text-gray-400'} />
                <span className="text-xs font-black uppercase tracking-tight">{action.label}</span>
              </button>
            );
          })}
        </div>
      )}

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
          <Route path="/pos" element={<ProtectedRoute permission="POS_ACCESS"><Layout><POS /></Layout></ProtectedRoute>} />
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
