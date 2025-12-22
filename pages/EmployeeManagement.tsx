import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { Employee, UserRole } from '../types';
import { useAuth } from '../App';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  IdCard, 
  Phone, 
  Calendar, 
  Globe, 
  HeartPulse, 
  X,
  AlertCircle,
  Hash,
  Loader2
} from 'lucide-react';

export default function EmployeeManagement() {
  const { user: currentUser } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Partial<Employee> | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Employee>>({
    fullName: '',
    dob: '',
    nationality: '',
    idNumber: '',
    phoneNumber: '',
    emergencyContactNumber: '',
    emergencyContactPerson: '',
    emergencyRelation: ''
  });

  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
    window.addEventListener('db_change_global_employees', loadData);
    return () => window.removeEventListener('db_change_global_employees', loadData);
  }, []);

  const loadData = async () => {
    const data = await db.getEmployees();
    setEmployees(data.sort((a, b) => b.createdAt - a.createdAt));
  };

  const handleOpenCreate = () => {
    setEditingEmployee(null);
    setFormData({
      fullName: '',
      dob: '',
      nationality: '',
      idNumber: '',
      phoneNumber: '',
      emergencyContactNumber: '',
      emergencyContactPerson: '',
      emergencyRelation: ''
    });
    setError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormData(emp);
    setError('');
    setIsModalOpen(true);
  };

  const handleDelete = async (emp: Employee) => {
    const canDelete = currentUser?.role === UserRole.SUPER_ADMIN || currentUser?.role === UserRole.ADMIN;
    if (!canDelete) {
      alert("Permission Denied: Only Super Admins and Admins can delete employee records.");
      return;
    }

    try {
      const users = await db.getUsers();
      const linkedUser = users.find(u => u.username === emp.empId);

      if (linkedUser) {
        alert(`Action Blocked: This employee has an active system user account (#${linkedUser.username}). You must delete the user account from "User & Access Management" before you can delete the primary employee record.`);
        return;
      }

      if (confirm(`Are you sure you want to delete the record for "${emp.fullName}"? This action is permanent and cannot be undone.`)) {
        await db.deleteEmployee(emp.id);
        await loadData(); 
        alert("Employee record deleted successfully.");
      }
    } catch (err) {
      console.error("Deletion failed:", err);
      alert("An error occurred while trying to delete the employee record.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (isSaving) return;

    if (!formData.fullName || !formData.idNumber || !formData.phoneNumber) {
        setError("Please fill in all required primary fields.");
        return;
    }

    setIsSaving(true);
    try {
        if (editingEmployee) {
          await db.updateEmployee({ ...editingEmployee, ...formData } as Employee);
        } else {
          await db.addEmployee(formData);
        }
        setIsModalOpen(false);
    } finally {
        setIsSaving(false);
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const term = searchTerm.toLowerCase();
    return (
      emp.fullName.toLowerCase().includes(term) ||
      emp.empId.toLowerCase().includes(term) ||
      emp.idNumber.toLowerCase().includes(term)
    );
  });

  if (currentUser?.role !== UserRole.SUPER_ADMIN && currentUser?.role !== UserRole.ADMIN) {
    return (
      <div className="p-12 text-center">
        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={40} />
        </div>
        <h2 className="text-xl font-bold text-gray-800">Access Denied</h2>
        <p className="text-gray-500 max-w-sm mx-auto mt-2">You do not have the required administrative privileges to manage global employee records.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Employee Management</h1>
          <p className="text-gray-500 dark:text-gray-400">Maintain records and emergency contacts for all staff.</p>
        </div>
        
        <button 
          onClick={handleOpenCreate}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-bold"
        >
          <Plus size={18} /> Add Employee
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                  <IdCard size={24} />
              </div>
              <div>
                  <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Total Staff</p>
                  <p className="text-2xl font-black dark:text-white">{employees.length}</p>
              </div>
          </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search Name, ID, or ID/Passport..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[1000px]">
            <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-xs font-black uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="p-4">Emp ID</th>
                <th className="p-4">Full Name</th>
                <th className="p-4">Primary Contact</th>
                <th className="p-4">Identity Details</th>
                <th className="p-4">Emergency Contact</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-gray-400 dark:text-gray-500 italic">
                    No employee records found.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map(emp => (
                  <tr key={emp.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors group">
                    <td className="p-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {emp.empId}
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-gray-900 dark:text-white">{emp.fullName}</div>
                      <div className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                          <Calendar size={10} /> {emp.dob}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-sm">
                          <Phone size={14} className="text-gray-400" />
                          <span className="dark:text-gray-300">{emp.phoneNumber}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] mt-1">
                          <Globe size={12} className="text-gray-400" />
                          <span className="text-gray-500">{emp.nationality}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-1 rounded w-fit font-mono">
                          ID: {emp.idNumber}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-0.5">
                          <div className="text-sm font-bold flex items-center gap-2">
                              <HeartPulse size={14} className="text-red-500" />
                              <span className="dark:text-gray-200">{emp.emergencyContactPerson}</span>
                              <span className="text-[10px] bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full border border-red-100 dark:border-red-900/40">
                                {emp.emergencyRelation}
                              </span>
                          </div>
                          <div className="text-xs text-gray-500 ml-5">{emp.emergencyContactNumber}</div>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                            <button 
                                onClick={() => handleOpenEdit(emp)}
                                className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all"
                                title="Edit Record"
                            >
                                <Edit2 size={18} />
                            </button>
                            <button 
                                onClick={() => handleDelete(emp)}
                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"
                                title="Delete Record"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/30">
              <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
                <IdCard className="text-blue-600" />
                {editingEmployee ? 'Edit Employee Record' : 'Register New Employee'}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-8">
              {error && (
                  <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-xl border border-red-100 dark:border-red-900/40 flex items-center gap-3 text-sm font-medium">
                      <AlertCircle size={18} />
                      {error}
                  </div>
              )}

              <div className="space-y-4">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] border-b dark:border-gray-700 pb-2">Personal Particulars</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-tight">Employee ID</label>
                    <div className="flex items-center gap-2 p-2.5 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-600 dark:text-gray-400 font-mono">
                        <Hash size={14} className="text-gray-400" />
                        {editingEmployee ? editingEmployee.empId : "System Generated"}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-tight">Full Name *</label>
                    <input 
                      required
                      placeholder="e.g. Ahmed Ali"
                      className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.fullName}
                      onChange={e => setFormData({...formData, fullName: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-tight">Date of Birth *</label>
                    <input 
                      type="date"
                      required
                      className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.dob}
                      onChange={e => setFormData({...formData, dob: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-tight">Nationality *</label>
                    <input 
                      required
                      placeholder="e.g. Maldivian"
                      className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.nationality}
                      onChange={e => setFormData({...formData, nationality: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-tight">ID No / Passport *</label>
                    <input 
                      required
                      placeholder="e.g. A000000"
                      className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                      value={formData.idNumber}
                      onChange={e => setFormData({...formData, idNumber: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-tight">Phone Number *</label>
                    <input 
                      required
                      placeholder="e.g. +960 7771234"
                      className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.phoneNumber}
                      onChange={e => setFormData({...formData, phoneNumber: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-black text-red-500 uppercase tracking-[0.2em] border-b border-red-100 dark:border-red-900/30 pb-2">Emergency Information</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-tight">Contact Person *</label>
                    <input 
                      required
                      placeholder="e.g. Maryam Ali"
                      className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.emergencyContactPerson}
                      onChange={e => setFormData({...formData, emergencyContactPerson: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-tight">Relation *</label>
                    <input 
                      required
                      placeholder="e.g. Mother, Spouse"
                      className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.emergencyRelation}
                      onChange={e => setFormData({...formData, emergencyRelation: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-tight">Emergency Phone Number *</label>
                  <input 
                    required
                    placeholder="e.g. +960 7775678"
                    className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.emergencyContactNumber}
                    onChange={e => setFormData({...formData, emergencyContactNumber: e.target.value})}
                  />
                </div>
              </div>
            </form>

            <div className="p-6 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-900/30">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)} 
                className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSubmit}
                disabled={isSaving}
                className="px-8 py-2.5 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {isSaving && <Loader2 className="animate-spin" size={16} />}
                {editingEmployee ? 'Update Record' : 'Save Employee'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}