import React, { useEffect, useState, useMemo, useRef } from 'react';
// @ts-ignore - Fixing missing member errors in react-router-dom
import { useParams } from 'react-router-dom';
import { useAuth } from '../App';
import { db, uuid } from '../services/db';
import { Order, OrderType, OrderStatus, Store, UserRole, Transaction, RegisterShift, User, PrintSettings } from '../types';
import { 
  Calendar, Receipt, ChefHat, Filter, ArrowRight, DollarSign, Info, Printer, 
  RotateCcw, Undo2, Trash2, X, Search, Wallet, FileText, CheckCircle, 
  AlertTriangle, CreditCard, Lock, Unlock, PauseCircle, Download, FileImage,
  Layers, CreditCard as PaymentIcon, Hash, User as UserIcon
} from 'lucide-react';
import { toJpeg } from 'html-to-image';

export default function StoreHistory() {
  const { storeId: urlStoreId } = useParams<{ storeId: string }>();
  const { user, currentStoreId, switchStore, hasPermission } = useAuth();
  
  const activeStoreId = urlStoreId || currentStoreId;

  const [activeTab, setActiveTab] = useState<'SALES' | 'KOT' | 'REGISTER'>('SALES');
  
  const [dateRange, setDateRange] = useState('TODAY');
  const [customStart, setCustomStart] = useState(new Date().toISOString().split('T')[0]);
  const [customEnd, setCustomEnd] = useState(new Date().toISOString().split('T')[0]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOrderType, setFilterOrderType] = useState('ALL');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('ALL');

  const [shiftSearch, setShiftSearch] = useState('');
  const [shiftStatusFilter, setShiftStatusFilter] = useState('ALL');

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
  const [previewOrder, setPreviewOrder] = useState<Partial<Order> | null>(null);
  const [previewShift, setPreviewShift] = useState<RegisterShift | null>(null); 
  const [previewPaperSize, setPreviewPaperSize] = useState<'thermal'|'a4'|'a5'|'letter'>('thermal');

  const exportRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    if (activeStoreId) {
      const allOrders = await db.getOrders(activeStoreId);
      setOrders(allOrders.sort((a, b) => b.createdAt - a.createdAt));
      const allShifts = await db.getRegisterShifts(activeStoreId);
      setShifts(allShifts.sort((a,b) => b.openedAt - a.openedAt));
      const usersData = await db.getUsers();
      setUsers(usersData);
      const stores = await db.getStores();
      const s = stores.find(s => s.id === activeStoreId) || null;
      setStore(s);
    }
  };

  useEffect(() => {
    if (activeStoreId) {
        if (urlStoreId && urlStoreId !== currentStoreId) {
            switchStore(urlStoreId);
        }
        loadData();
        window.addEventListener(`db_change_store_${activeStoreId}_orders`, loadData);
        window.addEventListener(`db_change_store_${activeStoreId}_shifts`, loadData);
        return () => {
            window.removeEventListener(`db_change_store_${activeStoreId}_orders`, loadData);
            window.removeEventListener(`db_change_store_${activeStoreId}_shifts`, loadData);
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
        case 'LAST_90_DAYS':
            const last90 = new Date();
            last90.setDate(last90.getDate() - 90);
            last90.setHours(0,0,0,0);
            start = last90.getTime();
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
    result = result.filter(o => {
        const t = o.createdAt;
        return t >= start && t <= end;
    });
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        result = result.filter(o => 
            o.orderNumber.toString().includes(term) ||
            (o.customerName?.toLowerCase() || '').includes(term) ||
            (o.tableNumber?.toLowerCase() || '').includes(term)
        );
    }
    if (filterOrderType !== 'ALL') { result = result.filter(o => o.orderType === filterOrderType); }
    if (filterPaymentMethod !== 'ALL') { result = result.filter(o => o.paymentMethod === filterPaymentMethod); }
    return result;
  }, [orders, dateRange, customStart, customEnd, searchTerm, filterOrderType, filterPaymentMethod]);

  const filteredShifts = useMemo(() => {
      let result = shifts;
      const { start, end } = getTimeRange();
      result = result.filter(s => s.openedAt >= start && s.openedAt <= end);
      if (shiftStatusFilter !== 'ALL') { result = result.filter(s => s.status === shiftStatusFilter); }
      if (shiftSearch) {
          const term = shiftSearch.toLowerCase();
          result = result.filter(s => {
              const idMatch = (s.shiftNumber?.toString() || s.id).includes(term);
              const userMatch = getUserName(s.openedBy).toLowerCase().includes(term);
              return idMatch || userMatch;
          });
      }
      return result;
  }, [shifts, dateRange, customStart, customEnd, shiftStatusFilter, shiftSearch]);

  const getUserName = (id: string) => { return users.find(u => u.id === id)?.name || 'Unknown'; };

  const getPaidAmount = (order: Order) => {
      return order.transactions?.reduce((acc, t) => {
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
      if (amountToRefund > paidAmount) { alert(`Cannot refund more than the paid amount (${store?.currency || '$'}${paidAmount.toFixed(2)})`); return; }
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

  const handleDelete = async (orderId: string) => {
    if (!activeStoreId) return;
    if (confirm("Are you sure you want to permanently delete this order record?")) { 
        await db.deleteOrder(activeStoreId, orderId); 
        await loadData();
    }
  };

  const generateReceiptHtml = (order: Partial<Order>, paperSize: string, allUsers: User[], isAutoPrint = false) => {
    if (!store) return '';
    const settings: PrintSettings = store.printSettings || { paperSize: 'thermal', fontSize: 'medium' };
    const currency = settings.currencySymbol || store.currency || '$';
    const paperSizeKey = paperSize || settings.paperSize || 'thermal';
    
    let width = '300px';
    let pageSize = '80mm auto';
    if (paperSizeKey === 'a4') { width = '210mm'; pageSize = 'A4'; }
    if (paperSizeKey === 'a5') { width = '148mm'; pageSize = 'A5'; }
    if (paperSizeKey === 'letter') { width = '8.5in'; pageSize = 'letter'; }

    const itemsHtml = settings.showItems !== false ? order.items?.map(item => {
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
                ${settings.showDate !== false ? `<div><strong>DATE:</strong> ${new Date(order.createdAt || Date.now()).toLocaleDateString()}</div>` : ''}
            </div>
            <div style="text-align: right;">
                ${settings.showCashierName ? `<div><strong>BY:</strong> ${allUsers.find(u => u.id === order.createdBy)?.name || 'Staff'}</div>` : ''}
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

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            @media print { body { margin: 0; padding: 20px; } @page { size: ${pageSize}; margin: 0; } }
            body { 
                font-family: ${paperSizeKey === 'thermal' ? 'monospace' : 'sans-serif'}; 
                width: ${width}; 
                margin: 0 auto; 
                padding: 20px; 
                font-size: ${settings.fontSize === 'small' ? '10px' : settings.fontSize === 'large' ? '14px' : '12px'}; 
                color: #000; 
                background: #fff; 
                line-height: 1.4; 
                box-sizing: border-box;
            }
            .header { text-align: ${headerAlignment}; border-bottom: 1px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
            .row { display: flex; justify-content: space-between; margin: 3px 0; }
            table { width: 100%; border-collapse: collapse; }
            .total { border-top: 1px solid #000; font-weight: bold; font-size: 1.3em; padding-top: 5px; margin-top: 5px; }
            .note-box { margin-top: 15px; padding: 8px; border: 1px dashed #666; font-size: 0.9em; font-style: italic; }
            .footer { text-align: ${footerAlignment}; margin-top: 30px; border-top: 1px dashed #ccc; padding-top: 10px; font-style: italic; }
          </style>
        </head>
        <body ${isAutoPrint ? 'onload="window.print(); window.close();"' : ''}>
          <div class="header">
            ${logoBlock}
            ${storeDetailsBlock}
            ${taxIdBlock}
            ${settings.headerText ? `<div style="font-weight: bold; margin-top: 10px; text-transform: uppercase;">${settings.headerText}</div>` : ''}
          </div>
          ${infoGridBlock}
          ${customerBlock}
          <table style="margin-top: 10px;">
            <thead>
                <tr style="border-bottom: 1px solid #000;">
                    <th align="left" style="font-size: 10px;">DESCRIPTION</th>
                    ${settings.showAmount !== false ? '<th align="right" style="font-size: 10px;">AMOUNT</th>' : ''}
                </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          <div style="margin-top:15px;">
            ${settings.showSubtotal !== false ? `<div class="row"><span>Subtotal:</span><span>${currency}${order.subtotal?.toFixed(2)}</span></div>` : ''}
            ${(settings.showServiceCharge !== false && order.serviceCharge && order.serviceCharge > 0) ? `<div class="row"><span>Service Charge (${store.serviceChargeRate}%):</span><span>${currency}${order.serviceCharge.toFixed(2)}</span></div>` : ''}
            ${(settings.showTax !== false && order.tax && order.tax > 0) ? `<div class="row"><span>Tax (${store.taxRate}%):</span><span>${currency}${order.tax.toFixed(2)}</span></div>` : ''}
            ${settings.showTotal !== false ? `<div class="row total"><span>TOTAL:</span><span>${currency}${order.total?.toFixed(2)}</span></div>` : ''}
          </div>
          ${order.note ? `<div class="note-box"><strong>Note:</strong> ${order.note}</div>` : ''}
          <div class="footer">${settings.footerText || 'Thank you for your visit!'}</div>
        </body>
      </html>
    `;
  };

  const generateShiftReportHtml = (shift: RegisterShift, paperSize: string, isAutoPrint = false) => {
      if (!store) return '';
      const currency = store.currency || '$';
      const stats = getShiftReportData(shift);
      const paperSizeKey = paperSize || 'thermal';
      
      let width = '300px';
      let pageSize = '80mm auto';
      if (paperSizeKey === 'a4') { width = '210mm'; pageSize = 'A4'; }
      if (paperSizeKey === 'a5') { width = '148mm'; pageSize = 'A5'; }
      if (paperSizeKey === 'letter') { width = '8.5in'; pageSize = 'letter'; }

      return `
        <!DOCTYPE html>
        <html>
          <head><meta charset="utf-8"></head>
          <body style="font-family:${paperSizeKey === 'thermal' ? 'monospace' : 'sans-serif'}; width:${width}; margin: 0 auto; padding: 20px; color: #000; background: #fff; font-size: 12px; line-height: 1.4; box-sizing: border-box;" ${isAutoPrint ? 'onload="window.print(); window.close();"' : ''}>
            <div style="text-align:center; border-bottom:2px solid #000; margin-bottom:15px; padding-bottom: 10px;">
                <h2 style="margin:0;">${store.name}</h2>
                <div style="font-weight: bold; margin-top: 5px;">SHIFT REPORT: #${shift.shiftNumber}</div>
                <div>User: ${getUserName(shift.openedBy)}</div>
            </div>
            <div style="margin-bottom:10px;">
                <div style="display:flex; justify-content:space-between;"><span>Open:</span><span>${new Date(shift.openedAt).toLocaleString()}</span></div>
                ${shift.closedAt ? `<div style="display:flex; justify-content:space-between;"><span>Close:</span><span>${new Date(shift.closedAt).toLocaleString()}</span></div>` : ''}
            </div>
            <div style="font-weight:bold; border-bottom:1px solid #000; margin:10px 0; font-size: 11px; text-transform: uppercase;">SALES DATA</div>
            <div style="display:flex; justify-content:space-between;"><span>Net Sales:</span><span>${currency}${stats.netSales.toFixed(2)}</span></div>
            <div style="display:flex; justify-content:space-between;"><span>Cash Sales:</span><span>${currency}${stats.paymentBreakdown.CASH.toFixed(2)}</span></div>
            <div style="display:flex; justify-content:space-between;"><span>Card Sales:</span><span>${currency}${stats.paymentBreakdown.CARD.toFixed(2)}</span></div>
            
            <div style="font-weight:bold; border-bottom:1px solid #000; margin:10px 0; font-size: 11px; text-transform: uppercase;">CASH DRAWER</div>
            <div style="display:flex; justify-content:space-between;"><span>Starting:</span><span>${currency}${shift.startingCash.toFixed(2)}</span></div>
            <div style="display:flex; justify-content:space-between;"><span>Expected:</span><span>${currency}${shift.expectedCash?.toFixed(2) || '0.00'}</span></div>
            <div style="display:flex; justify-content:space-between;"><span>Actual:</span><span>${currency}${shift.actualCash?.toFixed(2) || '0.00'}</span></div>
            <div style="display:flex; justify-content:space-between; font-weight:bold; border-top: 1px solid #000; margin-top: 5px; padding-top: 5px;"><span>Variance:</span><span>${currency}${shift.difference?.toFixed(2) || '0.00'}</span></div>
            
            <div style="font-weight:bold; border-bottom:1px solid #000; margin:10px 0; font-size: 11px; text-transform: uppercase;">PENDING ORDERS</div>
            <div style="display:flex; justify-content:space-between;"><span>Held at Close:</span><span>${stats.heldOrdersCount || 0}</span></div>
          </body>
        </html>
      `;
  };

  const getShiftReportData = (shift: RegisterShift) => {
      // Prioritize stored data if available
      if (shift.status === 'CLOSED' && shift.heldOrdersCount !== undefined) {
          const shiftOrders = orders.filter(o => o.shiftId === shift.id);
          let totalSales = 0;
          let refunds = 0;
          const pb = { CASH: 0, CARD: 0, TRANSFER: 0 };
          
          shiftOrders.forEach(o => {
              o.transactions?.forEach(t => {
                  if (t.type === 'PAYMENT') {
                      totalSales += t.amount;
                      if (t.method === 'CASH') pb.CASH += t.amount;
                      else if (t.method === 'CARD') pb.CARD += t.amount;
                      else if (t.method === 'TRANSFER') pb.TRANSFER += t.amount;
                  } else if (t.type === 'REVERSAL') { refunds += t.amount; }
              });
          });
          
          return { 
              totalSales, 
              refunds, 
              netSales: totalSales - refunds, 
              paymentBreakdown: pb, 
              heldOrdersCount: shift.heldOrdersCount, 
              heldOrdersTotal: 0 
          };
      }

      const shiftOrders = orders.filter(o => o.shiftId === shift.id);
      const paymentBreakdown = { CASH: 0, CARD: 0, TRANSFER: 0 };
      let totalSales = 0;
      let refunds = 0;
      shiftOrders.forEach(o => {
          o.transactions?.forEach(t => {
              if (t.type === 'PAYMENT') {
                  totalSales += t.amount;
                  if (t.method === 'CASH') paymentBreakdown.CASH += t.amount;
                  else if (t.method === 'CARD') paymentBreakdown.CARD += t.amount;
                  else if (t.method === 'TRANSFER') paymentBreakdown.TRANSFER += t.amount;
              } else if (t.type === 'REVERSAL') { refunds += t.amount; }
          });
      });
      const heldOrders = shiftOrders.filter(o => o.status === OrderStatus.ON_HOLD);
      return { 
          totalSales, 
          refunds, 
          netSales: totalSales - refunds, 
          paymentBreakdown, 
          heldOrdersCount: heldOrders.length, 
          heldOrdersTotal: heldOrders.reduce((sum, o) => sum + o.total, 0) 
      };
  };

  const handleFinalPrint = () => {
    let html = '';
    if (previewOrder) { html = generateReceiptHtml(previewOrder as Order, previewPaperSize, users, true); } 
    else if (previewShift) { html = generateShiftReportHtml(previewShift, previewPaperSize, true); }
    if (html) {
        const printWindow = window.open('', '_blank', 'width=600,height=800');
        if (printWindow) { printWindow.document.write(html); printWindow.document.close(); } 
        else { alert("Pop-up blocked. Please allow pop-ups to print."); }
    }
  };

  const handleSaveAsJpg = async () => {
      if (!exportRef.current || !store) return;
      const fileName = previewOrder ? `order-${previewOrder.orderNumber}.jpg` : `shift-${previewShift?.shiftNumber}.jpg`;
      try {
          const rawHtml = previewOrder ? generateReceiptHtml(previewOrder as Order, previewPaperSize, users, false) : generateShiftReportHtml(previewShift!, previewPaperSize, false);
          
          let width = '320px';
          if (previewPaperSize === 'a4' || previewPaperSize === 'letter') width = '800px';
          else if (previewPaperSize === 'a5') width = '500px';

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
          link.download = fileName;
          link.href = dataUrl;
          link.click();
          exportRef.current.innerHTML = '';
      } catch (err) {
          console.error(err);
          alert("Failed to save image");
      }
  };

  const previewHtml = useMemo(() => {
    if (previewOrder) return generateReceiptHtml(previewOrder as Order, previewPaperSize, users, false);
    if (previewShift) return generateShiftReportHtml(previewShift, previewPaperSize, false);
    return '';
  }, [previewOrder, previewShift, previewPaperSize, store, users]);

  const getIframeWidth = () => {
      switch(previewPaperSize) {
          case 'a4': return '550px';
          case 'a5': return '400px';
          case 'letter': return '550px';
          default: return '300px'; 
      }
  };

  const openPrintModal = (orderData: Partial<Order>) => {
      setPreviewOrder(orderData);
      setPreviewShift(null);
      setPreviewPaperSize(store?.printSettings?.paperSize || 'thermal');
      setPrintModalOpen(true);
  };

  const openShiftPrintModal = (shift: RegisterShift) => {
      setPreviewShift(shift);
      setPreviewOrder(null);
      setPreviewPaperSize(store?.printSettings?.paperSize || 'thermal');
      setPrintModalOpen(true);
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div ref={exportRef} style={{ position: 'fixed', left: '0', top: '0', zIndex: '-100', opacity: '1', pointerEvents: 'none', backgroundColor: 'white' }} />
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">History & Logs</h1>
            <p className="text-gray-500 text-sm">Review store transactions and register sessions.</p>
          </div>
          
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <select 
                value={dateRange} 
                onChange={(e) => setDateRange(e.target.value)} 
                className="pl-3 pr-8 py-2 border-0 bg-transparent text-sm font-bold text-gray-700 dark:text-gray-200 outline-none focus:ring-0"
            >
                <option value="TODAY">Today</option>
                <option value="YESTERDAY">Yesterday</option>
                <option value="LAST_7_DAYS">Last 7 Days</option>
                <option value="LAST_30_DAYS">Last 30 Days</option>
                <option value="LAST_90_DAYS">Last 90 Days</option>
                <option value="ALL">All Time</option>
                <option value="CUSTOM">Custom Range</option>
            </select>
            
            {dateRange === 'CUSTOM' && (
                <div className="flex items-center gap-2 ml-2 px-2 border-l border-gray-200 dark:border-gray-700">
                    <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="text-xs border-0 bg-transparent dark:text-white outline-none"/>
                    <span className="text-gray-400">to</span>
                    <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="text-xs border-0 bg-transparent dark:text-white outline-none"/>
                </div>
            )}
          </div>
      </div>
      
      <div className="flex gap-4 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          <button onClick={() => setActiveTab('SALES')} className={`px-4 py-3 font-black uppercase text-[10px] tracking-widest border-b-2 transition-colors ${activeTab === 'SALES' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>Sales History</button>
          <button onClick={() => setActiveTab('REGISTER')} className={`px-4 py-3 font-black uppercase text-[10px] tracking-widest border-b-2 transition-colors ${activeTab === 'REGISTER' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>Register Logs</button>
      </div>

      <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
        {activeTab === 'SALES' && (
            <>
                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 flex flex-wrap gap-4 items-center">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Order # or Customer..." 
                            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500 dark:text-white"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                            <Layers size={14} className="text-gray-400" />
                            <select 
                                value={filterOrderType} 
                                onChange={e => setFilterOrderType(e.target.value)}
                                className="border-0 bg-transparent text-xs font-bold text-gray-600 dark:text-gray-300 focus:ring-0 outline-none"
                            >
                                <option value="ALL">All Types</option>
                                <option value={OrderType.DINE_IN}>Dine-In</option>
                                <option value={OrderType.TAKEAWAY}>Takeaway</option>
                                <option value={OrderType.DELIVERY}>Delivery</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                            <PaymentIcon size={14} className="text-gray-400" />
                            <select 
                                value={filterPaymentMethod} 
                                onChange={e => setFilterPaymentMethod(e.target.value)}
                                className="border-0 bg-transparent text-xs font-bold text-gray-600 dark:text-gray-300 focus:ring-0 outline-none"
                            >
                                <option value="ALL">All Payments</option>
                                <option value="CASH">Cash</option>
                                <option value="CARD">Card</option>
                                <option value="TRANSFER">Transfer</option>
                            </select>
                        </div>
                        
                        <div className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-tighter ml-2">
                            {filteredOrders.length} Results
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-left min-w-[900px]">
                        <thead className="bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-[10px] font-black uppercase tracking-wider sticky top-0 border-b border-gray-100 dark:border-gray-700 z-10">
                            <tr><th className="p-4">Time</th><th className="p-4">Order #</th><th className="p-4">Customer</th><th className="p-4">Type</th><th className="p-4">Total</th><th className="p-4">Status</th><th className="p-4 text-right">Actions</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                            {filteredOrders.length === 0 ? (
                                <tr><td colSpan={7} className="p-10 text-center text-gray-400 italic">No sales records found for this criteria.</td></tr>
                            ) : (
                                filteredOrders.map(order => (
                                    <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                                        <td className="p-4 text-sm dark:text-gray-300">{new Date(order.createdAt).toLocaleString()}</td>
                                        <td className="p-4 font-mono font-bold text-sm text-blue-600">#{order.orderNumber}</td>
                                        <td className="p-4 text-sm dark:text-white truncate max-w-[150px]">{order.customerName || `Table ${order.tableNumber || '-'}`}</td>
                                        <td className="p-4 text-[10px] font-black text-gray-500 uppercase">{order.orderType}</td>
                                        <td className="p-4 font-bold dark:text-white">{store?.currency}{order.total.toFixed(2)}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${order.status === OrderStatus.COMPLETED ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                                {order.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-1">
                                                <button onClick={() => setViewOrder(order)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-white dark:hover:bg-gray-700 rounded transition-all" title="View"><Info size={18}/></button>
                                                <button onClick={() => openPrintModal(order)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-white dark:hover:bg-gray-700 rounded transition-all" title="Print"><Printer size={18}/></button>
                                                <button onClick={() => handleDelete(order.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-white dark:hover:bg-gray-700 rounded transition-all" title="Delete"><Trash2 size={18}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </>
        )}

        {activeTab === 'REGISTER' && (
            <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left min-w-[800px]">
                    <thead className="bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-[10px] font-black uppercase tracking-wider sticky top-0 border-b border-gray-100 dark:border-gray-700">
                        <tr><th className="p-4">Status</th><th className="p-4">Shift ID</th><th className="p-4">Opened</th><th className="p-4 text-right">Expected</th><th className="p-4 text-right">Actual</th><th className="p-4 text-right">Held Count</th><th className="p-4 text-right">Actions</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {filteredShifts.length === 0 ? (
                            <tr><td colSpan={7} className="p-10 text-center text-gray-400 italic">No register logs found.</td></tr>
                        ) : (
                            filteredShifts.map(shift => (
                                <tr key={shift.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                                    <td className="p-4"><span className={`px-2 py-1 text-[10px] font-black uppercase rounded-full ${shift.status === 'OPEN' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{shift.status}</span></td>
                                    <td className="p-4 font-mono font-bold text-sm text-blue-600">#{shift.shiftNumber}</td>
                                    <td className="p-4 text-sm dark:text-gray-300">{new Date(shift.openedAt).toLocaleString()}</td>
                                    <td className="p-4 text-right dark:text-gray-400">{store?.currency}{shift.expectedCash?.toFixed(2) || '0.00'}</td>
                                    <td className="p-4 text-right font-bold dark:text-white">{store?.currency}{shift.actualCash?.toFixed(2) || '0.00'}</td>
                                    <td className="p-4 text-right">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${shift.heldOrdersCount ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-50 text-gray-400'}`}>
                                            {shift.heldOrdersCount || 0} Held
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        {shift.status === 'CLOSED' && <button onClick={() => openShiftPrintModal(shift)} className="p-2 text-blue-600 hover:bg-white dark:hover:bg-gray-700 rounded transition-all" title="Print Report"><Printer size={18}/></button>}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        )}
      </div>

      {printModalOpen && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
              <div className="bg-white dark:bg-gray-800 w-full max-w-4xl h-[90vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                  <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-gray-900/30">
                    <h3 className="font-bold dark:text-white flex items-center gap-2"><Printer size={18} className="text-blue-600" /> Document Preview</h3>
                    <button onClick={() => setPrintModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"><X size={24}/></button>
                  </div>
                  <div className="flex-1 bg-gray-100 dark:bg-gray-900 p-8 flex justify-center overflow-auto">
                      <div className="bg-white shadow-lg h-fit rounded" style={{width: getIframeWidth()}}>
                          <iframe 
                            srcDoc={previewHtml} 
                            className="w-full h-[600px] border-none" 
                            title="Preview Frame" 
                          />
                      </div>
                  </div>
                  <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3 bg-white dark:bg-gray-900/30">
                      <button onClick={() => setPrintModalOpen(false)} className="px-6 py-2 border border-gray-200 dark:border-gray-600 rounded-lg dark:text-gray-300 font-bold hover:bg-gray-50">Close</button>
                      <button onClick={handleSaveAsJpg} className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg font-bold hover:bg-blue-50 flex items-center gap-2"><FileImage size={18}/> Save as Image</button>
                      <button onClick={handleFinalPrint} className="px-8 py-2 bg-blue-600 text-white rounded-lg font-bold shadow-lg hover:bg-blue-700">Print Now</button>
                  </div>
              </div>
          </div>
      )}

      {viewOrder && (
          <div className="fixed inset-0 bg-black/60 z-[250] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4">
                  <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                      <h3 className="font-bold dark:text-white flex items-center gap-2"><Receipt size={18} className="text-blue-600" /> Order Details: #{viewOrder.orderNumber}</h3>
                      <button onClick={() => setViewOrder(null)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"><X size={20}/></button>
                  </div>
                  <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                      <div className="grid grid-cols-2 gap-4">
                          <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border dark:border-gray-700">
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Customer</p>
                              <p className="text-sm font-bold dark:text-white">{viewOrder.customerName || 'Walk-in'}</p>
                          </div>
                          <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border dark:border-gray-700">
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Order Type</p>
                              <p className="text-sm font-bold dark:text-white">{viewOrder.orderType}</p>
                          </div>
                      </div>

                      <div className="space-y-2">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 border-b dark:border-gray-700 pb-1">Items Sold</p>
                          {viewOrder.items.map((it, idx) => (
                              <div key={idx} className="flex justify-between items-center text-sm">
                                  <div className="flex gap-2">
                                      <span className="font-bold text-blue-600">{it.quantity}x</span>
                                      <span className="dark:text-gray-300">{it.productName}</span>
                                  </div>
                                  <span className="font-mono dark:text-white">{store?.currency}{(it.price * it.quantity).toFixed(2)}</span>
                              </div>
                          ))}
                      </div>

                      <div className="border-t dark:border-gray-700 pt-4 space-y-2">
                          <div className="flex justify-between text-sm text-gray-500"><span>Subtotal</span><span>{store?.currency}{viewOrder.subtotal.toFixed(2)}</span></div>
                          <div className="flex justify-between text-sm text-gray-500"><span>Tax</span><span>{store?.currency}{viewOrder.tax.toFixed(2)}</span></div>
                          <div className="flex justify-between font-black text-lg pt-2 border-t dark:border-gray-700 dark:text-white"><span>Total Paid</span><span>{store?.currency}{viewOrder.total.toFixed(2)}</span></div>
                      </div>
                      
                      {viewOrder.note && (
                          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-900/40 rounded-xl text-xs text-yellow-800 dark:text-yellow-200">
                              <strong>Note:</strong> {viewOrder.note}
                          </div>
                      )}
                  </div>
                  <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 flex justify-end gap-2">
                      <button onClick={() => setViewOrder(null)} className="px-6 py-2 bg-gray-800 text-white rounded-xl font-bold">Done</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}