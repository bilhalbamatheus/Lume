import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { EntityTimeline } from './EntityTimeline';
import { EntityDocuments } from './EntityDocuments';
import { ContactProfileModal } from './ContactProfileModal';
import {
  X,
  Building2,
  User,
  Clock,
  CheckSquare,
  Square,
  Trash2,
  Edit3,
  Save,
  Loader2,
  ChevronDown,
  Info,
  FolderOpen,
  Plus,
  ExternalLink,
  Tag
} from 'lucide-react';

interface ProjectDetailModalProps {
  projectId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
  zIndexLevel?: 'base' | 'overlay';
}

interface ProjectData {
  id: string;
  code?: string | null;
  title: string;
  scope_type: 'projeto' | 'execucao' | 'turnkey';
  status: 'em_andamento' | 'concluido' | 'pausado' | 'cancelado';
  stage: string;
  contact_id: string;
  company_id: string;
  assigned_to?: string | null;
  estimated_completion_date?: string | null;
  actual_completion_date?: string | null;
  notes?: string | null;
  created_at: string;
  contact?: {
    id: string;
    display_name: string;
    type: 'person' | 'company';
    avatar_url?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  assigned_profile?: {
    id: string;
    full_name: string;
    email?: string | null;
    avatar_url?: string | null;
  } | null;
}

const PROJECT_STAGES = [
  { id: 'prj_vistoria', label: 'Levantamento & Vistoria' },
  { id: 'prj_elaboracao', label: 'Elaboração do Projeto' },
  { id: 'prj_protocolo', label: 'Análise / Protocolo' },
  { id: 'prj_aprovado', label: 'Projeto Aprovado' },
];

const WORK_STAGES = [
  { id: 'obra_suprimentos', label: 'Planejamento & Suprimentos' },
  { id: 'obra_execucao', label: 'Execução em Andamento' },
  { id: 'obra_testes', label: 'Comissionamento & Testes' },
  { id: 'obra_entregue', label: 'Obra Concluída & Entregue' },
];

export const ProjectDetailModal: React.FC<ProjectDetailModalProps> = ({
  projectId,
  isOpen,
  onClose,
  onUpdated,
  zIndexLevel = 'base'
}) => {
  const { user } = useAuth();
  usePermissions();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectData | null>(null);
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; name: string }>>([]);

  const [activeTab, setActiveTab] = useState<'info' | 'checklist' | 'timeline' | 'documents'>('info');

  // Modo de Edição
  const [isEditing, setIsEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editAssignedTo, setEditAssignedTo] = useState('');
  const [editEstimatedDate, setEditEstimatedDate] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Abertura do Perfil do Contacto por cima
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  // Checklists locais (armazenados em activities ou estado simples)
  const [checklists, setChecklists] = useState<Array<{ id: string; title: string; completed: boolean }>>([]);
  const [newChecklistText, setNewChecklistText] = useState('');

  const isProject = project?.scope_type === 'projeto';
  const stages = isProject ? PROJECT_STAGES : WORK_STAGES;

