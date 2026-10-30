import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { WorkGeneralDataTab } from './WorkGeneralDataTab';
import type { AssignedWorker } from './WorkGeneralDataTab';
import { WorkItemsTasksTab } from './WorkItemsTasksTab';
import { WorkScheduleTab } from './WorkScheduleTab';
import { WorkCustomSettingsModal } from './WorkCustomSettingsModal';
import { WorkOverviewTab } from './WorkOverviewTab';
import { WorkFinancialTab } from './WorkFinancialTab';
import WorkDailyLogsTab from './WorkDailyLogsTab';
import { DailyWorkLogModal } from './DailyWorkLogModal';
import {
  ArrowLeft,
  CheckSquare,
  CalendarRange,
  DollarSign,
  Loader2,
  AlertCircle,
  MoreVertical,
  Edit3,
  Trash2,
  PauseCircle,
  Save,
  X,
  Check,
  Settings,
  BookOpenCheck,
  LayoutDashboard,
  ChevronDown,
  FileText,
  ClipboardList
} from 'lucide-react';

export interface WorkDetailData {
  id: string;
  code?: string | null;
  title: string;
  stage: string;
  status: 'em_andamento' | 'concluida' | 'cancelada' | 'pausada';
  progress_percent: number;
  start_date?: string | null;
  estimated_completion_date?: string | null;
  actual_completion_date?: string | null;
  notes?: string | null;
  measurement_type?: 'por_subitem' | 'por_item' | 'sem_medicao';
  assigned_to?: string | null;
  contact_id?: string | null;
  opportunity_id?: string | null;
  template_id?: string | null;
  contact?: {
    id: string;
    display_name: string;
    type: 'person' | 'company';
    avatar_url?: string | null;
  } | null;
  assignee?: {
    id: string;
    full_name: string;
    email?: string | null;
    avatar_url?: string | null;
  } | null;
  opportunity?: {
    id: string;
    code?: string | null;
    title: string;
    final_value?: number | null;
    service_type?: string | null;
    commercial_owner?: {
      id: string;
      full_name: string;
      email?: string | null;
      avatar_url?: string | null;
    } | null;
  } | null;
}

interface WorkDetailViewProps {
  workId: string;
  onBack: () => void;
  onOpenContactModal?: (contactId: string) => void;
  onOpenOpportunityModal?: (opportunityId: string) => void;
  onUpdated?: () => void;
}

