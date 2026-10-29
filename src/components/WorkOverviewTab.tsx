import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  TrendingUp,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  FileText,
  Save,
  Loader2,
  ArrowRight,
  CheckSquare,
  PieChart,
  BarChart3,
  Scale,
  Receipt,
  LayoutDashboard,
  BookOpenCheck,
  UserCheck
} from 'lucide-react';

interface WorkOverviewTabProps {
  workId: string;
  contractAmount?: number;
  startDate?: string | null;
  targetDate?: string | null;
  initialNotes?: string | null;
  onNavigateTab?: (tab: 'items' | 'schedule' | 'finance') => void;
}

interface TaskEntryRecord {
  id: string;
  entry_date: string;
  quantity_executed: number;
  executed_by: string[];
  notes?: string | null;
  created_at: string;
  work_task_id: string;
  work_item_id: string;
  task_title?: string;
  task_unit?: string;
  item_title?: string;
}

const formatCurrency = (val: number) => {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const getInitials = (name: string) => {
  if (!name) return 'EX';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const WorkOverviewTab: React.FC<WorkOverviewTabProps> = ({
  workId,
  contractAmount = 0,
  startDate,
  targetDate,
  initialNotes = '',
  onNavigateTab
}) => {
  const [loading, setLoading] = useState(true);
  const [activeSubView, setActiveSubView] = useState<'summary' | 'timeline' | 'charts'>('summary');

  const [items, setItems] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [, setRecentPhotos] = useState<any[]>([]);
  const [taskEntries, setTaskEntries] = useState<TaskEntryRecord[]>([]);

  // Notas da Obra
  const [notes, setNotes] = useState(initialNotes || '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      const [itemsRes, mRes, invRes, photosRes, workRes, entriesRes] = await Promise.all([
        supabase
          .from('work_items')
          .select('*')
          .eq('work_id', workId),
        supabase
          .from('work_measurements')
          .select('*')
          .eq('work_id', workId),
        supabase
          .from('work_invoices')
          .select('*')
          .eq('work_id', workId),
        supabase
          .from('work_item_attachments')
          .select('*')
          .eq('work_item_id', workId)
          .like('file_type', 'image/%')
          .order('created_at', { ascending: false })
          .limit(4),
        supabase
          .from('works')
          .select('notes, contract_amount, budget_amount')
          .eq('id', workId)
          .single(),
        supabase
          .from('work_task_entries')
          .select('*')
          .eq('work_id', workId)
          .order('entry_date', { ascending: false })
          .order('created_at', { ascending: false })
      ]);

      const itemsList = itemsRes.data || [];
      const itemIds = itemsList.map(i => i.id);

      let tasksList: any[] = [];
      if (itemIds.length > 0) {
        const { data: tData } = await supabase
          .from('work_tasks')
          .select('*')
          .in('work_item_id', itemIds);

        tasksList = tData || [];
      }

      setItems(itemsList);
      setTasks(tasksList);
      setMeasurements(mRes.data || []);
      setInvoices(invRes.data || []);
      setRecentPhotos(photosRes.data || []);

      // Montar mapa para enriquecer os apontamentos da timeline
      const tasksMap = new Map<string, any>();
      tasksList.forEach(t => tasksMap.set(t.id, t));

      const itemsMap = new Map<string, any>();
      itemsList.forEach(i => itemsMap.set(i.id, i));

      const enrichedEntries: TaskEntryRecord[] = (entriesRes.data || []).map((entry: any) => {
        const relatedTask = tasksMap.get(entry.work_task_id);
        const relatedItem = itemsMap.get(entry.work_item_id);
        return {
          ...entry,
          task_title: relatedTask?.title || 'Atividade',
          task_unit: relatedTask?.unit || 'un',
          item_title: relatedItem?.title || 'Item'
        };
      });

      setTaskEntries(enrichedEntries);

      if (workRes.data?.notes !== undefined && workRes.data?.notes !== null) {
        setNotes(workRes.data.notes);
      }
    } catch (err) {
      console.error('Erro ao carregar dashboard executivo:', err);
    } finally {
      setLoading(false);
    }
  }, [workId]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleSaveNotes = async () => {
    try {
      setSavingNotes(true);
      const { error } = await supabase
        .from('works')
        .update({ notes: notes.trim() })
        .eq('id', workId);

      if (error) throw error;
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2500);
    } catch (err: any) {
      alert('Erro ao salvar notas: ' + err.message);
    } finally {
      setSavingNotes(false);
    }
  };

  // Cálculos Analíticos
  const analytics = useMemo(() => {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'concluida').length;

    // 1. Avanço Físico Real
    let physicalProgress = 0;
    if (totalTasks > 0) {
      let executedScore = 0;
      tasks.forEach(t => {
        if (t.status === 'concluida') executedScore += 1;
        else if (t.has_progress_tracking && t.quantity_planned > 0) {
          executedScore += Math.min(1, (t.quantity_executed || 0) / t.quantity_planned);
        }
      });
      physicalProgress = Math.round((executedScore / totalTasks) * 100);
    }

    // 2. Avanço Financeiro
    const totalMeasured = measurements.reduce((acc, m) => acc + (Number(m.total_measured_amount) || 0), 0);
    const totalPaid = invoices.filter(i => i.status === 'pago').reduce((acc, i) => acc + (Number(i.amount) || 0), 0);
    const balanceToMeasure = Math.max(0, contractAmount - totalMeasured);

    const financialProgress = contractAmount > 0 ? Math.min(100, Math.round((totalMeasured / contractAmount) * 100)) : 0;
    const paidProgress = contractAmount > 0 ? Math.min(100, Math.round((totalPaid / contractAmount) * 100)) : 0;

    // 3. Tempo Decorrido do Cronograma
    let timeElapsedPercent = 0;
    let daysTotal = 0;
    let daysRemaining: number | null = null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (startDate && targetDate) {
      const start = new Date(startDate + 'T00:00:00');
      const target = new Date(targetDate + 'T00:00:00');
      daysTotal = Math.max(1, Math.ceil((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      const daysPassed = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      daysRemaining = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      timeElapsedPercent = Math.max(0, Math.min(100, Math.round((daysPassed / daysTotal) * 100)));
    } else if (targetDate) {
      const target = new Date(targetDate + 'T00:00:00');
      daysRemaining = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }

    // 4. Atrasos e Próximos Prazos
    const nowStr = now.toISOString().split('T')[0];
    const delayedTasks = tasks.filter(t => t.status !== 'concluida' && t.due_date && t.due_date < nowStr);
    const upcomingTasks = tasks
      .filter(t => t.status !== 'concluida' && t.due_date)
      .sort((a, b) => (a.due_date > b.due_date ? 1 : -1))
      .slice(0, 4);

    let scheduleHealthStatus: 'em_dia' | 'atencao' | 'critico' = 'em_dia';
    if (delayedTasks.length > 0 || (daysRemaining !== null && daysRemaining < 0)) {
      scheduleHealthStatus = 'critico';
    } else if (timeElapsedPercent > physicalProgress + 15) {
      scheduleHealthStatus = 'atencao';
    }

    // 5. Agrupamento por Setor
    const locationsMap: Record<string, { total: number; done: number }> = {};
    items.forEach(it => {
      const loc = it.location || 'Geral / Canteiro';
      if (!locationsMap[loc]) locationsMap[loc] = { total: 0, done: 0 };

      const itTasks = tasks.filter(t => t.work_item_id === it.id);
      locationsMap[loc].total += itTasks.length;
      locationsMap[loc].done += itTasks.filter(t => t.status === 'concluida').length;
    });

    const locationsProgress = Object.entries(locationsMap).map(([loc, val]) => ({
      location: loc,
      percent: val.total > 0 ? Math.round((val.done / val.total) * 100) : 0,
      total: val.total,
      done: val.done
    }));

    // 6. Agrupamento por Categoria / Tipo de Subitem
    const categoriesMap: Record<string, { total: number; done: number }> = {};
    tasks.forEach(t => {
      const cat = t.task_type || 'Sem Categoria';
      if (!categoriesMap[cat]) categoriesMap[cat] = { total: 0, done: 0 };
      categoriesMap[cat].total += 1;
      if (t.status === 'concluida') categoriesMap[cat].done += 1;
    });

    const categoryStats = Object.entries(categoriesMap).map(([name, data]) => ({
      name,
      percent: data.total > 0 ? Math.round((data.done / data.total) * 100) : 0,
      total: data.total,
      done: data.done
    }));

    // 7. Curva S Estimada
    const curvePoints = [
      { label: 'Sem 1', planned: 15, executed: Math.min(physicalProgress, 20) },
      { label: 'Sem 2', planned: 35, executed: Math.min(physicalProgress, 40) },
      { label: 'Sem 3', planned: 60, executed: Math.min(physicalProgress, 65) },
      { label: 'Sem 4', planned: 85, executed: Math.min(physicalProgress, 85) },
      { label: 'Entrega', planned: 100, executed: physicalProgress }
    ];

    return {
      totalTasks,
      completedTasks,
      physicalProgress,
      financialProgress,
      paidProgress,
      totalMeasured,
      totalPaid,
      balanceToMeasure,
      timeElapsedPercent,
      daysRemaining,
      delayedTasksCount: delayedTasks.length,
      scheduleHealthStatus,
      upcomingTasks,
      locationsProgress,
      categoryStats,
      curvePoints
    };
  }, [tasks, items, measurements, invoices, contractAmount, startDate, targetDate]);

  // Agrupamento dos Apontamentos para a Timeline (por data)
  const timelineGroups = useMemo(() => {
    const groups: Record<string, { entries: TaskEntryRecord[]; notes: Set<string> }> = {};

    taskEntries.forEach(entry => {
      const dateKey = entry.entry_date || 'Data não informada';
      if (!groups[dateKey]) {
        groups[dateKey] = { entries: [], notes: new Set() };
      }
      groups[dateKey].entries.push(entry);
      if (entry.notes?.trim()) {
        groups[dateKey].notes.add(entry.notes.trim());
      }
    });

    return Object.entries(groups).map(([date, data]) => ({
      date,
      entries: data.entries,
      notes: Array.from(data.notes)
    }));
  }, [taskEntries]);

  // Cálculos do Gráfico Donut (SVG)
  const donutData = useMemo(() => {
    const total = Math.max(1, contractAmount);
    const paidVal = analytics.totalPaid;
    const measuredVal = Math.max(0, analytics.totalMeasured - analytics.totalPaid);
    const remainingVal = Math.max(0, total - analytics.totalMeasured);

    const paidPct = (paidVal / total) * 100;
    const measuredPct = (measuredVal / total) * 100;
    const remainingPct = (remainingVal / total) * 100;

    const C = 251.2;
    const offsetPaid = 0;
    const dashPaid = (paidPct / 100) * C;

    const offsetMeasured = -dashPaid;
    const dashMeasured = (measuredPct / 100) * C;

    const offsetRemaining = -(dashPaid + dashMeasured);
    const dashRemaining = (remainingPct / 100) * C;

    return {
      paidVal,
      measuredVal,
      remainingVal,
      paidPct: Math.round(paidPct),
      measuredPct: Math.round(measuredPct),
      remainingPct: Math.round(remainingPct),
      dashPaid: `${dashPaid} ${C}`,
      offsetPaid,
      dashMeasured: `${dashMeasured} ${C}`,
      offsetMeasured,
      dashRemaining: `${dashRemaining} ${C}`,
      offsetRemaining
    };
  }, [contractAmount, analytics.totalPaid, analytics.totalMeasured]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full text-slate-400 text-xs py-20">
        <Loader2 size={24} className="animate-spin text-sky-600 mb-2" />
        <span className="font-semibold text-slate-600">Calculando indicadores executivos do dashboard...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4 select-none pb-6">
      
      {/* 1. SELETOR DE MODO NO TOPO */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 pb-1">
        <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-semibold overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveSubView('summary')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeSubView === 'summary' ? 'bg-white text-sky-700 font-bold shadow-2xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <LayoutDashboard size={14} />
            <span>Resumo Executivo & Notas</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubView('timeline')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeSubView === 'timeline' ? 'bg-white text-sky-700 font-bold shadow-2xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpenCheck size={14} />
            <span>Timeline do Diário ({taskEntries.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubView('charts')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeSubView === 'charts' ? 'bg-white text-sky-700 font-bold shadow-2xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart3 size={14} />
            <span>Gráficos Analíticos & Curva S</span>
          </button>
        </div>

        <span className="text-[11px] font-bold text-slate-400 hidden sm:inline">
          Obra #{workId.slice(0, 8)}
        </span>
      </div>

      {/* 2. CARDS SUPERIORES FIXOS DE KPIS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
        
        {/* Contrato vs. Saldo */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-1.5 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Contrato Homologado</span>
            <strong className="text-slate-900 text-base lg:text-lg font-black block">
              {formatCurrency(contractAmount)}
            </strong>
          </div>
          <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-medium">Saldo Restante:</span>
            <span className="font-extrabold text-amber-700">{formatCurrency(analytics.balanceToMeasure)}</span>
          </div>
        </div>

        {/* Produção Física vs. Financeira */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-1.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Físico vs. Medido</span>
            <span className="text-xs font-black text-sky-600">{analytics.physicalProgress}%</span>
          </div>
          <div className="space-y-1">
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div className="h-2 rounded-full bg-sky-500" style={{ width: `${analytics.physicalProgress}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
              <span>{analytics.completedTasks}/{analytics.totalTasks} tarefas</span>
              <span>{analytics.financialProgress}% medido</span>
            </div>
          </div>
          <div className="pt-1 border-t border-slate-100 flex justify-between items-center text-[11px]">
            <span className="text-slate-400 font-medium">Medido:</span>
            <span className="font-bold text-slate-800">{formatCurrency(analytics.totalMeasured)}</span>
          </div>
        </div>

        {/* Saúde do Cronograma & Prazo */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-1.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Prazo & Cronograma</span>
            {analytics.scheduleHealthStatus === 'critico' ? (
              <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <AlertTriangle size={10} />
                <span>Crítico</span>
              </span>
            ) : analytics.scheduleHealthStatus === 'atencao' ? (
              <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                Ritmo Lento
              </span>
            ) : (
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 size={10} />
                <span>No Prazo</span>
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-1.5">
            <strong className="text-slate-900 text-lg font-black">
              {analytics.daysRemaining !== null ? `${analytics.daysRemaining} dias` : '—'}
            </strong>
            <span className="text-[11px] text-slate-400 font-medium">
              {analytics.daysRemaining !== null && analytics.daysRemaining >= 0 ? 'restantes' : 'de atraso'}
            </span>
          </div>

          <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-medium">Atrasadas:</span>
            <span className={`font-bold ${analytics.delayedTasksCount > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
              {analytics.delayedTasksCount} tarefas
            </span>
          </div>
        </div>

        {/* Liquidação / Faturamento Recebido */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-1.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block flex items-center gap-1">
              <CheckCircle2 size={11} />
              <span>Recebimento / Caixa</span>
            </span>
            <span className="text-xs font-black text-emerald-600">{analytics.paidProgress}%</span>
          </div>

          <div>
            <strong className="text-emerald-900 text-base lg:text-lg font-black block">
              {formatCurrency(analytics.totalPaid)}
            </strong>
            <span className="text-[10px] text-slate-400">Total liquidado na conta</span>
          </div>

          <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-medium">A Receber:</span>
            <span className="font-bold text-slate-800">{formatCurrency(Math.max(0, analytics.totalMeasured - analytics.totalPaid))}</span>
          </div>
        </div>

      </div>

      {/* 3. CONTEÚDO BASEADO NA SUB-ABA SELECIONADA */}
      {activeSubView === 'summary' ? (
        /* VISÃO 1: RESUMO EXECUTIVO & NOTAS */
        <div className="space-y-4">
          
          {/* Balanço Físico x Financeiro x Tempo */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Scale size={16} className="text-sky-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Balanço Comparativo Físico-Financeiro
                </h3>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Curva de Acompanhamento da Produção</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              <div className="space-y-1.5 bg-slate-50/70 p-3 rounded-xl border border-slate-200/70">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <CheckSquare size={13} className="text-sky-600" />
                    <span>Execução Física em Campo</span>
                  </span>
                  <span className="font-black text-sky-700">{analytics.physicalProgress}%</span>
                </div>
                <div className="w-full bg-slate-200/80 rounded-full h-2.5 overflow-hidden">
                  <div className="h-2.5 rounded-full bg-sky-500 transition-all duration-500" style={{ width: `${analytics.physicalProgress}%` }} />
                </div>
                <span className="text-[10px] text-slate-400 block">
                  {analytics.completedTasks} de {analytics.totalTasks} tarefas concluídas
                </span>
              </div>

              <div className="space-y-1.5 bg-slate-50/70 p-3 rounded-xl border border-slate-200/70">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Receipt size={13} className="text-emerald-600" />
                    <span>Avanço Financeiro Medido</span>
                  </span>
                  <span className="font-black text-emerald-700">{analytics.financialProgress}%</span>
                </div>
                <div className="w-full bg-slate-200/80 rounded-full h-2.5 overflow-hidden">
                  <div className="h-2.5 rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${analytics.financialProgress}%` }} />
                </div>
                <span className="text-[10px] text-slate-400 block truncate">
                  {formatCurrency(analytics.totalMeasured)} de {formatCurrency(contractAmount)}
                </span>
              </div>

              <div className="space-y-1.5 bg-slate-50/70 p-3 rounded-xl border border-slate-200/70">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Clock size={13} className="text-amber-600" />
                    <span>Tempo de Obra Consumido</span>
                  </span>
                  <span className="font-black text-amber-700">{analytics.timeElapsedPercent}%</span>
                </div>
                <div className="w-full bg-slate-200/80 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-500 ${
                      analytics.timeElapsedPercent > analytics.physicalProgress ? 'bg-rose-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${analytics.timeElapsedPercent}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 block">
                  {analytics.daysRemaining !== null ? `${analytics.daysRemaining} dias até o prazo final` : 'Sem data final'}
                </span>
              </div>
            </div>
          </div>

          {/* Grid com Entregas, Setores e Diário */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-4">
              {/* Próximas Entregas */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Clock size={15} className="text-sky-600" />
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Próximas Entregas & Prazos
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigateTab?.('schedule')}
                    className="text-[10px] font-bold text-sky-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Ver Cronograma</span>
                    <ArrowRight size={11} />
                  </button>
                </div>

                {analytics.upcomingTasks.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                    Nenhuma tarefa pendente com prazo cadastrado.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {analytics.upcomingTasks.map(t => {
                      const nowStr = new Date().toISOString().split('T')[0];
                      const isLate = t.due_date && t.due_date < nowStr;
                      const parentItem = items.find(i => i.id === t.work_item_id);

                      return (
                        <div
                          key={t.id}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs transition ${
                            isLate
                              ? 'bg-rose-50/60 border-rose-200 text-rose-900'
                              : 'bg-slate-50/60 border-slate-200/80 hover:bg-slate-50'
                          }`}
                        >
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              {isLate ? (
                                <AlertTriangle size={13} className="text-rose-600 shrink-0" />
                              ) : (
                                <Clock size={13} className="text-slate-400 shrink-0" />
                              )}
                              <strong className="font-bold truncate text-slate-800">{t.title}</strong>
                            </div>
                            {parentItem && (
                              <span className="text-[10px] text-slate-400 block truncate pl-4">
                                Componente: {parentItem.title}
                              </span>
                            )}
                          </div>

                          <div className="text-right shrink-0">
                            <span className={`text-[10px] font-bold block ${isLate ? 'text-rose-700' : 'text-slate-600'}`}>
                              {t.due_date ? new Date(t.due_date + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                            </span>
                            {isLate && (
                              <span className="text-[9px] font-black uppercase text-rose-600">Atrasada</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Setores / Canteiro */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <MapPin size={15} className="text-sky-600" />
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Progresso por Local / Setor
                    </h4>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">{analytics.locationsProgress.length} locais</span>
                </div>

                {analytics.locationsProgress.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                    Nenhum local cadastrado nos componentes.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {analytics.locationsProgress.map((loc, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-slate-800 flex items-center gap-1.5">
                            <MapPin size={12} className="text-slate-400" />
                            <span>{loc.location}</span>
                          </span>
                          <span className="text-sky-700 font-extrabold">{loc.percent}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full ${loc.percent >= 100 ? 'bg-emerald-500' : 'bg-sky-500'}`}
                            style={{ width: `${loc.percent}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 block text-right">
                          {loc.done} de {loc.total} subitens concluídos
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Diário de Bordo & Ocorrências */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3 flex flex-col">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2">
                  <FileText size={15} className="text-sky-600" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Diário Operacional & Ocorrências
                  </h4>
                </div>
                {savedFeedback && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <CheckCircle2 size={11} />
                    <span>Salvo!</span>
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-500 leading-relaxed shrink-0">
                Registre imprevistos, alterações de projeto, decisões de engenharia e observações diárias.
              </p>

              <textarea
                rows={10}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Escreva aqui as ocorrências e notas da obra..."
                className="w-full flex-1 p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-sky-500 text-xs text-slate-800 leading-relaxed resize-none shadow-2xs"
              />

              <div className="flex justify-end pt-1 shrink-0">
                <button
                  type="button"
                  disabled={savingNotes}
                  onClick={handleSaveNotes}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition"
                >
                  {savingNotes ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>Salvar Diário de Obra</span>
                </button>
              </div>
            </div>
          </div>

        </div>
      ) : activeSubView === 'timeline' ? (
        /* VISÃO 2: TIMELINE CRONOLÓGICA DO DIÁRIO DE OBRA (QUEM FEZ O QUÊ POR DIA) */
        <div className="space-y-4">
          
          {/* Header com resumo da Timeline */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <BookOpenCheck size={16} className="text-sky-600" />
                <span>Histórico de Lançamentos de Campo</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Acompanhe o que foi executado em cada dia e quais colaboradores atuaram em cada atividade.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-sky-50 border border-sky-200 text-sky-800 rounded-xl text-xs font-bold">
                {taskEntries.length} apontamentos realizados
              </span>
              <span className="px-3 py-1 bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold">
                {timelineGroups.length} dias de atividade
              </span>
            </div>
          </div>

          {/* Timeline Feed */}
          {timelineGroups.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl bg-white space-y-2">
              <BookOpenCheck size={36} className="text-slate-300 mx-auto" />
              <p className="font-bold text-slate-700 text-sm">Nenhum apontamento registrado ainda</p>
              <p className="max-w-xs mx-auto text-slate-400 leading-relaxed">
                Utilize o botão flutuante "Diário de Obra" no canto inferior direito para lançar os serviços feitos pela equipe.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {timelineGroups.map(group => {
                const formattedDate = group.date !== 'Data não informada'
                  ? new Date(group.date + 'T00:00:00').toLocaleDateString('pt-BR', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })
                  : group.date;

                return (
                  <div key={group.date} className="relative pl-6 sm:pl-8 before:absolute before:left-2 sm:before:left-3 before:top-3 before:bottom-0 before:w-0.5 before:bg-slate-200">
                    
                    {/* Marcador do Dia */}
                    <div className="absolute left-0 top-1 w-4 sm:w-6 h-4 sm:h-6 rounded-full bg-sky-600 text-white flex items-center justify-center shadow-xs border-2 border-white">
                      <Calendar size={11} />
                    </div>

                    <div className="space-y-2.5">
                      
                      {/* Título do Dia */}
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-extrabold text-slate-900 text-sm capitalize">
                          {formattedDate}
                        </h4>
                        <span className="text-[10px] font-bold text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                          {group.entries.length} {group.entries.length === 1 ? 'atividade' : 'atividades'}
                        </span>
                      </div>

                      {/* Observações do dia */}
                      {group.notes.length > 0 && (
                        <div className="space-y-1">
                          {group.notes.map((note, nIdx) => (
                            <div key={nIdx} className="bg-amber-50/80 border border-amber-200/80 p-2.5 rounded-xl text-xs text-amber-900 leading-relaxed font-medium">
                              <span className="font-bold text-[10px] text-amber-700 uppercase tracking-wider block mb-0.5">
                                Ocorrência / Nota de Campo:
                              </span>
                              {note}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Lista de Atividades do Dia */}
                      <div className="space-y-2">
                        {group.entries.map(entry => {
                          const executors = entry.executed_by || [];

                          return (
                            <div
                              key={entry.id}
                              className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs hover:border-slate-300 transition space-y-2"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h5 className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                                      {entry.task_title}
                                    </h5>
                                    {entry.item_title && (
                                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                                        {entry.item_title}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="shrink-0 bg-sky-50 border border-sky-200 text-sky-900 font-extrabold text-xs px-2.5 py-1 rounded-xl">
                                  +{entry.quantity_executed} {entry.task_unit}
                                </div>
                              </div>

                              {/* Badges de quem executou esta atividade */}
                              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                    <UserCheck size={11} className="text-sky-600" />
                                    <span>Executado por:</span>
                                  </span>

                                  {executors.length > 0 ? (
                                    executors.map((name, eIdx) => (
                                      <span
                                        key={eIdx}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700"
                                      >
                                        <span className="w-3.5 h-3.5 rounded-full bg-sky-600 text-white font-bold text-[7px] flex items-center justify-center">
                                          {getInitials(name)}
                                        </span>
                                        <span>{name}</span>
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-[11px] text-slate-400 italic">
                                      Equipe geral (não detalhado)
                                    </span>
                                  )}
                                </div>

                                <span className="text-[10px] text-slate-400 font-medium">
                                  {new Date(entry.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      ) : (
        /* VISÃO 3: GRÁFICOS ANALÍTICOS & CURVA S */
        <div className="space-y-4">
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            
            {/* GRÁFICO 1: DONUT DE COMPOSIÇÃO FINANCEIRA DO CONTRATO */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <PieChart size={15} className="text-emerald-600" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Composição do Contrato
                  </h4>
                </div>
                <span className="text-[10px] font-bold text-slate-400">Balanço Global</span>
              </div>

              {/* Renderização SVG da Rosca */}
              <div className="flex items-center justify-center relative py-2">
                <svg className="w-36 h-36 transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="#f1f5f9" strokeWidth="12" />
                  {/* Saldo Restante */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#cbd5e1"
                    strokeWidth="12"
                    strokeDasharray={donutData.dashRemaining}
                    strokeDashoffset={donutData.offsetRemaining}
                  />
                  {/* Medido a Faturar */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#0284c7"
                    strokeWidth="12"
                    strokeDasharray={donutData.dashMeasured}
                    strokeDashoffset={donutData.offsetMeasured}
                  />
                  {/* Faturado / Liquidado */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#10b981"
                    strokeWidth="12"
                    strokeDasharray={donutData.dashPaid}
                    strokeDashoffset={donutData.offsetPaid}
                  />
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                  <span className="text-xs text-slate-400 font-bold uppercase">Medido</span>
                  <strong className="text-lg font-black text-slate-900">{analytics.financialProgress}%</strong>
                </div>
              </div>

              {/* Legenda do Donut */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span>Liquidado / Recebido</span>
                  </span>
                  <strong className="text-emerald-700">{formatCurrency(donutData.paidVal)}</strong>
                </div>

                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-600" />
                    <span>Medido a Receber</span>
                  </span>
                  <strong className="text-sky-700">{formatCurrency(donutData.measuredVal)}</strong>
                </div>

                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                    <span>Saldo a Executar</span>
                  </span>
                  <strong className="text-slate-600">{formatCurrency(donutData.remainingVal)}</strong>
                </div>
              </div>
            </div>

            {/* GRÁFICO 2: CURVA S DE PRODUÇÃO */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-4 lg:col-span-2 flex flex-col justify-between">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <TrendingUp size={15} className="text-sky-600" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Curva S de Evolução Semanal
                  </h4>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-bold">
                  <span className="flex items-center gap-1 text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-slate-300" />
                    <span>Previsto no Cronograma</span>
                  </span>
                  <span className="flex items-center gap-1 text-sky-600">
                    <span className="w-2 h-2 rounded-full bg-sky-500" />
                    <span>Realizado em Campo</span>
                  </span>
                </div>
              </div>

              {/* Área do Gráfico */}
              <div className="h-44 flex items-end justify-between gap-3 pt-6 px-2">
                {analytics.curvePoints.map((pt, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                    <div className="w-full flex items-end justify-center gap-1.5 h-full">
                      <div
                        className="w-1/3 bg-slate-200 rounded-t-md transition-all duration-500"
                        style={{ height: `${pt.planned}%` }}
                        title={`Previsto: ${pt.planned}%`}
                      />
                      <div
                        className="w-1/3 bg-sky-500 rounded-t-md transition-all duration-500"
                        style={{ height: `${pt.executed}%` }}
                        title={`Realizado: ${pt.executed}%`}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">{pt.label}</span>
                  </div>
                ))}
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs flex items-center justify-between">
                <span className="text-slate-500 font-medium">Diagnóstico Operacional:</span>
                <span className={`font-bold ${analytics.physicalProgress >= 50 ? 'text-emerald-700' : 'text-slate-700'}`}>
                  {analytics.physicalProgress >= 50 ? 'Ritmo de montagem acelerado' : 'Fase inicial de estruturação'}
                </span>
              </div>
            </div>

          </div>

          {/* GRÁFICO 3: AVANÇO POR CATEGORIA / TIPO DE ATIVIDADE */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <BarChart3 size={15} className="text-indigo-600" />
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Progresso por Frente de Serviço & Categoria
                </h4>
              </div>
              <span className="text-[10px] font-bold text-slate-400">{analytics.categoryStats.length} frentes</span>
            </div>

            {analytics.categoryStats.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                Nenhuma tarefa categorizada na EAP.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analytics.categoryStats.map((cat, idx) => (
                  <div key={idx} className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-slate-800">{cat.name}</span>
                      <span className="text-indigo-700 font-black">{cat.percent}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          cat.percent >= 100 ? 'bg-emerald-500' : 'bg-indigo-600'
                        }`}
                        style={{ width: `${cat.percent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                      <span>{cat.done} de {cat.total} subitens finalizados</span>
                      <span>{cat.percent >= 100 ? 'Concluído' : 'Em andamento'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
};

export default WorkOverviewTab;