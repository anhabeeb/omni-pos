
import React, { useEffect, useState, useMemo } from 'react';
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
  ArrowRight,
  Calendar,
  X,
  ChevronDown
} from 'lucide-react';
// Fix: useAuth should be imported from AuthContext
import { useAuth } from '../AuthContext';

const getActionColor = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('DELETE')) return 'text-red-500';
    if (act.includes('CREATE')) return 'text-green-500';
    if (act.includes('UPDATE')) return 'text-blue-500';
    if (act.includes('SHIFT')) return 'text-purple-500';
    return 'text-gray-500';
};

export default function SystemLogs() {
  const { user } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [activities, setActivities] = useState<SystemActivity[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Date Filtering State
  const [dateRange, setDateRange] = useState('TODAY');
  const [customStart, setCustomStart] = useState(new Date().toISOString().split('T')[0]);
  const [customEnd, setCustomEnd] = useState(new Date().toISOString().split('T')[0]);

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

  const getTimeRange = () => {
    let start = 0;
    let end = Date.now();
    const today = new Date();

    switch (dateRange) {
        case 'TODAY':
            today.setHours(0,0,0,0);
            start = today.getTime();
            const endToday = new Date();
            endToday.setHours(23,59,59,999);
            end = endToday.getTime();
            break;
        case 'YESTERDAY':
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            yesterday.setHours(0,0,0,0);
            start = yesterday.getTime();
            const endYesterday = new Date(yesterday);
            endYesterday.setHours(23,59,59,999);
            end = endYesterday.getTime();
            break;
        case 'WEEK':
            const week = new Date();
            week.setDate(week.getDate() - 7);
            week.setHours(0,0,0,0);
            start = week.getTime();
            break;
        case 'MONTH':
            const month = new Date();
            month.setDate(month.getDate() - 30);
            month.setHours(0,0,0,0);
            start = month.getTime();
            break;
        case 'CUSTOM':
            if (customStart) {
                const s = new Date(customStart);
                s.setHours(0,0,0,0);
                start = s.getTime();
            }
            if (customEnd) {
                const e = new Date(customEnd);
                e.setHours(23,59,59,999);
                end = e.getTime();
            }
            break;
        case 'ALL':
            start = 0;
            break;
    }
    return { start, end };
  };

  const filteredActivities = useMemo(() => {
      const { start, end } = getTimeRange();
      const term = searchTerm.toLowerCase();
      
      return activities.filter(a => {
          const matchesTime = a.timestamp >= start && a.timestamp <= end;
          const matchesSearch = !searchTerm || (
              a.userName.toLowerCase().includes(term) ||
              a.description.toLowerCase().includes(term) ||
              a.action.toLowerCase().includes(term)
          );
          return matchesTime && matchesSearch;
      });
  }, [activities, searchTerm, dateRange, customStart, customEnd]);

  const getStoreActivities = (storeId: number | null) => {
      return filteredActivities.filter(a => a.storeId === storeId).slice(0, 100);
  };

  if (user?.role !== UserRole.SUPER_ADMIN && user?.role !== UserRole.ADMIN) {
      return (
        <div className="p-20 text-center space-y-4">
            <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 text-red-500 mx-auto rounded-full flex items-center justify-center">
                <AlertTriangle size={40} />
            </div>
            <h1 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-widest">Access Denied</h1>
            <p className="text-gray-500 dark:text-gray-400 max-w-xs mx-auto text-sm">System audit logs are restricted to Super Administrators and Administrators only.</p>
        </div>
      );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
              <ScrollText className="text-blue-600" /> System Activity Logs
          </h1>
          <p className="text-gray-500 dark:text-gray-400">Complete audit trail of system operations across all locations.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
            {/* Date Range Selector */}
            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-all group">
                <Calendar size={16} className="ml-2 text-gray-400 group-focus-within:text-blue-500" />
                <select 
                    value={dateRange} 
                    onChange={e => setDateRange(e.target.value)} 
                    className="bg-transparent text-xs font-black uppercase tracking-widest outline-none dark:text-white pr-2 cursor-pointer"
                >
                    <option value="TODAY">Today</option>
                    <option value="YESTERDAY">Yesterday</option>
                    <option value="WEEK">Last 7 Days</option>
                    <option value="MONTH">Last 30 Days</option>
                    <option value="ALL">All Time</option>
                    <option value="CUSTOM">Custom Range</option>
                </select>
                {dateRange === 'CUSTOM' && (
                    <div className="flex items-center gap-2 pl-2 border-l dark:border-gray-700 ml-1">
                        <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="bg-transparent text-[10px] font-bold outline-none dark:text-white" />
                        <span className="text-gray-400">-</span>
                        <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="bg-transparent text-[10px] font-bold outline-none dark:text-white" />
                    </div>
                )}
            </div>

            {/* Global Search Bar */}
            <div className="relative group min-w-[280px]">
                <Search className="absolute left-3 top-2.5 text-gray-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                <input 
                    type="text" 
                    placeholder="Search user, action, or details..." 
                    className="pl-10 pr-10 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm w-full transition-all shadow-sm"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={16} />
                    </button>
                )}
            </div>

            <button 
                onClick={loadData}
                disabled={isRefreshing}
                className="p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm group"
                title="Refresh Logs"
            >
                <RefreshCw size={18} className={`text-gray-500 group-hover:text-blue-600 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
          {/* Global Activities Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden h-[600px]">
              <div className="p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-xl">
                          <Globe size={20} />
                      </div>
                      <h2 className="font-black text-xs uppercase tracking-widest dark:text-white">Global System Logs</h2>
                  </div>
                  <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded-full border border-purple-100 dark:border-purple-800">SYSTEM</span>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
                  {getStoreActivities(null).length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50 space-y-2">
                          <Database size={32} />
                          <p className="text-xs font-bold uppercase tracking-widest">No activities found</p>
                      </div>
                  ) : (
                      getStoreActivities(null).map(act => (
                          <div key={act.id} className="p-4 border-b dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors group relative">
                              <div className="flex justify-between items-start mb-1.5">
                                  <span className={`text-[10px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded bg-gray-50 dark:bg-gray-700/50 ${getActionColor(act.action)}`}>{act.action}</span>
                                  <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1">
                                      <Clock size={10} /> {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                  </span>
                              </div>
                              <p className="text-xs font-bold text-gray-800 dark:text-gray-200 leading-relaxed mb-3">{act.description}</p>
                              <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                      <div className="w-5 h-5 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-400 group-hover:text-blue-500 transition-colors">
                                          <UserIcon size={12} />
                                      </div>
                                      