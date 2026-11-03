import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { CreateInventoryItemModal } from './CreateInventoryItemModal';
import { InventoryMovementModal } from './InventoryMovementModal';
import { InventoryItemDetailModal } from './InventoryItemDetailModal';
import { FulfillRequestModal } from './FulfillRequestModal';
import { PrintInventoryStockModal } from './PrintInventoryStockModal';
import {
  Boxes,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Wrench,
  Package,
  Shirt,
  Loader2,
  DollarSign,
  TrendingDown,
  ChevronRight,
  RotateCcw,
  Trash2,
  PackageOpen,
  CheckCircle2,
  XCircle,
  HardHat,
  Printer,
  Lock,
  X
} from 'lucide-react';

export interface InventoryItem {
  id: string;
  name: string;
  code?: string | null;
  item_type: 'epi' | 'ferramenta' | 'material' | 'uniforme' | 'consumivel';
  category: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  unit_cost: number;
  ca_number?: string | null;
  ca_expiry_date?: string | null;
  lifespan_days?: number | null;
  requires_size?: boolean;
  sizes_stock?: Record<string, number> | null;
  size?: string | null;
  serial_number?: string | null;
  brand?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface InventoryMovement {
  id: string;
  item_id: string;
  movement_type: string;
  quantity: number;
  size?: string | null;
  previous_stock: number;
  new_stock: number;
  unit_cost?: number | null;
  document_number?: string | null;
  notes?: string | null;
  created_at: string;
  item?: {
    name: string;
    unit: string;
    item_type: string;
  };
}

export interface MaterialRequest {
  id: string;
  requester_profile_id: string;
  beneficiary_profile_id?: string | null;
  work_id?: string | null;
  urgency: 'baixa' | 'normal' | 'urgente';
  status: 'pendente' | 'aprovado' | 'entregue' | 'atendido_parcial' | 'recusado';
  notes?: string | null;
  items: Array<{
    item_id?: string | null;
    item_name: string;
    unit?: string;
    size?: string | null;
    quantity: number;
  }>;
  created_at: string;
  requester?: { full_name: string } | null;
  beneficiary?: { full_name: string } | null;
  work?: { title: string; code?: string | null } | null;
}

interface InventoryViewProps {
  triggerCreateItem?: boolean;
  triggerMovement?: boolean;
  triggerPrintStock?: boolean;
  onResetTrigger?: () => void;
}

const formatCurrency = (val: number) => {
  return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const InventoryView: React.FC<InventoryViewProps> = ({
  triggerCreateItem = false,
  triggerMovement = false,
  triggerPrintStock = false,
  onResetTrigger
}) => {
  const { user } = useAuth();
  const { permissions, loading: loadingPerms } = usePermissions();

  const isMaster = Boolean(permissions?.isOwnerOrAdmin);
  const canViewModule = isMaster || Boolean(permissions?.canViewInventory);
  const canSeePrices = isMaster || Boolean(permissions?.canViewInventoryCosts);
  const canManageItems = isMaster || Boolean(permissions?.canManageInventoryItems);
  const canManageMovements = isMaster || Boolean(permissions?.canManageInventoryMovements);
  const canFulfillRequests = isMaster || Boolean(permissions?.canFulfillMaterialRequests);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [requests, setRequests] = useState<MaterialRequest[]>([]);

  // Sub-abas: 'inventory' | 'requests' | 'movements'
  const [activeTab, setActiveTab] = useState<'inventory' | 'requests' | 'movements'>('inventory');

  // Campo de busca unificado
  const [searchTerm, setSearchTerm] = useState('');

  // Filtros - Estoque
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'low' | 'ok'>('all');

  // Filtros - Solicitações
  const [requestStatusFilter, setRequestStatusFilter] = useState<string>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');

  // Filtros - Movimentações
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>('all');

  // Menu de filtros popover/sheet
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Modais de Criação e Detalhe
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<InventoryItem | null>(null);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedItemForDetail, setSelectedItemForDetail] = useState<InventoryItem | null>(null);

  // Modal de Movimentação Geral
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [selectedItemForMovement, setSelectedItemForMovement] = useState<InventoryItem | null>(null);

  // Modal de Atendimento de Solicitações
  const [isFulfillModalOpen, setIsFulfillModalOpen] = useState(false);
  const [selectedRequestForFulfill, setSelectedRequestForFulfill] = useState<MaterialRequest | null>(null);

  // Modal de Impressão de Estoque
  const [isPrintStockModalOpen, setIsPrintStockModalOpen] = useState(false);

  // Gatilhos do FAB Mobile
  useEffect(() => {
    if (triggerCreateItem && canManageItems) {
      setItemToEdit(null);
      setIsItemModalOpen(true);
      if (onResetTrigger) onResetTrigger();
    }
  }, [triggerCreateItem, canManageItems, onResetTrigger]);

  useEffect(() => {
    if (triggerMovement && canManageMovements) {
      setSelectedItemForMovement(null);
      setIsMovementModalOpen(true);
      if (onResetTrigger) onResetTrigger();
    }
  }, [triggerMovement, canManageMovements, onResetTrigger]);

  useEffect(() => {
    if (triggerPrintStock && canViewModule) {
      setIsPrintStockModalOpen(true);
      if (onResetTrigger) onResetTrigger();
    }
  }, [triggerPrintStock, canViewModule, onResetTrigger]);

  // Limpa o termo de busca ao alternar abas
  useEffect(() => {
    setSearchTerm('');
    setIsFilterOpen(false);
  }, [activeTab]);

  // Fechar popover de filtros ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadInventory = useCallback(async () => {
    let currentUserId = user?.id;
    if (!currentUserId) {
      const { data: authData } = await supabase.auth.getUser();
      currentUserId = authData.user?.id;
    }
    if (!currentUserId) return;

    let companyId = user?.company?.id || (user as any)?.company_id || (user as any)?.profile?.company_id;

    if (!companyId) {
      const { data: mem } = await supabase
        .from('memberships')
        .select('company_id')
        .eq('profile_id', currentUserId)
        .limit(1)
        .maybeSingle();
      companyId = mem?.company_id;
    }

    if (!companyId) return;

    try {
      setLoading(true);

      const [itemsRes, movementsRes, requestsRes, profilesRes, worksRes] = await Promise.all([
        supabase
          .from('inventory_items')
          .select('*')
          .eq('company_id', companyId)
          .eq('is_active', true)
          .order('name', { ascending: true }),
        supabase
          .from('inventory_movements')
          .select('*')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('material_requests')
          .select('*')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('profiles')
          .select('id, full_name')
          .eq('company_id', companyId),
        supabase
          .from('works')
          .select('id, title, code')
          .eq('company_id', companyId)
      ]);

      const profMap = new Map<string, string>();
      (profilesRes.data || []).forEach(p => profMap.set(p.id, p.full_name));

      const workMap = new Map<string, { title: string; code?: string | null }>();
      (worksRes.data || []).forEach(w => workMap.set(w.id, { title: w.title, code: w.code }));

      const itemMap = new Map<string, { name: string; unit: string; item_type: string }>();
      (itemsRes.data || []).forEach(i => itemMap.set(i.id, { name: i.name, unit: i.unit, item_type: i.item_type }));

      setItems(itemsRes.data || []);

      setMovements(
        (movementsRes.data || []).map((m: any) => ({
          ...m,
          item: itemMap.get(m.item_id) || { name: 'Item não identificado', unit: 'un', item_type: 'material' }
        }))
      );

      setRequests(
        (requestsRes.data || []).map((r: any) => ({
          ...r,
          requester: { full_name: profMap.get(r.requester_profile_id) || 'Solicitante' },
          beneficiary: { full_name: profMap.get(r.beneficiary_profile_id) || profMap.get(r.requester_profile_id) || 'Colaborador' },
          work: r.work_id ? workMap.get(r.work_id) || null : null
        }))
      );
    } catch (err) {
      console.error('Erro ao carregar almoxarifado:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (canViewModule) {
      loadInventory();
    }
  }, [loadInventory, canViewModule]);

