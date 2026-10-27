import React, { useEffect, useState, useMemo } from 'react';
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
import { WorksView } from './components/WorksView';
import { HRView } from './components/HRView';

import {
  Sparkles,
  ArrowRight,
  X
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

  // Trava de rotas segura e estável para todos os módulos
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
    }
  }, [currentTab, permissions, permsLoading, isAdmin]);

  const userId = user?.id;

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

        if (profile?.company_id) {
          const { data: company } = await supabase
            .from('companies')
            .select('id, created_by')
            .eq('id', profile.company_id)
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
    <div className="flex bg-slate-50 h-screen w-screen overflow-hidden text-slate-800">
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
          userName={user.profile?.full_name || 'Utilizador'}
          userEmail={user.email}
          userAvatarUrl={user.profile?.avatar_url || null}
          onSignOut={signOut}
        />

        <main className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col">
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
                userId={user.id}
                userEmail={user.email}
                initialName={user.profile?.full_name || 'Utilizador'}
                onProfileUpdated={() => {}} 
              />
            </div>
          ) : currentTab === 'contacts' ? (
            <div className="h-full w-full p-4 sm:p-6 lg:p-8 flex flex-col min-w-0 overflow-hidden box-border">
              {showProfileBanner && (
                <div className="mb-3 bg-gradient-to-r from-sky-50 via-blue-50 to-indigo-50 border border-sky-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center shrink-0">
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-semibold text-slate-900">
                        Deseja completar o seu perfil profissional?
                      </p>
                      <p className="text-[11px] sm:text-xs text-slate-500">
                        Adicione o seu contacto e fotografia de perfil para personalizar as suas propostas no Lume.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setCurrentTab('profile')}
                      className="text-xs bg-sky-600 hover:bg-sky-500 text-white font-medium px-3.5 py-1.5 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      Completar Perfil
                      <ArrowRight size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowProfileBanner(false)}
                      title="Dispensar aviso"
                      className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/50 transition-colors cursor-pointer"
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>
              )}

              <ContactsView 
                key={contactsRefreshKey}
                onOpenCreateModal={() => setIsModalOpen(true)} 
                permissions={permissions}
              />
            </div>
          ) : currentTab === 'opportunities' ? (
            <div className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col">
              <DealsPage initialFilters={tabFilterOptions} permissions={permissions} />
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
              <HRView permissions={permissions} />
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

      <CreateContactModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => setContactsRefreshKey(prev => prev + 1)}
      />

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
          onContactUpdated={() => setContactsRefreshKey(prev => prev + 1)}
        />
      )}
    </div>
  );
}