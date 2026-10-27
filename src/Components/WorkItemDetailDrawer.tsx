import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { WorkItem, WorkTask } from './WorkItemRow';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  X,
  Calendar,
  DollarSign,
  Plus,
  CheckSquare,
  Square,
  FileText,
  Trash2,
  Save,
  Loader2,
  Sliders,
  Paperclip,
  Upload,
  Image as ImageIcon,
  ExternalLink,
  Lock,
  MoreVertical,
  Unlink,
  ChevronDown,
  CheckCircle2,
  Users,
  UserCheck,
  PlayCircle,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  role?: string;
  team_id?: string | null;
  avatar_url?: string | null;
}

interface CompanyTeam {
  id: string;
  name: string;
}

export interface DailyEntryPayload {
  taskId: string;
  itemId: string;
  date: string;
  quantity: number;
  teamId: string | null;
  executors: string[];
  notes: string;
  isChecklistComplete: boolean;
}

interface WorkItemDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  item: WorkItem | null;
  measurementType: 'por_subitem' | 'por_item' | 'sem_medicao';
  allItems?: WorkItem[];
  allTasks?: WorkTask[];
  teamMembers?: TeamMember[];
  companyTeams?: CompanyTeam[];
  onItemUpdated: () => void;
  onToggleTaskStatus: (item: WorkItem, task: WorkTask) => void;
  onUpdateTaskExecutedQty: (item: WorkItem, task: WorkTask, rawVal: string) => void;
  onOpenCreateChildModal?: (parentId: string, parentTitle: string) => void;
  onSaveTaskEntry?: (payload: DailyEntryPayload) => Promise<void>;
  onOpenBlockTaskModal?: (task: WorkTask, parentItemId: string) => void;
  onUnblockTask?: (task: WorkTask) => void;
  onSaveInlineTask: (
    itemId: string,
    title: string,
    hasProgress: boolean,
    plannedQty: string,
    unit: string,
    price: string,
    startDate?: string,
    dueDate?: string,
    dependsOnId?: string,
    description?: string,
    taskType?: string,
    isBlocked?: boolean,
    blockReason?: string
  ) => void;
  canCompleteTasks?: boolean;
  canReopenTasks?: boolean;
  canAssignExecutors?: boolean;
}

interface AttachmentFile {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'file';
  size?: number;
  created_at: string;
}

const UNIT_OPTIONS = [
  { value: 'un', label: 'Unidade (un)' },
  { value: 'm', label: 'Metros (m)' },
  { value: 'm²', label: 'Metros Quadrados (m²)' },
  { value: 'm³', label: 'Metros Cúbicos (m³)' },
  { value: 'kg', label: 'Quilogramas (kg)' },
  { value: 'horas', label: 'Horas (h)' },
  { value: 'serv', label: 'Serviço (serv)' }
];

const formatCurrencyInput = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  const num = (parseInt(digits, 10) / 100).toFixed(2);
  return num
    .replace('.', ',')
    .replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
};

