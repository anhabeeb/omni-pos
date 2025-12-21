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
  MapPin
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toJpeg } from 'html-to-image';

const DENOMINATIONS = [1000, 500, 100, 50, 20, 10, 5, 2, 1];

export default function POS() {
  const { user, currentStoreId } = useAuth();
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

  const getStorageKeys = (storeId: string) => ({
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

  const loadFromPersistence = (storeId: string) => {
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
          const cust = JSON.parse(savedCust);
          setSelectedCustomer(cust);
          if (cust) setCustomerSearch(cust.name);
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

  const updateQuantity = (productId: string, delta: number) => {
      setCart(prev => prev.map(item => {
          if (item.productId === productId) {
              const newQty = Math.max(0, item.quantity + delta);
              return { ...item, quantity: newQty };
          }
          return item;
      }).filter(item => item.quantity > 0));
  };

  const clearCart = () => { 
      if (confirm("Are you sure you want to clear the current order?")) {
        setCart([]); setSelectedCustomer(null); setCustomerSearch(''); setTableNumber(''); setOrderNote(''); setOrderType(OrderType.DINE_IN); setDiscountPercent(0);
        if (currentStoreId) {
            const keys = getStorageKeys(currentStoreId);
            localStorage.removeItem(keys.cart);
            localStorage.removeItem(keys.customer);
            localStorage.removeItem(keys.table);
            localStorage.removeItem(keys.note);
            localStorage.removeItem(keys.discount);
        }
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
    if (currentStoreId) await db.deleteOrder(currentStoreId, order.id);
    setActiveTab('MENU');
    showToast(`Order #${order.orderNumber} resumed in Menu`);
  };

  const handleHoldActiveOrder = async (order: Order, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentStoreId) return;
    await db.updateOrderStatus(currentStoreId, order.id, OrderStatus.ON_HOLD);
    showToast(`Order #${order.orderNumber} moved to Held`, "INFO");
  };

  const handleActivateOrder = async (order: Order, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!shift) { showToast("Register is closed. Please open shift first.", "ERROR"); setIsShiftModalOpen(true); return; }
    if (!currentStoreId) return;
    await db.updateOrderStatus(currentStoreId, order.id, OrderStatus.PENDING);
    setActiveTab('ORDERS');
    showToast(`Order #${order.orderNumber} moved to Active`, "SUCCESS");
  };

  const handleSendToKitchen = async () => {
      if (!currentStoreId || !user || !shift || cart.length === 0) return;
      if (orderType === OrderType.DINE_IN && !tableNumber) { showToast("Please select a table number.", "ERROR"); return; }
      const newOrder: Order = {
          id: uuid(), orderNumber: '', storeId: currentStoreId, shiftId: shift.id,
          items: cart, subtotal: totals.subtotal, 
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
      await db.addOrder(currentStoreId, newOrder);
      setCart([]); setSelectedCustomer(null); setCustomerSearch(''); setTableNumber(''); setOrderNote(''); setOrderType(OrderType.DINE_IN); setDiscountPercent(0);
      setActiveTab('ORDERS');
      showToast("Order created & sent to kitchen.", "SUCCESS");
  };

  const totals = useMemo(() => {
      const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const discountAmount = (subtotal * discountPercent) / 100;
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

  const handleQuickSettleActive = (order: Order, e: React.MouseEvent) => {
      e.stopPropagation();
      setOrderToSettle(order); setPaymentMethod('CASH'); setAmountTendered(''); setPaymentError(''); setIsPaymentModalOpen(true);
  };

  const finalizePayment = async () => {
      if (!currentStoreId || !user || !shift) return;
      const payableTotal = orderToSettle ? orderToSettle.total : totals.total;
      const tendered = parseFloat(amountTendered) || 0;
      if (paymentMethod === 'CASH' && tendered < payableTotal) { setPaymentError(`Short by ${store?.currency}${(payableTotal - tendered).toFixed(2)}`); return; }
      const transaction: Transaction = {
          id: uuid(), type: 'PAYMENT', amount: payableTotal, method: paymentMethod,
          timestamp: Date.now(), performedBy: user.id, 
          tenderedAmount: paymentMethod === 'CASH' ? tendered : payableTotal,
          changeAmount: paymentMethod === 'CASH' ? tendered - payableTotal : 0
      };
      let finalOrder: Order;
      if (orderToSettle) {
          finalOrder = { ...orderToSettle, status: OrderStatus.COMPLETED, paymentMethod, transactions: [...(orderToSettle.transactions || []), transaction] };
          await db.updateOrder(currentStoreId, finalOrder);
          showToast(`Order #${orderToSettle.orderNumber} settled.`, "SUCCESS");
      } else {
          finalOrder = { 
            id: uuid(), orderNumber: '', storeId: currentStoreId, shiftId: shift.id, 
            items: cart, 
            subtotal: totals.subtotal, 
            discountPercent: discountPercent,
            discountAmount: totals.discountAmount,
            tax: totals.tax, serviceCharge: totals.serviceCharge, 
            total: totals.total, orderType, status: OrderStatus.COMPLETED, paymentMethod, note: orderNote, transactions: [transaction], tableNumber: orderType === OrderType.DINE_IN ? tableNumber : undefined, 
            customerName: selectedCustomer?.name, 
            customerPhone: selectedCustomer?.phone, 
            customerTin: selectedCustomer?.tin,
            customerAddress: selectedCustomer ? formatAddress(selectedCustomer) : undefined,
            createdBy: user.id, createdAt: Date.now() 
          } as Order;
          finalOrder = await db.addOrder(currentStoreId, finalOrder);
          setCart([]); setSelectedCustomer(null); setCustomerSearch(''); setTableNumber(''); setOrderNote(''); setOrderType(OrderType.DINE_IN); setDiscountPercent(0);
          showToast("Payment completed.", "SUCCESS");
      }
      setIsPaymentModalOpen(false); setOrderToSettle(null); setPreviewOrder(finalOrder); setPrintModalOpen(true);
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
  const getIframeWidth = () => { const paperSize = store?.printSettings?.paperSize || 'thermal'; switch(paperSize) { case 'a4': return '550px'; case 'a5': return '400px'; case 'letter': return '550px'; default: return '300px'; } };

  const filteredCustomers = customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone.includes(customerSearch));
  const handleCustomerSelect = (c: Customer) => { setSelectedCustomer(c); setCustomerSearch(c.name); setShowCustomerResults(false); };

  const handleQuickAddCustomer = async (e: React.FormEvent) => {
      e.preventDefault(); 
      if (!currentStoreId || !newCustData.name) return;
      const newCust: Customer = { ...newCustData, id: uuid() } as Customer;
      await db.addCustomer(currentStoreId, newCust); 
      setSelectedCustomer(newCust); 
      setCustomerSearch(newCust.name); 
      setIsCustomerModalOpen(false); 
      resetNewCustForm();
      showToast("Customer Added", "SUCCESS");
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
      if (!currentStoreId || !user) return;
      const total = calculateDenomTotal();
      if (total <= 0) { setShiftError("Starting float cannot be zero."); return; }
      await db.openShift(currentStoreId, user.id, total, denominations);
      setIsShiftModalOpen(false); setDenominations({}); setShiftError(''); loadData(); showToast("Register Opened", "SUCCESS");
  };

  const initiateCloseShift = () => {
    if (!currentStoreId) return;
    setShiftError('');
    if (cart.length > 0) { setShiftError("Cannot close: An unsaved order is in the cart."); return; }
    if (activeOrders.length > 0) { setShiftError(`Blocked: There are still ${activeOrders.length} active orders in progress.`); return; }
    
    if (!shift) { showToast("No active session found.", "ERROR"); setIsShiftModalOpen(false); return; }
    setIsShiftConfirmOpen(true);
  };

  const executeCloseShift = async () => {
    if (!currentStoreId || !shift) return;
    const totalCount = calculateDenomTotal();
    const success = await db.closeShift(currentStoreId, shift.id, totalCount, shiftNote, denominations);
    if (success) { 
        setIsShiftConfirmOpen(false); 
        setIsShiftModalOpen(false); 
        setDenominations({}); 
        setShiftNote(''); 
        loadData(); 
        showToast("Register Closed Successfully", "SUCCESS"); 
    } else {
        setShiftError("System failed to close shift record.");
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden text-gray-800 dark:text-gray-200">
      <div ref={exportRef} style={{ position: 'fixed', left: '0', top: '0', zIndex: '-100', opacity: '1', pointerEvents: 'none', backgroundColor: 'white' }} />
      
      {toast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-top-2">
              <div className={`px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 text-white font-bold border-2 ${toast.type === 'SUCCESS' ? 'bg-green-600 border-green-400' : toast.type === 'ERROR' ? 'bg-red-600 border-red-400' : 'bg-blue-600 border-blue-400'}`}>
                  {toast.type === 'SUCCESS' ? <CheckCircle size={18}/> : toast.type === 'ERROR' ? <AlertCircle size={18}/> : <Info size={18}/>}
                  {toast.message}
              </div>
          </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 relative">
        <div className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-3 md:px-4">
            <div className="flex items-center gap-2 md:gap-4 overflow-hidden">
                <div className="relative w-32 md:w-48 lg:w-64">
                    <Search className="absolute left-2 top-2.5 text-gray-400" size={14} />
                    <input className="w-full pl-7 pr-3 py-1.5 bg-white dark:bg-gray-700 rounded-lg text-xs outline-none dark:text-white border border-gray-200 dark:border-gray-700 focus:border-blue-500" placeholder="Search menu..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <div className="flex bg-white dark:bg-gray-700 p-1 rounded-lg text-[10px] md:text-xs font-medium overflow-hidden border border-gray-100 dark:border-gray-600">
                    <button onClick={() => setActiveTab('MENU')} className={`px-2 md:px-3 py-1 rounded-md transition-all ${activeTab === 'MENU' ? 'bg-blue-600 text-white shadow shadow-blue-500/20' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>Menu</button>
                    <button onClick={() => setActiveTab('ORDERS')} className={`px-2 md:px-3 py-1 rounded-md transition-all ${activeTab === 'ORDERS' ? 'bg-blue-600 text-white shadow shadow-blue-500/20' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>Active</button>
                    <button onClick={() => setActiveTab('HELD')} className={`px-2 md:px-3 py-1 rounded-md transition-all ${activeTab === 'HELD' ? 'bg-blue-600 text-white shadow shadow-blue-500/20' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>Held</button>
                    <button onClick={() => setActiveTab('HISTORY')} className={`px-2 md:px-3 py-1 rounded-md transition-all ${activeTab === 'HISTORY' ? 'bg-blue-600 text-white shadow shadow-blue-500/20' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>History</button>
                </div>
            </div>
            <div className="flex items-center gap-3">
                {shift && heldOrders.length > 0 && (
                    <div className="hidden sm:flex items-center gap-2 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 px-3 py-1.5 rounded-lg border border-yellow-200 dark:border-yellow-800 animate-pulse">
                        <PauseCircle size={14}/>
                        <span className="text-[10px] font-black uppercase tracking-tight">{heldOrders.length} Held Orders</span>
                    </div>
                )}
                <button onClick={() => { setDenominations({}); setShiftError(''); setIsShiftModalOpen(true); }} className={`flex items-center gap-2 px-3 md:px-4 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all active:scale-95 ${shift ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
                    {shift ? <Lock size={16} /> : <Unlock size={16} />}
                    <span className="hidden sm:inline">{shift ? 'Close Shift' : 'Open Shift'}</span>
                </button>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 md:p-3 custom-scrollbar flex flex-col relative">
            {activeTab === 'MENU' ? (
                <>
                    <div className="flex gap-2 overflow-x-auto pb-3 mb-2 custom-scrollbar-hide whitespace-nowrap">
                        <button 
                            onClick={() => setSelectedCategoryId('ALL')}
                            className={`px-3 py-1.5 rounded-full text-[10px] md:text-xs font-black uppercase transition-all border ${selectedCategoryId === 'ALL' ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700'}`}
                        >
                            All Items
                        </button>
                        {categories.map(cat => (
                            <button 
                                key={cat.id}
                                onClick={() => setSelectedCategoryId(cat.id)}
                                className={`px-3 py-1.5 rounded-full text-[10px] md:text-xs font-black uppercase transition-all border ${selectedCategoryId === cat.id ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700'}`}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-2 md:gap-3 content-start flex-1">
                        {products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) && (selectedCategoryId === 'ALL' || p.categoryId === selectedCategoryId)).map(product => (
                            <button 
                                key={product.id} 
                                onClick={() => addToCart(product)} 
                                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 text-left flex flex-col transition-all active:scale-95 shadow-sm group h-fit overflow-hidden"
                                style={{ padding: `${4 * menuScale}px` }}
                            >
                                <div 
                                    className="w-full bg-gray-50 dark:bg-gray-700 rounded mb-1.5 flex items-center justify-center text-gray-300 overflow-hidden"
                                    style={{ height: `${2.5 * menuScale}rem` }}
                                >
                                    {product.imageUrl ? <img src={product.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /> : <Utensils size={14 * menuScale}/>}
                                </div>
                                <h3 
                                    className="font-bold text-gray-800 dark:text-white line-clamp-2 mb-0.5 leading-tight"
                                    style={{ fontSize: `${8 * menuScale}px` }}
                                >
                                    {product.name}
                                </h3>
                                <div 
                                    className="mt-auto font-black text-blue-600"
                                    style={{ fontSize: `${9 * menuScale}px` }}
                                >
                                    {store?.currency}{((product.price) * (1 + (store?.taxRate || 0) / 100)).toFixed(2)}
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="sticky bottom-4 right-4 self-end z-20 flex items-center gap-3 px-3 py-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl transition-all hover:scale-105 group">
                        <div className="p-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl transition-colors group-hover:bg-blue-600 group-hover:text-white">
                            <Maximize2 size={16} />
                        </div>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-3">
                                <input
                                    type="range"
                                    min="0.75"
                                    max="1.5"
                                    step="0.05"
                                    value={menuScale}
                                    onChange={(e) => setMenuScale(parseFloat(e.target.value))}
                                    className="w-24 md:w-32 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                />
                                <span className="text-[10px] font-mono font-black text-blue-600 dark:text-blue-400 min-w-[32px]">{Math.round(menuScale * 100)}%</span>
                            </div>
                        </div>
                    </div>
                </>
            ) : activeTab === 'ORDERS' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {activeOrders.map(order => (
                        <div key={order.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl border-l-4 border-blue-500 shadow-sm flex flex-col transition-all hover:shadow-md">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-bold dark:text-white text-lg">#{order.orderNumber}</h3>
                                <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${order.kitchenStatus === 'READY' ? 'bg-green-100 text-green-700' : order.kitchenStatus === 'PREPARING' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>{order.kitchenStatus || 'Pending'}</span>
                            </div>
                            <div className="text-xs text-gray-500 mb-4">{order.orderType} • {order.tableNumber ? `Table ${order.tableNumber}` : order.customerName || 'Walk-in'}</div>
                            <div className="space-y-1 mb-4 overflow-hidden">
                                {order.items.slice(0, 3).map((it, idx) => <div key={idx} className="text-[11px] truncate opacity-70"> • {it.quantity}x {it.productName}</div>)}
                                {order.items.length > 3 && <div className="text-[10px] text-gray-400 italic">+{order.items.length - 3} more items...</div>}
                            </div>
                            <div className="mt-auto pt-2 border-t dark:border-gray-700 flex justify-between items-center">
                                <div className="flex gap-1">
                                    <button onClick={() => resumeOrder(order)} className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100" title="Edit Order"><Edit size={14}/></button>
                                    <button onClick={(e) => handleHoldActiveOrder(order, e)} className="p-1.5 bg-yellow-50 text-yellow-600 rounded hover:bg-yellow-100" title="Hold Order"><PauseCircle size={14}/></button>
                                    <button onClick={(e) => handleQuickSettleActive(order, e)} className="p-1.5 bg-green-50 text-green-600 rounded hover:bg-green-100" title="Settle & Archive"><DollarSign size={14}/></button>
                                </div>
                                <span className="font-bold dark:text-white">{store?.currency}{order.total.toFixed(2)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            ) : activeTab === 'HELD' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {heldOrders.map(order => (
                        <div key={order.id} onClick={() => handleActivateOrder(order)} className="bg-white dark:bg-gray-800 p-4 rounded-xl border-l-4 border-yellow-500 shadow-sm cursor-pointer hover:shadow-md transition-all flex flex-col group">
                            <h3 className="font-bold dark:text-white text-lg mb-1 group-hover:text-blue-500 transition-colors">#{order.orderNumber}</h3>
                            <div className="text-xs text-gray-500 mb-4">ON HOLD • {order.tableNumber ? `Table ${order.tableNumber}` : order.customerName || 'Walk-in'}</div>
                            <div className="mt-auto pt-2 border-t dark:border-gray-700 flex justify-between items-center">
                                <span className="text-[10px] font-black uppercase text-yellow-600 flex items-center gap-1"><Play size={10}/> Click to Activate</span>
                                <span className="font-bold dark:text-white">{store?.currency}{order.total.toFixed(2)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 overflow-hidden shadow-sm overflow-x-auto">
                    <table className="w-full text-left text-sm min-w-[500px]">
                        <thead className="bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 font-bold border-b border-gray-200 dark:border-gray-700">
                            <tr><th className="p-4">Time</th><th className="p-4">Order #</th><th className="p-4">Customer</th><th className="p-4 text-right">Amount</th><th className="p-4 text-right">Action</th></tr>
                        </thead>
                        <tbody className="divide-y dark:divide-gray-700">
                            {historyOrders.map(order => (
                                <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                                    <td className="p-4 dark:text-gray-300">{new Date(order.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</td>
                                    <td className="p-4 font-mono font-bold text-blue-600">#{order.orderNumber}</td>
                                    <td className="p-4 dark:text-gray-400 truncate max-w-[120px]">{order.customerName || `Table ${order.tableNumber || '-'}`}</td>
                                    <td className="p-4 text-right font-bold dark:text-white">{store?.currency}{order.total.toFixed(2)}</td>
                                    <td className="p-4 text-right">
                                        <button onClick={() => {setPreviewOrder(order); setPrintModalOpen(true);}} className="p-1.5 text-gray-400 hover:text-blue-600"><Printer size={16}/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
      </div>

      <div className="hidden md:flex w-64 lg:w-80 xl:w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col shadow-xl">
        <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            <div className="flex justify-between items-center mb-3">
                <div className="flex flex-col">
                    <h2 className="font-bold text-base dark:text-white">Current Order</h2>
                    <div className="flex items-center gap-1 text-[10px] font-black text-blue-600 uppercase tracking-widest mt-0.5">
                        <Hash size={10} /> Predicted Order #{nextOrderNum}
                    </div>
                </div>
                {cart.length > 0 && (
                    <button 
                        onClick={clearCart}
                        className="flex items-center gap-1 text-[10px] font-black uppercase text-red-500 hover:text-red-700 transition-colors"
                    >
                        <Trash2 size={12} /> Clear
                    </button>
                )}
            </div>
            <div className="space-y-2">
                <div className="flex gap-1 bg-white dark:bg-gray-700 p-1 rounded border border-gray-200 dark:border-gray-700">
                    {[OrderType.DINE_IN, OrderType.TAKEAWAY, OrderType.DELIVERY].map(t => (
                        <button key={t} onClick={() => setOrderType(t)} className={`flex-1 py-1 text-[8px] xl:text-[10px] font-bold rounded uppercase transition-all ${orderType === t ? 'bg-blue-600 text-white shadow shadow-blue-500/20' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>{t.replace('_', ' ')}</button>
                    ))}
                </div>
                <div className="flex gap-1">
                    <div className="relative flex-1">
                        <input type="text" placeholder="Customer..." className="w-full p-1.5 text-xs border border-gray-200 rounded bg-white dark:bg-gray-700 dark:text-white dark:border-gray-700 outline-none focus:ring-1 focus:ring-blue-500" value={customerSearch} onChange={(e) => { setCustomerSearch(e.target.value); setSelectedCustomer(null); setShowCustomerResults(true); }} onFocus={() => setShowCustomerResults(true)} onClick={(e) => e.stopPropagation()} />
                        {selectedCustomer && <CheckCircle size={14} className="absolute right-2 top-2 text-blue-500" />}
                        {showCustomerResults && customerSearch && !selectedCustomer && (
                            <div className="absolute top-full left-0 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-2xl mt-1 z-50 max-h-48 overflow-y-auto">
                                {filteredCustomers.length > 0 ? filteredCustomers.map(c => (
                                    <button key={c.id} onClick={(e) => { e.stopPropagation(); handleCustomerSelect(c); }} className="w-full text-left p-2 hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-0">
                                        <div className="font-bold text-sm dark:text-white">{c.name}</div><div className="text-xs text-gray-500">{c.phone}</div>
                                    </button>
                                )) : <div className="p-3 text-xs text-gray-500">No results.</div>}
                            </div>
                        )}
                    </div>
                    <button onClick={() => { resetNewCustForm(); setIsCustomerModalOpen(true); }} className="p-1.5 bg-blue-50 text-blue-600 rounded border border-blue-200 hover:bg-blue-100 transition-colors"><UserPlus size={16}/></button>
                </div>
                {orderType === OrderType.DINE_IN && (
                    store?.numberOfTables ? (
                        <select className="w-full p-1.5 text-xs border border-gray-200 rounded bg-white dark:bg-gray-700 dark:text-white dark:border-gray-700" value={tableNumber} onChange={e => setTableNumber(e.target.value)}><option value="">Select Table</option>{Array.from({length: store.numberOfTables}, (_, i) => (i + 1).toString()).map(num => (<option key={num} value={num}>Table {num}</option>))}</select>
                    ) : (<input placeholder="Table Number" className="w-full p-1.5 text-xs border border-gray-200 rounded bg-white dark:bg-gray-700 dark:text-white dark:border-gray-700" value={tableNumber} onChange={e => setTableNumber(e.target.value)} />)
                )}
                <div className="relative">
                    <StickyNote size={12} className="absolute left-2 top-2 text-gray-400" />
                    <textarea placeholder="Notes..." className="w-full pl-6 pr-2 py-1.5 text-xs border border-gray-200 rounded bg-white dark:bg-gray-700 dark:text-white dark:border-gray-700 outline-none focus:ring-1 focus:ring-blue-500 resize-none h-12" value={orderNote} onChange={e => setOrderNote(e.target.value)} />
                </div>
            </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar bg-white dark:bg-gray-800">
            {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-20"><ShoppingBag size={40} className="mb-1" /><p className="font-bold uppercase tracking-widest text-[10px]">Empty Cart</p></div>
            ) : cart.map(item => (
                <div key={item.productId} className="flex items-center justify-between">
                    <div className="flex-1 pr-2"><div className="text-xs font-bold dark:text-white truncate leading-tight">{item.productName}</div><div className="text-[10px] text-gray-500">{store?.currency}{item.price.toFixed(2)}</div></div>
                    <div className="flex items-center gap-1.5">
                        <button onClick={() => updateQuantity(item.productId, -1)} className="w-5 h-5 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-200 transition-colors">-</button>
                        <span className="text-xs font-black w-3 text-center dark:text-white">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.productId, 1)} className="w-5 h-5 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-200 transition-colors">+</button>
                    </div>
                    <div className="w-14 text-right font-black text-xs dark:text-white ml-2">{store?.currency}{(item.price * item.quantity).toFixed(2)}</div>
                </div>
            ))}
        </div>

        <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                    <Percent size={10} /> Discount
                </span>
                {discountPercent > 0 && (
                    <button onClick={() => setDiscountPercent(0)} className="text-[8px] font-bold text-red-500 uppercase">Remove</button>
                )}
            </div>
            <div className="grid grid-cols-4 gap-1 mb-2">
                {[5, 10, 15, 20].map(p => (
                    <button 
                        key={p} 
                        onClick={() => setDiscountPercent(p)}
                        className={`py-1 text-[10px] font-black rounded border transition-all ${discountPercent === p ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500'}`}
                    >
                        {p}%
                    </button>
                ))}
            </div>
            <div className="relative">
                <input 
                    type="number" 
                    placeholder="Custom %" 
                    className="w-full pl-3 pr-8 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                    value={discountPercent || ''}
                    onChange={e => setDiscountPercent(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                />
                <span className="absolute right-3 top-1.5 text-xs font-bold text-gray-400">%</span>
            </div>
        </div>

        <div className="p-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
            <div className="space-y-0.5 mb-3 text-[11px] dark:text-gray-300">
                <div className="flex justify-between"><span>Subtotal</span><span>{store?.currency}{totals.subtotal.toFixed(2)}</span></div>
                {totals.discountAmount > 0 && (
                    <div className="flex justify-between text-red-500 font-bold">
                        <span>Discount (${discountPercent}%)</span>
                        <span>-{store?.currency}{totals.discountAmount.toFixed(2)}</span>
                    </div>
                )}
                {totals.serviceCharge > 0 && <div className="flex justify-between"><span>Service Charge (${store?.serviceChargeRate}%)</span><span>{store?.currency}{totals.serviceCharge.toFixed(2)}</span></div>}
                {totals.tax > 0 && <div className="flex justify-between"><span>Tax (${store?.taxRate}%)</span><span>{store?.currency}{totals.tax.toFixed(2)}</span></div>}
                <div className="flex justify-between font-black text-lg dark:text-white pt-1 border-t border-gray-100 dark:border-gray-700 mt-1"><span>Total</span><span>{store?.currency}{totals.total.toFixed(2)}</span></div>
            </div>
            <div className="flex flex-col gap-1.5">
                <button onClick={handleSendToKitchen} disabled={cart.length === 0} className="w-full py-2 bg-orange-100 text-orange-700 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-orange-200 disabled:opacity-50 transition-all active:scale-95"><ChefHat size={14}/> Kitchen</button>
                <button onClick={handleCheckout} disabled={cart.length === 0} className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-black text-xs flex items-center justify-center gap-1.5 hover:bg-blue-700 disabled:opacity-50 shadow-lg active:scale-95"><DollarSign size={14}/> Checkout</button>
            </div>
        </div>
      </div>

      {printModalOpen && previewOrder && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
              <div className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
                  <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-gray-700"><h2 className="text-lg font-bold flex items-center gap-2 dark:text-white"><Printer size={20}/> Receipt: #{previewOrder.orderNumber}</h2><button onClick={() => setPrintModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"><X size={20}/></button></div>
                  <div className="flex-1 bg-gray-50 dark:bg-gray-900 p-4 md:p-8 overflow-auto flex justify-center"><div className="bg-white shadow-lg transition-all" style={{ width: getIframeWidth(), minHeight: '400px' }}><iframe srcDoc={previewHtml} className="w-full h-[600px] border-none" title="Print Preview" /></div></div>
                  <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3 bg-white dark:bg-gray-800">
                    <button onClick={() => setPrintModalOpen(false)} className="px-6 py-2 border border-gray-200 dark:border-gray-700 rounded-lg dark:text-gray-300">Close</button>
                    <button onClick={handleSaveAsJpg} className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg font-bold hover:bg-blue-50 flex items-center gap-2 transition-colors"><FileImage size={18}/> Save as Image</button>
                    <button onClick={handlePrintFinal} className="px-8 py-2 bg-blue-600 text-white rounded-lg font-bold shadow-sm hover:bg-blue-700 flex items-center gap-2"><Printer size={18}/> Print</button>
                  </div>
              </div>
          </div>
      )}

      {isPaymentModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 max-h-[95vh]">
                  <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold dark:text-white">Payment</h2><button onClick={() => { setIsPaymentModalOpen(false); setOrderToSettle(null); }} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"><X size={20}/></button></div>
                  <div className="text-center mb-6 bg-blue-50 dark:bg-blue-900/20 py-6 rounded-2xl border border-blue-100 dark:border-blue-800">
                      <div className="text-gray-500 uppercase text-[10px] font-black tracking-widest mb-1">Payable</div>
                      <div className="text-4xl md:text-5xl font-black text-blue-600">{store?.currency}{(orderToSettle ? orderToSettle.total : totals.total).toFixed(2)}</div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-6">
                      <button onClick={() => {setPaymentMethod('CASH'); setPaymentError('');}} className={`py-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${paymentMethod === 'CASH' ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm' : 'border-gray-100 dark:border-gray-700 text-gray-500 hover:border-gray-300'}`}><Banknote size={24}/> Cash</button>
                      <button onClick={() => {setPaymentMethod('CARD'); setPaymentError('');}} className={`py-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${paymentMethod === 'CARD' ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm' : 'border-gray-100 dark:border-gray-700 text-gray-500 hover:border-gray-300'}`}><CreditCard size={24}/> Card</button>
                      <button onClick={() => {setPaymentMethod('TRANSFER'); setPaymentError('');}} className={`py-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${paymentMethod === 'TRANSFER' ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm' : 'border-gray-100 dark:border-gray-700 text-gray-500 hover:border-gray-300'}`}><RefreshCcw size={24}/> Trans</button>
                  </div>
                  {paymentMethod === 'CASH' && (
                      <div className="space-y-4">
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Received</label>
                          <input 
                            autoFocus 
                            type="number" 
                            placeholder="0.00" 
                            className={`w-full p-4 border rounded-xl text-3xl font-bold text-center bg-white dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all ${paymentError ? 'border-red-500 bg-red-50' : 'border-gray-200 dark:border-gray-600'}`} 
                            value={amountTendered} 
                            onChange={e => {setAmountTendered(e.target.value); setPaymentError('');}} 
                          />
                          {paymentError && <p className="text-red-500 text-xs font-bold mt-2 text-center">{paymentError}</p>}
                        </div>
                      </div>
                  )}
                  <button onClick={finalizePayment} className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-lg mt-6 shadow-xl active:scale-[0.98] transition-all">Confirm Payment</button>
              </div>
          </div>
      )}

      {isShiftModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 flex flex-col h-[90vh] animate-in slide-in-from-bottom-4 duration-300">
                  <h2 className="text-xl font-bold mb-4 dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 pb-3">{shift ? <Lock size={20} /> : <Unlock size={20} />}{shift ? 'Close Shift' : 'Open Register'}</h2>
                  {shiftError && <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-lg mb-4 text-xs font-bold flex items-center gap-2 border border-red-100 dark:border-red-800"><AlertCircle size={14}/> {shiftError}</div>}
                  <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
                      <div className="grid grid-cols-2 gap-3">
                        {DENOMINATIONS.map(d => (
                          <div key={d} className="flex items-center gap-3 bg-white dark:bg-gray-700 p-2 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm">
                            <span className="font-bold text-gray-400 w-12 text-sm">{d}</span>
                            <input 
                              type="number" 
                              min="0" 
                              placeholder="0" 
                              className="w-full p-1.5 border border-gray-200 rounded text-center bg-white dark:bg-gray-700 dark:text-white dark:border-gray-700 outline-none focus:ring-1 focus:ring-blue-500 font-bold" 
                              value={denominations[d] || ''} 
                              onChange={e => setDenominations({...denominations, [d]: parseInt(e.target.value) || 0})} 
                            />
                          </div>
                        ))}
                      </div>
                      <div className="bg-blue-600 text-white p-5 rounded-2xl flex justify-between items-center shadow-lg"><div><span className="font-bold uppercase text-[10px] opacity-70 block mb-1">Total Counted</span><span className="text-2xl font-black">{store?.currency || '$'}{calculateDenomTotal().toFixed(2)}</span></div><RefreshCcw size={24} className="opacity-30" /></div>
                      {shift && (
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Notes</label>
                          <textarea 
                            placeholder="..." 
                            className="w-full p-3 border border-gray-200 rounded-xl bg-white dark:bg-gray-700 dark:text-white dark:border-gray-700 h-24 outline-none focus:ring-1 focus:ring-blue-500 text-sm" 
                            value={shiftNote} 
                            onChange={e => setShiftNote(e.target.value)} 
                          />
                        </div>
                      )}
                  </div>
                  <div className="flex gap-3 pt-6 border-t border-gray-100 dark:border-gray-700 mt-4"><button onClick={() => { setIsShiftModalOpen(false); setDenominations({}); setShiftError(''); }} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl">Cancel</button><button onClick={shift ? initiateCloseShift : handleOpenShift} className={`flex-1 py-3 rounded-xl text-white font-bold shadow-lg transition-all active:scale-95 ${shift ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}>{shift ? 'Finalize' : 'Open'}</button></div>
              </div>
          </div>
      )}

      {isShiftConfirmOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[150] p-4">
              <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-sm p-8 text-center animate-in zoom-in-95 duration-200">
                  <div className="w-20 h-20 bg-red-50 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600 dark:text-red-400 mx-auto mb-6"><AlertCircle size={40} /></div>
                  <h3 className="text-2xl font-bold dark:text-white mb-2">Finalize Shift?</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-8">Register Total: {store?.currency}{calculateDenomTotal().toFixed(2)}.</p>
                  <div className="flex flex-col gap-3"><button onClick={executeCloseShift} className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold shadow-xl active:scale-[0.98]">Confirm Close</button><button onClick={() => setIsShiftConfirmOpen(false)} className="w-full py-4 text-gray-500 font-bold hover:bg-white dark:hover:bg-gray-700 rounded-2xl transition-all">Go Back</button></div>
              </div>
          </div>
      )}

      {isCustomerModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 flex flex-col max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
                  <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-bold dark:text-white flex items-center gap-2"><UserPlus size={22} className="text-blue-600"/> Add Customer</h2>
                      <button onClick={() => setIsCustomerModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"><X size={20}/></button>
                  </div>
                  
                  <form onSubmit={handleQuickAddCustomer} className="space-y-4">
                      <div className="flex gap-4 p-1 bg-white dark:bg-gray-700 rounded-lg mb-4 border border-gray-200 dark:border-gray-600">
                          <button
                            type="button"
                            onClick={() => setNewCustData({...newCustData, type: 'INDIVIDUAL'})}
                            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${newCustData.type === 'INDIVIDUAL' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                          >
                              Individual
                          </button>
                          <button
                            type="button"
                            onClick={() => setNewCustData({...newCustData, type: 'COMPANY'})}
                            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${newCustData.type === 'COMPANY' ? 'bg-purple-50 text-purple-600 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                          >
                              Company
                          </button>
                      </div>

                      {newCustData.type === 'COMPANY' && (
                          <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg space-y-3 border border-purple-100 dark:border-purple-800">
                              <div>
                                <label className="block text-xs font-semibold text-purple-800 dark:text-purple-300 mb-1 uppercase tracking-tight">Company Name</label>
                                <input 
                                    placeholder="e.g. Acme Corp" 
                                    className="w-full p-2 border border-purple-200 dark:border-gray-700 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                    value={newCustData.companyName}
                                    onChange={e => setNewCustData({...newCustData, companyName: e.target.value})}
                                    required={newCustData.type === 'COMPANY'}
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-purple-800 dark:text-purple-300 mb-1 uppercase tracking-tight">Tax Identification Number (TIN)</label>
                                <input 
                                    placeholder="e.g. 123-456-789" 
                                    className="w-full p-2 border border-purple-200 dark:border-gray-700 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                    value={newCustData.tin}
                                    onChange={e => setNewCustData({...newCustData, tin: e.target.value})}
                                    required={newCustData.type === 'COMPANY'}
                                />
                              </div>
                          </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Contact Person</label>
                            <input 
                                placeholder="Full Name" 
                                className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                                value={newCustData.name}
                                onChange={e => setNewCustData({...newCustData, name: e.target.value})}
                                required
                            />
                          </div>
                          
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Phone Number</label>
                            <input 
                                placeholder="Phone Number" 
                                className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                                value={newCustData.phone}
                                onChange={e => setNewCustData({...newCustData, phone: e.target.value})}
                                required
                            />
                          </div>
                      </div>

                      <div className="border-t border-gray-100 dark:border-gray-700 pt-4 mt-2">
                          <h3 className="text-xs font-black text-gray-400 dark:text-gray-500 mb-3 flex items-center gap-2 uppercase tracking-widest">
                              <MapPin size={14} /> Address Details
                          </h3>
                          
                          {newCustData.type === 'INDIVIDUAL' ? (
                              <div className="space-y-3">
                                  <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">House Name / Building</label>
                                    <input 
                                        placeholder="e.g. Rose Villa, Apt 4B" 
                                        className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 dark:text-white"
                                        value={newCustData.houseName}
                                        onChange={e => setNewCustData({...newCustData, houseName: e.target.value})}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Street Name</label>
                                    <input 
                                        placeholder="e.g. Orchid Magu" 
                                        className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 dark:text-white"
                                        value={newCustData.streetName}
                                        onChange={e => setNewCustData({...newCustData, streetName: e.target.value})}
                                    />
                                  </div>
                              </div>
                          ) : (
                              <div className="space-y-3">
                                  <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Building Name</label>
                                        <input 
                                            placeholder="e.g. Trade Centre" 
                                            className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 dark:text-white"
                                            value={newCustData.buildingName}
                                            onChange={e => setNewCustData({...newCustData, buildingName: e.target.value})}
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Street</label>
                                        <input 
                                            placeholder="e.g. Main Street" 
                                            className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 dark:text-white"
                                            value={newCustData.street}
                                            onChange={e => setNewCustData({...newCustData, street: e.target.value})}
                                        />
                                      </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Island / Atoll</label>
                                        <input 
                                            placeholder="e.g. Male'" 
                                            className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 dark:text-white"
                                            value={newCustData.island}
                                            onChange={e => setNewCustData({...newCustData, island: e.target.value})}
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Country</label>
                                        <input 
                                            placeholder="e.g. Maldives" 
                                            className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 dark:text-white"
                                            value={newCustData.country}
                                            onChange={e => setNewCustData({...newCustData, country: e.target.value})}
                                        />
                                      </div>
                                  </div>
                              </div>
                          )}
                      </div>

                      <div className="flex gap-2 pt-4 border-t border-gray-100 dark:border-gray-700">
                          <button type="button" onClick={() => setIsCustomerModalOpen(false)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-white dark:hover:bg-gray-700 rounded-xl">Cancel</button>
                          <button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg transition-all active:scale-95">Save Customer</button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
}
