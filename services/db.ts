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

const centralSync = async (action: 'INSERT' | 'UPDATE' | 'DELETE' | 'INIT', table: string, data?: any) => {
    if (action === 'INIT') return true; 

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(CLOUDFLARE_CONFIG.SYNC_ENDPOINT, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, table, data }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Server sync failed');
        }

        console.debug(`%c[D1 SYNC SUCCESS]`, 'color: #10b981; font-weight: bold', `${action} -> ${table}`);
        return true;
    } catch (err) {
        console.warn(`[D1 SYNC OFFLINE/FAIL] ${table} update stored locally only.`, err);
        return false;
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
        }

        let users = getItem<User[]>('global_users', []);
        let adminExists = users.some(u => u.username === 'sys.admin');
        
        if (!adminExists) {
            console.log("Creating default system administrator...");
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
        }

        let perms = getItem<RolePermissionConfig[]>('global_permissions', []);
        if (perms.length === 0) {
            setItem('global_permissions', [
                { role: UserRole.SUPER_ADMIN, permissions: ['POS_ACCESS', 'POS_CREATE_ORDER', 'POS_EDIT_ORDER', 'POS_DELETE_ORDER', 'POS_REFUND', 'POS_SETTLE', 'POS_OPEN_CLOSE_REGISTER', 'VIEW_REPORTS', 'MANAGE_CUSTOMERS', 'MANAGE_SETTINGS', 'MANAGE_PRINT_DESIGNER', 'MANAGE_STAFF', 'VIEW_KOT', 'PROCESS_KOT', 'MANAGE_INVENTORY', 'VIEW_LIVE_ACTIVITY'] },
                { role: UserRole.CASHIER, permissions: ['POS_ACCESS', 'POS_CREATE_ORDER', 'POS_SETTLE', 'POS_OPEN_CLOSE_REGISTER', 'VIEW_KOT', 'MANAGE_CUSTOMERS'] },
                { role: UserRole.CHEF, permissions: ['VIEW_KOT', 'PROCESS_KOT'] }
            ]);
        }

        localStorage.setItem(DB_PREFIX + 'system_initialized', 'true');
        console.log("System initialization complete.");
    },

    getStores: async () => getItem<Store[]>('global_stores', []),
    addStore: async (store: Store) => {
        const stores = await db.getStores();
        const newStore = { ...store, id: store.id || uuid() };
        setItem('global_stores', [...stores, newStore]);
        await centralSync('INSERT', 'stores', newStore);
        return newStore;
    },
    updateStore: async (store: Store) => {
        const stores = await db.getStores();
        setItem('global_stores', stores.map(s => s.id === store.id ? store : s));
        await centralSync('UPDATE', 'stores', store);
    },
    deleteStore: async (id: string) => {
        const stores = await db.getStores();
        setItem('global_stores', stores.filter(s => s.id !== id));
        await centralSync('DELETE', 'stores', { id });
    },

    getUsers: async () => getItem<User[]>('global_users', []),
    addUser: async (user: User) => {
        const users = await db.getUsers();
        const newUser = { ...user, id: user.id || uuid(), userNumber: users.length + 1 };
        setItem('global_users', [...users, newUser]);
        await centralSync('INSERT', 'users', newUser);
        return newUser;
    },
    updateUser: async (user: User) => {
        const users = await db.getUsers();
        setItem('global_users', users.map(u => u.id === user.id ? user : u));
        await centralSync('UPDATE', 'users', user);
    },
    deleteUser: async (id: string) => {
        const users = await db.getUsers();
        setItem('global_users', users.filter(u => u.id !== id));
        await centralSync('DELETE', 'users', { id });
    },

    getEmployees: async () => getItem<Employee[]>('global_employees', []),
    addEmployee: async (emp: Partial<Employee>) => {
        const emps = await db.getEmployees();
        const newEmp = { ...emp, id: uuid(), empId: (emps.length + 1).toString().padStart(3, '0'), createdAt: Date.now() } as Employee;
        setItem('global_employees', [...emps, newEmp]);
        await centralSync('INSERT', 'employees', newEmp);
        return newEmp;
    },
    updateEmployee: async (emp: Employee) => {
        const emps = await db.getEmployees();
        setItem('global_employees', emps.map(e => e.id === emp.id ? emp : e));
        await centralSync('UPDATE', 'employees', emp);
    },
    deleteEmployee: async (id: string) => {
        const emps = await db.getEmployees();
        setItem('global_employees', emps.filter(e => e.id !== id));
        await centralSync('DELETE', 'employees', { id });
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
        await centralSync('INSERT', 'products', newProduct);
        return newProduct;
    },
    updateProduct: async (storeId: string, product: Product) => {
        const products = await db.getProducts(storeId);
        setItem(`store_${storeId}_products`, products.map(p => p.id === product.id ? product : p));
        await centralSync('UPDATE', 'products', product);
    },
    deleteProduct: async (storeId: string, id: string) => {
        const products = await db.getProducts(storeId);
        setItem(`store_${storeId}_products`, products.filter(p => p.id !== id));
        await centralSync('DELETE', 'products', { id });
    },

    getCategories: async (storeId: string) => getItem<Category[]>(`store_${storeId}_categories`, []),
    addCategory: async (storeId: string, category: Category) => {
        const categories = await db.getCategories(storeId);
        const newCategory = { ...category, id: uuid(), orderId: categories.length + 1 };
        setItem(`store_${storeId}_categories`, [...categories, newCategory]);
        await centralSync('INSERT', 'categories', newCategory);
        return newCategory;
    },
    deleteCategory: async (storeId: string, id: string) => {
        const categories = await db.getCategories(storeId);
        setItem(`store_${storeId}_categories`, categories.filter(c => c.id !== id));
        await centralSync('DELETE', 'categories', { id });
    },

    getCustomers: async (storeId: string) => getItem<Customer[]>(`store_${storeId}_customers`, []),
    addCustomer: async (storeId: string, customer: Customer) => {
        const customers = await db.getCustomers(storeId);
        const newCustomer = { ...customer, id: uuid() };
        setItem(`store_${storeId}_customers`, [...customers, newCustomer]);
        await centralSync('INSERT', 'customers', newCustomer);
        return newCustomer;
    },
    updateCustomer: async (storeId: string, customer: Customer) => {
        const customers = await db.getCustomers(storeId);
        setItem(`store_${storeId}_customers`, customers.map(c => c.id === customer.id ? customer : c));
        await centralSync('UPDATE', 'customers', customer);
    },
    deleteCustomer: async (storeId: string, id: string) => {
        const customers = await db.getCustomers(storeId);
        setItem(`store_${storeId}_customers`, customers.filter(c => c.id !== id));
        await centralSync('DELETE', 'customers', { id });
    },

    getOrders: async (storeId: string) => getItem<Order[]>(`store_${storeId}_orders`, []),
    getNextOrderNumber: async (storeId: string) => {
        const orders = await db.getOrders(storeId);
        return (orders.length + 1).toString().padStart(4, '0');
    },
    addOrder: async (storeId: string, order: Order) => {
        const orders = await db.getOrders(storeId);
        const nextNum = await db.getNextOrderNumber(storeId);
        const newOrder = { ...order, orderNumber: nextNum, createdAt: Date.now() };
        setItem(`store_${storeId}_orders`, [...orders, newOrder]);
        await centralSync('INSERT', 'orders', newOrder);
        return newOrder;
    },
    updateOrder: async (storeId: string, order: Order) => {
        const orders = await db.getOrders(storeId);
        setItem(`store_${storeId}_orders`, orders.map(o => o.id === order.id ? order : o));
        await centralSync('UPDATE', 'orders', order);
    },
    deleteOrder: async (storeId: string, id: string) => {
        const orders = await db.getOrders(storeId);
        setItem(`store_${storeId}_orders`, orders.filter(o => o.id !== id));
        await centralSync('DELETE', 'orders', { id });
    },
    updateOrderStatus: async (storeId: string, id: string, status: OrderStatus) => {
        const orders = await db.getOrders(storeId);
        setItem(`store_${storeId}_orders`, orders.map(o => o.id === id ? { ...o, status } : o));
        await centralSync('UPDATE', 'orders', { id, status });
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
        await centralSync('INSERT', 'quotations', newQuote);
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
        await centralSync('INSERT', 'shifts', newShift);
    },
    closeShift: async (storeId: string, shiftId: string, actualCash: number, notes: string, denominations: any) => {
        const shifts = await db.getRegisterShifts(storeId);
        const shift = shifts.find(s => s.id === shiftId);
        if (!shift) return false;

        const allOrders = await db.getOrders(storeId);
        const shiftOrders = allOrders.filter(o => o.shiftId === shiftId && o.status === OrderStatus.COMPLETED);
        const cashSales = shiftOrders.filter(o => o.paymentMethod === 'CASH').reduce((sum, o) => sum + o.total, 0);
        const expectedCash = shift.startingCash + cashSales;

        const updatedShift: RegisterShift = {
            ...shift,
            status: 'CLOSED',
            closedAt: Date.now(),
            actualCash,
            expectedCash,
            difference: actualCash - expectedCash,
            notes,
            closingDenominations: denominations
        };

        setItem(`store_${storeId}_shifts`, shifts.map(s => s.id === shiftId ? updatedShift : s));
        await centralSync('UPDATE', 'shifts', updatedShift);
        return true;
    },

    getInventory: async (storeId: string) => getItem<InventoryItem[]>(`store_${storeId}_inventory`, []),
    addInventoryItem: async (storeId: string, item: InventoryItem) => {
        const items = await db.getInventory(storeId);
        const newItem = { ...item, id: uuid(), storeId };
        setItem(`store_${storeId}_inventory`, [...items, newItem]);
        await centralSync('INSERT', 'inventory', newItem);
        return newItem;
    },
    updateInventoryItem: async (storeId: string, item: InventoryItem) => {
        const items = await db.getInventory(storeId);
        setItem(`store_${storeId}_inventory`, items.map(i => i.id === item.id ? item : i));
        await centralSync('UPDATE', 'inventory', item);
    },
    deleteInventoryItem: async (storeId: string, id: string) => {
        const items = await db.getInventory(storeId);
        setItem(`store_${storeId}_inventory`, items.filter(i => i.id !== id));
        await centralSync('DELETE', 'inventory', { id });
    },

    getRolePermissions: async () => getItem<RolePermissionConfig[]>('global_permissions', []),
    updateRolePermissions: async (config: RolePermissionConfig) => {
        const current = await db.getRolePermissions();
        setItem('global_permissions', current.map(c => c.role === config.role ? config : c));
        await centralSync('UPDATE', 'permissions', config);
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