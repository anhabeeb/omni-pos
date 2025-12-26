import React, { useState, useEffect, useRef } from 'react';
// @ts-ignore - Fixing missing member errors in react-router-dom
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { User, UserRole, Store, Permission, RolePermissionConfig } from './types';
import { db, SyncStatus } from './services/db';
import { AuthContext, AuthContextType } from './AuthContext';
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
  FileText,
  UserCircle,
  AlertCircle,
  CheckCircle,
  Loader2,
  Cloud,
  RefreshCw,
  Package,
  Globe,
  Terminal,
  Activity,
  ShieldCheck,
  UploadCloud,
  CloudDownload,
  X,
  Lock,
  User as UserIcon,
  Save,
  Key,
  ScrollText,
  Phone,
  Mail,
  FastForward,
  Hash
} from 'lucide-react';

import { useAuth } from './AuthContext';
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
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-700">
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

  const loadStores = async () => {
    const data = await db.getStores();
    if (user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.ADMIN) setStores(data);
    else if (user) setStores(data.filter(s => user.storeIds.includes(s.id)));
  };

  useEffect(() => {
    loadStores();
    
    const handleDbChange = () => loadStores();
    window.addEventListener('db_change_any', handleDbChange);
    
    const handleClickOutside = (event: MouseEvent) => {
      if (storeMenuRef.current && !storeMenuRef.current.contains(event.target as Node)) {
        setIsStoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
        window.removeEventListener('db_change_any', handleDbChange);
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [user]);

  const globalMenuItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', permission: 'VIEW_REPORTS' as Permission },
    { label: 'System Logs', icon: ScrollText, path: '/logs', permission: 'VIEW_LOGS' as Permission },
    { label: 'Employee Management', icon: UserSquare, path: '/employees', permission: 'MANAGE_STAFF' as Permission },
    { label: 'User & Access Management', icon: ShieldCheck, path: '/users', permission: 'MANAGE_STAFF' as Permission },
  ];

  const currentStore = stores.find(s => s.id === currentStoreId);

  const getStoreActions = (store: Store | undefined) => {
    if (!store) return [];
    
    const actions = [
      { label: 'POS Terminal', icon: ShoppingCart, path: '/pos', permission: 'POS_ACCESS' },
      { label: 'KOT', icon: ChefHat, path: '/kot', permission: 'VIEW_KOT', featureFlag: 'useKOT' },
      { label: 'Sales History', icon: History, path: `/store/${store.id}/history`, permission: 'VIEW_HISTORY' },
      { label: 'Quotations', icon: FileText, path: `/store/${store.id}/quotations`, permission: 'VIEW_QUOTATIONS' },
      { label: 'Reports', icon: BarChart3, path: '/reports', permission: 'VIEW_REPORTS' },
      { label: 'Customers', icon: UserCircle, path: `/store/${store.id}/customers`, permission: 'MANAGE_CUSTOMERS' },
      { label: 'Inventory', icon: Package, path: `/store/${store.id}/inventory`, permission: 'MANAGE_INVENTORY', featureFlag: 'useInventory' },
      { label: 'Menu', icon: MenuIcon, path: `/store/${store.id}/menu`, permission: 'MANAGE_INVENTORY' },
      { label: 'Users', icon: Users, path: `/store/${store.id}/staff`, permission: 'MANAGE_STAFF' },
      { label: 'Print Templates', icon: Printer, path: `/store/${store.id}/designer`, permission: 'MANAGE_PRINT_DESIGNER' },
    ];

    return actions.filter(action => {
        if (!action.featureFlag) return true;
        // Robust check for false/0 (disabled) while allowing undefined/null/true/1 to show by default
        // @ts-ignore
        const val = store[action.featureFlag];
        if (val === false || val === 0 || val === '0') return false;
        return true;
    });
  };

  const storeActions = getStoreActions(currentStore);

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
      <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
      
      <header className="h-16 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6 z-50 shrink-0">
        <div className="flex items-center gap-8">
          <div className="flex flex-col cursor-pointer" onClick={() => navigate('/dashboard')}>
            <h1 className="text-xl font-black text-blue-600 italic tracking-tighter leading-none">OmniPOS</h1>
            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest mt-1">Multi-Store Suite</span>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {globalMenuItems.filter(item => hasPermission(item.permission)).map((item) => (
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
          <div className="relative group">
            <Cloud size={18} className="text-gray-400" />
          </div>

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

      {currentStoreId && (
        <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 px-6 py-2.5 flex items-center justify-start lg:justify-center gap-2 z-40 shrink-0 shadow-sm overflow-x-auto custom-scrollbar-hide scroll-smooth">
          {storeActions.filter(a => {
              if (a.permission && !hasPermission(a.permission as Permission)) return false;
              return true;
          }).map((action) => {
            const isActive = location.pathname === action.path || (action.path !== '/' && location.pathname.startsWith(action.path));
            return (
              <button
                key={action.path}
                onClick={() => navigate(action.path)}
                className={`flex items-center gap-2.5 px-4 py-2 rounded-xl transition-all whitespace-nowrap group ${isActive ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent font-bold'}`}
              >
                <action.icon size={16} className={isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 group-hover:text-gray-600 transition-colors'} />
                <span className="text-xs font-black uppercase tracking-tight">{action.label}</span>
              </button>
            );
          })}
        </div>
      )}

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
      const beat = () => db.updateHeartbeat(user, currentStoreId);
      beat();
      const interval = setInterval(beat, 25000); // Heartbeat slightly faster than cloud expiry
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