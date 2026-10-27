import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  AlertCircle,
  Clock,
  Calendar,
  CheckCircle2,
  Phone,
  Video,
  MapPin,
  MessageCircle,
  Mail,
  CheckSquare,
  FileText,
  Briefcase,
  User,
  Building2,
  X
} from 'lucide-react';
import { ActivityCardItem } from './ActivityCardItem';

interface ActivitiesKanbanViewProps {
  activities: any[];
  currentUserId?: string;
  currentUserName?: string;
  teamMembers?: any[];
  onToggleComplete: (activity: any) => void;
  onEditActivity: (activity: any) => void;
  onDeleteActivity: (activity: any) => void;
  onOpenContact?: (contactId: string) => void;
  onOpenOpportunity?: (opportunityId: string) => void;
  onUpdateActivityDateOrStatus: (
    activityId: string,
    updates: { due_date?: string | null; status?: 'pendente' | 'concluida'; completed_at?: string | null }
  ) => Promise<void>;
}

export const ActivitiesKanbanView: React.FC<ActivitiesKanbanViewProps> = ({
  activities,
  currentUserId,
  currentUserName = 'Matheus',
  teamMembers = [],
  onToggleComplete,
  onEditActivity,
  onDeleteActivity,
  onOpenContact,
  onOpenOpportunity,
  onUpdateActivityDateOrStatus
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  const [selectedCardActivity, setSelectedCardActivity] = useState<any | null>(null);
  const [cardPosition, setCardPosition] = useState<{ x: number; y: number } | null>(null);
  const cardPopoverRef = useRef<HTMLDivElement>(null);

  const [draggedActivityId, setDraggedActivityId] = useState<string | null>(null);
  const [activeDropColumn, setActiveDropColumn] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (cardPopoverRef.current && !cardPopoverRef.current.contains(target)) {
        setSelectedCardActivity(null);
        setCardPosition(null);
      }
    };
    if (selectedCardActivity) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedCardActivity]);

  const columns = useMemo(() => {
    const overdue: any[] = [];
    const today: any[] = [];
    const upcoming: any[] = [];
    const completed: any[] = [];

    activities.forEach((act) => {
      if (act.status === 'concluida') {
        completed.push(act);
        return;
      }

      if (!act.due_date) {
        upcoming.push(act);
        return;
      }

      const actDate = act.due_date.split('T')[0];
      const isPast = act.due_date < new Date().toISOString() && actDate !== todayStr;

      if (isPast) {
        overdue.push(act);
      } else if (actDate === todayStr) {
        today.push(act);
      } else {
        upcoming.push(act);
      }
    });

    return [
      {
        id: 'overdue',
        title: 'Atrasadas',
        icon: AlertCircle,
        headerColor: 'text-rose-600 bg-rose-50 border-rose-200',
        badgeColor: 'bg-rose-100 text-rose-700',
        items: overdue
      },
      {
        id: 'today',
        title: 'Hoje',
        icon: Clock,
        headerColor: 'text-amber-600 bg-amber-50 border-amber-200',
        badgeColor: 'bg-amber-100 text-amber-700',
        items: today
      },
      {
        id: 'upcoming',
        title: 'Próximas',
        icon: Calendar,
        headerColor: 'text-sky-600 bg-sky-50 border-sky-200',
        badgeColor: 'bg-sky-100 text-sky-700',
        items: upcoming
      },
      {
        id: 'completed',
        title: 'Concluídas',
        icon: CheckCircle2,
        headerColor: 'text-emerald-600 bg-emerald-50 border-emerald-200',
        badgeColor: 'bg-emerald-100 text-emerald-700',
        items: completed
      }
    ];
  }, [activities, todayStr]);

  const renderTypeIcon = (type: string) => {
    switch (type) {
      case 'ligacao': return <Phone size={13} className="text-emerald-600" />;
      case 'reuniao': return <Video size={13} className="text-indigo-600" />;
      case 'visita': return <MapPin size={13} className="text-amber-600" />;
      case 'whatsapp': return <MessageCircle size={13} className="text-teal-600" />;
      case 'email': return <Mail size={13} className="text-sky-600" />;
      case 'proposta': return <FileText size={13} className="text-violet-600" />;
      default: return <CheckSquare size={13} className="text-slate-600" />;
    }
  };

  const getInitials = (name?: string | null) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const handleOpenCardDetailAtMouse = (e: React.MouseEvent, act: any) => {
    e.stopPropagation();
    const clickX = e.clientX;
    const clickY = e.clientY;

    const cardWidth = 440;
    const cardHeight = 260;

    const posX = clickX + cardWidth > window.innerWidth
      ? Math.max(16, window.innerWidth - cardWidth - 24)
      : Math.max(16, clickX);

    const posY = clickY + cardHeight > window.innerHeight
      ? Math.max(16, window.innerHeight - cardHeight - 24)
      : Math.max(16, clickY);

    setCardPosition({ x: posX, y: posY });
    setSelectedCardActivity(act);
  };

  const handleDragStart = (e: React.DragEvent, activityId: string) => {
    e.dataTransfer.setData('text/plain', activityId);
    setDraggedActivityId(activityId);
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    if (activeDropColumn !== colId) {
      setActiveDropColumn(colId);
    }
  };

  const handleDragLeave = () => {
    setActiveDropColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, targetColId: string) => {
    e.preventDefault();
    setActiveDropColumn(null);
    const actId = e.dataTransfer.getData('text/plain') || draggedActivityId;
    if (!actId) return;

    const activity = activities.find((a) => a.id === actId);
    if (!activity) return;

    const currentTime = activity.due_date
      ? new Date(activity.due_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : '14:00';

    if (targetColId === 'completed') {
      await onUpdateActivityDateOrStatus(actId, {
        status: 'concluida',
        completed_at: new Date().toISOString()
      });
    } else if (targetColId === 'today') {
      const newDue = `${todayStr}T${currentTime}:00`;
      await onUpdateActivityDateOrStatus(actId, {
        status: 'pendente',
        completed_at: null,
        due_date: new Date(newDue).toISOString()
      });
    } else if (targetColId === 'upcoming') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      const newDue = `${tomorrowStr}T${currentTime}:00`;
      await onUpdateActivityDateOrStatus(actId, {
        status: 'pendente',
        completed_at: null,
        due_date: new Date(newDue).toISOString()
      });
    } else if (targetColId === 'overdue') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const newDue = `${yesterdayStr}T${currentTime}:00`;
      await onUpdateActivityDateOrStatus(actId, {
        status: 'pendente',
        completed_at: null,
        due_date: new Date(newDue).toISOString()
      });
    }

    setDraggedActivityId(null);
  };

  return (
    <div className="w-full relative">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start w-full">
        {columns.map((col) => {
          const Icon = col.icon;
          const isDropActive = activeDropColumn === col.id;

          return (
            <div
              key={col.id}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.id)}
              className={`bg-slate-100/70 border rounded-2xl p-3 flex flex-col min-h-[550px] transition-colors ${
                isDropActive ? 'border-sky-500 bg-sky-50/40 ring-2 ring-sky-200' : 'border-slate-200/80'
              }`}
            >
              {/* Topo da Coluna */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 mb-3">
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                  <div className={`p-1 rounded-lg border ${col.headerColor}`}>
                    <Icon size={14} />
                  </div>
                  <span>{col.title}</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${col.badgeColor}`}>
                  {col.items.length}
                </span>
              </div>

              {/* Lista de Cards Resumidos */}
              <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[72vh] pr-0.5">
                {col.items.length === 0 ? (
                  <div className="py-14 text-center text-slate-400 text-xs italic">
                    Nenhuma atividade
                  </div>
                ) : (
                  col.items.map((act) => {
                    const isFinished = act.status === 'concluida';
                    const targetName = act.contact?.display_name || act.opportunity?.title;

                    return (
                      <div
                        key={act.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, act.id)}
                        onClick={(e) => handleOpenCardDetailAtMouse(e, act)}
                        className={`bg-white rounded-xl border p-3 shadow-2xs hover:shadow-xs transition-all cursor-grab active:cursor-grabbing hover:border-slate-300 space-y-2 group ${
                          isFinished ? 'border-slate-200 opacity-80' : 'border-slate-200'
                        }`}
                      >
                        {/* Vínculo superior compacto com clique no modal */}
                        {targetName && (
                          <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 truncate pb-1 border-b border-slate-100">
                            {act.contact ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  const contactId = act.contact_id || act.contact?.id;
                                  if (contactId && onOpenContact) onOpenContact(contactId);
                                }}
                                className="flex items-center gap-1 hover:text-sky-600 hover:underline cursor-pointer truncate"
                                title="Abrir perfil do contato"
                              >
                                {act.contact.type === 'company' ? (
                                  <Building2 size={11} className="text-indigo-600 shrink-0" />
                                ) : (
                                  <User size={11} className="text-sky-600 shrink-0" />
                                )}
                                <span className="truncate">{targetName}</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  const oppId = act.opportunity_id || act.opportunity?.id;
                                  if (oppId && onOpenOpportunity) onOpenOpportunity(oppId);
                                }}
                                className="flex items-center gap-1 hover:text-sky-600 hover:underline cursor-pointer truncate"
                                title="Abrir detalhes da oportunidade"
                              >
                                <Briefcase size={11} className="text-sky-600 shrink-0" />
                                <span className="truncate">{targetName}</span>
                              </button>
                            )}
                          </div>
                        )}

                        {/* Título e Ícone */}
                        <div className="flex items-start gap-2">
                          <div className="p-1.5 rounded-lg bg-slate-100 border border-slate-200 shrink-0 mt-0.5">
                            {renderTypeIcon(act.activity_type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h5
                              className={`font-bold text-xs text-slate-800 leading-snug truncate ${
                                isFinished ? 'line-through text-slate-400' : ''
                              }`}
                            >
                              {act.title}
                            </h5>
                            {act.description && (
                              <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                                {act.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Rodapé Resumido */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-400">
                          {act.due_date ? (
                            <span className="flex items-center gap-1 font-mono font-medium text-slate-600">
                              <Clock size={10} />
                              {new Date(act.due_date).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          ) : (
                            <span>Sem hora</span>
                          )}

                          <div className="flex items-center -space-x-1">
                            {(act.assignees || []).slice(0, 3).map((assignee: any, idx: number) => (
                              <div
                                key={idx}
                                className="h-4.5 w-4.5 rounded-full bg-sky-600 text-white flex items-center justify-center font-bold text-[8px] border border-white"
                              >
                                {getInitials(assignee.name)}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* CARD COMPLETO NA POSIÇÃO DO MOUSE AO CLICAR EM QUALQUER ITEM DO KANBAN */}
      {selectedCardActivity && cardPosition && (
        <div
          ref={cardPopoverRef}
          style={{
            position: 'fixed',
            left: `${cardPosition.x}px`,
            top: `${cardPosition.y}px`,
            zIndex: 140
          }}
          className="w-[440px] max-w-[92vw] shadow-2xl animate-in fade-in zoom-in-95 duration-150 relative"
        >
          <button
            type="button"
            onClick={() => {
              setSelectedCardActivity(null);
              setCardPosition(null);
            }}
            className="absolute top-2 right-2 z-20 p-1 bg-white/90 hover:bg-white text-slate-400 hover:text-slate-700 rounded-lg shadow-2xs border border-slate-200 cursor-pointer"
            title="Fechar"
          >
            <X size={14} />
          </button>

          <ActivityCardItem
            activity={selectedCardActivity}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            teamMembers={teamMembers}
            onToggleComplete={(act) => {
              onToggleComplete(act);
              setSelectedCardActivity((prev: any) =>
                prev ? { ...prev, status: prev.status === 'pendente' ? 'concluida' : 'pendente' } : null
              );
            }}
            onEdit={(act) => {
              setSelectedCardActivity(null);
              onEditActivity(act);
            }}
            onDelete={(act) => {
              setSelectedCardActivity(null);
              onDeleteActivity(act);
            }}
            onOpenContact={(id) => {
              setSelectedCardActivity(null);
              if (onOpenContact) onOpenContact(id);
            }}
            onOpenOpportunity={(id) => {
              setSelectedCardActivity(null);
              if (onOpenOpportunity) onOpenOpportunity(id);
            }}
          />
        </div>
      )}
    </div>
  );
};