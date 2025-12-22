import { Store, User, UserRole, Employee, Product, Category, Customer, Order, Quotation, RegisterShift, RolePermissionConfig, Permission, ActiveSession, OrderStatus, InventoryItem } from '../types';

const CLOUDFLARE_CONFIG = {
    DB_NAME: 'omni-pos',
    DB_ID: 'a50fddea-e22f-419c-afb8-6c40464e4a6a',
    SYNC_ENDPOINT: '/api/sync' 
};

const DB_PREFIX = 'omnipos_';

// Unique ID generator
export const uuid = () => Math.random().toString(36).substring(2, 11) + Date.now().toString(36);

// Helper for localStorage retrieval
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

// Helper for localStorage persistence and event dispatching
const setItem = <T>(key: string, value: T): void => {
    localStorage.setItem(DB_PREFIX + key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent('db_change_' + key));
    window.dispatchEvent(new CustomEvent('db_change_any'));
};

interface SyncTask {
    id: string;
    action: 'INSERT' | 'UPDATE' | 'DELETE';
    table: string;
    data: any;
    timestamp: number;
    attempts: number;
}

// Sync UI State
export type SyncStatus = 'CONNECTED' | 'SYNCING' | 'OFFLINE' | 'ERROR';
let currentSyncStatus: SyncStatus = 'CONNECTED';
let lastSyncError: string | null = null;

const getSyncQueue = (): SyncTask[] => getItem<SyncTask[]>('sync_queue', []);
const saveSyncQueue = (queue: SyncTask[]) => {
    setItem('sync_queue', queue);
    broadcastSyncUpdate();
};

const broadcastSyncUpdate = () => {
    const queue = getSyncQueue();
    window.dispatchEvent(new CustomEvent('db_sync_update', { 
        detail: { 
            status: currentSyncStatus, 
            pendingCount: queue.length,
            error: lastSyncError
        } 
    }));
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
    processSyncQueue();
};

let isProcessingSync = false;
/**
 * Processes the synchronization queue by sending tasks to the Cloudflare D1 endpoint.
 */
