import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { WorkSettingsModal } from './WorkSettingsModal';
import type { WorkStageConfig } from './WorkSettingsModal';
import { WorkDetailView } from './WorkDetailView';
import { DailyWorkLogModal } from './DailyWorkLogModal';
import {
  Search,
  Filter,
  Plus,
  Building2,
  User,
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  List,
  Kanban as KanbanIcon,
  PauseCircle,
  Lock,
  Loader2,
  BookOpenCheck,
  Briefcase
} from 'lucide-react';

export interface WorkItemData {
  id: string;
  code?: string | null;
  title: string;
  stage: string;
  status: 'em_andamento' | 'concluida' | 'cancelada' | 'pausada';
  progress_percent: number;
  start_date?: string | null;
  estimated_completion_date?: string | null;
  actual_completion_date?: string | null;
  updated_at?: string;
  assigned_to?: string | null;
  contact_id?: string | null;
  measurement_type?: 'por_subitem' | 'por_item' | 'sem_medicao';
  opportunity?: {
    id: string;
    assigned_to?: string | null;
  } | null;
  contact?: {
    id: string;
    display_name: string;
    type: 'person' | 'company';
  } | null;
  assignee?: {
    id: string;
    full_name: string;
    avatar_url?: string | null;
  } | null;
}

interface WorksViewProps {
  onSelectWork?: (workId: string) => void;
  onOpenContactModal?: (contactId: string) => void;
  onOpenCreateWorkModal?: () => void;
  permissions?: any;
}

