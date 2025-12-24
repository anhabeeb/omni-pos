
import React, { useEffect, useState, useRef } from 'react';
// @ts-ignore - Fixing missing member errors in react-router-dom
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { Product, Store, Category } from '../types';
// Fixed: Added Percent to lucide-react imports
import { ArrowLeft, Plus, Edit2, Trash2, Search, List, Tag, Filter, Download, Upload, FileSpreadsheet, Image as ImageIcon, X, AlertCircle, Loader2, Info, Percent } from 'lucide-react';
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
  const [isSaving, setIsSaving] = useState(false);
  
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
    if (!storeId || !editingProduct.name || isSaving) return;
    if (!editingProduct.categoryId) {
        alert("Please select a category");
        return;
    }

    setIsSaving(true);
    try {
        if (editingProduct.id) {
          await db.updateProduct(storeId, editingProduct as Product);
        } else {
          await db.addProduct(storeId, editingProduct as Product);
        }
        setIsProductModalOpen(false);
        resetProductForm();
    } finally {
        setIsSaving(false);
    }
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
      return cat ? cat.name : 'Unknown';
  };

  const handleExport = () => {
      if (!products.length) {
          alert("No products to export.");
          return;
        }

      const exportData = products.map(p => ({
          Name: p.name,
          Category: categories.find(c => c.id === p.categoryId)?.name || 'Unknown',
          Price: p.price,
          Cost: p.cost || 0,
          IsAvailable: p.isAvailable ? 'Yes' : 'No'
      }));

      const ws = utils.json_to_sheet(exportData);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Menu");
      const dateStr = new Date().toISOString().split('T')[0];
      writeFile(wb, `${store?.name || 'Store'}_Menu_${dateStr}.xlsx`);
  };

  const handleDownloadTemplate = () => {
      const templateData = [{
          'Name': 'Cheese Burger',
          'Category': 'Main Course',
          'Price': 15.50,
          'Cost': 5.20,
          'IsAvailable': 'Yes'
      }, {
          'Name': 'Iced Peach Tea',
          'Category': 'Beverages',
          'Price': 4.00,
          'Cost': 0.80,
          'IsAvailable': 'Yes'
      }];

      const ws = utils.json_to_sheet(templateData);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Menu_Template");
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
                  // Allow Name, Category, Price as required
                  const prodName = row.Name || row.name;
                  const catNameInput = row.Category || row.category;
                  const priceInput = row.Price || row.price;

                  if (!prodName || !catNameInput || priceInput === undefined) continue; 
                  
                  const catName = catNameInput.trim();
                  let category = localCategories.find(c => c.name.toLowerCase() === catName.toLowerCase());
                  
                  if (!category) {
                      category = await db.addCategory(storeId, { name: catName } as Category);
                      localCategories.push(category);
                  }

                  const costInput = row.Cost || row.cost || 0;
                  const availInput = row.IsAvailable || row.isAvailable;
                  
                  await db.addProduct(storeId, {
                      id: '', 
                      name: prodName,
                      categoryId: category.id,
                      price: parseFloat(priceInput),
                      cost: parseFloat(costInput),
                      isAvailable: availInput === 'No' || availInput === 'no' || availInput === false ? false : true,
                      storeId: storeId
                  } as Product);
                  addedCount++;
              }
              alert(`Imported ${addedCount} products successfully.`);
              if (fileInputRef.current) fileInputRef.current.value = '';
          } catch (error) {
              console.error("Import error:", error);
              alert("Error parsing file. Ensure it is a valid Excel/CSV file.");
          }
      };
      reader.readAsBinaryString(file);
  };

  const filteredProducts = products.filter(p => {
    const term = searchTerm.toLowerCase();
    const catName = getCategoryName(p.categoryId).toLowerCase();
    const matchesSearch = p.name.toLowerCase().includes(term) || catName.includes(term);
    const matchesCategory = selectedCategoryFilter === 'ALL' || p.categoryId === selectedCategoryFilter;
    const matchesStatus = selectedStatusFilter === 'ALL' || (selectedStatusFilter === 'AVAILABLE' ? p.isAvailable : !p.isAvailable);
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const calculateInclTax = (price: number) => {
    const taxRate = store?.taxRate || 0;
    return price * (1 + taxRate / 100);
  };

  if (!store) return <div className="p-12 text-center text-gray-500">Loading store configuration...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full text-gray-700 dark:text-gray-300 transition-colors">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Menu Management</h1>
            <p className="text-gray-500 dark:text-gray-400">{store.name}</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={handleDownloadTemplate} 
            className="flex items-center gap-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm text-sm font-bold"
            title="Download Import Template"
          >
            <FileSpreadsheet size={18} /> Template
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm text-sm font-bold">
            <Download size={18} /> Export
          </button>
          <button onClick={triggerImport} className="flex items-center gap-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm text-sm font-bold">
            <Upload size={18} /> Import
            <input ref={fileInputRef} type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileChange} />
          </button>
          <button onClick={() => setIsCategoryModalOpen(true)} className="flex items-center gap-2 bg-purple-50 text-purple-700 px-4 py-2 rounded-lg border border-purple-100 hover:bg-purple-100 transition-all shadow-sm text-sm font-bold">
            <Tag size={18} /> Categories
          </button>
          <button onClick={() => { resetProductForm(); setIsProductModalOpen(true); }} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all shadow-md text-sm font-bold">
            <Plus size={18} /> Add Product
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search products by name or category..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <select 
              value={selectedCategoryFilter} 
              onChange={e => setSelectedCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg outline-none bg-white dark:bg-gray-900 text-sm"
            >
              <option value="ALL">All Categories</option>
              {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
            <select 
              value={selectedStatusFilter} 
              onChange={e => setSelectedStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg outline-none bg-white dark:bg-gray-900 text-sm"
            >
              <option value="ALL">All Status</option>
              <option value="AVAILABLE">Available</option>
              <option value="UNAVAILABLE">Unavailable</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-xs font-black uppercase tracking-wider border-b">
              <tr>
                <th className="p-4">Item</th>
                <th className="p-4">Category</th>
                <th className="p-4 text-right">Price (Excl.)</th>
                <th className="p-4 text-right">Price (Incl.)</th>
                <th className="p-4 text-right">Cost</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {filteredProducts.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors group">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center text-gray-400 overflow-hidden">
                        {p.imageUrl ? <img src={p.imageUrl} className="w-full h-full object-cover" /> : <ImageIcon size={20} />}
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 dark:text-white">{p.name}</div>
                        <div className="text-[10px] text-gray-400 font-mono">ID: {p.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-xs font-medium px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
                      {getCategoryName(p.categoryId)}
                    </span>
                  </td>
                  <td className="p-4 text-right font-bold text-gray-500 dark:text-gray-400">{store.currency}{p.price.toFixed(2)}</td>
                  <td className="p-4 text-right font-black text-blue-600 dark:text-blue-400">{store.currency}{calculateInclTax(p.price).toFixed(2)}</td>
                  <td className="p-4 text-right text-gray-500 text-sm">{store.currency}{(p.cost || 0).toFixed(2)}</td>
                  <td className="p-4">
                    <button 
                      onClick={() => db.updateProduct(storeId || '', { ...p, isAvailable: !p.isAvailable })}
                      className={`text-[10px] font-black uppercase px-2 py-1 rounded-full transition-all ${p.isAvailable ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                    >
                      {p.isAvailable ? 'Available' : 'Unavailable'}
                    </button>
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <button onClick={() => handleEditProduct(p)} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"><Edit2 size={18}/></button>
                    <button onClick={() => handleDeleteProduct(p.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"><Trash2 size={18}/></button>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr><td colSpan={7} className="p-12 text-center text-gray-400 italic">No products found matching your search.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50 dark:bg-gray-900/30">
              <h2 className="text-xl font-bold dark:text-white">{editingProduct.id ? 'Edit Product' : 'Add New Product'}</h2>
              <button onClick={() => setIsProductModalOpen(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"><X size={20}/></button>
            </div>
            <form onSubmit={handleProductSubmit} className="p-6 space-y-4">
              <div className="flex gap-4 items-center mb-6">
                <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center text-gray-400 relative overflow-hidden group cursor-pointer" onClick={() => imageInputRef.current?.click()}>
                  {editingProduct.imageUrl ? (
                    <>
                      <img src={editingProduct.imageUrl} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Edit2 size={20} className="text-white"/></div>
                    </>
                  ) : (
                    <>
                      <ImageIcon size={24} />
                      <span className="text-[10px] font-bold uppercase mt-1">Upload</span>
                    </>
                  )}
                  <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-tight mb-1">Product Name *</label>
                    <input required placeholder="e.g. Cheese Burger" className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500" value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-tight mb-1">Category *</label>
                    <select required className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500" value={editingProduct.categoryId} onChange={e => setEditingProduct({...editingProduct, categoryId: e.target.value})}>
                      <option value="">Select Category...</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-4">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Pricing & Tax</label>
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-[10px] font-black uppercase">
                        <Percent size={12}/> Tax Rate: {store.taxRate}%
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="block text-[10px] font-black text-gray-500 uppercase ml-1">Base Price (Excl. Tax) *</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-gray-400 text-sm font-bold">{store.currency}</span>
                            <input 
                                required 
                                type="number" 
                                step="0.01" 
                                className="w-full pl-8 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500" 
                                value={editingProduct.price || ''} 
                                onChange={e => setEditingProduct({...editingProduct, price: parseFloat(e.target.value) || 0})} 
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="block text-[10px] font-black text-blue-600 uppercase ml-1">Selling Price (Incl. Tax)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-blue-400 text-sm font-bold">{store.currency}</span>
                            <div className="w-full pl-8 pr-4 py-2 border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl text-blue-700 dark:text-blue-300 font-black text-lg">
                                {calculateInclTax(editingProduct.price || 0).toFixed(2)}
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-[10px] text-blue-600 dark:text-blue-400 font-bold border border-blue-100 dark:border-blue-800">
                    <Info size={12} />
                    Tax Amount: {store.currency}{((editingProduct.price || 0) * (store.taxRate || 0) / 100).toFixed(2)}
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-black text-gray-500 uppercase ml-1">Cost Price (For Margin calculation)</label>
                <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-400 text-sm font-bold">{store.currency}</span>
                    <input type="number" step="0.01" className="w-full pl-8 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500" value={editingProduct.cost || ''} onChange={e => setEditingProduct({...editingProduct, cost: parseFloat(e.target.value) || 0})} />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input type="checkbox" id="avail" className="w-5 h-5 text-blue-600 rounded" checked={editingProduct.isAvailable} onChange={e => setEditingProduct({...editingProduct, isAvailable: e.target.checked})} />
                <label htmlFor="avail" className="text-sm font-bold text-gray-700 dark:text-gray-300">Item is available for sale</label>
              </div>
              <div className="flex justify-end gap-3 pt-6 border-t dark:border-gray-700">
                <button type="button" onClick={() => setIsProductModalOpen(false)} className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
                <button 
                    type="submit" 
                    disabled={isSaving}
                    className="px-8 py-2.5 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 flex items-center gap-2 active:scale-95 transition-all"
                >
                    {isSaving && <Loader2 className="animate-spin" size={16} />}
                    Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Categories Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50 dark:bg-gray-900/30">
              <h2 className="text-xl font-bold dark:text-white flex items-center gap-2"><Tag className="text-purple-600"/> Manage Categories</h2>
              <button onClick={() => setIsCategoryModalOpen(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"><X size={20}/></button>
            </div>
            <div className="p-6">
              <form onSubmit={handleAddCategory} className="flex gap-2 mb-6">
                <input 
                  placeholder="New Category Name..." 
                  className="flex-1 p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-purple-500" 
                  value={newCategoryName} 
                  onChange={e => setNewCategoryName(e.target.value)} 
                />
                <button type="submit" className="bg-purple-600 text-white p-2.5 rounded-xl hover:bg-purple-700 transition-all shadow-lg shadow-purple-500/20"><Plus size={24}/></button>
              </form>
              <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                {categories.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600">
                    <span className="font-bold dark:text-gray-200">{cat.name}</span>
                    <button onClick={() => handleDeleteCategory(cat.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"><Trash2 size={16}/></button>
                  </div>
                ))}
                {categories.length === 0 && <p className="text-center text-gray-400 py-4 italic">No categories defined yet.</p>}
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50 dark:bg-gray-900/30 flex justify-end">
              <button onClick={() => setIsCategoryModalOpen(false)} className="px-8 py-2.5 bg-gray-800 text-white rounded-xl font-bold">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
