import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  Loader2,
  Trophy,
  CheckSquare,
  Clock,
  AlertTriangle,
  ShieldAlert,
  Trash2,
  Sparkles
} from 'lucide-react';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  category: string;
  action_url?: string | null;
  entity_id?: string | null;
  entity_type?: string | null;
  is_read: boolean;
  created_at: string;
}

interface NotificationBellProps {
  onNavigate?: (tab: string, entityId?: string | null, filterOptions?: any) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filterTab, setFilterTab] = useState<'todas' | 'nao_lidas'>('todas');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeUserId = user?.id || (user as any)?.user?.id || (user as any)?.profile?.id;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadNotifications = async () => {
    if (!activeUserId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', activeUserId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      if (data) {
        setNotifications(data);
        setUnreadCount(data.filter((n) => !n.is_read).length);
      }
    } catch (err) {
      console.error('[NotificationBell] Erro ao carregar:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeUserId) {
      loadNotifications();

      const channel = supabase
        .channel(`user-notifications-${activeUserId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${activeUserId}`,
          },
          (payload) => {
            setNotifications((prev) => [payload.new as NotificationItem, ...prev]);
            setUnreadCount((prev) => prev + 1);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [activeUserId]);

  const handleNotificationClick = async (n: NotificationItem) => {
    // 1. Marca como lida no Supabase
    if (!n.is_read) {
      try {
        await supabase
          .from('notifications')
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq('id', n.id);

        setNotifications((prev) =>
          prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        console.error('Erro ao marcar como lida:', err);
      }
    }

    setIsOpen(false);

    // 2. Navegação SPA sem forçar reload de página
    if (!onNavigate) return;

    // Resolução por URL configurada
    const url = n.action_url || '';
    if (url.includes('opportunities') || url.includes('deals')) {
      const oppId = n.entity_id || new URLSearchParams(url.split('?')[1] || '').get('id');
      onNavigate('opportunities', oppId || null);
    } else if (url.includes('activities')) {
      onNavigate('activities', null);
    } else if (url.includes('contacts')) {
      const contactId = n.entity_id || new URLSearchParams(url.split('?')[1] || '').get('id');
      onNavigate('contacts', contactId || null);
    } else {
      // Fallback baseado na categoria da notificação
      switch (n.category) {
        case 'opportunity_won':
        case 'assigned_task':
          onNavigate('opportunities', n.entity_id || null);
          break;
        case 'upcoming_deadline':
        case 'overdue_task':
          onNavigate('activities', null);
          break;
        default:
          onNavigate('dashboard', null);
          break;
      }
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!activeUserId || unreadCount === 0) return;
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', activeUserId)
        .eq('is_read', false);

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Erro ao marcar todas como lidas:', err);
    }
  };

  const handleDeleteNotification = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await supabase.from('notifications').delete().eq('id', id);
      setNotifications((prev) => {
        const item = prev.find((n) => n.id === id);
        if (item && !item.is_read) {
          setUnreadCount((c) => Math.max(0, c - 1));
        }
        return prev.filter((n) => n.id !== id);
      });
    } catch (err) {
      console.error('Erro ao deletar notificação:', err);
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Agora há pouco';
    if (diffMins < 60) return `Há ${diffMins} min`;
    if (diffHours < 24) return `Há ${diffHours}h`;
    if (diffDays === 1) return 'Ontem';
    if (diffDays < 7) return `Há ${diffDays} dias`;
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const getCategoryConfig = (category: string) => {
    switch (category) {
      case 'opportunity_won':
        return {
          icon: Trophy,
          bgColor: 'bg-amber-500/10 text-amber-600 border-amber-200/60',
        };
      case 'assigned_task':
        return {
          icon: CheckSquare,
          bgColor: 'bg-sky-500/10 text-sky-600 border-sky-200/60',
        };
      case 'upcoming_deadline':
        return {
          icon: Clock,
          bgColor: 'bg-amber-500/10 text-amber-600 border-amber-200/60',
        };
      case 'overdue_task':
        return {
          icon: AlertTriangle,
          bgColor: 'bg-rose-500/10 text-rose-600 border-rose-200/60',
        };
      case 'access_change':
        return {
          icon: ShieldAlert,
          bgColor: 'bg-indigo-500/10 text-indigo-600 border-indigo-200/60',
        };
      default:
        return {
          icon: Sparkles,
          bgColor: 'bg-slate-500/10 text-slate-600 border-slate-200/60',
        };
    }
  };

  const filteredNotifications = useMemo(() => {
    if (filterTab === 'nao_lidas') {
      return notifications.filter((n) => !n.is_read);
    }
    return notifications;
  }, [notifications, filterTab]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) loadNotifications();
        }}
        className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer active:scale-95"
        title="Notificações"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-xs animate-in zoom-in-75">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-84 sm:w-96 bg-white border border-slate-200/90 rounded-3xl shadow-2xl overflow-hidden z-[100] animate-in fade-in zoom-in-95 duration-150">
          <div className="p-4 border-b border-slate-100/90 bg-slate-50/50 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-black text-slate-900 text-sm tracking-tight">Notificações</span>
                {unreadCount > 0 && (
                  <span className="bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full font-bold text-[10px] border border-rose-200/80">
                    {unreadCount} nova{unreadCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  className="text-[11px] font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <CheckCheck size={13} />
                  Marcar lidas
                </button>
              )}
            </div>

            <div className="flex items-center p-1 bg-slate-200/60 rounded-xl text-xs font-bold text-slate-600">
              <button
                type="button"
                onClick={() => setFilterTab('todas')}
                className={`flex-1 py-1 rounded-lg text-center cursor-pointer transition-all ${
                  filterTab === 'todas'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'hover:text-slate-900'
                }`}
              >
                Todas ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('nao_lidas')}
                className={`flex-1 py-1 rounded-lg text-center cursor-pointer transition-all ${
                  filterTab === 'nao_lidas'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'hover:text-slate-900'
                }`}
              >
                Não lidas ({unreadCount})
              </button>
            </div>
          </div>

          <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-100/80 overscroll-contain">
            {loading ? (
              <div className="p-10 text-center text-slate-400">
                <Loader2 size={18} className="animate-spin mx-auto mb-2 text-sky-600" />
                <span className="text-xs">Buscando alertas...</span>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-10 text-center space-y-1">
                <CheckCircle2 size={28} className="mx-auto text-slate-300 stroke-[1.5]" />
                <p className="text-xs font-bold text-slate-700">Tudo limpo por aqui!</p>
                <p className="text-[11px] text-slate-400">
                  {filterTab === 'nao_lidas'
                    ? 'Nenhuma notificação não lida.'
                    : 'Você não possui notificações recentes.'}
                </p>
              </div>
            ) : (
              filteredNotifications.map((n) => {
                const config = getCategoryConfig(n.category);
                const IconComponent = config.icon;

                return (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`group relative p-3.5 hover:bg-slate-50/80 transition-all cursor-pointer flex gap-3 items-start ${
                      !n.is_read ? 'bg-sky-50/30' : ''
                    }`}
                  >
                    {!n.is_read && (
                      <span className="absolute left-1.5 top-5 h-1.5 w-1.5 rounded-full bg-sky-600" />
                    )}

                    <div
                      className={`h-8 w-8 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${config.bgColor}`}
                    >
                      <IconComponent size={15} />
                    </div>

                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center justify-between gap-1">
                        <p
                          className={`text-xs truncate ${
                            !n.is_read ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'
                          }`}
                        >
                          {n.title}
                        </p>
                        <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                          {formatTimeAgo(n.created_at)}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5 line-clamp-2">
                        {n.message}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteNotification(e, n.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-all cursor-pointer shrink-0 mt-1"
                      title="Excluir notificação"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};