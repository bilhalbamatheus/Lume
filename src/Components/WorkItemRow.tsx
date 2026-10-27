import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Plus,
  MoreVertical,
  Edit2,
  Trash2,
  Copy,
  Calendar,
  Settings,
  CheckSquare,
  Square,
  Search,
  X,
  Lock,
  Unlink,
  Loader2,
  CheckCircle2,
  Users,
  UserCheck,
  Camera,
  Layers,
  Tag,
  DollarSign,
  PlayCircle,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export interface WorkTask {
  id: string;
  work_item_id: string;
  title: string;
  task_type?: string | null;
  description?: string | null;
  executed_by?: string[] | null;
  status: 'pendente' | 'em_andamento' | 'bloqueada' | 'concluida';
  has_progress_tracking: boolean;
  quantity_planned: number;
  quantity_executed: number;
  unit: string;
  unit_price: number;
  is_measured: boolean;
  weight: number;
  start_date?: string | null;
  due_date?: string | null;
  completed_at?: string | null;
  depends_on_task_id?: string | null;
  blocked_reason?: string | null;
  blocked_by?: string | null;
  blocked_at?: string | null;
}

export interface WorkItem {
  id: string;
  parent_id?: string | null;
  template_item_id?: string | null;
  code: string | null;
  title: string;
  item_type?: string | null;
  description?: string | null;
  location?: string | null;
  unit_price: number;
  weight: number;
  progress_percent: number;
  status: 'nao_iniciado' | 'em_andamento' | 'bloqueado' | 'concluido';
  start_date?: string | null;
  due_date?: string | null;
  depends_on_item_id?: string | null;
  tasks?: WorkTask[];
  children?: WorkItem[];
}

export interface TeamMember {
  id: string;
  name: string;
  role?: string;
  team_id?: string | null;
  avatar_url?: string | null;
}

export interface CompanyTeam {
  id: string;
  name: string;
}

export interface SettingOption {
  id: string;
  name: string;
  category: 'location' | 'item_type' | 'task_type';
  color?: string;
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

export interface WorkItemRowProps {
  item: WorkItem;
  depth?: number;
  measurementType: 'por_subitem' | 'por_item' | 'sem_medicao';
  allTasks?: WorkTask[];
  allItems?: WorkItem[];
  teamMembers?: TeamMember[];
  companyTeams?: CompanyTeam[];
  itemTypes?: SettingOption[];
  subitemTypes?: SettingOption[];
  isAllExpanded?: boolean;
  onOpenQuickSettings?: () => void;
  isParentBlocked?: boolean;
  canManageItems?: boolean;
  canDeleteItems?: boolean;
  canDuplicateItems?: boolean;
  canCreateTasks?: boolean;
  canCompleteTasks?: boolean;
  canReopenTasks?: boolean;
  canViewPrices?: boolean;
  canAssignExecutors?: boolean;
  onUnlinkItemDependency?: (itemId: string) => Promise<void>;
  onOpenItemDrawer: (item: WorkItem) => void;
  onOpenCreateChildModal: (parentId: string, parentTitle: string) => void;
  onOpenEditItemModal: (item: WorkItem) => void;
  onOpenDeleteItemModal: (item: WorkItem) => void;
  onDuplicateItem: (item: WorkItem) => Promise<void> | void;
  onCompleteAllItemTasks?: (item: WorkItem, executors?: string[]) => Promise<void>;
  onUploadItemFiles?: (item: WorkItem, files: FileList) => Promise<void>;
  onToggleTaskStatus: (item: WorkItem, task: WorkTask, executors?: string[]) => void;
  onSaveTaskEntry?: (payload: DailyEntryPayload) => Promise<void>;
  onUpdateTaskExecutedQty: (item: WorkItem, task: WorkTask, rawVal: string) => void;
  onOpenEditTaskModal: (task: WorkTask) => void;
  onOpenDeleteTaskModal: (task: WorkTask, parentItemId: string) => void;
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

export const WorkItemRow: React.FC<WorkItemRowProps> = ({
  item,
  depth = 1,
  measurementType,
  allTasks = [],
  allItems = [],
  teamMembers = [],
  companyTeams = [],
  itemTypes = [],
  subitemTypes = [],
  isAllExpanded = true,
  onOpenQuickSettings,
  isParentBlocked = false,
  canManageItems = true,
  canDeleteItems = true,
  canDuplicateItems = true,
  canCreateTasks = true,
  canCompleteTasks = true,
  canReopenTasks = true,
  canViewPrices = true,
  canAssignExecutors = true,
  onUnlinkItemDependency,
  onOpenItemDrawer,
  onOpenCreateChildModal,
  onOpenEditItemModal,
  onOpenDeleteItemModal,
  onDuplicateItem,
  onCompleteAllItemTasks,
  onUploadItemFiles,
  onToggleTaskStatus,
  onSaveTaskEntry,
  onUpdateTaskExecutedQty,
  onOpenEditTaskModal,
  onOpenDeleteTaskModal,
  onSaveInlineTask
}) => {
  const [isExpanded, setIsExpanded] = useState(isAllExpanded);
  const [openItemMenu, setOpenItemMenu] = useState(false);
  const [openTaskMenuId, setOpenTaskMenuId] = useState<string | null>(null);

  // Armazena as tarefas localmente para refletir bloqueios instantâneos
  const [localTasks, setLocalTasks] = useState<WorkTask[]>(item.tasks || []);

  useEffect(() => {
    setLocalTasks(item.tasks || []);
  }, [item.tasks]);

  // Estados do Modal de Apontamento Diário
  const [completingTask, setCompletingTask] = useState<WorkTask | null>(null);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryQty, setEntryQty] = useState('');
  const [entryNotes, setEntryNotes] = useState('');
  const [selectedExecutors, setSelectedExecutors] = useState<string[]>([]);
  const [isSavingEntry, setIsSavingEntry] = useState(false);
  const [checklistAction, setChecklistAction] = useState<'progress' | 'complete'>('complete');

  const [isCompletingAllItem, setIsCompletingAllItem] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Estados do Modal de Bloqueio (Restrição)
  const [blockingTask, setBlockingTask] = useState<WorkTask | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);

  useEffect(() => {
    setIsExpanded(isAllExpanded);
  }, [isAllExpanded]);

