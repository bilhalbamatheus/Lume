import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Compass,
  HardHat,
  Search,
  Calendar,
  Building2,
  RefreshCw} from 'lucide-react';

interface ProjectItem {
  id: string;
  code?: string | null;
  title: string;
  scope_type: 'projeto' | 'execucao' | 'turnkey';
  status: 'em_andamento' | 'concluido' | 'pausado' | 'cancelado';
  stage: string;
  contact_id: string;
  assigned_to?: string | null;
  estimated_completion_date?: string | null;
  created_at: string;
  contact?: {
    id: string;
    display_name: string;
    type: 'person' | 'company';
  } | null;
  assigned_profile?: {
    id: string;
    full_name: string;
    avatar_url?: string | null;
  } | null;
}

interface ProjectsViewProps {
  mode: 'projeto' | 'obra';
  onOpenProjectDetail?: (id: string) => void;
  onOpenContactModal?: (contactId: string) => void;
}

const PROJECT_STAGES = [
  { id: 'prj_vistoria', label: 'Levantamento & Vistoria', color: '#0284c7' },
  { id: 'prj_elaboracao', label: 'Elaboração do Projeto', color: '#8b5cf6' },
  { id: 'prj_protocolo', label: 'Análise / Protocolo', color: '#f59e0b' },
  { id: 'prj_aprovado', label: 'Projeto Aprovado', color: '#10b981' },
];

