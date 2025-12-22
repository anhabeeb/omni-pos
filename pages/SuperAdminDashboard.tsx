import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { Store, UserRole, Order, OrderStatus, ActiveSession } from '../types';
import { Plus, Store as StoreIcon, Users, ShoppingCart, Edit, TrendingUp, Clock, MapPin, Phone, FileText, DollarSign, Activity, Monitor, ShieldAlert, Shield, Briefcase, ChefHat, UtensilsCrossed, Trash2, X, Lock, AlertTriangle, AlertCircle, PauseCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '../App';
import { useNavigate } from 'react-router-dom';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function SuperAdminDashboard() {
  const { user, switchStore, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [stores, setStores] = useState<Store[]>([]);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  
  const [allOrders, setAllOrders] = useState<{storeId: string, order: Order}[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [storeToDelete, setStoreToDelete] = useState<Store | null>(null);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const [editingStore, setEditingStore] = useState<Partial<Store>>({
    name: '',
    phone: '',
    currency: '$', 
    tin: '',
    buildingName: '',
    streetName: '',
    city: '',
    province: '',
    zipCode: '',
    taxRate: 0,
    serviceChargeRate: 0,
    minStartingCash: 0,
    numberOfTables: 0,
    isActive: true
  });

  useEffect(() => {
    loadData();
    window.addEventListener('db_change_any', loadData);
    window.addEventListener('db_change_global_sessions', loadData);
    return () => {
        window.removeEventListener('db_change_any', loadData);
        window.removeEventListener('db_change_global_sessions', loadData);
    };
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    let loadedStores = await db.getStores();

    if (user.role === UserRole.MANAGER) {
        loadedStores = loadedStores.filter(s => user.storeIds.includes(s.id));
    }

    setStores(loadedStores);
    const activeSessions = await db.getActiveSessions();
    setSessions(activeSessions);

    const orders: {storeId: string, order: Order}[] = [];
    for (const store of loadedStores) {
        const storeOrders = await db.getOrders(store.id);
        storeOrders.forEach(o => orders.push({ storeId: store.id, order: o }));
    }
    setAllOrders(orders);
  };

  const handleSaveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    const fullAddress = [
        editingStore.buildingName,
        editingStore.streetName,
        editingStore.city,
        editingStore.province,
        editingStore.zipCode
    ].filter(Boolean).join(', ');

    const storeData = { ...editingStore, address: fullAddress };

    if (storeData.name) {
      setIsSaving(true);
      try {
          if (storeData.id) {
            await db.updateStore(storeData as Store);
          } else {
            await db.addStore({ ...storeData, isActive: true } as Store);
          }
          setIsModalOpen(false);
          resetForm();
          await loadData();
      } finally {
          setIsSaving(false);
      }
    }
  };

  const handleDeleteStore = async (e: React.FormEvent) => {
      e.preventDefault();
      setDeleteError('');

      if (!user || !storeToDelete || isSaving) return;

      if (confirmPassword === user.password) {
          setIsSaving(true);
          try {
              await db.deleteStore(storeToDelete.id);
              setIsDeleteModalOpen(false);
              setStoreToDelete(null);
              setConfirmPassword('');
              await loadData();
          } finally {
              setIsSaving(false);
          }
      } else {
          setDeleteError('Incorrect password. Access denied.');
      }
  };

  const resetForm = () => {
    setEditingStore({
        name: '', phone: '', currency: '$', tin: '', buildingName: '', streetName: '', city: '', province: '', zipCode: '', taxRate: 0, serviceChargeRate: 0, minStartingCash: 0, numberOfTables: 0, isActive: true
    });
  };

  const openEditModal = (store: Store) => {
    setEditingStore(store);
    setIsModalOpen(true);
  };

  const openDeleteModal = (store: Store) => {
      setStoreToDelete(store);
      setConfirmPassword('');
      setDeleteError('');
      setIsDeleteModalOpen(true);
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const getStoreStats = (storeId: string) => {
      const currentStore = stores.find(s => s.id === storeId);
      const currency = currentStore?.currency || '$';
      const today = new Date();
      today.setHours(0,0,0,0);
      const todayTs = today.getTime();

      const storeOrders = allOrders.filter(w => w.storeId === storeId).map(w => w.order);
      const todaySales = storeOrders
          .filter(o => o.createdAt >= todayTs && o.status === OrderStatus.COMPLETED)
          .reduce((sum, o) => sum + o.total, 0);
      
      const activeCount = storeOrders
          .filter(o => [OrderStatus.PENDING, OrderStatus.PREPARING, OrderStatus.READY].includes(o.status))
          .length;

      const heldCount = storeOrders
          .filter(o => o.status === OrderStatus.ON_HOLD)
          .length;

      const completedTodayCount = storeOrders
          .filter(o => o.createdAt >= todayTs && o.status === OrderStatus.COMPLETED)
          .length;

      const last7Days = new Array(7).fill(0).map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          d.setHours(0,0,0,0);
          return d;
      });

      const trendData = last7Days.map(date => {
          const nextDay = new Date(date);
          nextDay.setDate(date.getDate() + 1);
          
          const dailyTotal = storeOrders
              .filter(o => 
                  o.createdAt >= date.getTime() && 
                  o.createdAt < nextDay.getTime() && 
                  o.status === OrderStatus.COMPLETED
              )
              .reduce((sum, o) => sum + o.total, 0);

          return {
              date: date.toLocaleDateString('en-US', { weekday: 'short' }),
              sales: dailyTotal
          };
      });

      return { todaySales, activeCount, heldCount, completedTodayCount, trendData, currency };
  };

  const visibleSessions = sessions.filter(s => {
      const isAdminRole = s.role === UserRole.SUPER_ADMIN || s.role === UserRole.ADMIN;
      if (user?.role === UserRole.SUPER_ADMIN) return true;
      return !isAdminRole;
  });

  const getRoleIcon = (role: UserRole) => {
      switch(role) {
          case UserRole.SUPER_ADMIN: return <ShieldAlert size={14} className="text-red-500" />;
          case UserRole.ADMIN: return <Shield size={14} className="text-purple-500" />;
          case UserRole.MANAGER: return <Briefcase size={14} className="text-blue-500" />;
          case UserRole.CHEF: return <ChefHat size={14} className="text-orange-500" />;
          case UserRole.WAITER: return <UtensilsCrossed size={14} className="text-green-500" />;
          default: return <Monitor size={14} className="text-gray-500" />;
      }
  };

  const hasAccess = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER].includes(user?.role as UserRole);
  const isSuperOrAdmin = [UserRole.SUPER_ADMIN, UserRole.ADMIN].includes(user?.role as UserRole);
  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;

  if (!hasAccess) {
    return <div className="text-gray-800 dark:text-gray-200">Access Denied</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
              {isSuperOrAdmin ? 'Global Dashboard' : 'My Stores Dashboard'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">Overview of performance by location.</p>
        </div>
        
        {isSuperOrAdmin && (
            <button 
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-bold"
            >
            <Plus size={18} />
            Add New Store
            </button>
        )}
      </div>

      {hasPermission('VIEW_LIVE_ACTIVITY') && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <Activity size={16} className="text-green-500" /> Live System Activity
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {visibleSessions.filter(s => !s.storeId).length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                      <h3 className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3 pb-2 border-b dark:border-gray-700">Global / Dashboard</h3>
                      <div className="space-y-2">
                          {visibleSessions.filter(s => !s.storeId).map(s => (
                              <div key={s.userId} className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                      <div className="relative">
                                          <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                                              {getRoleIcon(s.role)}
                                          </div>
                                          <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border-2 border-white dark:border-gray-800 animate-pulse"></div>
                                      </div>
                                      <span className="text-xs font-bold dark:text-gray-200">{s.userName}</span>
                                  </div>
                                  <span className="text-[9px] text-gray-400 font-mono">LIVE</span>
                              </div>
                          ))}
                      </div>
                  </div>
              )}

              {stores.map(st => {
                  const storeUsers = visibleSessions.filter(s => s.storeId === st.id);
                  if (storeUsers.length === 0) return null;
                  return (
                      <div key={st.id} className="bg-blue-50/30 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
                          <h3 className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-3 pb-2 border-b border-blue-100 dark:border-blue-900/30 truncate">{st.name}</h3>
                          <div className="space-y-2">
                              {storeUsers.map(s => (
                                  <div key={s.userId} className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                          <div className="relative">
                                              <div className="w-6 h-6 bg-white dark:bg-gray-800 rounded-lg flex items-center justify-center border dark:border-gray-700">
                                                  {getRoleIcon(s.role)}
                                              </div>
                                              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border-2 border-white dark:border-gray-800 animate-pulse"></div>
                                          </div>
                                          <span className="text-xs font-bold dark:text-gray-200">{s.userName}</span>
                                      </div>
                                      <span className="text-[9px] text-blue-500 dark:text-blue-300 font-black">ONLINE</span>
                                  </div>
                              ))}
                          </div>
                      </div>
                  );
              })}

              {visibleSessions.length === 0 && (
                  <div className="col-span-full py-6 text-center text-gray-400 italic text-sm">
                      No users currently online.
                  </div>
              )}
          </div>
        </div>
      )}

      <div className="space-y-8">
        {stores.map((store) => {
            const stats = getStoreStats(store.id);
            return (
                <div key={store.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-blue-600 dark:text-blue-400">
                                <StoreIcon size={20} />
                            </div>
                            <div>
                                <h2 className="font-bold text-lg text-gray-900 dark:text-white leading-tight">{store.name}</h2>
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${store.isActive ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                                    {store.isActive ? 'Active Store' : 'Disabled'}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {isSuperOrAdmin && (
                                <button 
                                    onClick={() => openEditModal(store)}
                                    className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 px-3 py-1.5 rounded-lg transition-colors font-bold"
                                >
                                    <Edit size={16} /> Edit Details
                                </button>
                            )}
                            {isSuperAdmin && (
                                <button 
                                    onClick={() => openDeleteModal(store)}
                                    className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 hover:text-white hover:bg-red-600 dark:hover:bg-red-600 px-3 py-1.5 rounded-lg transition-all font-bold"
                                >
                                    <Trash2 size={16} /> Delete
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
                        <div className="lg:col-span-3 flex flex-col gap-4">
                            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                                <div className="flex items-start gap-2">
                                    <MapPin size={16} className="mt-0.5 flex-shrink-0 text-gray-400 dark:text-gray-500" />
                                    <span className="text-xs leading-relaxed">{store.address}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Phone size={16} className="text-gray-400 dark:text-gray-500" />
                                    <span className="text-xs font-mono">{store.phone}</span>
                                </div>
                                {store.tin && (
                                    <div className="flex items-center gap-2">
                                        <FileText size={16} className="text-gray-400 dark:text-gray-500" />
                                        <span className="text-xs">TIN: {store.tin}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2">
                                    <DollarSign size={16} className="text-gray-400 dark:text-gray-500" />
                                    <span className="text-xs">Currency: {store.currency || '$'}</span>
                                </div>
                            </div>

                            <div className="border-t border-gray-100 dark:border-gray-700 pt-4 flex flex-col gap-2 mt-auto">
                                <button 
                                    onClick={() => {
                                        switchStore(store.id);
                                        navigate('/pos');
                                    }}
                                    className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-xl hover:bg-blue-700 transition-all font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-95"
                                >
                                    <ShoppingCart size={16} /> Open POS
                                </button>
                                <div className="grid grid-cols-2 gap-2">
                                    <button 
                                        onClick={() => navigate(`/store/${store.id}/staff`)}
                                        className="flex items-center justify-center gap-2 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors font-bold text-[10px] uppercase"
                                    >
                                        <Users size={14} /> Staff
                                    </button>
                                    <button 
                                        onClick={() => navigate(`/store/${store.id}/menu`)}
                                        className="flex items-center justify-center gap-2 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors font-bold text-[10px] uppercase"
                                    >
                                        <FileText size={14} /> Menu
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-4 grid grid-cols-2 gap-4">
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800 flex flex-col justify-between">
                                <div>
                                    <p className="text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest mb-1">Revenue</p>
                                    <p className="text-xl font-black text-blue-900 dark:text-blue-100 truncate">{stats.currency}{stats.todaySales.toFixed(2)}</p>
                                </div>
                                <TrendingUp size={18} className="text-blue-500 mt-2" />
                            </div>

                            <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-2xl border border-orange-100 dark:border-orange-800 flex flex-col justify-between">
                                <div>
                                    <p className="text-orange-600 dark:text-orange-400 text-[10px] font-black uppercase tracking-widest mb-1">Active</p>
                                    <p className="text-xl font-black text-orange-900 dark:text-orange-100">{stats.activeCount}</p>
                                </div>
                                <Clock size={18} className="text-orange-500 mt-2" />
                            </div>

                            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-2xl border border-yellow-100 dark:border-yellow-800 flex flex-col justify-between">
                                <div>
                                    <p className="text-yellow-600 dark:text-yellow-400 text-[10px] font-black uppercase tracking-widest mb-1">Held</p>
                                    <p className="text-xl font-black text-yellow-900 dark:text-yellow-100">{stats.heldCount}</p>
                                </div>
                                <PauseCircle size={18} className="text-yellow-500 mt-2" />
                            </div>

                            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-2xl border border-green-100 dark:border-green-800 flex flex-col justify-between">
                                <div>
                                    <p className="text-green-600 dark:text-green-400 text-[10px] font-black uppercase tracking-widest mb-1">Completed</p>
                                    <p className="text-xl font-black text-green-900 dark:text-green-100">{stats.completedTodayCount}</p>
                                </div>
                                <CheckCircle2 size={18} className="text-green-500 mt-2" />
                            </div>
                        </div>

                        <div className="lg:col-span-5 border-l border-gray-100 dark:border-gray-700 pl-6">
                            <h3 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">7-Day Sales Trend</h3>
                            <div className="h-44">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={stats.trendData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                        <XAxis dataKey="date" tick={{fontSize: 10, fill: '#6b7280'}} axisLine={false} tickLine={false} />
                                        <YAxis tick={{fontSize: 10, fill: '#6b7280'}} axisLine={false} tickLine={false} width={30} />
                                        <Tooltip 
                                            contentStyle={{borderRadius: '12px', fontSize: '12px', backgroundColor: '#1f2937', color: '#fff', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} 
                                            formatter={(value: number) => [`${stats.currency}${value.toFixed(2)}`, 'Sales']}
                                        />
                                        <Line type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={3} dot={{r: 4, fill: '#3b82f6'}} activeDot={{r: 6, stroke: '#fff', strokeWidth: 2}} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            );
        })}
      </div>

      {isDeleteModalOpen && storeToDelete && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
              <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl w-full max-md shadow-2xl animate-in zoom-in-95 duration-200 border border-red-100 dark:border-red-900/30">
                  <div className="w-20 h-20 bg-red-50 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600 dark:text-red-400 mx-auto mb-6">
                      <AlertTriangle size={40} />
                  </div>
                  <h2 className="text-2xl font-bold text-center dark:text-white mb-2">Delete {storeToDelete.name}?</h2>
                  <p className="text-gray-500 dark:text-gray-400 text-center text-sm mb-8">
                      This action is permanent and will delete all associated products, orders, and reports for this store location.
                  </p>

                  <form onSubmit={handleDeleteStore} className="space-y-6">
                      <div className="space-y-2">
                          <label className="block text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Confirm System Password</label>
                          <div className="relative">
                              <Lock className="absolute left-4 top-3.5 text-gray-400" size={18} />
                              <input 
                                  type="password"
                                  autoFocus
                                  required
                                  className="w-full pl-12 pr-4 py-3.5 border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-red-500 outline-none transition-all font-bold"
                                  placeholder="Enter your password"
                                  value={confirmPassword}
                                  onChange={e => setConfirmPassword(e.target.value)}
                              />
                          </div>
                          {deleteError && <p className="text-red-500 text-xs font-bold mt-2 flex items-center gap-1"><AlertCircle size={14}/> {deleteError}</p>}
                      </div>

                      <div className="flex flex-col gap-3">
                          <button 
                              type="submit"
                              disabled={isSaving}
                              className="w-full py-4 bg-red-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-red-500/20 hover:bg-red-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                          >
                            {isSaving && <Loader2 className="animate-spin" size={20} />}
                            Permanently Delete Store
                          </button>
                          <button 
                              type="button"
                              onClick={() => {
                                  setIsDeleteModalOpen(false);
                                  setStoreToDelete(null);
                                  setConfirmPassword('');
                                  setDeleteError('');
                              }}
                              className="w-full py-4 text-gray-500 dark:text-gray-400 font-bold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded-2xl transition-all"
                          >
                              Cancel
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">{editingStore.id ? 'Edit Store Details' : 'Register New Store'}</h2>
            <form onSubmit={handleSaveStore} className="space-y-6">
              
              <div className="space-y-4">
                  <h3 className="text-xs font-black text-gray-400 dark:text-gray-500 border-b dark:border-gray-700 pb-2 flex items-center gap-2 uppercase tracking-[0.2em]">
                      <StoreIcon size={16} /> Business Details
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Company Name *</label>
                        <input 
                            placeholder="e.g. My Restaurant" 
                            className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
                            value={editingStore.name || ''} 
                            onChange={e => setEditingStore({...editingStore, name: e.target.value})} 
                            required 
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Contact No *</label>
                        <input 
                            placeholder="e.g. 555-0100" 
                            className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
                            value={editingStore.phone || ''} 
                            onChange={e => setEditingStore({...editingStore, phone: e.target.value})} 
                            required
                        />
                      </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Tax ID (TIN) *</label>
                        <input 
                            placeholder="e.g. 123-456-789" 
                            className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
                            value={editingStore.tin || ''} 
                            onChange={e => setEditingStore({...editingStore, tin: e.target.value})} 
                            required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Currency Symbol *</label>
                        <input 
                            placeholder="e.g. $, MVR, €" 
                            className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
                            value={editingStore.currency || ''} 
                            onChange={e => setEditingStore({...editingStore, currency: e.target.value})} 
                            required
                        />
                      </div>
                  </div>
              </div>

              <div className="space-y-4">
                  <h3 className="text-xs font-black text-gray-400 dark:text-gray-500 border-b dark:border-gray-700 pb-2 flex items-center gap-2 uppercase tracking-[0.2em]">
                      <MapPin size={16} /> Physical Address
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Building Name *</label>
                        <input 
                            required
                            placeholder="e.g. Trade Tower" 
                            className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                            value={editingStore.buildingName || ''} 
                            onChange={e => setEditingStore({...editingStore, buildingName: e.target.value})} 
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Street Name *</label>
                        <input 
                            required
                            placeholder="e.g. Orchid Magu" 
                            className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                            value={editingStore.streetName || ''} 
                            onChange={e => setEditingStore({...editingStore, streetName: e.target.value})} 
                        />
                      </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">City / Atoll *</label>
                        <input 
                            required
                            placeholder="e.g. Male'" 
                            className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                            value={editingStore.city || ''} 
                            onChange={e => setEditingStore({...editingStore, city: e.target.value})} 
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Province *</label>
                        <input 
                            required
                            placeholder="e.g. Kaafu" 
                            className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                            value={editingStore.province || ''} 
                            onChange={e => setEditingStore({...editingStore, province: e.target.value})} 
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Zip Code *</label>
                        <input 
                            required
                            placeholder="e.g. 20002" 
                            className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                            value={editingStore.zipCode || ''} 
                            onChange={e => setEditingStore({...editingStore, zipCode: e.target.value})} 
                        />
                      </div>
                  </div>
              </div>

              <div className="space-y-4">
                  <h3 className="text-xs font-black text-gray-400 dark:text-gray-500 border-b dark:border-gray-700 pb-2 flex items-center gap-2 uppercase tracking-[0.2em]">
                      <FileText size={16} /> Tax & Operations
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">GST Rate (%) *</label>
                      <input 
                        required
                        type="number" 
                        step="0.01"
                        className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
                        value={editingStore.taxRate ?? ''} 
                        onChange={e => setEditingStore({...editingStore, taxRate: parseFloat(e.target.value) || 0})} 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Service Charge (%) *</label>
                      <input 
                        required
                        type="number" 
                        step="0.01"
                        className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
                        value={editingStore.serviceChargeRate ?? ''} 
                        onChange={e => setEditingStore({...editingStore, serviceChargeRate: parseFloat(e.target.value) || 0})} 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Min Starting Cash *</label>
                      <input 
                        required
                        type="number" 
                        step="0.01"
                        className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
                        value={editingStore.minStartingCash ?? ''} 
                        onChange={e => setEditingStore({...editingStore, minStartingCash: parseFloat(e.target.value) || 0})} 
                      />
                    </div>
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Number of Tables *</label>
                      <input 
                        required
                        type="number" 
                        min="0"
                        className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
                        value={editingStore.numberOfTables ?? ''} 
                        onChange={e => setEditingStore({...editingStore, numberOfTables: parseInt(e.target.value) || 0})} 
                      />
                  </div>
              </div>
              
              {editingStore.id && (
                <div className="flex items-center gap-3 pt-2 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                    <input 
                        type="checkbox" 
                        id="isActive"
                        checked={editingStore.isActive}
                        onChange={e => setEditingStore({...editingStore, isActive: e.target.checked})}
                        className="w-5 h-5 text-blue-600 rounded-lg cursor-pointer"
                    />
                    <label htmlFor="isActive" className="text-sm font-black uppercase text-gray-700 dark:text-gray-300 cursor-pointer">Store Is Active</label>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 dark:border-gray-700">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors">Cancel</button>
                <button 
                    type="submit" 
                    disabled={isSaving}
                    className="px-8 py-2.5 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                    {isSaving && <Loader2 className="animate-spin" size={16} />}
                    Save Store
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}