
import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { db } from '../services/db';
import { User, Store, UserRole } from '../types';
// @ts-ignore - Fixing missing member errors in react-router-dom
import { useNavigate } from 'react-router-dom';
import { Store as StoreIcon, ArrowRight, Loader2, AlertCircle, CloudDownload, ShieldCheck } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
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
    setSyncStatus(null);

    try {
        const cleanUsername = username.trim();
        const cleanPassword = password.trim();

        if (!cleanUsername || !cleanPassword) {
            setError('Please enter both username and password.');
            setIsLoggingIn(false);
            return;
        }

        let foundUser: User | undefined = undefined;

        // CRITICAL: Always attempt Remote Login first to check for global session locks
        // This prevents the "Local Login Bypass" where a user who is already synced 
        // logs in on a second device without hitting the server.
        setSyncStatus("Verifying global session lock...");
        const remoteResult = await db.remoteLogin(cleanUsername, cleanPassword);
        
        if (remoteResult.success && remoteResult.user) {
            setSyncStatus("Handshake successful. Syncing data...");
            // Pull latest data to ensure this device is up to date
            const hydrateSuccess = await db.pullAllFromCloud();
            if (hydrateSuccess) {
                foundUser = remoteResult.user;
            } else {
                setError('Authenticated, but failed to sync system data. Check your connection.');
            }
        } else if (remoteResult.error && remoteResult.error.includes("logged in")) {
            // This is the concurrent login block
            setError(remoteResult.error);
            setIsLoggingIn(false);
            return;
        } else {
            // Server might be offline or returned an error
            // Fallback to Local Login ONLY IF the server is unreachable 
            // and credentials exist locally.
            const users = await db.getUsers();
            foundUser = users.find(u => u.username === cleanUsername && u.password === cleanPassword);
            
            if (!foundUser) {
                setError(remoteResult.error || 'Invalid credentials or system offline.');
                setIsLoggingIn(false);
                return;
            }
            
            // If we are logging in locally (offline), we should inform the user
            // that concurrent session prevention is inactive.
            console.warn("Logged in via local fallback. Global session locking is unavailable while offline.");
        }

        if (foundUser) {
            if (foundUser.role === UserRole.SUPER_ADMIN || foundUser.role === UserRole.ADMIN) {
                login(foundUser);
                navigate('/dashboard');
            } else {
                const allStores = await db.getStores();
                const stores = allStores.filter(s => foundUser!.storeIds.includes(s.id) && s.isActive);
                
                if (stores.length === 0) {
                    setError('Account not assigned to any active stores.');
                } else if (stores.length === 1) {
                    // Fix: stores[0].id is number
                    login(foundUser, stores[0].id);
                    navigate(getRedirectPath(foundUser.role));
                } else {
                    setTempUser(foundUser);
                    setAvailableStores(stores);
                    setIsStoreSelectorOpen(true);
                }
            }
        }
    } catch (err: any) {
        setError('A system error occurred: ' + err.message);
        console.error(err);
    } finally {
        setIsLoggingIn(false);
    }
  };

  // Fix: storeId should be number
  const handleStoreSelect = (storeId: number) => {
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
        <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-blue-600 italic">OmniPOS</h1>
            <p className="text-gray-400 text-xs font-black uppercase tracking-widest mt-1">Multi-Device Restaurant System</p>
        </div>
        
        {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-4 text-xs font-bold flex items-start gap-3 border border-red-100 animate-in fade-in duration-300">
                <AlertCircle size={18} className="shrink-0 mt-0.5" /> 
                <div className="flex-1">
                  <p className="uppercase tracking-tight mb-1">Authorization Failed</p>
                  <p className="text-gray-600 leading-tight font-medium">{error}</p>
                </div>
            </div>
        )}

        {syncStatus && !error && (
            <div className="bg-blue-50 text-blue-600 p-3 rounded-xl mb-4 text-xs font-black uppercase tracking-tighter flex items-center gap-2 border border-blue-100 animate-pulse">
                <CloudDownload size={16}/> {syncStatus}
            </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-1">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Username</label>
              <input 
                type="text" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" 
                placeholder="Enter username" 
              />
          </div>
          <div className="space-y-1">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Password</label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" 
                placeholder="Enter password" 
              />
          </div>
          
          <button 
            type="submit" 
            disabled={isLoggingIn}
            className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            {isLoggingIn ? <Loader2 className="animate-spin" size={18}/> : 'Authorize Device to Login'}
          </button>
        </form>

        <div className="mt-8 text-center flex flex-col items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-50 rounded-full">
                <ShieldCheck size={12} className="text-gray-400" />
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Secured by Cloudflare</p>
            </div>
            <p className="text-[9px] text-gray-300 font-medium">Session lock enforced globally across all devices.</p>
        </div>
      </div>
    </div>
  );
}
