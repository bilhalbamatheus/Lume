import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { WorkItem, WorkTask, TeamMember } from './WorkItemRow';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  X,
  Layers,
  MapPin,
  Calendar,
  Lock,
  Tag,
  CheckCircle2,
  Square,
  CheckSquare,
  Users,
  UserCheck,
  Camera,
  Plus,
  Trash2,
  Edit2,
  Save,
  Loader2,
  Upload,
  Paperclip,
  ChevronDown,
  FileCheck,
  FolderTree,
  ChevronRight,
  ExternalLink,
  PlayCircle,
  ShieldAlert,
  ShieldCheck,
  MoreVertical} from 'lucide-react';

interface SettingOption {
  id: string;
  name: string;
  color?: string;
}

interface WorkItemAttachment {
  id: string;
  work_item_id: string;
  title: string;
  description?: string | null;
  file_url: string;
  file_type?: string | null;
  file_size?: number | null;
  created_at?: string;
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

interface WorkItemDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  item: WorkItem | null;
  allItems: WorkItem[];
  allTasks: WorkTask[];
  teamMembers: TeamMember[];
  locationOptions?: SettingOption[];
  itemTypeOptions?: SettingOption[];
  subitemTypes?: SettingOption[];
  companyTeams?: CompanyTeam[];
  measurementType?: 'por_subitem' | 'por_item' | 'sem_medicao';
  onOpenQuickSettings?: () => void;
  onSelectChildItem?: (child: WorkItem) => void;
  onOpenCreateChildModal?: (parentId: string, parentTitle: string) => void;
  onToggleTaskStatus: (item: WorkItem, task: WorkTask, executors?: string[]) => void;
  onUpdateTaskExecutedQty?: (item: WorkItem, task: WorkTask, rawVal: string) => void;
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
  onItemUpdated?: () => void;
  canCompleteTasks?: boolean;
  canReopenTasks?: boolean;
  canAssignExecutors?: boolean;
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

const getInitials = (name: string) => {
  if (!name) return 'EX';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const formatFileSize = (bytes?: number | null) => {
  if (!bytes) return '';
  const k = 1024;
  if (bytes < k) return `${bytes} B`;
  const m = bytes / (k * k);
  if (m < 1) return `${(bytes / k).toFixed(1)} KB`;
  return `${m.toFixed(1)} MB`;
};

export const WorkItemDrawer: React.FC<WorkItemDrawerProps> = ({
  isOpen,
  onClose,
  item,
  allItems = [],
  allTasks = [],
  teamMembers = [],
  companyTeams = [],
  locationOptions = [],
  itemTypeOptions = [],
  subitemTypes = [],
  onSelectChildItem,
  onOpenCreateChildModal,
  onToggleTaskStatus,
  onSaveInlineTask,
  onItemUpdated,
  onSaveTaskEntry,
  canCompleteTasks = true,
  canReopenTasks = true,
  canAssignExecutors = true
}) => {
  const { user } = useAuth();

  // Abas
  const [activeTab, setActiveTab] = useState<'item' | 'subitem' | 'attachments'>('subitem');
  const [] = useState(false);

  // Modais de Ação no Item Principal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState(false);

  // Estados de edição do item principal
  const [editTitle, setEditTitle] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editItemType, setEditItemType] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editDependsOnId, setEditDependsOnId] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Edição inline da descrição no cabeçalho
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [headerDescription, setHeaderDescription] = useState('');
  const [savingHeaderDesc, setSavingHeaderDesc] = useState(false);

