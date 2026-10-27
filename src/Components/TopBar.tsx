import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { NotificationBell } from './NotificationBell';
import { CompanyGeneralModal } from './CompanyGeneralModal';
import { SystemParamsModal } from './SystemParamsModal';
import { OrganizationSettingsModal } from './OrganizationSettingsModal';
import {
  Search,
  CheckSquare,
  Menu,
  X,
  ChevronDown,
  User,
  Settings,
  LogOut,
  Building2,
  Briefcase,
  FileText,
  Loader2,
  ArrowRight,
  Sliders,
  Network
} from 'lucide-react';

interface SearchResultItem {
  id: string;
  type: 'contact' | 'opportunity' | 'quote' | 'activity';
  title: string;
  subtitle: string;
  badge?: string;
  badgeColor?: string;
  avatarUrl?: string | null;
  contactType?: 'person' | 'company';
  opportunityId?: string;
  data?: any;
}

interface TopBarProps {
  onOpenMobileMenu: () => void;
  onNavigateTab: (tab: string, filterOptions?: any) => void;
  onOpenOpportunityDetail?: (id: string) => void;
  onOpenContactModal?: (id: string) => void;
  isAdmin: boolean;
  companyName: string;
  companyLogoUrl: string | null;
  userName: string;
  userEmail?: string;
  userAvatarUrl: string | null;
  onSignOut: () => void;
}

