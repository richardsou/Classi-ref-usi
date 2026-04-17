import React, { useState, useEffect } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { db, doc, getDoc, setDoc, serverTimestamp, handleFirestoreError, OperationType, collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, getDocs, where, auth, limit } from '../firebase';
import { AppSettings, UserProfile, UserPermissions, ADMIN_PERMISSIONS, OPERATOR_PERMISSIONS, VIEWER_PERMISSIONS, DEFAULT_PERMISSIONS, Insert, InsertTransaction, InsertStock, ProductionLine, ScrapRecord, DefectTypeConfig } from '../types';
import { 
  Layout, Image as ImageIcon, Save, CheckCircle2, AlertCircle, Users, Shield, 
  User as UserIcon, Plus, Check, X, Search, Settings2, Package, History, 
  Factory, Edit2, Trash2, ChevronRight, ChevronDown, Filter, ArrowUpCircle, 
  ArrowDownCircle, ClipboardList, Settings, BarChart3, PieChart, ListFilter,
  AlertTriangle, Boxes, FileText, Key, Box, Cpu, Layers, Component, Wrench, Hammer, Cog,
  UserCheck, Clock
} from 'lucide-react';
import { OperatorManager } from './OperatorManager';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { RecordList } from './RecordList';
import { Reports } from './Reports';
import { DefectManager } from './DefectManager';
import { InsertReports } from './InsertReports';
import { InsertDashboard } from './InsertDashboard';
import { MessageModal } from './MessageModal';

interface ManagerPanelProps {
  userProfile: UserProfile | null;
  permissions: UserPermissions;
  productionLines: ProductionLine[];
  inserts: Insert[];
  stocks: InsertStock[];
  transactions: InsertTransaction[];
  initialTab?: 'users' | 'estoque' | 'scraps' | 'operadores' | 'settings';
  initialSubTab?: string;
}

