import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { User, UserRole, Store, Permission, RolePermissionConfig, Employee } from '../types';
import { Plus, Trash2, Shield, ShieldAlert, UserPlus, Lock, Briefcase, ChefHat, Monitor, UtensilsCrossed, Edit2, Search, CheckSquare, Square, Settings, Check, X, UserCheck, Hash, AlertCircle, Loader2, FileBarChart, History as HistoryIcon, FileText, Phone, Mail, ScrollText } from 'lucide-react';
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
    { id: 'VIEW_LOGS', label: 'View Global System Logs', category: 'Audit' },
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
                                              <button 
                                                  key={perm.id} 
                                                  disabled={selectedRole === UserRole.SUPER_ADMIN}
                                                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-left group ${isChecked ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 shadow-sm' : 'border border-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50'}`} 
                                                  onClick={() => togglePermission(perm.id)}
                                              >
                                                  {isChecked ? <CheckSquare size={18} className="text-blue-600" /> : <Square size={18} className="text-gray-300 group-hover:text-blue-400" />}
                                                  <span className={`text-xs font-bold ${isChecked ? 'text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'}`}>{perm.label}</span>
                                              </button>
                                          );
                                      })}
                                  </div>
                              ))}
                          </div>
                      </>
                  ) : <div className="p-20 text-center text-gray-400">Select a role from the left to configure station permissions.</div>}
              </div>
          </div>
      )}
      ...
