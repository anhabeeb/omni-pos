
import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { User, UserRole, Store, Permission, RolePermissionConfig, Employee } from '../types';
import { Plus, Trash2, Shield, ShieldAlert, UserPlus, Lock, Briefcase, ChefHat, Monitor, UtensilsCrossed, Edit2, Search, CheckSquare, Square, Settings, Check, X, UserCheck, Hash, AlertCircle, Loader2, FileBarChart, History as HistoryIcon, FileText, Phone, Mail } from 'lucide-react';
// Fix: useAuth should be imported from AuthContext
import { useAuth } from '../AuthContext';

const ALL_PERMISSIONS: { id: Permission; label: string; category: string }[] = [
    { id: 'POS_ACCESS', label: 'Access POS System', category: 'POS' },
    { id: 'POS_CREATE_ORDER', label: 'Create Orders', category: 'POS' },
    { id: 'POS_EDIT_ORDER', label: 'Edit Items/Customer', category: 'POS' },
    { id: 'POS_DELETE_ORDER', label: 'Delete/Cancel Orders', category: 'POS' },
    { id: 'POS_REFUND', label: 'Process Refunds', category: 'POS' },
    { id: 'POS_SETTLE', label: 'Settle Payment', category: 'POS' },
    { id: 'POS_OPEN_CLOSE_REGISTER', label: 'Open/Close Register', category: 'POS' },
    { id: 'VIEW_KOT', label: 'View Kitchen Display', category: 'Operations' },
    { id: 'PROCESS_KOT', label: 'Process KOT Orders', category: 'Operations' },
    { id: 'VIEW_HISTORY', label: 'View Sales & Register Logs', category: 'Audit' },
    { id: 'VIEW_QUOTATIONS', label: 'View Quotation History', category: 'Audit' },
    { id: 'VIEW_REPORTS', label: 'View Reports', category: 'Reports' },
    { id: 'MANAGE_INVENTORY', label: 'Manage Inventory & Menu', category: 'Management' },
    { id: 'MANAGE_CUSTOMERS', label: 'Manage Customers', category: 'Management' },
    { id: 'MANAGE_STAFF', label: 'Manage Staff', category: 'Management' },
    { id: 'MANAGE_SETTINGS', label: 'Manage Store Settings', category: 'Management' },
    { id: 'MANAGE_PRINT_DESIGNER', label: 'Manage Print Templates', category: 'Management' },
    { id: 'VIEW_LIVE_ACTIVITY', label: 'View Live Online Users', category: 'Management' },
];

