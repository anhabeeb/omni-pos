import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { Product, Store, Category } from '../types';
import { ArrowLeft, Plus, Edit2, Trash2, Search, List, Tag, Filter, Download, Upload, FileSpreadsheet, Image as ImageIcon, X } from 'lucide-react';
import { utils, writeFile, read } from 'xlsx';

export default function StoreMenu() {
  const { storeId } = useParams<{ storeId: string }>();
  const navigate = useNavigate();
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');
  
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  
  const [editingProduct, setEditingProduct] = useState<Partial<Product>>({
    name: '', price: 0, cost: 0, categoryId: '', isAvailable: true, imageUrl: ''
  });

  const [newCategoryName, setNewCategoryName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (storeId) {
      loadData();
      window.addEventListener(`db_change_store_${storeId}_products`, loadData);
      window.addEventListener(`db_change_store_${storeId}_categories`, loadData);
      return () => {
          window.removeEventListener(`db_change_store_${storeId}_products`, loadData);
          window.removeEventListener(`db_change_store_${storeId}_categories`, loadData);
      };
    }
  }, [storeId]);

  const loadData = async () => {
    if (!storeId) return;
    const stores = await db.getStores();
    setStore(stores.find(s => s.id === storeId) || null);
    setProducts(await db.getProducts(storeId));
    setCategories(await db.getCategories(storeId));
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId || !editingProduct.name) return;
    if (!editingProduct.categoryId) {
        alert("Please select a category");
        return;
    }

    if (editingProduct.id) {
      await db.updateProduct(storeId, editingProduct as Product);
    } else {
      await db.addProduct(storeId, editingProduct as Product);
    }
    setIsProductModalOpen(false);
    resetProductForm();
  };

  const handleAddCategory = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!storeId || !newCategoryName.trim()) return;
      await db.addCategory(storeId, { name: newCategoryName } as Category);
      setNewCategoryName('');
  };

  const handleDeleteCategory = async (id: string) => {
      if (!storeId) return;
      const inUse = products.some(p => p.categoryId === id);
      if (inUse) {
          alert("Cannot delete category. It is assigned to one or more products.");
          return;
      }
      if (confirm("Delete this category?")) {
          await db.deleteCategory(storeId, id);
      }
  };

  const resetProductForm = () => {
      setEditingProduct({ name: '', price: 0, cost: 0, categoryId: '', isAvailable: true, imageUrl: '' });
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setIsProductModalOpen(true);
  };

  const handleDeleteProduct = async (id: string) => {
    if (confirm('Delete this product?')) {
      if (storeId) await db.deleteProduct(storeId, id);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          if (file.size > 500000) { 
              alert("Image is too large. Please choose an image under 500KB.");
              return;
          }
          const reader = new FileReader();
          reader.onloadend = () => {
              setEditingProduct(prev => ({ ...prev, imageUrl: reader.result as string }));
          };
          reader.readAsDataURL(file);
      }
  };

  const getCategoryName = (catId: string) => {
      const cat = categories.find(c => c.id === catId);
      return cat ? `${cat.orderId}. ${cat.name}` : 'Unknown';
  };

  const handleExport = () => {
      if (!products.length) {
          alert("No products to export.");
          return;
        }

      const exportData = products.map(p => ({
          ID: p.id,
          Name: p.name,
          Category: categories.find(c => c.id === p.categoryId)?.name || 'Unknown',
          Price_Excl_Tax: p.price,
          Price_Incl_Tax: (p.price * (1 + (store?.taxRate || 0) / 100)),
          Cost: p.cost || 0,
          Status: p.isAvailable ? 'Available' : 'Unavailable'
      }));

      const ws = utils.json_to_sheet(exportData);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Menu");
      const dateStr = new Date().toISOString().split('T')[0];
      writeFile(wb, `${store?.name || 'Store'}_Menu_${dateStr}.xlsx`);
  };

  const downloadTemplate = () => {
      const templateData = [
          { Name: 'Cheese Burger', Category: 'Mains', Price: 10.50, Cost: 3.50, IsAvailable: 'Yes' },
          { Name: 'Cola', Category: 'Drinks', Price: 2.50, Cost: 0.80, IsAvailable: 'Yes' },
      ];
      const ws = utils.json_to_sheet(templateData);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Template");
      writeFile(wb, "Menu_Import_Template.xlsx");
  };

  const triggerImport = () => { fileInputRef.current?.click(); };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0 || !storeId) return;
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = async (event) => {
          try {
              const bstr = event.target?.result;
              const wb = read(bstr, { type: 'binary' });
              const wsName = wb.SheetNames[0];
              const ws = wb.Sheets[wsName];
              const data = utils.sheet_to_json<any>(ws);
              if (data.length === 0) { alert("File is empty."); return; }
              let addedCount = 0;
              let localCategories = await db.getCategories(storeId);
              for (const row of data) {
                  if (!row.Name || !row.Category || !row.Price) continue; 
                  const catName = row.Category.trim();
                  let category = localCategories.find(c => c.name.toLowerCase() === catName.toLowerCase());
                  if (!category) {
                      category = await db.addCategory(storeId, { name: catName } as Category);
                      localCategories.push(category);
                  }
                  await db.addProduct(storeId, {
                      id: '', 
                      name: row.Name,
                      categoryId: category.id,
                      price: parseFloat(row.Price),
                      cost: row.Cost ? parseFloat(row.Cost) : 0,
                      isAvailable: row.IsAvailable === 'No' || row.IsAvailable === false ? false : true,
                      storeId: storeId
                  } as Product);
                  addedCount++;
              }
              alert(`Imported ${addedCount} products.`);
              if (fileInputRef.current) fileInputRef.current.value = '';
          } catch (error) {
              alert("Error parsing file.");
          }
      };
      reader.readAsBinaryString(file);
  };

  const filteredProducts = products.filter(p => {
    const term = searchTerm.toLowerCase();
    const catName = getCategoryName(p.categoryId).toLowerCase();
    const matchesSearch = p.name.toLowerCase().includes(term) || catName.includes(term) || p.id.toLowerCase().includes(term);
    const matchesCategory = selectedCategoryFilter === 'ALL' || p.categoryId === selectedCategoryFilter;
    const matchesStatus = selectedStatusFilter === 'ALL' || (selectedStatusFilter === 'AVAILABLE' ? p.isAvailable : !p.isAvailable);
    return matchesSearch && matchesCategory && matchesStatus;
  });

  if (!store) return <div className="p-8 text-center text-gray-500">Loading Store Menu...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full text-gray-700 dark:text-gray-300 transition-colors"><ArrowLeft size={24} /></button>
            <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Menu Management</h1>
            <p className="text-gray-500 dark:text-gray-400">{store.name}</p>
            </div>
        </div>
        <div className="flex-1"></div>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls, .csv" />
        <div className="flex flex-wrap gap-2">
            <button onClick={downloadTemplate} className="flex items-center gap-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 text-sm transition-all"><FileSpreadsheet size={18} /> Template</button>
            <button onClick={triggerImport} className="flex items-center gap-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 text-sm transition-all"><Upload size={18} /> Import</button>
            <button onClick={handleExport} className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 text-sm shadow-sm transition-all"><Download size={18} /> Export</button>
        </div>
        <div className="flex flex-wrap gap-2">
            <button onClick={() => setIsCategoryModalOpen(true)} className="flex items-center gap-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-all font-bold"><List size={18} /> Categories</button>
            <button onClick={() => { resetProductForm(); setIsProductModalOpen(true); }} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 shadow-md transition-all font-bold"><Plus size={18} /> Add Product</button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative flex-1 w-full md:max-w-md">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Search menu items..." 
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto">
              <select value={selectedCategoryFilter} onChange={(e) => setSelectedCategoryFilter(e.target.value)} className="p-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="ALL">All Categories</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.orderId}. {c.name}</option>)}
              </select>
              <select value={selectedStatusFilter} onChange={(e) => setSelectedStatusFilter(e.target.value)} className="p-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="ALL">All Status</option>
                  <option value="AVAILABLE">Available</option>
                  <option value="UNAVAILABLE">Unavailable</option>
              </select>
          </div>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[1000px]">
            <thead className="bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-[10px] font-black uppercase tracking-widest border-b border-gray-200 dark:border-gray-700">
                <tr><th className="p-4">ID</th><th className="p-4">Image</th><th className="p-4">Name</th><th className="p-4">Category</th><th className="p-4">Price</th><th className="p-4">Incl. Tax</th><th className="p-4">Status</th><th className="p-4 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors group">
                    <td className="p-4 text-gray-400 font-mono text-xs">{product.id}</td>
                    <td className="p-4"><div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden border dark:border-gray-600 flex items-center justify-center">{product.imageUrl ? <img src={product.imageUrl} className="w-full h-full object-cover" /> : <ImageIcon size={16} className="text-gray-400" />}</div></td>
                    <td className="p-4 font-bold text-gray-900 dark:text-white">{product.name}</td>
                    <td className="p-4"><span className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-lg text-xs font-black uppercase tracking-tight">{getCategoryName(product.categoryId)}</span></td>
                    <td className="p-4 font-bold text-gray-700 dark:text-gray-200">{store.currency}{product.price.toFixed(2)}</td>
                    <td className="p-4 font-black text-blue-600 dark:text-blue-400">{store.currency}{(product.price * (1 + (store?.taxRate || 0) / 100)).toFixed(2)}</td>
                    <td className="p-4"><span className={`px-2 py-1 text-xs rounded-full font-black uppercase ${product.isAvailable ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>{product.isAvailable ? 'Available' : 'Unavailable'}</span></td>
                    <td className="p-4 text-right space-x-1">
                        <button onClick={() => handleEditProduct(product)} className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all"><Edit2 size={18} /></button>
                        <button onClick={() => handleDeleteProduct(product.id)} className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"><Trash2 size={18} /></button>
                    </td>
                </tr>
                ))}
                {filteredProducts.length === 0 && (
                    <tr><td colSpan={8} className="p-20 text-center text-gray-400 italic">No products match your filters.</td></tr>
                )}
            </tbody>
            </table>
        </div>
      </div>

      {/* Product Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6 border-b dark:border-gray-700 pb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Tag className="text-blue-600" />
                    {editingProduct.id ? 'Edit Product Details' : 'Create New Menu Item'}
                </h2>
                <button onClick={() => setIsProductModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleProductSubmit} className="space-y-6">
              <div className="flex flex-col md:flex-row gap-6 items-start">
                  <div className="w-full md:w-40 flex-shrink-0">
                      <div 
                        onClick={() => imageInputRef.current?.click()} 
                        className="w-full h-40 bg-gray-50 dark:bg-gray-900 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl flex flex-col items-center justify-center cursor-pointer overflow-hidden relative group hover:border-blue-500 transition-all"
                      >
                          {editingProduct.imageUrl ? (
                              <img src={editingProduct.imageUrl} className="w-full h-full object-cover" />
                          ) : (
                              <div className="flex flex-col items-center text-gray-400">
                                  <ImageIcon size={32}/>
                                  <span className="text-[10px] font-bold mt-2 uppercase tracking-widest">Upload Photo</span>
                              </div>
                          )}
                          {editingProduct.imageUrl && (
                              <button 
                                type="button" 
                                onClick={(e) => { e.stopPropagation(); setEditingProduct({...editingProduct, imageUrl:''}); }} 
                                className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                  <X size={14}/>
                              </button>
                          )}
                      </div>
                      <input type="file" ref={imageInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
                      <p className="text-[9px] text-gray-400 mt-2 text-center">Supported: JPG, PNG (Max 500KB)</p>
                  </div>
                  
                  <div className="flex-1 space-y-4 w-full">
                      <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Product Name *</label>
                        <input 
                            placeholder="e.g. Signature Beef Burger" 
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
                            value={editingProduct.name} 
                            onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} 
                            required 
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Category *</label>
                        <select 
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-bold appearance-none outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
                            value={editingProduct.categoryId} 
                            onChange={e => setEditingProduct({...editingProduct, categoryId: e.target.value})} 
                            required
                        >
                            <option value="">Choose a category...</option>
                            {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.orderId}. {cat.name}</option>)}
                        </select>
                      </div>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Sale Price ({store.currency}) *</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    placeholder="0.00" 
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
                    value={editingProduct.price || ''} 
                    onChange={e => setEditingProduct({...editingProduct, price: parseFloat(e.target.value) || 0})} 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Item Cost ({store.currency})</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    placeholder="0.00" 
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
                    value={editingProduct.cost || ''} 
                    onChange={e => setEditingProduct({...editingProduct, cost: parseFloat(e.target.value) || 0})} 
                  />
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                    <input 
                        type="checkbox" 
                        id="isAvailable"
                        checked={editingProduct.isAvailable} 
                        onChange={e => setEditingProduct({...editingProduct, isAvailable: e.target.checked})} 
                        className="w-5 h-5 text-blue-600 rounded-lg cursor-pointer transition-all"
                    />
                    <label htmlFor="isAvailable" className="text-sm font-black uppercase text-gray-700 dark:text-gray-300 cursor-pointer">Available for Ordering</label>
                </div>
                <p className="text-[10px] text-gray-500 mt-2 ml-8 italic">If unchecked, this item will be hidden from the POS terminal menu.</p>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t dark:border-gray-700">
                <button 
                    type="button" 
                    onClick={() => setIsProductModalOpen(false)} 
                    className="px-6 py-3 text-sm font-bold text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all"
                >
                    Discard
                </button>
                <button 
                    type="submit" 
                    className="px-10 py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-[0.98]"
                >
                    {editingProduct.id ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {isCategoryModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                  <div className="flex justify-between items-center mb-6 border-b dark:border-gray-700 pb-4">
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          <List className="text-blue-600" />
                          Manage Categories
                      </h2>
                      <button onClick={() => setIsCategoryModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"><X size={20}/></button>
                  </div>
                  
                  <form onSubmit={handleAddCategory} className="flex gap-2 mb-8">
                      <input 
                        placeholder="Add new category..." 
                        className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500" 
                        value={newCategoryName} 
                        onChange={e => setNewCategoryName(e.target.value)} 
                        required 
                      />
                      <button 
                        type="submit" 
                        className="bg-blue-600 text-white px-5 rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all"
                      >
                          <Plus size={24}/>
                      </button>
                  </form>
                  
                  <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-1">
                      {categories.length === 0 && <p className="text-center text-gray-400 py-10 italic">No categories defined yet.</p>}
                      {categories.map(cat => (
                          <div key={cat.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700 group transition-all">
                              <span className="font-black text-gray-700 dark:text-gray-200 uppercase text-xs tracking-tight">
                                  <span className="text-blue-500 mr-2 opacity-50">{cat.orderId}.</span>
                                  {cat.name}
                              </span>
                              <button 
                                onClick={() => handleDeleteCategory(cat.id)} 
                                className="text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 p-1.5 rounded-lg transition-all"
                              >
                                  <Trash2 size={16}/>
                              </button>
                          </div>
                      ))}
                  </div>
                  
                  <div className="mt-6 pt-4 border-t dark:border-gray-700 text-center">
                      <button 
                        onClick={() => setIsCategoryModalOpen(false)}
                        className="text-xs font-black text-blue-600 uppercase tracking-widest hover:underline"
                      >
                        Done
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}