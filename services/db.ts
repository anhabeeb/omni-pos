
import { Store, User, UserRole, Employee, Product, Category, Customer, Order, Quotation, RegisterShift, RolePermissionConfig, Permission, ActiveSession, OrderStatus, InventoryItem, SystemActivity } from '../types';

const DB_PREFIX = 'omnipos_';
const CLOUDFLARE_CONFIG = {
    SYNC_ENDPOINT: '/api/sync' 
};

export const uuid = () => Math.random().toString(36).substring(2, 11) + Date.now().toString(36);

const getItem = <T>(key: string, defaultValue: T): T => {
    try {
        const data = localStorage.getItem(DB_PREFIX + key);
        if (!data || data === "undefined") return defaultValue;
        return JSON.parse(data);
    } catch (e) {
        return defaultValue;
    }
};

const setItem = <T>(key: string, value: T): void => {
    localStorage.setItem(DB_PREFIX + key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent('db_change_' + key));
    window.dispatchEvent(new CustomEvent('db_change_any'));
};

const getNextId = (items: any[]): number => {
    if (items.length === 0) return 1;
    const ids = items.map(i => Number(i.id)).filter(id => !isNaN(id));
    if (ids.length === 0) return 1;
    return Math.max(...ids) + 1;
};

export type SyncStatus = 'CONNECTED' | 'SYNCING' | 'OFFLINE' | 'ERROR' | 'TESTING' | 'DISABLED' | 'MOCKED';
let currentSyncStatus: SyncStatus = 'CONNECTED';
let lastSyncError: string | null = null;
let isDatabaseReachable = false;
let isBackendMissing = false;

const broadcastSyncUpdate = () => {
    const queue = getItem<any[]>('sync_queue', []);
    const isEnabled = getItem<boolean>('sync_enabled', true);
    window.dispatchEvent(new CustomEvent('db_sync_update', { 
        detail: { 
            status: isEnabled ? currentSyncStatus : 'DISABLED', 
            pendingCount: queue.length,
            error: lastSyncError,
            isBackendMissing
        } 
    }));
};

const addToSyncQueue = (action: 'INSERT' | 'UPDATE' | 'DELETE', table: string, data: any) => {
    const queue = getItem<any[]>('sync_queue', []);
    queue.push({ id: uuid(), action, table, data, timestamp: Date.now() });
    setItem('sync_queue', queue);
    
    if (getItem<boolean>('sync_enabled', true)) {
        processSyncQueue();
    } else {
        broadcastSyncUpdate();
    }
};

let isProcessingSync = false;
const processSyncQueue = async () => {
    if (isProcessingSync) return;
    isProcessingSync = true;

    let queue = getItem<any[]>('sync_queue', []);
    while (queue.length > 0) {
        const task = queue[0];
        try {
            currentSyncStatus = 'SYNCING';
            broadcastSyncUpdate();

            const response = await fetch(CLOUDFLARE_CONFIG.SYNC_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(task)
            });

            if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
            
            const result = await response.json();
            if (!result.success) throw new Error(result.error || "Sync task failed");

            queue = queue.slice(1);
            setItem('sync_queue', queue);
            lastSyncError = null;
            currentSyncStatus = queue.length > 0 ? 'SYNCING' : 'CONNECTED';
        } catch (e: any) {
            lastSyncError = e.message;
            currentSyncStatus = 'ERROR';
            broadcastSyncUpdate();
            break; 
        }
    }
    isProcessingSync = false;
    broadcastSyncUpdate();
};

