import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Layers,
  CheckSquare,
  Square,
  Loader2,
  CalendarRange,
  Users,
  Edit3,
  X,
  Save,
  Search,
  Filter,
  Trash2,
  Link2,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  ChevronsDown,
  ChevronsUp,
  UserCheck,
  Tag,
  PlayCircle,
  ShieldAlert,
  ShieldCheck,
  MapPin
} from 'lucide-react';

interface WorkTask {
  id: string;
  work_item_id: string;
  title: string;
  task_type?: string | null;
  status: 'pendente' | 'em_andamento' | 'bloqueada' | 'concluida';
  has_progress_tracking: boolean;
  quantity_planned: number;
  quantity_executed: number;
  unit: string;
  start_date?: string | null;
  due_date?: string | null;
  depends_on_task_id?: string | null;
  executed_by?: string[] | null;
  blocked_reason?: string | null;
  blocked_at?: string | null;
}

interface WorkItem {
  id: string;
  parent_id?: string | null;
  code: string | null;
  title: string;
  item_type?: string | null;
  location?: string | null;
  progress_percent: number;
  start_date?: string | null;
  due_date?: string | null;
  depends_on_item_id?: string | null;
  tasks?: WorkTask[];
  children?: WorkItem[];
}

interface TeamMember {
  id: string;
  name: string;
  role?: string;
  team_id?: string | null;
  avatar_url?: string | null;
}

interface SettingOption {
  id: string;
  name: string;
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

interface WorkScheduleTabProps {
  workId: string;
  workTitle?: string;
  workCode?: string | null;
}

type ZoomLevel = 'days' | 'weeks' | 'months';

export const WorkScheduleTab: React.FC<WorkScheduleTabProps> = ({ 
  workId, 
  workTitle = 'Obra em Execução',
  workCode 
}) => {
  const { user } = useAuth();
  const { permissions, loading: loadingPerms } = usePermissions();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<WorkItem[]>([]);
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  
  // Colaboradores alocados na obra (work_members)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // Configurações dos Filtros
  const [itemTypeOptions, setItemTypeOptions] = useState<SettingOption[]>([]);
  const [subitemTypeOptions, setSubitemTypeOptions] = useState<SettingOption[]>([]);
  const [locationOptions, setLocationOptions] = useState<SettingOption[]>([]);

  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('weeks');
  const [baseDate, setBaseDate] = useState<Date>(new Date());

  // Iniciar recolhido por padrão (Set vazio)
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set());

  // Pesquisa e Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterButtonCoords, setFilterButtonCoords] = useState<{ top: number; left: number } | null>(null);

  const [filterStatus, setFilterStatus] = useState<'all' | 'concluida' | 'em_andamento' | 'atrasadas' | 'sem_prazo' | 'bloqueada'>('all');
  const [filterItemType, setFilterItemType] = useState<string>('all');
  const [filterSubitemType, setFilterSubitemType] = useState<string>('all');
  const [filterLocation, setFilterLocation] = useState<string>('all');
  const [filterExecutor, setFilterExecutor] = useState<string>('all');

  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const filterPopoverRef = useRef<HTMLDivElement>(null);

  // Popup de Ações Rápidas
  const [actionTarget, setActionTarget] = useState<{
    id: string;
    title: string;
    type: 'item' | 'task';
    start?: string | null;
    due?: string | null;
    status?: string;
    dependsOnId?: string | null;
    isBlocked?: boolean;
    dependencyTitle?: string | null;
    itemRef?: WorkItem;
    taskRef?: WorkTask;
  } | null>(null);

  // Modais de Prazos / Dependência
  const [isDatesModalOpen, setIsDatesModalOpen] = useState(false);
  const [quickStartDate, setQuickStartDate] = useState('');
  const [quickDueDate, setQuickDueDate] = useState('');
  const [savingQuickDates, setSavingQuickDates] = useState(false);

  const [isDependencyModalOpen, setIsDependencyModalOpen] = useState(false);
  const [selectedDependencyId, setSelectedDependencyId] = useState('');
  const [savingDependency, setSavingDependency] = useState(false);

  // Estados de Apontamento Diário
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

  // Fecha o popover de filtros ao clicar fora
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

