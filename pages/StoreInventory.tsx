
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { InventoryItem, Store } from '../types';
import { ArrowLeft, Plus, Edit2, Trash2, Search, AlertTriangle } from 'lucide-react';

export default function StoreInventory() {
  const { storeId } = useParams<{ storeId: string }>();
  const navigate = useNavigate();
  const [store, setStore] = useState<Store | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [editingItem, setEditingItem] = useState<Partial<InventoryItem>>({
    name: '', quantity: 0, unit: 'kg', minLevel: 0
  });

  useEffect(() => {
    if (storeId) {
      loadData();
      window.addEventListener(`db_change_store_${storeId}_inventory`, loadData);
      return () => window.removeEventListener(`db_change_store_${storeId}_inventory`, loadData);
    }
  }, [storeId]);

  // Fixed: Made loadData async and awaited DB calls
  const loadData = async () => {
    if (!storeId) return;
    const stores = await db.getStores();
    setStore(stores.find(s => s.id === storeId) || null);
    setItems(await db.getInventory(storeId));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId || !editingItem.name) return;

    if (editingItem.id) {
      db.updateInventoryItem(storeId, editingItem as InventoryItem);
    } else {
      db.addInventoryItem(storeId, editingItem as InventoryItem);
    }
    setIsModalOpen(false);
    setEditingItem({ name: '', quantity: 0, unit: 'kg', minLevel: 0 });
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this inventory item?')) {
      if (storeId) db.deleteInventoryItem(storeId, id);
    }
  };

  const filteredItems = items.filter(i => 
    i.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!store) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full text-gray-700 dark:text-gray-300">
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Inventory Management</h1>
          <p className="text-gray-500 dark:text-gray-400">{store.name}</p>
        </div>
        <div className="flex-1"></div>
        <button 
          onClick={() => {
            setEditingItem({ name: '', quantity: 0, unit: 'kg', minLevel: 0 });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus size={18} /> Add Item
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search inventory..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
            <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-sm border-b border-gray-200 dark:border-gray-700">
                <tr>
                <th className="p-4 w-16">#</th>
                <th className="p-4">Item Name</th>
                <th className="p-4">Quantity</th>
                <th className="p-4">Unit</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredItems.map((item, index) => (
                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="p-4 text-gray-500 dark:text-gray-400 font-mono text-xs">{index + 1}</td>
                    <td className="p-4 font-medium text-gray-900 dark:text-white">{item.name}</td>
                    <td className="p-4 font-bold text-gray-800 dark:text-gray-200">{item.quantity}</td>
                    <td className="p-4 text-gray-600 dark:text-gray-400">{item.unit}</td>
                    <td className="p-4">
                    {item.quantity <= item.minLevel ? (
                        <span className="flex items-center gap-1 text-red-600 dark:text-red-400 text-xs font-bold bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded-full w-fit">
                        <AlertTriangle size={12} /> Low Stock
                        </span>
                    ) : (
                        <span className="text-green-700 dark:text-green-400 text-xs font-bold bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full">OK</span>
                    )}
                    </td>
                    <td className="p-4 text-right space-x-2">
                    <button onClick={() => handleEdit(item)} className="text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 p-2 rounded">
                        <Edit2 size={18} />
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 p-2 rounded">
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
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl w-full max-w-md shadow-xl">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">{editingItem.id ? 'Edit' : 'Add'} Inventory Item</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input 
                placeholder="Item Name" 
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                value={editingItem.name}
                onChange={e => setEditingItem({...editingItem, name: e.target.value})}
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <input 
                  type="number"
                  placeholder="Quantity" 
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                  value={editingItem.quantity}
                  onChange={e => setEditingItem({...editingItem, quantity: parseFloat(e.target.value)})}
                  required
                />
                 <input 
                  placeholder="Unit (e.g. kg, pcs)" 
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                  value={editingItem.unit}
                  onChange={e => setEditingItem({...editingItem, unit: e.target.value})}
                  required
                />
              </div>
              <input 
                  type="number"
                  placeholder="Low Stock Alert Threshold" 
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                  value={editingItem.minLevel}
                  onChange={e => setEditingItem({...editingItem, minLevel: parseFloat(e.target.value)})}
                  required
                />

              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
