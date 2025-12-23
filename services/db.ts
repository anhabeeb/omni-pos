
import { Store, User, UserRole, Employee, Product, Category, Customer, Order, Quotation, RegisterShift, RolePermissionConfig, Permission, ActiveSession, OrderStatus, InventoryItem } from '../types';

const CLOUDFLARE_CONFIG = {
    DB_NAME: 'pos',
    DB_ID: '5657e25b-bcdb-4fb8-9a2b-4b1f80259e9f',
    SYNC_ENDPOINT: '/api/sync' 
};

const DB_PREFIX = 'omnipos_';

export const uuid = () => Math.random().toString(36).substring(2, 11) + Date.now().toString(36);

const getItem = <T>(key: string, defaultValue: T): T => {
    try {
        const data = localStorage.getItem(DB_PREFIX + key);
        if (!data || data === "undefined") return defaultValue;
        return JSON.parse(data);
    } catch (e) {
        console.error(`DB Error: Failed to parse key "${key}"`, e);
        return defaultValue;
    }
};

const setItem = <T>(key: string, value: T): void => {
    localStorage.setItem(DB_PREFIX + key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent('db_change_' + key));
    window.dispatchEvent(new CustomEvent('db_change_any'));
};

interface SyncTask {
    id: string;
    action: 'INSERT' | 'UPDATE' | 'DELETE' | 'PING' | 'WRITE_TEST' | 'GET_EXISTING_IDS' | 'FETCH_HYDRATION_DATA' | 'REMOTE_LOGIN' | 'HEARTBEAT' | 'LOGOUT';
    table?: string;
    data?: any;
    storeId?: string;
    username?: string;
    password?: string;
    userId?: string;
    timestamp: number;
    attempts: number;
}

export type SyncStatus = 'CONNECTED' | 'SYNCING' | 'OFFLINE' | 'ERROR' | 'TESTING' | 'DISABLED' | 'MOCKED';
let currentSyncStatus: SyncStatus = 'CONNECTED';
let lastSyncError: string | null = null;
let isDatabaseReachable = false;
let isBackendMissing = false;

const getSyncQueue = (): SyncTask[] => getItem<SyncTask[]>('sync_queue', []);
const saveSyncQueue = (queue: SyncTask[]) => {
    setItem('sync_queue', queue);
    broadcastSyncUpdate();
};

const broadcastSyncUpdate = () => {
    const queue = getSyncQueue();
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

const handleSyncResponse = async (response: Response) => {
    const verification = response.headers.get('X-OmniPOS-Verification');
    const text = await response.text();

    if (verification !== 'authorized') {
        if (text.toLowerCase().includes("hello world")) {
            currentSyncStatus = 'MOCKED';
            throw new Error("Cloudflare Worker detected, but it is not responding with the OmniPOS authorized headers.");
        }
        throw new Error("Backend mismatch: API route returned unexpected content.");
    }

    try {
        return JSON.parse(text);
    } catch (e) {
        throw new Error(`Invalid Backend Response: ${text.substring(0, 50)}...`);
    }
};

const addToSyncQueue = (action: 'INSERT' | 'UPDATE' | 'DELETE', table: string, data: any) => {
    const queue = getSyncQueue();
    const task: SyncTask = {
        id: uuid(),
        action,
        table,
        data,
        timestamp: Date.now(),
        attempts: 0
    };
    saveSyncQueue([...queue, task]);
    
    if (getItem<boolean>('sync_enabled', true)) {
        processSyncQueue();
    }
};

const batchAddTasksToSyncQueue = (tasks: { action: 'INSERT' | 'UPDATE' | 'DELETE', table: string, data: any }[]) => {
    const currentQueue = getSyncQueue();
    const newTasks: SyncTask[] = tasks.map(t => ({
        id: uuid(),
        action: t.action,
        table: t.table,
        data: t.data,
        timestamp: Date.now(),
        attempts: 0
    }));
    saveSyncQueue([...currentQueue, ...newTasks]);
    
    if (getItem<boolean>('sync_enabled', true)) {
        processSyncQueue();
    }
};

let isProcessingSync = false;
const processSyncQueue = async () => {
    if (isProcessingSync) return;
    if (!getItem<boolean>('sync_enabled', true)) return;
    
    isProcessingSync = true;
    
    if (!isDatabaseReachable) {
        currentSyncStatus = 'TESTING';
        broadcastSyncUpdate();
        const ok = await db.testConnection();
        if (!ok) {
            isProcessingSync = false;
            return; 
        }
    }

    let queue = getSyncQueue();
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

            if (response.status === 404) {
                isBackendMissing = true;
                throw new Error("Backend API route (/api/sync) is missing.");
            }

            const result = await handleSyncResponse(response);

            if (!response.ok || result.success === false) {
                throw new Error(result.error || `Server Error ${response.status}`);
            }

            queue = queue.slice(1);
            saveSyncQueue(queue);
            lastSyncError = null;
            isBackendMissing = false;
            currentSyncStatus = queue.length > 0 ? 'SYNCING' : 'CONNECTED';
        } catch (e: any) {
            console.error('Sync process interrupted:', e);
            lastSyncError = e.message;
            currentSyncStatus = e.message.includes('intercepted') ? 'MOCKED' : (navigator.onLine ? 'ERROR' : 'OFFLINE');
            isDatabaseReachable = false; 
            broadcastSyncUpdate();
            break; 
        }
    }
    isProcessingSync = false;
};

