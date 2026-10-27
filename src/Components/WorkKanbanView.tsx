import React, { useState, useMemo } from 'react';
import type { WorkItem, WorkTask } from './WorkItemRow';
import {
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  CornerDownRight,
  Edit2,
  CheckSquare,
  Square,
  Sliders,
  DollarSign,
  ChevronRight,
  Layers,
  ArrowRight
} from 'lucide-react';

interface WorkKanbanViewProps {
  items: WorkItem[];
  rawItems: WorkItem[];
  availableItemTypes: Array<{ id: string; title: string }>;
  measurementType: 'por_subitem' | 'por_item' | 'sem_medicao';
  onToggleTaskStatus: (item: WorkItem, task: WorkTask) => void;
  onSelectItemForDrawer: (item: WorkItem) => void;
  onOpenEditItemModal: (item: WorkItem) => void;
  onOpenDeleteItemModal: (item: WorkItem) => void;
  onOpenEditTaskModal: (task: WorkTask) => void;
  onOpenCreateChildModal: (parentId: string, parentTitle: string) => void;
}

export const WorkKanbanView: React.FC<WorkKanbanViewProps> = ({
  items,
  rawItems,
  availableItemTypes,
  measurementType,
  onToggleTaskStatus,
  onSelectItemForDrawer,
  onOpenEditItemModal,
  onOpenDeleteItemModal,
  onOpenEditTaskModal,
  onOpenCreateChildModal
}) => {
  const [groupBy, setGroupBy] = useState<'type' | 'status'>('type');
  const [expandedSubtasks, setExpandedSubtasks] = useState<Record<string, boolean>>({});

  const toggleSubtasks = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedSubtasks(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Mapeamento para identificar o título do item pai
  const itemMap = useMemo(() => {
    const map = new Map<string, string>();
    rawItems.forEach(i => map.set(i.id, i.title));
    return map;
  }, [rawItems]);

  // Colunas por Status Operacional no padrão do app
  const statusColumns = [
    { key: 'nao_iniciado', label: 'Não iniciado', dotColor: 'bg-slate-400', topBorder: 'border-t-slate-400' },
    { key: 'em_andamento', label: 'Em andamento', dotColor: 'bg-amber-500', topBorder: 'border-t-amber-500' },
    { key: 'bloqueado', label: 'Com Impedimento', dotColor: 'bg-rose-500', topBorder: 'border-t-rose-500' },
    { key: 'concluido', label: 'Concluído', dotColor: 'bg-emerald-500', topBorder: 'border-t-emerald-500' }
  ];

  // Colunas por Tipo de Item no padrão do app
  const typeColumns = useMemo(() => {
    const palette = [
      { dot: 'bg-sky-500', border: 'border-t-sky-500' },
      { dot: 'bg-indigo-500', border: 'border-t-indigo-500' },
      { dot: 'bg-emerald-500', border: 'border-t-emerald-500' },
      { dot: 'bg-amber-500', border: 'border-t-amber-500' },
      { dot: 'bg-purple-500', border: 'border-t-purple-500' }
    ];

    const list = availableItemTypes.map((t, idx) => ({
      key: t.id,
      label: t.title,
      dotColor: palette[idx % palette.length].dot,
      topBorder: palette[idx % palette.length].border
    }));

    list.push({
      key: 'sem_tipo',
      label: 'Personalizados / Outros',
      dotColor: 'bg-slate-400',
      topBorder: 'border-t-slate-400'
    });

    return list;
  }, [availableItemTypes]);

  // Agrupamento dos itens
  const columnsData = useMemo(() => {
    if (groupBy === 'status') {
      return statusColumns.map(col => {
        const colItems = items.filter(item => {
          if (col.key === 'concluido') return item.progress_percent >= 100 || item.status === 'concluido';
          if (col.key === 'bloqueado') return item.status === 'bloqueado';
          if (col.key === 'em_andamento') return item.progress_percent > 0 && item.progress_percent < 100;
          return item.status === 'nao_iniciado' && (!item.progress_percent || item.progress_percent === 0);
        });

        const totalValue = colItems.reduce((acc, i) => acc + (i.unit_price || 0), 0);
        return { ...col, items: colItems, totalValue };
      });
    } else {
      return typeColumns.map(col => {
        const colItems = items.filter(item => {
          if (col.key === 'sem_tipo') return !item.template_item_id;
          return item.template_item_id === col.key;
        });

        const totalValue = colItems.reduce((acc, i) => acc + (i.unit_price || 0), 0);
        return { ...col, items: colItems, totalValue };
      });
    }
  }, [groupBy, items, typeColumns]);

  return (
    <div className="space-y-4">
      {/* Estilo local para garantir o visual idêntico da barra de rolagem */}
      <style>{`
        .custom-kanban-scroll::-webkit-scrollbar {
          width: 5px;
          height: 6px;
        }
        .custom-kanban-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-kanban-scroll::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 9999px;
        }
        .custom-kanban-scroll::-webkit-scrollbar-thumb:hover {
          background-color: #94a3b8;
        }
        .custom-kanban-scroll {
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 transparent;
        }
      `}</style>

      {/* SELETOR DE AGRUPAMENTO PADRONIZADO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-sky-50 text-sky-600 rounded-xl border border-sky-100">
            <Sliders size={15} />
          </div>
          <span className="text-xs font-bold text-slate-800">Organizar Colunas por:</span>
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setGroupBy('type')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                groupBy === 'type' ? 'bg-white text-sky-700 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Tipo de Item / Frente
            </button>
            <button
              type="button"
              onClick={() => setGroupBy('status')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                groupBy === 'status' ? 'bg-white text-sky-700 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Status Operacional
            </button>
          </div>
        </div>

        <span className="text-[11px] text-slate-400 font-medium">
          {items.length} itens no canteiro
        </span>
      </div>

      {/* QUADRO KANBAN (ROLAGEM HORIZONTAL PADRONIZADA) */}
      <div className="flex gap-4 overflow-x-auto pb-4 items-start min-h-[520px] custom-kanban-scroll">
        {columnsData.map(col => (
          <div
            key={col.key}
            className={`w-80 shrink-0 bg-slate-100/60 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col overflow-hidden ${col.topBorder} border-t-[3px]`}
          >
            {/* CABEÇALHO PADRONIZADO COM FUNDO BRANCO */}
            <div className="p-3 bg-white border-b border-slate-200/80 flex items-center justify-between select-none">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2 h-2 rounded-full ${col.dotColor} shrink-0`} />
                <span className="font-bold text-xs text-slate-800 truncate">{col.label}</span>
                <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                  {col.items.length}
                </span>
              </div>

              {col.totalValue > 0 && measurementType === 'por_item' && (
                <span className="text-[11px] font-black text-slate-700">
                  R$ {col.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              )}
            </div>

            {/* LISTA DE CARDS (ROLAGEM VERTICAL FINA E SEM SETAS) */}
            <div className="p-2.5 space-y-2.5 overflow-y-auto max-h-[calc(100vh-340px)] custom-kanban-scroll">
              {col.items.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-300 rounded-2xl bg-white/40 my-1">
                  Nenhum item nesta etapa
                </div>
              ) : (
                col.items.map(item => {
                  const isDone = item.progress_percent >= 100;
                  const hasTasks = item.tasks && item.tasks.length > 0;
                  const showSubtasks = expandedSubtasks[item.id] !== false;
                  const parentTitle = item.parent_id ? itemMap.get(item.parent_id) : null;

                  return (
                    <div
                      key={item.id}
                      onClick={() => onSelectItemForDrawer(item)}
                      className="bg-white border border-slate-200 hover:border-sky-300 rounded-2xl p-3 shadow-2xs hover:shadow-xs transition group space-y-2 cursor-pointer relative"
                    >
                      {/* SUBORDINADO DE QUEM? */}
                      {parentTitle && (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg w-fit truncate max-w-full">
                          <CornerDownRight size={11} className="shrink-0" />
                          <span className="truncate">Parte de: {parentTitle}</span>
                        </div>
                      )}

                      {/* TOPO DO CARD: TAGS DE IDENTIFICAÇÃO */}
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          {item.code ? (
                            <span className="font-mono text-[9px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-100">
                              {item.code}
                            </span>
                          ) : (
                            <span className="font-mono text-[9px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                              ITEM
                            </span>
                          )}

                          {parentTitle && (
                            <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded truncate max-w-[150px] flex items-center gap-0.5">
                              <CornerDownRight size={10} className="shrink-0" />
                              <span className="truncate">{parentTitle}</span>
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            onOpenEditItemModal(item);
                          }}
                          className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer transition opacity-0 group-hover:opacity-100"
                          title="Editar Item"
                        >
                          <Edit2 size={12} />
                        </button>
                      </div>

                      {/* TÍTULO DO ITEM */}
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-sky-600 transition-colors leading-snug">
                          {item.title}
                        </h4>
                      </div>

                      {/* BARRA DE PROGRESSO */}
                      <div>
                        <div className="flex justify-between text-[10px] font-semibold text-slate-400 mb-0.5">
                          <span>Progresso</span>
                          <span className={`font-bold ${isDone ? 'text-emerald-600' : 'text-sky-600'}`}>
                            {item.progress_percent}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                              isDone ? 'bg-emerald-500' : 'bg-sky-500'
                            }`}
                            style={{ width: `${item.progress_percent}%` }}
                          />
                        </div>
                      </div>

                      {/* SUBTAREFAS EXPANSÍVEIS */}
                      {hasTasks && (
                        <div className="pt-1.5 border-t border-slate-100 space-y-1" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400">
                            <span>Subtarefas ({item.tasks?.length || 0})</span>
                            <button
                              type="button"
                              onClick={e => toggleSubtasks(item.id, e)}
                              className="text-sky-600 hover:underline cursor-pointer text-[10px]"
                            >
                              {showSubtasks ? 'Recolher' : 'Ver'}
                            </button>
                          </div>

                          {showSubtasks && (
                            <div className="space-y-1 pl-1.5 border-l-2 border-slate-200 pt-0.5">
                              {item.tasks?.map(task => {
                                const isTaskDone = task.status === 'concluida';
                                return (
                                  <div
                                    key={task.id}
                                    className="p-1.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-1 text-[11px]"
                                  >
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                      <button
                                        type="button"
                                        onClick={() => onToggleTaskStatus(item, task)}
                                        className="text-slate-400 hover:text-emerald-600 shrink-0 cursor-pointer"
                                      >
                                        {isTaskDone ? <CheckSquare size={13} className="text-emerald-600" /> : <Square size={13} />}
                                      </button>
                                      <span className={`truncate text-[10px] ${isTaskDone ? 'line-through text-slate-400' : 'text-slate-700 font-medium'}`}>
                                        {task.title}
                                      </span>
                                    </div>

                                    {task.has_progress_tracking && (
                                      <span className="text-[9px] bg-white border border-slate-200 px-1 py-0.2 rounded font-bold text-slate-500 shrink-0">
                                        {task.quantity_executed}/{task.quantity_planned}
                                      </span>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => onOpenEditTaskModal(task)}
                                      className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                                    >
                                      <Edit2 size={10} />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* RODAPÉ DO CARD: PRAZO, VALOR E AÇÃO */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        {measurementType === 'por_item' && item.unit_price > 0 ? (
                          <span className="font-extrabold text-slate-900 text-[11px]">
                            R$ {item.unit_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        ) : item.due_date ? (
                          <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                            <Calendar size={11} className="text-slate-400" />
                            {new Date(item.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Sem data</span>
                        )}

                        <span className="text-sky-600 hover:text-sky-700 text-[11px] font-bold flex items-center gap-0.5">
                          Detalhes
                          <ChevronRight size={12} />
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};