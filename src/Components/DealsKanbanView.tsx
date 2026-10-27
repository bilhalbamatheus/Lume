import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ContactProfileModal } from './ContactProfileModal';
import { 
  Search, 
  Filter, 
  Plus, 
  ChevronRight, 
  Building2, 
  User, 
  X,
  Snowflake,
  CheckCircle2,
  XCircle,
  Clock,
  Briefcase,
  AlertCircle,
  TrendingUp,
  DollarSign
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';

interface PipelineStage {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  default_probability?: number;
}

interface OpportunityItem {
  id: string;
  code?: string | null;
  title: string;
  stage_id: string;
  status: 'em_andamento' | 'ganha' | 'perdida' | 'congelada';
  estimated_value: number;
  expected_close_date?: string | null;
  service_type?: string | null;
  partner_contact_id?: string | null;
  updated_at?: string;
  assigned_to?: string | null;
  contact?: {
    id: string;
    display_name: string;
    type: 'person' | 'company';
  } | null;
  owner?: {
    id: string;
    full_name: string;
    avatar_url?: string | null;
  } | null;
}

interface DealsKanbanViewProps {
  initialStatus?: 'em_andamento' | 'ganha' | 'perdida' | 'congelada';
  initialStageId?: string;
  onOpenCreateOpportunityModal: () => void;
  onOpenOpportunityDetail: (opportunityId: string) => void;
  onOpenContactModal?: (contactId: string) => void;
  permissions?: any;
}

export const DealsKanbanView: React.FC<DealsKanbanViewProps> = ({
  initialStatus,
  initialStageId,
  onOpenCreateOpportunityModal,
  onOpenOpportunityDetail,
  onOpenContactModal,
  permissions: propPermissions
}) => {
  const { user } = useAuth();
  const { permissions: hookPermissions } = usePermissions();

  // Permissões instantâneas: se vier pelo pai renderiza no frame 0 sem delay de 2 segundos
  const permissions = propPermissions || hookPermissions;

  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; name: string }>>([]);
  const [partnersList, setPartnersList] = useState<Array<{ id: string; name: string }>>([]);
  const [serviceTypesList, setServiceTypesList] = useState<Array<{ id: string; name: string }>>([]);

  const currentUserId = user?.id || (user as any)?.user?.id || (user as any)?.profile?.id;
  const isAdmin = Boolean(permissions?.isOwnerOrAdmin);
  const canManage = Boolean(permissions?.canManageDeals || permissions?.isOwnerOrAdmin);

  // Status
  const [activeStatusTab, setActiveStatusTab] = useState<'em_andamento' | 'ganha' | 'perdida'>(() => {
    if (initialStatus === 'ganha' || initialStatus === 'perdida') return initialStatus;
    return 'em_andamento';
  });
  const [showFrozenOnly, setShowFrozenOnly] = useState<boolean>(initialStatus === 'congelada');

  // Filtros
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterContactType, setFilterContactType] = useState<'all' | 'person' | 'company'>('all');
  const [filterServiceType, setFilterServiceType] = useState<string>('all');
  const [filterPartnerId, setFilterPartnerId] = useState<string>('all');
  const [filterDateRange, setFilterDateRange] = useState<'all' | 'this_month' | 'next_month' | 'overdue'>('all');

  const filterContainerRef = useRef<HTMLDivElement>(null);
  const kanbanContainerRef = useRef<HTMLDivElement>(null);
  const [highlightedStageId, setHighlightedStageId] = useState<string | null>(initialStageId || null);

  // Modal de Contato
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [isContactProfileModalOpen, setIsContactProfileModalOpen] = useState(false);

  // Drag and Drop
  const [draggedOppId, setDraggedOppId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const mouseCoordsRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (initialStatus === 'congelada') {
      setShowFrozenOnly(true);
    } else if (initialStatus === 'ganha' || initialStatus === 'perdida' || initialStatus === 'em_andamento') {
      setShowFrozenOnly(false);
      setActiveStatusTab(initialStatus);
    }
    if (initialStageId) {
      setHighlightedStageId(initialStageId);
    }
  }, [initialStatus, initialStageId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterContainerRef.current && !filterContainerRef.current.contains(e.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadPipelineData = async () => {
    try {
      setLoading(true);
      const companyId = user?.company?.id;
      if (!companyId) return;

      const { data: stagesData, error: stagesError } = await supabase
        .from('commercial_pipeline_stages')
        .select('id, name, color, sort_order, default_probability')
        .eq('company_id', companyId)
        .order('sort_order', { ascending: true });

      if (stagesError) throw stagesError;
      setStages(stagesData || []);

      let query = supabase
        .from('opportunities')
        .select(`
          id,
          code,
          title,
          stage_id,
          status,
          estimated_value,
          expected_close_date,
          service_type,
          partner_contact_id,
          updated_at,
          assigned_to,
          contact:contacts!contact_id (
            id,
            display_name,
            type
          ),
          owner:profiles!assigned_to (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (!isAdmin && currentUserId) {
        query = query.eq('assigned_to', currentUserId);
      }

      const { data: oppsData, error: oppsError } = await query;
      if (oppsError) throw oppsError;

      const formattedOpps: OpportunityItem[] = (oppsData || []).map((item: any) => ({
        id: item.id,
        code: item.code || null,
        title: item.title,
        stage_id: item.stage_id,
        status: item.status || 'em_andamento',
        estimated_value: item.estimated_value || 0,
        expected_close_date: item.expected_close_date,
        service_type: item.service_type || null,
        partner_contact_id: item.partner_contact_id || null,
        updated_at: item.updated_at,
        assigned_to: item.assigned_to,
        contact: Array.isArray(item.contact) ? item.contact[0] : item.contact,
        owner: Array.isArray(item.owner) ? item.owner[0] : item.owner,
      }));

      setOpportunities(formattedOpps);

      const [membersRes, partnersRes, servicesRes] = await Promise.all([
        supabase
          .from('memberships')
          .select(`profile:profiles!profile_id (id, full_name)`)
          .eq('company_id', companyId)
          .eq('status', 'ativo'),
        supabase
          .from('contacts')
          .select('id, display_name')
          .eq('company_id', companyId)
          .is('deleted_at', null)
          .order('display_name', { ascending: true }),
        supabase
          .from('company_service_types')
          .select('id, name')
          .eq('company_id', companyId)
          .order('name', { ascending: true })
      ]);

      const members = (membersRes.data || [])
        .map((m: any) => {
          const p = Array.isArray(m.profile) ? m.profile[0] : m.profile;
          return p ? { id: p.id, name: p.full_name || 'Usuário' } : null;
        })
        .filter(Boolean) as Array<{ id: string; name: string }>;
      setTeamMembers(members);

      setPartnersList((partnersRes.data || []).map((p: any) => ({ id: p.id, name: p.display_name })));
      setServiceTypesList((servicesRes.data || []).map((s: any) => ({ id: s.id, name: s.name })));

    } catch (err) {
      console.error('Erro ao carregar dados do funil:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPipelineData();
  }, [user?.company?.id, isAdmin, currentUserId]);

  useEffect(() => {
    if (!loading && highlightedStageId && kanbanContainerRef.current) {
      const stageElement = document.getElementById(`kanban-stage-${highlightedStageId}`);
      if (stageElement) {
        stageElement.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [loading, highlightedStageId]);

  const countInProcess = opportunities.filter((op) => op.status === 'em_andamento').length;
  const countWon = opportunities.filter((op) => op.status === 'ganha').length;
  const countLost = opportunities.filter((op) => op.status === 'perdida').length;
  const countFrozen = opportunities.filter((op) => op.status === 'congelada').length;

  const handleDragStart = (e: React.DragEvent, oppId: string) => {
    if (!canManage || showFrozenOnly || activeStatusTab !== 'em_andamento') return;
    isDraggingRef.current = true;
    e.dataTransfer.setData('text/plain', oppId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedOppId(oppId);
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    if (!canManage || showFrozenOnly || activeStatusTab !== 'em_andamento') return;
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
    if (!canManage || showFrozenOnly || activeStatusTab !== 'em_andamento') return;

    const oppId = e.dataTransfer.getData('text/plain') || draggedOppId;
    setDragOverStageId(null);
    setDraggedOppId(null);

    setTimeout(() => {
      isDraggingRef.current = false;
    }, 100);

    if (!oppId) return;

    const currentOpp = opportunities.find((o) => o.id === oppId);
    if (!currentOpp || currentOpp.stage_id === targetStageId) return;

    const previousStageId = currentOpp.stage_id;

    setOpportunities((prev) =>
      prev.map((o) => (o.id === oppId ? { ...o, stage_id: targetStageId, updated_at: new Date().toISOString() } : o))
    );

    try {
      const { error } = await supabase
        .from('opportunities')
        .update({ 
          stage_id: targetStageId,
          updated_at: new Date().toISOString()
        })
        .eq('id', oppId);

      if (error) throw error;
    } catch (err) {
      console.error('Erro ao mover estágio:', err);
      setOpportunities((prev) =>
        prev.map((o) => (o.id === oppId ? { ...o, stage_id: previousStageId } : o))
      );
    }
  };

  const handleDragEnd = () => {
    setDraggedOppId(null);
    setDragOverStageId(null);
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 100);
  };

  const handleCardClick = (e: React.MouseEvent, oppId: string) => {
    const deltaX = Math.abs(e.clientX - mouseCoordsRef.current.x);
    const deltaY = Math.abs(e.clientY - mouseCoordsRef.current.y);

    if (deltaX > 6 || deltaY > 6 || isDraggingRef.current) {
      return;
    }

    onOpenOpportunityDetail(oppId);
  };

  const filteredOpportunities = opportunities.filter((op) => {
    if (showFrozenOnly) {
      if (op.status !== 'congelada') return false;
    } else {
      if (op.status !== activeStatusTab) return false;
    }

    if (assigneeFilter !== 'all') {
      if (op.assigned_to !== assigneeFilter) return false;
    }

    const q = search.toLowerCase();
    const matchesSearch = 
      op.title.toLowerCase().includes(q) ||
      (op.code && op.code.toLowerCase().includes(q)) ||
      (op.contact?.display_name && op.contact.display_name.toLowerCase().includes(q));

    const matchesContactType = 
      filterContactType === 'all' || op.contact?.type === filterContactType;

    const matchesServiceType = 
      filterServiceType === 'all' || op.service_type === filterServiceType;

    const matchesPartner = 
      filterPartnerId === 'all' || op.partner_contact_id === filterPartnerId;

    let matchesDate = true;
    if (filterDateRange !== 'all') {
      if (!op.expected_close_date) {
        matchesDate = false;
      } else {
        const closeDate = new Date(op.expected_close_date);
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        if (filterDateRange === 'overdue') {
          matchesDate = closeDate < now && op.status === 'em_andamento';
        } else if (filterDateRange === 'this_month') {
          matchesDate = closeDate.getFullYear() === currentYear && closeDate.getMonth() === currentMonth;
        } else if (filterDateRange === 'next_month') {
          const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
          const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
          matchesDate = closeDate.getFullYear() === nextYear && closeDate.getMonth() === nextMonth;
        }
      }
    }

    return (
      matchesSearch && 
      matchesContactType && 
      matchesServiceType && 
      matchesPartner && 
      matchesDate
    );
  });

  const activeFiltersCount = 
    (filterContactType !== 'all' ? 1 : 0) + 
    (filterServiceType !== 'all' ? 1 : 0) +
    (filterPartnerId !== 'all' ? 1 : 0) +
    (filterDateRange !== 'all' ? 1 : 0) +
    (assigneeFilter !== 'all' ? 1 : 0);

  const clearFilters = () => {
    setFilterContactType('all');
    setFilterServiceType('all');
    setFilterPartnerId('all');
    setFilterDateRange('all');
    setAssigneeFilter('all');
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);
  };

  const getDaysInStage = (updatedAt?: string) => {
    if (!updatedAt) return null;
    const diffTime = Math.abs(Date.now() - new Date(updatedAt).getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  const { totalPipelineValue, forecastValue } = useMemo(() => {
    const inProcessOpps = filteredOpportunities.filter(o => o.status === 'em_andamento');
    const total = inProcessOpps.reduce((acc, curr) => acc + (curr.estimated_value || 0), 0);

    const forecast = inProcessOpps.reduce((acc, curr) => {
      const stage = stages.find(s => s.id === curr.stage_id);
      const prob = (stage?.default_probability ?? 20) / 100;
      return acc + (curr.estimated_value || 0) * prob;
    }, 0);

    return { totalPipelineValue: total, forecastValue: forecast };
  }, [filteredOpportunities, stages]);

  const renderFilterFields = () => (
    <>
      {/* Responsável */}
      {isAdmin && teamMembers.length > 0 && (
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Responsável Comercial</label>
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500 cursor-pointer text-xs"
          >
            <option value="all">Toda a Equipe</option>
            {teamMembers.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Perfil do Contato */}
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

      {/* Tipo de Serviço */}
      <div>
        <label className="block font-semibold text-slate-700 mb-1">Tipo de Serviço</label>
        <select
          value={filterServiceType}
          onChange={(e) => setFilterServiceType(e.target.value)}
          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500 cursor-pointer text-xs"
        >
          <option value="all">Todos os Serviços</option>
          {serviceTypesList.map((srv) => (
            <option key={srv.id} value={srv.name}>{srv.name}</option>
          ))}
        </select>
      </div>

      {/* Parceiro / Indicador */}
      <div>
        <label className="block font-semibold text-slate-700 mb-1">Parceiro / Indicador</label>
        <select
          value={filterPartnerId}
          onChange={(e) => setFilterPartnerId(e.target.value)}
          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500 cursor-pointer text-xs"
        >
          <option value="all">Todos os Indicadores</option>
          {partnersList.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Previsão de Fechamento */}
      <div>
        <label className="block font-semibold text-slate-700 mb-1">Previsão de Fechamento</label>
        <select
          value={filterDateRange}
          onChange={(e) => setFilterDateRange(e.target.value as any)}
          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500 cursor-pointer text-xs"
        >
          <option value="all">Qualquer Período</option>
          <option value="this_month">Este Mês</option>
          <option value="next_month">Próximo Mês</option>
          <option value="overdue">Previsão Vencida (Atrasadas)</option>
        </select>
      </div>
    </>
  );

  return (
    <div className="flex flex-col h-full min-w-0 overflow-hidden relative">
      
      {/* 1. TOPO DA TELA */}
      <div className="flex items-center justify-between gap-3 pb-2.5 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">
              <span className="sm:hidden">Funil de vendas</span>
              <span className="hidden sm:inline">{isAdmin ? 'Funil Comercial' : 'Meu Funil Comercial'}</span>
            </h1>
            {showFrozenOnly && (
              <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-cyan-100 text-cyan-800 border border-cyan-200 flex items-center gap-1">
                <Snowflake size={11} /> Congeladas
              </span>
            )}
          </div>
          <p className="hidden sm:block text-xs text-slate-500 mt-0.5">
            {showFrozenOnly 
              ? 'Exibindo oportunidades pausadas temporariamente.'
              : isAdmin
              ? 'Acompanhamento consolidado do ciclo de vida das oportunidades de toda a equipe.'
              : 'Acompanhe as oportunidades sob a sua responsabilidade comercial.'}
          </p>
        </div>

        {/* Resumo de Valores e Botão Novo no Desktop */}
        <div className="flex items-center gap-3">
          {!showFrozenOnly && activeStatusTab === 'em_andamento' && (
            <div className="hidden lg:flex items-center gap-2 bg-slate-50 border border-slate-200/90 px-3 py-1.5 rounded-xl text-xs">
              <div className="flex items-center gap-1 text-slate-500 font-medium">
                <DollarSign size={13} className="text-slate-400" />
                <span>Em Aberto:</span>
                <strong className="text-slate-800">{formatCurrency(totalPipelineValue)}</strong>
              </div>
              <div className="h-3 w-px bg-slate-200" />
              <div className="flex items-center gap-1 text-slate-500 font-medium">
                <TrendingUp size={13} className="text-emerald-500" />
                <span>Previsão:</span>
                <strong className="text-emerald-700">{formatCurrency(forecastValue)}</strong>
              </div>
            </div>
          )}

          {canManage && (
            <button
              type="button"
              onClick={onOpenCreateOpportunityModal}
              className="hidden md:inline-flex items-center justify-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-all cursor-pointer active:scale-98 shrink-0"
            >
              <Plus size={16} />
              <span>Nova Negociação</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. BARRA DE CONTROLES: Pesquisa isolada no mobile | Botão de filtro à direita dos botões */}
      <div className="bg-white p-2 sm:p-2.5 rounded-2xl border border-slate-200/80 shadow-2xs mb-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 shrink-0">
        
        {/* Barra de Pesquisa (Sozinha em sua linha no mobile) */}
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

        {/* Grupo da Direita: Status + Botão de Filtros */}
        <div className="flex items-center gap-1.5 justify-between sm:justify-end shrink-0">
          
          {/* Alternador de Status */}
          <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 shrink-0 overflow-x-auto no-scrollbar flex-1 sm:flex-initial justify-between sm:justify-start">
            <button
              type="button"
              disabled={showFrozenOnly}
              onClick={() => {
                setActiveStatusTab('em_andamento');
                setShowFrozenOnly(false);
              }}
              title="Em Andamento"
              className={`flex items-center justify-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-40 shrink-0 ${
                !showFrozenOnly && activeStatusTab === 'em_andamento'
                  ? 'bg-white text-sky-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock size={15} className={!showFrozenOnly && activeStatusTab === 'em_andamento' ? 'text-sky-600' : 'text-slate-400'} />
              <span className="hidden sm:inline">Em Andamento</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                !showFrozenOnly && activeStatusTab === 'em_andamento' ? 'bg-sky-50 text-sky-700' : 'bg-slate-200 text-slate-600'
              }`}>
                {countInProcess}
              </span>
            </button>

            <button
              type="button"
              disabled={showFrozenOnly}
              onClick={() => {
                setActiveStatusTab('ganha');
                setShowFrozenOnly(false);
              }}
              title="Ganhas"
              className={`flex items-center justify-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-40 shrink-0 ${
                !showFrozenOnly && activeStatusTab === 'ganha'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 size={15} className={!showFrozenOnly && activeStatusTab === 'ganha' ? 'text-emerald-600' : 'text-slate-400'} />
              <span className="hidden sm:inline">Ganhas</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                !showFrozenOnly && activeStatusTab === 'ganha' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-600'
              }`}>
                {countWon}
              </span>
            </button>

            <button
              type="button"
              disabled={showFrozenOnly}
              onClick={() => {
                setActiveStatusTab('perdida');
                setShowFrozenOnly(false);
              }}
              title="Perdidas"
              className={`flex items-center justify-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-40 shrink-0 ${
                !showFrozenOnly && activeStatusTab === 'perdida'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <XCircle size={15} className={!showFrozenOnly && activeStatusTab === 'perdida' ? 'text-rose-600' : 'text-slate-400'} />
              <span className="hidden sm:inline">Perdidas</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                !showFrozenOnly && activeStatusTab === 'perdida' ? 'bg-rose-50 text-rose-700' : 'bg-slate-200 text-slate-600'
              }`}>
                {countLost}
              </span>
            </button>

            <div className="h-4 w-px bg-slate-300 mx-0.5 shrink-0" />

            <button
              type="button"
              onClick={() => setShowFrozenOnly(!showFrozenOnly)}
              title={showFrozenOnly ? "Sair das congeladas" : "Congeladas"}
              className={`flex items-center justify-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                showFrozenOnly
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'text-cyan-700 hover:bg-cyan-50'
              }`}
            >
              <Snowflake size={15} className={showFrozenOnly ? 'text-white' : 'text-cyan-600'} />
              <span className="hidden sm:inline">{showFrozenOnly ? 'Sair' : 'Congeladas'}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                showFrozenOnly ? 'bg-cyan-700 text-white' : 'bg-cyan-100 text-cyan-800'
              }`}>
                {countFrozen}
              </span>
            </button>
          </div>

          {/* Botão de Filtros Ancorado (Desktop: Popover anexo | Mobile: Bottom-sheet) */}
          <div className="relative shrink-0" ref={filterContainerRef}>
            <button
              type="button"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
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

            {/* POPOVER DESKTOP: Abre anexado logo abaixo do botão sem fundo escuro */}
            {isFilterOpen && (
              <div className="hidden md:block absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 z-50 animate-in fade-in zoom-in-95 duration-100 space-y-3.5 text-xs text-left">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="font-bold text-slate-900 text-xs uppercase tracking-wider">Filtros do Funil</span>
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
                    <button
                      type="button"
                      onClick={() => setIsFilterOpen(false)}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>

                {renderFilterFields()}

                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsFilterOpen(false)}
                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs transition"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM SHEET MOBILE: Abre deslizando de baixo para cima */}
      {isFilterOpen && (
        <div className="md:hidden fixed inset-0 z-[150] flex flex-col justify-end bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="absolute inset-0" onClick={() => setIsFilterOpen(false)} />
          
          <div className="relative bg-white rounded-t-3xl p-5 space-y-3.5 animate-in slide-in-from-bottom duration-200 max-h-[85vh] overflow-y-auto border-t border-slate-200 text-xs">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-1" />
            
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="font-bold text-slate-900 text-sm">Filtros do Funil</span>
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

      {/* 3. ÁREA DO KANBAN COM CARDS ENXUTOS */}
      <div 
        ref={kanbanContainerRef}
        className="flex-1 min-h-0 overflow-x-auto pb-3 flex gap-3 select-none snap-x snap-mandatory no-scrollbar"
      >
        {stages.map((stage) => {
          const stageOpps = filteredOpportunities.filter((op) => op.stage_id === stage.id);
          const stageTotal = stageOpps.reduce((acc, curr) => acc + (curr.estimated_value || 0), 0);
          const isOver = dragOverStageId === stage.id;
          const stageColor = stage.color || '#0ea5e9';
          const isHighlighted = highlightedStageId === stage.id;

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
                  : isHighlighted
                    ? 'border-sky-400 bg-sky-50/20 ring-2 ring-sky-400 shadow-md'
                    : 'border-slate-200/90'
              }`}
            >
              {/* Topo da Coluna */}
              <div 
                className="p-3 bg-white border-b border-slate-200/80 shrink-0"
                style={{ borderTop: `3px solid ${stageColor}` }}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span 
                      className="w-2.5 h-2.5 rounded-full shrink-0" 
                      style={{ backgroundColor: stageColor }}
                    />
                    <h3 className="font-bold text-xs text-slate-800 truncate">{stage.name}</h3>
                    <span className="px-1.5 py-0.2 bg-slate-100 text-slate-500 rounded-full text-[11px] font-semibold">
                      {stageOpps.length}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-800 shrink-0">{formatCurrency(stageTotal)}</span>
                </div>

                {stage.default_probability !== undefined && stage.default_probability > 0 && (
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                    <span>Probabilidade de fecho</span>
                    <span className="font-semibold text-slate-500">{stage.default_probability}%</span>
                  </div>
                )}
              </div>

              {/* Lista de Cards Enxutos */}
              <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2.5 no-scrollbar">
                {stageOpps.length === 0 ? (
                  <div className={`h-28 flex items-center justify-center border-2 border-dashed rounded-xl text-xs italic transition-colors ${
                    isOver 
                      ? 'border-sky-300 text-sky-600 bg-sky-50/50 font-semibold' 
                      : 'border-slate-200 text-slate-400'
                  }`}>
                    {isOver ? 'Solte para mover aqui' : 'Nenhuma negociação'}
                  </div>
                ) : (
                  stageOpps.map((op) => {
                    const isDraggingThis = draggedOppId === op.id;
                    const canDrag = canManage && !showFrozenOnly && activeStatusTab === 'em_andamento';
                    const daysInStage = getDaysInStage(op.updated_at);
                    const isStale = daysInStage !== null && daysInStage >= 7 && op.status === 'em_andamento';

                    return (
                      <div
                        key={op.id}
                        draggable={canDrag}
                        onDragStart={(e) => handleDragStart(e, op.id)}
                        onDragEnd={handleDragEnd}
                        onMouseDown={(e) => {
                          mouseCoordsRef.current = { x: e.clientX, y: e.clientY };
                        }}
                        onClick={(e) => handleCardClick(e, op.id)}
                        className={`bg-white p-3.5 rounded-xl border transition-all group relative select-none ${
                          canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                        } ${
                          isDraggingThis 
                            ? 'opacity-40 border-dashed border-sky-400 scale-95 shadow-none' 
                            : 'border-slate-200/90 shadow-2xs hover:shadow-md hover:border-sky-300 active:scale-[0.99]'
                        }`}
                      >
                        {/* 1. TÍTULO E BADGE DE STATUS OU PARADO */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0 pr-1">
                            <h4 className="font-bold text-slate-900 text-xs sm:text-sm group-hover:text-sky-600 transition-colors line-clamp-2">
                              {op.title}
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
                            {op.status === 'ganha' && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Ganha</span>
                            )}
                            {op.status === 'perdida' && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">Perdida</span>
                            )}
                            {op.status === 'congelada' && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200 flex items-center gap-0.5">
                                <Snowflake size={10} /> Congelada
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 2. CONTATO */}
                        {op.contact && (
                          <div 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onOpenContactModal && op.contact?.id) {
                                onOpenContactModal(op.contact.id);
                              } else if (op.contact?.id) {
                                setSelectedContactId(op.contact.id);
                                setIsContactProfileModalOpen(true);
                              }
                            }}
                            title="Ver detalhes do contato"
                            className="inline-flex items-center gap-1.5 mt-1.5 text-xs text-slate-500 hover:text-sky-600 cursor-pointer transition-colors max-w-full"
                          >
                            {op.contact.type === 'company' ? (
                              <Building2 size={13} className="text-slate-400 shrink-0" />
                            ) : (
                              <User size={13} className="text-slate-400 shrink-0" />
                            )}
                            <span className="truncate hover:underline">{op.contact.display_name}</span>
                          </div>
                        )}

                        {/* 3. TIPO DE OPORTUNIDADE / SERVIÇO */}
                        {op.service_type && (
                          <div className="mt-2">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200/60 truncate">
                              <Briefcase size={10} className="text-slate-400" />
                              {op.service_type}
                            </span>
                          </div>
                        )}

                        {/* RODAPÉ DO CARD: VALOR & RESPONSÁVEL */}
                        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-900 block">
                            {formatCurrency(op.estimated_value)}
                          </span>

                          <div className="flex items-center gap-2">
                            {op.owner && (
                              <div 
                                className="h-5 w-5 rounded-full overflow-hidden bg-sky-100 border border-slate-200 text-sky-700 flex items-center justify-center font-bold text-[9px]"
                                title={`Responsável: ${op.owner.full_name}`}
                              >
                                {op.owner.avatar_url ? (
                                  <img src={op.owner.avatar_url} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  op.owner.full_name.charAt(0).toUpperCase()
                                )}
                              </div>
                            )}

                            <span className="text-sky-600 flex items-center gap-0.5 text-[11px] font-semibold group-hover:translate-x-0.5 transition-transform">
                              <ChevronRight size={13} />
                            </span>
                          </div>
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

      {/* 4. BOTÃO FLUTUANTE (FAB) MOBILE */}
      {canManage && (
        <button
          type="button"
          onClick={onOpenCreateOpportunityModal}
          className="md:hidden fixed bottom-6 right-6 z-40 w-14 h-14 bg-sky-600 hover:bg-sky-500 active:scale-95 text-white rounded-full shadow-2xl flex items-center justify-center cursor-pointer transition-all border border-sky-400/40"
          title="Nova Negociação"
        >
          <Plus size={26} strokeWidth={2.5} />
        </button>
      )}

      {/* Modal de Perfil de Contato */}
      {isContactProfileModalOpen && selectedContactId && (
        <ContactProfileModal
          contactId={selectedContactId}
          isOpen={isContactProfileModalOpen}
          onClose={() => {
            setIsContactProfileModalOpen(false);
            setSelectedContactId(null);
          }}
        />
      )}
    </div>
  );
};

export default DealsKanbanView;