window.addEventListener('online', async () => {
    isDatabaseReachable = false;
    isBackendMissing = false;
    const ok = await db.testConnection();
    if (ok) {
        // Automatic full sync on reconnection
        await db.syncAllLocalToCloud();
        await db.pullAllFromCloud();
        processSyncQueue();
    }
});

export const db = {
    testConnection: async (): Promise<boolean> => {
        if (!getItem<boolean>('sync_enabled', true)) return false;

        try {
            const response = await fetch(CLOUDFLARE_CONFIG.SYNC_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'PING' })
            });

            if (response.status === 404) {
                isBackendMissing = true;
                throw new Error("Sync endpoint not found (404).");
            }

            const result = await handleSyncResponse(response);

            if (result.success) {
                isDatabaseReachable = true;
                isBackendMissing = false;
                lastSyncError = null;
                currentSyncStatus = getSyncQueue().length > 0 ? 'SYNCING' : 'CONNECTED';
                broadcastSyncUpdate();
                return true;
            }
            throw new Error(result.error || "Ping failed");
        } catch (e: any) {
            isDatabaseReachable = false;
            lastSyncError = e.message;
            currentSyncStatus = e.message.includes('intercepted') ? 'MOCKED' : (navigator.onLine ? 'ERROR' : 'OFFLINE');
            broadcastSyncUpdate();
            return false;
        }
    },

    setSyncEnabled: (enabled: boolean) => {
        setItem('sync_enabled', enabled);
        if (enabled) {
            isBackendMissing = false;
            db.testConnection().then(ok => {
                if (ok) {
                    db.syncAllLocalToCloud().then(() => {
                        db.pullAllFromCloud().then(() => {
                            processSyncQueue();
                        });
                    });
                }
            });
        } else {
            broadcastSyncUpdate();
        }
    },

    isSyncEnabled: () => getItem<boolean>('sync_enabled', true),

    verifyWriteAccess: async (): Promise<{success: boolean, message: string, hint?: string, is404?: boolean, trace?: string}> => {
        try {
            const response = await fetch(CLOUDFLARE_CONFIG.SYNC_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'WRITE_TEST' })
            });

            const verification = response.headers.get('X-OmniPOS-Verification');

            if (response.status === 404) {
                return { 
                    success: false, 
                    message: "API route /api/sync returned 404.", 
                    hint: "Ensure your worker is correctly deployed.",
                    is404: true
                };
            }

            if (verification !== 'authorized') {
                return {
                    success: false,
                    message: "Generic Cloudflare response detected.",
                    hint: "Verify worker deployment."
                };
            }

            const result = await handleSyncResponse(response);
            if (result.success) return { success: true, message: result.message };
            return { success: false, message: result.error, hint: result.hint };
        } catch (e: any) {
            return { success: false, message: e.message, hint: "Check internet connection." };
        }
    },

    getServerIds: async (table: string, storeId?: string): Promise<{ids: string[], orderNumbers?: string[]}> => {
        try {
            const response = await fetch(CLOUDFLARE_CONFIG.SYNC_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'GET_EXISTING_IDS', table, storeId })
            });
            const result = await handleSyncResponse(response);
            return { ids: result.ids || [], orderNumbers: result.orderNumbers || [] };
        } catch (e) {
            console.error(`Failed to fetch server IDs for ${table}`, e);
            return { ids: [] };
        }
    },

    remoteLogin: async (username: string, password: string): Promise<{success: boolean, user?: User, error?: string}> => {
        try {
            const response = await fetch(CLOUDFLARE_CONFIG.SYNC_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'REMOTE_LOGIN', username, password })
            });
            const result = await handleSyncResponse(response);
            if (result.success) return { success: true, user: result.user };
            return { success: false, error: result.error };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    },

    serverHeartbeat: async (userId: string) => {
        try {
            await fetch(CLOUDFLARE_CONFIG.SYNC_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'HEARTBEAT', userId })
            });
        } catch (e) {
            console.warn("Server heartbeat failed", e);
        }
    },

    serverLogout: async (userId: string) => {
        try {
            await fetch(CLOUDFLARE_CONFIG.SYNC_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'LOGOUT', userId })
            });
        } catch (e) {
            console.warn("Server logout notification failed", e);
        }
    },

    pullAllFromCloud: async (): Promise<boolean> => {
        try {
            currentSyncStatus = 'SYNCING';
            broadcastSyncUpdate();

            const response = await fetch(CLOUDFLARE_CONFIG.SYNC_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'FETCH_HYDRATION_DATA' })
            });

            const result = await handleSyncResponse(response);
            if (!result.success) throw new Error(result.error);

            const data = result.data;

            // Hydrate Global Tables
            setItem('global_users', data.users || []);
            setItem('global_stores', data.stores || []);
            setItem('global_employees', data.employees || []);
            setItem('global_permissions', data.global_permissions || []);

            // Hydrate Store-Specific Tables
            const storeIds = (data.stores || []).map((s: any) => s.id);
            for (const sid of storeIds) {
                setItem(`store_${sid}_products`, (data.products || []).filter((p: any) => p.storeId === sid));
                setItem(`store_${sid}_categories`, (data.categories || []).filter((c: any) => c.storeId === sid));
                setItem(`store_${sid}_customers`, (data.customers || []).filter((c: any) => c.storeId === sid));
                setItem(`store_${sid}_inventory`, (data.inventory || []).filter((i: any) => i.storeId === sid));
                setItem(`store_${sid}_orders`, (data.orders || []).filter((o: any) => o.storeId === sid));
                setItem(`store_${sid}_quotations`, (data.quotations || []).filter((q: any) => q.storeId === sid));
                setItem(`store_${sid}_shifts`, (data.shifts || []).filter((s: any) => s.storeId === sid));
            }

            currentSyncStatus = 'CONNECTED';
            broadcastSyncUpdate();
            return true;
        } catch (e: any) {
            console.error("Hydration failed:", e);
            lastSyncError = e.message;
            currentSyncStatus = 'ERROR';
            broadcastSyncUpdate();
            return false;
        }
    },

    syncAllLocalToCloud: async () => {
        const tasks: { action: 'INSERT' | 'UPDATE' | 'DELETE', table: string, data: any }[] = [];
        
        const stores = await db.getStores();
        const users = await db.getUsers();
        const emps = await db.getEmployees();
        const perms = await db.getRolePermissions();

        // Push Global Data
        users.forEach(u => tasks.push({ action: 'INSERT', table: 'users', data: u }));
        stores.forEach(s => tasks.push({ action: 'INSERT', table: 'stores', data: s }));
        emps.forEach(e => tasks.push({ action: 'INSERT', table: 'employees', data: e }));
        perms.forEach(p => tasks.push({ action: 'UPDATE', table: 'global_permissions', data: p }));

        // Push Store-Specific Data with Conflict Resolution
        for (const store of stores) {
            const [prods, cats, custs, inv, orders, quotes, shifts] = await Promise.all([
                db.getProducts(store.id),
                db.getCategories(store.id),
                db.getCustomers(store.id),
                db.getInventory(store.id),
                db.getOrders(store.id),
                db.getQuotations(store.id),
                db.getRegisterShifts(store.id)
            ]);

            const serverState = await db.getServerIds('orders', store.id);
            const serverOrderNumbers = new Set(serverState.orderNumbers || []);
            const serverIds = new Set(serverState.ids || []);

            let updatedOrders = [...orders];
            let ordersChanged = false;

            updatedOrders.forEach((o) => {
                let collision = false;
                if (serverIds.has(o.id)) { o.id = uuid(); collision = true; }
                while (serverOrderNumbers.has(o.orderNumber)) {
                    const currentNum = parseInt(o.orderNumber) || 0;
                    o.orderNumber = (currentNum + 1).toString().padStart(4, '0');
                    collision = true;
                }
                if (collision) {
                    serverIds.add(o.id);
                    serverOrderNumbers.add(o.orderNumber);
                    ordersChanged = true;
                }
                tasks.push({ action: 'INSERT', table: 'orders', data: o });
            });

            if (ordersChanged) setItem(`store_${store.id}_orders`, updatedOrders);

            prods.forEach(p => tasks.push({ action: 'INSERT', table: 'products', data: p }));
            cats.forEach(c => tasks.push({ action: 'INSERT', table: 'categories', data: c }));
            custs.forEach(c => tasks.push({ action: 'INSERT', table: 'customers', data: c }));
            inv.forEach(i => tasks.push({ action: 'INSERT', table: 'inventory', data: i }));
            quotes.forEach(q => tasks.push({ action: 'INSERT', table: 'quotations', data: q }));
            shifts.forEach(s => tasks.push({ action: 'INSERT', table: 'shifts', data: s }));
        }

        if (tasks.length > 0) batchAddTasksToSyncQueue(tasks);
        return true;
    },

    init: async () => {
        // 1. Setup default local data structure
        const perms = getItem<RolePermissionConfig[]>('global_permissions', []);
        if (perms.length === 0) {
            const defaultPerms: RolePermissionConfig[] = Object.values(UserRole).map(role => {
                let permissions: Permission[] = [];
                if (role === UserRole.CASHIER) {
                    permissions = ['POS_ACCESS', 'POS_CREATE_ORDER', 'POS_SETTLE', 'POS_OPEN_CLOSE_REGISTER'];
                } else if (role === UserRole.ACCOUNTANT) {
                    permissions = ['VIEW_HISTORY', 'VIEW_QUOTATIONS', 'MANAGE_CUSTOMERS', 'VIEW_REPORTS'];
                }
                return { role, permissions };
            });
            setItem('global_permissions', defaultPerms);
        }

        const users = getItem<User[]>('global_users', []);
        if (users.length === 0) {
            const admin: User = {
                id: uuid(),
                userNumber: 1,
                name: 'System Admin',
                username: 'sys.admin',
                password: '123',
                role: UserRole.SUPER_ADMIN,
                storeIds: []
            };
            setItem('global_users', [admin]);
        }

        // 2. Automated Cloud Sync & Pull if online
        if (getItem<boolean>('sync_enabled', true)) {
            const online = await db.testConnection();
            if (online) {
                // First push local changes (resolving ID conflicts)
                await db.syncAllLocalToCloud();
                // Then pull latest state from central DB
                await db.pullAllFromCloud();
                // Process any individual items in queue
                processSyncQueue();
            }
        }
    },

    getSyncStatus: () => ({
        status: getItem<boolean>('sync_enabled', true) ? currentSyncStatus : 'DISABLED',
        pendingCount: getSyncQueue().length,
        error: lastSyncError,
        isBackendMissing
    }),

    getUsers: async () => getItem<User[]>('global_users', []),
    addUser: async (u: User) => {
        const users = await db.getUsers();
        const newUser = { ...u, id: u.id || uuid(), userNumber: users.length + 1 };
        setItem('global_users', [...users, newUser]);
        addToSyncQueue('INSERT', 'users', newUser);
        return newUser;
    },
    updateUser: async (u: User) => {
        const users = await db.getUsers();
        setItem('global_users', users.map(user => user.id === u.id ? u : user));
        addToSyncQueue('UPDATE', 'users', u);
    },
    deleteUser: async (id: string) => {
        const users = await db.getUsers();
        setItem('global_users', users.filter(u => u.id !== id));
        addToSyncQueue('DELETE', 'users', { id });
    },
    getActiveSessions: async () => getItem<ActiveSession[]>('global_sessions', []),
    updateHeartbeat: async (userId: string, storeId: string | null) => {
        const users = await db.getUsers();
        const user = users.find(u => u.id === userId);
        if (!user) return;
        let sessions = await db.getActiveSessions();
        const now = Date.now();
        const existingIdx = sessions.findIndex(s => s.userId === userId);
        const session: ActiveSession = { userId, userName: user.name, role: user.role, storeId, lastActive: now };
        if (existingIdx >= 0) sessions[existingIdx] = session; else sessions.push(session);
        sessions = sessions.filter(s => now - s.lastActive < 300000);
        setItem('global_sessions', sessions);
        
        // Notify server to keep session alive globally
        db.serverHeartbeat(userId);
    },
    removeSession: async (userId: string) => {
        let sessions = await db.getActiveSessions();
        sessions = sessions.filter(s => s.userId !== userId);
        setItem('global_sessions', sessions);
        
        // Notify server to release session lock
        db.serverLogout(userId);
    },
    getRolePermissions: async () => getItem<RolePermissionConfig[]>('global_permissions', []),
    updateRolePermissions: async (config: RolePermissionConfig) => {
        const configs = await db.getRolePermissions();
        setItem('global_permissions', configs.map(c => c.role === config.role ? config : c));
        addToSyncQueue('UPDATE', 'global_permissions', config);
    },
    getEmployees: async () => getItem<Employee[]>('global_employees', []),
    addEmployee: async (data: Partial<Employee>) => {
        const emps = await db.getEmployees();
        const newEmp: Employee = { ...data, id: uuid(), empId: `EMP${1000 + emps.length + 1}`, createdAt: Date.now() } as Employee;
        setItem('global_employees', [...emps, newEmp]);
        addToSyncQueue('INSERT', 'employees', newEmp);
        return newEmp;
    },
    updateEmployee: async (emp: Employee) => {
        const emps = await db.getEmployees();
        setItem('global_employees', emps.map(e => e.id === emp.id ? emp : e));
        addToSyncQueue('UPDATE', 'employees', emp);
    },
    deleteEmployee: async (id: string) => {
        const emps = await db.getEmployees();
        setItem('global_employees', emps.filter(e => e.id !== id));
        addToSyncQueue('DELETE', 'employees', { id });
    },
    getStores: async () => getItem<Store[]>('global_stores', []),
    addStore: async (s: Store) => {
        const stores = await db.getStores();
        const newStore = { ...s, id: uuid() };
        setItem('global_stores', [...stores, newStore]);
        addToSyncQueue('INSERT', 'stores', newStore);
        return newStore;
    },
    updateStore: async (s: Store) => {
        const stores = await db.getStores();
        setItem('global_stores', stores.map(st => st.id === s.id ? s : st));
        addToSyncQueue('UPDATE', 'stores', s);
    },
    deleteStore: async (id: string) => {
        const stores = await db.getStores();
        setItem('global_stores', stores.filter(s => s.id !== id));
        addToSyncQueue('DELETE', 'stores', { id });
    },
    getProducts: async (storeId: string) => getItem<Product[]>(`store_${storeId}_products`, []),
    addProduct: async (storeId: string, p: Product) => {
        const prods = await db.getProducts(storeId);
        const newProd = { ...p, id: uuid(), storeId };
        setItem(`store_${storeId}_products`, [...prods, newProd]);
        addToSyncQueue('INSERT', 'products', newProd);
        return newProd;
    },
    updateProduct: async (storeId: string, p: Product) => {
        const prods = await db.getProducts(storeId);
        setItem(`store_${storeId}_products`, prods.map(prod => prod.id === p.id ? p : prod));
        addToSyncQueue('UPDATE', 'products', p);
    },
    deleteProduct: async (storeId: string, id: string) => {
        const prods = await db.getProducts(storeId);
        setItem(`store_${storeId}_products`, prods.filter(p => p.id !== id));
        addToSyncQueue('DELETE', 'products', { id });
    },
    getCategories: async (storeId: string) => getItem<Category[]>(`store_${storeId}_categories`, []),
    addCategory: async (storeId: string, c: Category) => {
        const cats = await db.getCategories(storeId);
        const newCat = { ...c, id: uuid(), storeId };
        setItem(`store_${storeId}_categories`, [...cats, newCat]);
        addToSyncQueue('INSERT', 'categories', newCat);
        return newCat;
    },
    deleteCategory: async (storeId: string, id: string) => {
        const cats = await db.getCategories(storeId);
        setItem(`store_${storeId}_categories`, cats.filter(c => c.id !== id));
        addToSyncQueue('DELETE', 'categories', { id });
    },
    getCustomers: async (storeId: string) => getItem<Customer[]>(`store_${storeId}_customers`, []),
    addCustomer: async (storeId: string, c: Customer) => {
        const custs = await db.getCustomers(storeId);
        const newCust = { ...c, id: uuid(), storeId };
        setItem(`store_${storeId}_customers`, [...custs, newCust]);
        addToSyncQueue('INSERT', 'customers', newCust);
        return newCust;
    },
    updateCustomer: async (storeId: string, c: Customer) => {
        const custs = await db.getCustomers(storeId);
        setItem(`store_${storeId}_customers`, custs.map(cust => cust.id === c.id ? c : cust));
        addToSyncQueue('UPDATE', 'customers', c);
    },
    deleteCustomer: async (id: string, storeId: string) => {
        const custs = await db.getCustomers(storeId);
        setItem(`store_${storeId}_customers`, custs.filter(c => c.id !== id));
        addToSyncQueue('DELETE', 'customers', { id });
    },
    getInventory: async (storeId: string) => getItem<InventoryItem[]>(`store_${storeId}_inventory`, []),
    addInventoryItem: async (storeId: string, i: InventoryItem) => {
        const items = await db.getInventory(storeId);
        const newItem = { ...i, id: uuid(), storeId };
        setItem(`store_${storeId}_inventory`, [...items, newItem]);
        addToSyncQueue('INSERT', 'inventory', newItem);
        return newItem;
    },
    updateInventoryItem: async (storeId: string, i: InventoryItem) => {
        const items = await db.getInventory(storeId);
        setItem(`store_${storeId}_inventory`, items.map(item => item.id === i.id ? i : item));
        addToSyncQueue('UPDATE', 'inventory', i);
    },
    deleteInventoryItem: async (storeId: string, id: string) => {
        const items = await db.getInventory(storeId);
        setItem(`store_${storeId}_inventory`, items.filter(i => i.id !== id));
        addToSyncQueue('DELETE', 'inventory', { id });
    },
    getOrders: async (storeId: string) => getItem<Order[]>(`store_${storeId}_orders`, []),
    addOrder: async (storeId: string, o: Order) => {
        const orders = await db.getOrders(storeId);
        const nextNum = await db.getNextOrderNumber(storeId);
        const newOrder = { ...o, id: o.id || uuid(), orderNumber: o.orderNumber || nextNum, storeId };
        setItem(`store_${storeId}_orders`, [...orders, newOrder]);
        addToSyncQueue('INSERT', 'orders', newOrder);
        return newOrder;
    },
    updateOrder: async (storeId: string, o: Order) => {
        const orders = await db.getOrders(storeId);
        setItem(`store_${storeId}_orders`, orders.map(order => order.id === o.id ? o : order));
        addToSyncQueue('UPDATE', 'orders', o);
    },
    updateOrderStatus: async (storeId: string, orderId: string, status: OrderStatus) => {
        const orders = await db.getOrders(storeId);
        const order = orders.find(o => o.id === orderId);
        if (order) {
            const updated = { ...order, status };
            await db.updateOrder(storeId, updated);
        }
    },
    deleteOrder: async (storeId: string, id: string) => {
        const orders = await db.getOrders(storeId);
        setItem(`store_${storeId}_orders`, orders.filter(o => o.id !== id));
        addToSyncQueue('DELETE', 'orders', { id });
    },
    getNextOrderNumber: async (storeId: string) => {
        const orders = await db.getOrders(storeId);
        const today = new Date().toISOString().split('T')[0];
        const todayOrders = orders.filter(o => new Date(o.createdAt).toISOString().split('T')[0] === today);
        return (todayOrders.length + 1).toString().padStart(4, '0');
    },
    getQuotations: async (storeId: string) => getItem<Quotation[]>(`store_${storeId}_quotations`, []),
    addQuotation: async (storeId: string, q: Partial<Quotation>) => {
        const quotes = await db.getQuotations(storeId);
        const today = new Date().toISOString().split('T')[0];
        const todayQuotes = quotes.filter(o => new Date(o.createdAt).toISOString().split('T')[0] === today);
        const nextNum = (todayQuotes.length + 1).toString().padStart(4, '0');
        const newQuote = { ...q, id: uuid(), quotationNumber: nextNum, storeId, createdAt: Date.now() } as Quotation;
        setItem(`store_${storeId}_quotations`, [...quotes, newQuote]);
        addToSyncQueue('INSERT', 'quotations', newQuote);
        return newQuote;
    },
    getRegisterShifts: async (storeId: string) => getItem<RegisterShift[]>(`store_${storeId}_shifts`, []),
    getActiveShift: async (storeId: string) => {
        const shifts = await db.getRegisterShifts(storeId);
        return shifts.find(s => s.status === 'OPEN') || null;
    },
    openShift: async (storeId: string, userId: string, startingCash: number, denominations: Record<number, number>) => {
        const shifts = await db.getRegisterShifts(storeId);
        const newShift: RegisterShift = { id: uuid(), shiftNumber: shifts.length + 1, storeId, openedBy: userId, openedAt: Date.now(), startingCash, openingDenominations: denominations, status: 'OPEN' };
        setItem(`store_${storeId}_shifts`, [...shifts, newShift]);
        addToSyncQueue('INSERT', 'shifts', newShift);
    },
    closeShift: async (storeId: string, shiftId: string, actualCash: number, notes: string, denominations: Record<number, number>) => {
        const shifts = await db.getRegisterShifts(storeId);
        const shiftIdx = shifts.findIndex(s => s.id === shiftId);
        if (shiftIdx < 0) return false;
        const shift = shifts[shiftIdx];
        const orders = await db.getOrders(storeId);
        const shiftOrders = orders.filter(o => o.shiftId === shiftId);
        let totalCashSales = 0;
        let totalCashRefunds = 0;
        shiftOrders.forEach(o => {
            if (o.paymentMethod === 'CASH') {
                if (o.status === OrderStatus.COMPLETED) totalCashSales += o.total;
                if (o.status === OrderStatus.RETURNED) totalCashRefunds += o.total;
            }
        });
        const expectedCash = shift.startingCash + totalCashSales - totalCashRefunds;
        const closedShift: RegisterShift = { ...shift, status: 'CLOSED', closedAt: Date.now(), actualCash, expectedCash, difference: actualCash - expectedCash, totalCashSales, totalCashRefunds, heldOrdersCount: shiftOrders.filter(o => o.status === OrderStatus.ON_HOLD).length, notes, closingDenominations: denominations };
        setItem(`store_${storeId}_shifts`, shifts.map(s => s.id === shiftId ? closedShift : s));
        addToSyncQueue('UPDATE', 'shifts', closedShift);
        return true;
    }
};
