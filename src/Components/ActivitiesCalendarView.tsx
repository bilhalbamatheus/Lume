import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Phone,
  Video,
  MapPin,
  MessageCircle,
  Mail,
  CheckSquare,
  FileText,
  Users,
  Briefcase,
  User,
  X,
  Check,
  ChevronDown
} from 'lucide-react';
import { ActivityCardItem } from './ActivityCardItem';

interface ActivitiesCalendarViewProps {
  activities: any[];
  teamMembers?: Array<{ id: string; name: string; email?: string; avatar_url?: string | null }>;
  currentUserId?: string;
  currentUserName?: string;
  onToggleComplete: (activity: any) => void;
  onEditActivity: (activity: any) => void;
  onDeleteActivity: (activity: any) => void;
  onOpenContact?: (contactId: string) => void;
  onOpenOpportunity?: (opportunityId: string) => void;
  onQuickCreate: (data: {
    description: string;
    dueDate: string;
    dueTime: string;
    activityType: string;
    opportunityId?: string | null;
    contactId?: string | null;
    assigneeIds: string[];
  }) => Promise<void>;
  oppList?: Array<{ id: string; title: string }>;
  contactList?: Array<{ id: string; display_name: string; type: string }>;
}

type CalendarViewMode = 'month' | 'week' | 'day';

