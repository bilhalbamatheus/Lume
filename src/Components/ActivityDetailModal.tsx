import React from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Calendar,
  Clock,
  Briefcase,
  User,
  CheckCircle2,
  Trash2,
  Edit3,
  Phone,
  Video,
  MapPin,
  MessageCircle,
  Mail,
  CheckSquare,
  AlertTriangle
} from 'lucide-react';

interface ActivityDetailModalProps {
  activity: any | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (activity: any) => void;
  onToggleComplete: (activity: any) => void;
  onDelete: (activity: any) => void;
}

export const ActivityDetailModal: React.FC<ActivityDetailModalProps> = ({
  activity,
  isOpen,
  onClose,
  onEdit,
  onToggleComplete,
  onDelete
}) => {
  if (!isOpen || !activity) return null;

  const isOverdue = activity.status === 'pendente' && activity.due_date && activity.due_date < new Date().toISOString();

  const renderTypeBadge = (type: string) => {
    switch (type) {
      case 'ligacao':
        return { label: 'Ligação', icon: <Phone size={13} />, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'reuniao':
        return { label: 'Reunião', icon: <Video size={13} />, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      case 'visita':
        return { label: 'Visita Técnica', icon: <MapPin size={13} />, color: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'whatsapp':
        return { label: 'WhatsApp', icon: <MessageCircle size={13} />, color: 'bg-teal-50 text-teal-700 border-teal-200' };
      case 'email':
        return { label: 'E-mail', icon: <Mail size={13} />, color: 'bg-sky-50 text-sky-700 border-sky-200' };
      default:
        return { label: 'Tarefa', icon: <CheckSquare size={13} />, color: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  const typeInfo = renderTypeBadge(activity.activity_type);

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Cabeçalho */}
        <div className="p-5 border-b border-slate-100 flex items-start justify-between bg-white shrink-0">
          <div className="space-y-1.5 pr-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border shadow-2xs ${typeInfo.color}`}>
                {typeInfo.icon}
                <span>{typeInfo.label}</span>
              </span>

              {activity.priority === 'alta' && (
                <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  Alta Prioridade 🔥
                </span>
              )}

              {activity.status === 'concluida' ? (
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Concluída
                </span>
              ) : isOverdue ? (
                <span className="text-[10px] text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                  Atrasada
                </span>
              ) : (
                <span className="text-[10px] text-sky-700 font-bold bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
                  Pendente
                </span>
              )}
            </div>

            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
              {activity.title}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700">
          {/* Data e Horário */}
          <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
            <Calendar size={15} className="text-sky-600 shrink-0" />
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-900">
                {activity.due_date ? new Date(activity.due_date).toLocaleDateString('pt-BR') : 'Sem data definida'}
              </span>
              {activity.due_date && (
                <span className="text-slate-400 flex items-center gap-1 font-mono">
                  <Clock size={12} />
                  {new Date(activity.due_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </div>

          {/* Descrição */}
          {activity.description ? (
            <div>
              <span className="font-bold text-[11px] text-slate-400 uppercase tracking-wider block mb-1">
                Pauta / Observações
              </span>
              <p className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-slate-800 leading-relaxed whitespace-pre-line">
                {activity.description}
              </p>
            </div>
          ) : (
            <p className="text-slate-400 italic">Nenhuma observação ou pauta preenchida.</p>
          )}

          {/* Vínculos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div>
              <span className="font-bold text-[11px] text-slate-400 uppercase tracking-wider block mb-1">
                Oportunidade
              </span>
              {activity.opportunity ? (
                <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                  <Briefcase size={14} className="text-sky-600 shrink-0" />
                  <span className="font-semibold text-slate-800 truncate">{activity.opportunity.title}</span>
                </div>
              ) : (
                <span className="text-slate-400 italic">Nenhuma vinculada</span>
              )}
            </div>

            <div>
              <span className="font-bold text-[11px] text-slate-400 uppercase tracking-wider block mb-1">
                Contato
              </span>
              {activity.contact ? (
                <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                  <User size={14} className="text-indigo-600 shrink-0" />
                  <span className="font-semibold text-slate-800 truncate">{activity.contact.display_name}</span>
                </div>
              ) : (
                <span className="text-slate-400 italic">Nenhum vinculado</span>
              )}
            </div>
          </div>

          {/* Responsáveis */}
          <div className="pt-2 border-t border-slate-100">
            <span className="font-bold text-[11px] text-slate-400 uppercase tracking-wider block mb-2">
              Responsáveis Atribuídos ({activity.assignees?.length || 0})
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {activity.assignees?.map((a: any, idx: number) => (
                <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200/80 rounded-xl">
                  {a.avatar_url ? (
                    <img src={a.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[9px] font-bold">
                      {a.name?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="font-medium text-slate-800">{a.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Rodapé de Ações */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              onClose();
              onDelete(activity);
            }}
            className="p-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition-colors cursor-pointer"
            title="Excluir Atividade"
          >
            <Trash2 size={16} />
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(activity);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-2xs"
            >
              <Edit3 size={14} />
              <span>Editar</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onToggleComplete(activity);
                onClose();
              }}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl text-white shadow-2xs transition-all cursor-pointer ${
                activity.status === 'concluida'
                  ? 'bg-amber-600 hover:bg-amber-500'
                  : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
            >
              <CheckCircle2 size={14} />
              <span>{activity.status === 'concluida' ? 'Marcar como Pendente' : 'Concluir Atividade'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};