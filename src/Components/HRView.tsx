import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { CreateEmployeeModal } from './CreateEmployeeModal';
import { EmployeeDetailPage } from './EmployeeDetailPage';
import {
  UserPlus,
  Search,
  Filter,
  AlertTriangle,
  ShieldAlert,
  Edit2,
  MoreVertical,
  Key,
  Loader2,
  Sun,
  UserMinus,
  RotateCcw,
  AlertOctagon,
  X,
  Clock,
  ShieldBan,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  Lock,
  CheckCircle2,
  Briefcase
} from 'lucide-react';

export interface Department {
  id: string;
  name: string;
  color?: string | null;
}

export interface JobPosition {
  id: string;
  department_id?: string | null;
  title: string;
  cbo_code?: string | null;
  contract_type?: 'clt' | 'pj' | 'diarista' | 'estagio' | 'temporario';
  salary_type: 'mensal' | 'diaria';
  base_salary: number;
}

export interface EmployeeCertification {
  id: string;
  title: string;
  category: string;
  issued_at: string;
  expires_at?: string | null;
  certificate_url?: string | null;
  notes?: string | null;
}

export interface CompanyRoleItem {
  id: string;
  name: string;
}

export interface EmployeeItem {
  record_id?: string;
  user_id: string;
  membership_id?: string | null;
  full_name: string;
  email?: string | null;
  cpf?: string | null;
  avatar_url?: string | null;
  role_title?: string | null;

  department_id?: string | null;
  department_name?: string | null;
  job_position_id?: string | null;
  job_position_title?: string | null;

  has_system_access: boolean;
  access_role_name?: string | null;
  membership_status?: 'ativo' | 'inativo' | 'pendente' | 'sem_acesso';
  invite_id?: string | null;
  invite_token?: string | null;
  invite_status?: 'pending' | 'accepted' | 'canceled' | null;

  rg?: string | null;
  rg_issuer?: string | null;
  birth_date?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  contract_type: 'clt' | 'pj' | 'diarista' | 'estagio' | 'temporario';
  work_status: 'ativo' | 'ferias' | 'afastado' | 'desligado';
  admission_date?: string | null;
  resignation_date?: string | null;
  base_salary: number;
  salary_type: 'mensal' | 'diaria';
  has_hazard_pay: boolean;
  hazard_pay_percent: number;
  pix_key?: string | null;
  bank_name?: string | null;
  bank_agency?: string | null;
  bank_account?: string | null;
  boot_size?: string | null;
  uniform_shirt_size?: string | null;
  uniform_pants_size?: string | null;
  notes?: string | null;

  certifications: EmployeeCertification[];
}

interface HRViewProps {
  permissions?: any;
  triggerCreateEmployee?: boolean;
  onResetTrigger?: () => void;
}

