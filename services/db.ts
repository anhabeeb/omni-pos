import { Store, User, UserRole, Employee, Product, Category, Customer, Order, Quotation, RegisterShift, RolePermissionConfig, Permission, ActiveSession, OrderStatus, InventoryItem } from '../types';

const CLOUDFLARE_CONFIG = {
    DB_NAME: 'omni-pos',
    DB_ID: 'a50fddea-e22f-419c-afb8-6c40464e4a6a',
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
    action: 'INSERT' | 'UPDATE' | 'DELETE';
    table: string;
    data: any;
    timestamp: number;
    attempts: number;
}

// Sync UI State
export type SyncStatus = 'CONNECTED' | 'SYNCING' | 'OFFLINE' | 'ERROR';
let currentSyncStatus: SyncStatus = 'CONNECTED';

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
            pendingCount: queue.length 
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
const processSyncQueue = async () => {
    if (isProcessingSync) return;
    const queue = getSyncQueue();
    if (queue.length === 0) {
        currentSyncStatus = 'CONNECTED';
        broadcastSyncUpdate();
        return;
    }

    isProcessingSync = true;
    currentSyncStatus = 'SYNCING';
    broadcastSyncUpdate();

    const task = queue[0];
    
    try {
        const response = await fetch(CLOUDFLARE_CONFIG.SYNC_ENDPOINT, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: task.action, table: task.table, data: task.data })
        });

        // Strict Validation: Parse the body to ensure it's not an SPA HTML fallback
        let result: any = {};
        try {
            const text = await response.text();
            result = JSON.parse(text);
        } catch (e) {
            console.error("[SYNC ERROR] Response was not valid JSON. Likely SPA fallback.", e);
            throw new Error("Invalid server response format");
        }

        if (response.ok && result.success === true) {
            const currentQueue = getSyncQueue();
            saveSyncQueue(currentQueue.filter(t => t.id !== task.id));
            console.debug(`%c[SYNC SUCCESS]`, 'color: #10b981; font-weight: bold', `${task.action} -> ${task.table} (#${task.data.id || 'N/A'})`);
            currentSyncStatus = getSyncQueue().length > 0 ? 'SYNCING' : 'CONNECTED';
        } else if (response.status === 409 || result.code === 'DUPLICATE_ID') {
            console.warn(`[SYNC CONFLICT] Duplicate ID in ${task.table}. Adjusting ID to prevent data loss...`);
            const oldId = task.data.id;
            const newId = uuid();
            const adjustedData = { ...task.data, id: newId };
            await updateLocalRecordId(task.table, oldId, newId, adjustedData);
            const currentQueue = getSyncQueue();
            const updatedQueue = currentQueue.map(t => 
                t.id === task.id ? { ...t, data: adjustedData, attempts: 0 } : t
            );
            saveSyncQueue(updatedQueue);
        } else {
            throw new Error(result.error || `Server returned HTTP ${response.status}`);
        }
    } catch (err: any) {
        console.warn(`%c[SYNC RETRYING]`, 'color: #f59e0b', `${task.table} sync will retry later. Error: ${err.message}`);
        currentSyncStatus = 'OFFLINE';
        const currentQueue = getSyncQueue();
        const updatedTask = { ...task, attempts: task.attempts + 1 };
        
        if (updatedTask.attempts < 15) {
            saveSyncQueue([...currentQueue.filter(t => t.id !== task.id), updatedTask]);
        } else {
            saveSyncQueue(currentQueue.filter(t => t.id !== task.id));
            console.error(`[SYNC ABORTED] Task dropped after 15 failed attempts`, task);
        }
    } finally {
        isProcessingSync = false;
        broadcastSyncUpdate();
        if (getSyncQueue().length > 0) {
            setTimeout(processSyncQueue, currentSyncStatus === 'OFFLINE' ? 10000 : 3000);
        }
    }
};

