import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  X,
  Search,
  Users,
  Save,
  Loader2,
  Trash2,
  CheckSquare,
  BookOpenCheck,
  UserCheck,
  RotateCcw,
  MessageSquare,
  PlayCircle,
  Check,
  UserX,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import type { WorkItem, WorkTask } from './WorkItemRow';

interface DailyWorkLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultWorkId?: string;
  onSaved?: () => void;
}

interface TaskEntryState {
  tempId: string;
  task: WorkTask;
  quantity: string;
  actionType: 'progress' | 'complete';
  isRework: boolean;
  itemNotes: string;
  executors: string[];
}

interface AssignedWorkerInfo {
  id: string;
  full_name: string;
  role_title?: string;
  avatar_url?: string | null;
}

const getInitials = (name: string) => {
  if (!name) return 'EX';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const DailyWorkLogModal: React.FC<DailyWorkLogModalProps> = ({
  isOpen,
  onClose,
  defaultWorkId,
  onSaved
}) => {
  const { user } = useAuth();

  // Estados Globais do Diário
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [globalNotes, setGlobalNotes] = useState('');

  // Dados da Obra
  const [selectedWorkId, setSelectedWorkId] = useState<string>(defaultWorkId || '');
  const [loadingData, setLoadingData] = useState(false);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [workTasks, setWorkTasks] = useState<WorkTask[]>([]);
  
  // Colaboradores aptos alocados na obra
  const [availableWorkers, setAvailableWorkers] = useState<AssignedWorkerInfo[]>([]);

  // Colaboradores PRESENTES no canteiro hoje (nomes selecionados)
  const [presentWorkers, setPresentWorkers] = useState<Set<string>>(new Set());

  // Controle de colapso do card de presença no mobile
  const [isMobilePresenceOpen, setIsMobilePresenceOpen] = useState(false);

  // Tarefas adicionadas ao diário
  const [entries, setEntries] = useState<TaskEntryState[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Busca de tarefas
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (defaultWorkId) {
      setSelectedWorkId(defaultWorkId);
    }
  }, [defaultWorkId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Carregar dados da obra
  const loadWorkData = useCallback(async () => {
    const companyId = user?.company?.id;
    if (!companyId || !selectedWorkId) return;

    try {
      setLoadingData(true);

      const [itemsRes, tasksRes, workMembersRes, companyMembersRes] = await Promise.all([
        supabase
          .from('work_items')
          .select('id, title, parent_id, code')
          .eq('work_id', selectedWorkId)
          .order('sort_order', { ascending: true }),
        supabase
          .from('work_tasks')
          .select('*')
          .eq('company_id', companyId)
          .neq('status', 'concluida')
          .order('created_at', { ascending: true }),
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
          .eq('work_id', selectedWorkId),
        supabase
          .from('memberships')
          .select(`
            id,
            profile:profiles!profile_id (
              id,
              full_name,
              role_title,
              avatar_url
            )
          `)
          .eq('company_id', companyId)
          .eq('status', 'ativo')
      ]);

      const itemsList = (itemsRes.data as any) || [];
      setWorkItems(itemsList);

      const validItemIds = new Set(itemsList.map((i: any) => i.id));
      const filteredTasks = (tasksRes.data || []).filter((t: any) => validItemIds.has(t.work_item_id));
      setWorkTasks((filteredTasks as any) || []);

      // 1. Processar Colaboradores alocados na tabela work_members
      const assignedList: AssignedWorkerInfo[] = [];
      (workMembersRes.data || []).forEach((wm: any) => {
        const prof = Array.isArray(wm.profile) ? wm.profile[0] : wm.profile;
        if (prof) {
          assignedList.push({
            id: prof.id,
            full_name: prof.full_name || 'Sem nome',
            role_title: prof.role_title || 'Colaborador',
            avatar_url: prof.avatar_url || null
          });
        }
      });

      // 2. Fallback caso a obra não tenha alocados
      const finalWorkersList = assignedList.length > 0 ? assignedList : (
        (companyMembersRes.data || []).map((m: any) => {
          const prof = Array.isArray(m.profile) ? m.profile[0] : m.profile;
          return {
            id: prof?.id || m.id,
            full_name: prof?.full_name || 'Sem nome',
            role_title: prof?.role_title || 'Colaborador',
            avatar_url: prof?.avatar_url || null
          };
        })
      );

      setAvailableWorkers(finalWorkersList);
      setPresentWorkers(new Set(finalWorkersList.map(w => w.full_name)));
    } catch (err) {
      console.error('Erro ao carregar dados para o diário de obra:', err);
    } finally {
      setLoadingData(false);
    }
  }, [user?.company?.id, selectedWorkId]);

  useEffect(() => {
    if (isOpen && selectedWorkId) {
      setEntries([]);
      setGlobalNotes('');
      setEntryDate(new Date().toISOString().split('T')[0]);
      loadWorkData();
    }
  }, [isOpen, selectedWorkId, loadWorkData]);

  // Alternar presença de um colaborador na obra hoje
  const toggleWorkerPresence = (workerName: string) => {
    setPresentWorkers(prev => {
      const next = new Set(prev);
      if (next.has(workerName)) {
        next.delete(workerName);
        setEntries(currentEntries =>
          currentEntries.map(e => ({
            ...e,
            executors: e.executors.filter(name => name !== workerName)
          }))
        );
      } else {
        next.add(workerName);
      }
      return next;
    });
  };

  const handleSelectAllPresent = () => {
    if (presentWorkers.size === availableWorkers.length) {
      setPresentWorkers(new Set());
      setEntries(current => current.map(e => ({ ...e, executors: [] })));
    } else {
      setPresentWorkers(new Set(availableWorkers.map(w => w.full_name)));
    }
  };

  // Mapa de itens para montar o caminho hierárquico
  const itemsMap = useMemo(() => {
    const map = new Map<string, WorkItem>();
    workItems.forEach(i => map.set(i.id, i));
    return map;
  }, [workItems]);

  const getHierarchyBreadcrumb = (itemId: string | null | undefined): string => {
    if (!itemId) return '';
    const parts: string[] = [];
    let current = itemsMap.get(itemId);
    let depth = 0;
    while (current && depth < 5) {
      parts.push(current.title);
      if (current.parent_id && itemsMap.has(current.parent_id)) {
        current = itemsMap.get(current.parent_id);
      } else break;
      depth++;
    }
    return parts.reverse().join(' / ');
  };

  // Tarefas disponíveis para apontar
  const availableTasksToLog = useMemo(() => {
    const q = searchTerm.toLowerCase();
    const addedTaskIds = entries.map(e => e.task.id);

    return workTasks.filter(t => {
      if (addedTaskIds.includes(t.id)) return false;
      if (!q) return true;
      const parentTitle = getHierarchyBreadcrumb(t.work_item_id).toLowerCase();
      return t.title.toLowerCase().includes(q) || parentTitle.includes(q);
    });
  }, [workTasks, searchTerm, entries, itemsMap]);

  // Adicionar tarefa ao diário
  const addTaskToLog = (task: WorkTask) => {
    const remaining = task.has_progress_tracking
      ? Math.max(0, task.quantity_planned - (task.quantity_executed || 0)).toString()
      : '0';

    setEntries(prev => [
      {
        tempId: Math.random().toString(36).substr(2, 9),
        task,
        quantity: remaining,
        actionType: 'complete',
        isRework: false,
        itemNotes: '',
        executors: []
      },
      ...prev
    ]);
    setSearchTerm('');
    setIsSearchOpen(false);
  };

  const removeEntry = (tempId: string) => {
    setEntries(prev => prev.filter(e => e.tempId !== tempId));
  };

  const updateEntryState = (tempId: string, updates: Partial<TaskEntryState>) => {
    setEntries(prev => prev.map(e => (e.tempId === tempId ? { ...e, ...updates } : e)));
  };

  const toggleTaskExecutor = (tempId: string, executorName: string) => {
    setEntries(prev =>
      prev.map(e => {
        if (e.tempId !== tempId) return e;
        const exists = e.executors.includes(executorName);
        const nextExecutors = exists
          ? e.executors.filter(name => name !== executorName)
          : [...e.executors, executorName];
        return { ...e, executors: nextExecutors };
      })
    );
  };

  // Salvar Diário de Obra em Lote
  const handleSave = async () => {
    if (entries.length === 0 || !selectedWorkId || !user?.company?.id) return;

    try {
      setIsSaving(true);

      const payload = entries.map(e => {
        let qty = 0;
        if (e.task.has_progress_tracking) {
          qty = parseFloat(e.quantity.replace(',', '.')) || 0;
        } else {
          qty = e.actionType === 'complete' ? 1 : 0;
        }

        const combinedTaskNotes = [
          e.isRework ? '[RETRABALHO]' : '',
          e.itemNotes.trim(),
          globalNotes ? `(Geral: ${globalNotes.trim()})` : ''
        ].filter(Boolean).join(' ') || null;

        return {
          company_id: user.company.id,
          work_id: selectedWorkId,
          work_item_id: e.task.work_item_id,
          work_task_id: e.task.id,
          entry_date: entryDate,
          quantity_executed: qty,
          team_id: null,
          executed_by: e.executors,
          notes: combinedTaskNotes,
          created_by: user?.profile?.id || null,
        };
      });

      const { error: insertError } = await supabase
        .from('work_task_entries')
        .insert(payload);

      if (insertError) throw insertError;

      for (const entry of entries) {
        let isFullyDone = false;
        let newExecuted = entry.task.quantity_executed || 0;

        if (entry.task.has_progress_tracking) {
          const qty = parseFloat(entry.quantity.replace(',', '.')) || 0;
          newExecuted = (entry.task.quantity_executed || 0) + qty;
          isFullyDone = newExecuted >= entry.task.quantity_planned;
        } else {
          isFullyDone = entry.actionType === 'complete';
          if (isFullyDone) newExecuted = 1;
        }

        const existingExecutors = entry.task.executed_by || [];
        const mergedExecutors = Array.from(new Set([...existingExecutors, ...entry.executors]));
        const newStatus = isFullyDone ? 'concluida' : 'em_andamento';

        await supabase
          .from('work_tasks')
          .update({
            quantity_executed: newExecuted,
            executed_by: mergedExecutors,
            status: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', entry.task.id);
      }

      onSaved?.();
      onClose();
    } catch (err: any) {
      alert('Erro ao salvar apontamentos do diário: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const presentWorkersList = availableWorkers.filter(w => presentWorkers.has(w.full_name));

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-2xs animate-in fade-in duration-200">
      <div className="bg-slate-50 border border-slate-200 w-full sm:rounded-3xl max-w-5xl shadow-2xl flex flex-col h-full sm:h-[88vh] animate-in zoom-in-95 duration-200 overflow-hidden">
        
        {/* CABEÇALHO DO MODAL */}
        <div className="bg-white px-4 sm:px-6 py-3 border-b border-slate-200 flex items-center justify-between shrink-0 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <BookOpenCheck size={18} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900 leading-tight">Diário de Obra</h2>
              <p className="text-[10px] sm:text-xs text-slate-400">Lançamento diário de atividades e equipe</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* CORPO: 2 COLUNAS (RESPONSIVO TOTAL PARA MOBILE) */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          
          {/* COLUNA ESQUERDA: DATA, SELEÇÃO DE PRESENÇA E OBSERVAÇÕES */}
          <div className="w-full lg:w-80 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 shrink-0 flex flex-col overflow-y-auto">
            <div className="p-3 sm:p-5 space-y-3 sm:space-y-4 text-xs">
              
              {/* DATA DO SERVIÇO */}
              <div>
                <label className="block text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Data da Execução *
                </label>
                <input
                  type="date"
                  required
                  value={entryDate}
                  onChange={e => setEntryDate(e.target.value)}
                  className="w-full px-3 py-1.5 sm:py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold focus:ring-2 focus:ring-sky-500 text-xs sm:text-sm"
                />
              </div>

              {/* SELEÇÃO DE PRESENÇA (SANFONADA NO MOBILE PARA ECONOMIZAR ESPAÇO) */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-2.5 sm:p-3.5 space-y-2">
                <div 
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setIsMobilePresenceOpen(prev => !prev)}
                >
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Users size={14} className="text-sky-600" />
                    <span>Equipe no Canteiro</span>
                  </span>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-sky-700 bg-sky-100/70 px-2 py-0.5 rounded-md border border-sky-200">
                      {presentWorkers.size}/{availableWorkers.length} presentes
                    </span>
                    <button 
                      type="button" 
                      className="text-slate-400 lg:hidden p-0.5"
                    >
                      {isMobilePresenceOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {/* Lista de Presença: Sempre visível no Desktop, sanfonada no Mobile */}
                <div className={`${isMobilePresenceOpen ? 'block' : 'hidden lg:block'} space-y-2 pt-1 border-t border-slate-200/70`}>
                  <div className="flex justify-between items-center text-[10px] text-slate-400">
                    <span>Marque quem compareceu hoje:</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectAllPresent();
                      }}
                      className="font-bold text-sky-600 hover:underline cursor-pointer"
                    >
                      {presentWorkers.size === availableWorkers.length ? 'Desmarcar Todos' : 'Marcar Todos'}
                    </button>
                  </div>

                  {availableWorkers.length > 0 ? (
                    <div className="space-y-1 max-h-36 sm:max-h-48 overflow-y-auto pr-0.5">
                      {availableWorkers.map(worker => {
                        const isPresent = presentWorkers.has(worker.full_name);
                        return (
                          <div
                            key={worker.id}
                            onClick={() => toggleWorkerPresence(worker.full_name)}
                            className={`p-1.5 sm:p-2 rounded-xl border transition flex items-center justify-between cursor-pointer ${
                              isPresent
                                ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-bold shadow-2xs'
                                : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-100 opacity-60'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[8px] sm:text-[9px] font-bold overflow-hidden shrink-0 ${
                                isPresent ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
                              }`}>
                                {worker.avatar_url ? (
                                  <img src={worker.avatar_url} alt="" className="w-full h-full object-cover" />
                                ) : getInitials(worker.full_name)}
                              </div>
                              <div className="min-w-0">
                                <span className="block text-xs truncate leading-tight">{worker.full_name}</span>
                                <span className="text-[9px] text-slate-400 block truncate leading-none mt-0.5">{worker.role_title || 'Colaborador'}</span>
                              </div>
                            </div>

                            <div className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded border flex items-center justify-center shrink-0 ${
                              isPresent ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                            }`}>
                              {isPresent && <Check size={11} />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 italic">
                      Nenhum colaborador alocado nesta obra.
                    </p>
                  )}
                </div>
              </div>

              {/* OBSERVAÇÕES GERAIS (DESKTOP E TABLET) */}
              <div className="hidden sm:block">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Observações Gerais do Canteiro
                </label>
                <textarea
                  rows={2}
                  value={globalNotes}
                  onChange={e => setGlobalNotes(e.target.value)}
                  placeholder="Ex: Clima chuvoso à tarde, entrega de cimento..."
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500 resize-none text-xs"
                />
              </div>

            </div>
          </div>

          {/* COLUNA DIREITA: BUSCA E TAREFAS */}
          <div className="flex-1 flex flex-col min-h-0 bg-slate-50/60 relative">
            
            {/* Barra de Busca de Tarefas */}
            <div className="p-2.5 sm:p-4 border-b border-slate-200 bg-white shrink-0 z-20 shadow-2xs">
              <div className="relative w-full" ref={searchRef}>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => {
                      setSearchTerm(e.target.value);
                      setIsSearchOpen(true);
                    }}
                    onFocus={() => setIsSearchOpen(true)}
                    placeholder="Adicionar tarefa à lista de hoje..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-sky-500 shadow-2xs placeholder-slate-400"
                  />
                </div>

                {/* Popover de Resultados da Busca */}
                {isSearchOpen && (searchTerm.length > 0 || availableTasksToLog.length > 0) && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-56 sm:max-h-72 overflow-y-auto z-50 animate-in fade-in zoom-in-95 duration-100 py-1 divide-y divide-slate-100">
                    {loadingData ? (
                      <div className="p-3 text-center text-xs text-slate-400">
                        <Loader2 size={16} className="animate-spin mx-auto mb-1 text-sky-600" />
                        Carregando tarefas...
                      </div>
                    ) : availableTasksToLog.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-500">
                        Nenhuma tarefa pendente encontrada.
                      </div>
                    ) : (
                      availableTasksToLog.map(task => (
                        <div
                          key={task.id}
                          onClick={() => addTaskToLog(task)}
                          className="px-3.5 py-2 hover:bg-sky-50 cursor-pointer flex items-center justify-between group transition"
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <strong className="block text-xs sm:text-sm text-slate-900 truncate group-hover:text-sky-700 transition">
                              {task.title}
                            </strong>
                            <span className="block text-[10px] text-slate-400 font-medium truncate">
                              {getHierarchyBreadcrumb(task.work_item_id)}
                            </span>
                          </div>
                          <div className="shrink-0 text-[9px] sm:text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg border border-slate-200">
                            {task.has_progress_tracking
                              ? `Faltam ${Math.max(0, task.quantity_planned - (task.quantity_executed || 0))} ${task.unit || 'un'}`
                              : 'Checklist'}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Lista de Tarefas Adicionadas (ROBUSTA NO MOBILE) */}
            <div className="flex-1 overflow-y-auto p-2.5 sm:p-5">
              {entries.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                  <BookOpenCheck size={36} className="text-slate-300 mb-2" />
                  <p className="text-xs sm:text-sm font-bold text-slate-700">Nenhuma tarefa adicionada hoje</p>
                  <p className="text-[11px] max-w-xs text-slate-400 mt-1">
                    Digite no campo de busca acima para incluir as tarefas trabalhadas pela equipe no canteiro.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {entries.map((entry, index) => (
                    <div
                      key={entry.tempId}
                      className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-2xs space-y-2.5 hover:border-slate-300 transition"
                    >
                      {/* LINHA 1: NOME DA TAREFA E LOCALIZAÇÃO (SEMPRE 100% VISÍVEL) */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-800 font-black text-[10px] flex items-center justify-center shrink-0 border border-sky-200 mt-0.5">
                            {index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm leading-snug break-words">
                              {entry.task.title}
                            </h4>
                            <span className="block text-[10px] text-slate-400 font-medium truncate mt-0.5" title={getHierarchyBreadcrumb(entry.task.work_item_id)}>
                              {getHierarchyBreadcrumb(entry.task.work_item_id)}
                            </span>
                          </div>
                        </div>

                        {/* Botão de Excluir */}
                        <button
                          type="button"
                          onClick={() => removeEntry(entry.tempId)}
                          className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer shrink-0"
                          title="Remover do diário"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {/* LINHA 2: CONTROLES DE AVANÇO (QUEBRA LIMPA NO MOBILE) */}
                      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        
                        {/* Toggle de Retrabalho */}
                        <button
                          type="button"
                          onClick={() => updateEntryState(entry.tempId, { isRework: !entry.isRework })}
                          className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border transition flex items-center gap-1 cursor-pointer ${
                            entry.isRework
                              ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                          title="Marcar se foi retrabalho ou conserto"
                        >
                          <RotateCcw size={11} />
                          <span>{entry.isRework ? 'Retrabalho Ativo' : 'Retrabalho'}</span>
                        </button>

                        {/* Controle de Status ou Quantidade */}
                        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                          {entry.task.has_progress_tracking ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-slate-400 font-bold">Feito hoje:</span>
                              <div className="relative">
                                <input
                                  type="text"
                                  value={entry.quantity}
                                  onChange={e => updateEntryState(entry.tempId, { quantity: e.target.value })}
                                  className="w-16 px-2 py-1 bg-white border border-sky-300 rounded-xl text-xs font-black text-sky-950 text-center focus:ring-2 focus:ring-sky-500 shadow-2xs"
                                />
                                <span className="absolute -top-2 -right-2 bg-slate-100 text-slate-600 text-[8px] font-bold px-1 rounded border border-slate-200">
                                  {entry.task.unit || 'un'}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                              <button
                                type="button"
                                onClick={() => updateEntryState(entry.tempId, { actionType: 'progress' })}
                                className={`px-2 py-1 rounded-lg transition text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                                  entry.actionType === 'progress'
                                    ? 'bg-sky-600 text-white shadow-2xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                <PlayCircle size={11} />
                                <span>Em Andamento</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => updateEntryState(entry.tempId, { actionType: 'complete' })}
                                className={`px-2 py-1 rounded-lg transition text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                                  entry.actionType === 'complete'
                                    ? 'bg-emerald-600 text-white shadow-2xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                <CheckSquare size={11} />
                                <span>Concluída</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* LINHA 3: CAMPO DE OBSERVAÇÃO ESPECÍFICO DO ITEM */}
                      <div>
                        <div className="relative">
                          <MessageSquare size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            value={entry.itemNotes}
                            onChange={e => updateEntryState(entry.tempId, { itemNotes: e.target.value })}
                            placeholder="Nota pontual (ex: tubulação obstruída, faltou parafuso)..."
                            className="w-full pl-7 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-1 focus:ring-sky-500"
                          />
                        </div>
                      </div>

                      {/* LINHA 4: QUEM EXECUTOU ESTA TAREFA (FILTRADO POR QUEM FOI HOJE) */}
                      <div className="pt-2 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                            <UserCheck size={11} className="text-sky-600" />
                            <span>Executado por:</span>
                            {entry.executors.length > 0 && (
                              <span className="text-sky-600 font-extrabold">({entry.executors.length})</span>
                            )}
                          </label>
                        </div>

                        {presentWorkersList.length === 0 ? (
                          <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[10px] flex items-center gap-1.5">
                            <UserX size={13} className="text-amber-600 shrink-0" />
                            <span>Marque os colaboradores presentes na lista de equipe à esquerda.</span>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-0.5">
                            {presentWorkersList.map(worker => {
                              const isSelected = entry.executors.includes(worker.full_name);
                              return (
                                <button
                                  type="button"
                                  key={worker.id}
                                  onClick={() => toggleTaskExecutor(entry.tempId, worker.full_name)}
                                  className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border transition flex items-center gap-1 cursor-pointer ${
                                    isSelected
                                      ? 'bg-sky-50 text-sky-800 border-sky-300 font-bold shadow-2xs'
                                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                  }`}
                                >
                                  <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold overflow-hidden shrink-0 ${
                                    isSelected ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-600'
                                  }`}>
                                    {worker.avatar_url ? (
                                      <img src={worker.avatar_url} alt="" className="w-full h-full object-cover" />
                                    ) : getInitials(worker.full_name)}
                                  </div>
                                  <span className="truncate max-w-[120px]">{worker.full_name}</span>
                                  {isSelected && <CheckSquare size={10} className="text-sky-600 ml-0.5 shrink-0" />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RODAPÉ DO MODAL (FIXO E BEM VISÍVEL NO MOBILE) */}
        <div className="bg-white border-t border-slate-200 p-3 sm:px-6 flex items-center justify-between shrink-0 shadow-lg">
          <div className="text-xs font-semibold text-slate-500">
            <strong className="text-slate-900 text-sm font-black">{entries.length}</strong> {entries.length === 1 ? 'tarefa' : 'tarefas'}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 sm:px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || entries.length === 0}
              className="px-4 sm:px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold text-xs sm:text-sm shadow-xs flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span>Salvar Diário</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DailyWorkLogModal;