export default function GlobalUsers() {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'USERS' | 'ROLES'>('USERS');
  
  const [users, setUsers] = useState<User[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermissionConfig[]>([]);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | ''>('');
  const [formData, setFormData] = useState<{
    id?: number;
    name: string;
    username: string;
    password: string;
    role: UserRole;
    storeIds: number[];
    phoneNumber: string;
    email: string;
  }>({
    name: '',
    username: '',
    password: '',
    role: UserRole.CASHIER,
    storeIds: [],
    phoneNumber: '',
    email: ''
  });
  const [error, setError] = useState('');

  const [roleFilter, setRoleFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const isEditingSuperAdmin = formData.id ? users.find(u => u.id === formData.id)?.role === UserRole.SUPER_ADMIN : false;

  useEffect(() => {
    loadData();
    window.addEventListener('db_change_global_users', loadData);
    window.addEventListener('db_change_global_permissions', loadData);
    window.addEventListener('db_change_global_employees', loadData);
    return () => {
        window.removeEventListener('db_change_global_users', loadData);
        window.removeEventListener('db_change_global_permissions', loadData);
        window.removeEventListener('db_change_global_employees', loadData);
    }
  }, [currentUser]);

  const loadData = async () => {
    const allUsers = await db.getUsers();
    // CRITICAL: Filter out sys.admin for everyone except the root admin themselves
    const visibleUsers = allUsers.filter(u => {
        if (u.username === 'sys.admin') return currentUser?.username === 'sys.admin';
        return true;
    });
    setUsers(visibleUsers);
    setEmployees(await db.getEmployees());
    setStores(await db.getStores());
    setRolePermissions(await db.getRolePermissions());
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (isSaving) return;

    if (formData.id) {
        const originalUser = users.find(u => u.id === formData.id);
        if (!originalUser) return;

        // Extra layer of protection for sys.admin
        if (originalUser.username === 'sys.admin' && currentUser?.username !== 'sys.admin') {
            setError("Protected Account: Only the root System Administrator can modify this account.");
            return;
        }

        if (originalUser.role === UserRole.SUPER_ADMIN && formData.role !== UserRole.SUPER_ADMIN) {
             setError("Access Denied: The System Administrator role is protected and cannot be changed.");
             return;
        }

        if (currentUser?.role === UserRole.ADMIN && formData.role === UserRole.SUPER_ADMIN) {
             setError("Cannot promote to Super Admin");
             return;
        }

        setIsSaving(true);
        try {
            await db.updateUser({
                ...originalUser,
                name: formData.name,
                username: formData.username,
                role: formData.role,
                storeIds: formData.storeIds,
                phoneNumber: formData.phoneNumber,
                email: formData.email,
                password: formData.password ? formData.password : originalUser.password
            });
            setIsModalOpen(false);
            resetForm();
        } finally {
            setIsSaving(false);
        }
    } else {
        if (!selectedEmployeeId) {
            setError('Please select an employee first.');
            return;
        }

        const employee = employees.find(e => e.id === selectedEmployeeId);
        if (!employee) return;

        if (currentUser?.role !== UserRole.SUPER_ADMIN && formData.role === UserRole.SUPER_ADMIN) {
            setError("Cannot create Super Admin");
            return;
        }
        if (currentUser?.role === UserRole.ADMIN && formData.role === UserRole.ADMIN) {
            setError("Admins cannot create other Admins.");
            return;
        }

        setIsSaving(true);
        try {
            await db.addUser({
                id: 0, 
                name: employee.fullName,
                username: employee.empId,
                password: '123', 
                role: formData.role,
                storeIds: formData.storeIds,
                phoneNumber: employee.phoneNumber,
                email: ''
            });
            setIsModalOpen(false);
            resetForm();
        } finally {
            setIsSaving(false);
        }
    }
  };

  const resetForm = () => {
      setFormData({ 
          id: undefined,
          name: '', 
          username: '', 
          password: '', 
          role: UserRole.CASHIER, 
          storeIds: [],
          phoneNumber: '',
          email: ''
      });
      setSelectedEmployeeId('');
  };

  const handleEditClick = (user: User) => {
      // Root admin check
      if (user.username === 'sys.admin' && currentUser?.username !== 'sys.admin') {
          alert("Protected Account: This record is managed by the root system administrator only.");
          return;
      }

      setFormData({
          id: user.id,
          name: user.name,
          username: user.username,
          password: '', 
          role: user.role,
          storeIds: user.storeIds || [],
          phoneNumber: user.phoneNumber || '',
          email: user.email || ''
      });
      setIsModalOpen(true);
  };

  const handleDeleteUser = async (userId: number) => {
    const canDelete = currentUser?.role === UserRole.SUPER_ADMIN || currentUser?.role === UserRole.ADMIN;
    if (!canDelete) {
        alert("Permission Denied: Only Super Admins and Admins can delete user accounts.");
        return;
    }

    if (userId === currentUser?.id) {
        alert("Action Denied: You cannot delete your own account.");
        return;
    }

    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;

    // Strict root protection
    if (targetUser.username === 'sys.admin') {
        alert("Protected Account: The root system administrator account cannot be deleted.");
        return;
    }

    if (targetUser.role === UserRole.SUPER_ADMIN && currentUser?.username !== 'sys.admin') {
        alert("Protected Account: Only the main System Administrator can delete other administrative accounts.");
        return;
    }

    if (currentUser?.role === UserRole.ADMIN && targetUser.role === UserRole.ADMIN) {
        alert("Action Denied: Administrators cannot delete other Administrator accounts.");
        return;
    }

    if (confirm(`Are you sure you want to delete the system access for "${targetUser.name}"? They will no longer be able to log in, but their employee record will be preserved.`)) {
      try {
        await db.deleteUser(userId);
        await loadData(); 
        alert("User account deleted successfully.");
      } catch (err) {
        console.error("Deletion failed:", err);
        alert("An error occurred while deleting the user account.");
      }
    }
  };

  const toggleStoreSelection = (storeId: number) => {
      setFormData(prev => ({
          ...prev,
          storeIds: prev.storeIds.includes(storeId) 
            ? prev.storeIds.filter(id => id !== storeId) 
            : [...prev.storeIds, storeId]
      }));
  };

  const togglePermission = async (permId: Permission) => {
      if (!selectedRole) return;
      const config = rolePermissions.find(p => p.role === selectedRole);
      let currentPerms = config ? config.permissions : [];
      currentPerms = currentPerms.includes(permId) ? currentPerms.filter(p => p !== permId) : [...currentPerms, permId];
      await db.updateRolePermissions({ role: selectedRole, permissions: currentPerms });
  };

  const toggleAll = async (select: boolean) => {
      if (!selectedRole || selectedRole === UserRole.SUPER_ADMIN) return;
      await db.updateRolePermissions({ role: selectedRole, permissions: select ? ALL_PERMISSIONS.map(p => p.id) : [] });
  };

  const filteredUsers = users.filter(u => {
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
      const term = searchTerm.toLowerCase();
      return matchesRole && (u.name.toLowerCase().includes(term) || u.username.toLowerCase().includes(term));
  });

  const availableEmployees = employees.filter(emp => !users.some(u => u.username === emp.empId));

  const getRoleIcon = (role: UserRole) => {
      switch(role) {
          case UserRole.SUPER_ADMIN: return <ShieldAlert size={20} />;
          case UserRole.ADMIN: return <Shield size={20} />;
          case UserRole.MANAGER: return <Briefcase size={20} />;
          case UserRole.ACCOUNTANT: return <FileBarChart size={20} />;
          case UserRole.CHEF: return <ChefHat size={20} />;
          case UserRole.WAITER: return <UtensilsCrossed size={20} />;
          default: return <Monitor size={20} />;
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">User & Access Management</h1>
          <p className="text-gray-500 dark:text-gray-400">Grant system access to employees and define their permissions.</p>
        </div>
        
        {activeTab === 'USERS' && (
            <button 
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm whitespace-nowrap font-bold"
            >
            <UserPlus size={18} />
            Create User Account
            </button>
        )}
      </div>

      <div className="flex gap-4 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          <button onClick={() => setActiveTab('USERS')} className={`px-4 py-3 font-medium text-sm transition-colors relative whitespace-nowrap ${activeTab === 'USERS' ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-500'}`}>
              <div className="flex items-center gap-2"><Lock size={18} /> User Accounts</div>
              {activeTab === 'USERS' && <span className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 dark:bg-blue-400 rounded-t-full"></span>}
          </button>
          <button onClick={() => setActiveTab('ROLES')} className={`px-4 py-3 font-medium text-sm transition-colors relative whitespace-nowrap ${activeTab === 'ROLES' ? 'text-purple-600 dark:text-purple-400 font-bold' : 'text-gray-500'}`}>
              <div className="flex items-center gap-2"><Shield size={18} /> Role Permissions</div>
              {activeTab === 'ROLES' && <span className="absolute bottom-0 left-0 w-full h-1 bg-purple-600 dark:bg-purple-400 rounded-t-full"></span>}
          </button>
      </div>

      {activeTab === 'USERS' && (
          <>
            <div className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                    <input 
                        type="text" placeholder="Search accounts..." 
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                    {['ALL', ...Object.values(UserRole).filter(r => r !== UserRole.SUPER_ADMIN)].map(r => (
                        <button 
                            key={r} 
                            onClick={() => setRoleFilter(r)} 
                            className={`px-3 py-1.5 text-xs font-black rounded-md transition-colors whitespace-nowrap ${roleFilter === r ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                        >
                            {r}
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[700px]">
                        <thead className="bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-[10px] font-black uppercase tracking-[0.1em] border-b border-gray-200 dark:border-gray-700">
                            <tr><th className="p-4">Username</th><th className="p-4">Staff Member</th><th className="p-4">System Role</th><th className="p-4">Assigned Stores</th><th className="p-4 text-right">Actions</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {filteredUsers.length === 0 ? (
                                <tr><td colSpan={5} className="p-10 text-center text-gray-400">No matching accounts found.</td></tr>
                            ) : (
                                filteredUsers.map(user => (
                                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                                        <td className="p-4 font-mono font-bold text-blue-600 dark:text-blue-400 text-sm">#{user.username}</td>
                                        <td className="p-4 font-bold text-gray-800 dark:text-white">{user.name}</td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2 text-xs font-bold bg-white dark:bg-gray-700 w-fit px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-600">
                                                <span className="text-gray-400">{getRoleIcon(user.role)}</span> {user.role}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-wrap gap-1">
                                                {user.role === UserRole.SUPER_ADMIN ? <span className="text-[10px] font-black bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">GLOBAL ACCESS</span> : (user.storeIds || []).map(sid => <span key={sid} className="text-[10px] font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 px-2 py-0.5 rounded-full border border-blue-100 dark:border-blue-900/40">{stores.find(st => st.id === sid)?.name || 'Unknown'}</span>)}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right space-x-1">
                                            <button onClick={() => handleEditClick(user)} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"><Edit2 size={18} /></button>
                                            {user.username !== 'sys.admin' && <button onClick={() => handleDeleteUser(user.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"><Trash2 size={18} /></button>}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
          </>
      )}

      {activeTab === 'ROLES' && (
          <div className="flex flex-col md:flex-row gap-6 h-full items-start">
              <div className="w-full md:w-64 bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
                  <div className="p-3 bg-white dark:bg-gray-900 border-b dark:border-gray-700 font-black text-xs uppercase text-gray-500">Select Role</div>
                  <div className="divide-y dark:divide-gray-700">
                      {Object.values(UserRole).map(role => (
                          <button key={role} onClick={() => setSelectedRole(role)} className={`w-full text-left p-3 text-sm flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${selectedRole === role ? 'bg-purple-600 text-white font-bold' : 'text-gray-700 dark:text-gray-300'}`}>{getRoleIcon(role)} {role}</button>
                      ))}
                  </div>
              </div>
              <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden w-full">
                  {selectedRole ? (
                      <>
                          <div className="p-4 border-b dark:border-gray-700 bg-white dark:bg-gray-900 flex justify-between items-center">
                              <h3 className="font-black text-gray-800 dark:text-white uppercase tracking-tighter flex items-center gap-2"><Shield size={18}/> {selectedRole} Access Matrix</h3>
                              {selectedRole !== UserRole.SUPER_ADMIN && (
                                  <div className="flex gap-2">
                                      <button onClick={() => toggleAll(true)} className="text-[10px] font-black uppercase text-blue-600">Select All</button>
                                      <button onClick={() => toggleAll(false)} className="text-[10px] font-black uppercase text-red-600">Clear</button>
                                  </div>
                              )}
                          </div>
                          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                              {['POS', 'Operations', 'Audit', 'Reports', 'Management'].map(category => (
                                  <div key={category} className="space-y-2">
                                      <h4 className="text-[10px] font-black text-gray-400 uppercase border-b pb-1 mb-2">{category}</h4>
                                      {ALL_PERMISSIONS.filter(p => p.category === category).map(perm => {
                                          const config = rolePermissions.find(rp => rp.role === selectedRole);
                                          const isChecked = config?.permissions.includes(perm.id) || selectedRole === UserRole.SUPER_ADMIN;
                                          return (
                                              <div key={perm.id} className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-all ${isChecked ? 'bg-blue-50 dark:bg-blue-900/10' : 'opacity-40 hover:opacity-100'}`} onClick={() => selectedRole !== UserRole.SUPER_ADMIN && togglePermission(perm.id)}>
                                                  {isChecked ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} className="text-gray-300" />}
                                                  <span className="text-xs font-bold dark:text-gray-200">{perm.label}</span>
                                              </div>
                                          );
                                      })}
                                  </div>
                              ))}
                          </div>
                      </>
                  ) : <div className="p-20 text-center text-gray-400">Select a role to configure permissions.</div>}
              </div>
          </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-gray-900/30">
              <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
                <UserPlus className="text-blue-600" />
                {formData.id ? 'Modify User Account' : 'Grant New System Access'}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-8">
              {error && (
                  <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-xl border border-red-100 dark:border-red-900/40 flex items-center gap-3 text-sm font-medium">
                      <AlertCircle size={18} />
                      {error}
                  </div>
              )}

              <div className="space-y-4">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] border-b dark:border-gray-700 pb-2">Account Details</h3>
                
                {!formData.id ? (
                    <div className="space-y-4">
                        <div className="flex flex-col">
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-tight">Select Employee from Registry *</label>
                            <div className="relative">
                                <UserCheck className="absolute left-3 top-3 text-gray-400" size={18} />
                                <select 
                                    required
                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-bold appearance-none outline-none focus:ring-2 focus:ring-blue-500"
                                    value={selectedEmployeeId}
                                    onChange={e => setSelectedEmployeeId(Number(e.target.value))}
                                >
                                    <option value="">Choose Staff Member...</option>
                                    {availableEmployees.map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.fullName} (ID: {emp.empId})</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {selectedEmployeeId !== '' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                                    <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Auto-Generated Username</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Hash size={14} className="text-blue-400" />
                                        <p className="text-sm font-black dark:text-white">#{employees.find(e => e.id === selectedEmployeeId)?.empId}</p>
                                    </div>
                                </div>
                                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-100 dark:border-green-800">
                                    <p className="text-[10px] font-black text-green-600 dark:text-green-400 uppercase tracking-widest">Initial Password</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Lock size={14} className="text-green-400" />
                                        <p className="text-sm font-black dark:text-white">123</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {formData.username === 'sys.admin' ? (
                            <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 space-y-4">
                                <label className="block text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-2">Main System Administrator Details</label>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase ml-1 mb-1">Public Display Name</label>
                                        <input 
                                            className="w-full p-2.5 border border-blue-200 dark:border-blue-800 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
                                            value={formData.name}
                                            onChange={e => setFormData({...formData, name: e.target.value})}
                                            placeholder="System Admin"
                                        />
                                    </div>
                                    <div className="flex flex-col justify-end">
                                        <div className="flex justify-between items-center text-xs p-2.5 bg-white/50 dark:bg-black/20 rounded-xl border border-blue-100 dark:border-blue-800">
                                            <span className="text-gray-500 font-bold uppercase tracking-widest text-[9px]">Root Username</span>
                                            <span className="font-mono font-black text-blue-600 dark:text-blue-300">#sys.admin</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase ml-1 mb-1">Phone Number</label>
                                        <div className="relative">
                                            <Phone className="absolute left-3 top-3 text-blue-400" size={14} />
                                            <input 
                                                className="w-full pl-9 p-2.5 border border-blue-100 dark:border-blue-800 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                                                value={formData.phoneNumber}
                                                onChange={e => setFormData({...formData, phoneNumber: e.target.value})}
                                                placeholder="+960 7771234"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase ml-1 mb-1">Email Address</label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-3 text-blue-400" size={14} />
                                            <input 
                                                className="w-full pl-9 p-2.5 border border-blue-100 dark:border-blue-800 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                                                value={formData.email}
                                                onChange={e => setFormData({...formData, email: e.target.value})}
                                                placeholder="admin@omnipos.com"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800 flex flex-col gap-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Account Holder</p>
                                        <p className="text-lg font-black dark:text-white">{formData.name}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">System Username</p>
                                        <p className="text-sm font-mono font-bold dark:text-blue-300">#{formData.username}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-2 border-t dark:border-gray-800">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Contact No</label>
                                        <input 
                                            className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                                            value={formData.phoneNumber}
                                            onChange={e => setFormData({...formData, phoneNumber: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Email</label>
                                        <input 
                                            className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                                            value={formData.email}
                                            onChange={e => setFormData({...formData, email: e.target.value})}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] border-b dark:border-gray-700 pb-2">Access Control</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-tight">System Role *</label>
                        <select 
                            required
                            disabled={isEditingSuperAdmin && currentUser?.username !== 'sys.admin'}
                            className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-900"
                            value={formData.role}
                            onChange={e => setFormData({...formData, role: e.target.value as UserRole})}
                        >
                            {(isEditingSuperAdmin || currentUser?.role === UserRole.SUPER_ADMIN) && <option value={UserRole.SUPER_ADMIN}>SUPER ADMINISTRATOR (SYSTEM)</option>}
                            {currentUser?.role === UserRole.SUPER_ADMIN && <option value={UserRole.ADMIN}>ADMINISTRATOR (GLOBAL)</option>}
                            <option value={UserRole.MANAGER}>STORE MANAGER</option>
                            <option value={UserRole.ACCOUNTANT}>ACCOUNTANT / AUDITOR</option>
                            <option value={UserRole.SUPERVISOR}>SUPERVISOR</option>
                            <option value={UserRole.CASHIER}>CASHIER</option>
                            <option value={UserRole.CHEF}>KITCHEN CHEF</option>
                            <option value={UserRole.WAITER}>WAITER / SERVER</option>
                        </select>
                        {isEditingSuperAdmin && <p className="text-[10px] text-blue-600 font-bold mt-1 uppercase">Protected system account role.</p>}
                    </div>

                    {formData.id && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-tight">Reset Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-2.5 text-gray-400" size={16} />
                                <input 
                                    type="password" 
                                    placeholder="Enter new password" 
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.password} 
                                    onChange={e => setFormData({...formData, password: e.target.value})} 
                                />
                            </div>
                        </div>
                    )}
                </div>
              </div>

              {(formData.role !== UserRole.ADMIN && formData.role !== UserRole.SUPER_ADMIN) && (
                  <div className="space-y-4">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] border-b dark:border-gray-700 pb-2">Station Assignment (Stores)</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white dark:bg-gray-900/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                        {stores.map(store => (
                            <button 
                                key={store.id} 
                                type="button"
                                onClick={() => toggleStoreSelection(store.id)}
                                className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${formData.storeIds.includes(store.id) ? 'bg-blue-600 text-white border-blue-600 shadow-md scale-[1.02]' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-blue-300'}`}
                            >
                                {formData.storeIds.includes(store.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                                <span className="text-xs font-black uppercase truncate">{store.name}</span>
                            </button>
                        ))}
                    </div>
                  </div>
              )}
            </form>

            <div className="p-6 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3 bg-white dark:bg-gray-900/30">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 dark:text-gray-400">Cancel</button>
              <button 
                onClick={handleSaveUser} 
                disabled={isSaving}
                className="px-8 py-2.5 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {isSaving && <Loader2 className="animate-spin" size={16} />}
                {formData.id ? 'Save Changes' : 'Finalize Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
