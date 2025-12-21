
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../App';
import { db } from '../services/db';
import { Quotation, Product, Customer, Store, OrderItem, PrintSettings, User } from '../types';
import { Plus, Trash2, Printer, Search, FileText, UserSquare, Calendar, Eye, X, ArrowLeft, ShoppingBag, Download, FileImage } from 'lucide-react';
import { toJpeg } from 'html-to-image';

export default function Quotations() {
  const { storeId: urlStoreId } = useParams<{ storeId: string }>();
  const { user, currentStoreId, switchStore } = useAuth();
  
  const activeStoreId = urlStoreId || currentStoreId;

  const [activeTab, setActiveTab] = useState<'LIST' | 'NEW'>('LIST');
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [store, setStore] = useState<Store | null>(null);
  const [users, setUsers] = useState<User[]>([]);

  const [cart, setCart] = useState<OrderItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [productSearch, setProductSearch] = useState('');

  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [previewQuote, setPreviewQuote] = useState<Quotation | null>(null);

  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeStoreId) {
      if (urlStoreId && urlStoreId !== currentStoreId) {
          switchStore(urlStoreId);
      }
      loadData();
      window.addEventListener(`db_change_store_${activeStoreId}_quotations`, loadQuotations);
      window.addEventListener(`db_change_global_stores`, loadStoreData);
      return () => {
          window.removeEventListener(`db_change_store_${activeStoreId}_quotations`, loadQuotations);
          window.removeEventListener(`db_change_global_stores`, loadStoreData);
      };
    }
  }, [activeStoreId, urlStoreId, currentStoreId]);

  // Fixed: Made loadData async and awaited DB calls
  const loadData = async () => {
      await loadStoreData();
      if (!activeStoreId) return;
      setProducts(await db.getProducts(activeStoreId));
      setCustomers(await db.getCustomers(activeStoreId));
      setUsers(await db.getUsers());
      await loadQuotations();
  };

  // Fixed: Made loadStoreData async and awaited db.getStores
  const loadStoreData = async () => {
      if (!activeStoreId) return;
      const stores = await db.getStores();
      const s = stores.find(st => st.id === activeStoreId);
      setStore(s || null);
  };

  // Fixed: Made loadQuotations async and awaited db.getQuotations
  const loadQuotations = async () => {
      if (!activeStoreId) return;
      const data = await db.getQuotations(activeStoreId);
      setQuotations(data.sort((a,b) => b.createdAt - a.createdAt));
  };

  const formatAddress = (c: Customer) => {
    if (c.type === 'INDIVIDUAL') {
        return [c.houseName, c.streetName, c.address].filter(Boolean).join(', ');
    } else {
        return [c.buildingName, c.street, c.island, c.country, c.address].filter(Boolean).join(', ');
    }
  };

  const addToCart = (product: Product) => {
      setCart(prev => {
          const existing = prev.find(item => item.productId === product.id);
          if (existing) { return prev.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item); }
          return [...prev, { productId: product.id, productName: product.name, price: product.price, quantity: 1 }];
      });
  };

  const updateQuantity = (productId: string, delta: number) => {
      setCart(prev => prev.map(item => {
          if (item.productId === productId) { return { ...item, quantity: Math.max(1, item.quantity + delta) }; }
          return item;
      }));
  };

  const removeFromCart = (productId: string) => {
      setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const totals = useMemo(() => {
      const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const taxRate = store?.taxRate || 0;
      const serviceChargeRate = store?.serviceChargeRate || 0;
      
      const serviceCharge = (subtotal * serviceChargeRate) / 100;
      const tax = ((subtotal + serviceCharge) * taxRate) / 100;
      
      return { subtotal, serviceCharge, tax, total: subtotal + serviceCharge + tax };
  }, [cart, store]);

  const handleSaveQuotation = () => {
      if (!activeStoreId || !user) return;
      if (cart.length === 0 || !selectedCustomer) return;
      try {
          const customerName = selectedCustomer.type === 'COMPANY' && selectedCustomer.companyName 
              ? `${selectedCustomer.companyName} (${selectedCustomer.name})` 
              : selectedCustomer.name;
          db.addQuotation(activeStoreId, { 
              customerName, 
              customerPhone: selectedCustomer.phone, 
              customerTin: selectedCustomer.tin, 
              customerAddress: formatAddress(selectedCustomer),
              items: cart, subtotal: totals.subtotal, tax: totals.tax, total: totals.total, createdBy: user.id 
          });
          alert("Quotation Created Successfully!");
          setCart([]); setSelectedCustomer(null); setActiveTab('LIST');
      } catch (err) {
          console.error(err);
          alert("Failed to save quotation.");
      }
  };

  // Fixed: Added allUsers parameter to handle user lookup synchronously
  const generateQuotationHtml = (quote: Quotation, allUsers: User[], isAutoPrint = false) => {
      if (!store) return '';
      const settings: PrintSettings = store.quotationSettings || { 
          paperSize: 'a4', 
          fontSize: 'medium', 
          showLogo: true, 
          showStoreDetails: true,
          showItems: true,
          showQuantity: true,
          showUnitPrice: true,
          showAmount: true,
          showSubtotal: true,
          showServiceCharge: true,
          showTax: true,
          showTotal: true,
          showCustomerDetails: true
      };
      
      const currency = settings.currencySymbol || store.currency || '$';
      const paperSizeKey = settings.paperSize || 'a4';
      
      let width = '210mm';
      let pageSize = 'A4';
      if (paperSizeKey === 'a5') { width = '148mm'; pageSize = 'A5'; }
      if (paperSizeKey === 'letter') { width = '8.5in'; pageSize = 'letter'; }
      if (paperSizeKey === 'thermal') { width = '80mm'; pageSize = '80mm auto'; }

      const headerAlignment = settings.headerAlignment || 'left';
      const footerAlignment = settings.footerAlignment || 'center';
      const logoAlignment = settings.logoPosition || 'center';

      const logoBlock = (settings.showLogo && settings.logoUrl) ? `
          <div style="text-align: ${logoAlignment}; margin-bottom: 20px;">
              <img src="${settings.logoUrl}" style="max-width: 150px; max-height: 80px;" />
          </div>
      ` : '';

      const storeDetailsBlock = settings.showStoreDetails !== false ? `
          <div style="margin-bottom: 10px;">
              <h2 style="margin: 0; font-size: 24px;">${store.name}</h2>
              <div style="color: #666;">${store.address}</div>
              ${store.phone ? `<div>Tel: ${store.phone}</div>` : ''}
              ${store.tin ? `<div>TIN: ${store.tin}</div>` : ''}
          </div>
      ` : '';

      const customerBlock = (settings.showCustomerDetails && (quote.customerName || quote.customerPhone || quote.customerTin)) ? `
          <div style="margin-bottom: 30px; text-align: left; padding: 15px; border: 1px solid #eee; border-radius: 8px; background: #fafafa;">
              <div style="font-weight: bold; text-transform: uppercase; font-size: 11px; color: #888; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 4px;">Quotation For:</div>
              <div style="font-size: 18px; font-weight: bold;">${quote.customerName}</div>
              ${quote.customerAddress ? `<div style="font-size: 13px; margin-top: 5px; color: #444;"><strong>Address:</strong> ${quote.customerAddress}</div>` : ''}
              ${quote.customerPhone ? `<div style="font-size: 13px; color: #444;"><strong>Phone:</strong> ${quote.customerPhone}</div>` : ''}
              ${quote.customerTin ? `<div style="font-size: 13px; color: #444;"><strong>TIN:</strong> ${quote.customerTin}</div>` : ''}
          </div>
      ` : '';

      const itemsHtml = settings.showItems !== false ? quote.items.map(item => {
          const hasSecondaryLine = settings.showQuantity !== false || settings.showUnitPrice !== false;
          return `
            <tr>
                <td style="padding: 12px 10px; border-bottom: 1px solid #eee;">
                    <div style="font-weight: bold;">${item.productName}</div>
                    ${hasSecondaryLine ? `
                        <div style="font-size: 11px; color: #777; margin-top: 3px;">
                            ${settings.showQuantity !== false ? `${item.quantity}` : ''}
                            ${settings.showQuantity !== false && settings.showUnitPrice !== false ? ' x ' : ''}
                            ${settings.showUnitPrice !== false ? `${currency}${item.price.toFixed(2)}` : ''}
                        </div>
                    ` : ''}
                </td>
                ${settings.showAmount !== false ? `<td align="right" style="padding: 12px 10px; border-bottom: 1px solid #eee; font-weight: bold; vertical-align: top;">${currency}${(item.price * item.quantity).toFixed(2)}</td>` : ''}
            </tr>
          `;
      }).join('') : '';

      const totalsBlock = `
          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px; margin-top: 20px;">
              ${settings.showSubtotal !== false ? `
                  <div style="width: 250px; display: flex; justify-content: space-between; font-size: 14px;">
                      <span>Subtotal:</span>
                      <span>${currency}${quote.subtotal.toFixed(2)}</span>
                  </div>
              ` : ''}
              ${(settings.showServiceCharge !== false && (store.serviceChargeRate ?? 0) > 0) ? `
                  <div style="width: 250px; display: flex; justify-content: space-between; font-size: 14px;">
                      <span>Service Charge (${store.serviceChargeRate ?? 0}%):</span>
                      <span>${currency}${(quote.subtotal * (store.serviceChargeRate ?? 0) / 100).toFixed(2)}</span>
                  </div>
              ` : ''}
              ${settings.showTax !== false ? `
                  <div style="width: 250px; display: flex; justify-content: space-between; font-size: 14px;">
                      <span>Tax (${store.taxRate}%):</span>
                      <span>${currency}${quote.tax.toFixed(2)}</span>
                  </div>
              ` : ''}
              ${settings.showTotal !== false ? `
                  <div style="width: 250px; display: flex; justify-content: space-between; font-weight: bold; font-size: 22px; border-top: 2px solid #333; padding-top: 10px; margin-top: 5px;">
                      <span>TOTAL:</span>
                      <span>${currency}${quote.total.toFixed(2)}</span>
                  </div>
              ` : ''}
          </div>
      `;

      return `
        <!DOCTYPE html><html><head><meta charset="utf-8">
          <style>
            @media print { body { margin: 0; padding: 40px; } @page { size: ${pageSize}; margin: 0; } } 
            body { 
                font-family: sans-serif; 
                padding: 40px; 
                width: ${width}; 
                margin: 0 auto; 
                color: #333; 
                background: #fff; 
                line-height: 1.5; 
                box-sizing: border-box; 
                font-size: ${settings.fontSize === 'small' ? '11px' : settings.fontSize === 'large' ? '15px' : '13px'};
            } 
            .header-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 3px solid #333; padding-bottom: 20px; } 
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; } 
            th { background: #f4f4f4; text-transform: uppercase; font-size: 11px; letter-spacing: 1px; color: #666; border-bottom: 2px solid #333; } 
            .footer { margin-top: 60px; text-align: ${footerAlignment}; border-top: 1px dashed #ccc; padding-top: 20px; font-style: italic; color: #888; font-size: 12px; }
          </style>
        </head><body ${isAutoPrint ? 'onload="window.print(); window.close();"' : ''}>
            ${logoBlock}
            <div class="header-row">
                <div style="text-align: ${headerAlignment};">${storeDetailsBlock}</div>
                <div style="text-align: right;">
                    <h1 style="margin: 0; color: #333; font-size: 28px; text-transform: uppercase; letter-spacing: -1px;">${settings.headerText || 'QUOTATION'}</h1>
                    <div style="font-weight: bold; font-size: 16px; margin-top: 5px;">Ref No: #${quote.quotationNumber}</div>
                    <div style="color: #666;">Date: ${new Date(quote.createdAt).toLocaleDateString()}</div>
                    ${settings.showCashierName ? `<div style="font-size: 11px; margin-top: 5px;">Created By: ${allUsers.find(u => u.id === quote.createdBy)?.name || 'Admin'}</div>` : ''}
                </div>
            </div>

            ${customerBlock}

            <table>
                <thead>
                    <tr>
                        <th align="left" style="padding: 12px 10px;">Item Description</th>
                        ${settings.showAmount !== false ? '<th align="right" style="padding: 12px 10px;">Amount</th>' : ''}
                    </tr>
                </thead>
                <tbody>${itemsHtml}</tbody>
            </table>

            ${totalsBlock}

            <div class="footer">${settings.footerText || 'This quotation is valid for 30 days. Prices and availability are subject to change.'}</div>
        </body></html>`;
  };

  const handlePrint = (quote: Quotation) => {
      setPreviewQuote(quote);
      setPrintModalOpen(true);
  };

  const finalPrint = () => {
    if (!previewQuote) return;
    const html = generateQuotationHtml(previewQuote, users, true);
    const printWindow = window.open('', '_blank', 'width=800,height=1100');
    if (printWindow) { printWindow.document.write(html); printWindow.document.close(); } 
    else { alert("Pop-up blocked. Please allow pop-ups for printing."); }
  };

  const handleSaveAsJpg = async () => {
    if (!previewQuote || !exportRef.current || !store) return;
    try {
        const rawHtml = generateQuotationHtml(previewQuote, users, false);
        const settings = store.quotationSettings || { paperSize: 'a4' };
        
        let width = '800px';
        if (settings.paperSize === 'a5') width = '550px';
        else if (settings.paperSize === 'thermal') width = '350px';

        const styleMatch = rawHtml.match(/<style[^>]*>([\s\S]*)<\/style>/i);
        const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        
        let css = styleMatch ? styleMatch[1] : '';
        css = css.replace(/\bbody\b/g, '.capture-root');
        const bodyContent = bodyMatch ? bodyMatch[1] : rawHtml;

        exportRef.current.style.width = width;
        exportRef.current.innerHTML = `<style>${css}</style><div class="capture-root" style="background:white; color:black; padding:40px; min-height:100%; box-sizing:border-box;">${bodyContent}</div>`;
        
        await new Promise(r => setTimeout(r, 500));
        await document.fonts.ready;
        
        const dataUrl = await toJpeg(exportRef.current, { 
            quality: 0.98, 
            backgroundColor: 'white', 
            cacheBust: true,
            pixelRatio: 2
        });
        
        const link = document.createElement('a');
        link.download = `quotation-${previewQuote.quotationNumber}.jpg`;
        link.href = dataUrl;
        link.click();
        exportRef.current.innerHTML = '';
    } catch (err) {
        console.error(err);
        alert("Failed to export quotation image.");
    }
  };

  const previewHtml = useMemo(() => { if (previewQuote) return generateQuotationHtml(previewQuote, users, false); return ''; }, [previewQuote, store, users]);
  
  const getIframeWidth = () => { 
      const paperSize = store?.quotationSettings?.paperSize || 'a4'; 
      switch(paperSize) { 
          case 'a4': return '650px'; 
          case 'a5': return '480px'; 
          case 'letter': return '650px'; 
          default: return '320px'; 
      } 
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <div ref={exportRef} style={{ position: 'fixed', left: '0', top: '0', zIndex: '-100', opacity: '1', pointerEvents: 'none', backgroundColor: 'white' }} />
      <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2"><FileText className="text-blue-600" /> Quotations</h1>
            <p className="text-sm text-gray-500">{store?.name}</p>
          </div>
          <div className="flex gap-2">
              <button onClick={() => setActiveTab('LIST')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'LIST' ? 'bg-blue-600 text-white shadow-md' : 'bg-white dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700'}`}>History</button>
              <button onClick={() => setActiveTab('NEW')} className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${activeTab === 'NEW' ? 'bg-blue-600 text-white shadow-md' : 'bg-white dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700'}`}><Plus size={18} /> New Quotation</button>
          </div>
      </div>

      {activeTab === 'LIST' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex-1 flex flex-col">
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left">
                      <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 text-[10px] font-black uppercase tracking-widest sticky top-0 z-10 border-b dark:border-gray-700">
                          <tr><th className="p-4">Date</th><th className="p-4">Quote #</th><th className="p-4">Customer</th><th className="p-4 text-right">Estimated Total</th><th className="p-4 text-right">Actions</th></tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {quotations.length === 0 ? (
                              <tr><td colSpan={5} className="p-20 text-center text-gray-400 italic">No quotation history found.</td></tr>
                          ) : (
                              quotations.map(q => (
                                  <tr key={q.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                                      <td className="p-4 text-sm dark:text-gray-300">{new Date(q.createdAt).toLocaleDateString()}</td>
                                      <td className="p-4 font-mono font-bold text-blue-600 dark:text-blue-400">#{q.quotationNumber}</td>
                                      <td className="p-4 font-bold dark:text-white truncate max-w-[200px]">{q.customerName}</td>
                                      <td className="p-4 text-right font-black dark:text-white">{store?.currency}{q.total.toFixed(2)}</td>
                                      <td className="p-4 text-right">
                                          <button onClick={() => handlePrint(q)} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all" title="View & Print"><Printer size={18}/></button>
                                      </td>
                                  </tr>
                              ))
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {activeTab === 'NEW' && (
          <div className="flex flex-col md:flex-row gap-6 flex-1 overflow-hidden">
              <div className="flex-1 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col p-4 shadow-sm overflow-hidden">
                  <div className="relative mb-4">
                      <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                      <input 
                        placeholder="Search products..." 
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" 
                        value={productSearch} 
                        onChange={e => setProductSearch(e.target.value)}
                      />
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 overflow-y-auto flex-1 pr-1 custom-scrollbar">
                      {products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase())).map(p => (
                          <button key={p.id} onClick={() => addToCart(p)} className="p-3 border dark:border-gray-700 rounded-xl text-left hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 active:scale-95 transition-all group">
                              <div className="font-bold text-sm truncate dark:text-white group-hover:text-blue-600">{p.name}</div>
                              <div className="text-blue-600 dark:text-blue-400 font-black text-xs mt-1">{store?.currency}{p.price.toFixed(2)}</div>
                          </button>
                      ))}
                      {products.length === 0 && <div className="col-span-full py-20 text-center text-gray-400 italic">No products available. Setup your menu first.</div>}
                  </div>
              </div>
              
              <div className="w-full md:w-96 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col shadow-xl overflow-hidden">
                  <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Recipient Customer</label>
                      <select 
                        className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-bold appearance-none outline-none focus:ring-2 focus:ring-blue-500" 
                        value={selectedCustomer?.id || ''} 
                        onChange={e => setSelectedCustomer(customers.find(c => c.id === e.target.value) || null)}
                      >
                          <option value="">Select Customer...</option>
                          {customers.map(c => <option key={c.id} value={c.id}>{c.name} {c.companyName ? `(${c.companyName})` : ''}</option>)}
                      </select>
                      {customers.length === 0 && <p className="text-[10px] text-red-500 mt-2">No customers found. Add them in the Customers section.</p>}
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                      {cart.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-gray-300 opacity-40">
                              <ShoppingBag size={48} className="mb-2" />
                              <p className="font-black text-xs uppercase tracking-[0.2em]">Estimate is Empty</p>
                          </div>
                      ) : cart.map(item => (
                          <div key={item.productId} className="flex justify-between items-center group">
                              <div className="dark:text-white overflow-hidden pr-2 flex-1">
                                  <div className="text-sm font-bold truncate">{item.productName}</div>
                                  <div className="text-[10px] text-gray-500 font-bold">{store?.currency}{item.price.toFixed(2)} / unit</div>
                              </div>
                              <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 p-1 rounded-lg border dark:border-gray-700">
                                      <button onClick={() => updateQuantity(item.productId, -1)} className="w-6 h-6 flex items-center justify-center bg-white dark:bg-gray-800 rounded-md text-gray-600 dark:text-gray-300 hover:text-blue-600">-</button>
                                      <span className="w-5 text-center text-sm font-black dark:text-white">{item.quantity}</span>
                                      <button onClick={() => updateQuantity(item.productId, 1)} className="w-6 h-6 flex items-center justify-center bg-white dark:bg-gray-800 rounded-md text-gray-600 dark:text-gray-300 hover:text-blue-600">+</button>
                                  </div>
                                  <button onClick={() => removeFromCart(item.productId)} className="text-red-300 hover:text-red-500 transition-colors p-1"><Trash2 size={16}/></button>
                              </div>
                          </div>
                      ))}
                  </div>

                  <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                      <div className="space-y-2 mb-6">
                          <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400"><span>Subtotal</span><span className="font-bold">{store?.currency}{totals.subtotal.toFixed(2)}</span></div>
                          {store && (store.serviceChargeRate ?? 0) > 0 && (
                            <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400"><span>Service Charge (${store.serviceChargeRate ?? 0}%)</span><span className="font-bold">{store?.currency}{totals.serviceCharge.toFixed(2)}</span></div>
                          )}
                          <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400"><span>Tax (${store?.taxRate || 0}%)</span><span className="font-bold">{store?.currency}{totals.tax.toFixed(2)}</span></div>
                          <div className="flex justify-between font-black text-2xl dark:text-white border-t border-gray-200 dark:border-gray-700 pt-3 mt-3"><span>Total</span><span>{store?.currency}{totals.total.toFixed(2)}</span></div>
                      </div>
                      <button 
                        onClick={handleSaveQuotation} 
                        disabled={cart.length === 0 || !selectedCustomer} 
                        className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-30 disabled:pointer-events-none transition-all active:scale-[0.98]"
                      >
                          Generate Official Quote
                      </button>
                  </div>
              </div>
          </div>
      )}

      {printModalOpen && previewQuote && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
              <div className="bg-white dark:bg-gray-800 w-full max-w-4xl h-[90vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                  <div className="flex justify-between items-center p-5 border-b dark:border-gray-700 bg-white dark:bg-gray-900/30">
                      <h2 className="text-lg font-black dark:text-white flex items-center gap-3">
                          <Printer size={22} className="text-blue-600"/> 
                          Official Quotation Preview
                      </h2>
                      <button onClick={() => setPrintModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"><X size={24}/></button>
                  </div>
                  <div className="flex-1 bg-gray-100 dark:bg-gray-950 p-8 flex justify-center overflow-auto">
                      <div className="bg-white shadow-2xl h-fit rounded" style={{width: getIframeWidth()}}>
                          <iframe srcDoc={previewHtml} className="w-full h-[1000px] border-none" title="Quotation Print Preview" />
                      </div>
                  </div>
                  <div className="p-5 border-t dark:border-gray-700 flex justify-end gap-3 bg-white dark:bg-gray-900/30">
                    <button onClick={() => setPrintModalOpen(false)} className="px-6 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Close</button>
                    <button onClick={handleSaveAsJpg} className="px-5 py-2.5 border-2 border-blue-600 text-blue-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center gap-2 transition-all"><FileImage size={18}/> Export Image</button>
                    <button onClick={finalPrint} className="px-10 py-2.5 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-blue-700 transition-all active:scale-95">Send to Printer</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
