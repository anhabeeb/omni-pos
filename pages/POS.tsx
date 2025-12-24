import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../App';
import { db, uuid } from '../services/db';
import { Product, Category, Order, OrderItem, OrderType, OrderStatus, Store, RegisterShift, Transaction, Customer, User } from '../types';
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
  // Fix: Added missing UserSquare icon import
  UserSquare
} from 'lucide-react';
// @ts-ignore - Fixing missing member errors in react-router-dom
import { useNavigate } from 'react-router-dom';
import { toJpeg } from 'html-to-image';

const DENOMINATIONS = [1000, 500, 100, 50, 20, 10, 5, 2, 1];

export default function POS() {
  const { user, currentStoreId, hasPermission } = useAuth();
  const navigate = useNavigate();

  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [shift, setShift] = useState<RegisterShift | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
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
        <div class="row"><span>Discount (${order.discountPercent}%):</span><span>-${currency}${order.discountAmount.toFixed(2)}</span></div>
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
            .row { display: flex; justify-content: space-between; margin: 4px 0; } 
            .total-row { font-weight: bold; font-size: 1.3em; border-top: 2px solid #000; padding-top: 8px; margin-top: 8px; } 
            table { width: 100%; border-collapse: collapse; } 
            th { text-align: left; border-bottom: 1px solid #000; padding-bottom: 4px; font-size: 10px; } 
            td { padding: 4px 0; } 
            .note-box { margin-top: 15px; padding: 8px; border: 1px dashed #666; font-size: 0.9em; font-style: italic; } 
            .footer { text-align: ${footerAlignment}; margin-top: 30px; border-top: 1px dashed #ccc; padding-top: 10px; font-style: italic; }
        </style>
    </head>
    <body ${isAutoPrint ? 'onload="window.print(); window.close();"' : ''}>
        <div class="header">
            ${logoBlock}
            ${storeDetailsBlock}
            ${taxIdBlock}
            ${settings.headerText ? `<div style="font-weight: bold; margin-top: 10px; text-transform: uppercase; border-bottom: 1px dashed #ccc; padding-bottom: 5px;">${settings.headerText}</div>` : ''}
        </div>
        
        ${infoGridBlock}
        ${customerBlock}

        <table style="margin-top: 10px;">
            <thead>
                <tr><th>DESCRIPTION</th>${settings.showAmount !== false ? '<th align="right">AMOUNT</th>' : ''}</tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
        </table>

        <div class="totals">
            ${settings.showSubtotal !== false ? `<div class="row"><span>Subtotal:</span><span>${currency}${order.subtotal.toFixed(2)}</span></div>` : ''}
            ${discountBlock}
            ${(settings.showServiceCharge !== false && order.serviceCharge > 0) ? `<div class="row"><span>Service Charge (${store.serviceChargeRate}%):</span><span>${currency}${order.serviceCharge.toFixed(2)}</span></div>` : ''}
            ${(settings.showTax !== false && order.tax > 0) ? `<div class="row"><span>Tax (${store.taxRate}%):</span><span>${currency}${order.tax.toFixed(2)}</span></div>` : ''}
            ${settings.showTotal !== false ? `<div class="row total-row"><span>TOTAL:</span><span>${currency}${order.total.toFixed(2)}</span></div>` : ''}
        </div>

        ${order.note ? `<div class="note-box"><strong>Note:</strong> ${order.note}</div>` : ''}
        
        <div class="footer">${settings.footerText || 'Thank you for your visit!'}</div>
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
  
  // Fix: Added getIframeWidth helper for print preview modal sizing
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
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 content-start">
          {productList.map(product => (
              <button 
                  key={product.id} 
                  onClick={() => addToCart(product)} 
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-500 text-left flex flex-col transition-all active:scale-95 shadow-sm group h-fit overflow-hidden p-2"
              >
                  <div 
                      className="w-full bg-gray-50 dark:bg-gray-700 rounded-lg mb-2 flex items-center justify-center text-gray-300 overflow-hidden relative"
                      style={{ height: `${3.5 * menuScale}rem` }}
                  >
                      {product.imageUrl ? <img src={product.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /> : <Utensils size={18 * menuScale}/>}
                      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="bg-blue-600 text-white p-1 rounded-full"><Plus size={10}/></div>
                      </div>
                  </div>
                  <h3 className="text-xs font-bold truncate dark:text-white">{product.name}</h3>
                  <p className="text-blue-600 dark:text-blue-400 font-black text-xs">{store?.currency}{product.price.toFixed(2)}</p>
              </button>
          ))}
      </div>
  );

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden relative">
      <div ref={exportRef} style={{ position: 'fixed', left: '0', top: '0', zIndex: '-100', opacity: '1', pointerEvents: 'none', backgroundColor: 'white' }} />
      
      {/* Toast Notification */}
      {toast && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[300] animate-in slide-in-from-top-4 duration-300">
              <div className={`px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border ${toast.type === 'SUCCESS' ? 'bg-emerald-600 border-emerald-500 text-white' : toast.type === 'ERROR' ? 'bg-red-600 border-red-500 text-white' : 'bg-blue-600 border-blue-500 text-white'}`}>
                  {toast.type === 'SUCCESS' ? <CheckCircle size={20}/> : toast.type === 'ERROR' ? <AlertCircle size={20}/> : <Info size={20}/>}
                  <span className="text-sm font-black uppercase tracking-widest">{toast.message}</span>
              </div>
          </div>
      )}

      {/* Primary POS Toolbar */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-2 flex items-center justify-between shrink-0 rounded-2xl shadow-sm">
        <div className="flex items-center gap-1">
            <button onClick={() => setActiveTab('MENU')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all ${activeTab === 'MENU' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 font-black' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 font-bold'}`}>
                <Utensils size={18}/> <span className="text-xs uppercase tracking-tight">Terminal</span>
            </button>
            <button onClick={() => setActiveTab('ORDERS')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all relative ${activeTab === 'ORDERS' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 font-black' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 font-bold'}`}>
                <Activity size={18}/> <span className="text-xs uppercase tracking-tight">Active</span>
                {activeOrders.length > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white dark:border-gray-900">{activeOrders.length}</span>}
            </button>
            <button onClick={() => setActiveTab('HELD')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all relative ${activeTab === 'HELD' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 font-black' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 font-bold'}`}>
                <PauseCircle size={18}/> <span className="text-xs uppercase tracking-tight">Held</span>
                {heldOrders.length > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white dark:border-gray-900">{heldOrders.length}</span>}
            </button>
            <button onClick={() => setActiveTab('HISTORY')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all ${activeTab === 'HISTORY' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 font-black' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 font-bold'}`}>
                <RefreshCcw size={18}/> <span className="text-xs uppercase tracking-tight">History</span>
            </button>
        </div>

        <div className="flex items-center gap-3">
            {shift ? (
                <div className="flex items-center gap-2">
                    <div className="hidden sm:flex flex-col text-right pr-3 border-r dark:border-gray-800">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Register Open</span>
                        <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">Shift #{shift.shiftNumber}</span>
                    </div>
                    <button onClick={() => setIsShiftModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-100 transition-colors">
                        <Lock size={16}/> End Shift
                    </button>
                </div>
            ) : (
                <button onClick={() => setIsShiftModalOpen(true)} className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all active:scale-95">
                    <Unlock size={18}/> Open Register
                </button>
            )}
        </div>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
          {/* Main Area */}
          <div className="flex-1 flex flex-col gap-4 overflow-hidden">
              {activeTab === 'MENU' ? (
                  <>
                    <div className="flex items-center gap-3 bg-white dark:bg-gray-900 p-3 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm shrink-0">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={18}/>
                            <input 
                                placeholder="Search menu (Shortcut: F1)" 
                                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border-0 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold dark:text-white"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-xl border dark:border-gray-700">
                            <Maximize2 size={16} className="text-gray-400"/>
                            <input 
                                type="range" min="0.8" max="1.5" step="0.1" 
                                value={menuScale} 
                                onChange={e => setMenuScale(parseFloat(e.target.value))} 
                                className="w-20"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto shrink-0 pb-1 custom-scrollbar-hide">
                        <button 
                            onClick={() => setSelectedCategoryId('ALL')}
                            className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-tight transition-all border whitespace-nowrap ${selectedCategoryId === 'ALL' ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-100 dark:border-gray-700 hover:bg-gray-50'}`}
                        >
                            All Items
                        </button>
                        {categories.map(cat => (
                            <button 
                                key={cat.id}
                                onClick={() => setSelectedCategoryId(cat.id.toString())}
                                className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-tight transition-all border whitespace-nowrap ${selectedCategoryId === cat.id.toString() ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-100 dark:border-gray-700 hover:bg-gray-50'}`}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                        {renderProductGrid(products.filter(p => {
                            const matchCat = selectedCategoryId === 'ALL' || p.categoryId === parseInt(selectedCategoryId);
                            const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
                            return matchCat && matchSearch;
                        }))}
                    </div>
                  </>
              ) : activeTab === 'ORDERS' ? (
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 content-start">
                    {activeOrders.map(order => (
                        <div key={order.id} onClick={() => resumeOrder(order)} className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:border-blue-500 cursor-pointer group transition-all">
                            <div className="flex justify-between items-start mb-3 border-b dark:border-gray-700 pb-2">
                                <div>
                                    <h3 className="font-black text-blue-600 dark:text-blue-400">#{order.orderNumber}</h3>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase">{new Date(order.createdAt).toLocaleTimeString()}</p>
                                </div>
                                <div className="text-right">
                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${order.status === OrderStatus.READY ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{order.status}</span>
                                    {order.tableNumber && <p className="text-xs font-black text-gray-800 dark:text-gray-200 mt-1">Table {order.tableNumber}</p>}
                                </div>
                            </div>
                            <div className="space-y-1 mb-4">
                                {order.items.slice(0, 3).map((item, i) => (
                                    <div key={i} className="flex justify-between text-xs dark:text-gray-400">
                                        <span className="truncate">{item.productName}</span>
                                        <span className="font-bold">x{item.quantity}</span>
                                    </div>
                                ))}
                                {order.items.length > 3 && <p className="text-[10px] text-gray-400 font-bold italic">+ {order.items.length - 3} more items</p>}
                            </div>
                            <div className="flex gap-2">
                                <button onClick={(e) => handleQuickSettle(order, e)} className="flex-1 py-2 bg-blue-600 text-white text-[10px] font-black uppercase rounded-lg shadow-lg shadow-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity">Settle Payment</button>
                                <button onClick={(e) => handleHoldActiveOrder(order, e)} className="p-2 bg-gray-50 dark:bg-gray-700 text-gray-400 hover:text-orange-500 rounded-lg"><PauseCircle size={16}/></button>
                            </div>
                        </div>
                    ))}
                    {activeOrders.length === 0 && <div className="col-span-full py-20 text-center text-gray-400 italic">No active orders found.</div>}
                </div>
              ) : activeTab === 'HELD' ? (
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 content-start">
                    {heldOrders.map(order => (
                        <div key={order.id} onClick={() => resumeOrder(order)} className="bg-orange-50/50 dark:bg-orange-900/10 p-4 rounded-2xl border border-orange-100 dark:border-orange-800 shadow-sm hover:border-blue-500 cursor-pointer group transition-all">
                             <div className="flex justify-between items-start mb-3 border-b border-orange-100 dark:border-orange-800 pb-2">
                                <div>
                                    <h3 className="font-black text-orange-600">#{order.orderNumber}</h3>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase">{new Date(order.createdAt).toLocaleTimeString()}</p>
                                </div>
                                <span className="text-[10px] font-black bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full uppercase">HELD</span>
                            </div>
                            <p className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-4">{order.customerName || 'No customer'}</p>
                            <button onClick={(e) => handleActivateOrder(order, e)} className="w-full py-2 bg-white dark:bg-gray-800 border border-orange-200 dark:border-orange-700 text-orange-600 text-[10px] font-black uppercase rounded-lg shadow-sm group-hover:bg-orange-600 group-hover:text-white group-hover:border-orange-600 transition-all flex items-center justify-center gap-2">
                                <Play size={14}/> Resume Order
                            </button>
                        </div>
                    ))}
                    {heldOrders.length === 0 && <div className="col-span-full py-20 text-center text-gray-400 italic">No held orders found.</div>}
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-2">
                    {historyOrders.map(order => (
                        <div key={order.id} className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-xl ${order.status === OrderStatus.COMPLETED ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                    <CheckCircle size={20}/>
                                </div>
                                <div>
                                    <p className="text-sm font-black dark:text-white">#{order.orderNumber}</p>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{new Date(order.createdAt).toLocaleTimeString()} • {order.paymentMethod || 'N/A'}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-lg font-black dark:text-white">{store?.currency}{order.total.toFixed(2)}</p>
                                <button onClick={() => { setPreviewOrder(order); setPrintModalOpen(true); }} className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-1 hover:underline ml-auto">
                                    <Printer size={12}/> View Receipt
                                </button>
                            </div>
                        </div>
                    ))}
                    {historyOrders.length === 0 && <div className="py-20 text-center text-gray-400 italic">No completed orders in this shift.</div>}
                </div>
              )}
          </div>

          {/* Cart Sidebar */}
          <div className="w-[380px] bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col overflow-hidden shrink-0">
                <div className="p-5 border-b dark:border-gray-800 space-y-4">
                    <div className="flex justify-between items-center">
                        <div className="flex flex-col">
                            <h2 className="text-lg font-black dark:text-white leading-none">Order Details</h2>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Ticket #{nextOrderNum}</p>
                        </div>
                        <button onClick={clearCart} disabled={cart.length === 0} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"><Trash2 size={20}/></button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        {[OrderType.DINE_IN, OrderType.TAKEAWAY, OrderType.DELIVERY].map(t => (
                            <button key={t} onClick={() => setOrderType(t)} className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all border ${orderType === t ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:border-gray-700 hover:bg-gray-100'}`}>{t.replace('_', ' ')}</button>
                        ))}
                    </div>

                    <div className="flex gap-2">
                        <div className="relative flex-1 group">
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                            <input 
                                placeholder="Customer Name..." 
                                className="w-full pl-9 pr-8 py-2 bg-gray-50 dark:bg-gray-800 border-0 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-xs dark:text-white"
                                value={customerSearch}
                                onChange={e => { setCustomerSearch(e.target.value); setShowCustomerResults(true); }}
                                onFocus={() => setShowCustomerResults(true)}
                            />
                            {selectedCustomer && <button onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); }} className="absolute right-2 top-2 p-0.5 text-gray-400 hover:text-red-500"><X size={14}/></button>}
                            
                            {showCustomerResults && customerSearch.length > 0 && !selectedCustomer && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-2xl shadow-2xl z-50 max-h-48 overflow-y-auto p-1 animate-in fade-in slide-in-from-top-1">
                                    {filteredCustomers.map(c => (
                                        <button key={c.id} onClick={() => handleCustomerSelect(c)} className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-left transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg"><UserSquare size={14}/></div>
                                                <div><p className="text-xs font-bold dark:text-white">{c.name}</p><p className="text-[9px] text-gray-400">{c.phone}</p></div>
                                            </div>
                                        </button>
                                    ))}
                                    {filteredCustomers.length === 0 && <div className="p-4 text-center text-xs text-gray-400">No customers found.</div>}
                                </div>
                            )}
                        </div>
                        <button onClick={() => setIsCustomerModalOpen(true)} className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800 rounded-xl hover:bg-blue-100 transition-colors"><UserPlus size={20}/></button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div className="relative">
                            <Hash className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                            <input 
                                placeholder="Table #" 
                                className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-800 border-0 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-xs dark:text-white"
                                value={tableNumber}
                                onChange={e => setTableNumber(e.target.value)}
                            />
                        </div>
                        <div className="relative">
                            <StickyNote className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                            <input 
                                placeholder="Order Note..." 
                                className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-800 border-0 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-xs dark:text-white"
                                value={orderNote}
                                onChange={e => setOrderNote(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-300 opacity-40">
                            <ShoppingBag size={48} className="mb-2" />
                            <p className="font-black text-xs uppercase tracking-widest">Cart is empty</p>
                        </div>
                    ) : cart.map(item => (
                        <div key={item.productId} className="flex justify-between items-center group">
                            <div className="flex-1 pr-2">
                                <div className="text-sm font-bold truncate dark:text-white leading-tight">{item.productName}</div>
                                <div className="text-[10px] text-blue-600 dark:text-blue-400 font-black">{store?.currency}{item.price.toFixed(2)}</div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 p-1 rounded-xl border border-gray-100 dark:border-gray-700">
                                    <button onClick={() => updateQuantity(item.productId, -1)} className="w-6 h-6 flex items-center justify-center bg-white dark:bg-gray-700 dark:text-white rounded-lg shadow-sm active:scale-90 transition-all"><Minus size={12}/></button>
                                    <span className="w-5 text-center text-xs font-black dark:text-white">{item.quantity}</span>
                                    <button onClick={() => updateQuantity(item.productId, 1)} className="w-6 h-6 flex items-center justify-center bg-white dark:bg-gray-700 dark:text-white rounded-lg shadow-sm active:scale-90 transition-all"><Plus size={12}/></button>
                                </div>
                                <button onClick={() => updateQuantity(item.productId, -item.quantity)} className="text-gray-300 hover:text-red-500 transition-colors"><X size={18}/></button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-6 border-t dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
                    <div className="space-y-2 mb-6">
                        <div className="flex justify-between text-xs text-gray-400 font-bold uppercase tracking-widest"><span>Subtotal</span><span className="text-gray-700 dark:text-gray-200">{store?.currency}{totals.subtotal.toFixed(2)}</span></div>
                        <div className="flex justify-between items-center text-xs text-gray-400 font-bold uppercase tracking-widest">
                            <div className="flex items-center gap-1 group cursor-pointer">
                                <span>Discount</span>
                                <input type="number" step="0.1" value={discountPercent} onChange={e => setDiscountPercent(parseFloat(e.target.value) || 0)} className="w-10 bg-transparent border-b border-dashed border-gray-300 dark:border-gray-600 text-center outline-none focus:border-blue-500 dark:text-gray-200"/>
                                <span className="text-[9px]">%</span>
                            </div>
                            <span className="text-red-500">-{store?.currency}{totals.discountAmount.toFixed(2)}</span>
                        </div>
                        {orderType === OrderType.DINE_IN && store?.serviceChargeRate && (
                            <div className="flex justify-between text-xs text-gray-400 font-bold uppercase tracking-widest"><span>Service Charge ({store.serviceChargeRate}%)</span><span className="text-gray-700 dark:text-gray-200">{store?.currency}{totals.serviceCharge.toFixed(2)}</span></div>
                        )}
                        <div className="flex justify-between text-xs text-gray-400 font-bold uppercase tracking-widest"><span>GST ({store?.taxRate}%)</span><span className="text-gray-700 dark:text-gray-200">{store?.currency}{totals.tax.toFixed(2)}</span></div>
                        <div className="flex justify-between items-center pt-4 mt-4 border-t dark:border-gray-800">
                            <span className="text-sm font-black dark:text-white uppercase tracking-tighter">Net Payable</span>
                            <span className="text-3xl font-black text-blue-600 tracking-tighter">{store?.currency}{totals.total.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button 
                            onClick={handleHoldCart}
                            disabled={cart.length === 0}
                            className="flex flex-col items-center justify-center gap-1 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-gray-600 dark:text-gray-300 font-black text-[10px] uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-700 transition-all active:scale-95 disabled:opacity-30"
                        >
                            <PauseCircle size={18}/> Hold Order
                        </button>
                        <button 
                            onClick={handleSendToKitchen}
                            disabled={cart.length === 0}
                            className="flex flex-col items-center justify-center gap-1 py-3 bg-orange-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all active:scale-95 disabled:opacity-30"
                        >
                            <ChefHat size={18}/> Kitchen Ticket
                        </button>
                        <button 
                            onClick={handleCheckout}
                            disabled={cart.length === 0}
                            className="col-span-2 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-30"
                        >
                            <DollarSign size={20}/> Pay Now
                        </button>
                    </div>
                </div>
          </div>
      </div>

      {/* Payment Settlement Modal */}
      {isPaymentModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-700">
                  <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
                      <div>
                        <h2 className="text-xl font-black dark:text-white uppercase tracking-tight">Finalize Settlement</h2>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Order Reference: {orderToSettle ? `#${orderToSettle.orderNumber}` : `New Sale`}</p>
                      </div>
                      <button onClick={() => setIsPaymentModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X size={24}/></button>
                  </div>
                  
                  <div className="flex flex-col md:flex-row h-[500px]">
                      <div className="flex-1 p-8 flex flex-col justify-center items-center bg-blue-50/20 dark:bg-blue-900/5">
                          <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-2">Amount Due</p>
                          <h1 className="text-6xl font-black text-blue-600 dark:text-blue-400 tracking-tighter mb-8">
                              {store?.currency}{(orderToSettle ? orderToSettle.total : totals.total).toFixed(2)}
                          </h1>
                          
                          <div className="grid grid-cols-1 w-full gap-2">
                                <button onClick={() => setPaymentMethod('CASH')} className={`flex items-center gap-4 p-5 rounded-2xl border-2 transition-all ${paymentMethod === 'CASH' ? 'bg-blue-600 border-blue-600 text-white shadow-xl' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-500 hover:bg-gray-50'}`}>
                                    <Banknote size={24}/>
                                    <div className="text-left"><p className="text-xs font-black uppercase tracking-widest">Cash Payment</p><p className="text-[10px] opacity-70">Pay via register drawer</p></div>
                                </button>
                                <button onClick={() => setPaymentMethod('CARD')} className={`flex items-center gap-4 p-5 rounded-2xl border-2 transition-all ${paymentMethod === 'CARD' ? 'bg-blue-600 border-blue-600 text-white shadow-xl' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-500 hover:bg-gray-50'}`}>
                                    <CreditCard size={24}/>
                                    <div className="text-left"><p className="text-xs font-black uppercase tracking-widest">Debit/Credit Card</p><p className="text-[10px] opacity-70">External machine swipe</p></div>
                                </button>
                                <button onClick={() => setPaymentMethod('TRANSFER')} className={`flex items-center gap-4 p-5 rounded-2xl border-2 transition-all ${paymentMethod === 'TRANSFER' ? 'bg-blue-600 border-blue-600 text-white shadow-xl' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-500 hover:bg-gray-50'}`}>
                                    <RefreshCcw size={24}/>
                                    <div className="text-left"><p className="text-xs font-black uppercase tracking-widest">Online Transfer</p><p className="text-[10px] opacity-70">Direct bank account credit</p></div>
                                </button>
                          </div>
                      </div>

                      <div className="w-full md:w-80 p-8 border-l dark:border-gray-700 flex flex-col justify-between">
                          <div className="space-y-6">
                              {paymentMethod === 'CASH' ? (
                                  <>
                                      <div className="space-y-2">
                                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Cash Tendered</label>
                                          <div className="relative">
                                              <DollarSign className="absolute left-3 top-3.5 text-gray-400" size={18}/>
                                              <input 
                                                autoFocus
                                                type="number" step="0.01" 
                                                placeholder="0.00"
                                                className="w-full pl-9 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border-0 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-lg font-black dark:text-white"
                                                value={amountTendered}
                                                onChange={e => { setAmountTendered(e.target.value); setPaymentError(''); }}
                                              />
                                          </div>
                                          {paymentError && <p className="text-red-500 text-[10px] font-black uppercase italic ml-1 animate-pulse">{paymentError}</p>}
                                      </div>
                                      
                                      <div className="p-4 bg-gray-100 dark:bg-gray-900/50 rounded-2xl border border-dashed dark:border-gray-700">
                                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Change Due</p>
                                          <p className="text-2xl font-black text-gray-800 dark:text-gray-200">
                                              {store?.currency}{Math.max(0, (parseFloat(amountTendered) || 0) - (orderToSettle ? orderToSettle.total : totals.total)).toFixed(2)}
                                          </p>
                                      </div>
                                  </>
                              ) : (
                                  <div className="p-6 text-center space-y-4">
                                      <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center text-blue-600 mx-auto">
                                          <Activity className="animate-pulse" size={32}/>
                                      </div>
                                      <p className="text-xs font-bold text-gray-500 leading-relaxed uppercase tracking-widest">Please verify {paymentMethod.toLowerCase()} transaction on external terminal before confirming.</p>
                                  </div>
                              )}
                          </div>

                          <button 
                            onClick={finalizePayment} 
                            disabled={isSaving || (paymentMethod === 'CASH' && (!amountTendered || parseFloat(amountTendered) < (orderToSettle?.total || totals.total)))}
                            className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/30 hover:bg-emerald-700 transition-all active:scale-[0.98] disabled:opacity-30"
                          >
                            Complete Settlement
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Register/Shift Management Modal */}
      {isShiftModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-700">
                  <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
                      <h2 className="text-xl font-black dark:text-white flex items-center gap-3 uppercase tracking-tighter">
                          {shift ? <Lock className="text-red-500"/> : <Unlock className="text-emerald-500"/>}
                          Register Control
                      </h2>
                      <button onClick={() => setIsShiftModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X size={24}/></button>
                  </div>

                  <div className="p-8 space-y-6">
                      <div className="bg-blue-50/30 dark:bg-blue-900/10 p-5 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">{shift ? 'Close Drawer Count' : 'Starting Float Count'}</p>
                          <div className="grid grid-cols-3 gap-2">
                              {DENOMINATIONS.slice(0, 6).map(d => (
                                  <div key={d} className="flex flex-col gap-1">
                                      <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 ml-1">{store?.currency}{d}</span>
                                      <input 
                                          type="number" min="0" placeholder="0"
                                          className="w-full p-2 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl text-xs font-bold dark:text-white text-center outline-none focus:ring-2 focus:ring-blue-500"
                                          value={denominations[d] || ''}
                                          onChange={e => setDenominations({...denominations, [d]: parseInt(e.target.value) || 0})}
                                      />
                                  </div>
                              ))}
                          </div>
                      </div>

                      <div className="flex justify-between items-center py-4 border-t dark:border-gray-700">
                          <div className="text-right flex-1 pr-6">
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Counted</p>
                              <p className="text-3xl font-black dark:text-white tracking-tighter">{store?.currency}{calculateDenomTotal().toFixed(2)}</p>
                          </div>
                          <div className="flex-1 space-y-1">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Notes</label>
                              <textarea 
                                className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border-0 rounded-xl text-xs font-bold outline-none dark:text-white"
                                value={shiftNote} onChange={e => setShiftNote(e.target.value)} rows={2} placeholder="Shift summary notes..."
                              />
                          </div>
                      </div>
                      
                      {shiftError && <p className="text-red-500 text-xs font-bold text-center animate-bounce">{shiftError}</p>}

                      <div className="flex gap-3">
                          <button onClick={() => setIsShiftModalOpen(false)} className="flex-1 py-4 text-sm font-bold text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-2xl transition-all">Cancel</button>
                          {shift ? (
                              <button onClick={initiateCloseShift} className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-red-500/20 hover:bg-red-700 transition-all active:scale-[0.98]">Close Register</button>
                          ) : (
                              <button onClick={handleOpenShift} className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/20 hover:bg-emerald-700 transition-all active:scale-[0.98]">Begin Session</button>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Close Shift Confirmation */}
      {isShiftConfirmOpen && shift && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[400] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl w-full max-md shadow-2xl border border-red-100 dark:border-red-900/30 animate-in zoom-in-95 duration-200">
                  <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center text-red-600 mx-auto mb-6">
                      <Lock size={40}/>
                  </div>
                  <h2 className="text-2xl font-black text-center dark:text-white mb-2 uppercase tracking-tighter">Finalize Shift End</h2>
                  <p className="text-gray-500 dark:text-gray-400 text-center text-sm mb-8 leading-relaxed">Closing the register will finalize all tallies and generate the end-of-shift report. Ensure all cash is counted correctly.</p>
                  
                  <div className="grid grid-cols-2 gap-4 mb-8">
                      <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border dark:border-gray-700 text-center">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Expected Cash</p>
                          <p className="text-xl font-black dark:text-white">{store?.currency}{(shift.expectedCash || 0).toFixed(2)}</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border dark:border-gray-700 text-center">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Actual Cash</p>
                          <p className="text-xl font-black dark:text-white">{store?.currency}{calculateDenomTotal().toFixed(2)}</p>
                      </div>
                  </div>

                  <div className="flex flex-col gap-3">
                      <button onClick={executeCloseShift} className="w-full py-4 bg-red-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-red-500/20 hover:bg-red-700 active:scale-[0.98] transition-all">Yes, Close Shift Now</button>
                      <button onClick={() => setIsShiftConfirmOpen(false)} className="w-full py-4 text-gray-500 dark:text-gray-400 font-bold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded-2xl">Return to POS</button>
                  </div>
              </div>
          </div>
      )}

      {/* Quick Add Customer Modal */}
      {isCustomerModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-700">
                  <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
                      <h2 className="text-xl font-black dark:text-white flex items-center gap-3 uppercase tracking-tighter"><UserPlus className="text-blue-600"/> Add Quick Customer</h2>
                      <button onClick={() => setIsCustomerModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X size={24}/></button>
                  </div>
                  <form onSubmit={handleQuickAddCustomer} className="p-8 space-y-6">
                      <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-700 rounded-xl">
                          <button type="button" onClick={() => setNewCustData({...newCustData, type: 'INDIVIDUAL'})} className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-all ${newCustData.type === 'INDIVIDUAL' ? 'bg-white dark:bg-gray-600 shadow text-blue-600 dark:text-blue-300' : 'text-gray-400'}`}>Individual</button>
                          <button type="button" onClick={() => setNewCustData({...newCustData, type: 'COMPANY'})} className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-all ${newCustData.type === 'COMPANY' ? 'bg-white dark:bg-gray-600 shadow text-blue-600 dark:text-blue-300' : 'text-gray-400'}`}>Company</button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Contact Name *</label>
                              <input required className="w-full p-3 bg-gray-50 dark:bg-gray-900 border-0 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold dark:text-white" value={newCustData.name} onChange={e => setNewCustData({...newCustData, name: e.target.value})}/>
                          </div>
                          <div className="space-y-1">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Phone Number *</label>
                              <input required className="w-full p-3 bg-gray-50 dark:bg-gray-900 border-0 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold dark:text-white font-mono" value={newCustData.phone} onChange={e => setNewCustData({...newCustData, phone: e.target.value})}/>
                          </div>
                      </div>
                      <div className="flex gap-3 pt-4">
                          <button type="button" onClick={() => setIsCustomerModalOpen(false)} className="flex-1 py-3 text-sm font-bold text-gray-500 hover:bg-gray-50 rounded-2xl transition-all">Cancel</button>
                          <button type="submit" disabled={isSaving} className="flex-1 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                              {isSaving ? <Loader2 className="animate-spin" size={18}/> : <CheckCircle size={18}/>} Save Record
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* Receipt Preview Modal */}
      {printModalOpen && previewOrder && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 w-full max-w-4xl h-[90vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-700">
                  <div className="p-5 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
                      <h2 className="text-lg font-black dark:text-white flex items-center gap-3 uppercase tracking-tighter"><Printer size={22} className="text-blue-600"/> Receipt Preview</h2>
                      <button onClick={() => setPrintModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X size={24}/></button>
                  </div>
                  <div className="flex-1 bg-gray-100 dark:bg-gray-950 p-4 md:p-8 flex justify-center overflow-auto custom-scrollbar">
                      <div className="bg-white shadow-2xl h-fit p-1 rounded" style={{width: getIframeWidth()}}>
                          <iframe srcDoc={previewHtml} className="w-full h-[1000px] border-none" title="Receipt Preview" />
                      </div>
                  </div>
                  <div className="p-5 border-t dark:border-gray-700 flex flex-wrap justify-end gap-3 bg-white dark:bg-gray-900">
                      <button onClick={() => setPrintModalOpen(false)} className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 dark:text-gray-400">Close</button>
                      <button onClick={handleSaveAsJpg} className="px-5 py-2.5 border-2 border-blue-600 text-blue-600 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-blue-50 transition-all">
                          <FileImage size={18}/> Export Image
                      </button>
                      <button onClick={handlePrintFinal} className="px-10 py-2 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-blue-700 transition-all active:scale-95">
                          Print Receipt
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}