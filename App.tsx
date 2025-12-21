
import React, { useState, useEffect, createContext, useContext } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { User, UserRole, Store, Permission, Employee, ActiveSession, RolePermissionConfig } from './types';
import { db } from './services/db';
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
  Loader2
} from 'lucide-react';

// --- Pages ---
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
            if (formData.password) {
                await db.updateUser({
                    ...user,
                    password: formData.password
                });
            }
            setSuccess("Profile updated successfully.");
            setTimeout(onClose, 1500);
        } catch (err) {
            setError("Failed to update profile.");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <UserCircle className="text-blue-600" />
                        Account Profile
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-200 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-8">
                    {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl border flex items-center gap-3 text-sm font-medium"><AlertCircle size={18} /> {error}</div>}
                    {success && <div className="bg-blue-50 text-blue-600 p-3 rounded-xl border flex items-center gap-3 text-sm font-medium"><CheckCircle size={18} /> {success}</div>}
                    <div className="space-y-4">
                        <h3 className="text-xs uppercase font-black text-gray-400 tracking-widest border-b pb-2">Identity</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-gray-50 rounded-xl border"><p className="text-[10px] uppercase font-bold text-gray-400">Account Name</p><p className="font-bold">{user.name}</p></div>
                            <div className="p-3 bg-gray-50 rounded-xl border"><p className="text-[10px] uppercase font-bold text-gray-400">Employee ID</p><p className="font-mono">#{user.username}</p></div>
                        </div>
                    </div>
                </form>
                <div className="p-6 border-t flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-6 py-2.5 text-sm hover:bg-gray-100 rounded-lg">Cancel</button>
                    <button onClick={handleSave} className="px-8 py-2.5 bg-blue-600 text-white rounded-xl shadow-lg hover:bg-blue-700">Update Profile</button>
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
          className={`flex items-center w-full rounded-xl transition-all mb-1 px-3 py-2 h-10 ${isActive ? 'bg-blue-600 shadow-md text-white' : 'hover:bg-blue-50 text-gray-500'}`}
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
                    <button onClick={(e) => toggleReports(storeId, e)} className={`flex items-center w-full rounded-xl px-3 py-2 justify-between hover:bg-blue-50 text-gray-500`}>
                        <div className="flex items-center"><BarChart3 size={18} /><span className="ml-3 text-sm font-medium">Reports</span></div>
                        <ChevronDown size={14} className={`transition-transform ${isReportsExpanded ? 'rotate-180' : ''}`} />
                    </button>
                    {isReportsExpanded && (
                        <div className="ml-4 pl-3 border-l border-blue-200 mb-2">
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
        <div className={`bg-white border-r h-screen flex flex-col fixed left-0 top-0 z-50 transition-all duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 w-64`}>
            <div className="flex items-center h-16 border-b px-6 justify-between">
                <div className="flex items-center cursor-pointer" onClick={() => navigate('/dashboard')}>
                    <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg"><Layout size={20} className="text-white" /></div>
                    <span className="ml-3 text-lg font-bold">Omni<span className="text-blue-600">POS</span></span>
                </div>
                <button onClick={() => setIsOpen(false)} className="md:hidden p-2 hover:bg-gray-100 rounded-lg"><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar pt-6 px-4">
                <button onClick={onProfileClick} className="mb-8 flex items-center w-full hover:bg-gray-50 p-2 rounded-xl">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">{user.name.charAt(0)}</div>
                    <div className="ml-3 overflow-hidden text-left"><p className="text-sm font-semibold truncate">{user.name}</p><p className="text-[10px] uppercase font-bold text-blue-600 opacity-70">{user.role}</p></div>
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
                            <button onClick={() => toggleStore(store.id)} className={`flex items-center w-full rounded-xl px-3 py-2.5 justify-between ${currentStoreId === store.id ? 'bg-blue-50 border-blue-100' : 'hover:bg-gray-50'}`}>
                                <div className="flex items-center min-w-0"><div className={`p-1.5 rounded-lg ${currentStoreId === store.id ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}><StoreIcon size={16} /></div><span className="ml-3 text-sm font-semibold truncate">{store.name}</span></div>
                                <ChevronRight size={14} className={`transition-transform ${expandedStoreIds.includes(store.id) ? 'rotate-90' : ''}`} />
                            </button>
                            {expandedStoreIds.includes(store.id) && renderStoreMenu(store.id)}
                        </div>
                    ))}
                </div>
            </div>
            <div className="border-t p-4"><button onClick={onLogout} className="flex items-center w-full p-2.5 hover:bg-red-50 rounded-xl text-red-600"><LogOut size={20}/><span className="ml-3 text-sm font-medium">Logout</span></button></div>
        </div>
    </>
  );
};

const PrivateRoute = ({ children }: { children?: React.ReactNode }) => {
  const { user } = useAuth();
  return user ? <>{children}</> : <Navigate to="/login" />;
};

const AppLayout = ({ children, onProfileClick }: { children?: React.ReactNode, onProfileClick: () => void }) => {
  const { user, currentStoreId, logout, hasPermission } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const [currentStore, setCurrentStore] = useState<Store | null>(null);

  useEffect(() => {
    const load = async () => {
        if (currentStoreId) {
            const stores = await db.getStores();
            setCurrentStore(stores.find(s => s.id === currentStoreId) || null);
        }
    };
    load();
  }, [currentStoreId]);

  if (!user) return null;

  return (
    <div className="flex bg-slate-50 min-h-screen">
      <Sidebar user={user} currentStoreId={currentStoreId} onLogout={logout} hasPermission={hasPermission} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} onProfileClick={onProfileClick} />
      <main className="flex-1 flex flex-col h-screen w-full md:ml-64">
        <div className="md:hidden bg-white border-b p-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
            <div className="flex items-center gap-3">
                <button onClick={() => setIsSidebarOpen(true)} className="p-2"><Menu size={24} /></button>
                <h1 className="text-lg font-bold">{currentStore ? currentStore.name : 'OmniPOS'}</h1>
            </div>
            <button onClick={onProfileClick} className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">{user.name.charAt(0)}</button>
        </div>
        <div className={`flex-1 overflow-y-auto ${location.pathname === '/pos' ? '' : 'p-4 md:p-8'}`}>{children}</div>
      </main>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentStoreId, setCurrentStoreId] = useState<string | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [rolePermissions, setRolePermissions] = useState<RolePermissionConfig[]>([]);
  const [isReady, setIsReady] = useState(false);
  
  useEffect(() => {
    const init = async () => {
        try {
            // Force initialize locally
            await db.init();
            
            const storedUser = localStorage.getItem('currentUser');
            const storedStoreId = localStorage.getItem('currentStoreId');
            if (storedUser) setUser(JSON.parse(storedUser));
            if (storedStoreId) setCurrentStoreId(storedStoreId);
            
            const perms = await db.getRolePermissions();
            setRolePermissions(perms);
        } catch (err) {
            console.error("Critical: System failed to initialize.", err);
        } finally {
            // Add a slight delay to ensure everything is mounted before lifting splash screen
            setTimeout(() => setIsReady(true), 500);
        }
    };
    init();
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
    localStorage.setItem('currentUser', JSON.stringify(u));
    if (storeId) {
        setCurrentStoreId(storeId);
        localStorage.setItem('currentStoreId', storeId);
    } else {
        setCurrentStoreId(null);
        localStorage.removeItem('currentStoreId');
    }
    db.updateHeartbeat(u.id, storeId || null);
  };

  const switchStore = (storeId: string) => {
      setCurrentStoreId(storeId);
      localStorage.setItem('currentStoreId', storeId);
      if (user) db.updateHeartbeat(user.id, storeId);
  };

  const logout = async () => {
    if (user) await db.removeSession(user.id);
    setUser(null);
    setCurrentStoreId(null);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('currentStoreId');
  };

  const hasPermission = (permission: Permission) => {
      if (!user) return false;
      const roleConfig = rolePermissions.find(rp => rp.role === user.role);
      return roleConfig ? roleConfig.permissions.includes(permission) : false;
  };

  if (!isReady) {
      return (
          <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
              <div className="relative">
                  <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                      <Layout className="text-blue-600" size={24} />
                  </div>
              </div>
              <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px] mt-6">Secure System Link Active</p>
              <p className="text-gray-400 text-[10px] mt-1 italic animate-pulse">Initializing local environment...</p>
          </div>
      );
  }

  return (
    <AuthContext.Provider value={{ user, currentStoreId, login, logout, switchStore, hasPermission, openProfile: () => setIsProfileModalOpen(true) }}>
        <HashRouter>
            {user && <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} user={user} />}
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/dashboard" element={<PrivateRoute><AppLayout onProfileClick={() => setIsProfileModalOpen(true)}><SuperAdminDashboard /></AppLayout></PrivateRoute>} />
                <Route path="/global-users" element={<PrivateRoute><AppLayout onProfileClick={() => setIsProfileModalOpen(true)}><GlobalUsers /></AppLayout></PrivateRoute>} />
                <Route path="/employees" element={<PrivateRoute><AppLayout onProfileClick={() => setIsProfileModalOpen(true)}><EmployeeManagement /></AppLayout></PrivateRoute>} />
                <Route path="/store/:storeId/staff" element={<PrivateRoute><AppLayout onProfileClick={() => setIsProfileModalOpen(true)}><StaffManagement /></AppLayout></PrivateRoute>} />
                <Route path="/store/:storeId/menu" element={<PrivateRoute><AppLayout onProfileClick={() => setIsProfileModalOpen(true)}><StoreMenu /></AppLayout></PrivateRoute>} />
                <Route path="/store/:storeId/customers" element={<PrivateRoute><AppLayout onProfileClick={() => setIsProfileModalOpen(true)}><StoreCustomers /></AppLayout></PrivateRoute>} />
                <Route path="/store/:storeId/print-designer" element={<PrivateRoute><AppLayout onProfileClick={() => setIsProfileModalOpen(true)}><PrintDesigner /></AppLayout></PrivateRoute>} />
                <Route path="/store/:storeId/history" element={<PrivateRoute><AppLayout onProfileClick={() => setIsProfileModalOpen(true)}><StoreHistory /></AppLayout></PrivateRoute>} />
                <Route path="/store/:storeId/quotations" element={<PrivateRoute><AppLayout onProfileClick={() => setIsProfileModalOpen(true)}><Quotations /></AppLayout></PrivateRoute>} />
                <Route path="/pos" element={<PrivateRoute><AppLayout onProfileClick={() => setIsProfileModalOpen(true)}><POS /></AppLayout></PrivateRoute>} />
                <Route path="/kot" element={<PrivateRoute><AppLayout onProfileClick={() => setIsProfileModalOpen(true)}><KOT /></AppLayout></PrivateRoute>} />
                <Route path="/reports" element={<PrivateRoute><AppLayout onProfileClick={() => setIsProfileModalOpen(true)}><StoreReports /></AppLayout></PrivateRoute>} />
                <Route path="*" element={<Navigate to="/login" />} />
            </Routes>
        </HashRouter>
    </AuthContext.Provider>
  );
}