export const WorkDetailView: React.FC<WorkDetailViewProps> = ({
  workId,
  onBack,
  onOpenContactModal,
  onOpenOpportunityModal,
  onUpdated
}) => {
  const { user } = useAuth();
  const { permissions, loading: loadingPerms } = usePermissions();

  const [loading, setLoading] = useState(true);
  const [work, setWork] = useState<WorkDetailData | null>(null);
  const [stages, setStages] = useState<Array<{ id: string; name: string; color: string }>>([]);
  const [updatingStage, setUpdatingStage] = useState(false);

  // Responsividade
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [targetMainEl, setTargetMainEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const main = document.querySelector('main');
    if (main && !isMobile) {
      main.style.position = 'relative';
      setTargetMainEl(main);
    }
    return () => {
      if (main) main.style.position = '';
    };
  }, [isMobile]);

  // Colaboradores alocados
  const [assignedWorkers, setAssignedWorkers] = useState<AssignedWorker[]>([]);

  // Abas de Navegação
  const [activeTab, setActiveTab] = useState<'dados' | 'overview' | 'items' | 'schedule' | 'daily_logs' | 'financial'>('dados');

  // Menus
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const [isMobileActionSheetOpen, setIsMobileActionSheetOpen] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement>(null);

  const [isStageMenuOpen, setIsStageMenuOpen] = useState(false);
  const stageMenuRef = useRef<HTMLDivElement>(null);

  // Modais de Edição e Exclusão
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingWork, setDeletingWork] = useState(false);

  const [isCustomSettingsOpen, setIsCustomSettingsOpen] = useState(false);
  const [isDailyLogModalOpen, setIsDailyLogModalOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(target)) {
        setIsActionsMenuOpen(false);
      }
      if (stageMenuRef.current && !stageMenuRef.current.contains(target)) {
        setIsStageMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadStages = useCallback(async () => {
    const companyId = user?.company?.id;
    if (!companyId) return;

    try {
      const { data, error } = await supabase
        .from('work_pipeline_stages')
        .select('id, name, color')
        .eq('company_id', companyId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setStages(data || []);
    } catch (err) {
      console.warn('Erro ao carregar etapas de obra:', err);
    }
  }, [user?.company?.id]);

  const loadAssignedWorkers = useCallback(async () => {
    try {
      const { data: wmRecords, error: wmError } = await supabase
        .from('work_members')
        .select(`
          user_id,
          is_foreman,
          profile:profiles!user_id (
            id,
            full_name,
            role_title,
            avatar_url
          )
        `)
        .eq('work_id', workId);

      if (wmError) throw wmError;

      const workers: AssignedWorker[] = [];
      (wmRecords || []).forEach((r: any) => {
        const prof = Array.isArray(r.profile) ? r.profile[0] : r.profile;
        if (prof) {
          workers.push({
            id: prof.id,
            full_name: prof.full_name || 'Sem nome',
            role_title: prof.role_title || 'Colaborador',
            avatar_url: prof.avatar_url || null,
            is_foreman: Boolean(r.is_foreman)
          });
        }
      });

      workers.sort((a, b) => (a.is_foreman === b.is_foreman ? 0 : a.is_foreman ? -1 : 1));
      setAssignedWorkers(workers);
    } catch (err) {
      console.warn('Erro ao carregar colaboradores alocados na obra:', err);
    }
  }, [workId]);

  const loadWorkData = useCallback(async () => {
    try {
      setLoading(true);
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
          notes,
          measurement_type,
          assigned_to,
          contact_id,
          opportunity_id,
          template_id,
          contact:contacts!contact_id (
            id,
            display_name,
            type,
            avatar_url
          ),
          assignee:profiles!assigned_to (
            id,
            full_name,
            email,
            avatar_url
          ),
          opportunity:opportunities!opportunity_id (
            id,
            code,
            title,
            final_value,
            service_type,
            commercial_owner:profiles!assigned_to (
              id,
              full_name,
              email,
              avatar_url
            )
          )
        `)
        .eq('id', workId)
        .single();

      if (error) throw error;

      // Cálculo Dinâmico de Progresso para evitar valores zerados
      let calculatedProgress = data.progress_percent || 0;
      const { data: itemRecords } = await supabase
        .from('work_items')
        .select('id')
        .eq('work_id', workId);

      const itemIds = (itemRecords || []).map(i => i.id);
      if (itemIds.length > 0) {
        const { data: taskRecords } = await supabase
          .from('work_tasks')
          .select('status, has_progress_tracking, quantity_planned, quantity_executed')
          .in('work_item_id', itemIds);

        if (taskRecords && taskRecords.length > 0) {
          let score = 0;
          taskRecords.forEach(t => {
            if (t.status === 'concluida') {
              score += 1;
            } else if (t.has_progress_tracking && t.quantity_planned > 0) {
              score += Math.min(1, (t.quantity_executed || 0) / t.quantity_planned);
            }
          });
          calculatedProgress = Math.round((score / taskRecords.length) * 100);

          if (calculatedProgress !== data.progress_percent) {
            await supabase
              .from('works')
              .update({ progress_percent: calculatedProgress })
              .eq('id', workId);
          }
        }
      }

      const oppObj = Array.isArray(data.opportunity) ? data.opportunity[0] : data.opportunity;

      setWork({
        ...data,
        progress_percent: calculatedProgress,
        contact: Array.isArray(data.contact) ? data.contact[0] : data.contact,
        assignee: Array.isArray(data.assignee) ? data.assignee[0] : data.assignee,
        opportunity: oppObj ? {
          ...oppObj,
          commercial_owner: Array.isArray(oppObj.commercial_owner) ? oppObj.commercial_owner[0] : oppObj.commercial_owner
        } : null
      });

      setEditTitle(data.title || '');
      setEditStartDate(data.start_date || '');
      setEditDueDate(data.estimated_completion_date || '');
      setEditNotes(data.notes || '');

      await loadAssignedWorkers();
    } catch (err) {
      console.error('Erro ao carregar detalhes da obra:', err);
    } finally {
      setLoading(false);
    }
  }, [workId, loadAssignedWorkers]);

  useEffect(() => {
    loadWorkData();
    loadStages();
  }, [loadWorkData, loadStages]);

  const handleStageChange = async (newStageId: string) => {
    if (!work || !permissions.canEditWorkDetails) return;

    try {
      setUpdatingStage(true);
      setIsStageMenuOpen(false);
      const isDone = newStageId.toLowerCase().includes('concluid');

      const { error } = await supabase
        .from('works')
        .update({
          stage: newStageId,
          actual_completion_date: isDone ? new Date().toISOString().split('T')[0] : null,
          progress_percent: isDone ? 100 : work.progress_percent,
          updated_at: new Date().toISOString()
        })
        .eq('id', work.id);

      if (error) throw error;

      setWork(prev => prev ? {
        ...prev,
        stage: newStageId,
        progress_percent: isDone ? 100 : prev.progress_percent
      } : null);

      onUpdated?.();
    } catch (err: any) {
      console.error('Erro ao atualizar etapa:', err);
      alert('Falha ao mudar etapa da obra.');
    } finally {
      setUpdatingStage(false);
    }
  };

  const handleTogglePause = async () => {
    if (!work || !permissions.canEditWorkDetails) return;
    const newStatus = work.status === 'pausada' ? 'em_andamento' : 'pausada';

    try {
      const { error } = await supabase
        .from('works')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', work.id);

      if (error) throw error;

      setWork(prev => prev ? { ...prev, status: newStatus } : null);
      setIsActionsMenuOpen(false);
      setIsMobileActionSheetOpen(false);
      onUpdated?.();
    } catch (err: any) {
      alert('Erro ao alterar status da obra: ' + err.message);
    }
  };

  const handleConfirmDeleteWork = async () => {
    if (!work || !permissions.canDeleteWorks) return;

    try {
      setDeletingWork(true);
      const { error } = await supabase
        .from('works')
        .delete()
        .eq('id', work.id);

      if (error) throw error;

      setIsDeleteModalOpen(false);
      onUpdated?.();
      onBack();
    } catch (err: any) {
      alert('Erro ao excluir obra: ' + err.message);
    } finally {
      setDeletingWork(false);
    }
  };

  const handleSaveEditModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!work || !editTitle.trim() || !permissions.canEditWorkDetails) return;

    try {
      setSavingEdit(true);
      const { error } = await supabase
        .from('works')
        .update({
          title: editTitle.trim(),
          start_date: editStartDate || null,
          estimated_completion_date: editDueDate || null,
          notes: editNotes.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', work.id);

      if (error) throw error;

      setWork(prev => prev ? {
        ...prev,
        title: editTitle.trim(),
        start_date: editStartDate || null,
        estimated_completion_date: editDueDate || null,
        notes: editNotes.trim() || null
      } : null);

      setIsEditModalOpen(false);
      onUpdated?.();
    } catch (err: any) {
      alert('Erro ao salvar alterações: ' + err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading || loadingPerms) {
    return (
      <div className="flex-1 flex items-center justify-center h-full text-slate-400 text-xs">
        <Loader2 size={20} className="animate-spin text-sky-600 mr-2" />
        <span>Carregando detalhes da obra...</span>
      </div>
    );
  }

  if (!work) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertCircle size={36} className="text-amber-500 mb-2" />
        <h3 className="font-bold text-slate-800 text-sm">Obra não encontrada</h3>
        <p className="text-xs text-slate-500 mt-1 mb-4">O registro solicitado pode ter sido excluído.</p>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 cursor-pointer"
        >
          Voltar para as Obras
        </button>
      </div>
    );
  }

  const currentStageObj = stages.find(s => s.id === work.stage || s.name.toLowerCase() === work.stage.toLowerCase());

  const resolvedContractAmount =
    work.opportunity?.final_value ||
    (work as any).contract_amount ||
    (work as any).budget_amount ||
    0;

  const mainContent = (
    <div className={`bg-slate-100 flex flex-col overflow-hidden animate-in fade-in duration-150 ${
      isMobile ? 'fixed inset-0 z-[150] w-screen h-screen' : 'absolute inset-0'
    }`}>
      
      {/* 1. TOPBAR MOBILE */}
      <div className="flex lg:hidden items-center justify-between px-3.5 py-2.5 bg-white border-b border-slate-200/90 shrink-0 z-30 shadow-2xs">
        <button
          type="button"
          onClick={onBack}
          className="w-8 h-8 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 hover:text-slate-900 transition cursor-pointer shadow-2xs"
          title="Voltar"
        >
          <ArrowLeft size={16} />
        </button>

        <span className="text-xs font-black text-slate-800 tracking-tight uppercase">
          Detalhes da Obra
        </span>

        <button
          type="button"
          onClick={() => setIsMobileActionSheetOpen(true)}
          className="w-8 h-8 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 hover:text-slate-900 transition cursor-pointer shadow-2xs"
          title="Opções da Obra"
        >
          <MoreVertical size={16} />
        </button>
      </div>

      {/* 2. BLOCO DE IDENTIFICAÇÃO NO MOBILE */}
      <div className="lg:hidden bg-white px-4 py-3 border-b border-slate-200/80 shrink-0 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <h1 className="text-base font-black text-slate-900 leading-tight truncate">
              {work.title}
            </h1>
            <div className="flex items-center gap-1.5 flex-wrap">
              {work.code && (
                <span className="font-mono text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-md">
                  {work.code}
                </span>
              )}
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border shrink-0 ${
                work.status === 'concluida'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : work.status === 'pausada'
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : work.status === 'cancelada'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-sky-50 text-sky-700 border-sky-200'
              }`}>
                {work.status === 'em_andamento'
                  ? 'Em Execução'
                  : work.status === 'pausada'
                  ? '⏸️ Pausada'
                  : work.status === 'concluida'
                  ? '🏆 Concluída'
                  : 'Cancelada'}
              </span>
            </div>
          </div>

          <div className="relative shrink-0" ref={stageMenuRef}>
            <button
              type="button"
              disabled={updatingStage || !permissions.canEditWorkDetails}
              onClick={() => permissions.canEditWorkDetails && setIsStageMenuOpen(!isStageMenuOpen)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
              style={{ borderLeft: currentStageObj?.color ? `4px solid ${currentStageObj.color}` : '4px solid #0ea5e9' }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: currentStageObj?.color || '#0ea5e9' }} />
              <span className="truncate max-w-[100px]">{currentStageObj?.name || work.stage}</span>
              <ChevronDown size={12} className="text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. CABEÇALHO DESKTOP COMPACTO */}
      <header className="hidden lg:block bg-white border-b border-slate-200/90 px-6 py-3.5 shrink-0 shadow-2xs z-30">
        <div className="flex items-center justify-between gap-4">
          
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-black text-slate-900 leading-tight truncate">
                {work.title}
              </h1>
              {work.code && (
                <span className="font-mono text-[11px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-lg shrink-0">
                  {work.code}
                </span>
              )}
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shrink-0 ${
                work.status === 'concluida'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : work.status === 'pausada'
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : work.status === 'cancelada'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-sky-50 text-sky-700 border-sky-200'
              }`}>
                {work.status === 'em_andamento'
                  ? 'Em Execução'
                  : work.status === 'pausada'
                  ? '⏸️ Pausada'
                  : work.status === 'concluida'
                  ? '🏆 Concluída'
                  : 'Cancelada'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            
            {/* Seletor de Etapa */}
            <div className="relative" ref={stageMenuRef}>
              <button
                type="button"
                disabled={updatingStage || !permissions.canEditWorkDetails}
                onClick={() => permissions.canEditWorkDetails && setIsStageMenuOpen(!isStageMenuOpen)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 transition ${
                  permissions.canEditWorkDetails ? 'hover:bg-slate-100 cursor-pointer' : 'cursor-default'
                }`}
                style={{ borderLeft: currentStageObj?.color ? `4px solid ${currentStageObj.color}` : '4px solid #0ea5e9' }}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: currentStageObj?.color || '#0ea5e9' }}
                />
                <span className="truncate max-w-[130px]">
                  {currentStageObj?.name || work.stage}
                </span>
                {updatingStage ? (
                  <Loader2 size={12} className="animate-spin text-sky-600" />
                ) : permissions.canEditWorkDetails ? (
                  <ChevronDown size={13} className={`text-slate-400 transition-transform ${isStageMenuOpen ? 'rotate-180' : ''}`} />
                ) : null}
              </button>

              {isStageMenuOpen && permissions.canEditWorkDetails && (
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-slate-200 rounded-2xl shadow-xl py-1.5 z-50 text-xs animate-in fade-in duration-100">
                  <span className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Mudar para a etapa:
                  </span>
                  {stages.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => handleStageChange(st.id)}
                      className={`w-full text-left px-3 py-1.5 flex items-center justify-between gap-2 font-medium cursor-pointer transition ${
                        work.stage === st.id ? 'bg-sky-50 text-sky-800 font-bold' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: st.color }} />
                        <span className="truncate">{st.name}</span>
                      </div>
                      {work.stage === st.id && <Check size={13} className="text-sky-600 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Menu (...) */}
            <div className="relative" ref={actionsMenuRef}>
              <button
                type="button"
                onClick={() => setIsActionsMenuOpen(!isActionsMenuOpen)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200 transition cursor-pointer shadow-2xs"
                title="Mais opções"
              >
                <MoreVertical size={16} />
              </button>

              {isActionsMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-slate-200 rounded-2xl shadow-xl py-1 z-50 text-xs animate-in fade-in duration-100">
                  {permissions.canCustomizeSystem && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsActionsMenuOpen(false);
                        setIsCustomSettingsOpen(true);
                      }}
                      className="w-full text-left px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium cursor-pointer"
                    >
                      <Settings size={14} className="text-sky-600" />
                      <span>Parâmetros e Cadastros</span>
                    </button>
                  )}

                  {permissions.canEditWorkDetails && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setIsActionsMenuOpen(false);
                          setIsEditModalOpen(true);
                        }}
                        className="w-full text-left px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium cursor-pointer"
                      >
                        <Edit3 size={14} className="text-slate-500" />
                        <span>Editar Informações</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleTogglePause}
                        className="w-full text-left px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium cursor-pointer"
                      >
                        <PauseCircle size={14} className="text-amber-500" />
                        <span>{work.status === 'pausada' ? 'Retomar Obra' : 'Pausar Obra'}</span>
                      </button>
                    </>
                  )}

                  {permissions.canDeleteWorks && (
                    <>
                      <div className="border-t border-slate-100 my-1" />
                      <button
                        type="button"
                        onClick={() => {
                          setIsActionsMenuOpen(false);
                          setIsDeleteModalOpen(true);
                        }}
                        className="w-full text-left px-3.5 py-2 text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-medium cursor-pointer"
                      >
                        <Trash2 size={14} />
                        <span>Excluir Obra</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Fechar (X) */}
            <button
              type="button"
              onClick={onBack}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              title="Fechar detalhes da obra"
            >
              <X size={20} />
            </button>

          </div>
        </div>
      </header>

      {/* 4. BARRA DE NAVEGAÇÃO DAS ABAS (COM A ABA DIÁRIOS) */}
      <div className="bg-white border-b border-slate-200/90 px-4 sm:px-6 shrink-0 overflow-x-auto no-scrollbar shadow-2xs">
        <div className="flex items-center gap-4 sm:gap-6 text-xs font-bold">
          
          <button
            type="button"
            onClick={() => setActiveTab('dados')}
            className={`py-3 sm:py-3.5 border-b-2 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'dados' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText size={15} />
            <span>Dados gerais</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`py-3 sm:py-3.5 border-b-2 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'overview' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <LayoutDashboard size={15} />
            <span>Visão geral</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('items')}
            className={`py-3 sm:py-3.5 border-b-2 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'items' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CheckSquare size={15} />
            <span>Itens</span>
          </button>

          {permissions.canViewSchedule && (
            <button
              type="button"
              onClick={() => setActiveTab('schedule')}
              className={`py-3 sm:py-3.5 border-b-2 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'schedule' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <CalendarRange size={15} />
              <span>Cronograma</span>
            </button>
          )}

          {/* NOVA ABA: DIÁRIOS DE OBRA */}
          <button
            type="button"
            onClick={() => setActiveTab('daily_logs')}
            className={`py-3 sm:py-3.5 border-b-2 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'daily_logs' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ClipboardList size={15} />
            <span>Diários</span>
          </button>

          {permissions.canViewWorkFinancial && (
            <button
              type="button"
              onClick={() => setActiveTab('financial')}
              className={`py-3 sm:py-3.5 border-b-2 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'financial' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <DollarSign size={15} />
              <span>Financeiro</span>
            </button>
          )}

        </div>
      </div>

      {/* 5. CORPO COM O CONTEÚDO DAS ABAS EM LARGURA TOTAL */}
      <main className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 bg-slate-50/70">
        
        {activeTab === 'dados' && (
          <WorkGeneralDataTab
            work={work}
            assignedWorkers={assignedWorkers}
            canCustomizeSystem={permissions.canCustomizeSystem}
            onOpenContactModal={onOpenContactModal}
            onOpenOpportunityModal={onOpenOpportunityModal}
            onOpenSettings={() => setIsCustomSettingsOpen(true)}
          />
        )}

        {activeTab === 'overview' && (
          <WorkOverviewTab 
            workId={work.id}
            contractAmount={resolvedContractAmount}
            startDate={work.start_date}
            targetDate={work.estimated_completion_date}
            initialNotes={work.notes}
            onNavigateTab={(tab) => {
              if (tab === 'items') setActiveTab('items');
              else if (tab === 'finance' && permissions.canViewWorkFinancial) setActiveTab('financial');
              else if (tab === 'schedule' && permissions.canViewSchedule) setActiveTab('schedule');
              else setActiveTab(tab as any);
            }}
          />
        )}

        {activeTab === 'items' && (
          <WorkItemsTasksTab
            workId={work.id}
            measurementType={work.measurement_type}
            onProgressUpdated={(newProg) => {
              setWork(prev => prev ? { ...prev, progress_percent: newProg } : null);
              onUpdated?.();
            }}
          />
        )}

        {activeTab === 'schedule' && permissions.canViewSchedule && (
          <WorkScheduleTab 
            workId={work.id} 
            workTitle={work.title}
            workCode={work.code}
          />
        )}

        {/* RENDERIZAÇÃO DA ABA DIÁRIOS */}
        {activeTab === 'daily_logs' && (
          <WorkDailyLogsTab 
            workId={work.id}
            onOpenNewLog={() => setIsDailyLogModalOpen(true)}
          />
        )}

        {activeTab === 'financial' && permissions.canViewWorkFinancial && (
          <WorkFinancialTab 
            workId={work.id}
            contractAmount={resolvedContractAmount}
            measurementType={work.measurement_type || 'por_subitem'}
          />
        )}

      </main>

      {/* ACTION SHEET MOBILE (...) */}
      {isMobileActionSheetOpen && (
        <div className="lg:hidden fixed inset-0 z-[180] flex flex-col justify-end bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div 
            className="absolute inset-0" 
            onClick={() => setIsMobileActionSheetOpen(false)} 
          />

          <div className="relative bg-white rounded-t-3xl p-5 space-y-3 animate-in slide-in-from-bottom duration-200 border-t border-slate-200">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-2" />

            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
              Opções da Obra
            </h3>

            {permissions.canEditWorkDetails && stages.length > 0 && (
              <div className="pb-3 border-b border-slate-100 space-y-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Etapa da Obra:
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {stages.map(st => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => {
                        setIsMobileActionSheetOpen(false);
                        handleStageChange(st.id);
                      }}
                      className={`p-2 rounded-xl text-xs font-semibold flex items-center justify-between border transition ${
                        work.stage === st.id
                          ? 'bg-sky-50 text-sky-800 border-sky-300 font-bold'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: st.color }} />
                        <span className="truncate">{st.name}</span>
                      </div>
                      {work.stage === st.id && <Check size={12} className="text-sky-600 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2 pt-1">
              {permissions.canCustomizeSystem && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileActionSheetOpen(false);
                    setIsCustomSettingsOpen(true);
                  }}
                  className="w-full p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center gap-3 text-slate-800 font-semibold text-xs transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                    <Settings size={18} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-slate-900">Parâmetros e Cadastros</p>
                    <p className="text-[11px] text-slate-500 font-normal">Equipe, locais e medição</p>
                  </div>
                </button>
              )}

              {permissions.canEditWorkDetails && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileActionSheetOpen(false);
                      setIsEditModalOpen(true);
                    }}
                    className="w-full p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center gap-3 text-slate-800 font-semibold text-xs transition-colors"
                  >
                    <div className="w-9 h-9 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                      <Edit3 size={18} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-slate-900">Editar Obra</p>
                      <p className="text-[11px] text-slate-500 font-normal">Título, prazos e notas</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={handleTogglePause}
                    className="w-full p-3 bg-amber-50 hover:bg-amber-100 rounded-2xl flex items-center gap-3 text-amber-900 font-semibold text-xs transition-colors"
                  >
                    <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                      <PauseCircle size={18} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-amber-950">
                        {work.status === 'pausada' ? 'Retomar Obra' : 'Pausar Obra'}
                      </p>
                      <p className="text-[11px] text-amber-700 font-normal">Alternar estado operacional</p>
                    </div>
                  </button>
                </>
              )}

              {permissions.canDeleteWorks && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileActionSheetOpen(false);
                    setIsDeleteModalOpen(true);
                  }}
                  className="w-full p-3 bg-rose-50 hover:bg-rose-100 rounded-2xl flex items-center gap-3 text-rose-900 font-semibold text-xs transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                    <Trash2 size={18} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-rose-950">Excluir Obra</p>
                    <p className="text-[11px] text-rose-600 font-normal">Remover esta obra permanentemente</p>
                  </div>
                </button>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsMobileActionSheetOpen(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR INFORMAÇÕES DA OBRA */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-base">Editar Obra</h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEditModal} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Título da Obra *</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Data de Início</label>
                  <input
                    type="date"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Previsão Conclusão</label>
                  <input
                    type="date"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Observações Operacionais</label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-sky-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-white bg-sky-600 hover:bg-sky-500 rounded-xl font-semibold shadow-2xs cursor-pointer active:scale-98 disabled:opacity-50"
                >
                  {savingEdit ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>Salvar Alterações</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR EXCLUSÃO DE OBRA */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-150 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <Trash2 size={22} />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-900 leading-tight">
                Excluir Obra
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Tem certeza que deseja excluir a obra <strong className="text-slate-800 font-bold">"{work.title}"</strong>? Esta ação removerá a estrutura de tarefas associada e não poderá ser desfeita.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                disabled={deletingWork}
                onClick={() => setIsDeleteModalOpen(false)}
                className="w-1/2 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingWork}
                onClick={handleConfirmDeleteWork}
                className="w-1/2 inline-flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-2xs transition-colors cursor-pointer active:scale-98 disabled:opacity-50"
              >
                {deletingWork ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PARÂMETROS E CADASTROS OPERACIONAIS */}
      <WorkCustomSettingsModal
        isOpen={isCustomSettingsOpen}
        onClose={() => setIsCustomSettingsOpen(false)}
        workId={work.id}
        currentMeasurementType={work.measurement_type}
        onUpdated={loadWorkData}
      />

      {/* BOTÃO FLUTUANTE DIÁRIO DE OBRA GLOBAL */}
      {permissions.canCompleteWorkTasks && (
        <button
          type="button"
          onClick={() => setIsDailyLogModalOpen(true)}
          className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-[90] flex items-center gap-2.5 px-4 py-3 sm:px-6 sm:py-4 bg-sky-600 hover:bg-sky-500 text-white rounded-full shadow-[0_10px_40px_rgba(2,132,199,0.4)] transition-all hover:-translate-y-1 hover:shadow-[0_15px_50px_rgba(2,132,199,0.5)] cursor-pointer font-bold group"
          title="Lançar Diário de Obra"
        >
          <BookOpenCheck size={24} className="group-hover:scale-110 transition-transform" />
          <span className="hidden sm:inline text-sm tracking-wide">
            Diário de Obra
          </span>
        </button>
      )}

      {/* MODAL GLOBAL DO DIÁRIO DE OBRA */}
      <DailyWorkLogModal
        isOpen={isDailyLogModalOpen}
        onClose={() => setIsDailyLogModalOpen(false)}
        defaultWorkId={workId}
        onSaved={() => {
          loadWorkData();
        }}
      />
    </div>
  );

  return (isMobile || !targetMainEl)
    ? createPortal(mainContent, document.body)
    : createPortal(mainContent, targetMainEl);
};

export default WorkDetailView;