  const loadScheduleData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: itemsData, error: itemsErr } = await supabase
        .from('work_items')
        .select('*')
        .eq('work_id', workId);

      if (itemsErr) throw itemsErr;

      const sortedItems = (itemsData || []).sort((a: WorkItem, b: WorkItem) =>
        (a.title || '').localeCompare(b.title || '', 'pt-BR', { numeric: true, sensitivity: 'base' })
      );

      const itemIds = sortedItems.map(i => i.id);
      let tasksData: WorkTask[] = [];

      if (itemIds.length > 0) {
        const { data: tData, error: tasksErr } = await supabase
          .from('work_tasks')
          .select('*')
          .in('work_item_id', itemIds);

        if (tasksErr) throw tasksErr;

        tasksData = (tData || [])
          .map((t: any) => ({
            ...t,
            executed_by: Array.isArray(t.executed_by) ? t.executed_by : []
          }))
          .sort((a: WorkTask, b: WorkTask) =>
            (a.title || '').localeCompare(b.title || '', 'pt-BR', { numeric: true, sensitivity: 'base' })
          );
      }

      setItems(sortedItems);
      setTasks(tasksData);
    } catch (err) {
      console.error('Erro ao carregar dados do cronograma:', err);
    } finally {
      setLoading(false);
    }
  }, [workId]);

  const loadFilterSettings = useCallback(async () => {
    const companyId = user?.company?.id;
    if (!companyId) return;

    try {
      const [workMembersRes, companyMembersRes, itemTypesRes, taskTypesRes, locsRes] = await Promise.all([
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
          .eq('work_id', workId),
        supabase
          .from('memberships')
          .select(`
            id,
            profile_id,
            role,
            team_id,
            status,
            profile:profiles(id, full_name, role_title, avatar_url)
          `)
          .eq('company_id', companyId)
          .eq('status', 'ativo'),
        supabase
          .from('work_item_types')
          .select('id, name, color')
          .eq('company_id', companyId)
          .or(`work_id.eq.${workId},work_id.is.null`)
          .order('name', { ascending: true }),
        supabase
          .from('work_task_types')
          .select('id, name, color')
          .eq('company_id', companyId)
          .or(`work_id.eq.${workId},work_id.is.null`)
          .order('name', { ascending: true }),
        supabase
          .from('work_locations')
          .select('id, name, color')
          .eq('company_id', companyId)
          .or(`work_id.eq.${workId},work_id.is.null`)
          .order('name', { ascending: true })
      ]);

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

      if (assignedFromWork.length > 0) {
        setTeamMembers(assignedFromWork);
      } else if (companyMembersRes.data) {
        setTeamMembers(
          companyMembersRes.data.map((m: any) => {
            const prof = Array.isArray(m.profile) ? m.profile[0] : m.profile;
            return {
              id: prof?.id || m.id,
              name: prof?.full_name || 'Sem nome',
              role: prof?.role_title || m.role || 'Colaborador',
              team_id: m.team_id,
              avatar_url: prof?.avatar_url || null
            };
          })
        );
      }

      if (itemTypesRes.data) setItemTypeOptions(itemTypesRes.data);
      if (taskTypesRes.data) setSubitemTypeOptions(taskTypesRes.data);
      if (locsRes.data) setLocationOptions(locsRes.data);
    } catch (err) {
      console.warn('Erro ao carregar configurações de filtro:', err);
    }
  }, [user?.company?.id, workId]);

  useEffect(() => {
    if (permissions.canViewSchedule) {
      loadScheduleData();
      loadFilterSettings();
    }
  }, [loadScheduleData, loadFilterSettings, permissions.canViewSchedule]);

  const itemsMap = useMemo(() => {
    const map = new Map<string, WorkItem>();
    items.forEach(i => map.set(i.id, i));
    return map;
  }, [items]);

  const getHierarchyBreadcrumb = useCallback((itemId: string | null | undefined, taskTitle?: string): string => {
    if (!itemId && !taskTitle) return '';
    const parts: string[] = [];
    let current = itemId ? itemsMap.get(itemId) : null;
    let depth = 0;

    while (current && depth < 8) {
      parts.push(current.title);
      if (current.parent_id && itemsMap.has(current.parent_id)) {
        current = itemsMap.get(current.parent_id);
      } else break;
      depth++;
    }

    parts.reverse();
    if (taskTitle) parts.push(taskTitle);

    return parts.join(' / ');
  }, [itemsMap]);

  const toggleItemExpansion = (itemId: string) => {
    setExpandedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const handleToggleExpandAll = () => {
    if (expandedItemIds.size === items.length) {
      setExpandedItemIds(new Set());
    } else {
      setExpandedItemIds(new Set(items.map(i => i.id)));
    }
  };

  const { timelineStart, timelineEnd, timeColumns } = useMemo(() => {
    const start = new Date(baseDate);
    const end = new Date(baseDate);

    if (zoomLevel === 'days') {
      start.setDate(start.getDate() - 5);
      end.setDate(end.getDate() + 15);
    } else if (zoomLevel === 'weeks') {
      start.setDate(start.getDate() - 14);
      end.setDate(end.getDate() + 42);
    } else {
      start.setMonth(start.getMonth() - 1);
      start.setDate(1);
      end.setMonth(end.getMonth() + 4);
      end.setDate(28);
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const cols: Array<{ label: string; subLabel: string; date: Date; isToday: boolean }> = [];
    const curr = new Date(start);
    const now = new Date();

    while (curr <= end) {
      if (zoomLevel === 'days') {
        const isToday = curr.toDateString() === now.toDateString();
        cols.push({
          label: curr.toLocaleDateString('pt-BR', { weekday: 'short' }),
          subLabel: `${curr.getDate()}/${curr.getMonth() + 1}`,
          date: new Date(curr),
          isToday
        });
        curr.setDate(curr.getDate() + 1);
      } else if (zoomLevel === 'weeks') {
        const weekEnd = new Date(curr);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const isCurrent = now >= curr && now <= weekEnd;
        cols.push({
          label: `SEM ${Math.ceil(curr.getDate() / 7)}`,
          subLabel: `${curr.getDate()}/${curr.getMonth() + 1} - ${weekEnd.getDate()}/${weekEnd.getMonth() + 1}`,
          date: new Date(curr),
          isToday: isCurrent
        });
        curr.setDate(curr.getDate() + 7);
      } else {
        const isCurrentMonth = curr.getMonth() === now.getMonth() && curr.getFullYear() === now.getFullYear();
        cols.push({
          label: curr.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase(),
          subLabel: `${curr.getFullYear()}`,
          date: new Date(curr),
          isToday: isCurrentMonth
        });
        curr.setMonth(curr.getMonth() + 1);
      }
    }

    return { timelineStart: start, timelineEnd: end, timeColumns: cols };
  }, [baseDate, zoomLevel]);

  const handleShiftTime = (direction: 'prev' | 'next') => {
    const factor = direction === 'next' ? 1 : -1;
    const nextDate = new Date(baseDate);

    if (zoomLevel === 'days') nextDate.setDate(nextDate.getDate() + 7 * factor);
    else if (zoomLevel === 'weeks') nextDate.setDate(nextDate.getDate() + 14 * factor);
    else nextDate.setMonth(nextDate.getMonth() + 1 * factor);

    setBaseDate(nextDate);
  };

  const metrics = useMemo(() => {
    const nowStr = new Date().toISOString().split('T')[0];
    let completed = 0;
    let delayed = 0;
    let inProgress = 0;
    let unassigned = 0;

    tasks.forEach(t => {
      const isDone = t.status === 'concluida';
      const isLate = !isDone && t.due_date && t.due_date < nowStr;

      if (isDone) completed += 1;
      else if (isLate) delayed += 1;
      else if (!t.due_date && !t.start_date) unassigned += 1;
      else inProgress += 1;
    });

    return { total: tasks.length, completed, delayed, inProgress, unassigned };
  }, [tasks]);

  const getItemEffectiveDates = (item: WorkItem) => {
    if (item.start_date || item.due_date) return { start: item.start_date, due: item.due_date };
    const itemTasks = tasks.filter(t => t.work_item_id === item.id && (t.start_date || t.due_date));
    if (itemTasks.length === 0) return { start: null, due: null };

    const starts = itemTasks.map(t => t.start_date || t.due_date).filter(Boolean) as string[];
    const dues = itemTasks.map(t => t.due_date || t.start_date).filter(Boolean) as string[];
    starts.sort();
    dues.sort();

    return { start: starts[0] || null, due: dues[dues.length - 1] || null };
  };

  const getBarCoordinates = (startStr?: string | null, dueStr?: string | null) => {
    if (!startStr && !dueStr) return null;
    const totalDuration = timelineEnd.getTime() - timelineStart.getTime();
    if (totalDuration <= 0) return null;

    const s = startStr ? new Date(startStr + 'T00:00:00') : (dueStr ? new Date(dueStr + 'T00:00:00') : new Date());
    const d = dueStr ? new Date(dueStr + 'T23:59:59') : new Date(s.getTime() + 86400000);

    const leftPercent = Math.max(0, Math.min(100, ((s.getTime() - timelineStart.getTime()) / totalDuration) * 100));
    const rightPercent = Math.max(0, Math.min(100, ((d.getTime() - timelineStart.getTime()) / totalDuration) * 100));
    const widthPercent = Math.max(2.5, rightPercent - leftPercent);

    return { left: `${leftPercent}%`, width: `${widthPercent}%` };
  };

  const todayPosition = useMemo(() => {
    const now = new Date();
    const totalDuration = timelineEnd.getTime() - timelineStart.getTime();
    if (now < timelineStart || now > timelineEnd || totalDuration <= 0) return null;
    return `${((now.getTime() - timelineStart.getTime()) / totalDuration) * 100}%`;
  }, [timelineStart, timelineEnd]);

  const scheduleTree = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    const nowStr = new Date().toISOString().split('T')[0];

    const itemsWithTasks: (WorkItem & { filteredTasks: WorkTask[] })[] = items.map(item => {
      const itemTasks = tasks.filter(t => t.work_item_id === item.id);

      const filteredTasks = itemTasks.filter(t => {
        if (filterSubitemType !== 'all' && t.task_type !== filterSubitemType) return false;
        if (filterExecutor !== 'all' && (!t.executed_by || !t.executed_by.includes(filterExecutor))) return false;

        const matchesSearch = q === '' || t.title.toLowerCase().includes(q) || (t.task_type && t.task_type.toLowerCase().includes(q));

        let matchesStatus = true;
        const isDone = t.status === 'concluida';
        const isBlocked = t.status === 'bloqueada';
        const isLate = !isDone && t.due_date && t.due_date < nowStr;
        const isUnassigned = !t.due_date && !t.start_date;

        if (filterStatus === 'concluida') matchesStatus = isDone;
        else if (filterStatus === 'em_andamento') matchesStatus = (!isDone && !isBlocked && !isLate && !isUnassigned);
        else if (filterStatus === 'atrasadas') matchesStatus = isLate;
        else if (filterStatus === 'sem_prazo') matchesStatus = isUnassigned;
        else if (filterStatus === 'bloqueada') matchesStatus = isBlocked;

        return matchesSearch && matchesStatus;
      });

      return {
        ...item,
        filteredTasks: filterStatus === 'all' && filterSubitemType === 'all' && filterExecutor === 'all' && q === '' ? itemTasks : filteredTasks
      };
    });

    const buildNode = (parentId: string | null = null): any[] => {
      return itemsWithTasks
        .filter(item => (item.parent_id || null) === parentId)
        .map(item => {
          const children = buildNode(item.id);
          const matchesItemSearch = q === '' || item.title.toLowerCase().includes(q) || (item.code && item.code.toLowerCase().includes(q));
          const matchesType = filterItemType === 'all' || item.item_type === filterItemType;
          const matchesLoc = filterLocation === 'all' || item.location === filterLocation;

          const hasMatchingTasks = item.filteredTasks.length > 0;
          const hasMatchingChildren = children.length > 0;

          if ((matchesItemSearch && matchesType && matchesLoc) || hasMatchingTasks || hasMatchingChildren) {
            return { ...item, children };
          }
          return null;
        })
        .filter(Boolean);
    };

    return buildNode(null);
  }, [items, tasks, searchTerm, filterStatus, filterItemType, filterSubitemType, filterLocation, filterExecutor]);

  const activeFiltersCount = 
    (filterStatus !== 'all' ? 1 : 0) + 
    (filterItemType !== 'all' ? 1 : 0) + 
    (filterSubitemType !== 'all' ? 1 : 0) +
    (filterLocation !== 'all' ? 1 : 0) +
    (filterExecutor !== 'all' ? 1 : 0);

  const handleSaveQuickDates = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionTarget || !permissions.canEditSchedule) return;

    try {
      setSavingQuickDates(true);
      const table = actionTarget.type === 'item' ? 'work_items' : 'work_tasks';

      const { error } = await supabase
        .from(table)
        .update({ start_date: quickStartDate || null, due_date: quickDueDate || null })
        .eq('id', actionTarget.id);

      if (error) throw error;
      setIsDatesModalOpen(false);
      setActionTarget(null);
      await loadScheduleData();
    } catch (err: any) {
      alert('Erro ao salvar prazo: ' + err.message);
    } finally {
      setSavingQuickDates(false);
    }
  };

  const handleSaveDependency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionTarget || !permissions.canEditSchedule) return;

    try {
      setSavingDependency(true);
      const table = actionTarget.type === 'item' ? 'work_items' : 'work_tasks';
      const col = actionTarget.type === 'item' ? 'depends_on_item_id' : 'depends_on_task_id';

      const { error } = await supabase.from(table).update({ [col]: selectedDependencyId || null }).eq('id', actionTarget.id);
      if (error) throw error;

      setIsDependencyModalOpen(false);
      setActionTarget(null);
      await loadScheduleData();
    } catch (err: any) {
      alert('Erro ao salvar dependência: ' + err.message);
    } finally {
      setSavingDependency(false);
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
      await loadScheduleData();
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
      await loadScheduleData();
    } catch (err: any) {
      alert('Erro ao desbloquear tarefa: ' + err.message);
    }
  };

  const handleToggleTaskStatus = async (task: WorkTask, item: WorkItem) => {
    setActionTarget(null);
    if (task.status === 'bloqueada') return;

    const isDone = task.status === 'concluida';
    if (isDone) {
      if (!permissions.canReopenWorkTasks) {
        alert('Seu perfil não possui permissão para reabrir tarefas.');
        return;
      }
      try {
        await supabase.from('work_tasks').update({ status: 'pendente', quantity_executed: 0, executed_by: [], completed_at: null }).eq('id', task.id);
        await supabase.from('work_task_entries').delete().eq('work_task_id', task.id);
        await loadScheduleData();
      } catch (err) {
        console.error(err);
      }
    } else {
      if (!permissions.canCompleteWorkTasks) return;
      
      setCompletingTask({ item, task });
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

  const handleConfirmTaskCompletion = async () => {
    if (!completingTask || !permissions.canCompleteWorkTasks) return;
    try {
      setIsSavingEntry(true);
      const companyId = user?.company?.id;
      if (!companyId) return;

      const parsedQty = parseFloat(entryQty.replace(',', '.'));
      if (isNaN(parsedQty) || (parsedQty <= 0 && checklistAction === 'complete')) {
        alert('Para concluir, a quantidade executada deve ser maior que zero.');
        return;
      }

      const { error } = await supabase
        .from('work_task_entries')
        .insert({
          company_id: companyId,
          work_id: workId,
          work_item_id: completingTask.item.id,
          work_task_id: completingTask.task.id,
          entry_date: entryDate,
          quantity_executed: parsedQty,
          team_id: null,
          executed_by: selectedExecutors,
          notes: entryNotes || null,
          created_by: user?.profile?.id || null,
        });

      if (error) throw error;

      setCompletingTask(null);
      setSelectedExecutors([]);
      await loadScheduleData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingEntry(false);
    }
  };

  const toggleExecutor = (memberName: string) => {
    if (!permissions.canAssignExecutors) return;
    setSelectedExecutors(prev => prev.includes(memberName) ? prev.filter(m => m !== memberName) : [...prev, memberName]);
  };

  if (!loadingPerms && !permissions.canViewSchedule) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50/50 rounded-2xl border border-slate-200">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3 border border-slate-200">
          <CalendarRange size={22} />
        </div>
        <h4 className="font-bold text-slate-800 text-sm mb-1">Acesso Restrito ao Cronograma</h4>
        <p className="text-xs text-slate-500 max-w-sm">
          Seu perfil de acesso atual não possui permissão para visualizar o cronograma operacional desta obra.
        </p>
      </div>
    );
  }

  const renderScheduleTree = (node: any, depth = 0): React.ReactNode => {
    const isExpanded = expandedItemIds.has(node.id);
    const hasChildren = (node.children && node.children.length > 0) || (node.filteredTasks && node.filteredTasks.length > 0);
    const itemTasks: WorkTask[] = node.filteredTasks || [];
    const doneTasks = itemTasks.filter(t => t.status === 'concluida').length;
    const itemProgress = itemTasks.length > 0 ? Math.round((doneTasks / itemTasks.length) * 100) : node.progress_percent || 0;
    const effectiveDates = getItemEffectiveDates(node);
    const itemBar = getBarCoordinates(effectiveDates.start, effectiveDates.due);

    const depItem = node.depends_on_item_id ? itemsMap.get(node.depends_on_item_id) : null;
    const isItemBlocked = depItem ? (depItem.progress_percent || 0) < 100 : false;

    return (
      <React.Fragment key={node.id}>
        {/* LINHA DO ITEM / COMPONENTE MACRO (h-11 = 44px) */}
        <div className={`flex items-center hover:bg-slate-50/70 transition border-b border-slate-200/60 ${depth === 0 ? 'bg-slate-50/50 font-bold' : 'bg-white'}`}>
          <div
            style={{ paddingLeft: `${16 + depth * 20}px` }}
            className="w-72 sm:w-80 h-11 p-2 pr-4 border-r border-slate-200 shrink-0 flex items-center justify-between gap-2 min-w-0"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => toggleItemExpansion(node.id)}
                  className="p-1 hover:bg-slate-200/70 text-slate-500 rounded-lg transition cursor-pointer shrink-0"
                >
                  {isExpanded ? <ChevronDown size={15} /> : <ChevronRightIcon size={15} />}
                </button>
              ) : (
                <span className="w-5 shrink-0" />
              )}

              <div
                onClick={() => {
                  if (!permissions.canEditSchedule) return;
                  setActionTarget({
                    id: node.id,
                    title: node.title,
                    type: 'item',
                    start: effectiveDates.start,
                    due: effectiveDates.due,
                    dependsOnId: node.depends_on_item_id,
                    isBlocked: isItemBlocked,
                    dependencyTitle: depItem?.title,
                    itemRef: node
                  });
                }}
                className={`flex items-center gap-2 min-w-0 group/title truncate ${permissions.canEditSchedule ? 'cursor-pointer' : 'cursor-default'}`}
              >
                {isItemBlocked ? (
                  <Lock size={14} className="text-amber-500 shrink-0" />
                ) : (
                  <Layers size={14} className="text-sky-600 shrink-0 group-hover/title:scale-110 transition-transform" />
                )}
                <span className={`text-xs truncate ${isItemBlocked ? 'text-amber-900 font-bold' : 'text-slate-900 group-hover/title:text-sky-700'}`}>
                  {node.title}
                </span>
                {node.code && (
                  <span className="font-mono text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold border shrink-0">
                    {node.code}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                {itemProgress}%
              </span>
            </div>
          </div>

          <div
            onClick={() => {
              if (!permissions.canEditSchedule) return;
              setActionTarget({
                id: node.id,
                title: node.title,
                type: 'item',
                start: effectiveDates.start,
                due: effectiveDates.due,
                dependsOnId: node.depends_on_item_id,
                isBlocked: isItemBlocked,
                dependencyTitle: depItem?.title,
                itemRef: node
              });
            }}
            className={`flex-1 h-11 relative flex items-center overflow-hidden ${permissions.canEditSchedule ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <div className="absolute inset-0 flex pointer-events-none">
              {timeColumns.map((col, idx) => (
                <div key={idx} className={`flex-1 min-w-[65px] border-r border-slate-100 last:border-r-0 h-full ${col.isToday ? 'bg-sky-50/30' : ''}`} />
              ))}
            </div>

            {todayPosition && (
              <div className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-20 pointer-events-none" style={{ left: todayPosition }} />
            )}

            {itemBar && (
              <div
                className={`absolute h-6 rounded-lg shadow-2xs flex items-center px-2.5 z-10 overflow-hidden hover:opacity-90 transition ${
                  isItemBlocked ? 'bg-amber-800' : depth === 0 ? 'bg-slate-900' : 'bg-slate-700'
                }`}
                style={{ left: itemBar.left, width: itemBar.width }}
              >
                <div
                  className={`absolute left-0 top-0 bottom-0 transition-all duration-300 ${isItemBlocked ? 'bg-amber-500/80' : 'bg-sky-500/80'}`}
                  style={{ width: `${itemProgress}%` }}
                />
                <span className="relative z-10 text-[10px] font-bold text-white truncate drop-shadow-xs flex items-center gap-1.5">
                  {isItemBlocked && <Lock size={10} />}
                  <span>{node.title}</span>
                </span>
              </div>
            )}
          </div>
        </div>

        {isExpanded && (
          <>
            {node.children && node.children.map((child: any) => renderScheduleTree(child, depth + 1))}

            {itemTasks.map(task => {
              const isDone = task.status === 'concluida';
              const isInProgress = task.status === 'em_andamento';
              const isTaskBlockedManual = task.status === 'bloqueada';
              const nowStr = new Date().toISOString().split('T')[0];
              const isLate = !isDone && task.due_date && task.due_date < nowStr;
              
              // Barra gerada com base nas datas da própria tarefa (independente do item pai)
              const taskBar = getBarCoordinates(task.start_date, task.due_date);

              const depTask = task.depends_on_task_id ? tasks.find(t => t.id === task.depends_on_task_id) : null;
              const isBlockedByDependency = (depTask && depTask.status !== 'concluida') || isItemBlocked;

              return (
                <div key={task.id} className="flex items-center hover:bg-slate-50 transition border-b border-slate-100">
                  {/* CÉLULA DE INFORMAÇÕES DA TAREFA (SEM CHECKBOX AVULSO QUE CAUSAVA ERRO) */}
                  <div
                    style={{ paddingLeft: `${36 + depth * 20}px` }}
                    className="w-72 sm:w-80 h-9 p-2 pr-3 border-r border-slate-200 shrink-0 flex items-center justify-between gap-2 min-w-0"
                  >
                    <div
                      onClick={() => {
                        setActionTarget({
                          id: task.id,
                          title: task.title,
                          type: 'task',
                          start: task.start_date,
                          due: task.due_date,
                          status: task.status,
                          dependsOnId: task.depends_on_task_id,
                          isBlocked: isBlockedByDependency,
                          dependencyTitle: depTask?.title || depItem?.title,
                          itemRef: node,
                          taskRef: task
                        });
                      }}
                      className="flex items-center gap-2 min-w-0 cursor-pointer flex-1 group"
                    >
                      {/* Ícone de Estado Visual */}
                      <div className="shrink-0">
                        {isTaskBlockedManual ? (
                          <ShieldAlert size={15} className="text-rose-600" />
                        ) : isBlockedByDependency ? (
                          <Lock size={14} className="text-amber-500" />
                        ) : isDone ? (
                          <CheckCircle2 size={15} className="text-emerald-600" />
                        ) : isInProgress ? (
                          <PlayCircle size={15} className="text-sky-500" />
                        ) : (
                          <Square size={15} className="text-slate-300 group-hover:text-slate-500" />
                        )}
                      </div>

                      <span className={`text-xs truncate transition-colors ${
                        isDone 
                          ? 'line-through text-slate-400' 
                          : isTaskBlockedManual 
                          ? 'text-rose-900 font-bold' 
                          : 'font-semibold text-slate-800 group-hover:text-sky-600'
                      }`}>
                        {task.title}
                      </span>
                    </div>

                    {task.due_date && (
                      <span className={`text-[10px] font-medium shrink-0 ${isLate ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                        {new Date(task.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>

                  {/* ÁREA DO GANTT DA TAREFA (h-9 = 36px) */}
                  <div
                    onClick={() => {
                      setActionTarget({
                        id: task.id,
                        title: task.title,
                        type: 'task',
                        start: task.start_date,
                        due: task.due_date,
                        status: task.status,
                        dependsOnId: task.depends_on_task_id,
                        isBlocked: isBlockedByDependency,
                        dependencyTitle: depTask?.title || depItem?.title,
                        itemRef: node,
                        taskRef: task
                      });
                    }}
                    className={`flex-1 h-9 relative flex items-center overflow-hidden ${permissions.canEditSchedule ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <div className="absolute inset-0 flex pointer-events-none">
                      {timeColumns.map((col, idx) => (
                        <div key={idx} className={`flex-1 min-w-[65px] border-r border-slate-100 last:border-r-0 h-full ${col.isToday ? 'bg-sky-50/20' : ''}`} />
                      ))}
                    </div>

                    {todayPosition && (
                      <div className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-20 pointer-events-none" style={{ left: todayPosition }} />
                    )}

                    {taskBar && (
                      <div
                        className={`absolute h-5 rounded-md shadow-2xs z-10 flex items-center px-2 transition hover:opacity-90 ${
                          isDone 
                            ? 'bg-emerald-500 text-white' 
                            : isTaskBlockedManual 
                            ? 'bg-rose-500 text-white' 
                            : isBlockedByDependency 
                            ? 'bg-amber-500 text-white' 
                            : isLate 
                            ? 'bg-rose-500 text-white animate-pulse' 
                            : 'bg-sky-500 text-white'
                        }`}
                        style={{ left: taskBar.left, width: taskBar.width }}
                      >
                        <span className="text-[9px] font-bold truncate drop-shadow-xs flex items-center gap-1">
                          {isTaskBlockedManual ? <ShieldAlert size={9} /> : isBlockedByDependency ? <Lock size={9} /> : null}
                          <span>{task.title}</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </React.Fragment>
    );
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full text-slate-400 text-xs py-20">
        <Loader2 size={24} className="animate-spin text-sky-600 mb-2" />
        <span className="font-semibold text-slate-600">Sincronizando cronograma operacional...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-3 select-none pb-4">
      
      {/* ======================================================== */}
      {/* 1. BARRA SUPERIOR DE CONTROLE (ORGANIZADA EM 2 LINHAS) */}
      {/* ======================================================== */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 shadow-2xs space-y-3 shrink-0">
        
        {/* LINHA 1: CARDS DE MÉTRICAS */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
          <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tarefas</span>
            <strong className="text-slate-900 text-xs font-black">{metrics.total}</strong>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-200/80 px-3 py-1.5 rounded-xl flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 size={12} />
              <span>Concluídas</span>
            </span>
            <strong className="text-emerald-900 text-xs font-black">
              {metrics.completed} ({metrics.total > 0 ? Math.round((metrics.completed / metrics.total) * 100) : 0}%)
            </strong>
          </div>

          <div className="bg-sky-50/70 border border-sky-200/80 px-3 py-1.5 rounded-xl flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-sky-700 font-bold uppercase tracking-wider flex items-center gap-1">
              <Clock size={12} />
              <span>Em Execução</span>
            </span>
            <strong className="text-sky-900 text-xs font-black">{metrics.inProgress}</strong>
          </div>

          <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 shrink-0 transition ${
            metrics.delayed > 0 
              ? 'bg-rose-50 border-rose-200 text-rose-900 font-bold shadow-2xs' 
              : 'bg-slate-50/80 border-slate-200/80 text-slate-600'
          }`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${metrics.delayed > 0 ? 'text-rose-700' : 'text-slate-400'}`}>
              <AlertTriangle size={12} />
              <span>Atrasadas</span>
            </span>
            <strong className={`text-xs font-black ${metrics.delayed > 0 ? 'text-rose-900' : 'text-slate-800'}`}>
              {metrics.delayed}
            </strong>
          </div>

          {metrics.unassigned > 0 && (
            <div className="bg-amber-50/70 border border-amber-200/80 px-3 py-1.5 rounded-xl flex items-center gap-2 shrink-0">
              <span className="text-[10px] text-amber-700 font-bold uppercase tracking-wider flex items-center gap-1">
                <CalendarRange size={12} />
                <span>Sem Prazos</span>
              </span>
              <strong className="text-amber-900 text-xs font-black">{metrics.unassigned}</strong>
            </div>
          )}
        </div>

        {/* LINHA 2: BUSCA | FILTRO | ZOOM | NAVEGAÇÃO TEMPORAL */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
          
          {/* Lado Esquerdo: Campo de Busca e Botão de Filtro */}
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar no cronograma..."
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 transition text-slate-800 placeholder-slate-400 shadow-2xs font-medium"
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

            {/* Botão de Filtro */}
            <button
              ref={filterButtonRef}
              type="button"
              onClick={handleToggleFilterPopover}
              title="Filtrar cronograma"
              className={`p-2 border rounded-xl transition cursor-pointer shadow-2xs flex items-center justify-center relative shrink-0 ${
                activeFiltersCount > 0
                  ? 'bg-sky-50 border-sky-300 text-sky-700 font-bold'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Filter size={15} />
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-sky-600 text-white text-[9px] flex items-center justify-center font-bold shadow-2xs">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>

          {/* Lado Direito: Controles do Cronograma (Zoom + Navegação) */}
          <div className="flex items-center gap-2 justify-end shrink-0">
            {/* Seletor de Zoom */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setZoomLevel('days')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer text-xs ${
                  zoomLevel === 'days' ? 'bg-white text-sky-700 font-bold shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Dias
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel('weeks')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer text-xs ${
                  zoomLevel === 'weeks' ? 'bg-white text-sky-700 font-bold shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Semanas
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel('months')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer text-xs ${
                  zoomLevel === 'months' ? 'bg-white text-sky-700 font-bold shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Meses
              </button>
            </div>

            {/* Navegador de Data */}
            <div className="flex items-center gap-0.5 bg-white border border-slate-200 p-0.5 rounded-xl shadow-2xs">
              <button
                type="button"
                onClick={() => handleShiftTime('prev')}
                className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                title="Retroceder período"
              >
                <ChevronLeft size={16} />
              </button>

              <button
                type="button"
                onClick={() => setBaseDate(new Date())}
                className="px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Hoje
              </button>

              <button
                type="button"
                onClick={() => handleShiftTime('next')}
                className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                title="Avançar período"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* ======================================================== */}
      {/* POPOVER FLUTUANTE DE FILTROS (VIA PORTAL) */}
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
              <span>Filtros do Cronograma</span>
            </span>
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setFilterStatus('all');
                  setFilterItemType('all');
                  setFilterSubitemType('all');
                  setFilterLocation('all');
                  setFilterExecutor('all');
                }}
                className="text-[11px] text-sky-600 hover:underline font-semibold cursor-pointer"
              >
                Limpar Todos
              </button>
            )}
          </div>

          <div className="space-y-2.5 max-h-[70vh] overflow-y-auto pr-0.5">
            {/* 1. Situação Operacional */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1 text-[11px]">Situação Operacional</label>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value as any)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium cursor-pointer text-xs focus:ring-2 focus:ring-sky-500"
              >
                <option value="all">Todas as Atividades</option>
                <option value="em_andamento">Liberadas para Execução</option>
                <option value="bloqueada">Restrição (Bloqueadas)</option>
                <option value="concluida">Concluídas</option>
                <option value="atrasadas">Atrasadas</option>
                <option value="sem_prazo">Sem Prazos Definidos</option>
              </select>
            </div>

            {/* 2. Local no Canteiro */}
            {locationOptions.length > 0 && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[11px]">Local no Canteiro</label>
                <select
                  value={filterLocation}
                  onChange={e => setFilterLocation(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium cursor-pointer text-xs focus:ring-2 focus:ring-sky-500"
                >
                  <option value="all">Todos os Locais</option>
                  {locationOptions.map(l => (
                    <option key={l.id} value={l.name}>{l.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* 3. Tipo de Item */}
            {itemTypeOptions.length > 0 && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[11px]">Tipo de Item</label>
                <select
                  value={filterItemType}
                  onChange={e => setFilterItemType(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium cursor-pointer text-xs focus:ring-2 focus:ring-sky-500"
                >
                  <option value="all">Todos os Tipos de Item</option>
                  {itemTypeOptions.map(t => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* 4. Tipo de Subitem */}
            {subitemTypeOptions.length > 0 && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[11px]">Tipo de Subitem / Tarefa</label>
                <select
                  value={filterSubitemType}
                  onChange={e => setFilterSubitemType(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium cursor-pointer text-xs focus:ring-2 focus:ring-sky-500"
                >
                  <option value="all">Todos os Tipos de Tarefa</option>
                  {subitemTypeOptions.map(st => (
                    <option key={st.id} value={st.name}>{st.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* 5. Executor */}
            {teamMembers.length > 0 && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[11px]">Executor Alocado</label>
                <select
                  value={filterExecutor}
                  onChange={e => setFilterExecutor(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium cursor-pointer text-xs focus:ring-2 focus:ring-sky-500"
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
      {/* 2. GRADE GANTT RECURSIVA (COM LINHAS DE TAMANHO ADEQUADO) */}
      {/* ======================================================== */}
      <div className="flex-1 min-h-0 bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-auto flex flex-col">
          <div className="min-w-[850px] flex-1 flex flex-col">
            
            {/* Cabeçalho da Grade */}
            <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 shrink-0 sticky top-0 z-30">
              
              <div className="w-72 sm:w-80 p-3 px-4 border-r border-slate-200 shrink-0 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleExpandAll}
                    className="p-1 bg-white hover:bg-slate-200 text-slate-600 rounded-lg border border-slate-200 shadow-2xs transition cursor-pointer"
                    title={expandedItemIds.size === items.length ? 'Recolher toda a árvore' : 'Expandir toda a árvore'}
                  >
                    {expandedItemIds.size === items.length ? (
                      <ChevronsUp size={14} />
                    ) : (
                      <ChevronsDown size={14} />
                    )}
                  </button>
                  <span className="uppercase text-[10px] text-slate-400 tracking-wider">Estrutura (EAP)</span>
                </div>
                <span className="text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                  {items.length} itens
                </span>
              </div>

              <div className="flex-1 flex overflow-hidden">
                {timeColumns.map((col, idx) => (
                  <div
                    key={idx}
                    className={`flex-1 min-w-[65px] p-2 text-center border-r border-slate-200/70 last:border-r-0 truncate transition ${
                      col.isToday ? 'bg-sky-50/90 border-b-2 border-b-sky-500' : ''
                    }`}
                  >
                    <span className={`block text-[10px] uppercase tracking-tight ${col.isToday ? 'text-sky-700 font-black' : 'text-slate-400'}`}>
                      {col.label}
                    </span>
                    <span className={`block text-[11px] font-black ${col.isToday ? 'text-sky-950 font-black' : 'text-slate-700'}`}>
                      {col.subLabel}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Linhas da Árvore */}
            <div className="flex-1 divide-y divide-slate-100">
              {scheduleTree.length === 0 ? (
                <div className="p-16 text-center text-xs text-slate-400">
                  Nenhuma atividade corresponde aos filtros atuais.
                </div>
              ) : (
                scheduleTree.map(rootNode => renderScheduleTree(rootNode, 0))
              )}
            </div>

          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* POPUP FLUTUANTE DE AÇÕES RÁPIDAS AO CLICAR EM ITEM OU SUBITEM */}
      {/* ======================================================== */}
      {actionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/50 backdrop-blur-2xs animate-in fade-in duration-100">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-3.5 animate-in zoom-in-95 duration-100 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 min-w-0">
                {actionTarget.status === 'bloqueada' ? (
                  <ShieldAlert size={16} className="text-rose-600 shrink-0" />
                ) : actionTarget.isBlocked ? (
                  <Lock size={16} className="text-amber-500 shrink-0" />
                ) : actionTarget.type === 'item' ? (
                  <Layers size={16} className="text-sky-600 shrink-0" />
                ) : (
                  <CheckSquare size={16} className="text-sky-600 shrink-0" />
                )}
                <h4 className="font-bold text-slate-900 text-sm truncate">{actionTarget.title}</h4>
              </div>
              <button
                type="button"
                onClick={() => setActionTarget(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {actionTarget.status === 'bloqueada' && actionTarget.taskRef?.blocked_reason && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2">
                <ShieldAlert size={14} className="text-rose-600 shrink-0 mt-0.5" />
                <span className="leading-snug">
                  <strong>Restrição Manual:</strong> {actionTarget.taskRef.blocked_reason}
                </span>
              </div>
            )}

            {actionTarget.isBlocked && actionTarget.dependencyTitle && actionTarget.status !== 'bloqueada' && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-start gap-2">
                <Lock size={14} className="text-amber-600 shrink-0 mt-0.5" />
                <span className="leading-snug">
                  Atividade bloqueada por dependência. Aguardando a conclusão de: <strong>{actionTarget.dependencyTitle}</strong>.
                </span>
              </div>
            )}

            <div className="space-y-1.5 text-xs">
              {permissions.canEditSchedule && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setQuickStartDate(actionTarget.start || '');
                      setQuickDueDate(actionTarget.due || '');
                      setIsDatesModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-sky-50 text-slate-700 font-semibold transition cursor-pointer text-left"
                  >
                    <CalendarRange size={16} className="text-sky-600 shrink-0" />
                    <div>
                      <span className="block text-slate-900 font-bold">Definir / Alterar Prazos</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {actionTarget.due ? `Até ${new Date(actionTarget.due + 'T00:00:00').toLocaleDateString('pt-BR')}` : 'Sem prazo definido'}
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDependencyId(actionTarget.dependsOnId || '');
                      setIsDependencyModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-sky-50 text-slate-700 font-semibold transition cursor-pointer text-left"
                  >
                    <Link2 size={16} className="text-sky-600 shrink-0" />
                    <div>
                      <span className="block text-slate-900 font-bold">Vincular Dependência</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {actionTarget.dependencyTitle ? `Vinculado a: ${actionTarget.dependencyTitle}` : 'Livre para execução (sem travas)'}
                      </span>
                    </div>
                  </button>
                </>
              )}

              {actionTarget.type === 'task' && actionTarget.taskRef && actionTarget.itemRef && (
                <>
                  {/* AÇÕES DE BLOQUEIO / DESBLOQUEIO */}
                  {actionTarget.status === 'bloqueada' ? (
                    <button
                      type="button"
                      onClick={() => {
                        handleUnblockTask(actionTarget.taskRef!);
                        setActionTarget(null);
                      }}
                      className="w-full flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-emerald-50 text-emerald-700 font-semibold transition cursor-pointer text-left"
                    >
                      <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                      <div>
                        <span className="block font-bold">Desbloquear Tarefa (Liberar)</span>
                        <span className="text-[10px] text-emerald-600/70 font-normal">Remover restrição e permitir execução</span>
                      </div>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setBlockingTask(actionTarget.taskRef!);
                        setActionTarget(null);
                      }}
                      className="w-full flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-amber-50 text-amber-700 font-semibold transition cursor-pointer text-left"
                    >
                      <ShieldAlert size={16} className="text-amber-600 shrink-0" />
                      <div>
                        <span className="block font-bold">Bloquear (Com Restrição)</span>
                        <span className="text-[10px] text-amber-600/70 font-normal">Marcar impedimentos operacionais</span>
                      </div>
                    </button>
                  )}

                  {/* AÇÕES DE CONCLUSÃO */}
                  {actionTarget.status !== 'bloqueada' && (
                    <button
                      type="button"
                      disabled={
                        actionTarget.isBlocked ||
                        (actionTarget.status === 'concluida' ? !permissions.canReopenWorkTasks : !permissions.canCompleteWorkTasks)
                      }
                      onClick={() => handleToggleTaskStatus(actionTarget.taskRef!, actionTarget.itemRef!)}
                      className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl font-semibold transition text-left ${
                        actionTarget.isBlocked || (actionTarget.status === 'concluida' ? !permissions.canReopenWorkTasks : !permissions.canCompleteWorkTasks)
                          ? 'opacity-50 cursor-not-allowed bg-slate-50 text-slate-400'
                          : actionTarget.status === 'concluida'
                          ? 'hover:bg-amber-50 text-amber-700 cursor-pointer'
                          : 'hover:bg-emerald-50 text-emerald-700 cursor-pointer'
                      }`}
                    >
                      {actionTarget.status === 'concluida' ? (
                        <>
                          <Clock size={16} className="text-amber-600 shrink-0" />
                          <div>
                            <span className="block font-bold">Reabrir Tarefa</span>
                            <span className="text-[10px] text-slate-400 font-normal">Voltar para pendente</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                          <div>
                            <span className="block font-bold">Apontar / Concluir Tarefa</span>
                            <span className="text-[10px] text-slate-400 font-normal">Registrar avanço no diário de obra</span>
                          </div>
                        </>
                      )}
                    </button>
                  )}
                </>
              )}

              {permissions.canEditSchedule && (actionTarget.start || actionTarget.due) && (
                <button
                  type="button"
                  onClick={async () => {
                    const table = actionTarget.type === 'item' ? 'work_items' : 'work_tasks';
                    await supabase.from(table).update({ start_date: null, due_date: null }).eq('id', actionTarget.id);
                    setActionTarget(null);
                    await loadScheduleData();
                  }}
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-rose-50 text-rose-600 font-semibold transition cursor-pointer text-left"
                >
                  <Trash2 size={16} className="text-rose-500 shrink-0" />
                  <div>
                    <span className="block font-bold">Limpar Prazos</span>
                    <span className="text-[10px] text-slate-400 font-normal">Remover datas desta atividade</span>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: AJUSTE RÁPIDO DE PRAZO */}
      {isDatesModalOpen && actionTarget && permissions.canEditSchedule && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CalendarRange size={18} className="text-sky-600" />
                <h4 className="font-bold text-slate-900 text-sm">Definir Prazos</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsDatesModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">
                {actionTarget.type === 'item' ? 'Componente' : 'Subitem / Tarefa'}
              </span>
              <p className="text-xs font-bold text-slate-800 truncate">{actionTarget.title}</p>
            </div>

            <form onSubmit={handleSaveQuickDates} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Data de Início</label>
                <input
                  type="date"
                  value={quickStartDate}
                  onChange={e => setQuickStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-sky-500 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Data de Conclusão / Término</label>
                <input
                  type="date"
                  value={quickDueDate}
                  min={quickStartDate || undefined}
                  onChange={e => setQuickDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-sky-500 text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDatesModalOpen(false)}
                  className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingQuickDates}
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold shadow-xs flex items-center gap-1 cursor-pointer"
                >
                  {savingQuickDates ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>Salvar Prazo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VINCULAR DEPENDÊNCIA */}
      {isDependencyModalOpen && actionTarget && permissions.canEditSchedule && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Link2 size={18} className="text-sky-600" />
                <h4 className="font-bold text-slate-900 text-sm">Vincular Dependência</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsDependencyModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Travar Atividade</span>
              <p className="text-xs font-bold text-slate-800 truncate">
                {actionTarget.type === 'item' 
                  ? getHierarchyBreadcrumb(actionTarget.id) 
                  : getHierarchyBreadcrumb(actionTarget.taskRef?.work_item_id, actionTarget.title)}
              </p>
            </div>

            <form onSubmit={handleSaveDependency} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Aguardar a conclusão prévia de:
                </label>
                <select
                  value={selectedDependencyId}
                  onChange={e => setSelectedDependencyId(e.target.value)}
                  className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium cursor-pointer text-xs"
                >
                  <option value="">Sem dependência (Livre para iniciar)</option>
                  {actionTarget.type === 'item'
                    ? items
                        .filter(i => i.id !== actionTarget.id)
                        .map(i => (
                          <option key={i.id} value={i.id}>
                            {getHierarchyBreadcrumb(i.id)} {i.code ? `(${i.code})` : ''}
                          </option>
                        ))
                    : tasks
                        .filter(t => t.id !== actionTarget.id)
                        .map(t => (
                          <option key={t.id} value={t.id}>
                            {getHierarchyBreadcrumb(t.work_item_id, t.title)}
                          </option>
                        ))}
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDependencyModalOpen(false)}
                  className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingDependency}
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold shadow-xs flex items-center gap-1 cursor-pointer"
                >
                  {savingDependency ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>Salvar Trava</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                                member.name.charAt(0).toUpperCase()
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
                onClick={handleConfirmTaskCompletion}
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

    </div>
  );
};

export default WorkScheduleTab;