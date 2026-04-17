import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { Insert, InsertStock, InsertTransaction, ProductionLine } from '../types';
import { 
  AlertTriangle, TrendingUp, Package, Boxes, FileSpreadsheet, 
  Download, Calendar, Filter, Table, AlertCircle, Search, ClipboardList,
  Box, Cpu, Layers, Component, Wrench, Hammer, Cog
} from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '../lib/utils';
import * as XLSX from 'xlsx';

interface InsertReportsProps {
  inserts: Insert[];
  stocks: InsertStock[];
  transactions: InsertTransaction[];
  productionLines: ProductionLine[];
}

type ReportFilterOption = 'hoje' | 'ontem' | '3dias' | '7dias' | 'mes' | 'custom';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const LINE_COLORS = [
  { name: 'Azul', class: 'bg-blue-500', hex: '#3b82f6' },
  { name: 'Esmeralda', class: 'bg-emerald-500', hex: '#10b981' },
  { name: 'Âmbar', class: 'bg-amber-500', hex: '#f59e0b' },
  { name: 'Rosa', class: 'bg-rose-500', hex: '#f43f5e' },
  { name: 'Índigo', class: 'bg-indigo-500', hex: '#6366f1' },
  { name: 'Laranja', class: 'bg-orange-500', hex: '#f97316' },
  { name: 'Ciano', class: 'bg-cyan-500', hex: '#06b6d4' },
  { name: 'Violeta', class: 'bg-violet-500', hex: '#8b5cf6' },
  { name: 'Fúcsia', class: 'bg-fuchsia-500', hex: '#d946ef' },
  { name: 'Lima', class: 'bg-lime-500', hex: '#84cc16' },
];

