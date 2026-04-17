import React, { useState, useEffect } from 'react';
import { 
  auth, db, googleProvider, signInWithPopup, signOut, 
  collection, addDoc, onSnapshot, query, orderBy, serverTimestamp,
  handleFirestoreError, OperationType, Timestamp, deleteDoc, doc, updateDoc,
  getDoc, setDoc, getDocs, where, limit
} from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  ScrapRecord, Shift, DefectType, DefectTypeConfig, AppSettings, UserProfile, UserPermissions,
  DEFAULT_PERMISSIONS, ADMIN_PERMISSIONS, OPERATOR_PERMISSIONS, VIEWER_PERMISSIONS,
  Insert, InsertTransaction, InsertStock, ProductionLine
} from './types';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { ScrapForm } from './components/ScrapForm';
import { RecordList } from './components/RecordList';
import { Reports } from './components/Reports';
import { InsertManager } from './components/InsertManager';
import { InsertDashboard } from './components/InsertDashboard';
import { DefectManager } from './components/DefectManager';
import { AppSettingsManager } from './components/AppSettingsManager';
import { ManagerPanel } from './components/ManagerPanel';
import { ImprovementManager } from './components/ImprovementManager';
import { ToolManager } from './components/ToolManager';
import { Login } from './components/Login';
import { Loading } from './components/Loading';
import { ErrorBoundary } from './components/ErrorBoundary';

