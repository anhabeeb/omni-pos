
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
  Mail
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
                alert("Database schema initialized and migrated! Please refresh the page to restart sync.");
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

    const handleBootstrap = async () => {
        if (!confirm("This will scan ALL local data and push missing or conflicting records to the cloud. Numerical IDs will be synchronized. Proceed?")) return;
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
        if (!confirm("This will download all data from the central server. Any unsynced local changes might be overwritten. Proceed?")) return;
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
        if (status.status === 'DISABLED') return {
            icon: Database,
            text: 'Local',
            color: 'text-gray-400',
            bg: 'bg-gray-100 dark:bg-gray-800'
        };

        switch(status.status) {
            case 'CONNECTED': return { 
                icon: Cloud, 
                text: 'Synced', 
                color: 'text-green-500', 
                bg: 'bg-green-50 dark:bg-green-900/10' 
            };
            case 'SYNCING': return { 
                icon: RefreshCw, 
                text: `Syncing`, 
                color: 'text-blue-500', 
                bg: 'bg-blue-50 dark:bg-blue-900/10',
                spin: true 
            };
            case 'TESTING': return { 
                icon: Zap, 
                text: 'Handshake', 
                color: 'text-purple-500', 
                bg: 'bg-purple-50 dark:bg-purple-900/10',
                spin: true 
            };
            case 'MOCKED': return { 
                icon: Unplug, 
                text: 'Error', 
                color: 'text-red-600', 
                bg: 'bg-red-50 dark:bg-red-900/20' 
            };
            case 'OFFLINE': return { 
                icon: CloudOff, 
                text: 'Offline', 
                color: 'text-orange-500', 
                bg: 'bg-orange-900/10' 
            };
            case 'ERROR': return { 
                icon: AlertCircle, 
                text: 'Sync Error', 
                color: 'text-red-500', 
                bg: 'bg-red-50 dark:bg-red-900/10' 
            };
            default: return { 
                icon: Cloud, 
                text: 'Init', 
                color: 'text-gray-500', 
                bg: 'bg-gray-50' 
            };
        }
    };

    const config = getStatusConfig();
    const Icon = config.icon;

    const isSchemaError = status.error?.toLowerCase().includes("sql") || 
                        status.error?.toLowerCase().includes("column") || 
                        status.error?.toLowerCase().includes("table") ||
                        status.error?.toLowerCase().includes("500");

    return (
        <div 
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-transparent transition-all group relative cursor-help ${config.bg}`}
        >
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
                                    {isSchemaError && (
                                        <button onClick={handleRepairSchema} disabled={isRepairing} className="mt-2 w-full flex items-center justify-center gap-2 py-1.5 bg-red-600 text-white text-[10px] font-black uppercase rounded hover:bg-red-700 transition-colors">
                                            {isRepairing ? <Loader2 size={12} className="animate-spin"/> : <Terminal size={12}/>} Repair DB Schema
                                        </button>
                                    )}
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

const ProfileModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const { user, login } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [email, setEmail] = useState(user?.email || '');
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
        phoneNumber: phoneNumber,
        email: email,
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

        <form onSubmit={handleUpdateProfile} className="p-8 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
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

          <div className="space-y-4">
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 text-gray-400" size={16} />
                      <input 
                        type="text" 
                        value={phoneNumber} 
                        onChange={(e) => setPhoneNumber(e.target.value)} 
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border-0 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold dark:text-white text-sm" 
                        placeholder="+960..."
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 text-gray-400" size={16} />
                      <input 
                        type="email" 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)} 
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border-0 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold dark:text-white text-sm" 
                        placeholder="email@example.com"
                      />
                    </div>
                  </div>
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

const LayoutWrapper = ({ children }: { children: React.ReactNode }) => {
  const { user, logout, currentStoreId, switchStore, hasPermission, openProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [stores, setStores] = useState<Store[]>([]);
  const [isStoreMenuOpen, setIsStoreMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const storeMenuRef = useRef<HTMLDivElement>(null);

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

    const handleClickOutside = (event: MouseEvent) => {
      if (storeMenuRef.current && !storeMenuRef.current.contains(event.target as Node)) {
        setIsStoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [user]);

  const globalMenuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT] },
    { icon: ScrollText, label: 'System Logs', path: '/logs', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
    { icon: UserSquare, label: 'Employee Management', path: '/employees', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
    { icon: ShieldCheck, label: 'User & Access Management', path: '/users', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
  ];

  const getStoreActions = (storeId: number) => [
    { icon: ShoppingCart, label: 'POS', path: '/pos', permission: 'POS_ACCESS' },
    { icon: ChefHat, label: 'Kitchen', path: '/kot', permission: 'VIEW_KOT' },
    { icon: History, label: 'History', path: '/history', permission: 'VIEW_HISTORY' },
    { icon: FileText, label: 'Quotations', path: '/quotations', permission: 'VIEW_QUOTATIONS' },
    { icon: BarChart3, label: 'Reports', path: '/reports', permission: 'VIEW_REPORTS' },
    { icon: UserCircle, label: 'Customers', path: `/store/${storeId}/customers`, permission: 'MANAGE_CUSTOMERS' },
    { icon: MenuIcon, label: 'Menu', path: `/store/${storeId}/menu`, permission: 'MANAGE_INVENTORY' },
    { icon: Users, label: 'Employee Management', path: `/store/${storeId}/staff`, permission: 'MANAGE_STAFF' },
    { icon: Printer, label: 'Designer', path: `/print-designer/${storeId}`, permission: 'MANAGE_PRINT_DESIGNER' },
  ];

  const currentStore = stores.find(s => s.id === currentStoreId);
  const storeActions = currentStoreId ? getStoreActions(currentStoreId) : [];

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
      <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
      
      <header className="h-16 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6 z-50 shrink-0">
        <div className="flex items-center gap-8">
          <div className="flex flex-col cursor-pointer" onClick={() => navigate('/')}>
            <h1 className="text-xl font-black text-blue-600 tracking-tighter italic leading-none">OmniPOS</h1>
            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest mt-1">Multi-Store Suite</span>
          </div>

          <nav className="flex items-center gap-1">
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

          <div className="flex items-center gap-3 pl-4">
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

      {currentStoreId && (
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-2 flex items-center justify-center gap-1 z-40 shrink-0 shadow-sm overflow-x-auto custom-scrollbar-hide">
          {storeActions.filter(a => {
              if (a.permission && !hasPermission(a.permission as Permission)) return false;
              return true;
          }).map((action) => (
            <button
              key={action.path}
              onClick={() => navigate(action.path)}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl transition-all whitespace-nowrap ${location.pathname === action.path ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 scale-105' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 font-bold'}`}
            >
              <action.icon size={14} className={location.pathname === action.path ? 'text-white' : 'text-gray-400'} />
              <span className="text-xs font-black uppercase tracking-tight">{action.label}</span>
            </button>
          ))}
        </div>
      )}

      <main className="flex-1 overflow-hidden p-6">
        <div className="h-full max-w-[1600px] mx-auto overflow-y-auto custom-scrollbar pr-2">
            {children}
        </div>
      </main>
    </div>
  );
};

