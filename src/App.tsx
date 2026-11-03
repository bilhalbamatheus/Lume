import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AcceptInviteScreen } from './components/AcceptInviteScreen';
import { supabase } from './lib/supabase';
import { useAuth } from './contexts/AuthContext';
import { usePermissions } from './hooks/usePermissions';
import { AuthScreen } from './components/AuthScreen';
import { OnboardingScreen } from './components/OnboardingScreen';
import { CreateContactModal } from './components/CreateContactModal';
import { CompanySettingsView } from './components/CompanySettingsView';
import { UserProfileView } from './components/UserProfileView';
import { ContactsView } from './components/ContactsView';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import logoImg from './assets/logo.png';
import { DealsPage } from './components/DealsPage';
import { ActivitiesView } from './components/ActivitiesView';
import { DashboardView } from './components/DashboardView';
import { OpportunityDetailModal } from './components/OpportunityDetailModal';
import { ContactProfileModal } from './components/ContactProfileModal';
import { CreateOpportunityModal } from './components/CreateOpportunityModal';
import { WorksView } from './components/WorksView';
import { HRView } from './components/HRView';
import { InventoryView } from './components/InventoryView';
import { RequestMaterialsModal } from './components/RequestMaterialsModal';
import { DailyWorkLogModal } from './components/DailyWorkLogModal';

import {
  Sparkles,
  ArrowRight,
  X,
  PackageOpen,
  BookOpenCheck,
  Plus,
  UserPlus,
  Clock,
  TrendingUp,
  FileUp,
  Boxes,
  ArrowUpRight,
  Printer
} from 'lucide-react';

