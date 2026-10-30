import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface ModulePermissions {
  // Contatos & Clientes
  canViewContacts: boolean;
  canCreateEditContacts: boolean;
  canDeleteContacts: boolean;

  // Funil Comercial & Propostas
  canViewPipeline: boolean;
  canManageDeals: boolean;
  canDeleteDeals: boolean;
  canWinLoseDeals: boolean;
  canCreateQuotes: boolean;
  canDeleteQuotes: boolean;
  canApplyDiscount: boolean;
  canViewProfitMargin: boolean;

  // ==========================================
  // OBRAS: AS 9 PERMISSÕES SIMPLIFICADAS
  // ==========================================
  canViewWorks: boolean;            // 1. Ter acesso às obras
  canManageWorkDetails: boolean;    // 2. Criar e editar dados da obra
  canDeleteWorks: boolean;          // 3. Excluir obra
  canManageWorkStructure: boolean;  // 4. Criar, editar, excluir e duplicar itens/tarefas (EAP)
  canExecuteWorkTasks: boolean;     // 5. Apontar avanço e dar baixa nas tarefas
  canReopenWorkTasks: boolean;      // 6. Reabrir tarefas
  canManageSchedule: boolean;       // 7. Visualizar e gerenciar cronograma
  canManageWorkFinancial: boolean;  // 8. Visualizar e operar o financeiro (ver valores em R$)
  canViewDailyLogs: boolean;        // 9. Visualizar diário de obra

  // Aliases de compatibilidade retroativa para não quebrar componentes existentes
  canEditWorkDetails: boolean;
  canCreateWorks: boolean;
  canManageWorkItems: boolean;
  canDeleteWorkItems: boolean;
  canDuplicateWorkItems: boolean;
  canCreateWorkTasks: boolean;
  canCompleteWorkTasks: boolean;
  canAssignExecutors: boolean;
  canViewSchedule: boolean;
  canEditSchedule: boolean;
  canViewWorkFinancial: boolean;
  canViewWorkPrices: boolean;
  canCreateMeasurements: boolean;
  canDeleteMeasurements: boolean;
  canManageInvoices: boolean;
  canPrintMeasurements: boolean;

  // RH & Departamento Pessoal
  canViewHR: boolean;
  canManageEmployees: boolean;
  canManageSalariesBenefits: boolean;
  canManageAdmissionsLeaves: boolean;

  // Gestão da Empresa & Sistema
  canManageCompanySettings: boolean;
  canManageTeam: boolean;
  canCustomizeSystem: boolean;
  isOwnerOrAdmin: boolean;
}

export interface UserOrganizationScope {
  myDepartmentId: string | null;
  myTeamId: string | null;
  isDepartmentManager: boolean;
  isTeamLeader: boolean;
  managedDepartmentIds: string[];
  ledTeamIds: string[];
  teamMemberProfileIds: string[];
}

const DEFAULT_PERMISSIONS: ModulePermissions = {
  canViewContacts: false,
  canCreateEditContacts: false,
  canDeleteContacts: false,
  canViewPipeline: false,
  canManageDeals: false,
  canDeleteDeals: false,
  canWinLoseDeals: false,
  canCreateQuotes: false,
  canDeleteQuotes: false,
  canApplyDiscount: false,
  canViewProfitMargin: false,

  // Obras Simplificadas
  canViewWorks: false,
  canManageWorkDetails: false,
  canDeleteWorks: false,
  canManageWorkStructure: false,
  canExecuteWorkTasks: false,
  canReopenWorkTasks: false,
  canManageSchedule: false,
  canManageWorkFinancial: false,
  canViewDailyLogs: false,

  // Aliases retroativos
  canEditWorkDetails: false,
  canCreateWorks: false,
  canManageWorkItems: false,
  canDeleteWorkItems: false,
  canDuplicateWorkItems: false,
  canCreateWorkTasks: false,
  canCompleteWorkTasks: false,
  canAssignExecutors: false,
  canViewSchedule: false,
  canEditSchedule: false,
  canViewWorkFinancial: false,
  canViewWorkPrices: false,
  canCreateMeasurements: false,
  canDeleteMeasurements: false,
  canManageInvoices: false,
  canPrintMeasurements: false,

  // RH Defaults
  canViewHR: false,
  canManageEmployees: false,
  canManageSalariesBenefits: false,
  canManageAdmissionsLeaves: false,

  canManageCompanySettings: false,
  canManageTeam: false,
  canCustomizeSystem: false,
  isOwnerOrAdmin: false,
};

