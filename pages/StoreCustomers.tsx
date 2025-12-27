import React, { useEffect, useState, useRef } from 'react';
// @ts-ignore - Fixing missing member errors in react-router-dom
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { Customer, Store, Permission } from '../types';
// Fix: useAuth should be imported from AuthContext
import { useAuth } from '../AuthContext';
import { 
  ArrowLeft, 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  User as UserIcon, 
  Building2, 
  MapPin, 
  Loader2, 
  AlertCircle,
  Download,
  Upload,
  FileSpreadsheet,
  X,
  Phone
} from 'lucide-react';
import { utils, writeFile, read } from 'xlsx';

export default function StoreCustomers() {
  const { storeId } = useParams<{ storeId: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [store, setStore] = useState<Store | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingCustomer, setEditingCustomer] = useState<Partial<Customer>>({
    phone: '', 
    type: 'INDIVIDUAL', 
    companyName: '', 
    tin: '',
    houseName: '',
    streetName: '',
    buildingName: '',
    street: '',
    island: '',
    country: '',
    address: ''
  });

  useEffect(() => {
    if (storeId) {
      loadData();
      const listener = () => loadData();
      window.addEventListener(`db_change_store_${storeId}_customers`, listener);
      return () => window.removeEventListener(`db_change_store_${storeId}_customers`, listener);
    }
  }, [storeId]);

  const loadData = async () => {
    if (!storeId) return;
    const numericStoreId = Number(storeId);
    const stores = await db.getStores();
    setStore(stores.find(s => s.id === numericStoreId) || null);
    setCustomers(await db.getCustomers(numericStoreId));
  };

  const validateForm = () => {
    const type = editingCustomer.type || 'INDIVIDUAL';
    if (type === 'INDIVIDUAL') {
        if (!editingCustomer.phone || !editingCustomer.houseName) {
            alert("Phone and Building/House Name are mandatory for individual customers.");
            return false;
        }
    } else {
        if (!editingCustomer.name || !editingCustomer.companyName || !editingCustomer.tin || !editingCustomer.phone || !editingCustomer.buildingName) {
            alert("All primary fields are mandatory for company accounts.");
            return false;
        }
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId || isSaving) return;
    if (!validateForm()) return;
    
    const numericStoreId = Number(storeId);
    const finalCustomer = { ...editingCustomer };
    
    if (finalCustomer.type === 'INDIVIDUAL') {
        finalCustomer.name = undefined; 
        finalCustomer.companyName = undefined;
        finalCustomer.tin = undefined;
        finalCustomer.buildingName = undefined;
        finalCustomer.street = undefined;
        finalCustomer.country = undefined;
    } else {
        finalCustomer.houseName = undefined;
        finalCustomer.streetName = undefined;
    }

    setIsSaving(true);
    try {
        if (finalCustomer.id) {
          await db.updateCustomer(numericStoreId, finalCustomer as Customer);
        } else {
          await db.addCustomer(numericStoreId, { ...finalCustomer, id: 0 } as Customer);
        }
        setIsModalOpen(false);
        resetForm();
    } finally {
        setIsSaving(false);
    }
  };

  const resetForm = () => {
    setEditingCustomer({ 
        phone: '', 
        type: 'INDIVIDUAL', 
        companyName: '', 
        tin: '',
        houseName: '',
        streetName: '',
        buildingName: '',
        street: '',
        island: '',
        country: '',
        address: ''
    });
  };

  const handleEdit = (customer: Customer) => {
    if (!hasPermission('MANAGE_CUSTOMERS')) {
        alert("You do not have permission to edit customers.");
        return;
    }
    setEditingCustomer(customer);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!hasPermission('MANAGE_CUSTOMERS')) {
        alert("You do not have permission to delete customers.");
        return;
    }
    if (confirm('Are you sure you want to permanently delete this customer?')) {
      if (storeId) {
          try {
            await db.deleteCustomer(Number(storeId), id);
          } catch (e) {
            alert("Failed to delete customer. Check your connection.");
          }
      }
    }
  };

  const handleExport = () => {
    if (!customers.length) {
        alert("No customer records to export.");
        return;
    }

    const exportData = customers.map(c => ({
        'Name': c.name || '',
        'Phone': c.phone,
        'Type': c.type,
        'Company Name': c.companyName || '',
        'TIN': c.tin || '',
        'House Name': c.houseName || '',
        'Street Name': c.streetName || '',
        'Building Name': c.buildingName || '',
        'Street': c.street || '',
        'Island': c.island || '',
        'Country': c.country || '',
        'Additional Address': c.address || ''
    }));

    const ws = utils.json_to_sheet(exportData);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Customers");
    writeFile(wb, `OmniPOS_Customers_${store?.name || 'Registry'}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleDownloadTemplate = () => {
    const templateData = [{
        'Phone': '+960 7771234',
        'Type': 'INDIVIDUAL',
        'House Name': 'Rose Villa',
        'Street Name': 'Orchid Magu',
        'Island': 'Male',
        'Country': 'Maldives',
    }];

    const ws = utils.json_to_sheet(templateData);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Template");
    writeFile(wb, "Customer_Import_Template.xlsx");
  };

  const triggerImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length || !storeId) return;
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = async (event) => {
        try {
            const bstr = event.target?.result;
            const wb = read(bstr, { type: 'binary' });
            const wsName = wb.SheetNames[0];
            const ws = wb.Sheets[wsName];
            const data = utils.sheet_to_json<any>(ws);

            if (!data.length) {
                alert("File is empty.");
                return;
            }

            let addedCount = 0;
            const numericStoreId = Number(storeId);

            for (const row of data) {
                const type = (row['Type'] || 'INDIVIDUAL').toUpperCase();
                const newCust: Partial<Customer> = {
                    name: row['Name'],
                    phone: String(row['Phone'] || ''),
                    type: type === 'COMPANY' ? 'COMPANY' : 'INDIVIDUAL',
                    companyName: row['Company Name'],
                    tin: row['TIN'],
                    houseName: row['House Name'],
                    streetName: row['Street Name'],
                    buildingName: row['Building Name'],
                    street: row['Street'],
                    island: row['Island'],
                    country: row['Country'],
                    address: row['Additional Address']
                };

                if (newCust.phone) {
                    await db.addCustomer(numericStoreId, newCust as Customer);
                    addedCount++;
                }
            }

            alert(`Successfully imported ${addedCount} customer records.`);
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (err) {
            console.error("Import failed:", err);
            alert("Error parsing file. Ensure it's a valid Excel format.");
        }
    };
    reader.readAsBinaryString(file);
  };

  const filteredCustomers = customers.filter(c => {
    const term = searchTerm.toLowerCase();
    const nameMatch = (c.name || '').toLowerCase().includes(term);
    const phoneMatch = c.phone.includes(term);
    const companyMatch = c.companyName?.toLowerCase().includes(term);
    const islandMatch = c.island?.toLowerCase().includes(term);
    return nameMatch || phoneMatch || companyMatch || islandMatch;
  });

  const getFormattedAddress = (c: Customer) => {
      if (c.type === 'INDIVIDUAL') {
          const parts = [c.houseName, c.streetName, c.island].filter(Boolean);
          return parts.length > 0 ? parts.join(', ') : '-';
      } else {
          const parts = [c.buildingName, c.street, c.island, c.country].filter(Boolean);
          return parts.length > 0 ? parts.join(', ') : '-';
      }
  };

  if (!store) return <div className="p-8 text-center text-gray-500">Loading customers...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full text-gray-700 dark:text-gray-300 transition-colors">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Customer Management</h1>
            <p className="text-gray-500 dark:text-gray-400">{store.name}</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handleDownloadTemplate} className="flex items-center gap-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm text-sm font-bold"><FileSpreadsheet size={18} /> Template</button>
          <button onClick={handleExport} className="flex items-center gap-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm text-sm font-bold"><Download size={18} /> Export</button>
          <button onClick={triggerImport} className="flex items-center gap-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm text-sm font-bold"><Upload size={18} /> Import<input ref={fileInputRef} type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileChange} /></button>
          {hasPermission('MANAGE_CUSTOMERS') && <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-bold shadow-sm text-sm"><Plus size={18} /> Add Customer</button>}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
            <input type="text" placeholder="Search by name, phone, or address..." className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>
        
        <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[800px]">
            <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-xs font-black uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                <tr><th className="p-4 w-16">#</th><th className="p-4">Customer Details</th><th className="p-4">Type</th><th className="p-4">Contact Info</th><th className="p-4">Address</th><th className="p-4 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredCustomers.length === 0 ? (
                    <tr><td colSpan={6} className="p-10 text-center text-gray-400 italic">No customers found.</td></tr>
                ) : filteredCustomers.map((customer, index) => (
                <tr key={customer.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors group">
                    <td className="p-4 text-gray-500 dark:text-gray-400 font-mono text-xs">{index + 1}</td>
                    <td className="p-4">
                      <div className="font-bold text-gray-900 dark:text-white">{customer.name || `Individual (${customer.phone})`}</div>
                      {customer.type === 'COMPANY' && customer.companyName && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5"><Building2 size={10} /> {customer.companyName}</div>
                      )}
                    </td>
                    <td className="p-4">
                        {customer.type === 'COMPANY' ? (
                            <span className="text-[10px] bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-1 rounded-full font-black uppercase border border-purple-100 dark:border-purple-800">Company</span>
                        ) : (
                            <span className="text-[10px] bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full font-black uppercase border border-blue-100 dark:border-blue-800">Individual</span>
                        )}
                    </td>
                    <td className="p-4 text-gray-600 dark:text-gray-300 text-sm font-medium">{customer.phone}</td>
                    <td className="p-4 text-gray-500 dark:text-gray-400 max-w-xs text-xs"><div className="flex items-start gap-1.5"><MapPin size={12} className="mt-0.5 flex-shrink-0 text-gray-400" /><span className="truncate">{getFormattedAddress(customer)}</span></div></td>
                    <td className="p-4 text-right space-x-1">
                        <button onClick={() => handleEdit(customer)} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"><Edit2 size={18} /></button>
                        <button onClick={() => handleDelete(customer.id)} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"><Trash2 size={18} /></button>
                    </td>
                </tr>
                ))}
            </tbody>
            </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/30">
              <h2 className="text-xl font-bold dark:text-white flex items-center gap-2"><UserIcon className="text-blue-600" />{editingCustomer.id ? 'Edit Customer' : 'Add New Customer'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"><X size={20} className="text-gray-500" /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
              <div className="flex gap-4 p-1 bg-gray-100 dark:bg-gray-700 rounded-xl mb-2">
                  <button type="button" onClick={() => setEditingCustomer({...editingCustomer, type: 'INDIVIDUAL'})} className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${editingCustomer.type === 'INDIVIDUAL' ? 'bg-white dark:bg-gray-600 shadow text-blue-600 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>Individual</button>
                  <button type="button" onClick={() => setEditingCustomer({...editingCustomer, type: 'COMPANY'})} className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${editingCustomer.type === 'COMPANY' ? 'bg-white dark:bg-gray-600 shadow text-purple-600 dark:text-purple-300' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>Company</button>
              </div>

              {editingCustomer.type === 'COMPANY' && (
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-2xl space-y-4 border border-purple-100 dark:border-purple-800">
                      <div><label className="block text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-1 ml-1">Company Name *</label><input placeholder="e.g. Acme Corp" className="w-full p-2.5 border border-purple-200 dark:border-purple-800 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-purple-500" value={editingCustomer.companyName} onChange={e => setEditingCustomer({...editingCustomer, companyName: e.target.value})} required /></div>
                      <div><label className="block text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-1 ml-1">Tax ID (TIN) *</label><input placeholder="e.g. 123-456-789" className="w-full p-2.5 border border-purple-200 dark:border-purple-800 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono outline-none focus:ring-2 focus:ring-purple-500" value={editingCustomer.tin} onChange={e => setEditingCustomer({...editingCustomer, tin: e.target.value})} required /></div>
                      <div><label className="block text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-1 ml-1">Representative Name *</label><input placeholder="Full Name" className="w-full p-2.5 border border-purple-200 dark:border-purple-800 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-purple-500" value={editingCustomer.name} onChange={e => setEditingCustomer({...editingCustomer, name: e.target.value})} required /></div>
                  </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1 ml-1">Phone Number *</label>
                    <input placeholder="Phone Number" className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono outline-none focus:ring-2 focus:ring-blue-500" value={editingCustomer.phone} onChange={e => setEditingCustomer({...editingCustomer, phone: e.target.value})} required />
                  </div>
              </div>

              <div className="border-t dark:border-gray-700 pt-6">
                  <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><MapPin size={14} /> Primary Address *</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 ml-1">{editingCustomer.type === 'INDIVIDUAL' ? 'Building / House Name *' : 'Building / Floor *'}</label>
                        <input required placeholder="e.g. Trade Centre" className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" value={editingCustomer.type === 'INDIVIDUAL' ? editingCustomer.houseName : editingCustomer.buildingName} onChange={e => setEditingCustomer(editingCustomer.type === 'INDIVIDUAL' ? {...editingCustomer, houseName: e.target.value} : {...editingCustomer, buildingName: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 ml-1">Street Name</label>
                        <input placeholder="e.g. Main Street" className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" value={editingCustomer.type === 'INDIVIDUAL' ? editingCustomer.streetName : editingCustomer.street} onChange={e => setEditingCustomer(editingCustomer.type === 'INDIVIDUAL' ? {...editingCustomer, streetName: e.target.value} : {...editingCustomer, street: e.target.value})} />
                      </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 ml-1">Island / City *</label>
                    <input required placeholder="e.g. Male'" className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" value={editingCustomer.island} onChange={e => setEditingCustomer({...editingCustomer, island: e.target.value})} />
                  </div>
              </div>
            </form>

            <div className="p-6 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-900/30">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-sm font-bold text-gray-500 transition-colors">Cancel</button>
              <button onClick={handleSubmit} disabled={isSaving} className="px-8 py-2.5 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2">{isSaving && <Loader2 className="animate-spin" size={16} />}Save Customer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}