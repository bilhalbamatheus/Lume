import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { WorkItemRow } from './WorkItemRow';
import { WorkItemDrawer } from './WorkItemDrawer';
import type { WorkItem, WorkTask, TeamMember, DailyEntryPayload } from './WorkItemRow';
import { WorkCustomSettingsModal } from './WorkCustomSettingsModal';
import { DailyWorkLogModal } from './DailyWorkLogModal';
import {
  Plus,
  Layers,
  Loader2,
  X,
  Save,
  Search,
  Filter,
  Calendar,
  Lock,
  Tag,
  MapPin,
  FileText,
  DollarSign,
  GitFork,
  Box,
  CheckSquare,
  Square,
  ChevronsDown,
  ChevronsUp,
  UserCheck,
  CheckCircle2,
  Edit2,
  Trash2,
  Copy,
  CornerDownRight,
  BookOpenCheck,
  ShieldAlert,
  PlayCircle
} from 'lucide-react';

export interface SettingOption {
  id: string;
  name: string;
  category: 'location' | 'item_type' | 'task_type';
  color?: string;
  extra?: string;
}

interface WorkItemsTasksTabProps {
  workId: string;
  measurementType?: 'por_subitem' | 'por_item' | 'sem_medicao';
  onProgressUpdated?: (newProgress: number) => void;
}

