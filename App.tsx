
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
  Menu,
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
  RefreshCw
} from 'lucide-react';

import Login from './pages/Login';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import GlobalUsers from './pages/GlobalUsers';
import StaffManagement from './pages/StaffManagement';
import StoreMenu from './pages/StoreMenu';
import StoreCustomers from './pages/StoreCustomers';
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
    const [status, setStatus] = useState<{ status: SyncStatus, pendingCount: number }>(db.getSyncStatus());

    useEffect(() => {
        const handleSyncUpdate = (e: any) => {
            setStatus(e.detail);
        };
        window.addEventListener('db_sync_update', handleSyncUpdate);
        return () => window.removeEventListener('db_sync_update', handleSyncUpdate);
    }, []);

    const getStatusConfig = () => {
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
            case 'OFFLINE': return { 
                icon: CloudOff, 
                text: status.pendingCount > 0 ? `${status.pendingCount} Unsynced` : 'Offline Mode', 
                color: 'text-orange-500', 
                bg: 'bg-orange-50 dark:bg-orange-900/10' 
            };
            case 'ERROR': return { 
                icon: AlertCircle, 
                text: 'Sync Error', 
                color: 'text-red-500', 
                bg: 'bg-red-50 dark:bg-red-900/10' 
            };
        }
    };

    const config = getStatusConfig();
    const Icon = config.icon;

    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border border-transparent transition-all ${config.bg}`}>
            <Icon size={14} className={`${config.color} ${config.spin ? 'animate-spin' : ''}`} />
            <span className={`text-[10px] font-black uppercase tracking-wider ${config.color}`}>{config.text}</span>
        </div>
    );
};

const ProfileModal = ({ isOpen, onClose, user }: { isOpen: boolean, onClose: () => void, user: User }) => {
    const [employee, setEmployee] = useState<Employee | null>(null);
    const [formData, setFormData] = useState({
        phoneNumber: '',
        emergencyContactPerson: '',
        emergencyRelation: '',
        emergencyContactNumber: '',
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        const load = async () => {
            if (isOpen && user) {
                const emps = await db.getEmployees();
                const emp = emps.find(e => e.empId === user.username);
                if (emp) {
                    setEmployee(emp);
                    setFormData({
                        phoneNumber: emp.phoneNumber,
                        emergencyContactPerson: emp.emergencyContactPerson,
                        emergencyRelation: emp.emergencyRelation,
                        emergencyContactNumber: emp.emergencyContactNumber,
                        password: '',
                        confirmPassword: ''
                    });
                }
                setError('');
                setSuccess('');
            }
        };
        load();
    }, [isOpen, user]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (formData.password && formData.password !== formData.confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        try {
            if (employee) {
                await db.updateEmployee({
                    ...employee,
                    phoneNumber: formData.phoneNumber,
                    emergencyContactPerson: formData.emergencyContactPerson,
                    emergencyRelation: formData.emergencyRelation,
                    emergencyContactNumber: formData.emergencyContactNumber
                });
            }
            
            const updatedUser = { ...user };
            if (formData.password) {
                updatedUser.password = formData.password;
            }
            await db.updateUser(updatedUser);
            
            setSuccess("Profile updated successfully.");
            setTimeout(onClose, 1500);
        } catch (err) {
            setError("Failed to update profile.");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                    <h2 className="text-xl font-bold flex items-center gap-2 dark:text-white">
                        <UserCircle className="text-blue-600" />
                        Account Profile
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                    {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl border flex items-center gap-3 text-sm font-medium"><AlertCircle size={18} /> {error}</div>}
                    {success && <div className="bg-blue-50 text-blue-600 p-3 rounded-xl border flex items-center gap-3 text-sm font-medium"><CheckCircle size={18} /> {success}</div>}
                    
                    <div className="space-y-4">
                        <h3 className="text-xs uppercase font-black text-gray-400 tracking-widest border-b dark:border-gray-700 pb-2">Identity</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border dark:border-gray-700">
                                <p className="text-[10px] uppercase font-bold text-gray-400">Account Name</p>
                                <p className="font-bold dark:text-white">{user.name}</p>
                            </div>
                            <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border dark:border-gray-700">
                                <p className="text-[10px] uppercase font-bold text-gray-400">System Username</p>
                                <p className="font-mono font-bold dark:text-blue-400">@{user.username}</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-xs uppercase font-black text-blue-600 tracking-widest border-b dark:border-gray-700 pb-2 flex items-center gap-2">
                            <Lock size={14} /> Security Credentials
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase mb-1 ml-1">New Password</label>
                                <input 
                                    type="password" 
                                    placeholder="Leave blank to keep current" 
                                    className="w-full p-3 border dark:border-gray-700 rounded-xl bg-white dark:bg-gray-700 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.password}
                                    onChange={e => setFormData({...formData, password: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase mb-1 ml-1">Confirm Password</label>
                                <input 
                                    type="password" 
                                    placeholder="Verify new password" 
                                    className="w-full p-3 border dark:border-gray-700 rounded-xl bg-white dark:bg-gray-700 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.confirmPassword}
                                    onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-xs uppercase font-black text-gray-400 tracking-widest border-b dark:border-gray-700 pb-2 flex items-center gap-2">
                            <Phone size={14} /> Contact Information
                        </h3>
                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase mb-1 ml-1">Personal Phone</label>
                            <input 
                                type="text" 
                                className="w-full p-3 border dark:border-gray-700 rounded-xl bg-white dark:bg-gray-700 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                value={formData.phoneNumber}
                                onChange={e => setFormData({...formData, phoneNumber: e.target.value})}
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase mb-1 ml-1">Emergency Contact Person</label>
                                <input 
                                    type="text" 
                                    className="w-full p-3 border dark:border-gray-700 rounded-xl bg-white dark:bg-gray-700 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.emergencyContactPerson}
                                    onChange={e => setFormData({...formData, emergencyContactPerson: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase mb-1 ml-1">Relation</label>
                                <input 
                                    type="text" 
                                    className="w-full p-3 border dark:border-gray-700 rounded-xl bg-white dark:bg-gray-700 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.emergencyRelation}
                                    onChange={e => setFormData({...formData, emergencyRelation: e.target.value})}
                                />
                            </div>
                        </div>
                    </div>
                </form>
                <div className="p-6 border-t flex justify-end gap-3 bg-gray-50 dark:bg-gray-900/50">
                    <button type="button" onClick={onClose} className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors">Cancel</button>
                    <button onClick={handleSave} className="px-8 py-2.5 bg-blue-600 text-white rounded-xl shadow-lg hover:bg-blue-700 font-bold transition-all active:scale-95">Update Profile</button>
                </div>
            </div>
        </div>
    );
};

const Sidebar = ({ 
    user, 
    currentStoreId, 
    onLogout, 
    hasPermission, 
    isOpen, 
    setIsOpen,
    onProfileClick
}: { 
    user: User; 
    currentStoreId: string | null; 
    onLogout: () => void; 
    hasPermission: (p: Permission) => boolean;
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    onProfileClick: () => void;
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { switchStore } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);

  useEffect(() => {
    const load = async () => {
        const s = await db.getStores();
        setStores(s);
    };
    load();
    window.addEventListener('db_change_global_stores', load);
    return () => window.removeEventListener('db_change_global_stores', load);
  }, []);

  const accessibleStores = (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN)
      ? stores
      : stores.filter(s => user.storeIds.includes(s.id));

  const [expandedStoreIds, setExpandedStoreIds] = useState<string[]>([]);
  const [expandedReportIds, setExpandedReportIds] = useState<string[]>([]);

  useEffect(() => {
      if (currentStoreId && !expandedStoreIds.includes(currentStoreId)) {
          setExpandedStoreIds([currentStoreId]);
      }
  }, [currentStoreId]);

  const toggleStore = (id: string) => {
    setExpandedStoreIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [id]);
  };

  const toggleReports = (storeId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setExpandedReportIds(prev => prev.includes(storeId) ? prev.filter(x => x !== storeId) : [...prev, storeId]);
  };

  const handleNavigation = (storeId: string, path: string) => {
      if (storeId && currentStoreId !== storeId) switchStore(storeId);
      navigate(path);
      if (window.innerWidth < 768) setIsOpen(false);
  };

  const NavItem = ({ icon: Icon, label, onClick, isActive, nested }: any) => (
      <button
          onClick={onClick}
          className={`flex items-center w-full rounded-xl transition-all mb-1 px-3 py-2 h-10 ${isActive ? 'bg-blue-600 shadow-md text-white' : 'hover:bg-blue-50 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400'}`}
      >
          <Icon size={18} className="flex-shrink-0" />
          <span className={`ml-3 text-sm font-medium whitespace-nowrap ${nested ? 'text-xs opacity-80' : ''}`}>{label}</span>
      </button>
  );

  const renderStoreMenu = (storeId: string) => {
      const isReportsExpanded = expandedReportIds.includes(storeId);
      const isActiveStore = currentStoreId === storeId; 
      return (
        <div className="space-y-0.5 mt-2">
            {hasPermission('POS_ACCESS') && <NavItem icon={ShoppingCart} label="POS" onClick={() => handleNavigation(storeId, '/pos')} isActive={isActiveStore && location.pathname === '/pos'} />}
            {hasPermission('VIEW_KOT') && <NavItem icon={ChefHat} label="Kitchen" onClick={() => handleNavigation(storeId, '/kot')} isActive={isActiveStore && location.pathname === '/kot'} />}
            {hasPermission('VIEW_REPORTS') && (
                <div>
                    <button onClick={(e) => toggleReports(storeId, e)} className={`flex items-center w-full rounded-xl px-3 py-2 justify-between hover:bg-blue-50 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400`}>
                        <div className="flex items-center"><BarChart3 size={18} /><span className="ml-3 text-sm font-medium">Reports</span></div>
                        <ChevronDown size={14} className={`transition-transform ${isReportsExpanded ? 'rotate-180' : ''}`} />
                    </button>
                    {isReportsExpanded && (
                        <div className="ml-4 pl-3 border-l border-blue-200 dark:border-blue-900 mb-2">
                            <NavItem icon={CalendarCheck} nested label="EOD" onClick={() => handleNavigation(storeId, '/reports?view=EOD')} isActive={isActiveStore && location.search.includes('EOD')} />
                            <NavItem icon={Circle} nested label="Analytics" onClick={() => handleNavigation(storeId, '/reports?view=SUMMARY')} isActive={isActiveStore && location.search.includes('SUMMARY')} />
                        </div>
                    )}
                </div>
            )}
            <NavItem icon={History} label="History" onClick={() => handleNavigation(storeId, `/store/${storeId}/history`)} isActive={location.pathname.includes(`/history`)} />
            <NavItem icon={MenuIcon} label="Menu" onClick={() => handleNavigation(storeId, `/store/${storeId}/menu`)} isActive={location.pathname.includes(`/menu`)} />
            <NavItem icon={FileText} label="Quotes" onClick={() => handleNavigation(storeId, `/store/${storeId}/quotations`)} isActive={location.pathname.includes(`/quotations`)} />
            {hasPermission('MANAGE_CUSTOMERS') && <NavItem icon={UserSquare} label="Customers" onClick={() => handleNavigation(storeId, `/store/${storeId}/customers`)} isActive={location.pathname.includes(`/customers`)} />}
            <NavItem icon={Users} label="Staff" onClick={() => handleNavigation(storeId, `/store/${storeId}/staff`)} isActive={location.pathname.includes(`/staff`)} />
            {hasPermission('MANAGE_PRINT_DESIGNER') && <NavItem icon={Printer} label="Printer" onClick={() => handleNavigation(storeId, `/store/${storeId}/print-designer`)} isActive={location.pathname.includes(`/print-designer`)} />}
        </div>
      );
  };

  return (
    <>
        {isOpen && <div className="fixed inset-0 bg-black/30 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsOpen(false)} />}
        <div className={`bg-white dark:bg-gray-800 border-r dark:border-gray-700 h-screen flex flex-col fixed left-0 top-0 z-50 transition-all duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 w-64`}>
            <div className="flex items-center h-16 border-b dark:border-gray-700 px-6 justify-between">
                <div className="flex items-center cursor-pointer" onClick={() => navigate('/dashboard')}>
                    <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg"><Layout size={20} className="text-white" /></div>
                    <span className="ml-3 text-lg font-bold dark:text-white">Omni<span className="text-blue-600">POS</span></span>
                </div>
                <button onClick={() => setIsOpen(false)} className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><X size={20} className="dark:text-white"/></button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar pt-6 px-4">
                <button onClick={onProfileClick} className="mb-8 flex items-center w-full hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded-xl">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 flex items-center justify-center font-bold">{user.name.charAt(0)}</div>
                    <div className="ml-3 overflow-hidden text-left"><p className="text-sm font-semibold truncate dark:text-white">{user.name}</p><p className="text-[10px] uppercase font-bold text-blue-600 opacity-70">@{user.username}</p></div>
                </button>
                { (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN) && (
                    <div className="mb-6">
                        <p className="px-3 text-[10px] uppercase font-bold text-gray-400 tracking-widest mb-3">Admin</p>
                        <NavItem icon={LayoutDashboard} label="Global Dashboard" onClick={() => handleNavigation('', '/dashboard')} isActive={location.pathname === '/dashboard'} />
                        <NavItem icon={IdCard} label="Employee Management" onClick={() => handleNavigation('', '/employees')} isActive={location.pathname === '/employees'} />
                        <NavItem icon={Users} label="User & Access Management" onClick={() => handleNavigation('', '/global-users')} isActive={location.pathname === '/global-users'} />
                    </div>
                )}
                <div className="space-y-1">
                    <p className="px-3 text-[10px] uppercase font-bold text-gray-400 tracking-widest mb-3">Units</p>
                    {accessibleStores.map(store => (
                        <div key={store.id} className="mb-2">
                            <button onClick={() => toggleStore(store.id)} className={`flex items-center w-full rounded-xl px-3 py-2.5 justify-between ${currentStoreId === store.id ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                                <div className="flex items-center min-w-0"><div className={`p-1.5 rounded-lg ${currentStoreId === store.id ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 dark:text-gray-300'}`}><StoreIcon size={16} /></div><span className="ml-3 text-sm font-semibold truncate dark:text-white">{store.name}</span></div>
                                <ChevronRight size={14} className={`transition-transform dark:text-gray-400 ${expandedStoreIds.includes(store.id) ? 'rotate-90' : ''}`} />
                            </button>
                            {expandedStoreIds.includes(store.id) && renderStoreMenu(store.id)}
                        </div>
                    ))}
                </div>
            </div>
            <div className="border-t dark:border-gray-700 p-4 space-y-3">
                <SyncIndicator />
                <button onClick={onLogout} className="flex items-center w-full p-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-red-600">
                    <LogOut size={20}/><span className="ml-3 text-sm font-medium">Logout</span>
                </button>
            </div>
        </div>
    </>
  );
};

