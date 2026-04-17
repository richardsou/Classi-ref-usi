import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile as updateAuthProfile } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { db, doc, getDoc, setDoc, serverTimestamp, handleFirestoreError, OperationType, collection, onSnapshot, query, orderBy, addDoc, auth, deleteDoc } from '../firebase';
import { AppSettings, UserProfile, UserPermissions, ADMIN_PERMISSIONS, OPERATOR_PERMISSIONS, VIEWER_PERMISSIONS, DEFAULT_PERMISSIONS, Shift } from '../types';
import { Layout, Image as ImageIcon, Save, CheckCircle2, AlertCircle, Users, Shield, User as UserIcon, Plus, Check, X, Search, Edit2, Trash2, Key, AlertTriangle, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const AppSettingsManager: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>({
    appName: 'Classificação de Refugo',
    logoUrl: 'https://www.fremax.com/assets/img/logo-fremax.png',
    logoHeight: 40
  });
  const [users, setUsers] = useState<(UserProfile & { id: string })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRegistrationId, setNewUserRegistrationId] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'operator' | 'viewer' | 'custom'>('viewer');
  
  const [editingUser, setEditingUser] = useState<(UserProfile & { id: string }) | null>(null);
  
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userToDelete, setUserToDelete] = useState<{ id: string, email: string } | null>(null);

  const currentUser = auth.currentUser;
  const myProfile = users.find(u => u.id === currentUser?.uid);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'app_settings', 'global');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSettings(docSnap.data() as AppSettings);
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      }
    };

    const unsubscribeUsers = onSnapshot(query(collection(db, 'users'), orderBy('email', 'asc')), (snapshot) => {
      const userList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as (UserProfile & { id: string })[];
      setUsers(userList);
      setIsLoading(false);
    }, (error) => {
      console.error('Error fetching users:', error);
      setIsLoading(false);
    });

    fetchSettings();
    return () => unsubscribeUsers();
  }, []);

  const handleAddUser = async () => {
    if (!newUserEmail.trim()) return;
    setIsSaving(true);
    try {
      // Check if user already exists
      const existingUser = users.find(u => u.email.toLowerCase() === newUserEmail.toLowerCase());
      if (existingUser) {
        setMessage({ type: 'error', text: 'Este usuário já está cadastrado.' });
        return;
      }

      const permissions = 
        newUserRole === 'admin' ? ADMIN_PERMISSIONS :
        newUserRole === 'operator' ? OPERATOR_PERMISSIONS :
        newUserRole === 'viewer' ? VIEWER_PERMISSIONS :
        DEFAULT_PERMISSIONS;

      let userId = '';

      // If password is provided, create the user in Auth
      if (newUserPassword.trim()) {
        if (newUserPassword.length < 6) {
          setMessage({ type: 'error', text: 'A senha deve ter pelo menos 6 caracteres.' });
          return;
        }

        try {
          // Use a secondary app instance to create the user without signing out the admin
          const secondaryApp = initializeApp(firebaseConfig, 'secondary');
          const secondaryAuth = getAuth(secondaryApp);
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newUserEmail.trim(), newUserPassword.trim());
          userId = userCredential.user.uid;
          
          // Clean up secondary app
          await secondaryAuth.signOut();
          // Note: secondaryApp.delete() is not strictly necessary here but good practice
        } catch (authError: any) {
          console.error('Error creating auth user:', authError);
          if (authError.code === 'auth/email-already-in-use') {
            setMessage({ type: 'error', text: 'Este e-mail já está em uso no sistema de autenticação.' });
          } else {
            setMessage({ type: 'error', text: 'Erro ao criar conta de acesso: ' + authError.message });
          }
          return;
        }
      }

      const userData = {
        email: newUserEmail.toLowerCase().trim(),
        registrationId: newUserRegistrationId.trim(),
        role: newUserRole,
        permissions,
        displayName: '',
        photoURL: '',
        isPending: !newUserPassword.trim(), // Not pending if we created with password
        updatedAt: new Date().toISOString()
      };

      if (userId) {
        await setDoc(doc(db, 'users', userId), userData);
      } else {
        await addDoc(collection(db, 'users'), userData);
      }
      
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRegistrationId('');
      setIsAddingUser(false);
      setMessage({ type: 'success', text: userId ? 'Usuário criado com sucesso!' : 'Usuário pré-autorizado com sucesso!' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'users');
      setMessage({ type: 'error', text: 'Erro ao autorizar usuário.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    const { id, email } = userToDelete;

    if (email === 'jamaicamo94@gmail.com') {
      setMessage({ type: 'error', text: 'O administrador mestre não pode ser excluído.' });
      setUserToDelete(null);
      return;
    }

    if (auth.currentUser?.email === email) {
      setMessage({ type: 'error', text: 'Você não pode excluir sua própria conta.' });
      setUserToDelete(null);
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', id));
      setMessage({ type: 'success', text: 'Usuário excluído com sucesso!' });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${id}`);
      setMessage({ type: 'error', text: 'Erro ao excluir usuário.' });
    } finally {
      setUserToDelete(null);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    setIsSaving(true);
    try {
      const { id, ...data } = editingUser;
      await setDoc(doc(db, 'users', id), {
        ...data,
        updatedAt: new Date().toISOString()
      });
      setEditingUser(null);
      setMessage({ type: 'success', text: 'Dados do usuário atualizados!' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${editingUser.id}`);
      setMessage({ type: 'error', text: 'Erro ao atualizar usuário.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateRegistrationId = async (userId: string, registrationId: string) => {
    try {
      const userDocRef = doc(db, 'users', userId);
      await setDoc(userDocRef, { 
        registrationId: registrationId.trim(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleTogglePermission = async (userId: string, permission: keyof UserPermissions) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    const newPermissions = {
      ...user.permissions,
      [permission]: !user.permissions[permission]
    };

    try {
      const userDocRef = doc(db, 'users', userId);
      await setDoc(userDocRef, { 
        permissions: newPermissions,
        role: 'custom',
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      await setDoc(doc(db, 'app_settings', 'global'), {
        ...settings,
        updatedAt: serverTimestamp()
      });
      setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });
      // Trigger a page reload to apply changes everywhere if needed, 
      // but better to use a global state or context.
      // For now, we'll just show the success message.
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'app_settings/global');
      setMessage({ type: 'error', text: 'Erro ao salvar configurações.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Meu Perfil */}
      {myProfile && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
        >
          <div className="p-6 border-b border-gray-100 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden">
              {myProfile.photoURL ? (
                <img src={myProfile.photoURL} alt={myProfile.displayName} className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-6 h-6 text-blue-600" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Meu Perfil</h2>
              <p className="text-xs text-gray-500">{myProfile.displayName} ({myProfile.email})</p>
            </div>
          </div>
          <div className="p-6 bg-blue-50/30">
            <div className="max-w-xs space-y-2">
              <label className="text-sm font-bold text-gray-700">Minha Matrícula</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={myProfile.registrationId || ''}
                  onChange={(e) => handleUpdateRegistrationId(myProfile.id, e.target.value)}
                  placeholder="Sua matrícula..."
                  className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                />
                <div className="p-3 bg-white border border-gray-200 rounded-xl flex items-center justify-center shadow-sm">
                  <Shield className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <p className="text-[10px] text-gray-500 font-medium">
                Esta matrícula será usada para identificar você como responsável pelas entradas no almoxarifado.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
      >
        <div className="p-6 border-b border-gray-100 flex items-center gap-2">
          <Layout className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">Configurações do Aplicativo</h2>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Nome do Aplicativo</label>
            <input
              type="text"
              value={settings.appName}
              onChange={(e) => setSettings({ ...settings, appName: e.target.value })}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="Ex: Classificação de Refugo"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">URL do Logo</label>
            <input
              type="text"
              value={settings.logoUrl}
              onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="https://exemplo.com/logo.png"
            />
            <p className="text-xs text-gray-500 italic">
              Dica: Use uma URL direta para a imagem do logo.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Altura do Logo (pixels)</label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="2"
                max="100"
                step="1"
                value={settings.logoHeight || 40}
                onChange={(e) => setSettings({ ...settings, logoHeight: parseInt(e.target.value) })}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <span className="text-sm font-bold text-gray-900 w-12 text-right">{settings.logoHeight || 40}px</span>
            </div>
            <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-dashed border-gray-200 flex items-center justify-center min-h-[100px]">
              {settings.logoUrl ? (
                <img 
                  src={settings.logoUrl} 
                  alt="Preview Real" 
                  style={{ height: settings.logoHeight || 40 }}
                  className="w-auto object-contain"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <ImageIcon className="w-8 h-8 text-gray-300" />
              )}
            </div>
            <p className="text-xs text-gray-500 italic">
              Ajuste a altura para que o logo se adapte melhor ao layout. O tamanho máximo é 100px.
            </p>
          </div>

          <div className="space-y-4 pt-4 border-t border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              Horários dos Turnos
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(['Turno 1', 'Turno 2', 'Turno 3'] as Shift[]).map((shift) => (
                <div key={shift} className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-3">
                  <p className="text-xs font-black text-gray-900 uppercase tracking-wider">{shift}</p>
                  <div className="space-y-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase">Início</label>
                      <input
                        type="time"
                        value={settings.shifts?.[shift]?.start || ''}
                        onChange={(e) => setSettings({
                          ...settings,
                          shifts: {
                            ...settings.shifts,
                            [shift]: { ...(settings.shifts?.[shift] || { end: '' }), start: e.target.value }
                          } as any
                        })}
                        className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase">Fim</label>
                      <input
                        type="time"
                        value={settings.shifts?.[shift]?.end || ''}
                        onChange={(e) => setSettings({
                          ...settings,
                          shifts: {
                            ...settings.shifts,
                            [shift]: { ...(settings.shifts?.[shift] || { start: '' }), end: e.target.value }
                          } as any
                        })}
                        className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-500 italic">
              Os horários serão usados para classificar automaticamente os lançamentos de insertos.
            </p>
          </div>

          {message && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className={`p-4 rounded-xl flex items-center gap-3 ${
                message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'
              }`}
            >
              {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              <span className="text-sm font-medium">{message.text}</span>
            </motion.div>
          )}

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-blue-200"
          >
            {isSaving ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Salvar Alterações
              </>
            )}
          </button>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
      >
        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Gestão de Usuários</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por e-mail ou matrícula..."
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all w-full sm:w-64"
              />
            </div>
            <button
              onClick={() => setIsAddingUser(!isAddingUser)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all font-bold text-sm whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Convidar
            </button>
          </div>
        </div>

        <div className="p-6">
          <AnimatePresence>
            {isAddingUser && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-8 p-6 bg-gray-50 rounded-2xl border border-gray-100 space-y-4"
              >
                <h3 className="text-sm font-bold text-gray-900">Novo Usuário</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">E-mail</label>
                    <input
                      type="email"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      placeholder="exemplo@email.com"
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Senha (Opcional)</label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="password"
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Matrícula</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={newUserRegistrationId}
                      onChange={(e) => setNewUserRegistrationId(e.target.value)}
                      placeholder="000000"
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Função</label>
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value as any)}
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="viewer">Visualizador</option>
                      <option value="operator">Operador</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleAddUser}
                    disabled={isSaving || !newUserEmail}
                    className="flex-1 bg-blue-600 text-white font-bold py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all text-sm"
                  >
                    {newUserPassword ? 'Criar e Autorizar' : 'Autorizar por E-mail'}
                  </button>
                  <button
                    onClick={() => setIsAddingUser(false)}
                    className="px-6 py-2.5 bg-white border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-all text-sm"
                  >
                    Cancelar
                  </button>
                </div>
                {newUserPassword && (
                  <p className="text-[10px] text-amber-600 font-medium bg-amber-50 p-2 rounded-lg border border-amber-100">
                    Atenção: Ao definir uma senha, o usuário será criado imediatamente no sistema de autenticação. Certifique-se de que o login por E-mail/Senha está ativado no console do Firebase.
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-gray-50">
                  <th className="pb-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Usuário</th>
                  <th className="pb-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Matrícula</th>
                  <th className="pb-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Permissão</th>
                  <th className="pb-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users
                  .filter(user => 
                    user.email.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                    (user.registrationId && user.registrationId.includes(userSearchTerm)) ||
                    (user.displayName && user.displayName.toLowerCase().includes(userSearchTerm.toLowerCase()))
                  )
                  .map((user) => (
                    <React.Fragment key={user.id}>
                    <tr className="group hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}>
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                            {user.photoURL ? (
                              <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
                            ) : (
                              <UserIcon className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-gray-900">{user.displayName || 'Sem nome'}</p>
                              {user.isPending && (
                                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full uppercase tracking-wider">
                                  Pendente
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4">
                        <span className="text-sm font-medium text-gray-700">{user.registrationId || '---'}</span>
                      </td>
                      <td className="py-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          user.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                          user.role === 'operator' ? 'bg-blue-100 text-blue-700' :
                          user.role === 'viewer' ? 'bg-gray-100 text-gray-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {user.role === 'admin' ? 'Admin' :
                           user.role === 'operator' ? 'Operador' :
                           user.role === 'viewer' ? 'Visualizador' : 'Custom'}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingUser(user);
                            }}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="Editar Usuário"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setUserToDelete({ id: user.id, email: user.email });
                            }}
                            disabled={user.email === 'jamaicamo94@gmail.com'}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-30"
                            title="Excluir Usuário"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    <AnimatePresence>
                      {expandedUser === user.id && (
                        <tr>
                          <td colSpan={2} className="px-6 py-4 bg-gray-50/50 rounded-b-2xl">
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="grid grid-cols-2 sm:grid-cols-4 gap-3 overflow-hidden"
                            >
                              {[
                                { id: 'dashboard', label: 'Dashboard' },
                                { id: 'registration', label: 'Registrar' },
                                { id: 'history', label: 'Histórico' },
                                { id: 'reports', label: 'Relatórios' },
                                { id: 'inserts', label: 'Insertos' },
                                { id: 'editRecords', label: 'Editar' },
                                { id: 'deleteRecords', label: 'Excluir' },
                                { id: 'categories', label: 'Categorias' },
                                { id: 'warehouse', label: 'Almoxarifado' },
                                { id: 'settings', label: 'Configurações' }
                              ].map((perm) => (
                                <button
                                  key={perm.id}
                                  onClick={() => handleTogglePermission(user.id, perm.id as keyof UserPermissions)}
                                  disabled={user.email === 'jamaicamo94@gmail.com'}
                                  className={`flex items-center gap-2 p-2 rounded-lg border transition-all text-xs font-bold ${
                                    user.permissions?.[perm.id as keyof UserPermissions]
                                      ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                      : 'bg-white border-gray-200 text-gray-500 hover:border-blue-200'
                                  } disabled:opacity-50`}
                                >
                                  {user.permissions?.[perm.id as keyof UserPermissions] ? (
                                    <Check className="w-3 h-3" />
                                  ) : (
                                    <X className="w-3 h-3" />
                                  )}
                                  {perm.label}
                                </button>
                              ))}
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>

      <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100">
        <h3 className="text-sm font-bold text-blue-900 mb-2">Sobre este módulo</h3>
        <p className="text-sm text-blue-800 leading-relaxed">
          Aqui você pode personalizar a identidade visual do seu sistema. As alterações feitas aqui serão aplicadas em todas as telas, incluindo a página de login e os menus de navegação.
        </p>
      </div>

      {/* Edit User Modal */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-xl">
                    <Edit2 className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Editar Usuário</h3>
                </div>
                <button onClick={() => setEditingUser(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-all">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Nome</label>
                    <input
                      type="text"
                      value={editingUser.displayName || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, displayName: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">E-mail</label>
                    <input
                      type="email"
                      value={editingUser.email}
                      onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Matrícula</label>
                    <input
                      type="text"
                      value={editingUser.registrationId || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, registrationId: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Função</label>
                    <select
                      value={editingUser.role}
                      onChange={(e) => {
                        const newRole = e.target.value as any;
                        const newPermissions = 
                          newRole === 'admin' ? ADMIN_PERMISSIONS :
                          newRole === 'operator' ? OPERATOR_PERMISSIONS :
                          newRole === 'viewer' ? VIEWER_PERMISSIONS :
                          editingUser.permissions;
                        setEditingUser({ ...editingUser, role: newRole, permissions: newPermissions });
                      }}
                      disabled={editingUser.email === 'jamaicamo94@gmail.com'}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
                    >
                      <option value="admin">Administrador</option>
                      <option value="operator">Operador</option>
                      <option value="viewer">Visualizador</option>
                      <option value="custom">Personalizado</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Permissões Detalhadas</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'dashboard', label: 'Dashboard' },
                      { id: 'registration', label: 'Registrar' },
                      { id: 'history', label: 'Histórico' },
                      { id: 'reports', label: 'Relatórios' },
                      { id: 'inserts', label: 'Insertos' },
                      { id: 'editRecords', label: 'Editar' },
                      { id: 'deleteRecords', label: 'Excluir' },
                      { id: 'categories', label: 'Categorias' },
                      { id: 'warehouse', label: 'Almoxarifado' },
                      { id: 'settings', label: 'Configurações' }
                    ].map((perm) => (
                      <button
                        key={perm.id}
                        onClick={() => {
                          const newPermissions = {
                            ...editingUser.permissions,
                            [perm.id]: !editingUser.permissions[perm.id as keyof UserPermissions]
                          };
                          setEditingUser({ ...editingUser, permissions: newPermissions, role: 'custom' });
                        }}
                        disabled={editingUser.email === 'jamaicamo94@gmail.com'}
                        className={`flex items-center gap-2 p-2 rounded-lg border transition-all text-[10px] font-bold ${
                          editingUser.permissions?.[perm.id as keyof UserPermissions]
                            ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                            : 'bg-white border-gray-200 text-gray-500 hover:border-blue-200'
                        } disabled:opacity-50`}
                      >
                        {editingUser.permissions?.[perm.id as keyof UserPermissions] ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        {perm.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-gray-50 flex gap-3">
                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
                >
                  {isSaving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <><Save className="w-4 h-4" /> Salvar Alterações</>}
                </button>
                <button
                  onClick={() => setEditingUser(null)}
                  className="px-6 bg-white border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-100 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Delete User Confirmation Modal */}
      <AnimatePresence>
        {userToDelete && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-red-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-xl">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <h3 className="text-lg font-bold text-red-900">Confirmar Exclusão</h3>
                </div>
                <button onClick={() => setUserToDelete(null)} className="p-2 hover:bg-red-100 rounded-xl transition-all">
                  <X className="w-5 h-5 text-red-400" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-gray-600 font-medium">
                  Tem certeza que deseja excluir o usuário <span className="font-bold text-gray-900">{userToDelete.email}</span>?
                </p>
                <p className="text-xs text-red-500 font-bold bg-red-50 p-3 rounded-xl border border-red-100">
                  Esta ação não pode ser desfeita e o usuário perderá o acesso imediatamente.
                </p>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setUserToDelete(null)}
                    className="flex-1 px-6 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDeleteUser}
                    className="flex-1 px-6 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-100 flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Excluir Usuário
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