export const WorksView: React.FC<WorksViewProps> = ({
  onSelectWork,
  onOpenContactModal,
  onOpenCreateWorkModal,
  permissions: propPermissions
}) => {
  const { user } = useAuth();
  const { permissions: hookPermissions, loading: loadingPerms } = usePermissions();
  const permissions = propPermissions || hookPermissions;

  const currentUserId = user?.id || user?.profile?.id || (user as any)?.user?.id || null;

  const [works, setWorks] = useState<WorkItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null);

  const [activeStatusTab, setActiveStatusTab] = useState<'em_andamento' | 'concluida' | 'todas'>('em_andamento');
  const [showPausedOnly, setShowPausedOnly] = useState<boolean>(false);

  const [draggedWorkId, setDraggedWorkId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const mouseCoordsRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);

  const [search, setSearch] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterContactType, setFilterContactType] = useState<'all' | 'person' | 'company'>('all');
  const [filterMeasurementType, setFilterMeasurementType] = useState<string>('all');
  const [filterDateRange, setFilterDateRange] = useState<'all' | 'this_month' | 'next_month' | 'overdue'>('all');
  const filterContainerRef = useRef<HTMLDivElement>(null);

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isDailyLogModalOpen, setIsDailyLogModalOpen] = useState(false);
  const [isMobileActionSheetOpen, setIsMobileActionSheetOpen] = useState(false);

  const [workStages, setWorkStages] = useState<WorkStageConfig[]>([]);

  const defaultStages: WorkStageConfig[] = useMemo(() => [
    { id: 'planejamento', name: 'Planejamento', color: '#f59e0b', sort_order: 1 },
    { id: 'execucao', name: 'Em andamento', color: '#0ea5e9', sort_order: 2 },
    { id: 'comissionamento', name: 'Comissionamento e testes', color: '#8b5cf6', sort_order: 3 },
    { id: 'concluida', name: 'Obra Concluída', color: '#10b981', sort_order: 4 }
  ], []);

  const STAGES = useMemo(() => {
    return workStages.length > 0 ? workStages : defaultStages;
  }, [workStages, defaultStages]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterContainerRef.current && !filterContainerRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadWorkStages = useCallback(async () => {
    const companyId = user?.company?.id;
    if (!companyId) return;

    try {
      const { data, error } = await supabase
        .from('work_pipeline_stages')
        .select('*')
        .eq('company_id', companyId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      if (data && data.length > 0) {
        setWorkStages(data);
      } else {
        setWorkStages(defaultStages);
      }
    } catch (err) {
      console.warn('Usando etapas padrão:', err);
      setWorkStages(defaultStages);
    }
  }, [user?.company?.id, defaultStages]);

  const loadWorksData = useCallback(async () => {
    try {
      setLoading(true);
      const companyId = user?.company?.id;
      if (!companyId) return;

      const isMasterAdmin = Boolean(permissions?.isOwnerOrAdmin);

      const { data, error } = await supabase
        .from('works')
        .select(`
          id,
          code,
          title,
          stage,
          status,
          progress_percent,
          start_date,
          estimated_completion_date,
          actual_completion_date,
          updated_at,
          assigned_to,
          contact_id,
          measurement_type,
          opportunity:opportunities!opportunity_id (id, assigned_to),
          contact:contacts!contact_id (id, display_name, type),
          assignee:profiles!assigned_to (id, full_name, avatar_url)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      let userAllocatedWorkIds = new Set<string>();
      if (!isMasterAdmin && currentUserId) {
        const { data: memberRecords } = await supabase
          .from('work_members')
          .select('work_id')
          .eq('user_id', currentUserId);

        userAllocatedWorkIds = new Set((memberRecords || []).map((m: any) => m.work_id));
      }

      const formattedWorks: WorkItemData[] = (data || [])
        .map((w: any) => {
          const opp = Array.isArray(w.opportunity) ? w.opportunity[0] : w.opportunity;
          return {
            id: w.id,
            code: w.code || null,
            title: w.title,
            stage: w.stage || 'planejamento',
            status: w.status || 'em_andamento',
            progress_percent: w.progress_percent || 0,
            start_date: w.start_date,
            estimated_completion_date: w.estimated_completion_date,
            actual_completion_date: w.actual_completion_date,
            updated_at: w.updated_at,
            assigned_to: w.assigned_to,
            contact_id: w.contact_id,
            measurement_type: w.measurement_type || 'por_subitem',
            opportunity: opp || null,
            contact: Array.isArray(w.contact) ? w.contact[0] : w.contact,
            assignee: Array.isArray(w.assignee) ? w.assignee[0] : w.assignee
          };
        })
        .filter((w: WorkItemData) => {
          if (isMasterAdmin) return true;
          if (!currentUserId) return false;

          const isTechnicalResponsible = w.assigned_to === currentUserId;
          const isCommercialResponsible = w.opportunity?.assigned_to === currentUserId;
          const isAllocatedWorker = userAllocatedWorkIds.has(w.id);

          return isTechnicalResponsible || isCommercialResponsible || isAllocatedWorker;
        });

      setWorks(formattedWorks);
    } catch (err) {
      console.error('Erro ao carregar dados das obras:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.company?.id, permissions?.isOwnerOrAdmin, currentUserId]);

  useEffect(() => {
    if (permissions?.canViewWorks) {
      loadWorksData();
      loadWorkStages();
    }
  }, [loadWorksData, loadWorkStages, permissions?.canViewWorks]);

  const countInProcess = works.filter(w => w.status !== 'pausada' && w.stage !== 'concluida' && w.progress_percent < 100).length;
  const countWon = works.filter(w => w.stage === 'concluida' || w.progress_percent >= 100).length;
  const countPaused = works.filter(w => w.status === 'pausada').length;

  const handleDragStart = (e: React.DragEvent, workId: string) => {
    if (showPausedOnly || !permissions?.canEditWorkDetails) return;
    isDraggingRef.current = true;
    e.dataTransfer.setData('text/plain', workId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedWorkId(workId);
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    if (showPausedOnly || !permissions?.canEditWorkDetails) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverStageId !== stageId) {
      setDragOverStageId(stageId);
    }
  };

  const handleDragLeave = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    if (dragOverStageId === stageId) {
      setDragOverStageId(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetStageId: string) => {
    e.preventDefault();
    if (showPausedOnly || !permissions?.canEditWorkDetails) return;

    const workId = e.dataTransfer.getData('text/plain') || draggedWorkId;
    setDragOverStageId(null);
    setDraggedWorkId(null);

    setTimeout(() => {
      isDraggingRef.current = false;
    }, 120);

    if (!workId) return;

    const currentWork = works.find(w => w.id === workId);
    if (!currentWork || currentWork.stage === targetStageId) return;

    const previousStage = currentWork.stage;
    const isNowDone = targetStageId === 'concluida';

    setWorks(prev =>
      prev.map(w => w.id === workId ? {
        ...w,
        stage: targetStageId,
        progress_percent: isNowDone ? 100 : w.progress_percent,
        updated_at: new Date().toISOString()
      } : w)
    );

    try {
      const { error } = await supabase
        .from('works')
        .update({
          stage: targetStageId,
          progress_percent: isNowDone ? 100 : currentWork.progress_percent,
          actual_completion_date: isNowDone ? new Date().toISOString().split('T')[0] : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', workId);

      if (error) throw error;
    } catch (err) {
      console.error('Erro ao mover obra de etapa:', err);
      setWorks(prev =>
        prev.map(w => w.id === workId ? { ...w, stage: previousStage } : w)
      );
    }
  };

  const handleDragEnd = () => {
    setDraggedWorkId(null);
    setDragOverStageId(null);
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 120);
  };

  const handleCardClick = (e: React.MouseEvent, workId: string) => {
    if (isDraggingRef.current) return;
    const deltaX = Math.abs(e.clientX - mouseCoordsRef.current.x);
    const deltaY = Math.abs(e.clientY - mouseCoordsRef.current.y);
    if (mouseCoordsRef.current.x > 0 && (deltaX > 12 || deltaY > 12)) return;

    setSelectedWorkId(workId);
    onSelectWork?.(workId);
  };

  const getDaysInStage = (updatedAt?: string) => {
    if (!updatedAt) return null;
    const diffTime = Math.abs(Date.now() - new Date(updatedAt).getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  const filteredWorks = works.filter((w) => {
    if (showPausedOnly) {
      if (w.status !== 'pausada') return false;
    } else {
      if (activeStatusTab === 'em_andamento') {
        if (w.stage === 'concluida' || w.progress_percent >= 100 || w.status === 'pausada') return false;
      } else if (activeStatusTab === 'concluida') {
        if (w.stage !== 'concluida' && w.progress_percent < 100) return false;
      }
    }

    const q = search.toLowerCase();
    const matchesSearch =
      w.title.toLowerCase().includes(q) ||
      (w.code && w.code.toLowerCase().includes(q)) ||
      (w.contact?.display_name && w.contact.display_name.toLowerCase().includes(q));

    const matchesContactType =
      filterContactType === 'all' || w.contact?.type === filterContactType;

    const matchesMeasurement =
      filterMeasurementType === 'all' || w.measurement_type === filterMeasurementType;

    let matchesDate = true;
    if (filterDateRange !== 'all') {
      if (!w.estimated_completion_date) {
        matchesDate = false;
      } else {
        const closeDate = new Date(w.estimated_completion_date);
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        if (filterDateRange === 'overdue') {
          matchesDate = closeDate < now && w.stage !== 'concluida';
        } else if (filterDateRange === 'this_month') {
          matchesDate = closeDate.getFullYear() === currentYear && closeDate.getMonth() === currentMonth;
        } else if (filterDateRange === 'next_month') {
          const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
          const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
          matchesDate = closeDate.getFullYear() === nextYear && closeDate.getMonth() === nextMonth;
        }
      }
    }

    return matchesSearch && matchesContactType && matchesMeasurement && matchesDate;
  });

  const activeFiltersCount =
    (filterContactType !== 'all' ? 1 : 0) +
    (filterMeasurementType !== 'all' ? 1 : 0) +
    (filterDateRange !== 'all' ? 1 : 0);

  const clearFilters = () => {
    setFilterContactType('all');
    setFilterMeasurementType('all');
    setFilterDateRange('all');
  };

  const renderFilterFields = () => (
    <>
      <div>
        <label className="block font-semibold text-slate-700 mb-1">Perfil do Contato</label>
        <div className="grid grid-cols-3 gap-1 bg-slate-50 p-1 border border-slate-200 rounded-xl text-center">
          {(['all', 'person', 'company'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFilterContactType(type)}
              className={`py-1.5 rounded-lg font-medium transition-all text-xs cursor-pointer ${
                filterContactType === type ? 'bg-white shadow-xs text-slate-800 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {type === 'all' ? 'Todos' : type === 'person' ? 'PF' : 'PJ'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block font-semibold text-slate-700 mb-1">Tipo de Medição</label>
        <select
          value={filterMeasurementType}
          onChange={(e) => setFilterMeasurementType(e.target.value)}
          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500 cursor-pointer text-xs"
        >
          <option value="all">Todas as Medições</option>
          <option value="por_subitem">Medição nos Subitens</option>
          <option value="por_item">Medição nos Itens</option>
          <option value="sem_medicao">Sem Medição Financeira</option>
        </select>
      </div>

      <div>
        <label className="block font-semibold text-slate-700 mb-1">Previsão de Término</label>
        <select
          value={filterDateRange}
          onChange={(e) => setFilterDateRange(e.target.value as any)}
          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500 cursor-pointer text-xs"
        >
          <option value="all">Qualquer Data</option>
          <option value="this_month">Este Mês</option>
          <option value="next_month">Próximo Mês</option>
          <option value="overdue">Cronograma Vencido (Atrasadas)</option>
        </select>
      </div>
    </>
  );

  if (!loadingPerms && !permissions?.canViewWorks) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3 border border-slate-200">
          <Lock size={26} />
        </div>
        <h3 className="text-base font-bold text-slate-800">Acesso Restrito ao Módulo de Obras</h3>
        <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
          Seu perfil de acesso não possui permissão para visualizar o painel operacional de obras.
        </p>
      </div>
    );
  }

  if (selectedWorkId) {
    return (
      <WorkDetailView
        workId={selectedWorkId}
        onBack={() => {
          setSelectedWorkId(null);
          loadWorksData();
        }}
        onOpenContactModal={onOpenContactModal}
        onUpdated={loadWorksData}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative p-3 sm:p-6 lg:p-8 box-border space-y-3">
      {/* 1. TOPO DA TELA */}
      <div className="flex items-center justify-between gap-3 pb-1 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Execução de Obras
            </h1>
            {showPausedOnly && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 animate-in fade-in flex items-center gap-1">
                <PauseCircle size={12} /> Obras Pausadas
              </span>
            )}
          </div>
          <p className="hidden sm:block text-xs sm:text-sm text-slate-500 mt-0.5">
            {showPausedOnly
              ? 'Exibindo obras que foram suspensas temporariamente.'
              : 'Acompanhamento operacional e controle de avanço de cada projeto em campo.'}
          </p>
        </div>

        {permissions?.canCreateWorks && (
          <div className="hidden md:flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenCreateWorkModal ? onOpenCreateWorkModal() : alert('Abrir modal de criação')}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-all cursor-pointer active:scale-98 shrink-0"
            >
              <Plus size={16} />
              <span>Nova Obra</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. BARRA DE CONTROLES */}
      <div className="bg-white p-2 sm:p-2.5 rounded-2xl border border-slate-200/80 shadow-2xs mb-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative flex-1 min-w-0">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título, código ou contato..."
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all text-slate-800 placeholder-slate-400"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 sm:px-2.5 sm:py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                viewMode === 'kanban' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Visualização em Kanban"
            >
              <KanbanIcon size={14} />
              <span className="hidden sm:inline">Kanban</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 sm:px-2.5 sm:py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                viewMode === 'list' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Visualização em Lista"
            >
              <List size={14} />
              <span className="hidden sm:inline">Lista</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 justify-between sm:justify-end shrink-0">
          <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 shrink-0 overflow-x-auto no-scrollbar flex-1 sm:flex-initial justify-between sm:justify-start">
            <button
              type="button"
              disabled={showPausedOnly}
              onClick={() => {
                setActiveStatusTab('em_andamento');
                setShowPausedOnly(false);
              }}
              className={`flex items-center justify-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-40 shrink-0 ${
                !showPausedOnly && activeStatusTab === 'em_andamento'
                  ? 'bg-white text-sky-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock size={15} className={!showPausedOnly && activeStatusTab === 'em_andamento' ? 'text-sky-600' : 'text-slate-400'} />
              <span className="hidden sm:inline">Em Andamento</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                !showPausedOnly && activeStatusTab === 'em_andamento' ? 'bg-sky-50 text-sky-700 font-bold' : 'bg-slate-200 text-slate-600'
              }`}>
                {countInProcess}
              </span>
            </button>

            <button
              type="button"
              disabled={showPausedOnly}
              onClick={() => {
                setActiveStatusTab('concluida');
                setShowPausedOnly(false);
              }}
              className={`flex items-center justify-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-40 shrink-0 ${
                !showPausedOnly && activeStatusTab === 'concluida'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 size={15} className={!showPausedOnly && activeStatusTab === 'concluida' ? 'text-emerald-600' : 'text-slate-400'} />
              <span className="hidden sm:inline">Concluídas</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                !showPausedOnly && activeStatusTab === 'concluida' ? 'bg-emerald-50 text-emerald-700 font-bold' : 'bg-slate-200 text-slate-600'
              }`}>
                {countWon}
              </span>
            </button>

            <button
              type="button"
              disabled={showPausedOnly}
              onClick={() => {
                setActiveStatusTab('todas');
                setShowPausedOnly(false);
              }}
              className={`flex items-center justify-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-40 shrink-0 ${
                !showPausedOnly && activeStatusTab === 'todas'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Briefcase size={15} className={!showPausedOnly && activeStatusTab === 'todas' ? 'text-slate-800' : 'text-slate-400'} />
              <span className="hidden sm:inline">Todas</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-600">
                {works.length}
              </span>
            </button>

            <div className="h-4 w-px bg-slate-300 mx-0.5 shrink-0" />

            <button
              type="button"
              onClick={() => setShowPausedOnly(!showPausedOnly)}
              className={`flex items-center justify-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                showPausedOnly
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-amber-700 hover:bg-amber-50'
              }`}
            >
              <PauseCircle size={15} className={showPausedOnly ? 'text-white' : 'text-amber-600'} />
              <span className="hidden sm:inline">{showPausedOnly ? 'Sair' : 'Pausadas'}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                showPausedOnly ? 'bg-amber-700 text-white font-bold' : 'bg-amber-100 text-amber-800'
              }`}>
                {countPaused}
              </span>
            </button>
          </div>

          <div className="relative shrink-0" ref={filterContainerRef}>
            <button
              type="button"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
                activeFiltersCount > 0
                  ? 'bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
              title="Filtros avançados"
            >
              <Filter size={14} className={activeFiltersCount > 0 ? 'text-sky-600' : 'text-slate-400'} />
              <span className="hidden sm:inline">Filtros</span>
              {activeFiltersCount > 0 && (
                <span className="h-4 w-4 rounded-full bg-sky-600 text-white text-[10px] flex items-center justify-center font-bold">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {isFilterOpen && (
              <div className="hidden md:block absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 z-50 animate-in fade-in zoom-in-95 duration-100 space-y-3 text-xs text-left">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Filtros de Obras</span>
                  <div className="flex items-center gap-2">
                    {activeFiltersCount > 0 && (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="text-[11px] text-sky-600 hover:underline font-semibold cursor-pointer"
                      >
                        Limpar
                      </button>
                    )}
                    <button onClick={() => setIsFilterOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                      <X size={15} />
                    </button>
                  </div>
                </div>

                {renderFilterFields()}

                <button
                  type="button"
                  onClick={() => setIsFilterOpen(false)}
                  className="w-full py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {isFilterOpen && (
        <div className="md:hidden fixed inset-0 z-[150] flex flex-col justify-end bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="absolute inset-0" onClick={() => setIsFilterOpen(false)} />
          <div className="relative bg-white rounded-t-3xl p-5 space-y-3.5 animate-in slide-in-from-bottom duration-200 max-h-[85vh] overflow-y-auto border-t border-slate-200 text-xs">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-1" />
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="font-bold text-slate-900 text-sm">Filtros de Obras</span>
              <div className="flex items-center gap-2">
                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-xs text-sky-600 hover:underline font-semibold cursor-pointer"
                  >
                    Limpar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {renderFilterFields()}

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsFilterOpen(false)}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs transition"
              >
                Aplicar Filtros
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. VISUALIZAÇÃO KANBAN OU LISTA */}
      {viewMode === 'kanban' ? (
        <div className="flex-1 min-h-0 overflow-x-auto pb-3 flex gap-3.5 select-none snap-x snap-mandatory no-scrollbar">
          {STAGES.map((stage) => {
            const stageWorks = filteredWorks.filter((w) => w.stage === stage.id);
            const isOver = dragOverStageId === stage.id;
            const stageColor = stage.color;

            return (
              <div
                key={stage.id}
                id={`kanban-stage-${stage.id}`}
                onDragOver={(e) => handleDragOver(e, stage.id)}
                onDragLeave={(e) => handleDragLeave(e, stage.id)}
                onDrop={(e) => handleDrop(e, stage.id)}
                className={`w-[85vw] sm:w-80 shrink-0 h-full flex flex-col bg-slate-100/70 border rounded-2xl overflow-hidden transition-all duration-300 snap-center ${
                  isOver 
                    ? 'border-sky-400 bg-sky-50/50 ring-2 ring-sky-300 ring-inset' 
                    : 'border-slate-200/90'
                }`}
              >
                <div 
                  className="p-3 bg-white border-b border-slate-200/80 shrink-0"
                  style={{ borderTop: `3px solid ${stageColor}` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span 
                        className="w-2.5 h-2.5 rounded-full shrink-0" 
                        style={{ backgroundColor: stageColor }}
                      />
                      <h3 className="font-bold text-xs text-slate-800 truncate">{stage.name}</h3>
                    </div>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-full text-[11px] font-bold">
                      {stageWorks.length}
                    </span>
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2.5 no-scrollbar">
                  {loading ? (
                    <div className="h-28 flex items-center justify-center text-xs text-slate-400">
                      <Loader2 size={16} className="animate-spin text-sky-600 mr-2" />
                      Carregando...
                    </div>
                  ) : stageWorks.length === 0 ? (
                    <div className={`h-28 flex items-center justify-center border-2 border-dashed rounded-xl text-xs italic transition-colors ${
                      isOver 
                        ? 'border-sky-300 text-sky-600 bg-sky-50/50 font-semibold' 
                        : 'border-slate-200 text-slate-400'
                    }`}>
                      {isOver ? 'Solte para mover aqui' : 'Nenhuma obra'}
                    </div>
                  ) : (
                    stageWorks.map((work) => {
                      const isDraggingThis = draggedWorkId === work.id;
                      const daysInStage = getDaysInStage(work.updated_at);
                      const isStale = daysInStage !== null && daysInStage >= 7 && work.stage !== 'concluida';
                      const canDrag = !showPausedOnly && permissions?.canEditWorkDetails;

                      return (
                        <div
                          key={work.id}
                          draggable={canDrag}
                          onDragStart={(e) => handleDragStart(e, work.id)}
                          onDragEnd={handleDragEnd}
                          onMouseDown={(e) => {
                            mouseCoordsRef.current = { x: e.clientX, y: e.clientY };
                          }}
                          onClick={(e) => handleCardClick(e, work.id)}
                          className={`bg-white p-3.5 rounded-xl border transition-all group relative select-none ${
                            canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                          } ${
                            isDraggingThis 
                              ? 'opacity-40 border-dashed border-sky-400 scale-95 shadow-none' 
                              : 'border-slate-200/90 shadow-2xs hover:shadow-md hover:border-sky-300 active:scale-[0.99]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="flex-1 min-w-0 space-y-0.5">
                              {work.code && (
                                <span className="font-mono text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200/70 px-1.5 py-0.2 rounded inline-block">
                                  {work.code}
                                </span>
                              )}
                              <h4 className="font-bold text-slate-900 text-xs sm:text-sm group-hover:text-sky-600 transition-colors line-clamp-2">
                                {work.title}
                              </h4>
                            </div>

                            <div className="shrink-0 flex items-center gap-1">
                              {isStale && (
                                <div 
                                  className="px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold flex items-center gap-0.5 shadow-2xs whitespace-nowrap"
                                  title={`Sem movimentação há ${daysInStage} dias`}
                                >
                                  <AlertCircle size={10} /> {daysInStage}d parado
                                </div>
                              )}
                              {work.stage === 'concluida' && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Concluída
                                </span>
                              )}
                              {work.status === 'pausada' && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-0.5">
                                  <PauseCircle size={10} /> Pausada
                                </span>
                              )}
                            </div>
                          </div>

                          {work.contact && (
                            <div 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onOpenContactModal && work.contact?.id) {
                                  onOpenContactModal(work.contact.id);
                                }
                              }}
                              title="Ver detalhes do contato"
                              className="inline-flex items-center gap-1.5 mt-1.5 text-xs text-slate-500 hover:text-sky-600 cursor-pointer transition-colors max-w-full"
                            >
                              {work.contact.type === 'company' ? (
                                <Building2 size={13} className="text-slate-400 shrink-0" />
                              ) : (
                                <User size={13} className="text-slate-400 shrink-0" />
                              )}
                              <span className="truncate hover:underline">{work.contact.display_name}</span>
                            </div>
                          )}

                          <div className="mt-2.5 space-y-1">
                            <div className="flex justify-between text-[10px] font-bold text-slate-500">
                              <span>Progresso</span>
                              <span className="text-sky-600 font-bold">{Math.round(work.progress_percent || 0)}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-1.5 rounded-full transition-all duration-300 ${
                                  work.progress_percent >= 100 ? 'bg-emerald-500' : 'bg-sky-500'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(0, work.progress_percent || 0))}%` }}
                              />
                            </div>
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 text-slate-500 font-medium text-[11px]">
                              <Calendar size={13} className="text-slate-400 shrink-0" />
                              <span>
                                {work.estimated_completion_date
                                  ? new Date(work.estimated_completion_date + 'T00:00:00').toLocaleDateString('pt-BR')
                                  : 'Sem previsão'}
                              </span>
                            </div>

                            {work.assignee && (
                              <div 
                                className="h-5 w-5 rounded-full overflow-hidden bg-sky-100 border border-slate-200 text-sky-700 flex items-center justify-center font-bold text-[9px] shrink-0"
                                title={`Responsável: ${work.assignee.full_name}`}
                              >
                                {work.assignee.avatar_url ? (
                                  <img src={work.assignee.avatar_url} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  work.assignee.full_name.charAt(0).toUpperCase()
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs overflow-x-auto flex-1 min-h-0">
          <table className="w-full text-left text-xs text-slate-600 min-w-[650px]">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Código / Obra</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Etapa</th>
                <th className="py-3 px-4">Avanço Físico</th>
                <th className="py-3 px-4">Previsão</th>
                <th className="py-3 px-4">Responsável</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Loader2 size={18} className="animate-spin text-sky-600 mx-auto mb-1.5" />
                    Carregando obras...
                  </td>
                </tr>
              ) : filteredWorks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Nenhuma obra encontrada.
                  </td>
                </tr>
              ) : (
                filteredWorks.map(work => (
                  <tr
                    key={work.id}
                    onClick={() => {
                      setSelectedWorkId(work.id);
                      onSelectWork?.(work.id);
                    }}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {work.code && (
                          <span className="font-mono text-[10px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-100">
                            {work.code}
                          </span>
                        )}
                        <span className="font-bold text-slate-900">{work.title}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {work.contact?.display_name || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="capitalize px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                        {work.stage}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="w-32 flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-sky-500 h-1.5 rounded-full"
                            style={{ width: `${Math.min(100, Math.max(0, work.progress_percent || 0))}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-slate-700">
                          {Math.round(work.progress_percent || 0)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {work.estimated_completion_date
                        ? new Date(work.estimated_completion_date + 'T00:00:00').toLocaleDateString('pt-BR')
                        : '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {work.assignee?.full_name || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {permissions?.canCompleteWorkTasks && !selectedWorkId && (
        <button
          type="button"
          onClick={() => setIsDailyLogModalOpen(true)}
          className="hidden md:flex fixed bottom-8 right-8 z-[90] items-center gap-2.5 px-6 py-4 bg-sky-600 hover:bg-sky-500 text-white rounded-full shadow-[0_10px_40px_rgba(2,132,199,0.4)] transition-all hover:-translate-y-1 hover:shadow-[0_15px_50px_rgba(2,132,199,0.5)] cursor-pointer font-bold group"
          title="Lançar Diário de Obra"
        >
          <BookOpenCheck size={22} className="group-hover:scale-110 transition-transform" />
          <span className="text-sm tracking-wide">Diário de Obra</span>
        </button>
      )}

      {!selectedWorkId && (
        <button
          type="button"
          onClick={() => setIsMobileActionSheetOpen(true)}
          className="md:hidden fixed bottom-6 right-6 z-40 w-14 h-14 bg-sky-600 hover:bg-sky-500 active:scale-95 text-white rounded-full shadow-2xl flex items-center justify-center cursor-pointer transition-all border border-sky-400/40"
          title="Ações de Obras"
        >
          <Plus size={26} strokeWidth={2.5} />
        </button>
      )}

      {isMobileActionSheetOpen && (
        <div className="md:hidden fixed inset-0 z-[150] flex flex-col justify-end bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="absolute inset-0" onClick={() => setIsMobileActionSheetOpen(false)} />
          
          <div className="relative bg-white rounded-t-3xl p-5 space-y-3 animate-in slide-in-from-bottom duration-200 border-t border-slate-200">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-2" />
            
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
              Ações de Obras
            </h3>

            <div className="space-y-2 pt-1">
              {permissions?.canCreateWorks && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileActionSheetOpen(false);
                    if (onOpenCreateWorkModal) onOpenCreateWorkModal();
                  }}
                  className="w-full p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center gap-3 text-slate-800 font-semibold text-xs transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                    <Plus size={18} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-slate-900">Nova Obra</p>
                    <p className="text-[11px] text-slate-500 font-normal">Cadastrar nova obra no sistema</p>
                  </div>
                </button>
              )}

              {permissions?.canCompleteWorkTasks && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileActionSheetOpen(false);
                    setIsDailyLogModalOpen(true);
                  }}
                  className="w-full p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center gap-3 text-slate-800 font-semibold text-xs transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                    <BookOpenCheck size={18} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-slate-900">Diário de Obra</p>
                    <p className="text-[11px] text-slate-500 font-normal">Lançar ou consultar relatórios de campo</p>
                  </div>
                </button>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsMobileActionSheetOpen(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {permissions?.canCustomizeSystem && (
        <WorkSettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          onStagesUpdated={loadWorkStages}
        />
      )}

      <DailyWorkLogModal
        isOpen={isDailyLogModalOpen}
        onClose={() => setIsDailyLogModalOpen(false)}
        onSaved={loadWorksData}
      />
    </div>
  );
};

export default WorksView;