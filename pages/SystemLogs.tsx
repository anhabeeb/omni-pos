
import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { Store, SystemActivity, UserRole } from '../types';
import { 
  ScrollText, 
  Store as StoreIcon, 
  Search, 
  Terminal, 
  Clock, 
  User as UserIcon, 
  Activity,
  Globe,
  RefreshCw,
  AlertTriangle,
  Database,
  Filter,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../App';

const getActionColor = (action: string) => {
    if (action.includes('DELETE')) return 'text-red-500';
    if (action.includes('CREATE')) return 'text-green-500';
    if (action.includes('UPDATE')) return 'text-blue-500';
    if (action.includes('SHIFT')) return 'text-purple-500';
    return 'text-gray-500';
};

export default function SystemLogs() {
  const { user } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [activities, setActivities] = useState<SystemActivity[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = async () => {
    setIsRefreshing(true);
    try {
        const [sData, aData] = await Promise.all([
            db.getStores(),
            db.getSystemActivities()
        ]);
        setStores(sData);
        setActivities(aData);
    } finally {
        setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('db_change_any', loadData);
    return () => window.removeEventListener('db_change_any', loadData);
  }, []);

  const filteredActivities = activities.filter(a => {
      const term = searchTerm.toLowerCase();
      return (
          a.userName.toLowerCase().includes(term) ||
          a.description.toLowerCase().includes(term) ||
          a.action.toLowerCase().includes(term)
      );
  });

  // Fix: Changed storeId parameter to number | null to match Store interface
  const getStoreActivities = (storeId: number | null) => {
      return filteredActivities.filter(a => a.storeId === storeId).slice(0, 50);
  };

  if (user?.role !== UserRole.SUPER_ADMIN && user?.role !== UserRole.ADMIN) {
      return <div className="p-8 text-red-500 font-bold">Access Denied</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
              <ScrollText className="text-blue-600" /> System Activity Logs
          </h1>
          <p className="text-gray-500 dark:text-gray-400">Complete audit trail of system operations across all locations.</p>
        </div>
        
        <div className="flex items-center gap-3">
            <div className="relative">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Search logs..." 
                    className="pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm w-64"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            <button 
                onClick={loadData}
                disabled={isRefreshing}
                className="p-2 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm"
            >
                <RefreshCw size={20} className={`text-gray-500 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
          {/* Global Activities Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden h-[500px]">
              <div className="p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-xl">
                          <Globe size={20} />
                      </div>
                      <h2 className="font-bold dark:text-white">Global System Logs</h2>
                  </div>
                  <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">SYSTEM</span>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
                  {getStoreActivities(null).length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50 space-y-2">
                          <Database size={32} />
                          <p className="text-xs font-bold uppercase tracking-widest">No activities logged</p>
                      </div>
                  ) : (
                      getStoreActivities(null).map(act => (
                          <div key={act.id} className="p-3 border-b dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors group">
                              <div className="flex justify-between items-start mb-1">
                                  <span className={`text-[9px] font-black uppercase tracking-tighter ${getActionColor(act.action)}`}>{act.action}</span>
                                  <span className="text-[9px] text-gray-400 font-mono flex items-center gap-1">
                                      <Clock size={10} /> {new Date(act.timestamp).toLocaleString()}
                                  </span>
                              </div>
                              <p className="text-xs font-bold text-gray-800 dark:text-gray-200 leading-snug">{act.description}</p>
                              <div className="mt-2 flex items-center gap-1.5">
                                  <div className="w-4 h-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-400 group-hover:text-blue-500 transition-colors">
                                      <UserIcon size={10} />
                                  </div>
                                  <span className="text-[10px] font-bold text-gray-500">{act.userName}</span>
                              </div>
                          </div>
                      ))
                  )}
              </div>
          </div>

          {/* Individual Store Activity Cards */}
          {stores.map(store => (
              <div key={store.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden h-[500px]">
                  <div className="p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-xl">
                              <StoreIcon size={20} />
                          </div>
                          <h2 className="font-bold dark:text-white truncate max-w-[150px]">{store.name}</h2>
                      </div>
                      <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">STORE</span>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
                      {/* Fix: Passed store.id (number) to getStoreActivities */}
                      {getStoreActivities(store.id).length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50 space-y-2">
                              <Activity size={32} />
                              <p className="text-xs font-bold uppercase tracking-widest">No activities logged</p>
                          </div>
                      ) : (
                          // Fix: Passed store.id (number) to getStoreActivities
                          getStoreActivities(store.id).map(act => (
                              <div key={act.id} className="p-3 border-b dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors group">
                                  <div className="flex justify-between items-start mb-1">
                                      <span className={`text-[9px] font-black uppercase tracking-tighter ${getActionColor(act.action)}`}>{act.action}</span>
                                      <span className="text-[9px] text-gray-400 font-mono flex items-center gap-1">
                                          <Clock size={10} /> {new Date(act.timestamp).toLocaleTimeString()}
                                      </span>
                                  </div>
                                  <p className="text-xs font-bold text-gray-800 dark:text-gray-200 leading-snug">{act.description}</p>
                                  <div className="mt-2 flex items-center gap-1.5">
                                      <div className="w-4 h-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-400 group-hover:text-blue-500 transition-colors">
                                          <UserIcon size={10} />
                                      </div>
                                      <span className="text-[10px] font-bold text-gray-500">{act.userName}</span>
                                  </div>
                              </div>
                          ))
                      )}
                  </div>
              </div>
          ))}
      </div>
    </div>
  );
}