import { Plus } from 'lucide-react';
import { motion } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<ScrapRecord[]>([]);
  const [defectTypes, setDefectTypes] = useState<DefectTypeConfig[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>({
    appName: 'Classificação de Refugo',
    logoUrl: 'https://www.fremax.com/assets/img/logo-fremax.png',
    logoHeight: 40
  });
  const [activeTab, setActiveTab] = useState<'dashboard' | 'form' | 'list' | 'reports' | 'inserts' | 'defects' | 'settings' | 'manager' | 'insertDashboard' | 'improvements' | 'tools'>('dashboard');
  const [managerInitialTab, setManagerInitialTab] = useState<'users' | 'estoque' | 'scraps' | 'operadores' | 'settings' | undefined>(undefined);
  const [editingRecord, setEditingRecord] = useState<ScrapRecord | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Fetch or create user profile
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (userDocSnap.exists()) {
          setUserProfile(userDocSnap.data() as UserProfile);
        } else {
          // Check if user was pre-authorized by email
          const q = query(collection(db, 'users'), where('email', '==', currentUser.email?.toLowerCase()));
          const querySnap = await getDocs(q);
          
          if (!querySnap.empty) {
            // User was pre-authorized, adopt that document
            const preAuthDoc = querySnap.docs[0];
            const preAuthData = preAuthDoc.data() as UserProfile;
            
            const updatedProfile: UserProfile = {
              ...preAuthData,
              displayName: currentUser.displayName || preAuthData.displayName || '',
              photoURL: currentUser.photoURL || preAuthData.photoURL || '',
              updatedAt: new Date().toISOString(),
              isPending: false,
              permissions: preAuthData.permissions || (
                preAuthData.role === 'admin' ? ADMIN_PERMISSIONS :
                preAuthData.role === 'operator' ? OPERATOR_PERMISSIONS :
                preAuthData.role === 'viewer' ? VIEWER_PERMISSIONS : DEFAULT_PERMISSIONS
              )
            };
            
            // Delete the old doc (if it had a random ID) and create/set the new one with UID
            if (preAuthDoc.id !== currentUser.uid) {
              await deleteDoc(doc(db, 'users', preAuthDoc.id));
            }
            await setDoc(userDocRef, updatedProfile);
            setUserProfile(updatedProfile);
          } else {
            // Create default profile
            const isAdminEmail = currentUser.email === 'jamaicamo94@gmail.com';
            const newProfile: UserProfile = {
              email: currentUser.email || '',
              role: isAdminEmail ? 'admin' : 'viewer',
              permissions: isAdminEmail ? ADMIN_PERMISSIONS : VIEWER_PERMISSIONS,
              displayName: currentUser.displayName || '',
              photoURL: currentUser.photoURL || '',
              updatedAt: new Date().toISOString()
            };
            await setDoc(userDocRef, newProfile);
            setUserProfile(newProfile);
          }
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        setUserProfile(snapshot.data() as UserProfile);
      }
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const path = 'app_settings';
    const unsubscribe = onSnapshot(doc(db, path, 'global'), (snapshot) => {
      if (snapshot.exists()) {
        setAppSettings(snapshot.data() as AppSettings);
      }
    }, (error) => {
      console.error('Error fetching app settings:', error);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !userProfile) return;

    const path = 'scrap_records';
    const q = query(collection(db, path), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newRecords = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ScrapRecord[];
      setRecords(newRecords);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return () => unsubscribe();
  }, [user, userProfile]);

  useEffect(() => {
    if (!user || !userProfile) return;

    const path = 'defect_types';
    const q = query(collection(db, path), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newTypes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as DefectTypeConfig[];
      setDefectTypes(newTypes);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return () => unsubscribe();
  }, [user, userProfile]);

  const [inserts, setInserts] = useState<Insert[]>([]);
  const [transactions, setTransactions] = useState<InsertTransaction[]>([]);
  const [stocks, setStocks] = useState<InsertStock[]>([]);
  const [productionLines, setProductionLines] = useState<ProductionLine[]>([]);

  useEffect(() => {
    if (!user || !userProfile) return;

    const unsubInserts = onSnapshot(query(collection(db, 'inserts'), orderBy('code', 'asc')), (snapshot) => {
      setInserts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Insert)));
    });

    const unsubTransactions = onSnapshot(query(collection(db, 'insert_transactions'), orderBy('timestamp', 'desc'), limit(100)), (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InsertTransaction)));
    });

    const unsubStocks = onSnapshot(collection(db, 'insert_stocks'), (snapshot) => {
      setStocks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InsertStock)));
    });

    const unsubLines = onSnapshot(query(collection(db, 'production_lines'), orderBy('name', 'asc')), (snapshot) => {
      setProductionLines(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductionLine)));
    });

    return () => {
      unsubInserts();
      unsubTransactions();
      unsubStocks();
      unsubLines();
    };
  }, [user, userProfile]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login error:", error);
      // Extra error context for unauthorized Vercel domains
      if (error.code === 'auth/unauthorized-domain') {
        alert("Atenção: O domínio atual (Vercel) não está autorizado para login. Vá no Firebase Console -> Authentication -> Settings -> Authorized domains e adicione a URL da sua aplicação.");
      } else if (error.code === 'auth/popup-closed-by-user') {
        // Usuário apenas fechou o popup
      } else {
        alert("Ocorreu um erro no login com o Google: " + error.message);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleAddRecord = async (data: {
    partName: string;
    defectType: DefectType;
    shift: Shift;
    quantity: number;
    date: string;
    notes: string;
  }) => {
    if (!user) return;

    const path = 'scrap_records';
    try {
      const [year, month, day] = data.date.split('-').map(Number);
      const recordDate = new Date(year, month - 1, day);
      const now = new Date();
      recordDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());

      const { date, ...rest } = data;

      if (editingRecord) {
        await updateDoc(doc(db, path, editingRecord.id), {
          ...rest,
          quantity: Math.floor(rest.quantity),
          timestamp: Timestamp.fromDate(recordDate),
          updatedAt: serverTimestamp()
        });
        setEditingRecord(null);
        setActiveTab('list');
      } else {
        await addDoc(collection(db, path), {
          ...rest,
          quantity: Math.floor(rest.quantity),
          timestamp: Timestamp.fromDate(recordDate),
          userId: user.uid,
          userEmail: user.email
        });
        setActiveTab('dashboard');
      }
    } catch (error) {
      handleFirestoreError(error, editingRecord ? OperationType.UPDATE : OperationType.CREATE, path);
    }
  };

  const handleDeleteRecord = async (id: string) => {
    if (!user) return;
    const path = 'scrap_records';
    try {
      await deleteDoc(doc(db, path, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  if (loading) return <Loading appName={appSettings.appName} logoUrl={appSettings.logoUrl} logoHeight={appSettings.logoHeight} />;

  if (!user || !userProfile) return <Login onGoogleLogin={handleLogin} appName={appSettings.appName} logoUrl={appSettings.logoUrl} logoHeight={appSettings.logoHeight} />;

  const isAdmin = userProfile?.role === 'admin' || user?.email === 'jamaicamo94@gmail.com';
  const permissions = isAdmin ? ADMIN_PERMISSIONS : (userProfile?.permissions || DEFAULT_PERMISSIONS);

  return (
    <ErrorBoundary>
      <Layout 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={handleLogout}
        userEmail={user.email}
        appName={appSettings.appName}
        logoUrl={appSettings.logoUrl}
        logoHeight={appSettings.logoHeight}
        userRole={userProfile.role}
        permissions={permissions}
        isOnline={isOnline}
      >
        {activeTab === 'dashboard' && permissions.dashboard && <Dashboard records={records} defectTypes={defectTypes} />}
        {activeTab === 'form' && permissions.registration && (
          <ScrapForm 
            onSubmit={handleAddRecord} 
            defectTypes={defectTypes}
            initialData={editingRecord || undefined}
            onCancel={() => {
              setEditingRecord(null);
              setActiveTab('dashboard');
            }}
          />
        )}
        {activeTab === 'list' && permissions.history && (
          <RecordList 
            records={records} 
            onDelete={handleDeleteRecord} 
            onEdit={(record) => {
              setEditingRecord(record);
              setActiveTab('form');
            }}
            permissions={permissions}
          />
        )}
        {activeTab === 'reports' && permissions.reports && (
          <Reports records={records} defectTypes={defectTypes} />
        )}
        {activeTab === 'inserts' && permissions.warehouse && (
          <InsertManager 
            permissions={permissions} 
            userProfile={userProfile}
            operatorName={userProfile?.displayName || user?.email || ''} 
            operatorId={userProfile?.registrationId || ''}
            onRegisterOperator={() => {
              setManagerInitialTab('operadores');
              setActiveTab('manager');
            }}
          />
        )}
        {activeTab === 'defects' && permissions.categories && (
          <DefectManager defectTypes={defectTypes} />
        )}
        {activeTab === 'settings' && permissions.settings && (
          <AppSettingsManager />
        )}
        {activeTab === 'insertDashboard' && permissions.inserts && (
          <InsertDashboard 
            inserts={inserts}
            stocks={stocks}
            transactions={transactions}
            productionLines={productionLines}
          />
        )}
        {activeTab === 'improvements' && permissions.improvements && (
          <ImprovementManager 
            currentUser={{ uid: user.uid, name: userProfile.displayName || user.email || '', email: user.email || '' }}
            records={records}
            permissions={permissions}
            isAdmin={isAdmin}
          />
        )}
        {activeTab === 'tools' && permissions.toolManagement && (
          <ToolManager 
            currentUser={{ uid: user.uid, name: userProfile.displayName || user.email || '', email: user.email || '' }}
            permissions={permissions}
            isAdmin={isAdmin}
          />
        )}
        {activeTab === 'manager' && (isAdmin || permissions.warehouse || permissions.history || permissions.reports || permissions.categories || permissions.manageUsers || permissions.settings || 
                             permissions.insertEntries || permissions.insertWithdraw || permissions.insertHistory || permissions.insertReports || permissions.insertModels || permissions.insertLines || permissions.insertCorrection || permissions.improvements || permissions.toolManagement) && (
          <ManagerPanel 
            userProfile={userProfile} 
            permissions={permissions}
            productionLines={productionLines}
            inserts={inserts}
            stocks={stocks}
            transactions={transactions}
            initialTab={managerInitialTab}
          />
        )}
      </Layout>

      {/* Floating Action Button */}
      {(activeTab === 'dashboard' || activeTab === 'list') && permissions.registration && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            setEditingRecord(null);
            setActiveTab('form');
          }}
          className="fixed bottom-8 right-8 w-16 h-16 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center z-50 hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-8 h-8" />
        </motion.button>
      )}
    </ErrorBoundary>
  );
}