export const InsertReports: React.FC<InsertReportsProps> = ({ inserts, stocks, transactions, productionLines }) => {
  const getLineColor = (lineName: string) => {
    const line = productionLines.find(l => l.name === lineName);
    if (line?.color) {
      const colorObj = LINE_COLORS.find(c => c.class === line.color);
      return colorObj?.hex || COLORS[0];
    }
    return COLORS[0];
  };

  const [dateFilter, setDateFilter] = useState<ReportFilterOption>('7dias');
  const [customStartDate, setCustomStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedInsert, setSelectedInsert] = useState<string | 'Todos'>('Todos');
  const [selectedLine, setSelectedLine] = useState<string | 'Todos'>('Todos');
  const [selectedType, setSelectedType] = useState<'Todos' | 'entry' | 'exit'>('Todos');

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

  const filteredTransactions = useMemo(() => {
    const { start, end } = dateRange;

    return transactions.filter(t => {
      if (!t.timestamp) return false;
      const d = t.timestamp.toDate();
      const inDateRange = d >= start && d <= end;
      const inInsert = selectedInsert === 'Todos' || t.insertId === selectedInsert;
      const inLine = selectedLine === 'Todos' || t.line === selectedLine;
      const inType = selectedType === 'Todos' || t.type === selectedType;
      
      return inDateRange && inInsert && inLine && inType;
    });
  }, [transactions, dateRange, selectedInsert, selectedLine, selectedType]);

  const exportToExcel = () => {
    const dataToExport = filteredTransactions.map(t => ({
      'Data': t.timestamp ? format(t.timestamp.toDate(), "dd/MM/yyyy") : '-',
      'Hora': t.timestamp ? format(t.timestamp.toDate(), "HH:mm") : '-',
      'Código': t.insertCode,
      'Tipo': t.type === 'entry' ? 'Entrada' : 'Saída',
      'Quantidade': t.quantity,
      'Linha/Local': t.line,
      'Operador': t.operatorName || '-',
      'Matrícula': t.operatorId || '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Relatório de Insertos");

    const wscols = [
      {wch: 12}, {wch: 10}, {wch: 15}, {wch: 12}, {wch: 12}, {wch: 20}, {wch: 20}, {wch: 15}
    ];
    worksheet['!cols'] = wscols;

    const fileName = `Relatorio_Insertos_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  // Chart Data calculations based on filtered transactions
  const consumptionByLine = filteredTransactions
    .filter(t => t.type === 'exit')
    .reduce((acc: any, t) => {
      acc[t.line] = (acc[t.line] || 0) + t.quantity;
      return acc;
    }, {});

  const pieData = Object.entries(consumptionByLine).map(([name, value]) => ({
    name,
    value
  }));

  const stockData = inserts.map(insert => {
    const totalStock = stocks
      .filter(s => s.insertId === insert.id)
      .reduce((acc, s) => acc + s.quantity, 0);
    
    return {
      name: insert.code,
      stock: totalStock,
      minStock: insert.minStock,
      isLow: totalStock < insert.minStock
    };
  });

  const uniqueLines = Array.from(new Set(transactions.map(t => t.line))).sort();

  return (
    <div className="space-y-6">
      {/* Header & Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200">
            <FileSpreadsheet className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Relatórios de Insertos</h2>
            <p className="text-gray-500 text-sm">Análise de movimentação e estoque</p>
          </div>
        </div>
        
        <button
          onClick={exportToExcel}
          disabled={filteredTransactions.length === 0}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50 disabled:shadow-none"
        >
          <Download className="w-5 h-5" />
          Exportar Excel
        </button>
      </div>

      {/* Filters Grid */}
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
            Filtros de Movimentação
          </div>
          <div className="space-y-3">
            <select 
              value={selectedInsert}
              onChange={(e) => setSelectedInsert(e.target.value)}
              className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="Todos">Todos os Modelos</option>
              {inserts.map(i => (
                <option key={i.id} value={i.id}>{i.code}</option>
              ))}
            </select>

            <select 
              value={selectedLine}
              onChange={(e) => setSelectedLine(e.target.value)}
              className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="Todos">Todas as Linhas</option>
              {uniqueLines.map(line => (
                <option key={line} value={line}>{line}</option>
              ))}
            </select>

            <select 
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as any)}
              className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="Todos">Todas as Operações</option>
              <option value="entry">Entradas</option>
              <option value="exit">Saídas</option>
            </select>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center">
          <p className="text-sm font-medium text-gray-500 mb-1">Movimentações Encontradas</p>
          <p className="text-4xl font-black text-gray-900 tracking-tight">{filteredTransactions.length}</p>
          <div className="mt-4 flex items-center gap-2 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
            <Table className="w-3 h-3" />
            PRONTO PARA EXPORTAR
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Stock Levels Chart */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Níveis de Estoque vs Mínimo
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stockData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: '#f9fafb' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '12px', fontWeight: 600 }} />
                <Bar dataKey="stock" name="Estoque Atual" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="minStock" name="Estoque Mínimo" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Consumption by Line */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Consumo por Linha (No Período)</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getLineColor(entry.name)} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: '12px', fontWeight: 600 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Data Preview Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-blue-600" />
            Prévia das Movimentações
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-wider">Data/Hora</th>
                <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-wider">Código</th>
                <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-wider">Qtd</th>
                <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-wider">Linha/Local</th>
                <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-wider">Operador</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTransactions.slice(0, 10).map((t) => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                    {t.timestamp ? format(t.timestamp.toDate(), "dd/MM HH:mm") : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">
                    {t.insertCode}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                      t.type === 'entry' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                    )}>
                      {t.type === 'entry' ? 'Entrada' : 'Saída'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-black text-gray-900">
                    {t.quantity}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600 font-medium">
                    {t.line}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500 text-xs">
                    {t.operatorName} ({t.operatorId})
                  </td>
                </tr>
              ))}
              {filteredTransactions.length > 10 && (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-400 italic">
                    Exibindo apenas os primeiros 10 registros da prévia...
                  </td>
                </tr>
              )}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <AlertCircle className="w-8 h-8" />
                      <p className="font-medium italic">Nenhuma movimentação encontrada para os filtros aplicados.</p>
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
