
import React, { useEffect, useState } from 'react';
// @ts-ignore - Fixing missing member errors in react-router-dom
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { Store, PrintSettings, UserRole } from '../types';
import { useAuth } from '../App';
import { ArrowLeft, Save, Printer, Type, Image as ImageIcon, Layout, Eye, AlignLeft, AlignCenter, AlignRight, DollarSign, FileType } from 'lucide-react';

const DEFAULT_SETTINGS: PrintSettings = {
  headerText: 'Welcome!',
  footerText: 'Thank you for your visit!',
  showLogo: false,
  logoUrl: '',
  showStoreDetails: true,
  showCashierName: true,
  showCustomerDetails: true,
  showTaxId: false,
  taxIdLabel: 'VAT Reg:',
  taxIdValue: '',
  fontSize: 'medium',
  paperSize: 'thermal',
  headerAlignment: 'center',
  footerAlignment: 'center',
  logoPosition: 'center',
  showDate: true,
  showOrderNumber: true,
  showItems: true,
  showQuantity: true,
  showUnitPrice: true,
  showAmount: true,
  showSubtotal: true,
  showServiceCharge: true,
  showTax: true,
  showTotal: true
};

const DEFAULT_QUOTATION_SETTINGS: PrintSettings = {
  ...DEFAULT_SETTINGS,
  headerText: 'QUOTATION',
  footerText: 'This quotation is valid for 30 days.',
  paperSize: 'a4',
  showCashierName: false,
};

const DEFAULT_EOD_SETTINGS: PrintSettings = {
  ...DEFAULT_SETTINGS,
  headerText: 'END OF DAY REPORT',
  footerText: 'System Generated Report',
  paperSize: 'thermal',
  showCashierName: false,
  showCustomerDetails: false,
};

