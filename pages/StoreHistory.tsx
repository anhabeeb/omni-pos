import React, { useEffect, useState, useMemo, useRef } from 'react';
// @ts-ignore - Fixing missing member errors in react-router-dom
import { useParams } from 'react-router-dom';
import { useAuth } from '../App';
import { db, uuid } from '../services/db';
import { Order, OrderStatus, Store, Transaction, RegisterShift, User, PrintSettings, OrderItem } from '../types';
import { 
  Calendar, Printer, RotateCcw, X, Search, FileImage, History as HistoryIcon, Eye, Trash
} from 'lucide-react';
import { toJpeg } from 'html-to-image';

export default function StoreHistory() {
  const { storeId: urlStoreId } = useParams<{ storeId: string }>();
  const { user, currentStoreId, switchStore, hasPermission } = useAuth();
  
  const activeStoreId = urlStoreId ? Number(urlStoreId) : currentStoreId;

  const [activeTab, setActiveTab] = useState<'SALES' | 'KOT' | 'REGISTER'>('SALES');
  
  const [dateRange, setDateRange] = useState('TODAY');
  const [customStart, setCustomStart] = useState(new Date().toISOString().split('T')[0]);
  const [customEnd, setCustomEnd] = useState(new Date().toISOString().split('T')[0]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOrderType] = useState('ALL');
  const [filterPaymentMethod] = useState('ALL');

  const [shiftSearch, setShiftSearch] = useState('');
  const [shiftStatusFilter] = useState('ALL');

  const [orders, setOrders] = useState<Order[]>([]);
  const [shifts, setShifts] = useState<RegisterShift[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [store, setStore] = useState<Store | null>(null);

  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [refundOrder, setRefundOrder] = useState<Order | null>(null);
  const [viewShift, setViewShift] = useState<RegisterShift | null>(null);
  
  const [refundMode, setRefundMode] = useState<'FULL' | 'PARTIAL'>('FULL');
  const [refundAmount, setRefundAmount] = useState<string>('');
  const [refundReason, setRefundReason] = useState('');

  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [previewOrder, setPreviewOrder] = useState<Order | null>(null);
  const [previewPaperSize, setPreviewPaperSize] = useState<'thermal' | 'a4' | 'a5' | 'letter'>('thermal');

  const exportRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    if (activeStoreId) {
      const allOrders = await db.getOrders(activeStoreId);
      setOrders(allOrders.sort((a: Order, b: Order) => b.createdAt - a.createdAt));
      const allShifts = await db.getRegisterShifts(activeStoreId);
      setShifts(allShifts.sort((a: RegisterShift, b: RegisterShift) => b.openedAt - a.openedAt));
      const usersData = await db.getUsers();
      setUsers(usersData);
      const stores = await db.getStores();
      const s = stores.find((st: Store) => st.id === activeStoreId) || null;
      setStore(s);
    }
  };

  useEffect(() => {
    if (activeStoreId) {
        if (urlStoreId && Number(urlStoreId) !== currentStoreId) {
            switchStore(Number(urlStoreId));
        }
        loadData();
        const handleUpdate = () => loadData();
        window.addEventListener(`db_change_store_${activeStoreId}_orders`, handleUpdate);
        window.addEventListener(`db_change_store_${activeStoreId}_shifts`, handleUpdate);
        return () => {
            window.removeEventListener(`db_change_store_${activeStoreId}_orders`, handleUpdate);
            window.removeEventListener(`db_change_store_${activeStoreId}_shifts`, handleUpdate);
        }
    }
  }, [activeStoreId, urlStoreId, currentStoreId]);

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
        case 'LAST_7_DAYS':
            const last7 = new Date();
            last7.setDate(last7.getDate() - 7);
            last7.setHours(0,0,0,0);
            start = last7.getTime();
            break;
        case 'LAST_30_DAYS':
            const last30 = new Date();
            last30.setDate(last30.getDate() - 30);
            last30.setHours(0,0,0,0);
            start = last30.getTime();
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

  const filteredOrders = useMemo(() => {
    let result = orders;
    const { start, end } = getTimeRange();
    result = result.filter((o: Order) => {
        const t = o.createdAt;
        return t >= start && t <= end;
    });
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        result = result.filter((o: Order) => 
            o.orderNumber.toString().includes(term) ||
            (o.customerName?.toLowerCase() || '').includes(term) ||
            (o.tableNumber?.toLowerCase() || '').includes(term)
        );
    }
    return result;
  }, [orders, dateRange, customStart, customEnd, searchTerm]);

  const filteredShifts = useMemo(() => {
      let result = shifts;
      const { start, end } = getTimeRange();
      result = result.filter((s: RegisterShift) => s.openedAt >= start && s.openedAt <= end);
      if (shiftStatusFilter !== 'ALL') { result = result.filter((s: RegisterShift) => s.status === shiftStatusFilter); }
      if (shiftSearch) {
          const term = shiftSearch.toLowerCase();
          result = result.filter((s: RegisterShift) => {
              const numMatch = (s.shiftNumber?.toString() || '').includes(term);
              const userMatch = getUserName(s.openedBy).toLowerCase().includes(term);
              return numMatch || userMatch;
          });
      }
      return result;
  }, [shifts, dateRange, customStart, customEnd, shiftStatusFilter, shiftSearch]);

  const getUserName = (id: number) => { return users.find((u: User) => u.id === id)?.name || 'Unknown'; };

  const getPaidAmount = (order: Order) => {
      return order.transactions?.reduce((acc: number, t: Transaction) => {
          if (t.type === 'PAYMENT') return acc + t.amount;
          if (t.type === 'REVERSAL') return acc - t.amount;
          return acc;
      }, 0) || 0;
  };

  const openRefundModal = (order: Order) => {
      setRefundOrder(order);
      setRefundMode('FULL');
      setRefundAmount(order.total.toFixed(2));
      setRefundReason('');
  };

  const handleProcessRefund = async () => {
      if (!activeStoreId || !user || !refundOrder) return;
      const amountToRefund = parseFloat(refundAmount);
      const paidAmount = getPaidAmount(refundOrder);
      if (isNaN(amountToRefund) || amountToRefund <= 0) { alert("Please enter a valid refund amount."); return; }
      if (amountToRefund > (paidAmount + 0.01)) { alert(`Cannot refund more than the paid amount (${store?.currency || '$'}${paidAmount.toFixed(2)})`); return; }
      const transaction: Transaction = {
          id: uuid(), type: 'REVERSAL', amount: amountToRefund, timestamp: Date.now(), performedBy: user.id, note: `Refund (${refundMode}): ${refundReason}`
      };
      let newStatus = refundOrder.status;
      if (refundMode === 'FULL' || (paidAmount - amountToRefund) <= 0.01) { newStatus = OrderStatus.RETURNED; }
      const updatedOrder: Order = { ...refundOrder, status: newStatus, transactions: [...(refundOrder.transactions || []), transaction] };
      await db.updateOrder(activeStoreId, updatedOrder);
      await loadData();
      setRefundOrder(null);
      alert("Refund processed successfully.");
  };

  const handleDelete = async (orderId: number) => {
    if (!activeStoreId) return;
    if (confirm("Are you sure you want to permanently delete this order record?")) { 
        await db.deleteOrder(activeStoreId, orderId); 
        await loadData();
    }
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
                ${settings.showCashierName ? `<div><strong>BY:</strong> ${users.find((u: User) => u.id === order.createdBy)?.name || 'Staff'}</div>` : ''}
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

  const handlePrint = (order: Order) => {
    setPreviewOrder(order);
    setPreviewPaperSize(store?.printSettings?.paperSize || 'thermal');
    setPrintModalOpen(true);
  };

  const finalPrint = () => {
    if (!previewOrder) return;
    const html = generateReceiptHtml(previewOrder, true, previewPaperSize);
    const printWindow = window.open('', '_blank', 'width=600,height=800');
    if (printWindow) { printWindow.document.write(html); printWindow.document.close(); }
    else alert("Pop-up blocked. Please allow pop-ups to print receipts.");
  };

  const handleSaveAsJpg = async () => {
    if (!previewOrder || !exportRef.current || !store) return;
    try {
        const paperSize = previewPaperSize;
        let width = '320px';
        if (paperSize === 'a4' || paperSize === 'letter') width = '800px';
        else if (paperSize === 'a5') width = '500px';

        const rawHtml = generateReceiptHtml(previewOrder, false, previewPaperSize);
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
    } catch (err) {
        console.error(err);
        alert("Failed to save image");
    }
  };

  const getIframeWidth = () => {
    const paperSize = previewPaperSize;
    if (paperSize === 'a4' || paperSize === 'letter') return '650px';
    if (paperSize === 'a5') return '500px';
    return '320px'; // thermal width
  };

  const previewHtml = useMemo(() => { 
    if (previewOrder) return generateReceiptHtml(previewOrder, false, previewPaperSize); 
    return ''; 
  }, [previewOrder, store, users, previewPaperSize]);

  return (
    <div className="space-y-6">
      <div ref={exportRef} style={{ position: 'fixed', left: '0', top: '0', zIndex: '-100', opacity: '1', pointerEvents: 'none', backgroundColor: 'white' }} />
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <HistoryIcon className="text-blue-600" /> Store History
          </h1>
          <p className="text-gray-500 dark:text-gray-400">{store?.name} Records</p>
        </div>
        <div className="flex gap-2 bg-white dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
            <button onClick={() => setActiveTab('SALES')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'SALES' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}>Sales</button>
            <button onClick={() => setActiveTab('KOT')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'KOT' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}>KOT</button>
            <button onClick={() => setActiveTab('REGISTER')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'REGISTER' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}>Register</button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 p-2 rounded-xl border border-gray-100 dark:border-gray-700">
                <Calendar size={18} className="text-gray-400" />
                <select value={dateRange} onChange={e => setDateRange(e.target.value)} className="bg-transparent text-sm font-bold outline-none dark:text-white">
                    <option value="TODAY">Today</option>
                    <option value="YESTERDAY">Yesterday</option>
                    <option value="LAST_7_DAYS">Last 7 Days</option>
                    <option value="LAST_30_DAYS">Last 30 Days</option>
                    <option value="CUSTOM">Custom Range</option>
                    <option value="ALL">All Time</option>
                </select>
            </div>
            {dateRange === 'CUSTOM' && (
                <div className="flex items-center gap-2">
                    <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="p-2 text-xs border rounded-lg bg-white dark:bg-gray-700 dark:text-white" />
                    <span className="text-gray-400">to</span>
                    <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="p-2 text-xs border rounded-lg bg-white dark:bg-gray-700 dark:text-white" />
                </div>
            )}
            <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                <input 
                    placeholder={activeTab === 'REGISTER' ? "Search shifts by number or staff..." : "Search orders by #, customer, table..."}
                    className="w-full pl-10 pr-4 py-2 border rounded-xl bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    value={activeTab === 'REGISTER' ? shiftSearch : searchTerm}
                    onChange={e => activeTab === 'REGISTER' ? setShiftSearch(e.target.value) : setSearchTerm(e.target.value)}
                />
            </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {activeTab === 'REGISTER' ? (
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-700">
                        <tr>
                            <th className="p-4 text-[10px] font-black uppercase text-gray-500">Shift #</th>
                            <th className="p-4 text-[10px] font-black uppercase text-gray-500">Staff</th>
                            <th className="p-4 text-[10px] font-black uppercase text-gray-500">Opened At</th>
                            <th className="p-4 text-[10px] font-black uppercase text-gray-500">Closed At</th>
                            <th className="p-4 text-[10px] font-black uppercase text-gray-500 text-right">Variance</th>
                            <th className="p-4 text-[10px] font-black uppercase text-gray-500">Status</th>
                            <th className="p-4 text-[10px] font-black uppercase text-gray-500 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {filteredShifts.map((s: RegisterShift) => (
                            <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                                <td className="p-4 font-mono font-bold text-blue-600">#{s.shiftNumber || s.id}</td>
                                <td className="p-4 font-bold dark:text-white">{getUserName(s.openedBy)}</td>
                                <td className="p-4 text-xs dark:text-gray-400">{new Date(s.openedAt).toLocaleString()}</td>
                                <td className="p-4 text-xs dark:text-gray-400">{s.closedAt ? new Date(s.closedAt).toLocaleString() : '-'}</td>
                                <td className={`p-4 text-right font-mono font-bold ${s.difference && s.difference < 0 ? 'text-red-500' : s.difference && s.difference > 0 ? 'text-green-500' : 'text-gray-400'}`}>
                                    {s.status === 'CLOSED' ? `${store?.currency}${s.difference?.toFixed(2)}` : '-'}
                                </td>
                                <td className="p-4">
                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${s.status === 'OPEN' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{s.status}</span>
                                </td>
                                <td className="p-4 text-right">
                                    <button onClick={() => setViewShift(s)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Eye size={18}/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        ) : (
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-700">
                        <tr>
                            <th className="p-4 text-[10px] font-black uppercase text-gray-500">Order #</th>
                            <th className="p-4 text-[10px] font-black uppercase text-gray-500">Time</th>
                            <th className="p-4 text-[10px] font-black uppercase text-gray-500">Details</th>
                            <th className="p-4 text-[10px] font-black uppercase text-gray-500 text-right">Total</th>
                            <th className="p-4 text-[10px] font-black uppercase text-gray-500">Status</th>
                            <th className="p-4 text-[10px] font-black uppercase text-gray-500 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {filteredOrders.map((o: Order) => (
                            <tr key={o.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                                <td className="p-4 font-mono font-bold text-blue-600">#{o.orderNumber}</td>
                                <td className="p-4 text-xs dark:text-gray-400">{new Date(o.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                                <td className="p-4">
                                    <div className="text-sm font-bold dark:text-white">{o.customerName || 'Walk-in'}</div>
                                    {o.tableNumber && <div className="text-[10px] text-gray-500">Table: {o.tableNumber}</div>}
                                </td>
                                <td className="p-4 text-right font-black dark:text-white">{store?.currency}{o.total.toFixed(2)}</td>
                                <td className="p-4">
                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${o.status === OrderStatus.COMPLETED ? 'bg-green-100 text-green-700' : o.status === OrderStatus.CANCELLED ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{o.status}</span>
                                </td>
                                <td className="p-4 text-right space-x-1">
                                    <button onClick={() => setViewOrder(o)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Eye size={16}/></button>
                                    <button onClick={() => handlePrint(o)} className="p-2 text-gray-400 hover:text-blue-600"><Printer size={16}/></button>
                                    {o.status === OrderStatus.COMPLETED && hasPermission('POS_REFUND') && (
                                        <button onClick={() => openRefundModal(o)} className="p-2 text-orange-500 hover:bg-orange-50 rounded-lg"><RotateCcw size={16}/></button>
                                    )}
                                    {hasPermission('POS_DELETE_ORDER') && (
                                        <button onClick={() => handleDelete(o.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash size={16}/></button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
      </div>

      {/* Order Details Modal */}
      {viewOrder && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
                  <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                      <h3 className="font-bold dark:text-white">Order Details: #{viewOrder.orderNumber}</h3>
                      <button onClick={() => setViewOrder(null)} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"><X size={20}/></button>
                  </div>
                  <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="space-y-1">
                              <p className="text-gray-400 font-bold uppercase text-[10px]">Customer</p>
                              <p className="font-bold dark:text-white">{viewOrder.customerName || 'Walk-in'}</p>
                          </div>
                          <div className="space-y-1 text-right">
                              <p className="text-gray-400 font-bold uppercase text-[10px]">Date & Time</p>
                              <p className="font-bold dark:text-white">{new Date(viewOrder.createdAt).toLocaleString()}</p>
                          </div>
                      </div>
                      <table className="w-full text-left">
                          <thead className="border-b dark:border-gray-700"><tr className="text-[10px] font-black uppercase text-gray-500"><th className="pb-2">Item</th><th className="pb-2 text-center">Qty</th><th className="pb-2 text-right">Price</th><th className="pb-2 text-right">Total</th></tr></thead>
                          <tbody className="divide-y dark:divide-gray-700">
                              {viewOrder.items.map((it: OrderItem, i: number) => (
                                  <tr key={i}><td className="py-2 text-sm dark:text-gray-200">{it.productName}</td><td className="py-2 text-center text-sm font-bold dark:text-gray-400">{it.quantity}</td><td className="py-2 text-right text-sm dark:text-gray-400">{store?.currency}{it.price.toFixed(2)}</td><td className="py-2 text-right text-sm font-black dark:text-white">{store?.currency}{(it.price * it.quantity).toFixed(2)}</td></tr>
                              ))}
                          </tbody>
                      </table>
                      <div className="flex flex-col items-end gap-1 pt-4 border-t dark:border-gray-700">
                          <div className="w-48 flex justify-between text-sm text-gray-500"><span>Subtotal:</span><span>{store?.currency}{viewOrder.subtotal.toFixed(2)}</span></div>
                          <div className="w-48 flex justify-between font-black text-xl dark:text-white border-t-2 border-gray-100 dark:border-gray-700 pt-2 mt-1"><span>TOTAL:</span><span>{store?.currency}{viewOrder.total.toFixed(2)}</span></div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Shift Details Modal */}
      {viewShift && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border dark:border-gray-700 animate-in zoom-in-95">
                  <div className="p-4 border-b dark:border-gray-700 bg-blue-50 dark:bg-blue-900/10 text-blue-600 flex justify-between items-center">
                      <h3 className="font-bold flex items-center gap-2">Shift Record: #{viewShift.shiftNumber || viewShift.id}</h3>
                      <button onClick={() => setViewShift(null)} className="p-1.5 hover:bg-blue-100 rounded-full transition-colors"><X size={20}/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                          <div><p className="text-[10px] font-black text-gray-400 uppercase">Staff</p><p className="font-bold dark:text-white">{getUserName(viewShift.openedBy)}</p></div>
                          <div><p className="text-[10px] font-black text-gray-400 uppercase">Status</p><p className={`font-black ${viewShift.status === 'OPEN' ? 'text-green-500' : 'text-gray-500'}`}>{viewShift.status}</p></div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm pt-4 border-t dark:border-gray-700">
                          <div><p className="text-[10px] font-black text-gray-400 uppercase">Starting Cash</p><p className="font-mono dark:text-gray-200">{store?.currency}{viewShift.startingCash.toFixed(2)}</p></div>
                          <div><p className="text-[10px] font-black text-gray-400 uppercase">Actual Cash</p><p className="font-mono dark:text-gray-200">{viewShift.actualCash ? `${store?.currency}${viewShift.actualCash.toFixed(2)}` : '-'}</p></div>
                      </div>
                      {viewShift.status === 'CLOSED' && (
                          <div className={`p-4 rounded-xl border ${viewShift.difference && viewShift.difference < 0 ? 'bg-red-50 border-red-100 text-red-700' : 'bg-green-50 border-green-100 text-green-700'}`}>
                              <p className="text-[10px] font-black uppercase mb-1">Variance / Discrepancy</p>
                              <p className="text-xl font-black font-mono">{store?.currency}{viewShift.difference?.toFixed(2) || '0.00'}</p>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* Refund Modal */}
      {refundOrder && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 w-full max-md rounded-2xl shadow-2xl overflow-hidden border dark:border-gray-700">
                  <div className="p-4 border-b dark:border-gray-700 bg-orange-50 dark:bg-orange-900/10 text-orange-600 flex justify-between items-center">
                      <h3 className="font-bold flex items-center gap-2"><RotateCcw size={18}/> Process Refund</h3>
                      <button onClick={() => setRefundOrder(null)} className="p-1.5 hover:bg-orange-100 rounded-full"><X size={20}/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <p className="text-sm text-gray-500">Refunding Order <span className="font-bold text-gray-800 dark:text-white">#{refundOrder.orderNumber}</span> for <span className="font-black text-blue-600">{store?.currency}{refundOrder.total.toFixed(2)}</span>.</p>
                      <div className="flex gap-2 p-1 bg-gray-50 dark:bg-gray-900 rounded-lg">
                          <button onClick={() => {setRefundMode('FULL'); setRefundAmount(refundOrder.total.toFixed(2));}} className={`flex-1 py-2 text-xs font-bold rounded-md ${refundMode === 'FULL' ? 'bg-white dark:bg-gray-700 shadow text-blue-600' : 'text-gray-400'}`}>Full Refund</button>
                          <button onClick={() => setRefundMode('PARTIAL')} className={`flex-1 py-2 text-xs font-bold rounded-md ${refundMode === 'PARTIAL' ? 'bg-white dark:bg-gray-700 shadow text-blue-600' : 'text-gray-400'}`}>Partial</button>
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-gray-400">Refund Amount</label>
                          <input disabled={refundMode === 'FULL'} type="number" step="0.01" className="w-full p-3 border rounded-xl bg-gray-50 dark:bg-gray-900 dark:text-white dark:border-gray-700 font-bold" value={refundAmount} onChange={e => setRefundAmount(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-gray-400">Reason</label>
                          <textarea className="w-full p-3 border rounded-xl bg-gray-50 dark:bg-gray-900 dark:text-white dark:border-gray-700" placeholder="e.g. Item returned, Error in billing..." value={refundReason} onChange={e => setRefundReason(e.target.value)} rows={2} />
                      </div>
                      <button onClick={handleProcessRefund} className="w-full py-4 bg-orange-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-orange-700 shadow-lg shadow-orange-500/20 active:scale-[0.98] transition-all">Execute Refund</button>
                  </div>
              </div>
          </div>
      )}

      {/* Print Preview Modal */}
      {printModalOpen && previewOrder && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[250] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 w-full max-w-4xl h-[90vh] flex flex-col rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                  <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                      <div className="flex items-center gap-4">
                        <Printer size={24} className="text-blue-600"/>
                        <div>
                            <h2 className="text-xl font-black dark:text-white uppercase tracking-tighter leading-none">Ticket Preview: #{previewOrder.orderNumber}</h2>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Format: {previewPaperSize.toUpperCase()}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-1 rounded-xl border dark:border-gray-700 shadow-sm">
                          {(['thermal', 'a4', 'a5', 'letter'] as const).map((size) => (
                              <button
                                  key={size}
                                  onClick={() => setPreviewPaperSize(size)}
                                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${previewPaperSize === size ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                              >
                                  {size}
                              </button>
                          ))}
                      </div>

                      <button onClick={() => setPrintModalOpen(false)} className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"><X size={24}/></button>
                  </div>
                  <div className="flex-1 bg-gray-100 dark:bg-gray-950 p-8 flex justify-center overflow-auto custom-scrollbar">
                      <div className="bg-white shadow-2xl h-fit rounded p-1 border animate-in zoom-in-95 duration-300">
                          <iframe srcDoc={previewHtml} className="w-full h-[1000px] border-none transition-all duration-300" style={{width: getIframeWidth()}} title="Receipt Preview" />
                      </div>
                  </div>
                  <div className="p-6 border-t dark:border-gray-700 flex flex-wrap justify-end gap-3 bg-white dark:bg-gray-900">
                      <button onClick={() => setPrintModalOpen(false)} className="px-6 py-3 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-gray-800 dark:text-gray-400">Close</button>
                      <button onClick={handleSaveAsJpg} className="px-6 py-3 border-2 border-blue-600 text-blue-600 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-blue-50 transition-all">
                          <FileImage size={18}/> Save to Media
                      </button>
                      <button onClick={finalPrint} className="px-12 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-blue-500/30 hover:bg-blue-700 transition-all active:scale-95">
                          Execute Print
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
