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

  // Obras: Gestão & EAP
  canViewWorks: boolean;
  canCreateWorks: boolean;
  canEditWorkDetails: boolean;
  canDeleteWorks: boolean;
  canManageWorkItems: boolean;
  canDeleteWorkItems: boolean;
  canDuplicateWorkItems: boolean;

  // Obras: Campo & Cronograma
  canCreateWorkTasks: boolean;
  canCompleteWorkTasks: boolean;
  canAssignExecutors: boolean;
  canReopenWorkTasks: boolean;
  canViewSchedule: boolean;
  canEditSchedule: boolean;

  // Obras: Financeiro & Medições
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

  canViewWorks: false,
  canCreateWorks: false,
  canEditWorkDetails: false,
  canDeleteWorks: false,
  canManageWorkItems: false,
  canDeleteWorkItems: false,
  canDuplicateWorkItems: false,
  canCreateWorkTasks: false,
  canCompleteWorkTasks: false,
  canAssignExecutors: false,
  canReopenWorkTasks: false,
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
              canViewWorks: true,
              canCreateWorks: true,
              canEditWorkDetails: true,
              canDeleteWorks: true,
              canManageWorkItems: true,
              canDeleteWorkItems: true,
              canDuplicateWorkItems: true,
              canCreateWorkTasks: true,
              canCompleteWorkTasks: true,
              canAssignExecutors: true,
              canReopenWorkTasks: true,
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

          canViewWorks: has('works_view', 'works.view', 'works_manage'),
          canCreateWorks: has('works_create', 'works.create'),
          canEditWorkDetails: has('works_edit_details', 'works.edit_details'),
          canDeleteWorks: has('works_delete', 'works.delete'),
          canManageWorkItems: has('work_items_manage', 'work_items.manage'),
          canDeleteWorkItems: has('work_items_delete', 'work_items.delete'),
          canDuplicateWorkItems: has('work_items_duplicate', 'work_items.duplicate'),

          canCreateWorkTasks: has('work_tasks_create', 'work_tasks.create'),
          canCompleteWorkTasks: has('work_tasks_complete', 'work_tasks.complete'),
          canAssignExecutors: has('work_tasks_assign', 'work_tasks.assign'),
          canReopenWorkTasks: has('work_tasks_reopen', 'work_tasks.reopen'),
          canViewSchedule: has('work_schedule_view', 'work_schedule.view'),
          canEditSchedule: has('work_schedule_edit', 'work_schedule.edit'),

          canViewWorkFinancial: has('work_financial_view', 'work_financial.view'),
          canViewWorkPrices: has('work_prices_view', 'work_prices.view'),
          canCreateMeasurements: has('work_measurements_create', 'work_measurements.create'),
          canDeleteMeasurements: has('work_measurements_delete', 'work_measurements.delete'),
          canManageInvoices: has('work_invoices_manage', 'work_invoices.manage'),
          canPrintMeasurements: has('work_measurements_print', 'work_measurements.print'),

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