/* Added missing App component and default export */
const App = () => {
    const [user, setUser] = useState<User | null>(() => {
        const saved = localStorage.getItem('user');
        return saved ? JSON.parse(saved) : null;
    });
    const [currentStoreId, setCurrentStoreId] = useState<string | null>(localStorage.getItem('currentStoreId'));
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
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

    return (
        <AuthContext.Provider value={{ 
            user, 
            currentStoreId, 
            login, 
            logout, 
            switchStore, 
            hasPermission,
            openProfile: () => setIsProfileOpen(true)
        }}>
            <HashRouter>
                <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
                    {!user ? (
                        <Routes>
                            <Route path="/login" element={<Login />} />
                            <Route path="*" element={<Navigate to="/login" />} />
                        </Routes>
                    ) : (
                        <div className="flex">
                            <Sidebar 
                                user={user} 
                                currentStoreId={currentStoreId} 
                                onLogout={logout} 
                                hasPermission={hasPermission}
                                isOpen={isSidebarOpen}
                                setIsOpen={setIsSidebarOpen}
                                onProfileClick={() => setIsProfileOpen(true)}
                            />
                            <main className="flex-1 min-h-screen md:ml-64 transition-all duration-300">
                                <header className="h-16 border-b dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-between px-4 md:px-8 sticky top-0 z-30">
                                    <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                                        <Menu icon={MenuIcon} size={24} className="dark:text-white" />
                                    </button>
                                    <div className="flex-1"></div>
                                    <div className="flex items-center gap-4">
                                        <SyncIndicator />
                                    </div>
                                </header>
                                <div className="p-4 md:p-8">
                                    <Routes>
                                        <Route path="/dashboard" element={<SuperAdminDashboard />} />
                                        <Route path="/employees" element={<EmployeeManagement />} />
                                        <Route path="/global-users" element={<GlobalUsers />} />
                                        <Route path="/pos" element={<POS />} />
                                        <Route path="/kot" element={<KOT />} />
                                        <Route path="/reports" element={<StoreReports />} />
                                        <Route path="/store/:storeId/menu" element={<StoreMenu />} />
                                        <Route path="/store/:storeId/customers" element={<StoreCustomers />} />
                                        <Route path="/store/:storeId/staff" element={<StaffManagement />} />
                                        <Route path="/store/:storeId/history" element={<StoreHistory />} />
                                        <Route path="/store/:storeId/quotations" element={<Quotations />} />
                                        <Route path="/store/:storeId/print-designer" element={<PrintDesigner />} />
                                        <Route path="*" element={<Navigate to={user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN ? "/dashboard" : "/pos"} />} />
                                    </Routes>
                                </div>
                            </main>
                            {user && <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} user={user} />}
                        </div>
                    )}
                </div>
            </HashRouter>
        </AuthContext.Provider>
    );
};

export default App;
