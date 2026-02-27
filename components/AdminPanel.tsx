import React, { useState, useEffect } from 'react';
import { AdminUser, SystemLog } from '../types';
import { getAdmins, addAdmin, deleteAdmin, updateAdmin, getSystemLogs } from '../utils/db';
import { UserPlus, Trash2, Edit2, Shield, User, Activity, Search, X } from 'lucide-react';

interface AdminPanelProps {
  currentUser: AdminUser;
  onClose: () => void;
  t: (key: string) => string;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ currentUser, onClose, t }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'logs'>('users');
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [isAdding, setIsAdding] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'superadmin' | 'user'>('user');

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    if (activeTab === 'users') {
      const data = await getAdmins();
      setAdmins(data);
    } else {
      const data = await getSystemLogs();
      setLogs(data);
    }
    setLoading(false);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newPassword) return;

    const newUser: AdminUser = {
      username: newUsername,
      role: newRole,
      name: newName || newUsername,
      addedAt: Date.now(),
      createdBy: currentUser.username
    };

    await addAdmin(newUser, newPassword, currentUser.username);
    setIsAdding(false);
    setNewUsername('');
    setNewPassword('');
    setNewName('');
    loadData();
  };

  const handleDeleteUser = async (username: string) => {
    if (window.confirm(`Are you sure you want to delete ${username}?`)) {
      await deleteAdmin(username, currentUser.username);
      loadData();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 w-full max-w-5xl h-[80vh] rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-800/50">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <Shield className="text-indigo-400" />
              {t('nav_users')}
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Xush kelibsiz, <span className="text-white font-medium">{currentUser.name || currentUser.username}</span> ({currentUser.role})
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X className="text-slate-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 bg-slate-800/30">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-4 text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'users' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-indigo-500/5' : 'text-slate-400 hover:text-white'
            }`}
          >
            <User className="w-4 h-4" />
            Foydalanuvchilar
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-6 py-4 text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'logs' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-indigo-500/5' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4" />
            Tizim Tarixi (Logs)
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 bg-slate-900">
          {loading ? (
            <div className="flex items-center justify-center h-full text-slate-500">Yuklanmoqda...</div>
          ) : activeTab === 'users' ? (
            <div className="space-y-6">
              {currentUser.role === 'superadmin' && (
                <div className="flex justify-end">
                  <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    Yangi Admin Qo'shish
                  </button>
                </div>
              )}

              {isAdding && (
                <form onSubmit={handleAddUser} className="bg-slate-800/50 p-6 rounded-xl border border-white/10 space-y-4 animate-in fade-in slide-in-from-top-4">
                  <h3 className="text-lg font-medium text-white mb-4">Yangi Foydalanuvchi</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Login (Username)</label>
                      <input
                        type="text"
                        value={newUsername}
                        onChange={e => setNewUsername(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Ism (Display Name)</label>
                      <input
                        type="text"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Parol</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Role</label>
                      <select
                        value={newRole}
                        onChange={e => setNewRole(e.target.value as any)}
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="user">Oddiy Foydalanuvchi (User)</option>
                        <option value="admin">Oddiy Admin</option>
                        <option value="superadmin">Super Admin</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 mt-4">
                    <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-slate-400 hover:text-white">Bekor qilish</button>
                    <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500">Saqlash</button>
                  </div>
                </form>
              )}

              <div className="bg-slate-800/30 rounded-xl border border-white/5 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-800/50 text-slate-400 uppercase text-xs">
                    <tr>
                      <th className="px-6 py-4 font-medium">Foydalanuvchi</th>
                      <th className="px-6 py-4 font-medium">Role</th>
                      <th className="px-6 py-4 font-medium">Oxirgi Kirish</th>
                      <th className="px-6 py-4 font-medium">Qo'shilgan Sana</th>
                      {currentUser.role === 'superadmin' && <th className="px-6 py-4 text-right">Amallar</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {admins.map((admin) => (
                      <tr key={admin.username} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">
                              {admin.username[0].toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium text-white">{admin.name || admin.username}</div>
                              <div className="text-xs text-slate-500">@{admin.username}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {currentUser.role === 'superadmin' && admin.username !== currentUser.username ? (
                            <select
                              value={admin.role || 'admin'}
                              onChange={async (e) => {
                                const newRole = e.target.value as 'admin' | 'superadmin' | 'user';
                                await updateAdmin(admin.username, { role: newRole }, currentUser.username);
                                loadData();
                              }}
                              className={`bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-xs font-medium focus:ring-2 focus:ring-indigo-500 ${
                                admin.role === 'superadmin' ? 'text-purple-400' : admin.role === 'admin' ? 'text-blue-400' : 'text-emerald-400'
                              }`}
                            >
                              <option value="user">User</option>
                              <option value="admin">Admin</option>
                              <option value="superadmin">Super Admin</option>
                            </select>
                          ) : (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              admin.role === 'superadmin' ? 'bg-purple-500/10 text-purple-400' : admin.role === 'admin' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'
                            }`}>
                              {admin.role || 'admin'}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-400">
                          {admin.lastLogin ? new Date(admin.lastLogin).toLocaleString() : '-'}
                        </td>
                        <td className="px-6 py-4 text-slate-400">
                          {new Date(admin.addedAt).toLocaleDateString()}
                        </td>
                        {currentUser.role === 'superadmin' && (
                          <td className="px-6 py-4 text-right">
                            {admin.username !== 'admin' && admin.username !== currentUser.username && (
                              <button
                                onClick={() => handleDeleteUser(admin.username)}
                                className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                title="O'chirish"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-slate-800/30 rounded-xl border border-white/5 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-800/50 text-slate-400 uppercase text-xs">
                    <tr>
                      <th className="px-6 py-4 font-medium">Vaqt</th>
                      <th className="px-6 py-4 font-medium">Foydalanuvchi</th>
                      <th className="px-6 py-4 font-medium">Amal</th>
                      <th className="px-6 py-4 font-medium">Tafsilotlar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 text-slate-400 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-white font-medium">{log.username}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            log.action === 'LOGIN' ? 'bg-green-500/10 text-green-400' :
                            log.action === 'DATA_UPLOAD' ? 'bg-blue-500/10 text-blue-400' :
                            log.action === 'DATA_DELETE' ? 'bg-red-500/10 text-red-400' :
                            'bg-slate-500/10 text-slate-400'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-300">
                          {log.details}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
