import React, { useState } from 'react';
import {
  Mail,
  Phone,
  MessageCircle,
  FileText,
  MapPin,
  Users,
  CheckSquare,
  Clock,
  CheckCircle2,
  Briefcase,
  User,
  Building2,
  Trash2,
  Edit3
} from 'lucide-react';

export interface ActivityCardItemProps {
  activity: any;
  currentUserId?: string;
  currentUserName?: string;
  teamMembers?: Array<{ id: string; name: string; email?: string; avatar_url?: string | null }>;
  onToggleComplete: (activity: any) => void;
  onEdit: (activity: any) => void;
  onDelete: (activity: any) => void;
  onOpenContact?: (contactId: string) => void;
  onOpenOpportunity?: (opportunityId: string) => void;
  className?: string;
}

export const ActivityCardItem: React.FC<ActivityCardItemProps> = ({
  activity,
  currentUserId,
  currentUserName = 'Matheus',
  teamMembers = [],
  onToggleComplete,
  onEdit,
  onDelete,
  onOpenContact,
  onOpenOpportunity,
  className = ''
}) => {
  const [hoveredAssigneeKey, setHoveredAssigneeKey] = useState<string | null>(null);
  const [hoveredCreatorKey, setHoveredCreatorKey] = useState<string | null>(null);
  const [hoveredOppKey, setHoveredOppKey] = useState<string | null>(null);
  const [hoveredContactKey, setHoveredContactKey] = useState<string | null>(null);

  const isFinished = activity.status === 'concluida';
  const isSelfCreator =
    activity.created_by === currentUserId ||
    !activity.created_by;

  const creatorMember = isSelfCreator
    ? {
        id: currentUserId || '',
        name: currentUserName,
        email: '',
        avatar_url: null
      }
    : teamMembers.find((m) => m.id === activity.created_by) || {
        id: activity.created_by || '',
        name: 'Colega de Equipe',
        email: '',
        avatar_url: null
      };

  const getInitials = (name?: string | null) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const renderTypeIcon = (type: string, size = 18) => {
    switch (type) {
      case 'email':
        return <Mail size={size} className="text-sky-600" />;
      case 'ligacao':
        return <Phone size={size} className="text-emerald-600" />;
      case 'whatsapp':
        return <MessageCircle size={size} className="text-teal-600" />;
      case 'proposta':
        return <FileText size={size} className="text-indigo-600" />;
      case 'reuniao':
        return <Users size={size} className="text-violet-600" />;
      case 'visita':
        return <MapPin size={size} className="text-amber-600" />;
      default:
        return <CheckSquare size={size} className="text-slate-600" />;
    }
  };

  const formatCurrency = (val: number | null | undefined) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  const handleContactClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const contactId = activity.contact_id || activity.contact?.id;
    if (contactId && onOpenContact) {
      onOpenContact(contactId);
    }
  };

  const handleOpportunityClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const oppId = activity.opportunity_id || activity.opportunity?.id;
    if (oppId && onOpenOpportunity) {
      onOpenOpportunity(oppId);
    }
  };

  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden transition-all hover:border-slate-300 ${className}`}
    >
      {/* CABEÇALHO DO CARD: VÍNCULOS COM CLIQUE DIRETO */}
      {(activity.opportunity || activity.contact) && (
        <div className="px-4 py-2 bg-slate-50/70 border-b border-slate-100 flex items-center gap-2 text-xs text-slate-600 flex-wrap">
          {activity.contact && (
            <div
              className="relative inline-block"
              onMouseEnter={() => setHoveredContactKey(activity.id)}
              onMouseLeave={() => setHoveredContactKey(null)}
            >
              <button
                type="button"
                onClick={handleContactClick}
                className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-sky-600 hover:underline cursor-pointer transition-colors"
                title="Abrir perfil do contato"
              >
                {activity.contact.type === 'company' ? (
                  <Building2 size={13} className="text-indigo-600" />
                ) : (
                  <User size={13} className="text-sky-600" />
                )}
                <span>{activity.contact.display_name}</span>
              </button>

              {hoveredContactKey === activity.id && (
                <div className="absolute left-0 bottom-full mb-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 z-50 animate-in fade-in duration-150 text-xs pointer-events-none">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100 shrink-0">
                      {activity.contact.type === 'company' ? <Building2 size={14} /> : <User size={14} />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">
                        {activity.contact.display_name}
                      </p>
                      <span className="text-[10px] text-slate-400">
                        {activity.contact.type === 'company'
                          ? 'Pessoa Jurídica'
                          : 'Pessoa Física'}
                      </span>
                    </div>
                  </div>
                  <div className="pt-2 space-y-1 text-[11px] text-slate-600">
                    {activity.contact.phone && (
                      <p className="flex items-center gap-1.5 truncate">
                        <Phone size={11} className="text-emerald-500 shrink-0" />
                        <span>{activity.contact.phone}</span>
                      </p>
                    )}
                    {activity.contact.email && (
                      <p className="flex items-center gap-1.5 truncate">
                        <Mail size={11} className="text-sky-500 shrink-0" />
                        <span>{activity.contact.email}</span>
                      </p>
                    )}
                    <p className="text-[10px] text-sky-600 font-semibold pt-1">
                      Clique para ver perfil completo
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activity.opportunity && (
            <>
              {activity.contact && <span className="text-slate-300">•</span>}
              <div
                className="relative inline-block"
                onMouseEnter={() => setHoveredOppKey(activity.id)}
                onMouseLeave={() => setHoveredOppKey(null)}
              >
                <button
                  type="button"
                  onClick={handleOpportunityClick}
                  className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-sky-600 hover:underline cursor-pointer transition-colors"
                  title="Abrir detalhes da oportunidade"
                >
                  <Briefcase size={12} className="text-sky-600" />
                  <span>{activity.opportunity.title}</span>
                </button>

                {hoveredOppKey === activity.id && (
                  <div className="absolute left-0 bottom-full mb-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 z-50 animate-in fade-in duration-150 text-xs pointer-events-none">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                      <div className="p-1.5 bg-sky-50 text-sky-600 rounded-lg border border-sky-100 shrink-0">
                        <Briefcase size={14} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate">
                          {activity.opportunity.title}
                        </p>
                        <span className="text-[10px] text-slate-400">
                          Oportunidade Comercial
                        </span>
                      </div>
                    </div>
                    <div className="pt-2 space-y-1 text-[11px] text-slate-600">
                      <p className="flex justify-between">
                        <span>Valor Estimado:</span>
                        <strong className="text-slate-900">
                          {formatCurrency(activity.opportunity.estimated_value)}
                        </strong>
                      </p>
                      <p className="flex justify-between">
                        <span>Status do Negócio:</span>
                        <span className="capitalize font-semibold text-sky-700">
                          {activity.opportunity.status?.replace('_', ' ') || 'Em Andamento'}
                        </span>
                      </p>
                      <p className="text-[10px] text-sky-600 font-semibold pt-1">
                        Clique para ver detalhes do negócio
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* CORPO DO CARD */}
      <div className="p-4 flex flex-col md:flex-row md:items-start justify-between gap-3.5">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200/60 shrink-0">
            {renderTypeIcon(activity.activity_type, 18)}
          </div>

          <div className="space-y-1 flex-1 min-w-0">
            <h4 className="font-bold text-sm text-slate-900 leading-snug">
              {activity.title}
            </h4>
            {activity.description && (
              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                {activity.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex md:flex-col items-center md:items-end justify-between md:justify-start gap-2 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleComplete(activity);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs ${
              isFinished
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200'
            }`}
          >
            <CheckCircle2
              size={13}
              className={isFinished ? 'text-emerald-600' : 'text-slate-400'}
            />
            <span>
              {isFinished
                ? `Finalizada ${
                    activity.completed_at
                      ? new Date(activity.completed_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'short'
                        })
                      : ''
                  }`
                : 'Marcar Concluída'}
            </span>
          </button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(activity);
              }}
              className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
              title="Editar Atividade"
            >
              <Edit3 size={15} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(activity);
              }}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              title="Excluir Atividade"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* RODAPÉ DO CARD */}
      <div className="px-4 py-2.5 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <div
            className="relative inline-block"
            onMouseEnter={() => setHoveredCreatorKey(activity.id)}
            onMouseLeave={() => setHoveredCreatorKey(null)}
          >
            <div className="flex items-center gap-1.5 text-slate-500 text-[11px] cursor-pointer">
              <span>Criada por</span>
              {creatorMember.avatar_url ? (
                <img
                  src={creatorMember.avatar_url}
                  alt=""
                  className="h-5 w-5 rounded-full object-cover border border-white shadow-2xs"
                />
              ) : (
                <div className="h-5 w-5 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-[9px] shadow-2xs">
                  {getInitials(creatorMember.name)}
                </div>
              )}
              <span className="font-semibold text-slate-700">
                {isSelfCreator ? 'Eu' : creatorMember.name.split(' ')[0]}
              </span>
            </div>

            {hoveredCreatorKey === activity.id && (
              <div className="absolute left-0 bottom-full mb-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 z-50 animate-in fade-in duration-150 text-xs pointer-events-none">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <div className="h-7 w-7 rounded-lg bg-slate-800 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    {getInitials(creatorMember.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">
                      {creatorMember.name}
                    </p>
                    <span className="text-[10px] text-slate-400">
                      Criador da Atividade
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-slate-500 text-[11px] pl-3 border-l border-slate-200">
            <span>Responsáveis</span>
            <div className="flex items-center -space-x-1.5">
              {(activity.assignees || []).map((assignee: any, idx: number) => {
                const hoverKey = `${activity.id}-${assignee.id}-${idx}`;
                const isHovered = hoveredAssigneeKey === hoverKey;

                return (
                  <div
                    key={idx}
                    className="relative inline-block"
                    onMouseEnter={() => setHoveredAssigneeKey(hoverKey)}
                    onMouseLeave={() => setHoveredAssigneeKey(null)}
                  >
                    <div className="cursor-pointer">
                      {assignee.avatar_url ? (
                        <img
                          src={assignee.avatar_url}
                          alt=""
                          className="h-5 w-5 rounded-full object-cover border border-white shadow-2xs hover:scale-110 transition-transform"
                        />
                      ) : (
                        <div className="h-5 w-5 rounded-full bg-sky-600 text-white flex items-center justify-center font-bold text-[9px] border border-white shadow-2xs hover:scale-110 transition-transform">
                          {getInitials(assignee.name)}
                        </div>
                      )}
                    </div>

                    {isHovered && (
                      <div className="absolute left-0 bottom-full mb-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 z-50 animate-in fade-in duration-150 text-xs pointer-events-none">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                          <div className="h-7 w-7 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                            {getInitials(assignee.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate">
                              {assignee.name}
                            </p>
                            <span className="text-[10px] text-slate-400">
                              Equipe Interna
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {activity.due_date && (
          <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
            <Clock size={11} />
            {new Date(activity.due_date).toLocaleDateString('pt-BR')}{' '}
            {new Date(activity.due_date).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        )}
      </div>
    </div>
  );
};