export default function App() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { permissions, loading: permsLoading } = usePermissions();
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [tabFilterOptions, setTabFilterOptions] = useState<any>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [contactsRefreshKey, setContactsRefreshKey] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [showProfileBanner, setShowProfileBanner] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [selectedDashboardOppId, setSelectedDashboardOppId] = useState<string | null>(null);
  const [isDashboardOppModalOpen, setIsDashboardOppModalOpen] = useState(false);

  const [selectedContactModalId, setSelectedContactModalId] = useState<string | null>(null);
  const [isContactProfileModalOpen, setIsContactProfileModalOpen] = useState(false);

  // Gatilhos de Ações de Contatos pelo FAB
  const [triggerContactInteraction, setTriggerContactInteraction] = useState(false);
  const [triggerContactAttach, setTriggerContactAttach] = useState(false);
  const [isCreateOppFromContactOpen, setIsCreateOppFromContactOpen] = useState(false);

  // Gatilho de Nova Oportunidade no Funil (DealsPage) pelo FAB Mobile
  const [triggerCreateOpportunity, setTriggerCreateOpportunity] = useState(false);

  // Gatilho de Cadastro de Colaborador no RH (HRView) pelo FAB Mobile
  const [triggerCreateEmployee, setTriggerCreateEmployee] = useState(false);

  // Gatilhos de Ações de Almoxarifado / Estoque (InventoryView) pelo FAB Mobile
  const [triggerCreateInventoryItem, setTriggerCreateInventoryItem] = useState(false);
  const [triggerInventoryMovement, setTriggerInventoryMovement] = useState(false);
  const [triggerPrintInventoryStock, setTriggerPrintInventoryStock] = useState(false);

  // Modais Globais de Ação Rápida
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isDailyLogModalOpen, setIsDailyLogModalOpen] = useState(false);

  // Menu Popover / Action Sheet do Botão Flutuante (FAB)
  const [isFabMenuOpen, setIsFabMenuOpen] = useState(false);
  const fabContainerRef = useRef<HTMLDivElement>(null);

  // Detector de modais secundários/internos abertos via DOM
  const [hasDomModalOpen, setHasDomModalOpen] = useState(false);

  useEffect(() => {
    const checkModals = () => {
      // Procura elementos de backdrop típicos de modais abertos internamente nas telas
      const modalElements = document.querySelectorAll(
        '.fixed.inset-0.bg-slate-950\\/75, .fixed.inset-0.bg-slate-950\\/70, .fixed.inset-0.bg-slate-950\\/60, .fixed.inset-0.bg-slate-950\\/80'
      );
      // Filtra o próprio Action Sheet do FAB
      const activeAppModals = Array.from(modalElements).filter(
        el => !el.classList.contains('z-[99998]') && !el.classList.contains('z-[99999]')
      );
      setHasDomModalOpen(activeAppModals.length > 0);
    };

    const observer = new MutationObserver(checkModals);
    observer.observe(document.body, { childList: true, subtree: true });
    checkModals();

    return () => observer.disconnect();
  }, []);

  // Define se qualquer modal de cadastro/edição está ativo na tela
  const isAnyModalOpen = Boolean(
    isModalOpen ||
    isDailyLogModalOpen ||
    isRequestModalOpen ||
    isCreateOppFromContactOpen ||
    isDashboardOppModalOpen ||
    triggerCreateOpportunity ||
    triggerCreateEmployee ||
    triggerCreateInventoryItem ||
    triggerInventoryMovement ||
    triggerPrintInventoryStock ||
    hasDomModalOpen
  );

  // Fecha o popover ao clicar fora no Desktop
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (
        isFabMenuOpen &&
        fabContainerRef.current &&
        !fabContainerRef.current.contains(e.target as Node)
      ) {
        setIsFabMenuOpen(false);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [isFabMenuOpen]);

  const canAccessSettings = useMemo(() => {
    return (
      isAdmin ||
      Boolean(permissions?.isOwnerOrAdmin) ||
      Boolean((permissions as any)?.canManageCompanySettings) ||
      Boolean((permissions as any)?.canManageTeam) ||
      Boolean((permissions as any)?.canCustomizeSystem)
    );
  }, [isAdmin, permissions]);

  const urlParams = new URLSearchParams(window.location.search);
  const inviteToken = urlParams.get('token');

  if (inviteToken) {
    return (
      <AcceptInviteScreen
        token={inviteToken}
        onSuccess={() => {
          window.location.href = '/';
        }}
      />
    );
  }

  useEffect(() => {
    if (permsLoading || !permissions) return;

    const isMaster = Boolean(isAdmin || permissions.isOwnerOrAdmin);

    if (currentTab === 'contacts' && !isMaster && !permissions.canViewContacts) {
      setCurrentTab('dashboard');
    } else if (currentTab === 'opportunities' && !isMaster && !permissions.canViewPipeline) {
      setCurrentTab('dashboard');
    } else if (currentTab === 'works' && !isMaster && !permissions.canViewWorks) {
      setCurrentTab('dashboard');
    } else if (currentTab === 'hr' && !isMaster && !permissions.canViewHR) {
      setCurrentTab('dashboard');
    } else if (currentTab === 'inventory' && !isMaster && !permissions.canViewInventory) {
      setCurrentTab('dashboard');
    }
  }, [currentTab, permissions, permsLoading, isAdmin]);

  const userId = (user as any)?.id || (user as any)?.profile?.id;
  const userEmail = (user as any)?.email || (user as any)?.profile?.email || '';

  useEffect(() => {
    async function checkAdminStatus() {
      try {
        if (!userId) return;

        const contextRole = (user as any)?.role || (user as any)?.membership?.role;
        if (contextRole && ['owner', 'admin', 'administrador'].includes(String(contextRole).toLowerCase())) {
          setIsAdmin(true);
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('id, company_id, access_role')
          .eq('id', userId)
          .maybeSingle();

        if ((profile as any)?.company_id) {
          const { data: company } = await supabase
            .from('companies')
            .select('id, created_by')
            .eq('id', (profile as any).company_id)
            .maybeSingle();

          if (company && (company.created_by === userId || !company.created_by)) {
            setIsAdmin(true);
            return;
          }
        }

        const { data: membership } = await supabase
          .from('memberships')
          .select('*')
          .eq('profile_id', userId)
          .maybeSingle();

        if (membership && ['owner', 'admin'].includes(String(membership.role || '').toLowerCase())) {
          setIsAdmin(true);
          return;
        }

        setIsAdmin(false);
      } catch (err) {
        console.warn('Erro ao verificar permissão:', err);
        setIsAdmin(false);
      }
    }

    checkAdminStatus();
  }, [userId]);

  useEffect(() => {
    if (permsLoading) return;
    if (!canAccessSettings && (currentTab === 'settings' || currentTab === 'company_settings')) {
      setCurrentTab('dashboard');
    }
  }, [canAccessSettings, currentTab, permsLoading]);

  useEffect(() => {
    if (user?.company && (user.company as any).onboarded === false) {
      setNeedsOnboarding(true);
    } else {
      setNeedsOnboarding(false);
    }
  }, [user?.company]);

  const handleNavigateTabWithFilter = (tab: string, filterOptions?: any) => {
    setTabFilterOptions(filterOptions || null);
    setCurrentTab(tab);
  };

  const isMaster = Boolean(isAdmin || permissions?.isOwnerOrAdmin);
  const canRequestMaterial = isMaster || Boolean(permissions?.canRequestMaterials);

  if (authLoading || permsLoading) {
    return (
      <div className="fixed inset-0 min-h-screen w-full bg-[#070f1e] flex flex-col items-center justify-center z-[9999] p-4 select-none overflow-hidden">
        <div className="absolute w-80 h-80 sm:w-96 sm:h-96 bg-sky-500/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center gap-6">
          <div className="relative p-2">
            <img 
              src={logoImg} 
              alt="Lume" 
              className="h-16 sm:h-20 w-auto object-contain drop-shadow-lg" 
            />
          </div>
          <div className="flex flex-col items-center gap-2.5 w-48 sm:w-56">
            <span className="text-xs font-medium text-slate-400 tracking-wider">
              Iniciando ambiente...
            </span>
            <div className="w-full h-1 bg-slate-800/80 rounded-full overflow-hidden relative">
              <div className="absolute inset-y-0 left-0 w-2/5 bg-gradient-to-r from-sky-500 to-cyan-400 rounded-full animate-pulse" />
            </div>
          </div>
        </div>
        <div className="absolute bottom-6 text-[11px] text-slate-600 font-medium tracking-wide">
          Lume DRM • Conexão Segura
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (needsOnboarding) {
    return (
      <OnboardingScreen 
        onComplete={() => {
          setNeedsOnboarding(false);
        }} 
      />
    );
  }

  return (
    <div className="flex bg-slate-50 h-screen w-screen overflow-hidden text-slate-800 relative">
      <Sidebar 
        currentTab={currentTab} 
        setCurrentTab={(tab) => {
          setTabFilterOptions(null);
          setCurrentTab(tab);
        }} 
        isAdmin={canAccessSettings}
        onSignOut={signOut}
        isMobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        permissions={permissions}
      />

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative z-10">
        <TopBar
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onNavigateTab={(tab, filters) => {
            handleNavigateTabWithFilter(tab, filters);
          }}
          onOpenOpportunityDetail={(id) => {
            setSelectedDashboardOppId(id);
            setIsDashboardOppModalOpen(true);
          }}
          onOpenContactModal={(id) => {
            if (id) {
              setSelectedContactModalId(id);
              setIsContactProfileModalOpen(true);
            } else {
              setCurrentTab('contacts');
            }
          }}
          isAdmin={canAccessSettings}
          companyName={user.company?.name || 'Empresa'}
          companyLogoUrl={user.company?.logo_url || null}
          userName={(user as any)?.profile?.full_name || 'Utilizador'}
          userEmail={userEmail}
          userAvatarUrl={(user as any)?.profile?.avatar_url || null}
          onSignOut={signOut}
        />

        <main className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col relative">
          {currentTab === 'dashboard' ? (
            <div className="flex-1 min-h-0 min-w-0 overflow-y-auto">
              <DashboardView
                onNavigateTab={handleNavigateTabWithFilter}
                onOpenOpportunityDetail={(id) => {
                  setSelectedDashboardOppId(id);
                  setIsDashboardOppModalOpen(true);
                }}
                permissions={permissions}
              />
            </div>
          ) : (currentTab === 'settings' || currentTab === 'company_settings') ? (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
              <CompanySettingsView 
                companyId={user.company.id} 
                onCompanyUpdated={() => {}} 
              />
            </div>
          ) : currentTab === 'profile' ? (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
              <UserProfileView 
                userId={userId}
                userEmail={userEmail}
                initialName={(user as any)?.profile?.full_name || 'Utilizador'}
                onProfileUpdated={() => {}} 
              />
            </div>
          ) : currentTab === 'contacts' ? (
            <div className="h-full w-full p-4 sm:p-6 lg:p-8 flex flex-col min-w-0 overflow-hidden box-border">

              <ContactsView 
                key={contactsRefreshKey}
                onOpenCreateModal={() => setIsModalOpen(true)} 
                permissions={permissions}
              />
            </div>
          ) : currentTab === 'opportunities' ? (
            <div className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col">
              <DealsPage 
                {...({
                  initialFilters: tabFilterOptions,
                  permissions: permissions,
                  triggerCreateOpportunity: triggerCreateOpportunity,
                  onResetTrigger: () => setTriggerCreateOpportunity(false)
                } as any)}
              />
            </div>
          ) : currentTab === 'works' ? (
            <div className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col">
              <WorksView
                onSelectWork={(workId) => {
                  console.log("Obra selecionada:", workId);
                }}
                onOpenContactModal={(contactId) => {
                  setSelectedContactModalId(contactId);
                  setIsContactProfileModalOpen(true);
                }}
              />
            </div>
          ) : currentTab === 'hr' ? (
            <div className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col">
              <HRView 
                permissions={permissions} 
                triggerCreateEmployee={triggerCreateEmployee}
                onResetTrigger={() => setTriggerCreateEmployee(false)}
              />
            </div>
          ) : currentTab === 'inventory' ? (
            <div className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col">
              <InventoryView 
                triggerCreateItem={triggerCreateInventoryItem}
                triggerMovement={triggerInventoryMovement}
                triggerPrintStock={triggerPrintInventoryStock}
                onResetTrigger={() => {
                  setTriggerCreateInventoryItem(false);
                  setTriggerInventoryMovement(false);
                  setTriggerPrintInventoryStock(false);
                }}
              />
            </div>
          ) : currentTab === 'activities' ? (
            <div className="flex-1 min-h-0 min-w-0 overflow-y-auto flex flex-col">
              <ActivitiesView initialFilterOptions={tabFilterOptions} />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500">
                <h3 className="font-semibold text-base text-slate-700">Módulo em Desenvolvimento</h3>
                <p className="text-xs text-slate-400 mt-1">Este recurso estará disponível nas próximas versões do Lume.</p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ========================================================================= */}
      {/* BOTÃO FLUTUANTE (FAB) + ACTION SHEET VIA PORTAL (OCULTO EM QUALQUER MODAL)*/}
      {/* ========================================================================= */}
      {!isAnyModalOpen && typeof document !== 'undefined' && createPortal(
        <div ref={fabContainerRef}>
          {/* BOTÃO GATILHO */}
          <div className="fixed bottom-6 right-6 z-[99999] pointer-events-auto">
            {/* Popover no Desktop */}
            {isFabMenuOpen && (
              <div 
                onClick={(e) => e.stopPropagation()}
                className="hidden md:flex flex-col absolute bottom-full right-0 mb-3 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl p-2 space-y-1 animate-in fade-in slide-in-from-bottom-3 duration-150"
              >
                <div className="px-3 py-1.5 border-b border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Ações Rápidas
                  </span>
                </div>

                {/* Diário de Obra */}
                <button
                  type="button"
                  onClick={() => {
                    setIsFabMenuOpen(false);
                    setIsDailyLogModalOpen(true);
                  }}
                  className="w-full p-2.5 rounded-xl text-left hover:bg-sky-50/80 transition-colors flex items-center gap-3 cursor-pointer group"
                >
                  <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0 group-hover:bg-sky-600 group-hover:text-white transition-colors">
                    <BookOpenCheck size={18} />
                  </div>
                  <div>
                    <strong className="text-xs font-bold text-slate-900 block group-hover:text-sky-900">
                      Diário de Obra
                    </strong>
                    <span className="text-[10px] text-slate-500 block">
                      Apontar atividades e avanço físico
                    </span>
                  </div>
                </button>

                {/* Solicitar Material / EPI (Condicionado à Permissão) */}
                {canRequestMaterial && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsFabMenuOpen(false);
                      setIsRequestModalOpen(true);
                    }}
                    className="w-full p-2.5 rounded-xl text-left hover:bg-amber-50/80 transition-colors flex items-center gap-3 cursor-pointer group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                      <PackageOpen size={18} />
                    </div>
                    <div>
                      <strong className="text-xs font-bold text-slate-900 block group-hover:text-amber-900">
                        Solicitar Material / EPI
                      </strong>
                      <span className="text-[10px] text-slate-500 block">
                        Pedir itens ou reposição de EPI
                      </span>
                    </div>
                  </button>
                )}
              </div>
            )}

            {/* O Botão Físico */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsFabMenuOpen(prev => !prev);
              }}
              className={`w-14 h-14 md:w-auto md:h-auto flex items-center justify-center gap-2 md:px-4 md:py-3 text-white rounded-full md:rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-200 cursor-pointer active:scale-95 group border border-sky-400/30 ${
                isFabMenuOpen ? 'bg-slate-900 hover:bg-slate-800' : 'bg-sky-600 hover:bg-sky-500'
              }`}
              title="Ações Rápidas"
            >
              <div className={`transition-transform duration-200 ${isFabMenuOpen ? 'rotate-45' : 'rotate-0'}`}>
                <Plus size={26} strokeWidth={2.5} />
              </div>
              <span className="hidden md:inline font-bold text-xs tracking-wide">
                {isFabMenuOpen ? 'Fechar' : 'Ações Rápidas'}
              </span>
            </button>
          </div>

          {/* ACTION SHEET MOBILE EM TELA CHEIA */}
          {isFabMenuOpen && (
            <div 
              className="md:hidden fixed inset-0 z-[99998] flex flex-col justify-end bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150 pointer-events-auto"
              onClick={() => setIsFabMenuOpen(false)}
            >
              <div 
                className="relative bg-white rounded-t-3xl p-5 space-y-3 animate-in slide-in-from-bottom duration-200 border-t border-slate-200 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-2" />

                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
                  {isContactProfileModalOpen ? 'Adicionar ao Contato' : 'Ações Rápidas'}
                </h3>

                <div className="space-y-2 pt-1 max-h-[60vh] overflow-y-auto">
                  {isContactProfileModalOpen ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setIsFabMenuOpen(false);
                          setTriggerContactInteraction(true);
                        }}
                        className="w-full p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center gap-3 text-slate-800 font-semibold text-xs transition-colors cursor-pointer active:scale-98"
                      >
                        <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                          <Clock size={19} />
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">Registrar Interação / Tarefa</p>
                          <p className="text-[11px] text-slate-500 font-normal truncate">
                            Adicione notas, reuniões ou ligações
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsFabMenuOpen(false);
                          setIsCreateOppFromContactOpen(true);
                        }}
                        className="w-full p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center gap-3 text-slate-800 font-semibold text-xs transition-colors cursor-pointer active:scale-98"
                      >
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                          <TrendingUp size={19} />
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">Nova Oportunidade</p>
                          <p className="text-[11px] text-slate-500 font-normal truncate">
                            Criar negociação no funil comercial
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsFabMenuOpen(false);
                          setTriggerContactAttach(true);
                        }}
                        className="w-full p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center gap-3 text-slate-800 font-semibold text-xs transition-colors cursor-pointer active:scale-98"
                      >
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                          <FileUp size={19} />
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">Anexar Documento</p>
                          <p className="text-[11px] text-slate-500 font-normal truncate">
                            Upload de arquivos ou contratos
                          </p>
                        </div>
                      </button>
                    </>
                  ) : (
                    <>
                      {currentTab === 'contacts' && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsFabMenuOpen(false);
                            setIsModalOpen(true);
                          }}
                          className="w-full p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center gap-3 text-slate-800 font-semibold text-xs transition-colors cursor-pointer active:scale-98"
                        >
                          <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                            <UserPlus size={19} />
                          </div>
                          <div className="text-left flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate">Novo Contato</p>
                            <p className="text-[11px] text-slate-500 font-normal truncate">
                              Cadastrar cliente ou fornecedor
                            </p>
                          </div>
                        </button>
                      )}

                      {currentTab === 'opportunities' && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsFabMenuOpen(false);
                            setTriggerCreateOpportunity(true);
                          }}
                          className="w-full p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center gap-3 text-slate-800 font-semibold text-xs transition-colors cursor-pointer active:scale-98"
                        >
                          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                            <TrendingUp size={19} />
                          </div>
                          <div className="text-left flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate">Nova Oportunidade</p>
                            <p className="text-[11px] text-slate-500 font-normal truncate">
                              Criar negociação no funil comercial
                            </p>
                          </div>
                        </button>
                      )}

                      {currentTab === 'hr' && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsFabMenuOpen(false);
                            setTriggerCreateEmployee(true);
                          }}
                          className="w-full p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center gap-3 text-slate-800 font-semibold text-xs transition-colors cursor-pointer active:scale-98"
                        >
                          <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                            <UserPlus size={19} />
                          </div>
                          <div className="text-left flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate">Cadastrar Colaborador</p>
                            <p className="text-[11px] text-slate-500 font-normal truncate">
                              Registrar funcionário no quadro da empresa
                            </p>
                          </div>
                        </button>
                      )}

                      {currentTab === 'inventory' && (
                        <>
                          {(isMaster || permissions?.canManageInventoryItems) && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsFabMenuOpen(false);
                                setTriggerCreateInventoryItem(true);
                              }}
                              className="w-full p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center gap-3 text-slate-800 font-semibold text-xs transition-colors cursor-pointer active:scale-98"
                            >
                              <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                                <Boxes size={19} />
                              </div>
                              <div className="text-left flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-900 truncate">Cadastrar Item</p>
                                <p className="text-[11px] text-slate-500 font-normal truncate">
                                  Adicionar novo material, EPI ou ferramenta ao estoque
                                </p>
                              </div>
                            </button>
                          )}

                          {(isMaster || permissions?.canManageInventoryMovements) && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsFabMenuOpen(false);
                                setTriggerInventoryMovement(true);
                              }}
                              className="w-full p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center gap-3 text-slate-800 font-semibold text-xs transition-colors cursor-pointer active:scale-98"
                            >
                              <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-800 flex items-center justify-center shrink-0">
                                <ArrowUpRight size={19} />
                              </div>
                              <div className="text-left flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-900 truncate">Movimentar Estoque</p>
                                <p className="text-[11px] text-slate-500 font-normal truncate">
                                  Lançar entrada com NF, cautela ou saída para obra
                                </p>
                              </div>
                            </button>
                          )}

                          {(isMaster || permissions?.canViewInventory) && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsFabMenuOpen(false);
                                setTriggerPrintInventoryStock(true);
                              }}
                              className="w-full p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center gap-3 text-slate-800 font-semibold text-xs transition-colors cursor-pointer active:scale-98"
                            >
                              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                                <Printer size={19} />
                              </div>
                              <div className="text-left flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-900 truncate">Imprimir Estoque</p>
                                <p className="text-[11px] text-slate-500 font-normal truncate">
                                  Gerar folha timbrada para conferência física
                                </p>
                              </div>
                            </button>
                          )}
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setIsFabMenuOpen(false);
                          setIsDailyLogModalOpen(true);
                        }}
                        className="w-full p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center gap-3 text-slate-800 font-semibold text-xs transition-colors cursor-pointer active:scale-98"
                      >
                        <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                          <BookOpenCheck size={19} />
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">Diário de Obra</p>
                          <p className="text-[11px] text-slate-500 font-normal truncate">
                            Apontar serviços e avanço físico
                          </p>
                        </div>
                      </button>

                      {canRequestMaterial && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsFabMenuOpen(false);
                            setIsRequestModalOpen(true);
                          }}
                          className="w-full p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center gap-3 text-slate-800 font-semibold text-xs transition-colors cursor-pointer active:scale-98"
                        >
                          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                            <PackageOpen size={19} />
                          </div>
                          <div className="text-left flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate">Solicitar Material / EPI</p>
                            <p className="text-[11px] text-slate-500 font-normal truncate">
                              Pedir reposição ou insumos para obra
                            </p>
                          </div>
                        </button>
                      )}
                    </>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setIsFabMenuOpen(false)}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer transition"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>,
        document.body
      )}

      {/* MODAL DE CRIAÇÃO DE CONTATO */}
      <CreateContactModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => setContactsRefreshKey(prev => prev + 1)}
      />

      {/* MODAL DE OPORTUNIDADE DASHBOARD */}
      {isDashboardOppModalOpen && selectedDashboardOppId && (
        <OpportunityDetailModal
          opportunityId={selectedDashboardOppId}
          isOpen={isDashboardOppModalOpen}
          zIndexLevel={isContactProfileModalOpen ? 'overlay' : 'base'}
          onClose={() => {
            setIsDashboardOppModalOpen(false);
            setSelectedDashboardOppId(null);
          }}
          onUpdated={() => {}}
        />
      )}

      {/* MODAL DE DETALHES DO CONTATO */}
      {isContactProfileModalOpen && selectedContactModalId && (
        <ContactProfileModal
          contactId={selectedContactModalId}
          isOpen={isContactProfileModalOpen}
          onClose={() => {
            setIsContactProfileModalOpen(false);
            setSelectedContactModalId(null);
          }}
          onOpenOpportunity={(oppId) => {
            setSelectedDashboardOppId(oppId);
            setIsDashboardOppModalOpen(true);
          }}
          onCreateOpportunityForContact={() => {
            setIsCreateOppFromContactOpen(true);
          }}
          triggerInteraction={triggerContactInteraction}
          triggerAttach={triggerContactAttach}
          onResetTrigger={() => {
            setTriggerContactInteraction(false);
            setTriggerContactAttach(false);
          }}
          onContactUpdated={() => setContactsRefreshKey(prev => prev + 1)}
        />
      )}

      {/* MODAL DE NOVA OPORTUNIDADE VINCULADA AO CONTATO */}
      {isCreateOppFromContactOpen && selectedContactModalId && (
        <CreateOpportunityModal
          isOpen={isCreateOppFromContactOpen}
          initialContactId={selectedContactModalId}
          onClose={() => setIsCreateOppFromContactOpen(false)}
          onSuccess={() => {
            setIsCreateOppFromContactOpen(false);
            setContactsRefreshKey(prev => prev + 1);
          }}
        />
      )}

      {/* MODAL GLOBAL DE SOLICITAÇÃO DE MATERIAIS / EPIS */}
      {isRequestModalOpen && (
        <RequestMaterialsModal
          isOpen={isRequestModalOpen}
          onClose={() => setIsRequestModalOpen(false)}
        />
      )}

      {/* MODAL GLOBAL DO DIÁRIO DE OBRA */}
      {isDailyLogModalOpen && (
        <DailyWorkLogModal
          isOpen={isDailyLogModalOpen}
          onClose={() => setIsDailyLogModalOpen(false)}
        />
      )}
    </div>
  );
}