const updateLocalRecordId = async (table: string, oldId: string, newId: string, fullData: any) => {
    const storeId = fullData.storeId;

    switch (table) {
        case 'stores': {
            const items = getItem<Store[]>('global_stores', []);
            setItem('global_stores', items.map(i => i.id === oldId ? fullData : i));
            break;
        }
        case 'users': {
            const items = getItem<User[]>('global_users', []);
            setItem('global_users', items.map(i => i.id === oldId ? fullData : i));
            break;
        }
        case 'employees': {
            const items = getItem<Employee[]>('global_employees', []);
            setItem('global_employees', items.map(i => i.id === oldId ? fullData : i));
            break;
        }
        case 'products': {
            const items = getItem<Product[]>(`store_${storeId}_products`, []);
            setItem(`store_${storeId}_products`, items.map(i => i.id === oldId ? fullData : i));
            break;
        }
        case 'categories': {
            const items = getItem<Category[]>(`store_${storeId}_categories`, []);
            setItem(`store_${storeId}_categories`, items.map(i => i.id === oldId ? fullData : i));
            break;
        }
        case 'customers': {
            const items = getItem<Customer[]>(`store_${storeId}_customers`, []);
            setItem(`store_${storeId}_customers`, items.map(i => i.id === oldId ? fullData : i));
            break;
        }
        case 'orders': {
            const items = getItem<Order[]>(`store_${storeId}_orders`, []);
            setItem(`store_${storeId}_orders`, items.map(i => i.id === oldId ? fullData : i));
            break;
        }
        case 'quotations': {
            const items = getItem<Quotation[]>(`store_${storeId}_quotations`, []);
            setItem(`store_${storeId}_quotations`, items.map(i => i.id === oldId ? fullData : i));
            break;
        }
        case 'shifts': {
            const items = getItem<RegisterShift[]>(`store_${storeId}_shifts`, []);
            setItem(`store_${storeId}_shifts`, items.map(i => i.id === oldId ? fullData : i));
            break;
        }
        case 'inventory': {
            const items = getItem<InventoryItem[]>(`store_${storeId}_inventory`, []);
            setItem(`store_${storeId}_inventory`, items.map(i => i.id === oldId ? fullData : i));
            break;
        }
    }
};