const WORK_STAGES = [
  { id: 'obra_suprimentos', label: 'Planejamento & Suprimentos', color: '#0284c7' },
  { id: 'obra_execucao', label: 'Execução em Andamento', color: '#f59e0b' },
  { id: 'obra_testes', label: 'Comissionamento & Testes', color: '#8b5cf6' },
  { id: 'obra_entregue', label: 'Obra Concluída & Entregue', color: '#10b981' },
];

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  mode,
  onOpenProjectDetail,
  onOpenContactModal
}) => {
  const { user } = useAuth();
  const [items, setItems] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Drag and Drop
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);

  const isProjectMode = mode === 'projeto';
  const currentStages = isProjectMode ? PROJECT_STAGES : WORK_STAGES;
  const targetScope = isProjectMode ? 'projeto' : 'execucao';

  const loadData = async () => {
    try {
      setLoading(true);
      const companyId = user?.company?.id;
      if (!companyId) return;

      const { data, error } = await supabase
        .from('projects')
        .select(`
          id,
          code,
          title,
          scope_type,
          status,
          stage,
          contact_id,
          assigned_to,
          estimated_completion_date,
          created_at,
          contact:contacts!contact_id (
            id,
            display_name,
            type
          ),
          assigned_profile:profiles!assigned_to (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq('company_id', companyId)
        .eq('scope_type', targetScope)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped: ProjectItem[] = (data || []).map((p: any) => {
        let normalizedStage = p.stage;
        // Compatibilidade com registos anteriores criados com etapa genérica 'vistoria'
        if (normalizedStage === 'vistoria') {
          normalizedStage = isProjectMode ? 'prj_vistoria' : 'obra_suprimentos';
        }

        return {
          ...p,
          stage: normalizedStage,
          contact: Array.isArray(p.contact) ? p.contact[0] : p.contact,
          assigned_profile: Array.isArray(p.assigned_profile) ? p.assigned_profile[0] : p.assigned_profile
        };
      });

      setItems(mapped);
    } catch (err) {
      console.error(`Erro ao carregar ${isProjectMode ? 'projetos' : 'obras'}:`, err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.company?.id, mode]);

  // Drag & Drop
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    if (dragOverStageId !== stageId) {
      setDragOverStageId(stageId);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || draggedId;
    setDragOverStageId(null);
    setDraggedId(null);

    if (!id) return;

    const currentItem = items.find((p) => p.id === id);
    if (!currentItem || currentItem.stage === targetStage) return;

    const previousStage = currentItem.stage;
    const isCompleted = targetStage === (isProjectMode ? 'prj_aprovado' : 'obra_entregue');

    setItems((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              stage: targetStage,
              status: isCompleted ? 'concluido' : 'em_andamento'
            }
          : p
      )
    );

    try {
      const { error } = await supabase
        .from('projects')
        .update({
          stage: targetStage,
          status: isCompleted ? 'concluido' : 'em_andamento',
          actual_completion_date: isCompleted ? new Date().toISOString().split('T')[0] : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
    } catch (err) {
      console.error('Erro ao mover etapa:', err);
      setItems((prev) =>
        prev.map((p) => (p.id === id ? { ...p, stage: previousStage } : p))
      );
    }
  };

  const filteredItems = items.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      (p.code && p.code.toLowerCase().includes(q)) ||
      (p.contact?.display_name && p.contact.display_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="h-full w-full flex flex-col p-4 sm:p-6 min-w-0 overflow-hidden box-border">
      {/* Topo do Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl border ${
                isProjectMode
                  ? 'bg-sky-50 text-sky-600 border-sky-200'
                  : 'bg-amber-50 text-amber-600 border-amber-200'
              }`}
            >
              {isProjectMode ? <Compass size={20} /> : <HardHat size={20} />}
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {isProjectMode ? 'Projetos de Engenharia' : 'Execução de Obras'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                {isProjectMode
                  ? 'Acompanhamento de levantamentos, memoriais, diagramas e homologações.'
                  : 'Acompanhamento do cronograma de campo, montagem, comissionamento e vistorias.'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            className="p-2 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer"
            title="Atualizar lista"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-sky-600' : ''} />
          </button>
        </div>
      </div>

      {/* Barra de Busca e Indicador */}
      <div className="bg-white p-2.5 rounded-2xl border border-slate-200/80 shadow-2xs mb-3 flex items-center justify-between gap-3 shrink-0">
        <span className="text-xs font-bold text-slate-600 px-2">
          Total: {filteredItems.length} {isProjectMode ? 'projetos' : 'obras'}
        </span>

        <div className="relative w-full max-w-sm">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código, título ou cliente..."
            className="w-full pl-9 pr-4 py-1.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-800"
          />
        </div>
      </div>

      {/* Quadro Kanban Específico */}
      <div className="flex-1 min-h-0 overflow-x-auto pb-3 flex gap-3.5 select-none snap-x snap-mandatory [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
        {currentStages.map((st) => {
          const stageItems = filteredItems.filter((p) => p.stage === st.id);
          const isOver = dragOverStageId === st.id;

          return (
            <div
              key={st.id}
              onDragOver={(e) => handleDragOver(e, st.id)}
              onDrop={(e) => handleDrop(e, st.id)}
              onDragLeave={() => setDragOverStageId(null)}
              className={`w-[85vw] sm:w-80 shrink-0 h-full flex flex-col bg-slate-100/70 border rounded-2xl overflow-hidden transition-all duration-300 snap-center ${
                isOver ? 'border-sky-400 bg-sky-50/50 ring-2 ring-sky-300 ring-inset' : 'border-slate-200/90'
              }`}
            >
              <div
                className="p-3 bg-white border-b border-slate-200/80 shrink-0"
                style={{ borderTop: `3px solid ${st.color}` }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: st.color }} />
                    <h3 className="font-bold text-xs text-slate-800">{st.label}</h3>
                  </div>
                  <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[11px] font-bold">
                    {stageItems.length}
                  </span>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2.5">
                {stageItems.length === 0 ? (
                  <div className="h-28 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-xl text-xs text-slate-400 italic">
                    Nenhum item nesta etapa
                  </div>
                ) : (
                  stageItems.map((p) => (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, p.id)}
                      onClick={() => onOpenProjectDetail?.(p.id)}
                      className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs hover:shadow-md hover:border-sky-300 transition-all cursor-pointer space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          {p.code && (
                            <span
                              className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                isProjectMode
                                  ? 'bg-sky-50 text-sky-700 border border-sky-200/70'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200/70'
                              }`}
                            >
                              {p.code}
                            </span>
                          )}
                          <h4 className="font-bold text-slate-900 text-xs sm:text-sm line-clamp-2">
                            {p.title}
                          </h4>
                        </div>
                      </div>

                      {p.contact && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onOpenContactModal && p.contact?.id) {
                              onOpenContactModal(p.contact.id);
                            }
                          }}
                          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-sky-600 transition-colors"
                        >
                          <Building2 size={13} className="text-slate-400 shrink-0" />
                          <span className="truncate hover:underline">{p.contact.display_name}</span>
                        </div>
                      )}

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                        {p.estimated_completion_date ? (
                          <span className="flex items-center gap-1 text-[11px] text-slate-600 font-medium">
                            <Calendar size={11} className="text-slate-400" />
                            {new Date(p.estimated_completion_date).toLocaleDateString('pt-BR')}
                          </span>
                        ) : (
                          <span className="text-[10px] italic">Sem prazo</span>
                        )}

                        {p.assigned_profile && (
                          <div
                            className="h-5 w-5 rounded-full overflow-hidden bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-[9px]"
                            title={`Responsável: ${p.assigned_profile.full_name}`}
                          >
                            {p.assigned_profile.avatar_url ? (
                              <img
                                src={p.assigned_profile.avatar_url}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              p.assigned_profile.full_name.charAt(0).toUpperCase()
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};