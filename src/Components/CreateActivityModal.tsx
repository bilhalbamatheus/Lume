import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  X,
  Calendar,
  Clock,
  CheckSquare,
  UserCheck,
  Check,
  Loader2,
  Edit3,
  Briefcase,
  User,
  Building2,
  ChevronDown,
  Search,
  Link2
} from 'lucide-react';

export interface ActivityEditData {
  id: string;
  title: string;
  description: string | null;
  activity_type: string;
  priority: string;
  due_date: string | null;
  opportunity_id?: string | null;
  contact_id?: string | null;
  assignee_ids?: string[];
}

interface CreateActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  activityToEdit?: ActivityEditData | null;
  defaultOpportunityId?: string | null;
  defaultContactId?: string | null;
  defaultDueDate?: string | null;
  defaultDueTime?: string | null;
}

interface TeamMember {
  id: string;
  name: string;
  email?: string;
  avatar_url?: string | null;
}

interface OpportunityOption {
  id: string;
  title: string;
  estimated_value?: number | null;
}

interface ContactOption {
  id: string;
  display_name: string;
  type: string;
  avatar_url?: string | null;
}

export const CreateActivityModal: React.FC<CreateActivityModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  activityToEdit,
  defaultOpportunityId,
  defaultContactId,
  defaultDueDate,
  defaultDueTime
}) => {
  const { user } = useAuth();

  const [saving, setSaving] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // Campos principais
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [activityType, setActivityType] = useState('tarefa');
  const [priority, setPriority] = useState('media');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueTime, setDueTime] = useState('14:00');

  // Múltiplos Responsáveis
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [isAssigneeDropdownOpen, setIsAssigneeDropdownOpen] = useState(false);
  const assigneeBoxRef = useRef<HTMLDivElement>(null);

  // Seletor de Tipo de Vínculo: 'none' | 'opportunity' | 'contact'
  const [linkMode, setLinkMode] = useState<'none' | 'opportunity' | 'contact'>('none');

  // Dados carregados
  const [opportunities, setOpportunities] = useState<OpportunityOption[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);

  // Oportunidade (Busca digitável)
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string>('');
  const [oppSearchText, setOppSearchText] = useState('');
  const [isOppDropdownOpen, setIsOppDropdownOpen] = useState(false);
  const oppBoxRef = useRef<HTMLDivElement>(null);

  // Contacto (Busca digitável)
  const [selectedContactId, setSelectedContactId] = useState<string>('');
  const [contactSearchText, setContactSearchText] = useState('');
  const [isContactDropdownOpen, setIsContactDropdownOpen] = useState(false);
  const contactBoxRef = useRef<HTMLDivElement>(null);

  // Fecha dropdowns ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (assigneeBoxRef.current && !assigneeBoxRef.current.contains(target)) {
        setIsAssigneeDropdownOpen(false);
      }
      if (oppBoxRef.current && !oppBoxRef.current.contains(target)) {
        setIsOppDropdownOpen(false);
      }
      if (contactBoxRef.current && !contactBoxRef.current.contains(target)) {
        setIsContactDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && user?.company?.id) {
      loadTeamAndReferences();

      if (activityToEdit) {
        setTitle(activityToEdit.title || '');
        setDescription(activityToEdit.description || '');
        setActivityType(activityToEdit.activity_type || 'tarefa');
        setPriority(activityToEdit.priority || 'media');

        if (activityToEdit.due_date) {
          const dateObj = new Date(activityToEdit.due_date);
          setDueDate(dateObj.toISOString().split('T')[0]);
          setDueTime(dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
        }

        // Garante que o criador/utilizador atual está sempre nos responsáveis
        const assignees = activityToEdit.assignee_ids || [];
        if (user.id && !assignees.includes(user.id)) {
          setSelectedAssigneeIds([user.id, ...assignees]);
        } else {
          setSelectedAssigneeIds(assignees);
        }

        if (activityToEdit.opportunity_id) {
          setLinkMode('opportunity');
          setSelectedOpportunityId(activityToEdit.opportunity_id);
          setSelectedContactId('');
        } else if (activityToEdit.contact_id) {
          setLinkMode('contact');
          setSelectedContactId(activityToEdit.contact_id);
          setSelectedOpportunityId('');
        } else {
          setLinkMode('none');
          setSelectedOpportunityId('');
          setSelectedContactId('');
        }
      } else {
        setTitle('');
        setDescription('');
        setActivityType('tarefa');
        setPriority('media');
        
        // Aplica a data e hora selecionadas pelo clique no calendário ou usa o padrão
        setDueDate(defaultDueDate || new Date().toISOString().split('T')[0]);
        setDueTime(defaultDueTime || '14:00');

        if (defaultOpportunityId) {
          setLinkMode('opportunity');
          setSelectedOpportunityId(defaultOpportunityId);
          setSelectedContactId('');
        } else if (defaultContactId) {
          setLinkMode('contact');
          setSelectedContactId(defaultContactId);
          setSelectedOpportunityId('');
        } else {
          setLinkMode('none');
          setSelectedOpportunityId('');
          setSelectedContactId('');
        }

        // O criador é sempre o responsável inicial predefinido
        if (user.id) {
          setSelectedAssigneeIds([user.id]);
        }
      }
    }
  }, [isOpen, user?.company?.id, activityToEdit, defaultOpportunityId, defaultContactId, defaultDueDate, defaultDueTime]);

  // Sincroniza textos de pesquisa ao selecionar IDs
  useEffect(() => {
    if (selectedOpportunityId) {
      const opp = opportunities.find((o) => o.id === selectedOpportunityId);
      if (opp) setOppSearchText(opp.title);
    } else {
      setOppSearchText('');
    }
  }, [selectedOpportunityId, opportunities]);

  useEffect(() => {
    if (selectedContactId) {
      const c = contacts.find((item) => item.id === selectedContactId);
      if (c) setContactSearchText(c.display_name);
    } else {
      setContactSearchText('');
    }
  }, [selectedContactId, contacts]);

  const loadTeamAndReferences = async () => {
    try {
      const companyId = user?.company?.id;
      if (!companyId) return;

      const [membersRes, oppsRes, contactsRes] = await Promise.all([
        supabase
          .from('memberships')
          .select(`
            profile_id,
            profile:profiles!profile_id (
              id,
              full_name,
              email,
              avatar_url
            )
          `)
          .eq('company_id', companyId)
          .eq('status', 'ativo'),

        supabase
          .from('opportunities')
          .select('id, title, estimated_value')
          .eq('company_id', companyId)
          .is('deleted_at', null)
          .order('title', { ascending: true }),

        supabase
          .from('contacts')
          .select('id, display_name, type, avatar_url')
          .eq('company_id', companyId)
          .is('deleted_at', null)
          .order('display_name', { ascending: true })
      ]);

      const activeMembers = (membersRes.data || [])
        .map((m: any) => {
          const prof = Array.isArray(m.profile) ? m.profile[0] : m.profile;
          if (!prof) return null;
          return {
            id: prof.id,
            name: prof.full_name || 'Utilizador Sem Nome',
            email: prof.email,
            avatar_url: prof.avatar_url || null
          };
        })
        .filter(Boolean) as TeamMember[];

      setTeamMembers(activeMembers);
      setOpportunities(oppsRes.data || []);
      setContacts(contactsRes.data || []);
    } catch (err) {
      console.warn('Erro ao carregar dados:', err);
    }
  };

  // Filtra os membros da equipa excluindo o próprio criador do dropdown
  const otherTeamMembers = useMemo(() => {
    return teamMembers.filter((m) => m.id !== user?.id);
  }, [teamMembers, user?.id]);

  // Filtros em tempo real
  const filteredOpportunities = useMemo(() => {
    return opportunities.filter((op) =>
      op.title.toLowerCase().includes(oppSearchText.toLowerCase())
    );
  }, [opportunities, oppSearchText]);

  const filteredContacts = useMemo(() => {
    return contacts.filter((c) =>
      c.display_name.toLowerCase().includes(contactSearchText.toLowerCase())
    );
  }, [contacts, contactSearchText]);

  const toggleAssignee = (profileId: string) => {
    setSelectedAssigneeIds((prev) =>
      prev.includes(profileId) ? prev.filter((id) => id !== profileId) : [...prev, profileId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !user?.company?.id) return;

    try {
      setSaving(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData.session?.user?.id || user.id;

      // Garante que o criador está sempre presente na lista final de responsáveis
      const finalAssignees = Array.from(new Set([currentUserId, ...selectedAssigneeIds]));

      const combinedDueDateTime = dueDate
        ? new Date(`${dueDate}T${dueTime || '12:00'}:00`).toISOString()
        : null;

      const oppId = linkMode === 'opportunity' ? selectedOpportunityId || null : null;
      const contactId = linkMode === 'contact' ? selectedContactId || null : null;

      let activityId = activityToEdit?.id;

      if (activityToEdit) {
        const { error: updateErr } = await supabase
          .from('activities')
          .update({
            title: title.trim(),
            description: description.trim() || null,
            activity_type: activityType,
            priority,
            due_date: combinedDueDateTime,
            opportunity_id: oppId,
            contact_id: contactId,
            updated_at: new Date().toISOString()
          })
          .eq('id', activityToEdit.id);

        if (updateErr) throw updateErr;

        await supabase.from('activity_assignees').delete().eq('activity_id', activityToEdit.id);
      } else {
        const { data: createdActivity, error: activityErr } = await supabase
          .from('activities')
          .insert({
            company_id: user.company.id,
            created_by: currentUserId,
            title: title.trim(),
            description: description.trim() || null,
            activity_type: activityType,
            priority,
            due_date: combinedDueDateTime,
            status: 'pendente',
            opportunity_id: oppId,
            contact_id: contactId
          })
          .select('id')
          .single();

        if (activityErr) throw activityErr;
        activityId = createdActivity.id;
      }

      if (activityId && finalAssignees.length > 0) {
        const assigneesPayload = finalAssignees.map((profileId) => ({
          activity_id: activityId,
          profile_id: profileId,
          company_id: user.company.id
        }));

        const { error: assigneesErr } = await supabase
          .from('activity_assignees')
          .insert(assigneesPayload);

        if (assigneesErr) throw assigneesErr;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro ao guardar atividade:', err);
      alert(`Falha ao registar atividade: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const currentUserObj = teamMembers.find((m) => m.id === user?.id) || {
    id: user?.id || '',
    name: user?.profile?.full_name || 'Você (Criador)',
    avatar_url: user?.profile?.avatar_url || null
  };

  const additionalSelectedMembers = teamMembers.filter(
    (m) => m.id !== user?.id && selectedAssigneeIds.includes(m.id)
  );

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Topo do Modal */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-50 text-sky-600 rounded-xl border border-sky-100">
              {activityToEdit ? <Edit3 size={18} /> : <CheckSquare size={18} />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                {activityToEdit ? 'Editar Atividade' : 'Nova Atividade / Tarefa'}
              </h2>
              <p className="text-xs text-slate-400">
                {activityToEdit ? 'Atualize prazos, tarefas e membros atribuídos.' : 'Agende tarefas com controlo de visibilidade restrito.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
          {/* Título */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Título da Atividade *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Ligar para alinhar proposta, Vistoria técnica..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Tipo e Prioridade */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tipo de Ação</label>
              <select
                value={activityType}
                onChange={(e) => setActivityType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500 cursor-pointer"
              >
                <option value="tarefa">Tarefa Geral</option>
                <option value="ligacao">Ligação Telefónica</option>
                <option value="reuniao">Reunião Presencial/Online</option>
                <option value="visita">Visita Técnica</option>
                <option value="whatsapp">Mensagem WhatsApp</option>
                <option value="email">E-mail</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Prioridade</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500 cursor-pointer"
              >
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta 🔥</option>
              </select>
            </div>
          </div>

          {/* Data e Hora Limite */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Calendar size={13} className="text-slate-400" />
                Data Limite *
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Clock size={13} className="text-slate-400" />
                Horário
              </label>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* RESPONSÁVEIS: O CRIADOR É SEMPRE O PRIMEIRO E NÃO APARECE NO DROPDOWN */}
          <div className="relative pt-1 border-t border-slate-100" ref={assigneeBoxRef}>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-semibold text-slate-800 flex items-center gap-1.5">
                <UserCheck size={14} className="text-sky-600" />
                Responsáveis Atribuídos ({1 + additionalSelectedMembers.length}) *
              </label>
              <span className="text-[10px] text-slate-400">Você + membros selecionados</span>
            </div>

            <button
              type="button"
              onClick={() => setIsAssigneeDropdownOpen(!isAssigneeDropdownOpen)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl text-slate-800 transition-colors cursor-pointer text-left shadow-2xs"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {/* Avatares empilhados (Começando sempre pelo Criador) */}
                <div className="flex items-center -space-x-1.5 shrink-0">
                  {currentUserObj.avatar_url ? (
                    <img
                      src={currentUserObj.avatar_url}
                      alt=""
                      className="w-5 h-5 rounded-full object-cover border border-white"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[9px] font-bold border border-white">
                      {currentUserObj.name.charAt(0).toUpperCase()}
                    </div>
                  )}

                  {additionalSelectedMembers.slice(0, 2).map((m) => (
                    <div key={m.id} className="relative">
                      {m.avatar_url ? (
                        <img
                          src={m.avatar_url}
                          alt=""
                          className="w-5 h-5 rounded-full object-cover border border-white"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[9px] font-bold border border-white">
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <span className="truncate font-semibold text-slate-900">
                  Você (Criador)
                  {additionalSelectedMembers.length > 0 &&
                    `, ${additionalSelectedMembers.map((m) => m.name).join(', ')}`}
                </span>
              </div>
              <ChevronDown
                size={14}
                className={`text-slate-400 shrink-0 ml-2 transition-transform duration-150 ${
                  isAssigneeDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isAssigneeDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-48 overflow-y-auto z-50 p-1.5 space-y-0.5 animate-in fade-in duration-100">
                <div className="p-2 border-b border-slate-100 mb-1 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Atribuir colegas de equipa</span>
                  <span>(Criador já incluído)</span>
                </div>

                {otherTeamMembers.length === 0 ? (
                  <p className="p-3 text-center text-slate-400 text-xs">
                    Não existem outros membros cadastrados na empresa.
                  </p>
                ) : (
                  otherTeamMembers.map((member) => {
                    const isSelected = selectedAssigneeIds.includes(member.id);
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => toggleAssignee(member.id)}
                        className={`w-full p-2 rounded-xl flex items-center justify-between gap-2 text-left transition-colors cursor-pointer text-xs ${
                          isSelected ? 'bg-sky-50 text-sky-900 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {member.avatar_url ? (
                            <img
                              src={member.avatar_url}
                              alt=""
                              className="w-5 h-5 rounded-full object-cover shrink-0 border border-slate-200"
                            />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[9px] font-bold shrink-0">
                              {member.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="truncate">{member.name}</span>
                        </div>
                        <div
                          className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-sky-600 border-sky-600 text-white' : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check size={11} strokeWidth={3} />}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* SELETOR DE VÍNCULO (NENHUM / OPORTUNIDADE / CONTACTO) */}
          <div className="pt-2 border-t border-slate-100 space-y-2.5">
            <label className="font-semibold text-slate-700 flex items-center gap-1.5">
              <Link2 size={13} className="text-sky-600" />
              Vincular Atividade a:
            </label>

            {/* Segmented Button / Tabs */}
            <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setLinkMode('none');
                  setSelectedOpportunityId('');
                  setSelectedContactId('');
                }}
                className={`py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  linkMode === 'none'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Nenhum (Avulsa)
              </button>
              <button
                type="button"
                onClick={() => {
                  setLinkMode('opportunity');
                  setSelectedContactId('');
                }}
                className={`py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  linkMode === 'opportunity'
                    ? 'bg-white text-sky-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Briefcase size={12} />
                <span>Oportunidade</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setLinkMode('contact');
                  setSelectedOpportunityId('');
                }}
                className={`py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  linkMode === 'contact'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <User size={12} />
                <span>Contacto</span>
              </button>
            </div>

            {/* CAMPO DE OPORTUNIDADE (FILTRO DIGITÁVEL) */}
            {linkMode === 'opportunity' && (
              <div className="relative pt-1 animate-in fade-in duration-150" ref={oppBoxRef}>
                <div className="relative">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={oppSearchText}
                    placeholder="Digite o nome da oportunidade..."
                    onFocus={() => setIsOppDropdownOpen(true)}
                    onChange={(e) => {
                      setOppSearchText(e.target.value);
                      setIsOppDropdownOpen(true);
                      if (!e.target.value) setSelectedOpportunityId('');
                    }}
                    className={`w-full pl-9 pr-14 py-2 bg-slate-50 border rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium ${
                      selectedOpportunityId ? 'border-sky-300 ring-1 ring-sky-200 bg-white' : 'border-slate-200'
                    }`}
                  />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {oppSearchText && (
                      <button
                        type="button"
                        onClick={() => {
                          setOppSearchText('');
                          setSelectedOpportunityId('');
                          setIsOppDropdownOpen(true);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X size={13} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsOppDropdownOpen(!isOppDropdownOpen)}
                      className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <ChevronDown
                        size={14}
                        className={`transition-transform duration-150 ${isOppDropdownOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </div>
                </div>

                {isOppDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-48 overflow-y-auto z-50 p-1.5 space-y-0.5 animate-in fade-in duration-100">
                    {filteredOpportunities.length === 0 ? (
                      <p className="p-2 text-center text-slate-400 text-xs">Nenhuma oportunidade encontrada</p>
                    ) : (
                      filteredOpportunities.map((op) => (
                        <button
                          key={op.id}
                          type="button"
                          onClick={() => {
                            setSelectedOpportunityId(op.id);
                            setOppSearchText(op.title);
                            setIsOppDropdownOpen(false);
                          }}
                          className={`w-full p-2 rounded-xl flex items-center justify-between gap-2 text-left transition-colors cursor-pointer text-xs ${
                            selectedOpportunityId === op.id
                              ? 'bg-sky-50 text-sky-900 font-semibold'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Briefcase size={13} className="text-sky-600 shrink-0" />
                            <span className="truncate">{op.title}</span>
                          </div>
                          {selectedOpportunityId === op.id && <Check size={13} className="text-sky-600 shrink-0" />}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {/* CAMPO DE CONTACTO (FILTRO DIGITÁVEL COM AVATARS) */}
            {linkMode === 'contact' && (
              <div className="relative pt-1 animate-in fade-in duration-150" ref={contactBoxRef}>
                <div className="relative">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={contactSearchText}
                    placeholder="Digite o nome do contacto ou empresa..."
                    onFocus={() => setIsContactDropdownOpen(true)}
                    onChange={(e) => {
                      setContactSearchText(e.target.value);
                      setIsContactDropdownOpen(true);
                      if (!e.target.value) setSelectedContactId('');
                    }}
                    className={`w-full pl-9 pr-14 py-2 bg-slate-50 border rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium ${
                      selectedContactId ? 'border-sky-300 ring-1 ring-sky-200 bg-white' : 'border-slate-200'
                    }`}
                  />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {contactSearchText && (
                      <button
                        type="button"
                        onClick={() => {
                          setContactSearchText('');
                          setSelectedContactId('');
                          setIsContactDropdownOpen(true);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X size={13} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsContactDropdownOpen(!isContactDropdownOpen)}
                      className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <ChevronDown
                        size={14}
                        className={`transition-transform duration-150 ${isContactDropdownOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </div>
                </div>

                {isContactDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-48 overflow-y-auto z-50 p-1.5 space-y-0.5 animate-in fade-in duration-100">
                    {filteredContacts.length === 0 ? (
                      <p className="p-2 text-center text-slate-400 text-xs">Nenhum contacto encontrado</p>
                    ) : (
                      filteredContacts.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedContactId(c.id);
                            setContactSearchText(c.display_name);
                            setIsContactDropdownOpen(false);
                          }}
                          className={`w-full p-2 rounded-xl flex items-center justify-between gap-2 text-left transition-colors cursor-pointer text-xs ${
                            selectedContactId === c.id
                              ? 'bg-sky-50 text-sky-900 font-semibold'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {c.avatar_url ? (
                              <img
                                src={c.avatar_url}
                                alt=""
                                className="w-5 h-5 rounded-full object-cover border border-slate-200 shrink-0"
                              />
                            ) : (
                              <div
                                className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                                  c.type === 'company'
                                    ? 'bg-indigo-50 text-indigo-600'
                                    : 'bg-sky-100 text-sky-700'
                                }`}
                              >
                                {c.type === 'company' ? (
                                  <Building2 size={11} />
                                ) : (
                                  c.display_name.charAt(0).toUpperCase()
                                )}
                              </div>
                            )}
                            <span className="truncate">{c.display_name}</span>
                          </div>
                          {selectedContactId === c.id && <Check size={13} className="text-sky-600 shrink-0" />}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Observações e Detalhes */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Observações e Detalhes</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes adicionais, pauta da reunião ou informações relevantes..."
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-sky-500 resize-none"
            />
          </div>

          {/* Botões do Rodapé */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-white bg-sky-600 hover:bg-sky-500 rounded-xl font-semibold shadow-xs cursor-pointer active:scale-98 disabled:opacity-50 transition-all"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckSquare size={14} />}
              <span>{activityToEdit ? 'Salvar Alterações' : 'Criar Atividade'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};