  const normalizedSubitemTypes = useMemo(() => {
    return subitemTypes.map((st: any) =>
      typeof st === 'string' ? { id: st, name: st, color: undefined } : st
    );
  }, [subitemTypes]);

  const [isAddingTask, setIsAddingTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskSubitemType, setTaskSubitemType] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskHasProgress, setTaskHasProgress] = useState(false);
  const [taskPlannedQty, setTaskPlannedQty] = useState('1');
  const [taskUnit, setTaskUnit] = useState('un');
  const [taskPrice, setTaskPrice] = useState('');
  const [taskStartDate, setTaskStartDate] = useState(item.start_date || '');
  const [taskDueDate, setTaskDueDate] = useState(item.due_date || '');
  const [taskDependsOnId, setTaskDependsOnId] = useState('');
  
  // Criar tarefa bloqueada
  const [createAsBlocked, setCreateAsBlocked] = useState(false);
  const [createBlockReason, setCreateBlockReason] = useState('');

  useEffect(() => {
    if (!taskSubitemType && normalizedSubitemTypes.length > 0) {
      setTaskSubitemType(normalizedSubitemTypes[0].name);
    }
  }, [normalizedSubitemTypes, taskSubitemType]);

  const [depSearchTerm, setDepSearchTerm] = useState('');
  const [isDepDropdownOpen, setIsDepDropdownOpen] = useState(false);
  const depDropdownRef = useRef<HTMLDivElement>(null);

  const [configTask, setConfigTask] = useState<WorkTask | null>(null);
  const [configStartDate, setConfigStartDate] = useState('');
  const [configDueDate, setConfigDueDate] = useState('');
  const [configDependsOnId, setConfigDependsOnId] = useState('');
  const [configDepSearch, setConfigDepSearch] = useState('');
  const [isConfigDepOpen, setIsConfigDepOpen] = useState(false);
  const configDepRef = useRef<HTMLDivElement>(null);

  const [taskToUnlink, setTaskToUnlink] = useState<WorkTask | null>(null);
  const [itemDepToUnlink, setItemDepToUnlink] = useState<WorkItem | null>(null);
  const [unlinking, setUnlinking] = useState(false);

  const dependencyItem = allItems.find(i => i.id === item.depends_on_item_id);

  const isItemBlocked = useMemo(() => {
    if (!dependencyItem) return false;
    if (dependencyItem.progress_percent >= 100) return false;

    const depTasks = allTasks.filter(t => t.work_item_id === dependencyItem.id);
    if (depTasks.length === 0) {
      return (dependencyItem.progress_percent || 0) < 100;
    }
    return !depTasks.every(t => t.status === 'concluida');
  }, [dependencyItem, allTasks]);

  const effectiveIsBlocked = isItemBlocked || isParentBlocked;
  const hasChildren = item.children && item.children.length > 0;

  const paddingLeftClass =
    depth === 1
      ? ''
      : depth === 2
      ? 'pl-2 sm:pl-3.5 border-l-2 border-sky-200'
      : depth === 3
      ? 'pl-3 sm:pl-5 border-l-2 border-indigo-200'
      : 'pl-4 sm:pl-7 border-l-2 border-slate-300';

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (depDropdownRef.current && !depDropdownRef.current.contains(e.target as Node)) {
        setIsDepDropdownOpen(false);
      }
      if (configDepRef.current && !configDepRef.current.contains(e.target as Node)) {
        setIsConfigDepOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const calculatedProgress = useMemo(() => {
    const tasks = localTasks;
    const children = item.children || [];

    if (tasks.length === 0 && children.length === 0) {
      return item.progress_percent || 0;
    }

    let totalTasksUnits = 0;
    let doneTasksUnits = 0;

    tasks.forEach(t => {
      totalTasksUnits += 1;
      if (t.status === 'concluida') {
        doneTasksUnits += 1;
      } else if (t.has_progress_tracking && t.quantity_planned > 0) {
        doneTasksUnits += Math.min(1, (t.quantity_executed || 0) / t.quantity_planned);
      }
    });

    if (children.length > 0) {
      const childrenSum = children.reduce((acc, c) => acc + (c.progress_percent || 0), 0);
      const childrenAvg = childrenSum / children.length;

      if (tasks.length === 0) {
        return Math.round(childrenAvg);
      }
      const tasksScore = (doneTasksUnits / totalTasksUnits) * 100;
      return Math.round((tasksScore + childrenAvg) / 2);
    }

    return totalTasksUnits > 0 ? Math.round((doneTasksUnits / totalTasksUnits) * 100) : 0;
  }, [localTasks, item.children, item.progress_percent]);

  const availableDependencyOptions = allTasks
    .filter(t => t.id !== configTask?.id)
    .map(t => {
      const parentItemTitle = item.id === t.work_item_id ? item.title : 'Item Relacionado';
      return {
        id: t.id,
        title: t.title,
        parentTitle: parentItemTitle,
        dueDate: t.due_date,
        status: t.status
      };
    });

  const filteredNewTaskDeps = availableDependencyOptions.filter(
    opt =>
      opt.title.toLowerCase().includes(depSearchTerm.toLowerCase()) ||
      opt.parentTitle.toLowerCase().includes(depSearchTerm.toLowerCase())
  );

  const filteredConfigTaskDeps = availableDependencyOptions.filter(
    opt =>
      opt.title.toLowerCase().includes(configDepSearch.toLowerCase()) ||
      opt.parentTitle.toLowerCase().includes(configDepSearch.toLowerCase())
  );

  const selectedNewDepObj = availableDependencyOptions.find(o => o.id === taskDependsOnId);
  const minNewStartDate = selectedNewDepObj?.dueDate || undefined;

  const selectedConfigDepObj = availableDependencyOptions.find(o => o.id === configDependsOnId);
  const minConfigStartDate = selectedConfigDepObj?.dueDate || undefined;

  const handleTaskCheckboxClick = (task: WorkTask) => {
    if (task.status === 'bloqueada') return;

    const isDone = task.status === 'concluida';
    if (isDone) {
      if (!canReopenTasks) return;
      onToggleTaskStatus(item, task, []);
    } else {
      if (!canCompleteTasks) return;
      
      setCompletingTask(task);
      setSelectedExecutors(task.executed_by || []);
      setEntryDate(new Date().toISOString().split('T')[0]);
      setEntryNotes('');
      
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
    if (!completingTask || !onSaveTaskEntry) return;

    try {
      setIsSavingEntry(true);
      const parsedQty = parseFloat(entryQty.replace(',', '.'));
      
      if (isNaN(parsedQty) || (parsedQty <= 0 && checklistAction === 'complete')) {
        alert('Para concluir, a quantidade executada deve ser maior que zero.');
        return;
      }

      await onSaveTaskEntry({
        taskId: completingTask.id,
        itemId: item.id,
        date: entryDate,
        quantity: parsedQty,
        teamId: null, // Modelo agora baseado puramente em colaboradores
        executors: selectedExecutors,
        notes: entryNotes,
        isChecklistComplete: !completingTask.has_progress_tracking && checklistAction === 'complete'
      });

      setCompletingTask(null);
      setSelectedExecutors([]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingEntry(false);
    }
  };

  const toggleExecutor = (memberName: string) => {
    if (!canAssignExecutors) return;
    setSelectedExecutors(prev =>
      prev.includes(memberName) ? prev.filter(m => m !== memberName) : [...prev, memberName]
    );
  };

  const handleCreateTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateTasks || !taskTitle.trim() || effectiveIsBlocked) return;

    if (createAsBlocked && !createBlockReason.trim()) {
      alert('Informe o motivo da restrição para bloquear a tarefa.');
      return;
    }

    onSaveInlineTask(
      item.id,
      taskTitle.trim(),
      taskHasProgress,
      taskPlannedQty,
      taskUnit,
      canViewPrices ? taskPrice : '0',
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
      
      setLocalTasks(prev => prev.map(t => t.id === blockingTask.id ? {
        ...t, status: 'bloqueada', blocked_reason: blockReason.trim()
      } : t));
      
      setBlockingTask(null);
      setBlockReason('');
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

      setLocalTasks(prev => prev.map(t => t.id === task.id ? {
        ...t, status: 'pendente', blocked_reason: null
      } : t));
    } catch (err: any) {
      alert('Erro ao desbloquear tarefa: ' + err.message);
    }
  };

  const handleOpenConfigModal = (task: WorkTask) => {
    if (effectiveIsBlocked) return;
    setConfigTask(task);
    setConfigStartDate(task.start_date || '');
    setConfigDueDate(task.due_date || '');
    setConfigDependsOnId(task.depends_on_task_id || '');
    setConfigDepSearch('');
  };

  const handleConfirmUnlinkTaskDependency = async () => {
    if (!taskToUnlink) return;
    try {
      setUnlinking(true);
      const { error } = await supabase
        .from('work_tasks')
        .update({ depends_on_task_id: null })
        .eq('id', taskToUnlink.id);

      if (error) throw error;
      
      setLocalTasks(prev => prev.map(t => t.id === taskToUnlink.id ? {
        ...t, depends_on_task_id: null
      } : t));
      
      setTaskToUnlink(null);
    } catch (err) {
      console.error('Erro ao desvincular dependência:', err);
    } finally {
      setUnlinking(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && onUploadItemFiles) {
      setIsUploading(true);
      try {
        await onUploadItemFiles(item, e.target.files);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const isDone = calculatedProgress >= 100;
  const currentItemTypeObj = itemTypes.find(t => t.name === item.item_type);

  return (
    <div className={`space-y-2.5 ${paddingLeftClass}`}>
      <div className={`bg-white border rounded-2xl shadow-2xs transition-all relative ${effectiveIsBlocked ? 'border-amber-200/80 bg-amber-50/10' : 'border-slate-200'}`}>
        
        {/* CABEÇALHO DO COMPONENTE / ITEM PAI */}
        <div
          onClick={() => onOpenItemDrawer(item)}
          className={`p-3 sm:p-3.5 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 cursor-pointer select-none rounded-t-2xl ${!isExpanded ? 'rounded-b-2xl' : ''}`}
        >
          <div className="flex items-start gap-2 sm:gap-2.5 min-w-0 flex-1">
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="p-1 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition shrink-0 cursor-pointer mt-0.5"
              title={isExpanded ? 'Recolher subitens' : 'Expandir subitens'}
            >
              {isExpanded ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
            </button>

            {depth > 1 && <ChevronRight size={13} className="text-slate-400 shrink-0 mt-1.5 hidden xs:block" />}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                {effectiveIsBlocked && (
                  <Lock size={13} className="text-amber-500 shrink-0" title="Item Bloqueado por Dependência" />
                )}
                
                <span className={`font-bold text-xs sm:text-sm break-words transition-colors ${effectiveIsBlocked ? 'text-amber-900' : 'text-slate-900 hover:text-sky-600'}`}>
                  {item.title}
                </span>

                {item.code && (
                  <span className="font-mono text-[9px] sm:text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold border border-slate-200 shrink-0">
                    {item.code}
                  </span>
                )}

                {item.item_type && (
                  <span
                    className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold border px-1.5 sm:px-2 py-0.5 rounded-md shrink-0"
                    style={{
                      backgroundColor: currentItemTypeObj?.color ? `${currentItemTypeObj.color}15` : '#e0e7ff',
                      borderColor: currentItemTypeObj?.color ? `${currentItemTypeObj.color}40` : '#c7d2fe',
                      color: currentItemTypeObj?.color || '#4338ca'
                    }}
                  >
                    <Layers size={10} style={{ color: currentItemTypeObj?.color || '#4f46e5' }} />
                    <span>{item.item_type}</span>
                  </span>
                )}

                {item.location && (
                  <span className="text-[9px] sm:text-[10px] bg-slate-100 text-slate-600 px-1.5 sm:px-2 py-0.5 rounded font-semibold border border-slate-200 shrink-0">
                    {item.location}
                  </span>
                )}

                {measurementType === 'por_item' && item.unit_price > 0 && canViewPrices && (
                  <span className="text-[9px] sm:text-[10px] bg-emerald-50 text-emerald-800 px-1.5 sm:px-2 py-0.5 rounded border border-emerald-100 font-bold shrink-0">
                    R$ {item.unit_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                )}

                {dependencyItem && isItemBlocked && (
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      setItemDepToUnlink(item);
                    }}
                    title="Clique para desvincular a dependência"
                    className="group flex items-center gap-1 text-[9px] sm:text-[10px] font-bold bg-amber-100/90 hover:bg-amber-200 text-amber-800 px-1.5 sm:px-2 py-0.5 rounded-full transition cursor-pointer border border-amber-200"
                  >
                    <Lock size={9} />
                    <span className="truncate max-w-[140px] sm:max-w-none">Aguardando: {dependencyItem.title}</span>
                    <X size={11} className="ml-0.5 text-amber-600 group-hover:text-amber-900" />
                  </button>
                )}
              </div>

              {item.description && (
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed line-clamp-2">
                  {item.description}
                </p>
              )}

              <div className="text-[10px] sm:text-[11px] text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                <span>
                  {localTasks.filter(t => t.status === 'concluida').length || 0} de {localTasks.length || 0} concluídas
                </span>
                {item.due_date && (
                  <span className="flex items-center gap-1 text-slate-500 font-medium">
                    <Calendar size={11} />
                    Até {new Date(item.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* PROGRESSO E AÇÕES DO ITEM */}
          <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100" onClick={e => e.stopPropagation()}>
            <div className="w-24 sm:w-28 mr-1 sm:mr-2">
              <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-0.5">
                <span>Avanço</span>
                <span className="text-sky-600">{calculatedProgress}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    isDone ? 'bg-emerald-500' : effectiveIsBlocked ? 'bg-amber-400' : 'bg-sky-500'
                  }`}
                  style={{ width: `${calculatedProgress}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-1">
              {!isDone && onCompleteAllItemTasks && canCompleteTasks && (
                <button
                  type="button"
                  disabled={effectiveIsBlocked}
                  onClick={() => {
                    setIsCompletingAllItem(true);
                    setSelectedExecutors([]);
                  }}
                  title="Concluir o item e todas as suas tarefas"
                  className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl transition cursor-pointer disabled:opacity-50 border border-emerald-100"
                >
                  <CheckCircle2 size={16} />
                </button>
              )}

              <label 
                title="Adicionar fotos ou arquivos a este item"
                className={`p-1.5 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-sky-600 rounded-xl transition cursor-pointer border border-slate-200 flex items-center justify-center ${isUploading ? 'opacity-50 cursor-wait' : ''}`}
              >
                {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                <input 
                  type="file" 
                  multiple 
                  className="hidden" 
                  onChange={handleFileUpload} 
                  disabled={isUploading || effectiveIsBlocked} 
                />
              </label>

              {depth < 5 && canManageItems && (
                <button
                  type="button"
                  disabled={effectiveIsBlocked}
                  onClick={() => onOpenCreateChildModal(item.id, item.title)}
                  className="p-1.5 bg-sky-50 text-sky-600 hover:bg-sky-100 rounded-xl text-xs font-semibold flex items-center gap-1 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus size={14} />
                  <span className="hidden md:inline">Componente</span>
                </button>
              )}

              <div className="relative">
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    setOpenItemMenu(!openItemMenu);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer transition border border-transparent"
                >
                  <MoreVertical size={16} />
                </button>

                {openItemMenu && (
                  <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-2xl shadow-xl py-1.5 z-50 text-xs animate-in fade-in duration-100">
                    {canManageItems && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          setOpenItemMenu(false);
                          onOpenEditItemModal(item);
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-slate-700 flex items-center gap-2 font-medium cursor-pointer"
                      >
                        <Edit2 size={13} className="text-sky-600" />
                        <span>Editar Item</span>
                      </button>
                    )}

                    {canDuplicateItems && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          setOpenItemMenu(false);
                          onDuplicateItem(item);
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-slate-700 flex items-center gap-2 font-medium cursor-pointer"
                      >
                        <Copy size={13} className="text-indigo-600" />
                        <span>Duplicar / Multiplicar</span>
                      </button>
                    )}

                    {canDeleteItems && (
                      <>
                        <div className="border-t border-slate-100 my-1" />
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setOpenItemMenu(false);
                            onOpenDeleteItemModal(item);
                          }}
                          className="w-full text-left px-3.5 py-2 hover:bg-rose-50 text-rose-600 flex items-center gap-2 font-medium cursor-pointer"
                        >
                          <Trash2 size={13} />
                          <span>Excluir Item</span>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* LISTA DE SUBITENS / TAREFAS */}
        {isExpanded && (
          <div className="border-t border-slate-100 bg-slate-50/50 p-2.5 sm:p-4 space-y-2.5 sm:space-y-3 rounded-b-2xl">
            <div className="space-y-2">
              {localTasks.length === 0 && !isAddingTask ? (
                <p className="text-xs text-slate-400 italic py-1 text-center">
                  Nenhum subitem ou tarefa cadastrado neste item.
                </p>
              ) : (
                localTasks.map(task => {
                  const isTaskDone = task.status === 'concluida';
                  const isTaskBlockedManual = task.status === 'bloqueada';
                  const isTaskInProgress = task.status === 'em_andamento';

                  const dependencyTask = task.depends_on_task_id
                    ? localTasks.find(t => t.id === task.depends_on_task_id) || allTasks.find(t => t.id === task.depends_on_task_id)
                    : null;
                  
                  const isBlockedByDependency = (dependencyTask && dependencyTask.status !== 'concluida') || effectiveIsBlocked;
                  const canToggle = (isTaskDone ? canReopenTasks : canCompleteTasks) && !isTaskBlockedManual;
                  
                  const taskExecutors: string[] = task.executed_by || [];
                  const primaryExecutorName = taskExecutors[0];
                  const primaryMemberObj = teamMembers.find(
                    m => m.name.toLowerCase() === primaryExecutorName?.toLowerCase()
                  );
                  const matchingTypeObj = normalizedSubitemTypes.find(
                    t => t.name === task.task_type
                  );

                  return (
                    <div
                      key={task.id}
                      className={`p-2.5 sm:p-3 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 ${
                        isTaskDone
                          ? 'bg-emerald-50/60 border-emerald-200'
                          : isTaskBlockedManual
                          ? 'bg-rose-50/60 border-rose-200'
                          : isBlockedByDependency
                          ? 'bg-amber-50/40 border-amber-200/80 shadow-2xs opacity-80'
                          : isTaskInProgress
                          ? 'bg-sky-50/30 border-sky-200'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        {/* CHECKBOX DE TAREFA */}
                        <button
                          type="button"
                          disabled={isBlockedByDependency || !canToggle}
                          onClick={() => {
                            if (isBlockedByDependency || !canToggle) return;
                            handleTaskCheckboxClick(task);
                          }}
                          className={`shrink-0 mt-0.5 transition flex items-center justify-center ${
                            isBlockedByDependency || !canToggle
                              ? 'cursor-not-allowed opacity-60'
                              : 'cursor-pointer'
                          }`}
                          title={
                            isTaskBlockedManual 
                              ? 'Tarefa bloqueada manualmente. Use o menu para desbloquear.'
                              : isBlockedByDependency
                              ? (effectiveIsBlocked ? 'Item pai bloqueado' : `Bloqueado até concluir: ${dependencyTask?.title}`)
                              : !canToggle
                              ? 'Sem permissão para alterar status'
                              : isTaskDone
                              ? (primaryExecutorName ? `Concluído por ${taskExecutors.join(', ')} (Clique para reabrir)` : 'Concluído (Clique para reabrir)')
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
                          ) : isTaskInProgress ? (
                            <PlayCircle size={18} className="text-sky-500 hover:text-sky-600" />
                          ) : (
                            <Square size={17} className="text-slate-400 hover:text-emerald-600" />
                          )}
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                            <span className={`text-xs font-semibold break-words ${isTaskDone ? 'line-through text-slate-400' : isTaskBlockedManual ? 'text-rose-900' : 'text-slate-800'}`}>
                              {task.title}
                            </span>

                            {task.task_type && (
                              <span
                                className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold border px-1.5 sm:px-2 py-0.5 rounded-md"
                                style={{
                                  backgroundColor: matchingTypeObj?.color ? `${matchingTypeObj.color}15` : '#f0f9ff',
                                  borderColor: matchingTypeObj?.color ? `${matchingTypeObj.color}40` : '#bae6fd',
                                  color: matchingTypeObj?.color || '#0369a1'
                                }}
                              >
                                <Tag size={10} style={{ color: matchingTypeObj?.color || '#0284c7' }} />
                                <span>{task.task_type}</span>
                              </span>
                            )}

                            {measurementType === 'por_subitem' && task.unit_price > 0 && canViewPrices && (
                              <span className="text-[9px] sm:text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 sm:px-2 py-0.5 rounded font-bold shrink-0">
                                {task.unit_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                            )}

                            {!effectiveIsBlocked && dependencyTask && dependencyTask.status !== 'concluida' && (
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  setTaskToUnlink(task);
                                }}
                                title="Clique para desvincular a dependência da tarefa"
                                className="group flex items-center gap-1 text-[9px] sm:text-[10px] font-bold bg-amber-100/90 hover:bg-amber-200 text-amber-800 px-1.5 sm:px-2 py-0.5 rounded-full transition cursor-pointer border border-amber-200"
                              >
                                <Lock size={9} />
                                <span className="truncate max-w-[120px] sm:max-w-none">Aguardando: {dependencyTask?.title}</span>
                                <X size={11} className="ml-0.5 text-amber-600 group-hover:text-amber-900" />
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

                          {task.description && !isTaskBlockedManual && (
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                              {task.description}
                            </p>
                          )}

                          {(task.start_date || task.due_date) && (
                            <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1.5">
                              <Calendar size={11} />
                              <span>
                                {task.start_date ? new Date(task.start_date + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                                {' até '}
                                {task.due_date ? new Date(task.due_date + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        {taskExecutors.length > 0 && !isTaskBlockedManual && (
                          <div className="relative group flex items-center cursor-pointer">
                            <div className="flex -space-x-1.5 overflow-hidden py-0.5">
                              {taskExecutors.slice(0, 3).map((execName, idx) => {
                                const mObj = teamMembers.find(m => m.name.toLowerCase() === execName.toLowerCase());
                                return (
                                  <div
                                    key={idx}
                                    className="inline-flex items-center justify-center w-5 sm:w-6 h-5 sm:h-6 rounded-full bg-sky-600 text-white font-bold text-[8px] border-2 border-white shadow-2xs uppercase overflow-hidden"
                                    title={execName}
                                  >
                                    {mObj?.avatar_url ? (
                                      <img src={mObj.avatar_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      getInitials(execName)
                                    )}
                                  </div>
                                );
                              })}
                              {taskExecutors.length > 3 && (
                                <div className="inline-flex items-center justify-center w-5 sm:w-6 h-5 sm:h-6 rounded-full bg-slate-200 text-slate-700 font-bold text-[8px] border-2 border-white shadow-2xs">
                                  +{taskExecutors.length - 3}
                                </div>
                              )}
                            </div>

                            <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block z-[80] w-48 p-2 bg-slate-900 text-white text-[11px] rounded-xl shadow-xl animate-in fade-in duration-150">
                              <span className="font-bold text-sky-400 block mb-1 text-[10px] uppercase tracking-wider border-b border-slate-700 pb-0.5">
                                Executado por:
                              </span>
                              <div className="space-y-1">
                                {taskExecutors.map((execName, idx) => (
                                  <div key={idx} className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                                    <span className="font-semibold text-white truncate">{execName}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {task.has_progress_tracking && !isTaskBlockedManual && (
                          <div className={`flex items-center gap-1.5 border px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-xl text-xs ${isBlockedByDependency ? 'bg-amber-50/50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
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
                            disabled={effectiveIsBlocked}
                            onClick={e => {
                              e.stopPropagation();
                              setOpenTaskMenuId(openTaskMenuId === task.id ? null : task.id);
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <MoreVertical size={14} />
                          </button>

                          {openTaskMenuId === task.id && !effectiveIsBlocked && (
                            <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50 text-xs">
                              
                              {/* AÇÕES DE BLOQUEIO / DESBLOQUEIO */}
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
                                  <span>Bloquear (Com Restrição)</span>
                                </button>
                              )}

                              {canCreateTasks && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenTaskMenuId(null);
                                    handleOpenConfigModal(task);
                                  }}
                                  className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 font-medium cursor-pointer"
                                >
                                  <Settings size={13} className="text-sky-600" />
                                  <span>Editar / Prazos</span>
                                </button>
                              )}
                              
                              {canDeleteItems && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenTaskMenuId(null);
                                    onOpenDeleteTaskModal(task, item.id);
                                  }}
                                  className="w-full text-left px-3.5 py-1.5 hover:bg-rose-50 text-rose-600 flex items-center gap-1.5 font-medium cursor-pointer"
                                >
                                  <Trash2 size={13} />
                                  <span>Excluir</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* FORMULÁRIO DE ADIÇÃO DE SUBITEM (ADAPTADO PARA MOBILE) */}
            {isAddingTask ? (
              <form onSubmit={handleCreateTaskSubmit} className="p-3 sm:p-3.5 bg-white border border-slate-200 rounded-2xl space-y-3 shadow-2xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-800">Novo Subitem / Tarefa</span>
                  <button type="button" onClick={() => setIsAddingTask(false)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                    <X size={14} />
                  </button>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
                          <Tag size={10} className="text-slate-400" />
                          <span>Tipo de Subitem</span>
                        </label>
                        {onOpenQuickSettings && (
                          <button
                            type="button"
                            onClick={onOpenQuickSettings}
                            className="text-sky-600 hover:underline font-bold text-[10px] flex items-center gap-0.5 cursor-pointer"
                            title="Cadastrar novo tipo de subitem"
                          >
                            <Plus size={10} />
                            <span>Novo</span>
                          </button>
                        )}
                      </div>

                      <select
                        value={taskSubitemType}
                        onChange={e => setTaskSubitemType(e.target.value)}
                        className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold cursor-pointer text-slate-700 focus:ring-2 focus:ring-sky-500"
                      >
                        <option value="">Selecione a categoria...</option>
                        {normalizedSubitemTypes.map((st: any) => (
                          <option key={st.id || st.name} value={st.name}>
                            {st.name}
                          </option>
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

                  <div className="flex items-center gap-3 py-1 border-t border-slate-100 mt-2 pt-2">
                    <label className="flex items-center gap-1.5 text-slate-700 font-medium cursor-pointer">
                      <input
                        type="radio"
                        name={`task_type_${item.id}`}
                        checked={!taskHasProgress}
                        onChange={() => setTaskHasProgress(false)}
                        className="text-sky-600 focus:ring-sky-500"
                      />
                      <span>Checklist Simples</span>
                    </label>

                    <label className="flex items-center gap-1.5 text-slate-700 font-medium cursor-pointer">
                      <input
                        type="radio"
                        name={`task_type_${item.id}`}
                        checked={taskHasProgress}
                        onChange={() => setTaskHasProgress(true)}
                        className="text-sky-600 focus:ring-sky-500"
                      />
                      <span>Quantitativo (Progresso)</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {taskHasProgress ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-500 font-bold mb-0.5">Meta Quantitativa</label>
                          <input
                            type="text"
                            placeholder="Ex: 100"
                            value={taskPlannedQty}
                            onChange={e => setTaskPlannedQty(e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 font-bold mb-0.5">Unidade</label>
                          <select
                            value={taskUnit}
                            onChange={e => setTaskUnit(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold cursor-pointer text-xs"
                          >
                            {UNIT_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div className="hidden sm:block" />
                    )}

                    {measurementType === 'por_subitem' && canViewPrices && (
                      <div>
                        <label className="block text-[10px] text-slate-500 font-bold mb-0.5 flex items-center gap-1">
                          <DollarSign size={11} className="text-emerald-600" />
                          <span>Preço Unitário para Medição (R$)</span>
                        </label>
                        <input
                          type="text"
                          placeholder="0,00"
                          value={taskPrice}
                          onChange={e => setTaskPrice(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 text-right focus:ring-2 focus:ring-sky-500 text-xs"
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold mb-0.5">Data Início</label>
                      <input
                        type="date"
                        value={taskStartDate}
                        min={minNewStartDate}
                        onChange={e => {
                          const val = e.target.value;
                          if (minNewStartDate && val < minNewStartDate) {
                            setTaskStartDate(minNewStartDate);
                          } else {
                            setTaskStartDate(val);
                          }
                        }}
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold mb-0.5">Data Término</label>
                      <input
                        type="date"
                        value={taskDueDate}
                        min={taskStartDate || minNewStartDate}
                        onChange={e => {
                          const val = e.target.value;
                          const minT = taskStartDate || minNewStartDate;
                          if (minT && val < minT) {
                            setTaskDueDate(minT);
                          } else {
                            setTaskDueDate(val);
                          }
                        }}
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium text-xs"
                      />
                    </div>
                  </div>

                  <div className="relative" ref={depDropdownRef}>
                    <label className="block text-[10px] text-slate-500 font-bold mb-0.5">
                      Dependência Lógica (Aguardar Tarefa)
                    </label>
                    <div
                      onClick={() => setIsDepDropdownOpen(!isDepDropdownOpen)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium flex items-center justify-between cursor-pointer"
                    >
                      <span className="truncate">
                        {selectedNewDepObj
                          ? `${selectedNewDepObj.title} (${selectedNewDepObj.parentTitle})`
                          : 'Sem dependência (Livre)'}
                      </span>
                      <ChevronDown size={14} className="text-slate-400" />
                    </div>

                    {isDepDropdownOpen && (
                      <div className="absolute left-0 top-full mt-1 w-full bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-[60] animate-in fade-in duration-100 space-y-2">
                        <div className="relative">
                          <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Procurar tarefa dependente..."
                            value={depSearchTerm}
                            onChange={e => setDepSearchTerm(e.target.value)}
                            className="w-full pl-7 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                          />
                        </div>

                        <div className="max-h-40 overflow-y-auto space-y-1">
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
                              className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-sky-50 text-xs font-semibold text-slate-800 flex flex-col cursor-pointer"
                            >
                              <span>{opt.title}</span>
                              <span className="text-[10px] text-slate-400 font-normal">Item: {opt.parentTitle}</span>
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
                      className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold cursor-pointer"
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
            ) : (
              canCreateTasks && (
                <button
                  type="button"
                  disabled={effectiveIsBlocked}
                  onClick={() => setIsAddingTask(true)}
                  className="w-full py-2 border border-dashed border-slate-300 hover:border-sky-400 hover:bg-sky-50/50 text-slate-600 hover:text-sky-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-transparent disabled:border-slate-300 disabled:text-slate-400"
                >
                  <Plus size={14} />
                  <span>Adicionar Subitem / Tarefa</span>
                </button>
              )
            )}

            {hasChildren && (
              <div className="pt-2 space-y-2.5">
                {item.children!.map(child => (
                  <WorkItemRow
                    key={child.id}
                    item={child}
                    depth={depth + 1}
                    isAllExpanded={isAllExpanded}
                    measurementType={measurementType}
                    allTasks={allTasks}
                    allItems={allItems}
                    teamMembers={teamMembers}
                    companyTeams={companyTeams}
                    itemTypes={itemTypes}
                    subitemTypes={subitemTypes}
                    canManageItems={canManageItems}
                    canDeleteItems={canDeleteItems}
                    canDuplicateItems={canDuplicateItems}
                    canCreateTasks={canCreateTasks}
                    canCompleteTasks={canCompleteTasks}
                    canReopenTasks={canReopenTasks}
                    canViewPrices={canViewPrices}
                    canAssignExecutors={canAssignExecutors}
                    onOpenQuickSettings={onOpenQuickSettings}
                    isParentBlocked={effectiveIsBlocked}
                    onUnlinkItemDependency={onUnlinkItemDependency}
                    onOpenItemDrawer={onOpenItemDrawer}
                    onOpenCreateChildModal={onOpenCreateChildModal}
                    onOpenEditItemModal={onOpenEditItemModal}
                    onOpenDeleteItemModal={onOpenDeleteItemModal}
                    onDuplicateItem={onDuplicateItem}
                    onCompleteAllItemTasks={onCompleteAllItemTasks}
                    onUploadItemFiles={onUploadItemFiles}
                    onToggleTaskStatus={onToggleTaskStatus}
                    onSaveTaskEntry={onSaveTaskEntry}
                    onUpdateTaskExecutedQty={onUpdateTaskExecutedQty}
                    onOpenEditTaskModal={onOpenEditTaskModal}
                    onOpenDeleteTaskModal={onOpenDeleteTaskModal}
                    onSaveInlineTask={onSaveInlineTask}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL: APONTAMENTO DIÁRIO DE EXECUÇÃO */}
      {completingTask && (
        <div className="fixed inset-0 z-[170] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-4 sm:p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600 border border-sky-100">
                  <CheckSquare size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 leading-tight">Apontamento de Execução</h3>
                  <p className="text-[11px] text-slate-500">Registro no diário de obra</p>
                </div>
              </div>
              <button
                onClick={() => setCompletingTask(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs overflow-y-auto pr-1 flex-1">
              <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                  Atividade Executada
                </span>
                <p className="font-bold text-slate-800 text-sm">
                  {completingTask.title}
                </p>
                {completingTask.has_progress_tracking && (
                  <div className="mt-2 flex items-center gap-2 text-[11px] font-medium text-slate-500 flex-wrap">
                    <span className="bg-white px-2 py-1 rounded border border-slate-200 shadow-2xs">
                      Planejado: <strong className="text-slate-800">{completingTask.quantity_planned} {completingTask.unit}</strong>
                    </span>
                    <span className="bg-white px-2 py-1 rounded border border-slate-200 shadow-2xs">
                      Já feito: <strong className="text-sky-600">{completingTask.quantity_executed || 0} {completingTask.unit}</strong>
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* DATA DO APONTAMENTO */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Data do Serviço</label>
                  <input
                    type="date"
                    required
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-sky-500 text-xs"
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
                      className="w-full px-3 py-2 bg-white border border-sky-300 rounded-xl font-extrabold text-sky-900 text-center focus:ring-2 focus:ring-sky-500 shadow-2xs text-xs"
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
                          checklistAction === 'progress' ? 'bg-white shadow-2xs text-sky-700 font-bold' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Apenas Apontar
                      </button>
                      <button
                        type="button"
                        onClick={() => { setChecklistAction('complete'); setEntryQty('1'); }}
                        className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition-all cursor-pointer ${
                          checklistAction === 'complete' ? 'bg-white shadow-2xs text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Concluir
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* SELEÇÃO DIRETA DOS COLABORADORES DA OBRA */}
              <div className="pt-1">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <UserCheck size={12} className="text-sky-600" />
                    <span>Quem executou esta tarefa?</span>
                    {selectedExecutors.length > 0 && (
                      <span className="text-sky-600 font-extrabold">({selectedExecutors.length})</span>
                    )}
                  </label>
                </div>

                <div className="space-y-1.5 max-h-40 overflow-y-auto p-1.5 border border-slate-200 rounded-2xl bg-slate-50/50">
                  {teamMembers.length > 0 ? (
                    teamMembers.map(member => {
                      const isSelected = selectedExecutors.includes(member.name);
                      return (
                        <button
                          type="button"
                          key={member.id}
                          disabled={!canAssignExecutors}
                          onClick={() => toggleExecutor(member.name)}
                          className={`w-full p-2 rounded-xl text-left border transition flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? 'bg-sky-50 border-sky-300 text-sky-900 font-bold shadow-2xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 font-medium'
                          } ${!canAssignExecutors ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border overflow-hidden shrink-0 ${
                              isSelected ? 'bg-sky-600 text-white border-sky-500' : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                              {member.avatar_url ? (
                                <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                getInitials(member.name)
                              )}
                            </div>
                            <div className="min-w-0">
                              <span className="block text-xs truncate">{member.name}</span>
                              {member.role && <span className="text-[10px] text-slate-400 font-normal block truncate">{member.role}</span>}
                            </div>
                          </div>

                          <UserCheck size={15} className={`shrink-0 ml-1 ${isSelected ? 'text-sky-600' : 'text-slate-300'}`} />
                        </button>
                      );
                    })
                  ) : (
                    <div className="p-3 text-center text-slate-400 italic">
                      Nenhum colaborador encontrado na equipe.
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
                  placeholder="Houve algum imprevisto ou detalhe hoje?"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-medium text-slate-800 focus:ring-2 focus:ring-sky-500 text-xs"
                />
              </div>

            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
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
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold cursor-pointer shadow-2xs transition text-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSavingEntry ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                <span>Salvar Apontamento</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIGURAÇÃO DE PRAZOS & DEPENDÊNCIA */}
      {configTask && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-5 sm:p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Settings size={18} className="text-sky-600" />
                <h4 className="text-sm sm:text-base font-bold text-slate-900">Configurar Cronograma</h4>
              </div>
              <button onClick={() => setConfigTask(null)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Tarefa</span>
                <p className="font-bold text-slate-800 text-sm break-words">{configTask.title}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Data Início</label>
                  <input
                    type="date"
                    value={configStartDate}
                    min={minConfigStartDate}
                    onChange={e => {
                      const val = e.target.value;
                      if (minConfigStartDate && val < minConfigStartDate) {
                        setConfigStartDate(minConfigStartDate);
                      } else {
                        setConfigStartDate(val);
                      }
                    }}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Data Término</label>
                  <input
                    type="date"
                    value={configDueDate}
                    min={configStartDate || minConfigStartDate}
                    onChange={e => {
                      const val = e.target.value;
                      const minT = configStartDate || minConfigStartDate;
                      if (minT && val < minT) {
                        setConfigDueDate(minT);
                      } else {
                        setConfigDueDate(val);
                      }
                    }}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold"
                  />
                </div>
              </div>

              <div className="relative" ref={configDepRef}>
                <label className="block font-semibold text-slate-700 mb-1">
                  Bloquear até concluir a tarefa (Dependência)
                </label>
                <div
                  onClick={() => setIsConfigDepOpen(!isConfigDepOpen)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium flex items-center justify-between cursor-pointer"
                >
                  <span className="truncate">
                    {selectedConfigDepObj
                      ? `${selectedConfigDepObj.title} (${selectedConfigDepObj.parentTitle})`
                      : 'Nenhuma dependência'}
                  </span>
                  <ChevronDown size={14} className="text-slate-400" />
                </div>

                {isConfigDepOpen && (
                  <div className="absolute left-0 top-full mt-1 w-full bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-50 animate-in fade-in duration-100 space-y-2">
                    <div className="relative">
                      <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Procurar tarefa dependente..."
                        value={configDepSearch}
                        onChange={e => setConfigDepSearch(e.target.value)}
                        className="w-full pl-7 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    <div className="max-h-40 overflow-y-auto space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setConfigDependsOnId('');
                          setIsConfigDepOpen(false);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-slate-50 text-xs font-semibold text-slate-500 cursor-pointer"
                      >
                        Sem dependência
                      </button>
                      {filteredConfigTaskDeps.map(opt => (
                        <button
                          type="button"
                          key={opt.id}
                          onClick={() => {
                            setConfigDependsOnId(opt.id);
                            if (opt.dueDate) {
                              setConfigStartDate(opt.dueDate);
                              if (configDueDate && configDueDate < opt.dueDate) {
                                setConfigDueDate(opt.dueDate);
                              }
                            }
                            setIsConfigDepOpen(false);
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-sky-50 text-xs font-semibold text-slate-800 flex flex-col cursor-pointer"
                        >
                          <span className="truncate">{opt.title}</span>
                          <span className="text-[10px] text-slate-400 font-normal">Item: {opt.parentTitle}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setConfigTask(null)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (configTask) {
                      const targetTask = item.tasks?.find(t => t.id === configTask.id);
                      if (targetTask) {
                        targetTask.start_date = configStartDate || null;
                        targetTask.due_date = configDueDate || null;
                        targetTask.depends_on_task_id = configDependsOnId || null;
                      }

                      onOpenEditTaskModal({
                        ...configTask,
                        start_date: configStartDate || null,
                        due_date: configDueDate || null,
                        depends_on_task_id: configDependsOnId || null
                      });
                    }
                    setConfigTask(null);
                  }}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-semibold cursor-pointer shadow-2xs"
                >
                  Salvar Cronograma
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BLOQUEAR TAREFA MANUALMENTE */}
      {blockingTask && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
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
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Tarefa a ser restringida:</span>
                <p className="font-bold text-slate-800 text-sm break-words">{blockingTask.title}</p>
              </div>

              <div>
                <label className="block font-semibold text-rose-800 mb-1">Qual é o motivo do bloqueio? *</label>
                <textarea
                  required
                  rows={3}
                  value={blockReason}
                  onChange={e => setBlockReason(e.target.value)}
                  placeholder="Ex: Falta de material, aguardando aprovação do cliente..."
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
                  Confirmar Restrição
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR DESVINCULAR TAREFA */}
      {taskToUnlink && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm p-6 shadow-2xl text-center space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-100">
              <Unlink size={22} />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-900">Desvincular Tarefa</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Deseja remover o bloqueio da tarefa <strong className="text-slate-800">"{taskToUnlink.title}"</strong>? Ela deixará de aguardar a tarefa anterior e ficará disponível para execução.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={unlinking}
                onClick={() => setTaskToUnlink(null)}
                className="flex-1 py-2 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={unlinking}
                onClick={handleConfirmUnlinkTaskDependency}
                className="flex-1 py-2 px-3 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {unlinking ? <Loader2 size={14} className="animate-spin" /> : <Unlink size={14} />}
                <span>Desvincular</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR DESVINCULAR ITEM */}
      {itemDepToUnlink && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm p-6 shadow-2xl text-center space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-100">
              <Unlink size={22} />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-900">Desvincular Item</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Deseja remover o bloqueio do item/frente <strong className="text-slate-800">"{itemDepToUnlink.title}"</strong>? Ele deixará de aguardar o item anterior e seus subitens ficarão liberados para execução.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={unlinking}
                onClick={() => setItemDepToUnlink(null)}
                className="flex-1 py-2 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={unlinking}
                onClick={async () => {
                  setUnlinking(true);
                  if (onUnlinkItemDependency) {
                    await onUnlinkItemDependency(itemDepToUnlink.id);
                  }
                  setItemDepToUnlink(null);
                  setUnlinking(false);
                }}
                className="flex-1 py-2 px-3 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {unlinking ? <Loader2 size={14} className="animate-spin" /> : <Unlink size={14} />}
                <span>Desvincular</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkItemRow;