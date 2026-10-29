import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  X,
  Network,
  ShieldCheck,
  Plus,
  Edit2,
  Trash2,
  Crown,
  Clock,
  Briefcase,
  Loader2,
  Check,
  Eye,
  Lock,
  TrendingUp,
  History,
  Gift,
  Heart,
  Car,
  Utensils,
  Bus,
  Layers
} from 'lucide-react';

export interface DepartmentItem {
  id: string;
  company_id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  manager_id?: string | null;
  manager?: {
    id: string;
    full_name: string;
    avatar_url?: string | null;
  } | null;
}

export interface JobPositionItem {
  id: string;
  company_id: string;
  department_id?: string | null;
  department_name?: string | null;
  title: string;
  description?: string | null;
  cbo_code?: string | null;
  contract_type: 'clt' | 'pj' | 'diarista' | 'estagio' | 'temporario';
  salary_type: 'mensal' | 'diaria';
  base_salary: number;
  weekly_hours: number;
  monthly_work_hours: number;
  is_active: boolean;
}

export interface CompanyBenefitItem {
  id: string;
  company_id: string;
  name: string;
  category: 'alimentacao' | 'combustivel' | 'saude' | 'transporte' | 'outros';
  default_value: number;
  description?: string | null;
  is_active: boolean;
}

export interface SalaryHistoryItem {
  id: string;
  previous_salary: number;
  new_salary: number;
  effective_date: string;
  reason: string;
  notes?: string | null;
  created_at: string;
}

export interface RoleDefinition {
  id: string;
  name: string;
  description: string;
  is_system?: boolean;
  permissions: string[];
}

export interface PermissionDefinition {
  id: string;
  label: string;
  category: 'Contatos' | 'Oportunidades' | 'Obras' | 'RH & Pessoas' | 'Gestão da Empresa';
  dependsOn?: string;
}

const AVAILABLE_PERMISSIONS: PermissionDefinition[] = [
  // --- 1. MÓDULO: CONTATOS ---
  { id: 'contacts_view', label: 'Visualizar carteira de clientes e contatos', category: 'Contatos' },
  { id: 'contacts_edit', label: 'Cadastrar e editar clientes (PF / PJ)', category: 'Contatos', dependsOn: 'contacts_view' },
  { id: 'contacts_delete', label: 'Excluir contatos da empresa', category: 'Contatos', dependsOn: 'contacts_view' },

  // --- 2. MÓDULO: OPORTUNIDADES ---
  { id: 'kanban_view', label: 'Visualizar pipeline comercial (Kanban)', category: 'Oportunidades' },
  { id: 'kanban_edit', label: 'Criar e movimentar negociações no funil', category: 'Oportunidades', dependsOn: 'kanban_view' },
  { id: 'kanban_close', label: 'Marcar negócios como Ganho ou Perdido', category: 'Oportunidades', dependsOn: 'kanban_view' },
  { id: 'kanban_delete', label: 'Excluir negociações do funil', category: 'Oportunidades', dependsOn: 'kanban_view' },
  { id: 'proposals_issue', label: 'Emitir propostas comerciais e orçamentos', category: 'Oportunidades', dependsOn: 'kanban_view' },
  { id: 'proposals_discount', label: 'Aplicar descontos especiais em propostas', category: 'Oportunidades', dependsOn: 'proposals_issue' },
  { id: 'proposals_margin', label: 'Visualizar margem de lucro e custo nas propostas', category: 'Oportunidades', dependsOn: 'proposals_issue' },
  { id: 'proposals_delete', label: 'Excluir propostas comerciais', category: 'Oportunidades', dependsOn: 'proposals_issue' },

  // --- 3. MÓDULO: OBRAS ---
  { id: 'works_view', label: 'Visualizar listagem e detalhes das obras', category: 'Obras' },
  { id: 'works_create', label: 'Criar novas obras no sistema', category: 'Obras', dependsOn: 'works_view' },
  { id: 'works_edit_details', label: 'Editar dados contratuais e status da obra', category: 'Obras', dependsOn: 'works_view' },
  { id: 'works_delete', label: 'Excluir obras e histórico vinculado', category: 'Obras', dependsOn: 'works_view' },
  { id: 'work_items_manage', label: 'Criar e editar itens na árvore (EAP)', category: 'Obras', dependsOn: 'works_view' },
  { id: 'work_items_delete', label: 'Excluir componentes e ramos da EAP', category: 'Obras', dependsOn: 'work_items_manage' },
  { id: 'work_items_duplicate', label: 'Duplicar componentes em lote com tarefas', category: 'Obras', dependsOn: 'work_items_manage' },
  { id: 'work_tasks_create', label: 'Adicionar novas tarefas nos componentes', category: 'Obras', dependsOn: 'works_view' },
  { id: 'work_tasks_complete', label: 'Apontar avanço e dar baixa em tarefas', category: 'Obras', dependsOn: 'works_view' },
  { id: 'work_tasks_reopen', label: 'Reabrir tarefas já dadas como concluídas', category: 'Obras', dependsOn: 'work_tasks_complete' },
  { id: 'work_tasks_assign', label: 'Definir executores responsáveis pelas tarefas', category: 'Obras', dependsOn: 'works_view' },
  { id: 'work_schedule_view', label: 'Visualizar cronograma (Gantt)', category: 'Obras', dependsOn: 'works_view' },
  { id: 'work_schedule_edit', label: 'Alterar prazos e dependências no cronograma', category: 'Obras', dependsOn: 'work_schedule_view' },
  { id: 'work_financial_view', label: 'Acessar aba financeira e KPIs de contrato', category: 'Obras', dependsOn: 'works_view' },
  { id: 'work_prices_view', label: 'Visualizar valores em R$ (itens e tarefas)', category: 'Obras', dependsOn: 'works_view' },
  { id: 'work_measurements_create', label: 'Emitir Boletins de Medição (BM)', category: 'Obras', dependsOn: 'work_financial_view' },
  { id: 'work_measurements_delete', label: 'Excluir medições não faturadas', category: 'Obras', dependsOn: 'work_measurements_create' },
  { id: 'work_invoices_manage', label: 'Aprovar medições e emitir/baixar faturas', category: 'Obras', dependsOn: 'work_financial_view' },
  { id: 'work_measurements_print', label: 'Exportar/Imprimir folha timbrada de medição', category: 'Obras', dependsOn: 'work_financial_view' },

  // --- 4. MÓDULO: RH & PESSOAS ---
  { id: 'hr_view', label: 'Acessar painel e listagem do RH & Colaboradores', category: 'RH & Pessoas' },
  { id: 'hr_employees_manage', label: 'Cadastrar e editar fichas de colaboradores', category: 'RH & Pessoas', dependsOn: 'hr_view' },
  { id: 'hr_salaries_manage', label: 'Visualizar e gerenciar salários, custos e benefícios', category: 'RH & Pessoas', dependsOn: 'hr_view' },
  { id: 'hr_admissions_leaves', label: 'Gerenciar admissões, desligamentos e afastamentos', category: 'RH & Pessoas', dependsOn: 'hr_view' },

  // --- 5. MÓDULO: GESTÃO DA EMPRESA ---
  { id: 'company_settings', label: 'Alterar dados fiscais, logotipo e endereço', category: 'Gestão da Empresa' },
  { id: 'team_manage', label: 'Gerenciar equipe, setores e cargos', category: 'Gestão da Empresa' },
  { id: 'custom_fields_manage', label: 'Personalizar funil, serviços e catálogo de itens', category: 'Gestão da Empresa' },
];

const CATEGORIES: ('Contatos' | 'Oportunidades' | 'Obras' | 'RH & Pessoas' | 'Gestão da Empresa')[] = [
  'Contatos',
  'Oportunidades',
  'Obras',
  'RH & Pessoas',
  'Gestão da Empresa'
];

const formatCurrency = (val: number) => {
  return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

interface OrganizationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
}

export const OrganizationSettingsModal: React.FC<OrganizationSettingsModalProps> = ({
  isOpen,
  onClose,
  companyId
}) => {
  const [activeTab, setActiveTab] = useState<'setores' | 'cargos' | 'beneficios' | 'acessos'>('setores');

  // Setores
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [deptFormName, setDeptFormName] = useState('');
  const [deptFormDesc, setDeptFormDesc] = useState('');
  const [deptFormColor, setDeptFormColor] = useState('#0ea5e9');
  const [deptFormManagerId, setDeptFormManagerId] = useState<string>('');
  const [savingDept, setSavingDept] = useState(false);
  const [deptToDelete, setDeptToDelete] = useState<DepartmentItem | null>(null);
  const [deletingDept, setDeletingDept] = useState(false);

  // Lista de gestores elegíveis (perfis da empresa)
  const [companyProfiles, setCompanyProfiles] = useState<{ id: string; full_name: string }[]>([]);

  // Cargos
  const [jobPositions, setJobPositions] = useState<JobPositionItem[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [selectedDeptFilterForJobs, setSelectedDeptFilterForJobs] = useState<string>('all');
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [jobFormTitle, setJobFormTitle] = useState('');
  const [jobFormDesc, setJobFormDesc] = useState('');
  const [jobFormCbo, setJobFormCbo] = useState('');
  const [jobFormDeptId, setJobFormDeptId] = useState<string>('');
  const [jobFormContractType, setJobFormContractType] = useState<'clt' | 'pj' | 'diarista' | 'estagio' | 'temporario'>('clt');
  const [jobFormSalaryType, setJobFormSalaryType] = useState<'mensal' | 'diaria'>('mensal');
  const [jobFormBaseSalary, setJobFormBaseSalary] = useState('');
  const [jobFormWeeklyHours, setJobFormWeeklyHours] = useState('44');
  const [savingJob, setSavingJob] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<JobPositionItem | null>(null);
  const [deletingJob, setDeletingJob] = useState(false);

  // Histórico de Reajuste do Cargo
  const [historyJob, setHistoryJob] = useState<JobPositionItem | null>(null);
  const [salaryHistory, setSalaryHistory] = useState<SalaryHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isAdjustSalaryOpen, setIsAdjustSalaryOpen] = useState(false);
  const [adjustNewSalary, setAdjustNewSalary] = useState('');
  const [adjustReason, setAdjustReason] = useState('Dissídio Coletivo');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [adjustDate, setAdjustDate] = useState(new Date().toISOString().split('T')[0]);
  const [savingAdjust, setSavingAdjust] = useState(false);

  // Benefícios da Empresa
  const [benefits, setBenefits] = useState<CompanyBenefitItem[]>([]);
  const [loadingBenefits, setLoadingBenefits] = useState(false);
  const [isBenefitModalOpen, setIsBenefitModalOpen] = useState(false);
  const [editingBenefitId, setEditingBenefitId] = useState<string | null>(null);
  const [benefitFormName, setBenefitFormName] = useState('');
  const [benefitFormCategory, setBenefitFormCategory] = useState<'alimentacao' | 'combustivel' | 'saude' | 'transporte' | 'outros'>('alimentacao');
  const [benefitFormDefaultValue, setBenefitFormDefaultValue] = useState('');
  const [benefitFormDesc, setBenefitFormDesc] = useState('');
  const [savingBenefit, setSavingBenefit] = useState(false);
  const [benefitToDelete, setBenefitToDelete] = useState<CompanyBenefitItem | null>(null);
  const [deletingBenefit, setDeletingBenefit] = useState(false);

  // Níveis de Acesso
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [savingRole, setSavingRole] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<RoleDefinition | null>(null);
  const [deletingRole, setDeletingRole] = useState(false);

  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleFormName, setRoleFormName] = useState('');
  const [roleFormDescription, setRoleFormDescription] = useState('');
  const [roleFormPermissions, setRoleFormPermissions] = useState<string[]>([]);

  // Carregar Setores e Cargos
  const loadOrganizationData = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoadingDepts(true);
      setLoadingJobs(true);

      const [deptRes, jobsRes, profilesRes] = await Promise.all([
        supabase
          .from('company_departments')
          .select(`
            id, company_id, name, description, color, manager_id,
            manager:profiles!manager_id(id, full_name, avatar_url)
          `)
          .eq('company_id', companyId)
          .order('name', { ascending: true }),

        supabase
          .from('company_job_positions')
          .select(`
            id, company_id, department_id, title, description, cbo_code,
            contract_type, salary_type, base_salary, weekly_hours, monthly_work_hours, is_active,
            department:company_departments!department_id(name)
          `)
          .eq('company_id', companyId)
          .order('title', { ascending: true }),

        supabase
          .from('profiles')
          .select('id, full_name')
          .eq('company_id', companyId)
          .order('full_name', { ascending: true })
      ]);

      const loadedDepts: DepartmentItem[] = (deptRes.data || []).map((d: any) => ({
        ...d,
        manager: Array.isArray(d.manager) ? d.manager[0] : d.manager
      }));

      const loadedJobs: JobPositionItem[] = (jobsRes.data || []).map((j: any) => {
        const deptObj = Array.isArray(j.department) ? j.department[0] : j.department;
        return {
          ...j,
          department_name: deptObj?.name || null,
          contract_type: j.contract_type || 'clt',
          base_salary: Number(j.base_salary) || 0,
          weekly_hours: Number(j.weekly_hours) || 44.0,
          monthly_work_hours: Number(j.monthly_work_hours) || 220
        };
      });

      setDepartments(loadedDepts);
      setJobPositions(loadedJobs);
      setCompanyProfiles(profilesRes.data || []);
    } catch (err) {
      console.error('Erro ao carregar organização (setores e cargos):', err);
    } finally {
      setLoadingDepts(false);
      setLoadingJobs(false);
    }
  }, [companyId]);

  // Carregar Benefícios
  const loadBenefitsData = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoadingBenefits(true);
      const { data, error } = await supabase
        .from('company_benefits')
        .select('*')
        .eq('company_id', companyId)
        .order('name', { ascending: true });

      if (error) throw error;
      setBenefits((data || []).map((b: any) => ({
        ...b,
        default_value: Number(b.default_value) || 0
      })));
    } catch (err) {
      console.error('Erro ao buscar benefícios da empresa:', err);
    } finally {
      setLoadingBenefits(false);
    }
  }, [companyId]);

  // Carregar Níveis de Acesso
  const fetchRoles = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoadingRoles(true);
      const { data, error } = await supabase
        .from('company_roles')
        .select('*')
        .eq('company_id', companyId)
        .order('is_system', { ascending: false });

      if (error) return;

      if (data && data.length > 0) {
        const formatted: RoleDefinition[] = data.map((r: any) => ({
          id: r.id,
          name: r.name,
          description: r.description || '',
          is_system: r.is_system,
          permissions: Array.isArray(r.permissions) ? r.permissions : []
        }));
        setRoles(formatted);
      }
    } catch (err) {
      console.error('Erro ao buscar roles:', err);
    } finally {
      setLoadingRoles(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (!isOpen || !companyId) return;
    loadOrganizationData();
    loadBenefitsData();
    fetchRoles();
  }, [isOpen, companyId, loadOrganizationData, loadBenefitsData, fetchRoles]);

  // Setores Handlers
  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptFormName.trim() || !companyId) return;

    try {
      setSavingDept(true);
      const payload = {
        company_id: companyId,
        name: deptFormName.trim(),
        description: deptFormDesc.trim() || null,
        color: deptFormColor,
        manager_id: deptFormManagerId || null,
        updated_at: new Date().toISOString()
      };

      if (editingDeptId) {
        const { error } = await supabase
          .from('company_departments')
          .update(payload)
          .eq('id', editingDeptId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('company_departments')
          .insert(payload);
        if (error) throw error;
      }

      setIsDeptModalOpen(false);
      setEditingDeptId(null);
      await loadOrganizationData();
    } catch (err: any) {
      alert('Erro ao salvar setor: ' + err.message);
    } finally {
      setSavingDept(false);
    }
  };

  const handleConfirmDeleteDept = async () => {
    if (!deptToDelete) return;
    try {
      setDeletingDept(true);
      const { error } = await supabase
        .from('company_departments')
        .delete()
        .eq('id', deptToDelete.id);

      if (error) throw error;
      setDeptToDelete(null);
      await loadOrganizationData();
    } catch (err: any) {
      alert('Erro ao excluir setor: ' + err.message);
    } finally {
      setDeletingDept(false);
    }
  };

  // Cargos Handlers
  const handleSaveJobPosition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobFormTitle.trim() || !companyId) return;

    try {
      setSavingJob(true);
      const numSalary = parseFloat(jobFormBaseSalary.replace(/\./g, '').replace(',', '.')) || 0;
      const numWeekly = parseFloat(jobFormWeeklyHours.replace(',', '.')) || 44.0;

      let calculatedMonthlyHours = 220;
      if (numWeekly === 40) calculatedMonthlyHours = 200;
      else if (numWeekly === 36) calculatedMonthlyHours = 180;
      else if (numWeekly === 30) calculatedMonthlyHours = 150;
      else if (numWeekly === 20) calculatedMonthlyHours = 100;
      else calculatedMonthlyHours = Math.round((numWeekly / 6) * 30);

      const payload = {
        company_id: companyId,
        department_id: jobFormDeptId || null,
        title: jobFormTitle.trim(),
        description: jobFormDesc.trim() || null,
        cbo_code: jobFormCbo.trim() || null,
        contract_type: jobFormContractType,
        salary_type: jobFormSalaryType,
        base_salary: numSalary,
        weekly_hours: numWeekly,
        monthly_work_hours: calculatedMonthlyHours,
        updated_at: new Date().toISOString()
      };

      if (editingJobId) {
        const { error } = await supabase
          .from('company_job_positions')
          .update(payload)
          .eq('id', editingJobId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('company_job_positions')
          .insert(payload);
        if (error) throw error;
      }

      setIsJobModalOpen(false);
      setEditingJobId(null);
      await loadOrganizationData();
    } catch (err: any) {
      alert('Erro ao salvar cargo: ' + err.message);
    } finally {
      setSavingJob(false);
    }
  };

  const handleConfirmDeleteJob = async () => {
    if (!jobToDelete) return;
    try {
      setDeletingJob(true);
      const { error } = await supabase
        .from('company_job_positions')
        .delete()
        .eq('id', jobToDelete.id);

      if (error) throw error;
      setJobToDelete(null);
      await loadOrganizationData();
    } catch (err: any) {
      alert('Erro ao excluir cargo: ' + err.message);
    } finally {
      setDeletingJob(false);
    }
  };

  // Histórico Salarial do Cargo
  const handleOpenSalaryHistory = async (job: JobPositionItem) => {
    setHistoryJob(job);
    setAdjustNewSalary(job.base_salary.toString());
    setAdjustReason('Dissídio Coletivo');
    setAdjustNotes('');
    setAdjustDate(new Date().toISOString().split('T')[0]);

    try {
      setLoadingHistory(true);
      const { data, error } = await supabase
        .from('job_position_salary_history')
        .select('*')
        .eq('job_position_id', job.id)
        .order('effective_date', { ascending: false });

      if (error) throw error;
      setSalaryHistory(data || []);
    } catch (err) {
      console.error('Erro ao carregar histórico salarial:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleApplySalaryAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!historyJob || !companyId) return;

    try {
      setSavingAdjust(true);
      const newSalaryNum = parseFloat(adjustNewSalary.replace(/\./g, '').replace(',', '.')) || 0;
      const previousSalaryNum = historyJob.base_salary;

      const { error: histError } = await supabase
        .from('job_position_salary_history')
        .insert({
          company_id: companyId,
          job_position_id: historyJob.id,
          previous_salary: previousSalaryNum,
          new_salary: newSalaryNum,
          effective_date: adjustDate,
          reason: adjustReason.trim(),
          notes: adjustNotes.trim() || null
        });

      if (histError) throw histError;

      const { error: updateError } = await supabase
        .from('company_job_positions')
        .update({
          base_salary: newSalaryNum,
          updated_at: new Date().toISOString()
        })
        .eq('id', historyJob.id);

      if (updateError) throw updateError;

      setIsAdjustSalaryOpen(false);
      await loadOrganizationData();
      await handleOpenSalaryHistory({ ...historyJob, base_salary: newSalaryNum });
    } catch (err: any) {
      alert('Erro ao aplicar reajuste salarial: ' + err.message);
    } finally {
      setSavingAdjust(false);
    }
  };

  // Benefícios Handlers
  const handleSaveBenefit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!benefitFormName.trim() || !companyId) return;

    try {
      setSavingBenefit(true);
      const numVal = parseFloat(benefitFormDefaultValue.replace(/\./g, '').replace(',', '.')) || 0;

      const payload = {
        company_id: companyId,
        name: benefitFormName.trim(),
        category: benefitFormCategory,
        default_value: numVal,
        description: benefitFormDesc.trim() || null,
        updated_at: new Date().toISOString()
      };

      if (editingBenefitId) {
        const { error } = await supabase
          .from('company_benefits')
          .update(payload)
          .eq('id', editingBenefitId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('company_benefits')
          .insert(payload);
        if (error) throw error;
      }

      setIsBenefitModalOpen(false);
      setEditingBenefitId(null);
      await loadBenefitsData();
    } catch (err: any) {
      alert('Erro ao salvar benefício: ' + err.message);
    } finally {
      setSavingBenefit(false);
    }
  };

  const handleConfirmDeleteBenefit = async () => {
    if (!benefitToDelete) return;
    try {
      setDeletingBenefit(true);
      const { error } = await supabase
        .from('company_benefits')
        .delete()
        .eq('id', benefitToDelete.id);

      if (error) throw error;
      setBenefitToDelete(null);
      await loadBenefitsData();
    } catch (err: any) {
      alert('Erro ao excluir benefício: ' + err.message);
    } finally {
      setDeletingBenefit(false);
    }
  };

  // Níveis de Acesso Handlers
  const handleOpenCreateRole = () => {
    setEditingRoleId(null);
    setIsEditMode(true);
    setRoleFormName('');
    setRoleFormDescription('');
    setRoleFormPermissions(['contacts_view']);
    setIsRoleModalOpen(true);
  };

  const handleOpenViewRole = (role: RoleDefinition) => {
    setEditingRoleId(role.id);
    setIsEditMode(false);
    setRoleFormName(role.name);
    setRoleFormDescription(role.description);
    setRoleFormPermissions(role.permissions);
    setIsRoleModalOpen(true);
  };

  const handleToggleFormPermission = (permId: string) => {
    if (!isEditMode) return;

    setRoleFormPermissions((prev) => {
      const isCurrentlyChecked = prev.includes(permId);

      if (isCurrentlyChecked) {
        const findDescendants = (id: string): string[] => {
          const directChildren = AVAILABLE_PERMISSIONS.filter(p => p.dependsOn === id).map(p => p.id);
          const indirectChildren = directChildren.flatMap(childId => findDescendants(childId));
          return [id, ...directChildren, ...indirectChildren];
        };

        const idsToRemove = findDescendants(permId);
        return prev.filter(id => !idsToRemove.includes(id));
      } else {
        const findAncestors = (id: string): string[] => {
          const item = AVAILABLE_PERMISSIONS.find(p => p.id === id);
          if (item?.dependsOn) {
            return [id, ...findAncestors(item.dependsOn)];
          }
          return [id];
        };

        const idsToAdd = findAncestors(permId);
        return Array.from(new Set([...prev, ...idsToAdd]));
      }
    });
  };

  const handleToggleCategory = (category: 'Contatos' | 'Oportunidades' | 'Obras' | 'RH & Pessoas' | 'Gestão da Empresa') => {
    if (!isEditMode) return;
    const catPermIds = AVAILABLE_PERMISSIONS.filter(p => p.category === category).map(p => p.id);
    const allChecked = catPermIds.every(id => roleFormPermissions.includes(id));

    if (allChecked) {
      setRoleFormPermissions(prev => prev.filter(id => !catPermIds.includes(id)));
    } else {
      setRoleFormPermissions(prev => Array.from(new Set([...prev, ...catPermIds])));
    }
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleFormName.trim()) return;

    try {
      setSavingRole(true);
      const payload = {
        name: roleFormName.trim(),
        description: roleFormDescription.trim(),
        permissions: roleFormPermissions
      };

      if (editingRoleId) {
        const { error } = await supabase
          .from('company_roles')
          .update(payload)
          .eq('id', editingRoleId);

        if (error) throw error;
        setRoles(prev => prev.map(r => (r.id === editingRoleId ? { ...r, ...payload } : r)));
      } else {
        const { data, error } = await supabase
          .from('company_roles')
          .insert({
            company_id: companyId,
            ...payload,
            is_system: false
          })
          .select()
          .single();

        if (error) throw error;
        if (data) setRoles(prev => [...prev, data]);
      }

      setIsRoleModalOpen(false);
      setIsEditMode(false);
    } catch (err: any) {
      alert('Erro ao salvar nível: ' + err.message);
    } finally {
      setSavingRole(false);
    }
  };

  const handleConfirmDeleteRole = async () => {
    if (!roleToDelete) return;
    try {
      setDeletingRole(true);
      const { error } = await supabase
        .from('company_roles')
        .delete()
        .eq('id', roleToDelete.id);

      if (error) throw error;
      setRoles(prev => prev.filter(r => r.id !== roleToDelete.id));
      setRoleToDelete(null);
    } catch (err: any) {
      alert(`Erro ao remover nível: ${err.message}`);
    } finally {
      setDeletingRole(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'alimentacao':
        return <Utensils size={14} className="text-amber-600" />;
      case 'combustivel':
        return <Car size={14} className="text-sky-600" />;
      case 'saude':
        return <Heart size={14} className="text-rose-600" />;
      case 'transporte':
        return <Bus size={14} className="text-indigo-600" />;
      default:
        return <Gift size={14} className="text-emerald-600" />;
    }
  };

  const filteredJobs = jobPositions.filter(j => 
    selectedDeptFilterForJobs === 'all' || j.department_id === selectedDeptFilterForJobs
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[260] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-5xl w-full shadow-2xl flex flex-col h-[88vh] overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Topo do Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <Network size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base leading-tight">
                Estrutura Organizacional, Cargos & Acessos
              </h3>
              <p className="text-xs text-slate-500">
                Gerencie setores, plano de cargos e salários, benefícios corporativos e perfis de permissão.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Abas */}
        <div className="px-6 border-b border-slate-200/90 flex items-center gap-2 bg-slate-50/50 shrink-0 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('setores')}
            className={`py-3 px-3.5 border-b-2 text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'setores'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers size={15} />
            <span>Setores ({departments.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cargos')}
            className={`py-3 px-3.5 border-b-2 text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'cargos'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Briefcase size={15} />
            <span>Cargos & Salários ({jobPositions.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('beneficios')}
            className={`py-3 px-3.5 border-b-2 text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'beneficios'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Gift size={15} />
            <span>Benefícios ({benefits.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('acessos')}
            className={`py-3 px-3.5 border-b-2 text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'acessos'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck size={15} />
            <span>Níveis de Acesso ({roles.length})</span>
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          
          {/* ABA 1: SETORES */}
          {activeTab === 'setores' && (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="p-4 sm:px-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Departamentos e Setores</h4>
                  <p className="text-xs text-slate-500">Organize os setores de operação, engenharia, comercial e diretoria</p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEditingDeptId(null);
                    setDeptFormName('');
                    setDeptFormDesc('');
                    setDeptFormColor('#0ea5e9');
                    setDeptFormManagerId('');
                    setIsDeptModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-2xs cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Novo Setor</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                {loadingDepts ? (
                  <div className="p-12 text-center text-xs text-slate-400">
                    <Loader2 size={18} className="animate-spin mx-auto mb-2 text-indigo-600" />
                    Carregando setores...
                  </div>
                ) : departments.length === 0 ? (
                  <div className="p-12 text-center text-xs text-slate-400 border border-dashed rounded-2xl bg-slate-50/50 max-w-lg mx-auto">
                    <Layers size={32} className="mx-auto mb-2 text-slate-300" />
                    <p className="font-bold text-slate-700">Nenhum setor cadastrado</p>
                    <p className="text-slate-400 mt-1">Crie setores como "Obras & Campo", "Engenharia", "Comercial" e "Diretoria".</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                    {departments.map(dept => {
                      const linkedJobsCount = jobPositions.filter(j => j.department_id === dept.id).length;

                      return (
                        <div
                          key={dept.id}
                          className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col justify-between space-y-3"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span
                                  className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs border border-white"
                                  style={{ backgroundColor: dept.color || '#0ea5e9' }}
                                />
                                <h5 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                                  {dept.name}
                                </h5>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingDeptId(dept.id);
                                    setDeptFormName(dept.name);
                                    setDeptFormDesc(dept.description || '');
                                    setDeptFormColor(dept.color || '#0ea5e9');
                                    setDeptFormManagerId(dept.manager_id || '');
                                    setIsDeptModalOpen(true);
                                  }}
                                  className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeptToDelete(dept)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>

                            {dept.description && (
                              <p className="text-[11px] text-slate-500 line-clamp-2 mt-2">
                                {dept.description}
                              </p>
                            )}
                          </div>

                          <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 flex items-center gap-1 truncate max-w-[150px]">
                              <Crown size={12} className="text-amber-500 shrink-0" />
                              {dept.manager?.full_name || 'Sem Gerente'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold bg-slate-100 px-2 py-0.5 rounded-full">
                              {linkedJobsCount} {linkedJobsCount === 1 ? 'cargo' : 'cargos'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ABA 2: CARGOS E SALÁRIOS */}
          {activeTab === 'cargos' && (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="p-4 sm:px-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 shrink-0 bg-white">
                <div className="flex items-center gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Plano de Cargos & Salários</h4>
                    <p className="text-xs text-slate-500">Defina funções, pisos salariais, regime e jornada de trabalho semanal</p>
                  </div>

                  <select
                    value={selectedDeptFilterForJobs}
                    onChange={e => setSelectedDeptFilterForJobs(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer"
                  >
                    <option value="all">Todos os Setores ({jobPositions.length})</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEditingJobId(null);
                    setJobFormTitle('');
                    setJobFormDesc('');
                    setJobFormCbo('');
                    setJobFormDeptId(selectedDeptFilterForJobs !== 'all' ? selectedDeptFilterForJobs : (departments[0]?.id || ''));
                    setJobFormContractType('clt');
                    setJobFormSalaryType('mensal');
                    setJobFormBaseSalary('');
                    setJobFormWeeklyHours('44');
                    setIsJobModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-2xs cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Novo Cargo</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                {loadingJobs ? (
                  <div className="p-12 text-center text-xs text-slate-400">
                    <Loader2 size={18} className="animate-spin mx-auto mb-2 text-indigo-600" />
                    Carregando cargos...
                  </div>
                ) : filteredJobs.length === 0 ? (
                  <div className="p-12 text-center text-xs text-slate-400 border border-dashed rounded-2xl bg-slate-50/50 max-w-lg mx-auto">
                    <Briefcase size={32} className="mx-auto mb-2 text-slate-300" />
                    <p className="font-bold text-slate-700">Nenhum cargo encontrado</p>
                    <p className="text-slate-400 mt-1">Cadastre cargos como "Eletricista Montador", "Encarregado de Obra" ou "Projetista".</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                    {filteredJobs.map(job => (
                      <div
                        key={job.id}
                        className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col justify-between space-y-3"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h5 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                                  {job.title}
                                </h5>
                                <span className="uppercase text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                  {job.contract_type}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 mt-1">
                                {job.department_name && (
                                  <span className="text-[10px] text-slate-500 font-semibold">
                                    {job.department_name}
                                  </span>
                                )}
                                <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100 flex items-center gap-0.5">
                                  <Clock size={9} />
                                  {job.weekly_hours}h/sem • {job.monthly_work_hours}h/mês
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingJobId(job.id);
                                  setJobFormTitle(job.title);
                                  setJobFormDesc(job.description || '');
                                  setJobFormCbo(job.cbo_code || '');
                                  setJobFormDeptId(job.department_id || '');
                                  setJobFormContractType(job.contract_type || 'clt');
                                  setJobFormSalaryType(job.salary_type);
                                  setJobFormBaseSalary(job.base_salary ? job.base_salary.toString() : '');
                                  setJobFormWeeklyHours(job.weekly_hours ? job.weekly_hours.toString() : '44');
                                  setIsJobModalOpen(true);
                                }}
                                className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                                title="Editar Cargo"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setJobToDelete(job)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                title="Excluir Cargo"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          {job.description && (
                            <p className="text-[11px] text-slate-500 line-clamp-2 mt-2">
                              {job.description}
                            </p>
                          )}
                        </div>

                        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                              Piso Base ({job.salary_type})
                            </span>
                            <strong className="text-xs font-black text-slate-900">
                              {formatCurrency(job.base_salary)}
                            </strong>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleOpenSalaryHistory(job)}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 text-slate-600 rounded-lg text-[10px] font-bold shadow-2xs transition cursor-pointer"
                          >
                            <History size={11} />
                            <span>Reajustes</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ABA 3: BENEFÍCIOS DA EMPRESA */}
          {activeTab === 'beneficios' && (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="p-4 sm:px-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Catálogo de Benefícios da Empresa</h4>
                  <p className="text-xs text-slate-500">Configure os auxílios e planos disponíveis para oferta na contratação</p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEditingBenefitId(null);
                    setBenefitFormName('');
                    setBenefitFormCategory('alimentacao');
                    setBenefitFormDefaultValue('');
                    setBenefitFormDesc('');
                    setIsBenefitModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-2xs cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Novo Benefício</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                {loadingBenefits ? (
                  <div className="p-12 text-center text-xs text-slate-400">
                    <Loader2 size={18} className="animate-spin mx-auto mb-2 text-indigo-600" />
                    Carregando benefícios...
                  </div>
                ) : benefits.length === 0 ? (
                  <div className="p-12 text-center text-xs text-slate-400 border border-dashed rounded-2xl bg-slate-50/50 max-w-lg mx-auto">
                    <Gift size={32} className="mx-auto mb-2 text-slate-300" />
                    <p className="font-bold text-slate-700">Nenhum benefício cadastrado</p>
                    <p className="text-slate-400 mt-1">Cadastre auxílios como Alimentação, Transporte, Combustível ou Plano de Saúde.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {benefits.map(benefit => (
                      <div
                        key={benefit.id}
                        className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col justify-between space-y-3"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                                {getCategoryIcon(benefit.category)}
                              </div>
                              <div className="min-w-0">
                                <h5 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                                  {benefit.name}
                                </h5>
                                <span className="capitalize text-[10px] text-slate-400 font-medium">
                                  {benefit.category}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingBenefitId(benefit.id);
                                  setBenefitFormName(benefit.name);
                                  setBenefitFormCategory(benefit.category);
                                  setBenefitFormDefaultValue(benefit.default_value ? benefit.default_value.toString() : '');
                                  setBenefitFormDesc(benefit.description || '');
                                  setIsBenefitModalOpen(true);
                                }}
                                className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setBenefitToDelete(benefit)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          {benefit.description && (
                            <p className="text-[11px] text-slate-500 line-clamp-2 mt-2">
                              {benefit.description}
                            </p>
                          )}
                        </div>

                        <div className="pt-2.5 border-t border-slate-100 flex items-baseline justify-between">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Valor Referência</span>
                          <strong className="text-xs font-black text-slate-900">
                            {benefit.default_value > 0 ? formatCurrency(benefit.default_value) : 'Variável'}
                          </strong>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ABA 4: NÍVEIS DE ACESSO */}
          {activeTab === 'acessos' && (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="p-4 sm:px-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Perfis & Permissões</h4>
                  <p className="text-xs text-slate-500">Configure o que cada perfil pode visualizar e editar na empresa</p>
                </div>

                <button
                  type="button"
                  onClick={handleOpenCreateRole}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-2xs cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Criar Nível de Acesso</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {loadingRoles ? (
                  <div className="p-12 text-center text-xs text-slate-400">
                    <Loader2 size={18} className="animate-spin mx-auto mb-2 text-indigo-600" />
                    Carregando níveis...
                  </div>
                ) : (
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="px-6 py-3.5">Nome do Nível</th>
                        <th className="px-6 py-3.5">Descrição</th>
                        <th className="px-6 py-3.5">Permissões</th>
                        <th className="px-6 py-3.5 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {roles.map(role => (
                        <tr key={role.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-6 py-3.5">
                            <div className="flex items-center gap-2">
                              <strong className="text-slate-900 font-bold">{role.name}</strong>
                              {role.is_system && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                  <Lock size={10} /> Sistema
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-6 py-3.5 text-slate-500 text-xs max-w-sm">
                            {role.description}
                          </td>

                          <td className="px-6 py-3.5">
                            {role.is_system ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                                <Check size={12} /> Acesso Total
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                <Check size={12} /> {role.permissions.length} ativas
                              </span>
                            )}
                          </td>

                          <td className="px-6 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenViewRole(role)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg cursor-pointer"
                              >
                                <Eye size={12} />
                                Visualizar
                              </button>
                              {!role.is_system && (
                                <button
                                  type="button"
                                  onClick={() => setRoleToDelete(role)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Rodapé */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs transition"
          >
            Concluir
          </button>
        </div>

      </div>

      {/* MODAL: CRIAR/EDITAR BENEFÍCIO */}
      {isBenefitModalOpen && (
        <div className="fixed inset-0 z-[280] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b">
              <h4 className="font-bold text-slate-900 text-sm">
                {editingBenefitId ? 'Editar Benefício' : 'Novo Benefício da Empresa'}
              </h4>
              <button onClick={() => setIsBenefitModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveBenefit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome do Benefício *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Ex: Auxílio Alimentação (Flash), Unimed..."
                  value={benefitFormName}
                  onChange={e => setBenefitFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Categoria *</label>
                  <select
                    value={benefitFormCategory}
                    onChange={e => setBenefitFormCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium cursor-pointer"
                  >
                    <option value="alimentacao">Alimentação / Refeição</option>
                    <option value="combustivel">Combustível / Ajuda de Custo</option>
                    <option value="saude">Saúde / Odonto</option>
                    <option value="transporte">Vale Transporte</option>
                    <option value="outros">Outros</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Valor Padrão (R$)</label>
                  <input
                    type="text"
                    placeholder="0,00"
                    value={benefitFormDefaultValue}
                    onChange={e => setBenefitFormDefaultValue(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Descrição / Regras</label>
                <textarea
                  rows={2}
                  value={benefitFormDesc}
                  onChange={e => setBenefitFormDesc(e.target.value)}
                  placeholder="Detalhes ou regras de concessão..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsBenefitModalOpen(false)}
                  className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingBenefit}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-2xs"
                >
                  {savingBenefit ? 'Salvando...' : 'Salvar Benefício'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EXCLUSÃO DE BENEFÍCIO */}
      {benefitToDelete && (
        <div className="fixed inset-0 z-[290] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <Trash2 size={22} />
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Excluir Benefício</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Deseja remover o benefício <strong>"{benefitToDelete.name}"</strong> do catálogo da empresa?
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBenefitToDelete(null)}
                className="flex-1 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingBenefit}
                onClick={handleConfirmDeleteBenefit}
                className="flex-1 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-2xs flex items-center justify-center gap-1 cursor-pointer"
              >
                {deletingBenefit ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                <span>Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CRIAR/EDITAR SETOR */}
      {isDeptModalOpen && (
        <div className="fixed inset-0 z-[280] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b">
              <h4 className="font-bold text-slate-900 text-sm">
                {editingDeptId ? 'Editar Setor' : 'Novo Setor'}
              </h4>
              <button onClick={() => setIsDeptModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveDepartment} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome do Setor *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Ex: Engenharia & Obras, Comercial..."
                  value={deptFormName}
                  onChange={e => setDeptFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Cor</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={deptFormColor}
                    onChange={e => setDeptFormColor(e.target.value)}
                    className="h-8 w-10 p-0 border rounded cursor-pointer"
                  />
                  <span className="font-mono text-slate-500">{deptFormColor}</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Gerente do Setor (Opcional)</label>
                <select
                  value={deptFormManagerId}
                  onChange={e => setDeptFormManagerId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Selecione o gerente...</option>
                  {companyProfiles.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Descrição</label>
                <textarea
                  rows={2}
                  value={deptFormDesc}
                  onChange={e => setDeptFormDesc(e.target.value)}
                  placeholder="Atribuições deste departamento..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsDeptModalOpen(false)}
                  className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingDept}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-2xs"
                >
                  {savingDept ? 'Salvando...' : 'Salvar Setor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CRIAR/EDITAR CARGO COM JORNADA SEMANAL */}
      {isJobModalOpen && (
        <div className="fixed inset-0 z-[280] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b">
              <h4 className="font-bold text-slate-900 text-sm">
                {editingJobId ? 'Editar Cargo' : 'Novo Cargo'}
              </h4>
              <button onClick={() => setIsJobModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveJobPosition} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Título do Cargo *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Ex: Eletricista Montador, Encarregado..."
                  value={jobFormTitle}
                  onChange={e => setJobFormTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Setor / Departamento</label>
                  <select
                    value={jobFormDeptId}
                    onChange={e => setJobFormDeptId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Selecione o setor...</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Código CBO (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ex: 7156-15"
                    value={jobFormCbo}
                    onChange={e => setJobFormCbo(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jornada Semanal *</label>
                  <select
                    value={jobFormWeeklyHours}
                    onChange={e => setJobFormWeeklyHours(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium cursor-pointer"
                  >
                    <option value="44">44h semanais (Obra/Campo)</option>
                    <option value="40">40h semanais (Escritório)</option>
                    <option value="36">36h semanais (Turno)</option>
                    <option value="30">30h semanais (Estágio/6h)</option>
                    <option value="20">20h semanais (Meio Período)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Regime de Contratação *</label>
                  <select
                    value={jobFormContractType}
                    onChange={e => setJobFormContractType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  >
                    <option value="clt">CLT (Carteira Assinada)</option>
                    <option value="pj">PJ (Prestador de Serviço)</option>
                    <option value="diarista">Diarista / Por Diária</option>
                    <option value="estagio">Estágio</option>
                    <option value="temporario">Temporário</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tipo de Salário</label>
                  <select
                    value={jobFormSalaryType}
                    onChange={e => setJobFormSalaryType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  >
                    <option value="mensal">Mensal (Salário Fixo)</option>
                    <option value="diaria">Por Diária</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Piso Salarial Base (R$)</label>
                  <input
                    type="text"
                    placeholder="0,00"
                    value={jobFormBaseSalary}
                    onChange={e => setJobFormBaseSalary(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Descrição das Atribuições</label>
                <textarea
                  rows={2}
                  value={jobFormDesc}
                  onChange={e => setJobFormDesc(e.target.value)}
                  placeholder="Principais responsabilidades deste cargo..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsJobModalOpen(false)}
                  className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingJob}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-2xs"
                >
                  {savingJob ? 'Salvando...' : 'Salvar Cargo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: HISTÓRICO SALARIAL DO CARGO */}
      {historyJob && (
        <div className="fixed inset-0 z-[280] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b shrink-0">
              <div>
                <h4 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                  <TrendingUp size={16} className="text-emerald-600" />
                  <span>Histórico Salarial: {historyJob.title}</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Piso atual: <strong className="text-slate-800">{formatCurrency(historyJob.base_salary)} ({historyJob.salary_type})</strong> • <span className="uppercase font-bold">{historyJob.contract_type}</span> • {historyJob.weekly_hours}h/sem ({historyJob.monthly_work_hours}h/mês)
                </p>
              </div>
              <button onClick={() => setHistoryJob(null)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            {!isAdjustSalaryOpen ? (
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border shrink-0">
                <span className="text-xs text-slate-600 font-medium">Deseja aplicar um reajuste de piso ou dissídio?</span>
                <button
                  type="button"
                  onClick={() => setIsAdjustSalaryOpen(true)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-2xs cursor-pointer"
                >
                  + Aplicar Reajuste
                </button>
              </div>
            ) : (
              <form onSubmit={handleApplySalaryAdjustment} className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-2xl space-y-3 shrink-0 text-xs">
                <span className="font-bold text-emerald-950 block text-[11px] uppercase tracking-wider">
                  Novo Reajuste Salarial
                </span>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Novo Salário Base (R$) *</label>
                    <input
                      type="text"
                      required
                      value={adjustNewSalary}
                      onChange={e => setAdjustNewSalary(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Data de Vigência *</label>
                    <input
                      type="date"
                      required
                      value={adjustDate}
                      onChange={e => setAdjustDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Motivo do Reajuste *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Dissídio Coletivo 2026, Reestruturação de Piso..."
                    value={adjustReason}
                    onChange={e => setAdjustReason(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl font-medium"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAdjustSalaryOpen(false)}
                    className="px-3 py-1 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingAdjust}
                    className="px-4 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow-2xs cursor-pointer"
                  >
                    {savingAdjust ? 'Salvando...' : 'Confirmar Reajuste'}
                  </button>
                </div>
              </form>
            )}

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Histórico de Alterações Salariais
              </span>

              {loadingHistory ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  <Loader2 size={16} className="animate-spin mx-auto mb-1 text-emerald-600" />
                  Carregando histórico...
                </div>
              ) : salaryHistory.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 italic border border-dashed rounded-xl">
                  Nenhum reajuste histórico registrado ainda para este cargo.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {salaryHistory.map(hist => (
                    <div key={hist.id} className="p-3 bg-white hover:bg-slate-50 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <strong className="block text-slate-900 font-bold">{hist.reason}</strong>
                        <span className="text-[10px] text-slate-400">
                          Vigência: {new Date(hist.effective_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 line-through block">
                          {formatCurrency(hist.previous_salary)}
                        </span>
                        <strong className="text-emerald-700 font-extrabold text-xs block">
                          {formatCurrency(hist.new_salary)}
                        </strong>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EXCLUSÃO DE SETOR */}
      {deptToDelete && (
        <div className="fixed inset-0 z-[290] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <Trash2 size={22} />
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Excluir Setor</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Deseja realmente remover o setor <strong>"{deptToDelete.name}"</strong>?
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeptToDelete(null)}
                className="flex-1 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingDept}
                onClick={handleConfirmDeleteDept}
                className="flex-1 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-2xs flex items-center justify-center gap-1 cursor-pointer"
              >
                {deletingDept ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                <span>Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EXCLUSÃO DE CARGO */}
      {jobToDelete && (
        <div className="fixed inset-0 z-[290] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <Trash2 size={22} />
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Excluir Cargo</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Deseja excluir o cargo <strong>"{jobToDelete.title}"</strong>?
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setJobToDelete(null)}
                className="flex-1 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingJob}
                onClick={handleConfirmDeleteJob}
                className="flex-1 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-2xs flex items-center justify-center gap-1 cursor-pointer"
              >
                {deletingJob ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                <span>Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VISUALIZAR / EDITAR NÍVEL DE ACESSO */}
      {isRoleModalOpen && (
        <div className="fixed inset-0 z-[280] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 max-w-2xl w-full shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b mb-4 shrink-0">
              <div>
                <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                  {editingRoleId && roles.find(r => r.id === editingRoleId)?.is_system
                    ? 'Visualizar Permissões (Administrador)'
                    : isEditMode
                    ? (editingRoleId ? 'Editar Nível de Acesso' : 'Criar Novo Nível de Acesso')
                    : `Visualizar Permissões: ${roleFormName}`}
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {editingRoleId && roles.find(r => r.id === editingRoleId)?.is_system
                    ? 'Perfil do sistema possui permissão total irrevogável.'
                    : 'Configure as permissões atribuídas a este nível.'}
                </p>
              </div>
              <button onClick={() => { setIsRoleModalOpen(false); setIsEditMode(false); }} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="flex flex-col flex-1 min-h-0">
              <div className="overflow-y-auto pr-1 space-y-4 flex-1 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Nome do Nível *</label>
                    <input
                      type="text"
                      required
                      disabled={!isEditMode || (!!editingRoleId && !!roles.find(r => r.id === editingRoleId)?.is_system)}
                      value={roleFormName}
                      onChange={(e) => setRoleFormName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 disabled:opacity-75 disabled:bg-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Descrição</label>
                    <input
                      type="text"
                      disabled={!isEditMode || (!!editingRoleId && !!roles.find(r => r.id === editingRoleId)?.is_system)}
                      value={roleFormDescription}
                      onChange={(e) => setRoleFormDescription(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 disabled:opacity-75 disabled:bg-slate-100"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <span className="font-bold text-slate-700 uppercase tracking-wider block mb-2 text-[10px]">
                    Permissões por Módulo
                  </span>

                  <div className="space-y-3">
                    {CATEGORIES.map(category => {
                      const categoryPerms = AVAILABLE_PERMISSIONS.filter(p => p.category === category);
                      const allCatChecked = categoryPerms.every(p => roleFormPermissions.includes(p.id));

                      return (
                        <div key={category} className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/40">
                          <div className="px-3 py-2 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
                            <span className="font-bold text-slate-800">{category}</span>
                            {isEditMode && (!editingRoleId || !roles.find(r => r.id === editingRoleId)?.is_system) && (
                              <button
                                type="button"
                                onClick={() => handleToggleCategory(category)}
                                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                              >
                                {allCatChecked ? 'Desmarcar todos' : 'Marcar todos'}
                              </button>
                            )}
                          </div>

                          <div className="p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {categoryPerms.map(perm => {
                              const isChecked = roleFormPermissions.includes(perm.id);
                              const isPrerequisiteMet = !perm.dependsOn || roleFormPermissions.includes(perm.dependsOn);
                              const isDisabled = !isEditMode || 
                                (!!editingRoleId && !!roles.find(r => r.id === editingRoleId)?.is_system) ||
                                (!isPrerequisiteMet && !isChecked);

                              return (
                                <label
                                  key={perm.id}
                                  className={`flex items-start gap-2 p-2 rounded-lg border text-xs select-none transition-colors ${
                                    isChecked
                                      ? 'bg-indigo-50/60 border-indigo-200 text-indigo-950 font-medium'
                                      : !isPrerequisiteMet
                                      ? 'bg-slate-100/50 border-slate-200 text-slate-400 opacity-60'
                                      : 'bg-white border-slate-200 text-slate-600'
                                  } ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-indigo-50/30'}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={isDisabled}
                                    onChange={() => handleToggleFormPermission(perm.id)}
                                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:cursor-not-allowed"
                                  />
                                  <div className="flex flex-col">
                                    <span>{perm.label}</span>
                                    {perm.dependsOn && !isPrerequisiteMet && (
                                      <span className="text-[9px] text-slate-400 font-medium flex items-center gap-0.5 mt-0.5">
                                        <Lock size={9} /> Requer permissão prévia
                                      </span>
                                    )}
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t mt-3 shrink-0">
                <div>
                  {!isEditMode && (!editingRoleId || !roles.find(r => r.id === editingRoleId)?.is_system) && (
                    <button
                      type="button"
                      onClick={() => setIsEditMode(true)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
                    >
                      <Edit2 size={13} className="inline mr-1" />
                      Editar Nível
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setIsRoleModalOpen(false); setIsEditMode(false); }}
                    className="px-4 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Fechar
                  </button>
                  {isEditMode && (!editingRoleId || !roles.find(r => r.id === editingRoleId)?.is_system) && (
                    <button
                      type="submit"
                      disabled={savingRole}
                      className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-2xs"
                    >
                      {savingRole ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EXCLUSÃO DE NÍVEL DE ACESSO */}
      {roleToDelete && (
        <div className="fixed inset-0 z-[290] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <Trash2 size={22} />
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Excluir Nível de Acesso</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Tem certeza que deseja excluir o nível <strong className="text-slate-800">"{roleToDelete.name}"</strong>?
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRoleToDelete(null)}
                className="flex-1 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingRole}
                onClick={handleConfirmDeleteRole}
                className="flex-1 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-2xs flex items-center justify-center gap-1 cursor-pointer"
              >
                {deletingRole ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                <span>Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default OrganizationSettingsModal;