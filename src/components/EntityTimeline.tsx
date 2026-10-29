import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import {
  CheckCircle2,
  Clock,
  Phone,
  MessageSquare,
  Calendar,
  FileText,
  Mail,
  MapPin,
  Trash2,
  Loader2,
  UserPlus,
  Briefcase,
  ChevronDown
} from 'lucide-react';

export interface TimelineEventItem {
  id: string;
  source: 'activity' | 'system';
  system_type?: 'contact_created' | 'opportunity_created';
  raw_title?: string;
  description?: string | null;
  activity_type?: string;
  priority?: string;
  due_date?: string | null;
  status?: string;
  completed_at?: string | null;
  created_at: string;
  created_by_name?: string;
  created_by_avatar?: string | null;
  assigned_to_name?: string;
  assigned_to_avatar?: string | null;
  extra_badge?: string;
}

interface MemberOption {
  id: string;
  user_id?: string;
  full_name: string;
  avatar_url?: string | null;
}

interface EntityTimelineProps {
  entityType: 'contact' | 'opportunity';
  entityId: string;
  companyId: string;
  contactId?: string | null;
  opportunityId?: string | null;
}

const TYPE_CONFIG: Record<string, { label: string; icon: any; nodeBg: string; boxBg: string; boxBorder: string; iconColor: string }> = {
  nota: { label: 'Nota', icon: FileText, nodeBg: 'bg-amber-500', boxBg: 'bg-amber-50', boxBorder: 'border-amber-200', iconColor: 'text-amber-600' },
  tarefa: { label: 'Tarefa', icon: Clock, nodeBg: 'bg-sky-500', boxBg: 'bg-sky-50', boxBorder: 'border-sky-200', iconColor: 'text-sky-600' },
  ligacao: { label: 'Ligação', icon: Phone, nodeBg: 'bg-emerald-500', boxBg: 'bg-emerald-50', boxBorder: 'border-emerald-200', iconColor: 'text-emerald-600' },
  whatsapp: { label: 'WhatsApp', icon: MessageSquare, nodeBg: 'bg-emerald-500', boxBg: 'bg-emerald-50', boxBorder: 'border-emerald-200', iconColor: 'text-emerald-600' },
  reuniao: { label: 'Reunião', icon: Calendar, nodeBg: 'bg-indigo-500', boxBg: 'bg-indigo-50', boxBorder: 'border-indigo-200', iconColor: 'text-indigo-600' },
  email: { label: 'E-mail', icon: Mail, nodeBg: 'bg-blue-500', boxBg: 'bg-blue-50', boxBorder: 'border-blue-200', iconColor: 'text-blue-600' },
  proposta: { label: 'Proposta', icon: FileText, nodeBg: 'bg-indigo-500', boxBg: 'bg-indigo-50', boxBorder: 'border-indigo-200', iconColor: 'text-indigo-600' },
  visita: { label: 'Visita', icon: MapPin, nodeBg: 'bg-violet-500', boxBg: 'bg-violet-50', boxBorder: 'border-violet-200', iconColor: 'text-violet-600' },
  contact_created: { label: 'Cadastro', icon: UserPlus, nodeBg: 'bg-sky-500', boxBg: 'bg-sky-50', boxBorder: 'border-sky-200', iconColor: 'text-sky-600' },
  opportunity_created: { label: 'Negócio', icon: Briefcase, nodeBg: 'bg-purple-500', boxBg: 'bg-purple-50', boxBorder: 'border-purple-200', iconColor: 'text-purple-600' },
};

function getDynamicTitle(ev: TimelineEventItem): string {
  if (ev.source === 'system') {
    if (ev.system_type === 'contact_created') return 'Contato criado';
    if (ev.system_type === 'opportunity_created') return ev.raw_title || 'Nova oportunidade';
  }

  const isDone = ev.status === 'concluida';
  const type = (ev.activity_type || '').toLowerCase();

  switch (type) {
    case 'nota':
      return 'Nota';
    case 'ligacao':
      return isDone ? 'Ligação realizada' : 'Ligação a fazer';
    case 'reuniao':
      return isDone ? 'Reunião realizada' : 'Reunião agendada';
    case 'whatsapp':
      return isDone ? 'WhatsApp enviado' : 'WhatsApp a enviar';
    case 'email':
      return isDone ? 'E-mail enviado' : 'E-mail a enviar';
    case 'proposta':
      return isDone ? 'Proposta enviada' : 'Proposta a enviar';
    case 'visita':
      return isDone ? 'Visita realizada' : 'Visita agendada';
    case 'tarefa':
    default:
      return isDone ? 'Tarefa concluída' : 'Tarefa pendente';
  }
}

