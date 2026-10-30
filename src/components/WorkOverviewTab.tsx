import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  Loader2,
  ArrowRight,
  CheckSquare,
  DollarSign,
  Layers,
  ChevronRight,
  ShieldAlert,
  Lock
} from 'lucide-react';

interface WorkOverviewTabProps {
  workId: string;
  contractAmount?: number;
  startDate?: string | null;
  targetDate?: string | null;
  initialNotes?: string | null;
  onNavigateTab?: (tab: 'items' | 'schedule' | 'finance') => void;
}

const formatCurrency = (val: number) => {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const WorkOverviewTab: React.FC<WorkOverviewTabProps> = ({
  workId,
  contractAmount = 0,
  startDate,
  targetDate,
  onNavigateTab
}) => {
  const { user } = useAuth();
  const { permissions, loading: loadingPerms } = usePermissions();

  const currentUserId = user?.id || user?.profile?.id || (user as any)?.user?.id || null;

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [workData, setWorkData] = useState<{ assigned_to?: string | null; commercial_owner_id?: string | null } | null>(null);

  // Busca dados de responsáveis da obra caso não venham do pai
  useEffect(() => {
    const fetchWorkResponsibles = async () => {
      try {
        const { data } = await supabase
          .from('works')
          .select('assigned_to, opportunity:opportunities!opportunity_id(assigned_to)')
          .eq('id', workId)
          .maybeSingle();

        if (data) {
          const opp = Array.isArray(data.opportunity) ? data.opportunity[0] : data.opportunity;
          setWorkData({
            assigned_to: data.assigned_to || null,
            commercial_owner_id: opp?.assigned_to || null
          });
        }
      } catch (err) {
        console.warn('Erro ao carregar responsáveis da obra:', err);
      }
    };

    if (workId) fetchWorkResponsibles();
  }, [workId]);

  // REGRA ESTRITA: Visualização de valores em R$
  // Apenas Admin, Financeiro, Responsável Técnico ou Responsável Comercial
  const canSeePrices = useMemo(() => {
    if (permissions.isOwnerOrAdmin) return true;
    if (permissions.canManageWorkFinancial || permissions.canViewWorkFinancial || permissions.canViewWorkPrices) return true;
    if (!currentUserId || !workData) return contractAmount > 0;

    const isTechnicalResponsible = workData.assigned_to === currentUserId;
    const isCommercialResponsible = workData.commercial_owner_id === currentUserId;

    return isTechnicalResponsible || isCommercialResponsible;
  }, [permissions, currentUserId, workData, contractAmount]);

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      const [itemsRes, mRes] = await Promise.all([
        supabase
          .from('work_items')
          .select('*')
          .eq('work_id', workId),
        supabase
          .from('work_measurements')
          .select('*')
          .eq('work_id', workId)
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
    } catch (err) {
      console.error('Erro ao carregar dashboard executivo:', err);
    } finally {
      setLoading(false);
    }
  }, [workId]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Métricas Consolidadas do Cockpit
  const analytics = useMemo(() => {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'concluida').length;
    const blockedTasks = tasks.filter(t => t.status === 'bloqueada');

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

    // 2. Avanço Financeiro Medido
    const totalMeasured = measurements.reduce((acc, m) => acc + (Number(m.total_measured_amount) || 0), 0);
    const balanceToMeasure = Math.max(0, contractAmount - totalMeasured);
    const financialProgress = contractAmount > 0 ? Math.min(100, Math.round((totalMeasured / contractAmount) * 100)) : 0;

    // 3. Tempo de Obra Decorrido
    let timeElapsedPercent = 0;
    let daysRemaining: number | null = null;
    let totalDays = 0;
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (startDate && targetDate) {
      const start = new Date(startDate + 'T00:00:00');
      const target = new Date(targetDate + 'T00:00:00');
      totalDays = Math.max(1, Math.ceil((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      const daysPassed = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      daysRemaining = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      timeElapsedPercent = Math.max(0, Math.min(100, Math.round((daysPassed / totalDays) * 100)));
    } else if (targetDate) {
      const target = new Date(targetDate + 'T00:00:00');
      daysRemaining = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }

    // 4. Prazos e Alertas
    const nowStr = now.toISOString().split('T')[0];
    const delayedTasks = tasks.filter(t => t.status !== 'concluida' && t.due_date && t.due_date < nowStr);
    const upcomingTasks = tasks
      .filter(t => t.status !== 'concluida' && t.due_date)
      .sort((a, b) => (a.due_date > b.due_date ? 1 : -1))
      .slice(0, 5);

    let healthStatus: 'em_dia' | 'atencao' | 'critico' = 'em_dia';
    if (delayedTasks.length > 0 || (daysRemaining !== null && daysRemaining < 0)) {
      healthStatus = 'critico';
    } else if (timeElapsedPercent > physicalProgress + 15) {
      healthStatus = 'atencao';
    }

    // 5. Progresso por Setor
    const locationsMap: Record<string, { total: number; done: number }> = {};
    items.forEach(it => {
      const loc = it.location || 'Canteiro Geral';
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

    // 6. Curva S Estimada
    const curvePoints = [
      { label: 'Sem 1', planned: 15, executed: Math.min(physicalProgress, 20) },
      { label: 'Sem 2', planned: 35, executed: Math.min(physicalProgress, 40) },
      { label: 'Sem 3', planned: 60, executed: Math.min(physicalProgress, 65) },
      { label: 'Sem 4', planned: 85, executed: Math.min(physicalProgress, 85) },
      { label: 'Meta', planned: 100, executed: physicalProgress }
    ];

    return {
      totalTasks,
      completedTasks,
      blockedTasksCount: blockedTasks.length,
      physicalProgress,
      financialProgress,
      totalMeasured,
      balanceToMeasure,
      timeElapsedPercent,
      daysRemaining,
      delayedTasksCount: delayedTasks.length,
      healthStatus,
      upcomingTasks,
      locationsProgress,
      curvePoints
    };
  }, [tasks, items, measurements, contractAmount, startDate, targetDate]);

  if (loading || loadingPerms) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full text-slate-400 text-xs py-20">
        <Loader2 size={24} className="animate-spin text-sky-600 mb-2" />
        <span className="font-semibold text-slate-600">Consolidando visão executiva da obra...</span>
      </div>
    );
  }

  // Trava de Acesso Geral da Obra (Permissão 1)
  if (!permissions.isOwnerOrAdmin && !permissions.canViewWorks) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50/50 rounded-2xl border border-slate-200">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3 border border-slate-200">
          <Lock size={22} />
        </div>
        <h4 className="font-bold text-slate-800 text-sm mb-1">Acesso Restrito</h4>
        <p className="text-xs text-slate-500 max-w-sm">
          Seu perfil não possui permissão para visualizar o cockpit executivo da obra.
        </p>
      </div>
    );
  }

  // Permissões das Abas de Destino
  const canAccessFinancialTab = Boolean(
    permissions.isOwnerOrAdmin ||
    permissions.canManageWorkFinancial ||
    permissions.canViewWorkFinancial
  );

  const canAccessScheduleTab = Boolean(
    permissions.isOwnerOrAdmin ||
    permissions.canManageSchedule ||
    permissions.canViewSchedule
  );

  const canAccessItemsTab = Boolean(
    permissions.isOwnerOrAdmin ||
    permissions.canManageWorkStructure ||
    permissions.canManageWorkItems ||
    permissions.canViewWorks
  );

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12 animate-in fade-in duration-150">
      
      {/* 1. OS 3 SUPER CARDS EXECUTIVOS UNIFICADOS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* CARD 1: PRODUÇÃO & AVANÇO FÍSICO */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider flex items-center gap-1.5">
              <CheckSquare size={14} />
              <span>Avanço Físico Real</span>
            </span>
            <span className="text-sm font-black text-sky-700 font-mono">
              {analytics.physicalProgress}%
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  analytics.physicalProgress >= 100 ? 'bg-emerald-500' : 'bg-sky-500'
                }`}
                style={{ width: `${analytics.physicalProgress}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 font-medium">
              <span>{analytics.completedTasks} de {analytics.totalTasks} tarefas concluídas</span>
              <span>{analytics.totalTasks - analytics.completedTasks} pendentes</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            {analytics.blockedTasksCount > 0 ? (
              <span className="text-rose-600 font-bold flex items-center gap-1 text-[11px]">
                <ShieldAlert size={13} />
                <span>{analytics.blockedTasksCount} com restrição</span>
              </span>
            ) : (
              <span className="text-slate-400 font-medium text-[11px]">Frentes liberadas</span>
            )}
            {canAccessItemsTab && (
              <button
                type="button"
                onClick={() => onNavigateTab?.('items')}
                className="text-sky-600 hover:underline font-bold text-xs flex items-center gap-0.5 cursor-pointer"
              >
                <span>Ver Itens EAP</span>
                <ChevronRight size={13} />
              </button>
            )}
          </div>
        </div>

        {/* CARD 2: SAÚDE DO PRAZO & CRONOGRAMA */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock size={14} className="text-amber-500" />
              <span>Prazo & Cronograma</span>
            </span>
            {analytics.healthStatus === 'critico' ? (
              <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <AlertTriangle size={10} />
                <span>Crítico</span>
              </span>
            ) : analytics.healthStatus === 'atencao' ? (
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

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <strong className="text-slate-900 text-lg font-black font-mono">
                {analytics.daysRemaining !== null ? `${analytics.daysRemaining} dias` : '—'}
              </strong>
              <span className="text-[11px] font-bold text-slate-500">
                {analytics.timeElapsedPercent}% do tempo decorrido
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  analytics.timeElapsedPercent > analytics.physicalProgress ? 'bg-rose-500' : 'bg-amber-500'
                }`}
                style={{ width: `${analytics.timeElapsedPercent}%` }}
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className={`text-[11px] font-bold ${analytics.delayedTasksCount > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
              {analytics.delayedTasksCount > 0 ? `${analytics.delayedTasksCount} tarefas atrasadas` : 'Nenhuma tarefa em atraso'}
            </span>
            {canAccessScheduleTab && (
              <button
                type="button"
                onClick={() => onNavigateTab?.('schedule')}
                className="text-sky-600 hover:underline font-bold text-xs flex items-center gap-0.5 cursor-pointer"
              >
                <span>Ver Cronograma</span>
                <ChevronRight size={13} />
              </button>
            )}
          </div>
        </div>

        {/* CARD 3: BALANÇO FINANCEIRO (COM PROTEÇÃO ESTREITA DE R$) */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign size={14} />
              <span>Balanço do Contrato</span>
            </span>
            {canSeePrices ? (
              <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                {analytics.financialProgress}% medido
              </span>
            ) : (
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 flex items-center gap-1">
                <Lock size={10} /> Restrito
              </span>
            )}
          </div>

          {canSeePrices ? (
            <div className="space-y-1">
              <div className="flex items-baseline justify-between">
                <strong className="text-slate-900 text-lg font-black font-mono">
                  {formatCurrency(contractAmount)}
                </strong>
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                <span>Medido: <strong className="text-emerald-700">{formatCurrency(analytics.totalMeasured)}</strong></span>
                <span>Saldo: <strong className="text-amber-700">{formatCurrency(analytics.balanceToMeasure)}</strong></span>
              </div>
            </div>
          ) : (
            <div className="space-y-1 py-1">
              <span className="text-xs text-slate-400 italic block">
                Valores contratuais visíveis apenas para o financeiro e gestores autorizados.
              </span>
              <div className="flex items-center gap-1 text-[11px] text-slate-500 font-semibold">
                <span>Status de Medição:</span>
                <strong className="text-slate-700">{analytics.financialProgress}% homologado</strong>
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-400 text-[11px]">
              {canSeePrices ? 'Boletins de Medição' : 'Dados Financeiros'}
            </span>
            {canAccessFinancialTab && (
              <button
                type="button"
                onClick={() => onNavigateTab?.('finance')}
                className="text-sky-600 hover:underline font-bold text-xs flex items-center gap-0.5 cursor-pointer"
              >
                <span>Ver Financeiro</span>
                <ChevronRight size={13} />
              </button>
            )}
          </div>
        </div>

      </div>

      {/* 2. GRID PRINCIPAL: SETORES DO CANTEIRO + PRÓXIMAS ENTREGAS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Setores e Pavimentos */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <MapPin size={15} className="text-sky-600" />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Progresso Físico por Local / Pavimento
              </h4>
            </div>
            <span className="text-[10px] font-bold text-slate-400">{analytics.locationsProgress.length} locais</span>
          </div>

          {analytics.locationsProgress.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
              Nenhum local cadastrado nos componentes da obra.
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {analytics.locationsProgress.map((loc, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-800 flex items-center gap-1.5 truncate">
                      <Layers size={13} className="text-slate-400 shrink-0" />
                      <span className="truncate">{loc.location}</span>
                    </span>
                    <span className="text-sky-700 font-extrabold shrink-0">{loc.percent}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
                    <div
                      className={`h-2 rounded-full ${loc.percent >= 100 ? 'bg-emerald-500' : 'bg-sky-500'}`}
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

        {/* Próximas Entregas & Prazos da Semana */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Clock size={15} className="text-sky-600" />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Próximas Entregas & Marcos Imediatos
              </h4>
            </div>
            {canAccessScheduleTab && (
              <button
                type="button"
                onClick={() => onNavigateTab?.('schedule')}
                className="text-[10px] font-bold text-sky-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Ver Cronograma</span>
                <ArrowRight size={11} />
              </button>
            )}
          </div>

          {analytics.upcomingTasks.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
              Nenhuma tarefa pendente com prazo cadastrado para os próximos dias.
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
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
                          {parentItem.title}
                        </span>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`text-[10px] font-bold block font-mono ${isLate ? 'text-rose-700' : 'text-slate-600'}`}>
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

      </div>

      {/* 3. CURVA S DE PRODUÇÃO */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <TrendingUp size={15} className="text-sky-600" />
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Curva S de Evolução (Planejado vs. Realizado)
            </h4>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-bold">
            <span className="flex items-center gap-1 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-slate-300" />
              <span>Planejado</span>
            </span>
            <span className="flex items-center gap-1 text-sky-600">
              <span className="w-2 h-2 rounded-full bg-sky-500" />
              <span>Realizado em Campo</span>
            </span>
          </div>
        </div>

        <div className="h-32 flex items-end justify-between gap-3 pt-4 px-2">
          {analytics.curvePoints.map((pt, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
              <div className="w-full flex items-end justify-center gap-1.5 h-full">
                <div
                  className="w-1/3 bg-slate-200 rounded-t-md transition-all duration-500"
                  style={{ height: `${pt.planned}%` }}
                  title={`Planejado: ${pt.planned}%`}
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
      </div>

    </div>
  );
};

export default WorkOverviewTab;