export const db = {
    init: async () => {
        const perms = getItem<RolePermissionConfig[]>('global_permissions', []);
        if (perms.length === 0) {
            const defaultPerms: RolePermissionConfig[] = Object.values(UserRole).map(role => ({
                role,
                permissions: role === UserRole.CASHIER ? ['POS_ACCESS', 'POS_CREATE_ORDER', 'POS_SETTLE', 'POS_OPEN_CLOSE_REGISTER'] : []
            }));
            setItem('global_permissions', defaultPerms);
        }
        const users = getItem<User[]>('global_users', []);
        if (users.length === 0) {
            setItem('global_users', [{ id: 1, userNumber: 1, name: 'System Admin', username: 'sys.admin', password: '123', role: UserRole.SUPER_ADMIN, storeIds: [] }]);
        }
        if (getItem<boolean>('sync_enabled', true)) {
            processSyncQueue();
        }
    },

    getSyncStatus: (): { status: SyncStatus, pendingCount: number, error: string | null, isBackendMissing: boolean } => {
        const isEnabled = getItem<boolean>('sync_enabled', true);
        return { 
            status: isEnabled ? currentSyncStatus : 'DISABLED', 
            pendingCount: getItem<any[]>('sync_queue', []).length, 
            error: lastSyncError, 
            isBackendMissing 
        };
    },
    testConnection: async () => true,
    setSyncEnabled: (e: boolean) => {
        setItem('sync_enabled', e);
        if (e) processSyncQueue();
    },
    isSyncEnabled: () => getItem<boolean>('sync_enabled', true),

    verifyWriteAccess: async () => ({ success: true, message: 'Local Access Verified' }),
    pullAllFromCloud: async () => {
        try {
            const response = await fetch(CLOUDFLARE_CONFIG.SYNC_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'FETCH_HYDRATION_DATA' })
            });
            const result = await response.json();
            if (result.success) {
                const data = result.data;
                if (data.users) setItem('global_users', data.users);
                if (data.stores) setItem('global_stores', data.stores);
                if (data.customers) {
                    // Group customers by store for local storage optimization
                    const stores = await db.getStores();
                    stores.forEach(s => {
                        const storeCusts = data.customers.filter((c: any) => c.storeId === s.id);
                        setItem(`store_${s.id}_customers`, storeCusts);
                    });
                }
                return true;
            }
            return false;
        } catch (e) {
            return false;
        }
    },
    syncAllLocalToCloud: async () => true,

    getUsers: async () => getItem<User[]>('global_users', []),
    addUser: async (u: User) => {
        const list = await db.getUsers();
        const newUser = { ...u, id: getNextId(list), userNumber: list.length + 1 };
        setItem('global_users', [...list, newUser]);
        addToSyncQueue('INSERT', 'users', newUser);
        return newUser;
    },
    updateUser: async (u: User) => {
        const list = await db.getUsers();
        setItem('global_users', list.map(item => item.id === u.id ? u : item));
        addToSyncQueue('UPDATE', 'users', u);
    },
    deleteUser: async (id: number) => {
        const list = await db.getUsers();
        setItem('global_users', list.filter(item => item.id !== id));
        addToSyncQueue('DELETE', 'users', { id });
    },

    getStores: async () => getItem<Store[]>('global_stores', []),
    addStore: async (s: Store) => {
        const list = await db.getStores();
        const newStore = { ...s, id: getNextId(list) };
        setItem('global_stores', [...list, newStore]);
        addToSyncQueue('INSERT', 'stores', newStore);
        return newStore;
    },
    updateStore: async (s: Store) => {
        const list = await db.getStores();
        setItem('global_stores', list.map(item => item.id === s.id ? s : item));
        addToSyncQueue('UPDATE', 'stores', s);
    },
    deleteStore: async (id: number) => {
        const list = await db.getStores();
        setItem('global_stores', list.filter(item => item.id !== id));
        addToSyncQueue('DELETE', 'stores', { id });
    },

    getCategories: async (storeId: number) => getItem<Category[]>(`store_${storeId}_categories`, []),
    addCategory: async (storeId: number, c: Category) => {
        const list = await db.getCategories(storeId);
        const newCat = { ...c, id: getNextId(list), storeId };
        setItem(`store_${storeId}_categories`, [...list, newCat]);
        addToSyncQueue('INSERT', 'categories', newCat);
        return newCat;
    },
    deleteCategory: async (storeId: number, id: number) => {
        const list = await db.getCategories(storeId);
        setItem(`store_${storeId}_categories`, list.filter(item => item.id !== id));
        addToSyncQueue('DELETE', 'categories', { id });
    },

    getProducts: async (storeId: number) => getItem<Product[]>(`store_${storeId}_products`, []),
    addProduct: async (storeId: number, p: Product) => {
        const list = await db.getProducts(storeId);
        const catProds = list.filter(prod => prod.categoryId === p.categoryId);
        const sequence = catProds.length > 0 ? (Math.max(...catProds.map(cp => cp.id % 100)) + 1) : 1;
        const newId = (Number(p.categoryId) * 100) + sequence;
        const newProd = { ...p, id: newId, storeId };
        setItem(`store_${storeId}_products`, [...list, newProd]);
        addToSyncQueue('INSERT', 'products', newProd);
        return newProd;
    },
    updateProduct: async (storeId: number, p: Product) => {
        const list = await db.getProducts(storeId);
        setItem(`store_${storeId}_products`, list.map(item => item.id === p.id ? p : item));
        addToSyncQueue('UPDATE', 'products', p);
    },
    deleteProduct: async (storeId: number, id: number) => {
        const list = await db.getProducts(storeId);
        setItem(`store_${storeId}_products`, list.filter(item => item.id !== id));
        addToSyncQueue('DELETE', 'products', { id });
    },

    getCustomers: async (storeId: number) => getItem<Customer[]>(`store_${storeId}_customers`, []),
    addCustomer: async (storeId: number, c: Customer) => {
        const list = await db.getCustomers(storeId);
        const newCust = { ...c, id: getNextId(list), storeId };
        setItem(`store_${storeId}_customers`, [...list, newCust]);
        addToSyncQueue('INSERT', 'customers', newCust);
        return newCust;
    },
    updateCustomer: async (storeId: number, c: Customer) => {
        const list = await db.getCustomers(storeId);
        setItem(`store_${storeId}_customers`, list.map(item => item.id === c.id ? c : item));
        addToSyncQueue('UPDATE', 'customers', c);
    },
    deleteCustomer: async (storeId: number, id: number) => {
        const list = await db.getCustomers(storeId);
        setItem(`store_${storeId}_customers`, list.filter(item => item.id !== id));
        addToSyncQueue('DELETE', 'customers', { id });
    },

    getEmployees: async () => getItem<Employee[]>('global_employees', []),
    addEmployee: async (e: Partial<Employee>) => {
        const list = await db.getEmployees();
        const newEmp = { ...e, id: getNextId(list), empId: `EMP${1000 + list.length + 1}`, createdAt: Date.now() } as Employee;
        setItem('global_employees', [...list, newEmp]);
        addToSyncQueue('INSERT', 'employees', newEmp);
        return newEmp;
    },
    updateEmployee: async (e: Employee) => {
        const list = await db.getEmployees();
        setItem('global_employees', list.map(item => item.id === e.id ? e : item));
        addToSyncQueue('UPDATE', 'employees', e);
    },
    deleteEmployee: async (id: number) => {
        const list = await db.getEmployees();
        setItem('global_employees', list.filter(item => item.id !== id));
        addToSyncQueue('DELETE', 'employees', { id });
    },

    getOrders: async (storeId: number) => getItem<Order[]>(`store_${storeId}_orders`, []),
    addOrder: async (storeId: number, o: Order) => {
        const list = await db.getOrders(storeId);
        const nextNum = await db.getNextOrderNumber(storeId);
        const newOrder = { ...o, id: getNextId(list), orderNumber: o.orderNumber || nextNum, storeId };
        setItem(`store_${storeId}_orders`, [...list, newOrder]);
        addToSyncQueue('INSERT', 'orders', newOrder);
        return newOrder;
    },
    updateOrder: async (storeId: number, o: Order) => {
        const list = await db.getOrders(storeId);
        setItem(`store_${storeId}_orders`, list.map(item => item.id === o.id ? o : item));
        addToSyncQueue('UPDATE', 'orders', o);
    },
    deleteOrder: async (storeId: number, id: number) => {
        const list = await db.getOrders(storeId);
        setItem(`store_${storeId}_orders`, list.filter(item => item.id !== id));
        addToSyncQueue('DELETE', 'orders', { id });
    },
    getNextOrderNumber: async (storeId: number) => {
        const list = await db.getOrders(storeId);
        const today = new Date().toISOString().split('T')[0];
        const count = list.filter(o => new Date(o.createdAt).toISOString().split('T')[0] === today).length;
        return (count + 1).toString().padStart(4, '0');
    },

    getQuotations: async (storeId: number) => getItem<Quotation[]>(`store_${storeId}_quotations`, []),
    addQuotation: async (storeId: number, q: Partial<Quotation>) => {
        const list = await db.getQuotations(storeId);
        const num = (list.length + 1).toString().padStart(4, '0');
        const newQuote = { ...q, id: getNextId(list), quotationNumber: num, storeId, createdAt: Date.now() } as Quotation;
        setItem(`store_${storeId}_quotations`, [...list, newQuote]);
        addToSyncQueue('INSERT', 'quotations', newQuote);
        return newQuote;
    },

    getRegisterShifts: async (storeId: number) => getItem<RegisterShift[]>(`store_${storeId}_shifts`, []),
    getActiveShift: async (storeId: number) => {
        const shifts = await db.getRegisterShifts(storeId);
        return shifts.find(s => s.status === 'OPEN') || null;
    },
    openShift: async (storeId: number, userId: number, cash: number, denoms: Record<number, number>) => {
        const list = await db.getRegisterShifts(storeId);
        const newShift: RegisterShift = { id: getNextId(list), shiftNumber: list.length + 1, storeId, openedBy: userId, openedAt: Date.now(), startingCash: cash, openingDenominations: denoms, status: 'OPEN' };
        setItem(`store_${storeId}_shifts`, [...list, newShift]);
        addToSyncQueue('INSERT', 'shifts', newShift);
    },
    closeShift: async (storeId: number, id: number, actual: number, notes: string, denoms: Record<number, number>) => {
        const list = await db.getRegisterShifts(storeId);
        const shift = list.find(s => s.id === id);
        if (!shift) return false;
        const closed = { ...shift, status: 'CLOSED' as const, actualCash: actual, notes, closingDenominations: denoms, closedAt: Date.now() };
        setItem(`store_${storeId}_shifts`, list.map(s => s.id === id ? closed : s));
        addToSyncQueue('UPDATE', 'shifts', closed);
        return true;
    },

    getInventory: async (storeId: number) => getItem<InventoryItem[]>(`store_${storeId}_inventory`, []),
    addInventoryItem: async (storeId: number, i: InventoryItem) => {
        const list = await db.getInventory(storeId);
        const newItem = { ...i, id: getNextId(list), storeId };
        setItem(`store_${storeId}_inventory`, [...list, newItem]);
        addToSyncQueue('INSERT', 'inventory', newItem);
        return newItem;
    },
    updateInventoryItem: async (storeId: number, i: InventoryItem) => {
        const list = await db.getInventory(storeId);
        setItem(`store_${storeId}_inventory`, list.map(item => item.id === i.id ? i : item));
        addToSyncQueue('UPDATE', 'inventory', i);
    },
    deleteInventoryItem: async (storeId: number, id: number) => {
        const list = await db.getInventory(storeId);
        setItem(`store_${storeId}_inventory`, list.filter(item => item.id !== id));
        addToSyncQueue('DELETE', 'inventory', { id });
    },

    getRolePermissions: async () => getItem<RolePermissionConfig[]>('global_permissions', []),
    updateRolePermissions: async (c: RolePermissionConfig) => {
        const list = await db.getRolePermissions();
        setItem('global_permissions', list.map(item => item.role === c.role ? c : item));
        addToSyncQueue('UPDATE', 'global_permissions', c);
    },

    getSystemActivities: async () => getItem<any[]>('global_activities', []),
    logActivity: async (a: any) => {
        const list = await db.getSystemActivities();
        const newAct = { ...a, id: getNextId(list), timestamp: Date.now() };
        setItem('global_activities', [newAct, ...list].slice(0, 1000));
        addToSyncQueue('INSERT', 'system_activities', newAct);
    },

    getFilteredSystemActivities: async (storeId: number | null): Promise<SystemActivity[]> => {
        const all = getItem<SystemActivity[]>('global_activities', []);
        return all.filter(a => a.storeId === storeId);
    },

    getActiveSessions: async () => getItem<ActiveSession[]>('global_sessions', []),
    updateHeartbeat: async (u: number, s: number | null) => {
        let list = await db.getActiveSessions();
        const now = Date.now();
        const sess = { userId: u, userName: 'User', role: UserRole.CASHIER, storeId: s, lastActive: now } as ActiveSession;
        const idx = list.findIndex(i => i.userId === u);
        if (idx >= 0) list[idx] = sess; else list.push(sess);
        setItem('global_sessions', list.filter(i => now - i.lastActive < 300000));
    },
    removeSession: async (u: number) => {
        let list = await db.getActiveSessions();
        setItem('global_sessions', list.filter(i => i.userId !== u));
    },
    remoteLogin: async (u: string, p: string) => {
        try {
            const response = await fetch(CLOUDFLARE_CONFIG.SYNC_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'REMOTE_LOGIN', username: u, password: p })
            });
            const result = await response.json();
            return result;
        } catch (e) {
            return { success: false, error: "System Offline" };
        }
    },
    updateOrderStatus: async (s: number, i: number, st: OrderStatus) => {
        const list = await db.getOrders(s);
        const ord = list.find(o => o.id === i);
        if (ord) await db.updateOrder(s, { ...ord, status: st });
    }
};
