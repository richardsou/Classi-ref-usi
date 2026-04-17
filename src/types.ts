export type Shift = 'Turno 1' | 'Turno 2' | 'Turno 3';

export type DefectType = string;

export interface DefectTypeConfig {
  id: string;
  name: string;
  color: string;
  order: number;
}

export interface ScrapRecord {
  id: string;
  partName: string;
  defectType: string;
  shift: Shift;
  quantity: number;
  weight?: number; // in kg
  timestamp: any; // Firestore Timestamp
  operatorName?: string;
  notes?: string;
}

export interface ShiftStats {
  shift: Shift;
  totalQuantity: number;
  totalWeight: number;
  defectDistribution: Record<string, number>;
}

export interface ShiftTimeConfig {
  start: string; // HH:mm
  end: string;   // HH:mm
}

export interface AppSettings {
  appName: string;
  logoUrl: string;
  logoHeight?: number;
  shifts?: Record<Shift, ShiftTimeConfig>;
}

export interface UserPermissions {
  dashboard: boolean;      // Dashboard Refugo
  registration: boolean;   // Novo Registro
  history: boolean;        // Histórico (Refugos)
  reports: boolean;        // Relatórios (Refugos)
  inserts: boolean;        // Dashboard Inserto
  editRecords: boolean;    // Permissão para Editar
  deleteRecords: boolean;  // Permissão para Excluir
  categories: boolean;     // Categorias (Refugos)
  warehouse: boolean;      // Almoxarifado / Gestão de Estoque
  settings: boolean;       // Configurações / Sistema
  manageUsers: boolean;    // Gestão de Usuários
  manageOperators: boolean; // Gestão de Operadores
  // Novas permissões de insertos
  insertEntries: boolean;
  insertWithdraw: boolean;
  insertHistory: boolean;
  insertReports: boolean;
  insertModels: boolean;
  insertLines: boolean;
  insertCorrection: boolean;
  improvements: boolean;   // Módulo de Melhorias
  toolManagement: boolean; // Gestão de Ferramentas
  // Permissões de IA
  generateAIAnalysis: boolean;
  generateAIImprovement: boolean;
  generateAIEmail: boolean;
  generateAIWhatsapp: boolean;
}

export const DEFAULT_PERMISSIONS: UserPermissions = {
  dashboard: true,
  registration: false,
  history: false,
  reports: false,
  inserts: false,
  editRecords: false,
  deleteRecords: false,
  categories: false,
  warehouse: false,
  settings: false,
  manageUsers: false,
  manageOperators: false,
  insertEntries: false,
  insertWithdraw: false,
  insertHistory: false,
  insertReports: false,
  insertModels: false,
  insertLines: false,
  insertCorrection: false,
  improvements: false,
  toolManagement: false,
  generateAIAnalysis: false,
  generateAIImprovement: false,
  generateAIEmail: false,
  generateAIWhatsapp: false
};

export const ADMIN_PERMISSIONS: UserPermissions = {
  dashboard: true,
  registration: true,
  history: true,
  reports: true,
  inserts: true,
  editRecords: true,
  deleteRecords: true,
  categories: true,
  warehouse: true,
  settings: true,
  manageUsers: true,
  manageOperators: true,
  insertEntries: true,
  insertWithdraw: true,
  insertHistory: true,
  insertReports: true,
  insertModels: true,
  insertLines: true,
  insertCorrection: true,
  improvements: true,
  toolManagement: true,
  generateAIAnalysis: true,
  generateAIImprovement: true,
  generateAIEmail: true,
  generateAIWhatsapp: true
};

export const OPERATOR_PERMISSIONS: UserPermissions = {
  dashboard: true,
  registration: true,
  history: true,
  reports: true,
  inserts: true,
  editRecords: true,
  deleteRecords: false,
  categories: false,
  warehouse: true,
  settings: false,
  manageUsers: false,
  manageOperators: false,
  insertEntries: true,
  insertWithdraw: true,
  insertHistory: true,
  insertReports: true,
  insertModels: false,
  insertLines: false,
  insertCorrection: false,
  improvements: true,
  toolManagement: true,
  generateAIAnalysis: true,
  generateAIImprovement: true,
  generateAIEmail: false,
  generateAIWhatsapp: false
};

export const VIEWER_PERMISSIONS: UserPermissions = {
  dashboard: true,
  registration: false,
  history: true,
  reports: true,
  inserts: true,
  editRecords: false,
  deleteRecords: false,
  categories: false,
  warehouse: false,
  settings: false,
  manageUsers: false,
  manageOperators: false,
  insertEntries: false,
  insertWithdraw: false,
  insertHistory: true,
  insertReports: true,
  insertModels: false,
  insertLines: false,
  insertCorrection: false,
  improvements: true,
  toolManagement: false,
  generateAIAnalysis: false,
  generateAIImprovement: false,
  generateAIEmail: false,
  generateAIWhatsapp: false
};

export interface Insert {
  id: string;
  code: string;
  description: string;
  manufacturer?: string;
  minStock: number;
  price?: number;
  imageUrl?: string;
}

export interface InsertTransaction {
  id: string;
  insertId: string;
  insertCode: string;
  type: 'entry' | 'exit';
  quantity: number;
  line: string;
  operatorName: string;
  operatorId: string; // Matrícula
  operatorFunction?: string;
  shift?: Shift;
  timestamp: any; // Firestore Timestamp
  performedBy?: {
    uid: string;
    name: string;
    email: string;
  };
}

export interface InsertStock {
  id: string; // insertId_line
  insertId: string;
  line: string;
  quantity: number;
}

export interface ProductionLine {
  id: string;
  name: string;
  color?: string;
}

export interface Operator {
  id: string; // Matrícula
  name: string;
  function: string;
  updatedAt: string;
}

export interface UserProfile {
  email: string;
  registrationId?: string; // Matrícula
  role: 'admin' | 'operator' | 'viewer' | 'custom';
  permissions: UserPermissions;
  displayName: string;
  photoURL: string;
  updatedAt: string;
  isPending?: boolean;
}

export type ImprovementCategory = 'Fábrica' | 'Máquina' | 'Operação' | 'Instrução de Trabalho' | 'Peça';

export interface ImprovementRecord {
  id: string;
  title: string;
  category: ImprovementCategory;
  description: string;
  status: 'Pendente' | 'Em Andamento' | 'Concluído';
  priority?: 'Baixa' | 'Média' | 'Alta';
  deadline?: string;
  responsible?: string;
  beforeImage?: string;
  afterImage?: string;
  archived?: boolean;
  aiContent?: {
    analysis?: string;
    improvement?: string;
    email?: string;
    whatsapp?: string;
  };
  createdAt: any;
  createdBy: {
    uid: string;
    name: string;
    email: string;
  };
}

export type MachineType = 'Torno' | 'Centro de Usinagem' | 'Furação';
export type ToolTransactionType = 'Entrada' | 'Saída' | 'Retorno';
export type ToolTransactionReason = 'Nova Entrada' | 'Em uso' | 'Colisão' | 'Desgaste' | 'Quebra' | 'Retorno Almoxarifado';

export interface Tool {
  id: string;
  code: string;
  name: string;
  machineType: MachineType;
  stock: number;
  minStock?: number;
  price?: number;
  inUse: number;
  imageUrl?: string;
}

export interface ToolTransaction {
  id: string;
  toolId: string;
  toolName: string;
  type: ToolTransactionType;
  reason: ToolTransactionReason;
  line?: string;
  quantity: number;
  createdAt: any;
  createdBy: {
    uid: string;
    name: string;
    email: string;
  };
}
