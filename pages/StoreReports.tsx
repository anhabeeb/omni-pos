
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '../App';
import { db } from '../services/db';
import { Order, OrderStatus, Product, User, Category, RegisterShift, PrintSettings } from '../types';
// @ts-ignore - Fixing missing member errors in react-router-dom
import { useSearchParams } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
// Fix: Added FileText to the lucide-react imports
import { DollarSign, ShoppingBag, Percent, TrendingUp, Users, Clock, Package, CreditCard, User as UserIcon, Calendar, Printer, CalendarCheck, X, BarChart3, PieChart as PieIcon, Download, FileImage, List, FileBarChart, FileText } from 'lucide-react';
import { toJpeg } from 'html-to-image';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

type DetailType = 'SALES_TREND' | 'TOP_PRODUCTS' | 'CATEGORY_SALES' | 'PAYMENT_METHODS' | null;

export default function StoreReports() {
  const { user, currentStoreId } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentView = searchParams.get('view') || 'SUMMARY';
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [staff, setStaff] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [shifts, setShifts] = useState<RegisterShift[]>([]);
  const [store, setStore] = useState<any>(null); 
  
  const [dateRange, setDateRange] = useState('WEEK');
  const [customStart, setCustomStart] = useState(new Date().toISOString().split('T')[0]);
  const [customEnd, setCustomEnd] = useState(new Date().toISOString().split('T')[0]);

  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  
  const [activeDetail, setActiveDetail] = useState<DetailType>(null);

  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadData = async () => {
      if (currentStoreId) {
        const stores = await db.getStores();
        const s = stores.find(st => st.id === currentStoreId);
        setStore(s);
        
        const [o, p, u, c, sh] = await Promise.all([
          db.getOrders(currentStoreId),
          db.getProducts(currentStoreId),
          db.getUsers(),
          db.getCategories(currentStoreId),
          db.getRegisterShifts(currentStoreId)
        ]);
        
        setOrders(o);
        setProducts(p);
        setStaff(u);
        setCategories(c);
        setShifts(sh);
      }
    };
    loadData();
  }, [currentStoreId]);

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
            const endYesterday = new Date();
            endYesterday.setDate(endYesterday.getDate() - 1);
            endYesterday.setHours(23,59,59,999);
            end = endYesterday.getTime();
            break;
        case 'WEEK':
            const week = new Date();
            week.setDate(week.getDate() - 7);
            week.setHours(0,0,0,0);
            start = week.getTime();
            break;
        case 'MONTH':
            const month = new Date();
            month.setDate(month.getDate() - 30);
            month.setHours(0,0,0,0);
            start = month.getTime();
            break;
        case 'YEAR':
            const year = new Date();
            year.setFullYear(year.getFullYear() - 1);
            year.setHours(0,0,0,0);
            start = year.getTime();
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
      const { start, end } = getTimeRange();
      return orders.filter(o => 
          o.status === OrderStatus.COMPLETED && 
          o.createdAt >= start &&
          o.createdAt <= end
      );
  }, [orders, dateRange, customStart, customEnd]);

  const salesTrendData = useMemo(() => {
      const groups: Record<string, { sales: number; count: number }> = {};
      filteredOrders.forEach(o => {
          const date = new Date(o.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          if (!groups[date]) groups[date] = { sales: 0, count: 0 };
          groups[date].sales += o.total;
          groups[date].count += 1;
      });
      return Object.entries(groups).map(([name, data]) => ({ name, sales: data.sales, count: data.count }));
  }, [filteredOrders]);

  const allProductsSalesData = useMemo(() => {
      const prods: Record<string, { qty: number; revenue: number; category: string }> = {};
      filteredOrders.forEach(o => {
          o.items.forEach(item => {
              if (!prods[item.productName]) {
                  const productObj = products.find(p => p.id === item.productId);
                  const categoryName = categories.find(c => c.id === productObj?.categoryId)?.name || 'Other';
                  prods[item.productName] = { qty: 0, revenue: 0, category: categoryName };
              }
              prods[item.productName].qty += item.quantity;
              prods[item.productName].revenue += (item.price * item.quantity);
          });
      });
      return Object.entries(prods)
          .map(([name, data]) => ({ name, ...data }))
          .sort((a, b) => b.revenue - a.revenue);
  }, [filteredOrders, products, categories]);

  const topProductsData = useMemo(() => allProductsSalesData.slice(0, 10), [allProductsSalesData]);

  const categoryDistributionData = useMemo(() => {
      const cats: Record<string, number> = {};
      filteredOrders.forEach(o => {
          o.items.forEach(item => {
              const product = products.find(p => p.id === item.productId);
              const catName = categories.find(c => c.id === product?.categoryId)?.name || 'Other';
              cats[catName] = (cats[catName] || 0) + (item.price * item.quantity);
          });
      });
      const totalRevenue = Object.values(cats).reduce((a, b) => a + b, 0);
      return Object.entries(cats).map(([name, value]) => ({ 
          name, 
          value, 
          percentage: totalRevenue > 0 ? (value / totalRevenue * 100).toFixed(1) : '0' 
      }));
  }, [filteredOrders, products, categories]);

  const paymentMethodData = useMemo(() => {
      const methods: Record<string, { value: number; count: number }> = { CASH: { value: 0, count: 0 }, CARD: { value: 0, count: 0 }, TRANSFER: { value: 0, count: 0 } };
      filteredOrders.forEach(o => {
          if (o.paymentMethod) {
              methods[o.paymentMethod].value += o.total;
              methods[o.paymentMethod].count += 1;
          }
      });
      return Object.entries(methods).map(([name, data]) => ({ name: name, value: data.value, count: data.count }));
  }, [filteredOrders]);

  const summaryMetrics = useMemo(() => {
      const revenue = filteredOrders.reduce((sum, o) => sum + o.total, 0);
      const tax = filteredOrders.reduce((sum, o) => sum + o.tax, 0);
      const netSales = filteredOrders.reduce((sum, o) => sum + o.subtotal, 0); 
      const totalCost = filteredOrders.reduce((sum, o) => {
          return sum + o.items.reduce((acc, item) => {
              const product = products.find(p => p.id === item.productId);
              return acc + ((product?.cost || 0) * item.quantity);
          }, 0);
      }, 0);
      const profit = netSales - totalCost;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
      return { revenue, tax, netSales, totalCost, profit, margin };
  }, [filteredOrders, products]);

  const generateEODStats = () => {
      const { start, end } = getTimeRange();
      const dayOrders = orders.filter(o => 
          o.createdAt >= start && o.createdAt <= end
      );
      
      const completedOrders = dayOrders.filter(o => o.status === OrderStatus.COMPLETED);
      const returnedOrders = dayOrders.filter(o => o.status === OrderStatus.RETURNED);

      const totalGrossRevenue = completedOrders.reduce((sum, o) => sum + o.total, 0);
      const totalRefundsValue = returnedOrders.reduce((sum, o) => sum + o.total, 0);
      
      const totalTax = completedOrders.reduce((sum, o) => sum + o.tax, 0);
      const totalServiceCharge = completedOrders.reduce((sum, o) => sum + o.serviceCharge, 0);
      const totalNetSales = completedOrders.reduce((sum, o) => sum + o.subtotal, 0);

      const dayShifts = shifts.filter(s => s.closedAt && s.closedAt >= start && s.closedAt <= end);
      
      const payments: Record<string, number> = { CASH: 0, CARD: 0, TRANSFER: 0 };
      completedOrders.forEach(o => {
          if (o.paymentMethod) payments[o.paymentMethod] = (payments[o.paymentMethod] || 0) + o.total;
      });

      return {
          start: new Date(start), 
          end: new Date(end), 
          ordersCount: completedOrders.length, 
          totalGrossRevenue, 
          totalRefundsValue, 
          netSalesTotal: totalGrossRevenue - totalRefundsValue, 
          totalTax,
          totalServiceCharge,
          totalNetSales, 
          payments,
          shifts: { 
              count: dayShifts.length, 
              totalOpening: dayShifts.reduce((sum, s) => sum + s.startingCash, 0), 
              totalExpected: dayShifts.reduce((sum, s) => sum + (s.expectedCash || 0), 0), 
              totalActual: dayShifts.reduce((sum, s) => sum + (s.actualCash || 0), 0), 
              totalVariance: dayShifts.reduce((sum, s) => sum + (s.difference || 0), 0) 
          }
      };
  };

  const generateEODHtml = (stats: any, isAutoPrint = false) => {
      if (!store) return '';
      const settings: PrintSettings = store.eodSettings || { paperSize: 'thermal', fontSize: 'medium' };
      const paperSizeKey = settings.paperSize || 'thermal';
      const currency = store.currency || '$';
      let width = '300px';
      if (paperSizeKey === 'a4') width = '210mm';

      return `<!DOCTYPE html><html><head><meta charset="utf-8">
      <style>
        body { font-family: sans-serif; width: ${width}; margin: 0 auto; padding: 20px; line-height: 1.4; font-size: 12px; color: #000; } 
        .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 15px; } 
        .section-title { font-weight: bold; border-bottom: 1px solid #eee; margin: 15px 0 5px 0; font-size: 11px; text-transform: uppercase; color: #666; }
        .row { display: flex; justify-content: space-between; margin-bottom: 4px; } 
        .total { font-weight: bold; border-top: 1px solid #000; padding-top: 5px; margin-top: 5px; }
        .highlight { background: #f9f9f9; padding: 2px 4px; border-radius: 4px; }
      </style></head>
      <body ${isAutoPrint ? 'onload="window.print(); window.close();"' : ''}>
        <div class="header">
          <h2 style="margin:0;">${store.name}</h2>
          <div style="font-weight: bold; margin-top: 4px;">END OF DAY REPORT</div>
          <div>${stats.start.toLocaleDateString()}</div>
        </div>

        <div class="section-title">Revenue Breakdown</div>
        <div class="row"><span>Total Net Sales (Subtotal)</span><span>${currency}${stats.totalNetSales.toFixed(2)}</span></div>
        <div class="row"><span>Total GST (Tax)</span><span>${currency}${stats.totalTax.toFixed(2)}</span></div>
        <div class="row"><span>Total SC (Service Charge)</span><span>${currency}${stats.totalServiceCharge.toFixed(2)}</span></div>
        <div class="row total highlight"><span>GROSS REVENUE</span><span>${currency}${stats.totalGrossRevenue.toFixed(2)}</span></div>
        <div class="row" style="margin-top: 4px;"><span>Returned/Refunds</span><span>(${currency}${stats.totalRefundsValue.toFixed(2)})</span></div>
        <div class="row total"><span>TOTAL COLLECTED</span><span>${currency}${stats.netSalesTotal.toFixed(2)}</span></div>

        <div class="section-title">Payment Methods</div>
        ${Object.entries(stats.payments).map(([m, a]) => `<div class="row"><span>${m}</span><span>${currency}${(a as number).toFixed(2)}</span></div>`).join('')}

        <div class="section-title">Drawer Reconciliation</div>
        <div class="row"><span>Expected In Drawer</span><span>${currency}${stats.shifts.totalExpected.toFixed(2)}</span></div>
        <div class="row"><span>Actual Counted</span><span>${currency}${stats.shifts.totalActual.toFixed(2)}</span></div>
        <div class="row total"><span>Variance</span><span style="color: ${stats.shifts.totalVariance < 0 ? 'red' : 'green'}">${currency}${stats.shifts.totalVariance.toFixed(2)}</span></div>
        
        <div style="margin-top: 30px; text-align: center; font-size: 10px; color: #999; border-top: 1px dashed #ccc; padding-top: 10px;">
          Generated on ${new Date().toLocaleString()}
        </div>
      </body></html>`;
  };

  const handleOpenPrintPreview = () => {
      const stats = generateEODStats();
      const html = generateEODHtml(stats, false);
      setPreviewHtml(html);
      setPrintModalOpen(true);
  };

  const handleFinalPrint = () => {
    const stats = generateEODStats();
    const html = generateEODHtml(stats, true);
    const printWindow = window.open('', '_blank', 'width=600,height=800');
    if (printWindow) { printWindow.document.write(html); printWindow.document.close(); }
  };

  const handleSaveAsJpg = async () => {
    if (!exportRef.current || !store) return;
    try {
        const stats = generateEODStats();
        const rawHtml = generateEODHtml(stats, false);
        const settings = store.eodSettings || { paperSize: 'thermal' };
        
        let width = '320px';
        if (settings.paperSize === 'a4') width = '800px';

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
        link.download = `eod-report-${new Date().toISOString().split('T')[0]}.jpg`;
        link.href = dataUrl;
        link.click();
        exportRef.current.innerHTML = '';
    } catch (err) {
        console.error(err);
        alert("Failed to save image");
    }
  };

  const eodStats = useMemo(() => generateEODStats(), [orders, dateRange, customStart, customEnd, shifts]);

  const setView = (view: 'SUMMARY' | 'EOD') => {
      setSearchParams({ view });
  };

  const renderDetailModal = () => {
    if (!activeDetail) return null;

    let title = "";
    let content = null;

    switch (activeDetail) {
        case 'SALES_TREND':
            title = "Sales Trend Detail";
            content = (
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-700">
                        <tr>
                            <th className="p-3 text-[10px] font-black uppercase text-gray-500">Date</th>
                            <th className="p-3 text-[10px] font-black uppercase text-gray-500 text-right">Order Count</th>
                            <th className="p-3 text-[10px] font-black uppercase text-gray-500 text-right">Revenue</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-700">
                        {salesTrendData.map((d, i) => (
                            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                <td className="p-3 text-sm font-medium dark:text-gray-200">{d.name}</td>
                                <td className="p-3 text-sm text-right dark:text-gray-400 font-mono">{d.count}</td>
                                <td className="p-3 text-sm text-right font-black text-blue-600 dark:text-blue-400 font-mono">{store?.currency}{d.sales.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            );
            break;
        case 'TOP_PRODUCTS':
            title = "Product Performance List";
            content = (
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-700">
                        <tr>
                            <th className="p-3 text-[10px] font-black uppercase text-gray-500">Product Name</th>
                            <th className="p-3 text-[10px] font-black uppercase text-gray-500">Category</th>
                            <th className="p-3 text-[10px] font-black uppercase text-gray-500 text-right">Qty Sold</th>
                            <th className="p-3 text-[10px] font-black uppercase text-gray-500 text-right">Revenue</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-700">
                        {allProductsSalesData.map((d, i) => (
                            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                <td className="p-3 text-sm font-bold dark:text-gray-200">{d.name}</td>
                                <td className="p-3 text-xs text-gray-500 uppercase font-black">{d.category}</td>
                                <td className="p-3 text-sm text-right dark:text-gray-400 font-mono">{d.qty}</td>
                                <td className="p-3 text-sm text-right font-black text-green-600 dark:text-green-400 font-mono">{store?.currency}{d.revenue.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            );
            break;
        case 'CATEGORY_SALES':
            title = "Category Breakdown";
            content = (
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-700">
                        <tr>
                            <th className="p-3 text-[10px] font-black uppercase text-gray-500">Category</th>
                            <th className="p-3 text-[10px] font-black uppercase text-gray-500 text-right">Revenue</th>
                            <th className="p-3 text-[10px] font-black uppercase text-gray-500 text-right">% Contribution</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-700">
                        {categoryDistributionData.map((d, i) => (
                            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                <td className="p-3 text-sm font-bold dark:text-gray-200">{d.name}</td>
                                <td className="p-3 text-sm text-right dark:text-gray-400 font-black font-mono">{store?.currency}{d.value.toFixed(2)}</td>
                                <td className="p-3 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <div className="w-16 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div className="h-full bg-blue-600" style={{ width: `${d.percentage}%` }}></div>
                                        </div>
                                        <span className="text-xs font-mono font-black text-gray-500">{d.percentage}%</span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            );
            break;
        case 'PAYMENT_METHODS':
            title = "Payment Methods detail";
            content = (
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-700">
                        <tr>
                            <th className="p-3 text-[10px] font-black uppercase text-gray-500">Method</th>
                            <th className="p-3 text-[10px] font-black uppercase text-gray-500 text-right">Trans. Count</th>
                            <th className="p-3 text-[10px] font-black uppercase text-gray-500 text-right">Volume</th>
                            <th className="p-3 text-[10px] font-black uppercase text-gray-500 text-right">Avg. Trans.</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-700">
                        {paymentMethodData.map((d, i) => (
                            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                <td className="p-3 text-sm font-bold flex items-center gap-2 dark:text-gray-200">
                                    <div className={`w-2 h-2 rounded-full ${d.name === 'CASH' ? 'bg-blue-600' : d.name === 'CARD' ? 'bg-emerald-600' : 'bg-amber-600'}`}></div>
                                    {d.name}
                                </td>
                                <td className="p-3 text-sm text-right dark:text-gray-400 font-mono">{d.count}</td>
                                <td className="p-3 text-sm text-right font-black text-blue-600 dark:text-blue-400 font-mono">{store?.currency}{d.value.toFixed(2)}</td>
                                <td className="p-3 text-sm text-right font-mono text-gray-500">
                                    {store?.currency}{d.count > 0 ? (d.value / d.count).toFixed(2) : '0.00'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            );
            break;
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-700">
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                    <h3 className="font-black text-xs uppercase tracking-widest text-gray-700 dark:text-gray-300">{title}</h3>
                    <button onClick={() => setActiveDetail(null)} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {content}
                </div>
                <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-2 bg-gray-50 dark:bg-gray-900/50">
                    <button onClick={() => setActiveDetail(null)} className="px-6 py-2 bg-blue-600 text-white text-xs font-black uppercase tracking-widest rounded-lg shadow-lg shadow-blue-500/30 hover:bg-blue-700 active:scale-95 transition-all">Close</button>
                </div>
            </div>
        </div>
    );
  };

  return (
    <div className="space-y-6">
        <div ref={exportRef} style={{ position: 'fixed', left: '0', top: '0', zIndex: '-100', opacity: '1', pointerEvents: 'none', backgroundColor: 'white' }} />
        {renderDetailModal()}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Reports & Analytics</h1>
                <p className="text-gray-500 dark:text-gray-400">{store?.name} Overview</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex bg-white dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mr-2">
                    <button 
                        onClick={() => setView('SUMMARY')}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-tight transition-all ${currentView === 'SUMMARY' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                    >
                        <BarChart3 size={14}/> Summary
                    </button>
                    <button 
                        onClick={() => setView('EOD')}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-tight transition-all ${currentView === 'EOD' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                    >
                        <CalendarCheck size={14}/> EOD Report
                    </button>
                </div>

                <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <Calendar size={18} className="ml-1 text-gray-400" />
                    <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="bg-transparent text-xs font-black uppercase tracking-widest outline-none dark:text-white pr-2 cursor-pointer">
                        <option value="TODAY">Today</option>
                        <option value="YESTERDAY">Yesterday</option>
                        <option value="WEEK">Last 7 Days</option>
                        <option value="MONTH">Last 30 Days</option>
                        <option value="YEAR">Last Year</option>
                        <option value="ALL">All Time</option>
                        <option value="CUSTOM">Custom Range</option>
                    </select>
                </div>

                {dateRange === 'CUSTOM' && (
                    <div className="flex items-center gap-1 bg-white dark:bg-gray-700 p-1.5 rounded-xl border border-gray-200 dark:border-gray-600 shadow-sm">
                        <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="text-[10px] font-bold border-0 rounded p-1 bg-white dark:bg-gray-600 dark:text-white outline-none"/>
                        <span className="text-gray-400 text-xs">-</span>
                        <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="text-[10px] font-bold border-0 rounded p-1 bg-white dark:bg-gray-600 dark:text-white outline-none"/>
                    </div>
                )}
            </div>
        </div>

        {currentView === 'EOD' ? (
            <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-700 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10 pb-6 border-b dark:border-gray-700">
                    <div>
                        <h2 className="text-2xl font-black flex items-center gap-3 dark:text-white uppercase tracking-tighter">
                            <CalendarCheck size={28} className="text-blue-600"/> End of Day Analysis
                        </h2>
                        <p className="text-sm text-gray-400 font-bold mt-1 uppercase tracking-widest">
                            {dateRange === 'TODAY' ? 'Current operational day overview' : `Report for period ending ${new Date().toLocaleDateString()}`}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleSaveAsJpg} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-5 py-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-all font-black text-xs uppercase tracking-widest">
                            <FileImage size={18}/> Export Image
                        </button>
                        <button onClick={handleOpenPrintPreview} className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all font-black text-xs uppercase tracking-widest active:scale-[0.98]">
                            <Printer size={18}/> Print Report
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                    <div className="bg-blue-50/50 dark:bg-blue-900/10 p-5 rounded-[2rem] border border-blue-100 dark:border-blue-900/30 flex flex-col justify-between group hover:border-blue-500 transition-colors">
                        <div>
                            <div className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">Net Sales</div>
                            <div className="text-2xl font-black text-blue-900 dark:text-blue-100 tracking-tighter">{store?.currency}{eodStats.totalNetSales.toFixed(2)}</div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-blue-100 dark:border-blue-900/30 flex justify-between items-center text-[10px] font-black uppercase text-blue-500">
                            <span>Before Tax</span>
                            <DollarSign size={12}/>
                        </div>
                    </div>
                    <div className="bg-purple-50/50 dark:bg-purple-900/10 p-5 rounded-[2rem] border border-purple-100 dark:border-purple-900/30 flex flex-col justify-between group hover:border-purple-500 transition-colors">
                        <div>
                            <div className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-1">Tax Collected</div>
                            <div className="text-2xl font-black text-purple-900 dark:text-purple-100 tracking-tighter">{store?.currency}{eodStats.totalTax.toFixed(2)}</div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-purple-100 dark:border-purple-900/30 flex justify-between items-center text-[10px] font-black uppercase text-purple-500">
                            <span>GST 6%</span>
                            <Percent size={12}/>
                        </div>
                    </div>
                    <div className="bg-indigo-50/50 dark:bg-indigo-900/10 p-5 rounded-[2rem] border border-indigo-100 dark:border-indigo-900/30 flex flex-col justify-between group hover:border-indigo-500 transition-colors">
                        <div>
                            <div className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">Service Charge</div>
                            <div className="text-2xl font-black text-indigo-900 dark:text-indigo-100 tracking-tighter">{store?.currency}{eodStats.totalServiceCharge.toFixed(2)}</div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-indigo-100 dark:border-indigo-900/30 flex justify-between items-center text-[10px] font-black uppercase text-indigo-500">
                            <span>10% SC</span>
                            <Users size={12}/>
                        </div>
                    </div>
                    <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-5 rounded-[2rem] border border-emerald-100 dark:border-emerald-900/30 flex flex-col justify-between group hover:border-emerald-500 transition-colors">
                        <div>
                            <div className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Gross Revenue</div>
                            <div className="text-2xl font-black text-emerald-900 dark:text-emerald-100 tracking-tighter">{store?.currency}{eodStats.totalGrossRevenue.toFixed(2)}</div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-emerald-100 dark:border-emerald-900/30 flex justify-between items-center text-[10px] font-black uppercase text-emerald-500">
                            <span>Post-Tax</span>
                            <TrendingUp size={12}/>
                        </div>
                    </div>
                    <div className={`p-5 rounded-[2rem] border flex flex-col justify-between group transition-colors ${eodStats.shifts.totalVariance < 0 ? 'bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 hover:border-red-500' : 'bg-green-50/50 dark:bg-green-900/10 border-green-100 dark:border-green-900/30 hover:border-green-500'}`}>
                        <div>
                            <div className={`text-[10px] font-black uppercase tracking-widest mb-1 ${eodStats.shifts.totalVariance < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>Variance</div>
                            <div className={`text-2xl font-black tracking-tighter ${eodStats.shifts.totalVariance < 0 ? 'text-red-900 dark:text-red-100' : 'text-emerald-900 dark:text-emerald-100'}`}>
                                {store?.currency}{eodStats.shifts.totalVariance.toFixed(2)}
                            </div>
                        </div>
                        <div className={`mt-4 pt-4 border-t flex justify-between items-center text-[10px] font-black uppercase ${eodStats.shifts.totalVariance < 0 ? 'border-red-100 dark:border-red-900/30 text-red-500' : 'border-green-100 dark:border-green-900/30 text-green-500'}`}>
                            <span>Drawer Shift</span>
                            <CreditCard size={12}/>
                        </div>
                    </div>
                </div>

                <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className="space-y-6">
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-4">Payment Methods Volume</h3>
                        <div className="space-y-4">
                            {paymentMethodData.map((d, i) => (
                                <div key={i} className="flex items-center gap-4 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${d.name === 'CASH' ? 'bg-blue-100 text-blue-600' : d.name === 'CARD' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                        <CreditCard size={20}/>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-black text-xs uppercase dark:text-white">{d.name}</span>
                                            <span className="font-mono text-xs font-black dark:text-gray-400">{d.count} Trans.</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden mr-4">
                                                <div className="h-full bg-blue-600 rounded-full" style={{width: `${(d.value / eodStats.totalGrossRevenue * 100) || 0}%`}}></div>
                                            </div>
                                            <span className="font-black text-sm text-blue-600 tracking-tighter whitespace-nowrap">{store?.currency}{d.value.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900/30 p-8 rounded-[2.5rem] border border-dashed border-gray-200 dark:border-gray-700">
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-6">Drawer Reconciliation Stats</h3>
                        <div className="space-y-5">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-gray-500 uppercase tracking-tight">Active Shifts</span>
                                <span className="text-sm font-black dark:text-white">{eodStats.shifts.count}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-gray-500 uppercase tracking-tight">Opening Float</span>
                                <span className="text-sm font-black dark:text-white">{store?.currency}{eodStats.shifts.totalOpening.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-gray-500 uppercase tracking-tight">Expected Drawer</span>
                                <span className="text-sm font-black dark:text-white">{store?.currency}{eodStats.shifts.totalExpected.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-4 border-t dark:border-gray-700">
                                <span className="text-sm font-black text-blue-600 uppercase tracking-widest">Actual Counted</span>
                                <span className="text-xl font-black text-blue-600 tracking-tighter">{store?.currency}{eodStats.shifts.totalActual.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        ) : (
            <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 group hover:border-blue-500 transition-colors">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Gross Revenue</p>
                        <h3 className="text-2xl font-black dark:text-white mt-1 tracking-tighter">{store?.currency}{summaryMetrics.revenue.toFixed(2)}</h3>
                        <div className="mt-2 flex items-center gap-1 text-blue-500 font-bold text-[10px] uppercase">
                            <TrendingUp size={10}/> Post-Tax
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 group hover:border-emerald-500 transition-colors">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Estimated Profit</p>
                        <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 tracking-tighter">{store?.currency}{summaryMetrics.profit.toFixed(2)}</h3>
                        <div className="mt-2 flex items-center gap-1 text-emerald-500 font-bold text-[10px] uppercase">
                            <ShoppingBag size={10}/> Net Items
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 group hover:border-purple-500 transition-colors">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Avg. Margin</p>
                        <h3 className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1 tracking-tighter">{summaryMetrics.margin.toFixed(1)}%</h3>
                        <div className="mt-2 flex items-center gap-1 text-purple-500 font-bold text-[10px] uppercase">
                            <Percent size={10}/> Profit Ratio
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 group hover:border-orange-500 transition-colors">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sales Count</p>
                        <h3 className="text-2xl font-black text-orange-600 dark:text-orange-400 mt-1 tracking-tighter">{filteredOrders.length}</h3>
                        <div className="mt-2 flex items-center gap-1 text-orange-500 font-bold text-[10px] uppercase">
                            <FileText size={10}/> Completed
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] flex items-center gap-2"><TrendingUp size={16} className="text-blue-500"/> Sales Trend</h3>
                            <button onClick={() => setActiveDetail('SALES_TREND')} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-blue-600 transition-colors" title="View Details"><List size={16}/></button>
                        </div>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={salesTrendData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                    <XAxis dataKey="name" tick={{fontSize: 10, fontWeight: 700}} axisLine={false} tickLine={false} />
                                    <YAxis tick={{fontSize: 10, fontWeight: 700}} axisLine={false} tickLine={false} />
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontWeight: 700 }} />
                                    <Line type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={3} dot={{r: 4, fill: '#3b82f6'}} activeDot={{r: 6}} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] flex items-center gap-2"><Package size={16} className="text-emerald-500"/> Top Selling Products</h3>
                            <button onClick={() => setActiveDetail('TOP_PRODUCTS')} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-blue-600 transition-colors" title="View Details"><List size={16}/></button>
                        </div>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={topProductsData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10, fontWeight: 700}} axisLine={false} tickLine={false} />
                                    <Tooltip contentStyle={{borderRadius: '12px', fontWeight: 700}} />
                                    <Bar dataKey="qty" fill="#10b981" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] flex items-center gap-2"><PieIcon size={16} className="text-purple-500"/> Category Distribution</h3>
                            <button onClick={() => setActiveDetail('CATEGORY_SALES')} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-blue-600 transition-colors" title="View Details"><List size={16}/></button>
                        </div>
                        <div className="h-64 flex items-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={categoryDistributionData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                        {categoryDistributionData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => `${store?.currency}${value.toFixed(2)}`} contentStyle={{borderRadius: '12px', fontWeight: 700}} />
                                    <Legend iconType="circle" />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] flex items-center gap-2"><CreditCard size={16} className="text-amber-500"/> Payment Methods</h3>
                            <button onClick={() => setActiveDetail('PAYMENT_METHODS')} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-blue-600 transition-colors" title="View Details"><List size={16}/></button>
                        </div>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={paymentMethodData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                        {paymentMethodData.map((entry, index) => <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b'][index % 3]} />)}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => `${store?.currency}${value.toFixed(2)}`} contentStyle={{borderRadius: '12px', fontWeight: 700}} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </>
        )}

        {printModalOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
                <div className="bg-white dark:bg-gray-800 w-full max-w-2xl h-[90vh] flex flex-col rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-700">
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                        <h2 className="text-xl font-black dark:text-white uppercase tracking-tighter flex items-center gap-3">
                            <Printer size={24} className="text-blue-600"/> Report Print Preview
                        </h2>
                        <button onClick={() => setPrintModalOpen(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
                            <X size={24} className="text-gray-400" />
                        </button>
                    </div>
                    <div className="flex-1 bg-gray-100 dark:bg-gray-950 p-8 flex justify-center overflow-auto custom-scrollbar">
                        <div className="bg-white shadow-2xl h-fit rounded p-1 border">
                            <iframe srcDoc={previewHtml} className="w-[300px] md:w-[400px] h-[600px] border-none" title="Preview Frame" />
                        </div>
                    </div>
                    <div className="p-6 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3 bg-white dark:bg-gray-900">
                        <button onClick={() => setPrintModalOpen(false)} className="px-6 py-2 border border-gray-200 dark:border-gray-600 rounded-lg dark:text-gray-300 font-black text-[10px] uppercase tracking-widest">Cancel</button>
                        <button onClick={handleSaveAsJpg} className="px-5 py-2 border-2 border-blue-600 text-blue-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-50 flex items-center gap-2 transition-all">
                            <FileImage size={18}/> Save to Media
                        </button>
                        <button onClick={handleFinalPrint} className="px-10 py-2.5 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all active:scale-[0.98]">Execute Print</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}