const DEFAULT_SCOPE: UserOrganizationScope = {
  myDepartmentId: null,
  myTeamId: null,
  isDepartmentManager: false,
  isTeamLeader: false,
  managedDepartmentIds: [],
  ledTeamIds: [],
  teamMemberProfileIds: [],
};

export const usePermissions = () => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<ModulePermissions>(DEFAULT_PERMISSIONS);
  const [scope, setScope] = useState<UserOrganizationScope>(DEFAULT_SCOPE);
  const [loading, setLoading] = useState(true);

  const isLoadedRef = useRef(false);

  const currentUserId = user?.id || user?.profile?.id || (user as any)?.user?.id || null;
  const currentCompanyId = user?.company?.id || user?.profile?.company_id || null;

  useEffect(() => {
    let isMounted = true;

    const loadPermissionsAndScope = async () => {
      try {
        if (!currentUserId) {
          if (isMounted) setLoading(false);
          return;
        }

        if (!isLoadedRef.current) {
          setLoading(true);
        }

        const [{ data: membership }, { data: profile }] = await Promise.all([
          supabase
            .from('memberships')
            .select('id, role, role_id, status, team_id')
            .eq('profile_id', currentUserId)
            .maybeSingle(),
          supabase
            .from('profiles')
            .select('id, access_role, company_id')
            .eq('id', currentUserId)
            .maybeSingle(),
        ]);

        const companyId = currentCompanyId || profile?.company_id;

        let myTeamId = membership?.team_id || null;
        let myDepartmentId: string | null = null;

        if (myTeamId) {
          const { data: teamData } = await supabase
            .from('company_teams')
            .select('id, department_id')
            .eq('id', myTeamId)
            .maybeSingle();

          if (teamData) {
            myDepartmentId = teamData.department_id;
          }
        }

        let managedDepartmentIds: string[] = [];
        let ledTeamIds: string[] = [];
        let teamMemberProfileIds: string[] = [currentUserId];

        if (companyId) {
          const [deptRes, teamRes] = await Promise.all([
            supabase
              .from('company_departments')
              .select('id')
              .eq('company_id', companyId)
              .eq('manager_id', currentUserId),
            supabase
              .from('company_teams')
              .select('id, department_id')
              .eq('company_id', companyId)
              .eq('leader_id', currentUserId),
          ]);

          managedDepartmentIds = (deptRes.data || []).map((d) => d.id);
          ledTeamIds = (teamRes.data || []).map((t) => t.id);

          if (managedDepartmentIds.length > 0) {
            const { data: deptTeams } = await supabase
              .from('company_teams')
              .select('id')
              .in('department_id', managedDepartmentIds);

            const extraTeamIds = (deptTeams || []).map((t) => t.id);
            ledTeamIds = Array.from(new Set([...ledTeamIds, ...extraTeamIds]));
          }

          if (ledTeamIds.length > 0) {
            const { data: teamMemberships } = await supabase
              .from('memberships')
              .select('profile_id')
              .in('team_id', ledTeamIds)
              .eq('status', 'ativo');

            const memberIds = (teamMemberships || []).map((m) => m.profile_id).filter(Boolean);
            teamMemberProfileIds = Array.from(new Set([currentUserId, ...memberIds]));
          }
        }

        const calculatedScope: UserOrganizationScope = {
          myDepartmentId,
          myTeamId,
          isDepartmentManager: managedDepartmentIds.length > 0,
          isTeamLeader: ledTeamIds.length > 0,
          managedDepartmentIds,
          ledTeamIds,
          teamMemberProfileIds,
        };

        const roleName = String(membership?.role || '').toLowerCase();
        let isMaster = ['owner', 'admin', 'administrador', 'proprietário'].includes(roleName);

        const targetRoleId = membership?.role_id || profile?.access_role;
        let perms: string[] = [];

        if (targetRoleId) {
          let { data: roleDef } = await supabase
            .from('company_roles')
            .select('id, name, permissions')
            .eq('id', targetRoleId)
            .maybeSingle();

          if (!roleDef) {
            const { data: roleByName } = await supabase
              .from('company_roles')
              .select('id, name, permissions')
              .eq('name', targetRoleId)
              .maybeSingle();
            roleDef = roleByName;
          }

          if (roleDef) {
            const rName = String(roleDef.name || '').toLowerCase();
            if (['admin', 'administrador', 'owner', 'proprietário'].some((r) => rName.includes(r))) {
              isMaster = true;
            }
            if (roleDef.permissions && Array.isArray(roleDef.permissions)) {
              perms = roleDef.permissions;
            }
          }
        }

        if (isMaster) {
          if (isMounted) {
            setPermissions({
              canViewContacts: true,
              canCreateEditContacts: true,
              canDeleteContacts: true,
              canViewPipeline: true,
              canManageDeals: true,
              canDeleteDeals: true,
              canWinLoseDeals: true,
              canCreateQuotes: true,
              canDeleteQuotes: true,
              canApplyDiscount: true,
              canViewProfitMargin: true,

              // 9 Obras completas para Master
              canViewWorks: true,
              canManageWorkDetails: true,
              canDeleteWorks: true,
              canManageWorkStructure: true,
              canExecuteWorkTasks: true,
              canReopenWorkTasks: true,
              canManageSchedule: true,
              canManageWorkFinancial: true,
              canViewDailyLogs: true,

              // Aliases
              canCreateWorks: true,
              canEditWorkDetails: true,
              canManageWorkItems: true,
              canDeleteWorkItems: true,
              canDuplicateWorkItems: true,
              canCreateWorkTasks: true,
              canCompleteWorkTasks: true,
              canAssignExecutors: true,
              canViewSchedule: true,
              canEditSchedule: true,
              canViewWorkFinancial: true,
              canViewWorkPrices: true,
              canCreateMeasurements: true,
              canDeleteMeasurements: true,
              canManageInvoices: true,
              canPrintMeasurements: true,

              canViewHR: true,
              canManageEmployees: true,
              canManageSalariesBenefits: true,
              canManageAdmissionsLeaves: true,
              canManageCompanySettings: true,
              canManageTeam: true,
              canCustomizeSystem: true,
              isOwnerOrAdmin: true,
            });
            setScope(calculatedScope);
            isLoadedRef.current = true;
            setLoading(false);
          }
          return;
        }

        const has = (...keys: string[]) => keys.some((k) => perms.includes(k));

        // Resolução das permissões das Obras (aceitando chaves novas ou legadas salvas no banco)
        const canViewWorks = has('works_view', 'works.view', 'works_manage');
        const canManageWorkDetails = has('works_edit_details', 'works_create', 'works.edit_details', 'works.create', 'works_manage_details');
        const canDeleteWorks = has('works_delete', 'works.delete');
        const canManageWorkStructure = has('work_items_manage', 'work_tasks_create', 'work_items_delete', 'work_items_duplicate', 'works_manage_structure');
        const canExecuteWorkTasks = has('work_tasks_complete', 'work_tasks_assign', 'works_execute_tasks');
        const canReopenWorkTasks = has('work_tasks_reopen', 'works_reopen_tasks');
        const canManageSchedule = has('work_schedule_view', 'work_schedule_edit', 'works_manage_schedule');
        const canManageWorkFinancial = has('work_financial_view', 'work_prices_view', 'work_measurements_create', 'work_measurements_delete', 'work_invoices_manage', 'work_measurements_print', 'works_manage_financial');
        const canViewDailyLogs = has('works_view_daily_logs', 'works_view');

        const resolvedPermissions: ModulePermissions = {
          canViewContacts: has('contacts_view', 'contacts.view', 'contacts_manage', 'contacts.manage', 'contacts_view_all'),
          canCreateEditContacts: has('contacts_edit', 'contacts.create_edit', 'contacts_create', 'contacts_manage'),
          canDeleteContacts: has('contacts_delete', 'contacts.delete'),

          canViewPipeline: has('kanban_view', 'deals.view', 'kanban_manage', 'opportunities_view', 'deals_view'),
          canManageDeals: has('kanban_edit', 'deals.manage', 'kanban_manage', 'opportunities_edit'),
          canDeleteDeals: has('kanban_delete', 'deals.delete'),
          canWinLoseDeals: has('kanban_close', 'deals.close'),
          canCreateQuotes: has('proposals_issue', 'proposals.issue', 'quotes_create'),
          canDeleteQuotes: has('proposals_delete', 'proposals.delete'),
          canApplyDiscount: has('proposals_discount', 'proposals.discount'),
          canViewProfitMargin: has('proposals_margin', 'proposals.margin'),

          // 9 Permissões de Obra
          canViewWorks,
          canManageWorkDetails,
          canDeleteWorks,
          canManageWorkStructure,
          canExecuteWorkTasks,
          canReopenWorkTasks,
          canManageSchedule,
          canManageWorkFinancial,
          canViewDailyLogs,

          // Mapeamentos retroativos
          canCreateWorks: canManageWorkDetails,
          canEditWorkDetails: canManageWorkDetails,
          canManageWorkItems: canManageWorkStructure,
          canDeleteWorkItems: canManageWorkStructure,
          canDuplicateWorkItems: canManageWorkStructure,
          canCreateWorkTasks: canManageWorkStructure,
          canCompleteWorkTasks: canExecuteWorkTasks,
          canAssignExecutors: canExecuteWorkTasks,
          canViewSchedule: canManageSchedule,
          canEditSchedule: canManageSchedule,
          canViewWorkFinancial: canManageWorkFinancial,
          canViewWorkPrices: canManageWorkFinancial, // REGRA: Apenas quem tem financeiro vê preços/valores
          canCreateMeasurements: canManageWorkFinancial,
          canDeleteMeasurements: canManageWorkFinancial,
          canManageInvoices: canManageWorkFinancial,
          canPrintMeasurements: canManageWorkFinancial,

          // RH & Pessoas
          canViewHR: has('hr_view', 'hr.view', 'hr_manage'),
          canManageEmployees: has('hr_employees_manage', 'hr.employees_manage', 'hr_manage'),
          canManageSalariesBenefits: has('hr_salaries_manage', 'hr.salaries_manage'),
          canManageAdmissionsLeaves: has('hr_admissions_leaves', 'hr.admissions_leaves'),

          canManageCompanySettings: has('company_settings', 'company.settings'),
          canManageTeam: has('team_manage', 'team.manage'),
          canCustomizeSystem: has('custom_fields_manage', 'system_customization'),
          isOwnerOrAdmin: false,
        };

        if (isMounted) {
          setPermissions(resolvedPermissions);
          setScope(calculatedScope);
          isLoadedRef.current = true;
          setLoading(false);
        }
      } catch (err) {
        console.warn('Erro ao carregar permissões:', err);
        if (isMounted) setLoading(false);
      }
    };

    loadPermissionsAndScope();

    return () => {
      isMounted = false;
    };
  }, [currentUserId, currentCompanyId]);

  return { permissions, scope, loading };
};