const getInitials = (name: string) => {
  if (!name) return 'EX';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const WorkItemDetailDrawer: React.FC<WorkItemDetailDrawerProps> = ({
  isOpen,
  onClose,
  item,
  measurementType,
  allItems = [],
  allTasks = [],
  teamMembers = [],
  companyTeams = [],
  onItemUpdated,
  onToggleTaskStatus,
  onOpenCreateChildModal,
  onSaveTaskEntry,
  onOpenBlockTaskModal,
  onUnblockTask,
  onSaveInlineTask,
  canCompleteTasks = true,
  canReopenTasks = true,
  canAssignExecutors = true
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'detalhes' | 'subtarefas' | 'anexos' | 'diario'>('detalhes');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Estados do Item Principal
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState('nao_iniciado');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);

  // Formulário de Nova Subtarefa
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskSubitemType, setNewTaskSubitemType] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskPlannedQty, setNewTaskPlannedQty] = useState('1');
  const [newTaskUnit, setNewTaskUnit] = useState('un');
  const [newTaskPrice, setNewTaskPrice] = useState('');
  const [newTaskHasProgress, setNewTaskHasProgress] = useState(false);
  const [newTaskStartDate, setNewTaskStartDate] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskDependsOnId, setNewTaskDependsOnId] = useState('');
  const [newTaskExecutors, setNewTaskExecutors] = useState<string[]>([]);
  const [createAsBlocked, setCreateAsBlocked] = useState(false);
  const [createBlockReason, setCreateBlockReason] = useState('');

  // Dropdowns
  const [isDepDropdownOpen, setIsDepDropdownOpen] = useState(false);
  const [depSearchTerm, setDepSearchTerm] = useState('');
  const depDropdownRef = useRef<HTMLDivElement>(null);

  // Menu de Ações por Tarefa
  const [openTaskMenuId, setOpenTaskMenuId] = useState<string | null>(null);

  // Estados do Modal de Apontamento Diário
  const [completingTask, setCompletingTask] = useState<WorkTask | null>(null);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryQty, setEntryQty] = useState('');
  const [entryTeamId, setEntryTeamId] = useState<string>('all');
  const [entryNotes, setEntryNotes] = useState('');
  const [selectedExecutors, setSelectedExecutors] = useState<string[]>([]);
  const [isSavingEntry, setIsSavingEntry] = useState(false);
  const [checklistAction, setChecklistAction] = useState<'progress' | 'complete'>('complete');

  useEffect(() => {
    if (item) {
      setTitle(item.title || '');
      setCode(item.code || '');
      setStatus(item.status || 'nao_iniciado');
      setStartDate(item.start_date || '');
      setDueDate(item.due_date || '');
      setUnitPrice(item.unit_price ? item.unit_price.toString() : '');
      setDescription((item as any).description || '');
      setNotes((item as any).notes || '');
      setAttachments((item as any).attachments || []);

      setNewTaskStartDate(item.start_date || '');
      setNewTaskDueDate(item.due_date || '');
    }
  }, [item]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (depDropdownRef.current && !depDropdownRef.current.contains(e.target as Node)) {
        setIsDepDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen || !item) return null;

  // Lógica de bloqueio do item pai
  const parentDependencyItem = allItems.find(i => i.id === item.depends_on_item_id);
  const isItemBlocked = parentDependencyItem ? parentDependencyItem.progress_percent < 100 : false;

  // Opções de dependência para subtarefas
  const availableTasksList = (item.tasks || []).concat(allTasks.filter(t => t.work_item_id !== item.id));
  const filteredNewTaskDeps = availableTasksList.filter(
    t => t.title.toLowerCase().includes(depSearchTerm.toLowerCase())
  );
  const selectedNewDepObj = availableTasksList.find(t => t.id === newTaskDependsOnId);

  const filteredTeamMembers = entryTeamId === 'all' 
    ? teamMembers 
    : teamMembers.filter(m => m.team_id === entryTeamId);

  // AÇÃO: CONCLUIR TODOS OS SUBITENS E O ITEM PAI (GERA DIÁRIO EM LOTE)
  const handleCompleteAll = async () => {
    if (!confirm('Deseja marcar este equipamento e TODAS as suas subtarefas como 100% concluídos?')) return;

    try {
      setSaving(true);
      const companyId = (item as any).company_id || user?.company?.id;
      const pendingTasks = item.tasks?.filter(t => t.status !== 'concluida') || [];
      
      if (pendingTasks.length > 0) {
        const entriesPayload = pendingTasks.map(t => {
          const remaining = t.has_progress_tracking ? Math.max(0, t.quantity_planned - (t.quantity_executed || 0)) : 1;
          return {
            company_id: companyId,
            work_id: (item as any).work_id,
            work_item_id: item.id,
            work_task_id: t.id,
            entry_date: new Date().toISOString().split('T')[0],
            quantity_executed: remaining,
            executed_by: [],
            created_by: user?.profile?.id || null,
          };
        });
        
        await supabase.from('work_task_entries').insert(entriesPayload);
      }

      await supabase
        .from('work_items')
        .update({
          status: 'concluido',
          progress_percent: 100,
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id);

      onItemUpdated();
    } catch (err: any) {
      alert('Erro ao concluir todos os itens: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveItem = async () => {
    try {
      setSaving(true);
      const parsedPrice = parseFloat(unitPrice.replace(/\./g, '').replace(',', '.')) || 0;

      const { error } = await supabase
        .from('work_items')
        .update({
          title: title.trim(),
          code: code.trim() || null,
          status,
          start_date: startDate || null,
          due_date: dueDate || null,
          unit_price: parsedPrice,
          description: description.trim() || null,
          notes: notes.trim() || null,
          attachments,
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id);

      if (error) throw error;
      onItemUpdated();
    } catch (err: any) {
      alert('Erro ao guardar alterações: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || isItemBlocked) return;

    if (createAsBlocked && !createBlockReason.trim()) {
      alert('Informe o motivo da restrição para criar a tarefa como bloqueada.');
      return;
    }

    onSaveInlineTask(
      item.id,
      newTaskTitle.trim(),
      newTaskHasProgress,
      newTaskPlannedQty,
      newTaskUnit,
      newTaskPrice,
      newTaskStartDate || undefined,
      newTaskDueDate || undefined,
      newTaskDependsOnId || undefined,
      newTaskDescription.trim() || undefined,
      newTaskSubitemType || undefined,
      createAsBlocked,
      createBlockReason
    );

    setNewTaskTitle('');
    setNewTaskDescription('');
    setNewTaskExecutors([]);
    setNewTaskPrice('');
    setNewTaskPlannedQty('1');
    setNewTaskHasProgress(false);
    setNewTaskDependsOnId('');
    setCreateAsBlocked(false);
    setCreateBlockReason('');
    setIsAddingTask(false);
  };

  const toggleExecutorSelection = (memberName: string) => {
    setNewTaskExecutors(prev =>
      prev.includes(memberName) ? prev.filter(m => m !== memberName) : [...prev, memberName]
    );
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Deseja excluir esta subtarefa?')) return;
    try {
      setSaving(true);
      const { error } = await supabase.from('work_tasks').delete().eq('id', taskId);
      if (error) throw error;
      onItemUpdated();
    } catch (err: any) {
      alert('Erro ao excluir tarefa: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUnlinkTaskDependency = async (task: WorkTask) => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('work_tasks')
        .update({ depends_on_task_id: null })
        .eq('id', task.id);
      if (error) throw error;
      onItemUpdated();
    } catch (err: any) {
      alert('Erro ao desvincular dependência: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setUploading(true);
      const newAttachments: AttachmentFile[] = [...attachments];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${item.id}_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `items/${fileName}`;

        const { error: uploadErr } = await supabase.storage
          .from('work-attachments')
          .upload(filePath, file);

        if (uploadErr) throw uploadErr;

        const { data: publicUrlData } = supabase.storage
          .from('work-attachments')
          .getPublicUrl(filePath);

        newAttachments.push({
          id: fileName,
          name: file.name,
          url: publicUrlData.publicUrl,
          type: file.type.startsWith('image/') ? 'image' : 'file',
          size: file.size,
          created_at: new Date().toISOString()
        });
      }

      setAttachments(newAttachments);
      await supabase.from('work_items').update({ attachments: newAttachments }).eq('id', item.id);
      onItemUpdated();
    } catch (err: any) {
      alert('Erro ao carregar arquivo: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    try {
      const updatedAttachments = attachments.filter(a => a.id !== attachmentId);
      setAttachments(updatedAttachments);
      await supabase.from('work_items').update({ attachments: updatedAttachments }).eq('id', item.id);
      onItemUpdated();
    } catch (err: any) {
      alert('Erro ao remover anexo: ' + err.message);
    }
  };

  // NOVA LÓGICA DE APONTAMENTO
  const handleTaskCheckboxClick = (task: WorkTask) => {
    if (task.status === 'bloqueada') return;

    const isDone = task.status === 'concluida';
    if (isDone) {
      if (!canReopenTasks) return;
      onToggleTaskStatus(item, task); 
    } else {
      if (!canCompleteTasks) return;
      
      setCompletingTask(task);
      setSelectedExecutors(task.executed_by || []);
      setEntryDate(new Date().toISOString().split('T')[0]);
      setEntryNotes('');
      setEntryTeamId('all');

      if (task.has_progress_tracking) {
        const remaining = Math.max(0, task.quantity_planned - (task.quantity_executed || 0));
        setEntryQty(remaining.toString());
      } else {
        setChecklistAction('complete');
        setEntryQty('1');
      }
    }
  };

  const handleConfirmCompletion = async () => {
    if (!completingTask) return;
    
    try {
      setIsSavingEntry(true);
      if (onSaveTaskEntry) {
        const parsedQty = parseFloat(entryQty.replace(',', '.'));
        if (isNaN(parsedQty) || (parsedQty <= 0 && checklistAction === 'complete')) {
          alert('Para concluir, a quantidade executada deve ser maior que zero.');
          setIsSavingEntry(false);
          return;
        }
        await onSaveTaskEntry({
          taskId: completingTask.id,
          itemId: item.id,
          date: entryDate,
          quantity: parsedQty,
          teamId: entryTeamId !== 'all' ? entryTeamId : null,
          executors: selectedExecutors,
          notes: entryNotes,
          isChecklistComplete: !completingTask.has_progress_tracking && checklistAction === 'complete'
        });
        onItemUpdated();
      } else {
        // Fallback
        onToggleTaskStatus(item, completingTask);
      }
      setCompletingTask(null);
    } catch(err) {
      console.error(err);
    } finally {
      setIsSavingEntry(false);
    }
  };

  const toggleModalExecutor = (memberName: string) => {
    if (!canAssignExecutors) return;
    setSelectedExecutors(prev =>
      prev.includes(memberName) ? prev.filter(m => m !== memberName) : [...prev, memberName]
    );
  };

  const isDone = item.progress_percent >= 100;

  return (
    <div className="fixed inset-0 z-[150] overflow-hidden bg-slate-950/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300">
        
        {/* CABEÇALHO DO DRAWER */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/80">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="font-mono text-xs font-bold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-100 shadow-2xs">
              {item.code || 'ITEM'}
            </span>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
              isDone
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : isItemBlocked
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-sky-50 text-sky-700 border-sky-200'
            }`}>
              {isDone ? 'Concluído' : isItemBlocked ? 'Aguardando Dependência' : 'Em Execução'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* BOTÃO CONCLUIR TUDO DA ESTRUTURA */}
            <button
              onClick={handleCompleteAll}
              disabled={saving || isDone}
              title="Concluir este item e todas as suas tarefas vinculadas de uma só vez"
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs disabled:opacity-50"
            >
              <CheckCircle2 size={15} className="text-emerald-600" />
              <span className="hidden sm:inline">Concluir Tudo</span>
            </button>

            <button
              onClick={handleSaveItem}
              disabled={saving}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs disabled:opacity-50 active:scale-98"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span>Guardar</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* NAVEGAÇÃO DE ABAS INTERNAS */}
        <div className="flex items-center gap-1 px-5 pt-3 border-b border-slate-100 shrink-0 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('detalhes')}
            className={`pb-2.5 px-3 text-xs font-bold transition cursor-pointer border-b-2 flex items-center gap-1.5 shrink-0 ${
              activeTab === 'detalhes'
                ? 'border-sky-600 text-sky-600'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <Sliders size={14} />
            <span>Atributos & Prazos</span>
          </button>
          <button
            onClick={() => setActiveTab('subtarefas')}
            className={`pb-2.5 px-3 text-xs font-bold transition cursor-pointer border-b-2 flex items-center gap-1.5 shrink-0 ${
              activeTab === 'subtarefas'
                ? 'border-sky-600 text-sky-600'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <CheckSquare size={14} />
            <span>Subtarefas</span>
            <span className="bg-slate-100 text-slate-600 font-bold px-1.5 py-0.2 rounded-full text-[10px]">
              {item.tasks?.length || 0}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('anexos')}
            className={`pb-2.5 px-3 text-xs font-bold transition cursor-pointer border-b-2 flex items-center gap-1.5 shrink-0 ${
              activeTab === 'anexos'
                ? 'border-sky-600 text-sky-600'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <Paperclip size={14} />
            <span>Fotos & Anexos</span>
            <span className="bg-slate-100 text-slate-600 font-bold px-1.5 py-0.2 rounded-full text-[10px]">
              {attachments.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('diario')}
            className={`pb-2.5 px-3 text-xs font-bold transition cursor-pointer border-b-2 flex items-center gap-1.5 shrink-0 ${
              activeTab === 'diario'
                ? 'border-sky-600 text-sky-600'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <FileText size={14} />
            <span>Diário / Descrição</span>
          </button>
        </div>

        {/* CONTEÚDO SCROLLÁVEL */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          
          {/* ABA DETALHES */}
          {activeTab === 'detalhes' && (
            <div className="space-y-4">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Nome do Item / Equipamento</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 text-sm focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Tag / Código</label>
                  <input
                    type="text"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    placeholder="Ex: M-01"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Status Operacional</label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 cursor-pointer"
                  >
                    <option value="nao_iniciado">Não iniciado</option>
                    <option value="em_andamento">Em andamento</option>
                    <option value="bloqueado">Parado / Bloqueado</option>
                    <option value="concluido">Concluído</option>
                  </select>
                </div>
              </div>

              {/* Banner de Bloqueio por Dependência */}
              {parentDependencyItem && isItemBlocked && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-amber-900">
                  <Lock size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <strong className="block font-bold">Item Bloqueado por Dependência</strong>
                    <span>Este equipamento aguarda a conclusão de <strong>"{parentDependencyItem.title}"</strong> ({parentDependencyItem.progress_percent}%) para ser liberado.</span>
                  </div>
                </div>
              )}

              {/* Prazos de Cronograma */}
              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
                <span className="font-bold text-slate-700 block flex items-center gap-1.5">
                  <Calendar size={13} className="text-sky-600" />
                  Datas Planeadas para o Cronograma
                </span>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Início das Atividades</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Prazo / Conclusão</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={e => setDueDate(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* Medição Financeira do Item */}
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Valor Previsto do Equipamento (R$)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 font-bold text-slate-400">R$</span>
                  <input
                    type="text"
                    value={unitPrice}
                    onChange={e => setUnitPrice(formatCurrencyInput(e.target.value))}
                    placeholder="0,00"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-900 text-sm focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              {/* Barra de Progresso Físico */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
                <div className="flex justify-between font-bold">
                  <span className="text-slate-600">Avanço Físico Apurado</span>
                  <span className="text-sky-600 font-black text-sm">{item.progress_percent}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      item.progress_percent >= 100 ? 'bg-emerald-500' : 'bg-sky-500'
                    }`}
                    style={{ width: `${item.progress_percent}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ABA SUBTAREFAS */}
          {activeTab === 'subtarefas' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-1">
                <div>
                  <h4 className="font-bold text-slate-800 text-xs">Subtarefas & Checklist de Campo</h4>
                  <p className="text-[11px] text-slate-400">Gerencie o avanço, executores, prazos e bloqueios</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddingTask(true)}
                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
                >
                  <Plus size={14} />
                  <span>Nova Subtarefa</span>
                </button>
              </div>

              {/* FORMULÁRIO DE NOVA SUBTAREFA */}
              {isAddingTask && (
                <form onSubmit={handleCreateTaskSubmit} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-200/60">
                    <span className="font-bold text-slate-800 text-xs">Nova Subtarefa</span>
                    <button type="button" onClick={() => setIsAddingTask(false)} className="text-slate-400 hover:text-slate-600 p-1">
                      <X size={14} />
                    </button>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-500 font-bold mb-1">Título da Atividade *</label>
                    <input
                      type="text"
                      autoFocus
                      required
                      placeholder="Ex: Passagem de cabos CC..."
                      value={newTaskTitle}
                      onChange={e => setNewTaskTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-xs"
                    />
                  </div>

                  {/* CAMPO DE DESCRIÇÃO DA ATIVIDADE */}
                  <div>
                    <label className="block text-[10px] text-slate-500 font-bold mb-1">Descrição do Serviço / Atividade a Realizar</label>
                    <textarea
                      rows={2}
                      placeholder="Detalhes dos procedimentos, normas de segurança ou instrução técnica..."
                      value={newTaskDescription}
                      onChange={e => setNewTaskDescription(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium resize-none"
                    />
                  </div>

                  {/* BLOQUEAR AO CRIAR */}
                  <div className="flex items-center gap-2 mt-1 border-t border-slate-100 pt-2">
                    <label className="flex items-center gap-1.5 text-slate-700 font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={createAsBlocked}
                        onChange={(e) => setCreateAsBlocked(e.target.checked)}
                        className="rounded text-rose-600 focus:ring-rose-500"
                      />
                      <span className="text-[11px] font-bold text-rose-700 flex items-center gap-1">
                        <ShieldAlert size={12} /> Começar como Bloqueada (Com Restrição)
                      </span>
                    </label>
                  </div>

                  {createAsBlocked && (
                    <div className="p-2 bg-rose-50 border border-rose-200 rounded-xl mt-1">
                      <label className="block text-[10px] text-rose-800 font-bold mb-1">Qual é a restrição / motivo do bloqueio? *</label>
                      <input
                        type="text"
                        required={createAsBlocked}
                        value={createBlockReason}
                        onChange={e => setCreateBlockReason(e.target.value)}
                        placeholder="Ex: Aguardando aprovação do projeto estrutural..."
                        className="w-full px-3 py-1.5 bg-white border border-rose-200 rounded-lg focus:ring-2 focus:ring-rose-500 text-xs font-medium"
                      />
                    </div>
                  )}

                  {/* CAMPO DE SELEÇÃO MULTI-EXECUTORES */}
                  <div>
                    <label className="block text-[10px] text-slate-500 font-bold mb-1 flex items-center gap-1 mt-2">
                      <Users size={12} className="text-sky-600" />
                      <span>Membros / Executores Responsáveis (Múltiplos)</span>
                    </label>
                    
                    {teamMembers.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 bg-white border border-slate-200 rounded-xl">
                        {teamMembers.map(member => {
                          const isSelected = newTaskExecutors.includes(member.name);
                          return (
                            <button
                              type="button"
                              key={member.id}
                              onClick={() => toggleExecutorSelection(member.name)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition flex items-center gap-1 cursor-pointer ${
                                isSelected
                                  ? 'bg-sky-50 text-sky-700 border-sky-300 font-bold'
                                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <UserCheck size={12} className={isSelected ? 'text-sky-600' : 'text-slate-400'} />
                              <span>{member.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <input
                        type="text"
                        placeholder="Nomes dos executores separados por vírgula (Ex: João, Pedro)..."
                        value={newTaskExecutors.join(', ')}
                        onChange={e => setNewTaskExecutors(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium"
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-3 py-1 mt-1">
                    <label className="flex items-center gap-1.5 text-slate-700 font-medium cursor-pointer">
                      <input
                        type="radio"
                        checked={!newTaskHasProgress}
                        onChange={() => setNewTaskHasProgress(false)}
                        className="text-sky-600"
                      />
                      <span>Checklist Simples</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-slate-700 font-medium cursor-pointer">
                      <input
                        type="radio"
                        checked={newTaskHasProgress}
                        onChange={() => setNewTaskHasProgress(true)}
                        className="text-sky-600"
                      />
                      <span>Quantitativo (Progresso)</span>
                    </label>
                  </div>

                  {newTaskHasProgress && (
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Meta (ex: 100)"
                        value={newTaskPlannedQty}
                        onChange={e => setNewTaskPlannedQty(e.target.value)}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold"
                      />
                      <select
                        value={newTaskUnit}
                        onChange={e => setNewTaskUnit(e.target.value)}
                        className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl font-semibold cursor-pointer"
                      >
                        {UNIT_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Seleção de Dependência */}
                  <div className="relative" ref={depDropdownRef}>
                    <label className="block text-[10px] text-slate-500 font-bold mb-0.5">
                      Dependência (Aguardar Conclusão de Tarefa)
                    </label>
                    <div
                      onClick={() => setIsDepDropdownOpen(!isDepDropdownOpen)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-medium flex items-center justify-between cursor-pointer"
                    >
                      <span className="truncate">
                        {selectedNewDepObj ? selectedNewDepObj.title : 'Sem dependência (Livre)'}
                      </span>
                      <ChevronDown size={14} className="text-slate-400" />
                    </div>

                    {isDepDropdownOpen && (
                      <div className="absolute left-0 top-full mt-1 w-full bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-[60] space-y-1">
                        <input
                          type="text"
                          placeholder="Buscar tarefa..."
                          value={depSearchTerm}
                          onChange={e => setDepSearchTerm(e.target.value)}
                          className="w-full px-2.5 py-1 bg-slate-50 border rounded-lg text-xs mb-1"
                        />
                        <div className="max-h-36 overflow-y-auto space-y-1">
                          <button
                            type="button"
                            onClick={() => { setNewTaskDependsOnId(''); setIsDepDropdownOpen(false); }}
                            className="w-full text-left px-2 py-1 hover:bg-slate-50 rounded text-xs text-slate-500 font-semibold"
                          >
                            Sem dependência
                          </button>
                          {filteredNewTaskDeps.map(opt => (
                            <button
                              type="button"
                              key={opt.id}
                              onClick={() => { setNewTaskDependsOnId(opt.id); setIsDepDropdownOpen(false); }}
                              className="w-full text-left px-2 py-1.5 hover:bg-sky-50 rounded text-xs font-semibold text-slate-800"
                            >
                              {opt.title}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingTask(false)}
                      className="px-3 py-1.5 text-slate-600 hover:bg-slate-200/60 rounded-xl font-semibold"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-sky-600 text-white rounded-xl font-semibold shadow-2xs"
                    >
                      Salvar Subtarefa
                    </button>
                  </div>
                </form>
              )}

              {/* LISTA COMPLETA DE TAREFAS */}
              <div className="space-y-2.5">
                {(!item.tasks || item.tasks.length === 0) ? (
                  <p className="text-slate-400 italic text-center py-8">
                    Nenhuma subtarefa cadastrada neste equipamento.
                  </p>
                ) : (
                  item.tasks.map(task => {
                    const isTaskDone = task.status === 'concluida';
                    const isInProgress = task.status === 'em_andamento';
                    const isTaskBlockedManual = task.status === 'bloqueada';
                    
                    const dependencyTask = task.depends_on_task_id
                      ? (item.tasks || []).find(t => t.id === task.depends_on_task_id) || allTasks.find(t => t.id === task.depends_on_task_id)
                      : null;
                    const isBlockedByDependency = (dependencyTask && dependencyTask.status !== 'concluida') || isItemBlocked;
                    const isEffectiveBlocked = isTaskBlockedManual || isBlockedByDependency;
                    
                    const taskExecutors: string[] = task.executed_by || [];
                    const canToggle = (isTaskDone ? canReopenTasks : canCompleteTasks) && !isTaskBlockedManual;

                    return (
                      <div
                        key={task.id}
                        className={`p-3.5 rounded-2xl border transition-all flex flex-col gap-2.5 ${
                          isTaskDone
                            ? 'bg-emerald-50/60 border-emerald-200'
                            : isTaskBlockedManual
                            ? 'bg-rose-50/60 border-rose-200'
                            : isBlockedByDependency
                            ? 'bg-amber-50/40 border-amber-200/80 shadow-2xs opacity-80'
                            : isInProgress
                            ? 'bg-sky-50/30 border-sky-200'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            {/* CHECKBOX: Abre modal de apontamento */}
                            <button
                              type="button"
                              disabled={isEffectiveBlocked || !canToggle}
                              onClick={() => !isEffectiveBlocked && handleTaskCheckboxClick(task)}
                              className={`shrink-0 mt-0.5 transition flex items-center justify-center ${
                                isEffectiveBlocked || !canToggle ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:scale-105'
                              }`}
                              title={
                                isTaskBlockedManual ? 'Tarefa bloqueada manualmente. Use o menu para desbloquear.'
                                : isBlockedByDependency ? 'Bloqueado por dependência' 
                                : isTaskDone ? 'Reabrir tarefa' 
                                : 'Apontar / Concluir Tarefa'
                              }
                            >
                              {isTaskBlockedManual ? (
                                <ShieldAlert size={17} className="text-rose-600" />
                              ) : isBlockedByDependency ? (
                                <Lock size={16} className="text-amber-500" />
                              ) : isTaskDone ? (
                                <CheckSquare size={17} className="text-emerald-600" />
                              ) : isInProgress ? (
                                <PlayCircle size={18} className="text-sky-500 hover:text-sky-600" />
                              ) : (
                                <Square size={17} className="text-slate-400 hover:text-emerald-600" />
                              )}
                            </button>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs font-semibold break-words ${isTaskDone ? 'line-through text-slate-400' : isTaskBlockedManual ? 'text-rose-900' : 'text-slate-800'}`}>
                                  {task.title}
                                </span>

                                {!isEffectiveBlocked && dependencyTask && dependencyTask.status !== 'concluida' && (
                                  <button
                                    type="button"
                                    onClick={() => handleUnlinkTaskDependency(task)}
                                    title="Clique para desvincular a dependência"
                                    className="flex items-center gap-1 text-[10px] font-bold bg-amber-100/90 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200 hover:bg-amber-200 transition"
                                  >
                                    <Lock size={9} />
                                    <span>Aguardando: {dependencyTask.title}</span>
                                    <Unlink size={10} className="ml-0.5 text-amber-700" />
                                  </button>
                                )}
                              </div>

                              {/* Se bloqueada, exibe o aviso em vermelho */}
                              {isTaskBlockedManual && task.blocked_reason && (
                                <div className="mt-1.5 mb-1 bg-rose-100 border border-rose-200 text-rose-800 p-2 rounded-lg text-[10px] flex items-start gap-1.5">
                                  <ShieldAlert size={12} className="shrink-0 mt-0.5 text-rose-600" />
                                  <div>
                                    <strong className="block uppercase tracking-wider text-[9px] text-rose-600">Restrição / Pendência:</strong>
                                    <p className="leading-snug font-medium">{task.blocked_reason}</p>
                                  </div>
                                </div>
                              )}

                              {/* DESCRIÇÃO DA SUBTAREFA */}
                              {task.description && !isTaskBlockedManual && (
                                <p className="text-[11px] text-slate-500 mt-1 leading-snug font-normal">
                                  {task.description}
                                </p>
                              )}

                              {/* LISTA DE EXECUTORES/MEMBROS QUE ATUARAM */}
                              {taskExecutors.length > 0 && !isTaskBlockedManual && (
                                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                  <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                                    <Users size={11} className="text-sky-600" /> Executado por:
                                  </span>
                                  {taskExecutors.map((execName, idx) => (
                                    <span
                                      key={idx}
                                      className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold rounded-md text-[10px] border border-slate-200"
                                    >
                                      {execName}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {task.has_progress_tracking && !isTaskBlockedManual && (
                              <div 
                                className={`flex items-center gap-1.5 border px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-xl text-xs cursor-pointer hover:bg-slate-100 ${isBlockedByDependency ? 'bg-amber-50/50 border-amber-200 opacity-70 cursor-not-allowed' : 'bg-slate-50 border-slate-200'}`}
                                onClick={() => !isBlockedByDependency && handleTaskCheckboxClick(task)}
                              >
                                <span className="text-slate-400 text-[10px] sm:text-[11px]">Progresso:</span>
                                <div className="font-bold text-slate-900 px-1 text-center min-w-[30px]">
                                  {task.quantity_executed || 0}
                                </div>
                                <span className="text-slate-500 font-semibold text-[10px] sm:text-[11px]">
                                  / {task.quantity_planned} {task.unit}
                                </span>
                              </div>
                            )}

                            {/* Menu de Ações por Tarefa */}
                            <div className="relative">
                              <button
                                type="button"
                                disabled={effectiveIsBlocked && !isTaskBlockedManual} // Se for restrição manual ele precisa poder clicar pra desbloquear
                                onClick={() => setOpenTaskMenuId(openTaskMenuId === task.id ? null : task.id)}
                                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition disabled:opacity-50"
                              >
                                <MoreVertical size={14} />
                              </button>

                              {openTaskMenuId === task.id && (
                                <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50 text-xs">
                                  {isTaskBlockedManual ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenTaskMenuId(null);
                                        if (onUnblockTask) onUnblockTask(task);
                                      }}
                                      className="w-full text-left px-3.5 py-1.5 hover:bg-emerald-50 text-emerald-700 flex items-center gap-1.5 font-bold cursor-pointer"
                                    >
                                      <ShieldCheck size={13} />
                                      <span>Desbloquear (Liberar)</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenTaskMenuId(null);
                                        if (onOpenBlockTaskModal) onOpenBlockTaskModal(task, item.id);
                                      }}
                                      className="w-full text-left px-3.5 py-1.5 hover:bg-amber-50 text-amber-700 flex items-center gap-1.5 font-bold cursor-pointer"
                                    >
                                      <ShieldAlert size={13} />
                                      <span>Bloquear (Restrição)</span>
                                    </button>
                                  )}

                                  {!isTaskBlockedManual && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenTaskMenuId(null);
                                          // Como a gaveta não tem um modal próprio de Edição de Prazos completo como a linha, 
                                          // pode emitir um evento pro parent tratar ou só ignorar/deletar dependendo das permissões
                                          alert("Use o botão de configurações da tarefa na visualização EAP para gerenciar datas e dependências.");
                                        }}
                                        className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 font-medium cursor-pointer"
                                      >
                                        <Sliders size={12} className="text-slate-400" />
                                        <span>Opções Avançadas</span>
                                      </button>
                                      
                                      <div className="border-t border-slate-100 my-1" />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenTaskMenuId(null);
                                          handleDeleteTask(task.id);
                                        }}
                                        className="w-full text-left px-3.5 py-1.5 hover:bg-rose-50 text-rose-600 flex items-center gap-1.5 font-medium cursor-pointer"
                                      >
                                        <Trash2 size={12} />
                                        <span>Excluir</span>
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ABA FOTOS & ANEXOS */}
          {activeTab === 'anexos' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-800 text-xs">Galeria de Fotos & Documentos</h4>
                  <p className="text-[11px] text-slate-400">Anexe ordens de serviço, esquemas e fotos do avanço</p>
                </div>
                <label className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs transition">
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  <span>Enviar Arquivo</span>
                  <input type="file" multiple className="hidden" onChange={handleFileUpload} disabled={uploading} />
                </label>
              </div>

              {attachments.length === 0 ? (
                <div className="border border-dashed border-slate-200 rounded-2xl p-8 text-center bg-slate-50/50 space-y-2">
                  <Paperclip className="mx-auto text-slate-300" size={24} />
                  <p className="text-slate-400 italic">
                    Nenhuma foto ou arquivo foi anexado a este equipamento.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {attachments.map(file => (
                    <div
                      key={file.id}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between space-y-2 group hover:border-sky-300 transition shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {file.type === 'image' ? (
                            <ImageIcon size={16} className="text-emerald-600 shrink-0" />
                          ) : (
                            <FileText size={16} className="text-sky-600 shrink-0" />
                          )}
                          <span className="truncate font-semibold text-slate-800 text-xs" title={file.name}>
                            {file.name}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteAttachment(file.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                          title="Remover anexo"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      {file.type === 'image' && (
                        <div className="w-full h-24 rounded-xl overflow-hidden bg-slate-200 border border-slate-100">
                          <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[10px] text-slate-400 font-medium">
                        <span>{new Date(file.created_at).toLocaleDateString('pt-BR')}</span>
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sky-600 hover:underline flex items-center gap-1 font-bold"
                        >
                          <span>Abrir</span>
                          <ExternalLink size={10} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ABA DIÁRIO / DESCRIÇÃO */}
          {activeTab === 'diario' && (
            <div className="space-y-4">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Descrição Técnica / Especificações</label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Informe características técnicas, voltagem, fabricante, dimensões ou observações essenciais..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 focus:ring-2 focus:ring-sky-500 resize-none text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Apontamentos & Ocorrências de Campo</label>
                <textarea
                  rows={5}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Registe ocorrências, problemas climáticos, paralisações ou inspeções técnicas deste equipamento..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 focus:ring-2 focus:ring-sky-500 resize-none text-xs"
                />
              </div>
            </div>
          )}

        </div>
      </div>

      {/* MODAL: APONTAMENTO DIÁRIO DE EXECUÇÃO */}
      {completingTask && (
        <div className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-5 sm:p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600 border border-sky-100">
                  <CheckSquare size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Apontamento de Execução</h3>
                  <p className="text-[11px] text-slate-500">Registro no diário de obra</p>
                </div>
              </div>
              <button
                onClick={() => setCompletingTask(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                  Atividade Executada
                </span>
                <p className="font-semibold text-slate-800 text-sm">
                  {completingTask.title}
                </p>
                {completingTask.has_progress_tracking && (
                  <div className="mt-2 flex items-center gap-2 text-[11px] font-medium text-slate-500">
                    <span className="bg-white px-2 py-1 rounded border border-slate-200 shadow-sm">
                      Planejado: <strong className="text-slate-800">{completingTask.quantity_planned} {completingTask.unit}</strong>
                    </span>
                    <span className="bg-white px-2 py-1 rounded border border-slate-200 shadow-sm">
                      Já feito: <strong className="text-sky-600">{completingTask.quantity_executed || 0} {completingTask.unit}</strong>
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* DATA DO APONTAMENTO */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Data do Serviço</label>
                  <input
                    type="date"
                    required
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                {/* QUANTIDADE FEITA NO DIA */}
                {completingTask.has_progress_tracking ? (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Qtd. feita HOJE ({completingTask.unit})</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 40"
                      value={entryQty}
                      onChange={(e) => setEntryQty(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-sky-300 rounded-xl font-extrabold text-sky-900 text-center focus:ring-2 focus:ring-sky-500 shadow-sm"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Ação</label>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => { setChecklistAction('progress'); setEntryQty('0'); }}
                        className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition-all cursor-pointer ${
                          checklistAction === 'progress' ? 'bg-white shadow-sm text-sky-700' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Apenas Apontar
                      </button>
                      <button
                        type="button"
                        onClick={() => { setChecklistAction('complete'); setEntryQty('1'); }}
                        className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition-all cursor-pointer ${
                          checklistAction === 'complete' ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Concluir
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* FILTRO DE EQUIPE E SELEÇÃO DE EXECUTORES */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[10px] font-bold text-slate-500">Membros da Equipe / Executores</label>
                  {companyTeams && companyTeams.length > 0 && (
                    <select
                      value={entryTeamId}
                      onChange={(e) => setEntryTeamId(e.target.value)}
                      className="text-[10px] font-semibold text-sky-700 bg-sky-50 border border-sky-200 rounded-lg px-2 py-1 outline-none cursor-pointer"
                    >
                      <option value="all">Todas as Equipes</option>
                      {companyTeams.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto p-1.5 border border-slate-200 rounded-xl bg-slate-50/50">
                  {filteredTeamMembers.length > 0 ? (
                    filteredTeamMembers.map(member => {
                      const isSelected = selectedExecutors.includes(member.name);
                      return (
                        <button
                          type="button"
                          key={member.id}
                          disabled={!canAssignExecutors}
                          onClick={() => toggleModalExecutor(member.name)}
                          className={`w-full p-2 sm:p-2.5 rounded-xl text-left border transition flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? 'bg-sky-50 border-sky-300 text-sky-900 font-bold shadow-xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 font-medium'
                          } ${!canAssignExecutors ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                          <div className="flex items-center gap-2 sm:gap-2.5">
                            <div className={`w-7 sm:w-8 h-7 sm:h-8 rounded-full flex items-center justify-center text-[10px] font-bold border overflow-hidden ${
                              isSelected ? 'bg-sky-600 text-white border-sky-500' : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                              {member.avatar_url ? (
                                <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                getInitials(member.name)
                              )}
                            </div>
                            <div>
                              <span className="block text-xs">{member.name}</span>
                              {member.role && <span className="text-[10px] text-slate-400 font-normal">{member.role}</span>}
                            </div>
                          </div>

                          <UserCheck size={16} className={isSelected ? 'text-sky-600' : 'text-slate-300'} />
                        </button>
                      );
                    })
                  ) : (
                    <div className="p-3 text-center text-slate-400 italic">
                      Nenhum membro encontrado.
                    </div>
                  )}
                </div>
              </div>

              {/* OBSERVAÇÕES */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Observações do dia (Opcional)</label>
                <input
                  type="text"
                  value={entryNotes}
                  onChange={(e) => setEntryNotes(e.target.value)}
                  placeholder="Houve algum problema ou detalhe na execução hoje?"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-medium text-slate-800 focus:ring-2 focus:ring-sky-500"
                />
              </div>

            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCompletingTask(null)}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSavingEntry}
                onClick={handleConfirmCompletion}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold cursor-pointer shadow-xs transition text-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSavingEntry ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                <span>Salvar Apontamento</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};