export const db = {
    init: async () => {
        let stores = getItem<Store[]>('global_stores', []);
        if (stores.length === 0) {
            const defaultStore: Store = {
                id: uuid(),
                name: 'Main Bistro',
                currency: '$',
                address: '123 Gourmet Way',
                phone: '555-0100',
                isActive: true,
                taxRate: 10,
                serviceChargeRate: 5,
                numberOfTables: 20
            };
            stores = [defaultStore];
            setItem('global_stores', stores);
            addToSyncQueue('INSERT', 'stores', defaultStore);
        }

        let users = getItem<User[]>('global_users', []);
        if (!users.some(u => u.username === 'sys.admin')) {
            const newAdmin: User = {
                id: uuid(),
                name: 'System Admin',
                username: 'sys.admin',
                password: '123',
                role: UserRole.SUPER_ADMIN,
                storeIds: []
            };
            users.push(newAdmin);
            setItem('global_users', users);
            addToSyncQueue('INSERT', 'users', newAdmin);
        }

        let perms = getItem<RolePermissionConfig[]>('global_permissions', []);
        if (perms.length === 0) {
            const defaultPerms = [
                { role: UserRole.SUPER_ADMIN, permissions: ['POS_ACCESS', 'POS_CREATE_ORDER', 'POS_EDIT_ORDER', 'POS_DELETE_ORDER', 'POS_REFUND', 'POS_SETTLE', 'POS_OPEN_CLOSE_REGISTER', 'VIEW_REPORTS', 'MANAGE_CUSTOMERS', 'MANAGE_SETTINGS', 'MANAGE_PRINT_DESIGNER', 'MANAGE_STAFF', 'VIEW_KOT', 'PROCESS_KOT', 'MANAGE_INVENTORY', 'VIEW_LIVE_ACTIVITY'] },
                { role: UserRole.CASHIER, permissions: ['POS_ACCESS', 'POS_CREATE_ORDER', 'POS_SETTLE', 'POS_OPEN_CLOSE_REGISTER', 'VIEW_KOT', 'MANAGE_CUSTOMERS'] },
                { role: UserRole.CHEF, permissions: ['VIEW_KOT', 'PROCESS_KOT'] }
            ];
            setItem('global_permissions', defaultPerms);
            defaultPerms.forEach(p => addToSyncQueue('UPDATE', 'permissions', p));
        }

        localStorage.setItem(DB_PREFIX + 'system_initialized', 'true');
        setInterval(processSyncQueue, 30000);
        processSyncQueue();
    },

    getSyncStatus: () => ({ status: currentSyncStatus, pendingCount: getSyncQueue().length }),

    getStores: async () => getItem<Store[]>('global_stores', []),
    addStore: async (store: Store) => {
        const stores = await db.getStores();
        const newStore = { ...store, id: store.id || uuid() };
        setItem('global_stores', [...stores, newStore]);
        addToSyncQueue('INSERT', 'stores', newStore);
        return newStore;
    },
    updateStore: async (store: Store) => {
        const stores = await db.getStores();
        setItem('global_stores', stores.map(s => s.id === store.id ? store : s));
        addToSyncQueue('UPDATE', 'stores', store);
    },
    deleteStore: async (id: string) => {
        const stores = await db.getStores();
        setItem('global_stores', stores.filter(s => s.id !== id));
        addToSyncQueue('DELETE', 'stores', { id });
    },

    getUsers: async () => getItem<User[]>('global_users', []),
    addUser: async (user: User) => {
        const users = await db.getUsers();
        const newUser = { ...user, id: user.id || uuid(), userNumber: users.length + 1 };
        setItem('global_users', [...users, newUser]);
        addToSyncQueue('INSERT', 'users', newUser);
        return newUser;
    },
    updateUser: async (user: User) => {
        const users = await db.getUsers();
        setItem('global_users', users.map(u => u.id === user.id ? user : u));
        addToSyncQueue('UPDATE', 'users', user);
    },
    deleteUser: async (id: string) => {
        const users = await db.getUsers();
        setItem('global_users', users.filter(u => u.id !== id));
        addToSyncQueue('DELETE', 'users', { id });
    },

    getEmployees: async () => getItem<Employee[]>('global_employees', []),
    addEmployee: async (emp: Partial<Employee>) => {
        const emps = await db.getEmployees();
        const newEmp = { ...emp, id: uuid(), empId: (emps.length + 1).toString().padStart(3, '0'), createdAt: Date.now() } as Employee;
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

    getProducts: async (storeId: string) => getItem<Product[]>(`store_${storeId}_products`, []),
    addProduct: async (storeId: string, product: Product) => {
        const products = await db.getProducts(storeId);
        const categories = await db.getCategories(storeId);
        const category = categories.find(c => c.id === product.categoryId);
        const categoryOrder = category?.orderId || 1;
        const categoryProducts = products.filter(p => p.categoryId === product.categoryId);
        
        let newId: string;
        if (categoryProducts.length === 0) {
            newId = (categoryOrder * 1000 + 1).toString();
        } else {
            const numericIds = categoryProducts.map(p => parseInt(p.id)).filter(id => !isNaN(id));
            const base = categoryOrder * 1000;
            const maxId = numericIds.length > 0 ? Math.max(...numericIds) : base;
            newId = (maxId + 1).toString();
        }

        const newProduct = { ...product, id: newId, storeId };
        setItem(`store_${storeId}_products`, [...products, newProduct]);
        addToSyncQueue('INSERT', 'products', newProduct);
        return newProduct;
    },
    updateProduct: async (storeId: string, product: Product) => {
        const products = await db.getProducts(storeId);
        setItem(`store_${storeId}_products`, products.map(p => p.id === product.id ? product : p));
        addToSyncQueue('UPDATE', 'products', product);
    },
    deleteProduct: async (storeId: string, id: string) => {
        const products = await db.getProducts(storeId);
        setItem(`store_${storeId}_products`, products.filter(p => p.id !== id));
        addToSyncQueue('DELETE', 'products', { id });
    },

    getCategories: async (storeId: string) => getItem<Category[]>(`store_${storeId}_categories`, []),
    addCategory: async (storeId: string, category: Category) => {
        const categories = await db.getCategories(storeId);
        const newCategory = { ...category, id: uuid(), orderId: categories.length + 1 };
        setItem(`store_${storeId}_categories`, [...categories, newCategory]);
        addToSyncQueue('INSERT', 'categories', newCategory);
        return newCategory;
    },
    deleteCategory: async (storeId: string, id: string) => {
        const categories = await db.getCategories(storeId);
        setItem(`store_${storeId}_categories`, categories.filter(c => c.id !== id));
        addToSyncQueue('DELETE', 'categories', { id });
    },

    getCustomers: async (storeId: string) => getItem<Customer[]>(`store_${storeId}_customers`, []),
    addCustomer: async (storeId: string, customer: Customer) => {
        const customers = await db.getCustomers(storeId);
        const newCustomer = { ...customer, id: uuid(), storeId };
        setItem(`store_${storeId}_customers`, [...customers, newCustomer]);
        addToSyncQueue('INSERT', 'customers', newCustomer);
        return newCustomer;
    },
    updateCustomer: async (storeId: string, customer: Customer) => {
        const customers = await db.getCustomers(storeId);
        setItem(`store_${storeId}_customers`, customers.map(c => c.id === customer.id ? customer : c));
        addToSyncQueue('UPDATE', 'customers', customer);
    },
    deleteCustomer: async (id: string, storeId: string) => {
        const customers = await db.getCustomers(storeId);
        setItem(`store_${storeId}_customers`, customers.filter(c => c.id !== id));
        addToSyncQueue('DELETE', 'customers', { id });
    },

    getOrders: async (storeId: string) => getItem<Order[]>(`store_${storeId}_orders`, []),
    getNextOrderNumber: async (storeId: string) => {
        const orders = await db.getOrders(storeId);
        return (orders.length + 1).toString().padStart(4, '0');
    },
    addOrder: async (storeId: string, order: Order) => {
        const orders = await db.getOrders(storeId);
        const nextNum = await db.getNextOrderNumber(storeId);
        const newOrder = { ...order, id: order.id || uuid(), orderNumber: nextNum, createdAt: Date.now(), storeId };
        setItem(`store_${storeId}_orders`, [...orders, newOrder]);
        addToSyncQueue('INSERT', 'orders', newOrder);
        return newOrder;
    },
    updateOrder: async (storeId: string, order: Order) => {
        const orders = await db.getOrders(storeId);
        setItem(`store_${storeId}_orders`, orders.map(o => o.id === order.id ? order : o));
        addToSyncQueue('UPDATE', 'orders', order);
    },
    deleteOrder: async (storeId: string, id: string) => {
        const orders = await db.getOrders(storeId);
        setItem(`store_${storeId}_orders`, orders.filter(o => o.id !== id));
        addToSyncQueue('DELETE', 'orders', { id });
    },
    updateOrderStatus: async (storeId: string, id: string, status: OrderStatus) => {
        const orders = await db.getOrders(storeId);
        const order = orders.find(o => o.id === id);
        if (order) {
            const updated = { ...order, status };
            setItem(`store_${storeId}_orders`, orders.map(o => o.id === id ? updated : o));
            addToSyncQueue('UPDATE', 'orders', updated);
        }
    },

    getQuotations: async (storeId: string) => getItem<Quotation[]>(`store_${storeId}_quotations`, []),
    addQuotation: async (storeId: string, quote: Partial<Quotation>) => {
        const quotes = await db.getQuotations(storeId);
        const newQuote = { 
            ...quote, 
            id: uuid(), 
            storeId,
            quotationNumber: (quotes.length + 1).toString().padStart(4, '0'),
            createdAt: Date.now() 
        } as Quotation;
        setItem(`store_${storeId}_quotations`, [...quotes, newQuote]);
        addToSyncQueue('INSERT', 'quotations', newQuote);
        return newQuote;
    },

    getRegisterShifts: async (storeId: string) => getItem<RegisterShift[]>(`store_${storeId}_shifts`, []),
    getActiveShift: async (storeId: string) => {
        const shifts = await db.getRegisterShifts(storeId);
        return shifts.find(s => s.status === 'OPEN');
    },
    openShift: async (storeId: string, userId: string, startingCash: number, denominations: any) => {
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
    closeShift: async (storeId: string, shiftId: string, actualCash: number, notes: string, denominations: any) => {
        const shifts = await db.getRegisterShifts(storeId);
        const shift = shifts.find(s => s.id === shiftId);
        if (!shift) return false;

        const allOrders = await db.getOrders(storeId);
        const shiftOrders = allOrders.filter(o => o.shiftId === shiftId);
        const completedOrders = shiftOrders.filter(o => o.status === OrderStatus.COMPLETED);
        const heldOrders = shiftOrders.filter(o => o.status === OrderStatus.ON_HOLD);
        
        const cashSales = completedOrders.filter(o => o.paymentMethod === 'CASH').reduce((sum, o) => sum + o.total, 0);
        const expectedCash = shift.startingCash + cashSales;

        const updatedShift: RegisterShift = {
            ...shift,
            status: 'CLOSED',
            closedAt: Date.now(),
            actualCash,
            expectedCash,
            difference: actualCash - expectedCash,
            notes,
            closingDenominations: denominations,
            heldOrdersCount: heldOrders.length,
            totalCashSales: cashSales
        };

        setItem(`store_${storeId}_shifts`, shifts.map(s => s.id === shiftId ? updatedShift : s));
        addToSyncQueue('UPDATE', 'shifts', updatedShift);
        return true;
    },

    getInventory: async (storeId: string) => getItem<InventoryItem[]>(`store_${storeId}_inventory`, []),
    addInventoryItem: async (storeId: string, item: InventoryItem) => {
        const items = await db.getInventory(storeId);
        const newItem = { ...item, id: uuid(), storeId };
        setItem(`store_${storeId}_inventory`, [...items, newItem]);
        addToSyncQueue('INSERT', 'inventory', newItem);
        return newItem;
    },
    updateInventoryItem: async (storeId: string, item: InventoryItem) => {
        const items = await db.getInventory(storeId);
        setItem(`store_${storeId}_inventory`, items.map(i => i.id === item.id ? item : i));
        addToSyncQueue('UPDATE', 'inventory', item);
    },
    deleteInventoryItem: async (storeId: string, id: string) => {
        const items = await db.getInventory(storeId);
        setItem(`store_${storeId}_inventory`, items.filter(i => i.id !== id));
        addToSyncQueue('DELETE', 'inventory', { id });
    },

    getRolePermissions: async () => getItem<RolePermissionConfig[]>('global_permissions', []),
    updateRolePermissions: async (config: RolePermissionConfig) => {
        const current = await db.getRolePermissions();
        setItem('global_permissions', current.map(c => c.role === config.role ? config : c));
        addToSyncQueue('UPDATE', 'permissions', config);
    },

    updateHeartbeat: async (userId: string, storeId: string | null) => {
        const sessions = getItem<ActiveSession[]>('global_sessions', []);
        const users = await db.getUsers();
        const user = users.find(u => u.id === userId);
        if (!user) return;

        const now = Date.now();
        const sessionData: ActiveSession = {
            userId,
            userName: user.name,
            role: user.role,
            storeId,
            lastActive: now
        };

        const existing = sessions.findIndex(s => s.userId === userId);
        if (existing > -1) {
            sessions[existing] = sessionData;
        } else {
            sessions.push(sessionData);
        }

        const activeSessions = sessions.filter(s => now - s.lastActive < 120000);
        setItem('global_sessions', activeSessions);
    },
    removeSession: async (userId: string) => {
        const sessions = getItem<ActiveSession[]>('global_sessions', []);
        setItem('global_sessions', sessions.filter(s => s.userId !== userId));
    },
    getActiveSessions: async () => getItem<ActiveSession[]>('global_sessions', [])
};
