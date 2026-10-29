import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  X,
  HardHat,
  Kanban as KanbanIcon,
  Plus,
  Edit3,
  Trash2,
  ChevronUp,
  ChevronDown,
  Loader2,
  Save,
  AlertCircle
} from 'lucide-react';

export interface WorkStageConfig {
  id: string;
  company_id?: string;
  name: string;
  color: string;
  sort_order: number;
}

interface WorkSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStagesUpdated?: () => void;
}

export const WorkSettingsModal: React.FC<WorkSettingsModalProps> = ({
  isOpen,
  onClose,
  onStagesUpdated
}) => {
  const { user } = useAuth();

  // Estados das Etapas
  const [workStages, setWorkStages] = useState<WorkStageConfig[]>([]);
  const [loadingStages, setLoadingStages] = useState(false);
  const [isEditingStageModal, setIsEditingStageModal] = useState(false);
  const [editingStage, setEditingStage] = useState<Partial<WorkStageConfig> | null>(null);
  const [stageToDelete, setStageToDelete] = useState<WorkStageConfig | null>(null);
  const [deletingStage, setDeletingStage] = useState(false);
  const [stageWorkCount, setStageWorkCount] = useState<number>(0);
  const [checkingStageCount, setCheckingStageCount] = useState(false);
  const [savingStage, setSavingStage] = useState(false);

  // Carregar etapas com inicialização de dados padrão (seed)
  const loadWorkStages = useCallback(async () => {
    const companyId = user?.company?.id;
    if (!companyId) return;

    try {
      setLoadingStages(true);
      const { data, error } = await supabase
        .from('work_pipeline_stages')
        .select('*')
        .eq('company_id', companyId)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        const seedStages = [
          { company_id: companyId, name: 'Planejamento', color: '#f59e0b', sort_order: 1 },
          { company_id: companyId, name: 'Em andamento', color: '#0ea5e9', sort_order: 2 },
          { company_id: companyId, name: 'Comissionamento e testes', color: '#8b5cf6', sort_order: 3 },
          { company_id: companyId, name: 'Obra Concluída', color: '#10b981', sort_order: 4 }
        ];

        const { data: createdSeed, error: seedError } = await supabase
          .from('work_pipeline_stages')
          .insert(seedStages)
          .select();

        if (seedError) throw seedError;
        setWorkStages(createdSeed || []);
        onStagesUpdated?.();
      } else {
        setWorkStages(data);
      }
    } catch (err: any) {
      console.error('Erro ao carregar etapas de obras:', err);
    } finally {
      setLoadingStages(false);
    }
  }, [user?.company?.id, onStagesUpdated]);

  useEffect(() => {
    if (isOpen) {
      loadWorkStages();
    }
  }, [isOpen, loadWorkStages]);

  // Reordenação de etapas
  const handleMoveStage = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= workStages.length) return;

    const currentStages = [...workStages];
    const current = { ...currentStages[index] };
    const target = { ...currentStages[targetIndex] };

    const tempOrder = current.sort_order;
    current.sort_order = target.sort_order;
    target.sort_order = tempOrder;

    currentStages[index] = target;
    currentStages[targetIndex] = current;
    setWorkStages(currentStages);

    try {
      const { error: err1 } = await supabase
        .from('work_pipeline_stages')
        .update({ sort_order: current.sort_order })
        .eq('id', current.id);
      if (err1) throw err1;

      const { error: err2 } = await supabase
        .from('work_pipeline_stages')
        .update({ sort_order: target.sort_order })
        .eq('id', target.id);
      if (err2) throw err2;

      onStagesUpdated?.();
    } catch (err: any) {
      console.error('Erro ao reordenar etapa:', err);
      await loadWorkStages();
    }
  };

  // Salvar/Editar etapa
  const handleSaveStageModal = async (e: React.FormEvent) => {
    e.preventDefault();
    const companyId = user?.company?.id;
    if (!editingStage?.name?.trim() || !companyId) return;

    try {
      setSavingStage(true);
      if (editingStage.id) {
        const { error } = await supabase
          .from('work_pipeline_stages')
          .update({
            name: editingStage.name.trim(),
            color: editingStage.color || '#0ea5e9'
          })
          .eq('id', editingStage.id);

        if (error) throw error;
      } else {
        const nextOrder = workStages.length > 0
          ? Math.max(...workStages.map(s => s.sort_order || 0)) + 1
          : 1;

        const { error } = await supabase
          .from('work_pipeline_stages')
          .insert({
            company_id: companyId,
            name: editingStage.name.trim(),
            color: editingStage.color || '#0ea5e9',
            sort_order: nextOrder
          });

        if (error) throw error;
      }

      setIsEditingStageModal(false);
      setEditingStage(null);
      await loadWorkStages();
      onStagesUpdated?.();
    } catch (err: any) {
      alert(`Erro ao salvar etapa: ${err.message || ''}`);
    } finally {
      setSavingStage(false);
    }
  };

  // Verificar dependências antes de excluir etapa
  const handleOpenDeleteStage = async (stage: WorkStageConfig) => {
    try {
      setCheckingStageCount(true);
      const { count, error } = await supabase
        .from('works')
        .select('*', { count: 'exact', head: true })
        .or(`stage.eq.${stage.id},stage.eq.${stage.name.toLowerCase()}`);

      if (error) throw error;
      setStageWorkCount(count || 0);
      setStageToDelete(stage);
    } catch (err) {
      setStageWorkCount(0);
      setStageToDelete(stage);
    } finally {
      setCheckingStageCount(false);
    }
  };

  // Confirmar exclusão
  const handleConfirmDeleteStage = async () => {
    if (!stageToDelete || stageWorkCount > 0) return;

    if (workStages.length <= 1) {
      alert('É necessário manter ao menos 1 etapa de obra.');
      setStageToDelete(null);
      return;
    }

    try {
      setDeletingStage(true);
      const { error } = await supabase
        .from('work_pipeline_stages')
        .delete()
        .eq('id', stageToDelete.id);

      if (error) throw error;
      setWorkStages(prev => prev.filter(s => s.id !== stageToDelete.id));
      setStageToDelete(null);
      onStagesUpdated?.();
    } catch (err: any) {
      alert(`Não foi possível excluir: ${err.message || ''}`);
    } finally {
      setDeletingStage(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-2xs animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full shadow-2xl flex flex-col h-[75vh] overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
              <HardHat size={20} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                Definições de Etapas das Obras
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure as etapas do funil de execução e colunas do Kanban.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg cursor-pointer transition-colors hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        {/* Conteúdo Principal */}
        <div className="flex-1 min-h-0 p-6 flex flex-col space-y-4 overflow-y-auto">
          <div className="flex items-center justify-between shrink-0">
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <KanbanIcon size={16} className="text-sky-600" />
                <span>Etapas do Fluxo (Kanban)</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Adicione, reordene ou edite as cores das fases das obras.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingStage({ name: '', color: '#0ea5e9' });
                setIsEditingStageModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold shadow-2xs transition-all cursor-pointer active:scale-98"
            >
              <Plus size={14} />
              <span>Nova Etapa</span>
            </button>
          </div>

          <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-2xs divide-y divide-slate-100 flex-1 overflow-y-auto">
            {loadingStages ? (
              <div className="p-12 text-center text-xs text-slate-400">
                <Loader2 size={20} className="animate-spin mx-auto mb-2 text-sky-600" />
                Carregando etapas...
              </div>
            ) : workStages.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-400 italic">
                Nenhuma etapa configurada.
              </div>
            ) : (
              workStages.map((stage, idx) => (
                <div
                  key={stage.id}
                  className="p-3 sm:px-4 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-5 text-center text-xs font-bold text-slate-400">
                      {idx + 1}º
                    </span>
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs border border-white"
                      style={{ backgroundColor: stage.color || '#0ea5e9' }}
                    />
                    <span className="text-xs sm:text-sm font-bold text-slate-900">
                      {stage.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveStage(idx, 'up')}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg disabled:opacity-30 cursor-pointer"
                      title="Mover para cima"
                    >
                      <ChevronUp size={15} />
                    </button>
                    <button
                      type="button"
                      disabled={idx === workStages.length - 1}
                      onClick={() => handleMoveStage(idx, 'down')}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg disabled:opacity-30 cursor-pointer"
                      title="Mover para baixo"
                    >
                      <ChevronDown size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingStage(stage);
                        setIsEditingStageModal(true);
                      }}
                      className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
                      title="Editar etapa"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={checkingStageCount}
                      onClick={() => handleOpenDeleteStage(stage)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Excluir etapa"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Rodapé */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs transition-colors"
          >
            Concluir
          </button>
        </div>
      </div>

      {/* Modal: Criar / Editar Etapa */}
      {isEditingStageModal && editingStage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  {editingStage.id ? 'Editar Etapa da Obra' : 'Nova Etapa da Obra'}
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => {
                  setIsEditingStageModal(false);
                  setEditingStage(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveStageModal} className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nome da Etapa *</label>
                <input 
                  type="text" 
                  required
                  autoFocus
                  placeholder="Ex: Fundação, Estruturas, Acabamento..."
                  value={editingStage.name || ''}
                  onChange={(e) => setEditingStage({ ...editingStage, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all shadow-2xs" 
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Cor da Etiqueta</label>
                <div className="flex items-center gap-2.5">
                  <input 
                    type="color" 
                    value={editingStage.color || '#0ea5e9'}
                    onChange={(e) => setEditingStage({ ...editingStage, color: e.target.value })}
                    className="h-9 w-12 p-0 border border-slate-200 rounded-lg cursor-pointer"
                  />
                  <span className="text-slate-600 font-mono text-xs">{editingStage.color || '#0ea5e9'}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingStageModal(false);
                    setEditingStage(null);
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingStage}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-2xs transition-colors cursor-pointer active:scale-98 disabled:opacity-50"
                >
                  {savingStage ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>Salvar Etapa</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Exclusão de Etapa */}
      {stageToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl text-center animate-in zoom-in-95 duration-150">
            {stageWorkCount > 0 ? (
              <>
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3.5 border border-amber-200/80">
                  <AlertCircle size={24} />
                </div>
                <h3 className="text-base font-bold text-slate-900 leading-tight mb-1.5">
                  Não é possível excluir esta etapa
                </h3>
                <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                  A etapa <strong className="text-slate-800 font-bold">"{stageToDelete.name}"</strong> possui {stageWorkCount} {stageWorkCount === 1 ? 'obra vinculada' : 'obras vinculadas'}.
                </p>
                <button
                  type="button"
                  onClick={() => setStageToDelete(null)}
                  className="w-full py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  Entendido, voltar
                </button>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3.5 border border-rose-100">
                  <Trash2 size={24} />
                </div>
                <h3 className="text-base font-bold text-slate-900 leading-tight mb-1.5">
                  Excluir Etapa da Obra
                </h3>
                <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                  Tem certeza que deseja excluir a etapa <strong className="text-slate-800 font-bold">"{stageToDelete.name}"</strong>?
                </p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStageToDelete(null)}
                    className="w-1/2 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={deletingStage}
                    onClick={handleConfirmDeleteStage}
                    className="w-1/2 inline-flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-2xs cursor-pointer disabled:opacity-50"
                  >
                    {deletingStage ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    <span>Excluir</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkSettingsModal;