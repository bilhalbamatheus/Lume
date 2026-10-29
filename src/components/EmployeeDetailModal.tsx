import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Department, JobPosition, EmployeeItem, EmployeeCertification } from './HRView';
import {
  X,
  Edit2,
  Save,
  Loader2,
  FileText,
  Briefcase,
  Key,
  HardHat,
  ShieldCheck,
  ShieldAlert,
  TrendingUp,
  Plus,
  Trash2,
  Check,
  Copy,
  Upload,
  Eye,
  Paperclip,
  Phone,
  Flame,
  Gift,
  Heart,
  Car,
  Utensils,
  Bus,
  DollarSign,
  Scale,
  Clock,
  Calculator,
  ArrowRight
} from 'lucide-react';

interface EmployeeDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  isNew: boolean;
  employee: EmployeeItem | null;
  departments: Department[];
  jobPositions: (JobPosition & { contract_type?: string; monthly_work_hours?: number; weekly_hours?: number })[];
  onSaved: () => void;
}

interface EmployeeDocument {
  id: string;
  name: string;
  file_url: string;
  file_type?: string | null;
  file_size?: number | null;
  created_at: string;
}

interface CompanyBenefitItem {
  id: string;
  name: string;
  category: 'alimentacao' | 'combustivel' | 'saude' | 'transporte' | 'outros';
  default_value: number;
}

interface EmployeeBenefitAssigned {
  id: string;
  benefit_id?: string | null;
  custom_name: string;
  category: string;
  amount: number;
  deduction_amount: number;
  status: string;
}

interface SalaryHistoryItem {
  id: string;
  previous_salary: number;
  new_salary: number;
  effective_date: string;
  change_type: string;
  notes?: string | null;
  created_at: string;
}

interface CompanyRole {
  id: string;
  name: string;
}