const processSyncQueue = async () => {
    if (isProcessingSync) return;
    isProcessingSync = true;
    
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

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP ${response.status}`);
            }

            queue = queue.slice(1);
            saveSyncQueue(queue);
            lastSyncError = null;
            currentSyncStatus = 'CONNECTED';
        } catch (e: any) {
            console.error('Sync failed:', e);
            lastSyncError = e.message;
            currentSyncStatus = navigator.onLine ? 'ERROR' : 'OFFLINE';
            broadcastSyncUpdate();
            break;
        }
    }
    isProcessingSync = false;
    broadcastSyncUpdate();
};

// Retry sync when coming back online
window.addEventListener('online', processSyncQueue);

/**
 * Main database service for OmniPOS.
 * Handles local storage persistence with Cloudflare D1 synchronization.
 */
export const db = {
    init: async () => {
        // Initialize default System Administrator if no users exist
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
        
        // Initialize default role permissions
        const perms = getItem<RolePermissionConfig[]>('global_permissions', []);
        if (perms.length === 0) {
            const defaultPerms: RolePermissionConfig[] = Object.values(UserRole).map(role => ({
                role,
                permissions: role === UserRole.SUPER_ADMIN ? [] : []
            }));
            const cashier = defaultPerms.find(p => p.role === UserRole.CASHIER);
            if (cashier) cashier.permissions = ['POS_ACCESS', 'POS_CREATE_ORDER', 'POS_SETTLE', 'POS_OPEN_CLOSE_REGISTER'];
            setItem('global_permissions', defaultPerms);
        }

        processSyncQueue();
    },

    getSyncStatus: () => ({
        status: currentSyncStatus,
        pendingCount: getSyncQueue().length,
        error: lastSyncError
    }),

    // User Management
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

    // Session Management (Local volatile state for heartbeat)
    getActiveSessions: async () => getItem<ActiveSession[]>('global_sessions', []),
    updateHeartbeat: async (userId: string, storeId: string | null) => {
        const users = await db.getUsers();
        const user = users.find(u => u.id === userId);
        if (!user) return;
        
        let sessions = await db.getActiveSessions();
        const now = Date.now();
        const existingIdx = sessions.findIndex(s => s.userId === userId);
        
        const session: ActiveSession = {
            userId,
            userName: user.name,
            role: user.role,
            storeId,
            lastActive: now
        };

        if (existingIdx >= 0) {
            sessions[existingIdx] = session;
        } else {
            sessions.push(session);
        }
        
        // Remove sessions inactive for more than 5 minutes
        sessions = sessions.filter(s => now - s.lastActive < 300000);
        setItem('global_sessions', sessions);
    },
    removeSession: async (userId: string) => {
        let sessions = await db.getActiveSessions();
        sessions = sessions.filter(s => s.userId !== userId);
        setItem('global_sessions', sessions);
    },

    // Global Access Control
    getRolePermissions: async () => getItem<RolePermissionConfig[]>('global_permissions', []),
    updateRolePermissions: async (config: RolePermissionConfig) => {
        const configs = await db.getRolePermissions();
        const exists = configs.find(c => c.role === config.role);
        if (exists) {
            setItem('global_permissions', configs.map(c => c.role === config.role ? config : c));
            addToSyncQueue('UPDATE', 'permissions', config);
        } else {
            setItem('global_permissions', [...configs, config]);
            addToSyncQueue('INSERT', 'permissions', config);
        }
    },

    // Global Employee Registry
    getEmployees: async () => getItem<Employee[]>('global_employees', []),
    addEmployee: async (data: Partial<Employee>) => {
        const emps = await db.getEmployees();
        const newEmp: Employee = {
            ...data,
            id: uuid(),
            empId: `EMP${1000 + emps.length + 1}`,
            createdAt: Date.now()
        } as Employee;
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

    // Store Configuration
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

    // Store Products & Categories
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

    // Store Customer Database
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
    deleteCustomer: async (storeId: string, id: string) => {
        const custs = await db.getCustomers(storeId);
        setItem(`store_${storeId}_customers`, custs.filter(c => c.id !== id));
        addToSyncQueue('DELETE', 'customers', { id });
    },

    // Store Inventory Control
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

    // Store Sales & Order Processing
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

    // Store Quotation Management
    getQuotations: async (storeId: string) => getItem<Quotation[]>(`store_${storeId}_quotations`, []),
    addQuotation: async (storeId: string, q: Partial<Quotation>) => {
        const quotes = await db.getQuotations(storeId);
        const today = new Date().toISOString().split('T')[0];
        const todayQuotes = quotes.filter(o => new Date(o.createdAt).toISOString().split('T')[0] === today);
        const nextNum = (todayQuotes.length + 1).toString().padStart(4, '0');
        
        const newQuote = { 
            ...q, 
            id: uuid(), 
            quotationNumber: nextNum, 
            storeId, 
            createdAt: Date.now() 
        } as Quotation;
        
        setItem(`store_${storeId}_quotations`, [...quotes, newQuote]);
        addToSyncQueue('INSERT', 'quotations', newQuote);
        return newQuote;
    },

    // Store Cash Register Shift Tracking
    getRegisterShifts: async (storeId: string) => getItem<RegisterShift[]>(`store_${storeId}_shifts`, []),
    getActiveShift: async (storeId: string) => {
        const shifts = await db.getRegisterShifts(storeId);
        return shifts.find(s => s.status === 'OPEN') || null;
    },
    openShift: async (storeId: string, userId: string, startingCash: number, denominations: Record<number, number>) => {
        const shifts = await db.getRegisterShifts(storeId);
        const newShift: RegisterShift = {
            id: uuid(),
            shiftNumber: shifts.length + 1,
            storeId,
            openedBy: userId,
            openedAt: Date.now(),
            startingCash,
            openingDenominations: denominations,
            status: 'OPEN'
        };
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
            o.transactions?.forEach(t => {
                if (t.method === 'CASH') {
                    if (t.type === 'PAYMENT') totalCashSales += t.amount;
                    if (t.type === 'REVERSAL') totalCashRefunds += t.amount;
                }
            });
        });

        const expectedCash = shift.startingCash + totalCashSales - totalCashRefunds;
        const difference = actualCash - expectedCash;
        const heldCount = shiftOrders.filter(o => o.status === OrderStatus.ON_HOLD).length;

        const updatedShift: RegisterShift = {
            ...shift,
            status: 'CLOSED',
            closedAt: Date.now(),
            actualCash,
            expectedCash,
            difference,
            notes,
            closingDenominations: denominations,
            totalCashSales,
            totalCashRefunds,
            heldOrdersCount: heldCount
        };

        shifts[shiftIdx] = updatedShift;
        setItem(`store_${storeId}_shifts`, shifts);
        addToSyncQueue('UPDATE', 'shifts', updatedShift);
        return true;
    }
};