// Formata o nome do usuário: 1º e 2º nome
const formatUserName = (name: string): string => {
  if (!name) return 'Usuário';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1]}`;
};

// Formata o nome da empresa: exibe até 2 ou 3 palavras chave limpando sufixos fiscais
const formatCompanyName = (name: string): string => {
  if (!name) return 'Empresa';
  const clean = name.replace(/\b(ltda|s\.?a\.?|me|epp|eireli)\b/gi, '').trim();
  const parts = clean.split(/\s+/);
  if (parts.length <= 2) return clean;
  return `${parts[0]} ${parts[1]}`;
};

export const TopBar: React.FC<TopBarProps> = ({
  onOpenMobileMenu,
  onNavigateTab,
  onOpenOpportunityDetail,
  onOpenContactModal,
  isAdmin,
  companyName,
  companyLogoUrl,
  userName,
  userEmail,
  userAvatarUrl,
  onSignOut
}) => {
  const { user } = useAuth();
  const { permissions } = usePermissions();

  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  
  // Dropdown do Usuário
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Dropdown da Empresa (Ancorado no Card)
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const companyDropdownRef = useRef<HTMLDivElement>(null);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Modais de cada área
  const [isCompanyGeneralOpen, setIsCompanyGeneralOpen] = useState(false);
  const [isSystemParamsOpen, setIsSystemParamsOpen] = useState(false);
  const [isOrganizationOpen, setIsOrganizationOpen] = useState(false);

  const canAccessSettings =
    isAdmin ||
    permissions.isOwnerOrAdmin ||
    Boolean((permissions as any).canManageCompanySettings) ||
    Boolean((permissions as any).canManageTeam) ||
    Boolean((permissions as any).canCustomizeSystem);

  const [pendingActivitiesCount, setPendingActivitiesCount] = useState<number>(0);
  const activeUserId = user?.id || (user as any)?.user?.id || (user as any)?.profile?.id;

  // Atalho global: Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      } else if (e.key === 'Escape') {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fechar dropdowns ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (searchContainerRef.current && !searchContainerRef.current.contains(target)) {
        setIsSearchOpen(false);
      }
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setUserDropdownOpen(false);
      }
      if (companyDropdownRef.current && !companyDropdownRef.current.contains(target)) {
        setCompanyDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Busca global
  useEffect(() => {
    const term = searchTerm.trim();
    if (!term || term.length < 2 || !user?.company?.id) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const companyId = user.company.id;

        const [contactsRes, oppsRes, quotesRes, actsRes] = await Promise.all([
          supabase
            .from('contacts')
            .select('id, code, display_name, type, avatar_url')
            .eq('company_id', companyId)
            .or(`display_name.ilike.%${term}%,code.ilike.%${term}%`)
            .is('deleted_at', null)
            .limit(5),

          supabase
            .from('opportunities')
            .select('id, code, title, estimated_value, status')
            .eq('company_id', companyId)
            .or(`title.ilike.%${term}%,code.ilike.%${term}%`)
            .is('deleted_at', null)
            .limit(5),

          supabase
            .from('opportunity_quotes')
            .select('id, code, quote_number, title, total_value, status, opportunity_id')
            .eq('company_id', companyId)
            .or(`title.ilike.%${term}%,code.ilike.%${term}%`)
            .limit(5),

          supabase
            .from('activities')
            .select('id, title, status, due_date')
            .eq('company_id', companyId)
            .ilike('title', `%${term}%`)
            .limit(5),
        ]);

        const results: SearchResultItem[] = [];

        // 1. Contatos
        (contactsRes.data || []).forEach((c: any) => {
          results.push({
            id: c.id,
            type: 'contact',
            title: c.display_name,
            subtitle: c.code ? `${c.code} • ${c.type === 'company' ? 'Pessoa Jurídica' : 'Pessoa Física'}` : c.type === 'company' ? 'Pessoa Jurídica' : 'Pessoa Física',
            badge: c.type === 'company' ? 'PJ' : 'PF',
            badgeColor: c.type === 'company' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-sky-50 text-sky-700 border-sky-200',
            avatarUrl: c.avatar_url || null,
            contactType: c.type,
            data: c
          });
        });

        // 2. Oportunidades
        (oppsRes.data || []).forEach((op: any) => {
          const formattedVal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(op.estimated_value || 0);
          results.push({
            id: op.id,
            type: 'opportunity',
            title: op.title,
            subtitle: op.code ? `${op.code} • Valor: ${formattedVal}` : `Valor: ${formattedVal}`,
            badge: op.status === 'ganha' ? 'Ganha' : op.status === 'perdida' ? 'Perdida' : op.status === 'congelada' ? 'Congelada' : 'Em Andamento',
            badgeColor: op.status === 'ganha' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : op.status === 'perdida' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-sky-50 text-sky-700 border-sky-200',
            data: op
          });
        });

        // 3. Propostas
        (quotesRes.data || []).forEach((q: any) => {
          const formattedVal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(q.total_value || 0);
          results.push({
            id: q.id,
            type: 'quote',
            title: q.title,
            subtitle: `${q.code || `#${q.quote_number}`} • Total: ${formattedVal}`,
            badge: 'Proposta',
            badgeColor: 'bg-violet-50 text-violet-700 border-violet-200',
            opportunityId: q.opportunity_id,
            data: q
          });
        });

        // 4. Atividades
        (actsRes.data || []).forEach((act: any) => {
          const dateStr = act.due_date ? new Date(act.due_date).toLocaleDateString('pt-BR') : 'Sem prazo';
          results.push({
            id: act.id,
            type: 'activity',
            title: act.title,
            subtitle: `Prazo: ${dateStr}`,
            badge: act.status === 'concluida' ? 'Concluída' : 'Pendente',
            badgeColor: act.status === 'concluida' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200',
            data: act
          });
        });

        setSearchResults(results);
      } catch (err) {
        console.warn('Erro na busca global:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchTerm, user?.company?.id]);

  const handleSelectResult = (item: SearchResultItem) => {
    setIsSearchOpen(false);
    setIsMobileSearchOpen(false);
    setSearchTerm('');

    if (item.type === 'opportunity') {
      if (onOpenOpportunityDetail) {
        onOpenOpportunityDetail(item.id);
      } else {
        onNavigateTab('opportunities');
      }
    } else if (item.type === 'quote') {
      if (item.opportunityId && onOpenOpportunityDetail) {
        onOpenOpportunityDetail(item.opportunityId);
      } else {
        onNavigateTab('opportunities');
      }
    } else if (item.type === 'contact') {
      if (onOpenContactModal) {
        onOpenContactModal(item.id);
      } else {
        onNavigateTab('contacts');
      }
    } else if (item.type === 'activity') {
      onNavigateTab('activities');
    }
  };

  const checkDeadlinesAndOverdue = useCallback(async () => {
    if (!activeUserId || !user?.company?.id) return;

    const todayKey = new Date().toISOString().slice(0, 10);
    const sessionCheckKey = `deadline_check_${activeUserId}_${todayKey}`;

    if (sessionStorage.getItem(sessionCheckKey)) return;

    try {
      const now = new Date();
      const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const { data: activities, error: actError } = await supabase
        .from('activities')
        .select('id, title, due_date, status')
        .eq('company_id', user.company.id)
        .not('due_date', 'is', null);

      if (actError || !activities) return;

      const pendingActivities = activities.filter((act: any) => {
        const st = String(act.status || '').toLowerCase();
        return st === 'pendente' || st === 'pending' || st === 'em_andamento';
      });

      for (const act of pendingActivities) {
        if (!act.due_date) continue;
        const dueDate = new Date(act.due_date);

        if (dueDate < now) {
          await supabase.rpc('create_notification_checked', {
            p_user_id: activeUserId,
            p_company_id: user.company.id,
            p_title: '⚠️ Atividade Atrasada',
            p_message: `A atividade "${act.title}" expirou o prazo em ${dueDate.toLocaleDateString('pt-BR')}.`,
            p_category: 'overdue_task',
            p_action_url: '/activities',
            p_entity_id: act.id,
            p_entity_type: 'activity',
          });
        } else if (dueDate <= in24Hours) {
          await supabase.rpc('create_notification_checked', {
            p_user_id: activeUserId,
            p_company_id: user.company.id,
            p_title: '⏰ Prazo Próximo',
            p_message: `A atividade "${act.title}" vence hoje às ${dueDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`,
            p_category: 'upcoming_deadline',
            p_action_url: '/activities',
            p_entity_id: act.id,
            p_entity_type: 'activity',
          });
        }
      }

      sessionStorage.setItem(sessionCheckKey, 'true');
    } catch (err) {
      console.warn('[TopBar] Falha ao checar prazos:', err);
    }
  }, [activeUserId, user?.company?.id]);

  const fetchPendingActivities = useCallback(async () => {
    try {
      const companyId = user?.company?.id;
      if (!companyId) return;

      const { data, error } = await supabase
        .from('activities')
        .select('id, status')
        .eq('company_id', companyId);

      if (!error && data) {
        const count = data.filter((act: any) => {
          const st = String(act.status || '').toLowerCase();
          return st === 'pendente' || st === 'pending' || st === 'em_andamento';
        }).length;
        setPendingActivitiesCount(count);
      }
    } catch (err) {
      console.warn('Erro ao carregar contador do Topbar:', err);
    }
  }, [user?.company?.id]);

  useEffect(() => {
    fetchPendingActivities();
    checkDeadlinesAndOverdue();

    const handleLocalUpdate = () => {
      fetchPendingActivities();
    };
    window.addEventListener('activity-updated', handleLocalUpdate);

    const channel = supabase
      .channel('activities_topbar_count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'activities',
          filter: user?.company?.id ? `company_id=eq.${user.company.id}` : undefined
        },
        () => {
          fetchPendingActivities();
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener('activity-updated', handleLocalUpdate);
      supabase.removeChannel(channel);
    };
  }, [fetchPendingActivities, checkDeadlinesAndOverdue, user?.company?.id]);

  const handleNotificationNavigate = (tab: string, entityId?: string | null, filterOptions?: any) => {
    if (tab === 'opportunities' && entityId && onOpenOpportunityDetail) {
      onOpenOpportunityDetail(entityId);
      return;
    }
    if (tab === 'contacts' && entityId && onOpenContactModal) {
      onOpenContactModal(entityId);
      return;
    }
    onNavigateTab(tab, filterOptions);
  };

  return (
    <>
      <header className="h-16 bg-white border-b border-slate-200/90 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-2xs shrink-0">
        {/* Lado Esquerdo: Menu Mobile & Omnisearch */}
        <div className="flex items-center gap-3 sm:gap-4 flex-1 max-w-xl">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Abrir Menu"
          >
            <Menu size={20} />
          </button>

          {/* Omnisearch Desktop */}
          <div className="relative w-full max-w-md hidden md:block" ref={searchContainerRef}>
            <Search className="absolute left-3.5 top-2.5 text-slate-400" size={16} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar contatos, propostas, negócios ou tarefas..."
              value={searchTerm}
              onFocus={() => setIsSearchOpen(true)}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsSearchOpen(true);
              }}
              className="w-full pl-10 pr-16 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all shadow-2xs font-medium"
            />

            <div className="absolute right-2.5 top-2.5 hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 bg-white border border-slate-200 rounded-md text-[10px] text-slate-400 font-mono pointer-events-none shadow-2xs">
              <span>Ctrl</span>
              <span>K</span>
            </div>

            {/* Popover de Resultados */}
            {isSearchOpen && searchTerm.trim().length >= 2 && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150 max-h-96 overflow-y-auto">
                <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-100 mb-1">
                  <span>Resultados Encontrados</span>
                  {isSearching && <Loader2 size={12} className="animate-spin text-sky-600" />}
                </div>

                {isSearching ? (
                  <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <Loader2 size={14} className="animate-spin text-sky-600" />
                    <span>Procurando registros...</span>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    Nenhum resultado para "{searchTerm}".
                  </div>
                ) : (
                  <div className="space-y-1">
                    {searchResults.map((item) => (
                      <div
                        key={`${item.type}-${item.id}`}
                        onClick={() => handleSelectResult(item)}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {item.type === 'contact' ? (
                            item.avatarUrl ? (
                              <img
                                src={item.avatarUrl}
                                alt=""
                                className="h-8 w-8 rounded-full object-cover shrink-0 border border-slate-200 shadow-2xs"
                              />
                            ) : (
                              <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border ${
                                item.contactType === 'company'
                                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                  : 'bg-sky-50 border-sky-200 text-sky-700'
                              }`}>
                                {item.title.charAt(0).toUpperCase()}
                              </div>
                            )
                          ) : (
                            <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                              item.type === 'quote' 
                                ? 'bg-violet-50 text-violet-600'
                                : 'bg-slate-100 text-slate-600 group-hover:bg-sky-50 group-hover:text-sky-600'
                            }`}>
                              {item.type === 'opportunity' ? (
                                <Briefcase size={15} />
                              ) : item.type === 'quote' ? (
                                <FileText size={15} />
                              ) : (
                                <CheckSquare size={15} />
                              )}
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <p className="text-xs sm:text-sm font-semibold text-slate-900 group-hover:text-sky-600 transition-colors truncate">
                              {item.title}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate">
                              {item.subtitle}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {item.badge && (
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${item.badgeColor}`}>
                              {item.badge}
                            </span>
                          )}
                          <ArrowRight size={13} className="text-slate-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Botão de Busca Mobile */}
          <button
            type="button"
            onClick={() => setIsMobileSearchOpen(true)}
            className="md:hidden p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <Search size={18} />
          </button>
        </div>

        {/* Busca Mobile Expansível */}
        {isMobileSearchOpen && (
          <div className="absolute inset-0 bg-white px-4 flex flex-col justify-center z-50 animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-2.5 text-slate-400" size={16} />
                <input
                  type="text"
                  autoFocus
                  placeholder="Buscar no Lume..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsMobileSearchOpen(false);
                  setSearchTerm('');
                }}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {searchTerm.trim().length >= 2 && searchResults.length > 0 && (
              <div className="absolute top-16 left-4 right-4 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 max-h-72 overflow-y-auto z-50">
                {searchResults.map((item) => (
                  <div
                    key={`${item.type}-${item.id}`}
                    onClick={() => handleSelectResult(item)}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                      {item.type === 'contact' ? (
                        item.avatarUrl ? (
                          <img
                            src={item.avatarUrl}
                            alt=""
                            className="h-7 w-7 rounded-full object-cover shrink-0 border border-slate-200"
                          />
                        ) : (
                          <div className="h-7 w-7 rounded-full bg-sky-50 text-sky-700 flex items-center justify-center font-bold text-[10px] shrink-0 border border-sky-200">
                            {item.title.charAt(0).toUpperCase()}
                          </div>
                        )
                      ) : (
                        <div className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                          {item.type === 'opportunity' ? <Briefcase size={13} /> : item.type === 'quote' ? <FileText size={13} /> : <CheckSquare size={13} />}
                        </div>
                      )}
                      <div className="min-w-0 flex-1 truncate">
                        <p className="text-xs font-semibold text-slate-900 truncate">{item.title}</p>
                        <p className="text-[10px] text-slate-400 truncate">{item.subtitle}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${item.badgeColor}`}>
                      {item.badge}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Lado Direito: Ações & Perfil */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onNavigateTab('activities')}
              title="Atividades e Tarefas"
              className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <CheckSquare size={18} />
              {pendingActivitiesCount > 0 && (
                <span className="absolute top-1 right-1 h-4 min-w-[16px] px-1 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border border-white shadow-2xs">
                  {pendingActivitiesCount > 99 ? '99+' : pendingActivitiesCount}
                </span>
              )}
            </button>

            <NotificationBell onNavigate={handleNotificationNavigate} />
          </div>

          <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />

          {/* CARD DA EMPRESA COM DROPDOWN ANCORADO E ÍCONE CHEVRON-DOWN */}
          <div className="relative" ref={companyDropdownRef}>
            <button
              type="button"
              onClick={() => canAccessSettings && setCompanyDropdownOpen(!companyDropdownOpen)}
              className={`hidden sm:flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs transition-all group ${
                canAccessSettings ? 'hover:bg-slate-100 hover:border-slate-300 hover:text-slate-900 cursor-pointer' : 'cursor-default'
              }`}
              title={canAccessSettings ? `Gerenciar ${companyName}` : companyName}
            >
              {companyLogoUrl ? (
                <img src={companyLogoUrl} alt="" className="h-6 w-6 rounded-lg object-contain shrink-0" />
              ) : (
                <Building2 size={15} className="text-sky-600 shrink-0" />
              )}
              <span className="truncate max-w-[140px] font-semibold text-slate-800">
                {formatCompanyName(companyName)}
              </span>
              {canAccessSettings && (
                <ChevronDown size={14} className="text-slate-400 group-hover:text-slate-600 transition-colors shrink-0" />
              )}
            </button>

            {/* Menu Popover Flutuante Ancorado no Card da Empresa */}
            {companyDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100 text-xs">
                <div className="px-3 py-2 border-b border-slate-100 mb-1">
                  <p className="font-bold text-slate-900 truncate text-sm">{companyName}</p>
                  <p className="text-[11px] text-slate-400">Configurações e parâmetros</p>
                </div>

                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setCompanyDropdownOpen(false);
                      setIsCompanyGeneralOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors text-left cursor-pointer group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 border border-sky-100 group-hover:bg-sky-100">
                      <Building2 size={14} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">Dados Gerais da Empresa</p>
                      <p className="text-[10px] text-slate-400">Razão social, CNPJ, logo e endereço</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCompanyDropdownOpen(false);
                      setIsSystemParamsOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors text-left cursor-pointer group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100 group-hover:bg-emerald-100">
                      <Sliders size={14} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">Cadastros & Catálogo</p>
                      <p className="text-[10px] text-slate-400">Catálogo de itens, serviços e funis</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCompanyDropdownOpen(false);
                      setIsOrganizationOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors text-left cursor-pointer group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100 group-hover:bg-indigo-100">
                      <Network size={14} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">Estrutura Organizacional</p>
                      <p className="text-[10px] text-slate-400">Setores, equipes, membros e acessos</p>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Dropdown de Perfil com Formatação de 1º e 2º Nome */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer shadow-2xs"
            >
              {userAvatarUrl ? (
                <img src={userAvatarUrl} alt="" className="h-6 w-6 rounded-full object-cover shrink-0" />
              ) : (
                <div className="h-6 w-6 rounded-full bg-sky-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                  {userName.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="hidden sm:inline text-xs font-semibold text-slate-800 truncate max-w-[130px]">
                {formatUserName(userName)}
              </span>
              <ChevronDown size={14} className="text-slate-400 shrink-0" />
            </button>

            {userDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl p-1.5 z-50 animate-in fade-in duration-100 text-xs">
                <div className="p-2 border-b border-slate-100 mb-1">
                  <p className="font-bold text-slate-900 truncate">{userName}</p>
                  {userEmail && <p className="text-[11px] text-slate-400 truncate">{userEmail}</p>}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onNavigateTab('profile');
                    setUserDropdownOpen(false);
                  }}
                  className="w-full flex items-center gap-2 p-2 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors text-left cursor-pointer"
                >
                  <User size={14} className="text-slate-400" />
                  <span>Meu Perfil</span>
                </button>

                {canAccessSettings && (
                  <button
                    type="button"
                    onClick={() => {
                      setUserDropdownOpen(false);
                      setCompanyDropdownOpen(true);
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors text-left cursor-pointer"
                  >
                    <Settings size={14} className="text-slate-400" />
                    <span>Configurações</span>
                  </button>
                )}

                <div className="border-t border-slate-100 my-1" />

                <button
                  type="button"
                  onClick={() => {
                    setUserDropdownOpen(false);
                    onSignOut();
                  }}
                  className="w-full flex items-center gap-2 p-2 rounded-xl text-rose-600 hover:bg-rose-50 transition-colors text-left font-semibold cursor-pointer"
                >
                  <LogOut size={14} />
                  <span>Sair da Conta</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* MODAL 1: DADOS GERAIS DA EMPRESA */}
      <CompanyGeneralModal
        isOpen={isCompanyGeneralOpen}
        onClose={() => setIsCompanyGeneralOpen(false)}
        companyId={user?.company?.id || ''}
      />

      {/* MODAL 2: CADASTROS E CATÁLOGO DO SISTEMA */}
      <SystemParamsModal
        isOpen={isSystemParamsOpen}
        onClose={() => setIsSystemParamsOpen(false)}
        companyId={user?.company?.id || ''}
      />

      {/* MODAL 3: ESTRUTURA ORGANIZACIONAL & ACESSOS */}
      <OrganizationSettingsModal
        isOpen={isOrganizationOpen}
        onClose={() => setIsOrganizationOpen(false)}
        companyId={user?.company?.id || ''}
      />
    </>
  );
};

export default TopBar;