const getInitials = (name: string) => {
  if (!name) return 'EX';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const WorkItemsTasksTab: React.FC<WorkItemsTasksTabProps> = ({
  workId,
  measurementType = 'por_subitem',
  onProgressUpdated
}) => {
  const { user } = useAuth();
  const { permissions } = usePermissions();
  const [loading, setLoading] = useState(true);

  const [itemsTree, setItemsTree] = useState<WorkItem[]>([]);
  const [allItemsList, setAllItemsList] = useState<WorkItem[]>([]);
  const [allTasksList, setAllTasksList] = useState<WorkTask[]>([]);
  
  // Colaboradores alocados nesta obra (work_members)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [companyTeams, setCompanyTeams] = useState<any[]>([]);

  // Parâmetros Operacionais
  const [locationOptions, setLocationOptions] = useState<SettingOption[]>([]);
  const [itemTypeOptions, setItemTypeOptions] = useState<SettingOption[]>([]);
  const [subitemTypeOptions, setSubitemTypeOptions] = useState<SettingOption[]>([]);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Modos de Visualização (Inicializa recolhido por padrão: false)
  const [viewMode, setViewMode] = useState<'tree' | 'items' | 'tasks'>('tree');
  const [isAllExpanded, setIsAllExpanded] = useState<boolean>(false);

  // Pesquisa e Filtros Flutuantes
  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterButtonCoords, setFilterButtonCoords] = useState<{ top: number; left: number } | null>(null);
  
  // Filtros completos
  const [filterStatus, setFilterStatus] = useState<'all' | 'em_andamento' | 'concluida' | 'bloqueada'>('all');
  const [filterLocation, setFilterLocation] = useState<string>('all');
  const [filterItemType, setFilterItemType] = useState<string>('all');
  const [filterTaskType, setFilterTaskType] = useState<string>('all');
  const [filterExecutor, setFilterExecutor] = useState<string>('all');

  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const filterPopoverRef = useRef<HTMLDivElement>(null);

  // Tooltip Hover de Árvore
  const [hoveredTreeItemId, setHoveredTreeItemId] = useState<string | null>(null);

  // Modal de Criação de Componente
  const [isCreateItemModalOpen, setIsCreateItemModalOpen] = useState(false);
  const [modalParentItem, setModalParentItem] = useState<{ id: string | null; title: string | null }>({ id: null, title: null });

  const [itemFormTitle, setItemFormTitle] = useState('');
  const [itemFormCode, setItemFormCode] = useState('');
  const [itemFormItemType, setItemFormItemType] = useState('');
  const [itemFormLocation, setItemFormLocation] = useState('');
  const [itemFormPrice, setItemFormPrice] = useState('');
  const [itemFormStartDate, setItemFormStartDate] = useState('');
  const [itemFormDueDate, setItemFormDueDate] = useState('');
  const [itemFormDependsOnId, setItemFormDependsOnId] = useState('');
  const [itemFormDescription, setItemFormDescription] = useState('');
  const [savingItemForm, setSavingItemForm] = useState(false);

  // Drawer
  const [selectedDrawerItemId, setSelectedDrawerItemId] = useState<string | null>(null);

  // Modais de Edição e Exclusão de Itens
  const [editingItem, setEditingItem] = useState<WorkItem | null>(null);
  const [editItemTitle, setEditItemTitle] = useState('');
  const [editItemCode, setEditItemCode] = useState('');
  const [editItemType, setEditItemType] = useState('');
  const [editItemLocation, setEditItemLocation] = useState('');
  const [editItemPrice, setEditItemPrice] = useState('');
  const [editItemDescription, setEditItemDescription] = useState('');
  const [savingEditItem, setSavingEditItem] = useState(false);

  const [itemToDelete, setItemToDelete] = useState<WorkItem | null>(null);
  const [deletingItem, setDeletingItem] = useState(false);

  // Duplicação em Lote com Sequencial
  const [itemToBatchDuplicate, setItemToBatchDuplicate] = useState<WorkItem | null>(null);
  const [duplicateQuantity, setDuplicateQuantity] = useState<number>(1);
  const [duplicateStartIndex, setDuplicateStartIndex] = useState<number>(1);
  const [duplicatingBatch, setDuplicatingBatch] = useState(false);

  // Modais de Exclusão de Tarefas
  const [taskToDelete, setTaskToDelete] = useState<{ task: WorkTask; parentItemId: string } | null>(null);
  const [deletingTask, setDeletingTask] = useState(false);

  // Modal de Apontamento ao clicar na Tabela Corrida de Tarefas
  const [completingTask, setCompletingTask] = useState<{ item: WorkItem; task: WorkTask } | null>(null);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryQty, setEntryQty] = useState('');
  const [entryNotes, setEntryNotes] = useState('');
  const [selectedExecutors, setSelectedExecutors] = useState<string[]>([]);
  const [isSavingEntry, setIsSavingEntry] = useState(false);
  const [checklistAction, setChecklistAction] = useState<'progress' | 'complete'>('complete');

  // Modal de Bloqueio de Tarefa
  const [blockingTask, setBlockingTask] = useState<WorkTask | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);

  // Modal do Diário de Obra (FAB)
  const [isDailyLogModalOpen, setIsDailyLogModalOpen] = useState(false);

  const lastReportedProgressRef = useRef<number | null>(null);

  // Controla abertura e fechamento do Popover de Filtros via Portal
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        filterPopoverRef.current &&
        !filterPopoverRef.current.contains(target) &&
        filterButtonRef.current &&
        !filterButtonRef.current.contains(target)
      ) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleFilterPopover = () => {
    if (!isFilterOpen && filterButtonRef.current) {
      const rect = filterButtonRef.current.getBoundingClientRect();
      setFilterButtonCoords({
        top: rect.bottom + 6,
        left: Math.max(10, Math.min(rect.right - 280, window.innerWidth - 290))
      });
      setIsFilterOpen(true);
    } else {
      setIsFilterOpen(false);
    }
  };

  // Carrega Colaboradores Alocados na Obra a partir de work_members
  const loadTeamMembersAndTeams = useCallback(async () => {
    const companyId = user?.company?.id;
    if (!companyId || !workId) return;

    try {
      const [teamsDataRes, workMembersRes] = await Promise.all([
        supabase
          .from('company_teams')
          .select('id, name')
          .eq('company_id', companyId)
          .order('name'),
        supabase
          .from('work_members')
          .select(`
            user_id,
            profile:profiles!user_id (
              id,
              full_name,
              role_title,
              avatar_url
            )
          `)
          .eq('work_id', workId)
      ]);

      if (teamsDataRes.data) setCompanyTeams(teamsDataRes.data);

      const assignedFromWork: TeamMember[] = [];
      (workMembersRes.data || []).forEach((wm: any) => {
        const prof = Array.isArray(wm.profile) ? wm.profile[0] : wm.profile;
        if (prof) {
          assignedFromWork.push({
            id: prof.id,
            name: prof.full_name || 'Sem nome',
            role: prof.role_title || 'Colaborador',
            avatar_url: prof.avatar_url || null
          });
        }
      });

      setTeamMembers(assignedFromWork);
    } catch (err) {
      console.warn('Erro ao carregar colaboradores da obra:', err);
    }
  }, [user?.company?.id, workId]);

  const loadCustomSettings = useCallback(async () => {
    const companyId = user?.company?.id;
    if (!companyId || !workId) return;

    try {
      const [locRes, itemTypesRes, taskTypesRes] = await Promise.all([
        supabase
          .from('work_locations')
          .select('id, name, color')
          .eq('company_id', companyId)
          .eq('work_id', workId)
          .order('name', { ascending: true }),
        supabase
          .from('work_item_types')
          .select('id, name, color')
          .eq('company_id', companyId)
          .eq('work_id', workId)
          .order('name', { ascending: true }),
        supabase
          .from('work_task_types')
          .select('id, name, color')
          .eq('company_id', companyId)
          .eq('work_id', workId)
          .order('name', { ascending: true })
      ]);

      if (!locRes.error && locRes.data) {
        setLocationOptions(locRes.data.map(d => ({ ...d, category: 'location' })));
      }
      if (!itemTypesRes.error && itemTypesRes.data) {
        setItemTypeOptions(itemTypesRes.data.map(d => ({ ...d, category: 'item_type' })));
      }
      if (!taskTypesRes.error && taskTypesRes.data) {
        setSubitemTypeOptions(taskTypesRes.data.map(d => ({ ...d, category: 'task_type' })));
      }
    } catch (err) {
      console.error('Erro ao carregar configurações operacionais:', err);
    }
  }, [user?.company?.id, workId]);

  const loadWorkStructure = useCallback(async () => {
    try {
      setLoading(true);

      const { data: allItems, error: itemsErr } = await supabase
        .from('work_items')
        .select('*')
        .eq('work_id', workId);

      if (itemsErr) throw itemsErr;

      const itemsList: any[] = (allItems || []).sort((a: any, b: any) =>
        (a.title || '').localeCompare(b.title || '', 'pt-BR', { numeric: true, sensitivity: 'base' })
      );
      const itemIds = itemsList.map(i => i.id);

      let tasksList: WorkTask[] = [];
      if (itemIds.length > 0) {
        const { data: allTasks, error: tasksErr } = await supabase
          .from('work_tasks')
          .select('*')
          .in('work_item_id', itemIds);

        if (tasksErr) throw tasksErr;

        tasksList = (allTasks || [])
          .sort((a: any, b: any) =>
            (a.title || '').localeCompare(b.title || '', 'pt-BR', { numeric: true, sensitivity: 'base' })
          )
          .map((t: any) => ({
            ...t,
            executed_by: Array.isArray(t.executed_by) ? t.executed_by : []
          }));
      }

      setAllItemsList(itemsList);
      setAllTasksList(tasksList);

      const itemsWithTasks: WorkItem[] = itemsList.map(item => ({
        ...item,
        tasks: tasksList.filter(t => t.work_item_id === item.id)
      }));

      const buildTree = (parentId: string | null = null): WorkItem[] => {
        return itemsWithTasks
          .filter(item => (item.parent_id || null) === parentId)
          .map(item => ({
            ...item,
            children: buildTree(item.id)
          }));
      };

      setItemsTree(buildTree(null));
    } catch (err) {
      console.error('Erro ao carregar estrutura da obra:', err);
    } finally {
      setLoading(false);
    }
  }, [workId]);

  const itemsMap = useMemo(() => {
    const map = new Map<string, any>();
    allItemsList.forEach(item => map.set(item.id, item));
    return map;
  }, [allItemsList]);

  const getHierarchyArray = useCallback((itemId: string | null | undefined): any[] => {
    if (!itemId) return [];
    const chain: any[] = [];
    let current = itemsMap.get(itemId);
    let depth = 0;

    while (current && depth < 8) {
      chain.push(current);
      if (current.parent_id && itemsMap.has(current.parent_id)) {
        current = itemsMap.get(current.parent_id);
      } else {
        break;
      }
      depth++;
    }

    return chain;
  }, [itemsMap]);

  const activeDrawerItem = useMemo(() => {
    if (!selectedDrawerItemId) return null;
    const baseItem = allItemsList.find(i => i.id === selectedDrawerItemId);
    if (!baseItem) return null;
    return {
      ...baseItem,
      tasks: allTasksList.filter(t => t.work_item_id === baseItem.id)
    };
  }, [selectedDrawerItemId, allItemsList, allTasksList]);

  const calculatedProgress = useMemo(() => {
    if (allTasksList.length === 0) return 0;
    let total = allTasksList.length;
    let done = 0;
    allTasksList.forEach(t => {
      if (t.status === 'concluida') done += 1;
      else if (t.has_progress_tracking && t.quantity_planned > 0) {
        done += Math.min(1, (t.quantity_executed || 0) / t.quantity_planned);
      }
    });
    return Math.round((done / total) * 100);
  }, [allTasksList]);

  useEffect(() => {
    if (lastReportedProgressRef.current !== calculatedProgress) {
      lastReportedProgressRef.current = calculatedProgress;
      onProgressUpdated?.(calculatedProgress);
    }
  }, [calculatedProgress, onProgressUpdated]);

  useEffect(() => {
    loadWorkStructure();
    loadTeamMembersAndTeams();
    loadCustomSettings();
  }, [loadWorkStructure, loadTeamMembersAndTeams, loadCustomSettings]);

  const handleOpenCreateModal = (parentId: string | null = null, parentTitle: string | null = null) => {
    if (!permissions.canManageWorkItems) return;
    setModalParentItem({ id: parentId, title: parentTitle });
    setItemFormTitle('');
    setItemFormCode('');
    setItemFormItemType(itemTypeOptions[0]?.name || '');
    setItemFormLocation(locationOptions[0]?.name || '');
    setItemFormPrice('');
    setItemFormStartDate('');
    setItemFormDueDate('');
    setItemFormDependsOnId('');
    setItemFormDescription('');
    setIsCreateItemModalOpen(true);
  };

  const handleSaveItemForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permissions.canManageWorkItems || !itemFormTitle.trim()) return;

    try {
      setSavingItemForm(true);
      const companyId = user?.company?.id;
      if (!companyId) return;

      const numPrice = permissions.canViewWorkPrices
        ? parseFloat(itemFormPrice.replace(/\./g, '').replace(',', '.')) || 0
        : 0;

      const { error: itemError } = await supabase
        .from('work_items')
        .insert({
          company_id: companyId,
          work_id: workId,
          parent_id: modalParentItem.id,
          title: itemFormTitle.trim(),
          code: itemFormCode.trim() || null,
          item_type: itemFormItemType.trim() || null,
          location: itemFormLocation.trim() || null,
          unit_price: numPrice,
          start_date: itemFormStartDate || null,
          due_date: itemFormDueDate || null,
          depends_on_item_id: itemFormDependsOnId || null,
          description: itemFormDescription.trim() || null,
          sort_order: 999
        });

      if (itemError) throw itemError;

      setIsCreateItemModalOpen(false);
      await loadWorkStructure();
    } catch (err: any) {
      alert('Erro ao salvar componente: ' + err.message);
    } finally {
      setSavingItemForm(false);
    }
  };

  const handleSaveTaskEntry = async (payload: DailyEntryPayload) => {
    if (!permissions.canCompleteWorkTasks) return;
    const companyId = user?.company?.id;
    if (!companyId) return;

    try {
      const { error } = await supabase
        .from('work_task_entries')
        .insert({
          company_id: companyId,
          work_id: workId,
          work_item_id: payload.itemId,
          work_task_id: payload.taskId,
          entry_date: payload.date,
          quantity_executed: payload.quantity,
          team_id: null,
          executed_by: payload.executors,
          notes: payload.notes || null,
          created_by: user?.profile?.id || null,
        });

      if (error) throw error;
      await loadWorkStructure();
    } catch (err: any) {
      alert('Erro ao salvar apontamento no Diário de Obra: ' + err.message);
      throw err;
    }
  };

  const handleToggleTaskStatus = async (item: WorkItem, task: WorkTask, executors?: string[]) => {
    const isDone = task.status === 'concluida';
    if (isDone && !permissions.canReopenWorkTasks) {
      alert('Seu nível de acesso não permite reabrir tarefas concluídas.');
      return;
    }
    if (!isDone && !permissions.canCompleteWorkTasks) {
      alert('Seu nível de acesso não permite concluir tarefas.');
      return;
    }

    try {
      if (isDone) {
        const { error } = await supabase
          .from('work_tasks')
          .update({
            status: 'pendente',
            quantity_executed: 0,
            executed_by: [],
            completed_at: null
          })
          .eq('id', task.id);
        
        if (error) throw error;
        await supabase.from('work_task_entries').delete().eq('work_task_id', task.id);
      } else {
        await handleSaveTaskEntry({
          taskId: task.id,
          itemId: item.id,
          date: new Date().toISOString().split('T')[0],
          quantity: task.quantity_planned || 1,
          teamId: null,
          executors: executors || [],
          notes: '',
          isChecklistComplete: true
        });
      }

      await loadWorkStructure();
    } catch (err: any) {
      alert('Erro ao atualizar tarefa: ' + err.message);
    }
  };

  const handleUpdateTaskExecutedQty = async (item: WorkItem, task: WorkTask, rawVal: string) => {
    if (!permissions.canCompleteWorkTasks) return;
    const parsed = parseFloat(rawVal.replace(',', '.')) || 0;
    
    try {
      await handleSaveTaskEntry({
        taskId: task.id,
        itemId: item.id,
        date: new Date().toISOString().split('T')[0],
        quantity: parsed,
        teamId: null,
        executors: [],
        notes: '',
        isChecklistComplete: false
      });
    } catch (err: any) {
      console.error('Erro ao atualizar quantidade:', err);
    }
  };

  const handleSaveInlineTask = async (
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
    blockReasonParam?: string
  ) => {
    if (!permissions.canCreateWorkTasks) return;
    const companyId = user?.company?.id;
    if (!companyId) return;

    try {
      const numPrice = permissions.canViewWorkPrices
        ? parseFloat(price.replace(/\./g, '').replace(',', '.')) || 0
        : 0;
      const numQty = parseFloat(plannedQty.replace(',', '.')) || 1;

      const { error } = await supabase
        .from('work_tasks')
        .insert({
          company_id: companyId,
          work_item_id: itemId,
          title,
          task_type: taskType || null,
          description: description || null,
          has_progress_tracking: hasProgress,
          quantity_planned: numQty,
          quantity_executed: 0,
          unit: unit || 'un',
          unit_price: numPrice,
          start_date: startDate || null,
          due_date: dueDate || null,
          depends_on_task_id: dependsOnId || null,
          status: isBlocked ? 'bloqueada' : 'pendente',
          blocked_reason: isBlocked ? blockReasonParam : null,
          blocked_at: isBlocked ? new Date().toISOString() : null,
          sort_order: 999
        });

      if (error) throw error;
      await loadWorkStructure();
    } catch (err: any) {
      alert('Erro ao criar tarefa: ' + err.message);
    }
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
      setBlockingTask(null);
      setBlockReason('');
      await loadWorkStructure();
    } catch (err: any) {
      alert('Erro ao bloquear tarefa: ' + err.message);
    } finally {
      setIsBlocking(false);
    }
  };

  const handleSaveEditItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permissions.canManageWorkItems || !editingItem || !editItemTitle.trim()) return;

    try {
      setSavingEditItem(true);
      const numPrice = permissions.canViewWorkPrices
        ? parseFloat(editItemPrice.replace(/\./g, '').replace(',', '.')) || 0
        : editingItem.unit_price || 0;

      const { error } = await supabase
        .from('work_items')
        .update({
          title: editItemTitle.trim(),
          code: editItemCode.trim() || null,
          item_type: editItemType.trim() || null,
          location: editItemLocation.trim() || null,
          description: editItemDescription.trim() || null,
          unit_price: numPrice
        })
        .eq('id', editingItem.id);

      if (error) throw error;
      setEditingItem(null);
      await loadWorkStructure();
    } catch (err: any) {
      alert('Erro ao salvar item: ' + err.message);
    } finally {
      setSavingEditItem(false);
    }
  };

  const handleConfirmDeleteItem = async () => {
    if (!permissions.canDeleteWorkItems || !itemToDelete) return;
    try {
      setDeletingItem(true);
      const { error } = await supabase.from('work_items').delete().eq('id', itemToDelete.id);
      if (error) throw error;
      setItemToDelete(null);
      if (selectedDrawerItemId === itemToDelete.id) {
        setSelectedDrawerItemId(null);
      }
      await loadWorkStructure();
    } catch (err: any) {
      alert('Erro ao excluir item: ' + err.message);
    } finally {
      setDeletingItem(false);
    }
  };

  const handleConfirmBatchDuplicate = async () => {
    if (!permissions.canDuplicateWorkItems || !itemToBatchDuplicate) return;
    const companyId = user?.company?.id;
    if (!companyId || !workId) return;

    try {
      setDuplicatingBatch(true);

      const baseTitle = itemToBatchDuplicate.title.replace(/\s*\d+$/, '').replace(/\s*\(Cópia\)$/i, '').trim();
      const baseCode = (itemToBatchDuplicate.code || '').replace(/[-_]?\d+$/, '').replace(/[-_]COP$/i, '').trim();

      for (let i = 0; i < duplicateQuantity; i++) {
        const currentNumber = duplicateStartIndex + i;
        const formattedNum = String(currentNumber).padStart(2, '0');

        const newTitle = `${baseTitle} ${formattedNum}`;
        const newCode = baseCode ? `${baseCode}-${formattedNum}` : null;

        const duplicateRecursive = async (
          itemToCopy: WorkItem,
          newParentId: string | null,
          isRoot: boolean
        ) => {
          const { data: createdItem, error: itemErr } = await supabase
            .from('work_items')
            .insert({
              company_id: companyId,
              work_id: workId,
              parent_id: newParentId,
              title: isRoot ? newTitle : itemToCopy.title,
              code: isRoot ? newCode : itemToCopy.code,
              item_type: itemToCopy.item_type || null,
              location: itemToCopy.location || null,
              unit_price: itemToCopy.unit_price || 0,
              description: itemToCopy.description || null,
              sort_order: 999
            })
            .select()
            .single();

          if (itemErr || !createdItem) throw itemErr;

          const tasksToCopy = allTasksList.filter(t => t.work_item_id === itemToCopy.id);
          if (tasksToCopy.length > 0) {
            const newTasksPayload = tasksToCopy.map(t => ({
              company_id: companyId,
              work_item_id: createdItem.id,
              title: t.title,
              task_type: t.task_type || null,
              description: t.description || null,
              has_progress_tracking: t.has_progress_tracking,
              quantity_planned: t.quantity_planned || 1,
              quantity_executed: 0,
              unit: t.unit || 'un',
              unit_price: t.unit_price || 0,
              is_measured: t.is_measured ?? true,
              weight: t.weight || 0,
              status: 'pendente',
              sort_order: 999
            }));

            const { error: tasksErr } = await supabase
              .from('work_tasks')
              .insert(newTasksPayload);

            if (tasksErr) throw tasksErr;
          }

          const childrenToCopy = allItemsList.filter(child => child.parent_id === itemToCopy.id);
          for (const child of childrenToCopy) {
            await duplicateRecursive(child, createdItem.id, false);
          }
        };

        await duplicateRecursive(itemToBatchDuplicate, itemToBatchDuplicate.parent_id || null, true);
      }

      setItemToBatchDuplicate(null);
      await loadWorkStructure();
    } catch (err: any) {
      console.error('Erro na duplicação em lote:', err);
      alert('Erro ao duplicar em lote: ' + err.message);
    } finally {
      setDuplicatingBatch(false);
    }
  };

  const handleSaveEditTask = async (task: WorkTask) => {
    if (!permissions.canCreateWorkTasks && !permissions.canManageWorkItems) return;
    try {
      const { error } = await supabase
        .from('work_tasks')
        .update({
          title: task.title,
          task_type: task.task_type || null,
          start_date: task.start_date || null,
          due_date: task.due_date || null,
          depends_on_task_id: task.depends_on_task_id || null
        })
        .eq('id', task.id);

      if (error) throw error;
      await loadWorkStructure();
    } catch (err: any) {
      alert('Erro ao atualizar tarefa: ' + err.message);
    }
  };

  const handleConfirmDeleteTask = async () => {
    if (!permissions.canDeleteWorkItems || !taskToDelete) return;
    try {
      setDeletingTask(true);
      const { error } = await supabase.from('work_tasks').delete().eq('id', taskToDelete.task.id);
      if (error) throw error;
      setTaskToDelete(null);
      await loadWorkStructure();
    } catch (err: any) {
      alert('Erro ao excluir tarefa: ' + err.message);
    } finally {
      setDeletingTask(false);
    }
  };

  const handleTaskTableCheckboxClick = (task: WorkTask) => {
    if (task.status === 'bloqueada') return;

    const parentItem = allItemsList.find(i => i.id === task.work_item_id);
    if (!parentItem) return;

    const isDone = task.status === 'concluida';
    if (isDone) {
      if (!permissions.canReopenWorkTasks) return;
      handleToggleTaskStatus(parentItem, task, []);
    } else {
      if (!permissions.canCompleteWorkTasks) return;
      setCompletingTask({ item: parentItem, task });
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

  const handleConfirmTaskCompletionFromTable = async () => {
    if (!completingTask) return;
    try {
      setIsSavingEntry(true);
      const parsedQty = parseFloat(entryQty.replace(',', '.'));
      if (isNaN(parsedQty) || (parsedQty <= 0 && checklistAction === 'complete')) {
        alert('Para concluir, a quantidade executada deve ser maior que zero.');
        return;
      }

      await handleSaveTaskEntry({
        taskId: completingTask.task.id,
        itemId: completingTask.item.id,
        date: entryDate,
        quantity: parsedQty,
        teamId: null,
        executors: selectedExecutors,
        notes: entryNotes,
        isChecklistComplete: !completingTask.task.has_progress_tracking && checklistAction === 'complete'
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
    if (!permissions.canAssignExecutors) return;
    setSelectedExecutors(prev =>
      prev.includes(memberName) ? prev.filter(m => m !== memberName) : [...prev, memberName]
    );
  };

  // Filtragem completa
  const filteredTree = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();

    const filterNode = (node: WorkItem): WorkItem | null => {
      const matchesTitle = node.title.toLowerCase().includes(q) || (node.code && node.code.toLowerCase().includes(q));
      const matchesLoc = filterLocation === 'all' || node.location === filterLocation;
      const matchesItemType = filterItemType === 'all' || node.item_type === filterItemType;

      const filteredTasks = (node.tasks || []).filter(task => {
        const matchesTaskSearch = q === '' || task.title.toLowerCase().includes(q);
        
        let matchesStatus = true;
        if (filterStatus === 'em_andamento') matchesStatus = task.status === 'pendente' || task.status === 'em_andamento';
        else if (filterStatus === 'concluida') matchesStatus = task.status === 'concluida';
        else if (filterStatus === 'bloqueada') matchesStatus = task.status === 'bloqueada';

        const matchesTaskType = filterTaskType === 'all' || task.task_type === filterTaskType;
        const matchesExec = filterExecutor === 'all' || (task.executed_by && task.executed_by.includes(filterExecutor));

        return matchesTaskSearch && matchesStatus && matchesTaskType && matchesExec;
      });

      const filteredChildren = (node.children || [])
        .map(child => filterNode(child))
        .filter((c): c is WorkItem => c !== null);

      if (
        (matchesTitle && matchesLoc && matchesItemType && filterStatus === 'all' && filterTaskType === 'all' && filterExecutor === 'all') ||
        filteredTasks.length > 0 ||
        filteredChildren.length > 0
      ) {
        return {
          ...node,
          tasks: filteredTasks,
          children: filteredChildren
        };
      }

      return null;
    };

    if (
      !q &&
      filterStatus === 'all' &&
      filterLocation === 'all' &&
      filterItemType === 'all' &&
      filterTaskType === 'all' &&
      filterExecutor === 'all'
    ) {
      return itemsTree;
    }

    return itemsTree
      .map(root => filterNode(root))
      .filter((n): n is WorkItem => n !== null);
  }, [itemsTree, searchTerm, filterStatus, filterLocation, filterItemType, filterTaskType, filterExecutor]);

  const flattenedItems = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return allItemsList.filter(item => {
      const matchesSearch = q === '' || item.title.toLowerCase().includes(q) || (item.code && item.code.toLowerCase().includes(q));
      const matchesLoc = filterLocation === 'all' || item.location === filterLocation;
      const matchesType = filterItemType === 'all' || item.item_type === filterItemType;
      return matchesSearch && matchesLoc && matchesType;
    });
  }, [allItemsList, searchTerm, filterLocation, filterItemType]);

  const flattenedTasks = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return allTasksList.filter(task => {
      const parent = allItemsList.find(i => i.id === task.work_item_id);
      const matchesSearch = q === '' || task.title.toLowerCase().includes(q) || (parent && parent.title.toLowerCase().includes(q));
      
      let matchesStatus = true;
      if (filterStatus === 'em_andamento') matchesStatus = task.status === 'pendente' || task.status === 'em_andamento';
      else if (filterStatus === 'concluida') matchesStatus = task.status === 'concluida';
      else if (filterStatus === 'bloqueada') matchesStatus = task.status === 'bloqueada';

      const matchesLoc = filterLocation === 'all' || (parent && parent.location === filterLocation);
      const matchesItemType = filterItemType === 'all' || (parent && parent.item_type === filterItemType);
      const matchesTaskType = filterTaskType === 'all' || task.task_type === filterTaskType;
      const matchesExec = filterExecutor === 'all' || (task.executed_by && task.executed_by.includes(filterExecutor));

      return matchesSearch && matchesStatus && matchesLoc && matchesItemType && matchesTaskType && matchesExec;
    });
  }, [allTasksList, allItemsList, searchTerm, filterStatus, filterLocation, filterItemType, filterTaskType, filterExecutor]);

  const activeFiltersCount =
    (filterStatus !== 'all' ? 1 : 0) +
    (filterLocation !== 'all' ? 1 : 0) +
    (filterItemType !== 'all' ? 1 : 0) +
    (filterTaskType !== 'all' ? 1 : 0) +
    (filterExecutor !== 'all' ? 1 : 0);

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterStatus('all');
    setFilterLocation('all');
    setFilterItemType('all');
    setFilterTaskType('all');
    setFilterExecutor('all');
  };

  const handleToggleExpandAll = () => {
    setIsAllExpanded(prev => !prev);
  };

  return (
    <div className="flex flex-col h-full space-y-3">
      
      {/* ======================================================== */}
      {/* LINHA 1: TÍTULO À ESQUERDA | TIPO DE VISUALIZAÇÃO À DIREITA */}
      {/* ======================================================== */}
      <div className="flex items-center justify-between gap-3 pb-1 border-b border-slate-200/80 shrink-0">
        <div className="min-w-0">
          <h3 className="text-sm font-black text-slate-900 tracking-tight">
            Estrutura da Obra
          </h3>
        </div>

        {/* Alternador de Modo de Visualização */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 shadow-2xs shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('tree')}
            title="Árvore EAP"
            className={`p-1.5 px-2.5 sm:px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
              viewMode === 'tree' ? 'bg-white text-sky-700 font-bold shadow-2xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <GitFork size={14} />
            <span className="hidden sm:inline">Árvore EAP</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('items')}
            title="Lista de Componentes"
            className={`p-1.5 px-2.5 sm:px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
              viewMode === 'items' ? 'bg-white text-sky-700 font-bold shadow-2xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers size={14} />
            <span className="hidden sm:inline">Itens</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('tasks')}
            title="Lista Corrida de Tarefas"
            className={`p-1.5 px-2.5 sm:px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
              viewMode === 'tasks' ? 'bg-white text-sky-700 font-bold shadow-2xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <CheckSquare size={14} />
            <span className="hidden sm:inline">Tarefas</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* LINHA 2: RECOLHER TUDO | PESQUISA | FILTRO | NOVO COMPONENTE (DESKTOP ONLY) */}
      {/* ======================================================== */}
      <div className="flex items-center justify-between gap-2 shrink-0">
        
        {/* Lado Esquerdo: Recolher/Expandir + Campo de Busca Expandido */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {viewMode === 'tree' && itemsTree.length > 0 && (
            <button
              type="button"
              onClick={handleToggleExpandAll}
              className="p-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-xl transition cursor-pointer shadow-2xs shrink-0 flex items-center justify-center"
              title={isAllExpanded ? "Recolher todas as pastas" : "Expandir todas as pastas"}
            >
              {isAllExpanded ? <ChevronsUp size={16} /> : <ChevronsDown size={16} />}
            </button>
          )}

          {/* Barra de Pesquisa */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar..."
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 transition text-slate-800 placeholder-slate-400 shadow-2xs font-medium"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Lado Direito: Filtro Flutuante + Novo Componente (Apenas Desktop) */}
        <div className="flex items-center gap-2 shrink-0">
          
          {/* Botão de Filtro */}
          <button
            ref={filterButtonRef}
            type="button"
            onClick={handleToggleFilterPopover}
            title="Filtrar atividades"
            className={`p-2 border rounded-xl transition cursor-pointer shadow-2xs flex items-center justify-center relative ${
              activeFiltersCount > 0
                ? 'bg-sky-50 border-sky-300 text-sky-700 font-bold'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Filter size={16} />
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-sky-600 text-white text-[9px] flex items-center justify-center font-bold shadow-2xs">
                {activeFiltersCount}
              </span>
            )}
          </button>

          {/* Botão Novo Componente (Oculto no mobile via hidden sm:inline-flex) */}
          {permissions.canManageWorkItems && (
            <button
              type="button"
              onClick={() => handleOpenCreateModal(null, null)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer active:scale-98 shrink-0 whitespace-nowrap"
            >
              <Plus size={15} />
              <span>Novo Componente</span>
            </button>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* POPOVER FLUTUANTE DE FILTROS (VIA PORTAL PARA NUNCA SER CORTADO) */}
      {/* ======================================================== */}
      {isFilterOpen && filterButtonCoords && createPortal(
        <div
          ref={filterPopoverRef}
          style={{
            position: 'fixed',
            top: `${filterButtonCoords.top}px`,
            left: `${filterButtonCoords.left}px`,
            width: '280px'
          }}
          className="bg-white border border-slate-200 rounded-3xl shadow-2xl p-4 z-[99999] text-xs space-y-3 animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Filter size={13} className="text-sky-600" />
              <span>Filtrar Execução</span>
            </span>
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-[11px] text-sky-600 hover:underline font-semibold cursor-pointer"
              >
                Limpar Todos
              </button>
            )}
          </div>

          <div className="space-y-2.5 max-h-[70vh] overflow-y-auto pr-0.5">
            {/* 1. Situação Operacional */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1 text-[11px]">Situação das Tarefas</label>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value as any)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500 cursor-pointer text-xs"
              >
                <option value="all">Todas as Situações</option>
                <option value="em_andamento">Liberadas / Em Andamento</option>
                <option value="bloqueada">Restrição (Bloqueadas)</option>
                <option value="concluida">Concluídas</option>
              </select>
            </div>

            {/* 2. Local no Canteiro */}
            {locationOptions.length > 0 && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[11px]">Local / Setor</label>
                <select
                  value={filterLocation}
                  onChange={e => setFilterLocation(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500 cursor-pointer text-xs"
                >
                  <option value="all">Todos os Locais</option>
                  {locationOptions.map(l => (
                    <option key={l.id} value={l.name}>{l.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* 3. Tipo de Componente */}
            {itemTypeOptions.length > 0 && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[11px]">Tipo de Componente</label>
                <select
                  value={filterItemType}
                  onChange={e => setFilterItemType(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500 cursor-pointer text-xs"
                >
                  <option value="all">Todos os Tipos</option>
                  {itemTypeOptions.map(t => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* 4. Tipo de Subitem / Tarefa */}
            {subitemTypeOptions.length > 0 && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[11px]">Tipo de Tarefa / Subitem</label>
                <select
                  value={filterTaskType}
                  onChange={e => setFilterTaskType(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500 cursor-pointer text-xs"
                >
                  <option value="all">Todas as Tarefas</option>
                  {subitemTypeOptions.map(st => (
                    <option key={st.id} value={st.name}>{st.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* 5. Executor Alocado */}
            {teamMembers.length > 0 && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[11px]">Colaborador / Executor</label>
                <select
                  value={filterExecutor}
                  onChange={e => setFilterExecutor(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500 cursor-pointer text-xs"
                >
                  <option value="all">Todos os Colaboradores</option>
                  {teamMembers.map(m => (
                    <option key={m.id} value={m.name}>{m.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsFilterOpen(false)}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer shadow-2xs transition"
            >
              Aplicar Filtros
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* ======================================================== */}
      {/* CORPO DA ABA COM VISUALIZAÇÃO DOS ITENS E TAREFAS */}
      {/* ======================================================== */}
      {loading ? (
        <div className="p-16 text-center text-xs text-slate-400">
          <Loader2 size={20} className="animate-spin mx-auto mb-2 text-sky-600" />
          Carregando componentes e tarefas da obra...
        </div>
      ) : (
        <>
          {/* 1. VISUALIZAÇÃO: ÁRVORE EAP */}
          {viewMode === 'tree' && (
            <div className="flex-1 min-h-0 overflow-y-auto border border-slate-200 rounded-2xl p-2.5 sm:p-3.5 bg-white space-y-3 shadow-2xs">
              {filteredTree.length === 0 ? (
                <div className="h-64 border border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-xs text-slate-400 p-6 text-center">
                  <Layers size={32} className="text-slate-300 mb-2" />
                  {itemsTree.length === 0 ? (
                    <>
                      <span className="font-semibold text-slate-700">Nenhum componente cadastrado.</span>
                      {permissions.canManageWorkItems && (
                        <button
                          type="button"
                          onClick={() => handleOpenCreateModal(null, null)}
                          className="mt-3 px-3.5 py-1.5 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-xl font-bold cursor-pointer transition-colors"
                        >
                          + Adicionar primeiro componente
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="font-semibold text-slate-700">Nenhum item corresponde aos filtros ativos.</span>
                      <button
                        type="button"
                        onClick={handleClearFilters}
                        className="mt-3 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold cursor-pointer transition-colors"
                      >
                        Limpar filtros de busca
                      </button>
                    </>
                  )}
                </div>
              ) : (
                filteredTree.map(rootItem => (
                  <WorkItemRow
                    key={rootItem.id}
                    item={rootItem}
                    depth={1}
                    isAllExpanded={isAllExpanded}
                    measurementType={measurementType}
                    allTasks={allTasksList}
                    allItems={allItemsList}
                    teamMembers={teamMembers}
                    companyTeams={companyTeams}
                    itemTypes={itemTypeOptions}
                    subitemTypes={subitemTypeOptions}
                    canManageItems={permissions.canManageWorkItems}
                    canDeleteItems={permissions.canDeleteWorkItems}
                    canDuplicateItems={permissions.canDuplicateWorkItems}
                    canCreateTasks={permissions.canCreateWorkTasks}
                    canCompleteTasks={permissions.canCompleteWorkTasks}
                    canReopenTasks={permissions.canReopenWorkTasks}
                    canViewPrices={permissions.canViewWorkPrices}
                    canAssignExecutors={permissions.canAssignExecutors}
                    onOpenQuickSettings={() => setIsSettingsModalOpen(true)}
                    onOpenItemDrawer={item => setSelectedDrawerItemId(item.id)}
                    onOpenCreateChildModal={(parentId, parentTitle) => handleOpenCreateModal(parentId, parentTitle)}
                    onOpenEditItemModal={item => {
                      if (!permissions.canManageWorkItems) return;
                      setEditingItem(item);
                      setEditItemTitle(item.title);
                      setEditItemCode(item.code || '');
                      setEditItemType(item.item_type || '');
                      setEditItemLocation(item.location || '');
                      setEditItemDescription(item.description || '');
                      setEditItemPrice(item.unit_price ? item.unit_price.toString() : '');
                    }}
                    onOpenDeleteItemModal={item => {
                      if (!permissions.canDeleteWorkItems) return;
                      setItemToDelete(item);
                    }}
                    onDuplicateItem={item => {
                      if (!permissions.canDuplicateWorkItems) return;
                      setItemToBatchDuplicate(item);
                      setDuplicateQuantity(1);
                      setDuplicateStartIndex(1);
                    }}
                    onToggleTaskStatus={handleToggleTaskStatus}
                    onSaveTaskEntry={handleSaveTaskEntry} 
                    onUpdateTaskExecutedQty={handleUpdateTaskExecutedQty}
                    onOpenEditTaskModal={handleSaveEditTask}
                    onOpenDeleteTaskModal={(task, parentItemId) => {
                      if (!permissions.canDeleteWorkItems) return;
                      setTaskToDelete({ task, parentItemId });
                    }}
                    onSaveInlineTask={handleSaveInlineTask}
                  />
                ))
              )}
            </div>
          )}

          {/* 2. VISUALIZAÇÃO: LISTA DE ITENS */}
          {viewMode === 'items' && (
            <div className="flex-1 min-h-0 overflow-y-auto border border-slate-200 rounded-2xl bg-white shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600 min-w-[700px]">
                  <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider sticky top-0 z-10">
                    <tr>
                      <th className="py-3 px-4">Componente & Hierarquia</th>
                      <th className="py-3 px-4">Tipo</th>
                      <th className="py-3 px-4">Local</th>
                      <th className="py-3 px-4">Dependência</th>
                      <th className="py-3 px-4">Tarefas</th>
                      <th className="py-3 px-4">Avanço Físico</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {flattenedItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400">
                          Nenhum componente encontrado.
                        </td>
                      </tr>
                    ) : (
                      flattenedItems.map(item => {
                        const itemTasks = allTasksList.filter(t => t.work_item_id === item.id);
                        const doneTasks = itemTasks.filter(t => t.status === 'concluida').length;
                        
                        let prog = 0;
                        if (itemTasks.length > 0) {
                          let doneUnits = 0;
                          itemTasks.forEach(t => {
                            if (t.status === 'concluida') doneUnits += 1;
                            else if (t.has_progress_tracking && t.quantity_planned > 0) {
                              doneUnits += Math.min(1, (t.quantity_executed || 0) / t.quantity_planned);
                            }
                          });
                          prog = Math.round((doneUnits / itemTasks.length) * 100);
                        } else {
                          prog = item.progress_percent || 0;
                        }

                        const currentTypeObj = itemTypeOptions.find(t => t.name === item.item_type);
                        const depItem = item.depends_on_item_id ? allItemsList.find(i => i.id === item.depends_on_item_id) : null;
                        const isItemBlocked = depItem ? (depItem.progress_percent || 0) < 100 : false;
                        
                        const hierarchyChain = getHierarchyArray(item.id);
                        const isHovered = hoveredTreeItemId === item.id;

                        return (
                          <tr
                            key={item.id}
                            onClick={() => setSelectedDrawerItemId(item.id)}
                            className="hover:bg-slate-50/70 transition cursor-pointer"
                          >
                            <td className="py-3 px-4 font-bold text-slate-900">
                              <div className="relative inline-block max-w-full">
                                <div
                                  onMouseEnter={() => setHoveredTreeItemId(item.id)}
                                  onMouseLeave={() => setHoveredTreeItemId(null)}
                                  className="inline-flex items-center gap-1.5 flex-wrap cursor-pointer"
                                >
                                  {isItemBlocked && <Lock size={13} className="text-amber-500 shrink-0" />}
                                  
                                  <span className="text-slate-900 text-xs font-bold hover:text-sky-600 transition-colors">
                                    {hierarchyChain.map((node, idx) => (
                                      <React.Fragment key={node.id}>
                                        <span className={idx === 0 ? 'text-slate-900 font-black' : 'text-slate-500 font-semibold'}>
                                          {node.title}
                                        </span>
                                        <span className="text-slate-300 mx-1">/</span>
                                      </React.Fragment>
                                    ))}
                                  </span>

                                  {item.code && (
                                    <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold border border-slate-200">
                                      {item.code}
                                    </span>
                                  )}
                                </div>

                                {isHovered && hierarchyChain.length > 1 && (
                                  <div className="absolute left-0 top-full mt-1.5 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 z-50 text-xs space-y-2 animate-in fade-in duration-100 pointer-events-none">
                                    <div className="flex items-center gap-1.5 pb-2 border-b border-slate-100 text-slate-800 font-bold text-[11px]">
                                      <GitFork size={13} className="text-sky-600" />
                                      <span>Estrutura Hierárquica</span>
                                    </div>
                                    <div className="space-y-1.5">
                                      {[...hierarchyChain].reverse().map((node, idx) => (
                                        <div
                                          key={node.id}
                                          style={{ paddingLeft: `${idx * 12}px` }}
                                          className="flex items-center gap-1.5 text-[11px]"
                                        >
                                          {idx > 0 && <CornerDownRight size={11} className="text-slate-400 shrink-0" />}
                                          <span className={`truncate ${idx === hierarchyChain.length - 1 ? 'font-black text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded' : 'text-slate-600 font-medium'}`}>
                                            {node.title}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              {item.item_type ? (
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] font-bold border px-2 py-0.5 rounded-md"
                                  style={{
                                    backgroundColor: currentTypeObj?.color ? `${currentTypeObj.color}15` : '#e0e7ff',
                                    borderColor: currentTypeObj?.color ? `${currentTypeObj.color}40` : '#c7d2fe',
                                    color: currentTypeObj?.color || '#4338ca'
                                  }}
                                >
                                  <span>{item.item_type}</span>
                                </span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {item.location ? (
                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px]">
                                  {item.location}
                                </span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {depItem ? (
                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  isItemBlocked ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                }`}>
                                  <Lock size={9} />
                                  <span>{depItem.title}</span>
                                </span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              {itemTasks.length > 0 ? `${doneTasks} de ${itemTasks.length}` : 'Sem tarefas'}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2 min-w-[120px]">
                                <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className={`h-1.5 rounded-full ${prog >= 100 ? 'bg-emerald-500' : 'bg-sky-500'}`}
                                    style={{ width: `${prog}%` }}
                                  />
                                </div>
                                <span className="font-bold text-slate-800 text-xs">{prog}%</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1">
                                {permissions.canManageWorkItems && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingItem(item);
                                      setEditItemTitle(item.title);
                                      setEditItemCode(item.code || '');
                                      setEditItemType(item.item_type || '');
                                      setEditItemLocation(item.location || '');
                                      setEditItemDescription(item.description || '');
                                      setEditItemPrice(item.unit_price ? item.unit_price.toString() : '');
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition cursor-pointer"
                                    title="Editar componente"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                )}
                                {permissions.canDeleteWorkItems && (
                                  <button
                                    type="button"
                                    onClick={() => setItemToDelete(item)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                    title="Excluir componente"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. VISUALIZAÇÃO: LISTA DE TAREFAS */}
          {viewMode === 'tasks' && (
            <div className="flex-1 min-h-0 overflow-y-auto border border-slate-200 rounded-2xl bg-white shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600 min-w-[750px]">
                  <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider sticky top-0 z-10">
                    <tr>
                      <th className="py-3 px-4">Tarefa & Hierarquia</th>
                      <th className="py-3 px-4">Tipo de Subitem</th>
                      <th className="py-3 px-4">Local</th>
                      <th className="py-3 px-4">Executores</th>
                      <th className="py-3 px-4">Avanço / Quantitativo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {flattenedTasks.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400">
                          Nenhuma tarefa encontrada.
                        </td>
                      </tr>
                    ) : (
                      flattenedTasks.map(task => {
                        const parent = allItemsList.find(i => i.id === task.work_item_id);
                        const isDone = task.status === 'concluida';
                        const isTaskBlockedManual = task.status === 'bloqueada';
                        const isTaskInProgress = task.status === 'em_andamento';

                        const matchingTypeObj = subitemTypeOptions.find(t => t.name === task.task_type);
                        const parentChain = getHierarchyArray(task.work_item_id);

                        const depTask = task.depends_on_task_id
                          ? allTasksList.find(t => t.id === task.depends_on_task_id)
                          : null;
                        const isDepTaskBlocked = depTask ? depTask.status !== 'concluida' : false;

                        const parentDepItem = parent?.depends_on_item_id
                          ? allItemsList.find(i => i.id === parent.depends_on_item_id)
                          : null;
                        const isParentItemBlocked = parentDepItem ? (parentDepItem.progress_percent || 0) < 100 : false;

                        const isBlockedByDependency = isDepTaskBlocked || isParentItemBlocked;
                        const canToggle = (isDone ? permissions.canReopenWorkTasks : permissions.canCompleteWorkTasks) && !isTaskBlockedManual;
                        const taskExecutors: string[] = task.executed_by || [];
                        const isHovered = hoveredTreeItemId === task.id;

                        return (
                          <tr
                            key={task.id}
                            className={`transition ${
                              isDone
                                ? 'bg-emerald-50/20'
                                : isTaskBlockedManual
                                ? 'bg-rose-50/50'
                                : isBlockedByDependency
                                ? 'bg-amber-50/30'
                                : 'hover:bg-slate-50/70'
                            }`}
                          >
                            <td className="py-3 px-4 font-bold text-slate-900">
                              <div className="flex items-center gap-2.5">
                                <button
                                  type="button"
                                  disabled={isBlockedByDependency || !canToggle}
                                  onClick={() => handleTaskTableCheckboxClick(task)}
                                  className={`shrink-0 transition flex items-center justify-center ${
                                    isBlockedByDependency || !canToggle
                                      ? 'cursor-not-allowed opacity-60'
                                      : 'cursor-pointer'
                                  }`}
                                  title={
                                    isTaskBlockedManual
                                      ? 'Restrição manual'
                                      : isBlockedByDependency
                                      ? 'Bloqueada por dependência'
                                      : isDone
                                      ? 'Concluída (Clique para reabrir)'
                                      : 'Clique para apontar avanço'
                                  }
                                >
                                  {isTaskBlockedManual ? (
                                    <ShieldAlert size={17} className="text-rose-600" />
                                  ) : isBlockedByDependency ? (
                                    <Lock size={16} className="text-amber-500" />
                                  ) : isDone ? (
                                    <CheckSquare size={17} className="text-emerald-600" />
                                  ) : isTaskInProgress ? (
                                    <PlayCircle size={18} className="text-sky-500 hover:text-sky-600" />
                                  ) : (
                                    <Square size={17} className="text-slate-400 hover:text-emerald-600" />
                                  )}
                                </button>

                                <div className="relative inline-block max-w-full">
                                  <div
                                    onMouseEnter={() => setHoveredTreeItemId(task.id)}
                                    onMouseLeave={() => setHoveredTreeItemId(null)}
                                    className="inline-flex items-center gap-1.5 flex-wrap cursor-pointer"
                                  >
                                    <span className={`text-xs hover:text-sky-600 transition-colors ${isDone ? 'line-through text-slate-400 font-normal' : isTaskBlockedManual ? 'text-rose-900' : 'text-slate-900 font-bold'}`}>
                                      <strong className={`${isTaskBlockedManual ? 'text-rose-900' : 'text-slate-900'} font-black`}>{task.title}</strong>
                                      <span className="text-slate-300 mx-1">/</span>
                                      {parentChain.map((node) => (
                                        <React.Fragment key={node.id}>
                                          <span className="text-slate-500 font-semibold">{node.title}</span>
                                          <span className="text-slate-300 mx-1">/</span>
                                        </React.Fragment>
                                      ))}
                                    </span>

                                    {isTaskBlockedManual && (
                                      <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded-md border border-rose-200" title={task.blocked_reason || 'Tarefa Bloqueada'}>
                                        <ShieldAlert size={9} />
                                        <span>Restrição Manual</span>
                                      </span>
                                    )}

                                    {!isTaskBlockedManual && isBlockedByDependency && (
                                      <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-md border border-amber-200">
                                        <Lock size={9} />
                                        <span>
                                          {isDepTaskBlocked
                                            ? `Aguardando: ${depTask?.title}`
                                            : `Aguardando: ${parentDepItem?.title}`}
                                        </span>
                                      </span>
                                    )}
                                  </div>

                                  {isHovered && parentChain.length > 0 && (
                                    <div className="absolute left-0 top-full mt-1.5 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 z-50 text-xs space-y-2 animate-in fade-in duration-100 pointer-events-none">
                                      <div className="flex items-center gap-1.5 pb-2 border-b border-slate-100 text-slate-800 font-bold text-[11px]">
                                        <GitFork size={13} className="text-sky-600" />
                                        <span>Árvore de Execução</span>
                                      </div>
                                      <div className="space-y-1.5">
                                        {[...parentChain].reverse().map((node, idx) => (
                                          <div
                                            key={node.id}
                                            style={{ paddingLeft: `${idx * 12}px` }}
                                            className="flex items-center gap-1.5 text-[11px]"
                                          >
                                            {idx > 0 && <CornerDownRight size={11} className="text-slate-400 shrink-0" />}
                                            <span className="text-slate-600 font-medium truncate">{node.title}</span>
                                          </div>
                                        ))}
                                        <div
                                          style={{ paddingLeft: `${parentChain.length * 12}px` }}
                                          className="flex items-center gap-1.5 text-[11px]"
                                        >
                                          <CornerDownRight size={11} className="text-sky-600 shrink-0" />
                                          <span className="font-black text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded truncate">
                                            {task.title}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-4">
                              {task.task_type ? (
                                <span
                                  className="px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 inline-flex items-center gap-1"
                                  style={{
                                    backgroundColor: matchingTypeObj?.color ? `${matchingTypeObj.color}15` : '#f1f5f9',
                                    borderColor: matchingTypeObj?.color ? `${matchingTypeObj.color}40` : '#e2e8f0',
                                    color: matchingTypeObj?.color || '#475569'
                                  }}
                                >
                                  <span>{task.task_type}</span>
                                </span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>

                            <td className="py-3 px-4">
                              {parent?.location ? (
                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px]">
                                  {parent.location}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>

                            <td className="py-3 px-4">
                              {taskExecutors.length > 0 ? (
                                <div className="flex items-center gap-1.5">
                                  <div className="flex -space-x-1.5 overflow-hidden">
                                    {taskExecutors.slice(0, 3).map((execName, idx) => {
                                      const mObj = teamMembers.find(m => m.name.toLowerCase() === execName.toLowerCase());
                                      return (
                                        <div
                                          key={idx}
                                          className="w-5 h-5 rounded-full bg-sky-600 text-white font-bold text-[8px] flex items-center justify-center border-2 border-white uppercase overflow-hidden"
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
                                  </div>
                                  <span className="text-xs font-semibold text-slate-700 truncate max-w-[140px]">
                                    {taskExecutors.join(', ')}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">Pendente</span>
                              )}
                            </td>

                            <td className="py-3 px-4">
                              {task.has_progress_tracking ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="w-14 px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 text-center">
                                    {task.quantity_executed || 0}
                                  </span>
                                  <span className="text-slate-500 font-semibold text-[11px]">
                                    / {task.quantity_planned} {task.unit}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-500 font-medium">Checklist</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* DRAWER LATERAL DE DETALHES DO ITEM */}
      <WorkItemDrawer
        isOpen={!!selectedDrawerItemId}
        onClose={() => setSelectedDrawerItemId(null)}
        item={activeDrawerItem}
        allItems={allItemsList}
        allTasks={allTasksList}
        teamMembers={teamMembers}
        subitemTypes={subitemTypeOptions}
        measurementType={measurementType}
        canCreateTasks={permissions.canCreateWorkTasks}
        canCompleteTasks={permissions.canCompleteWorkTasks}
        canReopenTasks={permissions.canReopenWorkTasks}
        canViewPrices={permissions.canViewWorkPrices}
        onToggleTaskStatus={handleToggleTaskStatus}
        onSaveTaskEntry={handleSaveTaskEntry} 
        onSaveInlineTask={handleSaveInlineTask}
        onItemUpdated={loadWorkStructure}
      />

      {/* MODAL: CRIAR COMPONENTE */}
      {isCreateItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-7 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-3.5">
              <div>
                <h4 className="font-bold text-slate-900 text-base">
                  {modalParentItem.id ? 'Novo Subcomponente' : 'Novo Componente da EAP'}
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  {modalParentItem.id
                    ? `Vinculado dentro de: "${modalParentItem.title}"`
                    : 'Componente principal de primeiro nível da obra.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateItemModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveItemForm} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nome do Componente *
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="Ex: Motor Elétrico Principal 01"
                    value={itemFormTitle}
                    onChange={e => setItemFormTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Tag size={12} className="text-slate-400" />
                    <span>Tag / Código</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: MOT-01"
                    value={itemFormCode}
                    onChange={e => setItemFormCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <MapPin size={12} className="text-slate-400" />
                      <span>Local no Canteiro</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsSettingsModalOpen(true)}
                      className="text-sky-600 hover:underline font-bold text-[10px]"
                    >
                      + Novo
                    </button>
                  </label>
                  {locationOptions.length > 0 ? (
                    <select
                      value={itemFormLocation}
                      onChange={e => setItemFormLocation(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-sky-500 cursor-pointer"
                    >
                      <option value="">Selecione o local...</option>
                      {locationOptions.map(loc => (
                        <option key={loc.id} value={loc.name}>{loc.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="Ex: Casa de Máquinas"
                      value={itemFormLocation}
                      onChange={e => setItemFormLocation(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-sky-500"
                    />
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Box size={12} className="text-slate-400" />
                      <span>Tipo de Componente</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsSettingsModalOpen(true)}
                      className="text-sky-600 hover:underline font-bold text-[10px]"
                    >
                      + Novo
                    </button>
                  </label>
                  {itemTypeOptions.length > 0 ? (
                    <select
                      value={itemFormItemType}
                      onChange={e => setItemFormItemType(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-sky-500 cursor-pointer"
                    >
                      <option value="">Selecione o tipo...</option>
                      {itemTypeOptions.map(t => (
                        <option key={t.id} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="Ex: Motores, Painéis"
                      value={itemFormItemType}
                      onChange={e => setItemFormItemType(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-sky-500"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Calendar size={12} className="text-slate-400" />
                    <span>Início Previsto</span>
                  </label>
                  <input
                    type="date"
                    value={itemFormStartDate}
                    onChange={e => setItemFormStartDate(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Calendar size={12} className="text-slate-400" />
                    <span>Conclusão Prevista</span>
                  </label>
                  <input
                    type="date"
                    value={itemFormDueDate}
                    min={itemFormStartDate || undefined}
                    onChange={e => setItemFormDueDate(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Lock size={12} className="text-slate-400" />
                  <span>Aguardar Conclusão de Outro Item (Dependência)</span>
                </label>
                <select
                  value={itemFormDependsOnId}
                  onChange={e => setItemFormDependsOnId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500 cursor-pointer"
                >
                  <option value="">Sem dependência (Livre para iniciar)</option>
                  {allItemsList.map(otherItem => (
                    <option key={otherItem.id} value={otherItem.id}>
                      {otherItem.title} {otherItem.code ? `(${otherItem.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {measurementType === 'por_item' && permissions.canViewWorkPrices && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <DollarSign size={12} className="text-slate-400" />
                    <span>Valor Medido (R$)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="0,00"
                    value={itemFormPrice}
                    onChange={e => setItemFormPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:ring-2 focus:ring-sky-500 text-right"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <FileText size={12} className="text-slate-400" />
                  <span>Descrição / Requisitos</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Orientações e especificações técnicas de montagem..."
                  value={itemFormDescription}
                  onChange={e => setItemFormDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium resize-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateItemModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingItemForm || !itemFormTitle.trim()}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-semibold shadow-2xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer active:scale-98"
                >
                  {savingItemForm ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>Salvar Componente</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Item */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h4 className="font-bold text-slate-900 text-sm">Editar Componente</h4>
              <button onClick={() => setEditingItem(null)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handleSaveEditItem} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Título *</label>
                  <input
                    type="text"
                    required
                    value={editItemTitle}
                    onChange={e => setEditItemTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Tag size={12} className="text-slate-400" />
                    <span>Tag / Código</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: AP-02"
                    value={editItemCode}
                    onChange={e => setEditItemCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Local / Setor</label>
                  <select
                    value={editItemLocation}
                    onChange={e => setEditItemLocation(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  >
                    <option value="">Sem local...</option>
                    {locationOptions.map(l => (
                      <option key={l.id} value={l.name}>{l.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Descrição</label>
                <textarea
                  rows={3}
                  value={editItemDescription}
                  onChange={e => setEditItemDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium resize-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {measurementType === 'por_item' && permissions.canViewWorkPrices && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Valor Unitário (R$)</label>
                  <input
                    type="text"
                    value={editItemPrice}
                    onChange={e => setEditItemPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEditItem || !editItemTitle.trim()}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-semibold shadow-2xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {savingEditItem ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>Salvar Alterações</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DUPLICAÇÃO EM LOTE */}
      {itemToBatchDuplicate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-7 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 text-xs max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100 font-bold">
                  <Copy size={16} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Duplicar em Lote</h4>
                  <p className="text-[11px] text-slate-400">Gere múltiplas cópias sequenciais com todas as tarefas</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setItemToBatchDuplicate(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Item Modelo</span>
              <strong className="text-slate-900 font-bold text-xs block">{itemToBatchDuplicate.title}</strong>
              <span className="text-[10px] text-slate-500 block">
                {allTasksList.filter(t => t.work_item_id === itemToBatchDuplicate.id).length} tarefas vinculadas serão clonadas para cada cópia.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Quantidade de Cópias *</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  required
                  value={duplicateQuantity}
                  onChange={e => setDuplicateQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-sky-500 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Iniciar no Número</label>
                <input
                  type="number"
                  min={1}
                  value={duplicateStartIndex}
                  onChange={e => setDuplicateStartIndex(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-sky-500 text-xs"
                />
              </div>
            </div>

            <div className="p-3 bg-sky-50/50 rounded-2xl border border-sky-100 space-y-1.5">
              <span className="text-[10px] font-bold text-sky-800 uppercase tracking-wider block">Exemplo do resultado:</span>
              <div className="text-[11px] text-sky-900 font-medium space-y-0.5">
                <div>• {itemToBatchDuplicate.title.replace(/\s*\d+$/, '').trim()} {String(duplicateStartIndex).padStart(2, '0')}</div>
                {duplicateQuantity > 1 && (
                  <div>• {itemToBatchDuplicate.title.replace(/\s*\d+$/, '').trim()} {String(duplicateStartIndex + 1).padStart(2, '0')}</div>
                )}
                {duplicateQuantity > 2 && (
                  <div className="text-slate-400 text-[10px]">... até o número {String(duplicateStartIndex + duplicateQuantity - 1).padStart(2, '0')}</div>
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                disabled={duplicatingBatch}
                onClick={() => setItemToBatchDuplicate(null)}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={duplicatingBatch}
                onClick={handleConfirmBatchDuplicate}
                className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {duplicatingBatch ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
                <span>{duplicatingBatch ? 'Criando Cópias...' : `Criar ${duplicateQuantity} Cópias`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Excluir Item */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <Plus size={22} className="rotate-45" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-base">Excluir Componente</h4>
              <p className="text-xs text-slate-500 mt-1">
                Deseja excluir "{itemToDelete.title}" e todas as suas tarefas vinculadas?
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="w-1/2 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingItem}
                onClick={handleConfirmDeleteItem}
                className="w-1/2 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {deletingItem ? <Loader2 size={13} className="animate-spin" /> : null}
                <span>Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Excluir Tarefa */}
      {taskToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <Plus size={22} className="rotate-45" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-base">Excluir Tarefa</h4>
              <p className="text-xs text-slate-500 mt-1">
                Deseja remover a tarefa "{taskToDelete.task.title}"?
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTaskToDelete(null)}
                className="w-1/2 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingTask}
                onClick={handleConfirmDeleteTask}
                className="w-1/2 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {deletingTask ? <Loader2 size={13} className="animate-spin" /> : null}
                <span>Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: APONTAMENTO AO CONCLUIR TAREFA NA TABELA CORRIDA DE TAREFAS */}
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
                  {completingTask.task.title}
                </p>
                {completingTask.task.has_progress_tracking && (
                  <div className="mt-2 flex items-center gap-2 text-[11px] font-medium text-slate-500 flex-wrap">
                    <span className="bg-white px-2 py-1 rounded border border-slate-200 shadow-2xs">
                      Planejado: <strong className="text-slate-800">{completingTask.task.quantity_planned} {completingTask.task.unit}</strong>
                    </span>
                    <span className="bg-white px-2 py-1 rounded border border-slate-200 shadow-2xs">
                      Já feito: <strong className="text-sky-600">{completingTask.task.quantity_executed || 0} {completingTask.task.unit}</strong>
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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

                {completingTask.task.has_progress_tracking ? (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Qtd. feita HOJE ({completingTask.task.unit})</label>
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

              {/* SELEÇÃO DOS COLABORADORES DA OBRA */}
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
                          disabled={!permissions.canAssignExecutors}
                          onClick={() => toggleExecutor(member.name)}
                          className={`w-full p-2 rounded-xl text-left border transition flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? 'bg-sky-50 border-sky-300 text-sky-900 font-bold shadow-2xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 font-medium'
                          } ${!permissions.canAssignExecutors ? 'opacity-70 cursor-not-allowed' : ''}`}
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
                onClick={handleConfirmTaskCompletionFromTable}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold cursor-pointer shadow-2xs transition text-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSavingEntry ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                <span>Salvar Apontamento</span>
              </button>
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

      {/* Modal Rápido de Configurações Operacionais */}
      <WorkCustomSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        workId={workId}
        currentMeasurementType={measurementType}
        onUpdated={loadCustomSettings}
      />

      {/* BOTÃO FLUTUANTE DIÁRIO DE OBRA */}
      {permissions.canCompleteWorkTasks && (
        <button
          type="button"
          onClick={() => setIsDailyLogModalOpen(true)}
          className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-[90] flex items-center gap-2.5 px-4 py-3 sm:px-6 sm:py-4 bg-sky-600 hover:bg-sky-500 text-white rounded-full shadow-[0_10px_40px_rgba(2,132,199,0.4)] transition-all hover:-translate-y-1 hover:shadow-[0_15px_50px_rgba(2,132,199,0.5)] cursor-pointer font-bold group"
          title="Lançar Diário de Obra"
        >
          <BookOpenCheck size={22} className="group-hover:scale-110 transition-transform sm:w-6 sm:h-6" />
          <span className="hidden sm:inline text-sm tracking-wide">
            Diário de Obra
          </span>
        </button>
      )}

      {/* MODAL GLOBAL DO DIÁRIO */}
      <DailyWorkLogModal
        isOpen={isDailyLogModalOpen}
        onClose={() => setIsDailyLogModalOpen(false)}
        defaultWorkId={workId}
        onSaved={() => {
          loadWorkStructure();
        }}
      />

    </div>
  );
};

export default WorkItemsTasksTab;