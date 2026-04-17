import React, { useState, useMemo } from 'react';
import { ScrapRecord, UserPermissions } from '../types';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Table, Clock, User, AlertCircle, Package, Trash2, Edit2, Calendar, X, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface RecordListProps {
  records: ScrapRecord[];
  onDelete?: (id: string) => Promise<void>;
  onEdit?: (record: ScrapRecord) => void;
  permissions: UserPermissions;
}

type DateFilterOption = 'hoje' | 'ontem' | '3dias' | '7dias' | '15dias' | 'mes' | 'todos' | 'custom';

export const RecordList: React.FC<RecordListProps> = ({ records, onDelete, onEdit, permissions }) => {
  const [dateFilter, setDateFilter] = useState<DateFilterOption>('todos');
  const [customStartDate, setCustomStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const canEdit = permissions.editRecords && onEdit;
  const canDelete = permissions.deleteRecords && onDelete;

  const dateRange = useMemo(() => {
    const now = new Date();
    let start = startOfDay(now);
    let end = endOfDay(now);

    switch (dateFilter) {
      case 'hoje':
        start = startOfDay(now);
        end = endOfDay(now);
        break;
      case 'ontem':
        start = startOfDay(subDays(now, 1));
        end = endOfDay(subDays(now, 1));
        break;
      case '3dias':
        start = startOfDay(subDays(now, 2));
        end = endOfDay(now);
        break;
      case '7dias':
        start = startOfDay(subDays(now, 6));
        end = endOfDay(now);
        break;
      case '15dias':
        start = startOfDay(subDays(now, 14));
        end = endOfDay(now);
        break;
      case 'mes':
        start = startOfDay(subDays(now, 29));
        end = endOfDay(now);
        break;
      case 'custom':
        start = startOfDay(new Date(customStartDate + 'T00:00:00'));
        end = endOfDay(new Date(customEndDate + 'T23:59:59'));
        break;
      case 'todos':
        return null;
    }
    return { start, end };
  }, [dateFilter, customStartDate, customEndDate]);

  const filteredRecords = useMemo(() => {
    if (!dateRange) return records;
    const { start, end } = dateRange;

    return records.filter(r => {
      if (!r.timestamp) return false;
      const d = r.timestamp.toDate();
      return d >= start && d <= end;
    });
  }, [records, dateRange]);

  const handleDeleteConfirm = async () => {
    if (!recordToDelete || !onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(recordToDelete);
      setRecordToDelete(null);
    } catch (error) {
      console.error("Error deleting record:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
      >
        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Table className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Histórico de Registros</h2>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-xl border border-gray-100">
              <Calendar className="w-4 h-4 text-gray-400 ml-2" />
              <select 
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as DateFilterOption)}
                className="bg-transparent border-none focus:ring-0 text-sm font-medium text-gray-700 outline-none pr-8"
              >
                <option value="todos">Todos os registros</option>
                <option value="hoje">Hoje</option>
                <option value="ontem">Ontem</option>
                <option value="3dias">Últimos 3 dias</option>
                <option value="7dias">Últimos 7 dias</option>
                <option value="15dias">Últimos 15 dias</option>
                <option value="mes">Último mês</option>
                <option value="custom">Período personalizado</option>
              </select>
            </div>

            {dateFilter === 'custom' && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-100"
              >
                <input 
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-transparent border-none focus:ring-0 text-sm font-medium text-gray-700 outline-none"
                />
                <span className="text-gray-400 text-xs font-bold">até</span>
                <input 
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-transparent border-none focus:ring-0 text-sm font-medium text-gray-700 outline-none"
                />
              </motion.div>
            )}
            <span className="text-sm text-gray-500 font-medium">{filteredRecords.length} registros</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Data/Hora</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Peça</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Turno</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Defeito</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Qtd</th>
                {(canDelete || canEdit) && <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRecords.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="w-4 h-4 text-gray-400" />
                      {record.timestamp ? format(record.timestamp.toDate(), "dd/MM/yyyy HH:mm", { locale: ptBR }) : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 font-medium text-gray-900">
                      <Package className="w-4 h-4 text-blue-500" />
                      {record.partName}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      record.shift === 'Turno 1' ? 'bg-blue-100 text-blue-700' :
                      record.shift === 'Turno 2' ? 'bg-amber-100 text-amber-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>
                      {record.shift}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <AlertCircle className="w-4 h-4 text-red-400" />
                      {record.defectType}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                    {record.quantity}
                  </td>
                  {(canDelete || canEdit) && (
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        {canEdit && (
                          <button
                            onClick={() => onEdit(record)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar Registro"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => setRecordToDelete(record.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir Registro"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={(onDelete || onEdit) ? 6 : 5} className="px-6 py-12 text-center text-gray-500 italic">
                    Nenhum registro encontrado para este período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {recordToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Excluir Registro?</h3>
                <p className="text-gray-500 mb-6">
                  Você tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setRecordToDelete(null)}
                    disabled={isDeleting}
                    className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDeleteConfirm}
                    disabled={isDeleting}
                    className="flex-1 px-6 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-200 disabled:opacity-50"
                  >
                    {isDeleting ? 'Excluindo...' : 'Sim, Excluir'}
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