export const EntityTimeline: React.FC<EntityTimelineProps> = ({
  entityType,
  entityId,
  companyId,
  contactId,
  opportunityId,
}) => {
  const { user } = useAuth();
  const { permissions } = usePermissions();

  const [events, setEvents] = useState<TimelineEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Membros para seleção de Responsável
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [selectedAssignedTo, setSelectedAssignedTo] = useState<string>('');

  // Formulário compacto
  const [activeFormType, setActiveFormType] = useState<string>('nota');
  const [formText, setFormText] = useState('');
  
  const todayStr = new Date().toISOString().split('T')[0];
  const [dueDate, setDueDate] = useState(todayStr);
  const [dueTime, setDueTime] = useState('14:00');
  const [priority, setPriority] = useState<'baixa' | 'media' | 'alta'>('media');

  useEffect(() => {
    async function fetchMembers() {
      if (!companyId) return;
      try {
        const { data, error } = await supabase
          .from('memberships')
          .select(`
            id,
            profile:profiles!profile_id (
              id,
              full_name,
              avatar_url
            )
          `)
          .eq('company_id', companyId);

        if (!error && data) {
          const list: MemberOption[] = data.map((m: any) => ({
            id: m.profile?.id || m.id,
            user_id: m.profile?.id,
            full_name: m.profile?.full_name || 'Usuário',
            avatar_url: m.profile?.avatar_url || null,
          }));
          setMembers(list);

          const currentUserId = user?.profile?.id || user?.id;
          if (currentUserId) {
            setSelectedAssignedTo(currentUserId);
          } else if (list.length > 0) {
            setSelectedAssignedTo(list[0].id);
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar colaboradores:', err);
      }
    }
    fetchMembers();
  }, [companyId, user]);

  const fetchTimeline = useCallback(async () => {
    if (!entityId || !companyId) return;

    try {
      setLoading(true);

      let activitiesQuery = supabase
        .from('activities')
        .select(`
          id,
          title,
          description,
          activity_type,
          priority,
          due_date,
          status,
          completed_at,
          created_at,
          created_by,
          profile:profiles!created_by (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq('company_id', companyId);

      if (entityType === 'contact') {
        activitiesQuery = activitiesQuery.eq('contact_id', entityId);
      } else {
        activitiesQuery = activitiesQuery.eq('opportunity_id', entityId);
      }

      const { data: actsData, error: actsError } = await activitiesQuery;
      if (actsError) throw actsError;

      const timelineItems: TimelineEventItem[] = (actsData || []).map((act: any) => ({
        id: act.id,
        source: 'activity',
        raw_title: act.title,
        description: act.description,
        activity_type: act.activity_type || 'tarefa',
        priority: act.priority,
        due_date: act.due_date,
        status: act.status,
        completed_at: act.completed_at,
        created_at: act.created_at,
        created_by_name: act.profile?.full_name || 'Usuário',
        created_by_avatar: act.profile?.avatar_url || null,
        assigned_to_name: act.profile?.full_name || 'Usuário',
        assigned_to_avatar: act.profile?.avatar_url || null,
      }));

      // Marcos de Sistema do Contato
      if (entityType === 'contact') {
        const { data: contactInfo } = await supabase
          .from('contacts')
          .select('id, display_name, created_at, created_by')
          .eq('id', entityId)
          .maybeSingle();

        if (contactInfo) {
          timelineItems.push({
            id: `system-contact-${contactInfo.id}`,
            source: 'system',
            system_type: 'contact_created',
            raw_title: 'Contato criado',
            description: `Cadastro de ${contactInfo.display_name} adicionado ao sistema.`,
            created_at: contactInfo.created_at,
            created_by_name: 'Sistema',
          });
        }

        const { data: opps } = await supabase
          .from('opportunities')
          .select('id, title, estimated_value, created_at, stage:commercial_pipeline_stages!stage_id(name)')
          .or(`contact_id.eq.${entityId},partner_contact_id.eq.${entityId}`);

        (opps || []).forEach((opp: any) => {
          const valFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(opp.estimated_value || 0);
          timelineItems.push({
            id: `system-opp-${opp.id}`,
            source: 'system',
            system_type: 'opportunity_created',
            raw_title: `Nova oportunidade: ${opp.title}`,
            description: `Negociação iniciada na etapa "${opp.stage?.name || 'Inicial'}" com valor previsto de ${valFormatted}.`,
            created_at: opp.created_at,
            created_by_name: 'Sistema',
            extra_badge: valFormatted,
          });
        });
      } else {
        const { data: oppInfo } = await supabase
          .from('opportunities')
          .select('id, title, created_at')
          .eq('id', entityId)
          .maybeSingle();

        if (oppInfo) {
          timelineItems.push({
            id: `system-opp-${oppInfo.id}`,
            source: 'system',
            system_type: 'opportunity_created',
            raw_title: `Oportunidade criada: ${oppInfo.title}`,
            description: `Negociação aberta no funil comercial.`,
            created_at: oppInfo.created_at,
            created_by_name: 'Sistema',
          });
        }
      }

      timelineItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setEvents(timelineItems);
    } catch (err) {
      console.error('Erro ao carregar timeline:', err);
    } finally {
      setLoading(false);
    }
  }, [entityId, companyId, entityType]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  const handleCreateActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formText.trim() || submitting) return;

    try {
      setSubmitting(true);
      const currentUserId = user?.profile?.id || user?.id;

      let combinedDueDate: string | null = null;
      if (activeFormType !== 'nota' && dueDate) {
        combinedDueDate = new Date(`${dueDate}T${dueTime || '14:00'}:00`).toISOString();
      }

      const isAutoDone = activeFormType === 'nota';
      const statusValue = isAutoDone ? 'concluida' : 'pendente';

      const payload = {
        company_id: companyId,
        contact_id: entityType === 'contact' ? entityId : contactId || null,
        opportunity_id: entityType === 'opportunity' ? entityId : opportunityId || null,
        created_by: selectedAssignedTo || currentUserId || null,
        title: formText.trim().split('\n')[0].slice(0, 80),
        description: formText.trim(),
        activity_type: activeFormType,
        priority: priority,
        due_date: combinedDueDate,
        status: statusValue,
        completed_at: isAutoDone ? new Date().toISOString() : null,
      };

      const { error } = await supabase.from('activities').insert(payload);
      if (error) throw error;

      setFormText('');
      window.dispatchEvent(new Event('activity-updated'));
      await fetchTimeline();
    } catch (err: any) {
      alert(`Falha ao registrar atividade: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (item: TimelineEventItem) => {
    if (item.source !== 'activity') return;

    const nextStatus = item.status === 'pendente' ? 'concluida' : 'pendente';
    const nextCompletedAt = nextStatus === 'concluida' ? new Date().toISOString() : null;

    setEvents(prev =>
      prev.map(ev => (ev.id === item.id ? { ...ev, status: nextStatus, completed_at: nextCompletedAt } : ev))
    );

    try {
      const { error } = await supabase
        .from('activities')
        .update({
          status: nextStatus,
          completed_at: nextCompletedAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);

      if (error) throw error;
      window.dispatchEvent(new Event('activity-updated'));
    } catch (err) {
      console.error('Erro ao alternar status da atividade:', err);
      fetchTimeline();
    }
  };

  const handleDeleteActivity = async (id: string) => {
    if (!window.confirm('Deseja excluir esta atividade do histórico?')) return;

    try {
      const { error } = await supabase.from('activities').delete().eq('id', id);
      if (error) throw error;

      setEvents(prev => prev.filter(ev => ev.id !== id));
      window.dispatchEvent(new Event('activity-updated'));
    } catch (err: any) {
      alert(`Erro ao excluir: ${err.message || ''}`);
    }
  };

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formTabs = [
    { id: 'email', label: 'E-mail', icon: Mail },
    { id: 'ligacao', label: 'Ligação', icon: Phone },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
    { id: 'proposta', label: 'Proposta', icon: FileText },
    { id: 'reuniao', label: 'Reunião', icon: Calendar },
    { id: 'visita', label: 'Visita', icon: MapPin },
    { id: 'nota', label: 'Nota', icon: FileText },
  ];

  return (
    <div className="space-y-5">
      {/* FORMULÁRIO ENXUTO E RESPONSIVO */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-2xs space-y-3">
        {/* Abas Superiores Sem Scrollbar Feia */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar scroll-smooth">
          {formTabs.map(tab => {
            const Icon = tab.icon;
            const isSelected = activeFormType === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFormType(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  isSelected
                    ? 'bg-sky-50 text-sky-600 border border-sky-200'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Icon size={13} className={isSelected ? 'text-sky-600' : 'text-slate-400'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Textarea Compacto */}
        <form onSubmit={handleCreateActivity} className="space-y-3">
          <textarea
            rows={2}
            value={formText}
            onChange={e => setFormText(e.target.value)}
            placeholder="O que foi feito e qual o próximo passo?"
            className="w-full text-xs sm:text-sm text-slate-800 placeholder-slate-400 border border-slate-200 rounded-xl p-2.5 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all resize-none"
          />

          {/* Grid Enxuto e Adaptado para Mobile */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 items-end">
            {/* Responsáveis */}
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Responsável
              </label>
              <div className="relative">
                <select
                  value={selectedAssignedTo}
                  onChange={e => setSelectedAssignedTo(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-lg text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500 appearance-none pr-7 cursor-pointer"
                >
                  {members.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.full_name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Prazo / Data */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Data
              </label>
              <input
                type="date"
                disabled={activeFormType === 'nota'}
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-40"
              />
            </div>

            {/* Horário */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Horário
              </label>
              <input
                type="time"
                disabled={activeFormType === 'nota'}
                value={dueTime}
                onChange={e => setDueTime(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-40"
              />
            </div>

            {/* Prioridade */}
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Prioridade
              </label>
              <div className="relative">
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-lg text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500 appearance-none pr-7 cursor-pointer"
                >
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                </select>
                <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Botões Compactos */}
          <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setFormText('')}
              className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !formText.trim()}
              className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold shadow-2xs transition-all cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>

      {/* LINHA DO TEMPO COM CONEXÃO VISUAL CONTÍNUA */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
          Histórico
        </h4>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
            <Loader2 size={18} className="animate-spin text-sky-600" />
            <span>Carregando histórico...</span>
          </div>
        ) : events.length === 0 ? (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center text-slate-400 text-xs">
            Nenhuma atividade ou interação registrada.
          </div>
        ) : (
          <div className="relative pl-6 sm:pl-7">
            {/* Linha vertical conectora */}
            <div className="absolute left-2.5 sm:left-3 top-3 bottom-3 w-0.5 bg-slate-200" />

            <div className="space-y-3">
              {events.map((ev) => {
                const configKey = ev.source === 'system' ? (ev.system_type || 'contact_created') : (ev.activity_type || 'tarefa');
                const config = TYPE_CONFIG[configKey] || TYPE_CONFIG.tarefa;
                const Icon = config.icon;
                const isDone = ev.status === 'concluida';
                const dynamicTitle = getDynamicTitle(ev);

                return (
                  <div key={ev.id} className="relative group">
                    {/* Nó circular sobre a linha */}
                    <div
                      className={`absolute -left-6 sm:-left-7 top-4 w-5 h-5 rounded-full flex items-center justify-center text-white shadow-xs z-10 ${
                        isDone ? 'bg-emerald-500 ring-2 ring-white' : `${config.nodeBg} ring-2 ring-white`
                      }`}
                      title={config.label}
                    >
                      <Icon size={11} className="stroke-[2.5]" />
                    </div>

                    {/* Card da Atividade */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 sm:p-4 shadow-2xs hover:border-slate-300 transition-all">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 border ${config.boxBg} ${config.boxBorder}`}>
                            <Icon size={17} className={config.iconColor} />
                          </div>

                          <div className="min-w-0 flex-1 pt-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                                {dynamicTitle}
                              </h4>
                              {ev.extra_badge && (
                                <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
                                  {ev.extra_badge}
                                </span>
                              )}
                            </div>

                            {ev.description && (
                              <p className="text-xs text-slate-500 mt-1 whitespace-pre-line leading-relaxed">
                                {ev.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {ev.source === 'activity' && ev.activity_type !== 'nota' && (
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(ev)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                                isDone
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 hover:bg-emerald-100'
                                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              <CheckCircle2 size={13} className={isDone ? 'text-emerald-600' : 'text-slate-400'} />
                              <span className="hidden sm:inline">{isDone ? 'Concluída' : 'Marcar Concluída'}</span>
                              <span className="sm:hidden">{isDone ? 'Feita' : 'Concluir'}</span>
                            </button>
                          )}

                          {ev.source === 'activity' && (permissions.isOwnerOrAdmin || ev.created_by_name === user?.profile?.full_name) && (
                            <button
                              type="button"
                              onClick={() => handleDeleteActivity(ev.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Excluir"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400">Criada por</span>
                            <div className="w-4 h-4 rounded-full bg-slate-900 text-white flex items-center justify-center text-[9px] font-bold">
                              {(ev.created_by_name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <span className="font-semibold text-slate-800 text-[11px] truncate max-w-[90px]">{ev.created_by_name}</span>
                          </div>

                          {ev.source === 'activity' && ev.assigned_to_name && (
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-400">Responsável</span>
                              <div className="w-4 h-4 rounded-full bg-sky-600 text-white flex items-center justify-center text-[9px] font-bold">
                                {(ev.assigned_to_name || 'U').charAt(0).toUpperCase()}
                              </div>
                              <span className="font-semibold text-slate-800 text-[11px] truncate max-w-[90px]">{ev.assigned_to_name}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1 text-[11px] text-slate-400">
                          <Clock size={11} />
                          <span>
                            {ev.due_date ? `Prazo: ${formatDateTime(ev.due_date)}` : formatDateTime(ev.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};