export default function PrintDesigner() {
  const { storeId } = useParams<{ storeId: string }>();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const [store, setStore] = useState<Store | null>(null);
  
  const [documentType, setDocumentType] = useState<'RECEIPT' | 'QUOTATION' | 'EOD'>('RECEIPT');
  const [settings, setSettings] = useState<PrintSettings>(DEFAULT_SETTINGS);

  // Fixed: Await db.getStores in effect and use Number for ID comparison
  useEffect(() => {
    const loadStore = async () => {
        if (storeId) {
          const stores = await db.getStores();
          const current = stores.find(s => s.id === Number(storeId));
          if (current) {
            setStore(current);
            loadSettingsForType(current, 'RECEIPT');
          }
        }
    };
    loadStore();
  }, [storeId]);

  const loadSettingsForType = (currentStore: Store, type: 'RECEIPT' | 'QUOTATION' | 'EOD') => {
      let mergedSettings: PrintSettings;
      
      if (type === 'RECEIPT') {
          mergedSettings = { ...DEFAULT_SETTINGS, ...(currentStore.printSettings || {}) };
      } else if (type === 'QUOTATION') {
          mergedSettings = { ...DEFAULT_QUOTATION_SETTINGS, ...(currentStore.quotationSettings || {}) };
      } else {
          mergedSettings = { ...DEFAULT_EOD_SETTINGS, ...(currentStore.eodSettings || {}) };
      }
      
      if (!mergedSettings.currencySymbol) {
          mergedSettings.currencySymbol = currentStore.currency || '$';
      }
      
      setSettings(mergedSettings);
  };

  const handleTypeChange = (newType: 'RECEIPT' | 'QUOTATION' | 'EOD') => {
      setDocumentType(newType);
      if (store) {
          loadSettingsForType(store, newType);
      }
  };

  const handleSave = () => {
    if (store) {
      try {
          const updatedStore = { ...store };
          const settingsToSave = { ...settings };

          if (documentType === 'RECEIPT') {
              updatedStore.printSettings = settingsToSave;
          } else if (documentType === 'QUOTATION') {
              updatedStore.quotationSettings = settingsToSave;
          } else {
              updatedStore.eodSettings = settingsToSave;
          }
          
          db.updateStore(updatedStore);
          setStore(updatedStore); 
          alert(`${documentType === 'RECEIPT' ? 'Receipt' : documentType === 'QUOTATION' ? 'Quotation' : 'EOD Report'} settings saved successfully!`);
      } catch (e) {
          console.error("Save failed", e);
          alert("Failed to save settings. Please try again.");
      }
    } else {
        alert("Store not found. Cannot save.");
    }
  };

  const getPreviewStyle = () => {
    switch(settings.paperSize) {
        case 'a4': return { width: '400px', minHeight: '565px', fontSize: '10px' };
        case 'a5': return { width: '280px', minHeight: '400px', fontSize: '10px' };
        case 'letter': return { width: '400px', minHeight: '520px', fontSize: '10px' };
        default: return { width: '260px', minHeight: '400px', fontSize: settings.fontSize === 'small' ? '10px' : settings.fontSize === 'large' ? '14px' : '12px' }; // Thermal
    }
  };

  const isThermal = settings.paperSize === 'thermal';
  const currency = settings.currencySymbol || store?.currency || '$';

  const AlignmentControl = ({ value, onChange, label }: { value: string, onChange: (val: any) => void, label: string }) => (
      <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase">{label}</span>
          <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg w-fit">
              {[
                  { id: 'left', icon: AlignLeft },
                  { id: 'center', icon: AlignCenter },
                  { id: 'right', icon: AlignRight }
              ].map((opt) => (
                  <button
                      key={opt.id}
                      onClick={() => onChange(opt.id)}
                      className={`p-1.5 rounded-md transition-colors ${value === opt.id ? 'bg-white dark:bg-gray-600 shadow text-blue-600 dark:text-blue-300' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
                  >
                      <opt.icon size={16} />
                  </button>
              ))}
          </div>
      </div>
  );

  const renderPreviewContent = () => {
      if (documentType === 'EOD') {
          return (
              <>
                <div className="mb-4 border-b pb-2 text-sm">
                    {settings.showDate && <div><span className="font-bold">Date:</span> {new Date().toLocaleDateString()}</div>}
                    <div><span className="font-bold">Range:</span> Daily</div>
                </div>

                <div className="mb-4">
                    <div className="font-bold border-b mb-1 uppercase text-xs">Sales Summary</div>
                    <div className="flex justify-between text-sm mb-1"><span>Gross Sales</span><span>{currency}1,500.00</span></div>
                    <div className="flex justify-between text-sm mb-1 text-red-500"><span>Refunds</span><span>({currency}50.00)</span></div>
                    <div className="flex justify-between text-sm font-bold border-t pt-1"><span>Net Sales</span><span>{currency}1,450.00</span></div>
                </div>

                <div className="mb-4">
                    <div className="font-bold border-b mb-1 uppercase text-xs">Payment Details</div>
                    <div className="flex justify-between text-sm mb-1"><span>Cash</span><span>{currency}500.00</span></div>
                    <div className="flex justify-between text-sm mb-1"><span>Card</span><span>{currency}1,000.00</span></div>
                </div>

                <div className="mb-4 bg-gray-50 p-2 border">
                    <div className="font-bold border-b mb-1 uppercase text-xs text-center">Drawer</div>
                    <div className="flex justify-between text-sm mb-1"><span>Opening</span><span>{currency}200.00</span></div>
                    <div className="flex justify-between text-sm mb-1"><span>Expected</span><span>{currency}700.00</span></div>
                    <div className="flex justify-between text-sm font-bold border-t pt-1"><span>Actual</span><span>{currency}700.00</span></div>
                </div>
              </>
          );
      }

      // Receipt / Quote Content
      // Calculation Logic:
      // Subtotal = 250
      // SC (10%) = 25
      // Tax (10%) on (Subtotal + SC) = (250+25) * 10% = 27.5
      // Total = 250 + 25 + 27.5 = 302.5
      return (
          <>
             <div className="mb-6 grid grid-cols-2 gap-y-1 text-sm border-b pb-4">
                 <div>
                     {settings.showDate !== false && (
                         <div><span className="font-bold">Date:</span> {new Date().toLocaleDateString()}</div>
                     )}
                     {settings.showOrderNumber !== false && (
                         <div><span className="font-bold">{documentType === 'QUOTATION' ? 'Quote #' : 'Order #'}:</span> 1001</div>
                     )}
                 </div>
                 <div className="text-right">
                     {settings.showCashierName && (
                        <div><span className="font-bold">By:</span> {user?.name || 'Admin'}</div>
                     )}
                 </div>
             </div>

             {settings.showCustomerDetails && (
                 <div className="mb-4 text-sm border p-2 rounded">
                    <div className="font-bold border-b pb-1 mb-1 text-xs uppercase">Customer Details</div>
                    <div><strong>Name:</strong> John Doe</div>
                    <div><strong>Address:</strong> 123 Ocean Drive, Male'</div>
                    <div><strong>Phone:</strong> 777-1234</div>
                    <div><strong>TIN:</strong> 123-456-789</div>
                 </div>
             )}

             {settings.showItems !== false && (
                 <table className="w-full mb-6 text-sm border-collapse">
                    <thead>
                        <tr className="border-b-2 border-black">
                            <th className="text-left py-2">Item</th>
                            {settings.showAmount !== false && <th className="text-right py-2 w-24">Amount</th>}
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-b border-gray-100">
                            <td className="py-2">
                                <div>Premium Item A</div>
                                {(settings.showQuantity !== false || settings.showUnitPrice !== false) && (
                                    <div className="text-xs text-gray-500">
                                        {settings.showQuantity !== false ? '2' : ''}
                                        {settings.showQuantity !== false && settings.showUnitPrice !== false ? ' x ' : ''}
                                        {settings.showUnitPrice !== false ? `${currency}50.00` : ''}
                                    </div>
                                )}
                            </td>
                            {settings.showAmount !== false && <td className="text-right py-2">{currency}100.00</td>}
                        </tr>
                        <tr className="border-b border-gray-100">
                            <td className="py-2">
                                <div>Service Item B</div>
                                {(settings.showQuantity !== false || settings.showUnitPrice !== false) && (
                                    <div className="text-xs text-gray-500">
                                        {settings.showQuantity !== false ? '1' : ''}
                                        {settings.showQuantity !== false && settings.showUnitPrice !== false ? ' x ' : ''}
                                        {settings.showUnitPrice !== false ? `${currency}50.00` : ''}
                                    </div>
                                )}
                            </td>
                            {settings.showAmount !== false && <td className="text-right py-2">{currency}50.00</td>}
                        </tr>
                    </tbody>
                 </table>
             )}

             <div className="flex flex-col items-end gap-1 mb-6">
                {settings.showSubtotal !== false && (
                    <div className="w-48 flex justify-between text-sm">
                        <span>Subtotal:</span>
                        <span>{currency}250.00</span>
                    </div>
                )}
                {settings.showServiceCharge !== false && (
                    <div className="w-48 flex justify-between text-sm">
                        <span>Service Charge (10%):</span>
                        <span>{currency}25.00</span>
                    </div>
                )}
                {settings.showTax !== false && (
                    <div className="w-48 flex justify-between text-sm">
                        <span>Tax ({store?.taxRate}%):</span>
                        <span>{currency}27.50</span>
                    </div>
                )}
                {settings.showTotal !== false && (
                    <div className="w-48 flex justify-between font-bold text-lg border-t-2 border-black pt-2 mt-1">
                        <span>TOTAL:</span>
                        <span>{currency}302.50</span>
                    </div>
                )}
             </div>
          </>
      );
  };

  if (!user || !hasPermission('MANAGE_PRINT_DESIGNER')) {
    return <div className="p-8 text-red-600 font-bold">Access Denied</div>;
  }

  if (!store) return <div className="p-8">Loading...</div>;

  return (
    <div className="h-full flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full text-gray-700 dark:text-gray-300">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Print Designer</h1>
            <p className="text-gray-500 dark:text-gray-400">{store.name}</p>
          </div>
        </div>
        <button 
          onClick={handleSave}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 shadow-sm"
        >
          <Save size={18} /> Save Settings
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 h-full overflow-hidden">
        {/* Editor Panel */}
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-y-auto p-6">
          
          {/* Template Selector */}
          <div className="mb-8 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
              <h3 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                  <FileType size={16} /> Select Template to Edit
              </h3>
              <div className="flex gap-2">
                  <button 
                    onClick={() => handleTypeChange('RECEIPT')}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${documentType === 'RECEIPT' ? 'bg-blue-600 text-white shadow' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/30'}`}
                  >
                      Sales Receipt
                  </button>
                  <button 
                    onClick={() => handleTypeChange('QUOTATION')}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${documentType === 'QUOTATION' ? 'bg-blue-600 text-white shadow' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/30'}`}
                  >
                      Quotation
                  </button>
                  <button 
                    onClick={() => handleTypeChange('EOD')}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${documentType === 'EOD' ? 'bg-blue-600 text-white shadow' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/30'}`}
                  >
                      EOD Report
                  </button>
              </div>
          </div>

          {/* General */}
          <div className="mb-8">
             <h3 className="text-sm font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4 flex items-center gap-2">
                <Layout size={16} /> General Settings
             </h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Paper Format</label>
                    <select 
                        value={settings.paperSize}
                        onChange={(e) => setSettings({...settings, paperSize: e.target.value as any})}
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                        <option value="thermal">Receipt (Thermal 80mm)</option>
                        <option value="a4">A4 Document</option>
                        <option value="a5">A5 Document</option>
                        <option value="letter">Letter</option>
                    </select>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Currency Symbol</label>
                    <div className="relative">
                        <DollarSign size={16} className="absolute left-3 top-2.5 text-gray-400" />
                        <input 
                            value={settings.currencySymbol || ''}
                            onChange={(e) => setSettings({...settings, currencySymbol: e.target.value})}
                            className="w-full pl-9 p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            placeholder={store.currency || '$'}
                        />
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">Default: {store.currency || '$'}</p>
                 </div>
             </div>
             {isThermal && (
                 <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Base Font Size</label>
                    <div className="flex gap-2">
                        {['small', 'medium', 'large'].map((size) => (
                            <button
                                key={size}
                                onClick={() => setSettings({...settings, fontSize: size as any})}
                                className={`flex-1 py-2 text-sm border rounded-lg capitalize ${settings.fontSize === size ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 dark:border-blue-400 text-blue-700 dark:text-blue-300 font-medium' : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}
                            >
                                {size}
                            </button>
                        ))}
                    </div>
                 </div>
             )}
          </div>

          {/* Visibility */}
          <div className="mb-8">
             <h3 className="text-sm font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4 flex items-center gap-2">
                <Eye size={16} /> Layout Options
             </h3>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <label className="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <input type="checkbox" checked={settings.showStoreDetails} onChange={e => setSettings({...settings, showStoreDetails: e.target.checked})} className="w-4 h-4 text-blue-600 rounded" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Store Info</span>
                </label>
                <label className="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <input type="checkbox" checked={settings.showOrderNumber !== false} onChange={e => setSettings({...settings, showOrderNumber: e.target.checked})} className="w-4 h-4 text-blue-600 rounded" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Order/Quote ID</span>
                </label>
                <label className="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <input type="checkbox" checked={settings.showDate !== false} onChange={e => setSettings({...settings, showDate: e.target.checked})} className="w-4 h-4 text-blue-600 rounded" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Date & Time</span>
                </label>
                <label className="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <input type="checkbox" checked={settings.showCashierName} onChange={e => setSettings({...settings, showCashierName: e.target.checked})} className="w-4 h-4 text-blue-600 rounded" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Cashier Name</span>
                </label>
                <label className="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <input type="checkbox" checked={settings.showCustomerDetails} onChange={e => setSettings({...settings, showCustomerDetails: e.target.checked})} className="w-4 h-4 text-blue-600 rounded" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Customer Details</span>
                </label>
                <label className="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <input type="checkbox" checked={settings.showTaxId} onChange={e => setSettings({...settings, showTaxId: e.target.checked})} className="w-4 h-4 text-blue-600 rounded" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Tax ID (TIN)</span>
                </label>
                
                {/* Menu Items Options */}
                <div className="col-span-full border-t border-gray-100 dark:border-gray-700 my-2 pt-2"></div>
                
                <label className="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <input type="checkbox" checked={settings.showItems !== false} onChange={e => setSettings({...settings, showItems: e.target.checked})} className="w-4 h-4 text-blue-600 rounded" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Menu Items</span>
                </label>
                <label className="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <input type="checkbox" checked={settings.showQuantity !== false} onChange={e => setSettings({...settings, showQuantity: e.target.checked})} className="w-4 h-4 text-blue-600 rounded" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Quantity</span>
                </label>
                <label className="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <input type="checkbox" checked={settings.showUnitPrice !== false} onChange={e => setSettings({...settings, showUnitPrice: e.target.checked})} className="w-4 h-4 text-blue-600 rounded" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Unit Price</span>
                </label>
                <label className="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <input type="checkbox" checked={settings.showAmount !== false} onChange={e => setSettings({...settings, showAmount: e.target.checked})} className="w-4 h-4 text-blue-600 rounded" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Total Line Amount</span>
                </label>

                {/* Footer / Totals Options */}
                <div className="col-span-full border-t border-gray-100 dark:border-gray-700 my-2 pt-2"></div>

                <label className="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <input type="checkbox" checked={settings.showSubtotal !== false} onChange={e => setSettings({...settings, showSubtotal: e.target.checked})} className="w-4 h-4 text-blue-600 rounded" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Subtotal</span>
                </label>
                <label className="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <input type="checkbox" checked={settings.showServiceCharge !== false} onChange={e => setSettings({...settings, showServiceCharge: e.target.checked})} className="w-4 h-4 text-blue-600 rounded" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Service Charge</span>
                </label>
                <label className="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <input type="checkbox" checked={settings.showTax !== false} onChange={e => setSettings({...settings, showTax: e.target.checked})} className="w-4 h-4 text-blue-600 rounded" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Tax</span>
                </label>
                <label className="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <input type="checkbox" checked={settings.showTotal !== false} onChange={e => setSettings({...settings, showTotal: e.target.checked})} className="w-4 h-4 text-blue-600 rounded" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Total Amount</span>
                </label>
             </div>
             
             {settings.showTaxId && (
                  <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg mt-4 border border-gray-200 dark:border-gray-600">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tax Label</label>
                        <input value={settings.taxIdLabel || ''} onChange={e => setSettings({...settings, taxIdLabel: e.target.value})} className="w-full p-2 border border-gray-300 dark:border-gray-500 rounded text-sm bg-white dark:bg-gray-600 text-gray-900 dark:text-white" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Value (Optional override)</label>
                        <input value={settings.taxIdValue || ''} onChange={e => setSettings({...settings, taxIdValue: e.target.value})} className="w-full p-2 border border-gray-300 dark:border-gray-500 rounded text-sm bg-white dark:bg-gray-600 text-gray-900 dark:text-white" placeholder="Leave blank to use Store TIN" />
                      </div>
                  </div>
              )}
          </div>

          {/* Branding & Header */}
          <div className="mb-8">
             <h3 className="text-sm font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4 flex items-center gap-2">
                <ImageIcon size={16} /> Branding
             </h3>
             
             <div className="space-y-4">
                 <div className="flex justify-between items-start">
                     <div className="flex-1">
                        <label className="flex items-center gap-2 mb-2">
                            <input type="checkbox" checked={settings.showLogo} onChange={e => setSettings({...settings, showLogo: e.target.checked})} className="w-4 h-4 text-blue-600 rounded" />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Show Logo</span>
                        </label>
                        {settings.showLogo && (
                            <input 
                                value={settings.logoUrl || ''}
                                onChange={e => setSettings({...settings, logoUrl: e.target.value})}
                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-2"
                                placeholder="https://example.com/logo.png"
                            />
                        )}
                     </div>
                     {settings.showLogo && (
                         <div className="ml-4">
                             <AlignmentControl value={settings.logoPosition || 'center'} onChange={val => setSettings({...settings, logoPosition: val})} label="Logo Align" />
                         </div>
                     )}
                 </div>

                 <div className="flex gap-4">
                     <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Header Title</label>
                        <input 
                            value={settings.headerText || ''}
                            onChange={e => setSettings({...settings, headerText: e.target.value})}
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            placeholder={documentType === 'QUOTATION' ? 'QUOTATION' : 'Welcome!'}
                        />
                     </div>
                     <AlignmentControl value={settings.headerAlignment || 'center'} onChange={val => setSettings({...settings, headerAlignment: val})} label="Align" />
                 </div>
             </div>
          </div>

          {/* Footer */}
          <div className="mb-8">
             <h3 className="text-sm font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4 flex items-center gap-2">
                <Type size={16} /> Footer
             </h3>
             <div className="flex gap-4 items-start">
                 <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Footer Message</label>
                    <textarea 
                        value={settings.footerText || ''}
                        onChange={e => setSettings({...settings, footerText: e.target.value})}
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        rows={2}
                        placeholder="Thank you!"
                    />
                 </div>
                 <AlignmentControl value={settings.footerAlignment || 'center'} onChange={val => setSettings({...settings, footerAlignment: val})} label="Align" />
             </div>
          </div>

        </div>

        {/* Preview Panel */}
        <div className="w-full lg:w-1/2 flex flex-col bg-gray-200 dark:bg-gray-900 rounded-xl border border-gray-300 dark:border-gray-800 overflow-hidden shadow-inner">
           <div className="bg-gray-300 dark:bg-gray-800 p-3 border-b border-gray-400 dark:border-gray-700 text-center font-bold text-gray-700 dark:text-gray-300 flex items-center justify-center gap-2">
               <Printer size={16} /> Live Preview: {documentType} ({settings.paperSize.toUpperCase()})
           </div>
           <div className="flex-1 overflow-y-auto p-8 flex justify-center items-start">
              <div 
                className={`bg-white shadow-2xl p-6 text-black transition-all duration-300 ${isThermal ? 'font-mono' : 'font-sans'}`}
                style={getPreviewStyle()}
              >
                 {/* Logo Preview */}
                 {settings.showLogo && settings.logoUrl && (
                     <div style={{ textAlign: settings.logoPosition || 'center', marginBottom: '1rem' }}>
                         <img src={settings.logoUrl} alt="Logo" className="inline-block max-w-[100px] max-h-[60px]" />
                     </div>
                 )}

                 {/* Header */}
                 <div style={{ textAlign: settings.headerAlignment || (isThermal ? 'center' : 'left'), marginBottom: '1.5rem' }}>
                     {settings.showStoreDetails && (
                         <div className="mb-2">
                            <div className="font-bold text-2xl mb-1">{store.name}</div>
                            <div className="text-gray-600">{store.address}</div>
                            <div className="text-gray-600">{store.phone}</div>
                            {store.tin && <div className="text-gray-600">TIN: {store.tin}</div>}
                         </div>
                     )}
                     {settings.showTaxId && (
                         <div className="mt-1 font-medium">{settings.taxIdLabel} {settings.taxIdValue || store.tin}</div>
                     )}
                     {settings.headerText && (
                         <div className={`mt-4 font-medium py-2 ${isThermal ? 'border-t border-b border-dashed border-gray-300' : 'text-gray-500 italic'}`}>
                             {settings.headerText}
                         </div>
                     )}
                 </div>

                 {renderPreviewContent()}

                 {/* Footer */}
                 {settings.footerText && (
                     <div style={{ textAlign: settings.footerAlignment || 'center' }} className="mt-auto pt-6 border-t border-gray-200 text-gray-500 text-sm whitespace-pre-wrap">
                         {settings.footerText}
                     </div>
                 )}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