  const loadProject = async (id: string) => {
    try {
      setLoading(true);
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
          company_id,
          assigned_to,
          estimated_completion_date,
          actual_completion_date,
          notes,
          created_at,
          contact:contacts!contact_id (
            id,
            display_name,
            type,
            avatar_url
          ),
          assigned_profile:profiles!assigned_to (
            id,
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      const formatted: ProjectData = {
        ...data,
        contact: Array.isArray(data.contact) ? data.contact[0] : data.contact,
        assigned_profile: Array.isArray(data.assigned_profile) ? data.assigned_profile[0] : data.assigned_profile
      };

      setProject(formatted);
      setEditTitle(formatted.title);
      setEditAssignedTo(formatted.assigned_to || '');
      setEditEstimatedDate(formatted.estimated_completion_date || '');
      setEditNotes(formatted.notes || '');
    } catch (err) {
      console.error('Erro ao carregar detalhes do projeto/obra:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTeam = async () => {
    try {
      const companyId = user?.company?.id;
      if (!companyId) return;

      const { data } = await supabase
        .from('memberships')
        .select(`
          profile:profiles!profile_id (
            id,
            full_name
          )
        `)
        .eq('company_id', companyId)
        .eq('status', 'ativo');

      const mapped = (data || [])
        .map((m: any) => {
          const prof = Array.isArray(m.profile) ? m.profile[0] : m.profile;
          if (!prof) return null;
          return { id: prof.id, name: prof.full_name || 'Utilizador' };
        })
        .filter(Boolean);

      setTeamMembers(mapped as Array<{ id: string; name: string }>);
    } catch (err) {
      console.warn('Erro ao carregar membros:', err);
    }
  };

  useEffect(() => {
    if (isOpen && projectId) {
      loadProject(projectId);
      loadTeam();
    } else {
      setProject(null);
      setIsEditing(false);
      setActiveTab('info');
    }
  }, [isOpen, projectId]);

  const handleStageChange = async (newStage: string) => {
    if (!project) return;
    const isCompleted = newStage === (isProject ? 'prj_aprovado' : 'obra_entregue');

    setProject(prev => prev ? { ...prev, stage: newStage, status: isCompleted ? 'concluido' : 'em_andamento' } : null);

    try {
      const { error } = await supabase
        .from('projects')
        .update({
          stage: newStage,
          status: isCompleted ? 'concluido' : 'em_andamento',
          actual_completion_date: isCompleted ? new Date().toISOString().split('T')[0] : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', project.id);

      if (error) throw error;
      onUpdated?.();
    } catch (err) {
      console.error('Erro ao mudar etapa:', err);
    }
  };

  const handleSaveEdit = async () => {
    if (!project) return;

    try {
      setSavingEdit(true);
      const payload = {
        title: editTitle.trim() || project.title,
        assigned_to: editAssignedTo || null,
        estimated_completion_date: editEstimatedDate || null,
        notes: editNotes.trim() || null,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('projects')
        .update(payload)
        .eq('id', project.id);

      if (error) throw error;

      await loadProject(project.id);
      setIsEditing(false);
      onUpdated?.();
    } catch (err: any) {
      alert(`Falha ao salvar alterações: ${err.message}`);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!project) return;
    if (!window.confirm(`Deseja realmente excluir este registo "${project.title}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', project.id);

      if (error) throw error;

      onUpdated?.();
      onClose();
    } catch (err: any) {
      alert(`Erro ao excluir: ${err.message}`);
    }
  };

  const handleAddChecklist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklistText.trim()) return;

    setChecklists(prev => [
      ...prev,
      { id: String(Date.now()), title: newChecklistText.trim(), completed: false }
    ]);
    setNewChecklistText('');
  };

  const handleToggleChecklist = (id: string) => {
    setChecklists(prev =>
      prev.map(it => it.id === id ? { ...it, completed: !it.completed } : it)
    );
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200 ${
          zIndexLevel === 'overlay' ? 'z-[140]' : 'z-[80]'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 bottom-0 h-screen w-full max-w-2xl lg:max-w-3xl bg-white shadow-2xl flex flex-col border-l border-slate-200 rounded-none m-0 p-0 overflow-hidden animate-in slide-in-from-right duration-300 ${
          zIndexLevel === 'overlay' ? 'z-[140]' : 'z-[80]'
        }`}
      >
        {/* Cabeçalho */}
        <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50/70 shrink-0 relative">
          <div className="absolute right-3.5 top-3.5 sm:right-4 sm:top-4 flex items-center gap-1 sm:gap-1.5 z-20">
            <button
              type="button"
              onClick={handleDeleteProject}
              title="Excluir"
              className="p-1.5 sm:p-2 text-slate-400 hover:text-red-600 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-xl transition-colors cursor-pointer shadow-2xs"
            >
              <Trash2 size={15} />
            </button>

            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              title={isEditing ? "Cancelar Edição" : "Editar"}
              className={`p-1.5 sm:p-2 rounded-xl transition-colors cursor-pointer shadow-2xs border ${
                isEditing
                  ? 'bg-sky-600 border-sky-600 text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Edit3 size={15} />
            </button>

            <button
              type="button"
              onClick={onClose}
              title="Fechar (Esc)"
              className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer shadow-2xs"
            >
              <X size={17} />
            </button>
          </div>

          {loading || !project ? (
            <div className="space-y-3 pr-24">
              <div className="h-7 bg-slate-200 rounded-xl w-2/3 animate-pulse" />
              <div className="h-5 bg-slate-200 rounded-lg w-1/3 animate-pulse" />
            </div>
          ) : (
            <div className="space-y-2 pr-28">
              <div className="flex items-center gap-2 flex-wrap">
                {project.code && (
                  <span className={`inline-flex items-center gap-1 font-mono text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                    isProject ? 'bg-sky-50 text-sky-700 border-sky-200/60' : 'bg-amber-50 text-amber-700 border-amber-200/60'
                  }`}>
                    <Tag size={12} />
                    <span>{project.code}</span>
                  </span>
                )}

                <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${
                  isProject ? 'bg-sky-50 text-sky-700 border-sky-200/60' : 'bg-amber-50 text-amber-700 border-amber-200/60'
                }`}>
                  {isProject ? 'Projeto de Engenharia' : 'Execução de Obra'}
                </span>
              </div>

              <h2 className="text-base sm:text-xl font-bold text-slate-900 leading-snug">
                {project.title}
              </h2>

              <div className="pt-2 border-t border-slate-200/80 flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Etapa Atual:</span>
                <div className="relative">
                  <select
                    value={project.stage}
                    onChange={(e) => handleStageChange(e.target.value)}
                    className="appearance-none pl-3 pr-8 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all cursor-pointer shadow-2xs"
                  >
                    {stages.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>
          )}

          {/* Abas */}
          <div className="flex items-center gap-4 sm:gap-6 mt-4 sm:mt-5 pt-2 border-t border-slate-200/80 text-xs font-semibold overflow-x-auto no-scrollbar shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('info')}
              className={`pb-2.5 transition-colors cursor-pointer relative whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                activeTab === 'info' ? 'text-sky-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Info size={14} />
              <span>DADOS GERAIS</span>
              {activeTab === 'info' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-600 rounded-full" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('checklist')}
              className={`pb-2.5 transition-colors cursor-pointer relative whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                activeTab === 'checklist' ? 'text-sky-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <CheckSquare size={14} />
              <span>CHECKLIST & PENDÊNCIAS</span>
              {checklists.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                  {checklists.filter(c => c.completed).length}/{checklists.length}
                </span>
              )}
              {activeTab === 'checklist' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-600 rounded-full" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('timeline')}
              className={`pb-2.5 transition-colors cursor-pointer relative whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                activeTab === 'timeline' ? 'text-sky-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Clock size={14} />
              <span>HISTÓRICO</span>
              {activeTab === 'timeline' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-600 rounded-full" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('documents')}
              className={`pb-2.5 transition-colors cursor-pointer relative whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                activeTab === 'documents' ? 'text-sky-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <FolderOpen size={14} />
              <span>DOCUMENTOS TÉCNICOS</span>
              {activeTab === 'documents' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-600 rounded-full" />
              )}
            </button>
          </div>
        </div>

        {/* Corpo com Scroll */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5 text-xs sm:text-sm">
          {loading || !project ? (
            <div className="py-24 text-center text-slate-400">
              <Loader2 size={24} className="animate-spin mx-auto mb-2 text-sky-600" />
              Carregando dados...
            </div>
          ) : isEditing ? (
            /* Modo de Edição */
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-sky-300 shadow-sm space-y-4">
              <h4 className="font-bold text-sky-900 uppercase tracking-wider text-xs">
                Editar {isProject ? 'Projeto' : 'Obra'}
              </h4>

              <div className="space-y-3.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Título</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500 text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Responsável Técnico</label>
                    <select
                      value={editAssignedTo}
                      onChange={(e) => setEditAssignedTo(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500 cursor-pointer text-xs"
                    >
                      <option value="">Não atribuído</option>
                      {teamMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Previsão de Entrega</label>
                    <input
                      type="date"
                      value={editEstimatedDate}
                      onChange={(e) => setEditEstimatedDate(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Observações Técnicas</label>
                  <textarea
                    rows={4}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Informações sobre documentação, acesso, cronograma..."
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-sky-500 resize-none text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={savingEdit}
                  onClick={handleSaveEdit}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  {savingEdit ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>Salvar Alterações</span>
                </button>
              </div>
            </div>
          ) : activeTab === 'info' ? (
            /* Visualização de Dados Gerais */
            <div className="space-y-4">
              {/* Card do Cliente */}
              <div className="bg-slate-50/70 p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <User size={14} className="text-slate-400" />
                  Cliente Vinculado
                </h4>

                {project.contact ? (
                  <div
                    onClick={() => setIsContactModalOpen(true)}
                    className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:border-sky-300 hover:bg-slate-50/50 transition-all flex items-center justify-between gap-3 cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-700 shrink-0">
                        {project.contact.type === 'company' ? <Building2 size={18} /> : <User size={18} />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-sky-600 transition-colors truncate">
                          {project.contact.display_name}
                        </p>
                        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                          {project.contact.type === 'company' ? 'Pessoa Jurídica' : 'Pessoa Física'}
                        </span>
                      </div>
                    </div>
                    <ExternalLink size={14} className="text-slate-400 group-hover:text-sky-600 shrink-0" />
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-400 italic">
                    Nenhum cliente associado.
                  </div>
                )}
              </div>

              {/* Informações de Cronograma e Responsável */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
                    Responsável Técnico
                  </span>
                  <p className="text-sm font-bold text-slate-900">
                    {project.assigned_profile?.full_name || 'Não atribuído'}
                  </p>
                </div>

                <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
                    Previsão de Conclusão
                  </span>
                  <p className="text-sm font-bold text-slate-900">
                    {project.estimated_completion_date
                      ? new Date(project.estimated_completion_date).toLocaleDateString('pt-BR')
                      : 'Não definida'}
                  </p>
                </div>
              </div>

              {/* Observações */}
              <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Observações & Considerações
                </span>
                {project.notes ? (
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line bg-white p-3 rounded-xl border border-slate-200/60">
                    {project.notes}
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 italic">Nenhuma observação registrada.</p>
                )}
              </div>
            </div>
          ) : activeTab === 'checklist' ? (
            /* Checklist & Pendências */
            <div className="space-y-4">
              <form onSubmit={handleAddChecklist} className="flex gap-2">
                <input
                  type="text"
                  value={newChecklistText}
                  onChange={(e) => setNewChecklistText(e.target.value)}
                  placeholder="Adicionar nova pendência ou etapa técnica..."
                  className="flex-1 px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Adicionar</span>
                </button>
              </form>

              {checklists.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl text-xs text-slate-400 italic">
                  Nenhuma pendência ou checklist cadastrado.
                </div>
              ) : (
                <div className="space-y-2">
                  {checklists.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleToggleChecklist(item.id)}
                      className={`p-3 rounded-xl border transition-all flex items-center gap-3 cursor-pointer ${
                        item.completed
                          ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900 line-through opacity-80'
                          : 'bg-white border-slate-200 text-slate-800 hover:border-sky-300'
                      }`}
                    >
                      {item.completed ? (
                        <CheckSquare size={16} className="text-emerald-600 shrink-0" />
                      ) : (
                        <Square size={16} className="text-slate-400 shrink-0" />
                      )}
                      <span className="text-xs font-medium flex-1">{item.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === 'timeline' && project ? (
            /* Histórico & Atividades */
            <div className="pt-1">
              <EntityTimeline
                entityType="opportunity"
                entityId={project.id}
                companyId={project.company_id}
                contactId={project.contact_id}
              />
            </div>
          ) : (
            /* Documentos Técnicos */
            project && (
              <div className="pt-1">
                <EntityDocuments
                  entityType="opportunity"
                  entityId={project.id}
                  companyId={project.company_id}
                />
              </div>
            )
          )}
        </div>

        {/* Rodapé Fixo */}
        <div className="p-3.5 sm:p-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>Criado em {project?.created_at ? new Date(project.created_at).toLocaleDateString('pt-BR') : '—'}</span>
          <span className="text-[11px] text-slate-400">Lume DRM</span>
        </div>
      </div>

      {/* Modal do Contacto quando aberto a partir do Projeto */}
      {isContactModalOpen && project?.contact_id && (
        <ContactProfileModal
          contactId={project.contact_id}
          isOpen={isContactModalOpen}
          zIndexLevel="overlay"
          onClose={() => setIsContactModalOpen(false)}
        />
      )}
    </>,
    document.body
  );
};