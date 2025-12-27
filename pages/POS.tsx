import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../AuthContext';
import { db, uuid } from '../services/db';
import { Product, Category, Order, OrderItem, OrderType, OrderStatus, Store, RegisterShift, Transaction, Customer, User, PrintSettings } from '../types';
import { 
  Search, Trash2, Plus, X, Utensils, ShoppingBag, Lock, Unlock, RefreshCcw, 
  ChefHat, DollarSign, CheckCircle, UserPlus, Edit, PauseCircle, Printer, AlertCircle, Info, Play,
  Maximize2,
  Hash,
  FileImage,
  Percent,
  MapPin,
  Loader2,
  Tag,
  ArrowRight,
  Split,
  User as UserIcon,
  Banknote,
  CreditCard,
  ShoppingCart,
  ChevronRight,
  History,
  Phone,
  ChevronDown,
  Building2,
  ChevronUp,
  Settings2,
  LayoutGrid,
  Save,
  Store as StoreIcon,
  Table as TableIcon,
  XCircle,
  Clock,
  Navigation
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toJpeg } from 'html-to-image';

const DENOMINATIONS = [1000, 500, 100, 50, 20, 10, 5, 2, 1];
const DISCOUNT_PRESETS = [5, 10, 15, 20];

export default function POS() {
  const { user, currentStoreId, switchStore, logout, hasPermission } = useAuth();
  const navigate = useNavigate();

  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sessionUsers, setSessionUsers] = useState<User[]>([]);
  const [shift, setShift] = useState<RegisterShift | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | 'ALL'>('ALL');
  const [activeTab, setActiveTab] = useState<'MENU' | 'ACTIVE' | 'HELD' | 'HISTORY'>('MENU');
  
  const [viewMode, setViewMode] = useState<'SIMPLE' | 'DETAIL'>('SIMPLE');
  
  const [menuScale, setMenuScale] = useState(1);
  const [toast, setToast] = useState<{ message: string, type: 'SUCCESS' | 'ERROR' | 'INFO' } | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerResults, setShowCustomerResults] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [isCartMetadataCollapsed, setIsCartMetadataCollapsed] = useState(false);
  const [resumedOrder, setResumedOrder] = useState<Order | null>(null);

  const [newCustData, setNewCustData] = useState<Partial<Customer>>({
    name: '', phone: '', type: 'INDIVIDUAL', companyName: '', tin: '', houseName: '', streetName: '', buildingName: '', street: '', island: '', country: '', address: ''
  });

  const [cart, setCart] = useState<OrderItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>(OrderType.DINE_IN);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [tableNumber, setTableNumber] = useState('');
  const [orderNote, setOrderNote] = useState('');
  const [nextOrderNum, setNextOrderNum] = useState<string>('');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [showDiscountPresets, setShowDiscountPresets] = useState(false);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [orderToSettle, setOrderToSettle] = useState<Order | null>(null); 
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'TRANSFER'>('CASH');
  const [amountTendered, setAmountTendered] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentError, setPaymentError] = useState('');

  const [isSplitMode, setIsSplitMode] = useState(false);
  const [splitPayment1, setSplitPayment1] = useState<{ method: 'CASH' | 'CARD' | 'TRANSFER', amount: string, ref: string }>({ method: 'CASH', amount: '', ref: '' });
  const [splitPayment2, setSplitPayment2] = useState<{ method: 'CASH' | 'CARD' | 'TRANSFER', amount: string, ref: string }>({ method: 'CASH', amount: '', ref: '' });

  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [previewOrder, setPreviewOrder] = useState<Order | null>(null);
  const [previewPaperSize, setPreviewPaperSize] = useState<'thermal' | 'a4' | 'a5' | 'letter'>('thermal');
  
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isShiftConfirmOpen, setIsShiftConfirmOpen] = useState(false);
  const [shiftNote, setShiftNote] = useState('');
  const [shiftError, setShiftError] = useState('');
  const [denominations, setDenominations] = useState<Record<number, number>>({});

  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [heldOrders, setHeldOrders] = useState<Order[]>([]);
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]);

  const exportRef = useRef<HTMLDivElement>(null);

  const isKOTEnabled = useMemo(() => {
    if (!store) return true;
    const val = (store as any).useKOT;
    if (val === false || (val as any) === 0 || (val as any) === '0' || val === null || val === undefined) return false;
    return true;
  }, [store]);

  const formatAddress = (c: Customer) => {
    if (c.type === 'INDIVIDUAL') {
        return [c.houseName, c.streetName, c.address].filter(Boolean).join(', ');
    } else {
        return [c.buildingName, c.street, c.island, c.country, c.address].filter(Boolean).join(', ');
    }
  };

  const getStorageKeys = (storeId: number) => ({
    cart: `pos_cart_${storeId}`,
    type: `pos_type_${storeId}`,
    customer: `pos_customer_${storeId}`,
    table: `pos_table_${storeId}`,
    note: `pos_note_${storeId}`,
    discount: `pos_discount_${storeId}`,
    resumed: `pos_resumed_${storeId}`,
    viewMode: `pos_view_${storeId}`
  });

  useEffect(() => {
    if (currentStoreId) {
      loadData();
      loadFromPersistence(currentStoreId);
      const handleDbChange = () => loadData();
      window.addEventListener('db_change_any', handleDbChange);
      return () => window.removeEventListener('db_change_any', handleDbChange);
    }
  }, [currentStoreId]);

  useEffect(() => {
    if (currentStoreId) {
        const keys = getStorageKeys(currentStoreId);
        localStorage.setItem(keys.cart, JSON.stringify(cart));
        localStorage.setItem(keys.type, orderType);
        localStorage.setItem(keys.customer, JSON.stringify(selectedCustomer));
        localStorage.setItem(keys.table, tableNumber);
        localStorage.setItem(keys.note, orderNote);
        localStorage.setItem(keys.discount, discountPercent.toString());
        localStorage.setItem(keys.resumed, JSON.stringify(resumedOrder));
        localStorage.setItem(keys.viewMode, viewMode);
    }
  }, [cart, orderType, selectedCustomer, tableNumber, orderNote, discountPercent, resumedOrder, currentStoreId, viewMode]);

  useEffect(() => {
      const handleClickOutside = () => {
          setShowCustomerResults(false);
          setShowDiscountPresets(false);
      };
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    if (toast) {
        const timer = setTimeout(() => setToast(null), 3000);
        return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message: string, type: 'SUCCESS' | 'ERROR' | 'INFO' = 'INFO') => {
      setToast({ message, type });
  };

  const loadFromPersistence = (storeId: number) => {
      const keys = getStorageKeys(storeId);
      const savedCart = localStorage.getItem(keys.cart);
      const savedType = localStorage.getItem(keys.type);
      const savedCust = localStorage.getItem(keys.customer);
      const savedTable = localStorage.getItem(keys.table);
      const savedNote = localStorage.getItem(keys.note);
      const savedDiscount = localStorage.getItem(keys.discount);
      const savedResumed = localStorage.getItem(keys.resumed);
      const savedView = localStorage.getItem(keys.viewMode);

      if (savedCart) setCart(JSON.parse(savedCart));
      if (savedType) setOrderType(savedType as OrderType);
      if (savedCust) {
          try {
              const cust = JSON.parse(savedCust);
              setSelectedCustomer(cust);
              if (cust) setCustomerSearch(cust.name || cust.phone);
          } catch(e) { /* ignore */ }
      }
      if (savedTable) setTableNumber(savedTable);
      if (savedNote) setOrderNote(savedNote);
      if (savedDiscount) setDiscountPercent(parseFloat(savedDiscount) || 0);
      if (savedResumed) {
          try { setResumedOrder(JSON.parse(savedResumed)); } catch(e) {}
      }
      if (savedView) setViewMode(savedView as any);
  };

  const loadData = async () => {
      if (!currentStoreId) return;
      
      const [sList, pList, cList, uList, custs, activeShift, allOrders, orderNum] = await Promise.all([
          db.getStores(),
          db.getProducts(currentStoreId),
          db.getCategories(currentStoreId),
          db.getUsers(),
          db.getCustomers(currentStoreId),
          db.getActiveShift(currentStoreId),
          db.getOrders(currentStoreId),
          db.getNextOrderNumber(currentStoreId)
      ]);

      const s = (sList as Store[]).find((st: Store) => st.id === currentStoreId);
      setStore(s || null);
      setProducts((pList as Product[]).filter((p: Product) => p.isAvailable));
      setCategories((cList as Category[]).sort((a: Category, b: Category) => (a.orderId || 0) - (b.orderId || 0)));
      setCustomers(custs as Customer[]);
      setSessionUsers(uList as User[]);
      setNextOrderNum(orderNum as string);
      setShift(activeShift as RegisterShift | null);

      setActiveOrders((allOrders as Order[]).filter((o: Order) => [OrderStatus.PENDING, OrderStatus.PREPARING, OrderStatus.READY].includes(o.status)).sort((a: Order, b: Order) => b.createdAt - a.createdAt));
      setHeldOrders((allOrders as Order[]).filter((o: Order) => o.status === OrderStatus.ON_HOLD).sort((a: Order, b: Order) => b.createdAt - a.createdAt));
      
      const history = activeShift 
        ? (allOrders as Order[]).filter((o: Order) => o.shiftId === (activeShift as RegisterShift).id && [OrderStatus.COMPLETED, OrderStatus.CANCELLED, OrderStatus.RETURNED].includes(o.status)) 
        : (allOrders as Order[]).filter((o: Order) => o.status === OrderStatus.COMPLETED).slice(-20);
      
      setHistoryOrders(history.sort((a: Order, b: Order) => b.createdAt - a.createdAt));
  };

  const addToCart = (product: Product) => {
      if (!shift) { showToast("Register is closed. Please open shift first.", "ERROR"); setIsShiftModalOpen(true); return; }
      setCart((prev: OrderItem[]) => {
          const existing = prev.find((item: OrderItem) => item.productId === product.id);
          if (existing) return prev.map((item: OrderItem) => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item);
          return [...prev, { productId: product.id, productName: product.name, price: product.price, quantity: 1 }];
      });
  };

  const updateQuantity = (productId: number, delta: number) => {
      setCart((prev: OrderItem[]) => prev.map((item: OrderItem) => {
          if (item.productId === productId) {
              const newQty = Math.max(0, item.quantity + delta);
              return { ...item, quantity: newQty };
          }
          return item;
      }).filter((item: OrderItem) => item.quantity > 0));
  };

  const resetOrderUI = () => {
    setCart([]); 
    setSelectedCustomer(null); 
    setCustomerSearch(''); 
    setTableNumber(''); 
    setOrderNote(''); 
    setOrderType(OrderType.DINE_IN); 
    setDiscountPercent(0);
    setResumedOrder(null);
    if (currentStoreId) {
        const keys = getStorageKeys(currentStoreId);
        localStorage.removeItem(keys.cart);
        localStorage.removeItem(keys.customer);
        localStorage.removeItem(keys.table);
        localStorage.removeItem(keys.note);
        localStorage.removeItem(keys.discount);
        localStorage.removeItem(keys.resumed);
    }
  };

  const clearCart = () => { 
      if (confirm("Are you sure you want to clear the current order?")) {
          resetOrderUI();
      }
  };

  const resumeOrder = async (order: Order) => {
    if (!shift) { showToast("Register is closed. Please open shift first.", "ERROR"); setIsShiftModalOpen(true); return; }
    setResumedOrder(order);
    setCart(order.items); 
    setOrderType(order.orderType); 
    setDiscountPercent(order.discountPercent || 0);
    if (order.tableNumber) setTableNumber(order.tableNumber);
    if (order.note) setOrderNote(order.note);
    if (order.customerPhone) {
        const found = customers.find((c: Customer) => c.phone === order.customerPhone);
        if (found) { setSelectedCustomer(found); setCustomerSearch(found.name || found.phone); } 
        else { setCustomerSearch(order.customerName || order.customerPhone); }
    } else {
        setSelectedCustomer(null);
        setCustomerSearch(order.customerName || '');
    }
    if (currentStoreId) {
        await db.deleteOrder(currentStoreId, order.id);
        db.logActivity({
            storeId: currentStoreId, userId: user?.id || 0, userName: user?.name || '',
            action: 'ORDER_CREATE',
            description: `Order #${order.orderNumber} pulled from active tab for editing`
        });
    }
    setActiveTab('MENU');
    showToast(`Editing Order #${order.orderNumber}`, "INFO");
  };

  const handleHoldActiveOrder = async (order: Order, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentStoreId) return;
    await db.updateOrderStatus(currentStoreId, order.id, OrderStatus.ON_HOLD);
    db.logActivity({
        storeId: currentStoreId, userId: user?.id || 0, userName: user?.name || '',
        action: 'ORDER_UPDATE',
        description: `Order #${order.orderNumber} placed on hold`
    });
    showToast(`Order #${order.orderNumber} moved to Held`, "INFO");
  };

  const handleActivateOrder = async (order: Order, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!shift) { showToast("Register is closed. Please open shift first.", "ERROR"); setIsShiftModalOpen(true); return; }
    if (!currentStoreId) return;
    await db.updateOrderStatus(currentStoreId, order.id, OrderStatus.PENDING);
    db.logActivity({
        storeId: currentStoreId, userId: user?.id || 0, userName: user?.name || '',
        action: 'ORDER_UPDATE',
        description: `Order #${order.orderNumber} reactivated`
    });
    setActiveTab('ACTIVE');
    showToast(`Order #${order.orderNumber} moved to Active`, "SUCCESS");
  };

  const validateOrderRequirements = () => {
    if ((orderType === OrderType.TAKEAWAY || orderType === OrderType.DELIVERY) && !selectedCustomer) {
        showToast(`Customer required for ${orderType === OrderType.TAKEAWAY ? 'Take Away' : 'Delivery'}`, "ERROR");
        return false;
    }
    if (orderType === OrderType.DINE_IN && !tableNumber) {
        showToast("Table number required for Dine In", "ERROR");
        return false;
    }
    return true;
  };

  const handleSendToHold = async () => {
    if (!currentStoreId || !user || !shift || cart.length === 0 || isSaving) return;
    if (!validateOrderRequirements()) return;
    setIsSaving(true);
    const newOrderData: Order = {
        id: resumedOrder?.id || 0, orderNumber: resumedOrder?.orderNumber || '', storeId: currentStoreId, shiftId: shift.id,
        items: [...cart], subtotal: totals.subtotal, discountPercent: discountPercent, discountAmount: totals.discountAmount,
        tax: totals.tax, serviceCharge: totals.serviceCharge, total: totals.total, orderType, 
        status: OrderStatus.ON_HOLD, kitchenStatus: 'PENDING',
        tableNumber: orderType === OrderType.DINE_IN ? tableNumber : undefined,
        note: orderNote, customerName: (selectedCustomer?.type === 'COMPANY' ? selectedCustomer.companyName : selectedCustomer?.name) || selectedCustomer?.name || customerSearch, 
        customerPhone: selectedCustomer?.phone, customerTin: selectedCustomer?.tin,
        customerAddress: selectedCustomer ? formatAddress(selectedCustomer) : undefined,
        createdBy: resumedOrder?.createdBy || user.id, createdAt: resumedOrder?.createdAt || Date.now()
    } as Order;
    resetOrderUI(); setActiveTab('HELD');
    try {
        await db.addOrder(currentStoreId, newOrderData);
        showToast("Ticket placed on hold.", "SUCCESS");
    } finally { setIsSaving(false); }
  };

  const handleSendToKitchen = async () => {
      if (!currentStoreId || !user || !shift || cart.length === 0 || isSaving) return;
      if (!validateOrderRequirements()) return;
      setIsSaving(true);
      const newOrderData: Order = {
          id: resumedOrder?.id || 0, orderNumber: resumedOrder?.orderNumber || '', storeId: currentStoreId, shiftId: shift.id,
          items: [...cart], subtotal: totals.subtotal, discountPercent: discountPercent, discountAmount: totals.discountAmount,
          tax: totals.tax, serviceCharge: totals.serviceCharge, total: totals.total, orderType, status: resumedOrder?.status || OrderStatus.PENDING, 
          kitchenStatus: isKOTEnabled ? 'PENDING' : 'SERVED',
          tableNumber: orderType === OrderType.DINE_IN ? tableNumber : undefined,
          note: orderNote, customerName: (selectedCustomer?.type === 'COMPANY' ? selectedCustomer.companyName : selectedCustomer?.name) || selectedCustomer?.name || customerSearch, 
          customerPhone: selectedCustomer?.phone, customerTin: selectedCustomer?.tin,
          customerAddress: selectedCustomer ? formatAddress(selectedCustomer) : undefined,
          createdBy: resumedOrder?.createdBy || user.id, createdAt: resumedOrder?.createdAt || Date.now()
      } as Order;
      resetOrderUI(); setActiveTab('ACTIVE');
      try {
          const added = (newOrderData.id && newOrderData.id !== 0) ? (await db.updateOrder(currentStoreId, newOrderData), newOrderData) : await db.addOrder(currentStoreId, newOrderData);
          db.logActivity({ storeId: currentStoreId, userId: user.id, userName: user.name, action: resumedOrder ? 'ORDER_UPDATE' : 'ORDER_CREATE', description: `Order #${added.orderNumber} saved/updated` });
          showToast(resumedOrder ? "Order updated." : "Order recorded.", "SUCCESS");
      } catch (e) { console.error(e); } finally { setIsSaving(false); }
  };

  const totals = useMemo(() => {
      const subtotal = cart.reduce((sum: number, item: OrderItem) => sum + (item.price * item.quantity), 0);
      const dPercent = discountPercent || 0;
      const discountAmount = (subtotal * dPercent) / 100;
      const subtotalAfterDiscount = subtotal - discountAmount;
      const taxRate = store?.taxRate || 0;
      const serviceChargeRate = store?.serviceChargeRate || 0;
      const serviceCharge = (orderType === OrderType.DINE_IN) ? (subtotalAfterDiscount * serviceChargeRate) / 100 : 0;
      const tax = ((subtotalAfterDiscount + serviceCharge) * taxRate) / 100;
      return { subtotal, discountAmount, subtotalAfterDiscount, tax, serviceCharge, total: subtotalAfterDiscount + tax + serviceCharge };
  }, [cart, store, orderType, discountPercent]);

  const handleCheckout = () => {
      if (cart.length === 0) return;
      if (!validateOrderRequirements()) return;
      setOrderToSettle(null); setPaymentMethod('CASH'); setAmountTendered(''); setPaymentRef(''); setPaymentError(''); 
      setIsSplitMode(false); setSplitPayment1({ method: 'CASH', amount: '', ref: '' }); setSplitPayment2({ method: 'CASH', amount: '', ref: '' });
      setIsPaymentModalOpen(true);
  };

  const finalizePayment = async () => {
    if (!currentStoreId || !user || !shift || isSaving) return;
    const targetOrder = orderToSettle || {
        id: resumedOrder?.id || 0, orderNumber: resumedOrder?.orderNumber || '', storeId: currentStoreId, shiftId: shift.id,
        items: [...cart], subtotal: totals.subtotal, discountPercent: discountPercent, discountAmount: totals.discountAmount,
        tax: totals.tax, serviceCharge: totals.serviceCharge, total: totals.total, orderType, status: OrderStatus.PENDING, 
        customerName: (selectedCustomer?.type === 'COMPANY' ? selectedCustomer.companyName : selectedCustomer?.name) || selectedCustomer?.name || customerSearch,
        customerPhone: selectedCustomer?.phone, customerTin: selectedCustomer?.tin, customerAddress: selectedCustomer ? formatAddress(selectedCustomer) : undefined,
        tableNumber: orderType === OrderType.DINE_IN ? tableNumber : undefined,
        note: orderNote, createdBy: resumedOrder?.createdBy || user.id, createdAt: resumedOrder?.createdAt || Date.now()
    } as Order;
    const totalToPay = targetOrder.total;
    const transactions: Transaction[] = [];
    if (isSplitMode) {
        const amt1 = parseFloat(splitPayment1.amount) || 0;
        const amt2 = parseFloat(splitPayment2.amount) || 0;
        if (Math.abs((amt1 + amt2) - totalToPay) > 0.01) { setPaymentError(`Total split amount (${store?.currency}${ (amt1 + amt2).toFixed(2) }) does not match total due (${store?.currency}${totalToPay.toFixed(2)})`); return; }
        if (splitPayment1.method !== 'CASH' && !splitPayment1.ref) { setPaymentError("Reference required for Split Part 1"); return; }
        if (splitPayment2.method !== 'CASH' && !splitPayment2.ref) { setPaymentError("Reference required for Split Part 2"); return; }
        transactions.push({ id: uuid(), type: 'PAYMENT', method: splitPayment1.method, amount: amt1, referenceNumber: splitPayment1.ref, timestamp: Date.now(), performedBy: user.id });
        transactions.push({ id: uuid(), type: 'PAYMENT', method: splitPayment2.method, amount: amt2, referenceNumber: splitPayment2.ref, timestamp: Date.now(), performedBy: user.id });
    } else {
        if (paymentMethod !== 'CASH' && !paymentRef) { setPaymentError(`Reference number required for ${paymentMethod}`); return; }
        const tendered = paymentMethod === 'CASH' ? (parseFloat(amountTendered) || totalToPay) : totalToPay;
        if (tendered < totalToPay - 0.01) { setPaymentError("Insufficient amount tendered."); return; }
        transactions.push({ id: uuid(), type: 'PAYMENT', method: paymentMethod, amount: totalToPay, referenceNumber: paymentRef, tenderedAmount: tendered, changeAmount: tendered - totalToPay, timestamp: Date.now(), performedBy: user.id });
    }
    setIsSaving(true);
    try {
        const completedOrder: Order = { ...targetOrder, status: OrderStatus.COMPLETED, paymentMethod: isSplitMode ? undefined : paymentMethod, transactions: [...(targetOrder.transactions || []), ...transactions] };
        if (completedOrder.id && completedOrder.id !== 0) await db.updateOrder(currentStoreId, completedOrder);
        else { const added = await db.addOrder(currentStoreId, completedOrder); completedOrder.id = added.id; completedOrder.orderNumber = added.orderNumber; }
        db.logActivity({ storeId: currentStoreId, userId: user.id, userName: user.name, action: 'ORDER_UPDATE', description: `Order #${completedOrder.orderNumber} settled` });
        setPreviewOrder(completedOrder); setPreviewPaperSize(store?.printSettings?.paperSize || 'thermal'); setPrintModalOpen(true);
        setIsPaymentModalOpen(false); resetOrderUI(); showToast(`Order #${completedOrder.orderNumber} Completed`, "SUCCESS");
    } catch (e) { console.error(e); } finally { setIsSaving(false); }
  };

  const generateReceiptHtml = (order: Order, isAutoPrint = false, paperSizeOverride?: string) => {
    if (!store) return '';
    const settings: PrintSettings = store.printSettings || { paperSize: 'thermal', fontSize: 'medium' };
    const currency = settings.currencySymbol || store.currency || '$';
    const paperSize = paperSizeOverride || settings.paperSize || 'thermal';
    
    let width = '300px'; 
    let pageSize = '80mm auto';
    if (paperSize === 'a4') { width = '210mm'; pageSize = 'A4'; }
    if (paperSize === 'a5') { width = '148mm'; pageSize = 'A5'; }
    if (paperSize === 'letter') { width = '8.5in'; pageSize = 'letter'; }
    
    const itemsHtml = settings.showItems !== false ? order.items.map((item: OrderItem) => {
        const hasSecondaryLine = settings.showQuantity !== false || settings.showUnitPrice !== false;
        return `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px 0;">
                    <div>${item.productName}</div>
                    ${hasSecondaryLine ? `
                        <div style="font-size: 0.85em; color: #666; margin-top: 2px;">
                            ${settings.showQuantity !== false ? item.quantity : ''}
                            ${settings.showQuantity !== false && settings.showUnitPrice !== false ? ' x ' : ''}
                            ${settings.showUnitPrice !== false ? `${currency}${item.price.toFixed(2)}` : ''}
                        </div>
                    ` : ''}
                </td>
                ${settings.showAmount !== false ? `<td style="padding: 8px 0; text-align: right; vertical-align: top;">${currency}${(item.price * item.quantity).toFixed(2)}</td>` : ''}
            </tr>
        `;
    }).join('') : '';
    
    const headerAlignment = settings.headerAlignment || 'center';
    const footerAlignment = settings.footerAlignment || 'center';
    const logoAlignment = settings.logoPosition || 'center';

    const logoBlock = (settings.showLogo && settings.logoUrl) ? `
        <div style="text-align: ${logoAlignment}; margin-bottom: 10px;">
            <img src="${settings.logoUrl}" style="max-width: 150px; max-height: 80px;" />
        </div>
    ` : '';

    const storeDetailsBlock = settings.showStoreDetails !== false ? `
        <div style="margin-bottom: 5px;">
            <h2 style="margin: 0; font-size: 18px;">${store.name}</h2>
            <div>${store.address}</div>
            <div>Tel: ${store.phone}</div>
        </div>
    ` : '';

    const taxIdBlock = settings.showTaxId ? `
        <div style="font-size: 11px; margin-top: 4px;"><strong>${settings.taxIdLabel || 'TIN'}:</strong> ${settings.taxIdValue || store.tin || '-'}</div>
    ` : '';

    const infoGridBlock = `
        <div style="display: grid; grid-template-cols: 1fr 1fr; gap: 10px; text-align: left; font-size: 11px; margin-top: 15px; border-top: 1px solid #000; padding-top: 10px; margin-bottom: 10px;">
            <div>
                ${settings.showOrderNumber !== false ? `<div><strong>ORDER:</strong> #${order.orderNumber}</div>` : ''}
                ${settings.showDate !== false ? `<div><strong>DATE:</strong> ${new Date(order.createdAt).toLocaleDateString()}</div>` : ''}
            </div>
            <div style="text-align: right;">
                ${settings.showCashierName ? `<div><strong>BY:</strong> ${sessionUsers.find((u: User) => u.id === order.createdBy)?.name || 'Staff'}</div>` : ''}
                ${settings.showCustomerDetails && order.tableNumber ? `<div><strong>TABLE:</strong> ${order.tableNumber}</div>` : ''}
            </div>
        </div>
    `;

    const isCompany = !!order.customerTin;
    const customerBlock = (settings.showCustomerDetails && (order.customerName || order.customerPhone || order.customerTin)) ? `
      <div style="margin-top: 10px; border: 1px dashed #ccc; padding: 10px; font-size: ${paperSize === 'thermal' ? '1.05em' : '0.8em'}; text-align: left;">
        <div style="font-weight: bold; font-size: 1.1em; border-bottom: 1px dashed #ccc; margin-bottom: 5px; padding-bottom: 2px;">CUSTOMER DETAILS</div>
        ${isCompany && order.customerName ? `<div><strong>Name:</strong> ${order.customerName}</div>` : ''}
        ${order.customerAddress ? `<div style="font-size: ${paperSize === 'thermal' ? '0.85em' : '0.75em'}; color: #333;"><strong>Address:</strong> ${order.customerAddress}</div>` : ''}
        ${order.customerPhone ? `<div style="font-size: ${paperSize === 'thermal' ? '0.85em' : '0.75em'};"><strong>Phone:</strong> ${order.customerPhone}</div>` : ''}
        ${order.customerTin ? `<div style="font-size: ${paperSize === 'thermal' ? '0.85em' : '0.75em'};"><strong>TIN:</strong> ${order.customerTin}</div>` : ''}
      </div>
    ` : '';

    const discountBlock = order.discountAmount && order.discountAmount > 0 ? `
        <div style="display: flex; justify-content: space-between; margin: 4px 0;"><span>Discount (${order.discountPercent}%):</span><span>-${currency}${order.discountAmount.toFixed(2)}</span></div>
    ` : '';

    const serviceChargeBlock = order.serviceCharge && order.serviceCharge > 0 ? `
        <div style="display: flex; justify-content: space-between; margin: 4px 0;"><span>Service Charge:</span><span>${currency}${order.serviceCharge.toFixed(2)}</span></div>
    ` : '';

    const taxBlock = order.tax && order.tax > 0 ? `
        <div style="display: flex; justify-content: space-between; margin: 4px 0;"><span>GST (${store.taxRate}%):</span><span>${currency}${order.tax.toFixed(2)}</span></div>
    ` : '';

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            @media print { body { margin: 0; padding: 20px; } @page { size: ${pageSize}; margin: 0; } } 
            body { 
                font-family: ${paperSize === 'thermal' ? 'monospace' : 'sans-serif'}; 
                font-size: ${settings.fontSize === 'small' ? '10px' : settings.fontSize === 'large' ? '14px' : '12px'}; 
                width: ${width}; margin: 0 auto; padding: 20px; color: #000; background: #fff; line-height: 1.4; box-sizing: border-box; 
            } 
            .header { text-align: ${headerAlignment}; margin-bottom: 20px; } 
            .totals { margin-top: 20px; } 
            .total-row { font-weight: bold; font-size: 1.3em; border-top: 2px solid #000; padding-top: 8px; margin-top: 8px; } 
            table { width: 100%; border-collapse: collapse; } 
            th { text-align: left; border-bottom: 1px solid #000; padding-bottom: 4px; font-size: 10px; } 
            td { padding: 4px 0; } 
            .footer { text-align: ${footerAlignment}; margin-top: 30px; border-top: 1px dashed #ccc; padding-top: 10px; font-style: italic; }
        </style>
    </head>
    <body ${isAutoPrint ? 'onload="window.print(); window.close();"' : ''}>
        <div class="header">${logoBlock}${storeDetailsBlock}${taxIdBlock}</div>
        ${infoGridBlock}${customerBlock}
        <table style="margin-top: 10px;"><thead><tr><th>DESCRIPTION</th>${settings.showAmount !== false ? '<th align="right">AMOUNT</th>' : ''}</tr></thead>
        <tbody>${itemsHtml}</tbody></table>
        <div class="totals">
            ${settings.showSubtotal !== false ? `<div style="display: flex; justify-content: space-between;"><span>Subtotal:</span><span>${currency}${order.subtotal.toFixed(2)}</span></div>` : ''}
            ${discountBlock}
            ${serviceChargeBlock}
            ${taxBlock}
            ${settings.showTotal !== false ? `<div style="display: flex; justify-content: space-between;" class="total-row"><span>TOTAL:</span><span>${currency}${order.total.toFixed(2)}</span></div>` : ''}
        </div>
        <div class="footer">${settings.footerText || 'Thank you!'}</div>
    </body>
    </html>`;
  };

  const previewHtml = useMemo(() => {
    if (previewOrder) return generateReceiptHtml(previewOrder, false, previewPaperSize);
    return '';
  }, [previewOrder, store, sessionUsers, previewPaperSize]);

  const handleQuickAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStoreId || isSaving) return;
    
    // Validation: Phone and Building/House Name required for individual
    if (newCustData.type === 'INDIVIDUAL') {
        if (!newCustData.phone || !newCustData.houseName) {
            showToast("Phone and Building/House Name are required", "ERROR");
            return;
        }
    } else {
        if (!newCustData.companyName || !newCustData.tin || !newCustData.phone || !newCustData.buildingName) {
            showToast("All company fields are required", "ERROR");
            return;
        }
    }

    setIsSaving(true);
    try {
        const added = await db.addCustomer(currentStoreId, newCustData as Customer);
        setCustomers(prev => [...prev, added]);
        setSelectedCustomer(added);
        setCustomerSearch(added.name || added.phone);
        setIsCustomerModalOpen(false);
        setNewCustData({
            name: '', phone: '', type: 'INDIVIDUAL', companyName: '', tin: '', houseName: '', streetName: '', buildingName: '', street: '', island: '', country: '', address: ''
        });
        showToast("Customer added successfully", "SUCCESS");
    } catch (e) {
        showToast("Failed to add customer", "ERROR");
    } finally {
        setIsSaving(false);
    }
  };

  const calculateDenomTotal = () => {
    return Object.entries(denominations).reduce((sum, [denom, count]) => sum + (Number(denom) * count), 0);
  };

  const handleOpenShift = async () => {
    if (!currentStoreId || !user) return;
    const amount = calculateDenomTotal();
    try {
        await db.openShift(currentStoreId, user.id, amount, denominations);
        setIsShiftModalOpen(false);
        setDenominations({});
        await loadData();
        showToast("Shift opened successfully", "SUCCESS");
    } catch (e) {
        setShiftError("Failed to open shift");
    }
  };

  const executeCloseShift = async () => {
    if (!currentStoreId || !shift) return;
    const actual = calculateDenomTotal();
    try {
        await db.closeShift(currentStoreId, shift.id, actual, shiftNote, denominations);
        setIsShiftModalOpen(false);
        setDenominations({});
        setShiftNote('');
        await loadData();
        showToast("Shift closed successfully", "SUCCESS");
    } catch (e) {
        setShiftError("Failed to close shift");
    }
  };

  const handlePrintFinal = () => {
    if (!previewOrder) return;
    const html = generateReceiptHtml(previewOrder, true, previewPaperSize);
    const printWindow = window.open('', '_blank', 'width=600,height=800');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    } else {
      alert("Pop-up blocked. Please allow pop-ups to print receipts.");
    }
  };

  const renderSimpleMenu = () => (
    <>
      <div className="flex flex-col gap-4 h-full">
          <div className="relative group shrink-0">
              <Search className="absolute left-4 top-3 text-gray-400 group-focus-within:text-blue-600 transition-colors" size={16}/>
              <input 
                  className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold dark:text-white shadow-sm transition-all text-sm" 
                  placeholder="Search items..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
              />
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0 pb-1">
              <button onClick={() => setSelectedCategoryId('ALL')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border whitespace-nowrap ${selectedCategoryId === 'ALL' ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-100 dark:border-gray-700'}`}>All Items</button>
              {categories.map((cat: Category) => (
                  <button key={cat.id} onClick={() => setSelectedCategoryId(cat.id)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border whitespace-nowrap ${selectedCategoryId === cat.id ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-100 dark:border-gray-700'}`}>{cat.name}</button>
              ))}
          </div>
          <div className="flex-1 pr-2 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 content-start">
                  {products.filter((p: Product) => p.name.toLowerCase().includes(searchTerm.toLowerCase()) && (selectedCategoryId === 'ALL' || p.categoryId === selectedCategoryId)).map((product: Product) => (
                      <button key={product.id} onClick={() => addToCart(product)} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 hover:border-blue-500 text-left flex flex-col transition-all active:scale-95 shadow-sm group p-2">
                          <div className="w-full bg-gray-50 dark:bg-gray-700 rounded-xl mb-2 flex items-center justify-center text-gray-300 overflow-hidden relative h-16" style={{ height: `${4 * menuScale}rem` }}>
                              {product.imageUrl ? <img src={product.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /> : <Utensils size={20 * menuScale}/>}
                          </div>
                          <h3 className="text-[11px] font-black truncate dark:text-white mb-0.5 uppercase tracking-tight leading-tight">{product.name}</h3>
                          <p className="text-blue-600 dark:text-blue-400 font-black text-xs tracking-tighter">{store?.currency}{product.price.toFixed(2)}</p>
                      </button>
                  ))}
              </div>
          </div>
      </div>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4 px-3 py-1.5 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-gray-200 rounded-2xl shadow-xl">
          <Maximize2 size={14} className="text-gray-400"/><input type="range" min="0.8" max="1.5" step="0.05" value={menuScale} onChange={(e) => setMenuScale(parseFloat(e.target.value))} className="w-24 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"/><span className="text-[10px] font-black text-blue-600 w-8">{Math.round(menuScale * 100)}%</span>
      </div>
    </>
  );

  const renderDetailView = () => (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950 p-4 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
      {/* Top Bar: Search, Options, and Order # */}
      <div className="flex flex-col md:flex-row items-center gap-3 mb-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 rounded-2xl shadow-sm">
        
        <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 px-2 shrink-0">Enter Item(s)</div>
        <div className="flex-1 relative w-full">
           <div className="absolute left-3 top-2.5 text-gray-400">
             <Search size={18}/>
           </div>
           <input 
             className="w-full bg-blue-50/30 dark:bg-blue-900/10 border border-gray-200 dark:border-gray-700 rounded-xl pl-10 pr-4 py-2 text-sm font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
             placeholder="< Type or Scan item info here >"
             value={searchTerm}
             onChange={e => {
                setSearchTerm(e.target.value);
                const match = products.find(p => p.name.toLowerCase() === e.target.value.toLowerCase());
                if (match) { addToCart(match); setSearchTerm(''); }
             }}
           />
           {searchTerm && (
             <div className="absolute top-full left-0 w-full bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl shadow-2xl z-50 mt-1 max-h-48 overflow-y-auto">
               {products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).map(p => (
                 <button key={p.id} onClick={() => { addToCart(p); setSearchTerm(''); }} className="w-full text-left p-3 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-b last:border-0 border-gray-100 dark:border-gray-700 text-xs uppercase font-black text-gray-700 dark:text-gray-300 flex justify-between">
                   <span>{p.name}</span>
                   <span className="text-blue-600 dark:text-blue-400">{store?.currency}{p.price.toFixed(2)}</span>
                 </button>
               ))}
             </div>
           )}
        </div>
        
        {/* Order Type Switcher */}
        <div className="flex gap-1.5 bg-gray-100/50 dark:bg-gray-800 p-1 rounded-xl border dark:border-gray-700 shrink-0">
          {[OrderType.DINE_IN, OrderType.TAKEAWAY, OrderType.DELIVERY].map((t) => (
              <button 
                key={t} 
                onClick={() => setOrderType(t)} 
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${orderType === t ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-400'}`}
              >
                  {t === OrderType.DINE_IN ? 'Dine In' : t === OrderType.TAKEAWAY ? 'Take Away' : 'Delivery'}
              </button>
          ))}
        </div>

        {/* Table Selection (Visible when Dine In is selected) */}
        {orderType === OrderType.DINE_IN && (
          <div className="flex items-center gap-2 px-3 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm shrink-0">
              <Tag size={14} className="text-blue-600" />
              <select 
                className="bg-transparent text-[10px] font-black uppercase outline-none dark:text-white py-1 cursor-pointer" 
                value={tableNumber} 
                onChange={e => setTableNumber(e.target.value)}
              >
                  <option value="">Table #</option>
                  {Array.from({length: store?.numberOfTables || 0}, (_, i) => (i + 1).toString()).map(num => <option key={num} value={num}>Table {num}</option>)}
              </select>
          </div>
        )}

        <div className="h-6 w-px bg-gray-200 dark:border-gray-700 mx-1 hidden md:block" />

        {/* Ticket Indicator - Top Right */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-100 dark:border-blue-900/50 shrink-0">
            <Hash size={14} className="font-black"/>
            <span className="text-xs font-black uppercase tracking-tighter">Ticket #{resumedOrder ? resumedOrder.orderNumber : nextOrderNum}</span>
        </div>
      </div>

      {/* Main Item List Table */}
      <div className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden flex flex-col mb-4 shadow-sm">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full border-collapse">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
              <tr className="text-left">
                <th className="p-3 text-[10px] font-black uppercase text-gray-500 tracking-widest w-16">Item #</th>
                <th className="p-3 text-[10px] font-black uppercase text-gray-500 tracking-widest">Description</th>
                <th className="p-3 text-[10px] font-black uppercase text-gray-500 tracking-widest text-center w-24">Qty</th>
                <th className="p-3 text-[10px] font-black uppercase text-gray-500 tracking-widest text-right w-24">Price</th>
                <th className="p-3 text-[10px] font-black uppercase text-gray-500 tracking-widest text-right w-24">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {cart.map((item, idx) => (
                <tr key={idx} className="hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors group">
                  <td className="p-3 font-mono text-xs text-gray-400 font-bold">#{item.productId}</td>
                  <td className="p-3 font-black text-xs text-gray-800 dark:text-gray-200 uppercase tracking-tight">{item.productName}</td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-3">
                       <button onClick={() => updateQuantity(item.productId, -1)} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all opacity-0 group-hover:opacity-100"><XCircle size={16}/></button>
                       <span className="font-black text-sm dark:text-white">{item.quantity}</span>
                       <button onClick={() => updateQuantity(item.productId, 1)} className="p-1 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all opacity-0 group-hover:opacity-100"><Plus size={16}/></button>
                    </div>
                  </td>
                  <td className="p-3 text-right font-bold text-gray-600 dark:text-gray-400">{store?.currency}{item.price.toFixed(2)}</td>
                  <td className="p-3 text-right font-black text-blue-600 dark:text-blue-400">{store?.currency}{(item.price * item.quantity).toFixed(2)}</td>
                </tr>
              ))}
              {cart.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-300 dark:text-gray-700">
                      <ShoppingCart size={48} strokeWidth={1} className="opacity-20 mb-2" />
                      <p className="font-black text-[10px] uppercase tracking-[0.3em]">Transaction Empty</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Section: Customer and Totals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Customer Info Box */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 rounded-2xl flex flex-col shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <div className="text-[10px] uppercase font-black text-gray-400 tracking-[0.2em]">Customer Information</div>
            {selectedCustomer && <button onClick={() => {setSelectedCustomer(null); setCustomerSearch('');}} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 p-1 rounded-lg transition-colors"><X size={14}/></button>}
          </div>
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={14} />
              <input 
                className="w-full bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded-xl pl-8 pr-4 py-2 text-xs font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500" 
                placeholder="Find customer record..." 
                value={customerSearch}
                onChange={e => {setCustomerSearch(e.target.value); setShowCustomerResults(true);}}
                onFocus={() => setShowCustomerResults(true)}
              />
            </div>
            <button className="bg-blue-600 text-white p-2 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95" onClick={() => setIsCustomerModalOpen(true)}><UserPlus size={18}/></button>
          </div>
          {showCustomerResults && customerSearch && (
              <div className="relative">
                  <div className="absolute bottom-full left-0 w-full bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl shadow-2xl z-50 mb-2 max-h-32 overflow-y-auto">
                    {customers.filter(c => (c.name||'').toLowerCase().includes(customerSearch.toLowerCase()) || c.phone.includes(customerSearch)).map(c => (
                        <button key={c.id} onClick={() => {setSelectedCustomer(c); setCustomerSearch(c.name||c.phone); setShowCustomerResults(false);}} className="w-full text-left p-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-b last:border-0 border-gray-100 dark:border-gray-700 text-[10px] uppercase font-black text-gray-700 dark:text-gray-300">{c.name || 'Individual'} ({c.phone})</button>
                    ))}
                  </div>
              </div>
          )}
          <div className="flex-1 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 border border-gray-100 dark:border-gray-800/80">
            {selectedCustomer ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-bold text-gray-500 uppercase"><span>Identify</span><span className="text-gray-800 dark:text-white font-black">{selectedCustomer.type === 'COMPANY' ? selectedCustomer.companyName : (selectedCustomer.name || 'Customer')}</span></div>
                  <div className="flex justify-between items-center text-[10px] font-bold text-gray-500 uppercase"><span>Contact No</span><span className="text-gray-800 dark:text-white font-black font-mono tracking-tighter">{selectedCustomer.phone}</span></div>
                  <div className="flex justify-between items-start text-[10px] font-bold text-gray-500 uppercase">
                    <span>Address</span>
                    <span className="text-gray-800 dark:text-white font-black text-right max-w-[200px] truncate" title={formatAddress(selectedCustomer)}>{formatAddress(selectedCustomer)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold text-gray-500 uppercase"><span>Account Type</span><span className="text-blue-600 dark:text-blue-400 font-black">{selectedCustomer.type}</span></div>
                </div>
            ) : <div className="h-full flex items-center justify-center text-[10px] text-gray-400 font-black uppercase tracking-widest opacity-60">Anonymous Account</div>}
          </div>
        </div>

        {/* Totals Box */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 rounded-2xl flex flex-col justify-between shadow-sm">
           <div className="space-y-2">
             <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Subtotal Amount</span>
                <div className="text-right dark:text-white font-mono font-black text-xs">{store?.currency}{totals.subtotal.toFixed(2)}</div>
             </div>
             <div className="flex justify-between items-center">
                <div className="flex items-center gap-1">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Discount (%)</span>
                    <input type="number" className="w-12 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg px-1 text-center font-black text-[10px] dark:text-white" value={discountPercent} onChange={e => setDiscountPercent(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="text-right text-red-500 font-mono font-black text-xs">-{store?.currency}{totals.discountAmount.toFixed(2)}</div>
             </div>
             
             {/* Service Charge (Visible when Dine In is active) */}
             <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Service Charge ({orderType === OrderType.DINE_IN ? store?.serviceChargeRate || 0 : 0}%)</span>
                <div className="text-right dark:text-white font-mono font-black text-xs">{store?.currency}{totals.serviceCharge.toFixed(2)}</div>
             </div>

             <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Taxes (GST {store?.taxRate}%)</span>
                <div className="text-right dark:text-white font-mono font-black text-xs">{store?.currency}{totals.tax.toFixed(2)}</div>
             </div>
           </div>
           <div className="flex justify-between items-end mt-4 pt-4 border-t dark:border-gray-800">
              <span className="text-sm font-black text-blue-600 uppercase tracking-tighter">Grand Total</span>
              <div className="bg-black dark:bg-gray-950 text-[#00ff00] font-mono text-3xl px-6 py-2 leading-none shadow-inner border-2 border-gray-800 dark:border-gray-900 rounded-xl select-none">
                {store?.currency}{totals.total.toFixed(2)}
              </div>
           </div>
        </div>
      </div>

      {/* Detail Footer Buttons */}
      <div className="flex flex-wrap md:flex-nowrap justify-end items-center gap-3 mt-4">
        <div className="flex gap-3 w-full md:w-auto">
            <button onClick={handleCheckout} disabled={cart.length === 0} className="flex-1 md:px-10 flex items-center justify-center gap-2 bg-blue-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-30"><DollarSign size={18}/> Take Payment</button>
            <button onClick={handleSendToKitchen} disabled={cart.length === 0} className="flex-1 md:px-8 flex items-center justify-center gap-2 bg-emerald-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/30 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-30"><History size={18}/> Pay Later</button>
            <button onClick={clearCart} className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl hover:bg-red-100 transition-all active:scale-95" title="Cancel Transaction"><XCircle size={20}/></button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-10.5rem)] overflow-hidden relative">
      <div ref={exportRef} style={{ position: 'fixed', left: '0', top: '0', zIndex: '-100', opacity: '1', pointerEvents: 'none', backgroundColor: 'white' }} />
      {toast && (<div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-top-2"><div className={`px-6 py-2.5 rounded-full shadow-2xl flex items-center gap-3 text-white text-xs font-black uppercase tracking-widest border-2 ${toast.type === 'SUCCESS' ? 'bg-emerald-600 border-emerald-400' : toast.type === 'ERROR' ? 'bg-red-600 border-red-400' : 'bg-blue-600 border-blue-400'}`}>{toast.type === 'SUCCESS' ? <CheckCircle size={16}/> : toast.type === 'ERROR' ? <AlertCircle size={16}/> : <Info size={16}/>}{toast.message}</div></div>)}

      <div className="flex-1 flex flex-col gap-4 min-w-0 overflow-hidden">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 shrink-0">
              <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl border dark:border-gray-700">
                  {[
                    { id: 'MENU', label: 'SALES' },
                    { id: 'ACTIVE', label: 'ACTIVE', count: activeOrders.length, badgeColor: 'bg-yellow-400 text-yellow-900' },
                    { id: 'HELD', label: 'HELD', count: heldOrders.length, badgeColor: 'bg-orange-500 text-white' },
                    { id: 'HISTORY', label: 'HISTORY' }
                  ].map((tab: { id: string, label: string, count?: number, badgeColor?: string }) => (
                      <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === tab.id ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                          {tab.label} {tab.count !== undefined && tab.count > 0 && (<span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black ${tab.badgeColor}`}>{tab.count}</span>)}
                      </button>
                  ))}
                  <div className="mx-2 w-px bg-gray-200 dark:bg-gray-700 my-1" />
                  <button onClick={() => { setViewMode(viewMode === 'SIMPLE' ? 'DETAIL' : 'SIMPLE'); resetOrderUI(); }} className="px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-blue-100 dark:border-blue-900 transition-all hover:bg-blue-100 flex items-center gap-2">
                    {viewMode === 'SIMPLE' ? <StoreIcon size={14}/> : <LayoutGrid size={14}/>} {viewMode === 'SIMPLE' ? 'Detail View' : 'Simple View'}
                  </button>
                  <div className="mx-2 w-px bg-gray-200 dark:bg-gray-700 my-1" />
                  {shift ? (
                      <button onClick={() => setIsShiftModalOpen(true)} className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-100 transition-all hover:bg-red-100 flex items-center gap-2"><Lock size={14}/> End Shift #{shift.shiftNumber}</button>
                  ) : (
                      <button onClick={() => setIsShiftModalOpen(true)} className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-100 transition-all hover:bg-emerald-100 flex items-center gap-2"><Unlock size={14}/> Open Register</button>
                  )}
              </div>
          </div>

          <div className="flex-1 flex flex-col min-w-0 relative h-full overflow-hidden">
              {activeTab === 'MENU' ? (viewMode === 'SIMPLE' ? renderSimpleMenu() : renderDetailView()) : (
                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700">
                      {activeTab === 'ACTIVE' ? (
                          <div className="overflow-x-auto">
                              <table className="w-full text-left">
                                  <thead className="bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-700 text-[10px] font-black uppercase text-gray-500 tracking-widest">
                                      <tr>
                                          <th className="p-4">Ticket</th>
                                          <th className="p-4">Time</th>
                                          <th className="p-4">Summary</th>
                                          <th className="p-4">Type</th>
                                          <th className="p-4 text-right">Amount</th>
                                          <th className="p-4 text-center">Status</th>
                                          <th className="p-4 text-right">Actions</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y dark:divide-gray-700">
                                      {activeOrders.map(order => (
                                          <tr key={order.id} className="hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors">
                                              <td className="p-4 font-mono font-black text-blue-600 dark:text-blue-400">#{order.orderNumber}</td>
                                              <td className="p-4 text-xs font-bold text-gray-400 flex items-center gap-1.5"><Clock size={12}/> {new Date(order.createdAt).toLocaleTimeString()}</td>
                                              <td className="p-4">
                                                  <div className="text-xs font-black dark:text-white uppercase flex items-center gap-1.5"><UserIcon size={12} className="text-blue-500"/> {order.customerName || 'Standard Order'}</div>
                                                  {order.tableNumber && <div className="text-[10px] text-blue-500 font-bold uppercase mt-0.5 ml-4.5">Table {order.tableNumber}</div>}
                                              </td>
                                              <td className="p-4">
                                                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300 w-fit">
                                                  {order.orderType === OrderType.DINE_IN ? <Utensils size={10}/> : order.orderType === OrderType.TAKEAWAY ? <ShoppingBag size={10}/> : <Navigation size={10}/>}
                                                  {order.orderType === OrderType.TAKEAWAY ? 'Take Away' : order.orderType === OrderType.DELIVERY ? 'Delivery' : 'Dine In'}
                                                </div>
                                              </td>
                                              <td className="p-4 text-right font-black dark:text-white tracking-tighter">{store?.currency}{order.total.toFixed(2)}</td>
                                              <td className="p-4 text-center">
                                                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${order.kitchenStatus === 'READY' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{order.kitchenStatus || 'Pending'}</span>
                                              </td>
                                              <td className="p-4 text-right">
                                                  <div className="flex justify-end gap-1.5">
                                                      <button onClick={() => resumeOrder(order)} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all" title="Edit"><Edit size={18}/></button>
                                                      <button onClick={(e) => handleHoldActiveOrder(order, e)} className="p-2 text-orange-600 hover:bg-orange-50 dark:hover:bg-blue-900/30 rounded-lg transition-all" title="Hold"><PauseCircle size={18}/></button>
                                                      <button onClick={() => {setPreviewOrder(order); setPrintModalOpen(true);}} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all" title="Print"><Printer size={18}/></button>
                                                      <button onClick={() => {setOrderToSettle(order); setIsPaymentModalOpen(true);}} className="p-2 bg-blue-600 text-white hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-500/20 transition-all" title="Checkout"><DollarSign size={18}/></button>
                                                  </div>
                                              </td>
                                          </tr>
                                      ))}
                                      {activeOrders.length === 0 && <tr><td colSpan={7} className="p-20 text-center text-gray-300 italic font-black uppercase tracking-[0.2em] opacity-40">No active tickets</td></tr>}
                                  </tbody>
                              </table>
                          </div>
                      ) : activeTab === 'HELD' ? (
                          <div className="overflow-x-auto">
                              <table className="w-full text-left">
                                  <thead className="bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-700 text-[10px] font-black uppercase text-gray-500 tracking-widest">
                                      <tr>
                                          <th className="p-4">Ticket</th>
                                          <th className="p-4">Saved Time</th>
                                          <th className="p-4">Details</th>
                                          <th className="p-4 text-right">Amount</th>
                                          <th className="p-4 text-right">Actions</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y dark:divide-gray-700">
                                      {heldOrders.map(order => (
                                          <tr key={order.id} className="hover:bg-orange-50/50 dark:hover:bg-orange-900/10 transition-colors">
                                              <td className="p-4 font-mono font-black text-orange-600">#{order.orderNumber}</td>
                                              <td className="p-4 text-xs font-bold text-gray-400 flex items-center gap-1.5"><Clock size={12}/> {new Date(order.createdAt).toLocaleTimeString()}</td>
                                              <td className="p-4">
                                                  <div className="text-xs font-black dark:text-white uppercase flex items-center gap-1.5"><UserIcon size={12} className="text-orange-500"/> {order.customerName || 'Unnamed Order'}</div>
                                                  <div className="text-[10px] text-gray-400 font-bold uppercase mt-0.5 ml-4.5">{order.orderType === OrderType.TAKEAWAY ? 'Take Away' : order.orderType === OrderType.DELIVERY ? 'Delivery' : 'Dine In'}</div>
                                              </td>
                                              <td className="p-4 text-right font-black dark:text-white tracking-tighter">{store?.currency}{order.total.toFixed(2)}</td>
                                              <td className="p-4 text-right">
                                                  <button onClick={() => handleActivateOrder(order)} className="flex items-center gap-2 ml-auto px-4 py-2 bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-700 shadow-xl shadow-orange-500/20 active:scale-95 transition-all">
                                                      <Play size={12}/> Activate Order
                                                  </button>
                                              </td>
                                          </tr>
                                      ))}
                                      {heldOrders.length === 0 && <tr><td colSpan={5} className="p-20 text-center text-gray-300 italic font-black uppercase tracking-[0.2em] opacity-40">No saved tickets</td></tr>}
                                  </tbody>
                              </table>
                          </div>
                      ) : (
                          <div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800"><tr className="text-[10px] font-black uppercase text-gray-400 tracking-widest"><th className="p-3">Time</th><th className="p-3">Ticket</th><th className="p-3">Summary</th><th className="p-3 text-right">Amount</th><th className="p-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-gray-50 dark:divide-gray-700">{historyOrders.map((order: Order) => (<tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"><td className="p-3 text-[11px] font-bold text-gray-500">{new Date(order.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</td><td className="p-3 font-mono font-black text-blue-600 text-xs">#{order.orderNumber}</td><td className="p-3"><div className="text-[11px] font-black dark:text-white uppercase tracking-tight leading-none mb-1">{order.customerName || 'Walk-in'}</div></td><td className="p-3 text-right font-black text-sm dark:text-white tracking-tighter">{store?.currency}{order.total.toFixed(2)}</td><td className="p-3 text-right"><button onClick={() => {setPreviewOrder(order); setPrintModalOpen(true);}} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="Reprint"><Printer size={18}/></button></td></tr>))}</tbody></table></div>
                      )}
                  </div>
              )}
          </div>
      </div>

      {viewMode === 'SIMPLE' && (
      <aside className="w-full lg:w-[380px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex flex-col shadow-2xl overflow-hidden h-full rounded-3xl">
          <div className="p-5 border-b border-gray-100 dark:border-gray-800 space-y-4 shrink-0">
              <div className="flex justify-between items-center">
                  <div>
                      <h2 className="font-black text-xl dark:text-white tracking-tighter uppercase leading-none">Order Details</h2>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-2"><Hash size={11} /> Ticket Queue {resumedOrder ? resumedOrder.orderNumber : nextOrderNum}</div>
                  </div>
                  <div className="flex items-center gap-2"><button onClick={() => setIsCartMetadataCollapsed(!isCartMetadataCollapsed)} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all">{isCartMetadataCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}</button>{cart.length > 0 && (<button onClick={clearCart} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={20} /></button>)}</div>
              </div>
              {!isCartMetadataCollapsed && (<div className="space-y-4 animate-in slide-in-from-top-2 duration-300"><div className="flex gap-1.5 bg-gray-100/50 dark:bg-gray-800 p-1.5 rounded-2xl border dark:border-gray-700">{[OrderType.DINE_IN, OrderType.TAKEAWAY, OrderType.DELIVERY].map((t: OrderType) => (<button key={t} onClick={() => setOrderType(t)} className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${orderType === t ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>{t === OrderType.DINE_IN ? 'Dine In' : t === OrderType.TAKEAWAY ? 'Take Away' : 'Delivery'}</button>))}</div><div className="space-y-3"><div className="relative group"><div className="absolute left-3.5 top-3 text-gray-400 group-focus-within:text-blue-600 transition-colors"><Search size={18} /></div><input type="text" placeholder="Find Customer..." className="w-full pl-10 pr-12 py-3 bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded-2xl text-[11px] font-bold dark:text-white outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" value={customerSearch} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setCustomerSearch(e.target.value); setSelectedCustomer(null); setShowCustomerResults(true); }} onFocus={() => setShowCustomerResults(true)} /><button onClick={() => { setIsCustomerModalOpen(true); }} className="absolute right-2 top-2 p-2 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all active:scale-95"><UserPlus size={16}/></button>{showCustomerResults && customerSearch && !selectedCustomer && (<div className="absolute top-full left-0 w-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-2xl mt-2 z-[60] max-h-48 overflow-y-auto p-1.5">{customers.filter(c => (c.name || '').toLowerCase().includes(customerSearch.toLowerCase()) || c.phone.includes(customerSearch)).map(c => (<button key={c.id} onClick={() => {setSelectedCustomer(c); setCustomerSearch(c.name || c.phone); setShowCustomerResults(false);}} className="w-full text-left p-3 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl border-b last:border-0 dark:border-gray-700 flex items-center gap-3"><div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/50 text-blue-600 rounded-xl flex items-center justify-center font-black text-xs">{c.name ? c.name[0] : '#'}</div><div><div className="font-black text-[11px] dark:text-white uppercase leading-none">{c.name || c.phone}</div><div className="text-[9px] text-gray-500 font-mono mt-1">{c.phone}</div></div></button>))}</div>)}</div>{selectedCustomer && (
                <div className="p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1 overflow-hidden">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest bg-white dark:bg-gray-800 px-1.5 py-0.5 rounded shadow-sm border border-blue-50 dark:border-blue-900">{selectedCustomer.type === 'COMPANY' ? 'Company' : 'Individual'}</span>
                      </div>
                      <div className="font-black text-[11px] dark:text-white truncate uppercase mt-1">{selectedCustomer.name || 'Customer'}</div>
                      <div className="text-[10px] text-gray-500 flex items-center gap-1.5 font-bold"><Phone size={10} /> {selectedCustomer.phone}</div>
                      <div className="text-[9px] text-gray-400 flex items-center gap-1.5 font-medium italic"><MapPin size={10} /> {formatAddress(selectedCustomer)}</div>
                    </div>
                    <button onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); }} className="p-1 hover:bg-red-50 text-gray-300 hover:text-red-500 rounded-lg"><X size={14} /></button>
                  </div>
                </div>
              )}{orderType === OrderType.DINE_IN && (<div className="flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 py-1.5 px-4 rounded-2xl shadow-sm"><div className="text-gray-400"><Tag size={16}/></div><select className="flex-1 bg-transparent text-xs font-black uppercase tracking-widest outline-none dark:text-white py-2" value={tableNumber} onChange={e => setTableNumber(e.target.value)}><option value="">Table Number</option>{Array.from({length: store?.numberOfTables || 0}, (_: any, i: number) => (i + 1).toString()).map((num: string) => <option key={num} value={num}>Table {num}</option>)}</select></div>)}</div></div>)}
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">{cart.length === 0 ? (<div className="h-full flex flex-col items-center justify-center text-gray-200 opacity-80"><ShoppingBag size={64} strokeWidth={1} className="opacity-20" /><p className="font-black uppercase tracking-[0.3em] text-[10px] mt-4">Cart Empty</p></div>) : cart.map((item: OrderItem) => (<div key={item.productId} className="flex items-center justify-between group bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm"><div className="flex-1 pr-4"><div className="text-[11px] font-black dark:text-white uppercase tracking-tight leading-tight mb-1 truncate max-w-[150px]">{item.productName}</div><div className="text-[9px] font-black text-blue-600 tracking-tighter">{store?.currency}{item.price.toFixed(2)}</div></div><div className="flex items-center gap-3"><div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 p-1 rounded-xl border dark:border-gray-700"><button onClick={() => updateQuantity(item.productId, -1)} className="w-6 h-6 flex items-center justify-center bg-white dark:bg-gray-700 rounded-lg text-gray-600 hover:text-red-500 shadow-sm transition-all text-xs font-bold">-</button><span className="text-[11px] font-black dark:text-white w-4 text-center">{item.quantity}</span><button onClick={() => updateQuantity(item.productId, 1)} className="w-6 h-6 flex items-center justify-center bg-white dark:bg-gray-700 rounded-lg text-gray-600 hover:text-blue-500 shadow-sm transition-all text-xs font-bold">+</button></div><div className="w-16 text-right font-black text-xs dark:text-white tracking-tighter">{store?.currency}{(item.price * item.quantity).toFixed(2)}</div></div></div>))}</div>
          <div className="p-6 bg-gray-50/50 dark:bg-gray-950/30 border-t border-gray-100 dark:border-gray-800 shrink-0"><div className="space-y-2 mb-6"><div className="flex justify-between items-center text-[11px] font-bold text-gray-400 uppercase tracking-widest"><span>Subtotal</span><span className="text-gray-900 dark:text-white font-black">{store?.currency}{totals.subtotal.toFixed(2)}</span></div><div className="relative"><div className="flex justify-between items-center text-[11px] font-bold text-gray-400 uppercase tracking-widest"><span>Discount</span><div className="flex items-center gap-3">{totals.discountAmount > 0 && (<span className="text-red-500 font-black">-{store?.currency}{totals.discountAmount.toFixed(2)}</span>)}<button onClick={(e: React.MouseEvent) => { e.stopPropagation(); setShowDiscountPresets(!showDiscountPresets); }} className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border transition-all ${discountPercent > 0 ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-100'}`}><Percent size={12}/><span className="text-[10px] font-black">{discountPercent}%</span></button></div></div>{showDiscountPresets && (<div className="absolute bottom-full right-0 mb-3 w-64 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-3xl shadow-2xl p-5 z-30"><div className="flex justify-between items-center mb-4"><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Presets</p><button onClick={() => { setDiscountPercent(0); setShowDiscountPresets(false); }} className="text-[10px] font-black text-red-500 uppercase hover:underline">Reset</button></div><div className="grid grid-cols-4 gap-2 mb-4">{DISCOUNT_PRESETS.map((p: number) => (<button key={p} onClick={() => { setDiscountPercent(p); setShowDiscountPresets(false); }} className={`py-2.5 rounded-xl text-xs font-black border transition-all ${discountPercent === p ? 'bg-blue-600 text-white' : 'bg-gray-50'}`}>{p}%</button>))}</div><div className="space-y-2"><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Custom</p><div className="relative"><input type="number" className="w-full p-3 bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-sm font-black outline-none" value={discountPercent || ''} onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}/><div className="absolute right-4 top-3 text-gray-400 font-black text-sm">%</div></div></div></div>)}</div>{(totals.serviceCharge > 0 || (store?.serviceChargeRate && store.serviceChargeRate > 0)) && (<div className="flex justify-between items-center text-[11px] font-bold text-gray-400 uppercase tracking-widest"><span>Service Charge {store?.serviceChargeRate ? `(${store.serviceChargeRate}%)` : ''}</span><span className="text-gray-900 dark:text-white font-black">{store?.currency}{totals.serviceCharge.toFixed(2)}</span></div>)}<div className="flex justify-between items-center text-[11px] font-bold text-gray-400 uppercase tracking-widest"><span>GST ({store?.taxRate}%)</span><span className="text-gray-900 dark:text-white font-black">{store?.currency}{totals.tax.toFixed(2)}</span></div><div className="flex justify-between items-center pt-4 mt-2 border-t border-gray-200 dark:border-gray-800"><span className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tighter">Total Payable</span><span className="text-4xl font-black text-blue-600 tracking-tighter">{store?.currency}{totals.total.toFixed(2)}</span></div></div><div className="grid grid-cols-2 gap-3 mb-2"><button onClick={handleSendToKitchen} disabled={cart.length === 0} className={`flex items-center justify-center gap-2 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-30 ${isKOTEnabled ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 hover:bg-orange-200' : 'bg-orange-600 text-white hover:bg-orange-700 shadow-xl shadow-orange-500/20'}`}>{isKOTEnabled ? <><ChefHat size={18}/> KOT</> : <><History size={18}/> Pay Later</>}</button><button onClick={handleCheckout} disabled={cart.length === 0} className="flex items-center justify-center gap-2 py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all active:scale-[0.98] disabled:opacity-30"><DollarSign size={20}/> Pay</button></div></div></aside>
      )}

      {isPaymentModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-700 flex flex-col">
                  <div className="p-8 border-b dark:border-gray-700 flex justify-between items-center"><div><h2 className="text-2xl font-black dark:text-white uppercase tracking-tighter">Settlement Center</h2><p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">Ticket: {orderToSettle ? `#${orderToSettle.orderNumber}` : (resumedOrder ? `#${resumedOrder.orderNumber}` : `Terminal Sale`)}</p></div><button onClick={() => setIsPaymentModalOpen(false)} className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"><X size={24} className="text-gray-400" /></button></div>
                  <div className="flex flex-col md:flex-row min-h-[480px]"><div className="flex-1 p-10 flex flex-col bg-blue-50/20 dark:bg-blue-900/5"><div className="mb-8 flex justify-between items-end"><div><span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-2 block">Amount Payable</span><h1 className="text-5xl font-black text-blue-600 tracking-tighter">{store?.currency}{(orderToSettle ? orderToSettle.total : totals.total).toFixed(2)}</h1></div><button onClick={() => setIsSplitMode(!isSplitMode)} className={`flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase transition-all ${isSplitMode ? 'bg-purple-600 text-white shadow-lg' : 'bg-gray-100 text-gray-500'}`}><Split size={14}/> {isSplitMode ? 'Cancel Split' : 'Split'}</button></div>{isSplitMode ? (<div className="space-y-4"><div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border-2 border-purple-100"><div className="flex justify-between items-center mb-3"><span className="text-[10px] font-black uppercase text-purple-600">Part 1</span><div className="flex gap-1">{['CASH', 'CARD', 'TRANSFER'].map((m: string) => (<button key={m} onClick={() => setSplitPayment1({...splitPayment1, method: m as any})} className={`px-2 py-1 rounded text-[9px] font-black border ${splitPayment1.method === m ? 'bg-purple-600 text-white' : 'text-gray-400'}`}>{m}</button>))}</div></div><input type="number" className="w-full p-3 bg-gray-50 dark:bg-gray-900 rounded-xl font-black text-lg outline-none" value={splitPayment1.amount} onChange={(e) => setSplitPayment1({...splitPayment1, amount: e.target.value})}/>{splitPayment1.method !== 'CASH' && (<input type="text" placeholder="Ref No" className="w-full p-2.5 bg-purple-50 dark:bg-gray-900 border-2 border-purple-100 rounded-xl font-bold text-xs mt-2" value={splitPayment1.ref} onChange={(e) => setSplitPayment1({...splitPayment1, ref: e.target.value})}/>)}</div><div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border-2 border-purple-100"><div className="flex justify-between items-center mb-3"><span className="text-[10px] font-black uppercase text-purple-600">Part 2</span><div className="flex gap-1">{['CASH', 'CARD', 'TRANSFER'].map((m: string) => (<button key={m} onClick={() => setSplitPayment2({...splitPayment2, method: m as any})} className={`px-2 py-1 rounded text-[9px] font-black border ${splitPayment2.method === m ? 'bg-purple-600 text-white' : 'text-gray-400'}`}>{m}</button>))}</div></div><input type="number" className="w-full p-3 bg-gray-50 dark:bg-gray-900 rounded-xl font-black text-lg outline-none" value={splitPayment2.amount} onChange={(e) => setSplitPayment2({...splitPayment2, amount: e.target.value})}/>{splitPayment2.method !== 'CASH' && (<input type="text" placeholder="Ref No" className="w-full p-2.5 bg-purple-50 dark:bg-gray-900 border-2 border-purple-100 rounded-xl font-bold text-xs mt-2" value={splitPayment2.ref} onChange={(e) => setSplitPayment2({...splitPayment2, ref: e.target.value})}/>)}</div></div>) : (<div className="grid grid-cols-1 w-full gap-3">{[{ id: 'CASH', icon: Banknote, label: 'Cash' }, { id: 'CARD', icon: CreditCard, label: 'Card' }, { id: 'TRANSFER', icon: RefreshCcw, label: 'Transfer' }].map((method) => (<button key={method.id} onClick={() => { setPaymentMethod(method.id as any); setPaymentRef(''); }} className={`flex items-center gap-5 p-5 rounded-[2rem] border-2 transition-all ${paymentMethod === method.id ? 'bg-blue-600 border-blue-600 text-white shadow-2xl' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'}`}><div className={`p-3 rounded-2xl ${paymentMethod === method.id ? 'bg-white/20' : 'bg-gray-100'}`}><method.icon size={24} /></div><p className="text-xs font-black uppercase tracking-widest">{method.label}</p>{paymentMethod === method.id && <div className="ml-auto bg-white/20 p-1 rounded-full"><CheckCircle size={16}/></div>}</button>))}</div>)}</div><div className="w-full md:w-80 p-10 border-l border-gray-100 dark:border-gray-700 flex flex-col justify-between"><div className="space-y-8">{!isSplitMode && paymentMethod === 'CASH' && (<><div className="space-y-3"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Cash Tendered</label><div className="relative"><DollarSign className="absolute left-4 top-4 text-gray-300" size={20}/><input autoFocus type="number" step="0.01" className="w-full pl-10 pr-4 py-4 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl outline-none text-xl font-black dark:text-white" value={amountTendered} onChange={(e) => { setAmountTendered(e.target.value); setPaymentError(''); }}/></div></div><div className="p-5 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100"><p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Change</p><p className="text-3xl font-black text-emerald-700 dark:text-emerald-200">{store?.currency}{Math.max(0, (parseFloat(amountTendered) || 0) - (orderToSettle ? orderToSettle.total : totals.total)).toFixed(2)}</p></div></>)}{!isSplitMode && (paymentMethod === 'CARD' || paymentMethod === 'TRANSFER') && (<div className="space-y-3"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Ref No *</label><div className="relative"><Hash className="absolute left-4 top-4 text-gray-300" size={18}/><input autoFocus type="text" className="w-full pl-10 pr-4 py-4 bg-blue-50 dark:bg-gray-900 rounded-2xl outline-none text-lg font-bold dark:text-white" value={paymentRef} onChange={(e) => { setPaymentRef(e.target.value); setPaymentError(''); }}/></div></div>)}{paymentError && <p className="text-red-500 text-[10px] font-black uppercase">{paymentError}</p>}</div><button onClick={finalizePayment} disabled={isSaving || (!isSplitMode && paymentMethod === 'CASH' && (!amountTendered || parseFloat(amountTendered) < (orderToSettle?.total || totals.total)))} className="w-full py-5 bg-emerald-600 text-white rounded-3xl font-black text-xs uppercase tracking-[0.3em] shadow-2xl hover:bg-emerald-700 flex items-center justify-center gap-3">Finalize <ArrowRight size={18}/></button></div></div>
              </div>
          </div>
      )}

      {printModalOpen && previewOrder && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[250] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 w-full max-w-4xl h-[90vh] flex flex-col rounded-[2.5rem] overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-700">
                  <div className="p-6 border-b flex justify-between items-center bg-gray-50 dark:bg-gray-900/50"><div className="flex items-center gap-4"><Printer size={24} className="text-blue-600"/><div><h2 className="text-xl font-black dark:text-white uppercase tracking-tighter">Receipt Preview: #{previewOrder.orderNumber}</h2></div></div><button onClick={() => setPrintModalOpen(false)} className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"><X size={24}/></button></div>
                  <div className="flex-1 bg-gray-100 dark:bg-gray-950 p-8 flex justify-center overflow-auto custom-scrollbar"><div className="bg-white shadow-2xl h-fit rounded p-1 border"><iframe srcDoc={previewHtml} className="w-[320px] h-[1000px] border-none" title="Receipt Preview" /></div></div>
                  <div className="p-6 border-t flex flex-wrap justify-end gap-3 bg-white dark:bg-gray-900"><button onClick={() => setPrintModalOpen(false)} className="px-6 py-3 text-xs font-black uppercase text-gray-500">Close</button><button onClick={handlePrintFinal} className="px-12 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-blue-700">Execute Print</button></div>
              </div>
          </div>
      )}

      {isCustomerModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="p-8 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/30"><h2 className="text-xl font-bold dark:text-white flex items-center gap-2"><UserIcon className="text-blue-600" /> Add New Customer</h2><button onClick={() => setIsCustomerModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X size={24}/></button></div>
                  <form onSubmit={handleQuickAddCustomer} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
                      <div className="flex gap-4 p-1 bg-gray-100 dark:bg-gray-700 rounded-xl mb-2">
                        <button type="button" onClick={() => setNewCustData({...newCustData, type: 'INDIVIDUAL'})} className={`flex-1 py-2.5 text-xs font-black uppercase rounded-lg ${newCustData.type === 'INDIVIDUAL' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Individual</button>
                        <button type="button" onClick={() => setNewCustData({...newCustData, type: 'COMPANY'})} className={`flex-1 py-2.5 text-xs font-black uppercase rounded-lg ${newCustData.type === 'COMPANY' ? 'bg-white shadow text-purple-600' : 'text-gray-500'}`}>Company</button>
                      </div>
                      
                      {newCustData.type === 'COMPANY' && (
                        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-2xl space-y-4 border border-purple-100">
                          <input placeholder="Company Name *" className="w-full p-2.5 border border-purple-200 rounded-xl bg-white dark:bg-gray-700 font-bold outline-none" value={newCustData.companyName || ''} onChange={(e) => setNewCustData({...newCustData, companyName: e.target.value})} required={newCustData.type === 'COMPANY'} />
                          <input placeholder="TIN *" className="w-full p-2.5 border border-purple-200 rounded-xl bg-white dark:bg-gray-700 font-mono outline-none" value={newCustData.tin || ''} onChange={(e) => setNewCustData({...newCustData, tin: e.target.value})} required={newCustData.type === 'COMPANY'} />
                          <input placeholder="Representative Name *" className="w-full p-2.5 border border-purple-200 rounded-xl bg-white dark:bg-gray-700 font-bold outline-none" value={newCustData.name || ''} onChange={(e) => setNewCustData({...newCustData, name: e.target.value})} required={newCustData.type === 'COMPANY'} />
                        </div>
                      )}

                      <div className="grid grid-cols-1 gap-4">
                        <input placeholder="Phone Number *" className="w-full p-2.5 border border-gray-300 rounded-xl bg-white dark:bg-gray-700 font-mono outline-none focus:ring-2 focus:ring-blue-500" value={newCustData.phone || ''} onChange={(e) => setNewCustData({...newCustData, phone: e.target.value})} required />
                      </div>

                      <div className="border-t pt-6 space-y-4">
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Primary Address</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <input placeholder="Building / House Name *" className="w-full p-2.5 border border-gray-300 rounded-xl bg-white dark:bg-gray-700 outline-none focus:ring-2 focus:ring-blue-500" value={newCustData.type === 'INDIVIDUAL' ? newCustData.houseName : newCustData.buildingName} onChange={(e) => setNewCustData(newCustData.type === 'INDIVIDUAL' ? {...newCustData, houseName: e.target.value} : {...newCustData, buildingName: e.target.value})} required />
                          <input placeholder="Street Name" className="w-full p-2.5 border border-gray-300 rounded-xl bg-white dark:bg-gray-700 outline-none focus:ring-2 focus:ring-blue-500" value={newCustData.type === 'INDIVIDUAL' ? newCustData.streetName : newCustData.street} onChange={(e) => setNewCustData(newCustData.type === 'INDIVIDUAL' ? {...newCustData, streetName: e.target.value} : {...newCustData, street: e.target.value})} />
                        </div>
                        <input placeholder="Island / City *" className="w-full p-2.5 border border-gray-300 rounded-xl bg-white dark:bg-gray-700 outline-none focus:ring-2 focus:ring-blue-500" value={newCustData.island || ''} onChange={(e) => setNewCustData({...newCustData, island: e.target.value})} required />
                      </div>

                      <div className="flex gap-4 pt-4 border-t dark:border-gray-700">
                        <button type="button" onClick={() => setIsCustomerModalOpen(false)} className="flex-1 py-4 text-xs font-black uppercase text-gray-400">Discard</button>
                        <button type="submit" disabled={isSaving} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase shadow-2xl hover:bg-blue-700 transition-all flex items-center justify-center gap-3">{isSaving ? <Loader2 className="animate-spin" size={18}/> : <CheckCircle size={18}/>} Save Record</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {isShiftModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in border border-gray-100 flex flex-col"><div className="p-8 border-b dark:border-gray-700 flex justify-between items-center"><h2 className="text-2xl font-black dark:text-white uppercase tracking-tighter flex items-center gap-3">{shift ? <Lock className="text-red-500"/> : <Unlock className="text-emerald-500"/>} Register</h2><button onClick={() => setIsShiftModalOpen(false)} className="p-3 hover:bg-gray-100 rounded-full transition-colors"><X size={24}/></button></div>
                  <div className="p-10 space-y-8 overflow-y-auto"><div className="bg-blue-50/30 dark:bg-blue-900/10 p-6 rounded-[2rem] border border-blue-100"><p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4">{shift ? 'Closing Cash' : 'Float'}</p><div className="grid grid-cols-3 gap-3">{DENOMINATIONS.slice(0, 6).map((d: number) => (<div key={d} className="flex flex-col gap-1.5"><span className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">{store?.currency}{d}</span><input type="number" min="0" placeholder="0" className="w-full p-3 bg-white dark:bg-gray-800 rounded-xl text-xs font-black dark:text-white text-center shadow-sm" value={denominations[d] || ''} onChange={(e) => setDenominations({...denominations, [d]: parseInt(e.target.value) || 0})}/></div>))}</div></div><div className="flex flex-col items-center py-6 border-y dark:border-gray-800"><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Calculated Total</p><p className="text-5xl font-black dark:text-white tracking-tighter text-blue-600">{store?.currency}{calculateDenomTotal().toFixed(2)}</p></div>{shiftError && <p className="text-red-500 text-xs font-black uppercase text-center animate-bounce">{shiftError}</p>}<div className="flex gap-4"><button type="button" onClick={() => setIsShiftModalOpen(false)} className="px-4 py-5 text-xs font-black uppercase text-gray-400 hover:text-gray-800">Discard</button>{shift ? (<button type="button" onClick={() => setIsShiftConfirmOpen(true)} className="flex-1 py-5 bg-red-600 text-white rounded-3xl font-black text-xs uppercase shadow-2xl hover:bg-red-700">End Shift</button>) : (<button type="button" onClick={handleOpenShift} className="flex-1 py-5 bg-emerald-600 text-white rounded-3xl font-black text-xs uppercase shadow-2xl hover:bg-emerald-700">Open Station</button>)}</div></div>
              </div>
          </div>
      )}

      {isShiftConfirmOpen && shift && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[400] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 p-10 rounded-[3rem] w-full max-md shadow-2xl border border-red-100 text-center animate-in zoom-in-95 duration-300"><div className="w-24 h-24 bg-red-50 dark:bg-red-900/20 rounded-[2rem] flex items-center justify-center text-red-600 mx-auto mb-8 shadow-inner"><Lock size={48}/></div><h2 className="text-3xl font-black dark:text-white mb-3 uppercase tracking-tighter">Finalize Shift End</h2><p className="text-gray-400 font-bold text-sm mb-10 leading-relaxed uppercase tracking-widest max-w-xs mx-auto">This will audit all tallies and lock the station.</p><div className="grid grid-cols-2 gap-6 mb-10"><div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 text-center"><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Expected</p><p className="text-2xl font-black text-white">{store?.currency}{(shift.expectedCash || 0).toFixed(2)}</p></div><div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-[2rem] border border-blue-100 dark:border-blue-700 text-center"><p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">Actual</p><p className="text-2xl font-black text-blue-700 dark:text-blue-100">{store?.currency}{calculateDenomTotal().toFixed(2)}</p></div></div><div className="flex flex-col gap-4"><button onClick={() => { setIsShiftConfirmOpen(false); executeCloseShift(); }} className="w-full py-5 bg-red-600 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-2xl hover:bg-red-700 transition-all">Confirm Closure</button><button onClick={() => setIsShiftConfirmOpen(false)} className="w-full py-4 text-gray-400 font-black text-xs uppercase tracking-widest">Cancel</button></div></div>
          </div>
      )}
    </div>
  );
}