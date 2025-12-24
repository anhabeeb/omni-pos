
import React, { useEffect, useState } from 'react';
// @ts-ignore - Fixing missing member errors in react-router-dom
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { User, UserRole, Store } from '../types';
import { useAuth } from '../App';
import { 
  Users, 
  Trash2, 
  ArrowLeft, 
  ChefHat, 
  Monitor, 
  Briefcase,
  UtensilsCrossed,
  Shield
} from 'lucide-react';

export default function StaffManagement() {
  const { storeId } = useParams<{ storeId: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  
  const [store, setStore] = useState<Store | null>(null);
  const [staff, setStaff] = useState<User[]>([]);

  useEffect(() => {
    if (storeId) {
      loadData();
      window.addEventListener('db_change_global_users', loadData);
      return () => window.removeEventListener('db_change_global_users', loadData);
    }
  }, [storeId]);

  // Fixed: Made loadData async and awaited DB calls with Number casting
  const loadData = async () => {
    if (!storeId) return;
    const numericStoreId = Number(storeId);
    
    // Get Store Details
    const stores = await db.getStores();
    const currentStore = stores.find(s => s.id === numericStoreId);
    setStore(currentStore || null);

    // Get Staff for this store (check if storeId is in their storeIds array)
    const allUsers = await db.getUsers();
    const storeStaff = allUsers.filter(u => u.storeIds && u.storeIds.includes(numericStoreId));
    setStaff(storeStaff);
  };

  // Fixed: Made handleRemoveFromStore async and awaited DB call with Number casting
  const handleRemoveFromStore = async (userId: number) => {
      if (!storeId) return;
      const numericStoreId = Number(storeId);
      if (userId === currentUser?.id) {
          alert("You cannot remove yourself.");
          return;
      }

      if (confirm('Are you sure you want to remove this staff member from this store? (Their account will remain active)')) {
          const allUsers = await db.getUsers();
          const targetUser = allUsers.find(u => u.id === userId);
          if (targetUser) {
              // Filter out this store ID
              targetUser.storeIds = targetUser.storeIds.filter(id => id !== numericStoreId);
              // Update user in DB
              await db.updateUser(targetUser);
              await loadData();
          }
      }
  };

  // Role Badge Helper
  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case UserRole.MANAGER: return { icon: Briefcase, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' };
      case UserRole.SUPERVISOR: return { icon: Shield, color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' };
      case UserRole.CHEF: return { icon: ChefHat, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' };
      case UserRole.WAITER: return { icon: UtensilsCrossed, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' };
      default: return { icon: Monitor, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' }; // Cashier
    }
  };

  if (!store) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-700 dark:text-gray-300"
        >
          <ArrowLeft size={24} />
        </button>
        <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Staff List</h1>
            <p className="text-gray-500 dark:text-gray-400">{store.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {staff.length === 0 && (
            <div className="col-span-full text-center py-10 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                <Users className="mx-auto text-gray-300 dark:text-gray-600 mb-2" size={48} />
                <p className="text-gray-500 dark:text-gray-400">No staff members assigned to this store.</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Use "User Management" in Global Dashboard to assign staff.</p>
            </div>
        )}

        {staff.map((user) => {
          const { icon: Icon, color } = getRoleBadge(user.role);
          return (
            <div key={user.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 flex flex-col relative overflow-hidden">
              <div className="absolute top-2 right-2 text-xs font-mono font-bold text-gray-300 dark:text-gray-600">
                  #{user.userNumber}
              </div>
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-lg ${color}`}>
                  <Icon size={24} />
                </div>
                <span className={`px-2 py-1 text-xs rounded-full font-bold ${color}`}>
                  {user.role}
                </span>
              </div>
              
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{user.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">@{user.username}</p>

              <div className="pt-4 border-t border-gray-100 dark:border-gray-700 mt-auto flex justify-end">
                <button 
                    onClick={() => handleRemoveFromStore(user.id)}
                    className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 p-2 rounded transition-colors flex items-center gap-2 text-sm"
                    title="Remove from this store"
                >
                    <Trash2 size={16} /> Unassign
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