export const ManagerPanel: React.FC<ManagerPanelProps> = ({ 
  userProfile, 
  permissions,
  productionLines, 
  inserts, 
  stocks, 
  transactions,
  initialTab,
  initialSubTab
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'estoque' | 'scraps' | 'operadores' | 'settings'>(initialTab || 'estoque');
  const [estoqueSubTab, setEstoqueSubTab] = useState<'entries' | 'history' | 'inserts' | 'lines' | 'reports' | 'correction'>((initialSubTab as any) || 'entries');
  const [scrapSubTab, setScrapSubTab] = useState<'history' | 'reports' | 'categories'>((initialSubTab as any) || 'history');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<InsertTransaction | null>(null);

  const ALL_PERMISSIONS_LIST = [
    { id: 'dashboard', label: 'Dashboard Refugo' },
    { id: 'inserts', label: 'Dashboard Inserto' },
    { id: 'registration', label: 'Novo Registro' },
    { id: 'warehouse', label: 'Almoxarifado' },
    { id: 'history', label: 'Histórico (Refugo)' },
    { id: 'reports', label: 'Relatórios (Refugo)' },
    { id: 'categories', label: 'Categorias (Refugo)' },
    { id: 'settings', label: 'Sistema' },
    { id: 'manageUsers', label: 'Gestão Usuários' },
    { id: 'manageOperators', label: 'Gestão Operadores' },
    { id: 'editRecords', label: 'Editar Registros' },
    { id: 'deleteRecords', label: 'Excluir Registros' },
    { id: 'insertEntries', label: 'Entradas (Inserto)' },
    { id: 'insertWithdraw', label: 'Saídas (Inserto)' },
    { id: 'insertHistory', label: 'Histórico (Inserto)' },
    { id: 'insertReports', label: 'Relatórios (Inserto)' },
    { id: 'insertModels', label: 'Modelos (Inserto)' },
    { id: 'insertLines', label: 'Linhas (Inserto)' },
    { id: 'insertCorrection', label: 'Correção (Inserto)' },
    { id: 'improvements', label: 'Módulo Melhorias' },
    { id: 'toolManagement', label: 'Gestão Ferramentas' },
    { id: 'generateAIAnalysis', label: 'Gerar Análise IA' },
    { id: 'generateAIImprovement', label: 'Gerar Melhoria IA' },
    { id: 'generateAIEmail', label: 'Gerar E-mail IA' },
    { id: 'generateAIWhatsapp', label: 'Gerar WhatsApp IA' }
  ];

  const isAdmin = userProfile?.role === 'admin' || userProfile?.email === 'jamaicamo94@gmail.com';
  const canEdit = isAdmin || permissions.editRecords;
  const canDelete = isAdmin || permissions.deleteRecords;

  // App Settings State
  const [settings, setSettings] = useState<AppSettings>({
    appName: 'Classificação de Refugo',
    logoUrl: 'https://www.fremax.com/assets/img/logo-fremax.png',
    logoHeight: 40
  });

  // Users State
  const [users, setUsers] = useState<(UserProfile & { id: string })[]>([]);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRegistrationId, setNewUserRegistrationId] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'operator' | 'viewer' | 'custom'>('viewer');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<(UserProfile & { id: string }) | null>(null);
  const [userToDelete, setUserToDelete] = useState<{ id: string, email: string } | null>(null);
  const [scrapToDelete, setScrapToDelete] = useState<string | null>(null);
  const [insertToDelete, setInsertToDelete] = useState<Insert | null>(null);
  const [lineToDelete, setLineToDelete] = useState<ProductionLine | null>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<InsertTransaction | null>(null);
  const [stockEntryToConfirm, setStockEntryToConfirm] = useState<boolean>(false);

  // Inserts State
  const [isAddingInsert, setIsAddingInsert] = useState(false);
  const [newInsert, setNewInsert] = useState<Partial<Insert>>({ code: '', description: '', manufacturer: '', minStock: 0, imageUrl: '' });
  const [editingInsert, setEditingInsert] = useState<Insert | null>(null);
  const [insertSearchTerm, setInsertSearchTerm] = useState('');

  // Lines State
  const [isAddingLine, setIsAddingLine] = useState(false);
  const [newLineName, setNewLineName] = useState('');
  const [editingLine, setEditingLine] = useState<ProductionLine | null>(null);

  // Stock Entry State
  const [entrySearchTerm, setEntrySearchTerm] = useState('');
  const [stockEntry, setStockEntry] = useState({
    insertId: '',
    quantity: 1,
    operatorId: userProfile?.registrationId || ''
  });

  // Scraps State
  const [scrapRecords, setScrapRecords] = useState<ScrapRecord[]>([]);
  const [defectTypes, setDefectTypes] = useState<DefectTypeConfig[]>([]);
  const [editingScrap, setEditingScrap] = useState<ScrapRecord | null>(null);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  useEffect(() => {
    if (userProfile?.registrationId) {
      setStockEntry(prev => ({ ...prev, operatorId: userProfile.registrationId }));
    }
  }, [userProfile]);

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

    const unsubUsers = onSnapshot(query(collection(db, 'users'), orderBy('email', 'asc')), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile & { id: string })));
    });

    const unsubScraps = onSnapshot(query(collection(db, 'scrap_records'), orderBy('timestamp', 'desc'), limit(100)), (snapshot) => {
      setScrapRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ScrapRecord)));
    });

    const unsubDefects = onSnapshot(query(collection(db, 'defect_types'), orderBy('order', 'asc')), (snapshot) => {
      setDefectTypes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DefectTypeConfig)));
      setIsLoading(false);
    });

    fetchSettings();

    return () => {
      unsubUsers();
      unsubScraps();
      unsubDefects();
    };
  }, []);

  // --- Scrap Management Handlers ---
  const handleDeleteScrap = async () => {
    if (!scrapToDelete) return;
    try {
      await deleteDoc(doc(db, 'scrap_records', scrapToDelete));
      setMessage({ type: 'success', text: 'Registro de refugo excluído.' });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `scrap_records/${scrapToDelete}`);
    } finally {
      setScrapToDelete(null);
    }
  };

  // --- User Management Handlers ---
  const handleAddUser = async () => {
    if (!newUserEmail.trim()) return;
    setIsSaving(true);
    try {
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

      if (newUserRegistrationId.trim().length < 3) {
        setMessage({ type: 'error', text: 'A matrícula deve ter no mínimo 3 dígitos.' });
        setIsSaving(false);
        return;
      }

      let userId = '';

      // If password is provided, create the user in Auth
      if (newUserPassword.trim()) {
        if (newUserPassword.length < 6) {
          setMessage({ type: 'error', text: 'A senha deve ter pelo menos 6 caracteres.' });
          return;
        }

        try {
          // Use a secondary app instance to create the user without signing out the admin
          let secondaryApp;
          const apps = getApps();
          const existingApp = apps.find(app => app.name === 'secondary');
          if (existingApp) {
            secondaryApp = existingApp;
          } else {
            secondaryApp = initializeApp(firebaseConfig, 'secondary');
          }
          const secondaryAuth = getAuth(secondaryApp);
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newUserEmail.trim(), newUserPassword.trim());
          userId = userCredential.user.uid;
          
          // Clean up secondary app
          await secondaryAuth.signOut();
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
        isPending: !newUserPassword.trim(),
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
    if (editingUser.registrationId && editingUser.registrationId.trim().length < 3) {
      setMessage({ type: 'error', text: 'A matrícula deve ter no mínimo 3 dígitos.' });
      return;
    }
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
    if (registrationId.trim().length < 3) {
      setMessage({ type: 'error', text: 'A matrícula deve ter no mínimo 3 dígitos.' });
      return;
    }
    try {
      await setDoc(doc(db, 'users', userId), { 
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
    const newPermissions = { ...user.permissions, [permission]: !user.permissions[permission] };
    try {
      await setDoc(doc(db, 'users', userId), { 
        permissions: newPermissions, 
        role: 'custom',
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleSetAllPermissions = async (userId: string, value: boolean) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    const newPermissions = Object.keys(DEFAULT_PERMISSIONS).reduce((acc, key) => {
      acc[key as keyof UserPermissions] = value;
      return acc;
    }, {} as UserPermissions);
    
    try {
      await setDoc(doc(db, 'users', userId), { 
        permissions: newPermissions, 
        role: 'custom',
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  // --- Insert Management Handlers ---
  const MODEL_ICONS = [Package, Box, Cpu, Layers, Component, Wrench, Hammer, Cog];
  
  const getModelIcon = (id: string) => {
    const index = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % MODEL_ICONS.length;
    return MODEL_ICONS[index];
  };

  const LINE_COLORS = [
    { name: 'Azul', class: 'bg-blue-500', text: 'text-blue-500', bg: 'bg-blue-50' },
    { name: 'Esmeralda', class: 'bg-emerald-500', text: 'text-emerald-500', bg: 'bg-emerald-50' },
    { name: 'Âmbar', class: 'bg-amber-500', text: 'text-amber-500', bg: 'bg-amber-50' },
    { name: 'Rosa', class: 'bg-rose-500', text: 'text-rose-500', bg: 'bg-rose-50' },
    { name: 'Índigo', class: 'bg-indigo-500', text: 'text-indigo-500', bg: 'bg-indigo-50' },
    { name: 'Laranja', class: 'bg-orange-500', text: 'text-orange-500', bg: 'bg-orange-50' },
    { name: 'Ciano', class: 'bg-cyan-500', text: 'text-cyan-500', bg: 'bg-cyan-50' },
    { name: 'Violeta', class: 'bg-violet-500', text: 'text-violet-500', bg: 'bg-violet-50' },
    { name: 'Fúcsia', class: 'bg-fuchsia-500', text: 'text-fuchsia-500', bg: 'bg-fuchsia-50' },
    { name: 'Lima', class: 'bg-lime-500', text: 'text-lime-500', bg: 'bg-lime-50' },
  ];

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isEditing: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        
        if (isEditing && editingInsert) {
          setEditingInsert({ ...editingInsert, imageUrl: dataUrl });
        } else {
          setNewInsert({ ...newInsert, imageUrl: dataUrl });
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleCreateInsert = async () => {
    if (!newInsert.code || !newInsert.description) return;
    try {
      await addDoc(collection(db, 'inserts'), { ...newInsert, minStock: Number(newInsert.minStock) || 0 });
      setNewInsert({ code: '', description: '', manufacturer: '', minStock: 0, imageUrl: '' });
      setIsAddingInsert(false);
      setMessage({ type: 'success', text: 'Modelo de inserto criado com sucesso.' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'inserts');
    }
  };

  const handleUpdateInsert = async () => {
    if (!editingInsert) return;
    try {
      await updateDoc(doc(db, 'inserts', editingInsert.id), {
        code: editingInsert.code,
        description: editingInsert.description,
        manufacturer: editingInsert.manufacturer,
        minStock: Number(editingInsert.minStock) || 0,
        imageUrl: editingInsert.imageUrl || ''
      });
      setEditingInsert(null);
      setMessage({ type: 'success', text: 'Modelo de inserto atualizado.' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `inserts/${editingInsert.id}`);
    }
  };

  const handleDeleteInsert = async () => {
    if (!insertToDelete) return;
    try {
      // 1. Delete associated stocks
      const stocksQuery = query(collection(db, 'insert_stocks'), where('insertId', '==', insertToDelete.id));
      const stocksSnap = await getDocs(stocksQuery);
      for (const stockDoc of stocksSnap.docs) {
        await deleteDoc(stockDoc.ref);
      }

      // 2. Delete associated transactions
      const transactionsQuery = query(collection(db, 'insert_transactions'), where('insertId', '==', insertToDelete.id));
      const transactionsSnap = await getDocs(transactionsQuery);
      for (const transactionDoc of transactionsSnap.docs) {
        await deleteDoc(transactionDoc.ref);
      }

      // 3. Delete the insert model itself
      await deleteDoc(doc(db, 'inserts', insertToDelete.id));
      
      setMessage({ type: 'success', text: 'Modelo de inserto e todos os dados relacionados excluídos.' });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `inserts/${insertToDelete.id}`);
    } finally {
      setInsertToDelete(null);
    }
  };

  // --- Line Management Handlers ---
  const handleCreateLine = async () => {
    if (!newLineName.trim()) return;
    try {
      // Find a color that is not already in use
      const usedColors = productionLines.map(l => l.color);
      const availableColors = LINE_COLORS.filter(c => !usedColors.includes(c.class));
      
      // If all colors are used, pick a random one, otherwise pick the first available
      const colorToAssign = availableColors.length > 0 
        ? availableColors[0].class 
        : LINE_COLORS[Math.floor(Math.random() * LINE_COLORS.length)].class;

      await addDoc(collection(db, 'production_lines'), { 
        name: newLineName.trim(),
        color: colorToAssign
      });
      setNewLineName('');
      setIsAddingLine(false);
      setMessage({ type: 'success', text: 'Linha de produção criada.' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'production_lines');
    }
  };

  const handleUpdateLine = async () => {
    if (!editingLine || !editingLine.name.trim()) return;
    try {
      await updateDoc(doc(db, 'production_lines', editingLine.id), { 
        name: editingLine.name.trim(),
        color: editingLine.color || LINE_COLORS[0].class
      });
      setEditingLine(null);
      setMessage({ type: 'success', text: 'Linha de produção atualizada.' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `production_lines/${editingLine.id}`);
    }
  };

  const handleDeleteLine = async () => {
    if (!lineToDelete) return;
    try {
      await deleteDoc(doc(db, 'production_lines', lineToDelete.id));
      setMessage({ type: 'success', text: 'Linha excluída.' });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `production_lines/${lineToDelete.id}`);
    } finally {
      setLineToDelete(null);
    }
  };

  // --- Stock Entry Handler ---
  const handleStockEntry = async () => {
    const { insertId } = stockEntry;
    const quantity = Number(stockEntry.quantity);
    const operatorId = stockEntry.operatorId || userProfile?.registrationId || '';
    
    if (!insertId || isNaN(quantity) || quantity <= 0) {
      setMessage({ type: 'error', text: 'Preencha todos os campos corretamente. A quantidade deve ser maior que zero.' });
      return;
    }

    if (operatorId.length < 3) {
      setMessage({ type: 'error', text: 'A matrícula deve ter no mínimo 3 dígitos.' });
      return;
    }

    const insert = inserts.find(i => i.id === insertId);
    if (!insert) {
      setMessage({ type: 'error', text: 'Modelo de inserto não encontrado.' });
      return;
    }

    setIsSaving(true);
    try {
      const line = 'Almoxarifado';
      const stockId = `${insertId}_${line}`;
      const stockRef = doc(db, 'insert_stocks', stockId);
      const stockSnap = await getDoc(stockRef);
      
      let currentQty = 0;
      if (stockSnap.exists()) {
        currentQty = stockSnap.data().quantity;
      }

      try {
        await addDoc(collection(db, 'insert_transactions'), {
          insertId,
          insertCode: insert.code,
          type: 'entry',
          quantity: quantity,
          line,
          operatorName: userProfile?.displayName || 'Gestor',
          operatorId: operatorId,
          timestamp: serverTimestamp(),
          performedBy: userProfile ? {
            uid: auth.currentUser?.uid || '',
            name: userProfile.displayName || auth.currentUser?.email || 'Usuário',
            email: userProfile.email
          } : undefined
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'insert_transactions');
        throw error;
      }

      try {
        await setDoc(stockRef, {
          insertId,
          line,
          quantity: currentQty + quantity
        }, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `insert_stocks/${stockId}`);
        throw error;
      }

      setMessage({ type: 'success', text: 'Entrada de estoque realizada com sucesso!' });
      setStockEntry(prev => ({ ...prev, quantity: 1 }));
      setStockEntryToConfirm(false);
    } catch (error) {
      console.error('Error in handleStockEntry:', error);
      setMessage({ type: 'error', text: 'Erro ao realizar entrada. Verifique suas permissões.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTransaction = async () => {
    if (!transactionToDelete) return;
    
    setIsSaving(true);
    try {
      const stockId = `${transactionToDelete.insertId}_${transactionToDelete.line}`;
      const stockRef = doc(db, 'insert_stocks', stockId);
      const stockSnap = await getDoc(stockRef);
      
      if (stockSnap.exists()) {
        const currentQty = Number(stockSnap.data().quantity) || 0;
        const adjustment = transactionToDelete.type === 'entry' ? -transactionToDelete.quantity : transactionToDelete.quantity;
        
        try {
          await setDoc(stockRef, {
            quantity: currentQty + adjustment
          }, { merge: true });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `insert_stocks/${stockId}`);
          throw error;
        }
      }

      await deleteDoc(doc(db, 'insert_transactions', transactionToDelete.id));
      setMessage({ type: 'success', text: 'Movimentação excluída e estoque ajustado.' });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `insert_transactions/${transactionToDelete.id}`);
    } finally {
      setIsSaving(false);
      setTransactionToDelete(null);
    }
  };

  const handleUpdateTransaction = async () => {
    if (!editingTransaction) return;
    
    setIsSaving(true);
    try {
      const oldDoc = await getDoc(doc(db, 'insert_transactions', editingTransaction.id));
      if (!oldDoc.exists()) throw new Error('Transação não encontrada');
      
      const oldData = oldDoc.data() as InsertTransaction;
      const stockId = `${oldData.insertId}_${oldData.line}`;
      const stockRef = doc(db, 'insert_stocks', stockId);
      const stockSnap = await getDoc(stockRef);

      if (stockSnap.exists()) {
        const currentQty = Number(stockSnap.data().quantity) || 0;
        // Revert old quantity
        const revertQty = oldData.type === 'entry' ? -oldData.quantity : oldData.quantity;
        // Apply new quantity
        const applyQty = editingTransaction.type === 'entry' ? editingTransaction.quantity : -editingTransaction.quantity;
        
        try {
          await setDoc(stockRef, {
            quantity: currentQty + revertQty + applyQty
          }, { merge: true });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `insert_stocks/${stockId}`);
          throw error;
        }
      }

      await updateDoc(doc(db, 'insert_transactions', editingTransaction.id), {
        quantity: editingTransaction.quantity,
        operatorId: editingTransaction.operatorId,
        updatedAt: serverTimestamp()
      });

      setEditingTransaction(null);
      setMessage({ type: 'success', text: 'Movimentação atualizada e estoque ajustado.' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `insert_transactions/${editingTransaction.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  // --- Stock Correction Handler ---
  const handleCorrectStock = async (stockId: string, newQuantity: number) => {
    setIsSaving(true);
    try {
      const stockRef = doc(db, 'insert_stocks', stockId);
      await setDoc(stockRef, { quantity: newQuantity }, { merge: true });
      setMessage({ type: 'success', text: 'Estoque corrigido manualmente.' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `insert_stocks/${stockId}`);
    } finally {
      setIsSaving(false);
    }
  };
  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'app_settings', 'global'), { ...settings, updatedAt: serverTimestamp() });
      setMessage({ type: 'success', text: 'Configurações globais salvas.' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'app_settings/global');
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

  const tabs = [
    { id: 'estoque', label: 'Estoque', icon: Boxes, visible: permissions.warehouse },
    { id: 'scraps', label: 'Refugos', icon: AlertTriangle, visible: permissions.history || permissions.reports || permissions.categories },
    { id: 'operadores', label: 'Operadores', icon: UserCheck, visible: permissions.manageOperators },
    { id: 'users', label: 'Usuários', icon: Users, visible: permissions.manageUsers },
    { id: 'settings', label: 'Sistema', icon: Settings, visible: permissions.settings },
  ].filter(tab => tab.visible || userProfile?.role === 'admin' || userProfile?.email === 'jamaicamo94@gmail.com') as { id: 'estoque' | 'scraps' | 'operadores' | 'users' | 'settings', label: string, icon: any }[];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight break-words">Painel do Gestor</h1>
            <p className="text-xs md:text-sm text-gray-500 font-medium">Controle administrativo e configurações</p>
          </div>
        </div>
      </div>

      <MessageModal 
        isOpen={!!message}
        onClose={() => setMessage(null)}
        type={message?.type || 'success'}
        message={message?.text || ''}
      />

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1 bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap",
              activeTab === tab.id 
                ? "bg-blue-600 text-white shadow-md shadow-blue-100" 
                : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {/* --- ESTOQUE TAB --- */}
            {activeTab === 'estoque' && (
              <div className="space-y-6">
                <div className="flex items-center gap-1 bg-gray-100/50 p-1 rounded-xl w-full overflow-x-auto no-scrollbar">
                  {(permissions.insertEntries || userProfile?.role === 'admin' || userProfile?.email === 'jamaicamo94@gmail.com') && (
                    <button
                      onClick={() => setEstoqueSubTab('entries')}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                        estoqueSubTab === 'entries' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                      )}
                    >
                      <ArrowUpCircle className="w-3.5 h-3.5" />
                      Entradas
                    </button>
                  )}
                  {(permissions.insertHistory || userProfile?.role === 'admin' || userProfile?.email === 'jamaicamo94@gmail.com') && (
                    <button
                      onClick={() => setEstoqueSubTab('history')}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                        estoqueSubTab === 'history' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                      )}
                    >
                      <History className="w-3.5 h-3.5" />
                      Histórico
                    </button>
                  )}
                  {(permissions.insertReports || userProfile?.role === 'admin' || userProfile?.email === 'jamaicamo94@gmail.com') && (
                    <button
                      onClick={() => setEstoqueSubTab('reports')}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                        estoqueSubTab === 'reports' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                      )}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Relatórios
                    </button>
                  )}
                  {(permissions.insertModels || userProfile?.role === 'admin' || userProfile?.email === 'jamaicamo94@gmail.com') && (
                    <button
                      onClick={() => setEstoqueSubTab('inserts')}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                        estoqueSubTab === 'inserts' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                      )}
                    >
                      <Package className="w-3.5 h-3.5" />
                      Modelos
                    </button>
                  )}
                  {(permissions.insertLines || userProfile?.role === 'admin' || userProfile?.email === 'jamaicamo94@gmail.com') && (
                    <button
                      onClick={() => setEstoqueSubTab('lines')}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                        estoqueSubTab === 'lines' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                      )}
                    >
                      <Factory className="w-3.5 h-3.5" />
                      Linhas
                    </button>
                  )}
                  {(permissions.insertCorrection || userProfile?.role === 'admin' || userProfile?.email === 'jamaicamo94@gmail.com') && (
                    <button
                      onClick={() => setEstoqueSubTab('correction')}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                        estoqueSubTab === 'correction' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                      )}
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      Correção
                    </button>
                  )}
                </div>

                <div className="space-y-6">
                  {(estoqueSubTab === 'entries' && (permissions.insertEntries || userProfile?.role === 'admin' || userProfile?.email === 'jamaicamo94@gmail.com')) && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-6">
                          <div className="flex items-center gap-2 mb-2">
                            <ArrowUpCircle className="w-5 h-5 text-emerald-600" />
                            <h3 className="font-bold text-gray-900">Nova Entrada</h3>
                          </div>
                          
                          <div className="space-y-4">
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Modelo de Inserto</label>
                              {!stockEntry.insertId && (
                                <input
                                  type="text"
                                  placeholder="Buscar modelo..."
                                  value={entrySearchTerm}
                                  onChange={(e) => setEntrySearchTerm(e.target.value)}
                                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 mb-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                              )}
                              <select
                                value={stockEntry.insertId}
                                onChange={(e) => setStockEntry({ ...stockEntry, insertId: e.target.value })}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                              >
                                <option value="">Selecione um modelo...</option>
                                {inserts
                                  .filter(i => 
                                    !entrySearchTerm || 
                                    i.code.toLowerCase().includes(entrySearchTerm.toLowerCase()) || 
                                    i.description.toLowerCase().includes(entrySearchTerm.toLowerCase())
                                  )
                                  .map(i => {
                                    const totalStock = stocks.filter(s => s.insertId === i.id).reduce((acc, s) => acc + s.quantity, 0);
                                    return (
                                      <option key={i.id} value={i.id}>{i.code} - {i.description} (Em uso: {totalStock})</option>
                                    )
                                  })}
                              </select>
                            </div>

                            {stockEntry.insertId && (
                              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                                {(() => {
                                  const insert = inserts.find(i => i.id === stockEntry.insertId);
                                  const totalStock = stocks
                                    .filter(s => s.insertId === stockEntry.insertId)
                                    .reduce((acc, s) => acc + s.quantity, 0);
                                  const isLow = insert ? totalStock < insert.minStock : false;

                                  return (
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-gray-500 uppercase">Estoque Atual:</span>
                                        <span className={cn(
                                          "text-sm font-black",
                                          isLow ? "text-red-600" : "text-emerald-600"
                                        )}>
                                          {totalStock} unidades
                                        </span>
                                      </div>
                                      {isLow && (
                                        <div className="flex items-center gap-2 p-2 bg-red-50 text-red-700 rounded-lg border border-red-100">
                                          <AlertTriangle className="w-4 h-4 shrink-0" />
                                          <p className="text-[10px] font-bold leading-tight">
                                            ESTOQUE ABAIXO DO MÍNIMO ({insert?.minStock})
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Quantidade</label>
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  value={stockEntry.quantity}
                                  onChange={(e) => setStockEntry({ ...stockEntry, quantity: Number(e.target.value) })}
                                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Sua Matrícula</label>
                                <input
                                  type="text"
                                  readOnly
                                  value={stockEntry.operatorId}
                                  className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-500 outline-none"
                                />
                              </div>
                            </div>

                            <button
                              onClick={() => setStockEntryToConfirm(true)}
                              disabled={isSaving || !stockEntry.insertId || stockEntry.quantity <= 0}
                              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 mt-4"
                            >
                              {isSaving ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /> : <Plus className="w-5 h-5" />}
                              Confirmar Entrada
                            </button>
                          </div>
                        </div>

                        <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100">
                          <h4 className="text-sm font-bold text-blue-900 mb-2">Dica do Gestor</h4>
                          <p className="text-xs text-blue-800 leading-relaxed">
                            As entradas de estoque são registradas automaticamente para o <strong>Almoxarifado</strong>. 
                            Certifique-se de que sua matrícula está correta no seu perfil para evitar erros de rastreabilidade.
                          </p>
                        </div>
                      </div>

                      <div className="lg:col-span-2">
                        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="font-bold text-gray-900 flex items-center gap-2">
                              <ClipboardList className="w-5 h-5 text-blue-600" />
                              Últimas Entradas
                            </h3>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-3 font-bold text-gray-500 uppercase tracking-wider">Data</th>
                                  <th className="px-4 py-3 font-bold text-gray-500 uppercase tracking-wider">Inserto</th>
                                  <th className="px-4 py-3 font-bold text-gray-500 uppercase tracking-wider">Qtd</th>
                                  <th className="px-4 py-3 font-bold text-gray-500 uppercase tracking-wider">Responsável</th>
                                  <th className="px-4 py-3 font-bold text-gray-500 uppercase tracking-wider text-right">Ações</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {transactions.filter(t => t.type === 'entry').slice(0, 10).map((t) => (
                                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3 text-gray-600">
                                      {t.timestamp ? format(t.timestamp.toDate(), "dd/MM HH:mm") : '-'}
                                    </td>
                                    <td className="px-4 py-3 font-bold text-gray-900">{t.insertCode}</td>
                                    <td className="px-4 py-3">
                                      <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg font-black">
                                        +{t.quantity}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">{t.operatorName}</td>
                                    <td className="px-4 py-3 text-right">
                                      <div className="flex items-center justify-end gap-1">
                                        {canEdit && (
                                          <button
                                            onClick={() => setEditingTransaction(t)}
                                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            title="Editar"
                                          >
                                            <Edit2 className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                        {canDelete && (
                                          <button
                                            onClick={() => setTransactionToDelete(t)}
                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Excluir"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                                {transactions.filter(t => t.type === 'entry').length === 0 && (
                                  <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-400 italic">Nenhuma entrada recente.</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {(estoqueSubTab === 'history' && (permissions.insertHistory || userProfile?.role === 'admin' || userProfile?.email === 'jamaicamo94@gmail.com')) && (
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                      <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                          <History className="w-5 h-5 text-blue-600" />
                          Histórico Completo de Movimentações
                        </h3>
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="text"
                              placeholder="Filtrar histórico..."
                              className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-64"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 font-bold text-gray-500 uppercase tracking-wider">Data</th>
                              <th className="px-4 py-3 font-bold text-gray-500 uppercase tracking-wider">Inserto</th>
                              <th className="px-4 py-3 font-bold text-gray-500 uppercase tracking-wider">Tipo</th>
                              <th className="px-4 py-3 font-bold text-gray-500 uppercase tracking-wider">Qtd</th>
                              <th className="px-4 py-3 font-bold text-gray-500 uppercase tracking-wider">Linha/Destino</th>
                              <th className="px-4 py-3 font-bold text-gray-500 uppercase tracking-wider">Operador</th>
                              <th className="px-4 py-3 font-bold text-gray-500 uppercase tracking-wider">Matrícula</th>
                              <th className="px-4 py-3 font-bold text-gray-500 uppercase tracking-wider">Realizado por</th>
                              <th className="px-4 py-3 font-bold text-gray-500 uppercase tracking-wider text-right">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {transactions.map((t) => (
                              <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3 text-gray-600">
                                  {t.timestamp ? format(t.timestamp.toDate(), "dd/MM HH:mm") : '-'}
                                </td>
                                <td className="px-4 py-3 font-bold text-gray-900">{t.insertCode}</td>
                                <td className="px-4 py-3">
                                  <span className={cn(
                                    "px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
                                    t.type === 'entry' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                                  )}>
                                    {t.type === 'entry' ? 'Entrada' : 'Saída'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 font-bold text-gray-900">{t.quantity}</td>
                                <td className="px-4 py-3 text-gray-600">{t.line}</td>
                                <td className="px-4 py-3 text-gray-600">{t.operatorName}</td>
                                <td className="px-4 py-3 text-gray-600 font-mono">{t.operatorId}</td>
                                <td className="px-4 py-3 text-gray-600">
                                  {t.performedBy ? (
                                    <div className="flex flex-col">
                                      <span className="font-bold">{t.performedBy.name}</span>
                                      <span className="text-[10px] opacity-70">{t.performedBy.email}</span>
                                    </div>
                                  ) : '-'}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    {canEdit && (
                                      <button
                                        onClick={() => setEditingTransaction(t)}
                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="Editar"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    {canDelete && (
                                      <button
                                        onClick={() => setTransactionToDelete(t)}
                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Excluir"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {(estoqueSubTab === 'correction' && (permissions.insertCorrection || userProfile?.role === 'admin' || userProfile?.email === 'jamaicamo94@gmail.com')) && (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100 bg-amber-50">
                <h3 className="text-lg font-bold text-amber-900 flex items-center gap-2">
                  <Wrench className="w-5 h-5" />
                  Correção Manual de Estoque
                </h3>
                <p className="text-xs text-amber-700 font-medium mt-1">Use esta ferramenta para ajustar o saldo físico quando houver divergências.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50">
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Inserto</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Linha / Local</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Saldo Atual</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Nova Quantidade</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {stocks.map((stock) => {
                      const insert = inserts.find(i => i.id === stock.insertId);
                      return (
                        <tr key={stock.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200 overflow-hidden">
                                {insert?.imageUrl ? (
                                  <img src={insert.imageUrl} alt={insert.code} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <Package className="w-4 h-4 text-gray-400" />
                                )}
                              </div>
                              <div>
                                <p className="text-xs font-black text-blue-600 uppercase tracking-widest">{insert?.code || '???'}</p>
                                <p className="text-[11px] font-bold text-gray-900 truncate max-w-[150px]">{insert?.description || 'Modelo não encontrado'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg text-[10px] font-black uppercase tracking-wider">
                              {stock.line}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "text-sm font-black",
                              stock.quantity < 0 ? "text-red-600" : "text-gray-900"
                            )}>
                              {stock.quantity}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="number"
                              defaultValue={stock.quantity}
                              onBlur={(e) => {
                                const val = Number(e.target.value);
                                if (!isNaN(val) && val !== stock.quantity) {
                                  // We'll use a local state or just handle it on button click
                                  // For simplicity, we'll use a ref-like approach or just let the user type
                                }
                              }}
                              id={`correct-${stock.id}`}
                              className="w-24 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => {
                                const input = document.getElementById(`correct-${stock.id}`) as HTMLInputElement;
                                const val = Number(input.value);
                                if (!isNaN(val)) {
                                  handleCorrectStock(stock.id, val);
                                }
                              }}
                              disabled={isSaving}
                              className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all"
                              title="Salvar Correção"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {stocks.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500 font-medium">
                          Nenhum registro de estoque encontrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(estoqueSubTab === 'reports' && (permissions.insertReports || userProfile?.role === 'admin' || userProfile?.email === 'jamaicamo94@gmail.com')) && (
                    <InsertReports 
                      inserts={inserts} 
                      stocks={stocks} 
                      transactions={transactions} 
                      productionLines={productionLines}
                    />
                  )}
                  {(estoqueSubTab === 'inserts' && (permissions.insertModels || userProfile?.role === 'admin' || userProfile?.email === 'jamaicamo94@gmail.com')) && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="relative flex-1 max-w-md">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Buscar modelos..."
                            value={insertSearchTerm}
                            onChange={(e) => setInsertSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                          />
                        </div>
                        {canEdit && (
                          <button
                            onClick={() => setIsAddingInsert(true)}
                            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all font-bold text-sm shadow-lg shadow-blue-100"
                          >
                            <Plus className="w-4 h-4" />
                            Novo Modelo
                          </button>
                        )}
                      </div>

                      <AnimatePresence>
                        {isAddingInsert && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4 overflow-hidden"
                          >
                            <h3 className="font-bold text-gray-900">Cadastrar Novo Modelo</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                              <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-500 uppercase">Código</label>
                                <input
                                  type="text"
                                  value={newInsert.code}
                                  onChange={(e) => setNewInsert({ ...newInsert, code: e.target.value })}
                                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-500 uppercase">Fabricante</label>
                                <input
                                  type="text"
                                  value={newInsert.manufacturer}
                                  onChange={(e) => setNewInsert({ ...newInsert, manufacturer: e.target.value })}
                                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-500 uppercase">Estoque Mínimo</label>
                                <input
                                  type="number"
                                  value={newInsert.minStock}
                                  onChange={(e) => setNewInsert({ ...newInsert, minStock: Number(e.target.value) })}
                                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-500 uppercase">Preço (R$)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={newInsert.price || ''}
                                  onChange={(e) => setNewInsert({ ...newInsert, price: Number(e.target.value) })}
                                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-500 uppercase">Imagem do Inserto</label>
                                <div className="flex items-center gap-2">
                                  {newInsert.imageUrl && (
                                    <div className="w-10 h-10 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                                      <img src={newInsert.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                    </div>
                                  )}
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleImageUpload(e, false)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                  />
                                </div>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-gray-500 uppercase">Descrição</label>
                              <input
                                type="text"
                                value={newInsert.description}
                                onChange={(e) => setNewInsert({ ...newInsert, description: e.target.value })}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                            <div className="flex gap-2 pt-2">
                              <button onClick={handleCreateInsert} className="flex-1 bg-blue-600 text-white font-bold py-2.5 rounded-xl hover:bg-blue-700 transition-all">Salvar Modelo</button>
                              <button onClick={() => setIsAddingInsert(false)} className="px-6 py-2.5 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all">Cancelar</button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {inserts.filter(i => i.code.toLowerCase().includes(insertSearchTerm.toLowerCase()) || i.description.toLowerCase().includes(insertSearchTerm.toLowerCase())).map((insert) => (
                          <div key={insert.id} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 group">
                            {editingInsert?.id === insert.id ? (
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Código</label>
                                    <input type="text" value={editingInsert.code} onChange={(e) => setEditingInsert({ ...editingInsert, code: e.target.value })} className="w-full bg-gray-50 border-none rounded-xl px-3 py-2 text-sm font-bold" />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Fabricante</label>
                                    <input type="text" value={editingInsert.manufacturer} onChange={(e) => setEditingInsert({ ...editingInsert, manufacturer: e.target.value })} className="w-full bg-gray-50 border-none rounded-xl px-3 py-2 text-sm" />
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-gray-400 uppercase">Descrição</label>
                                  <input type="text" value={editingInsert.description} onChange={(e) => setEditingInsert({ ...editingInsert, description: e.target.value })} className="w-full bg-gray-50 border-none rounded-xl px-3 py-2 text-sm" />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Estoque Mínimo</label>
                                    <input type="number" value={editingInsert.minStock} onChange={(e) => setEditingInsert({ ...editingInsert, minStock: Number(e.target.value) })} className="w-full bg-gray-50 border-none rounded-xl px-3 py-2 text-sm" />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Preço (R$)</label>
                                    <input type="number" step="0.01" value={editingInsert.price || ''} onChange={(e) => setEditingInsert({ ...editingInsert, price: Number(e.target.value) })} className="w-full bg-gray-50 border-none rounded-xl px-3 py-2 text-sm" />
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-gray-400 uppercase">Imagem do Inserto</label>
                                    <div className="flex items-center gap-2">
                                      {editingInsert.imageUrl && (
                                        <div className="w-8 h-8 rounded-md overflow-hidden border border-gray-200 flex-shrink-0">
                                          <img src={editingInsert.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                        </div>
                                      )}
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleImageUpload(e, true)}
                                        className="w-full bg-gray-50 border-none rounded-xl px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                      />
                                    </div>
                                  </div>
                                <div className="flex gap-2 pt-2">
                                  <button onClick={handleUpdateInsert} className="flex-1 bg-blue-600 text-white font-bold py-2 rounded-xl text-xs">Salvar Alterações</button>
                                  <button onClick={() => setEditingInsert(null)} className="px-3 py-2 bg-gray-100 text-gray-600 font-bold rounded-xl text-xs">Cancelar</button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-3 mb-3">
                                    <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                                      {insert.imageUrl ? (
                                        <img src={insert.imageUrl} alt={insert.code} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                      ) : (
                                        (() => {
                                          const Icon = getModelIcon(insert.id);
                                          return <Icon className="w-6 h-6 text-gray-300" />;
                                        })()
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-0.5">{insert.code}</p>
                                      <h4 className="text-sm font-bold text-gray-900 line-clamp-1">{insert.description}</h4>
                                    </div>
                                  </div>
                                  <p className="text-xs text-gray-500 font-medium">{insert.manufacturer || 'Sem fabricante'}</p>
                                  <div className="mt-4 flex items-center gap-3">
                                    <div className="px-2 py-1 bg-gray-50 rounded-lg border border-gray-100">
                                      <p className="text-[9px] font-bold text-gray-400 uppercase">Mínimo</p>
                                      <p className="text-xs font-black text-gray-900">{insert.minStock}</p>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                  {canEdit && (
                                    <button onClick={() => setEditingInsert(insert)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Edit2 className="w-4 h-4" /></button>
                                  )}
                                  {canDelete && (
                                    <button onClick={() => setInsertToDelete(insert)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 className="w-4 h-4" /></button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(estoqueSubTab === 'lines' && (permissions.insertLines || userProfile?.role === 'admin' || userProfile?.email === 'jamaicamo94@gmail.com')) && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-gray-900">Linhas de Produção</h3>
                        {canEdit && (
                          <button
                            onClick={() => setIsAddingLine(true)}
                            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all font-bold text-sm shadow-lg shadow-blue-100"
                          >
                            <Plus className="w-4 h-4" />
                            Nova Linha
                          </button>
                        )}
                      </div>

                      <AnimatePresence>
                        {isAddingLine && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4 overflow-hidden"
                          >
                            <div className="flex-1 space-y-1.5">
                              <label className="text-xs font-bold text-gray-500 uppercase">Nome da Linha</label>
                              <input
                                type="text"
                                value={newLineName}
                                onChange={(e) => setNewLineName(e.target.value)}
                                placeholder="Ex: Linha 01"
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                            <div className="flex gap-2 pt-5">
                              <button onClick={handleCreateLine} className="bg-blue-600 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-blue-700 transition-all">Criar</button>
                              <button onClick={() => setIsAddingLine(false)} className="bg-gray-100 text-gray-600 font-bold px-6 py-2.5 rounded-xl hover:bg-gray-200 transition-all">Cancelar</button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {productionLines.map((line) => {
                          const lineColor = LINE_COLORS.find(c => c.class === line.color) || LINE_COLORS[0];
                          
                          return (
                            <div key={line.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3 group">
                              {editingLine?.id === line.id ? (
                                <div className="space-y-3">
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Nome da Linha</label>
                                    <input
                                      type="text"
                                      value={editingLine.name}
                                      onChange={(e) => setEditingLine({ ...editingLine, name: e.target.value })}
                                      className="w-full bg-gray-50 border-none rounded-lg px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                      autoFocus
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Cor da Linha</label>
                                    <div className="flex flex-wrap gap-1.5">
                                      {LINE_COLORS.map((c) => (
                                        <button
                                          key={c.class}
                                          onClick={() => setEditingLine({ ...editingLine, color: c.class })}
                                          className={cn(
                                            "w-6 h-6 rounded-full border-2 transition-all",
                                            editingLine.color === c.class ? "border-gray-900 scale-110" : "border-transparent hover:scale-105",
                                            c.class
                                          )}
                                          title={c.name}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                  <div className="flex gap-2 pt-1">
                                    <button onClick={handleUpdateLine} className="flex-1 bg-blue-600 text-white font-bold py-2 rounded-xl text-[10px] flex items-center justify-center gap-1">
                                      <Check className="w-3 h-3" /> Salvar
                                    </button>
                                    <button onClick={() => setEditingLine(null)} className="px-3 py-2 bg-gray-100 text-gray-600 font-bold rounded-xl text-[10px]">Cancelar</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div className={cn("p-2 rounded-xl shrink-0", lineColor.bg)}>
                                        <Factory className={cn("w-4 h-4", lineColor.text)} />
                                      </div>
                                      <span className="text-sm font-bold text-gray-900 truncate">{line.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                      {canEdit && (
                                        <button onClick={() => setEditingLine(line)} className="p-1.5 text-gray-400 hover:text-blue-600"><Edit2 className="w-3.5 h-3.5" /></button>
                                      )}
                                      {canDelete && (
                                        <button onClick={() => setLineToDelete(line)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className={cn("w-full h-1 rounded-full", line.color || 'bg-gray-200')} />
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* --- REFUGOS TAB --- */}
            {activeTab === 'scraps' && (
              <div className="space-y-6">
                <div className="flex items-center gap-1 bg-gray-100/50 p-1 rounded-xl w-fit">
                  <button
                    onClick={() => setScrapSubTab('history')}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
                      scrapSubTab === 'history' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    )}
                  >
                    <ListFilter className="w-3.5 h-3.5" />
                    Histórico
                  </button>
                  <button
                    onClick={() => setScrapSubTab('reports')}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
                      scrapSubTab === 'reports' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    )}
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    Relatórios
                  </button>
                  <button
                    onClick={() => setScrapSubTab('categories')}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
                      scrapSubTab === 'categories' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    )}
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    Categorias
                  </button>
                </div>

                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                  {scrapSubTab === 'history' && (
                    <RecordList 
                      records={scrapRecords} 
                      onDelete={async (id) => setScrapToDelete(id)}
                      onEdit={() => {}} // In manager panel, we might just allow delete or view
                      permissions={{...permissions, deleteRecords: canDelete, editRecords: canEdit} as UserPermissions}
                    />
                  )}
                  {scrapSubTab === 'reports' && (
                    <div className="p-6">
                      <Reports records={scrapRecords} defectTypes={defectTypes} />
                    </div>
                  )}
                  {scrapSubTab === 'categories' && (
                    <div className="p-6">
                      <DefectManager defectTypes={defectTypes} canEdit={canEdit} canDelete={canDelete} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* --- USERS TAB --- */}
            {activeTab === 'users' && (
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
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
                        placeholder="Buscar usuários..."
                        value={userSearchTerm}
                        onChange={(e) => setUserSearchTerm(e.target.value)}
                        className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-64"
                      />
                    </div>
                    <button onClick={() => setIsAddingUser(!isAddingUser)} className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all font-bold text-sm">
                      <Plus className="w-4 h-4" /> Convidar
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  <AnimatePresence>
                    {isAddingUser && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-8 p-6 bg-gray-50 rounded-2xl border border-gray-100 space-y-4 overflow-hidden">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">E-mail</label>
                            <input type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="Email" className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Senha (Opcional)</label>
                            <div className="relative">
                              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                              <input type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm" />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Matrícula</label>
                            <input type="text" value={newUserRegistrationId} onChange={(e) => setNewUserRegistrationId(e.target.value)} placeholder="Matrícula" className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Função</label>
                            <select value={newUserRole} onChange={(e) => setNewUserRole(e.target.value as any)} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm">
                              <option value="viewer">Visualizador</option>
                              <option value="operator">Operador</option>
                              <option value="admin">Administrador</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={handleAddUser} className="flex-1 bg-blue-600 text-white font-bold py-2.5 rounded-xl">
                            {newUserPassword ? 'Criar e Autorizar' : 'Autorizar por E-mail'}
                          </button>
                          <button onClick={() => setIsAddingUser(false)} className="px-6 py-2.5 bg-white border border-gray-200 text-gray-600 font-bold rounded-xl">Cancelar</button>
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
                          <th className="pb-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Função</th>
                          <th className="pb-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {users.filter(u => u.email.toLowerCase().includes(userSearchTerm.toLowerCase())).map((user) => (
                          <React.Fragment key={user.id}>
                            <tr className="group hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}>
                              <td className="py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                                    {user.photoURL ? <img src={user.photoURL} className="w-full h-full object-cover" /> : <UserIcon className="w-5 h-5 text-gray-400" />}
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-gray-900">{user.displayName || 'Sem nome'}</p>
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
                                  <td colSpan={4} className="px-6 py-6 bg-gray-50/80 border-y border-gray-100">
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-4">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <Shield className="w-4 h-4 text-blue-600" />
                                          <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest">Controle de Acesso</h4>
                                        </div>
                                        <div className="flex gap-2">
                                          <button 
                                            onClick={() => handleSetAllPermissions(user.id, true)}
                                            className="text-[10px] font-bold text-blue-600 hover:underline"
                                          >
                                            Marcar Todos
                                          </button>
                                          <span className="text-gray-300">|</span>
                                          <button 
                                            onClick={() => handleSetAllPermissions(user.id, false)}
                                            className="text-[10px] font-bold text-gray-600 hover:underline"
                                          >
                                            Desmarcar Todos
                                          </button>
                                        </div>
                                      </div>
                                      
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                          {ALL_PERMISSIONS_LIST.map((perm) => (
                                            <button 
                                              key={perm.id} 
                                              onClick={() => handleTogglePermission(user.id, perm.id as keyof UserPermissions)} 
                                              className={cn(
                                                "flex items-center gap-2 p-2.5 rounded-xl border transition-all text-[10px] font-bold", 
                                                user.permissions?.[perm.id as keyof UserPermissions] 
                                                  ? "bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-100" 
                                                  : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                                              )}
                                            >
                                              {user.permissions?.[perm.id as keyof UserPermissions] ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                                              {perm.label}
                                            </button>
                                          ))}
                                        </div>
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
              </div>
            )}

            {activeTab === 'operadores' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <OperatorManager permissions={permissions} />
              </motion.div>
            )}

            {/* --- SETTINGS TAB --- */}
            {activeTab === 'settings' && (
              <div className="max-w-2xl space-y-6">
                {/* Meu Perfil Section */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-6 border-b border-gray-100 flex items-center gap-2">
                    <UserIcon className="w-6 h-6 text-blue-600" />
                    <h2 className="text-xl font-semibold text-gray-900">Meu Perfil</h2>
                  </div>
                  <div className="p-6">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-100">
                        {userProfile?.photoURL ? (
                          <img src={userProfile.photoURL} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <UserIcon className="w-8 h-8 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">{userProfile?.displayName || 'Administrador'}</h3>
                        <p className="text-sm text-gray-500">{userProfile?.email}</p>
                        <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-black uppercase rounded-lg">
                          {userProfile?.role}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">Minha Matrícula</label>
                      <input 
                        type="text" 
                        value={userProfile?.registrationId || ''} 
                        onChange={(e) => auth.currentUser && handleUpdateRegistrationId(auth.currentUser.uid, e.target.value)}
                        placeholder="Digite sua matrícula"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold" 
                      />
                      <p className="text-[10px] text-gray-400 font-medium italic">
                        * Esta matrícula será usada automaticamente em suas movimentações de estoque.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-6 border-b border-gray-100 flex items-center gap-2">
                    <Layout className="w-6 h-6 text-blue-600" />
                    <h2 className="text-xl font-semibold text-gray-900">Configurações do Aplicativo</h2>
                  </div>
                  <div className="p-6 space-y-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">Nome do Aplicativo</label>
                      <input type="text" value={settings.appName} onChange={(e) => setSettings({ ...settings, appName: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">URL do Logo</label>
                      <input type="text" value={settings.logoUrl} onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">Altura do Logo (px)</label>
                      <input type="range" min="20" max="100" value={settings.logoHeight || 40} onChange={(e) => setSettings({ ...settings, logoHeight: parseInt(e.target.value) })} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                    </div>
                    <button onClick={handleSaveSettings} disabled={isSaving} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-100">
                      {isSaving ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /> : <Save className="w-5 h-5" />}
                      Salvar Configurações
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      {/* App Settings Modal */}
      {/* ... existing settings modal ... */}

      {/* Edit Transaction Modal */}
      <AnimatePresence>
        {editingTransaction && (
          <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-blue-600">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <Edit2 className="w-5 h-5" />
                  Editar Movimentação
                </h3>
                <button onClick={() => setEditingTransaction(null)} className="text-white/80 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="p-4 bg-gray-50 rounded-2xl space-y-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Inserto</p>
                  <p className="font-bold text-gray-900">{editingTransaction.insertCode}</p>
                  <p className="text-xs text-gray-500">{editingTransaction.type === 'entry' ? 'Entrada' : 'Saída'} em {editingTransaction.line}</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Quantidade</label>
                  <input
                    type="number"
                    value={editingTransaction.quantity}
                    onChange={(e) => setEditingTransaction({ ...editingTransaction, quantity: Number(e.target.value) })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Matrícula</label>
                  <input
                    type="text"
                    value={editingTransaction.operatorId}
                    onChange={(e) => setEditingTransaction({ ...editingTransaction, operatorId: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setEditingTransaction(null)}
                    className="flex-1 px-6 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleUpdateTransaction}
                    disabled={isSaving || editingTransaction.quantity <= 0}
                    className="flex-1 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                  >
                    {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Matrícula</label>
                    <input
                      type="text"
                      value={editingUser.registrationId || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, registrationId: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">E-mail</label>
                  <input
                    type="email"
                    value={editingUser.email}
                    onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
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
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="admin">Administrador</option>
                    <option value="operator">Operador</option>
                    <option value="viewer">Visualizador</option>
                    <option value="custom">Personalizado</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Permissões Detalhadas</label>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-gray-50 rounded-2xl border border-gray-100">
                    {ALL_PERMISSIONS_LIST.map((perm) => (
                      <button
                        key={perm.id}
                        onClick={() => {
                          const newPermissions = { 
                            ...editingUser.permissions, 
                            [perm.id]: !editingUser.permissions?.[perm.id as keyof UserPermissions] 
                          };
                          setEditingUser({ ...editingUser, permissions: newPermissions, role: 'custom' });
                        }}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-lg border transition-all text-[10px] font-bold text-left",
                          editingUser.permissions?.[perm.id as keyof UserPermissions]
                            ? "bg-blue-600 border-blue-600 text-white"
                            : "bg-white border-gray-200 text-gray-500 hover:border-blue-200"
                        )}
                      >
                        {editingUser.permissions?.[perm.id as keyof UserPermissions] ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        {perm.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setEditingUser(null)}
                    className="flex-1 px-6 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={isSaving}
                    className="flex-1 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
                  >
                    {isSaving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Save className="w-4 h-4" />}
                    Salvar Alterações
                  </button>
                </div>
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

      {/* Delete Scrap Confirmation Modal */}
      <AnimatePresence>
        {scrapToDelete && (
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
                  <h3 className="text-lg font-bold text-red-900">Excluir Registro</h3>
                </div>
                <button onClick={() => setScrapToDelete(null)} className="p-2 hover:bg-red-100 rounded-xl transition-all">
                  <X className="w-5 h-5 text-red-400" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-gray-600 font-medium">Tem certeza que deseja excluir este registro de refugo?</p>
                <div className="flex gap-3 pt-4">
                  <button onClick={() => setScrapToDelete(null)} className="flex-1 px-6 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all">Cancelar</button>
                  <button onClick={handleDeleteScrap} className="flex-1 px-6 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-100 flex items-center justify-center gap-2">
                    <Trash2 className="w-4 h-4" /> Excluir
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Insert Confirmation Modal */}
      <AnimatePresence>
        {insertToDelete && (
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
                  <h3 className="text-lg font-bold text-red-900">Excluir Modelo</h3>
                </div>
                <button onClick={() => setInsertToDelete(null)} className="p-2 hover:bg-red-100 rounded-xl transition-all">
                  <X className="w-5 h-5 text-red-400" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-gray-600 font-medium">Tem certeza que deseja excluir o modelo <span className="font-bold text-gray-900">{insertToDelete.code}</span>?</p>
                <div className="flex gap-3 pt-4">
                  <button onClick={() => setInsertToDelete(null)} className="flex-1 px-6 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all">Cancelar</button>
                  <button onClick={handleDeleteInsert} className="flex-1 px-6 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-100 flex items-center justify-center gap-2">
                    <Trash2 className="w-4 h-4" /> Excluir
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Line Confirmation Modal */}
      <AnimatePresence>
        {lineToDelete && (
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
                  <h3 className="text-lg font-bold text-red-900">Excluir Linha</h3>
                </div>
                <button onClick={() => setLineToDelete(null)} className="p-2 hover:bg-red-100 rounded-xl transition-all">
                  <X className="w-5 h-5 text-red-400" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-gray-600 font-medium">Tem certeza que deseja excluir a linha <span className="font-bold text-gray-900">{lineToDelete.name}</span>?</p>
                <div className="flex gap-3 pt-4">
                  <button onClick={() => setLineToDelete(null)} className="flex-1 px-6 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all">Cancelar</button>
                  <button onClick={handleDeleteLine} className="flex-1 px-6 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-100 flex items-center justify-center gap-2">
                    <Trash2 className="w-4 h-4" /> Excluir
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Transaction Confirmation Modal */}
      <AnimatePresence>
        {transactionToDelete && (
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
                  <h3 className="text-lg font-bold text-red-900">Excluir Movimentação</h3>
                </div>
                <button onClick={() => setTransactionToDelete(null)} className="p-2 hover:bg-red-100 rounded-xl transition-all">
                  <X className="w-5 h-5 text-red-400" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-gray-600 font-medium">Tem certeza que deseja excluir esta movimentação de estoque?</p>
                <p className="text-xs text-amber-600 font-bold bg-amber-50 p-3 rounded-xl border border-amber-100">
                  Atenção: O estoque do inserto será ajustado automaticamente.
                </p>
                <div className="flex gap-3 pt-4">
                  <button onClick={() => setTransactionToDelete(null)} className="flex-1 px-6 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all">Cancelar</button>
                  <button onClick={handleDeleteTransaction} className="flex-1 px-6 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-100 flex items-center justify-center gap-2">
                    <Trash2 className="w-4 h-4" /> Excluir
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Stock Entry Confirmation Modal */}
      <AnimatePresence>
        {stockEntryToConfirm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-emerald-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-xl">
                    <ArrowUpCircle className="w-5 h-5 text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-bold text-emerald-900">Confirmar Entrada</h3>
                </div>
                <button onClick={() => setStockEntryToConfirm(false)} className="p-2 hover:bg-emerald-100 rounded-xl transition-all">
                  <X className="w-5 h-5 text-emerald-400" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="p-4 bg-gray-50 rounded-2xl space-y-2">
                  <div className="flex justify-between text-xs font-bold text-gray-500 uppercase">
                    <span>Modelo:</span>
                    <span className="text-gray-900">{inserts.find(i => i.id === stockEntry.insertId)?.code}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-gray-500 uppercase">
                    <span>Quantidade:</span>
                    <span className="text-emerald-600">+{stockEntry.quantity} unidades</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600">Deseja confirmar a entrada deste material no estoque?</p>
                <div className="flex gap-3 pt-4">
                  <button onClick={() => setStockEntryToConfirm(false)} className="flex-1 px-6 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all">Cancelar</button>
                  <button onClick={handleStockEntry} className="flex-1 px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2">
                    <Check className="w-4 h-4" /> Confirmar
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
