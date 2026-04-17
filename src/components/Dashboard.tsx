import React, { useMemo, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Sankey, Layer, Rectangle
} from 'recharts';
import { ScrapRecord, Shift, DefectType, DefectTypeConfig } from '../types';
import { SHIFTS, SHIFT_COLORS } from '../constants';
import { LayoutDashboard, TrendingUp, AlertTriangle, Package, Filter, Calendar, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfDay, endOfDay, subDays, isSameDay, startOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronRight } from 'lucide-react';

type DateFilterOption = 'hoje' | 'ontem' | '3dias' | '7dias' | '15dias' | 'mes' | 'personalizado';

interface DashboardProps {
  records: ScrapRecord[];
  defectTypes: DefectTypeConfig[];
}

export const Dashboard: React.FC<DashboardProps> = ({ records, defectTypes }) => {
  const [selectedShift, setSelectedShift] = useState<Shift | 'Todos'>('Todos');
  const [dateFilter, setDateFilter] = useState<DateFilterOption>('7dias');
  const [customRange, setCustomRange] = useState({
    start: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });
  const [selectedDetail, setSelectedDetail] = useState<{ type: 'defect' | 'part'; name: string; shift?: Shift } | null>(null);

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

  const filteredRecords = useMemo(() => {
    const { start, end } = dateRange;

    return records.filter(r => {
      if (!r.timestamp) return false;
      const d = r.timestamp.toDate();
      const inRange = d >= start && d <= end;
      const inShift = selectedShift === 'Todos' || r.shift === selectedShift;
      return inRange && inShift;
    });
  }, [records, selectedShift, dateRange]);

  // Sankey Data (Parts -> Defects)
  const sankeyData = useMemo(() => {
    if (filteredRecords.length === 0) return { nodes: [], links: [], partNames: [], defectNames: [] };

    const partNames = Array.from(new Set(filteredRecords.map(r => r.partName || 'Desconhecida')));
    const defectNames = Array.from(new Set(filteredRecords.map(r => r.defectType || 'Desconhecido')));
    
    const nodes = [
      ...partNames.map(name => ({ name, type: 'part' })),
      ...defectNames.map(name => ({ name, type: 'defect' }))
    ];
    
    const links: { source: number, target: number, value: number }[] = [];
    
    filteredRecords.forEach(r => {
      const sourceIdx = partNames.indexOf(r.partName || 'Desconhecida');
      const targetIdx = partNames.length + defectNames.indexOf(r.defectType || 'Desconhecido');
      
      const existingLink = links.find(l => l.source === sourceIdx && l.target === targetIdx);
      if (existingLink) {
        existingLink.value += r.quantity;
      } else {
        links.push({ source: sourceIdx, target: targetIdx, value: r.quantity });
      }
    });
    
    return { nodes, links, partNames, defectNames };
  }, [filteredRecords]);

  const getDefectColor = React.useCallback((defectName: string) => {
    const defect = defectTypes.find(d => d.name === defectName);
    return defect?.color || '#94a3b8';
  }, [defectTypes]);

  const CustomSankeyNode = React.useCallback((props: any) => {
    const { x, y, width, height, index, payload } = props;
    const isDefect = payload.type === 'defect';
    const isSource = payload.type === 'part';
    const fill = isDefect ? getDefectColor(payload.name) : '#3b82f6';
    
    return (
      <Layer key={`CustomNode${index}`}>
        <Rectangle x={x} y={y} width={width} height={height} fill={fill} fillOpacity={1} rx={2} />
        <text
          textAnchor={isSource ? 'start' : 'end'}
          x={isSource ? x : x + width}
          y={y - 6}
          fontSize="11"
          fontWeight="600"
          fill="#374151"
        >
          {payload.name}
        </text>
      </Layer>
    );
  }, [getDefectColor]);

  const CustomSankeyLink = React.useCallback((props: any) => {
    const { sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, payload } = props;
    const targetNode = typeof payload.target === 'object' ? payload.target : sankeyData.nodes[payload.target];
    const fill = targetNode ? getDefectColor(targetNode.name) : '#cbd5e1';
    
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
  }, [getDefectColor, sankeyData]);

  const stats = useMemo(() => {
    const totalQuantity = filteredRecords.reduce((acc, r) => acc + r.quantity, 0);
    const { start, end } = dateRange;
    
    // Shift Data for Comparison
    const shiftComparisonData = SHIFTS.map(shift => {
      const shiftRecords = records.filter(r => {
        if (!r.timestamp) return false;
        const d = r.timestamp.toDate();
        return d >= start && d <= end && r.shift === shift;
      });
      const quantity = shiftRecords.reduce((acc, r) => acc + r.quantity, 0);
      
      return { name: shift, quantity };
    });

    // Flattened shift comparison for a cleaner chart (Grouped by Defect and Shift)
    const flattenedShiftData: any[] = [];
    const activeDefectNames = defectTypes.map(t => t.name);
    
    // Also include defects that are in records but not in current config
    const recordsDefectNames = Array.from(new Set(records.map(r => r.defectType)));
    const allDefectNames = Array.from(new Set([...activeDefectNames, ...recordsDefectNames]));

    allDefectNames.forEach(type => {
      const entry: any = { defect: type };
      let hasData = false;
      SHIFTS.forEach(shift => {
        const qty = records
          .filter(r => {
            if (!r.timestamp) return false;
            const d = r.timestamp.toDate();
            return d >= start && d <= end && r.shift === shift && r.defectType === type;
          })
          .reduce((acc, r) => acc + r.quantity, 0);
        entry[shift] = qty;
        if (qty > 0) hasData = true;
      });
      if (hasData) flattenedShiftData.push(entry);
    });

    // Defect Data for Current Filter
    const defectData = allDefectNames.map(type => ({
      name: type,
      value: filteredRecords.filter(r => r.defectType === type).reduce((acc, r) => acc + r.quantity, 0),
    })).filter(d => d.value > 0);

    // Top 3 Scraps of the Selected Range
    const scrapsByPart: Record<string, number> = {};
    filteredRecords.forEach(r => {
      scrapsByPart[r.partName] = (scrapsByPart[r.partName] || 0) + r.quantity;
    });

    const top3Scraps = Object.entries(scrapsByPart)
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 3);

    const topDefect = [...defectData].sort((a, b) => b.value - a.value)[0]?.name || 'N/A';

    // Calculate critical shift (most scrap quantity)
    const criticalShift = [...shiftComparisonData].sort((a, b) => b.quantity - a.quantity)[0]?.name || 'N/A';

    // Specific Day Stats relative to end date
    const analysisDate = dateRange.end;
    const yesterday = subDays(analysisDate, 1);
    const last3DaysStart = subDays(analysisDate, 2);

    const selectedDayQty = records.filter(r => r.timestamp && isSameDay(r.timestamp.toDate(), analysisDate))
      .reduce((acc, r) => acc + r.quantity, 0);
    
    const yesterdayQty = records.filter(r => r.timestamp && isSameDay(r.timestamp.toDate(), yesterday))
      .reduce((acc, r) => acc + r.quantity, 0);

    const last3DaysQty = records.filter(r => {
      if (!r.timestamp) return false;
      const d = r.timestamp.toDate();
      return d >= startOfDay(last3DaysStart) && d <= analysisDate;
    }).reduce((acc, r) => acc + r.quantity, 0);

    return { 
      totalQuantity, 
      shiftComparisonData, 
      flattenedShiftData,
      defectData, 
      topDefect, 
      criticalShift, 
      top3Scraps, 
      selectedDayQty, 
      yesterdayQty, 
      last3DaysQty 
    };
  }, [filteredRecords, records, dateRange]);

  return (
    <div className="space-y-8 pb-12">
      {/* Header & Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Análise de Refugo</h2>
          <p className="text-gray-500">Acompanhe o desempenho e qualidade da produção</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
            <Filter className="w-4 h-4 text-gray-400 ml-2" />
            <select 
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value as any)}
              className="bg-transparent border-none focus:ring-0 text-sm font-medium text-gray-700 outline-none pr-8"
            >
              <option value="Todos">Todos os Turnos</option>
              {SHIFTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
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
        <SummaryCard 
          title="Refugo no Período" 
          value={stats.totalQuantity} 
          icon={<Package className="w-5 h-5 text-blue-600" />}
          color="bg-blue-50"
        />
        <SummaryCard 
          title={`Refugo em ${format(dateRange.end, 'dd/MM')}`} 
          value={stats.selectedDayQty} 
          icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
          color="bg-emerald-50"
        />
        <SummaryCard 
          title="Refugo Ontem" 
          value={stats.yesterdayQty} 
          icon={<TrendingUp className="w-5 h-5 text-amber-600" />}
          color="bg-amber-50"
        />
        <SummaryCard 
          title="Últimos 3 Dias" 
          value={stats.last3DaysQty} 
          icon={<TrendingUp className="w-5 h-5 text-purple-600" />}
          color="bg-purple-50"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SummaryCard 
          title="Maior Incidência" 
          value={stats.topDefect} 
          icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
          color="bg-red-50"
        />
        <SummaryCard 
          title="Turno Crítico" 
          value={stats.criticalShift} 
          icon={<LayoutDashboard className="w-5 h-5 text-indigo-600" />}
          color="bg-indigo-50"
        />
      </div>

      {/* Top 3 Scraps of the Selected Range */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"
      >
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Top 3 Refugos do Período</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {stats.top3Scraps.map((scrap, index) => (
            <motion.div 
              key={scrap.name} 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedDetail({ type: 'part', name: scrap.name })}
              className="p-6 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col items-center text-center cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-all"
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 text-xl font-bold ${
                index === 0 ? 'bg-amber-100 text-amber-600' :
                index === 1 ? 'bg-gray-200 text-gray-600' :
                'bg-orange-100 text-orange-600'
              }`}>
                {index + 1}
              </div>
              <p className="text-lg font-bold text-gray-900 mb-1">{scrap.quantity} un</p>
              <p className="text-sm font-medium text-gray-600 truncate w-full">{scrap.name}</p>
            </motion.div>
          ))}
          {stats.top3Scraps.length === 0 && (
            <div className="col-span-full py-8 text-center text-gray-500 italic">
              Nenhum refugo registrado neste período.
            </div>
          )}
        </div>
      </motion.div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Defect Distribution */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 h-[500px] flex flex-col"
        >
          <h3 className="text-lg font-semibold mb-2 text-gray-900 px-2">Distribuição de Defeitos</h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <Pie
                  data={stats.defectData}
                  cx="50%"
                  cy="45%"
                  innerRadius="55%"
                  outerRadius="75%"
                  paddingAngle={2}
                  dataKey="value"
                  onClick={(data) => setSelectedDetail({ type: 'defect', name: data.name })}
                  className="cursor-pointer"
                >
                  {stats.defectData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={defectTypes.find(t => t.name === entry.name)?.color || '#cbd5e1'} 
                      className="hover:opacity-80 transition-opacity"
                    />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                />
                <Legend 
                  layout="horizontal" 
                  verticalAlign="bottom" 
                  align="center"
                  wrapperStyle={{ paddingTop: '20px', fontSize: '11px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Shift Comparison - Vertical Layout for many defects */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 h-[500px] flex flex-col"
        >
          <h3 className="text-lg font-semibold mb-2 text-gray-900 px-2">Comparativo de Defeitos por Turno</h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                layout="vertical"
                data={stats.flattenedShiftData} 
                margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                <XAxis 
                  type="number" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#6b7280', fontSize: 11 }} 
                  allowDecimals={false}
                />
                <YAxis 
                  type="category" 
                  dataKey="defect" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                  width={90}
                />
                <Tooltip 
                  cursor={{ fill: '#f9fafb' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                  formatter={(value: number) => [Math.floor(value), 'Quantidade']}
                />
                <Legend 
                  iconType="circle" 
                  wrapperStyle={{ paddingTop: '10px', fontSize: '11px' }}
                />
                {SHIFTS.map((shift) => (
                  <Bar 
                    key={shift} 
                    dataKey={shift} 
                    name={shift} 
                    fill={SHIFT_COLORS[shift]} 
                    radius={[0, 4, 4, 0]}
                    barSize={12}
                    onClick={(data: any) => setSelectedDetail({ type: 'defect', name: data.defect || data.payload?.defect, shift: shift })}
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Sankey Diagram (Parts -> Defects) */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"
      >
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-semibold text-gray-900">Fluxo de Refugo (Peças → Defeitos)</h3>
        </div>
        <div className="h-[600px] w-full">
          {sankeyData.nodes.length > 0 ? (
            <div className="w-full h-full flex flex-col">
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <Sankey
                    data={sankeyData}
                    nodePadding={24}
                    margin={{ left: 20, right: 20, top: 30, bottom: 20 }}
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
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-xs font-bold text-gray-600">Peças</span>
                </div>
                {sankeyData.defectNames.map(defect => (
                  <div key={defect} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getDefectColor(defect) }} />
                    <span className="text-xs font-bold text-gray-600">{defect}</span>
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
      </motion.div>

      <AnimatePresence>
        {selectedDetail && (
          <DrillDownModal 
            detail={selectedDetail} 
            records={filteredRecords} 
            onClose={() => setSelectedDetail(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const DrillDownModal: React.FC<{ 
  detail: { type: 'defect' | 'part'; name: string; shift?: Shift }; 
  records: ScrapRecord[]; 
  onClose: () => void 
}> = ({ detail, records, onClose }) => {
  const data = useMemo(() => {
    let filtered = detail.type === 'defect' 
      ? records.filter(r => r.defectType === detail.name)
      : records.filter(r => r.partName === detail.name);

    if (detail.shift) {
      filtered = filtered.filter(r => r.shift === detail.shift);
    }

    const grouped: Record<Shift, { item: string; quantity: number }[]> = {
      'Turno 1': [],
      'Turno 2': [],
      'Turno 3': []
    };

    filtered.forEach(r => {
      const itemName = detail.type === 'defect' ? r.partName : r.defectType;
      const existing = grouped[r.shift].find(x => x.item === itemName);
      if (existing) {
        existing.quantity += r.quantity;
      } else {
        grouped[r.shift].push({ item: itemName, quantity: r.quantity });
      }
    });

    return grouped;
  }, [detail, records]);

  const activeShifts = detail.shift ? [detail.shift] : SHIFTS;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
      >
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
              Detalhamento por {detail.type === 'defect' ? 'Defeito' : 'Peça'} {detail.shift ? `- ${detail.shift}` : ''}
            </p>
            <h3 className="text-xl font-bold text-gray-900">{detail.name}</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {activeShifts.map(shift => (
            <div key={shift} className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: SHIFT_COLORS[shift] }} />
                <h4 className="font-bold text-gray-800">{shift}</h4>
              </div>
              
              {data[shift].length > 0 ? (
                <div className="bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-100/50">
                        <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">{detail.type === 'defect' ? 'Peça' : 'Defeito'}</th>
                        <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase text-right">Quantidade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data[shift].sort((a, b) => b.quantity - a.quantity).map((row, idx) => (
                        <tr key={idx} className="border-t border-gray-100">
                          <td className="px-4 py-3 text-sm font-medium text-gray-700">{row.item}</td>
                          <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">{row.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-white border-t-2 border-gray-100">
                        <td className="px-4 py-3 text-sm font-bold text-gray-900">Total {shift}</td>
                        <td className="px-4 py-3 text-sm font-bold text-blue-600 text-right">
                          {data[shift].reduce((acc, curr) => acc + curr.quantity, 0)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic px-4">Nenhum registro para este turno.</p>
              )}
            </div>
          ))}
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
          >
            Fechar
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const SummaryCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color: string }> = ({ title, value, icon, color }) => (
  <motion.div 
    whileHover={{ y: -4 }}
    className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4"
  >
    <div className={`p-3 rounded-xl ${color}`}>
      {icon}
    </div>
    <div>
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
  </motion.div>
);
