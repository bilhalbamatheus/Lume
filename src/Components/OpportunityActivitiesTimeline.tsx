import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Mail,
  Phone,
  MessageSquare,
  FileText,
  UserCheck,
  MapPin,
  Clock,
  Loader2,
  Plus,
  X,
  Send,
  Calendar,
  CheckCircle2,
  Trash2
} from 'lucide-react';

interface TimelineActivity {
  id: string;
  type: string;
  title: string;
  description: string | null;
  created_at: string;
  due_date: string | null;
  status: 'pendente' | 'concluida' | 'cancelada';
  created_by?: string | null;
  creator?: {
    full_name: string;
    avatar_url: string | null;
  } | null;
}

interface OpportunityActivitiesTimelineProps {
  opportunityId: string;
  contactId?: string | null;
}

export const OpportunityActivitiesTimeline: React.FC<OpportunityActivitiesTimelineProps> = ({
  opportunityId,
  contactId
}) => {
  const { user } = useAuth();
  const [activities, setActivities] = useState<TimelineActivity[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulário Inline (Estilo padrão do ActivitiesView)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activityType, setActivityType] = useState('email');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueTime, setDueTime] = useState('14:00');
  const [saving, setSaving] = useState(false);

  const loadActivities = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('activities')
        .select(`
          id,
          type,
          title,
          description,
          created_at,
          due_date,
          status,
          created_by,
          creator:profiles!created_by (
            full_name,
            avatar_url
          )
        `)
        .eq('opportunity_id', opportunityId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted: TimelineActivity[] = (data || []).map((it: any) => ({
        ...it,
        creator: Array.isArray(it.creator) ? it.creator[0] : it.creator
      }));

      setActivities(formatted);
    } catch (err) {
      console.warn('Erro ao carregar atividades da oportunidade:', err);
    } finally {
      setLoading(false);
    }
  }, [opportunityId]);

  useEffect(() => {
    if (opportunityId) {
      loadActivities();
    }
  }, [opportunityId, loadActivities]);

  const handleSaveActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !user?.company?.id) return;

    try {
      setSaving(true);
      const sessionData = await supabase.auth.getSession();
      const authUserId = sessionData.data.session?.user?.id || user.id;

      const typeLabels: Record<string, string> = {
        email: 'E-mail a enviar',
        ligacao: 'Ligação',
        whatsapp: 'WhatsApp',
        proposta: 'Proposta Comercial',
        reuniao: 'Reunião',
        visita: 'Visita'
      };

      const combinedDue = dueDate ? `${dueDate}T${dueTime || '14:00'}:00` : null;

      const { error } = await supabase.from('activities').insert({
        company_id: user.company.id,
        opportunity_id: opportunityId,
        contact_id: contactId || null,
        created_by: authUserId,
        type: activityType,
        title: typeLabels[activityType] || 'Atividade',
        description: description.trim(),
        status: 'pendente',
        due_date: combinedDue
      });

      if (error) throw error;

      setDescription('');
      setIsFormOpen(false);
      await loadActivities();
    } catch (err: any) {
      alert(`Falha ao registrar atividade: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (activityId: string, currentStatus: string) => {
    try {
      const nextStatus = currentStatus === 'concluida' ? 'pendente' : 'concluida';
      const { error } = await supabase
        .from('activities')
        .update({
          status: nextStatus,
          completed_at: nextStatus === 'concluida' ? new Date().toISOString() : null
        })
        .eq('id', activityId);

      if (error) throw error;
      await loadActivities();
    } catch (err: any) {
      alert(`Erro ao atualizar status: ${err.message}`);
    }
  };

  const handleDeleteActivity = async (activityId: string) => {
    if (!window.confirm('Deseja realmente excluir esta atividade?')) return;
    try {
      const { error } = await supabase.from('activities').delete().eq('id', activityId);
      if (error) throw error;
      await loadActivities();
    } catch (err: any) {
      alert(`Erro ao excluir atividade: ${err.message}`);
    }
  };

  const renderIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail size={16} className="text-sky-600" />;
      case 'ligacao':
        return <Phone size={16} className="text-emerald-600" />;
      case 'whatsapp':
        return <MessageSquare size={16} className="text-teal-600" />;
      case 'proposta':
        return <FileText size={16} className="text-violet-600" />;
      case 'reuniao':
        return <UserCheck size={16} className="text-indigo-600" />;
      case 'visita':
        return <MapPin size={16} className="text-amber-600" />;
      default:
        return <FileText size={16} className="text-slate-500" />;
    }
  };

  const formatActivityDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const userInitial = user?.email ? user.email.slice(0, 2).toUpperCase() : 'EU';

  return (
    <div className="space-y-4">
      {/* Botão de Alternância do Formulário */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsFormOpen(!isFormOpen)}
          className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-2xs border ${
            isFormOpen
              ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
              : 'bg-sky-600 border-sky-600 text-white hover:bg-sky-500 active:scale-98'
          }`}
        >
          {isFormOpen ? <X size={14} /> : <Plus size={14} />}
          <span>{isFormOpen ? 'Fechar Formulário' : 'Nova Atividade'}</span>
        </button>

        <span className="text-xs font-medium text-slate-400">
          {activities.length} {activities.length === 1 ? 'atividade' : 'atividades'}
        </span>
      </div>

      {/* Formulário Inline */}
      {isFormOpen && (
        <form
          onSubmit={handleSaveActivity}
          className="bg-white border border-sky-200/80 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 animate-in fade-in duration-150"
        >
          {/* Seletor Pílula de Tipos */}
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { id: 'email', label: 'E-mail', icon: Mail },
              { id: 'ligacao', label: 'Ligação', icon: Phone },
              { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
              { id: 'proposta', label: 'Proposta', icon: FileText },
              { id: 'reuniao', label: 'Reunião', icon: UserCheck },
              { id: 'visita', label: 'Visita', icon: MapPin }
            ].map((btn) => {
              const Icon = btn.icon;
              const active = activityType === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setActivityType(btn.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer border ${
                    active
                      ? 'bg-sky-50 text-sky-700 border-sky-300 shadow-2xs font-semibold'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Icon size={13} className={active ? 'text-sky-600' : 'text-slate-400'} />
                  <span>{btn.label}</span>
                </button>
              );
            })}
          </div>

          {/* Campo de Descrição */}
          <textarea
            rows={3}
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="O que foi feito e qual o próximo passo?"
            className="w-full p-3.5 bg-slate-50/60 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white resize-none transition-all"
          />

          {/* Barra Inferior com Responsável e Datas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="block text-[11px] font-semibold text-slate-400 mb-1">
                Responsáveis
              </span>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-sky-50 border border-sky-200 rounded-xl text-xs font-semibold text-sky-800 shadow-2xs">
                <div className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[9px] font-bold">
                  {userInitial}
                </div>
                <span>Eu ({user?.email?.split('@')[0] || 'Usuário'})</span>
              </div>
            </div>

            <div>
              <span className="block text-[11px] font-semibold text-slate-400 mb-1">
                Prazo / Data
              </span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <span className="block text-[11px] font-semibold text-slate-400 mb-1">
                Horário
              </span>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* Botões Cancelar e Salvar */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !description.trim()}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-xs transition-all cursor-pointer active:scale-98 disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              <span>Salvar</span>
            </button>
          </div>
        </form>
      )}

      {/* Lista de Atividades */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 text-xs">
          <Loader2 size={18} className="animate-spin mx-auto mb-2 text-sky-600" />
          Carregando atividades...
        </div>
      ) : activities.length === 0 ? (
        <div className="py-12 text-center bg-slate-50/60 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-400">
          Nenhuma atividade registrada para esta negociação.
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((act) => (
            <div
              key={act.id}
              className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs hover:border-slate-300 transition-all space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center shrink-0">
                    {renderIcon(act.type)}
                  </div>

                  <div className="min-w-0">
                    <h4 className="font-bold text-sm text-slate-900 leading-tight">
                      {act.title}
                    </h4>
                    {act.description && (
                      <p className="text-xs text-slate-600 whitespace-pre-line mt-1 leading-relaxed">
                        {act.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(act.id, act.status)}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer shadow-2xs ${
                      act.status === 'concluida'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <CheckCircle2
                      size={13}
                      className={act.status === 'concluida' ? 'text-emerald-600' : 'text-slate-400'}
                    />
                    <span>{act.status === 'concluida' ? 'Concluída' : 'Marcar Concluída'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteActivity(act.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                    title="Excluir Atividade"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Rodapé do Card */}
              <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span>Criada por</span>
                  {act.creator?.avatar_url ? (
                    <img
                      src={act.creator.avatar_url}
                      alt=""
                      className="w-4 h-4 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-sky-600 text-white flex items-center justify-center font-bold text-[8px]">
                      {act.creator?.full_name?.charAt(0) || 'U'}
                    </div>
                  )}
                  <strong className="text-slate-700">{act.creator?.full_name || 'Usuário'}</strong>
                </div>

                <div className="flex items-center gap-1 font-mono text-slate-400">
                  <Clock size={12} />
                  <span>{formatActivityDate(act.due_date || act.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};