// Main App component with routing and auth provider
const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentStoreId, setCurrentStoreId] = useState<number | null>(null);
  const [rolePermissions, setRolePermissions] = useState<RolePermissionConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const savedUser = localStorage.getItem('user');
      const savedStoreId = localStorage.getItem('currentStoreId');
      
      if (savedUser) {
        try {
          const parsedUser = JSON.parse(savedUser);
          setUser(parsedUser);
          
          if (savedStoreId) {
            setCurrentStoreId(Number(savedStoreId));
          }
          
          // Verify session heartbeat
          db.updateHeartbeat(parsedUser.id, savedStoreId ? Number(savedStoreId) : null);
        } catch (e) {
          console.error("Failed to restore session", e);
          localStorage.removeItem('user');
          localStorage.removeItem('currentStoreId');
        }
      }
      
      const perms = await db.getRolePermissions();
      setRolePermissions(perms);
      setIsLoading(false);
    };

    initAuth();
    
    const handlePermChange = async () => {
      const perms = await db.getRolePermissions();
      setRolePermissions(perms);
    };
    
    window.addEventListener('db_change_global_permissions', handlePermChange);
    return () => window.removeEventListener('db_change_global_permissions', handlePermChange);
  }, []);

  const login = (u: User, storeId?: number) => {
    setUser(u);
    localStorage.setItem('user', JSON.stringify(u));
    if (storeId) {
      setCurrentStoreId(storeId);
      localStorage.setItem('currentStoreId', storeId.toString());
    }
    db.updateHeartbeat(u.id, storeId || null);
  };

  const logout = async () => {
    if (user) {
      await db.removeSession(user.id);
    }
    setUser(null);
    setCurrentStoreId(null);
    localStorage.removeItem('user');
    localStorage.removeItem('currentStoreId');
  };

  const switchStore = (storeId: number) => {
    setCurrentStoreId(storeId);
    localStorage.setItem('currentStoreId', storeId.toString());
    if (user) {
      db.updateHeartbeat(user.id, storeId);
    }
  };

  const hasPermission = (permission: Permission) => {
    if (!user) return false;
    if (user.role === UserRole.SUPER_ADMIN) return true;
    const config = rolePermissions.find(rp => rp.role === user.role);
    return config?.permissions.includes(permission) || false;
  };

  const openProfile = () => {
    // LayoutWrapper handles its own modal state internally
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Loader2 size={40} className="text-blue-600 animate-spin mb-4" />
        <p className="text-gray-500 font-bold animate-pulse uppercase tracking-widest text-[10px]">Initializing System...</p>
      </div>
    );
  }

  const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: UserRole[] }) => {
    if (!user) {
      return <Navigate to="/login" replace />;
    }
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      return <Navigate to="/" replace />;
    }
    return <LayoutWrapper>{children}</LayoutWrapper>;
  };

  return (
    <AuthContext.Provider value={{ user, currentStoreId, login, logout, switchStore, hasPermission, openProfile }}>
      <HashRouter>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
          
          <Route path="/" element={
            <ProtectedRoute>
              {user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.ADMIN ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <Navigate to="/pos" replace />
              )}
            </ProtectedRoute>
          } />

          <Route path="/dashboard" element={<ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT]}><SuperAdminDashboard /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.ADMIN]}><GlobalUsers /></ProtectedRoute>} />
          <Route path="/employees" element={<ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.ADMIN]}><EmployeeManagement /></ProtectedRoute>} />
          <Route path="/logs" element={<ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.ADMIN]}><SystemLogs /></ProtectedRoute>} />
          
          <Route path="/store/:storeId/staff" element={<ProtectedRoute><StaffManagement /></ProtectedRoute>} />
          <Route path="/store/:storeId/menu" element={<ProtectedRoute><StoreMenu /></ProtectedRoute>} />
          <Route path="/store/:storeId/customers" element={<ProtectedRoute><StoreCustomers /></ProtectedRoute>} />
          
          <Route path="/pos" element={<ProtectedRoute><POS /></ProtectedRoute>} />
          <Route path="/kot" element={<ProtectedRoute><KOT /></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute><StoreHistory /></ProtectedRoute>} />
          <Route path="/quotations" element={<ProtectedRoute><Quotations /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><StoreReports /></ProtectedRoute>} />
          <Route path="/print-designer/:storeId" element={<ProtectedRoute><PrintDesigner /></ProtectedRoute>} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthContext.Provider>
  );
};

export default App;
