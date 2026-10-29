import React from 'react';
import logoImg from '../assets/logo.png';
import faviconImg from '../assets/favicon.png';
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  Kanban,
  HardHat,
  UserCheck,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  isAdmin?: boolean;
  onSignOut: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  permissions: any;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  isAdmin = false,
  onSignOut,
  isMobileOpen,
  onCloseMobile,
  isCollapsed,
  setIsCollapsed,
  permissions
}) => {
  const isMaster = Boolean(isAdmin || permissions?.isOwnerOrAdmin);

  // Validação de acesso por módulo
  const canSeeContacts = isMaster || Boolean(permissions?.canViewContacts);
  const canSeePipeline = isMaster || Boolean(permissions?.canViewPipeline);
  const canSeeWorks = isMaster || Boolean(permissions?.canViewWorks);
  const canSeeHR = isMaster || Boolean(permissions?.canViewHR);

  const canAccessSettings =
    isMaster ||
    Boolean(permissions?.canManageCompanySettings) ||
    Boolean(permissions?.canManageTeam) ||
    Boolean(permissions?.canCustomizeSystem);

  // Lista com RH & Pessoas incluído e condicionado
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, visible: true },
    { id: 'contacts', label: 'Contatos', icon: Users, visible: canSeeContacts },
    { id: 'opportunities', label: 'Oportunidades', icon: Kanban, visible: canSeePipeline },
    { id: 'works', label: 'Obras', icon: HardHat, visible: canSeeWorks },
    { id: 'hr', label: 'RH', icon: UserCheck, visible: canSeeHR },
    { id: 'activities', label: 'Atividades', icon: CheckSquare, visible: true },
  ].filter((item) => item.visible);

  const handleSelectTab = (tabId: string) => {
    setCurrentTab(tabId);
    onCloseMobile();
  };

  const renderContent = (forceExpanded = false) => {
    const collapsed = forceExpanded ? false : isCollapsed;

    return (
      <div
        className={`relative flex flex-col justify-between h-full w-full pt-1 pb-4 box-border transition-all duration-300 ${
          collapsed ? 'px-2 items-center' : 'px-2.5'
        }`}
      >
        {!forceExpanded && (
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex absolute -right-3.5 top-14 z-50 h-7 w-7 items-center justify-center rounded-full bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 shadow-md transition-all cursor-pointer hover:scale-110"
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        )}

        <div className="w-full flex flex-col items-center">
          <div
            className={`relative flex items-center mb-2 w-full border-b border-slate-800/80 pb-2 ${
              collapsed ? 'justify-center pt-2' : 'justify-between px-1 pt-0'
            }`}
          >
            {collapsed ? (
              <div
                title="Lume"
                onClick={() => setIsCollapsed(false)}
                className="h-11 w-11 rounded-2xl bg-slate-900 border border-slate-800/80 p-1.5 flex items-center justify-center shadow-sm cursor-pointer transition-transform hover:scale-105"
              >
                <img
                  src={faviconImg}
                  alt="Lume"
                  className="h-full w-full object-contain"
                />
              </div>
            ) : (
              <div className="flex-1 flex justify-center items-center">
                <img
                  src={logoImg}
                  alt="Lume"
                  className="w-full h-auto max-h-24 object-contain -my-1 transition-transform hover:scale-102"
                />
              </div>
            )}

            {forceExpanded && (
              <button
                type="button"
                onClick={onCloseMobile}
                className="md:hidden absolute right-1 top-2 text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 cursor-pointer"
              >
                <X size={20} />
              </button>
            )}
          </div>

          {!collapsed && (
            <p className="w-full px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 text-left">
              Operação
            </p>
          )}

          <nav className="space-y-1.5 w-full flex flex-col items-center">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectTab(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center rounded-xl text-sm font-medium transition-all cursor-pointer box-border ${
                    collapsed
                      ? 'w-11 h-11 justify-center'
                      : 'w-full gap-3 px-3.5 py-2.5'
                  } ${
                    active
                      ? 'bg-sky-600 text-white shadow-sm font-semibold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon size={19} className="shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="pt-4 border-t border-slate-800/80 space-y-1 w-full flex flex-col items-center">
          {canAccessSettings && !forceExpanded && (
            <button
              type="button"
              onClick={() => handleSelectTab('company_settings')}
              title={collapsed ? 'Configurações' : undefined}
              className={`hidden md:flex items-center text-xs text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl cursor-pointer transition-colors box-border ${
                collapsed
                  ? 'w-11 h-11 justify-center'
                  : 'w-full gap-3 px-3.5 py-2 text-left'
              } ${
                currentTab === 'settings' || currentTab === 'company_settings'
                  ? 'text-white bg-slate-800/60 font-semibold'
                  : ''
              }`}
            >
              <Settings size={17} className="shrink-0" />
              {!collapsed && <span>Configurações</span>}
            </button>
          )}

          <button
            type="button"
            onClick={onSignOut}
            title={collapsed ? 'Sair da Conta' : undefined}
            className={`flex items-center text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl cursor-pointer transition-colors box-border ${
              collapsed
                ? 'w-11 h-11 justify-center'
                : 'w-full gap-3 px-3.5 py-2 text-left'
            }`}
          >
            <LogOut size={17} className="shrink-0" />
            {!collapsed && <span>Sair da Conta</span>}
          </button>

          {!collapsed && (
            <p className="pt-3 text-[10px] text-slate-500 text-center font-mono">
              v1.0 • Lume Cloud
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <aside
        className={`hidden md:flex bg-slate-900 text-slate-200 h-screen border-r border-slate-800 shrink-0 transition-all duration-300 relative z-40 ${
          isCollapsed ? 'w-16' : 'w-[210px]'
        }`}
      >
        {renderContent(false)}
      </aside>

      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex animate-in fade-in duration-200">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-[240px] max-w-[85%] bg-slate-900 text-slate-200 h-full shadow-2xl z-10 flex flex-col animate-in slide-in-from-left duration-250">
            {renderContent(true)}
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;