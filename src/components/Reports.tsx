import React, { useState, useMemo } from 'react';
import { ScrapRecord, DefectTypeConfig, Shift } from '../types';
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileDown, Filter, Calendar, Table, Download, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import * as XLSX from 'xlsx';

interface ReportsProps {
  records: ScrapRecord[];
  defectTypes: DefectTypeConfig[];
}

type ReportFilterOption = 'hoje' | 'ontem' | '3dias' | '7dias' | 'mes' | 'custom';

export const Reports: React.FC<ReportsProps> = ({ records, defectTypes }) => {
  const [dateFilter, setDateFilter] = useState<ReportFilterOption>('7dias');
  const [customStartDate, setCustomStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedShift, setSelectedShift] = useState<Shift | 'Todos'>('Todos');
  const [selectedDefect, setSelectedDefect] = useState<string | 'Todos'>('Todos');
  const [weightFilterType, setWeightFilterType] = useState<'Todos' | 'Maior' | 'Menor' | 'Entre'>('Todos');
  const [minWeight, setMinWeight] = useState<number>(0);
  const [maxWeight, setMaxWeight] = useState<number>(0);

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
      case 'mes':
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case 'custom':
        start = startOfDay(new Date(customStartDate + 'T00:00:00'));
        end = endOfDay(new Date(customEndDate + 'T23:59:59'));
        break;
    }
    return { start, end };
  }, [dateFilter, customStartDate, customEndDate]);

  const filteredRecords = useMemo(() => {
    const { start, end } = dateRange;

    return records.filter(r => {
      if (!r.timestamp) return false;
      const d = r.timestamp.toDate();
      const inDateRange = d >= start && d <= end;
      const inShift = selectedShift === 'Todos' || r.shift === selectedShift;
      const inDefect = selectedDefect === 'Todos' || r.defectType === selectedDefect;
      
      const weight = r.weight || 0;
      let inWeightRange = true;
      if (weightFilterType === 'Maior') {
        inWeightRange = weight > minWeight;
      } else if (weightFilterType === 'Menor') {
        inWeightRange = weight < maxWeight;
      } else if (weightFilterType === 'Entre') {
        inWeightRange = weight >= minWeight && weight <= maxWeight;
      }

      return inDateRange && inShift && inDefect && inWeightRange;
    });
  }, [records, dateRange, selectedShift, selectedDefect, weightFilterType, minWeight, maxWeight]);

  const exportToExcel = () => {
    const dataToExport = filteredRecords.map(record => ({
      'Data': record.timestamp ? format(record.timestamp.toDate(), "dd/MM/yyyy") : '-',
      'Hora': record.timestamp ? format(record.timestamp.toDate(), "HH:mm") : '-',
      'Peça': record.partName,
      'Turno': record.shift,
      'Defeito': record.defectType,
      'Quantidade': record.quantity,
      'Peso (kg)': record.weight || 0,
      'Operador': record.operatorName || '-',
      'Observações': record.notes || '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Relatório de Refugo");

    // Set column widths
    const wscols = [
      {wch: 12}, {wch: 10}, {wch: 25}, {wch: 12}, {wch: 20}, {wch: 12}, {wch: 12}, {wch: 20}, {wch: 35}
    ];
    worksheet['!cols'] = wscols;

    const fileName = `Relatorio_Refugo_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200">
            <FileSpreadsheet className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Relatórios</h2>
            <p className="text-gray-500 text-sm">Gere e exporte relatórios em Excel</p>
          </div>
        </div>
        
        <button
          onClick={exportToExcel}
          disabled={filteredRecords.length === 0}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50 disabled:shadow-none"
        >
          <Download className="w-5 h-5" />
          Exportar Excel
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center gap-2 text-gray-900 font-bold">
            <Calendar className="w-5 h-5 text-blue-600" />
            Período
          </div>
          <div className="space-y-3">
            <select 
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as ReportFilterOption)}
              className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="hoje">Hoje</option>
              <option value="ontem">Ontem</option>
              <option value="3dias">Últimos 3 dias</option>
              <option value="7dias">Últimos 7 dias</option>
              <option value="mes">Este mês</option>
              <option value="custom">Personalizado</option>
            </select>

            {dateFilter === 'custom' && (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <input 
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-gray-50 border-none rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <input 
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-gray-50 border-none rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center gap-2 text-gray-900 font-bold">
            <Filter className="w-5 h-5 text-blue-600" />
            Filtros
          </div>
          <div className="space-y-3">
            <select 
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value as any)}
              className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="Todos">Todos os Turnos</option>
              <option value="Turno 1">Turno 1</option>
              <option value="Turno 2">Turno 2</option>
              <option value="Turno 3">Turno 3</option>
            </select>

            <select 
              value={selectedDefect}
              onChange={(e) => setSelectedDefect(e.target.value)}
              className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="Todos">Todos os Defeitos</option>
              {defectTypes.map(type => (
                <option key={type.id} value={type.name}>{type.name}</option>
              ))}
            </select>

            <div className="space-y-2">
              <select 
                value={weightFilterType}
                onChange={(e) => setWeightFilterType(e.target.value as any)}
                className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="Todos">Todos os Pesos</option>
                <option value="Maior">Peso maior que...</option>
                <option value="Menor">Peso menor que...</option>
                <option value="Entre">Peso entre...</option>
              </select>

              {weightFilterType === 'Maior' && (
                <input 
                  type="number"
                  placeholder="Mínimo (kg)"
                  value={minWeight || ''}
                  onChange={(e) => setMinWeight(Number(e.target.value))}
                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                />
              )}
              {weightFilterType === 'Menor' && (
                <input 
                  type="number"
                  placeholder="Máximo (kg)"
                  value={maxWeight || ''}
                  onChange={(e) => setMaxWeight(Number(e.target.value))}
                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                />
              )}
              {weightFilterType === 'Entre' && (
                <div className="grid grid-cols-2 gap-2">
                  <input 
                    type="number"
                    placeholder="Mín"
                    value={minWeight || ''}
                    onChange={(e) => setMinWeight(Number(e.target.value))}
                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <input 
                    type="number"
                    placeholder="Máx"
                    value={maxWeight || ''}
                    onChange={(e) => setMaxWeight(Number(e.target.value))}
                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center">
          <p className="text-sm font-medium text-gray-500 mb-1">Registros Encontrados</p>
          <p className="text-4xl font-black text-gray-900 tracking-tight">{filteredRecords.length}</p>
          <div className="mt-4 flex items-center gap-2 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
            <Table className="w-3 h-3" />
            PRONTO PARA EXPORTAR
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Prévia dos Dados</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-wider">Data</th>
                <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-wider">Peça</th>
                <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-wider">Turno</th>
                <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-wider">Defeito</th>
                <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-wider">Peso</th>
                <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-wider">Qtd</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRecords.slice(0, 10).map((record) => (
                <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                    {record.timestamp ? format(record.timestamp.toDate(), "dd/MM/yyyy HH:mm") : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                    {record.partName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 bg-gray-100 rounded-full text-xs font-bold text-gray-600">
                      {record.shift}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                    {record.defectType}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600 font-medium">
                    {record.weight ? `${record.weight} kg` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">
                    {record.quantity}
                  </td>
                </tr>
              ))}
              {filteredRecords.length > 10 && (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-400 italic">
                    Exibindo apenas os primeiros 10 registros da prévia...
                  </td>
                </tr>
              )}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <AlertCircle className="w-8 h-8" />
                      <p className="font-medium italic">Nenhum registro encontrado para os filtros aplicados.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
