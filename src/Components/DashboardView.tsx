import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import {
  TrendingUp,
  DollarSign,
  Trophy,
  Target,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  Building2,
  User,
  Kanban,
  Loader2,
  RefreshCw,
  ChevronRight,
  Calendar,
  ChevronDown,
  Briefcase
} from 'lucide-react';

interface DashboardViewProps {
  onNavigateTab: (tab: string, filterOptions?: any) => void;
  onOpenOpportunityDetail?: (opportunityId: string) => void;
  permissions?: any;
}   

interface StageStat {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  probability: number;
  count: number;
  totalValue: number;
  deals: any[];
}

type PeriodPreset = 'this_month' | 'last_30_days' | 'last_90_days' | 'this_year' | 'all_time' | 'custom';

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateTab,
  onOpenOpportunityDetail,
  permissions: propPermissions
}) => {
  const { user } = useAuth();
  const { permissions: hookPermissions } = usePermissions();
  
  // Utiliza as permissões já prontas vindas do App.tsx (0 delay visual)
  const permissions = propPermissions || hookPermissions;

  const [loading, setLoading] = useState(true);

  // Estados dos dados brutos
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);

  // Estados do Seletor de Período
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('this_month');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);
  const periodDropdownRef = useRef<HTMLDivElement>(null);

  // Controle de Hover nos Popovers
  const [hoveredStageId, setHoveredStageId] = useState<string | null>(null);
  const [hoveredActivityType, setHoveredActivityType] = useState<'atrasadas' | 'pendentes' | 'concluidas' | null>(null);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (periodDropdownRef.current && !periodDropdownRef.current.contains(event.target as Node)) {
        setIsPeriodDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Sem data';
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const companyId = user?.company?.id;
      const currentUserId = user?.id || (user as any)?.profile?.id;
      if (!companyId) return;

      const isAdmin = Boolean(permissions.isOwnerOrAdmin);
      const hasPipelineAccess = Boolean(permissions.canViewPipeline);

      // 1. CARREGAR ATIVIDADES COM SELECT FLEXÍVEL (Evita Erro 400 em colunas com nomes alternativos)
      try {
        const { data: rawActivities, error: actError } = await supabase
          .from('activities')
          .select('*')
          .eq('company_id', companyId);

        if (actError) throw actError;

        let filteredActs = rawActivities || [];
        if (!isAdmin && currentUserId) {
          filteredActs = filteredActs.filter((a: any) => {
            const creator = a.created_by || a.profile_id;
            const assignee = a.assigned_to || a.assigned_profile_id;
            return creator === currentUserId || assignee === currentUserId;
          });
        }
        setActivities(filteredActs);
      } catch (actErr) {
        console.warn('[DashboardView] Fallback na busca de atividades:', actErr);
        setActivities([]);
      }

      // 2. SE NÃO TEM ACESSO AO COMERCIAL: não busca e zera oportunidades
      if (!hasPipelineAccess) {
        setStages([]);
        setOpportunities([]);
        return;
      }

      // 3. SE TEM ACESSO AO COMERCIAL: busca etapas e oportunidades
      const [stagesRes, oppsRes] = await Promise.all([
        supabase
          .from('commercial_pipeline_stages')
          .select('id, name, color, sort_order, default_probability')
          .eq('company_id', companyId)
          .order('sort_order', { ascending: true }),

        (() => {
          let query = supabase
            .from('opportunities')
            .select(`
              id,
              title,
              stage_id,
              status,
              estimated_value,
              assigned_to,
              created_at,
              updated_at,
              contact:contacts!contact_id (
                id,
                display_name,
                type
              )
            `)
            .eq('company_id', companyId);

          if (!isAdmin && currentUserId) {
            query = query.eq('assigned_to', currentUserId);
          }

          return query;
        })()
      ]);

      setStages(stagesRes.data || []);
      setOpportunities(oppsRes.data || []);
    } catch (err) {
      console.error('[DashboardView] Erro ao carregar métricas:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.company?.id, user?.id, permissions.isOwnerOrAdmin, permissions.canViewPipeline]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Limites de data com base no preset
  const dateRange = useMemo(() => {
    const now = new Date();
    let start: Date | null = null;
    let end: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    switch (periodPreset) {
      case 'this_month':
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        break;
      case 'last_30_days':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'last_90_days':
        start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'this_year':
        start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        break;
      case 'custom':
        if (customStartDate) start = new Date(`${customStartDate}T00:00:00`);
        if (customEndDate) end = new Date(`${customEndDate}T23:59:59`);
        break;
      case 'all_time':
      default:
        start = null;
        break;
    }

    return { start, end };
  }, [periodPreset, customStartDate, customEndDate]);

  const periodLabel = useMemo(() => {
    switch (periodPreset) {
      case 'this_month': return 'Este Mês';
      case 'last_30_days': return 'Últimos 30 dias';
      case 'last_90_days': return 'Últimos 90 dias';
      case 'this_year': return 'Este Ano';
      case 'all_time': return 'Todo o Período';
      case 'custom':
        return customStartDate && customEndDate 
          ? `${formatDate(customStartDate)} até ${formatDate(customEndDate)}`
          : 'Personalizado';
      default: return 'Período';
    }
  }, [periodPreset, customStartDate, customEndDate]);

  // Cálculos consolidados
  const metrics = useMemo(() => {
    const now = new Date();
    const { start, end } = dateRange;

    const isInRange = (dateString?: string | null) => {
      if (!dateString) return false;
      const d = new Date(dateString);
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    };

    const wonDealsInPeriod = opportunities.filter((op) => {
      if (op.status !== 'ganha') return false;
      return isInRange(op.updated_at || op.created_at);
    });
    const wonRevenue = wonDealsInPeriod.reduce((acc, curr) => acc + (curr.estimated_value || 0), 0);
    const wonTicketAverage = wonDealsInPeriod.length > 0 ? wonRevenue / wonDealsInPeriod.length : 0;

    const lostDealsInPeriod = opportunities.filter((op) => {
      if (op.status !== 'perdida') return false;
      return isInRange(op.updated_at || op.created_at);
    });

    const totalClosedInPeriod = wonDealsInPeriod.length + lostDealsInPeriod.length;
    const conversionRate = totalClosedInPeriod > 0
      ? Math.round((wonDealsInPeriod.length / totalClosedInPeriod) * 100)
      : (opportunities.some(o => o.status === 'ganha') ? 100 : 0);

    const inProcess = opportunities.filter((op) => {
      if (op.status !== 'em_andamento') return false;
      if (end && new Date(op.created_at) > end) return false;
      return true;
    });
    const pipelineValue = inProcess.reduce((acc, curr) => acc + (curr.estimated_value || 0), 0);
    const pipelineTicketAverage = inProcess.length > 0 ? pipelineValue / inProcess.length : 0;

    const forecastValue = inProcess.reduce((acc, curr) => {
      const st = stages.find((s) => s.id === curr.stage_id);
      const prob = (st?.default_probability && st.default_probability > 0 ? st.default_probability : 25) / 100;
      return acc + (curr.estimated_value || 0) * prob;
    }, 0);

    const relevantActivities = activities.filter((a) => {
      if (!a.due_date) return true;
      return isInRange(a.due_date);
    });

    const pendingTasksList = relevantActivities.filter((a) => {
      const st = String(a.status || '').toLowerCase();
      return st === 'pendente' || st === 'pending' || st === 'em_andamento';
    });
    const overdueTasksList = pendingTasksList.filter((a) => a.due_date && new Date(a.due_date) < now);
    const completedTasksList = relevantActivities.filter((a) => {
      const st = String(a.status || '').toLowerCase();
      return st === 'concluida' || st === 'completed';
    });

    const stagesStats: StageStat[] = stages.map((st) => {
      const stageOpps = inProcess.filter((op) => op.stage_id === st.id);
      const totalVal = stageOpps.reduce((acc, curr) => acc + (curr.estimated_value || 0), 0);
      return {
        id: st.id,
        name: st.name,
        color: st.color || '#0ea5e9',
        sort_order: st.sort_order,
        probability: st.default_probability || 0,
        count: stageOpps.length,
        totalValue: totalVal,
        deals: stageOpps,
      };
    });

    const topOpportunities = [...inProcess]
      .sort((a, b) => (b.estimated_value || 0) - (a.estimated_value || 0))
      .slice(0, 5);

    return {
      wonRevenue,
      wonCount: wonDealsInPeriod.length,
      wonTicketAverage,
      lostCount: lostDealsInPeriod.length,
      pipelineValue,
      inProcessCount: inProcess.length,
      pipelineTicketAverage,
      forecastValue,
      conversionRate,
      pendingTasksCount: pendingTasksList.length,
      pendingTasksList,
      overdueTasksCount: overdueTasksList.length,
      overdueTasksList,
      completedTasksCount: completedTasksList.length,
      completedTasksList,
      stagesStats,
      topOpportunities,
    };
  }, [opportunities, stages, activities, dateRange]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
        <Loader2 size={24} className="animate-spin text-sky-600" />
        <span className="text-xs font-semibold">Calculando indicadores...</span>
      </div>
    );
  }

  const hasPipeline = permissions.canViewPipeline;
  const isOnlyPersonal = hasPipeline && !permissions.isOwnerOrAdmin;

  return (
    <div className="flex flex-col h-full min-w-0 overflow-y-auto space-y-5 p-4 sm:p-6 pr-2 sm:pr-4">
      {/* Topo: Título + Seletor de Período + Ações Rápidas */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            {!hasPipeline && <Briefcase size={22} className="text-sky-600" />}
            <span>
              {!hasPipeline
                ? 'Minhas Atividades & Tarefas'
                : isOnlyPersonal
                ? 'Meu Desempenho Comercial'
                : 'Dashboard Estratégico'}
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            {!hasPipeline
              ? 'Acompanhe exclusivamente as suas tarefas operacionais e vistorias agendadas.'
              : isOnlyPersonal
              ? 'Métricas e oportunidades sob a sua responsabilidade comercial.'
              : 'Visão consolidada de vendas, pipeline de negociações e produtividade de toda a empresa.'}
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          {/* SELETOR DE PERÍODO */}
          <div className="relative" ref={periodDropdownRef}>
            <button
              type="button"
              onClick={() => setIsPeriodDropdownOpen(!isPeriodDropdownOpen)}
              className="inline-flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer"
            >
              <Calendar size={14} className="text-sky-600" />
              <span>{periodLabel}</span>
              <ChevronDown size={13} className="text-slate-400" />
            </button>

            {isPeriodDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="space-y-1 text-xs">
                  <button
                    type="button"
                    onClick={() => { setPeriodPreset('this_month'); setIsPeriodDropdownOpen(false); }}
                    className={`w-full text-left px-3 py-2 rounded-xl font-medium transition-colors cursor-pointer flex items-center justify-between ${
                      periodPreset === 'this_month' ? 'bg-sky-50 text-sky-700 font-bold' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>Este Mês</span>
                    {periodPreset === 'this_month' && <CheckCircle2 size={13} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setPeriodPreset('last_30_days'); setIsPeriodDropdownOpen(false); }}
                    className={`w-full text-left px-3 py-2 rounded-xl font-medium transition-colors cursor-pointer flex items-center justify-between ${
                      periodPreset === 'last_30_days' ? 'bg-sky-50 text-sky-700 font-bold' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>Últimos 30 dias</span>
                    {periodPreset === 'last_30_days' && <CheckCircle2 size={13} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setPeriodPreset('last_90_days'); setIsPeriodDropdownOpen(false); }}
                    className={`w-full text-left px-3 py-2 rounded-xl font-medium transition-colors cursor-pointer flex items-center justify-between ${
                      periodPreset === 'last_90_days' ? 'bg-sky-50 text-sky-700 font-bold' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>Últimos 90 dias (Trimestre)</span>
                    {periodPreset === 'last_90_days' && <CheckCircle2 size={13} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setPeriodPreset('this_year'); setIsPeriodDropdownOpen(false); }}
                    className={`w-full text-left px-3 py-2 rounded-xl font-medium transition-colors cursor-pointer flex items-center justify-between ${
                      periodPreset === 'this_year' ? 'bg-sky-50 text-sky-700 font-bold' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>Este Ano</span>
                    {periodPreset === 'this_year' && <CheckCircle2 size={13} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setPeriodPreset('all_time'); setIsPeriodDropdownOpen(false); }}
                    className={`w-full text-left px-3 py-2 rounded-xl font-medium transition-colors cursor-pointer flex items-center justify-between ${
                      periodPreset === 'all_time' ? 'bg-sky-50 text-sky-700 font-bold' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>Todo o Histórico</span>
                    {periodPreset === 'all_time' && <CheckCircle2 size={13} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setPeriodPreset('custom')}
                    className={`w-full text-left px-3 py-2 rounded-xl font-medium transition-colors cursor-pointer flex items-center justify-between ${
                      periodPreset === 'custom' ? 'bg-sky-50 text-sky-700 font-bold' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>Intervalo Personalizado</span>
                    {periodPreset === 'custom' && <CheckCircle2 size={13} />}
                  </button>
                </div>

                {periodPreset === 'custom' && (
                  <div className="pt-2.5 mt-2 border-t border-slate-100 space-y-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">De:</label>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="w-full text-xs p-1.5 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Até:</label>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="w-full text-xs p-1.5 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-sky-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsPeriodDropdownOpen(false)}
                      className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Aplicar Filtro
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={loadDashboardData}
            className="p-2 border border-slate-200 bg-white rounded-xl text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer"
            title="Atualizar Indicadores"
          >
            <RefreshCw size={15} />
          </button>

          {hasPipeline && (
            <button
              type="button"
              onClick={() => onNavigateTab('opportunities', { status: 'em_andamento' })}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer active:scale-98 transition-all"
            >
              <Kanban size={14} />
              <span>Ver Funil</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid de KPIs Principais (Exibido APENAS se canViewPipeline for TRUE) */}
      {hasPipeline && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Faturado no Período */}
          <div
            onClick={() => onNavigateTab('opportunities', { status: 'ganha' })}
            className="group relative bg-white border border-slate-200/90 hover:border-emerald-300 hover:shadow-md rounded-2xl p-4 shadow-2xs flex flex-col justify-between cursor-pointer transition-all active:scale-[0.99]"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider group-hover:text-emerald-700 transition-colors">
                {isOnlyPersonal ? 'Meu Faturado' : 'Faturado'} ({periodLabel})
              </span>
              <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 group-hover:scale-105 transition-transform">
                <Trophy size={16} />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight group-hover:text-emerald-700 transition-colors">
                {formatCurrency(metrics.wonRevenue)}
              </h3>
              <div className="mt-1 flex items-center justify-between text-[11px]">
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 size={12} /> {metrics.wonCount} fechadas
                </span>
                <span className="text-slate-400 font-medium">
                  Média: {formatCurrency(metrics.wonTicketAverage)}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Pipeline em Aberto */}
          <div
            onClick={() => onNavigateTab('opportunities', { status: 'em_andamento' })}
            className="group relative bg-white border border-slate-200/90 hover:border-sky-300 hover:shadow-md rounded-2xl p-4 shadow-2xs flex flex-col justify-between cursor-pointer transition-all active:scale-[0.99]"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider group-hover:text-sky-700 transition-colors">
                {isOnlyPersonal ? 'Minhas em Aberto' : 'Pipeline em Aberto'}
              </span>
              <div className="h-8 w-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100 group-hover:scale-105 transition-transform">
                <DollarSign size={16} />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight group-hover:text-sky-700 transition-colors">
                {formatCurrency(metrics.pipelineValue)}
              </h3>
              <div className="mt-1 flex items-center justify-between text-[11px]">
                <span className="text-slate-600 font-medium">
                  {metrics.inProcessCount} no funil
                </span>
                <span className="text-slate-400 font-medium">
                  Média: {formatCurrency(metrics.pipelineTicketAverage)}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Previsão Ponderada */}
          <div
            onClick={() => onNavigateTab('opportunities', { status: 'em_andamento' })}
            className="group relative bg-white border border-slate-200/90 hover:border-indigo-300 hover:shadow-md rounded-2xl p-4 shadow-2xs flex flex-col justify-between cursor-pointer transition-all active:scale-[0.99]"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider group-hover:text-indigo-700 transition-colors">
                Previsão (Forecast)
              </span>
              <div className="h-8 w-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 group-hover:scale-105 transition-transform">
                <TrendingUp size={16} />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight group-hover:text-indigo-700 transition-colors">
                {formatCurrency(metrics.forecastValue)}
              </h3>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                Ponderado pela etapa das negociações
              </p>
            </div>
          </div>

          {/* Card 4: Taxa de Conversão */}
          <div
            onClick={() => onNavigateTab('opportunities', { status: 'ganha' })}
            className="group relative bg-white border border-slate-200/90 hover:border-amber-300 hover:shadow-md rounded-2xl p-4 shadow-2xs flex flex-col justify-between cursor-pointer transition-all active:scale-[0.99]"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider group-hover:text-amber-700 transition-colors">
                Taxa de Conversão
              </span>
              <div className="h-8 w-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 group-hover:scale-105 transition-transform">
                <Target size={16} />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight group-hover:text-amber-700 transition-colors">
                {metrics.conversionRate}%
              </h3>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                {metrics.wonCount} ganhas vs. {metrics.lostCount} perdidas
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Seção Central: Funil (se tiver acesso) + Atividades */}
      <div className={`grid grid-cols-1 ${hasPipeline ? 'lg:grid-cols-3' : 'lg:grid-cols-1'} gap-5`}>
        {hasPipeline && (
          <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {isOnlyPersonal ? 'Meu Funil Comercial' : 'Distribuição do Funil Comercial'}
                </h3>
                <p className="text-xs text-slate-400">Passe o mouse para inspecionar os negócios ou clique para abrir no Kanban</p>
              </div>
              <button
                onClick={() => onNavigateTab('opportunities', { status: 'em_andamento' })}
                className="text-xs text-sky-600 font-bold hover:underline inline-flex items-center gap-0.5 cursor-pointer"
              >
                Abrir Kanban <ArrowUpRight size={13} />
              </button>
            </div>

            <div className="space-y-3 flex-1 justify-center flex flex-col">
              {metrics.stagesStats.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-6">Nenhuma oportunidade ativa no momento.</p>
              ) : (
                metrics.stagesStats.map((st) => {
                  const percent =
                    metrics.pipelineValue > 0
                      ? Math.round((st.totalValue / metrics.pipelineValue) * 100)
                      : 0;
                  const isHovered = hoveredStageId === st.id;

                  return (
                    <div
                      key={st.id}
                      onMouseEnter={() => setHoveredStageId(st.id)}
                      onMouseLeave={() => setHoveredStageId(null)}
                      className="relative"
                    >
                      <div
                        onClick={() => onNavigateTab('opportunities', { stageId: st.id, status: 'em_andamento' })}
                        className="p-2.5 rounded-xl border border-transparent hover:border-slate-200 hover:bg-slate-50/90 transition-all cursor-pointer group"
                      >
                        <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: st.color }} />
                            <span className="text-slate-800 group-hover:text-sky-600 transition-colors">
                              {st.name}
                            </span>
                            <span className="text-[11px] text-slate-400 font-normal">
                              ({st.count} {st.count === 1 ? 'negócio' : 'negócios'})
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-900 font-bold">{formatCurrency(st.totalValue)}</span>
                            <ChevronRight size={13} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>

                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.max(percent, 2)}%`,
                              backgroundColor: st.color,
                            }}
                          />
                        </div>
                      </div>

                      {isHovered && st.deals.length > 0 && (
                        <div 
                          onMouseEnter={() => setHoveredStageId(st.id)}
                          onMouseLeave={() => setHoveredStageId(null)}
                          className="absolute left-4 right-4 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-2xl p-3 z-40 animate-in fade-in zoom-in-95 duration-150"
                        >
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs">
                            <div className="flex items-center gap-1.5 font-bold text-slate-900">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: st.color }} />
                              <span>Oportunidades em "{st.name}"</span>
                            </div>
                            <span className="text-[11px] text-slate-400 font-medium">Total: {formatCurrency(st.totalValue)}</span>
                          </div>

                          <div className="max-h-48 overflow-y-auto space-y-1 pt-2 divide-y divide-slate-50">
                            {st.deals.map((deal) => (
                              <div
                                key={deal.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onOpenOpportunityDetail) onOpenOpportunityDetail(deal.id);
                                }}
                                className="pt-1.5 pb-1 flex items-center justify-between text-xs hover:bg-slate-50 px-2 rounded-lg transition-colors cursor-pointer group/item"
                              >
                                <div className="min-w-0 pr-2 flex-1">
                                  <span className="font-semibold text-slate-800 group-hover/item:text-sky-600 block truncate">
                                    {deal.title}
                                  </span>
                                  {deal.contact?.display_name && (
                                    <span className="text-[10px] text-slate-400 truncate block">
                                      {deal.contact.display_name}
                                    </span>
                                  )}
                                </div>
                                <span className="font-bold text-slate-900 text-xs shrink-0">
                                  {formatCurrency(deal.estimated_value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Bloco de Atividades (Sempre visível para todos) */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900">
                {!hasPipeline || isOnlyPersonal ? 'Minhas Atividades' : 'Saúde das Atividades'}
              </h3>
              <button
                onClick={() => onNavigateTab('activities')}
                className="text-xs text-sky-600 font-bold hover:underline inline-flex items-center gap-0.5 cursor-pointer"
              >
                Ver Todas <ArrowUpRight size={13} />
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Passe o mouse para pré-visualizar ou clique para abrir a lista.
            </p>
          </div>

          <div className="space-y-3">
            {/* 1. Tarefas Atrasadas */}
            <div
              onMouseEnter={() => setHoveredActivityType('atrasadas')}
              onMouseLeave={() => setHoveredActivityType(null)}
              className="relative"
            >
              <div
                onClick={() => onNavigateTab('activities', { filter: 'atrasadas' })}
                className="group p-3 bg-rose-50/70 hover:bg-rose-100/70 border border-rose-200/80 rounded-xl flex items-center justify-between transition-all cursor-pointer active:scale-[0.99]"
              >
                <div className="flex items-center gap-2.5 text-xs text-rose-800 font-bold">
                  <AlertTriangle size={16} className="text-rose-600 group-hover:scale-110 transition-transform" />
                  <span>Tarefas Atrasadas</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-black text-rose-700">{metrics.overdueTasksCount}</span>
                  <ChevronRight size={13} className="text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>

              {hoveredActivityType === 'atrasadas' && (
                <div 
                  onMouseEnter={() => setHoveredActivityType('atrasadas')}
                  onMouseLeave={() => setHoveredActivityType(null)}
                  className="absolute left-2 right-2 top-full mt-1 bg-white border border-rose-200 rounded-2xl shadow-2xl p-3 z-40 animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-rose-700">
                      <AlertTriangle size={13} />
                      <span>Tarefas com Prazo Expirado</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-semibold">{metrics.overdueTasksCount} pendências</span>
                  </div>

                  <div className="max-h-44 overflow-y-auto space-y-1.5 pt-2">
                    {metrics.overdueTasksList.length === 0 ? (
                      <p className="text-xs text-emerald-600 font-medium italic text-center py-2">
                        🎉 Nenhuma tarefa atrasada no momento!
                      </p>
                    ) : (
                      metrics.overdueTasksList.map((act) => (
                        <div
                          key={act.id}
                          onClick={() => onNavigateTab('activities', { filter: 'atrasadas' })}
                          className="flex items-center justify-between text-xs p-1.5 rounded-lg hover:bg-rose-50/50 transition-colors cursor-pointer"
                        >
                          <span className="font-semibold text-slate-800 truncate pr-2 flex-1">
                            {act.title}
                          </span>
                          <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100 shrink-0 flex items-center gap-1">
                            <Calendar size={10} /> {formatDate(act.due_date)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Pendentes */}
            <div
              onMouseEnter={() => setHoveredActivityType('pendentes')}
              onMouseLeave={() => setHoveredActivityType(null)}
              className="relative"
            >
              <div
                onClick={() => onNavigateTab('activities', { filter: 'pendentes' })}
                className="group p-3 bg-amber-50/70 hover:bg-amber-100/70 border border-amber-200/80 rounded-xl flex items-center justify-between transition-all cursor-pointer active:scale-[0.99]"
              >
                <div className="flex items-center gap-2.5 text-xs text-amber-800 font-bold">
                  <Clock size={16} className="text-amber-600 group-hover:scale-110 transition-transform" />
                  <span>Pendentes no Período</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-black text-amber-700">{metrics.pendingTasksCount}</span>
                  <ChevronRight size={13} className="text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>

              {hoveredActivityType === 'pendentes' && (
                <div 
                  onMouseEnter={() => setHoveredActivityType('pendentes')}
                  onMouseLeave={() => setHoveredActivityType(null)}
                  className="absolute left-2 right-2 top-full mt-1 bg-white border border-amber-200 rounded-2xl shadow-2xl p-3 z-40 animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-amber-800">
                      <Clock size={13} />
                      <span>Tarefas Pendentes ({periodLabel})</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-semibold">{metrics.pendingTasksCount} tarefas</span>
                  </div>

                  <div className="max-h-44 overflow-y-auto space-y-1.5 pt-2">
                    {metrics.pendingTasksList.length === 0 ? (
                      <p className="text-xs text-slate-400 italic text-center py-2">
                        Nenhuma tarefa pendente na lista.
                      </p>
                    ) : (
                      metrics.pendingTasksList.map((act) => (
                        <div
                          key={act.id}
                          onClick={() => onNavigateTab('activities', { filter: 'pendentes' })}
                          className="flex items-center justify-between text-xs p-1.5 rounded-lg hover:bg-amber-50/50 transition-colors cursor-pointer"
                        >
                          <span className="font-semibold text-slate-800 truncate pr-2 flex-1">
                            {act.title}
                          </span>
                          <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1">
                            <Calendar size={10} /> {formatDate(act.due_date)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 3. Concluídas */}
            <div
              onMouseEnter={() => setHoveredActivityType('concluidas')}
              onMouseLeave={() => setHoveredActivityType(null)}
              className="relative"
            >
              <div
                onClick={() => onNavigateTab('activities', { filter: 'concluidas' })}
                className="group p-3 bg-emerald-50/70 hover:bg-emerald-100/70 border border-emerald-200/80 rounded-xl flex items-center justify-between transition-all cursor-pointer active:scale-[0.99]"
              >
                <div className="flex items-center gap-2.5 text-xs text-emerald-800 font-bold">
                  <CheckCircle2 size={16} className="text-emerald-600 group-hover:scale-110 transition-transform" />
                  <span>Atividades Concluídas</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-black text-emerald-700">{metrics.completedTasksCount}</span>
                  <ChevronRight size={13} className="text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>

              {hoveredActivityType === 'concluidas' && (
                <div 
                  onMouseEnter={() => setHoveredActivityType('concluidas')}
                  onMouseLeave={() => setHoveredActivityType(null)}
                  className="absolute left-2 right-2 bottom-full mb-1 bg-white border border-emerald-200 rounded-2xl shadow-2xl p-3 z-40 animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-700">
                      <CheckCircle2 size={13} />
                      <span>Tarefas Finalizadas ({periodLabel})</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-semibold">{metrics.completedTasksCount} concluídas</span>
                  </div>

                  <div className="max-h-44 overflow-y-auto space-y-1.5 pt-2">
                    {metrics.completedTasksList.length === 0 ? (
                      <p className="text-xs text-slate-400 italic text-center py-2">
                        Nenhuma atividade concluída no período.
                      </p>
                    ) : (
                      metrics.completedTasksList.map((act) => (
                        <div
                          key={act.id}
                          onClick={() => onNavigateTab('activities', { filter: 'concluidas' })}
                          className="flex items-center justify-between text-xs p-1.5 rounded-lg hover:bg-emerald-50/50 transition-colors cursor-pointer"
                        >
                          <span className="font-semibold text-slate-700 truncate pr-2 flex-1 line-through text-slate-500">
                            {act.title}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 shrink-0">
                            Pronto
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={() => onNavigateTab('activities')}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            >
              Organizar agenda do dia →
            </button>
          </div>
        </div>
      </div>

      {/* Top 5 Negociações (Somente visível com canViewPipeline) */}
      {hasPipeline && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {isOnlyPersonal ? 'Minhas Maiores Negociações em Andamento' : 'Maiores Negociações em Andamento'}
              </h3>
              <p className="text-xs text-slate-400">Oportunidades com maior impacto financeiro no pipeline ativo</p>
            </div>
            <button
              onClick={() => onNavigateTab('opportunities', { status: 'em_andamento' })}
              className="text-xs text-sky-600 font-bold hover:underline cursor-pointer"
            >
              Ver todas no funil
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {metrics.topOpportunities.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">Nenhuma oportunidade em andamento.</p>
            ) : (
              metrics.topOpportunities.map((op) => {
                const stage = stages.find((s) => s.id === op.stage_id);
                return (
                  <div
                    key={op.id}
                    onClick={() => onOpenOpportunityDetail && onOpenOpportunityDetail(op.id)}
                    className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 px-2 rounded-xl transition-all cursor-pointer group"
                  >
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-sky-600 transition-colors truncate">
                        {op.title}
                      </h4>
                      {op.contact && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                          {op.contact.type === 'company' ? (
                            <Building2 size={12} className="text-slate-400 shrink-0" />
                          ) : (
                            <User size={12} className="text-slate-400 shrink-0" />
                          )}
                          <span className="truncate">{op.contact.display_name}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-4 shrink-0 text-right">
                      {stage && (
                        <span
                          className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border"
                          style={{
                            backgroundColor: `${stage.color}15`,
                            color: stage.color,
                            borderColor: `${stage.color}40`,
                          }}
                        >
                          {stage.name}
                        </span>
                      )}
                      <span className="font-extrabold text-xs sm:text-sm text-slate-900">
                        {formatCurrency(op.estimated_value)}
                      </span>
                      <ArrowUpRight size={14} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};