  // Formulário de nova subtarefa
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskSubitemType, setTaskSubitemType] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskHasProgress, setTaskHasProgress] = useState(false);
  const [taskPlannedQty, setTaskPlannedQty] = useState('1');
  const [taskUnit, setTaskUnit] = useState('un');
  const [taskPrice, setTaskPrice] = useState('');
  const [taskStartDate, setTaskStartDate] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskDependsOnId, setTaskDependsOnId] = useState('');
  const [createAsBlocked, setCreateAsBlocked] = useState(false);
  const [createBlockReason, setCreateBlockReason] = useState('');

  const [depSearchTerm, setDepSearchTerm] = useState('');
  const [isDepDropdownOpen, setIsDepDropdownOpen] = useState(false);
  const depDropdownRef = useRef<HTMLDivElement>(null);

  // Menus Dropdown
  const [openTaskMenuId, setOpenTaskMenuId] = useState<string | null>(null);
  const [openChildMenuId, setOpenChildMenuId] = useState<string | null>(null);

  // 1º MELHORIA: MODAL DE BLOQUEIO INTEGRADO (TAREFA)
  const [blockingTask, setBlockingTask] = useState<WorkTask | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);

  // 2º MELHORIA: MODAIS CUSTOMIZADOS DE EXCLUSÃO (SEM WINDOW.CONFIRM)
  const [taskToDelete, setTaskToDelete] = useState<WorkTask | null>(null);
  const [deletingTask, setDeletingTask] = useState(false);

  const [childToDelete, setChildToDelete] = useState<WorkItem | null>(null);
  const [deletingChild, setDeletingChild] = useState(false);

  const [attachmentToDelete, setAttachmentToDelete] = useState<WorkItemAttachment | null>(null);
  const [deletingAttachment, setDeletingAttachment] = useState(false);

  // 4º MELHORIA: MODAL DE CRIAR NOVO SUBCOMPONENTE DIRETO NO DRAWER
  const [isCreateChildModalOpen, setIsCreateChildModalOpen] = useState(false);
  const [newChildTitle, setNewChildTitle] = useState('');
  const [newChildCode, setNewChildCode] = useState('');
  const [newChildType, setNewChildType] = useState('');
  const [newChildLocation, setNewChildLocation] = useState('');
  const [creatingChild, setCreatingChild] = useState(false);

  // 5º MELHORIA: EDITAR ITEM FILHO
  const [editingChild, setEditingChild] = useState<WorkItem | null>(null);
  const [editChildTitle, setEditChildTitle] = useState('');
  const [editChildCode, setEditChildCode] = useState('');
  const [editChildType, setEditChildType] = useState('');
  const [editChildLocation, setEditChildLocation] = useState('');
  const [savingChildEdit, setSavingChildEdit] = useState(false);

  // 6º MELHORIA: MODAL DE EDITAR SUBTAREFA
  const [editingTask, setEditingTask] = useState<WorkTask | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskType, setEditTaskType] = useState('');
  const [editTaskDesc, setEditTaskDesc] = useState('');
  const [editTaskStartDate, setEditTaskStartDate] = useState('');
  const [editTaskDueDate, setEditTaskDueDate] = useState('');
  const [editTaskDependsOnId, setEditTaskDependsOnId] = useState('');
  const [editTaskPlannedQty, setEditTaskPlannedQty] = useState('1');
  const [editTaskUnit, setEditTaskUnit] = useState('un');
  const [savingTaskEdit, setSavingTaskEdit] = useState(false);

  // Estados do Modal de Apontamento Diário
  const [completingTask, setCompletingTask] = useState<WorkTask | null>(null);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryQty, setEntryQty] = useState('');
  const [entryTeamId, setEntryTeamId] = useState<string>('all');
  const [entryNotes, setEntryNotes] = useState('');
  const [selectedExecutors, setSelectedExecutors] = useState<string[]>([]);
  const [isSavingEntry, setIsSavingEntry] = useState(false);
  const [checklistAction, setChecklistAction] = useState<'progress' | 'complete'>('complete');

  // Anexos
  const [attachments, setAttachments] = useState<WorkItemAttachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [isSubmittingUpload, setIsSubmittingUpload] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (depDropdownRef.current && !depDropdownRef.current.contains(e.target as Node)) {
        setIsDepDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (item) {
      setHeaderDescription(item.description || '');
      setTaskStartDate(item.start_date || '');
      setTaskDueDate(item.due_date || '');
      setIsAddingTask(false);
      setIsEditingDescription(false);
    }
  }, [item]);

  const loadAttachments = useCallback(async () => {
    if (!item?.id) return;
    try {
      setLoadingAttachments(true);
      const { data, error } = await supabase
        .from('work_item_attachments')
        .select('*')
        .eq('work_item_id', item.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAttachments(data || []);
    } catch (err) {
      console.warn('Erro ao carregar anexos:', err);
    } finally {
      setLoadingAttachments(false);
    }
  }, [item?.id]);

  useEffect(() => {
    if (isOpen && item?.id) {
      loadAttachments();
    }
  }, [isOpen, item?.id, loadAttachments]);

  const childComponents = useMemo(() => {
    if (!item) return [];
    return allItems.filter(i => i.parent_id === item.id);
  }, [item, allItems]);

  if (!isOpen || !item) return null;

  const depItem = item.depends_on_item_id ? allItems.find(i => i.id === item.depends_on_item_id) : null;
  const isItemBlocked = depItem ? (depItem.progress_percent || 0) < 100 : false;

  const tasks = item.tasks || [];
  const doneTasksCount = tasks.filter(t => t.status === 'concluida').length;
  const progressPercent = tasks.length > 0
    ? Math.round((doneTasksCount / tasks.length) * 100)
    : item.progress_percent || 0;

  const availableTasksList = (item.tasks || []).concat(allTasks.filter(t => t.work_item_id !== item.id));
  const filteredNewTaskDeps = availableTasksList.filter(
    t => t.title.toLowerCase().includes(depSearchTerm.toLowerCase())
  );
  const selectedNewDepObj = availableTasksList.find(t => t.id === taskDependsOnId);
  const minNewStartDate = (selectedNewDepObj as any)?.due_date || (selectedNewDepObj as any)?.dueDate || undefined;

  const filteredTeamMembers = entryTeamId === 'all' 
    ? teamMembers 
    : teamMembers.filter(m => m.team_id === entryTeamId);

  // AÇÕES NO ITEM PRINCIPAL
  const handleOpenEditModal = () => {
    setEditTitle(item.title || '');
    setEditCode(item.code || '');
    setEditItemType(item.item_type || '');
    setEditLocation(item.location || '');
    setEditStartDate(item.start_date || '');
    setEditDueDate(item.due_date || '');
    setEditDependsOnId(item.depends_on_item_id || '');
    setEditDescription(item.description || '');
    setIsEditModalOpen(true);
  };

  const handleSaveEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim()) return;

    try {
      setSavingEdit(true);
      const { error } = await supabase
        .from('work_items')
        .update({
          title: editTitle.trim(),
          code: editCode.trim() || null,
          item_type: editItemType.trim() || null,
          location: editLocation.trim() || null,
          start_date: editStartDate || null,
          due_date: editDueDate || null,
          depends_on_item_id: editDependsOnId || null,
          description: editDescription.trim() || null
        })
        .eq('id', item.id);

      if (error) throw error;
      setIsEditModalOpen(false);
      onItemUpdated?.();
    } catch (err: any) {
      alert('Erro ao atualizar item: ' + err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDeleteItem = async () => {
    try {
      setDeletingItem(true);
      const { error } = await supabase.from('work_items').delete().eq('id', item.id);
      if (error) throw error;

      setIsDeleteModalOpen(false);
      onClose();
      onItemUpdated?.();
    } catch (err: any) {
      alert('Erro ao excluir item: ' + err.message);
    } finally {
      setDeletingItem(false);
    }
  };

  const handleSaveHeaderDescription = async () => {
    try {
      setSavingHeaderDesc(true);
      const { error } = await supabase
        .from('work_items')
        .update({ description: headerDescription.trim() || null })
        .eq('id', item.id);

      if (error) throw error;
      setIsEditingDescription(false);
      onItemUpdated?.();
    } catch (err: any) {
      alert('Erro ao salvar descrição: ' + err.message);
    } finally {
      setSavingHeaderDesc(false);
    }
  };

  // CRIAÇÃO DE SUBCOMPONENTE FILHO (ABA ITEM)
  const handleOpenCreateChild = () => {
    if (onOpenCreateChildModal) {
      onOpenCreateChildModal(item.id, item.title);
    } else {
      setNewChildTitle('');
      setNewChildCode('');
      setNewChildType(itemTypeOptions[0]?.name || '');
      setNewChildLocation(item.location || '');
      setIsCreateChildModalOpen(true);
    }
  };

  const handleSaveChildSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChildTitle.trim()) return;

    try {
      setCreatingChild(true);
      const companyId = (item as any).company_id || user?.company?.id;

      const { error } = await supabase
        .from('work_items')
        .insert({
          company_id: companyId,
          work_id: (item as any).work_id,
          parent_id: item.id,
          title: newChildTitle.trim(),
          code: newChildCode.trim() || null,
          item_type: newChildType || null,
          location: newChildLocation || null,
          sort_order: 999
        });

      if (error) throw error;
      setIsCreateChildModalOpen(false);
      onItemUpdated?.();
    } catch (err: any) {
      alert('Erro ao criar subcomponente: ' + err.message);
    } finally {
      setCreatingChild(false);
    }
  };

  // EDITAR ITEM FILHO
  const handleOpenEditChild = (child: WorkItem) => {
    setEditingChild(child);
    setEditChildTitle(child.title || '');
    setEditChildCode(child.code || '');
    setEditChildType(child.item_type || '');
    setEditChildLocation(child.location || '');
  };

  const handleSaveChildEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingChild || !editChildTitle.trim()) return;

    try {
      setSavingChildEdit(true);
      const { error } = await supabase
        .from('work_items')
        .update({
          title: editChildTitle.trim(),
          code: editChildCode.trim() || null,
          item_type: editChildType || null,
          location: editChildLocation || null
        })
        .eq('id', editingChild.id);

      if (error) throw error;
      setEditingChild(null);
      onItemUpdated?.();
    } catch (err: any) {
      alert('Erro ao editar subcomponente: ' + err.message);
    } finally {
      setSavingChildEdit(false);
    }
  };

  const handleConfirmDeleteChild = async () => {
    if (!childToDelete) return;
    try {
      setDeletingChild(true);
      const { error } = await supabase.from('work_items').delete().eq('id', childToDelete.id);
      if (error) throw error;
      setChildToDelete(null);
      onItemUpdated?.();
    } catch (err: any) {
      alert('Erro ao excluir subcomponente: ' + err.message);
    } finally {
      setDeletingChild(false);
    }
  };

  // AÇÕES NAS SUBTAREFAS
  const handleCreateTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || isItemBlocked) return;

    if (createAsBlocked && !createBlockReason.trim()) {
      alert('Informe o motivo da restrição para criar a tarefa como bloqueada.');
      return;
    }

    onSaveInlineTask(
      item.id,
      taskTitle.trim(),
      taskHasProgress,
      taskPlannedQty,
      taskUnit,
      taskPrice,
      taskStartDate || undefined,
      taskDueDate || undefined,
      taskDependsOnId || undefined,
      taskDescription.trim() || undefined,
      taskSubitemType || undefined,
      createAsBlocked,
      createBlockReason
    );

    setTaskTitle('');
    setTaskDescription('');
    setTaskPrice('');
    setTaskPlannedQty('1');
    setTaskHasProgress(false);
    setTaskStartDate(item.start_date || '');
    setTaskDueDate(item.due_date || '');
    setTaskDependsOnId('');
    setCreateAsBlocked(false);
    setCreateBlockReason('');
    setIsAddingTask(false);
  };

  // 1º MELHORIA: FUNÇÃO LOCAL DE BLOQUEIO / DESBLOQUEIO DE TAREFA
  const handleConfirmBlockTask = async () => {
    if (!blockingTask || !blockReason.trim()) return;
    try {
      setIsBlocking(true);
      const { error } = await supabase
        .from('work_tasks')
        .update({
          status: 'bloqueada',
          blocked_reason: blockReason.trim(),
          blocked_at: new Date().toISOString()
        })
        .eq('id', blockingTask.id);

      if (error) throw error;
      setBlockingTask(null);
      setBlockReason('');
      onItemUpdated?.();
    } catch (err: any) {
      alert('Erro ao bloquear tarefa: ' + err.message);
    } finally {
      setIsBlocking(false);
    }
  };

  const handleUnblockTask = async (task: WorkTask) => {
    try {
      const { error } = await supabase
        .from('work_tasks')
        .update({
          status: 'pendente',
          blocked_reason: null,
          blocked_at: null
        })
        .eq('id', task.id);

      if (error) throw error;
      onItemUpdated?.();
    } catch (err: any) {
      alert('Erro ao desbloquear tarefa: ' + err.message);
    }
  };

  // 6º MELHORIA: EDITAR TAREFA
  const handleOpenEditTask = (task: WorkTask) => {
    setEditingTask(task);
    setEditTaskTitle(task.title);
    setEditTaskType(task.task_type || '');
    setEditTaskDesc((task as any).description || '');
    setEditTaskStartDate(task.start_date || '');
    setEditTaskDueDate(task.due_date || '');
    setEditTaskDependsOnId(task.depends_on_task_id || '');
    setEditTaskPlannedQty(task.quantity_planned?.toString() || '1');
    setEditTaskUnit(task.unit || 'un');
  };

  const handleSaveTaskEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !editTaskTitle.trim()) return;

    try {
      setSavingTaskEdit(true);
      const parsedQty = parseFloat(editTaskPlannedQty.replace(',', '.')) || 1;

      const { error } = await supabase
        .from('work_tasks')
        .update({
          title: editTaskTitle.trim(),
          task_type: editTaskType || null,
          description: editTaskDesc.trim() || null,
          start_date: editTaskStartDate || null,
          due_date: editTaskDueDate || null,
          depends_on_task_id: editTaskDependsOnId || null,
          quantity_planned: parsedQty,
          unit: editTaskUnit
        })
        .eq('id', editingTask.id);

      if (error) throw error;
      setEditingTask(null);
      onItemUpdated?.();
    } catch (err: any) {
      alert('Erro ao salvar tarefa: ' + err.message);
    } finally {
      setSavingTaskEdit(false);
    }
  };

  // EXCLUIR TAREFA VIA MODAL
  const handleConfirmDeleteTask = async () => {
    if (!taskToDelete) return;
    try {
      setDeletingTask(true);
      const { error } = await supabase.from('work_tasks').delete().eq('id', taskToDelete.id);
      if (error) throw error;
      setTaskToDelete(null);
      onItemUpdated?.();
    } catch (err: any) {
      alert('Erro ao excluir tarefa: ' + err.message);
    } finally {
      setDeletingTask(false);
    }
  };

  // APONTAMENTO
  const handleTaskCheckboxClick = (task: WorkTask) => {
    if (task.status === 'bloqueada') return;

    const isTaskDone = task.status === 'concluida';
    if (isTaskDone) {
      if (!canReopenTasks) return;
      onToggleTaskStatus(item, task, []); 
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
        onItemUpdated?.();
      } else {
        onToggleTaskStatus(item, completingTask, selectedExecutors);
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

  // ANEXOS
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !uploadTitle.trim() || !user?.company?.id) return;

    try {
      setIsSubmittingUpload(true);
      const sanitizedName = uploadFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${user.company.id}/${item.id}/${Date.now()}_${sanitizedName}`;

      const { error: storageError } = await supabase.storage.from('work-attachments').upload(filePath, uploadFile, { upsert: true });
      if (storageError) throw storageError;
      const { data: publicUrlData } = supabase.storage.from('work-attachments').getPublicUrl(filePath);

      const { error: dbError } = await supabase.from('work_item_attachments').insert({
        company_id: user.company.id,
        work_item_id: item.id,
        title: uploadTitle.trim(),
        description: uploadDescription.trim() || null,
        file_url: publicUrlData.publicUrl,
        file_type: uploadFile.type,
        file_size: uploadFile.size
      });

      if (dbError) throw dbError;

      setIsUploadModalOpen(false);
      setUploadFile(null);
      setUploadTitle('');
      setUploadDescription('');
      await loadAttachments();
    } catch (err: any) {
      alert('Erro ao enviar anexo: ' + err.message);
    } finally {
      setIsSubmittingUpload(false);
    }
  };

  const handleConfirmDeleteAttachment = async () => {
    if (!attachmentToDelete) return;
    try {
      setDeletingAttachment(true);
      const { error } = await supabase.from('work_item_attachments').delete().eq('id', attachmentToDelete.id);
      if (error) throw error;
      setAttachments(prev => prev.filter(a => a.id !== attachmentToDelete.id));
      setAttachmentToDelete(null);
    } catch (err: any) {
      alert('Erro ao remover anexo: ' + err.message);
    } finally {
      setDeletingAttachment(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/40 backdrop-blur-2xs animate-in fade-in duration-150">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-8">
        <aside className="w-screen max-w-2xl bg-white shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
          
          {/* CABEÇALHO DO ITEM */}
          <div className="p-5 border-b border-slate-200/90 bg-white space-y-3 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                {item.code && (
                  <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-bold border border-slate-200">
                    {item.code}
                  </span>
                )}
                {isItemBlocked ? (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200 px-2.5 py-0.5 rounded-full">
                    <Lock size={10} className="text-amber-600" />
                    <span>Bloqueado (Aguardando: {depItem?.title})</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
                    <CheckCircle2 size={10} className="text-emerald-600" />
                    <span>Liberado</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" onClick={handleOpenEditModal} className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-xl transition cursor-pointer" title="Editar">
                  <Edit2 size={15} />
                </button>
                <button type="button" onClick={() => setIsDeleteModalOpen(true)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer" title="Excluir">
                  <Trash2 size={15} />
                </button>
                <div className="w-[1px] h-4 bg-slate-200 mx-1" />
                <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer" title="Fechar">
                  <X size={17} />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight leading-tight truncate">
                {item.title}
              </h2>
              <div className="flex items-center gap-2.5 shrink-0 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Avanço</span>
                <div className="w-20 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                  <div className={`h-1.5 rounded-full transition-all duration-300 ${progressPercent >= 100 ? 'bg-emerald-500' : 'bg-sky-500'}`} style={{ width: `${progressPercent}%` }} />
                </div>
                <span className="text-xs font-black text-sky-600">{progressPercent}%</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                {item.location && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-lg border border-slate-200">
                    <MapPin size={11} className="text-slate-400" />
                    <span>{item.location}</span>
                  </span>
                )}
                {item.item_type && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-indigo-50 border border-indigo-200 text-indigo-700 px-2.5 py-0.5 rounded-lg">
                    <Layers size={11} className="text-indigo-500" />
                    <span>{item.item_type}</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
                <Calendar size={12} className="text-slate-400" />
                <span>
                  {item.start_date ? new Date(item.start_date + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                  {' • '}
                  {item.due_date ? new Date(item.due_date + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                </span>
              </div>
            </div>
            
            <div className="pt-2 border-t border-slate-100">
              {isEditingDescription ? (
                <div className="space-y-2">
                  <textarea
                    rows={2}
                    value={headerDescription}
                    onChange={e => setHeaderDescription(e.target.value)}
                    placeholder="Adicione uma descrição operacional..."
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 font-medium"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingDescription(false)}
                      className="px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={savingHeaderDesc}
                      onClick={handleSaveHeaderDescription}
                      className="px-3 py-1 bg-sky-600 text-white text-[11px] font-bold rounded-lg cursor-pointer hover:bg-sky-500 flex items-center gap-1"
                    >
                      {savingHeaderDesc ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                      <span>Salvar</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setIsEditingDescription(true)}
                  className="group cursor-pointer p-2 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"
                  title="Clique para editar a descrição"
                >
                  <p className="text-xs text-slate-600 leading-relaxed italic">
                    {item.description || 'Nenhuma descrição adicionada. Clique para adicionar detalhes técnicos.'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* NAVEGAÇÃO ENTRE AS ABAS */}
          <div className="px-5 border-b border-slate-200 flex items-center gap-6 text-xs font-bold text-slate-500 shrink-0 bg-white">
            <button
              type="button"
              onClick={() => setActiveTab('item')}
              className={`py-3.5 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'item' ? 'border-sky-600 text-sky-600' : 'border-transparent hover:text-slate-800'
              }`}
            >
              <FolderTree size={14} />
              <span>Itens ({childComponents.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('subitem')}
              className={`py-3.5 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'subitem' ? 'border-sky-600 text-sky-600' : 'border-transparent hover:text-slate-800'
              }`}
            >
              <CheckSquare size={14} />
              <span>Subitens ({tasks.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('attachments')}
              className={`py-3.5 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'attachments' ? 'border-sky-600 text-sky-600' : 'border-transparent hover:text-slate-800'
              }`}
            >
              <Paperclip size={14} />
              <span>Anexos ({attachments.length})</span>
            </button>
          </div>

          {/* CONTEÚDO DAS ABAS */}
          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
            
            {/* 4º MELHORIA: ABA ITEM COM BOTÃO NOVO SUBCOMPONENTE E MENU DE AÇÕES */}
            {activeTab === 'item' && (
              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Componentes e Frentes Internas
                  </span>
                  <button
                    type="button"
                    onClick={handleOpenCreateChild}
                    className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1 cursor-pointer bg-sky-50 px-3 py-1.5 rounded-xl border border-sky-200/60"
                  >
                    <Plus size={14} />
                    <span>Novo Subcomponente</span>
                  </button>
                </div>

                {childComponents.length === 0 ? (
                  <div className="p-10 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-center text-slate-400 space-y-2">
                    <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                      <FolderTree size={20} />
                    </div>
                    <span className="font-bold text-slate-700 text-sm">Nenhum subcomponente vinculado</span>
                    <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed">
                      Este item ainda não possui divisões internas. Adicione subcomponentes para organizar frentes mais complexas.
                    </p>
                    <button
                      type="button"
                      onClick={handleOpenCreateChild}
                      className="mt-3 px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-2xs cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>Adicionar Primeiro Subcomponente</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {childComponents.map(child => {
                      const childTasks = allTasks.filter(t => t.work_item_id === child.id);
                      const doneCount = childTasks.filter(t => t.status === 'concluida').length;
                      const prog = childTasks.length > 0 ? Math.round((doneCount / childTasks.length) * 100) : child.progress_percent || 0;

                      return (
                        <div
                          key={child.id}
                          onClick={() => onSelectChildItem?.(child)}
                          className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-2xs hover:border-sky-300 hover:bg-sky-50/20 transition cursor-pointer flex items-center justify-between gap-3 relative"
                        >
                          <div className="min-w-0 space-y-1 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {child.code && (
                                <span className="font-mono text-[9px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-bold border">
                                  {child.code}
                                </span>
                              )}
                              <span className="font-bold text-slate-900 text-xs truncate">
                                {child.title}
                              </span>
                              {child.item_type && (
                                <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded">
                                  {child.item_type}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 block">
                              {childTasks.length} subitens cadastrados
                            </span>
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0" onClick={e => e.stopPropagation()}>
                            <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden hidden sm:block">
                              <div className={`h-1.5 rounded-full ${prog >= 100 ? 'bg-emerald-500' : 'bg-sky-500'}`} style={{ width: `${prog}%` }} />
                            </div>
                            <span className="font-extrabold text-xs text-slate-700 w-8 text-right">{prog}%</span>

                            {/* 5º MELHORIA: MENU DE AÇÕES NOS ITENS FILHOS */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setOpenChildMenuId(openChildMenuId === child.id ? null : child.id)}
                                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                              >
                                <MoreVertical size={14} />
                              </button>

                              {openChildMenuId === child.id && (
                                <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50 text-xs">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenChildMenuId(null);
                                      onSelectChildItem?.(child);
                                    }}
                                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 font-medium cursor-pointer"
                                  >
                                    <ChevronRight size={13} />
                                    <span>Abrir</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenChildMenuId(null);
                                      handleOpenEditChild(child);
                                    }}
                                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 font-medium cursor-pointer"
                                  >
                                    <Edit2 size={13} className="text-sky-600" />
                                    <span>Editar</span>
                                  </button>
                                  <div className="border-t border-slate-100 my-1" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenChildMenuId(null);
                                      setChildToDelete(child);
                                    }}
                                    className="w-full text-left px-3 py-1.5 hover:bg-rose-50 text-rose-600 flex items-center gap-1.5 font-medium cursor-pointer"
                                  >
                                    <Trash2 size={13} />
                                    <span>Excluir</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ABA 2: SUBITEM (TAREFAS OPERACIONAIS) */}
            {activeTab === 'subitem' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Checklist Operacional
                  </span>
                  {!isAddingTask && (
                    <button
                      type="button"
                      disabled={isItemBlocked}
                      onClick={() => setIsAddingTask(true)}
                      className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1 cursor-pointer bg-sky-50 px-3 py-1.5 rounded-xl border border-sky-200/60 disabled:opacity-50"
                    >
                      <Plus size={14} />
                      <span>Adicionar Subitem / Tarefa</span>
                    </button>
                  )}
                </div>

                {/* Formulário de Tarefa */}
                {isAddingTask && (
                  <form onSubmit={handleCreateTaskSubmit} className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3.5 shadow-md">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <span className="text-xs font-bold text-slate-800">Nova Tarefa / Checklist</span>
                      <button type="button" onClick={() => setIsAddingTask(false)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                        <X size={14} />
                      </button>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] text-slate-500 font-bold mb-1">Título da Atividade *</label>
                          <input
                            type="text"
                            autoFocus
                            required
                            value={taskTitle}
                            onChange={e => setTaskTitle(e.target.value)}
                            placeholder="Ex: Montagem dos trilhos de fixação..."
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 font-medium"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-500 font-bold mb-1">Tipo de Subitem</label>
                          <select
                            value={taskSubitemType}
                            onChange={e => setTaskSubitemType(e.target.value)}
                            className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold cursor-pointer text-slate-700 focus:ring-2 focus:ring-sky-500"
                          >
                            <option value="">Selecione a categoria...</option>
                            {subitemTypes.map((st: any) => (
                              <option key={st.id || st.name} value={st.name}>{st.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-500 font-bold mb-1">Descrição / Instruções</label>
                        <textarea
                          rows={2}
                          placeholder="Descreva o que precisa ser feito..."
                          value={taskDescription}
                          onChange={e => setTaskDescription(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium resize-none focus:ring-2 focus:ring-sky-500"
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

                      <div className="flex items-center gap-3 py-1 mt-1 border-t border-slate-100 pt-2">
                        <label className="flex items-center gap-1.5 text-slate-700 font-medium cursor-pointer">
                          <input
                            type="radio"
                            name="task_drawer_type"
                            checked={!taskHasProgress}
                            onChange={() => setTaskHasProgress(false)}
                            className="text-sky-600"
                          />
                          <span>Checklist Simples</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-slate-700 font-medium cursor-pointer">
                          <input
                            type="radio"
                            name="task_drawer_type"
                            checked={taskHasProgress}
                            onChange={() => setTaskHasProgress(true)}
                            className="text-sky-600"
                          />
                          <span>Quantitativo (Progresso)</span>
                        </label>
                      </div>

                      {taskHasProgress && (
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="Meta (ex: 100)"
                            value={taskPlannedQty}
                            onChange={e => setTaskPlannedQty(e.target.value)}
                            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                          />
                          <select
                            value={taskUnit}
                            onChange={e => setTaskUnit(e.target.value)}
                            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold cursor-pointer"
                          >
                            {UNIT_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-500 font-bold mb-0.5">Data Início</label>
                          <input
                            type="date"
                            value={taskStartDate}
                            min={minNewStartDate}
                            onChange={e => setTaskStartDate(e.target.value)}
                            className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 font-bold mb-0.5">Data Término</label>
                          <input
                            type="date"
                            value={taskDueDate}
                            min={taskStartDate || minNewStartDate}
                            onChange={e => setTaskDueDate(e.target.value)}
                            className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium"
                          />
                        </div>
                      </div>

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
                                onClick={() => {
                                  setTaskDependsOnId('');
                                  setIsDepDropdownOpen(false);
                                }}
                                className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-slate-50 text-xs font-semibold text-slate-500 cursor-pointer"
                              >
                                Sem dependência
                              </button>
                              {filteredNewTaskDeps.map(opt => (
                                <button
                                  type="button"
                                  key={opt.id}
                                  onClick={() => {
                                    setTaskDependsOnId(opt.id);
                                    setIsDepDropdownOpen(false);
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 hover:bg-sky-50 text-xs font-semibold text-slate-800 flex flex-col cursor-pointer"
                                >
                                  <span>{opt.title}</span>
                                  <span className="text-[10px] text-slate-400 font-normal">Item: {(opt as any)?.parentTitle}</span>
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
                          className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-semibold shadow-2xs cursor-pointer"
                        >
                          Salvar Subitem
                        </button>
                      </div>
                    </div>
                  </form>
                )}

                {/* Lista de Subitens */}
                {tasks.length === 0 ? (
                  <div className="p-10 text-center text-xs text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl italic">
                    Nenhum subitem cadastrado neste componente.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tasks.map(task => {
                      const isTaskDone = task.status === 'concluida';
                      const isTaskBlockedManual = task.status === 'bloqueada';
                      const isInProgress = task.status === 'em_andamento';

                      const dependencyTask = task.depends_on_task_id
                        ? allTasks.find(t => t.id === task.depends_on_task_id)
                        : null;
                      const isBlockedByDependency = (dependencyTask && dependencyTask.status !== 'concluida') || isItemBlocked;
                      const isEffectiveBlocked = isTaskBlockedManual || isBlockedByDependency;

                      const taskExecutors = task.executed_by || [];
                      const primaryExecutorName = taskExecutors[0];
                      const primaryMemberObj = teamMembers.find(
                        m => m.name.toLowerCase() === primaryExecutorName?.toLowerCase()
                      );

                      const canToggle = (isTaskDone ? canReopenTasks : canCompleteTasks) && !isTaskBlockedManual;

                      return (
                        <div
                          key={task.id}
                          className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs ${
                            isTaskDone
                              ? 'bg-emerald-50/60 border-emerald-200'
                              : isTaskBlockedManual
                              ? 'bg-rose-50/50 border-rose-200'
                              : isBlockedByDependency
                              ? 'bg-amber-50/40 border-amber-200/80 shadow-2xs opacity-80'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start gap-2.5 flex-1 min-w-0">
                            {/* CHECKBOX */}
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
                                : !canToggle ? 'Sem permissão para alterar status'
                                : isTaskDone ? 'Reabrir tarefa' 
                                : 'Apontar / Concluir Tarefa'
                              }
                            >
                              {isTaskBlockedManual ? (
                                <ShieldAlert size={17} className="text-rose-600" />
                              ) : isBlockedByDependency ? (
                                <Lock size={16} className="text-amber-500" />
                              ) : isTaskDone ? (
                                taskExecutors.length > 0 ? (
                                  <div className="relative group/check">
                                    <div className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[8px] flex items-center justify-center overflow-hidden border border-emerald-400 shadow-2xs">
                                      {primaryMemberObj?.avatar_url ? (
                                        <img src={primaryMemberObj.avatar_url} alt="" className="w-full h-full object-cover" />
                                      ) : (
                                        <span>{getInitials(primaryExecutorName)}</span>
                                      )}
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 text-white flex items-center justify-center border border-white">
                                      <CheckSquare size={7} />
                                    </div>
                                  </div>
                                ) : (
                                  <CheckSquare size={17} className="text-emerald-600" />
                                )
                              ) : isInProgress ? (
                                <PlayCircle size={18} className="text-sky-500 hover:text-sky-600" />
                              ) : (
                                <Square size={17} className="text-slate-400 hover:text-emerald-600" />
                              )}
                            </button>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`font-bold block truncate ${isTaskDone ? 'line-through text-slate-400' : isTaskBlockedManual ? 'text-rose-900' : 'text-slate-800'}`}>
                                  {task.title}
                                </span>

                                {task.task_type && (
                                  <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-sky-50 border border-sky-200 text-sky-700 px-2 py-0.5 rounded-md">
                                    <Tag size={9} className="text-sky-500" />
                                    <span>{task.task_type}</span>
                                  </span>
                                )}

                                {!isEffectiveBlocked && dependencyTask && dependencyTask.status !== 'concluida' && (
                                  <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                                    <Lock size={9} />
                                    <span>Aguardando: {dependencyTask.title}</span>
                                  </span>
                                )}
                              </div>

                              {/* Aviso de Bloqueio */}
                              {isTaskBlockedManual && task.blocked_reason && (
                                <div className="mt-1.5 mb-1 bg-rose-100 border border-rose-200 text-rose-800 p-2 rounded-lg text-[10px] flex items-start gap-1.5">
                                  <ShieldAlert size={12} className="shrink-0 mt-0.5 text-rose-600" />
                                  <div>
                                    <strong className="block uppercase tracking-wider text-[9px] text-rose-600">Restrição / Pendência:</strong>
                                    <p className="leading-snug font-medium">{task.blocked_reason}</p>
                                  </div>
                                </div>
                              )}

                              {task.description && !isTaskBlockedManual && (
                                <p className="text-[11px] text-slate-500 mt-1 leading-snug font-normal">
                                  {task.description}
                                </p>
                              )}

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

                            {/* 6º MELHORIA: MENU DE AÇÕES DA TAREFA COM EDITAR, BLOQUEAR E EXCLUIR */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setOpenTaskMenuId(openTaskMenuId === task.id ? null : task.id)}
                                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition"
                              >
                                <MoreVertical size={14} />
                              </button>

                              {openTaskMenuId === task.id && (
                                <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50 text-xs">
                                  {/* 1º Bloquear / Desbloquear */}
                                  {isTaskBlockedManual ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenTaskMenuId(null);
                                        handleUnblockTask(task);
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
                                        setBlockingTask(task);
                                      }}
                                      className="w-full text-left px-3.5 py-1.5 hover:bg-amber-50 text-amber-700 flex items-center gap-1.5 font-bold cursor-pointer"
                                    >
                                      <ShieldAlert size={13} />
                                      <span>Bloquear (Restrição)</span>
                                    </button>
                                  )}

                                  {/* 6º Botão de Editar Tarefa */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenTaskMenuId(null);
                                      handleOpenEditTask(task);
                                    }}
                                    className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 font-medium cursor-pointer"
                                  >
                                    <Edit2 size={13} className="text-sky-600" />
                                    <span>Editar Tarefa</span>
                                  </button>

                                  <div className="border-t border-slate-100 my-1" />
                                  
                                  {/* 2º Excluir com Modal */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenTaskMenuId(null);
                                      setTaskToDelete(task);
                                    }}
                                    className="w-full text-left px-3.5 py-1.5 hover:bg-rose-50 text-rose-600 flex items-center gap-1.5 font-medium cursor-pointer"
                                  >
                                    <Trash2 size={12} />
                                    <span>Excluir</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ABA 3: ANEXOS E FOTOS */}
            {activeTab === 'attachments' && (
              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Galeria e Documentos Técnicos
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsUploadModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold shadow-2xs transition cursor-pointer"
                  >
                    <Upload size={13} />
                    <span>Novo Anexo / Foto</span>
                  </button>
                </div>

                {loadingAttachments ? (
                  <div className="p-10 text-center text-slate-400">
                    <Loader2 size={18} className="animate-spin mx-auto mb-2 text-sky-600" />
                    <span>Carregando anexos...</span>
                  </div>
                ) : attachments.length === 0 ? (
                  <div className="p-10 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-center text-slate-400 space-y-2">
                    <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                      <Camera size={20} />
                    </div>
                    <span className="font-bold text-slate-700 text-sm">Nenhum anexo ou foto</span>
                    <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed">
                      Clique em "Novo Anexo / Foto" para fazer o upload com nome e descrição personalizada.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5">
                    {attachments.map(att => {
                      const isImage = att.file_type?.startsWith('image/');

                      return (
                        <div
                          key={att.id}
                          className="p-3 bg-white border border-slate-200 rounded-2xl shadow-2xs hover:border-slate-300 transition flex items-start justify-between gap-3"
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200/80 overflow-hidden shrink-0 flex items-center justify-center text-slate-400">
                              {isImage ? (
                                <img src={att.file_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <FileCheck size={20} className="text-slate-500" />
                              )}
                            </div>

                            <div className="min-w-0 space-y-0.5">
                              <h4 className="font-bold text-slate-900 text-xs truncate">
                                {att.title}
                              </h4>
                              {att.description && (
                                <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                                  {att.description}
                                </p>
                              )}
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 pt-0.5">
                                {att.file_size && <span>{formatFileSize(att.file_size)}</span>}
                                {att.created_at && (
                                  <span>• {new Date(att.created_at).toLocaleDateString('pt-BR')}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <a
                              href={att.file_url}
                              target="_blank"
                              rel="noreferrer"
                              download
                              className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition"
                              title="Visualizar anexo"
                            >
                              <ExternalLink size={14} />
                            </a>
                            <button
                              type="button"
                              onClick={() => setAttachmentToDelete(att)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Excluir anexo"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

          </div>

          {/* 3º MELHORIA: O RODAPÉ FOI COMPLETAMENTE REMOVIDO! O "X" DO TOPO FAZ O FECHAMENTO */}
        </aside>
      </div>

      {/* 1º MELHORIA: MODAL DE BLOQUEAR TAREFA COM JUSTIFICATIVA */}
      {blockingTask && (
        <div className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-rose-600">
                <ShieldAlert size={18} />
                <h4 className="font-bold text-slate-900 text-sm">Bloquear Tarefa</h4>
              </div>
              <button onClick={() => setBlockingTask(null)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Tarefa Restrita:</span>
                <p className="font-bold text-slate-800 text-sm break-words">{blockingTask.title}</p>
              </div>

              <div>
                <label className="block font-semibold text-rose-800 mb-1">Qual é a restrição / motivo do bloqueio? *</label>
                <textarea
                  required
                  rows={3}
                  value={blockReason}
                  onChange={e => setBlockReason(e.target.value)}
                  placeholder="Ex: Falta de material, aguardando aprovação do cliente, área não liberada..."
                  className="w-full px-3 py-2 bg-rose-50/50 border border-rose-200 rounded-xl font-medium focus:ring-2 focus:ring-rose-500 resize-none text-slate-800"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setBlockingTask(null)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isBlocking || !blockReason.trim()}
                  onClick={handleConfirmBlockTask}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                >
                  {isBlocking ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />}
                  Confirmar Bloqueio
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2º MELHORIA: MODAL EXCLUIR TAREFA (NÃO USA WINDOW.CONFIRM) */}
      {taskToDelete && (
        <div className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <Trash2 size={22} />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-base">Excluir Subtarefa</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Tem certeza que deseja remover a subtarefa <strong className="text-slate-800">"{taskToDelete.title}"</strong>?
              </p>
            </div>
            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={deletingTask}
                onClick={() => setTaskToDelete(null)}
                className="flex-1 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingTask}
                onClick={handleConfirmDeleteTask}
                className="flex-1 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {deletingTask ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                <span>Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2º MELHORIA: MODAL EXCLUIR ITEM FILHO (NÃO USA WINDOW.CONFIRM) */}
      {childToDelete && (
        <div className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <Trash2 size={22} />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-base">Excluir Subcomponente</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Tem certeza que deseja excluir <strong className="text-slate-800">"{childToDelete.title}"</strong> e todas as suas tarefas vinculadas?
              </p>
            </div>
            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={deletingChild}
                onClick={() => setChildToDelete(null)}
                className="flex-1 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingChild}
                onClick={handleConfirmDeleteChild}
                className="flex-1 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {deletingChild ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                <span>Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2º MELHORIA: MODAL EXCLUIR ANEXO (NÃO USA WINDOW.CONFIRM) */}
      {attachmentToDelete && (
        <div className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <Trash2 size={22} />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-base">Excluir Anexo</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Deseja remover o arquivo <strong className="text-slate-800">"{attachmentToDelete.title}"</strong>?
              </p>
            </div>
            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={deletingAttachment}
                onClick={() => setAttachmentToDelete(null)}
                className="flex-1 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingAttachment}
                onClick={handleConfirmDeleteAttachment}
                className="flex-1 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {deletingAttachment ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                <span>Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4º MELHORIA: MODAL CRIAR SUBCOMPONENTE */}
      {isCreateChildModalOpen && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FolderTree size={18} className="text-sky-600" />
                <h3 className="text-sm font-bold text-slate-900">Novo Subcomponente</h3>
              </div>
              <button onClick={() => setIsCreateChildModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveChildSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-2.5">
                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Título *</label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="Ex: Bomba D'água 02"
                    value={newChildTitle}
                    onChange={e => setNewChildTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tag / Código</label>
                  <input
                    type="text"
                    placeholder="BMB-02"
                    value={newChildCode}
                    onChange={e => setNewChildCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tipo de Componente</label>
                  <select
                    value={newChildType}
                    onChange={e => setNewChildType(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  >
                    <option value="">Sem tipo...</option>
                    {itemTypeOptions.map(t => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Local / Setor</label>
                  <input
                    type="text"
                    placeholder="Ex: Subsolo"
                    value={newChildLocation}
                    onChange={e => setNewChildLocation(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateChildModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingChild || !newChildTitle.trim()}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {creatingChild ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>Salvar Subcomponente</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5º MELHORIA: MODAL EDITAR SUBCOMPONENTE FILHO */}
      {editingChild && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Edit2 size={18} className="text-sky-600" />
                <h3 className="text-sm font-bold text-slate-900">Editar Subcomponente</h3>
              </div>
              <button onClick={() => setEditingChild(null)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveChildEdit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-2.5">
                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Título *</label>
                  <input
                    type="text"
                    required
                    value={editChildTitle}
                    onChange={e => setEditChildTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tag / Código</label>
                  <input
                    type="text"
                    value={editChildCode}
                    onChange={e => setEditChildCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tipo de Componente</label>
                  <select
                    value={editChildType}
                    onChange={e => setEditChildType(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  >
                    <option value="">Sem tipo...</option>
                    {itemTypeOptions.map(t => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Local / Setor</label>
                  <input
                    type="text"
                    value={editChildLocation}
                    onChange={e => setEditChildLocation(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingChild(null)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingChildEdit || !editChildTitle.trim()}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {savingChildEdit ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>Salvar Alterações</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6º MELHORIA: MODAL EDITAR SUBTAREFA */}
      {editingTask && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Edit2 size={18} className="text-sky-600" />
                <h3 className="text-sm font-bold text-slate-900">Editar Subtarefa</h3>
              </div>
              <button onClick={() => setEditingTask(null)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveTaskEditSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Título da Atividade *</label>
                <input
                  type="text"
                  required
                  value={editTaskTitle}
                  onChange={e => setEditTaskTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tipo de Subitem</label>
                <select
                  value={editTaskType}
                  onChange={e => setEditTaskType(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold cursor-pointer text-slate-700"
                >
                  <option value="">Selecione o tipo...</option>
                  {subitemTypes.map((st: any) => (
                    <option key={st.id || st.name} value={st.name}>{st.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Descrição</label>
                <textarea
                  rows={2}
                  value={editTaskDesc}
                  onChange={e => setEditTaskDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium resize-none"
                />
              </div>

              {editingTask.has_progress_tracking && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Meta Quantitativa</label>
                    <input
                      type="text"
                      value={editTaskPlannedQty}
                      onChange={e => setEditTaskPlannedQty(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Unidade</label>
                    <select
                      value={editTaskUnit}
                      onChange={e => setEditTaskUnit(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                    >
                      {UNIT_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Data Início</label>
                  <input
                    type="date"
                    value={editTaskStartDate}
                    onChange={e => setEditTaskStartDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Data Término</label>
                  <input
                    type="date"
                    value={editTaskDueDate}
                    min={editTaskStartDate || undefined}
                    onChange={e => setEditTaskDueDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Dependência Lógica (Aguardar Tarefa)</label>
                <select
                  value={editTaskDependsOnId}
                  onChange={e => setEditTaskDependsOnId(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                >
                  <option value="">Sem dependência (Livre para iniciar)</option>
                  {allTasks.filter(t => t.id !== editingTask.id).map(other => (
                    <option key={other.id} value={other.id}>
                      {other.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingTask(null)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingTaskEdit || !editTaskTitle.trim()}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {savingTaskEdit ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>Salvar Subtarefa</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 1: EDITAR DADOS DO COMPONENTE PRINCIPAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Edit2 size={18} className="text-sky-600" />
                <h3 className="text-sm font-bold text-slate-900">Editar Componente</h3>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEditSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-2.5">
                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Título *</label>
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tag / Código</label>
                  <input
                    type="text"
                    value={editCode}
                    onChange={e => setEditCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Local / Setor</label>
                  <select
                    value={editLocation}
                    onChange={e => setEditLocation(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  >
                    <option value="">Sem local...</option>
                    {locationOptions.map(l => (
                      <option key={l.id} value={l.name}>{l.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tipo de Componente</label>
                  <select
                    value={editItemType}
                    onChange={e => setEditItemType(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  >
                    <option value="">Sem tipo...</option>
                    {itemTypeOptions.map(t => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Data Início</label>
                  <input
                    type="date"
                    value={editStartDate}
                    onChange={e => setEditStartDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Data Término</label>
                  <input
                    type="date"
                    value={editDueDate}
                    min={editStartDate || undefined}
                    onChange={e => setEditDueDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Dependência (Item prévio)</label>
                <select
                  value={editDependsOnId}
                  onChange={e => setEditDependsOnId(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                >
                  <option value="">Sem dependência (Livre para iniciar)</option>
                  {allItems.filter(i => i.id !== item.id).map(other => (
                    <option key={other.id} value={other.id}>
                      {other.title} {other.code ? `(${other.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit || !editTitle.trim()}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {savingEdit ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>Salvar Alterações</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2º MELHORIA: MODAL EXCLUIR ITEM PRINCIPAL */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <Trash2 size={22} />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-900">Excluir Componente</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Tem certeza que deseja excluir <strong className="text-slate-800">"{item.title}"</strong> e todas as suas tarefas vinculadas? Esta ação é irreversível.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={deletingItem}
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 py-2 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingItem}
                onClick={handleConfirmDeleteItem}
                className="flex-1 py-2 px-3 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {deletingItem ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE APONTAMENTO DIÁRIO DE EXECUÇÃO */}
      {completingTask && (
        <div className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
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
              <button onClick={() => setCompletingTask(null)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                  Atividade Executada
                </span>
                <p className="font-semibold text-slate-800 text-sm">{completingTask.title}</p>
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

              {/* Equipe / Executores */}
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

                <div className="space-y-1.5 max-h-48 overflow-y-auto p-1.5 border border-slate-100 rounded-2xl bg-slate-50/50">
                  {filteredTeamMembers.length > 0 ? (
                    filteredTeamMembers.map(member => {
                      const isSelected = selectedExecutors.includes(member.name);
                      return (
                        <button
                          type="button"
                          key={member.id}
                          disabled={!canAssignExecutors}
                          onClick={() => toggleModalExecutor(member.name)}
                          className={`w-full p-2.5 rounded-xl text-left border transition flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? 'bg-sky-50 border-sky-300 text-sky-900 font-bold'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 font-medium'
                          } ${!canAssignExecutors ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border overflow-hidden ${
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
                    <div className="p-3 text-center text-slate-400 italic">Nenhum membro encontrado.</div>
                  )}
                </div>
              </div>

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

      {/* MODAL DE UPLOAD DE ANEXO */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Upload size={18} className="text-sky-600" />
                <h3 className="text-sm font-bold text-slate-900">Novo Anexo ou Foto</h3>
              </div>
              <button onClick={() => setIsUploadModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Arquivo / Foto *</label>
                <input
                  type="file"
                  required
                  ref={fileInputRef}
                  onChange={e => {
                    const file = e.target.files?.[0] || null;
                    setUploadFile(file);
                    if (file && !uploadTitle) setUploadTitle(file.name.replace(/\.[^/.]+$/, ''));
                  }}
                  className="w-full text-slate-500 file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100 cursor-pointer"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome do Anexo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Foto dos módulos instalados, Laudo de aterramento..."
                  value={uploadTitle}
                  onChange={e => setUploadTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Descrição / Legenda</label>
                <textarea
                  rows={3}
                  placeholder="Explique o que este documento ou foto comprova..."
                  value={uploadDescription}
                  onChange={e => setUploadDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium resize-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingUpload || !uploadFile || !uploadTitle.trim()}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-semibold shadow-2xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmittingUpload ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                  <span>Enviar Anexo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default WorkItemDrawer;