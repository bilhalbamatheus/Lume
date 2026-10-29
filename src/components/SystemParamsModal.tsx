import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { usePermissions } from '../hooks/usePermissions';
import {
  X,
  Package,
  Briefcase,
  Kanban,
  HardHat,
  Plus,
  Trash2,
  Edit3,
  Loader2,
  Check,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  Percent,
  Sliders,
  Save
} from 'lucide-react';

export interface CommercialStageConfig {
  id: string;
  company_id?: string;
  pipeline_id?: string;
  name: string;
  color: string;
  sort_order: number;
  default_probability?: number;
}

export interface WorkStageConfig {
  id: string;
  company_id?: string;
  name: string;
  color: string;
  sort_order: number;
}

export interface CompanyServiceType {
  id: string;
  name: string;
  sort_order: number;
}

export interface CatalogItem {
  id: string;
  name: string;
  item_type: 'equipamento' | 'material' | 'servico' | 'outros';
  unit: string;
  cost_price: number;
  markup_percent: number;
  sale_price: number;
  notes?: string | null;
  is_active: boolean;
}

interface SystemParamsModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
}

const parsePtBrCurrency = (val: string): number => {
  if (!val) return 0;
  const clean = val.replace(/\./g, '').replace(',', '.');
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
};

const formatCurrency = (val: number | null | undefined): string => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
};

