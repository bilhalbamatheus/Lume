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
  Square,
  BookOpenCheck,
  UserCheck} from 'lucide-react';
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
  isComplete: boolean;
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
  
  // Colaboradores alocados nesta obra (work_members)
  const [availableWorkers, setAvailableWorkers] = useState<AssignedWorkerInfo[]>([]);

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

  // Carregar dados da obra (Itens, Tarefas e Colaboradores Alocados via work_members)
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
          .eq('status', 'pendente') // busca tarefas pendentes e em andamento
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

      // Filtrar apenas tarefas pertencentes aos itens desta obra
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

      // 2. Fallback caso a obra ainda não tenha colaboradores vinculados
      if (assignedList.length > 0) {
        setAvailableWorkers(assignedList);
      } else {
        const fallbackList: AssignedWorkerInfo[] = [];
        (companyMembersRes.data || []).forEach((m: any) => {
          const prof = Array.isArray(m.profile) ? m.profile[0] : m.profile;
          if (prof) {
            fallbackList.push({
              id: prof.id,
              full_name: prof.full_name || 'Sem nome',
              role_title: prof.role_title || 'Colaborador',
              avatar_url: prof.avatar_url || null
            });
          }
        });
        setAvailableWorkers(fallbackList);
      }
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

  // Mapa de itens para montar a hierarquia visual (Breadcrumb)
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

  // Tarefas filtradas na busca
  const availableTasksToLog = useMemo(() => {
    const q = searchTerm.toLowerCase();
    const addedTaskIds = entries.map(e => e.task.id);

    return workTasks.filter(t => {
      if (t.status === 'concluida' || addedTaskIds.includes(t.id)) return false;
      if (!q) return true;
      const parentTitle = getHierarchyBreadcrumb(t.work_item_id).toLowerCase();
      return t.title.toLowerCase().includes(q) || parentTitle.includes(q);
    });
  }, [workTasks, searchTerm, entries, itemsMap]);

  // Adicionar tarefa ao diário
  const addTaskToLog = (task: WorkTask) => {
    const remaining = task.has_progress_tracking
      ? Math.max(0, task.quantity_planned - (task.quantity_executed || 0)).toString()
      : '1';

    setEntries(prev => [
      {
        tempId: Math.random().toString(36).substr(2, 9),
        task,
        quantity: remaining,
        isComplete: !task.has_progress_tracking,
        executors: [] // Começa limpo para selecionar os colaboradores desta atividade específica
      },
      ...prev
    ]);
    setSearchTerm('');
    setIsSearchOpen(false);
  };

  const removeEntry = (tempId: string) => {
    setEntries(prev => prev.filter(e => e.tempId !== tempId));
  };

  const updateEntryQty = (tempId: string, val: string) => {
    setEntries(prev => prev.map(e => e.tempId === tempId ? { ...e, quantity: val } : e));
  };

  const toggleEntryChecklist = (tempId: string) => {
    setEntries(prev => prev.map(e => e.tempId === tempId ? { ...e, isComplete: !e.isComplete } : e));
  };

  // Alternar executor de uma tarefa específica
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
        const qty = e.task.has_progress_tracking
          ? parseFloat(e.quantity.replace(',', '.')) || 0
          : (e.isComplete ? 1 : 0);

        return {
          company_id: user.company.id,
          work_id: selectedWorkId,
          work_item_id: e.task.work_item_id,
          work_task_id: e.task.id,
          entry_date: entryDate,
          quantity_executed: qty,
          team_id: null,
          executed_by: e.executors, // Executores específicos desta atividade
          notes: globalNotes || null,
          created_by: user?.profile?.id || null,
        };
      }).filter(e => e.quantity_executed > 0);

      if (payload.length === 0) {
        alert('Nenhum apontamento com avanço para salvar. Preencha as quantidades.');
        setIsSaving(false);
        return;
      }

      // 1. Inserir apontamentos no diário (work_task_entries)
      const { error: insertError } = await supabase
        .from('work_task_entries')
        .insert(payload);

      if (insertError) throw insertError;

      // 2. Atualizar avanço acumulado e executores das tarefas executadas
      for (const entry of entries) {
        const qty = entry.task.has_progress_tracking
          ? parseFloat(entry.quantity.replace(',', '.')) || 0
          : (entry.isComplete ? 1 : 0);

        if (qty <= 0) continue;

        const currentExecuted = entry.task.quantity_executed || 0;
        const newExecuted = entry.task.has_progress_tracking
          ? currentExecuted + qty
          : 1;

        const isFullyDone = entry.task.has_progress_tracking
          ? newExecuted >= entry.task.quantity_planned
          : entry.isComplete;

        // Combina executores anteriores com os do dia
        const existingExecutors = entry.task.executed_by || [];
        const mergedExecutors = Array.from(new Set([...existingExecutors, ...entry.executors]));

        await supabase
          .from('work_tasks')
          .update({
            quantity_executed: newExecuted,
            executed_by: mergedExecutors,
            status: isFullyDone ? 'concluida' : 'em_andamento',
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

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-2xs animate-in fade-in duration-200">
      <div className="bg-slate-50 border border-slate-200 rounded-3xl w-full max-w-5xl shadow-2xl flex flex-col h-[94vh] sm:h-[88vh] animate-in zoom-in-95 duration-200 overflow-hidden">
        
        {/* CABEÇALHO DO MODAL */}
        <div className="bg-white px-4 sm:px-6 py-3.5 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <BookOpenCheck size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">Diário de Obra</h2>
              <p className="text-[11px] sm:text-xs font-medium text-slate-500">Lançamento diário de atividades e medição de campo</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* CORPO: DIVIDIDO EM 2 COLUNAS (FLEXÍVEL E RESPONSIVO) */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          
          {/* COLUNA ESQUERDA: PARÂMETROS GERAIS DO DIA E EQUIPE DA OBRA */}
          <div className="w-full lg:w-80 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 shrink-0 flex flex-col overflow-y-auto max-h-56 lg:max-h-full">
            <div className="p-4 sm:p-5 space-y-4 sm:space-y-5 text-xs">
              
              {/* DATA DO SERVIÇO */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Data da Execução *
                </label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={entryDate}
                    onChange={e => setEntryDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold focus:ring-2 focus:ring-sky-500 text-xs sm:text-sm"
                  />
                </div>
              </div>

              {/* INFORMATIVO: COLABORADORES ALOCADOS NESTA OBRA */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 sm:p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Users size={13} className="text-sky-600" />
                    <span>Equipe no Canteiro</span>
                  </span>
                  <span className="text-[10px] font-extrabold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                    {availableWorkers.length} {availableWorkers.length === 1 ? 'membro' : 'membros'}
                  </span>
                </div>

                {availableWorkers.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-0.5">
                    {availableWorkers.map(worker => (
                      <span
                        key={worker.id}
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 shadow-2xs"
                        title={worker.role_title || 'Colaborador'}
                      >
                        <span className="w-3.5 h-3.5 rounded-full bg-sky-600 text-white font-bold text-[7px] flex items-center justify-center shrink-0">
                          {getInitials(worker.full_name)}
                        </span>
                        <span className="truncate max-w-[110px]">{worker.full_name}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400 italic">
                    Nenhum colaborador alocado nesta obra. Todos os membros da empresa estão disponíveis.
                  </p>
                )}
              </div>

              {/* OBSERVAÇÕES DO DIA */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Observações de Campo
                </label>
                <textarea
                  rows={3}
                  value={globalNotes}
                  onChange={e => setGlobalNotes(e.target.value)}
                  placeholder="Ex: Chuva na parte da tarde, atraso na entrega de cimento..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500 resize-none text-xs"
                />
              </div>

            </div>
          </div>

          {/* COLUNA DIREITA: BUSCA DE TAREFAS E ATRIBUIÇÃO DE EXECUTORES */}
          <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50 relative">
            
            {/* Barra de Busca de Tarefas */}
            <div className="p-3 sm:p-4 border-b border-slate-200 bg-white shrink-0 z-20">
              <div className="relative max-w-xl" ref={searchRef}>
                <div className="relative">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => {
                      setSearchTerm(e.target.value);
                      setIsSearchOpen(true);
                    }}
                    onFocus={() => setIsSearchOpen(true)}
                    placeholder="Buscar tarefas na EAP para apontar avanço..."
                    className="w-full pl-10 pr-4 py-2 sm:py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-sky-500 shadow-xs placeholder-slate-400"
                  />
                </div>

                {isSearchOpen && (searchTerm.length > 0 || availableTasksToLog.length > 0) && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-64 sm:max-h-72 overflow-y-auto z-50 animate-in fade-in zoom-in-95 duration-100 py-1 divide-y divide-slate-100">
                    {loadingData ? (
                      <div className="p-4 text-center text-xs text-slate-400">
                        <Loader2 size={16} className="animate-spin mx-auto mb-1 text-sky-600" />
                        Carregando tarefas...
                      </div>
                    ) : availableTasksToLog.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500">
                        Nenhuma tarefa pendente encontrada.
                      </div>
                    ) : (
                      availableTasksToLog.map(task => (
                        <div
                          key={task.id}
                          onClick={() => addTaskToLog(task)}
                          className="px-4 py-2 hover:bg-sky-50 cursor-pointer flex items-center justify-between group transition"
                        >
                          <div className="min-w-0 flex-1 pr-3">
                            <strong className="block text-xs sm:text-sm text-slate-900 truncate group-hover:text-sky-700 transition">
                              {task.title}
                            </strong>
                            <span className="block text-[10px] text-slate-400 font-medium truncate mt-0.5">
                              {getHierarchyBreadcrumb(task.work_item_id)}
                            </span>
                          </div>
                          <div className="shrink-0 text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg border border-slate-200">
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

            {/* Lista de Tarefas Adicionadas */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-5">
              {entries.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                  <BookOpenCheck size={40} className="text-slate-300 mb-2.5" />
                  <p className="text-xs sm:text-sm font-bold text-slate-700">Nenhuma tarefa adicionada hoje</p>
                  <p className="text-[11px] max-w-xs text-slate-400 mt-1">
                    Digite o nome da atividade no campo de busca acima para apontar as quantidades executadas.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {entries.map((entry, index) => (
                    <div
                      key={entry.tempId}
                      className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-2xs space-y-2.5 hover:border-slate-300 transition"
                    >
                      {/* Topo do Card: Nome da Tarefa, Quantidade e Excluir */}
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px] flex items-center justify-center shrink-0 border border-slate-200 mt-0.5">
                            {index + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-slate-900 text-xs sm:text-sm truncate" title={entry.task.title}>
                              {entry.task.title}
                            </h4>
                            <span className="block text-[10px] text-slate-400 font-medium truncate mt-0.5" title={getHierarchyBreadcrumb(entry.task.work_item_id)}>
                              {getHierarchyBreadcrumb(entry.task.work_item_id)}
                            </span>
                          </div>
                        </div>

                        {/* Controles de Quantidade / Conclusão */}
                        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                          {entry.task.has_progress_tracking ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-slate-400 font-bold hidden sm:inline">Qtd Feita:</span>
                              <div className="relative">
                                <input
                                  type="text"
                                  value={entry.quantity}
                                  onChange={e => updateEntryQty(entry.tempId, e.target.value)}
                                  className="w-16 sm:w-20 px-2 py-1 bg-white border border-sky-300 rounded-xl text-xs sm:text-sm font-black text-sky-950 text-center focus:ring-2 focus:ring-sky-500 shadow-2xs"
                                />
                                <span className="absolute -top-2 -right-2 bg-slate-100 text-slate-600 text-[9px] font-bold px-1.5 py-0.2 rounded border border-slate-200">
                                  {entry.task.unit || 'un'}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => toggleEntryChecklist(entry.tempId)}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-bold transition cursor-pointer ${
                                entry.isComplete
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                              }`}
                            >
                              {entry.isComplete ? <CheckSquare size={14} className="text-emerald-600" /> : <Square size={14} />}
                              <span>{entry.isComplete ? 'Concluída' : 'Pendente'}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => removeEntry(entry.tempId)}
                            className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Remover do relatório"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {/* EXECUTORES ESPECÍFICOS DESTA TAREFA */}
                      <div className="pt-2 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                            <UserCheck size={11} className="text-sky-600" />
                            <span>Quem executou esta tarefa?</span>
                            {entry.executors.length > 0 && (
                              <span className="text-sky-600 font-extrabold">({entry.executors.length})</span>
                            )}
                          </label>
                        </div>

                        {availableWorkers.length === 0 ? (
                          <p className="text-[10px] text-slate-400 italic">Nenhum colaborador encontrado.</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-0.5">
                            {availableWorkers.map(worker => {
                              const isSelected = entry.executors.includes(worker.full_name);
                              return (
                                <button
                                  type="button"
                                  key={worker.id}
                                  onClick={() => toggleTaskExecutor(entry.tempId, worker.full_name)}
                                  className={`px-2 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-semibold border transition flex items-center gap-1.5 cursor-pointer ${
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
                                  <span>{worker.full_name}</span>
                                  {isSelected && <CheckSquare size={11} className="text-sky-600 ml-0.5" />}
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

        {/* RODAPÉ DO MODAL */}
        <div className="bg-white border-t border-slate-200 p-3 sm:px-6 flex items-center justify-between shrink-0">
          <div className="text-xs font-semibold text-slate-500">
            <strong className="text-slate-900 text-sm">{entries.length}</strong> {entries.length === 1 ? 'tarefa lançada' : 'tarefas lançadas'}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 sm:px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || entries.length === 0}
              className="px-4 sm:px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold text-xs sm:text-sm shadow-xs flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              <span>Salvar Diário</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DailyWorkLogModal;