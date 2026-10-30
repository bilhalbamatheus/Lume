import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import {
  Calendar,
  UserCheck,
  Search,
  Loader2,
  ChevronRight,
  X,
  Layers,
  Users,
  RotateCcw,
  Award,
  Lock
} from 'lucide-react';

interface DailyLogEntry {
  id: string;
  entry_date: string;
  quantity_executed: number;
  executed_by: string[];
  notes?: string | null;
  item_notes?: string | null;
  is_rework?: boolean;
  created_at: string;
  work_task_id: string;
  work_item_id: string;
  task_title?: string;
  task_unit?: string;
  has_progress_tracking?: boolean;
  item_title?: string;
  item_location?: string;
}

interface DayGroup {
  date: string;
  formattedDate: string;
  entries: DailyLogEntry[];
  totalActivities: number;
  reworkCount: number;
  uniqueExecutors: string[];
  notes: string[];
}

interface WorkerPerformance {
  name: string;
  totalEntries: number;
  completedTasks: number;
  daysActive: number;
  reworkCount: number;
  entries: DailyLogEntry[];
}

interface WorkDailyLogsTabProps {
  workId: string;
  onOpenNewLog?: () => void;
}

type PeriodFilter = 'all' | 'month' | 'week';

const getInitials = (name: string) => {
  if (!name) return 'EX';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const WorkDailyLogsTab: React.FC<WorkDailyLogsTabProps> = ({
  workId,
  onOpenNewLog
}) => {
  useAuth();
  const { permissions, loading: loadingPerms } = usePermissions();


  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<DailyLogEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDay, setSelectedDay] = useState<DayGroup | null>(null);

  // Sub-aba interna: 'timeline' (Dia a Dia) ou 'performance' (Rendimento da Equipe)
  const [subView, setSubView] = useState<'timeline' | 'performance'>('performance');

  // Filtro de Período para Rendimento
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');

  // Colaborador selecionado para ver o histórico detalhado
  const [selectedWorkerDetails, setSelectedWorkerDetails] = useState<WorkerPerformance | null>(null);

  // -------------------------------------------------------------
  // REGRAS DAS PERMISSÕES SIMPLIFICADAS
  // -------------------------------------------------------------
  // Permissão 9: Visualizar diário de obra e rendimento da equipe
  const canViewDailyLogs = Boolean(
    permissions.isOwnerOrAdmin ||
    permissions.canViewDailyLogs
  );

  // Permissão 5: Apontar avanço e dar baixa em tarefas
  const canExecuteTasks = Boolean(
    permissions.isOwnerOrAdmin ||
    permissions.canExecuteWorkTasks ||
    permissions.canCompleteWorkTasks
  );

  const loadEntries = useCallback(async () => {
    try {
      setLoading(true);

      const [entriesRes, itemsRes] = await Promise.all([
        supabase
          .from('work_task_entries')
          .select('*')
          .eq('work_id', workId)
          .order('entry_date', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('work_items')
          .select('id, title, location')
          .eq('work_id', workId)
      ]);

      const rawEntries = entriesRes.data || [];
      const itemsList = itemsRes.data || [];
      const itemMap = new Map(itemsList.map(i => [i.id, i]));

      const taskIds = Array.from(new Set(rawEntries.map(e => e.work_task_id).filter(Boolean)));
      let taskMap = new Map();

      if (taskIds.length > 0) {
        const { data: tasksData } = await supabase
          .from('work_tasks')
          .select('id, title, unit, has_progress_tracking')
          .in('id', taskIds);
        taskMap = new Map((tasksData || []).map(t => [t.id, t]));
      }

      const enriched: DailyLogEntry[] = rawEntries.map((e: any) => {
        const t = taskMap.get(e.work_task_id);
        const it = itemMap.get(e.work_item_id);
        const hasReworkTag = Boolean(e.is_rework || (e.notes && e.notes.includes('[RETRABALHO]')));

        return {
          ...e,
          task_title: t?.title || 'Atividade',
          task_unit: t?.unit || 'un',
          has_progress_tracking: Boolean(t?.has_progress_tracking),
          item_title: it?.title || 'Componente',
          item_location: it?.location || 'Geral',
          is_rework: hasReworkTag
        };
      });

      setEntries(enriched);
    } catch (err) {
      console.error('Erro ao carregar diários de obra:', err);
    } finally {
      setLoading(false);
    }
  }, [workId]);

  useEffect(() => {
    if (canViewDailyLogs) {
      loadEntries();
    }
  }, [loadEntries, canViewDailyLogs]);

  // Filtragem dos Apontamentos com Base no Período Selecionado
  const periodFilteredEntries = useMemo(() => {
    if (periodFilter === 'all') return entries;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    if (periodFilter === 'month') {
      return entries.filter(e => {
        if (!e.entry_date) return false;
        const d = new Date(e.entry_date + 'T00:00:00');
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      });
    }

    if (periodFilter === 'week') {
      const day = now.getDay();
      const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now);
      monday.setDate(diffToMonday);
      monday.setHours(0, 0, 0, 0);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      return entries.filter(e => {
        if (!e.entry_date) return false;
        const d = new Date(e.entry_date + 'T00:00:00');
        return d >= monday && d <= sunday;
      });
    }

    return entries;
  }, [entries, periodFilter]);

  // Agrupamento por Dia
  const dayGroups = useMemo(() => {
    const map: Record<string, DailyLogEntry[]> = {};

    entries.forEach(entry => {
      const d = entry.entry_date || 'Data não informada';
      if (!map[d]) map[d] = [];
      map[d].push(entry);
    });

    return Object.entries(map).map(([date, dayEntries]) => {
      const executorsSet = new Set<string>();
      const notesSet = new Set<string>();
      let reworks = 0;

      dayEntries.forEach(e => {
        (e.executed_by || []).forEach(name => executorsSet.add(name));
        if (e.notes?.trim()) notesSet.add(e.notes.trim());
        if (e.is_rework) reworks += 1;
      });

      const formatted = date !== 'Data não informada'
        ? new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric'
          })
        : date;

      return {
        date,
        formattedDate: formatted,
        entries: dayEntries,
        totalActivities: dayEntries.length,
        reworkCount: reworks,
        uniqueExecutors: Array.from(executorsSet),
        notes: Array.from(notesSet)
      };
    });
  }, [entries]);

  // Estatísticas de Produtividade dos Funcionários por Período
  const workersPerformance = useMemo(() => {
    const stats: Record<string, WorkerPerformance> = {};
    const datesPerWorker: Record<string, Set<string>> = {};

    periodFilteredEntries.forEach(entry => {
      const isComplete = entry.quantity_executed > 0;
      const isRework = Boolean(entry.is_rework);

      (entry.executed_by || []).forEach(name => {
        const cleanName = name.trim();
        if (!cleanName) return;

        if (!stats[cleanName]) {
          stats[cleanName] = {
            name: cleanName,
            totalEntries: 0,
            completedTasks: 0,
            daysActive: 0,
            reworkCount: 0,
            entries: []
          };
          datesPerWorker[cleanName] = new Set();
        }

        stats[cleanName].totalEntries += 1;
        stats[cleanName].entries.push(entry);
        if (isComplete) stats[cleanName].completedTasks += 1;
        if (isRework) stats[cleanName].reworkCount += 1;
        if (entry.entry_date) datesPerWorker[cleanName].add(entry.entry_date);
      });
    });

    Object.keys(stats).forEach(name => {
      stats[name].daysActive = datesPerWorker[name]?.size || 0;
    });

    return Object.values(stats).sort((a, b) => b.totalEntries - a.totalEntries);
  }, [periodFilteredEntries]);

  // Filtro de Busca
  const filteredGroups = useMemo(() => {
    if (!searchTerm.trim()) return dayGroups;
    const q = searchTerm.toLowerCase();

    return dayGroups.filter(group => {
      const matchesDate = group.date.toLowerCase().includes(q) || group.formattedDate.toLowerCase().includes(q);
      const matchesExecutor = group.uniqueExecutors.some(ex => ex.toLowerCase().includes(q));
      const matchesTask = group.entries.some(
        e => e.task_title?.toLowerCase().includes(q) || e.item_title?.toLowerCase().includes(q)
      );

      return matchesDate || matchesExecutor || matchesTask;
    });
  }, [dayGroups, searchTerm]);

  const totalReworksGlobal = useMemo(() => {
    return entries.filter(e => e.is_rework).length;
  }, [entries]);

  if (!loadingPerms && !canViewDailyLogs) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50/50 rounded-2xl border border-slate-200">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3 border border-slate-200">
          <Lock size={22} />
        </div>
        <h4 className="font-bold text-slate-800 text-sm mb-1">Acesso Restrito aos Diários de Obra</h4>
        <p className="text-xs text-slate-500 max-w-sm">
          Seu perfil de acesso não possui permissão para visualizar os relatórios e diários desta obra.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full text-slate-400 text-xs py-20">
        <Loader2 size={24} className="animate-spin text-sky-600 mb-2" />
        <span className="font-semibold text-slate-600">Carregando relatórios diários de obra...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12 animate-in fade-in duration-150">
      
      {/* 1. CARDS DE RESUMO OPERACIONAL */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Dias de Obra
          </span>
          <div className="flex items-baseline gap-1.5">
            <strong className="text-lg font-black text-slate-900 font-mono">
              {dayGroups.length}
            </strong>
            <span className="text-[11px] text-slate-400">com apontamento</span>
          </div>
        </div>

        <div className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider block">
            Apontamentos
          </span>
          <div className="flex items-baseline gap-1.5">
            <strong className="text-lg font-black text-sky-700 font-mono">
              {entries.length}
            </strong>
            <span className="text-[11px] text-slate-400">atividades</span>
          </div>
        </div>

        <div className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
            Equipe Atuante
          </span>
          <div className="flex items-baseline gap-1.5">
            <strong className="text-lg font-black text-emerald-800 font-mono">
              {workersPerformance.length}
            </strong>
            <span className="text-[11px] text-slate-400">colaboradores</span>
          </div>
        </div>

        <div className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block flex items-center gap-1">
            <RotateCcw size={11} />
            <span>Retrabalhos</span>
          </span>
          <div className="flex items-baseline gap-1.5">
            <strong className={`text-lg font-black font-mono ${totalReworksGlobal > 0 ? 'text-amber-800' : 'text-slate-800'}`}>
              {totalReworksGlobal}
            </strong>
            <span className="text-[11px] text-slate-400">apontados</span>
          </div>
        </div>
      </div>

      {/* 2. BARRA DE CONTROLE: ALTERNADOR DE MODO + BUSCA */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        
        {/* Alternador de Sub-Aba */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-semibold w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setSubView('timeline')}
            className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
              subView === 'timeline' ? 'bg-white text-sky-700 font-bold shadow-2xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar size={14} />
            <span>Diários Dia a Dia</span>
          </button>

          <button
            type="button"
            onClick={() => setSubView('performance')}
            className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
              subView === 'performance' ? 'bg-white text-sky-700 font-bold shadow-2xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users size={14} />
            <span>Rendimento da Equipe ({workersPerformance.length})</span>
          </button>
        </div>

        {/* Busca e Botão Novo */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          {subView === 'timeline' && (
            <div className="relative flex-1 sm:w-72">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar por data, colaborador ou tarefa..."
                className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:ring-2 focus:ring-sky-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}

          {onOpenNewLog && canExecuteTasks && (
            <button
              type="button"
              onClick={onOpenNewLog}
              className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-2xs transition shrink-0 cursor-pointer"
            >
              + Novo Apontamento
            </button>
          )}
        </div>
      </div>

      {/* 3. CONTEÚDO PRINCIPAL: TIMELINE OU PRODUTIVIDADE */}
      {subView === 'timeline' ? (
        /* VISUALIZAÇÃO DIA A DIA */
        filteredGroups.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-xs text-slate-400 space-y-2">
            <Calendar size={36} className="text-slate-300 mx-auto" />
            <h4 className="font-bold text-slate-800 text-sm">Nenhum diário encontrado</h4>
            <p className="max-w-md mx-auto text-slate-400">
              Não há apontamentos registrados para este filtro. Utilize o botão "+ Novo Apontamento" para registrar as atividades do dia.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredGroups.map(group => (
              <div
                key={group.date}
                onClick={() => setSelectedDay(group)}
                className="bg-white border border-slate-200/90 hover:border-sky-300 hover:shadow-md transition-all p-4 rounded-2xl cursor-pointer group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                {/* Lado Esquerdo: Data e Resumo */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 group-hover:bg-sky-50 text-slate-600 group-hover:text-sky-600 border border-slate-200 flex flex-col items-center justify-center shrink-0 transition-colors">
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      {group.date !== 'Data não informada'
                        ? new Date(group.date + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase()
                        : 'DIA'}
                    </span>
                    <strong className="text-base font-black leading-none mt-0.5">
                      {group.date !== 'Data não informada'
                        ? new Date(group.date + 'T00:00:00').getDate()
                        : '—'}
                    </strong>
                  </div>

                  <div className="space-y-0.5 min-w-0">
                    <h4 className="text-sm font-bold text-slate-900 group-hover:text-sky-600 transition-colors capitalize truncate">
                      {group.formattedDate}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                      <span className="font-semibold text-slate-700">
                        {group.totalActivities} {group.totalActivities === 1 ? 'atividade' : 'atividades'} trabalhadas
                      </span>
                      {group.reworkCount > 0 && (
                        <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                          <RotateCcw size={10} />
                          <span>{group.reworkCount} retrabalho(s)</span>
                        </span>
                      )}
                      {group.notes.length > 0 && (
                        <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 font-semibold px-2 py-0.5 rounded-md">
                          {group.notes.length} nota(s)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Lado Direito: Colaboradores e Seta */}
                <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden md:inline">
                      Equipe ({group.uniqueExecutors.length}):
                    </span>
                    <div className="flex -space-x-2 overflow-hidden">
                      {group.uniqueExecutors.slice(0, 4).map((name, idx) => (
                        <div
                          key={idx}
                          className="w-7 h-7 rounded-full bg-sky-100 text-sky-800 border-2 border-white text-[10px] font-bold flex items-center justify-center shrink-0 shadow-2xs"
                          title={name}
                        >
                          {getInitials(name)}
                        </div>
                      ))}
                      {group.uniqueExecutors.length > 4 && (
                        <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 border-2 border-white text-[10px] font-bold flex items-center justify-center shrink-0">
                          +{group.uniqueExecutors.length - 4}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="w-8 h-8 rounded-xl bg-slate-50 group-hover:bg-sky-600 group-hover:text-white text-slate-400 flex items-center justify-center transition-colors shrink-0">
                    <ChevronRight size={16} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* VISUALIZAÇÃO DE PRODUTIVIDADE & RENDIMENTO DA EQUIPE */
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-4">
            
            {/* Topo da Tabela: Título e Seletor de Período */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Award size={16} className="text-amber-500" />
                  <span>Rendimento Individual dos Colaboradores no Canteiro</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Clique na linha de um colaborador para ver em quais atividades ele atuou
                </p>
              </div>

              {/* SELETOR DE PERÍODO */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-semibold self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setPeriodFilter('all')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer text-xs ${
                    periodFilter === 'all'
                      ? 'bg-white text-sky-700 font-bold shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Toda a Obra
                </button>
                <button
                  type="button"
                  onClick={() => setPeriodFilter('month')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer text-xs ${
                    periodFilter === 'month'
                      ? 'bg-white text-sky-700 font-bold shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Mês Atual
                </button>
                <button
                  type="button"
                  onClick={() => setPeriodFilter('week')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer text-xs ${
                    periodFilter === 'week'
                      ? 'bg-white text-sky-700 font-bold shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Esta Semana
                </button>
              </div>
            </div>

            {workersPerformance.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-8 text-center">
                Nenhum apontamento com colaboradores atribuídos neste período.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-4">Colaborador</th>
                      <th className="py-2.5 px-4 text-center">Dias no Canteiro</th>
                      <th className="py-2.5 px-4 text-center">Tarefas Atuadas</th>
                      <th className="py-2.5 px-4 text-center">Finalizadas</th>
                      <th className="py-2.5 px-4 text-center">Retrabalhos</th>
                      <th className="py-2.5 px-4 text-right">Rendimento Relativo</th>
                      <th className="py-2.5 px-4 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {workersPerformance.map((wp, idx) => {
                      const maxEntries = Math.max(1, workersPerformance[0]?.totalEntries || 1);
                      const relativePct = Math.round((wp.totalEntries / maxEntries) * 100);

                      return (
                        <tr
                          key={wp.name}
                          onClick={() => setSelectedWorkerDetails(wp)}
                          className="hover:bg-slate-50/80 transition cursor-pointer group"
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-sky-100 text-sky-800 font-bold text-[10px] flex items-center justify-center shrink-0 border border-slate-200 group-hover:scale-105 transition-transform">
                                {getInitials(wp.name)}
                              </div>
                              <div>
                                <strong className="text-slate-900 text-xs font-bold block group-hover:text-sky-600 transition-colors">
                                  {wp.name}
                                </strong>
                                <span className="text-[10px] text-slate-400">
                                  {idx === 0 ? '🏆 Maior volume de atividades' : `Posição #${idx + 1}`}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                            {wp.daysActive} dias
                          </td>

                          <td className="py-3 px-4 text-center font-mono font-extrabold text-sky-700">
                            {wp.totalEntries}
                          </td>

                          <td className="py-3 px-4 text-center font-mono font-bold text-emerald-700">
                            {wp.completedTasks}
                          </td>

                          <td className="py-3 px-4 text-center">
                            {wp.reworkCount > 0 ? (
                              <span className="font-mono font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md text-[11px]">
                                {wp.reworkCount}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-mono">0</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200/60 hidden sm:block">
                                <div
                                  className="h-1.5 rounded-full bg-sky-500"
                                  style={{ width: `${relativePct}%` }}
                                />
                              </div>
                              <span className="font-mono font-extrabold text-slate-700 text-xs">
                                {relativePct}%
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-4 text-center">
                            <div className="w-6 h-6 rounded-lg bg-slate-50 group-hover:bg-sky-600 group-hover:text-white text-slate-400 flex items-center justify-center transition-colors mx-auto">
                              <ChevronRight size={14} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. MODAL DE DETALHES DO DIA SELECIONADO */}
      {selectedDay && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 h-[88vh] flex flex-col">
            
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar size={13} />
                  <span>Relatório Diário</span>
                </span>
                <h3 className="text-lg font-black text-slate-900 capitalize leading-tight">
                  {selectedDay.formattedDate}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {selectedDay.notes.length > 0 && (
              <div className="space-y-2 shrink-0">
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
                  Ocorrências e Decisões de Campo
                </span>
                {selectedDay.notes.map((note, nIdx) => (
                  <div key={nIdx} className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs text-amber-900 leading-relaxed font-medium">
                    {note}
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2 flex-1 min-h-0 flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block shrink-0">
                Tarefas Trabalhadas ({selectedDay.entries.length})
              </span>

              <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-1">
                {selectedDay.entries.map(entry => (
                  <div
                    key={entry.id}
                    className={`p-3.5 border rounded-2xl space-y-2 transition ${
                      entry.is_rework
                        ? 'bg-amber-50/60 border-amber-200'
                        : 'bg-slate-50/80 border-slate-200/80 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <strong className="block text-xs font-bold text-slate-900 leading-snug">
                            {entry.task_title}
                          </strong>
                          {entry.is_rework && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded">
                              <RotateCcw size={10} /> Retrabalho
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                          <Layers size={11} className="text-slate-400 shrink-0" />
                          <span className="truncate">{entry.item_title}</span>
                          {entry.item_location && (
                            <>
                              <span>•</span>
                              <span className="truncate">{entry.item_location}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 bg-white border border-sky-200 text-sky-800 font-extrabold text-xs px-2.5 py-1 rounded-xl shadow-2xs font-mono">
                        +{entry.quantity_executed} {entry.task_unit}
                      </div>
                    </div>

                    {entry.item_notes && (
                      <p className="text-[11px] text-slate-600 bg-white p-2 rounded-xl border border-slate-200/70 italic">
                        "{entry.item_notes}"
                      </p>
                    )}

                    <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between gap-2 flex-wrap text-xs">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <UserCheck size={12} className="text-sky-600" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Executado por:
                        </span>
                        {(entry.executed_by || []).length > 0 ? (
                          (entry.executed_by || []).map((name, eIdx) => (
                            <span
                              key={eIdx}
                              className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[11px] font-bold text-slate-700"
                            >
                              {name}
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Equipe geral</span>
                        )}
                      </div>

                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(entry.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-2xs"
              >
                Fechar Detalhes
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 5. MODAL DE DETALHES DO COLABORADOR */}
      {selectedWorkerDetails && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 h-[88vh] flex flex-col">
            
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-sky-600 text-white font-extrabold text-sm flex items-center justify-center shadow-xs shrink-0">
                  {getInitials(selectedWorkerDetails.name)}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 leading-tight">
                    {selectedWorkerDetails.name}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Histórico de atividades executadas nesta obra • {periodFilter === 'all' ? 'Toda a Obra' : periodFilter === 'month' ? 'Mês Atual' : 'Esta Semana'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedWorkerDetails(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5 p-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs shrink-0">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tarefas</span>
                <strong className="text-sm font-black text-sky-700 font-mono mt-0.5 block">
                  {selectedWorkerDetails.totalEntries}
                </strong>
              </div>
              <div className="border-l border-slate-200/80 pl-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Dias Ativos</span>
                <strong className="text-sm font-black text-slate-800 font-mono mt-0.5 block">
                  {selectedWorkerDetails.daysActive} dias
                </strong>
              </div>
              <div className="border-l border-slate-200/80 pl-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Retrabalhos</span>
                <strong className={`text-sm font-black font-mono mt-0.5 block ${selectedWorkerDetails.reworkCount > 0 ? 'text-amber-800' : 'text-slate-800'}`}>
                  {selectedWorkerDetails.reworkCount}
                </strong>
              </div>
            </div>

            <div className="space-y-2 flex-1 min-h-0 flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block shrink-0">
                Atividades Realizadas ({selectedWorkerDetails.entries.length})
              </span>

              <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-1">
                {selectedWorkerDetails.entries.map((entry, idx) => (
                  <div
                    key={entry.id || idx}
                    className={`p-3.5 border rounded-2xl space-y-2 transition ${
                      entry.is_rework
                        ? 'bg-amber-50/60 border-amber-200'
                        : 'bg-slate-50/80 border-slate-200/80 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <strong className="block text-xs font-bold text-slate-900 leading-snug">
                            {entry.task_title}
                          </strong>
                          {entry.is_rework && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded">
                              <RotateCcw size={10} /> Retrabalho
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                          <Layers size={11} className="text-slate-400 shrink-0" />
                          <span className="truncate">{entry.item_title}</span>
                          {entry.item_location && (
                            <>
                              <span>•</span>
                              <span className="truncate">{entry.item_location}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 bg-white border border-sky-200 text-sky-800 font-extrabold text-xs px-2.5 py-1 rounded-xl shadow-2xs font-mono">
                        +{entry.quantity_executed} {entry.task_unit}
                      </div>
                    </div>

                    {entry.item_notes && (
                      <p className="text-[11px] text-slate-600 bg-white p-2 rounded-xl border border-slate-200/70 italic">
                        "{entry.item_notes}"
                      </p>
                    )}

                    <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-500">
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                        <Calendar size={12} className="text-slate-400" />
                        <span>
                          {entry.entry_date ? new Date(entry.entry_date + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                        </span>
                      </span>

                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(entry.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedWorkerDetails(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-2xs"
              >
                Fechar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default WorkDailyLogsTab;