const maskCPF = (val: string | null | undefined): string => {
  if (!val) return '';
  const digits = val.replace(/\D/g, '').slice(0, 11);
  if (digits.length !== 11) return val;
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

const getInitials = (name: string) => {
  if (!name) return 'EX';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const formatCurrency = (val: number) => {
  return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const HRView: React.FC<HRViewProps> = ({
  permissions: propPermissions,
  triggerCreateEmployee = false,
  onResetTrigger
}) => {
  const { user } = useAuth();
  const { permissions: hookPermissions, loading: loadingPerms } = usePermissions();
  const permissions = propPermissions || hookPermissions;

  const isMaster = Boolean(permissions?.isOwnerOrAdmin);
  const canViewModule = isMaster || Boolean(permissions?.canViewHR);
  const canManageEmployees = isMaster || Boolean(permissions?.canManageEmployees);
  const canSeeSalaries = isMaster || Boolean(permissions?.canManageSalariesBenefits);
  const canManageAdmissions = isMaster || Boolean(permissions?.canManageAdmissionsLeaves);

  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobPositions, setJobPositions] = useState<JobPosition[]>([]);
  const [companyRoles, setCompanyRoles] = useState<CompanyRoleItem[]>([]);
  const [companyCltChargesRate, setCompanyCltChargesRate] = useState<number>(64.5);

  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeItem | null>(null);
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [employeeToEdit, setEmployeeToEdit] = useState<EmployeeItem | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [jobPositionFilter, setJobPositionFilter] = useState('all');
  const [contractFilter, setContractFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [accessFilter, setAccessFilter] = useState('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterContainerRef = useRef<HTMLDivElement>(null);

  // Menu Dropdown flutuante
  const [dropdownMenu, setDropdownMenu] = useState<{
    employee: EmployeeItem;
    top: number;
    left: number;
  } | null>(null);

  // Modal: Conceder Acesso
  const [accessModalEmp, setAccessModalEmp] = useState<EmployeeItem | null>(null);
  const [accessEmailInput, setAccessEmailInput] = useState('');
  const [accessRoleInput, setAccessRoleInput] = useState('');
  const [savingAccess, setSavingAccess] = useState(false);
  const [cancelingInvite, setCancelingInvite] = useState(false);
  const [copiedLinkToken, setCopiedLinkToken] = useState<string | null>(null);
  const [accessSuccessMessage, setAccessSuccessMessage] = useState<string | null>(null);

  // Modal: Confirmação de Ações
  const [actionConfirm, setActionConfirm] = useState<{
    type: 'ferias' | 'afastar' | 'reativar' | 'desligar' | 'remover_acesso';
    employee: EmployeeItem;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Gatilho de abertura via FAB Mobile do App.tsx
  useEffect(() => {
    if (triggerCreateEmployee) {
      setEmployeeToEdit(null);
      setIsEmployeeModalOpen(true);
      if (onResetTrigger) onResetTrigger();
    }
  }, [triggerCreateEmployee, onResetTrigger]);

  useEffect(() => {
    function handleScrollOrClickOutside(e: MouseEvent) {
      if (filterContainerRef.current && !filterContainerRef.current.contains(e.target as Node)) {
        setIsFilterOpen(false);
      }
      setDropdownMenu(null);
    }
    window.addEventListener('click', handleScrollOrClickOutside);
    window.addEventListener('scroll', handleScrollOrClickOutside, true);
    return () => {
      window.removeEventListener('click', handleScrollOrClickOutside);
      window.removeEventListener('scroll', handleScrollOrClickOutside, true);
    };
  }, []);

  const loadHRData = useCallback(async () => {
    const companyId = user?.company?.id;
    if (!companyId) return;

    try {
      setLoading(true);

      const [profilesRes, membershipsRes, deptsRes, jobsRes, recordsRes, certsRes, invitesRes, rolesRes, companyRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, email, cpf, role_title, avatar_url, access_role, is_active, company_id')
          .eq('company_id', companyId),

        supabase
          .from('memberships')
          .select(`
            id,
            profile_id,
            status,
            role,
            department_id,
            job_position_id,
            department:company_departments!department_id ( id, name ),
            job_position:company_job_positions!job_position_id ( id, title, contract_type )
          `)
          .eq('company_id', companyId),

        supabase
          .from('company_departments')
          .select('id, name, color')
          .eq('company_id', companyId)
          .order('name', { ascending: true }),

        supabase
          .from('company_job_positions')
          .select('id, department_id, title, cbo_code, contract_type, salary_type, base_salary, weekly_hours, monthly_work_hours')
          .eq('company_id', companyId)
          .order('title', { ascending: true }),

        supabase
          .from('employee_records')
          .select('*')
          .eq('company_id', companyId),

        supabase
          .from('employee_certifications')
          .select('*')
          .eq('company_id', companyId),

        supabase
          .from('company_invites')
          .select('*')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false }),

        supabase
          .from('company_roles')
          .select('id, name')
          .eq('company_id', companyId)
          .order('name', { ascending: true }),

        supabase
          .from('companies')
          .select('clt_charges_rate_percent')
          .eq('id', companyId)
          .maybeSingle()
      ]);

      if (companyRes.data?.clt_charges_rate_percent !== undefined && companyRes.data?.clt_charges_rate_percent !== null) {
        setCompanyCltChargesRate(Number(companyRes.data.clt_charges_rate_percent) || 64.5);
      }

      const loadedDepts: Department[] = deptsRes.data || [];
      const loadedJobs: JobPosition[] = (jobsRes.data || []).map((j: any) => ({
        ...j,
        contract_type: j.contract_type || 'clt',
        base_salary: Number(j.base_salary) || 0
      }));
      const loadedRoles: CompanyRoleItem[] = rolesRes.data || [];

      setDepartments(loadedDepts);
      setJobPositions(loadedJobs);
      setCompanyRoles(loadedRoles);

      const membershipsMap = new Map<string, any>();
      (membershipsRes.data || []).forEach(m => membershipsMap.set(m.profile_id, m));

      const recordsMap = new Map<string, any>();
      (recordsRes.data || []).forEach(r => recordsMap.set(r.user_id, r));

      const certsByRecordMap = new Map<string, EmployeeCertification[]>();
      (certsRes.data || []).forEach((c: any) => {
        const arr = certsByRecordMap.get(c.employee_record_id) || [];
        arr.push(c);
        certsByRecordMap.set(c.employee_record_id, arr);
      });

      const invitesByEmailMap = new Map<string, any>();
      (invitesRes.data || []).forEach((inv: any) => {
        if (inv.email) {
          const key = inv.email.toLowerCase().trim();
          if (!invitesByEmailMap.has(key) || inv.status === 'pending') {
            invitesByEmailMap.set(key, inv);
          }
        }
      });

      const list: EmployeeItem[] = [];

      (profilesRes.data || []).forEach((prof: any) => {
        const membership = membershipsMap.get(prof.id);
        const rec = recordsMap.get(prof.id);
        const certs = rec ? (certsByRecordMap.get(rec.id) || []) : [];
        const invite = prof.email ? invitesByEmailMap.get(prof.email.toLowerCase().trim()) : null;

        const deptId = rec?.department_id || membership?.department_id || null;
        const jobId = rec?.job_position_id || membership?.job_position_id || null;

        const deptObj = loadedDepts.find(d => d.id === deptId);
        const jobObj = loadedJobs.find(j => j.id === jobId);

        let resolvedWorkStatus: 'ativo' | 'ferias' | 'afastado' | 'desligado' = 'ativo';
        if (rec?.work_status) {
          resolvedWorkStatus = rec.work_status;
        } else if (prof.is_active === false) {
          resolvedWorkStatus = 'desligado';
        }

        const isDismissed = resolvedWorkStatus === 'desligado';
        const isMembershipActive = membership && membership.status === 'ativo' && !isDismissed;
        const hasAccess = Boolean(isMembershipActive && rec?.has_system_access !== false && prof.is_active !== false);

        const matchedRoleObj = loadedRoles.find(r => r.id === prof.access_role);
        const roleLabel = matchedRoleObj?.name || prof.access_role || (membership?.role === 'admin' ? 'Administrador' : null);

        list.push({
          record_id: rec?.id,
          user_id: prof.id,
          membership_id: membership?.id || null,
          full_name: prof.full_name || 'Sem nome',
          email: prof.email || null,
          cpf: prof.cpf || null,
          avatar_url: prof.avatar_url || null,
          role_title: jobObj?.title || prof.role_title || 'Colaborador',

          department_id: deptId,
          department_name: deptObj?.name || null,
          job_position_id: jobId,
          job_position_title: jobObj?.title || null,

          has_system_access: hasAccess,
          access_role_name: roleLabel,
          membership_status: isDismissed ? 'inativo' : (membership?.status || (invite?.status === 'pending' ? 'pendente' : 'sem_acesso')),
          invite_id: invite?.id || null,
          invite_token: invite?.status === 'pending' ? invite.token : null,
          invite_status: invite?.status || null,

          rg: rec?.rg || null,
          rg_issuer: rec?.rg_issuer || null,
          birth_date: rec?.birth_date || null,
          emergency_contact_name: rec?.emergency_contact_name || null,
          emergency_contact_phone: rec?.emergency_contact_phone || null,
          contract_type: rec?.contract_type || jobObj?.contract_type || 'clt',
          work_status: resolvedWorkStatus,
          admission_date: rec?.admission_date || null,
          resignation_date: rec?.resignation_date || null,
          base_salary: Number(rec?.base_salary) || (jobObj ? jobObj.base_salary : 0),
          salary_type: rec?.salary_type || (jobObj ? jobObj.salary_type : 'mensal'),
          has_hazard_pay: Boolean(rec?.has_hazard_pay),
          hazard_pay_percent: Number(rec?.hazard_pay_percent) || 30,
          pix_key: rec?.pix_key || null,
          bank_name: rec?.bank_name || null,
          bank_agency: rec?.bank_agency || null,
          bank_account: rec?.bank_account || null,
          boot_size: rec?.boot_size || null,
          uniform_shirt_size: rec?.uniform_shirt_size || null,
          uniform_pants_size: rec?.uniform_pants_size || null,
          notes: rec?.notes || null,

          certifications: certs
        });
      });

      setEmployees(list);

      setSelectedEmployee(prev => {
        if (!prev) return null;
        return list.find(e => e.user_id === prev.user_id) || prev;
      });

      setAccessModalEmp(prev => {
        if (!prev) return null;
        return list.find(e => e.user_id === prev.user_id) || prev;
      });
    } catch (err) {
      console.error('Erro ao carregar colaboradores de RH:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.company?.id]);

  useEffect(() => {
    if (canViewModule) {
      loadHRData();
    }
  }, [loadHRData, canViewModule]);

  const filteredEmployees = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    const qDigits = searchTerm.replace(/\D/g, '');

    return employees.filter(e => {
      const empCpfDigits = (e.cpf || '').replace(/\D/g, '');
      const matchesSearch =
        q === '' ||
        e.full_name.toLowerCase().includes(q) ||
        (e.role_title && e.role_title.toLowerCase().includes(q)) ||
        (e.email && e.email.toLowerCase().includes(q)) ||
        (qDigits && empCpfDigits.includes(qDigits)) ||
        (e.cpf && e.cpf.includes(q));

      const matchesDept = departmentFilter === 'all' || e.department_id === departmentFilter;
      const matchesJob = jobPositionFilter === 'all' || e.job_position_id === jobPositionFilter;
      const matchesContract = contractFilter === 'all' || e.contract_type === contractFilter;
      const matchesStatus = statusFilter === 'all' || e.work_status === statusFilter;

      let matchesAccess = true;
      if (accessFilter === 'com_login') matchesAccess = e.has_system_access;
      else if (accessFilter === 'apenas_campo') matchesAccess = !e.has_system_access && !e.invite_token;
      else if (accessFilter === 'pendente') matchesAccess = Boolean(e.invite_token && e.invite_status === 'pending');

      return matchesSearch && matchesDept && matchesJob && matchesContract && matchesStatus && matchesAccess;
    });
  }, [employees, searchTerm, departmentFilter, jobPositionFilter, contractFilter, statusFilter, accessFilter]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (departmentFilter !== 'all') count++;
    if (jobPositionFilter !== 'all') count++;
    if (contractFilter !== 'all') count++;
    if (statusFilter !== 'all') count++;
    if (accessFilter !== 'all') count++;
    return count;
  }, [departmentFilter, jobPositionFilter, contractFilter, statusFilter, accessFilter]);

  const clearFilters = () => {
    setDepartmentFilter('all');
    setJobPositionFilter('all');
    setContractFilter('all');
    setStatusFilter('all');
    setAccessFilter('all');
  };

  const dynamicMetrics = useMemo(() => {
    const list = filteredEmployees;
    const total = list.length;
    const active = list.filter(e => e.work_status === 'ativo').length;
    const dismissed = list.filter(e => e.work_status === 'desligado').length;
    const activeMembers = list.filter(e => e.work_status !== 'desligado');

    let totalBaseSalary = 0;
    let totalCostEstimated = 0;

    activeMembers.forEach(e => {
      let base = Number(e.base_salary) || 0;
      if (e.salary_type === 'diaria') base = base * 22;

      const hazardPay = e.has_hazard_pay ? (base * (Number(e.hazard_pay_percent) || 30)) / 100 : 0;
      const totalColabBase = base + hazardPay;

      totalBaseSalary += totalColabBase;

      if (e.contract_type === 'clt') {
        const charges = (totalColabBase * (companyCltChargesRate || 64.5)) / 100;
        totalCostEstimated += totalColabBase + charges;
      } else {
        totalCostEstimated += totalColabBase;
      }
    });

    const nowStr = new Date().toISOString().split('T')[0];
    const in30Days = new Date();
    in30Days.setDate(new Date().getDate() + 30);
    const in30DaysStr = in30Days.toISOString().split('T')[0];

    let expiredCertsCount = 0;
    let expiringSoonCertsCount = 0;

    list.forEach(e => {
      if (e.work_status === 'desligado') return;
      e.certifications.forEach(c => {
        if (!c.expires_at) return;
        if (c.expires_at < nowStr) expiredCertsCount++;
        else if (c.expires_at <= in30DaysStr) expiringSoonCertsCount++;
      });
    });

    return {
      total,
      active,
      dismissed,
      totalBaseSalary,
      totalCostEstimated,
      expiredCertsCount,
      expiringSoonCertsCount
    };
  }, [filteredEmployees, companyCltChargesRate]);

  const getEmployeeCertificationStatus = (emp: EmployeeItem) => {
    if (emp.work_status === 'desligado' || !emp.certifications || emp.certifications.length === 0) {
      return null;
    }
    const nowStr = new Date().toISOString().split('T')[0];
    const in30Days = new Date();
    in30Days.setDate(new Date().getDate() + 30);
    const in30DaysStr = in30Days.toISOString().split('T')[0];

    let hasExpired = false;
    let hasExpiringSoon = false;

    emp.certifications.forEach(c => {
      if (!c.expires_at) return;
      if (c.expires_at < nowStr) hasExpired = true;
      else if (c.expires_at <= in30DaysStr) hasExpiringSoon = true;
    });

    if (hasExpired) return 'expired';
    if (hasExpiringSoon) return 'expiring_soon';
    return null;
  };

  const handleOpenNewEmployee = () => {
    if (!canManageEmployees) return;
    setEmployeeToEdit(null);
    setIsEmployeeModalOpen(true);
  };

  const handleOpenEditEmployee = (emp: EmployeeItem) => {
    setEmployeeToEdit(emp);
    setIsEmployeeModalOpen(true);
  };

  const handleOpenDropdown = (e: React.MouseEvent<HTMLButtonElement>, emp: EmployeeItem) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 208;
    const menuHeight = 230;

    let left = rect.right - menuWidth;
    let top = rect.bottom + 6;

    if (top + menuHeight > window.innerHeight) {
      top = rect.top - menuHeight - 6;
    }

    setDropdownMenu({
      employee: emp,
      top,
      left
    });
  };

  const handleOpenAccessModal = (emp: EmployeeItem) => {
    setDropdownMenu(null);
    setAccessSuccessMessage(null);
    setAccessModalEmp(emp);
    setAccessEmailInput(emp.email || '');
    setAccessRoleInput(companyRoles[0]?.id || '');
  };

  const handleSaveAccessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessModalEmp || !user?.company?.id || !accessEmailInput.trim() || !canManageEmployees) return;

    try {
      setSavingAccess(true);
      setAccessSuccessMessage(null);
      const companyId = user.company.id;
      const cleanEmail = accessEmailInput.trim().toLowerCase();

      const newToken = Array.from(crypto.getRandomValues(new Uint8Array(24)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      await supabase
        .from('profiles')
        .update({
          email: cleanEmail,
          access_role: accessRoleInput || null,
          role_title: accessModalEmp.role_title || 'Colaborador',
          is_active: true
        })
        .eq('id', accessModalEmp.user_id);

      const { data: existingRec } = await supabase
        .from('employee_records')
        .select('id')
        .eq('user_id', accessModalEmp.user_id)
        .eq('company_id', companyId)
        .maybeSingle();

      if (existingRec) {
        await supabase
          .from('employee_records')
          .update({
            has_system_access: true,
            work_status: accessModalEmp.work_status === 'desligado' ? 'ativo' : accessModalEmp.work_status,
            resignation_date: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingRec.id);
      } else {
        await supabase
          .from('employee_records')
          .insert({
            company_id: companyId,
            user_id: accessModalEmp.user_id,
            has_system_access: true,
            work_status: 'ativo',
            updated_at: new Date().toISOString()
          });
      }

      const { data: existingMember } = await supabase
        .from('memberships')
        .select('id')
        .eq('profile_id', accessModalEmp.user_id)
        .eq('company_id', companyId)
        .maybeSingle();

      if (existingMember) {
        await supabase
          .from('memberships')
          .update({
            status: 'ativo',
            updated_at: new Date().toISOString()
          })
          .eq('id', existingMember.id);
      }

      const { data: existingInvite } = await supabase
        .from('company_invites')
        .select('id')
        .eq('company_id', companyId)
        .eq('email', cleanEmail)
        .maybeSingle();

      let activeToken = newToken;
      let activeInviteId = existingInvite?.id;

      if (existingInvite) {
        const { data: updatedInvite, error: updateErr } = await supabase
          .from('company_invites')
          .update({
            token: newToken,
            role_id: accessRoleInput || null,
            role_title: accessModalEmp.role_title || 'Colaborador',
            full_name: accessModalEmp.full_name,
            status: 'pending',
            invited_by: user.id,
            created_at: new Date().toISOString()
          })
          .eq('id', existingInvite.id)
          .select()
          .single();

        if (updateErr) throw updateErr;
        if (updatedInvite) {
          activeToken = updatedInvite.token;
          activeInviteId = updatedInvite.id;
        }
      } else {
        const { data: newInvite, error: invErr } = await supabase
          .from('company_invites')
          .insert({
            company_id: companyId,
            email: cleanEmail,
            full_name: accessModalEmp.full_name,
            role_title: accessModalEmp.role_title || 'Colaborador',
            role_id: accessRoleInput || null,
            token: newToken,
            status: 'pending',
            invited_by: user.id
          })
          .select()
          .single();

        if (invErr) throw invErr;
        if (newInvite) {
          activeToken = newInvite.token;
          activeInviteId = newInvite.id;
        }
      }

      setAccessModalEmp(prev => prev ? {
        ...prev,
        email: cleanEmail,
        has_system_access: true,
        work_status: 'ativo',
        invite_id: activeInviteId,
        invite_token: activeToken,
        invite_status: 'pending'
      } : null);

      setAccessSuccessMessage('Novo convite gerado com sucesso! Copie o link abaixo para enviar ao colaborador.');
      await loadHRData();
    } catch (err: any) {
      alert('Erro ao conceder acesso: ' + err.message);
    } finally {
      setSavingAccess(false);
    }
  };

  const handleCancelInviteFromModal = async () => {
    if (!accessModalEmp || !user?.company?.id || !canManageEmployees) return;
    try {
      setCancelingInvite(true);
      const companyId = user.company.id;
      const targetEmail = accessModalEmp.email ? accessModalEmp.email.toLowerCase().trim() : '';

      if (accessModalEmp.invite_id) {
        await supabase.from('company_invites').delete().eq('id', accessModalEmp.invite_id);
      } else if (targetEmail) {
        await supabase.from('company_invites').delete().eq('company_id', companyId).eq('email', targetEmail);
      }

      await supabase
        .from('employee_records')
        .update({ has_system_access: false, updated_at: new Date().toISOString() })
        .eq('user_id', accessModalEmp.user_id)
        .eq('company_id', companyId);

      await supabase
        .from('memberships')
        .update({ status: 'inativo' })
        .eq('profile_id', accessModalEmp.user_id)
        .eq('company_id', companyId);

      setAccessModalEmp(prev => prev ? {
        ...prev,
        has_system_access: false,
        invite_id: null,
        invite_token: null,
        invite_status: null
      } : null);

      setAccessSuccessMessage(null);
      await loadHRData();
    } catch (err: any) {
      alert('Erro ao cancelar convite: ' + err.message);
    } finally {
      setCancelingInvite(false);
    }
  };

  const handleCopyInviteLink = (token?: string | null) => {
    if (!token) return;
    const inviteUrl = `${window.location.origin}/invite?token=${token}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLinkToken(token);
    setTimeout(() => setCopiedLinkToken(null), 2500);
  };

  const handleConfirmAction = async () => {
    if (!actionConfirm || !user?.company?.id) return;
    try {
      setActionLoading(true);
      const { type, employee } = actionConfirm;
      const companyId = user.company.id;

      if (type === 'remover_acesso') {
        if (!canManageEmployees) return;
        await supabase
          .from('employee_records')
          .update({ has_system_access: false, updated_at: new Date().toISOString() })
          .eq('user_id', employee.user_id)
          .eq('company_id', companyId);

        await supabase
          .from('memberships')
          .update({ status: 'inativo' })
          .eq('profile_id', employee.user_id)
          .eq('company_id', companyId);

        if (employee.invite_id) {
          await supabase.from('company_invites').delete().eq('id', employee.invite_id);
        }
      } else {
        if (!canManageAdmissions) return;
        let newStatus: 'ativo' | 'ferias' | 'afastado' | 'desligado' = 'ativo';
        let resignationDate: string | null = null;

        if (type === 'ferias') newStatus = 'ferias';
        else if (type === 'afastar') newStatus = 'afastado';
        else if (type === 'desligar') {
          newStatus = 'desligado';
          resignationDate = new Date().toISOString().split('T')[0];
        }

        await supabase
          .from('employee_records')
          .update({
            work_status: newStatus,
            has_system_access: type === 'desligar' ? false : employee.has_system_access,
            resignation_date: resignationDate,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', employee.user_id)
          .eq('company_id', companyId);

        if (type === 'desligar') {
          await supabase
            .from('memberships')
            .update({ status: 'inativo' })
            .eq('profile_id', employee.user_id)
            .eq('company_id', companyId);

          await supabase
            .from('profiles')
            .update({ is_active: false })
            .eq('id', employee.user_id);
        }

        if (type === 'reativar') {
          await supabase
            .from('profiles')
            .update({ is_active: true })
            .eq('id', employee.user_id);
        }
      }

      setActionConfirm(null);
      await loadHRData();
    } catch (err: any) {
      alert('Erro ao executar ação: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const renderFilterFields = () => (
    <>
      <div>
        <label className="block font-semibold text-slate-700 mb-1">Setor / Departamento</label>
        <select
          value={departmentFilter}
          onChange={e => {
            setDepartmentFilter(e.target.value);
            setJobPositionFilter('all');
          }}
          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500 cursor-pointer text-xs"
        >
          <option value="all">Todos os Setores</option>
          {departments.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block font-semibold text-slate-700 mb-1">Cargo / Função</label>
        <select
          value={jobPositionFilter}
          onChange={e => setJobPositionFilter(e.target.value)}
          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500 cursor-pointer text-xs"
        >
          <option value="all">Todos os Cargos</option>
          {jobPositions
            .filter(j => departmentFilter === 'all' || j.department_id === departmentFilter)
            .map(j => (
              <option key={j.id} value={j.id}>{j.title}</option>
            ))}
        </select>
      </div>

      <div>
        <label className="block font-semibold text-slate-700 mb-1">Situação Cadastral</label>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500 cursor-pointer text-xs"
        >
          <option value="all">Todas as Situações</option>
          <option value="ativo">Ativos</option>
          <option value="ferias">Em Férias</option>
          <option value="afastado">Afastados</option>
          <option value="desligado">Desligados</option>
        </select>
      </div>

      <div>
        <label className="block font-semibold text-slate-700 mb-1">Nível de Acesso</label>
        <select
          value={accessFilter}
          onChange={e => setAccessFilter(e.target.value)}
          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500 cursor-pointer text-xs"
        >
          <option value="all">Todos os Acessos</option>
          <option value="com_login">Com Login</option>
          <option value="pendente">Convite Pendente</option>
          <option value="apenas_campo">Apenas Campo</option>
        </select>
      </div>
    </>
  );

  if (!loadingPerms && !canViewModule) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3 border border-slate-200">
          <Lock size={26} />
        </div>
        <h3 className="text-base font-bold text-slate-800">Acesso Restrito ao RH</h3>
        <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
          Seu perfil de acesso não possui permissão para visualizar o painel de RH e colaboradores.
        </p>
      </div>
    );
  }

  // Visualização de Detalhes em Tela Cheia
  if (selectedEmployee) {
    return (
      <>
        <EmployeeDetailPage
          employee={selectedEmployee}
          departments={departments}
          jobPositions={jobPositions}
          onBack={() => setSelectedEmployee(null)}
          onEdit={() => handleOpenEditEmployee(selectedEmployee)}
          onOpenAccessModal={() => handleOpenAccessModal(selectedEmployee)}
          onReload={loadHRData}
        />

        {/* Modal de Edição */}
        {isEmployeeModalOpen && (
          <CreateEmployeeModal
            isOpen={isEmployeeModalOpen}
            onClose={() => {
              setIsEmployeeModalOpen(false);
              setEmployeeToEdit(null);
            }}
            departments={departments}
            jobPositions={jobPositions}
            employeeToEdit={employeeToEdit}
            onSuccess={loadHRData}
          />
        )}

        {/* POPUP DE ACESSO */}
        {accessModalEmp && createPortal(
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
                    <Key size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Acesso ao Sistema Lume</h4>
                    <p className="text-[11px] text-slate-400">{accessModalEmp.full_name}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAccessModalEmp(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {accessSuccessMessage && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-900">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span>{accessSuccessMessage}</span>
                </div>
              )}

              <form onSubmit={handleSaveAccessSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">E-mail Corporativo *</label>
                  <input
                    type="email"
                    required
                    placeholder="colaborador@empresa.com.br"
                    value={accessEmailInput}
                    onChange={e => setAccessEmailInput(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-sky-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Perfil de Permissões *</label>
                  <select
                    required
                    value={accessRoleInput}
                    onChange={e => setAccessRoleInput(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold cursor-pointer text-slate-900"
                  >
                    <option value="">Selecione o nível...</option>
                    {companyRoles.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>

                {accessModalEmp.invite_token && (
                  <div className="p-3.5 bg-sky-50/70 border border-sky-200 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-sky-950 flex items-center gap-1">
                        <Clock size={12} className="text-sky-600" />
                        <span>Link de Convite Ativo</span>
                      </span>
                      <button
                        type="button"
                        disabled={cancelingInvite}
                        onClick={handleCancelInviteFromModal}
                        className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 rounded-xl text-xs font-bold"
                      >
                        {cancelingInvite ? 'Cancelando...' : 'Cancelar Convite'}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={`${window.location.origin}/invite?token=${accessModalEmp.invite_token}`}
                        className="flex-1 px-2.5 py-1.5 bg-white border border-sky-200 rounded-xl font-mono text-[11px]"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopyInviteLink(accessModalEmp.invite_token)}
                        className="px-3.5 py-1.5 bg-sky-600 text-white rounded-xl font-bold text-xs"
                      >
                        {copiedLinkToken === accessModalEmp.invite_token ? 'Copiado!' : 'Copiar'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button type="button" onClick={() => setAccessModalEmp(null)} className="px-3.5 py-1.5 text-slate-600 rounded-xl font-semibold">
                    Fechar
                  </button>
                  <button type="submit" disabled={savingAccess || !accessEmailInput.trim()} className="px-4 py-1.5 bg-sky-600 text-white rounded-xl font-bold">
                    {savingAccess ? 'Salvando...' : 'Salvar e Conceder'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
      </>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 bg-slate-50/50 p-3 sm:p-6 overflow-y-auto space-y-3.5 relative">
      
      {/* 1. CABEÇALHO */}
      <div className="flex items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Gestão de Pessoas
          </h1>
          <p className="hidden sm:block text-xs sm:text-sm text-slate-500 mt-0.5">
            Dossiê completo, alocação funcional, controle de acesso e situação de colaboradores.
          </p>
        </div>

        {canManageEmployees && (
          <button
            type="button"
            onClick={handleOpenNewEmployee}
            className="hidden md:inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer active:scale-98 shrink-0"
          >
            <UserPlus size={15} />
            <span>Cadastrar Colaborador</span>
          </button>
        )}
      </div>

      {/* 2. CARDS DE INDICADORES (OCULTOS NO MOBILE, VISÍVEIS APENAS NO DESKTOP) */}
      <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Quadro Efetivo</span>
          <div className="flex items-baseline gap-1.5">
            <strong className="text-base sm:text-lg font-black text-slate-900">{dynamicMetrics.total}</strong>
            <span className="text-[11px] sm:text-xs font-semibold text-emerald-600">({dynamicMetrics.active} ativos)</span>
          </div>
          <span className="text-[10px] text-slate-400 block truncate">
            {dynamicMetrics.dismissed > 0 ? `${dynamicMetrics.dismissed} desligado(s)` : 'Sem desligamentos'}
          </span>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
            <DollarSign size={12} className="text-sky-600" />
            <span>Folha Base (Salários)</span>
          </span>
          <strong className="text-base sm:text-lg font-black text-slate-900 block truncate">
            {canSeeSalaries ? formatCurrency(dynamicMetrics.totalBaseSalary) : 'R$ ••••••'}
          </strong>
          <span className="text-[10px] text-slate-400 block truncate">
            {canSeeSalaries ? 'Salários base filtrados' : 'Acesso salarial restrito'}
          </span>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
            <TrendingUp size={12} className="text-indigo-600" />
            <span>Custo Total Estimado</span>
          </span>
          <strong className="text-base sm:text-lg font-black text-indigo-700 block truncate">
            {canSeeSalaries ? formatCurrency(dynamicMetrics.totalCostEstimated) : 'R$ ••••••'}
          </strong>
          <span className="text-[10px] text-indigo-500 font-semibold block truncate">
            {canSeeSalaries ? `Folha + Encargos (${companyCltChargesRate}%)` : 'Encargos confidenciais'}
          </span>
        </div>

        <div className={`p-3 rounded-2xl border shadow-2xs space-y-1 transition-colors ${
          dynamicMetrics.expiredCertsCount > 0
            ? 'bg-rose-50/70 border-rose-200 text-rose-900'
            : dynamicMetrics.expiringSoonCertsCount > 0
            ? 'bg-amber-50/70 border-amber-200 text-amber-900'
            : 'bg-white border-slate-200'
        }`}>
          <span className="text-[10px] font-bold uppercase tracking-wider block flex items-center gap-1">
            {dynamicMetrics.expiredCertsCount > 0 ? (
              <AlertTriangle size={12} className="text-rose-600" />
            ) : dynamicMetrics.expiringSoonCertsCount > 0 ? (
              <ShieldAlert size={12} className="text-amber-600" />
            ) : (
              <ShieldCheck size={12} className="text-emerald-600" />
            )}
            <span>Saúde & NRs</span>
          </span>
          <div className="flex items-baseline gap-2">
            <strong className={`text-base sm:text-lg font-black ${
              dynamicMetrics.expiredCertsCount > 0 ? 'text-rose-700' : dynamicMetrics.expiringSoonCertsCount > 0 ? 'text-amber-700' : 'text-emerald-700'
            }`}>
              {dynamicMetrics.expiredCertsCount > 0
                ? `${dynamicMetrics.expiredCertsCount} vencida(s)`
                : dynamicMetrics.expiringSoonCertsCount > 0
                ? `${dynamicMetrics.expiringSoonCertsCount} a vencer`
                : '100% em dia'}
            </strong>
          </div>
          <span className="text-[10px] block opacity-75 truncate">
            {dynamicMetrics.expiringSoonCertsCount > 0 && dynamicMetrics.expiredCertsCount > 0
              ? `+${dynamicMetrics.expiringSoonCertsCount} vencendo em 30d`
              : 'Conformidade operacional'}
          </span>
        </div>
      </div>

      {/* 3. BARRA DE PESQUISA & BOTÃO DE FILTROS UNIFICADO */}
      <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between gap-2.5 shrink-0">
        <div className="relative flex-1 min-w-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, cargo ou CPF..."
            className="w-full pl-9 pr-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-800 placeholder-slate-400"
          />
        </div>

        {/* Botão de Filtros Unificado */}
        <div className="relative shrink-0" ref={filterContainerRef}>
          <button
            type="button"
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
              activeFiltersCount > 0
                ? 'bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="Filtros avançados"
          >
            <Filter size={14} className={activeFiltersCount > 0 ? 'text-sky-600' : 'text-slate-400'} />
            <span>Filtros</span>
            {activeFiltersCount > 0 && (
              <span className="h-4 w-4 rounded-full bg-sky-600 text-white text-[10px] flex items-center justify-center font-bold">
                {activeFiltersCount}
              </span>
            )}
          </button>

          {/* POPOVER DESKTOP */}
          {isFilterOpen && (
            <div className="hidden md:block absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 z-50 animate-in fade-in zoom-in-95 duration-100 space-y-3 text-xs text-left">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Filtros de RH</span>
                <div className="flex items-center gap-2">
                  {activeFiltersCount > 0 && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="text-[11px] text-sky-600 hover:underline font-semibold cursor-pointer"
                    >
                      Limpar
                    </button>
                  )}
                  <button onClick={() => setIsFilterOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                    <X size={15} />
                  </button>
                </div>
              </div>

              {renderFilterFields()}

              <button
                type="button"
                onClick={() => setIsFilterOpen(false)}
                className="w-full py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold cursor-pointer"
              >
                Fechar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ACTION SHEET MOBILE (FILTROS) */}
      {isFilterOpen && (
        <div className="md:hidden fixed inset-0 z-[150] flex flex-col justify-end bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="absolute inset-0" onClick={() => setIsFilterOpen(false)} />
          <div className="relative bg-white rounded-t-3xl p-5 space-y-3.5 animate-in slide-in-from-bottom duration-200 max-h-[85vh] overflow-y-auto border-t border-slate-200 text-xs">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-1" />
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="font-bold text-slate-900 text-sm">Filtros de RH</span>
              <div className="flex items-center gap-2">
                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-xs text-sky-600 hover:underline font-semibold cursor-pointer"
                  >
                    Limpar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {renderFilterFields()}

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsFilterOpen(false)}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs transition"
              >
                Aplicar Filtros
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. FEED DE CARDS NO MOBILE (< md) */}
      <div className="block md:hidden flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-2.5 pb-24">
        {loading ? (
          <div className="p-10 text-center bg-white rounded-2xl border border-slate-200 shadow-2xs text-slate-400 text-xs">
            <Loader2 size={20} className="animate-spin text-sky-600 mx-auto mb-2" />
            Carregando colaboradores...
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-2xs text-slate-400 text-xs italic">
            Nenhum colaborador encontrado com os filtros selecionados.
          </div>
        ) : (
          filteredEmployees.map(emp => {
            const certStatus = getEmployeeCertificationStatus(emp);
            const isInvited = Boolean(emp.invite_token && emp.invite_status === 'pending');

            return (
              <div
                key={emp.user_id}
                onClick={() => setSelectedEmployee(emp)}
                className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs active:bg-slate-50 transition cursor-pointer space-y-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-800 font-bold text-xs flex items-center justify-center overflow-hidden border border-sky-200">
                        {emp.avatar_url ? (
                          <img src={emp.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : getInitials(emp.full_name)}
                      </div>
                      {certStatus === 'expired' && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-600 rounded-full border-2 border-white animate-pulse" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <strong className="text-slate-900 font-bold truncate text-sm block">
                        {emp.full_name}
                      </strong>
                      <span className="block text-[11px] text-slate-400 truncate">
                        {emp.job_position_title || emp.role_title} • {emp.department_name || 'Sem Setor'}
                      </span>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold capitalize shrink-0 ${
                    emp.work_status === 'ativo'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : emp.work_status === 'desligado'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {emp.work_status}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    {emp.has_system_access ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-md">
                        <Key size={10} />
                        <span>{emp.access_role_name || 'Com Login'}</span>
                      </span>
                    ) : isInvited ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                        <Clock size={10} />
                        <span>Convite Pendente</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80">
                        <span>Apenas Campo</span>
                      </span>
                    )}
                  </div>

                  {canSeeSalaries && emp.base_salary > 0 && (
                    <strong className="text-slate-900 font-bold font-mono">
                      {formatCurrency(emp.base_salary)}
                    </strong>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 5. TABELA NO DESKTOP (md: em diante) */}
      <div className="hidden md:block bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden flex-1 min-h-0">
        {loading ? (
          <div className="p-16 text-center text-xs text-slate-400">
            <Loader2 size={20} className="animate-spin mx-auto mb-2 text-sky-600" />
            Carregando quadro de colaboradores...
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 italic">
            Nenhum colaborador encontrado com os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto h-full no-scrollbar">
            <table className="w-full text-left text-xs text-slate-600 min-w-[700px]">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold text-slate-700 uppercase tracking-wider sticky top-0 z-10">
                <tr>
                  <th className="py-3 px-4">Colaborador</th>
                  <th className="py-3 px-4">Cargo / Função</th>
                  <th className="py-3 px-4">Setor</th>
                  <th className="py-3 px-4 text-center">Acesso App</th>
                  {canSeeSalaries && <th className="py-3 px-4">Remuneração Base</th>}
                  <th className="py-3 px-4">Situação</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredEmployees.map(emp => {
                  const isInvited = Boolean(emp.invite_token && emp.invite_status === 'pending');
                  const certStatus = getEmployeeCertificationStatus(emp);

                  return (
                    <tr
                      key={emp.user_id}
                      onClick={() => setSelectedEmployee(emp)}
                      className="hover:bg-slate-50/80 transition cursor-pointer"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="relative shrink-0">
                            <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-800 font-bold text-xs flex items-center justify-center overflow-hidden border border-sky-200">
                              {emp.avatar_url ? (
                                <img src={emp.avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : getInitials(emp.full_name)}
                            </div>
                            {certStatus === 'expired' && (
                              <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-600 rounded-full border-2 border-white animate-pulse" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <strong className="text-slate-900 font-bold truncate text-xs block">
                              {emp.full_name}
                            </strong>
                            <span className="block text-[10px] text-slate-400 truncate">
                              {emp.email || maskCPF(emp.cpf) || 'Sem documento'}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <strong className="block text-slate-800 font-bold truncate">{emp.job_position_title || emp.role_title}</strong>
                        <span className="text-[10px] uppercase font-bold text-slate-400">{emp.contract_type}</span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="text-slate-700 font-semibold">{emp.department_name || 'Sem Setor'}</span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        {emp.has_system_access ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-md">
                            <Key size={10} />
                            <span>{emp.access_role_name || 'Com Login'}</span>
                          </span>
                        ) : isInvited ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                            <Clock size={10} />
                            <span>Convite Pendente</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80">
                            <span>Apenas Campo</span>
                          </span>
                        )}
                      </td>

                      {canSeeSalaries && (
                        <td className="py-3 px-4">
                          <strong className="text-slate-900 font-bold block">
                            {emp.base_salary > 0 ? formatCurrency(emp.base_salary) : '—'}
                          </strong>
                        </td>
                      )}

                      <td className="py-3 px-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold capitalize ${
                          emp.work_status === 'ativo'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : emp.work_status === 'desligado'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {emp.work_status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => handleOpenDropdown(e, emp)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          <MoreVertical size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DROPDOWN MENU */}
      {dropdownMenu && createPortal(
        <div
          style={{ top: `${dropdownMenu.top}px`, left: `${dropdownMenu.left}px` }}
          className="fixed w-52 bg-white border border-slate-200 rounded-2xl shadow-xl py-1.5 z-[9999] text-xs animate-in fade-in zoom-in-95 duration-100 text-left"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              const emp = dropdownMenu.employee;
              setDropdownMenu(null);
              handleOpenEditEmployee(emp);
            }}
            className="w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium cursor-pointer"
          >
            <Edit2 size={13} className="text-sky-600" />
            <span>Editar Informações</span>
          </button>

          {canManageEmployees && (
            <>
              <div className="border-t border-slate-100 my-1" />
              {!dropdownMenu.employee.has_system_access ? (
                <button
                  type="button"
                  onClick={() => handleOpenAccessModal(dropdownMenu.employee)}
                  className="w-full px-3.5 py-2 text-sky-700 hover:bg-sky-50 flex items-center gap-2 font-medium cursor-pointer"
                >
                  <Key size={13} className="text-sky-600" />
                  <span>Conceder Acesso</span>
                </button>
              ) : (
                dropdownMenu.employee.user_id !== user?.id && (
                  <button
                    type="button"
                    onClick={() => {
                      const emp = dropdownMenu.employee;
                      setDropdownMenu(null);
                      setActionConfirm({ type: 'remover_acesso', employee: emp });
                    }}
                    className="w-full px-3.5 py-2 text-amber-700 hover:bg-amber-50 flex items-center gap-2 font-medium cursor-pointer"
                  >
                    <ShieldBan size={13} className="text-amber-600" />
                    <span>Tirar Acesso</span>
                  </button>
                )
              )}
            </>
          )}

          {canManageAdmissions && (
            <>
              <div className="border-t border-slate-100 my-1" />

              {dropdownMenu.employee.work_status === 'ativo' ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const emp = dropdownMenu.employee;
                      setDropdownMenu(null);
                      setActionConfirm({ type: 'ferias', employee: emp });
                    }}
                    className="w-full px-3.5 py-2 text-amber-700 hover:bg-amber-50 flex items-center gap-2 cursor-pointer font-medium"
                  >
                    <Sun size={13} className="text-amber-600" />
                    <span>Dar Férias</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const emp = dropdownMenu.employee;
                      setDropdownMenu(null);
                      setActionConfirm({ type: 'afastar', employee: emp });
                    }}
                    className="w-full px-3.5 py-2 text-purple-700 hover:bg-purple-50 flex items-center gap-2 cursor-pointer font-medium"
                  >
                    <AlertOctagon size={13} className="text-purple-600" />
                    <span>Baixar INSS / Afastar</span>
                  </button>

                  {dropdownMenu.employee.user_id !== user?.id && (
                    <button
                      type="button"
                      onClick={() => {
                        const emp = dropdownMenu.employee;
                        setDropdownMenu(null);
                        setActionConfirm({ type: 'desligar', employee: emp });
                      }}
                      className="w-full px-3.5 py-2 text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer font-medium"
                    >
                      <UserMinus size={13} className="text-rose-600" />
                      <span>Desligar Colaborador</span>
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const emp = dropdownMenu.employee;
                    setDropdownMenu(null);
                    setActionConfirm({ type: 'reativar', employee: emp });
                  }}
                  className="w-full px-3.5 py-2 text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 cursor-pointer font-medium"
                >
                  <RotateCcw size={13} className="text-emerald-600" />
                  <span>Reativar Colaborador</span>
                </button>
              )}
            </>
          )}
        </div>,
        document.body
      )}

      {/* MODAL DE CRIAÇÃO / EDIÇÃO */}
      {isEmployeeModalOpen && (
        <CreateEmployeeModal
          isOpen={isEmployeeModalOpen}
          onClose={() => {
            setIsEmployeeModalOpen(false);
            setEmployeeToEdit(null);
          }}
          departments={departments}
          jobPositions={jobPositions}
          employeeToEdit={employeeToEdit}
          onSuccess={loadHRData}
        />
      )}

      {/* MODAL DE CONFIRMAÇÃO DE AÇÃO */}
      {actionConfirm && (
        <div className="fixed inset-0 z-[360] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-3 animate-in zoom-in-95 duration-150">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto border ${
              actionConfirm.type === 'desligar' 
                ? 'bg-rose-50 text-rose-600 border-rose-100' 
                : actionConfirm.type === 'remover_acesso'
                ? 'bg-amber-50 text-amber-600 border-amber-100'
                : actionConfirm.type === 'ferias'
                ? 'bg-amber-50 text-amber-600 border-amber-100'
                : actionConfirm.type === 'afastar'
                ? 'bg-purple-50 text-purple-600 border-purple-100'
                : 'bg-emerald-50 text-emerald-600 border-emerald-100'
            }`}>
              {actionConfirm.type === 'desligar' ? (
                <UserMinus size={22} />
              ) : actionConfirm.type === 'remover_acesso' ? (
                <ShieldBan size={22} />
              ) : actionConfirm.type === 'ferias' ? (
                <Sun size={22} />
              ) : actionConfirm.type === 'afastar' ? (
                <AlertOctagon size={22} />
              ) : (
                <RotateCcw size={22} />
              )}
            </div>

            <h4 className="font-bold text-slate-900 text-sm">
              {actionConfirm.type === 'desligar' 
                ? 'Confirmar Desligamento' 
                : actionConfirm.type === 'remover_acesso'
                ? 'Revogar Acesso ao Sistema'
                : actionConfirm.type === 'ferias'
                ? 'Registrar Início de Férias'
                : actionConfirm.type === 'afastar'
                ? 'Registrar Afastamento / INSS'
                : 'Reativar Colaborador'}
            </h4>

            <p className="text-xs text-slate-500 leading-relaxed">
              Deseja alterar a situação de <strong className="text-slate-900">"{actionConfirm.employee.full_name}"</strong>?
              {actionConfirm.type === 'desligar' && (
                <span className="block mt-1 text-rose-600 font-semibold text-[11px]">
                  O histórico completo permanece intacto. O colaborador será marcado como desligado e seu login revogado.
                </span>
              )}
              {actionConfirm.type === 'remover_acesso' && (
                <span className="block mt-1 text-amber-600 font-semibold text-[11px]">
                  O colaborador voltará para o status "Apenas Campo" e perderá o login no sistema.
                </span>
              )}
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActionConfirm(null)}
                className="flex-1 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmAction}
                className={`flex-1 py-2 text-xs font-bold text-white rounded-xl shadow-2xs flex items-center justify-center gap-1 cursor-pointer ${
                  actionConfirm.type === 'desligar' 
                    ? 'bg-rose-600 hover:bg-rose-500' 
                    : actionConfirm.type === 'remover_acesso'
                    ? 'bg-amber-600 hover:bg-amber-500'
                    : 'bg-slate-900 hover:bg-slate-800'
                }`}
              >
                {actionLoading ? <Loader2 size={13} className="animate-spin" /> : null}
                <span>Confirmar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP DE ACESSO */}
      {accessModalEmp && createPortal(
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
                  <Key size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Acesso ao Sistema Lume</h4>
                  <p className="text-[11px] text-slate-400">{accessModalEmp.full_name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAccessModalEmp(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {accessSuccessMessage && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-900">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>{accessSuccessMessage}</span>
              </div>
            )}

            <form onSubmit={handleSaveAccessSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">E-mail Corporativo *</label>
                <input
                  type="email"
                  required
                  placeholder="colaborador@empresa.com.br"
                  value={accessEmailInput}
                  onChange={e => setAccessEmailInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-sky-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Perfil de Permissões *</label>
                <select
                  required
                  value={accessRoleInput}
                  onChange={e => setAccessRoleInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold cursor-pointer text-slate-900"
                >
                  <option value="">Selecione o nível...</option>
                  {companyRoles.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              {accessModalEmp.invite_token && (
                <div className="p-3.5 bg-sky-50/70 border border-sky-200 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-sky-950 flex items-center gap-1">
                      <Clock size={12} className="text-sky-600" />
                      <span>Link de Convite Ativo</span>
                    </span>
                    <button
                      type="button"
                      disabled={cancelingInvite}
                      onClick={handleCancelInviteFromModal}
                      className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 rounded-xl text-xs font-bold"
                    >
                      {cancelingInvite ? 'Cancelando...' : 'Cancelar Convite'}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/invite?token=${accessModalEmp.invite_token}`}
                      className="flex-1 px-2.5 py-1.5 bg-white border border-sky-200 rounded-xl font-mono text-[11px]"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyInviteLink(accessModalEmp.invite_token)}
                      className="px-3.5 py-1.5 bg-sky-600 text-white rounded-xl font-bold text-xs"
                    >
                      {copiedLinkToken === accessModalEmp.invite_token ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setAccessModalEmp(null)} className="px-3.5 py-1.5 text-slate-600 rounded-xl font-semibold">
                  Fechar
                </button>
                <button type="submit" disabled={savingAccess || !accessEmailInput.trim()} className="px-4 py-1.5 bg-sky-600 text-white rounded-xl font-bold">
                  {savingAccess ? 'Salvando...' : 'Salvar e Conceder'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default HRView;