import React, { useMemo, useState, useCallback } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line, Sankey, Layer, Rectangle
} from 'recharts';
import { Insert, InsertStock, InsertTransaction, Shift } from '../types';
import { 
  AlertTriangle, TrendingUp, Package, Boxes, 
  ArrowUpCircle, ArrowDownCircle, Activity, Clock,
  Box, Cpu, Layers, Component, Wrench, Hammer, Cog,
  Calendar, Filter, ChevronRight, Download, BarChart3, Users,
  X, Info, Search, ListFilter
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, isWithinInterval, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { ProductionLine } from '../types';

interface InsertDashboardProps {
  inserts: Insert[];
  stocks: InsertStock[];
  transactions: InsertTransaction[];
  productionLines: ProductionLine[];
}

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

interface ConsumptionItem {
  name: string;
  quantity: number;
}

interface LineConsumption {
  line: string;
  items: ConsumptionItem[];
  total: number;
}

type DateFilterOption = 'hoje' | 'ontem' | '3dias' | '7dias' | '15dias' | 'mes' | 'personalizado';

export const InsertDashboard: React.FC<InsertDashboardProps> = ({ inserts, stocks, transactions, productionLines }) => {
  const [dateFilter, setDateFilter] = useState<DateFilterOption>('mes');
  const [shiftFilter, setShiftFilter] = useState<Shift | 'todos'>('todos');
  const [customRange, setCustomRange] = useState({
    start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });

  const [selectedDetail, setSelectedDetail] = useState<{
    title: string;
    type: 'line' | 'operator' | 'insert' | 'stock';
    data: any[];
  } | null>(null);

  const MODEL_ICONS = [Package, Box, Cpu, Layers, Component, Wrench, Hammer, Cog];
  
  const getModelIcon = (id: string) => {
    const index = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % MODEL_ICONS.length;
    return MODEL_ICONS[index];
  };

  const getLineColor = useCallback((lineName: string) => {
    const line = productionLines.find(l => l.name === lineName);
    if (line?.color) {
      const colorObj = LINE_COLORS.find(c => c.class === line.color);
      return colorObj?.hex || COLORS[0];
    }
    return COLORS[0];
  }, [productionLines]);

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
      case 'personalizado':
        start = startOfDay(parseISO(customRange.start));
        end = endOfDay(parseISO(customRange.end));
        break;
    }
    return { start, end };
  }, [dateFilter, customRange]);

  // Filtered transactions based on period and shift
  const filteredTransactions = useMemo(() => {
    const { start, end } = dateRange;

    return transactions.filter(t => {
      if (!t.timestamp) return false;
      const date = t.timestamp.toDate();
      const inRange = isWithinInterval(date, { start, end });
      const inShift = shiftFilter === 'todos' || t.shift === shiftFilter;
      return inRange && inShift;
    });
  }, [transactions, dateRange, shiftFilter]);

  // 1. Stock Status Summary
  const stockSummary = useMemo(() => {
    const validStocks = stocks.filter(s => inserts.some(i => i.id === s.insertId));
    const totalItems = validStocks.reduce((acc, s) => acc + (Number(s.quantity) || 0), 0);
    const lowStockCount = inserts.filter(insert => {
      const totalStock = validStocks
        .filter(s => s.insertId === insert.id)
        .reduce((acc, s) => acc + (Number(s.quantity) || 0), 0);
      return totalStock < insert.minStock;
    }).length;

    const periodEntries = filteredTransactions.filter(t => t.type === 'entry').reduce((acc, t) => acc + t.quantity, 0);
    const periodExits = filteredTransactions.filter(t => t.type === 'exit').reduce((acc, t) => acc + t.quantity, 0);

    return { totalItems, lowStockCount, periodEntries, periodExits };
  }, [inserts, stocks, filteredTransactions]);

  // 2. Consumption Distribution by Line (Filtered by period)
  const lineDistribution = useMemo(() => {
    const exits = filteredTransactions.filter(t => t.type === 'exit');
    const data = exits.reduce((acc: Record<string, number>, t) => {
      const line = t.line || 'Não Informada';
      acc[line] = (acc[line] || 0) + t.quantity;
      return acc;
    }, {});
    return Object.entries(data)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions]);

  // 3. Top 10 Models Consumption
  const topModelsConsumption = useMemo(() => {
    const exits = filteredTransactions.filter(t => t.type === 'exit');
    const data = exits.reduce((acc: Record<string, { code: string, desc: string, quantity: number }>, t) => {
      const id = t.insertId;
      if (!acc[id]) {
        const insert = inserts.find(i => i.id === id);
        acc[id] = { 
          code: t.insertCode || insert?.code || 'Desconhecido', 
          desc: insert?.description || '', 
          quantity: 0 
        };
      }
      acc[id].quantity += t.quantity;
      return acc;
    }, {});
    
    return Object.values(data)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  }, [filteredTransactions, inserts]);

  // 4. Sankey Data (Inserts -> Lines)
  const sankeyData = useMemo(() => {
    const exits = filteredTransactions.filter(t => t.type === 'exit');
    if (exits.length === 0) return { nodes: [], links: [], lineNames: [] };

    const insertCodes = Array.from(new Set(exits.map(t => t.insertCode || 'Desconhecido')));
    const lineNames = Array.from(new Set(exits.map(t => t.line || 'Não Informada')));
    
    const nodes = [
      ...insertCodes.map(name => ({ name, type: 'insert' })),
      ...lineNames.map(name => ({ name, type: 'line' }))
    ];
    
    const links: { source: number, target: number, value: number }[] = [];
    
    exits.forEach(t => {
      const sourceIdx = insertCodes.indexOf(t.insertCode || 'Desconhecido');
      const targetIdx = insertCodes.length + lineNames.indexOf(t.line || 'Não Informada');
      
      const existingLink = links.find(l => l.source === sourceIdx && l.target === targetIdx);
      if (existingLink) {
        existingLink.value += t.quantity;
      } else {
        links.push({ source: sourceIdx, target: targetIdx, value: t.quantity });
      }
    });
    
    return { nodes, links, lineNames };
  }, [filteredTransactions]);

  // 5. Activity Trend (Filtered by period)
  const activityTrend = useMemo(() => {
    // Group by date
    const grouped = filteredTransactions.reduce((acc: Record<string, { entradas: number, saidas: number }>, t) => {
      if (!t.timestamp) return acc;
      const dateKey = format(t.timestamp.toDate(), 'yyyy-MM-dd');
      if (!acc[dateKey]) acc[dateKey] = { entradas: 0, saidas: 0 };
      if (t.type === 'entry') acc[dateKey].entradas += t.quantity;
      if (t.type === 'exit') acc[dateKey].saidas += t.quantity;
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([date, values]) => ({
        date: format(parseISO(date), 'dd/MM'),
        ...values
      }))
      .sort((a, b) => {
        const dateA = a.date.split('/').reverse().join('');
        const dateB = b.date.split('/').reverse().join('');
        return dateA.localeCompare(dateB);
      });
  }, [filteredTransactions]);

  // 6. Consumption by Line and Insert
  const consumptionByLine = useMemo<LineConsumption[]>(() => {
    const exits = filteredTransactions.filter(t => t.type === 'exit');
    
    const grouped: Record<string, Record<string, number>> = {};
    exits.forEach(t => {
      const line = t.line || 'Não Informada';
      if (!grouped[line]) grouped[line] = {};
      
      const insert = inserts.find(i => i.id === t.insertId);
      const insertKey = insert ? `${insert.code} - ${insert.description}` : 'Desconhecido';
      
      grouped[line][insertKey] = (grouped[line][insertKey] || 0) + t.quantity;
    });

    return Object.entries(grouped).map(([line, items]) => ({
      line,
      items: Object.entries(items).map(([name, quantity]) => ({ name, quantity })),
      total: Object.values(items).reduce((acc, q) => acc + q, 0)
    })).sort((a, b) => b.total - a.total);
  }, [filteredTransactions, inserts]);

  // 7. Critical Items
  const criticalItems = useMemo(() => {
    const validStocks = stocks.filter(s => inserts.some(i => i.id === s.insertId));
    return inserts
      .map(insert => {
        const totalStock = validStocks
          .filter(s => s.insertId === insert.id)
          .reduce((acc, s) => acc + (Number(s.quantity) || 0), 0);
        return {
          ...insert,
          currentStock: totalStock,
          ratio: insert.minStock > 0 ? totalStock / insert.minStock : 1
        };
      })
      .filter(i => i.currentStock < i.minStock)
      .sort((a, b) => a.ratio - b.ratio)
      .slice(0, 5);
  }, [inserts, stocks]);

  const CustomSankeyNode = useCallback((props: any) => {
    const { x, y, width, height, index, payload } = props;
    const isLine = payload.type === 'line';
    const fill = isLine ? getLineColor(payload.name) : '#94a3b8';
    
    return (
      <Layer key={`CustomNode${index}`}>
        <Rectangle x={x} y={y} width={width} height={height} fill={fill} fillOpacity={1} rx={2} />
        <text
          textAnchor={x < 200 ? 'start' : 'end'}
          x={x < 200 ? x + width + 8 : x - 8}
          y={y + height / 2}
          fontSize="11"
          fontWeight="700"
          fill="#374151"
          dy={4}
        >
          {payload.name}
        </text>
      </Layer>
    );
  }, [getLineColor]);

  const CustomSankeyLink = useCallback((props: any) => {
    const { sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, payload } = props;
    const targetNode = typeof payload.target === 'object' ? payload.target : sankeyData.nodes[payload.target];
    const fill = targetNode ? getLineColor(targetNode.name) : '#cbd5e1';
    
    return (
      <path
        d={`
          M${sourceX},${sourceY + linkWidth / 2}
          C${sourceControlX},${sourceY + linkWidth / 2} ${targetControlX},${targetY + linkWidth / 2} ${targetX},${targetY + linkWidth / 2}
          L${targetX},${targetY - linkWidth / 2}
          C${targetControlX},${targetY - linkWidth / 2} ${sourceControlX},${sourceY - linkWidth / 2} ${sourceX},${sourceY - linkWidth / 2}
          Z
        `}
        fill={fill}
        fillOpacity={0.3}
        className="hover:fill-opacity-60 transition-all duration-300"
      />
    );
  }, [getLineColor, sankeyData]);

  return (
    <div className="space-y-6">
      {/* Period Selection */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            Análise de Insertos
          </h2>
          <p className="text-gray-500">Acompanhe o fluxo e estoque de ferramentas</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Shift Filter */}
          <div className="flex items-center gap-2 bg-white p-1 rounded-2xl shadow-sm border border-gray-100">
            {(['todos', 'Turno 1', 'Turno 2', 'Turno 3'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setShiftFilter(s)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                  shiftFilter === s 
                    ? "bg-blue-50 text-blue-600 shadow-sm border border-blue-100" 
                    : "text-gray-400 hover:text-gray-600"
                )}
              >
                {s === 'todos' ? 'Todos' : s}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
            <Calendar className="w-4 h-4 text-gray-400 ml-2" />
            <select 
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilterOption)}
              className="bg-transparent border-none focus:ring-0 text-sm font-medium text-gray-700 outline-none pr-8"
            >
              <option value="hoje">Hoje</option>
              <option value="ontem">Ontem</option>
              <option value="3dias">Últimos 3 dias</option>
              <option value="7dias">Últimos 7 dias</option>
              <option value="15dias">Últimos 15 dias</option>
              <option value="mes">Último mês</option>
              <option value="personalizado">Personalizado</option>
            </select>
          </div>

          {dateFilter === 'personalizado' && (
            <div className="flex items-center gap-2 bg-white p-2 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-right-2">
              <input 
                type="date" 
                value={customRange.start}
                onChange={(e) => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
                className="bg-transparent border-none text-xs font-bold text-gray-700 focus:ring-0 outline-none px-2"
              />
              <ChevronRight className="w-4 h-4 text-gray-300" />
              <input 
                type="date" 
                value={customRange.end}
                onChange={(e) => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
                className="bg-transparent border-none text-xs font-bold text-gray-700 focus:ring-0 outline-none px-2"
              />
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div 
          onClick={() => setSelectedDetail({
            title: 'Resumo de Estoque Atual',
            type: 'stock',
            data: stocks.map(s => ({
              ...s,
              insert: inserts.find(i => i.id === s.insertId)
            })).filter(s => s.insert)
          })}
          className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors">
              <Boxes className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-full uppercase tracking-wider">Total</span>
          </div>
          <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Peças em Estoque</p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-black text-gray-900 tracking-tight">{stockSummary.totalItems}</p>
            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 transition-colors" />
          </div>
        </div>

        <div 
          onClick={() => setSelectedDetail({
            title: 'Itens com Estoque Crítico',
            type: 'insert',
            data: criticalItems
          })}
          className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-red-50 rounded-xl group-hover:bg-red-100 transition-colors">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <span className="text-[10px] font-black text-red-600 bg-red-50 px-2 py-1 rounded-full uppercase tracking-wider">Crítico</span>
          </div>
          <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Abaixo do Mínimo</p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-black text-red-600 tracking-tight">{stockSummary.lowStockCount}</p>
            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-red-500 transition-colors" />
          </div>
        </div>

        <div 
          onClick={() => setSelectedDetail({
            title: 'Entradas no Período',
            type: 'insert',
            data: filteredTransactions.filter(t => t.type === 'entry')
          })}
          className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-emerald-50 rounded-xl group-hover:bg-emerald-100 transition-colors">
              <ArrowUpCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full uppercase tracking-wider">Período</span>
          </div>
          <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Entradas no Período</p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-black text-emerald-600 tracking-tight">+{stockSummary.periodEntries}</p>
            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-emerald-500 transition-colors" />
          </div>
        </div>

        <div 
          onClick={() => setSelectedDetail({
            title: 'Saídas no Período',
            type: 'insert',
            data: filteredTransactions.filter(t => t.type === 'exit')
          })}
          className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-amber-50 rounded-xl group-hover:bg-amber-100 transition-colors">
              <ArrowDownCircle className="w-6 h-6 text-amber-600" />
            </div>
            <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-full uppercase tracking-wider">Período</span>
          </div>
          <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Saídas no Período</p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-black text-amber-600 tracking-tight">-{stockSummary.periodExits}</p>
            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-amber-500 transition-colors" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Trend */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              Fluxo de Movimentação no Período
            </h3>
          </div>
          <div className="h-[450px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activityTrend}>
                <defs>
                  <linearGradient id="colorEntradas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorSaidas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '12px', fontWeight: 600 }} />
                <Area 
                  type="monotone" 
                  dataKey="entradas" 
                  name="Entradas" 
                  stroke="#10b981" 
                  fillOpacity={1} 
                  fill="url(#colorEntradas)" 
                  strokeWidth={3}
                  activeDot={{ 
                    r: 6, 
                    onClick: (props: any) => {
                      const dateStr = props.payload.date; // dd/MM
                      setSelectedDetail({
                        title: `Entradas em ${dateStr}`,
                        type: 'insert',
                        data: filteredTransactions.filter(t => t.type === 'entry' && format(t.timestamp.toDate(), 'dd/MM') === dateStr)
                      });
                    }
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="saidas" 
                  name="Saídas" 
                  stroke="#f59e0b" 
                  fillOpacity={1} 
                  fill="url(#colorSaidas)" 
                  strokeWidth={3}
                  activeDot={{ 
                    r: 6, 
                    onClick: (props: any) => {
                      const dateStr = props.payload.date; // dd/MM
                      setSelectedDetail({
                        title: `Saídas em ${dateStr}`,
                        type: 'insert',
                        data: filteredTransactions.filter(t => t.type === 'exit' && format(t.timestamp.toDate(), 'dd/MM') === dateStr)
                      });
                    }
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Consumption Distribution */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-blue-600" />
            Consumo por Linha
          </h3>
          <div className="h-[450px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={lineDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  onClick={(data) => setSelectedDetail({
                    title: `Consumo na Linha: ${data.name}`,
                    type: 'line',
                    data: filteredTransactions.filter(t => t.line === data.name && t.type === 'exit')
                  })}
                >
                  {lineDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getLineColor(entry.name)} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`${value} un.`, 'Consumo']}
                />
                <Legend iconType="circle" layout="vertical" align="center" verticalAlign="bottom" wrapperStyle={{ fontSize: '10px', fontWeight: 600, paddingTop: '20px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top 10 Models & Sankey Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 10 Models */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              Top 10 Modelos Mais Consumidos
            </h3>
          </div>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={topModelsConsumption} 
                layout="vertical" 
                margin={{ left: 10, right: 40, top: 20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600 }} />
                <YAxis 
                  dataKey="code" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fontWeight: 700, fill: '#374151' }}
                  width={100}
                />
                <Tooltip 
                  cursor={{ fill: '#f3f4f6', radius: 8 }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number, name: string, props: any) => [`${value} unidades`, props.payload.desc || 'Consumo']}
                />
                <Bar 
                  dataKey="quantity" 
                  name="Quantidade" 
                  radius={[0, 12, 12, 0]} 
                  barSize={24}
                  onClick={(props: any) => setSelectedDetail({
                    title: `Consumo do Modelo ${props.code}`,
                    type: 'insert',
                    data: filteredTransactions.filter(t => t.insertCode === props.code && t.type === 'exit')
                  })}
                >
                  {topModelsConsumption.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={index === 0 ? '#1d4ed8' : index < 3 ? '#3b82f6' : '#93c5fd'} 
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sankey Diagram */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              Fluxo de Distribuição (Modelos → Linhas)
            </h3>
          </div>
          <div className="h-[400px] w-full">
            {sankeyData.nodes.length > 0 ? (
              <div className="w-full h-full flex flex-col">
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <Sankey
                      data={sankeyData}
                      nodePadding={20}
                      margin={{ left: 20, right: 20, top: 20, bottom: 20 }}
                      node={CustomSankeyNode}
                      link={CustomSankeyLink}
                    >
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                    </Sankey>
                  </ResponsiveContainer>
                </div>
                {/* Legend */}
                <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-center gap-4">
                  <div className="flex items-center gap-2 mr-4">
                    <div className="w-3 h-3 rounded-full bg-slate-400" />
                    <span className="text-xs font-bold text-gray-600">Modelos de Inserto</span>
                  </div>
                  {sankeyData.lineNames.map(line => (
                    <div key={line} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getLineColor(line) }} />
                      <span className="text-xs font-bold text-gray-600">{line}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold">
                Dados insuficientes para o diagrama de fluxo.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Consumption by Line Section */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            Consumo por Linha de Produção
          </h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {consumptionByLine.map((lineData, idx) => (
            <div 
              key={idx} 
              onClick={() => setSelectedDetail({
                title: `Detalhamento: ${lineData.line}`,
                type: 'line',
                data: filteredTransactions.filter(t => t.line === lineData.line && t.type === 'exit')
              })}
              className="bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-all cursor-pointer group"
            >
              <div className={cn("p-4 flex items-center justify-between", getLineColor(lineData.line).replace('#', 'bg-[#') + ']/10')}>
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", productionLines.find(l => l.name === lineData.line)?.color || 'bg-gray-400')} />
                  <h4 className="font-black text-gray-900 text-sm uppercase tracking-tight">{lineData.line}</h4>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-gray-500">{lineData.total} un.</span>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-600 transition-colors" />
                </div>
              </div>
              <div className="p-4 space-y-3">
                {lineData.items.map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between gap-4">
                    <p className="text-xs font-bold text-gray-600 truncate flex-1">{item.name}</p>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-600" 
                          style={{ width: `${(item.quantity / lineData.total) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-black text-gray-900 w-6 text-right">{item.quantity}</span>
                    </div>
                  </div>
                ))}
                {lineData.items.length === 0 && (
                  <p className="text-[10px] text-gray-400 font-bold text-center py-4">Sem consumo no período</p>
                )}
              </div>
            </div>
          ))}
          {consumptionByLine.length === 0 && (
            <div className="col-span-full py-12 text-center">
              <p className="text-gray-400 font-bold">Nenhum consumo registrado no período selecionado.</p>
            </div>
          )}
        </div>
      </div>

      {/* Critical Items List */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-red-600" />
            Itens com Estoque Crítico
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {criticalItems.map(item => (
            <div key={item.id} className="p-4 bg-red-50 rounded-2xl border border-red-100 flex items-center gap-4">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border border-red-200 flex-shrink-0 overflow-hidden">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.code} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  (() => {
                    const Icon = getModelIcon(item.id);
                    return <Icon className="w-6 h-6 text-red-600" />;
                  })()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">{item.code}</p>
                <h4 className="text-sm font-bold text-gray-900 truncate">{item.description}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1.5 bg-red-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-red-600" 
                      style={{ width: `${Math.min(100, (item.currentStock / item.minStock) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-black text-red-700">{item.currentStock}/{item.minStock}</span>
                </div>
              </div>
            </div>
          ))}
          {criticalItems.length === 0 && (
            <div className="col-span-full py-8 text-center bg-emerald-50 rounded-2xl border border-emerald-100">
              <p className="text-emerald-700 font-bold">Todos os itens estão com estoque adequado!</p>
            </div>
          )}
        </div>
      </div>
      {/* Details Modal */}
      <AnimatePresence>
        {selectedDetail && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDetail(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-4xl max-h-[80vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-50 rounded-2xl">
                    <ListFilter className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-900 tracking-tight">
                      {selectedDetail.title}
                    </h3>
                    <p className="text-sm font-bold text-gray-500">
                      {selectedDetail.data.length} registros encontrados
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedDetail(null)}
                  className="p-3 hover:bg-gray-100 rounded-2xl transition-all"
                >
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Data/Info</th>
                        <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Item</th>
                        <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Qtd</th>
                        <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Local/Operador</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {selectedDetail.data.map((item, i) => (
                        <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-4">
                            <p className="text-xs font-bold text-gray-900">
                              {item.timestamp ? format(item.timestamp.toDate(), "dd/MM/yyyy") : (item.line || 'Estoque')}
                            </p>
                            <p className="text-[10px] text-gray-500 font-medium">
                              {item.timestamp ? format(item.timestamp.toDate(), "HH:mm") : (item.shift || '-')}
                            </p>
                          </td>
                          <td className="py-4">
                            <p className="text-xs font-black text-blue-600 uppercase tracking-widest">
                              {item.insertCode || item.code || 'N/A'}
                            </p>
                            <p className="text-[11px] font-bold text-gray-600 truncate max-w-[200px]">
                              {item.description || inserts.find(ins => ins.id === item.insertId)?.description || '-'}
                            </p>
                          </td>
                          <td className="py-4">
                            <span className={cn(
                              "px-2.5 py-1 rounded-lg text-xs font-black",
                              item.type === 'entry' ? "bg-emerald-100 text-emerald-700" : 
                              item.type === 'exit' ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                            )}>
                              {item.quantity}
                            </span>
                          </td>
                          <td className="py-4">
                            <p className="text-xs font-bold text-gray-900">{item.operatorName || item.line || '-'}</p>
                            <p className="text-[10px] text-gray-500 font-mono">{item.operatorId || '-'}</p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
