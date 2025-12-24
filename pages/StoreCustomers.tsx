
import React, { useEffect, useState } from 'react';
// @ts-ignore - Fixing missing member errors in react-router-dom
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { Customer, Store } from '../types';
import { ArrowLeft, Plus, Edit2, Trash2, Search, User as UserIcon, Building2, MapPin, Loader2 } from 'lucide-react';

export default function StoreCustomers() {
  const { storeId } = useParams<{ storeId: string }>();
  const navigate = useNavigate();
  const [store, setStore] = useState<Store | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [editingCustomer, setEditingCustomer] = useState<Partial<Customer>>({
    name: '', 
    phone: '', 
    type: 'INDIVIDUAL', 
    companyName: '', 
    tin: '',
    houseName: '',
    streetName: '',
    buildingName: '',
    street: '',
    island: '',
    country: ''
  });

  useEffect(() => {
    if (storeId) {
      loadData();
      window.addEventListener(`db_change_store_${storeId}_customers`, loadData);
      return () => window.removeEventListener(`db_change_store_${storeId}_customers`, loadData);
    }
  }, [storeId]);

  const loadData = async () => {
    if (!storeId) return;
    const numericStoreId = Number(storeId);
    const stores = await db.getStores();
    setStore(stores.find(s => s.id === numericStoreId) || null);
    setCustomers(await db.getCustomers(numericStoreId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId || !editingCustomer.name || isSaving) return;
    const numericStoreId = Number(storeId);

    const finalCustomer = { ...editingCustomer };
    if (finalCustomer.type === 'INDIVIDUAL') {
        finalCustomer.companyName = undefined;
        finalCustomer.tin = undefined;
        finalCustomer.buildingName = undefined;
        finalCustomer.street = undefined;
        finalCustomer.island = undefined;
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
          // Fix: id should be 0 for auto-increment
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
        name: '', 
        phone: '', 
        type: 'INDIVIDUAL', 
        companyName: '', 
        tin: '',
        houseName: '',
        streetName: '',
        buildingName: '',
        street: '',
        island: '',
        country: ''
    });
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsModalOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm('Delete this customer?')) {
      if (storeId) db.deleteCustomer(Number(storeId), id);
    }
  };

  const filteredCustomers = customers.filter(c => {
    const term = searchTerm.toLowerCase();
    
    const nameMatch = c.name.toLowerCase().includes(term);
    const phoneMatch = c.phone.includes(term);
    const companyMatch = c.companyName?.toLowerCase().includes(term);
    const tinMatch = c.tin?.includes(term);
    
    const addressFields = [
        c.houseName, 
        c.streetName, 
        c.buildingName, 
        c.street, 
        c.island, 
        c.country, 
        c.address
    ].filter(Boolean).join(' ').toLowerCase();
    
    const addressMatch = addressFields.includes(term);

    return nameMatch || phoneMatch || companyMatch || tinMatch || addressMatch;
  });

  const getFormattedAddress = (c: Customer) => {
      if (c.type === 'INDIVIDUAL') {
          const parts = [c.houseName, c.streetName, c.address].filter(Boolean);
          return parts.length > 0 ? parts.join(', ') : '-';
      } else {
          const parts = [c.buildingName, c.street, c.island, c.country, c.address].filter(Boolean);
          return parts.length > 0 ? parts.join(', ') : '-';
      }
  };

  if (!store) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full text-gray-700 dark:text-gray-300">
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Customer Management</h1>
          <p className="text-gray-500 dark:text-gray-400">{store.name}</p>
        </div>
        <div className="flex-1"></div>
        <button 
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 whitespace-nowrap"
        >
          <Plus size={18} /> <span className="hidden md:inline">Add Customer</span>
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by name, phone, address, TIN..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[800px]">
            <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-sm border-b border-gray-200 dark:border-gray-700">
                <tr>
                <th className="p-4 w-16">#</th>
                <th className="p-4">Customer Details</th>
                <th className="p-4">Type</th>
                <th className="p-4">Contact Info</th>
                <th className="p-4">Address</th>
                <th className="p-4 text-right">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredCustomers.map((customer, index) => (
                <tr key={customer.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="p-4 text-gray-500 dark:text-gray-400 font-mono text-xs">{index + 1}</td>
                    <td className="p-4">
                    <div className="font-medium text-gray-900 dark:text-white">{customer.name}</div>
                    {customer.type === 'COMPANY' && customer.companyName && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                            <Building2 size={10} /> {customer.companyName}
                        </div>
                    )}
                    {customer.tin && (
                        <div className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1 rounded w-fit mt-1">
                            TIN: {customer.tin}
                        </div>
                    )}
                    </td>
                    <td className="p-4">
                        {customer.type === 'COMPANY' ? (
                            <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-1 rounded-full font-bold">Company</span>
                        ) : (
                            <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full font-bold">Individual</span>
                        )}
                    </td>
                    <td className="p-4 text-gray-600 dark:text-gray-300">{customer.phone}</td>
                    <td className="p-4 text-gray-600 dark:text-gray-300 max-w-xs text-sm">
                        <div className="flex items-start gap-1">
                            <MapPin size={14} className="mt-0.5 flex-shrink-0 text-gray-400" />
                            <span className="truncate">{getFormattedAddress(customer)}</span>
                        </div>
                    </td>
                    <td className="p-4 text-right space-x-2">
                    <button onClick={() => handleEdit(customer)} className="text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 p-2 rounded">
                        <Edit2 size={18} />
                    </button>
                    <button onClick={() => handleDelete(customer.id)} className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 p-2 rounded">
                        <Trash2 size={18} />
                    </button>
                    </td>
                </tr>
                ))}
            </tbody>
            </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">{editingCustomer.id ? 'Edit' : 'Add'} Customer</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              
              <div className="flex gap-4 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg mb-4">
                  <button
                    type="button"
                    onClick={() => setEditingCustomer({...editingCustomer, type: 'INDIVIDUAL'})}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${editingCustomer.type === 'INDIVIDUAL' ? 'bg-white dark:bg-gray-600 shadow text-blue-600 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                  >
                      Individual
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingCustomer({...editingCustomer, type: 'COMPANY'})}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${editingCustomer.type === 'COMPANY' ? 'bg-white dark:bg-gray-600 shadow text-purple-600 dark:text-purple-300' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                  >
                      Company
                  </button>
              </div>

              {editingCustomer.type === 'COMPANY' && (
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg space-y-3 border border-purple-100 dark:border-purple-800">
                      <div>
                        <label className="block text-xs font-semibold text-purple-800 dark:text-purple-300 mb-1">Company Name</label>
                        <input 
                            placeholder="e.g. Acme Corp" 
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            value={editingCustomer.companyName}
                            onChange={e => setEditingCustomer({...editingCustomer, companyName: e.target.value})}
                            required={editingCustomer.type === 'COMPANY'}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-purple-800 dark:text-purple-300 mb-1">Tax Identification Number (TIN)</label>
                        <input 
                            placeholder="e.g. 123-456-789" 
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            value={editingCustomer.tin}
                            onChange={e => setEditingCustomer({...editingCustomer, tin: e.target.value})}
                            required={editingCustomer.type === 'COMPANY'}
                        />
                      </div>
                  </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Contact Person / Customer Name</label>
                    <input 
                        placeholder="Full Name" 
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                        value={editingCustomer.name}
                        onChange={e => setEditingCustomer({...editingCustomer, name: e.target.value})}
                        required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Phone Number</label>
                    <input 
                        placeholder="Phone Number" 
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                        value={editingCustomer.phone}
                        onChange={e => setEditingCustomer({...editingCustomer, phone: e.target.value})}
                        required
                    />
                  </div>
              </div>

              <div className="border-t border-gray-100 dark:border-gray-700 pt-4 mt-2">
                  <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                      <MapPin size={16} /> Address Details
                  </h3>
                  
                  {editingCustomer.type === 'INDIVIDUAL' ? (
                      <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">House Name / Building</label>
                            <input 
                                placeholder="e.g. Rose Villa, Apt 4B" 
                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                                value={editingCustomer.houseName}
                                onChange={e => setEditingCustomer({...editingCustomer, houseName: e.target.value})}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Street Name</label>
                            <input 
                                placeholder="e.g. Orchid Magu" 
                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                                value={editingCustomer.streetName}
                                onChange={e => setEditingCustomer({...editingCustomer, streetName: e.target.value})}
                            />
                          </div>
                      </div>
                  ) : (
                      <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Building Name</label>
                                <input 
                                    placeholder="e.g. Trade Centre" 
                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                                    value={editingCustomer.buildingName}
                                    onChange={e => setEditingCustomer({...editingCustomer, buildingName: e.target.value})}
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Street</label>
                                <input 
                                    placeholder="e.g. Main Street" 
                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                                    value={editingCustomer.street}
                                    onChange={e => setEditingCustomer({...editingCustomer, street: e.target.value})}
                                />
                              </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Island / Atoll</label>
                                <input 
                                    placeholder="e.g. Male'" 
                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                                    value={editingCustomer.island}
                                    onChange={e => setEditingCustomer({...editingCustomer, island: e.target.value})}
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Country</label>
                                <input 
                                    placeholder="e.g. Maldives" 
                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                                    value={editingCustomer.country}
                                    onChange={e => setEditingCustomer({...editingCustomer, country: e.target.value})}
                                />
                              </div>
                          </div>
                      </div>
                  )}
              </div>

              <div className="flex justify-end gap-2 mt-6 border-t border-gray-100 dark:border-gray-700 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">Cancel</button>
                <button 
                    type="submit" 
                    disabled={isSaving}
                    className="px-6 py-2 bg-blue-600 text-white rounded font-bold shadow-md hover:bg-blue-700 flex items-center gap-2"
                >
                    {isSaving && <Loader2 className="animate-spin" size={16} />}
                    Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