export const ActivitiesCalendarView: React.FC<ActivitiesCalendarViewProps> = ({
  activities,
  teamMembers = [],
  currentUserId,
  currentUserName = 'Matheus',
  onToggleComplete,
  onEditActivity,
  onDeleteActivity,
  onOpenContact,
  onOpenOpportunity,
  onQuickCreate,
  oppList = [],
  contactList = []
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');

  // Popover de CRIAÇÃO RÁPIDA no mouse
  const [createPopupPosition, setCreatePopupPosition] = useState<{ x: number; y: number } | null>(null);
  const [popupDate, setPopupDate] = useState<string | null>(null);
  const [popupTime, setPopupTime] = useState<string>('12:00');
  const [popupType, setPopupType] = useState<string>('tarefa');
  const [popupDescription, setPopupDescription] = useState<string>('');
  const [popupSearchTarget, setPopupSearchTarget] = useState<string>('');
  const [popupSelectedOppId, setPopupSelectedOppId] = useState<string | null>(null);
  const [popupSelectedContactId, setPopupSelectedContactId] = useState<string | null>(null);
  const [isTargetDropdownOpen, setIsTargetDropdownOpen] = useState(false);
  const [popupAssignees, setPopupAssignees] = useState<string[]>([]);
  const [isAssigneeDropdownOpen, setIsAssigneeDropdownOpen] = useState(false);
  const [isSavingPopup, setIsSavingPopup] = useState(false);

  // Popover do CARD DE VISUALIZAÇÃO DA ATIVIDADE no mouse
  const [viewCardActivity, setViewCardActivity] = useState<any | null>(null);
  const [viewCardPosition, setViewCardPosition] = useState<{ x: number; y: number } | null>(null);

  const popoverCreateRef = useRef<HTMLDivElement>(null);
  const popoverViewRef = useRef<HTMLDivElement>(null);
  const assigneeDropdownRef = useRef<HTMLDivElement>(null);
  const targetDropdownRef = useRef<HTMLDivElement>(null);

  // Fecha popovers ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverCreateRef.current && !popoverCreateRef.current.contains(target)) {
        closeQuickCreatePopup();
      }
      if (popoverViewRef.current && !popoverViewRef.current.contains(target)) {
        setViewCardActivity(null);
        setViewCardPosition(null);
      }
      if (assigneeDropdownRef.current && !assigneeDropdownRef.current.contains(target)) {
        setIsAssigneeDropdownOpen(false);
      }
      if (targetDropdownRef.current && !targetDropdownRef.current.contains(target)) {
        setIsTargetDropdownOpen(false);
      }
    };

    if (popupDate || viewCardActivity) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [popupDate, viewCardActivity]);

  const handlePrev = () => {
    const d = new Date(currentDate);
    if (viewMode === 'month') d.setMonth(d.getMonth() - 1);
    else if (viewMode === 'week') d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (viewMode === 'month') d.setMonth(d.getMonth() + 1);
    else if (viewMode === 'week') d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Abre popup de CRIAÇÃO no mouse
  const openQuickCreatePopup = (e: React.MouseEvent, dateStr: string, timeStr = '12:00') => {
    setViewCardActivity(null);
    const clickX = e.clientX;
    const clickY = e.clientY;

    const popupWidth = 350;
    const popupHeight = 440;

    const posX = clickX + popupWidth > window.innerWidth
      ? Math.max(16, window.innerWidth - popupWidth - 24)
      : Math.max(16, clickX);

    const posY = clickY + popupHeight > window.innerHeight
      ? Math.max(16, window.innerHeight - popupHeight - 24)
      : Math.max(16, clickY);

    setCreatePopupPosition({ x: posX, y: posY });
    setPopupDate(dateStr);
    setPopupTime(timeStr);
    setPopupType('tarefa');
    setPopupDescription('');
    setPopupSearchTarget('');
    setPopupSelectedOppId(null);
    setPopupSelectedContactId(null);
    setPopupAssignees([]);
  };

  const closeQuickCreatePopup = () => {
    setPopupDate(null);
    setCreatePopupPosition(null);
    setIsTargetDropdownOpen(false);
    setIsAssigneeDropdownOpen(false);
  };

  // Abre o CARD DE VISUALIZAÇÃO no mouse
  const openActivityCardAtMouse = (e: React.MouseEvent, act: any) => {
    e.stopPropagation();
    closeQuickCreatePopup();

    const clickX = e.clientX;
    const clickY = e.clientY;

    const cardWidth = 460;
    const cardHeight = 280;

    const posX = clickX + cardWidth > window.innerWidth
      ? Math.max(16, window.innerWidth - cardWidth - 24)
      : Math.max(16, clickX);

    const posY = clickY + cardHeight > window.innerHeight
      ? Math.max(16, window.innerHeight - cardHeight - 24)
      : Math.max(16, clickY);

    setViewCardPosition({ x: posX, y: posY });
    setViewCardActivity(act);
  };

  const handleSubmitPopup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!popupDescription.trim() || !popupDate) return;

    try {
      setIsSavingPopup(true);
      await onQuickCreate({
        description: popupDescription.trim(),
        dueDate: popupDate,
        dueTime: popupTime,
        activityType: popupType,
        opportunityId: popupSelectedOppId,
        contactId: popupSelectedContactId,
        assigneeIds: popupAssignees
      });
      closeQuickCreatePopup();
    } catch (err: any) {
      alert(`Erro ao criar atividade: ${err.message}`);
    } finally {
      setIsSavingPopup(false);
    }
  };

  const renderTypeIcon = (type: string) => {
    switch (type) {
      case 'ligacao': return <Phone size={11} className="shrink-0 text-emerald-600" />;
      case 'reuniao': return <Video size={11} className="shrink-0 text-indigo-600" />;
      case 'visita': return <MapPin size={11} className="shrink-0 text-amber-600" />;
      case 'whatsapp': return <MessageCircle size={11} className="shrink-0 text-teal-600" />;
      case 'email': return <Mail size={11} className="shrink-0 text-sky-600" />;
      case 'proposta': return <FileText size={11} className="shrink-0 text-violet-600" />;
      default: return <CheckSquare size={11} className="shrink-0 text-slate-500" />;
    }
  };

  const getActivityDisplayLabel = (act: any) => {
    const parts = [];
    if (act.due_date) {
      const time = new Date(act.due_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      parts.push(time);
    }
    const target = act.contact?.display_name || act.opportunity?.title || act.title;
    parts.push(target);
    return parts.join(' • ');
  };

  const otherTeamMembers = teamMembers.filter((m) => m.id !== currentUserId);

  // ========================================================
  // RENDERIZAÇÃO: MÊS
  // ========================================================
  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const days = [];
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    for (let d = 1; d <= totalDays; d++) {
      days.push(new Date(year, month, d));
    }

    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const todayYMD = new Date().toISOString().split('T')[0];

    return (
      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200 text-center text-xs font-bold text-slate-600 py-2.5">
          {weekDays.map((wd) => (
            <div key={wd}>{wd}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
          {days.map((dateObj, idx) => {
            if (!dateObj) {
              return <div key={`empty-${idx}`} className="h-28 bg-slate-50/40" />;
            }

            const ymd = dateObj.toISOString().split('T')[0];
            const isToday = ymd === todayYMD;
            const dayActivities = activities.filter((a) => a.due_date && a.due_date.startsWith(ymd));

            return (
              <div
                key={ymd}
                onClick={(e) => openQuickCreatePopup(e, ymd, '12:00')}
                className="h-28 p-1.5 flex flex-col justify-between hover:bg-sky-50/20 transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                      isToday ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-700'
                    }`}
                  >
                    {dateObj.getDate()}
                  </span>
                  {dayActivities.length > 0 && (
                    <span className="text-[10px] font-semibold text-slate-400">
                      {dayActivities.length}
                    </span>
                  )}
                </div>

                <div className="space-y-1 overflow-y-auto max-h-20 scrollbar-none">
                  {dayActivities.map((act) => (
                    <div
                      key={act.id}
                      onClick={(e) => openActivityCardAtMouse(e, act)}
                      className={`px-1.5 py-0.5 rounded-lg text-[10px] font-semibold truncate flex items-center gap-1 shadow-2xs border transition-transform hover:scale-101 cursor-pointer ${
                        act.status === 'concluida'
                          ? 'bg-slate-100 text-slate-400 line-through border-slate-200'
                          : 'bg-white text-slate-800 hover:border-sky-300 border-slate-200'
                      }`}
                    >
                      {renderTypeIcon(act.activity_type)}
                      <span className="truncate">{getActivityDisplayLabel(act)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ========================================================
  // RENDERIZAÇÃO: SEMANA
  // ========================================================
  const renderWeekView = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      days.push(d);
    }

    const hours = Array.from({ length: 13 }, (_, i) => i + 8);
    const todayYMD = new Date().toISOString().split('T')[0];

    return (
      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
        <div className="grid grid-cols-8 bg-slate-50 border-b border-slate-200 text-center py-2.5 text-xs font-bold text-slate-600">
          <div className="text-slate-400">Hora</div>
          {days.map((d) => {
            const ymd = d.toISOString().split('T')[0];
            const isToday = ymd === todayYMD;
            return (
              <div key={ymd} className="space-y-0.5">
                <span className="block text-[10px] text-slate-400 uppercase">
                  {d.toLocaleDateString('pt-BR', { weekday: 'short' })}
                </span>
                <span
                  className={`inline-block px-2 py-0.5 rounded-full ${
                    isToday ? 'bg-sky-600 text-white' : 'text-slate-800'
                  }`}
                >
                  {d.getDate()}
                </span>
              </div>
            );
          })}
        </div>

        <div className="divide-y divide-slate-100 max-h-[580px] overflow-y-auto">
          {hours.map((h) => {
            const timeStr = `${String(h).padStart(2, '0')}:00`;

            return (
              <div key={h} className="grid grid-cols-8 divide-x divide-slate-100 min-h-[52px]">
                <div className="text-center text-[10px] text-slate-400 font-mono py-1 bg-slate-50/50">
                  {timeStr}
                </div>

                {days.map((d) => {
                  const ymd = d.toISOString().split('T')[0];
                  const actsInHour = activities.filter((a) => {
                    if (!a.due_date || !a.due_date.startsWith(ymd)) return false;
                    const actHour = new Date(a.due_date).getHours();
                    return actHour === h;
                  });

                  return (
                    <div
                      key={ymd}
                      onClick={(e) => openQuickCreatePopup(e, ymd, timeStr)}
                      className="p-1 hover:bg-sky-50/20 transition-colors cursor-pointer space-y-1"
                    >
                      {actsInHour.map((act) => (
                        <div
                          key={act.id}
                          onClick={(e) => openActivityCardAtMouse(e, act)}
                          className={`p-1 rounded-lg text-[10px] font-semibold border flex items-center gap-1 shadow-2xs transition-transform hover:scale-101 cursor-pointer ${
                            act.status === 'concluida'
                              ? 'bg-slate-100 text-slate-400 line-through border-slate-200'
                              : 'bg-sky-50 text-sky-900 border-sky-200'
                          }`}
                        >
                          {renderTypeIcon(act.activity_type)}
                          <span className="truncate">{getActivityDisplayLabel(act)}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ========================================================
  // RENDERIZAÇÃO: DIA
  // ========================================================
  const renderDayView = () => {
    const ymd = currentDate.toISOString().split('T')[0];
    const hours = Array.from({ length: 13 }, (_, i) => i + 8);

    return (
      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs max-w-2xl mx-auto">
        <div className="p-3 bg-slate-50 border-b border-slate-200 text-center">
          <p className="text-xs text-slate-400 uppercase font-bold">
            {currentDate.toLocaleDateString('pt-BR', { weekday: 'long' })}
          </p>
          <h4 className="text-base font-extrabold text-slate-900">
            {currentDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </h4>
        </div>

        <div className="divide-y divide-slate-100 max-h-[580px] overflow-y-auto">
          {hours.map((h) => {
            const timeStr = `${String(h).padStart(2, '0')}:00`;
            const actsInHour = activities.filter((a) => {
              if (!a.due_date || !a.due_date.startsWith(ymd)) return false;
              const actHour = new Date(a.due_date).getHours();
              return actHour === h;
            });

            return (
              <div
                key={h}
                onClick={(e) => openQuickCreatePopup(e, ymd, timeStr)}
                className="flex items-start gap-3 p-3 hover:bg-sky-50/20 transition-colors cursor-pointer"
              >
                <span className="w-12 text-xs font-mono font-bold text-slate-400 shrink-0 pt-0.5">
                  {timeStr}
                </span>

                <div className="flex-1 space-y-1.5">
                  {actsInHour.length === 0 ? (
                    <span className="text-[11px] text-slate-300 italic block py-0.5">
                      Disponível (clique para agendar)
                    </span>
                  ) : (
                    actsInHour.map((act) => (
                      <div
                        key={act.id}
                        onClick={(e) => openActivityCardAtMouse(e, act)}
                        className={`p-2 rounded-xl text-xs font-medium border flex items-center justify-between gap-2 shadow-2xs transition-transform hover:scale-101 cursor-pointer ${
                          act.status === 'concluida'
                            ? 'bg-slate-100 text-slate-400 line-through border-slate-200'
                            : 'bg-white hover:border-sky-300 text-slate-800 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {renderTypeIcon(act.activity_type)}
                          <span className="font-bold truncate">{getActivityDisplayLabel(act)}</span>
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

  const getHeaderTitle = () => {
    if (viewMode === 'month') {
      return currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    }
    if (viewMode === 'day') {
      return currentDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    return `Semana de ${currentDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`;
  };

  return (
    <div className="space-y-4 relative">
      {/* Controles de Navegação e Modos */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToday}
            className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Hoje
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrev}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <h3 className="text-sm sm:text-base font-extrabold text-slate-900 capitalize pl-1">
            {getHeaderTitle()}
          </h3>
        </div>

        {/* Seletor Mês / Semana / Dia */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('month')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              viewMode === 'month' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Mês
          </button>
          <button
            type="button"
            onClick={() => setViewMode('week')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              viewMode === 'week' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Semana
          </button>
          <button
            type="button"
            onClick={() => setViewMode('day')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              viewMode === 'day' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Dia
          </button>
        </div>
      </div>

      {/* Grade do Calendário */}
      {viewMode === 'month' && renderMonthView()}
      {viewMode === 'week' && renderWeekView()}
      {viewMode === 'day' && renderDayView()}

      {/* CARD IDÊNTICO AO DA LISTAGEM NA POSIÇÃO DO MOUSE */}
      {viewCardActivity && viewCardPosition && (
        <div
          ref={popoverViewRef}
          style={{
            position: 'fixed',
            left: `${viewCardPosition.x}px`,
            top: `${viewCardPosition.y}px`,
            zIndex: 140
          }}
          className="w-[440px] max-w-[92vw] shadow-2xl animate-in fade-in zoom-in-95 duration-150 relative"
        >
          <button
            type="button"
            onClick={() => {
              setViewCardActivity(null);
              setViewCardPosition(null);
            }}
            className="absolute top-2 right-2 z-20 p-1 bg-white/90 hover:bg-white text-slate-400 hover:text-slate-700 rounded-lg shadow-2xs border border-slate-200 cursor-pointer"
            title="Fechar card"
          >
            <X size={14} />
          </button>

          <ActivityCardItem
            activity={viewCardActivity}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            teamMembers={teamMembers}
            onToggleComplete={(act) => {
              onToggleComplete(act);
              setViewCardActivity((prev: any) =>
                prev ? { ...prev, status: prev.status === 'pendente' ? 'concluida' : 'pendente' } : null
              );
            }}
            onEdit={(act) => {
              setViewCardActivity(null);
              onEditActivity(act);
            }}
            onDelete={(act) => {
              setViewCardActivity(null);
              onDeleteActivity(act);
            }}
            onOpenContact={(id) => {
              setViewCardActivity(null);
              if (onOpenContact) onOpenContact(id);
            }}
            onOpenOpportunity={(id) => {
              setViewCardActivity(null);
              if (onOpenOpportunity) onOpenOpportunity(id);
            }}
          />
        </div>
      )}

      {/* POPOVER FLUTUANTE DE CRIAÇÃO RÁPIDA NO MOUSE */}
      {popupDate && createPopupPosition && (
        <div
          ref={popoverCreateRef}
          style={{
            position: 'fixed',
            left: `${createPopupPosition.x}px`,
            top: `${createPopupPosition.y}px`,
            zIndex: 130
          }}
          className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-4 w-[350px] space-y-3 text-xs animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between pb-1 border-b border-slate-100">
            <span className="text-[11px] font-bold text-slate-500">
              Nova atividade • {new Date(popupDate + 'T00:00:00').toLocaleDateString('pt-BR')}
            </span>
            <button
              type="button"
              onClick={closeQuickCreatePopup}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded-lg cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>

          <form onSubmit={handleSubmitPopup} className="space-y-3">
            {/* Seletor de Tipo */}
            <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl">
              {[
                { id: 'tarefa', label: 'Tarefa', icon: CheckSquare },
                { id: 'email', label: 'E-mail', icon: Mail },
                { id: 'ligacao', label: 'Ligação', icon: Phone },
                { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
                { id: 'proposta', label: 'Proposta', icon: FileText },
                { id: 'reuniao', label: 'Reunião', icon: Users },
                { id: 'visita', label: 'Visita', icon: MapPin }
              ].map((t) => {
                const Icon = t.icon;
                const isSelected = popupType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    title={t.label}
                    onClick={() => setPopupType(t.id)}
                    className={`flex-1 py-1.5 flex items-center justify-center rounded-lg transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/60'
                    }`}
                  >
                    <Icon size={14} />
                  </button>
                );
              })}
            </div>

            {/* Empresa/Pessoa + Horas */}
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 relative" ref={targetDropdownRef}>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Empresa, pessoa ou negócio
                </label>
                <input
                  type="text"
                  value={popupSearchTarget}
                  onFocus={() => setIsTargetDropdownOpen(true)}
                  onChange={(e) => {
                    setPopupSearchTarget(e.target.value);
                    setIsTargetDropdownOpen(true);
                    if (!e.target.value) {
                      setPopupSelectedOppId(null);
                      setPopupSelectedContactId(null);
                    }
                  }}
                  placeholder="Em qual empresa, pessoa..."
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 text-xs"
                />

                {isTargetDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-40 overflow-y-auto z-50 p-1 space-y-0.5">
                    {oppList
                      .filter((op) => op.title.toLowerCase().includes(popupSearchTarget.toLowerCase()))
                      .slice(0, 4)
                      .map((op) => (
                        <button
                          key={op.id}
                          type="button"
                          onClick={() => {
                            setPopupSelectedOppId(op.id);
                            setPopupSelectedContactId(null);
                            setPopupSearchTarget(`💼 ${op.title}`);
                            setIsTargetDropdownOpen(false);
                          }}
                          className="w-full p-1.5 rounded-lg flex items-center gap-1.5 hover:bg-slate-50 text-left text-[11px] cursor-pointer text-slate-700 truncate"
                        >
                          <Briefcase size={12} className="text-sky-600 shrink-0" />
                          <span className="truncate">{op.title}</span>
                        </button>
                      ))}

                    {contactList
                      .filter((c) => c.display_name.toLowerCase().includes(popupSearchTarget.toLowerCase()))
                      .slice(0, 4)
                      .map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setPopupSelectedContactId(c.id);
                            setPopupSelectedOppId(null);
                            setPopupSearchTarget(`👤 ${c.display_name}`);
                            setIsTargetDropdownOpen(false);
                          }}
                          className="w-full p-1.5 rounded-lg flex items-center gap-1.5 hover:bg-slate-50 text-left text-[11px] cursor-pointer text-slate-700 truncate"
                        >
                          <User size={12} className="text-indigo-600 shrink-0" />
                          <span className="truncate">{c.display_name}</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Horas</label>
                <input
                  type="time"
                  required
                  value={popupTime}
                  onChange={(e) => setPopupTime(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-sky-500 text-xs"
                />
              </div>
            </div>

            {/* Descrição */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Descrição</label>
              <textarea
                required
                rows={3}
                value={popupDescription}
                onChange={(e) => setPopupDescription(e.target.value)}
                placeholder="O que já foi feito e qual o próximo passo?"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none text-xs"
              />
            </div>

            {/* Responsáveis com Chips */}
            <div className="relative" ref={assigneeDropdownRef}>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Responsáveis</label>
              <div
                onClick={() => setIsAssigneeDropdownOpen(!isAssigneeDropdownOpen)}
                className="w-full min-h-[36px] px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl cursor-pointer flex items-center justify-between gap-1 shadow-2xs"
              >
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-900 text-white rounded-md text-[10px] font-bold">
                    Eu ({currentUserName.split(' ')[0]})
                  </span>
                  {popupAssignees.map((id) => {
                    const m = teamMembers.find((item) => item.id === id);
                    return (
                      <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-sky-100 text-sky-800 rounded-md text-[10px] font-bold">
                        {m?.name.split(' ')[0]}
                        <X
                          size={10}
                          className="hover:text-red-600 cursor-pointer"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setPopupAssignees((prev) => prev.filter((item) => item !== id));
                          }}
                        />
                      </span>
                    );
                  })}
                </div>
                <ChevronDown size={14} className="text-slate-400 shrink-0" />
              </div>

              {isAssigneeDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-40 overflow-y-auto z-50 p-1 space-y-0.5">
                  {otherTeamMembers.length === 0 ? (
                    <p className="p-2 text-center text-slate-400 text-[11px]">Nenhum colega cadastrado</p>
                  ) : (
                    otherTeamMembers.map((member) => {
                      const isSelected = popupAssignees.includes(member.id);
                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() =>
                            setPopupAssignees((prev) =>
                              isSelected ? prev.filter((id) => id !== member.id) : [...prev, member.id]
                            )
                          }
                          className={`w-full p-1.5 rounded-lg flex items-center justify-between text-left cursor-pointer text-[11px] ${
                            isSelected ? 'bg-sky-50 text-sky-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <span>{member.name}</span>
                          {isSelected && <Check size={12} className="text-sky-600" />}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Botão ADICIONAR */}
            <div className="pt-2 border-t border-slate-100">
              <button
                type="submit"
                disabled={isSavingPopup}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white font-bold rounded-xl shadow-xs transition-all uppercase tracking-wider text-[11px] disabled:opacity-50 cursor-pointer"
              >
                {isSavingPopup ? 'Adicionando...' : 'ADICIONAR'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};