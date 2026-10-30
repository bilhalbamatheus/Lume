import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { WorkSchedulePrintModal } from './WorkSchedulePrintModal';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Loader2,
  CalendarRange,
  X,
  Save,
  Search,
  Filter,
  Trash2,
  Link2,
  UserCheck,
  PlayCircle,
  ShieldAlert,
  ShieldCheck,
  Printer,
  CalendarCheck2,
  Zap,
  ListOrdered,
  Kanban,
  ArrowUpDown,
  Check,
  Minus} from 'lucide-react';

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

interface WorkScheduleTabProps {
  workId: string;
  workTitle?: string;
  workCode?: string | null;
}

type ZoomLevel = 'days' | 'weeks' | 'months';
type SortOption = 'due_date' | 'title' | 'status' | 'hierarchy';

export const WorkScheduleTab: React.FC<WorkScheduleTabProps> = ({ 
  workId,
  workTitle = 'Obra',
  workCode
}) => {
  const { user } = useAuth();
  const { permissions, loading: loadingPerms } = usePermissions();


  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<WorkItem[]>([]);
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // Dados da obra para validação de Técnico/Comercial
  const [, setWorkData] = useState<{ assigned_to?: string | null; commercial_owner_id?: string | null } | null>(null);

  // Configurações dos Filtros
  const [itemTypeOptions, setItemTypeOptions] = useState<SettingOption[]>([]);
  const [subitemTypeOptions, setSubitemTypeOptions] = useState<SettingOption[]>([]);
  const [locationOptions, setLocationOptions] = useState<SettingOption[]>([]);

  // Modos de Visualização & Ordenação
  const [viewMode, setViewMode] = useState<'gantt' | 'list'>('gantt');
  const [sortBy, setSortBy] = useState<SortOption>('due_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Filtro Rápido: Mostrar Somente com Prazos Agendados
  const [onlyScheduled, setOnlyScheduled] = useState(false);

  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('weeks');
  const [baseDate, setBaseDate] = useState<Date>(new Date());

  // Busca e Filtros
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

  // Modal de Impressão
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Modal de Agendamento em Massa (Painel Duplo)
  const [isBatchScheduleOpen, setIsBatchScheduleOpen] = useState(false);
  const [batchStartDate, setBatchStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [batchDueDate, setBatchDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });
  const [batchSelectedTaskIds, setBatchSelectedTaskIds] = useState<Set<string>>(new Set());
  const [batchSearchTerm, setBatchSearchTerm] = useState('');
  const [batchFilterItemId, setBatchFilterItemId] = useState<string>('all');
  const [savingBatch, setSavingBatch] = useState(false);

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

  // Modais de Prazos e Dependência
  const [isDatesModalOpen, setIsDatesModalOpen] = useState(false);
  const [quickStartDate, setQuickStartDate] = useState('');
  const [quickDueDate, setQuickDueDate] = useState('');
  const [savingQuickDates, setSavingQuickDates] = useState(false);

  const [isDependencyModalOpen, setIsDependencyModalOpen] = useState(false);
  const [selectedDependencyId, setSelectedDependencyId] = useState('');
  const [savingDependency, setSavingDependency] = useState(false);

  // Apontamento Diário
  const [completingTask, setCompletingTask] = useState<{ item: WorkItem; task: WorkTask } | null>(null);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryQty, setEntryQty] = useState('');
  const [entryNotes, setEntryNotes] = useState('');
  const [selectedExecutors, setSelectedExecutors] = useState<string[]>([]);
  const [isSavingEntry, setIsSavingEntry] = useState(false);
  const [checklistAction, setChecklistAction] = useState<'progress' | 'complete'>('complete');

  // Bloqueio de Tarefa
  const [blockingTask, setBlockingTask] = useState<WorkTask | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);

  // Permissões
  const canViewSchedule = Boolean(
    permissions.isOwnerOrAdmin ||
    permissions.canManageSchedule ||
    permissions.canViewSchedule
  );

  const canEditSchedule = Boolean(
    permissions.isOwnerOrAdmin ||
    permissions.canManageSchedule ||
    permissions.canEditSchedule
  );

  const canCompleteTasks = Boolean(
    permissions.isOwnerOrAdmin ||
    permissions.canExecuteWorkTasks ||
    permissions.canCompleteWorkTasks
  );

  const canReopenTasks = Boolean(
    permissions.isOwnerOrAdmin ||
    permissions.canReopenWorkTasks
  );

  // Carrega responsáveis da obra
  useEffect(() => {
    const fetchWorkResponsibles = async () => {
      try {
        const { data } = await supabase
          .from('works')
          .select('assigned_to, opportunity:opportunities!opportunity_id(assigned_to)')
          .eq('id', workId)
          .maybeSingle();

        if (data) {
          const opp = Array.isArray(data.opportunity) ? data.opportunity[0] : data.opportunity;
          setWorkData({
            assigned_to: data.assigned_to || null,
            commercial_owner_id: opp?.assigned_to || null
          });
        }
      } catch (err) {
        console.warn('Erro ao carregar responsáveis da obra:', err);
      }
    };

    if (workId) fetchWorkResponsibles();
  }, [workId]);

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

      const itemIds = (itemsData || []).map(i => i.id);
      let tasksData: WorkTask[] = [];

      if (itemIds.length > 0) {
        const { data: tData, error: tasksErr } = await supabase
          .from('work_tasks')
          .select('*')
          .in('work_item_id', itemIds);

        if (tasksErr) throw tasksErr;

        tasksData = (tData || []).map((t: any) => ({
          ...t,
          executed_by: Array.isArray(t.executed_by) ? t.executed_by : []
        }));
      }

      setItems(itemsData || []);
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
    if (canViewSchedule) {
      loadScheduleData();
      loadFilterSettings();
    }
  }, [loadScheduleData, loadFilterSettings, canViewSchedule]);

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

    const cols: Array<{ label: string; subLabel: string; date: Date; isToday: boolean; endDate: Date }> = [];
    const curr = new Date(start);
    const now = new Date();

    while (curr <= end) {
      if (zoomLevel === 'days') {
        const isToday = curr.toDateString() === now.toDateString();
        const dayEnd = new Date(curr);
        dayEnd.setHours(23, 59, 59);
        cols.push({
          label: curr.toLocaleDateString('pt-BR', { weekday: 'short' }),
          subLabel: `${curr.getDate()}/${curr.getMonth() + 1}`,
          date: new Date(curr),
          endDate: dayEnd,
          isToday
        });
        curr.setDate(curr.getDate() + 1);
      } else if (zoomLevel === 'weeks') {
        const weekEnd = new Date(curr);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59);
        const isCurrent = now >= curr && now <= weekEnd;
        cols.push({
          label: `SEM ${Math.ceil(curr.getDate() / 7)}`,
          subLabel: `${curr.getDate()}/${curr.getMonth() + 1} - ${weekEnd.getDate()}/${weekEnd.getMonth() + 1}`,
          date: new Date(curr),
          endDate: weekEnd,
          isToday: isCurrent
        });
        curr.setDate(curr.getDate() + 7);
      } else {
        const monthEnd = new Date(curr.getFullYear(), curr.getMonth() + 1, 0, 23, 59, 59);
        const isCurrentMonth = curr.getMonth() === now.getMonth() && curr.getFullYear() === now.getFullYear();
        cols.push({
          label: curr.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase(),
          subLabel: `${curr.getFullYear()}`,
          date: new Date(curr),
          endDate: monthEnd,
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
    let scheduledCount = 0;

    tasks.forEach(t => {
      const isDone = t.status === 'concluida';
      const isLate = !isDone && t.due_date && t.due_date < nowStr;
      const hasDate = Boolean(t.start_date || t.due_date);

      if (hasDate) scheduledCount += 1;

      if (isDone) completed += 1;
      else if (isLate) delayed += 1;
      else if (!hasDate) unassigned += 1;
      else inProgress += 1;
    });

    return { total: tasks.length, completed, delayed, inProgress, unassigned, scheduledCount };
  }, [tasks]);

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

  // Lista de Tarefas Filtradas e Ordenadas
  const sortedTasksList = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    const nowStr = new Date().toISOString().split('T')[0];

    const filtered = tasks.filter(task => {
      if (onlyScheduled && !task.start_date && !task.due_date) return false;

      const parentItem = itemsMap.get(task.work_item_id);
      const breadcrumb = getHierarchyBreadcrumb(task.work_item_id);

      if (filterSubitemType !== 'all' && task.task_type !== filterSubitemType) return false;
      if (filterItemType !== 'all' && parentItem?.item_type !== filterItemType) return false;
      if (filterLocation !== 'all' && parentItem?.location !== filterLocation) return false;
      if (filterExecutor !== 'all' && (!task.executed_by || !task.executed_by.includes(filterExecutor))) return false;

      const matchesSearch =
        q === '' ||
        task.title.toLowerCase().includes(q) ||
        breadcrumb.toLowerCase().includes(q) ||
        (task.task_type && task.task_type.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      const isDone = task.status === 'concluida';
      const isBlocked = task.status === 'bloqueada';
      const isLate = Boolean(!isDone && task.due_date && task.due_date < nowStr);
      const isUnassigned = Boolean(!task.due_date && !task.start_date);

      if (filterStatus === 'concluida') return isDone;
      if (filterStatus === 'em_andamento') return !isDone && !isBlocked && !isLate && !isUnassigned;
      if (filterStatus === 'atrasadas') return isLate;
      if (filterStatus === 'sem_prazo') return isUnassigned;
      if (filterStatus === 'bloqueada') return isBlocked;

      return true;
    });

    return filtered.sort((a, b) => {
      let res = 0;
      if (sortBy === 'due_date') {
        const da = a.due_date || '9999-99-99';
        const db = b.due_date || '9999-99-99';
        res = da.localeCompare(db);
      } else if (sortBy === 'title') {
        res = a.title.localeCompare(b.title, 'pt-BR');
      } else if (sortBy === 'status') {
        res = a.status.localeCompare(b.status);
      } else if (sortBy === 'hierarchy') {
        const ha = getHierarchyBreadcrumb(a.work_item_id);
        const hb = getHierarchyBreadcrumb(b.work_item_id);
        res = ha.localeCompare(hb, 'pt-BR', { numeric: true });
      }
      return sortOrder === 'asc' ? res : -res;
    });
  }, [tasks, itemsMap, searchTerm, onlyScheduled, filterSubitemType, filterItemType, filterLocation, filterExecutor, filterStatus, sortBy, sortOrder, getHierarchyBreadcrumb]);

  const handleDirectScheduleCell = async (task: WorkTask, col: { date: Date; endDate: Date }) => {
    if (!canEditSchedule) return;

    const sStr = col.date.toISOString().split('T')[0];
    const dStr = col.endDate.toISOString().split('T')[0];

    try {
      const { error } = await supabase
        .from('work_tasks')
        .update({
          start_date: sStr,
          due_date: dStr
        })
        .eq('id', task.id);

      if (error) throw error;

      setTasks(prev =>
        prev.map(t => (t.id === task.id ? { ...t, start_date: sStr, due_date: dStr } : t))
      );
    } catch (err: any) {
      alert('Erro ao agendar na grade: ' + err.message);
    }
  };

  const batchFilteredTasks = useMemo(() => {
    const q = batchSearchTerm.toLowerCase().trim();
    return tasks.filter(t => {
      if (batchFilterItemId !== 'all' && t.work_item_id !== batchFilterItemId) return false;
      if (q === '') return true;
      const b = getHierarchyBreadcrumb(t.work_item_id);
      return t.title.toLowerCase().includes(q) || b.toLowerCase().includes(q);
    });
  }, [tasks, batchSearchTerm, batchFilterItemId, getHierarchyBreadcrumb]);

  const handleApplyBatchSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditSchedule || batchSelectedTaskIds.size === 0) return;

    try {
      setSavingBatch(true);
      const taskIdsArray = Array.from(batchSelectedTaskIds);

      const { error } = await supabase
        .from('work_tasks')
        .update({
          start_date: batchStartDate || null,
          due_date: batchDueDate || null
        })
        .in('id', taskIdsArray);

      if (error) throw error;

      setIsBatchScheduleOpen(false);
      setBatchSelectedTaskIds(new Set());
      await loadScheduleData();
    } catch (err: any) {
      alert('Erro ao agendar tarefas em lote: ' + err.message);
    } finally {
      setSavingBatch(false);
    }
  };

  const handleToggleBatchTask = (taskId: string) => {
    setBatchSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const handleSaveQuickDates = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionTarget || !canEditSchedule) return;

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
    if (!actionTarget || !canEditSchedule) return;

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
      if (!canReopenTasks) {
        alert('O seu perfil não possui permissão para reabrir tarefas concluídas.');
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
      if (!canCompleteTasks) {
        alert('O seu perfil não possui permissão para dar baixa em tarefas.');
        return;
      }
      
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
    if (!completingTask || !canCompleteTasks) return;
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
    if (!canCompleteTasks) return;
    setSelectedExecutors(prev => prev.includes(memberName) ? prev.filter(m => m !== memberName) : [...prev, memberName]);
  };

  if (!loadingPerms && !canViewSchedule) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50/50 rounded-2xl border border-slate-200">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3 border border-slate-200">
          <CalendarRange size={22} />
        </div>
        <h4 className="font-bold text-slate-800 text-sm mb-1">Acesso Restrito ao Cronograma</h4>
        <p className="text-xs text-slate-500 max-w-sm">
          O seu perfil de acesso não possui permissão para visualizar o cronograma operacional desta obra.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full text-slate-400 text-xs py-20">
        <Loader2 className="animate-spin text-sky-600 mb-2" size={24} />
        <span className="font-semibold text-slate-600">Sincronizando cronograma operacional...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-3 select-none pb-4">
      
      {/* 1. BARRA SUPERIOR DE CONTROLE */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 shadow-2xs space-y-3 shrink-0">
        
        {/* LINHA 1: MÉTRICAS + IMPRIMIR E AGENDAR EM MASSA */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
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

            {/* BADGE: FILTRAR SOMENTE COM PRAZOS */}
            <button
              type="button"
              onClick={() => setOnlyScheduled(!onlyScheduled)}
              className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 shrink-0 transition cursor-pointer ${
                onlyScheduled
                  ? 'bg-sky-600 border-sky-600 text-white font-bold shadow-2xs'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
              title="Ocultar tarefas sem prazos na visualização"
            >
              <CalendarCheck2 className={onlyScheduled ? 'text-white' : 'text-sky-600'} size={12} />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {onlyScheduled ? 'Apenas Agendadas' : `Agendadas: ${metrics.scheduledCount}`}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-auto">
            {canEditSchedule && (
              <button
                type="button"
                onClick={() => {
                  setBatchSelectedTaskIds(new Set());
                  setIsBatchScheduleOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-2xs cursor-pointer transition"
                title="Abrir painel para agendar várias tarefas em conjunto"
              >
                <Zap className="fill-white" size={14} />
                <span>Agendar em Massa</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-2xs cursor-pointer transition"
            >
              <Printer className="text-slate-500" size={14} />
              <span className="hidden sm:inline">Imprimir / PDF</span>
            </button>
          </div>
        </div>

        {/* LINHA 2: BUSCA | FILTROS | ORDENAÇÃO | ALTERNADOR (GANTT vs LISTA) | ZOOM */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
          
          <div className="flex items-center gap-2 flex-1 max-w-lg flex-wrap">
            {/* Campo de Busca */}
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar por tarefa ou local..."
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

            {/* Botão de Ordenação */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-2xs">
              <ArrowUpDown className="text-slate-400 ml-1" size={13} />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as SortOption)}
                className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer pr-1"
              >
                <option value="due_date">Por Prazo</option>
                <option value="title">Por Nome da Tarefa</option>
                <option value="hierarchy">Por Pavimento/Local</option>
                <option value="status">Por Status</option>
              </select>
              <button
                type="button"
                onClick={() => setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))}
                className="text-[10px] font-black text-sky-600 hover:bg-sky-50 px-1.5 py-0.5 rounded cursor-pointer"
                title="Inverter direção da ordenação"
              >
                {sortOrder === 'asc' ? 'ASC' : 'DESC'}
              </button>
            </div>

            {/* Botão de Filtro Avançado */}
            <button
              ref={filterButtonRef}
              type="button"
              onClick={handleToggleFilterPopover}
              title="Filtros avançados"
              className={`p-2 border rounded-xl transition cursor-pointer shadow-2xs flex items-center justify-center relative shrink-0 ${
                (filterStatus !== 'all' || filterItemType !== 'all' || filterSubitemType !== 'all' || filterLocation !== 'all' || filterExecutor !== 'all')
                  ? 'bg-sky-50 border-sky-300 text-sky-700 font-bold'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Filter size={15} />
            </button>
          </div>

          {/* Lado Direito: Alternador Gantt/Lista + Zoom + Navegação */}
          <div className="flex items-center gap-2 justify-end shrink-0 flex-wrap">
            
            {/* GANTT vs LISTAGEM */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewMode('gantt')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer text-xs flex items-center gap-1.5 ${
                  viewMode === 'gantt' ? 'bg-white text-sky-700 font-bold shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Kanban size={13} />
                <span>Gantt</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer text-xs flex items-center gap-1.5 ${
                  viewMode === 'list' ? 'bg-white text-sky-700 font-bold shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <ListOrdered size={13} />
                <span>Listagem</span>
              </button>
            </div>

            {viewMode === 'gantt' && (
              <>
                <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setZoomLevel('days')}
                    className={`px-2 py-1 rounded-lg transition cursor-pointer text-xs ${
                      zoomLevel === 'days' ? 'bg-white text-sky-700 font-bold shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Dias
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomLevel('weeks')}
                    className={`px-2 py-1 rounded-lg transition cursor-pointer text-xs ${
                      zoomLevel === 'weeks' ? 'bg-white text-sky-700 font-bold shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Semanas
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomLevel('months')}
                    className={`px-2 py-1 rounded-lg transition cursor-pointer text-xs ${
                      zoomLevel === 'months' ? 'bg-white text-sky-700 font-bold shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Meses
                  </button>
                </div>

                <div className="flex items-center gap-0.5 bg-white border border-slate-200 p-0.5 rounded-xl shadow-2xs">
                  <button
                    type="button"
                    onClick={() => handleShiftTime('prev')}
                    className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
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
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </>
            )}

          </div>

        </div>

      </div>

      {/* 2. CORPO DO GANTT */}
      {viewMode === 'gantt' ? (
        <div className="flex-1 min-h-0 bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 overflow-auto flex flex-col">
            <div className="min-w-[850px] flex-1 flex flex-col">
              
              {/* Cabeçalho da Grade */}
              <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 shrink-0 sticky top-0 z-30">
                <div className="w-80 sm:w-96 p-3 px-4 border-r border-slate-200 shrink-0 flex items-center justify-between bg-slate-50">
                  <span className="uppercase text-[10px] text-slate-400 tracking-wider">Tarefa & Local</span>
                  <span className="text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                    {sortedTasksList.length} atividades
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

              {/* Linhas de Tarefas */}
              <div className="flex-1 divide-y divide-slate-100">
                {sortedTasksList.length === 0 ? (
                  <div className="p-16 text-center text-xs text-slate-400">
                    Nenhuma tarefa corresponde aos filtros aplicados.
                  </div>
                ) : (
                  sortedTasksList.map(task => {
                    const isDone = task.status === 'concluida';
                    const isInProgress = task.status === 'em_andamento';
                    const isTaskBlocked = task.status === 'bloqueada';
                    const nowStr = new Date().toISOString().split('T')[0];
                    const isLate = !isDone && task.due_date && task.due_date < nowStr;
                    const taskBar = getBarCoordinates(task.start_date, task.due_date);
                    const breadcrumb = getHierarchyBreadcrumb(task.work_item_id);
                    const parent = itemsMap.get(task.work_item_id);

                    return (
                      <div key={task.id} className="flex items-center hover:bg-slate-50/70 transition">
                        
                        {/* Identificação da Tarefa */}
                        <div className="w-80 sm:w-96 h-12 p-2 px-3 border-r border-slate-200 shrink-0 flex items-center justify-between gap-2 min-w-0">
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
                                isBlocked: isTaskBlocked,
                                itemRef: parent,
                                taskRef: task
                              });
                            }}
                            className="flex items-center gap-2 min-w-0 cursor-pointer flex-1 group"
                          >
                            <div className="shrink-0">
                              {isTaskBlocked ? (
                                <ShieldAlert className="text-rose-600" size={15} />
                              ) : isDone ? (
                                <CheckCircle2 className="text-emerald-600" size={15} />
                              ) : isInProgress ? (
                                <PlayCircle className="text-sky-500" size={15} />
                              ) : (
                                <Clock className="text-slate-300 group-hover:text-slate-500" size={15} />
                              )}
                            </div>

                            <div className="min-w-0">
                              <span className={`block text-xs font-bold truncate leading-tight transition-colors ${
                                isDone ? 'line-through text-slate-400' : 'text-slate-800 group-hover:text-sky-600'
                              }`}>
                                {task.title}
                              </span>
                              <span className="text-[10px] text-slate-400 block truncate" title={breadcrumb}>
                                {breadcrumb}
                              </span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            {task.due_date ? (
                              <span className={`text-[10px] font-mono font-bold block ${isLate ? 'text-rose-600' : 'text-slate-600'}`}>
                                {new Date(task.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                              </span>
                            ) : (
                              <span className="text-[9px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-bold">
                                Sem prazo
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Grade do Gantt */}
                        <div className="flex-1 h-12 relative flex items-center overflow-hidden">
                          <div className="absolute inset-0 flex">
                            {timeColumns.map((col, idx) => (
                              <div
                                key={idx}
                                onClick={() => handleDirectScheduleCell(task, col)}
                                className={`flex-1 min-w-[65px] border-r border-slate-100 last:border-r-0 h-full hover:bg-sky-50/50 cursor-pointer transition ${
                                  col.isToday ? 'bg-sky-50/20' : ''
                                }`}
                                title={canEditSchedule ? `Clique para agendar para ${col.label} (${col.subLabel})` : undefined}
                              />
                            ))}
                          </div>

                          {todayPosition && (
                            <div className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-20 pointer-events-none" style={{ left: todayPosition }} />
                          )}

                          {/* Barra do Gantt */}
                          {taskBar && (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setActionTarget({
                                  id: task.id,
                                  title: task.title,
                                  type: 'task',
                                  start: task.start_date,
                                  due: task.due_date,
                                  status: task.status,
                                  dependsOnId: task.depends_on_task_id,
                                  isBlocked: isTaskBlocked,
                                  itemRef: parent,
                                  taskRef: task
                                });
                              }}
                              className={`absolute h-6 rounded-lg shadow-2xs z-10 flex items-center px-2.5 transition hover:brightness-110 cursor-pointer ${
                                isDone 
                                  ? 'bg-emerald-500 text-white' 
                                  : isTaskBlocked 
                                  ? 'bg-rose-500 text-white' 
                                  : isLate 
                                  ? 'bg-rose-500 text-white animate-pulse' 
                                  : 'bg-sky-500 text-white'
                              }`}
                              style={{ left: taskBar.left, width: taskBar.width }}
                            >
                              <span className="text-[10px] font-bold truncate drop-shadow-xs flex items-center gap-1">
                                {isTaskBlocked && <ShieldAlert size={10} />}
                                <span>{task.title}</span>
                              </span>
                            </div>
                          )}
                        </div>

                      </div>
                    );
                  })
                )}
              </div>

            </div>
          </div>
        </div>
      ) : (
        /* VISUALIZAÇÃO EM LISTAGEM / TABELA */
        <div className="flex-1 min-h-0 bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col overflow-hidden">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-600">
            <span>Listagem de Atividades ({sortedTasksList.length})</span>
            <span className="text-[11px] text-slate-400 font-normal">Clique na linha para ver opções e apontar</span>
          </div>

          <div className="flex-1 min-h-0 overflow-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-4 w-12 text-center">Status</th>
                  <th className="py-2.5 px-4">Hierarquia & Atividade</th>
                  <th className="py-2.5 px-4 w-32 text-center">Início</th>
                  <th className="py-2.5 px-4 w-32 text-center">Término</th>
                  <th className="py-2.5 px-4 w-28 text-center">Tipo</th>
                  <th className="py-2.5 px-4 w-28 text-right">Meta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {sortedTasksList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 italic">
                      Nenhuma atividade encontrada.
                    </td>
                  </tr>
                ) : (
                  sortedTasksList.map(task => {
                    const isDone = task.status === 'concluida';
                    const isBlocked = task.status === 'bloqueada';
                    const nowStr = new Date().toISOString().split('T')[0];
                    const isLate = !isDone && task.due_date && task.due_date < nowStr;
                    const breadcrumb = getHierarchyBreadcrumb(task.work_item_id);
                    const parent = itemsMap.get(task.work_item_id);

                    return (
                      <tr
                        key={task.id}
                        onClick={() => {
                          setActionTarget({
                            id: task.id,
                            title: task.title,
                            type: 'task',
                            start: task.start_date,
                            due: task.due_date,
                            status: task.status,
                            dependsOnId: task.depends_on_task_id,
                            isBlocked,
                            itemRef: parent,
                            taskRef: task
                          });
                        }}
                        className="hover:bg-slate-50/70 transition cursor-pointer"
                      >
                        <td className="py-2.5 px-4 text-center">
                          {isBlocked ? (
                            <ShieldAlert className="text-rose-600 mx-auto" size={15} />
                          ) : isDone ? (
                            <CheckCircle2 className="text-emerald-600 mx-auto" size={15} />
                          ) : isLate ? (
                            <AlertTriangle className="text-rose-500 mx-auto" size={15} />
                          ) : (
                            <Clock className="text-sky-500 mx-auto" size={15} />
                          )}
                        </td>
                        <td className="py-2.5 px-4">
                          <strong className="block text-slate-900 text-xs font-bold">{task.title}</strong>
                          <span className="text-[10px] text-slate-400">{breadcrumb}</span>
                        </td>
                        <td className="py-2.5 px-4 text-center text-slate-600 font-mono">
                          {task.start_date ? new Date(task.start_date + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                        </td>
                        <td className="py-2.5 px-4 text-center font-mono">
                          <span className={isLate ? 'text-rose-600 font-bold' : 'text-slate-800'}>
                            {task.due_date ? new Date(task.due_date + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          {task.task_type ? (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-semibold border border-slate-200">
                              {task.task_type}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                          {task.has_progress_tracking ? `${task.quantity_planned} ${task.unit || 'un'}` : 'Checklist'}
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

      {/* 3. MODAL DE AGENDAMENTO EM MASSA (PAINEL DUPLO) */}
      {isBatchScheduleOpen && canEditSchedule && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-5xl w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 h-[88vh] flex flex-col">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                  <Zap className="fill-sky-700" size={20} />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-base leading-tight">Agendamento em Massa</h4>
                  <p className="text-xs text-slate-400">Selecione as tarefas na esquerda para agrupar na lista de aplicação</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchScheduleOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Configuração de Prazos do Lote */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl shrink-0">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Data de Início da Atividade *</label>
                <input
                  type="date"
                  required
                  value={batchStartDate}
                  onChange={e => setBatchStartDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 text-xs focus:ring-2 focus:ring-sky-500 shadow-2xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Data Limite de Término / Entrega *</label>
                <input
                  type="date"
                  required
                  min={batchStartDate}
                  value={batchDueDate}
                  onChange={e => setBatchDueDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 text-xs focus:ring-2 focus:ring-sky-500 shadow-2xs"
                />
              </div>
            </div>

            {/* PAINEL DUPLO */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-4">
              
              {/* LADO ESQUERDO: DISPONÍVEIS */}
              <div className="border border-slate-200 rounded-2xl flex flex-col min-h-0 bg-slate-50/40 p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Tarefas Disponíveis ({batchFilteredTasks.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const allIds = batchFilteredTasks.map(t => t.id);
                      setBatchSelectedTaskIds(new Set([...Array.from(batchSelectedTaskIds), ...allIds]));
                    }}
                    className="text-[11px] font-bold text-sky-600 hover:underline cursor-pointer"
                  >
                    Adicionar Todas Deste Filtro
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                    <input
                      type="text"
                      value={batchSearchTerm}
                      onChange={e => setBatchSearchTerm(e.target.value)}
                      placeholder="Pesquisar..."
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-medium"
                    />
                  </div>

                  <select
                    value={batchFilterItemId}
                    onChange={e => setBatchFilterItemId(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-medium"
                  >
                    <option value="all">Todas as Áreas / Pavimentos</option>
                    {items.map(it => (
                      <option key={it.id} value={it.id}>
                        {it.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 bg-white rounded-xl border border-slate-200 p-1">
                  {batchFilteredTasks.length === 0 ? (
                    <p className="p-8 text-center text-xs text-slate-400 italic">Nenhuma tarefa encontrada.</p>
                  ) : (
                    batchFilteredTasks.map(task => {
                      const isSelected = batchSelectedTaskIds.has(task.id);
                      const breadcrumb = getHierarchyBreadcrumb(task.work_item_id);

                      return (
                        <div
                          key={task.id}
                          onClick={() => handleToggleBatchTask(task.id)}
                          className={`p-2.5 rounded-lg flex items-center justify-between gap-2.5 cursor-pointer transition ${
                            isSelected ? 'bg-sky-50 text-sky-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                              isSelected ? 'bg-sky-600 border-sky-600 text-white' : 'border-slate-300 bg-white'
                            }`}>
                              {isSelected && <Check size={12} />}
                            </div>
                            <div className="min-w-0">
                              <span className="block text-xs truncate">{task.title}</span>
                              <span className="text-[10px] text-slate-400 block truncate">{breadcrumb}</span>
                            </div>
                          </div>

                          <span className="text-[10px] font-mono text-slate-400 shrink-0">
                            {task.due_date ? new Date(task.due_date + 'T00:00:00').toLocaleDateString('pt-BR') : 'Sem prazo'}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* LADO DIREITO: SELECIONADAS */}
              <div className="border border-slate-200 rounded-2xl flex flex-col min-h-0 bg-white p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-700 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="text-sky-600" size={14} />
                    <span>Tarefas Selecionadas ({batchSelectedTaskIds.size})</span>
                  </span>
                  {batchSelectedTaskIds.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setBatchSelectedTaskIds(new Set())}
                      className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                    >
                      Remover Todas
                    </button>
                  )}
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200 p-1">
                  {batchSelectedTaskIds.size === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 text-xs">
                      <Zap className="text-slate-300 mb-2" size={28} />
                      <p className="font-semibold text-slate-600">Nenhuma tarefa adicionada</p>
                      <p className="text-[11px] max-w-xs mt-0.5">Selecione na lista ao lado para aplicar a nova data em massa.</p>
                    </div>
                  ) : (
                    Array.from(batchSelectedTaskIds).map(id => {
                      const t = tasks.find(x => x.id === id);
                      if (!t) return null;
                      const breadcrumb = getHierarchyBreadcrumb(t.work_item_id);

                      return (
                        <div key={id} className="p-2.5 flex items-center justify-between gap-2 hover:bg-slate-50 transition rounded-lg">
                          <div className="min-w-0">
                            <span className="block text-xs font-bold text-slate-800 truncate">{t.title}</span>
                            <span className="text-[10px] text-slate-400 block truncate">{breadcrumb}</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleToggleBatchTask(id)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition shrink-0"
                            title="Remover deste lote"
                          >
                            <Minus size={14} />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>

            {/* Rodapé do Modal */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500 font-semibold">
                Total para atualizar: <strong className="text-slate-900">{batchSelectedTaskIds.size} tarefas</strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsBatchScheduleOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold cursor-pointer text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={savingBatch || batchSelectedTaskIds.size === 0}
                  onClick={handleApplyBatchSchedule}
                  className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-xs"
                >
                  {savingBatch ? <Loader2 className="animate-spin" size={13} /> : <Save size={13} />}
                  <span>Aplicar Datas em Massa</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* POPOVER FLUTUANTE DE FILTROS */}
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
              <Filter className="text-sky-600" size={13} />
              <span>Filtros do Cronograma</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setFilterStatus('all');
                setFilterItemType('all');
                setFilterSubitemType('all');
                setFilterLocation('all');
                setFilterExecutor('all');
                setOnlyScheduled(false);
              }}
              className="text-[11px] text-sky-600 hover:underline font-semibold cursor-pointer"
            >
              Limpar Todos
            </button>
          </div>

          <div className="space-y-2.5 max-h-[70vh] overflow-y-auto pr-0.5">
            <div>
              <label className="block font-semibold text-slate-700 mb-1 text-[11px]">Situação Operacional</label>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value as any)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium cursor-pointer text-xs"
              >
                <option value="all">Todas as Atividades</option>
                <option value="em_andamento">Liberadas para Execução</option>
                <option value="bloqueada">Restrição (Bloqueadas)</option>
                <option value="concluida">Concluídas</option>
                <option value="atrasadas">Atrasadas</option>
                <option value="sem_prazo">Sem Prazos Definidos</option>
              </select>
            </div>

            {locationOptions.length > 0 && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[11px]">Local no Canteiro</label>
                <select
                  value={filterLocation}
                  onChange={e => setFilterLocation(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium cursor-pointer text-xs"
                >
                  <option value="all">Todos os Locais</option>
                  {locationOptions.map(l => (
                    <option key={l.id} value={l.name}>{l.name}</option>
                  ))}
                </select>
              </div>
            )}

            {itemTypeOptions.length > 0 && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[11px]">Tipo de Item</label>
                <select
                  value={filterItemType}
                  onChange={e => setFilterItemType(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium cursor-pointer text-xs"
                >
                  <option value="all">Todos os Tipos de Item</option>
                  {itemTypeOptions.map(t => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            {subitemTypeOptions.length > 0 && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[11px]">Tipo de Tarefa</label>
                <select
                  value={filterSubitemType}
                  onChange={e => setFilterSubitemType(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium cursor-pointer text-xs"
                >
                  <option value="all">Todos os Tipos de Tarefa</option>
                  {subitemTypeOptions.map(st => (
                    <option key={st.id} value={st.name}>{st.name}</option>
                  ))}
                </select>
              </div>
            )}

            {teamMembers.length > 0 && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[11px]">Executor</label>
                <select
                  value={filterExecutor}
                  onChange={e => setFilterExecutor(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium cursor-pointer text-xs"
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
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Aplicar Filtros
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* POPUP DE AÇÕES DA TAREFA */}
      {actionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/50 backdrop-blur-2xs animate-in fade-in duration-100">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-3.5 animate-in zoom-in-95 duration-100 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 min-w-0">
                {actionTarget.status === 'bloqueada' ? (
                  <ShieldAlert className="text-rose-600 shrink-0" size={16} />
                ) : (
                  <Clock className="text-sky-600 shrink-0" size={16} />
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
                <ShieldAlert className="text-rose-600 shrink-0 mt-0.5" size={14} />
                <span className="leading-snug">
                  <strong>Restrição:</strong> {actionTarget.taskRef.blocked_reason}
                </span>
              </div>
            )}

            <div className="space-y-1.5 text-xs">
              {canEditSchedule && (
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
                    <CalendarRange className="text-sky-600 shrink-0" size={16} />
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
                    <Link2 className="text-sky-600 shrink-0" size={16} />
                    <div>
                      <span className="block text-slate-900 font-bold">Vincular Dependência</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {actionTarget.dependencyTitle ? `Vinculado a: ${actionTarget.dependencyTitle}` : 'Livre para execução'}
                      </span>
                    </div>
                  </button>
                </>
              )}

              {actionTarget.taskRef && actionTarget.itemRef && (
                <>
                  {actionTarget.status === 'bloqueada' ? (
                    canCompleteTasks && (
                      <button
                        type="button"
                        onClick={() => {
                          handleUnblockTask(actionTarget.taskRef!);
                          setActionTarget(null);
                        }}
                        className="w-full flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-emerald-50 text-emerald-700 font-semibold transition cursor-pointer text-left"
                      >
                        <ShieldCheck className="text-emerald-600 shrink-0" size={16} />
                        <div>
                          <span className="block font-bold">Desbloquear Tarefa</span>
                          <span className="text-[10px] text-emerald-600/70 font-normal">Remover restrição operacional</span>
                        </div>
                      </button>
                    )
                  ) : (
                    canCompleteTasks && (
                      <button
                        type="button"
                        onClick={() => {
                          setBlockingTask(actionTarget.taskRef!);
                          setActionTarget(null);
                        }}
                        className="w-full flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-amber-50 text-amber-700 font-semibold transition cursor-pointer text-left"
                      >
                        <ShieldAlert className="text-amber-600 shrink-0" size={16} />
                        <div>
                          <span className="block font-bold">Bloquear (Com Restrição)</span>
                          <span className="text-[10px] text-amber-600/70 font-normal">Marcar impedimentos</span>
                        </div>
                      </button>
                    )
                  )}

                  {actionTarget.status !== 'bloqueada' && (
                    <button
                      type="button"
                      disabled={actionTarget.status === 'concluida' ? !canReopenTasks : !canCompleteTasks}
                      onClick={() => handleToggleTaskStatus(actionTarget.taskRef!, actionTarget.itemRef!)}
                      className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl font-semibold transition text-left ${
                        actionTarget.status === 'concluida' 
                          ? canReopenTasks ? 'hover:bg-amber-50 text-amber-700 cursor-pointer' : 'opacity-60 cursor-not-allowed'
                          : canCompleteTasks ? 'hover:bg-emerald-50 text-emerald-700 cursor-pointer' : 'opacity-60 cursor-not-allowed'
                      }`}
                    >
                      {actionTarget.status === 'concluida' ? (
                        <>
                          <Clock className="text-amber-600 shrink-0" size={16} />
                          <div>
                            <span className="block font-bold">Reabrir Tarefa</span>
                            <span className="text-[10px] text-slate-400 font-normal">Voltar para pendente</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="text-emerald-600 shrink-0" size={16} />
                          <div>
                            <span className="block font-bold">Apontar / Concluir Tarefa</span>
                            <span className="text-[10px] text-slate-400 font-normal">Registrar avanço físico</span>
                          </div>
                        </>
                      )}
                    </button>
                  )}
                </>
              )}

              {canEditSchedule && (actionTarget.start || actionTarget.due) && (
                <button
                  type="button"
                  onClick={async () => {
                    await supabase.from('work_tasks').update({ start_date: null, due_date: null }).eq('id', actionTarget.id);
                    setActionTarget(null);
                    await loadScheduleData();
                  }}
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-rose-50 text-rose-600 font-semibold transition cursor-pointer text-left"
                >
                  <Trash2 className="text-rose-500 shrink-0" size={16} />
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
      {isDatesModalOpen && actionTarget && canEditSchedule && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CalendarRange className="text-sky-600" size={18} />
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
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Tarefa</span>
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
                <label className="block font-semibold text-slate-700 mb-1">Data de Término</label>
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
                  {savingQuickDates ? <Loader2 className="animate-spin" size={13} /> : <Save size={13} />}
                  <span>Salvar Prazo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VINCULAR DEPENDÊNCIA */}
      {isDependencyModalOpen && actionTarget && canEditSchedule && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Link2 className="text-sky-600" size={18} />
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
                {getHierarchyBreadcrumb(actionTarget.taskRef?.work_item_id, actionTarget.title)}
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
                  {tasks
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
                  {savingDependency ? <Loader2 className="animate-spin" size={13} /> : <Save size={13} />}
                  <span>Salvar Trava</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: APONTAMENTO DIÁRIO DE EXECUÇÃO */}
      {completingTask && canCompleteTasks && (
        <div className="fixed inset-0 z-[170] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-4 sm:p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600 border border-sky-100">
                  <CheckCircle2 size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 leading-tight">Apontamento de Execução</h3>
                  <p className="text-[11px] text-slate-500">Registro no diário de obra</p>
                </div>
              </div>
              <button
                type="button"
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

              {/* SELEÇÃO DOS COLABORADORES */}
              <div className="pt-1">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <UserCheck className="text-sky-600" size={12} />
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
                              {member.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <span className="block text-xs truncate">{member.name}</span>
                              {member.role && <span className="text-[10px] text-slate-400 font-normal block truncate">{member.role}</span>}
                            </div>
                          </div>

                          <UserCheck className={`shrink-0 ml-1 ${isSelected ? 'text-sky-600' : 'text-slate-300'}`} size={15} />
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
                {isSavingEntry ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
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
                  placeholder="Ex: Falta de material, aguardando aprovação..."
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
                  {isBlocking ? <Loader2 className="animate-spin" size={13} /> : <Lock size={13} />}
                  Confirmar Restrição
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL OFICIAL DE IMPRESSÃO */}
      <WorkSchedulePrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        workTitle={workTitle}
        workCode={workCode}
        tasks={tasks}
        allItems={items}
        getHierarchyBreadcrumb={getHierarchyBreadcrumb}
      />

    </div>
  );
};

export default WorkScheduleTab;