  const pendingRequestsCount = useMemo(() => {
    return requests.filter(r => r.status === 'pendente' || r.status === 'atendido_parcial').length;
  }, [requests]);

  const metrics = useMemo(() => {
    const totalItems = items.length;
    let totalStockValue = 0;
    let lowStockCount = 0;
    let caExpiringCount = 0;

    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);
    const in30DaysStr = in30Days.toISOString().split('T')[0];

    items.forEach(it => {
      const stock = Number(it.current_stock) || 0;
      const min = Number(it.min_stock) || 0;
      const cost = Number(it.unit_cost) || 0;

      totalStockValue += stock * cost;

      if (stock <= min && min > 0) {
        lowStockCount++;
      }

      if (it.item_type === 'epi' && it.ca_expiry_date) {
        if (it.ca_expiry_date <= in30DaysStr) {
          caExpiringCount++;
        }
      }
    });

    return {
      totalItems,
      totalStockValue,
      lowStockCount,
      caExpiringCount
    };
  }, [items]);

  // Itens Filtrados
  const filteredItems = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();

    return items.filter(it => {
      const matchesSearch =
        q === '' ||
        it.name.toLowerCase().includes(q) ||
        (it.code && it.code.toLowerCase().includes(q)) ||
        (it.ca_number && it.ca_number.includes(q)) ||
        (it.brand && it.brand.toLowerCase().includes(q));

      const matchesType = typeFilter === 'all' || it.item_type === typeFilter;

      let matchesStock = true;
      if (stockStatusFilter === 'low') {
        matchesStock = Number(it.current_stock) <= Number(it.min_stock);
      } else if (stockStatusFilter === 'ok') {
        matchesStock = Number(it.current_stock) > Number(it.min_stock);
      }

      return matchesSearch && matchesType && matchesStock;
    });
  }, [items, searchTerm, typeFilter, stockStatusFilter]);

  // Solicitações Filtradas
  const filteredRequests = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();

    return requests.filter(req => {
      const matchesSearch =
        q === '' ||
        (req.beneficiary?.full_name && req.beneficiary.full_name.toLowerCase().includes(q)) ||
        (req.requester?.full_name && req.requester.full_name.toLowerCase().includes(q)) ||
        (req.work?.title && req.work.title.toLowerCase().includes(q)) ||
        (req.notes && req.notes.toLowerCase().includes(q)) ||
        (Array.isArray(req.items) && req.items.some(i => i.item_name.toLowerCase().includes(q)));

      const matchesStatus = requestStatusFilter === 'all' || req.status === requestStatusFilter;
      const matchesUrgency = urgencyFilter === 'all' || req.urgency === urgencyFilter;

      return matchesSearch && matchesStatus && matchesUrgency;
    });
  }, [requests, searchTerm, requestStatusFilter, urgencyFilter]);

  // Movimentações Filtradas
  const filteredMovements = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();

    return movements.filter(mov => {
      const matchesSearch =
        q === '' ||
        (mov.item?.name && mov.item.name.toLowerCase().includes(q)) ||
        (mov.document_number && mov.document_number.toLowerCase().includes(q)) ||
        (mov.notes && mov.notes.toLowerCase().includes(q));

      const matchesType = movementTypeFilter === 'all' || mov.movement_type === movementTypeFilter;

      return matchesSearch && matchesType;
    });
  }, [movements, searchTerm, movementTypeFilter]);

  // Contagem de filtros ativos para a aba atual
  const activeFiltersCount = useMemo(() => {
    if (activeTab === 'inventory') {
      let count = 0;
      if (typeFilter !== 'all') count++;
      if (stockStatusFilter !== 'all') count++;
      return count;
    }
    if (activeTab === 'requests') {
      let count = 0;
      if (requestStatusFilter !== 'all') count++;
      if (urgencyFilter !== 'all') count++;
      return count;
    }
    if (activeTab === 'movements') {
      return movementTypeFilter !== 'all' ? 1 : 0;
    }
    return 0;
  }, [activeTab, typeFilter, stockStatusFilter, requestStatusFilter, urgencyFilter, movementTypeFilter]);

  const clearCurrentTabFilters = () => {
    if (activeTab === 'inventory') {
      setTypeFilter('all');
      setStockStatusFilter('all');
    } else if (activeTab === 'requests') {
      setRequestStatusFilter('all');
      setUrgencyFilter('all');
    } else if (activeTab === 'movements') {
      setMovementTypeFilter('all');
    }
  };

  const handleOpenFulfill = (req: MaterialRequest) => {
    if (!canFulfillRequests) return;
    setSelectedRequestForFulfill(req);
    setIsFulfillModalOpen(true);
  };

  const handleRejectRequest = async (requestId: string) => {
    if (!canFulfillRequests) return;
    if (!window.confirm('Deseja recusar esta solicitação de material?')) return;
    try {
      const { error } = await supabase
        .from('material_requests')
        .update({ status: 'recusado', updated_at: new Date().toISOString() })
        .eq('id', requestId);

      if (error) throw error;
      setRequests(prev => prev.map(r => (r.id === requestId ? { ...r, status: 'recusado' } : r)));
    } catch (err: any) {
      alert('Erro ao recusar solicitação: ' + err.message);
    }
  };

  const getItemTypeBadge = (type: InventoryItem['item_type']) => {
    switch (type) {
      case 'epi':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200 px-2 py-0.5 rounded-md">
            <ShieldCheck size={11} />
            <span>EPI</span>
          </span>
        );
      case 'ferramenta':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md">
            <Wrench size={11} />
            <span>Ferramenta</span>
          </span>
        );
      case 'material':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md">
            <Package size={11} />
            <span>Material</span>
          </span>
        );
      case 'uniforme':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200 px-2 py-0.5 rounded-md">
            <Shirt size={11} />
            <span>Uniforme</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md">
            <span>Consumível</span>
          </span>
        );
    }
  };

  const getMovementBadge = (type: string) => {
    switch (type) {
      case 'saida_obra':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-md">
            <ArrowUpRight size={11} />
            <span>Saída Obra</span>
          </span>
        );
      case 'saida_epi':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200 px-2 py-0.5 rounded-md">
            <ShieldCheck size={11} />
            <span>Cautela EPI</span>
          </span>
        );
      case 'entrada_compra':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md">
            <ArrowDownLeft size={11} />
            <span>Entrada NF</span>
          </span>
        );
      case 'devolucao':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md">
            <RotateCcw size={11} />
            <span>Devolução</span>
          </span>
        );
      case 'descarte':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200 px-2 py-0.5 rounded-md">
            <Trash2 size={11} />
            <span>Descarte</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md">
            <span>{type}</span>
          </span>
        );
    }
  };

  const renderFilterFields = () => {
    if (activeTab === 'inventory') {
      return (
        <>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Tipo de Item</label>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer"
            >
              <option value="all">Todos os Tipos</option>
              <option value="epi">Apenas EPIs</option>
              <option value="ferramenta">Apenas Ferramentas</option>
              <option value="material">Materiais de Obra</option>
              <option value="uniforme">Uniformes</option>
              <option value="consumivel">Consumíveis</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Situação de Saldo</label>
            <select
              value={stockStatusFilter}
              onChange={e => setStockStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer"
            >
              <option value="all">Todas as Situações</option>
              <option value="low">Apenas Estoque Crítico</option>
              <option value="ok">Saldo Suficiente</option>
            </select>
          </div>
        </>
      );
    }

    if (activeTab === 'requests') {
      return (
        <>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Status da Solicitação</label>
            <select
              value={requestStatusFilter}
              onChange={e => setRequestStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer"
            >
              <option value="all">Todos os Status</option>
              <option value="pendente">Pendente</option>
              <option value="atendido_parcial">Atendido em Parte</option>
              <option value="entregue">Entregue / Concluído</option>
              <option value="recusado">Recusado</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Urgência</label>
            <select
              value={urgencyFilter}
              onChange={e => setUrgencyFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer"
            >
              <option value="all">Todas as Urgências</option>
              <option value="urgente">Urgente</option>
              <option value="normal">Normal</option>
              <option value="baixa">Baixa</option>
            </select>
          </div>
        </>
      );
    }

    if (activeTab === 'movements') {
      return (
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Tipo de Operação</label>
          <select
            value={movementTypeFilter}
            onChange={e => setMovementTypeFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer"
          >
            <option value="all">Todas as Operações</option>
            <option value="saida_obra">Saída para Obra</option>
            <option value="saida_epi">Cautela de EPI</option>
            <option value="entrada_compra">Entrada por Compra / NF</option>
            <option value="devolucao">Devolução</option>
            <option value="descarte">Baixa / Descarte</option>
          </select>
        </div>
      );
    }

    return null;
  };

  // Bloqueio de Acesso caso não tenha permissão de visualização
  if (!loadingPerms && !canViewModule) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3 border border-slate-200">
          <Lock size={26} />
        </div>
        <h3 className="text-base font-bold text-slate-800">Acesso Restrito ao Almoxarifado</h3>
        <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
          Seu perfil de acesso não possui permissão para visualizar o painel do almoxarifado e catálogo de materiais.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 bg-slate-50/50 p-3 sm:p-6 overflow-y-auto space-y-3.5 relative">
      
      {/* 1. CABEÇALHO */}
      <div className="flex items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Almoxarifado e Estoque
          </h1>
          <p className="hidden sm:block text-xs sm:text-sm text-slate-500 mt-0.5">
            Gestão unificada de requisições, EPIs e materiais para obras.
          </p>
        </div>

        {/* Botões de Ação na Web (md: em diante) */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          {canManageMovements && (
            <button
              type="button"
              onClick={() => {
                setSelectedItemForMovement(null);
                setIsMovementModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer active:scale-98"
            >
              <ArrowUpRight size={14} />
              <span>Movimentar Estoque</span>
            </button>
          )}

          {canManageItems && (
            <button
              type="button"
              onClick={() => {
                setItemToEdit(null);
                setIsItemModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer active:scale-98"
            >
              <Plus size={15} />
              <span>Cadastrar Item</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. CARDS DE INDICADORES (SOMENTE NA WEB, OCULTOS NO MOBILE) */}
      <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Itens no Catálogo
          </span>
          <strong className="text-lg font-black text-slate-900 block font-mono">
            {metrics.totalItems}
          </strong>
          <span className="text-[10px] text-slate-400 block truncate">Produtos e equipamentos</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block flex items-center gap-1">
            <DollarSign size={12} className="text-emerald-600" />
            <span>Valor em Estoque</span>
          </span>
          <strong className="text-lg font-black text-emerald-900 block truncate font-mono">
            {canSeePrices ? formatCurrency(metrics.totalStockValue) : 'R$ ••••••'}
          </strong>
          <span className="text-[10px] text-emerald-600 block truncate">
            {canSeePrices ? 'Custo total imobilizado' : 'Acesso a custos restrito'}
          </span>
        </div>

        <div
          className={`p-3.5 rounded-2xl border shadow-2xs space-y-1 transition-colors ${
            metrics.lowStockCount > 0
              ? 'bg-amber-50/80 border-amber-200 text-amber-900'
              : 'bg-white border-slate-200'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider block flex items-center gap-1">
            <TrendingDown size={12} className={metrics.lowStockCount > 0 ? 'text-amber-600' : 'text-slate-400'} />
            <span>Estoque Baixo</span>
          </span>
          <strong
            className={`text-lg font-black block font-mono ${
              metrics.lowStockCount > 0 ? 'text-amber-800' : 'text-slate-900'
            }`}
          >
            {metrics.lowStockCount} {metrics.lowStockCount === 1 ? 'item' : 'itens'}
          </strong>
          <span className="text-[10px] block opacity-75 truncate">Abaixo do saldo mínimo</span>
        </div>

        <div
          className={`p-3.5 rounded-2xl border shadow-2xs space-y-1 transition-colors ${
            pendingRequestsCount > 0
              ? 'bg-sky-50/80 border-sky-200 text-sky-950'
              : 'bg-white border-slate-200'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider block flex items-center gap-1">
            <PackageOpen size={12} className={pendingRequestsCount > 0 ? 'text-sky-600' : 'text-slate-400'} />
            <span>Fila de Solicitações</span>
          </span>
          <strong
            className={`text-lg font-black block font-mono ${
              pendingRequestsCount > 0 ? 'text-sky-900' : 'text-slate-900'
            }`}
          >
            {pendingRequestsCount} {pendingRequestsCount === 1 ? 'pendente' : 'pendentes'}
          </strong>
          <span className="text-[10px] block opacity-75 truncate">Aguardando atendimento</span>
        </div>
      </div>

      {/* 3. TABS + BOTÃO IMPRIMIR ESTOQUE ALINHADO À DIREITA NA WEB */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 pb-1 shrink-0">
        <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-semibold w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab('inventory')}
            className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'inventory'
                ? 'bg-white text-sky-700 font-bold shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Boxes size={14} />
            <span>Estoque</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('requests')}
            className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 relative ${
              activeTab === 'requests'
                ? 'bg-white text-sky-700 font-bold shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <PackageOpen size={14} />
            <span>Solicitações</span>
            {pendingRequestsCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" title="Solicitações pendentes" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('movements')}
            className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'movements'
                ? 'bg-white text-sky-700 font-bold shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ArrowUpRight size={14} />
            <span>Movimentação</span>
          </button>
        </div>

        {/* Botão de Imprimir Estoque posicionado na direita das abas na Web */}
        <button
          type="button"
          onClick={() => setIsPrintStockModalOpen(true)}
          className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer active:scale-98 shrink-0"
          title="Imprimir folha de conferência de estoque"
        >
          <Printer size={14} className="text-slate-500" />
          <span>Imprimir Estoque</span>
        </button>
      </div>

      {/* 4. BARRA DE BUSCA E BOTÃO DE FILTROS (DISPONÍVEL EM TODAS AS ABAS) */}
      <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between gap-2.5 shrink-0">
        <div className="relative flex-1 min-w-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder={
              activeTab === 'inventory'
                ? 'Buscar por nome, código, CA ou marca...'
                : activeTab === 'requests'
                ? 'Buscar por solicitante, obra ou item solicitado...'
                : 'Buscar movimentação por item ou documento...'
            }
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-800 font-medium"
          />
        </div>

        {/* Botão de Filtro com Ícone no Mobile e Popover na Web */}
        <div className="relative shrink-0" ref={filterRef}>
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

          {/* POPOVER DESKTOP */}
          {isFilterOpen && (
            <div className="hidden md:block absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 z-50 animate-in fade-in zoom-in-95 duration-100 space-y-3 text-xs text-left">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                  Filtros da Aba {activeTab === 'inventory' ? 'Estoque' : activeTab === 'requests' ? 'Solicitações' : 'Movimentações'}
                </span>
                <div className="flex items-center gap-2">
                  {activeFiltersCount > 0 && (
                    <button
                      type="button"
                      onClick={clearCurrentTabFilters}
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

      {/* ACTION SHEET MOBILE (FILTROS) */}
      {isFilterOpen && (
        <div className="md:hidden fixed inset-0 z-[160] flex flex-col justify-end bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="absolute inset-0" onClick={() => setIsFilterOpen(false)} />
          <div className="relative bg-white rounded-t-3xl p-5 space-y-3.5 animate-in slide-in-from-bottom duration-200 border-t border-slate-200 text-xs shadow-2xl">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-1" />
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="font-bold text-slate-900 text-sm">
                Filtros - {activeTab === 'inventory' ? 'Estoque' : activeTab === 'requests' ? 'Solicitações' : 'Movimentações'}
              </span>
              <div className="flex items-center gap-2">
                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    onClick={clearCurrentTabFilters}
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

      {/* 5. ÁREA DE LISTAGEM: MOBILE (CARDS) VS DESKTOP (TABELA) */}
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="p-16 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
            <Loader2 size={20} className="animate-spin mx-auto mb-2 text-sky-600" />
            Carregando almoxarifado...
          </div>
        ) : activeTab === 'inventory' ? (
          <>
            {/* CARDS MOBILE (ESTOQUE) */}
            <div className="block md:hidden space-y-2.5 pb-24">
              {filteredItems.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-400 italic">
                  Nenhum item encontrado no estoque.
                </div>
              ) : (
                filteredItems.map(item => {
                  const isLow = Number(item.current_stock) <= Number(item.min_stock);
                  const hasSizes = item.requires_size && item.sizes_stock && Object.keys(item.sizes_stock).length > 0;

                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSelectedItemForDetail(item);
                        setIsDetailModalOpen(true);
                      }}
                      className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs active:bg-slate-50 transition cursor-pointer space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <strong className="text-slate-900 font-bold text-sm block truncate">
                              {item.name}
                            </strong>
                            {hasSizes && (
                              <span className="px-1.5 py-0.2 rounded-md bg-sky-50 text-sky-700 border border-sky-200 text-[9px] font-bold">
                                Grade
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 block truncate">
                            {item.code ? `Cód: ${item.code} • ` : ''}{item.category}
                          </span>
                        </div>
                        {getItemTypeBadge(item.item_type)}
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          {item.item_type === 'epi' && item.ca_number && (
                            <span className="font-mono text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              CA {item.ca_number}
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded-md font-mono font-bold text-xs border ${
                              isLow
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            }`}
                          >
                            {item.current_stock} {item.unit}
                          </span>
                        </div>

                        {canSeePrices && (
                          <strong className="text-slate-900 font-bold font-mono">
                            {formatCurrency(Number(item.unit_cost) || 0)}
                          </strong>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* TABELA DESKTOP (ESTOQUE) */}
            <div className="hidden md:block bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden h-full">
              {filteredItems.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-400 italic">
                  Nenhum item encontrado no estoque com os filtros aplicados.
                </div>
              ) : (
                <div className="overflow-x-auto h-full">
                  <table className="w-full text-left text-xs text-slate-600 min-w-[700px]">
                    <thead className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold text-slate-700 uppercase tracking-wider sticky top-0 z-10">
                      <tr>
                        <th className="py-3 px-4">Item / Equipamento</th>
                        <th className="py-3 px-4">Tipo</th>
                        <th className="py-3 px-4">CA / Especificação</th>
                        <th className="py-3 px-4 text-center">Saldo em Estoque</th>
                        {canSeePrices && <th className="py-3 px-4 text-right">Custo Unitário</th>}
                        <th className="py-3 px-4 text-right">Situação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {filteredItems.map(item => {
                        const isLow = Number(item.current_stock) <= Number(item.min_stock);
                        const hasSizes = item.requires_size && item.sizes_stock && Object.keys(item.sizes_stock).length > 0;

                        return (
                          <tr
                            key={item.id}
                            onClick={() => {
                              setSelectedItemForDetail(item);
                              setIsDetailModalOpen(true);
                            }}
                            className="hover:bg-sky-50/50 transition cursor-pointer group"
                            title="Clique para ver detalhes"
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <strong className="text-slate-900 group-hover:text-sky-700 font-bold block text-xs truncate max-w-[280px] transition-colors">
                                  {item.name}
                                </strong>
                                {hasSizes && (
                                  <span className="px-1.5 py-0.2 rounded-md bg-sky-50 text-sky-700 border border-sky-200 text-[9px] font-bold shrink-0">
                                    Grade
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 block">
                                {item.code ? `Cód: ${item.code} • ` : ''}Categoria: {item.category}
                              </span>
                            </td>

                            <td className="py-3 px-4">{getItemTypeBadge(item.item_type)}</td>

                            <td className="py-3 px-4">
                              {item.item_type === 'epi' ? (
                                item.ca_number ? (
                                  <span className="font-mono text-[11px] font-bold text-slate-800 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                                    CA {item.ca_number}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic text-[10px]">Sem CA</span>
                                )
                              ) : item.item_type === 'ferramenta' ? (
                                <span className="text-[11px] text-slate-700 font-semibold">
                                  {item.brand || 'Sem marca'} {item.serial_number ? `(${item.serial_number})` : ''}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic text-[10px]">Padrão de obra</span>
                              )}
                            </td>

                            <td className="py-3 px-4 text-center">
                              <div className="inline-flex items-center gap-1.5">
                                <span
                                  className={`px-2.5 py-0.5 rounded-lg font-mono font-black text-xs border ${
                                    isLow
                                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  }`}
                                >
                                  {item.current_stock} {item.unit}
                                </span>
                                {isLow && (
                                  <span title={`Mínimo: ${item.min_stock} ${item.unit}`}>
                                    <AlertTriangle size={13} className="text-amber-500" />
                                  </span>
                                )}
                              </div>
                            </td>

                            {canSeePrices && (
                              <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                                {formatCurrency(Number(item.unit_cost) || 0)}
                              </td>
                            )}

                            <td className="py-3 px-4 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                {isLow ? (
                                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                                    Baixo Estoque
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                    Regular
                                  </span>
                                )}
                                <ChevronRight size={14} className="text-slate-300 group-hover:text-sky-600 transition-colors" />
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
          </>
        ) : activeTab === 'requests' ? (
          <>
            {/* CARDS MOBILE (SOLICITAÇÕES) */}
            <div className="block md:hidden space-y-2.5 pb-24">
              {filteredRequests.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-400 italic">
                  Nenhuma solicitação encontrada com os filtros aplicados.
                </div>
              ) : (
                filteredRequests.map(req => {
                  const isPending = req.status === 'pendente' || req.status === 'atendido_parcial';

                  return (
                    <div key={req.id} className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <strong className="text-slate-900 font-bold text-xs block">
                            {req.beneficiary?.full_name || req.requester?.full_name || 'Não informado'}
                          </strong>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            {new Date(req.created_at).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                            req.urgency === 'urgente'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-sky-50 text-sky-800 border border-sky-200'
                          }`}
                        >
                          {req.urgency}
                        </span>
                      </div>

                      {req.work && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-700">
                          <HardHat size={13} className="text-sky-600 shrink-0" />
                          <span className="truncate">{req.work.title}</span>
                        </div>
                      )}

                      <div className="p-2 bg-slate-50 rounded-xl space-y-1">
                        {Array.isArray(req.items) && req.items.map((it, idx) => (
                          <div key={idx} className="text-[11px] font-semibold text-slate-800 flex justify-between">
                            <span>{it.item_name} {it.size ? `(Tam. ${it.size})` : ''}</span>
                            <span className="font-mono">{it.quantity}x</span>
                          </div>
                        ))}
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            req.status === 'entregue'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : req.status === 'atendido_parcial'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : req.status === 'recusado'
                              ? 'bg-slate-100 text-slate-400'
                              : 'bg-sky-50 text-sky-800 border border-sky-200'
                          }`}
                        >
                          {req.status === 'atendido_parcial' ? 'Parcial' : req.status}
                        </span>

                        {isPending && canFulfillRequests && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenFulfill(req)}
                              className="px-3 py-1 bg-sky-600 text-white rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1 cursor-pointer"
                            >
                              <CheckCircle2 size={12} />
                              <span>Atender</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectRequest(req.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                            >
                              <XCircle size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* TABELA DESKTOP (SOLICITAÇÕES) */}
            <div className="hidden md:block bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden h-full">
              {filteredRequests.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-400 italic">
                  Nenhuma solicitação encontrada com os filtros aplicados.
                </div>
              ) : (
                <div className="overflow-x-auto h-full">
                  <table className="w-full text-left text-xs text-slate-600 min-w-[750px]">
                    <thead className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold text-slate-700 uppercase tracking-wider sticky top-0 z-10">
                      <tr>
                        <th className="py-3 px-4">Data</th>
                        <th className="py-3 px-4">Destinatário</th>
                        <th className="py-3 px-4">Obra</th>
                        <th className="py-3 px-4">Itens Solicitados</th>
                        <th className="py-3 px-4 text-center">Urgência</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {filteredRequests.map(req => {
                        const isPending = req.status === 'pendente' || req.status === 'atendido_parcial';

                        return (
                          <tr key={req.id} className="hover:bg-slate-50/60 transition">
                            <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                              {new Date(req.created_at).toLocaleDateString('pt-BR')} às{' '}
                              {new Date(req.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </td>

                            <td className="py-3 px-4">
                              <strong className="text-slate-900 block font-bold text-xs">
                                {req.beneficiary?.full_name || req.requester?.full_name || 'Não informado'}
                              </strong>
                              {req.beneficiary && req.requester && req.beneficiary.full_name !== req.requester.full_name && (
                                <span className="text-[10px] text-slate-400">
                                  Por: {req.requester.full_name}
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-4">
                              {req.work ? (
                                <div className="flex items-center gap-1.5 text-xs text-slate-800">
                                  <HardHat size={13} className="text-sky-600 shrink-0" />
                                  <span className="truncate max-w-[180px]">
                                    {req.work.code ? `[${req.work.code}] ` : ''}{req.work.title}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">Uso Geral</span>
                              )}
                            </td>

                            <td className="py-3 px-4">
                              <div className="space-y-1 max-w-[280px]">
                                {Array.isArray(req.items) && req.items.map((it, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-block bg-slate-100 text-slate-800 font-semibold px-2 py-0.5 rounded text-[11px] mr-1.5 mb-1"
                                  >
                                    {it.quantity}x {it.item_name} {it.size ? `(Tam. ${it.size})` : ''}
                                  </span>
                                ))}
                              </div>
                            </td>

                            <td className="py-3 px-4 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                                  req.urgency === 'urgente'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : req.urgency === 'baixa'
                                    ? 'bg-slate-100 text-slate-600 border border-slate-200'
                                    : 'bg-sky-50 text-sky-800 border border-sky-200'
                                }`}
                              >
                                {req.urgency}
                              </span>
                            </td>

                            <td className="py-3 px-4 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                                  req.status === 'entregue'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : req.status === 'atendido_parcial'
                                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                    : req.status === 'recusado'
                                    ? 'bg-slate-100 text-slate-400 line-through'
                                    : 'bg-sky-50 text-sky-800 border border-sky-200 animate-pulse'
                                }`}
                              >
                                {req.status === 'atendido_parcial' ? 'Atendido Parcial' : req.status}
                              </span>
                            </td>

                            <td className="py-3 px-4 text-right">
                              {isPending ? (
                                canFulfillRequests ? (
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenFulfill(req)}
                                      className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold shadow-2xs transition cursor-pointer flex items-center gap-1 active:scale-98"
                                    >
                                      <CheckCircle2 size={12} />
                                      <span>Atender</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRejectRequest(req.id)}
                                      className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer"
                                    >
                                      <XCircle size={15} />
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">Pendente</span>
                                )
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">Concluído</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* CARDS MOBILE (MOVIMENTAÇÕES) */}
            <div className="block md:hidden space-y-2.5 pb-24">
              {filteredMovements.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-400 italic">
                  Nenhuma movimentação encontrada com os filtros aplicados.
                </div>
              ) : (
                filteredMovements.map(mov => {
                  const isSaida = mov.movement_type.startsWith('saida') || mov.movement_type === 'descarte';

                  return (
                    <div key={mov.id} className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <strong className="text-slate-900 font-bold text-xs">
                          {mov.item?.name || 'Item desconhecido'}
                        </strong>
                        {getMovementBadge(mov.movement_type)}
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="font-mono text-[10px] text-slate-400">
                          {new Date(mov.created_at).toLocaleDateString('pt-BR')}
                        </span>

                        <div className="flex items-center gap-2">
                          <span className={`font-mono font-bold ${isSaida ? 'text-rose-600' : 'text-emerald-700'}`}>
                            {isSaida ? `-${mov.quantity}` : `+${mov.quantity}`}
                          </span>
                          <span className="text-slate-400 text-[10px]">Novo Saldo: {mov.new_stock}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* TABELA DESKTOP (MOVIMENTAÇÕES) */}
            <div className="hidden md:block bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden h-full">
              {filteredMovements.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-400 italic">
                  Nenhuma movimentação de estoque registrada com os filtros aplicados.
                </div>
              ) : (
                <div className="overflow-x-auto h-full">
                  <table className="w-full text-left text-xs text-slate-600 min-w-[700px]">
                    <thead className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold text-slate-700 uppercase tracking-wider sticky top-0 z-10">
                      <tr>
                        <th className="py-3 px-4">Data / Hora</th>
                        <th className="py-3 px-4">Item</th>
                        <th className="py-3 px-4">Operação</th>
                        <th className="py-3 px-4 text-center">Tam.</th>
                        <th className="py-3 px-4 text-center">Quantidade</th>
                        <th className="py-3 px-4 text-center">Saldo Resultante</th>
                        {canSeePrices && <th className="py-3 px-4 text-right">Valor Unitário</th>}
                        <th className="py-3 px-4">Doc / Romaneio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {filteredMovements.map(mov => {
                        const isSaida = mov.movement_type.startsWith('saida') || mov.movement_type === 'descarte';

                        return (
                          <tr key={mov.id} className="hover:bg-slate-50/70 transition">
                            <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                              {new Date(mov.created_at).toLocaleDateString('pt-BR')} às{' '}
                              {new Date(mov.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </td>

                            <td className="py-3 px-4 font-bold text-slate-900">
                              {mov.item?.name || 'Item desconhecido'}
                            </td>

                            <td className="py-3 px-4">{getMovementBadge(mov.movement_type)}</td>

                            <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">
                              {mov.size ? `Tam. ${mov.size}` : '—'}
                            </td>

                            <td className="py-3 px-4 text-center font-mono font-bold">
                              <span className={isSaida ? 'text-rose-600' : 'text-emerald-700'}>
                                {isSaida ? `-${mov.quantity}` : `+${mov.quantity}`}
                              </span>
                            </td>

                            <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                              {mov.new_stock}
                            </td>

                            {canSeePrices && (
                              <td className="py-3 px-4 text-right font-mono text-slate-700">
                                {mov.unit_cost ? formatCurrency(Number(mov.unit_cost)) : '—'}
                              </td>
                            )}

                            <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                              {mov.document_number || mov.notes || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* MODAIS */}
      {isItemModalOpen && (
        <CreateInventoryItemModal
          isOpen={isItemModalOpen}
          onClose={() => {
            setIsItemModalOpen(false);
            setItemToEdit(null);
          }}
          onSuccess={loadInventory}
          itemToEdit={itemToEdit}
        />
      )}

      {isDetailModalOpen && (
        <InventoryItemDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedItemForDetail(null);
          }}
          item={selectedItemForDetail}
          onEditItem={it => {
            if (!canManageItems) return;
            setItemToEdit(it);
            setIsItemModalOpen(true);
          }}
          onQuickMovement={it => {
            if (!canManageMovements) return;
            setSelectedItemForMovement(it);
            setIsMovementModalOpen(true);
          }}
        />
      )}

      {isMovementModalOpen && (
        <InventoryMovementModal
          isOpen={isMovementModalOpen}
          onClose={() => {
            setIsMovementModalOpen(false);
            setSelectedItemForMovement(null);
          }}
          onSuccess={() => {
            setIsMovementModalOpen(false);
            setSelectedItemForMovement(null);
            loadInventory();
          }}
          item={selectedItemForMovement}
          allItems={items}
        />
      )}

      {isFulfillModalOpen && (
        <FulfillRequestModal
          isOpen={isFulfillModalOpen}
          onClose={() => {
            setIsFulfillModalOpen(false);
            setSelectedRequestForFulfill(null);
          }}
          onSuccess={() => {
            setIsFulfillModalOpen(false);
            setSelectedRequestForFulfill(null);
            loadInventory();
          }}
          request={selectedRequestForFulfill}
          allItems={items}
        />
      )}

      {isPrintStockModalOpen && (
        <PrintInventoryStockModal
          isOpen={isPrintStockModalOpen}
          onClose={() => setIsPrintStockModalOpen(false)}
          items={items}
        />
      )}
    </div>
  );
};

export default InventoryView;