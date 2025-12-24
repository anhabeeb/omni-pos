
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../App';
import { db, uuid } from '../services/db';
import { Product, Category, Order, OrderItem, OrderType, OrderStatus, Store, RegisterShift, Transaction, Customer, User, Permission } from '../types';
import { 
  Search, Trash2, Plus, Minus, CreditCard, Banknote, 
  X, Utensils, ShoppingBag, Lock, Unlock, RefreshCcw, 
  ChefHat, DollarSign, CheckCircle, UserPlus, Edit, PauseCircle, Printer, AlertCircle, Info, Play, StickyNote,
  Maximize2,
  Hash,
  FileImage,
  Percent,
  MapPin,
  Loader2,
  Activity,
  Tag,
  UserSquare,
  LogOut,
  LayoutDashboard,
  ChevronDown,
  ArrowRight
} from 'lucide-react';
// @ts-ignore - Fixing missing member errors in react-router-dom
import { useNavigate } from 'react-router-dom';
import { toJpeg } from 'html-to-image';

const DENOMINATIONS = [1000, 500, 100, 50, 20, 10, 5, 2, 1];

export default function POS() {
  const { user, currentStoreId, switchStore, logout, hasPermission } = useAuth();
  const navigate = useNavigate();

  const [stores, setStores] = useState<Store[]>([]);
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [shift, setShift] = useState<RegisterShift | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | 'ALL'>('ALL');
  const [activeTab, setActiveTab] = useState<'MENU' | 'ORDERS' | 'HELD' | 'HISTORY'>('MENU');
  
  const [menuScale, setMenuScale] = useState(1);
  const [toast, setToast] = useState<{ message: string, type: 'SUCCESS' | 'ERROR' | 'INFO' } | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerResults, setShowCustomerResults] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [newCustData, setNewCustData] = useState<Partial<Customer>>({
    name: '', phone: '', type: 'INDIVIDUAL', companyName: '', tin: '', houseName: '', streetName: '', buildingName: '', street: '', island: '', country: ''
  });

  const [cart, setCart] = useState<OrderItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>(OrderType.DINE_IN);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [tableNumber, setTableNumber] = useState('');
  const [orderNote, setOrderNote] = useState('');
  const [nextOrderNum, setNextOrderNum] = useState<string>('');
  const [discountPercent, setDiscountPercent] = useState<number>(0);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [orderToSettle, setOrderToSettle] = useState<Order | null>(null); 
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'TRANSFER'>('CASH');
  const [amountTendered, setAmountTendered] = useState('');
  const [paymentError, setPaymentError] = useState('');

  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [previewOrder, setPreviewOrder] = useState<Order | null>(null);
  
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isShiftConfirmOpen, setIsShiftConfirmOpen] = useState(false);
  const [shiftNote, setShiftNote] = useState('');
  const [shiftError, setShiftError] = useState('');
  const [denominations, setDenominations] = useState<Record<number, number>>({});

  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [heldOrders, setHeldOrders] = useState<Order[]>([]);
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]);

  const exportRef = useRef<HTMLDivElement>(null);

  const getStorageKeys = (storeId: number) => ({
    cart: `pos_cart_${storeId}`,
    type: `pos_type_${storeId}`,
    customer: `pos_customer_${storeId}`,
    table: `pos_table_${storeId}`,
    note: `pos_note_${storeId}`,
    discount: `pos_discount_${storeId}`
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
    }
  }, [cart, orderType, selectedCustomer, tableNumber, orderNote, discountPercent, currentStoreId]);

  useEffect(() => {
      const handleClickOutside = () => setShowCustomerResults(false);
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

      if (savedCart) setCart(JSON.parse(savedCart));
      if (savedType) setOrderType(savedType as OrderType);
      if (savedCust) {
          try {
              const cust = JSON.parse(savedCust);
              setSelectedCustomer(cust);
              if (cust) setCustomerSearch(cust.name);
          } catch(e) { /* ignore */ }
      }
      if (savedTable) setTableNumber(savedTable);
      if (savedNote) setOrderNote(savedNote);
      if (savedDiscount) setDiscountPercent(parseFloat(savedDiscount) || 0);
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

      const s = sList.find(st => st.id === currentStoreId);
      setStores(sList);
      setStore(s || null);
      setProducts(pList.filter(p => p.isAvailable));
      setCategories(cList.sort((a,b) => (a.orderId || 0) - (b.orderId || 0)));
      setCustomers(custs);
      setUsers(uList);
      setNextOrderNum(orderNum);
      setShift(activeShift || null);

      setActiveOrders(allOrders.filter(o => [OrderStatus.PENDING, OrderStatus.PREPARING, OrderStatus.READY].includes(o.status)).sort((a,b) => b.createdAt - a.createdAt));
      setHeldOrders(allOrders.filter(o => o.status === OrderStatus.ON_HOLD).sort((a,b) => b.createdAt - a.createdAt));
      
      const history = activeShift 
        ? allOrders.filter(o => o.shiftId === activeShift.id && [OrderStatus.COMPLETED, OrderStatus.CANCELLED, OrderStatus.RETURNED].includes(o.status)) 
        : allOrders.filter(o => o.status === OrderStatus.COMPLETED).slice(-20);
      
      setHistoryOrders(history.sort((a,b) => b.createdAt - a.createdAt));
  };

  const formatAddress = (c: Customer) => {
    if (c.type === 'INDIVIDUAL') {
        return [c.houseName, c.streetName, c.address].filter(Boolean).join(', ');
    } else {
        return [c.buildingName, c.street, c.island, c.country, c.address].filter(Boolean).join(', ');
    }
  };

  const addToCart = (product: Product) => {
      if (!shift) { showToast("Register is closed. Please open shift first.", "ERROR"); setIsShiftModalOpen(true); return; }
      setCart(prev => {
          const existing = prev.find(item => item.productId === product.id);
          if (existing) return prev.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item);
          return [...prev, { productId: product.id, productName: product.name, price: product.price, quantity: 1 }];
      });
  };

  const updateQuantity = (productId: number, delta: number) => {
      setCart(prev => prev.map(item => {
          if (item.productId === productId) {
              const newQty = Math.max(0, item.quantity + delta);
              return { ...item, quantity: newQty };
          }
          return item;
      }).filter(item => item.quantity > 0));
  };

  const resetOrderUI = () => {
    setCart([]); 
    setSelectedCustomer(null); 
    setCustomerSearch(''); 
    setTableNumber(''); 
    setOrderNote(''); 
    setOrderType(OrderType.DINE_IN); 
    setDiscountPercent(0);
    if (currentStoreId) {
        const keys = getStorageKeys(currentStoreId);
        localStorage.removeItem(keys.cart);
        localStorage.removeItem(keys.customer);
        localStorage.removeItem(keys.table);
        localStorage.removeItem(keys.note);
        localStorage.removeItem(keys.discount);
    }
  };

  const clearCart = () => { 
      if (confirm("Are you sure you want to clear the current order?")) {
          resetOrderUI();
      }
  };

  const resumeOrder = async (order: Order) => {
    if (!shift) { showToast("Register is closed. Please open shift first.", "ERROR"); setIsShiftModalOpen(true); return; }
    setCart(order.items); setOrderType(order.orderType); setDiscountPercent(order.discountPercent || 0);
    if (order.tableNumber) setTableNumber(order.tableNumber);
    if (order.note) setOrderNote(order.note);
    if (order.customerName) {
        const found = customers.find(c => c.name === order.customerName);
        if (found) { setSelectedCustomer(found); setCustomerSearch(found.name); }
        else setCustomerSearch(order.customerName);
    }
    if (currentStoreId) {
        await db.deleteOrder(currentStoreId, order.id);
        db.logActivity({
            storeId: currentStoreId, userId: user?.id || 0, userName: user?.name || '',
            action: 'ORDER_CREATE',
            description: `Order #${order.orderNumber} resumed from memory/hold`
        });
    }
    setActiveTab('MENU');
    showToast(`Order #${order.orderNumber} resumed in Menu`);
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

  const handleHoldCart = async () => {
    if (!currentStoreId || !user || !shift || cart.length === 0 || isSaving) return;
    if (orderType === OrderType.DINE_IN && !tableNumber) { showToast("Please select a table number.", "ERROR"); return; }
    
    setIsSaving(true);
    const newOrder: Order = {
        id: 0, orderNumber: '', storeId: currentStoreId, shiftId: shift.id,
        items: [...cart], subtotal: totals.subtotal, 
        discountPercent: discountPercent, 
        discountAmount: totals.discountAmount,
        tax: totals.tax, serviceCharge: totals.serviceCharge,
        total: totals.total, orderType, status: OrderStatus.ON_HOLD, kitchenStatus: 'PENDING',
        tableNumber: orderType === OrderType.DINE_IN ? tableNumber : undefined,
        note: orderNote, 
        customerName: selectedCustomer?.name, 
        customerPhone: selectedCustomer?.phone,
        customerTin: selectedCustomer?.tin,
        customerAddress: selectedCustomer ? formatAddress(selectedCustomer) : undefined,
        createdBy: user.id, createdAt: Date.now()
    } as Order;

    resetOrderUI();
    setActiveTab('HELD');
    showToast("Holding order...", "INFO");

    try {
        const added = await db.addOrder(currentStoreId, newOrder);
        db.logActivity({
            storeId: currentStoreId, userId: user.id, userName: user.name,
            action: 'ORDER_CREATE',
            description: `New order #${added.orderNumber} placed on hold`
        });
        showToast("Order placed on hold.", "SUCCESS");
    } catch (e) {
        console.error(e);
        showToast("Order saved locally", "INFO");
    } finally {
        setIsSaving(false);
    }
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
    setActiveTab('ORDERS');
    showToast(`Order #${order.orderNumber} moved to Active`, "SUCCESS");
  };

  const handleSendToKitchen = async () => {
      if (!currentStoreId || !user || !shift || cart.length === 0 || isSaving) return;
      if (orderType === OrderType.DINE_IN && !tableNumber) { showToast("Please select a table number.", "ERROR"); return; }
      
      setIsSaving(true);
      const newOrderData: Order = {
          id: 0, orderNumber: '', storeId: currentStoreId, shiftId: shift.id,
          items: [...cart], subtotal: totals.subtotal, 
          discountPercent: discountPercent, 
          discountAmount: totals.discountAmount,
          tax: totals.tax, serviceCharge: totals.serviceCharge,
          total: totals.total, orderType, status: OrderStatus.PENDING, kitchenStatus: 'PENDING',
          tableNumber: orderType === OrderType.DINE_IN ? tableNumber : undefined,
          note: orderNote, 
          customerName: selectedCustomer?.name, 
          customerPhone: selectedCustomer?.phone, 
          customerTin: selectedCustomer?.tin,
          customerAddress: selectedCustomer ? formatAddress(selectedCustomer) : undefined,
          createdBy: user.id, createdAt: Date.now()
      } as Order;

      resetOrderUI();
      setActiveTab('ORDERS');
      showToast("Sending order to kitchen...", "INFO");

      try {
          const added = await db.addOrder(currentStoreId, newOrderData);
          db.logActivity({
            storeId: currentStoreId, userId: user.id, userName: user.name,
            action: 'ORDER_CREATE',
            description: `New order #${added.orderNumber} sent to kitchen`
          });
          showToast("Order created & sent to kitchen.", "SUCCESS");
      } catch (e) {
          console.error(e);
          showToast("Order sent locally", "INFO");
      } finally {
          setIsSaving(false);
      }
  };

  const totals = useMemo(() => {
      const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const dPercent = discountPercent || 0;
      const discountAmount = (subtotal * dPercent) / 100;
      const subtotalAfterDiscount = subtotal - discountAmount;
      
      const taxRate = store?.taxRate || 0;
      const serviceChargeRate = store?.serviceChargeRate || 0;
      
      const serviceCharge = (orderType === OrderType.DINE_IN) ? (subtotalAfterDiscount * serviceChargeRate) / 100 : 0;
      const tax = ((subtotalAfterDiscount + serviceCharge) * taxRate) / 100;
      
      return { 
          subtotal, 
          discountAmount, 
          subtotalAfterDiscount,
          tax, 
          serviceCharge, 
          total: subtotalAfterDiscount + tax + serviceCharge 
      };
  }, [cart, store, orderType, discountPercent]);

  const handleCheckout = () => {
      if (cart.length === 0) return;
      if (orderType === OrderType.DINE_IN && !tableNumber) { showToast("Please select a table number.", "ERROR"); return; }
      setOrderToSettle(null); setPaymentMethod('CASH'); setAmountTendered(''); setPaymentError(''); setIsPaymentModalOpen(true);
  };

  const handleQuickSettle = (order: Order, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      setOrderToSettle(order); setPaymentMethod('CASH'); setAmountTendered(''); setPaymentError(''); setIsPaymentModalOpen(true);
  };

  const finalizePayment = async () => {
      if (!currentStoreId || !user || !shift || isSaving) return;
      const payableTotal = orderToSettle ? orderToSettle.total : totals.total;
      const tendered = parseFloat(amountTendered) || 0;
      
      if (paymentMethod === 'CASH' && tendered < payableTotal) { 
          setPaymentError(`Short by ${store?.currency}${(payableTotal - tendered).toFixed(2)}`); 
          return; 
      }
      
      setIsSaving(true);
      const transaction: Transaction = {
          id: uuid(), type: 'PAYMENT', amount: payableTotal, method: paymentMethod,
          timestamp: Date.now(), performedBy: user.id, 
          tenderedAmount: paymentMethod === 'CASH' ? tendered : payableTotal,
          changeAmount: paymentMethod === 'CASH' ? tendered - payableTotal : 0
      };

      const localCart = [...cart];
      const localTotals = {...totals};
      const localNote = orderNote;
      const localTable = tableNumber;
      const localType = orderType;
      const localCust = selectedCustomer;
      const localDisc = discountPercent;

      setIsPaymentModalOpen(false);
      resetOrderUI();
      showToast("Processing payment...", "INFO");

      try {
          let finalOrder: Order;
          if (orderToSettle) {
              finalOrder = { ...orderToSettle, status: OrderStatus.COMPLETED, paymentMethod, transactions: [...(orderToSettle.transactions || []), transaction] };
              await db.updateOrder(currentStoreId, finalOrder);
              db.logActivity({
                storeId: currentStoreId, userId: user.id, userName: user.name,
                action: 'ORDER_UPDATE',
                description: `Active order #${finalOrder.orderNumber} settled via ${paymentMethod}`
              });
          } else {
              finalOrder = { 
                id: 0, orderNumber: '', storeId: currentStoreId, shiftId: shift.id, 
                items: localCart, 
                subtotal: localTotals.subtotal, 
                discountPercent: localDisc,
                discountAmount: localTotals.discountAmount,
                tax: localTotals.tax, serviceCharge: localTotals.serviceCharge, 
                total: localTotals.total, orderType: localType, status: OrderStatus.COMPLETED, kitchenStatus: 'SERVED', paymentMethod, note: localNote, transactions: [transaction], tableNumber: localType === OrderType.DINE_IN ? localTable : undefined, 
                customerName: localCust?.name, 
                customerPhone: localCust?.phone, 
                customerTin: localCust?.tin,
                customerAddress: localCust ? formatAddress(localCust) : undefined,
                createdBy: user.id, createdAt: Date.now() 
              } as Order;
              finalOrder = await db.addOrder(currentStoreId, finalOrder);
              db.logActivity({
                storeId: currentStoreId, userId: user.id, userName: user.name,
                action: 'ORDER_CREATE',
                description: `Quick-sale settled #${finalOrder.orderNumber} via ${paymentMethod}`
              });
          }
          setOrderToSettle(null); 
          setPreviewOrder(finalOrder); 
          setPrintModalOpen(true);
          showToast("Payment completed successfully.", "SUCCESS");
      } catch (e) {
          console.error(e);
          showToast("Payment recorded locally", "INFO");
      } finally {
          setIsSaving(false);
      }
  };

  const generateReceiptHtml = (order: Order, isAutoPrint = false) => {
    if (!store) return '';
    const settings = store.printSettings || { paperSize: 'thermal', fontSize: 'medium' };
    const currency = settings.currencySymbol || store.currency || '$';
    const paperSize = settings.paperSize || 'thermal';
    
    let width = '300px'; 
    let pageSize = '80mm auto';
    if (paperSize === 'a4') { width = '210mm'; pageSize = 'A4'; }
    if (paperSize === 'a5') { width = '148mm'; pageSize = 'A5'; }
    if (paperSize === 'letter') { width = '8.5in'; pageSize = 'letter'; }
    
    const itemsHtml = settings.showItems !== false ? order.items.map(item => {
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
                ${settings.showCashierName ? `<div><strong>BY:</strong> ${users.find(u => u.id === order.createdBy)?.name || 'Staff'}</div>` : ''}
                ${settings.showCustomerDetails && order.tableNumber ? `<div><strong>TABLE:</strong> ${order.tableNumber}</div>` : ''}
            </div>
        </div>
    `;

    const customerBlock = (settings.showCustomerDetails && (order.customerName || order.customerPhone || order.customerTin)) ? `
      <div style="margin-top: 10px; border: 1px dashed #ccc; padding: 10px; font-size: 0.9em; text-align: left;">
        <div style="font-weight: bold; font-size: 1.1em; border-bottom: 1px dashed #ccc; margin-bottom: 5px; padding-bottom: 2px;">CUSTOMER DETAILS</div>
        ${order.customerName ? `<div><strong>Name:</strong> ${order.customerName}</div>` : ''}
        ${order.customerAddress ? `<div style="font-size: 0.85em; color: #333;"><strong>Address:</strong> ${order.customerAddress}</div>` : ''}
        ${order.customerPhone ? `<div style="font-size: 0.85em;"><strong>Phone:</strong> ${order.customerPhone}</div>` : ''}
        ${order.customerTin ? `<div style="font-size: 0.85em;"><strong>TIN:</strong> ${order.customerTin}</div>` : ''}
      </div>
    ` : '';

    const discountBlock = order.discountAmount && order.discountAmount > 0 ? `
        <div style="display: flex; justify-content: space-between; margin: 4px 0;"><span>Discount (${order.discountPercent}%):</span><span>-${currency}${order.discountAmount.toFixed(2)}</span></div>
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
            ${settings.showTotal !== false ? `<div style="display: flex; justify-content: space-between;" class="total-row"><span>TOTAL:</span><span>${currency}${order.total.toFixed(2)}</span></div>` : ''}
        </div>
        <div class="footer">${settings.footerText || 'Thank you!'}</div>
    </body>
    </html>`;
  };

  const handlePrintFinal = () => {
    if (!previewOrder) return;
    const html = generateReceiptHtml(previewOrder, true);
    const printWindow = window.open('', '_blank', 'width=600,height=800');
    if (printWindow) { printWindow.document.write(html); printWindow.document.close(); }
    else alert("Pop-up blocked. Please allow pop-ups to print receipts.");
  };

  const handleSaveAsJpg = async () => {
      if (!previewOrder || !exportRef.current || !store) return;
      try {
          const settings = store.printSettings || { paperSize: 'thermal' };
          const paperSize = settings.paperSize || 'thermal';
          let width = '320px';
          if (paperSize === 'a4' || paperSize === 'letter') width = '800px';
          else if (paperSize === 'a5') width = '500px';

          const rawHtml = generateReceiptHtml(previewOrder, false);
          const styleMatch = rawHtml.match(/<style[^>]*>([\s\S]*)<\/style>/i);
          const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
          
          let css = styleMatch ? styleMatch[1] : '';
          css = css.replace(/\bbody\b/g, '.capture-root');
          const bodyContent = bodyMatch ? bodyMatch[1] : rawHtml;

          exportRef.current.style.width = width;
          exportRef.current.innerHTML = `<style>${css}</style><div class="capture-root" style="background:white; color:black; padding:20px; min-height:100%; box-sizing:border-box;">${bodyContent}</div>`;
          
          await new Promise(r => setTimeout(r, 400));
          await document.fonts.ready;

          const dataUrl = await toJpeg(exportRef.current, { 
              quality: 0.98, 
              backgroundColor: 'white',
              cacheBust: true,
              pixelRatio: 2
          });

          const link = document.createElement('a');
          link.download = `receipt-${previewOrder.orderNumber}.jpg`;
          link.href = dataUrl;
          link.click();
          
          exportRef.current.innerHTML = '';
          showToast("Receipt saved as Image", "SUCCESS");
      } catch (err) {
          console.error(err);
          showToast("Failed to save image", "ERROR");
      }
  };

  const previewHtml = useMemo(() => { if (previewOrder) return generateReceiptHtml(previewOrder, false); return ''; }, [previewOrder, store, users]);
  
  const getIframeWidth = () => {
    if (!store) return '400px';
    const settings = store.printSettings || { paperSize: 'thermal' };
    const paperSize = settings.paperSize || 'thermal';
    if (paperSize === 'a4' || paperSize === 'letter') return '650px';
    if (paperSize === 'a5') return '500px';
    return '320px'; // thermal width
  };

  const filteredCustomers = customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone.includes(customerSearch));
  const handleCustomerSelect = (c: Customer) => { setSelectedCustomer(c); setCustomerSearch(c.name); setShowCustomerResults(false); };

  const handleQuickAddCustomer = async (e: React.FormEvent) => {
      e.preventDefault(); 
      if (!currentStoreId || !newCustData.name || isSaving) return;
      setIsSaving(true);
      try {
          const newCust: Customer = { ...newCustData, id: 0, storeId: currentStoreId } as Customer;
          const added = await db.addCustomer(currentStoreId, newCust); 
          setSelectedCustomer(added); 
          setCustomerSearch(added.name); 
          setIsCustomerModalOpen(false); 
          resetNewCustForm();
          showToast("Customer Added", "SUCCESS");
      } finally {
          setIsSaving(false);
      }
  };

  const resetNewCustForm = () => {
    setNewCustData({
      name: '', phone: '', type: 'INDIVIDUAL', companyName: '', tin: '', houseName: '', streetName: '', buildingName: '', street: '', island: '', country: ''
    });
  };

  const calculateDenomTotal = () => { 
    return DENOMINATIONS.reduce((sum, d) => {
      const count = denominations[d] || 0;
      return sum + (d * count);
    }, 0);
  };

  const handleOpenShift = async () => {
      if (!currentStoreId || !user || isSaving) return;
      const total = calculateDenomTotal();
      if (total <= 0) { setShiftError("Starting float cannot be zero."); return; }
      setIsSaving(true);
      try {
          await db.openShift(currentStoreId, user.id, total, denominations);
          setIsShiftModalOpen(false); setDenominations({}); setShiftError(''); loadData(); showToast("Register Opened", "SUCCESS");
      } finally {
          setIsSaving(false);
      }
  };

  const initiateCloseShift = () => {
    if (!currentStoreId) return;
    setShiftError('');
    if (cart.length > 0) { setShiftError("Cannot close: An unsaved order is in the cart."); return; }
    if (activeOrders.length > 0) { setShiftError(`Blocked: There are still ${activeOrders.length} active orders in preparation.`); return; }
    
    if (!shift) { showToast("No active session found.", "ERROR"); setIsShiftModalOpen(false); return; }
    setIsShiftConfirmOpen(true);
  };

  const executeCloseShift = async () => {
    if (!currentStoreId || !shift || isSaving) return;
    const totalCount = calculateDenomTotal();
    
    const shiftId = shift.id;
    setIsShiftConfirmOpen(false);
    setIsShiftModalOpen(false);
    setIsSaving(true);
    
    try {
        const success = await db.closeShift(currentStoreId, shiftId, totalCount, shiftNote, denominations);
        if (success) { 
            setDenominations({}); 
            setShiftNote(''); 
            setShift(null); 
            loadData(); 
            showToast("Register Closed Successfully", "SUCCESS"); 
        } else {
            showToast("System failed to close shift record.", "ERROR");
        }
    } catch (e) {
        console.error(e);
        showToast("Error processing shift closure.", "ERROR");
    } finally {
        setIsSaving(false);
    }
  };

  const renderProductGrid = (productList: Product[]) => (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 content-start">
          {productList.map(product => (
              <button 
                  key={product.id} 
                  onClick={() => addToCart(product)} 
                  className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/5 text-left flex flex-col transition-all active:scale-95 shadow-sm group h-fit overflow-hidden p-2"
              >
                  <div 
                      className="w-full bg-gray-50 dark:bg-gray-700 rounded-xl mb-2 flex items-center justify-center text-gray-300 overflow-hidden relative"
                      style={{ height: `${4 * menuScale}rem` }}
                  >
                      {product.imageUrl ? <img src={product.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /> : <Utensils size={20 * menuScale}/>}
                      <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/5 transition-colors flex items-center justify-center">
                          <div className="bg-blue-600 text-white p-1.5 rounded-full scale-0 group-hover:scale-100 transition-transform shadow-lg">
                            <Plus size={14}/>
                          </div>
                      </div>
                  </div>
                  <h3 className="text-[11px] font-black truncate dark:text-white mb-0.5 uppercase tracking-tight leading-tight">{product.name}</h3>
                  <p className="text-blue-600 dark:text-blue-400 font-black text-xs tracking-tighter">{store?.currency}{product.price.toFixed(2)}</p>
              </button>
          ))}
      </div>
  );

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-13rem)] overflow-hidden relative">
      <div ref={exportRef} style={{ position: 'fixed', left: '0', top: '0', zIndex: '-100', opacity: '1', pointerEvents: 'none', backgroundColor: 'white' }} />
      
      {/* Toast Notification */}
      {toast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-top-2">
              <div className={`px-6 py-2.5 rounded-full shadow-2xl flex items-center gap-3 text-white text-xs font-black uppercase tracking-widest border-2 ${toast.type === 'SUCCESS' ? 'bg-emerald-600 border-emerald-400' : toast.type === 'ERROR' ? 'bg-red-600 border-red-400' : 'bg-blue-600 border-blue-400'}`}>
                  {toast.type === 'SUCCESS' ? <CheckCircle size={16}/> : toast.type === 'ERROR' ? <AlertCircle size={16}/> : <Info size={16}/>}
                  {toast.message}
              </div>
          </div>
      )}

      {/* POS Context Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0">
          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl border dark:border-gray-700">
              {['MENU', 'ORDERS', 'HELD', 'HISTORY'].map(tab => (
                  <button 
                      key={tab}
                      onClick={() => setActiveTab(tab as any)}
                      className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                      {tab}
                  </button>
              ))}
          </div>
          
          <div className="flex items-center gap-3">
              {shift ? (
                  <button onClick={() => setIsShiftModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-100 transition-all hover:bg-red-100">
                      <Lock size={16}/> End Shift #{shift.shiftNumber}
                  </button>
              ) : (
                  <button onClick={() => setIsShiftModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-100 transition-all hover:bg-emerald-100">
                      <Unlock size={16}/> Open Register
                  </button>
              )}
          </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 flex-1 overflow-hidden">
        {/* Main Grid Area */}
        <div className="flex-1 flex flex-col min-w-0 relative h-full overflow-hidden">
            {activeTab === 'MENU' ? (
                <>
                    <div className="flex flex-col gap-4 h-full">
                        <div className="relative group shrink-0">
                            <Search className="absolute left-4 top-3 text-gray-400 group-focus-within:text-blue-600 transition-colors" size={16}/>
                            <input 
                                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold dark:text-white shadow-sm transition-all text-sm" 
                                placeholder="Search menu items..." 
                                value={searchTerm} 
                                onChange={e => setSearchTerm(e.target.value)} 
                            />
                        </div>

                        <div className="flex items-center gap-2 overflow-x-auto shrink-0 pb-1 custom-scrollbar-hide">
                            <button 
                                onClick={() => setSelectedCategoryId('ALL')}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border whitespace-nowrap ${selectedCategoryId === 'ALL' ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-100 dark:border-gray-700 hover:bg-gray-100'}`}
                            >
                                All Items
                            </button>
                            {categories.map(cat => (
                                <button 
                                    key={cat.id}
                                    onClick={() => setSelectedCategoryId(cat.id)}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border whitespace-nowrap ${selectedCategoryId === cat.id ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-100 dark:border-gray-700 hover:bg-gray-100'}`}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>

                        <div className="flex-1 pr-2 overflow-y-auto custom-scrollbar">
                            {renderProductGrid(products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) && (selectedCategoryId === 'ALL' || p.categoryId === selectedCategoryId)))}
                        </div>
                    </div>

                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4 px-3 py-1.5 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl">
                        <Maximize2 size={14} className="text-gray-400"/>
                        <input
                            type="range" min="0.8" max="1.5" step="0.05"
                            value={menuScale}
                            onChange={(e) => setMenuScale(parseFloat(e.target.value))}
                            className="w-24 h-1 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <span className="text-[10px] font-black text-blue-600 w-8">{Math.round(menuScale * 100)}%</span>
                    </div>
                </>
            ) : (
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                    {activeTab === 'ORDERS' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                            {activeOrders.map(order => (
                                <div key={order.id} onClick={() => resumeOrder(order)} className="bg-white dark:bg-gray-800 p-4 rounded-[2rem] border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col group hover:border-blue-500 hover:shadow-xl transition-all cursor-pointer">
                                    <div className="flex justify-between items-start mb-2 border-b border-gray-50 dark:border-gray-700 pb-2">
                                        <div>
                                            <h3 className="font-black dark:text-white text-base tracking-tighter text-blue-600 uppercase leading-none">#{order.orderNumber}</h3>
                                            <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{new Date(order.createdAt).toLocaleTimeString()}</p>
                                        </div>
                                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-lg uppercase tracking-widest ${order.kitchenStatus === 'READY' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{order.kitchenStatus || 'Pending'}</span>
                                    </div>
                                    <div className="text-[9px] font-black uppercase text-gray-500 mb-2 tracking-tighter">{order.orderType} • {order.tableNumber ? `Table ${order.tableNumber}` : order.customerName || 'Walk-in'}</div>
                                    <div className="space-y-1 mb-4 flex-1">
                                        {order.items.slice(0, 3).map((it, idx) => <div key={idx} className="text-[11px] font-bold dark:text-gray-400 flex justify-between"><span>{it.productName}</span><span className="text-gray-300">x{it.quantity}</span></div>)}
                                        {order.items.length > 3 && <p className="text-[9px] text-gray-300 italic">+{order.items.length - 3} more...</p>}
                                    </div>
                                    <div className="pt-2 border-t border-gray-50 dark:border-gray-700 flex justify-between items-center mt-auto">
                                        <div className="flex gap-1.5">
                                            <button onClick={(e) => { e.stopPropagation(); resumeOrder(order); }} className="p-1.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all"><Edit size={14}/></button>
                                            <button onClick={(e) => handleQuickSettle(order, e)} className="p-1.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all"><DollarSign size={14}/></button>
                                        </div>
                                        <span className="font-black text-base dark:text-white tracking-tighter">{store?.currency}{order.total.toFixed(2)}</span>
                                    </div>
                                </div>
                            ))}
                            {activeOrders.length === 0 && <div className="col-span-full py-16 text-center text-gray-400 italic font-black uppercase tracking-widest opacity-30">No active tickets</div>}
                        </div>
                    ) : activeTab === 'HELD' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                            {heldOrders.map(order => (
                                <div key={order.id} className="bg-orange-50/30 dark:bg-orange-900/10 p-4 rounded-[2rem] border border-orange-100 dark:border-orange-800 shadow-sm flex flex-col group hover:border-orange-500 hover:shadow-xl transition-all cursor-pointer" onClick={() => resumeOrder(order)}>
                                    <div className="flex justify-between items-start mb-2 border-b border-orange-100 dark:border-orange-800 pb-2">
                                        <div>
                                            <h3 className="font-black text-orange-600 text-base tracking-tighter uppercase leading-none">#{order.orderNumber}</h3>
                                            <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{new Date(order.createdAt).toLocaleTimeString()}</p>
                                        </div>
                                        <span className="text-[8px] font-black uppercase bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-lg tracking-widest">ON HOLD</span>
                                    </div>
                                    <p className="text-[11px] font-black text-gray-600 dark:text-gray-400 mb-4 uppercase tracking-tighter">{order.customerName || 'Standard Order'}</p>
                                    <div className="mt-auto flex gap-2">
                                        <button onClick={(e) => { e.stopPropagation(); handleActivateOrder(order); }} className="flex-1 py-2 bg-orange-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg shadow-orange-600/20 hover:bg-orange-700 transition-all flex items-center justify-center gap-2"><Play size={12}/> Activate</button>
                                    </div>
                                </div>
                            ))}
                            {heldOrders.length === 0 && <div className="col-span-full py-16 text-center text-gray-400 italic font-black uppercase tracking-widest opacity-30">No held orders</div>}
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700">
                                    <tr className="text-[9px] font-black uppercase text-gray-400 tracking-widest">
                                        <th className="p-3">Time</th>
                                        <th className="p-3">Ticket</th>
                                        <th className="p-3">Summary</th>
                                        <th className="p-3 text-right">Amount</th>
                                        <th className="p-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                                    {historyOrders.map(order => (
                                        <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                                            <td className="p-3 text-[11px] font-bold text-gray-500">{new Date(order.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</td>
                                            <td className="p-3 font-mono font-black text-blue-600 text-xs">#{order.orderNumber}</td>
                                            <td className="p-3 text-[11px] font-bold dark:text-gray-400 truncate max-w-[150px] uppercase">{order.customerName || `Walk-in`}</td>
                                            <td className="p-3 text-right font-black text-sm dark:text-white tracking-tighter">{store?.currency}{order.total.toFixed(2)}</td>
                                            <td className="p-3 text-right">
                                                <button onClick={() => {setPreviewOrder(order); setPrintModalOpen(true);}} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Printer size={16}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* Sidebar Context */}
        <aside className="w-full lg:w-[360px] bg-white dark:bg-gray-900 border lg:border-l border-gray-200 dark:border-gray-800 flex flex-col shadow-2xl rounded-[2.5rem] lg:rounded-none lg:rounded-r-[2.5rem] overflow-hidden h-full">
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 space-y-4 shrink-0">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="font-black text-lg dark:text-white tracking-tighter uppercase leading-none">Order Details</h2>
                        <div className="flex items-center gap-1.5 text-[9px] font-black text-blue-600 uppercase tracking-widest mt-1">
                            <Hash size={10} /> Predicted Ticket {nextOrderNum}
                        </div>
                    </div>
                    {cart.length > 0 && (
                        <button onClick={clearCart} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                            <Trash2 size={18} />
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-3 gap-1.5 bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl">
                    {[OrderType.DINE_IN, OrderType.TAKEAWAY, OrderType.DELIVERY].map(t => (
                        <button key={t} onClick={() => setOrderType(t)} className={`py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${orderType === t ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-400'}`}>
                            {t.split('_')[0]}
                        </button>
                    ))}
                </div>

                <div className="space-y-2">
                    <div className="relative group">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={14} />
                        <input 
                            type="text" placeholder="Find Customer..." 
                            className="w-full pl-9 pr-9 py-2 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl text-[11px] font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500" 
                            value={customerSearch} 
                            onChange={(e) => { setCustomerSearch(e.target.value); setSelectedCustomer(null); setShowCustomerResults(true); }} 
                            onFocus={() => setShowCustomerResults(true)} 
                        />
                        <button onClick={() => { resetNewCustForm(); setIsCustomerModalOpen(true); }} className="absolute right-2 top-1.5 p-1 bg-blue-600 text-white rounded-lg shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all">
                            <UserPlus size={12}/>
                        </button>
                        
                        {showCustomerResults && customerSearch && !selectedCustomer && (
                            <div className="absolute top-full left-0 w-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-2xl mt-2 z-[60] max-h-48 overflow-y-auto p-1.5">
                                {filteredCustomers.map(c => (
                                    <button key={c.id} onClick={() => handleCustomerSelect(c)} className="w-full text-left p-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl border-b last:border-0 dark:border-gray-700 flex items-center gap-2">
                                        <div className="w-7 h-7 bg-blue-100 dark:bg-blue-900/50 text-blue-600 rounded-lg flex items-center justify-center font-black text-[10px]">{c.name[0]}</div>
                                        <div><div className="font-black text-[10px] dark:text-white uppercase leading-none">{c.name}</div><div className="text-[8px] text-gray-500 font-mono mt-0.5">{c.phone}</div></div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {orderType === OrderType.DINE_IN && (
                        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-800 p-1 rounded-2xl">
                            <div className="p-1.5 bg-gray-50 dark:bg-gray-700 text-gray-400 rounded-xl">
                                <Tag size={14}/>
                            </div>
                            <select className="flex-1 bg-transparent text-[10px] font-black uppercase tracking-widest outline-none dark:text-white" value={tableNumber} onChange={e => setTableNumber(e.target.value)}>
                                <option value="">Table #</option>
                                {Array.from({length: store?.numberOfTables || 0}, (_, i) => (i + 1).toString()).map(num => <option key={num} value={num}>Table {num}</option>)}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
                {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-300 opacity-20 py-6">
                        <ShoppingBag size={56} strokeWidth={1} />
                        <p className="font-black uppercase tracking-[0.2em] text-[8px] mt-2">Empty Order</p>
                    </div>
                ) : cart.map(item => (
                    <div key={item.productId} className="flex items-center justify-between group animate-in slide-in-from-right-2 duration-200">
                        <div className="flex-1 pr-3">
                            <div className="text-[11px] font-black dark:text-white uppercase tracking-tight leading-tight mb-0.5">{item.productName}</div>
                            <div className="text-[9px] font-black text-blue-600 tracking-tighter">{store?.currency}{item.price.toFixed(2)}</div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 p-0.5 rounded-xl">
                                <button onClick={() => updateQuantity(item.productId, -1)} className="w-5 h-5 flex items-center justify-center bg-white dark:bg-gray-700 rounded-lg text-gray-600 hover:text-red-500 shadow-sm transition-all text-xs">-</button>
                                <span className="text-[11px] font-black dark:text-white w-3 text-center">{item.quantity}</span>
                                <button onClick={() => updateQuantity(item.productId, 1)} className="w-5 h-5 flex items-center justify-center bg-white dark:bg-gray-700 rounded-lg text-gray-600 hover:text-blue-500 shadow-sm transition-all text-xs">+</button>
                            </div>
                            <div className="w-16 text-right font-black text-[11px] dark:text-white tracking-tighter">
                                {store?.currency}{(item.price * item.quantity).toFixed(2)}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-5 bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-xl border-t border-gray-200 dark:border-gray-800 shadow-inner shrink-0">
                <div className="space-y-1.5 mb-4">
                    <div className="flex justify-between text-[9px] font-black text-gray-400 uppercase tracking-widest">
                        <span>Subtotal</span>
                        <span className="text-gray-900 dark:text-white">{store?.currency}{totals.subtotal.toFixed(2)}</span>
                    </div>
                    {totals.discountAmount > 0 && (
                        <div className="flex justify-between text-[9px] font-black text-red-500 uppercase tracking-widest">
                            <span>Discount ({discountPercent}%)</span>
                            <span>-{store?.currency}{totals.discountAmount.toFixed(2)}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-[9px] font-black text-gray-400 uppercase tracking-widest">
                        <span>Tax ({store?.taxRate}%)</span>
                        <span className="text-gray-900 dark:text-white">{store?.currency}{totals.tax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-3 mt-1.5 border-t border-gray-200 dark:border-gray-800">
                        <span className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tighter">Due</span>
                        <span className="text-2xl font-black text-blue-600 tracking-tighter">{store?.currency}{totals.total.toFixed(2)}</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-2">
                    <button onClick={handleHoldCart} disabled={cart.length === 0} className="flex flex-col items-center justify-center gap-0.5 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-[8px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-300 hover:bg-gray-100 transition-all active:scale-95 disabled:opacity-30">
                        <PauseCircle size={14}/> Hold
                    </button>
                    <button onClick={handleSendToKitchen} disabled={cart.length === 0} className="flex flex-col items-center justify-center gap-0.5 py-2 bg-orange-500 text-white rounded-2xl text-[8px] font-black uppercase tracking-widest shadow-lg shadow-orange-500/30 hover:bg-orange-600 transition-all active:scale-95 disabled:opacity-30">
                        <ChefHat size={14}/> Kitchen
                    </button>
                </div>
                <button 
                    onClick={handleCheckout} 
                    disabled={cart.length === 0} 
                    className="w-full py-3.5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.15em] shadow-xl shadow-blue-500/40 hover:bg-blue-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-30"
                >
                    <DollarSign size={16}/> Settle Payment
                </button>
            </div>
        </aside>
      </div>

      {/* Payment Settlement Modal */}
      {isPaymentModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-700 flex flex-col">
                  <div className="p-8 border-b dark:border-gray-700 flex justify-between items-center">
                      <div>
                        <h2 className="text-2xl font-black dark:text-white uppercase tracking-tighter">Settlement Center</h2>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Ticket: {orderToSettle ? `#${orderToSettle.orderNumber}` : `New Terminal Sale`}</p>
                      </div>
                      <button onClick={() => setIsPaymentModalOpen(false)} className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                        <X size={24} className="text-gray-400" />
                      </button>
                  </div>
                  
                  <div className="flex flex-col md:flex-row min-h-[480px]">
                      <div className="flex-1 p-10 flex flex-col items-center justify-center bg-blue-50/20 dark:bg-blue-900/5">
                          <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-2">Total Amount Payable</span>
                          <h1 className="text-7xl font-black text-blue-600 tracking-tighter mb-10">
                              {store?.currency}{(orderToSettle ? orderToSettle.total : totals.total).toFixed(2)}
                          </h1>
                          
                          <div className="grid grid-cols-1 w-full gap-3">
                                {[
                                    { id: 'CASH', icon: Banknote, label: 'Cash Payment', sub: 'Standard currency' },
                                    { id: 'CARD', icon: CreditCard, label: 'Credit/Debit Card', sub: 'External terminal' },
                                    { id: 'TRANSFER', icon: RefreshCcw, label: 'Bank Transfer', sub: 'Direct verification' }
                                ].map(method => (
                                    <button 
                                        key={method.id}
                                        onClick={() => setPaymentMethod(method.id as any)}
                                        className={`flex items-center gap-5 p-5 rounded-[2rem] border-2 transition-all group ${paymentMethod === method.id ? 'bg-blue-600 border-blue-600 text-white shadow-2xl shadow-blue-600/40' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-blue-200'}`}
                                    >
                                        <div className={`p-3 rounded-2xl transition-colors ${paymentMethod === method.id ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-700 group-hover:bg-blue-50'}`}>
                                            <method.icon size={24} className={paymentMethod === method.id ? 'text-white' : 'text-gray-500'} />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-xs font-black uppercase tracking-widest">{method.label}</p>
                                            <p className={`text-[10px] opacity-60 font-bold ${paymentMethod === method.id ? 'text-white' : 'text-gray-400'}`}>{method.sub}</p>
                                        </div>
                                        {paymentMethod === method.id && <div className="ml-auto bg-white/20 p-1 rounded-full"><CheckCircle size={16}/></div>}
                                    </button>
                                ))}
                          </div>
                      </div>

                      <div className="w-full md:w-80 p-10 border-l border-gray-100 dark:border-gray-700 flex flex-col justify-between">
                          <div className="space-y-8">
                              {paymentMethod === 'CASH' ? (
                                  <>
                                      <div className="space-y-3">
                                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Cash Tendered</label>
                                          <div className="relative">
                                              <DollarSign className="absolute left-4 top-4 text-gray-300" size={20}/>
                                              <input 
                                                autoFocus
                                                type="number" step="0.01" 
                                                className="w-full pl-10 pr-4 py-4 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 text-xl font-black dark:text-white"
                                                placeholder="0.00"
                                                value={amountTendered}
                                                onChange={e => { setAmountTendered(e.target.value); setPaymentError(''); }}
                                              />
                                          </div>
                                          {paymentError && <p className="text-red-500 text-[10px] font-black uppercase tracking-widest ml-1 animate-pulse">{paymentError}</p>}
                                      </div>
                                      
                                      <div className="p-5 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800">
                                          <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Change to Return</p>
                                          <p className="text-3xl font-black text-emerald-700 dark:text-emerald-200 tracking-tighter">
                                              {store?.currency}{Math.max(0, (parseFloat(amountTendered) || 0) - (orderToSettle ? orderToSettle.total : totals.total)).toFixed(2)}
                                          </p>
                                      </div>
                                  </>
                              ) : (
                                  <div className="p-10 text-center space-y-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-[2rem] border border-blue-100 dark:border-blue-800 border-dashed">
                                      <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-3xl flex items-center justify-center text-blue-600 mx-auto shadow-xl">
                                          <Activity className="animate-pulse" size={32}/>
                                      </div>
                                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest leading-relaxed">Please process the transaction on your external terminal and confirm here.</p>
                                  </div>
                              )}
                          </div>

                          <button 
                            onClick={finalizePayment} 
                            disabled={isSaving || (paymentMethod === 'CASH' && (!amountTendered || parseFloat(amountTendered) < (orderToSettle?.total || totals.total)))}
                            className="w-full py-5 bg-emerald-600 text-white rounded-3xl font-black text-xs uppercase tracking-[0.3em] shadow-2xl shadow-emerald-600/40 hover:bg-emerald-700 transition-all active:scale-[0.98] disabled:opacity-30 flex items-center justify-center gap-3 mt-8"
                          >
                            Finalize Transaction <ArrowRight size={18}/>
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Receipt Preview Modal */}
      {printModalOpen && previewOrder && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[250] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 w-full max-w-4xl h-[90vh] flex flex-col rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                  <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center">
                      <h2 className="text-xl font-black dark:text-white uppercase tracking-tighter flex items-center gap-3">
                        <Printer size={24} className="text-blue-600"/> Ticket Preview: #{previewOrder.orderNumber}
                      </h2>
                      <button onClick={() => setPrintModalOpen(false)} className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"><X size={24}/></button>
                  </div>
                  <div className="flex-1 bg-gray-100 dark:bg-gray-950 p-8 flex justify-center overflow-auto custom-scrollbar">
                      <div className="bg-white shadow-2xl h-fit rounded p-1 border">
                          <iframe srcDoc={previewHtml} className="w-full h-[1000px] border-none" style={{width: getIframeWidth()}} title="Receipt Preview" />
                      </div>
                  </div>
                  <div className="p-6 border-t dark:border-gray-700 flex flex-wrap justify-end gap-3 bg-white dark:bg-gray-900">
                      <button onClick={() => setPrintModalOpen(false)} className="px-6 py-3 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-gray-800 dark:text-gray-400">Close</button>
                      <button onClick={handleSaveAsJpg} className="px-6 py-3 border-2 border-blue-600 text-blue-600 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-blue-50 transition-all">
                          <FileImage size={18}/> Save to Media
                      </button>
                      <button onClick={handlePrintFinal} className="px-12 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-blue-600/30 hover:bg-blue-700 transition-all active:scale-95">
                          Execute Print
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Customer Quick Modal */}
      {isCustomerModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="p-8 border-b dark:border-gray-700 flex justify-between items-center">
                      <h2 className="text-2xl font-black dark:text-white uppercase tracking-tighter flex items-center gap-3">
                        <UserSquare className="text-blue-600"/> Add Quick Customer
                      </h2>
                      <button onClick={() => setIsCustomerModalOpen(false)} className="p-3 hover:bg-gray-100 rounded-full"><X size={24}/></button>
                  </div>
                  <form onSubmit={handleQuickAddCustomer} className="p-10 space-y-8">
                      <div className="flex gap-2 p-1.5 bg-gray-100 dark:bg-gray-900 rounded-2xl">
                          <button type="button" onClick={() => setNewCustData({...newCustData, type: 'INDIVIDUAL'})} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${newCustData.type === 'INDIVIDUAL' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-400'}`}>Individual</button>
                          <button type="button" onClick={() => setNewCustData({...newCustData, type: 'COMPANY'})} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${newCustData.type === 'COMPANY' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-400'}`}>Company</button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Contact Name *</label>
                              <input required className="w-full p-4 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold dark:text-white" value={newCustData.name} onChange={e => setNewCustData({...newCustData, name: e.target.value})}/>
                          </div>
                          <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Phone Number *</label>
                              <input required className="w-full p-4 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold dark:text-white font-mono" value={newCustData.phone} onChange={e => setNewCustData({...newCustData, phone: e.target.value})}/>
                          </div>
                      </div>
                      <div className="flex gap-4 pt-4">
                          <button type="button" onClick={() => setIsCustomerModalOpen(false)} className="flex-1 py-4 text-xs font-black uppercase tracking-widest text-gray-400">Discard</button>
                          <button type="submit" disabled={isSaving} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-blue-500/40 hover:bg-blue-700 transition-all flex items-center justify-center gap-3">
                              {isSaving ? <Loader2 className="animate-spin" size={18}/> : <CheckCircle size={18}/>} Save Record
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* Shift Control Modal */}
      {isShiftModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-400 border border-gray-100 dark:border-gray-700 flex flex-col">
                  <div className="p-8 border-b dark:border-gray-700 flex justify-between items-center">
                      <h2 className="text-2xl font-black dark:text-white uppercase tracking-tighter flex items-center gap-3">
                          {shift ? <Lock className="text-red-500"/> : <Unlock className="text-emerald-500"/>}
                          Register Management
                      </h2>
                      <button onClick={() => setIsShiftModalOpen(false)} className="p-3 hover:bg-gray-100 rounded-full transition-colors"><X size={24}/></button>
                  </div>

                  <div className="p-10 space-y-8 overflow-y-auto custom-scrollbar">
                      <div className="bg-blue-50/30 dark:bg-blue-900/10 p-6 rounded-[2rem] border border-blue-100 dark:border-blue-800">
                          <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-4">{shift ? 'Closing Cash Count' : 'Starting Float Count'}</p>
                          <div className="grid grid-cols-3 gap-3">
                              {DENOMINATIONS.slice(0, 6).map(d => (
                                  <div key={d} className="flex flex-col gap-1.5">
                                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">{store?.currency}{d}</span>
                                      <input 
                                          type="number" min="0" placeholder="0"
                                          className="w-full p-3 bg-white dark:bg-gray-800 border-none rounded-xl text-xs font-black dark:text-white text-center outline-none focus:ring-4 focus:ring-blue-500/10 shadow-sm"
                                          value={denominations[d] || ''}
                                          onChange={e => setDenominations({...denominations, [d]: parseInt(e.target.value) || 0})}
                                      />
                                  </div>
                              ))}
                          </div>
                      </div>

                      <div className="flex flex-col items-center py-6 border-y border-gray-100 dark:border-gray-800">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Calculated Total</p>
                          <p className="text-5xl font-black dark:text-white tracking-tighter text-blue-600">{store?.currency}{calculateDenomTotal().toFixed(2)}</p>
                      </div>
                      
                      {shiftError && <p className="text-red-500 text-xs font-black uppercase text-center animate-bounce">{shiftError}</p>}

                      <div className="flex gap-4">
                          <button type="button" onClick={() => setIsShiftModalOpen(false)} className="flex-1 py-5 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-gray-800">Discard</button>
                          {shift ? (
                              <button type="button" onClick={initiateCloseShift} className="flex-1 py-5 bg-red-600 text-white rounded-3xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-red-600/30 hover:bg-red-700 transition-all active:scale-[0.98]">Execute Closure</button>
                          ) : (
                              <button type="button" onClick={handleOpenShift} className="flex-1 py-5 bg-emerald-600 text-white rounded-3xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-emerald-600/30 hover:bg-emerald-700 transition-all active:scale-[0.98]">Open Terminal</button>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Finalize Closure Modal */}
      {isShiftConfirmOpen && shift && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[400] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 p-10 rounded-[3rem] w-full max-md shadow-2xl border border-red-100 dark:border-red-900/30 text-center animate-in zoom-in-95 duration-300">
                  <div className="w-24 h-24 bg-red-50 dark:bg-red-900/20 rounded-[2rem] flex items-center justify-center text-red-600 mx-auto mb-8 shadow-inner">
                      <Lock size={48}/>
                  </div>
                  <h2 className="text-3xl font-black dark:text-white mb-3 uppercase tracking-tighter">Finalize Shift End</h2>
                  <p className="text-gray-400 font-bold text-sm mb-10 leading-relaxed uppercase tracking-widest max-w-xs mx-auto">This will audit all tallies and lock the terminal until a new float is provided.</p>
                  
                  <div className="grid grid-cols-2 gap-6 mb-10">
                      <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-800 text-center">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Expected In Drawer</p>
                          <p className="text-2xl font-black dark:text-white tracking-tighter">{store?.currency}{(shift.expectedCash || 0).toFixed(2)}</p>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-[2rem] border border-blue-100 dark:border-blue-800 text-center">
                          <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">Actual Cash Logged</p>
                          <p className="text-2xl font-black text-blue-700 dark:text-blue-100 tracking-tighter">{store?.currency}{calculateDenomTotal().toFixed(2)}</p>
                      </div>
                  </div>

                  <div className="flex flex-col gap-4">
                      <button onClick={executeCloseShift} className="w-full py-5 bg-red-600 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-2xl shadow-red-600/40 hover:bg-red-700 active:scale-[0.98] transition-all">Confirm Shift Closure</button>
                      <button onClick={() => setIsShiftConfirmOpen(false)} className="w-full py-4 text-gray-400 font-black text-xs uppercase tracking-widest hover:text-gray-800">Return to Terminal</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