export const SystemParamsModal: React.FC<SystemParamsModalProps> = ({
  isOpen,
  onClose,
  companyId
}) => {
  const { permissions } = usePermissions();
  // Valida se o usuário tem privilégio de administrador/proprietário ou permissão de customização
  const canEditParams = Boolean(
    permissions?.isOwnerOrAdmin ||
    (permissions as any)?.canCustomizeSystem ||
    (permissions as any)?.company_settings ||
    (permissions as any)?.custom_fields_manage
  );

  const [activeTab, setActiveTab] = useState<'catalogo' | 'servicos' | 'commercial_pipeline' | 'work_pipeline'>('catalogo');

  // --- CATÁLOGO DE ITENS ---
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [itemFormId, setItemFormId] = useState<string | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemType, setItemType] = useState<'equipamento' | 'material' | 'servico' | 'outros'>('equipamento');
  const [itemUnit, setItemUnit] = useState('un');
  const [itemCostPrice, setItemCostPrice] = useState('');
  const [itemMarkupPercent, setItemMarkupPercent] = useState('30');
  const [itemSalePrice, setItemSalePrice] = useState('');
  const [itemNotes, setItemNotes] = useState('');
  const [savingCatalogItem, setSavingCatalogItem] = useState(false);

  // --- SERVIÇOS ---
  const [services, setServices] = useState<CompanyServiceType[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [isAddServiceModalOpen, setIsAddServiceModalOpen] = useState(false);
  const [savingService, setSavingService] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editingServiceName, setEditingServiceName] = useState('');
  const [serviceToDelete, setServiceToDelete] = useState<CompanyServiceType | null>(null);
  const [deletingService, setDeletingService] = useState(false);

  // --- FUNIL COMERCIAL ---
  const [commercialStages, setCommercialStages] = useState<CommercialStageConfig[]>([]);
  const [loadingCommercialStages, setLoadingCommercialStages] = useState(false);
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [isEditingCommStageModal, setIsEditingCommStageModal] = useState(false);
  const [editingCommStage, setEditingCommStage] = useState<Partial<CommercialStageConfig> | null>(null);
  const [commStageToDelete, setCommStageToDelete] = useState<CommercialStageConfig | null>(null);
  const [deletingCommStage, setDeletingCommStage] = useState(false);
  const [commStageOppCount, setCommStageOppCount] = useState(0);
  const [checkingCommStageOpps, setCheckingCommStageOpps] = useState(false);

  // --- FUNIL DAS OBRAS (work_pipeline_stages) ---
  const [workStages, setWorkStages] = useState<WorkStageConfig[]>([]);
  const [loadingWorkStages, setLoadingWorkStages] = useState(false);
  const [isEditingWorkStageModal, setIsEditingWorkStageModal] = useState(false);
  const [editingWorkStage, setEditingWorkStage] = useState<Partial<WorkStageConfig> | null>(null);
  const [workStageToDelete, setWorkStageToDelete] = useState<WorkStageConfig | null>(null);
  const [deletingWorkStage, setDeletingWorkStage] = useState(false);
  const [workStageCount, setWorkStageCount] = useState(0);
  const [checkingWorkStageCount, setCheckingWorkStageCount] = useState(false);

  // 1. CARREGAR CATÁLOGO
  const loadCatalogItems = async () => {
    if (!companyId) return;
    try {
      setLoadingCatalog(true);
      const { data, error } = await supabase
        .from('company_catalog_items')
        .select('id, name, item_type, unit, cost_price, markup_percent, sale_price, notes, is_active')
        .eq('company_id', companyId)
        .order('name', { ascending: true });

      if (error) throw error;
      setCatalogItems((data as CatalogItem[]) || []);
    } catch (err) {
      console.error('Erro ao buscar catálogo:', err);
    } finally {
      setLoadingCatalog(false);
    }
  };

  // 2. CARREGAR SERVIÇOS
  const loadServices = async () => {
    if (!companyId) return;
    try {
      setLoadingServices(true);
      const { data, error } = await supabase
        .from('company_service_types')
        .select('id, name, sort_order')
        .eq('company_id', companyId)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setServices(data || []);
    } catch (err) {
      console.error('Erro ao buscar serviços:', err);
    } finally {
      setLoadingServices(false);
    }
  };

  // 3. CARREGAR FUNIL COMERCIAL
  const loadCommercialStages = async () => {
    if (!companyId) return;
    try {
      setLoadingCommercialStages(true);
      let { data: pipeline } = await supabase
        .from('commercial_pipelines')
        .select('id')
        .eq('company_id', companyId)
        .order('is_default', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!pipeline) {
        const { data: newPipe } = await supabase
          .from('commercial_pipelines')
          .insert({
            company_id: companyId,
            name: 'Funil Comercial Padrão',
            is_default: true,
          })
          .select('id')
          .single();
        pipeline = newPipe;
      }

      if (pipeline?.id) {
        setPipelineId(pipeline.id);
        const { data: stagesData, error: stagesError } = await supabase
          .from('commercial_pipeline_stages')
          .select('*')
          .eq('pipeline_id', pipeline.id)
          .order('sort_order', { ascending: true });

        if (stagesError) throw stagesError;
        setCommercialStages(stagesData || []);
      }
    } catch (err) {
      console.error('Erro ao carregar etapas do funil comercial:', err);
    } finally {
      setLoadingCommercialStages(false);
    }
  };

  // 4. CARREGAR FUNIL DAS OBRAS
  const loadWorkStages = async () => {
    if (!companyId) return;
    try {
      setLoadingWorkStages(true);
      const { data, error } = await supabase
        .from('work_pipeline_stages')
        .select('*')
        .eq('company_id', companyId)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        const defaultWorkStagesSeed = [
          { company_id: companyId, name: 'Planejamento / Projeto', color: '#0284c7', sort_order: 1 },
          { company_id: companyId, name: 'Mobilização / Canteiro', color: '#f59e0b', sort_order: 2 },
          { company_id: companyId, name: 'Execução / Montagem', color: '#0ea5e9', sort_order: 3 },
          { company_id: companyId, name: 'Comissionamento & Testes', color: '#8b5cf6', sort_order: 4 },
          { company_id: companyId, name: 'Obra Concluída', color: '#10b981', sort_order: 5 }
        ];

        const { data: createdSeed, error: seedErr } = await supabase
          .from('work_pipeline_stages')
          .insert(defaultWorkStagesSeed)
          .select('*');

        if (!seedErr && createdSeed) {
          setWorkStages(createdSeed);
        } else {
          setWorkStages([]);
        }
      } else {
        setWorkStages(data);
      }
    } catch (err) {
      console.error('Erro ao carregar etapas de obra:', err);
    } finally {
      setLoadingWorkStages(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !companyId) return;
    if (activeTab === 'catalogo') loadCatalogItems();
    if (activeTab === 'servicos') loadServices();
    if (activeTab === 'commercial_pipeline') loadCommercialStages();
    if (activeTab === 'work_pipeline') loadWorkStages();
  }, [isOpen, companyId, activeTab]);

  // --- HANDLERS DO CATÁLOGO ---
  const handleCostOrMarkupChange = (newCostStr: string, newMarkupStr: string) => {
    setItemCostPrice(newCostStr);
    setItemMarkupPercent(newMarkupStr);

    const cost = parsePtBrCurrency(newCostStr);
    const markup = parseFloat(newMarkupStr) || 0;

    if (cost > 0) {
      const calculatedSale = cost * (1 + markup / 100);
      setItemSalePrice(calculatedSale.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    }
  };

  const handleSalePriceChange = (newSaleStr: string) => {
    setItemSalePrice(newSaleStr);

    const sale = parsePtBrCurrency(newSaleStr);
    const cost = parsePtBrCurrency(itemCostPrice);

    if (cost > 0 && sale >= cost) {
      const calculatedMarkup = ((sale - cost) / cost) * 100;
      setItemMarkupPercent(calculatedMarkup.toFixed(2));
    }
  };

  const handleOpenCatalogModal = (item?: CatalogItem) => {
    if (!canEditParams) return;
    if (item) {
      setItemFormId(item.id);
      setItemName(item.name);
      setItemType(item.item_type || 'equipamento');
      setItemUnit(item.unit || 'un');
      setItemCostPrice(item.cost_price ? item.cost_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
      setItemMarkupPercent(item.markup_percent !== undefined ? String(item.markup_percent) : '30');
      setItemSalePrice(item.sale_price ? item.sale_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
      setItemNotes(item.notes || '');
    } else {
      setItemFormId(null);
      setItemName('');
      setItemType('equipamento');
      setItemUnit('un');
      setItemCostPrice('');
      setItemMarkupPercent('30');
      setItemSalePrice('');
      setItemNotes('');
    }
    setShowCatalogModal(true);
  };

  const handleSaveCatalogItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !itemName.trim() || !canEditParams) return;

    try {
      setSavingCatalogItem(true);
      const cost = parsePtBrCurrency(itemCostPrice);
      const markup = parseFloat(itemMarkupPercent) || 0;
      const sale = itemSalePrice ? parsePtBrCurrency(itemSalePrice) : (cost * (1 + markup / 100));

      const payload = {
        company_id: companyId,
        name: itemName.trim(),
        item_type: itemType,
        unit: itemUnit.trim() || 'un',
        cost_price: cost,
        markup_percent: markup,
        sale_price: sale,
        notes: itemNotes.trim() || null,
        updated_at: new Date().toISOString()
      };

      if (itemFormId) {
        const { error } = await supabase
          .from('company_catalog_items')
          .update(payload)
          .eq('id', itemFormId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('company_catalog_items')
          .insert(payload);
        if (error) throw error;
      }

      setShowCatalogModal(false);
      await loadCatalogItems();
    } catch (err: any) {
      alert(`Erro ao salvar item: ${err.message}`);
    } finally {
      setSavingCatalogItem(false);
    }
  };

  const handleDeleteCatalogItem = async (id: string, name: string) => {
    if (!canEditParams) return;
    if (!window.confirm(`Deseja remover "${name}" do catálogo de itens?`)) return;
    try {
      const { error } = await supabase
        .from('company_catalog_items')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await loadCatalogItems();
    } catch (err: any) {
      alert(`Erro ao excluir item: ${err.message || ''}`);
    }
  };

  // --- HANDLERS DE SERVIÇOS ---
  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName.trim() || !companyId || !canEditParams) return;
    try {
      setSavingService(true);
      const nextOrder = services.length > 0 ? Math.max(...services.map(s => s.sort_order || 0)) + 1 : 1;
      const { error } = await supabase
        .from('company_service_types')
        .insert({
          company_id: companyId,
          name: newServiceName.trim(),
          sort_order: nextOrder
        });

      if (error) {
        if (error.code === '23505') {
          alert('Já existe um serviço cadastrado com este nome.');
          return;
        }
        throw error;
      }

      setNewServiceName('');
      setIsAddServiceModalOpen(false);
      await loadServices();
    } catch (err: any) {
      alert('Não foi possível salvar o tipo de serviço.');
    } finally {
      setSavingService(false);
    }
  };

  const handleUpdateService = async (id: string) => {
    if (!editingServiceName.trim() || !companyId || !canEditParams) return;
    try {
      const { error } = await supabase
        .from('company_service_types')
        .update({ name: editingServiceName.trim(), company_id: companyId })
        .eq('id', id);

      if (error) throw error;
      setEditingServiceId(null);
      await loadServices();
    } catch (err: any) {
      alert(`Erro ao atualizar: ${err.message || 'Falha na requisição'}`);
    }
  };

  const handleConfirmDeleteService = async () => {
    if (!serviceToDelete || !canEditParams) return;
    try {
      setDeletingService(true);
      const { error } = await supabase
        .from('company_service_types')
        .delete()
        .eq('id', serviceToDelete.id);

      if (error) throw error;
      setServices(prev => prev.filter(s => s.id !== serviceToDelete.id));
      setServiceToDelete(null);
    } catch (err: any) {
      alert('Erro ao excluir tipo de serviço.');
    } finally {
      setDeletingService(false);
    }
  };

  // --- HANDLERS DO FUNIL COMERCIAL ---
  const handleMoveCommercialStage = async (index: number, direction: 'up' | 'down') => {
    if (!canEditParams) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= commercialStages.length) return;

    const newStages = [...commercialStages];
    const current = newStages[index];
    const target = newStages[targetIndex];

    const tempOrder = current.sort_order;
    current.sort_order = target.sort_order;
    target.sort_order = tempOrder;

    newStages[index] = target;
    newStages[targetIndex] = current;
    setCommercialStages(newStages);

    try {
      await supabase
        .from('commercial_pipeline_stages')
        .upsert([
          { id: current.id, sort_order: current.sort_order },
          { id: target.id, sort_order: target.sort_order }
        ]);
    } catch (err) {
      loadCommercialStages();
    }
  };

  const handleSaveCommercialStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCommStage?.name?.trim() || !pipelineId || !canEditParams) return;

    try {
      if (editingCommStage.id) {
        const { error } = await supabase
          .from('commercial_pipeline_stages')
          .update({
            name: editingCommStage.name.trim(),
            color: editingCommStage.color || '#0ea5e9',
            default_probability: editingCommStage.default_probability || 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingCommStage.id);
        if (error) throw error;
      } else {
        const nextOrder = commercialStages.length > 0 ? Math.max(...commercialStages.map(s => s.sort_order)) + 1 : 1;
        const { error } = await supabase
          .from('commercial_pipeline_stages')
          .insert({
            company_id: companyId,
            pipeline_id: pipelineId,
            name: editingCommStage.name.trim(),
            color: editingCommStage.color || '#0ea5e9',
            sort_order: nextOrder,
            default_probability: editingCommStage.default_probability || 0
          });
        if (error) throw error;
      }

      setIsEditingCommStageModal(false);
      setEditingCommStage(null);
      await loadCommercialStages();
    } catch (err) {
      console.error('Erro ao salvar etapa comercial:', err);
    }
  };

  const handleOpenDeleteCommStage = async (stage: CommercialStageConfig) => {
    if (!canEditParams) return;
    try {
      setCheckingCommStageOpps(true);
      const { count, error } = await supabase
        .from('opportunities')
        .select('*', { count: 'exact', head: true })
        .eq('stage_id', stage.id);

      if (error) throw error;
      setCommStageOppCount(count || 0);
      setCommStageToDelete(stage);
    } catch (err) {
      setCommStageOppCount(0);
      setCommStageToDelete(stage);
    } finally {
      setCheckingCommStageOpps(false);
    }
  };

  const handleConfirmDeleteCommStage = async () => {
    if (!commStageToDelete || commStageOppCount > 0 || !canEditParams) return;
    if (commercialStages.length <= 1) {
      alert('O funil comercial precisa manter ao menos 1 etapa.');
      setCommStageToDelete(null);
      return;
    }

    try {
      setDeletingCommStage(true);
      const { error } = await supabase
        .from('commercial_pipeline_stages')
        .delete()
        .eq('id', commStageToDelete.id);

      if (error) throw error;
      setCommercialStages(prev => prev.filter(s => s.id !== commStageToDelete.id));
      setCommStageToDelete(null);
    } catch (err: any) {
      alert(`Não foi possível excluir a etapa: ${err.message || ''}`);
    } finally {
      setDeletingCommStage(false);
    }
  };

  // --- HANDLERS DO FUNIL DAS OBRAS ---
  const handleMoveWorkStage = async (index: number, direction: 'up' | 'down') => {
    if (!canEditParams) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= workStages.length) return;

    const newStages = [...workStages];
    const current = newStages[index];
    const target = newStages[targetIndex];

    const tempOrder = current.sort_order;
    current.sort_order = target.sort_order;
    target.sort_order = tempOrder;

    newStages[index] = target;
    newStages[targetIndex] = current;
    setWorkStages(newStages);

    try {
      await supabase
        .from('work_pipeline_stages')
        .upsert([
          { id: current.id, sort_order: current.sort_order },
          { id: target.id, sort_order: target.sort_order }
        ]);
    } catch (err) {
      loadWorkStages();
    }
  };

  const handleSaveWorkStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorkStage?.name?.trim() || !companyId || !canEditParams) return;

    try {
      if (editingWorkStage.id) {
        const { error } = await supabase
          .from('work_pipeline_stages')
          .update({
            name: editingWorkStage.name.trim(),
            color: editingWorkStage.color || '#0ea5e9'
          })
          .eq('id', editingWorkStage.id);
        if (error) throw error;
      } else {
        const nextOrder = workStages.length > 0 ? Math.max(...workStages.map(s => s.sort_order || 0)) + 1 : 1;
        const { error } = await supabase
          .from('work_pipeline_stages')
          .insert({
            company_id: companyId,
            name: editingWorkStage.name.trim(),
            color: editingWorkStage.color || '#0ea5e9',
            sort_order: nextOrder
          });
        if (error) throw error;
      }

      setIsEditingWorkStageModal(false);
      setEditingWorkStage(null);
      await loadWorkStages();
    } catch (err: any) {
      alert('Erro ao salvar etapa da obra: ' + err.message);
    }
  };

  const handleOpenDeleteWorkStage = async (stage: WorkStageConfig) => {
    if (!canEditParams) return;
    try {
      setCheckingWorkStageCount(true);
      const { count, error } = await supabase
        .from('works')
        .select('*', { count: 'exact', head: true })
        .or(`stage.eq.${stage.id},stage.eq.${stage.name.toLowerCase()}`);

      if (error) throw error;
      setWorkStageCount(count || 0);
      setWorkStageToDelete(stage);
    } catch (err) {
      setWorkStageCount(0);
      setWorkStageToDelete(stage);
    } finally {
      setCheckingWorkStageCount(false);
    }
  };

  const handleConfirmDeleteWorkStage = async () => {
    if (!workStageToDelete || workStageCount > 0 || !canEditParams) return;
    if (workStages.length <= 1) {
      alert('É necessário manter ao menos 1 etapa de obra.');
      setWorkStageToDelete(null);
      return;
    }

    try {
      setDeletingWorkStage(true);
      const { error } = await supabase
        .from('work_pipeline_stages')
        .delete()
        .eq('id', workStageToDelete.id);

      if (error) throw error;
      setWorkStages(prev => prev.filter(s => s.id !== workStageToDelete.id));
      setWorkStageToDelete(null);
    } catch (err: any) {
      alert('Não foi possível excluir etapa de obra: ' + err.message);
    } finally {
      setDeletingWorkStage(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[260] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-4xl w-full shadow-2xl flex flex-col h-[85vh] overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Topo do Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <Sliders size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base leading-tight">
                Cadastros & Catálogo do Sistema
              </h3>
              <p className="text-xs text-slate-500">
                Parametrize catálogo de itens, serviços e etapas dos funis Comercial e de Obras.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Barra de Abas */}
        <div className="px-6 border-b border-slate-200/90 flex items-center gap-2 bg-slate-50/50 shrink-0 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('catalogo')}
            className={`py-3 px-3.5 border-b-2 text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'catalogo'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Package size={15} />
            <span>Catálogo de Itens ({catalogItems.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('servicos')}
            className={`py-3 px-3.5 border-b-2 text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'servicos'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Briefcase size={15} />
            <span>Tipos de Serviços ({services.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('commercial_pipeline')}
            className={`py-3 px-3.5 border-b-2 text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'commercial_pipeline'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Kanban size={15} />
            <span>Funil Comercial ({commercialStages.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('work_pipeline')}
            className={`py-3 px-3.5 border-b-2 text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'work_pipeline'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <HardHat size={15} />
            <span>Funil das Obras ({workStages.length})</span>
          </button>
        </div>

        {/* Conteúdo das Abas */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          
          {/* ABA 1: CATÁLOGO DE ITENS */}
          {activeTab === 'catalogo' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="Buscar por descrição ou tipo..."
                  className="w-full sm:max-w-xs px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                />

                {canEditParams && (
                  <button
                    type="button"
                    onClick={() => handleOpenCatalogModal()}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer active:scale-98"
                  >
                    <Plus size={14} />
                    <span>Novo Item</span>
                  </button>
                )}
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">Item / Descrição</th>
                      <th className="py-2.5 px-3 w-28">Tipo</th>
                      <th className="py-2.5 px-3 w-16 text-center">Unid.</th>
                      <th className="py-2.5 px-3 w-28 text-right">Custo Base</th>
                      <th className="py-2.5 px-3 w-20 text-center">Mark-up</th>
                      <th className="py-2.5 px-3 w-28 text-right">Preço Venda</th>
                      {canEditParams && <th className="py-2.5 px-3 w-16 text-center">Ações</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingCatalog ? (
                      <tr>
                        <td colSpan={canEditParams ? 7 : 6} className="py-8 text-center text-slate-400">
                          <Loader2 size={18} className="animate-spin mx-auto mb-1 text-emerald-600" />
                          Carregando catálogo...
                        </td>
                      </tr>
                    ) : catalogItems.filter((i) =>
                        i.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                        i.item_type.toLowerCase().includes(catalogSearch.toLowerCase())
                      ).length === 0 ? (
                      <tr>
                        <td colSpan={canEditParams ? 7 : 6} className="py-8 text-center text-slate-400 italic">
                          Nenhum item cadastrado no catálogo.
                        </td>
                      </tr>
                    ) : (
                      catalogItems
                        .filter((i) =>
                          i.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                          i.item_type.toLowerCase().includes(catalogSearch.toLowerCase())
                        )
                        .map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-2.5 px-3">
                              <p className="font-semibold text-slate-800">{item.name}</p>
                              {item.notes && <p className="text-[10px] text-slate-400 truncate max-w-xs">{item.notes}</p>}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                item.item_type === 'equipamento'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : item.item_type === 'servico'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : item.item_type === 'material'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}>
                                {item.item_type.charAt(0).toUpperCase() + item.item_type.slice(1)}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono text-slate-500">{item.unit}</td>
                            <td className="py-2.5 px-3 text-right text-slate-500">
                              {formatCurrency(item.cost_price)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                {item.markup_percent}%
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                              {formatCurrency(item.sale_price)}
                            </td>
                            {canEditParams && (
                              <td className="py-2.5 px-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenCatalogModal(item)}
                                    className="p-1.5 text-slate-400 hover:text-sky-600 rounded-lg cursor-pointer transition-colors"
                                    title="Editar item"
                                  >
                                    <Edit3 size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCatalogItem(item.id, item.name)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer transition-colors"
                                    title="Excluir item"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ABA 2: TIPOS DE SERVIÇOS */}
          {activeTab === 'servicos' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-xs text-slate-500">
                  Modalidades de atendimento disponíveis para seleção nas negociações comerciais.
                </p>
                {canEditParams && (
                  <button
                    type="button"
                    onClick={() => {
                      setNewServiceName('');
                      setIsAddServiceModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-2xs transition cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Novo Serviço</span>
                  </button>
                )}
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 bg-white shadow-2xs max-w-xl">
                {loadingServices ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    <Loader2 size={18} className="animate-spin mx-auto mb-1.5 text-emerald-600" />
                    Carregando serviços...
                  </div>
                ) : services.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 italic">
                    Nenhum tipo de serviço cadastrado.
                  </div>
                ) : (
                  services.map((srv) => (
                    <div key={srv.id} className="p-3.5 flex items-center justify-between text-xs sm:text-sm hover:bg-slate-50/60 transition-colors">
                      {editingServiceId === srv.id && canEditParams ? (
                        <div className="flex items-center gap-2 flex-1 mr-3">
                          <input
                            type="text"
                            autoFocus
                            value={editingServiceName}
                            onChange={(e) => setEditingServiceName(e.target.value)}
                            className="flex-1 px-3 py-1 text-xs bg-white border border-sky-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateService(srv.id)}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md cursor-pointer"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingServiceId(null)}
                            className="p-1 text-slate-400 hover:bg-slate-200 rounded-md cursor-pointer"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="font-semibold text-slate-800">{srv.name}</span>
                          {canEditParams && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingServiceId(srv.id);
                                  setEditingServiceName(srv.name);
                                }}
                                className="p-1.5 text-slate-400 hover:text-sky-600 rounded-lg cursor-pointer"
                                title="Editar nome"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setServiceToDelete(srv)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                                title="Excluir serviço"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ABA 3: FUNIL COMERCIAL */}
          {activeTab === 'commercial_pipeline' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-xs text-slate-500">
                  Ordem e cores das etapas do quadro Kanban de negociações comerciais.
                </p>
                {canEditParams && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCommStage({ name: '', color: '#0ea5e9', default_probability: 20 });
                      setIsEditingCommStageModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-2xs transition cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Nova Etapa Comercial</span>
                  </button>
                )}
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 bg-white shadow-2xs">
                {loadingCommercialStages ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    <Loader2 size={18} className="animate-spin mx-auto mb-1 text-emerald-600" />
                    Carregando etapas...
                  </div>
                ) : commercialStages.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 italic">
                    Nenhuma etapa cadastrada no funil comercial.
                  </div>
                ) : (
                  commercialStages.map((stage, idx) => (
                    <div key={stage.id} className="p-3.5 sm:px-5 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-5 text-center text-xs font-bold text-slate-400">
                          {idx + 1}º
                        </span>
                        <span
                          className="w-4 h-4 rounded-full shrink-0 shadow-2xs border border-white"
                          style={{ backgroundColor: stage.color || '#0ea5e9' }}
                        />
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">{stage.name}</p>
                          <p className="text-[11px] text-slate-400 font-medium">
                            Probabilidade: {stage.default_probability || 0}%
                          </p>
                        </div>
                      </div>

                      {canEditParams && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveCommercialStage(idx, 'up')}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg disabled:opacity-30 cursor-pointer"
                            title="Mover para cima"
                          >
                            <ChevronUp size={16} />
                          </button>
                          <button
                            type="button"
                            disabled={idx === commercialStages.length - 1}
                            onClick={() => handleMoveCommercialStage(idx, 'down')}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg disabled:opacity-30 cursor-pointer"
                            title="Mover para baixo"
                          >
                            <ChevronDown size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCommStage(stage);
                              setIsEditingCommStageModal(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-sky-600 rounded-lg cursor-pointer"
                            title="Editar etapa"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            type="button"
                            disabled={checkingCommStageOpps}
                            onClick={() => handleOpenDeleteCommStage(stage)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                            title="Excluir etapa"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ABA 4: FUNIL DAS OBRAS */}
          {activeTab === 'work_pipeline' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-xs text-slate-500">
                  Etapas macro de andamento e ciclo de vida pelas quais as obras passam no sistema.
                </p>
                {canEditParams && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingWorkStage({ name: '', color: '#0ea5e9' });
                      setIsEditingWorkStageModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-2xs transition cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Nova Etapa de Obra</span>
                  </button>
                )}
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 bg-white shadow-2xs">
                {loadingWorkStages ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    <Loader2 size={18} className="animate-spin mx-auto mb-1 text-emerald-600" />
                    Carregando etapas de obra...
                  </div>
                ) : workStages.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 italic">
                    Nenhuma etapa de obra cadastrada.
                  </div>
                ) : (
                  workStages.map((stage, idx) => (
                    <div key={stage.id} className="p-3.5 sm:px-5 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-5 text-center text-xs font-bold text-slate-400">
                          {idx + 1}º
                        </span>
                        <span
                          className="w-4 h-4 rounded-full shrink-0 shadow-2xs border border-white"
                          style={{ backgroundColor: stage.color || '#0ea5e9' }}
                        />
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">{stage.name}</p>
                          <p className="text-[11px] text-slate-400 font-medium">
                            Etapa de Obra #{stage.sort_order}
                          </p>
                        </div>
                      </div>

                      {canEditParams && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveWorkStage(idx, 'up')}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg disabled:opacity-30 cursor-pointer"
                            title="Mover para cima"
                          >
                            <ChevronUp size={16} />
                          </button>
                          <button
                            type="button"
                            disabled={idx === workStages.length - 1}
                            onClick={() => handleMoveWorkStage(idx, 'down')}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg disabled:opacity-30 cursor-pointer"
                            title="Mover para baixo"
                          >
                            <ChevronDown size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingWorkStage(stage);
                              setIsEditingWorkStageModal(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-sky-600 rounded-lg cursor-pointer"
                            title="Editar etapa"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            type="button"
                            disabled={checkingWorkStageCount}
                            onClick={() => handleOpenDeleteWorkStage(stage)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                            title="Excluir etapa"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>

        {/* Rodapé */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs transition"
          >
            Concluir
          </button>
        </div>

      </div>

      {/* MODAL INTERNO: CRIAR/EDITAR ITEM CATÁLOGO */}
      {showCatalogModal && (
        <div className="fixed inset-0 z-[280] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="font-bold text-slate-900 text-sm">
                {itemFormId ? 'Editar Item do Catálogo' : 'Novo Item do Catálogo'}
              </h4>
              <button onClick={() => setShowCatalogModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveCatalogItem} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome / Descrição *</label>
                <input
                  type="text"
                  required
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="Ex: Módulo Fotovoltaico 550W"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tipo de Item</label>
                  <select
                    value={itemType}
                    onChange={(e) => setItemType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                  >
                    <option value="equipamento">Equipamento</option>
                    <option value="material">Material</option>
                    <option value="servico">Serviço</option>
                    <option value="outros">Outros</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Unidade</label>
                  <select
                    value={itemUnit}
                    onChange={(e) => setItemUnit(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                  >
                    <option value="un">un (Unidade)</option>
                    <option value="m">m (Metro linear)</option>
                    <option value="m²">m² (Metro quadrado)</option>
                    <option value="kWp">kWp (Potência)</option>
                    <option value="hora">hora (Horas)</option>
                    <option value="diaria">diaria (Diária)</option>
                    <option value="vb">vb (Verba)</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Custo Base (R$) *</label>
                    <input
                      type="text"
                      required
                      value={itemCostPrice}
                      onChange={(e) => handleCostOrMarkupChange(e.target.value, itemMarkupPercent)}
                      placeholder="0,00"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 font-semibold focus:ring-2 focus:ring-emerald-500 text-right shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Mark-up</span>
                      <Percent size={11} className="text-slate-400" />
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        value={itemMarkupPercent}
                        onChange={(e) => handleCostOrMarkupChange(itemCostPrice, e.target.value)}
                        placeholder="30"
                        className="w-full pl-3 pr-7 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 font-semibold focus:ring-2 focus:ring-emerald-500 text-right shadow-2xs"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[11px] pointer-events-none">%</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-emerald-900 mb-1">
                    Preço de Venda Sugerido (R$) *
                  </label>
                  <input
                    type="text"
                    required
                    value={itemSalePrice}
                    onChange={(e) => handleSalePriceChange(e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-emerald-950 font-extrabold text-sm focus:ring-2 focus:ring-emerald-500 text-right shadow-2xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Observações Técnicas</label>
                <input
                  type="text"
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  placeholder="Garantia, fabricante..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 shadow-2xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCatalogModal(false)}
                  className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingCatalogItem}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold shadow-2xs cursor-pointer active:scale-98 disabled:opacity-50"
                >
                  {savingCatalogItem ? 'Salvando...' : 'Salvar Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL INTERNO: CRIAR NOVO SERVIÇO */}
      {isAddServiceModalOpen && (
        <div className="fixed inset-0 z-[280] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="font-bold text-slate-900 text-sm">Novo Tipo de Serviço</h4>
              <button onClick={() => setIsAddServiceModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddService} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome do Serviço *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Ex: Consultoria Energética, Usina Solo..."
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-emerald-500 shadow-2xs font-medium"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsAddServiceModalOpen(false)}
                  className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingService || !newServiceName.trim()}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold shadow-2xs cursor-pointer active:scale-98 disabled:opacity-50"
                >
                  {savingService ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL INTERNO: EDITAR ETAPA COMERCIAL */}
      {isEditingCommStageModal && editingCommStage && (
        <div className="fixed inset-0 z-[280] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="font-bold text-slate-900 text-sm">
                {editingCommStage.id ? 'Editar Etapa Comercial' : 'Nova Etapa Comercial'}
              </h4>
              <button onClick={() => { setIsEditingCommStageModal(false); setEditingCommStage(null); }} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveCommercialStage} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome da Etapa *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Proposta Enviada"
                  value={editingCommStage.name || ''}
                  onChange={(e) => setEditingCommStage({ ...editingCommStage, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-emerald-500 shadow-2xs font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Cor</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={editingCommStage.color || '#0ea5e9'}
                    onChange={(e) => setEditingCommStage({ ...editingCommStage, color: e.target.value })}
                    className="h-8 w-12 p-0 border border-slate-200 rounded-lg cursor-pointer"
                  />
                  <span className="font-mono text-slate-500">{editingCommStage.color || '#0ea5e9'}</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Probabilidade (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={editingCommStage.default_probability ?? 0}
                  onChange={(e) => setEditingCommStage({ ...editingCommStage, default_probability: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-emerald-500 shadow-2xs font-medium"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => { setIsEditingCommStageModal(false); setEditingCommStage(null); }}
                  className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold shadow-2xs cursor-pointer active:scale-98"
                >
                  Salvar Etapa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL INTERNO: EDITAR ETAPA DE OBRA */}
      {isEditingWorkStageModal && editingWorkStage && (
        <div className="fixed inset-0 z-[280] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="font-bold text-slate-900 text-sm">
                {editingWorkStage.id ? 'Editar Etapa de Obra' : 'Nova Etapa de Obra'}
              </h4>
              <button onClick={() => { setIsEditingWorkStageModal(false); setEditingWorkStage(null); }} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveWorkStage} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome da Etapa de Obra *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Execução / Montagem"
                  value={editingWorkStage.name || ''}
                  onChange={(e) => setEditingWorkStage({ ...editingWorkStage, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-emerald-500 shadow-2xs font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Cor da Etiqueta</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={editingWorkStage.color || '#0ea5e9'}
                    onChange={(e) => setEditingWorkStage({ ...editingWorkStage, color: e.target.value })}
                    className="h-8 w-12 p-0 border border-slate-200 rounded-lg cursor-pointer"
                  />
                  <span className="font-mono text-slate-500">{editingWorkStage.color || '#0ea5e9'}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => { setIsEditingWorkStageModal(false); setEditingWorkStage(null); }}
                  className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold shadow-2xs cursor-pointer active:scale-98"
                >
                  Salvar Etapa de Obra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL INTERNO: EXCLUSÃO DE ETAPA COMERCIAL */}
      {commStageToDelete && (
        <div className="fixed inset-0 z-[290] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-3">
            {commStageOppCount > 0 ? (
              <>
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
                  <AlertTriangle size={22} />
                </div>
                <h4 className="font-bold text-slate-900 text-sm">Não é possível excluir</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  A etapa <strong className="text-slate-800">"{commStageToDelete.name}"</strong> possui {commStageOppCount} negociação(ões) vinculada(s). Mova-as antes de excluir.
                </p>
                <button
                  type="button"
                  onClick={() => setCommStageToDelete(null)}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Entendido
                </button>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
                  <Trash2 size={22} />
                </div>
                <h4 className="font-bold text-slate-900 text-sm">Excluir Etapa Comercial</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Deseja excluir a etapa <strong className="text-slate-800">"{commStageToDelete.name}"</strong>?
                </p>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setCommStageToDelete(null)}
                    className="flex-1 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={deletingCommStage}
                    onClick={handleConfirmDeleteCommStage}
                    className="flex-1 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-2xs flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {deletingCommStage ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    <span>Excluir</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL INTERNO: EXCLUSÃO DE ETAPA DE OBRA */}
      {workStageToDelete && (
        <div className="fixed inset-0 z-[290] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-3">
            {workStageCount > 0 ? (
              <>
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
                  <AlertTriangle size={22} />
                </div>
                <h4 className="font-bold text-slate-900 text-sm">Não é possível excluir etapa</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  A etapa <strong className="text-slate-800">"{workStageToDelete.name}"</strong> está sendo utilizada em {workStageCount} obra(s) ativa(s)[cite: 1]. Mova as obras para outra etapa antes de excluir.
                </p>
                <button
                  type="button"
                  onClick={() => setWorkStageToDelete(null)}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Entendido
                </button>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
                  <Trash2 size={22} />
                </div>
                <h4 className="font-bold text-slate-900 text-sm">Excluir Etapa de Obra</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Deseja excluir a etapa <strong className="text-slate-800">"{workStageToDelete.name}"</strong>? Ela não está sendo usada em nenhuma obra no momento.
                </p>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setWorkStageToDelete(null)}
                    className="flex-1 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={deletingWorkStage}
                    onClick={handleConfirmDeleteWorkStage}
                    className="flex-1 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-2xs flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {deletingWorkStage ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    <span>Excluir</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL INTERNO: EXCLUSÃO DE SERVIÇO */}
      {serviceToDelete && (
        <div className="fixed inset-0 z-[290] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <Trash2 size={22} />
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Excluir Serviço</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Deseja excluir o tipo de serviço <strong className="text-slate-800">"{serviceToDelete.name}"</strong>?
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setServiceToDelete(null)}
                className="flex-1 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingService}
                onClick={handleConfirmDeleteService}
                className="flex-1 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-2xs flex items-center justify-center gap-1 cursor-pointer"
              >
                {deletingService ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                <span>Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SystemParamsModal;