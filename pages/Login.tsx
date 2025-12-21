
import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { db } from '../services/db';
import { User, Store, UserRole } from '../types';
// @ts-ignore - Fixing missing member errors in react-router-dom
import { useNavigate } from 'react-router-dom';
// Add AlertCircle to imports from lucide-react
import { Store as StoreIcon, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isStoreSelectorOpen, setIsStoreSelectorOpen] = useState(false);
  const [availableStores, setAvailableStores] = useState<Store[]>([]);
  const [tempUser, setTempUser] = useState<User | null>(null);
  
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const getRedirectPath = (role: UserRole) => {
      if ([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER].includes(role)) return '/dashboard';
      return '/pos';
  };

  useEffect(() => {
    const checkAuth = async () => {
        if (user) {
            if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN) {
                navigate('/dashboard');
            } else if (localStorage.getItem('currentStoreId')) {
                navigate(getRedirectPath(user.role));
            } else if (user.storeIds && user.storeIds.length > 0) {
                const allStores = await db.getStores();
                const stores = allStores.filter(s => user.storeIds.includes(s.id) && s.isActive);
                setAvailableStores(stores);
                setTempUser(user);
                setIsStoreSelectorOpen(true);
            }
        }
    };
    checkAuth();
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoggingIn(true);

    try {
        const cleanUsername = username.trim();
        const cleanPassword = password.trim();

        if (!cleanUsername || !cleanPassword) {
            setError('Please enter both username and password.');
            return;
        }

        const users = await db.getUsers();
        const foundUser = users.find(u => u.username === cleanUsername && u.password === cleanPassword);
        
        if (foundUser) {
            if (foundUser.role === UserRole.SUPER_ADMIN || foundUser.role === UserRole.ADMIN) {
                login(foundUser);
                navigate('/dashboard');
            } else {
                const allStores = await db.getStores();
                const stores = allStores.filter(s => foundUser.storeIds.includes(s.id) && s.isActive);
                
                if (stores.length === 0) {
                    setError('Account not assigned to any active stores.');
                } else if (stores.length === 1) {
                    login(foundUser, stores[0].id);
                    navigate(getRedirectPath(foundUser.role));
                } else {
                    setTempUser(foundUser);
                    setAvailableStores(stores);
                    setIsStoreSelectorOpen(true);
                }
            }
        } else {
            setError('Invalid credentials. Please check your username and password.');
        }
    } catch (err) {
        setError('A system error occurred during login.');
        console.error(err);
    } finally {
        setIsLoggingIn(false);
    }
  };

  const handleStoreSelect = (storeId: string) => {
    if (tempUser) {
        login(tempUser, storeId);
        navigate(getRedirectPath(tempUser.role));
    }
  };

  if (isStoreSelectorOpen && tempUser) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md border">
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold">Select Store</h1>
                    <p className="text-gray-500">Welcome, {tempUser.name}</p>
                </div>
                <div className="space-y-3">
                    {availableStores.map(store => (
                        <button key={store.id} onClick={() => handleStoreSelect(store.id)} className="w-full flex items-center justify-between p-4 border rounded-xl hover:bg-blue-50 transition-all group">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors"><StoreIcon size={20} /></div>
                                <div className="text-left"><p className="font-bold">{store.name}</p><p className="text-xs text-gray-500">{store.address}</p></div>
                            </div>
                            <ArrowRight size={20} className="text-gray-300 group-hover:text-blue-600" />
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md border">
        <div className="text-center mb-8"><h1 className="text-3xl font-bold text-blue-600">OmniPOS</h1><p className="text-gray-500 mt-2">Sign in to your account</p></div>
        {/* Fixed: AlertCircle is now imported */}
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm font-medium flex items-center gap-2 animate-in fade-in duration-300"><AlertCircle size={16}/> {error}</div>}
        <form onSubmit={handleLogin} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Username</label><input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter username" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter password" /></div>
          <button 
            type="submit" 
            disabled={isLoggingIn}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoggingIn ? <Loader2 className="animate-spin" size={18}/> : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