const getInitials = (name: string) => {
  if (!name) return 'EX';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const formatCurrency = (val: number) => {
  return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const EmployeeDetailModal: React.FC<EmployeeDetailModalProps> = ({
  isOpen,
  onClose,
  isNew,
  employee,
  departments,
  jobPositions,
  onSaved
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'pessoal' | 'setor_cargo' | 'beneficios' | 'fardamentos' | 'salario'>('pessoal');
  const [isEditing, setIsEditing] = useState(isNew);
  const [saving, setSaving] = useState(false);

  // Alíquota de encargos da empresa
  const [companyCltRate, setCompanyCltRate] = useState<number>(64.5);

  // Popup de Acesso
  const [isAccessPopupOpen, setIsAccessPopupOpen] = useState(false);
  const [accessEmail, setAccessEmail] = useState('');
  const [accessRoleId, setAccessRoleId] = useState('');
  const [companyRoles, setCompanyRoles] = useState<CompanyRole[]>([]);
  const [savingAccess, setSavingAccess] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Formulário - Pessoal
  const [formFullName, setFormFullName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formCpf, setFormCpf] = useState('');
  const [formRg, setFormRg] = useState('');
  const [formRgIssuer, setFormRgIssuer] = useState('');
  const [formBirthDate, setFormBirthDate] = useState('');
  const [formEmergencyName, setFormEmergencyName] = useState('');
  const [formEmergencyPhone, setFormEmergencyPhone] = useState('');

  // Documentos
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Formulário - Setor & Cargo
  const [formDepartmentId, setFormDepartmentId] = useState('');
  const [formJobPositionId, setFormJobPositionId] = useState('');
  const [formAdmissionDate, setFormAdmissionDate] = useState('');
  const [formBaseSalary, setFormBaseSalary] = useState('');

  // Periculosidade
  const [formHasHazardPay, setFormHasHazardPay] = useState(false);
  const [formHazardPayPercent, setFormHazardPayPercent] = useState('30');

  // Pagamento
  const [formPixKey, setFormPixKey] = useState('');
  const [formBankName, setFormBankName] = useState('');
  const [formBankAgency, setFormBankAgency] = useState('');
  const [formBankAccount, setFormBankAccount] = useState('');

  // Benefícios
  const [companyCatalogBenefits, setCompanyCatalogBenefits] = useState<CompanyBenefitItem[]>([]);
  const [assignedBenefits, setAssignedBenefits] = useState<EmployeeBenefitAssigned[]>([]);
  const [loadingBenefits, setLoadingBenefits] = useState(false);
  const [selectedBenefitCatalogId, setSelectedBenefitCatalogId] = useState('');
  const [benefitAmountInput, setBenefitAmountInput] = useState('');
  const [benefitDeductionInput, setBenefitDeductionInput] = useState('');
  const [savingBenefitAssign, setSavingBenefitAssign] = useState(false);

  // Formulário - Fardamento
  const [formBootSize, setFormBootSize] = useState('');
  const [formShirtSize, setFormShirtSize] = useState('');
  const [formPantsSize, setFormPantsSize] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Histórico Salarial
  const [empSalaryHistory, setEmpSalaryHistory] = useState<SalaryHistoryItem[]>([]);
  const [loadingSalaryHistory, setLoadingSalaryHistory] = useState(false);
  const [showAddSalaryChange, setShowAddSalaryChange] = useState(false);
  const [newSalaryValue, setNewSalaryValue] = useState('');
  const [salaryChangeReason, setSalaryChangeReason] = useState('promocao');
  const [salaryChangeDate, setSalaryChangeDate] = useState(new Date().toISOString().split('T')[0]);
  const [salaryChangeNotes, setSalaryChangeNotes] = useState('');
  const [savingSalaryChange, setSavingSalaryChange] = useState(false);

  useEffect(() => {
    if (!isOpen || !user?.company?.id) return;

    // Busca papéis da empresa
    supabase
      .from('company_roles')
      .select('id, name')
      .eq('company_id', user.company.id)
      .order('name')
      .then(({ data }) => {
        if (data) setCompanyRoles(data);
      });

    // Busca benefícios cadastrados
    supabase
      .from('company_benefits')
      .select('id, name, category, default_value')
      .eq('company_id', user.company.id)
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        if (data) setCompanyCatalogBenefits(data);
      });

    // Busca a taxa de encargos CLT da empresa
    supabase
      .from('companies')
      .select('clt_charges_rate_percent')
      .eq('id', user.company.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.clt_charges_rate_percent !== undefined && data?.clt_charges_rate_percent !== null) {
          setCompanyCltRate(Number(data.clt_charges_rate_percent) || 64.5);
        }
      });
  }, [isOpen, user?.company?.id]);

  const loadDocuments = async (recordId: string) => {
    const { data } = await supabase
      .from('employee_documents')
      .select('*')
      .eq('employee_record_id', recordId)
      .order('created_at', { ascending: false });
    if (data) setDocuments(data);
  };

  const loadAssignedBenefits = async (recordId: string) => {
    setLoadingBenefits(true);
    const { data } = await supabase
      .from('employee_benefits')
      .select('*')
      .eq('employee_record_id', recordId)
      .order('created_at', { ascending: false });
    if (data) setAssignedBenefits(data);
    setLoadingBenefits(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    setIsEditing(isNew);

    if (isNew || !employee) {
      setFormFullName('');
      setFormEmail('');
      setFormCpf('');
      setFormRg('');
      setFormRgIssuer('');
      setFormBirthDate('');
      setFormEmergencyName('');
      setFormEmergencyPhone('');

      setFormDepartmentId(departments[0]?.id || '');
      setFormJobPositionId('');
      setFormAdmissionDate(new Date().toISOString().split('T')[0]);
      setFormBaseSalary('');
      setFormHasHazardPay(false);
      setFormHazardPayPercent('30');
      setFormPixKey('');
      setFormBankName('');
      setFormBankAgency('');
      setFormBankAccount('');

      setFormBootSize('');
      setFormShirtSize('');
      setFormPantsSize('');
      setFormNotes('');
      setDocuments([]);
      setAssignedBenefits([]);
      setEmpSalaryHistory([]);
      setActiveTab('pessoal');
      setAccessEmail('');
      setAccessRoleId('');
    } else {
      setFormFullName(employee.full_name);
      setFormEmail(employee.email || '');
      setAccessEmail(employee.email || '');
      setFormCpf(employee.cpf || '');
      setFormRg(employee.rg || '');
      setFormRgIssuer(employee.rg_issuer || '');
      setFormBirthDate(employee.birth_date || '');
      setFormEmergencyName(employee.emergency_contact_name || '');
      setFormEmergencyPhone(employee.emergency_contact_phone || '');

      setFormDepartmentId(employee.department_id || '');
      setFormJobPositionId(employee.job_position_id || '');
      setFormAdmissionDate(employee.admission_date || '');
      setFormBaseSalary(employee.base_salary ? employee.base_salary.toString() : '');
      setFormHasHazardPay(Boolean(employee.has_hazard_pay));
      setFormHazardPayPercent(employee.hazard_pay_percent ? employee.hazard_pay_percent.toString() : '30');
      setFormPixKey(employee.pix_key || '');
      setFormBankName(employee.bank_name || '');
      setFormBankAgency(employee.bank_agency || '');
      setFormBankAccount(employee.bank_account || '');

      setFormBootSize(employee.boot_size || '');
      setFormShirtSize(employee.uniform_shirt_size || '');
      setFormPantsSize(employee.uniform_pants_size || '');
      setFormNotes(employee.notes || '');

      setActiveTab('pessoal');

      if (employee.record_id) {
        loadDocuments(employee.record_id);
        loadAssignedBenefits(employee.record_id);

        setLoadingSalaryHistory(true);
        supabase
          .from('employee_salary_history')
          .select('*')
          .eq('employee_record_id', employee.record_id)
          .order('effective_date', { ascending: false })
          .then(({ data }) => {
            setEmpSalaryHistory(data || []);
            setLoadingSalaryHistory(false);
          });
      }
    }
  }, [isOpen, isNew, employee, departments]);

  const handleJobPositionChange = (jobId: string) => {
    setFormJobPositionId(jobId);
    if (!jobId) return;

    const job = jobPositions.find(j => j.id === jobId);
    if (job) {
      if (job.department_id && !formDepartmentId) {
        setFormDepartmentId(job.department_id);
      }
      if (job.base_salary > 0) {
        setFormBaseSalary(job.base_salary.toString());
      }
    }
  };

  const currentJobObj = jobPositions.find(j => j.id === formJobPositionId);
  const currentDeptObj = departments.find(d => d.id === formDepartmentId);

  // =========================================================================
  // CÁLCULO ESTRUTURADO DE CUSTOS (DIRETOS, INDIRETOS, TOTAIS E HORA-HOMEM)
  // =========================================================================
  const financialCostAnalysis = useMemo(() => {
    const rawSalary = parseFloat(formBaseSalary.replace(/\./g, '').replace(',', '.')) || 0;
    const isDiaria = (currentJobObj?.salary_type || employee?.salary_type) === 'diaria';
    const effectiveBaseSalary = isDiaria ? rawSalary * 22 : rawSalary;

    const hazardPercent = parseFloat(formHazardPayPercent.replace(',', '.')) || 30.0;
    const hazardPayAmount = formHasHazardPay ? (effectiveBaseSalary * hazardPercent) / 100 : 0;

    // Benefícios pagos pela empresa (montante bruto menos eventuais descontos do funcionário)
    const companyBenefitsTotal = assignedBenefits.reduce((acc, b) => {
      const netForCompany = Math.max(0, (b.amount || 0) - (b.deduction_amount || 0));
      return acc + netForCompany;
    }, 0);

    // CUSTOS DIRETOS
    const totalDirectCost = effectiveBaseSalary + hazardPayAmount + companyBenefitsTotal;

    // CUSTOS INDIRETOS / ENCARGOS
    const contractType = (currentJobObj?.contract_type || employee?.contract_type || 'clt').toLowerCase();
    const isClt = contractType === 'clt';

    const baseForCharges = effectiveBaseSalary + hazardPayAmount;

    let totalIndirectCost = 0;
    let inssPatronal = 0;
    let fgtsProvision = 0;
    let thirteenthProvision = 0;
    let vacationProvision = 0;

    if (isClt && baseForCharges > 0) {
      // Cálculo das parcelas constitutivas dos encargos e provisões
      inssPatronal = baseForCharges * 0.20; // 20% INSS Patronal aproximado
      fgtsProvision = baseForCharges * 0.08; // 8% FGTS
      thirteenthProvision = baseForCharges * (1 / 12); // Provisão 13º salário (8,33%)
      vacationProvision = (baseForCharges * (1 / 12)) * (4 / 3); // Provisão férias + 1/3 (11,11%)

      // Total de encargos baseado na alíquota cadastrada na empresa
      totalIndirectCost = (baseForCharges * companyCltRate) / 100;
    }

    const totalEmployeeCost = totalDirectCost + totalIndirectCost;

    // Cálculo da Hora-Homem
    const monthlyHours = currentJobObj?.monthly_work_hours || 220;
    const hourlyCost = monthlyHours > 0 ? totalEmployeeCost / monthlyHours : 0;
    const costMultiplier = effectiveBaseSalary > 0 ? totalEmployeeCost / effectiveBaseSalary : 1;

    return {
      effectiveBaseSalary,
      hazardPayAmount,
      companyBenefitsTotal,
      totalDirectCost,
      isClt,
      contractType,
      inssPatronal,
      fgtsProvision,
      thirteenthProvision,
      vacationProvision,
      totalIndirectCost,
      totalEmployeeCost,
      monthlyHours,
      hourlyCost,
      costMultiplier
    };
  }, [formBaseSalary, formHasHazardPay, formHazardPayPercent, currentJobObj, employee, assignedBenefits, companyCltRate]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user?.company?.id) return;
    if (!employee?.record_id) {
      alert('Salve o colaborador primeiro antes de anexar arquivos.');
      return;
    }

    try {
      setUploadingDoc(true);
      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop();
        const filePath = `employees/${employee.record_id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadErr } = await supabase.storage
          .from('company-assets')
          .upload(filePath, file);

        if (uploadErr) throw uploadErr;

        const { data: publicUrlData } = supabase.storage
          .from('company-assets')
          .getPublicUrl(filePath);

        await supabase.from('employee_documents').insert({
          company_id: user.company.id,
          employee_record_id: employee.record_id,
          name: file.name,
          file_url: publicUrlData.publicUrl,
          file_type: file.type,
          file_size: file.size
        });
      }

      await loadDocuments(employee.record_id);
    } catch (err: any) {
      alert('Erro ao anexar arquivo: ' + err.message);
    } finally {
      setUploadingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    try {
      await supabase.from('employee_documents').delete().eq('id', docId);
      setDocuments(prev => prev.filter(d => d.id !== docId));
    } catch (err: any) {
      alert('Erro ao remover documento: ' + err.message);
    }
  };

  // Atribuir Benefício ao Colaborador
  const handleAssignBenefit = async () => {
    if (!selectedBenefitCatalogId || !employee?.record_id || !user?.company?.id) return;
    const catBenefit = companyCatalogBenefits.find(b => b.id === selectedBenefitCatalogId);
    if (!catBenefit) return;

    try {
      setSavingBenefitAssign(true);
      const amountNum = parseFloat(benefitAmountInput.replace(/\./g, '').replace(',', '.')) || catBenefit.default_value;
      const deductionNum = parseFloat(benefitDeductionInput.replace(/\./g, '').replace(',', '.')) || 0;

      const { data, error } = await supabase
        .from('employee_benefits')
        .insert({
          company_id: user.company.id,
          employee_record_id: employee.record_id,
          benefit_id: catBenefit.id,
          custom_name: catBenefit.name,
          category: catBenefit.category,
          amount: amountNum,
          deduction_amount: deductionNum,
          status: 'ativo'
        })
        .select()
        .single();

      if (error) throw error;
      setAssignedBenefits(prev => [data, ...prev]);
      setSelectedBenefitCatalogId('');
      setBenefitAmountInput('');
      setBenefitDeductionInput('');
    } catch (err: any) {
      alert('Erro ao atribuir benefício: ' + err.message);
    } finally {
      setSavingBenefitAssign(false);
    }
  };

  const handleDeleteAssignedBenefit = async (assignedId: string) => {
    try {
      await supabase.from('employee_benefits').delete().eq('id', assignedId);
      setAssignedBenefits(prev => prev.filter(b => b.id !== assignedId));
    } catch (err: any) {
      alert('Erro ao remover benefício: ' + err.message);
    }
  };

  const handleSaveAccessFromPopup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessEmail.trim() || !user?.company?.id) return;

    try {
      setSavingAccess(true);
      const companyId = user.company.id;
      const targetUserId = employee?.user_id;

      if (targetUserId) {
        await supabase
          .from('profiles')
          .update({ email: accessEmail.trim().toLowerCase() })
          .eq('id', targetUserId);

        await supabase
          .from('employee_records')
          .update({ has_system_access: true })
          .eq('user_id', targetUserId);
      }

      const { data: existingInvite } = await supabase
        .from('company_invites')
        .select('id')
        .eq('company_id', companyId)
        .eq('email', accessEmail.trim().toLowerCase())
        .maybeSingle();

      if (!existingInvite) {
        await supabase
          .from('company_invites')
          .insert({
            company_id: companyId,
            email: accessEmail.trim().toLowerCase(),
            full_name: formFullName.trim() || employee?.full_name,
            role_title: jobPositions.find(j => j.id === formJobPositionId)?.title || 'Colaborador',
            role_id: accessRoleId || null,
            status: 'pending'
          });
      }

      setFormEmail(accessEmail.trim());
      setIsAccessPopupOpen(false);
      alert('Acesso configurado e convite registrado com sucesso!');
      onSaved();
    } catch (err: any) {
      alert('Erro ao conceder acesso: ' + err.message);
    } finally {
      setSavingAccess(false);
    }
  };

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFullName.trim() || !user?.company?.id) return;

    try {
      setSaving(true);
      const companyId = user.company.id;
      const numSalary = parseFloat(formBaseSalary.replace(/\./g, '').replace(',', '.')) || 0;
      const numHazardPercent = parseFloat(formHazardPayPercent.replace(',', '.')) || 30.0;
      const selectedJob = jobPositions.find(j => j.id === formJobPositionId);

      // Garante ID gerado se for novo colaborador
      let targetUserId = employee?.user_id || crypto.randomUUID();

      // Salva no profiles chamando a RPC ou inserindo com ID explícito
      const { data: upsertedId, error: rpcError } = await supabase.rpc('upsert_employee_profile', {
        p_id: targetUserId,
        p_company_id: companyId,
        p_full_name: formFullName.trim(),
        p_email: formEmail.trim() || '',
        p_cpf: formCpf.trim() || '',
        p_role_title: selectedJob?.title || employee?.role_title || 'Colaborador'
      });

      if (rpcError) {
        const { error: profileErr } = await supabase
          .from('profiles')
          .upsert({
            id: targetUserId,
            company_id: companyId,
            full_name: formFullName.trim(),
            email: formEmail.trim() || null,
            cpf: formCpf.trim() || null,
            role_title: selectedJob?.title || employee?.role_title || 'Colaborador',
            is_active: true,
            updated_at: new Date().toISOString()
          });

        if (profileErr) throw profileErr;
      } else if (upsertedId) {
        targetUserId = upsertedId;
      }

      const recordPayload = {
        company_id: companyId,
        user_id: targetUserId,
        department_id: formDepartmentId || null,
        job_position_id: formJobPositionId || null,
        rg: formRg.trim() || null,
        rg_issuer: formRgIssuer.trim() || null,
        birth_date: formBirthDate || null,
        emergency_contact_name: formEmergencyName.trim() || null,
        emergency_contact_phone: formEmergencyPhone.trim() || null,
        contract_type: selectedJob?.contract_type || employee?.contract_type || 'clt',
        work_status: employee?.work_status || 'ativo',
        admission_date: formAdmissionDate || null,
        salary_type: selectedJob?.salary_type || employee?.salary_type || 'mensal',
        base_salary: numSalary,
        has_hazard_pay: formHasHazardPay,
        hazard_pay_percent: numHazardPercent,
        pix_key: formPixKey.trim() || null,
        bank_name: formBankName.trim() || null,
        bank_agency: formBankAgency.trim() || null,
        bank_account: formBankAccount.trim() || null,
        boot_size: formBootSize.trim() || null,
        uniform_shirt_size: formShirtSize.trim() || null,
        uniform_pants_size: formPantsSize.trim() || null,
        notes: formNotes.trim() || null,
        updated_at: new Date().toISOString()
      };

      const { error: recErr } = await supabase
        .from('employee_records')
        .upsert(recordPayload, { onConflict: 'company_id,user_id' });

      if (recErr) throw recErr;

      onSaved();
      setIsEditing(false);
      if (isNew) onClose();
    } catch (err: any) {
      alert('Erro ao salvar colaborador: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddSalaryChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee?.record_id || !user?.company?.id) return;

    try {
      setSavingSalaryChange(true);
      const newSalaryNum = parseFloat(newSalaryValue.replace(/\./g, '').replace(',', '.')) || 0;
      const currentSalary = employee.base_salary;

      const { data: histData, error: histErr } = await supabase
        .from('employee_salary_history')
        .insert({
          company_id: user.company.id,
          employee_record_id: employee.record_id,
          previous_salary: currentSalary,
          new_salary: newSalaryNum,
          effective_date: salaryChangeDate,
          change_type: salaryChangeReason,
          notes: salaryChangeNotes.trim() || null
        })
        .select()
        .single();

      if (histErr) throw histErr;

      await supabase
        .from('employee_records')
        .update({
          base_salary: newSalaryNum,
          updated_at: new Date().toISOString()
        })
        .eq('id', employee.record_id);

      setFormBaseSalary(newSalaryNum.toString());
      setEmpSalaryHistory(prev => [histData, ...prev]);
      setShowAddSalaryChange(false);
      setNewSalaryValue('');
      setSalaryChangeNotes('');
    } catch (err: any) {
      alert('Erro ao registrar alteração salarial: ' + err.message);
    } finally {
      setSavingSalaryChange(false);
    }
  };

  const copyInviteLink = (token: string) => {
    const inviteUrl = `${window.location.origin}/invite?token=${token}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
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

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[300] flex justify-end animate-in fade-in duration-200">
      <div 
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 z-10 animate-in slide-in-from-right duration-250">
        
        {/* CABEÇALHO */}
        <header className="px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-sky-50 text-sky-700 border border-sky-100 font-bold text-sm flex items-center justify-center shrink-0 shadow-2xs">
              {getInitials(formFullName || 'Novo')}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black truncate text-slate-900">
                  {isNew ? 'Novo Colaborador' : formFullName}
                </h2>
                {!isNew && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize border ${
                    employee?.work_status === 'ativo'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : employee?.work_status === 'desligado'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {employee?.work_status || 'Ativo'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 truncate mt-0.5">
                {isNew 
                  ? 'Preencha a ficha do colaborador' 
                  : `${currentJobObj?.title || 'Colaborador'} • ${currentDeptObj?.name || 'Sem setor'}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isNew && (
              <>
                <button
                  type="button"
                  onClick={() => setIsAccessPopupOpen(true)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer active:scale-98 ${
                    employee?.has_system_access
                      ? 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100'
                      : 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
                  }`}
                >
                  <Key size={13} />
                  <span>{employee?.has_system_access ? 'Acesso Ativo' : 'Conceder Acesso'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsEditing(!isEditing)}
                  className={`p-2 rounded-xl transition cursor-pointer border ${
                    isEditing 
                      ? 'bg-sky-600 text-white border-sky-600 shadow-2xs' 
                      : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                  }`}
                  title={isEditing ? 'Visualizar Dossiê' : 'Editar Informações'}
                >
                  <Edit2 size={16} />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              title="Fechar"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* NAVEGAÇÃO DE ABAS */}
        <nav className="px-6 bg-slate-50/70 border-b border-slate-200/80 flex items-center gap-1 shrink-0 overflow-x-auto text-xs font-bold scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('pessoal')}
            className={`py-3 px-3.5 border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'pessoal' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText size={14} />
            <span>Dados Pessoais & Docs</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('setor_cargo')}
            className={`py-3 px-3.5 border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'setor_cargo' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Briefcase size={14} />
            <span>Setor, Cargo & Custos</span>
          </button>

          {!isNew && (
            <button
              type="button"
              onClick={() => setActiveTab('beneficios')}
              className={`py-3 px-3.5 border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'beneficios' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Gift size={14} />
              <span>Benefícios ({assignedBenefits.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('fardamentos')}
            className={`py-3 px-3.5 border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'fardamentos' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <HardHat size={14} />
            <span>Fardamento & EPI</span>
          </button>

          {!isNew && (
            <button
              type="button"
              onClick={() => setActiveTab('salario')}
              className={`py-3 px-3.5 border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'salario' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <TrendingUp size={14} />
              <span>Histórico Salarial</span>
            </button>
          )}
        </nav>

        {/* CORPO DO DRAWER */}
        <main className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          
          {isEditing ? (
            /* MODO EDIÇÃO / NOVO CADASTRO */
            <form id="employee-drawer-form" onSubmit={handleSaveSubmit} className="space-y-5">
              
              {/* ABA 1: PESSOAL & DOCS */}
              {activeTab === 'pessoal' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Nome Completo *</label>
                      <input
                        type="text"
                        required
                        autoFocus
                        value={formFullName}
                        onChange={e => setFormFullName(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-sky-500 text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">CPF</label>
                      <input
                        type="text"
                        placeholder="000.000.000-00"
                        value={formCpf}
                        onChange={e => setFormCpf(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-sky-500 text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">RG</label>
                      <input
                        type="text"
                        value={formRg}
                        onChange={e => setFormRg(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Órgão Emissor</label>
                      <input
                        type="text"
                        value={formRgIssuer}
                        onChange={e => setFormRgIssuer(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Data Nascimento</label>
                      <input
                        type="date"
                        value={formBirthDate}
                        onChange={e => setFormBirthDate(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200 space-y-3">
                    <span className="font-extrabold text-slate-900 uppercase tracking-wider text-[11px] block">
                      Contato de Emergência no Canteiro
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Nome do Parente / Responsável</label>
                        <input
                          type="text"
                          placeholder="Ex: Esposa, Mãe..."
                          value={formEmergencyName}
                          onChange={e => setFormEmergencyName(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Telefone de Contato</label>
                        <input
                          type="text"
                          placeholder="(00) 00000-0000"
                          value={formEmergencyPhone}
                          onChange={e => setFormEmergencyPhone(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ABA 2: SETOR & CARGO */}
              {activeTab === 'setor_cargo' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Setor / Departamento</label>
                      <select
                        value={formDepartmentId}
                        onChange={e => setFormDepartmentId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold cursor-pointer text-slate-900"
                      >
                        <option value="">Selecione o setor...</option>
                        {departments.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Cargo Oficial *</label>
                      <select
                        required
                        value={formJobPositionId}
                        onChange={e => handleJobPositionChange(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold cursor-pointer text-slate-900"
                      >
                        <option value="">Selecione o cargo...</option>
                        {jobPositions
                          .filter(j => !formDepartmentId || j.department_id === formDepartmentId)
                          .map(j => (
                            <option key={j.id} value={j.id}>
                              {j.title} {j.base_salary > 0 ? `(${formatCurrency(j.base_salary)})` : ''}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Data de Admissão</label>
                      <input
                        type="date"
                        value={formAdmissionDate}
                        onChange={e => setFormAdmissionDate(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Salário Base (R$) *</label>
                      <input
                        type="text"
                        placeholder="0,00"
                        value={formBaseSalary}
                        onChange={e => setFormBaseSalary(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                      />
                    </div>
                  </div>

                  {/* PERICULOSIDADE */}
                  <div className="p-3.5 bg-amber-50/50 border border-amber-200 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Flame size={16} className="text-amber-600" />
                        <div>
                          <strong className="text-xs font-bold text-slate-900 block">Adicional de Periculosidade</strong>
                          <span className="text-[10px] text-slate-500">Adicional para atividades de risco/eletricidade</span>
                        </div>
                      </div>

                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formHasHazardPay}
                          onChange={e => setFormHasHazardPay(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                      </label>
                    </div>

                    {formHasHazardPay && (
                      <div className="pt-2.5 border-t border-amber-200/80 flex items-center justify-between gap-4 animate-in fade-in duration-150">
                        <span className="text-xs font-semibold text-slate-700">Porcentagem do Adicional:</span>
                        <div className="relative w-28">
                          <input
                            type="text"
                            value={formHazardPayPercent}
                            onChange={e => setFormHazardPayPercent(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-xl font-bold text-slate-900 pr-7 text-right"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">%</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* PIX E BANCO */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                    <span className="font-extrabold text-slate-900 uppercase tracking-wider text-[11px] block">
                      Dados de Pagamento & Chave Pix
                    </span>
                    <input
                      type="text"
                      placeholder="Chave Pix (CPF, celular, e-mail ou aleatória)"
                      value={formPixKey}
                      onChange={e => setFormPixKey(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-medium"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="Banco"
                        value={formBankName}
                        onChange={e => setFormBankName(e.target.value)}
                        className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Agência"
                        value={formBankAgency}
                        onChange={e => setFormBankAgency(e.target.value)}
                        className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Conta"
                        value={formBankAccount}
                        onChange={e => setFormBankAccount(e.target.value)}
                        className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ABA 4: FARDAMENTO & EPI */}
              {activeTab === 'fardamentos' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Botina / Calçado</label>
                      <input
                        type="text"
                        placeholder="Ex: 41, 42"
                        value={formBootSize}
                        onChange={e => setFormBootSize(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-center text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Camisa</label>
                      <input
                        type="text"
                        placeholder="Ex: M, G, GG"
                        value={formShirtSize}
                        onChange={e => setFormShirtSize(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-center text-slate-900 uppercase"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Calça</label>
                      <input
                        type="text"
                        placeholder="Ex: 42, 44"
                        value={formPantsSize}
                        onChange={e => setFormPantsSize(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-center text-slate-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Observações Operacionais & Alergias</label>
                    <textarea
                      rows={3}
                      placeholder="Restrições ou necessidades específicas..."
                      value={formNotes}
                      onChange={e => setFormNotes(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium resize-none text-slate-900"
                    />
                  </div>
                </div>
              )}
            </form>
          ) : (
            /* MODO VISUALIZAÇÃO / LEITURA */
            <div className="space-y-5">
              
              {/* ABA 1: PESSOAL & DOCS */}
              {activeTab === 'pessoal' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">CPF</span>
                      <strong className="text-slate-900 font-bold text-xs">{formCpf || 'Não informado'}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">RG</span>
                      <strong className="text-slate-900 font-bold text-xs">
                        {formRg ? `${formRg} (${formRgIssuer || 'SSP'})` : 'Não informado'}
                      </strong>
                    </div>
                    <div className="pt-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Data de Nascimento</span>
                      <strong className="text-slate-900 font-bold text-xs">
                        {formBirthDate ? new Date(formBirthDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'Não informada'}
                      </strong>
                    </div>
                    <div className="pt-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">E-mail Cadastrado</span>
                      <strong className="text-slate-900 font-bold text-xs">{formEmail || 'Sem e-mail'}</strong>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Contato de Emergência no Canteiro
                    </span>
                    <p className="text-xs text-slate-800 font-bold">
                      {formEmergencyName || 'Nenhum contato registrado'}
                    </p>
                    {formEmergencyPhone && (
                      <p className="text-[11px] text-slate-500 flex items-center gap-1.5 font-medium">
                        <Phone size={12} className="text-slate-400" />
                        <span>{formEmergencyPhone}</span>
                      </p>
                    )}
                  </div>

                  {/* ANEXOS */}
                  <div className="pt-2 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider block">
                        Documentos Pessoais & Trabalhistas ({documents.length})
                      </span>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        multiple
                        className="hidden"
                      />
                      <button
                        type="button"
                        disabled={uploadingDoc}
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                      >
                        {uploadingDoc ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                        <span>Anexar Arquivo</span>
                      </button>
                    </div>

                    {documents.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400 border border-dashed rounded-xl bg-slate-50/50">
                        Nenhum documento anexado ainda.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {documents.map(doc => (
                          <div key={doc.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <Paperclip size={13} className="text-slate-400 shrink-0" />
                              <span className="font-bold text-slate-800 text-xs truncate">{doc.name}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <a
                                href={doc.file_url}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 text-slate-400 hover:text-sky-600 rounded"
                              >
                                <Eye size={13} />
                              </a>
                              <button
                                type="button"
                                onClick={() => handleDeleteDocument(doc.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ABA 2: SETOR & CARGO (COM CONTAINERS DE CUSTOS DIRETOS, INDIRETOS E TOTAL) */}
              {activeTab === 'setor_cargo' && (
                <div className="space-y-4">
                  {/* IDENTIFICAÇÃO FUNCIONAL */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cargo Oficial</span>
                      <strong className="text-slate-900 font-bold text-xs block truncate">{currentJobObj?.title || 'Colaborador'}</strong>
                      {currentJobObj?.cbo_code && (
                        <span className="text-[9px] text-slate-400 font-mono">CBO: {currentJobObj.cbo_code}</span>
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Setor</span>
                      <strong className="text-slate-900 font-bold text-xs block truncate">{currentDeptObj?.name || 'Sem Setor'}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Contratação</span>
                      <span className="inline-block uppercase text-[10px] font-extrabold px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200 mt-0.5">
                        {financialCostAnalysis.contractType.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Data de Admissão</span>
                      <strong className="text-slate-900 font-bold text-xs block">
                        {formAdmissionDate ? new Date(formAdmissionDate + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                      </strong>
                    </div>
                  </div>

                  {/* OS 2 CONTAINERS: CUSTOS DIRETOS & CUSTOS INDIRETOS */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    
                    {/* CONTAINER 1: CUSTOS DIRETOS */}
                    <div className="bg-white border border-sky-100 rounded-2xl p-4 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-sky-50">
                        <span className="font-extrabold text-xs text-sky-950 uppercase tracking-wider flex items-center gap-1.5">
                          <DollarSign size={14} className="text-sky-600" />
                          <span>Custos Diretos (Folha)</span>
                        </span>
                        <span className="text-[10px] font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-md">
                          Desembolso Direto
                        </span>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Salário Base Mensal:</span>
                          <strong className="text-slate-900 font-semibold">{formatCurrency(financialCostAnalysis.effectiveBaseSalary)}</strong>
                        </div>

                        {formHasHazardPay && (
                          <div className="flex items-center justify-between text-amber-900">
                            <span className="flex items-center gap-1 text-slate-500">
                              <Flame size={12} className="text-amber-500" />
                              <span>Periculosidade (+{formHazardPayPercent}%):</span>
                            </span>
                            <strong className="text-amber-700 font-semibold">{formatCurrency(financialCostAnalysis.hazardPayAmount)}</strong>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Benefícios Empresa (Líquido):</span>
                          <strong className="text-slate-900 font-semibold">{formatCurrency(financialCostAnalysis.companyBenefitsTotal)}</strong>
                        </div>
                      </div>

                      <div className="pt-2.5 border-t border-sky-100 flex items-center justify-between">
                        <span className="font-bold text-xs text-sky-900">Subtotal Direto:</span>
                        <strong className="text-sm font-black text-sky-700">
                          {formatCurrency(financialCostAnalysis.totalDirectCost)}
                        </strong>
                      </div>
                    </div>

                    {/* CONTAINER 2: CUSTOS INDIRETOS & ENCARGOS */}
                    <div className="bg-white border border-indigo-100 rounded-2xl p-4 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-indigo-50">
                        <span className="font-extrabold text-xs text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                          <Scale size={14} className="text-indigo-600" />
                          <span>Encargos & Provisões</span>
                        </span>
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                          {financialCostAnalysis.isClt ? `${companyCltRate}% Encargos CLT` : 'Sem Encargos CLT'}
                        </span>
                      </div>

                      {financialCostAnalysis.isClt ? (
                        <div className="space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">INSS Patronal / Sistema S (~20%):</span>
                            <strong className="text-slate-900 font-semibold">{formatCurrency(financialCostAnalysis.inssPatronal)}</strong>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Provisão FGTS (8%):</span>
                            <strong className="text-slate-900 font-semibold">{formatCurrency(financialCostAnalysis.fgtsProvision)}</strong>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Provisão 13º Salário (1/12):</span>
                            <strong className="text-slate-900 font-semibold">{formatCurrency(financialCostAnalysis.thirteenthProvision)}</strong>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Provisão Férias + 1/3 (11,11%):</span>
                            <strong className="text-slate-900 font-semibold">{formatCurrency(financialCostAnalysis.vacationProvision)}</strong>
                          </div>
                        </div>
                      ) : (
                        <div className="py-4 text-center text-slate-400 space-y-1">
                          <ShieldCheck size={20} className="mx-auto text-emerald-500" />
                          <p className="text-xs font-semibold text-slate-600">Contratação {financialCostAnalysis.contractType.toUpperCase()}</p>
                          <p className="text-[10px] text-slate-400">Não há incidência de encargos previdenciários e trabalhistas CLT.</p>
                        </div>
                      )}

                      <div className="pt-2.5 border-t border-indigo-100 flex items-center justify-between">
                        <span className="font-bold text-xs text-indigo-900">Subtotal Indireto:</span>
                        <strong className="text-sm font-black text-indigo-700">
                          {formatCurrency(financialCostAnalysis.totalIndirectCost)}
                        </strong>
                      </div>
                    </div>

                  </div>

                  {/* CARD RESUMO EXECUTIVO DO CUSTO TOTAL DA EMPRESA */}
                  <div className="p-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl shadow-md space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-700">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                          Custo Total da Empresa
                        </span>
                        <div className="flex items-baseline gap-2">
                          <strong className="text-xl sm:text-2xl font-black text-white">
                            {formatCurrency(financialCostAnalysis.totalEmployeeCost)}
                          </strong>
                          <span className="text-xs text-slate-400">/ mês</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                          Custo Hora-Homem (H/H)
                        </span>
                        <div className="flex items-baseline gap-1 justify-end">
                          <strong className="text-base sm:text-lg font-black text-sky-400">
                            {formatCurrency(financialCostAnalysis.hourlyCost)}
                          </strong>
                          <span className="text-[11px] text-slate-400">/ hora</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-300">
                      <span>Jornada Base: <strong>{financialCostAnalysis.monthlyHours}h/mês</strong></span>
                      <span>Fator sobre Salário: <strong className="text-emerald-400">{financialCostAnalysis.costMultiplier.toFixed(2)}x</strong></span>
                    </div>
                  </div>

                  {/* DADOS BANCÁRIOS & PIX */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Dados para Pagamento
                    </span>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Chave Pix:</span>
                      <strong className="font-mono text-slate-900">{formPixKey || 'Não cadastrada'}</strong>
                    </div>
                    {formBankName && (
                      <div className="flex items-center justify-between text-xs border-t border-slate-200/60 pt-1.5">
                        <span className="text-slate-500 font-medium">Banco / Agência / Conta:</span>
                        <strong className="text-slate-900">{formBankName} • Ag: {formBankAgency || '—'} • CC: {formBankAccount || '—'}</strong>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ABA 4: FARDAMENTOS & EPI */}
              {activeTab === 'fardamentos' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Botina</span>
                      <strong className="text-base font-black text-slate-900">{formBootSize || '—'}</strong>
                    </div>
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Camisa</span>
                      <strong className="text-base font-black text-slate-900 uppercase">{formShirtSize || '—'}</strong>
                    </div>
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Calça</span>
                      <strong className="text-base font-black text-slate-900">{formPantsSize || '—'}</strong>
                    </div>
                  </div>

                  {formNotes && (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Observações</span>
                      <p className="text-slate-700 leading-relaxed">{formNotes}</p>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

          {/* ABA 3: BENEFÍCIOS DO COLABORADOR */}
          {activeTab === 'beneficios' && !isNew && (
            <div className="space-y-4">
              
              {/* Resumo do Pacote de Benefícios */}
              <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                    Total em Benefícios
                  </span>
                  <strong className="text-base font-black text-emerald-950 block">
                    {formatCurrency(financialCostAnalysis.companyBenefitsTotal)} / mês
                  </strong>
                </div>

                <span className="text-[11px] font-semibold text-emerald-700 bg-white border border-emerald-200 px-2.5 py-1 rounded-xl">
                  {assignedBenefits.length} {assignedBenefits.length === 1 ? 'benefício ativo' : 'benefícios ativos'}
                </span>
              </div>

              {/* Adicionar Benefício a partir do Catálogo da Empresa */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <span className="font-extrabold text-slate-900 text-[11px] block uppercase tracking-wider">
                  + Conceder Benefício do Catálogo
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="sm:col-span-1">
                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Benefício *</label>
                    <select
                      value={selectedBenefitCatalogId}
                      onChange={e => {
                        setSelectedBenefitCatalogId(e.target.value);
                        const b = companyCatalogBenefits.find(item => item.id === e.target.value);
                        if (b && b.default_value > 0) {
                          setBenefitAmountInput(b.default_value.toString());
                        }
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
                    >
                      <option value="">Selecione...</option>
                      {companyCatalogBenefits.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.default_value > 0 ? formatCurrency(b.default_value) : 'Variável'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Valor Mensal (R$) *</label>
                    <input
                      type="text"
                      placeholder="0,00"
                      value={benefitAmountInput}
                      onChange={e => setBenefitAmountInput(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Desconto em Folha (R$)</label>
                    <input
                      type="text"
                      placeholder="0,00"
                      value={benefitDeductionInput}
                      onChange={e => setBenefitDeductionInput(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    disabled={savingBenefitAssign || !selectedBenefitCatalogId}
                    onClick={handleAssignBenefit}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {savingBenefitAssign ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                    <span>Adicionar ao Colaborador</span>
                  </button>
                </div>
              </div>

              {/* Lista dos Benefícios Concedidos */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                {assignedBenefits.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 italic">
                    Nenhum benefício vinculado a este colaborador.
                  </div>
                ) : (
                  assignedBenefits.map(b => (
                    <div key={b.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                          {getCategoryIcon(b.category)}
                        </div>
                        <div className="min-w-0">
                          <strong className="text-xs font-bold text-slate-900 block truncate">{b.custom_name}</strong>
                          <span className="text-[10px] text-slate-400 block truncate">
                            {b.deduction_amount > 0 ? `Desconto em folha: ${formatCurrency(b.deduction_amount)}` : 'Sem desconto em folha (100% empresa)'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <strong className="text-xs font-black text-slate-900">
                          {formatCurrency(b.amount)}
                        </strong>
                        <button
                          type="button"
                          onClick={() => handleDeleteAssignedBenefit(b.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          title="Remover"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ABA 5: HISTÓRICO SALARIAL */}
          {activeTab === 'salario' && !isNew && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Salário Atual</span>
                  <strong className="text-sm font-black text-slate-900">
                    {formatCurrency(employee?.base_salary || 0)} ({employee?.salary_type || 'mensal'})
                  </strong>
                </div>

                {!showAddSalaryChange && (
                  <button
                    type="button"
                    onClick={() => setShowAddSalaryChange(true)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-2xs"
                  >
                    + Novo Reajuste
                  </button>
                )}
              </div>

              {showAddSalaryChange && (
                <div className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-2xl space-y-2.5">
                  <span className="font-bold text-emerald-950 text-xs block">Novo Reajuste Individual</span>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Novo Salário (R$)"
                      value={newSalaryValue}
                      onChange={e => setNewSalaryValue(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl font-bold text-xs"
                    />
                    <select
                      value={salaryChangeReason}
                      onChange={e => setSalaryChangeReason(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs"
                    >
                      <option value="promocao">Promoção</option>
                      <option value="merito">Mérito</option>
                      <option value="dissidio">Dissídio</option>
                    </select>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddSalaryChange(false)}
                      className="px-3 py-1 text-slate-600 text-xs font-semibold"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={savingSalaryChange || !newSalaryValue}
                      onClick={handleAddSalaryChange}
                      className="px-3.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold"
                    >
                      Confirmar
                    </button>
                  </div>
                </div>
              )}

              <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                {loadingSalaryHistory ? (
                  <div className="p-6 text-center text-xs text-slate-400">Carregando histórico...</div>
                ) : empSalaryHistory.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 italic">Nenhum reajuste individual registrado.</div>
                ) : (
                  empSalaryHistory.map(hist => (
                    <div key={hist.id} className="p-3 bg-white flex items-center justify-between text-xs">
                      <div>
                        <strong className="block text-slate-900 font-bold capitalize">{hist.change_type}</strong>
                        <span className="text-[10px] text-slate-400">
                          {new Date(hist.effective_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 line-through block">
                          {formatCurrency(hist.previous_salary)}
                        </span>
                        <strong className="text-emerald-700 font-black text-xs block">
                          {formatCurrency(hist.new_salary)}
                        </strong>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </main>

        {/* RODAPÉ EM MODO EDIÇÃO */}
        {isEditing && (
          <footer className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
            {!isNew && (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl cursor-pointer"
              >
                Cancelar Edição
              </button>
            )}
            <button
              type="submit"
              form="employee-drawer-form"
              disabled={saving}
              className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-98"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span>{isNew ? 'Concluir Cadastro' : 'Salvar Alterações'}</span>
            </button>
          </footer>
        )}

        {/* POPUP DE ACESSO */}
        {isAccessPopupOpen && (
          <div className="fixed inset-0 z-[320] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-2xs animate-in fade-in duration-150">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
                    <Key size={16} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Acesso ao Sistema Lume</h4>
                    <p className="text-[11px] text-slate-400">Configure login e permissões do colaborador</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAccessPopupOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveAccessFromPopup} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">E-mail Corporativo de Login *</label>
                  <input
                    type="email"
                    required
                    placeholder="colaborador@empresa.com.br"
                    value={accessEmail}
                    onChange={e => setAccessEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-sky-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nível de Acesso (Permissões) *</label>
                  <select
                    required
                    value={accessRoleId}
                    onChange={e => setAccessRoleId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold cursor-pointer text-slate-900"
                  >
                    <option value="">Selecione o perfil...</option>
                    {companyRoles.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>

                {employee?.invite_token && (
                  <div className="p-3 bg-sky-50 border border-sky-100 rounded-xl flex items-center justify-between gap-2">
                    <span className="text-[11px] text-sky-900 font-medium truncate">Convite pendente de aceitação</span>
                    <button
                      type="button"
                      onClick={() => copyInviteLink(employee.invite_token!)}
                      className="px-2.5 py-1 bg-white border border-sky-200 text-sky-700 rounded-lg font-bold text-[10px] flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      {copiedLink ? <Check size={11} /> : <Copy size={11} />}
                      <span>{copiedLink ? 'Copiado!' : 'Copiar Link'}</span>
                    </button>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAccessPopupOpen(false)}
                    className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingAccess}
                    className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  >
                    {savingAccess ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    <span>Salvar e Conceder</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>,
    document.body
  );
};

export default EmployeeDetailModal;