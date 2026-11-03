import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import type { Department, JobPosition, EmployeeItem } from './HRView';
import {
  X,
  User,
  Briefcase,
  HardHat,
  Key,
  Flame,
  Loader2,
  Save,
  ShieldAlert
} from 'lucide-react';

interface CreateEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  departments: Department[];
  jobPositions: (JobPosition & { contract_type?: string; monthly_work_hours?: number; weekly_hours?: number })[];
  employeeToEdit?: EmployeeItem | null;
  onSuccess: () => void;
}

interface CompanyRole {
  id: string;
  name: string;
}

const maskCPF = (val: string) => {
  const digits = val.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

const maskPhone = (val: string) => {
  const digits = val.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
};

const formatCurrencyInput = (val: string) => {
  const digits = val.replace(/\D/g, '');
  if (!digits) return '';
  const num = (parseInt(digits, 10) / 100).toFixed(2);
  return num
    .replace('.', ',')
    .replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
};

const numberToCurrencyString = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(val) || val === 0) return '';
  return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseCurrencyToNumber = (val: string): number => {
  if (!val) return 0;
  const cleaned = val.replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
};

export const CreateEmployeeModal: React.FC<CreateEmployeeModalProps> = ({
  isOpen,
  onClose,
  departments,
  jobPositions,
  employeeToEdit,
  onSuccess
}) => {
  const { user } = useAuth();
  const { permissions, loading: loadingPermissions } = usePermissions();

  const [loading, setLoading] = useState(false);
  const [companyRoles, setCompanyRoles] = useState<CompanyRole[]>([]);

  // 1. Dados Pessoais
  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [rg, setRg] = useState('');
  const [rgIssuer, setRgIssuer] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  // 2. Setor, Cargo & Remuneração
  const [departmentId, setDepartmentId] = useState('');
  const [jobPositionId, setJobPositionId] = useState('');
  const [admissionDate, setAdmissionDate] = useState(new Date().toISOString().split('T')[0]);
  const [baseSalary, setBaseSalary] = useState('');
  const [hasHazardPay, setHasHazardPay] = useState(false);
  const [hazardPayPercent, setHazardPayPercent] = useState('30');

  // Dados Bancários
  const [pixKey, setPixKey] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAgency, setBankAgency] = useState('');
  const [bankAccount, setBankAccount] = useState('');

  // 3. Fardamento e Medidas Operacionais
  const [bootSize, setBootSize] = useState('');
  const [shirtSize, setShirtSize] = useState('');
  const [pantsSize, setPantsSize] = useState('');
  const [notes, setNotes] = useState('');

  // 4. Acesso ao Sistema
  const [grantAccess, setGrantAccess] = useState(false);
  const [accessEmail, setAccessEmail] = useState('');
  const [accessRoleId, setAccessRoleId] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    if (employeeToEdit) {
      setFullName(employeeToEdit.full_name || '');
      setCpf(maskCPF(employeeToEdit.cpf || ''));
      setRg(employeeToEdit.rg || '');
      setRgIssuer(employeeToEdit.rg_issuer || '');
      setBirthDate(employeeToEdit.birth_date || '');
      setEmergencyName(employeeToEdit.emergency_contact_name || '');
      setEmergencyPhone(maskPhone(employeeToEdit.emergency_contact_phone || ''));

      setDepartmentId(employeeToEdit.department_id || '');
      setJobPositionId(employeeToEdit.job_position_id || '');
      setAdmissionDate(employeeToEdit.admission_date || new Date().toISOString().split('T')[0]);
      setBaseSalary(numberToCurrencyString(employeeToEdit.base_salary));
      setHasHazardPay(Boolean(employeeToEdit.has_hazard_pay));
      setHazardPayPercent(employeeToEdit.hazard_pay_percent ? employeeToEdit.hazard_pay_percent.toString() : '30');

      setPixKey(employeeToEdit.pix_key || '');
      setBankName(employeeToEdit.bank_name || '');
      setBankAgency(employeeToEdit.bank_agency || '');
      setBankAccount(employeeToEdit.bank_account || '');

      setBootSize(employeeToEdit.boot_size || '');
      setShirtSize(employeeToEdit.uniform_shirt_size || '');
      setPantsSize(employeeToEdit.uniform_pants_size || '');
      setNotes(employeeToEdit.notes || '');

      setGrantAccess(Boolean(employeeToEdit.has_system_access));
      setAccessEmail(employeeToEdit.email || '');
      setAccessRoleId('');
    } else {
      setFullName('');
      setCpf('');
      setRg('');
      setRgIssuer('');
      setBirthDate('');
      setEmergencyName('');
      setEmergencyPhone('');

      setDepartmentId(departments[0]?.id || '');
      setJobPositionId('');
      setAdmissionDate(new Date().toISOString().split('T')[0]);
      setBaseSalary('');
      setHasHazardPay(false);
      setHazardPayPercent('30');

      setPixKey('');
      setBankName('');
      setBankAgency('');
      setBankAccount('');

      setBootSize('');
      setShirtSize('');
      setPantsSize('');
      setNotes('');

      setGrantAccess(false);
      setAccessEmail('');
      setAccessRoleId('');
    }

    if (user?.company?.id) {
      supabase
        .from('company_roles')
        .select('id, name')
        .eq('company_id', user.company.id)
        .order('name')
        .then(({ data }) => {
          if (data) {
            setCompanyRoles(data);
            if (!employeeToEdit && data.length > 0) setAccessRoleId(data[0].id);
          }
        });
    }
  }, [isOpen, employeeToEdit, departments, user?.company?.id]);

  const handleJobPositionChange = (jobId: string) => {
    setJobPositionId(jobId);
    if (!jobId) return;

    const job = jobPositions.find(j => j.id === jobId);
    if (job) {
      if (job.department_id && !departmentId) {
        setDepartmentId(job.department_id);
      }
      if (job.base_salary > 0 && !baseSalary) {
        setBaseSalary(numberToCurrencyString(job.base_salary));
      }
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.company?.id) {
      alert('Empresa ativa não identificada.');
      return;
    }

    if (!fullName.trim()) {
      alert('Por favor, informe o nome completo do colaborador.');
      return;
    }

    if (grantAccess && !accessEmail.trim()) {
      alert('Para conceder acesso ao sistema, informe o e-mail de login.');
      return;
    }

    try {
      setLoading(true);
      const companyId = user.company.id;
      const cleanEmail = accessEmail.trim().toLowerCase();
      const numSalary = parseCurrencyToNumber(baseSalary);
      const numHazardPercent = parseFloat(hazardPayPercent.replace(',', '.')) || 30.0;
      const selectedJob = jobPositions.find(j => j.id === jobPositionId);

      const targetUserId = employeeToEdit?.user_id || crypto.randomUUID();

      // 1. Atualizar ou Inserir Profile
      if (employeeToEdit) {
        const updateProfilePayload: any = {
          full_name: fullName.trim(),
          cpf: cpf.replace(/\D/g, '') || null,
          role_title: selectedJob?.title || employeeToEdit.role_title || 'Colaborador',
          updated_at: new Date().toISOString()
        };

        if (cleanEmail) updateProfilePayload.email = cleanEmail;
        if (accessRoleId) updateProfilePayload.access_role = accessRoleId;

        await supabase
          .from('profiles')
          .update(updateProfilePayload)
          .eq('id', targetUserId);
      } else {
        const { error: profileErr } = await supabase
          .from('profiles')
          .insert({
            id: targetUserId,
            company_id: companyId,
            full_name: fullName.trim(),
            email: cleanEmail || null,
            cpf: cpf.replace(/\D/g, '') || null,
            role_title: selectedJob?.title || 'Colaborador',
            access_role: grantAccess ? (accessRoleId || null) : null,
            is_active: true,
            updated_at: new Date().toISOString()
          });

        if (profileErr) throw profileErr;
      }

      // 2. Ficha de Funcionário (employee_records)
      const recordPayload = {
        company_id: companyId,
        user_id: targetUserId,
        department_id: departmentId || null,
        job_position_id: jobPositionId || null,
        rg: rg.trim() || null,
        rg_issuer: rgIssuer.trim() || null,
        birth_date: birthDate || null,
        emergency_contact_name: emergencyName.trim() || null,
        emergency_contact_phone: emergencyPhone.trim() || null,
        contract_type: selectedJob?.contract_type || employeeToEdit?.contract_type || 'clt',
        work_status: employeeToEdit?.work_status || 'ativo',
        admission_date: admissionDate || null,
        salary_type: selectedJob?.salary_type || employeeToEdit?.salary_type || 'mensal',
        base_salary: numSalary,
        has_hazard_pay: hasHazardPay,
        hazard_pay_percent: numHazardPercent,
        pix_key: pixKey.trim() || null,
        bank_name: bankName.trim() || null,
        bank_agency: bankAgency.trim() || null,
        bank_account: bankAccount.trim() || null,
        boot_size: bootSize.trim() || null,
        uniform_shirt_size: shirtSize.trim() || null,
        uniform_pants_size: pantsSize.trim() || null,
        notes: notes.trim() || null,
        has_system_access: grantAccess || Boolean(employeeToEdit?.has_system_access),
        updated_at: new Date().toISOString()
      };

      const { error: recErr } = await supabase
        .from('employee_records')
        .upsert(recordPayload, { onConflict: 'company_id,user_id' });

      if (recErr) throw recErr;

      // 3. Convite de Acesso
      if (grantAccess && cleanEmail && !employeeToEdit?.has_system_access) {
        const newToken = Array.from(crypto.getRandomValues(new Uint8Array(24)))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');

        await supabase
          .from('company_invites')
          .insert({
            company_id: companyId,
            email: cleanEmail,
            full_name: fullName.trim(),
            role_title: selectedJob?.title || 'Colaborador',
            role_id: accessRoleId || null,
            token: newToken,
            status: 'pending',
            invited_by: user.id
          });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao salvar colaborador: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
        
        {/* Topo do Modal */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="pr-4">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              {employeeToEdit ? 'Editar Colaborador' : 'Novo Colaborador'}
            </h2>
            <p className="text-xs text-slate-500">
              {employeeToEdit
                ? 'Atualize as informações cadastrais e funcionais do colaborador.'
                : 'Preencha os dados e alocação do colaborador na empresa.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Verificação de Permissão */}
        {!loadingPermissions && !permissions?.canManageEmployees && !permissions?.isOwnerOrAdmin ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
              <ShieldAlert size={24} />
            </div>
            <h3 className="text-base font-bold text-slate-900">Acesso Restrito</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Seu nível de acesso atual não possui permissão para gerenciar colaboradores no RH.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer"
            >
              Fechar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Formulário corrido sem abas */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-xs">
              
              {/* SEÇÃO 1: DADOS PESSOAIS */}
              <div className="space-y-3.5">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <User size={14} className="text-sky-600" />
                  <span>Dados Pessoais</span>
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Nome Completo *</label>
                    <input
                      type="text"
                      required
                      autoFocus
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      placeholder="Ex: João da Silva"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">CPF</label>
                    <input
                      type="text"
                      value={cpf}
                      onChange={e => setCpf(maskCPF(e.target.value))}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Data de Nascimento</label>
                    <input
                      type="date"
                      value={birthDate}
                      onChange={e => setBirthDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">RG</label>
                    <input
                      type="text"
                      value={rg}
                      onChange={e => setRg(e.target.value)}
                      placeholder="Ex: 0000000000"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Órgão Emissor</label>
                    <input
                      type="text"
                      value={rgIssuer}
                      onChange={e => setRgIssuer(e.target.value.toUpperCase())}
                      placeholder="Ex: SSP/RS"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 uppercase focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white"
                    />
                  </div>
                </div>

                {/* Contato de Emergência */}
                <div className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-2.5 mt-2">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                    Contato de Emergência no Canteiro
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nome do Responsável / Parente</label>
                      <input
                        type="text"
                        placeholder="Ex: Maria (Esposa)"
                        value={emergencyName}
                        onChange={e => setEmergencyName(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Telefone de Contato</label>
                      <input
                        type="text"
                        placeholder="(00) 00000-0000"
                        maxLength={15}
                        value={emergencyPhone}
                        onChange={e => setEmergencyPhone(maskPhone(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SEÇÃO 2: SETOR, CARGO & CONTRATO */}
              <div className="space-y-3.5 pt-3 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Briefcase size={14} className="text-sky-600" />
                  <span>Setor, Cargo & Remuneração</span>
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Setor / Departamento</label>
                    <select
                      value={departmentId}
                      onChange={e => setDepartmentId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white cursor-pointer"
                    >
                      <option value="">Selecione o setor...</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Cargo Oficial *</label>
                    <select
                      required
                      value={jobPositionId}
                      onChange={e => handleJobPositionChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white cursor-pointer"
                    >
                      <option value="">Selecione o cargo...</option>
                      {jobPositions
                        .filter(j => !departmentId || j.department_id === departmentId)
                        .map(j => (
                          <option key={j.id} value={j.id}>{j.title}</option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Data de Admissão</label>
                    <input
                      type="date"
                      value={admissionDate}
                      onChange={e => setAdmissionDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Salário Base (R$)</label>
                    <input
                      type="text"
                      placeholder="0,00"
                      value={baseSalary}
                      onChange={e => setBaseSalary(formatCurrencyInput(e.target.value))}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white"
                    />
                  </div>
                </div>

                {/* Periculosidade */}
                <div className="p-3.5 bg-amber-50/50 border border-amber-200 rounded-2xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Flame size={16} className="text-amber-600 shrink-0" />
                    <div>
                      <strong className="text-xs font-bold text-slate-900 block">Adicional de Periculosidade</strong>
                      <span className="text-[10px] text-slate-500">Atividades de risco elétrico ou altura</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {hasHazardPay && (
                      <div className="relative w-20">
                        <input
                          type="text"
                          value={hazardPayPercent}
                          onChange={e => setHazardPayPercent(e.target.value.replace(/[^\d.,]/g, ''))}
                          className="w-full px-2 py-1 bg-white border border-amber-300 rounded-lg font-bold text-slate-900 text-center text-xs"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-[10px]">%</span>
                      </div>
                    )}
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasHazardPay}
                        onChange={e => setHasHazardPay(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                    </label>
                  </div>
                </div>

                {/* Dados de Pagamento */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                    Dados de Pagamento & Chave Pix
                  </span>
                  <input
                    type="text"
                    placeholder="Chave Pix (CPF, celular, e-mail ou aleatória)"
                    value={pixKey}
                    onChange={e => setPixKey(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Banco"
                      value={bankName}
                      onChange={e => setBankName(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800"
                    />
                    <input
                      type="text"
                      placeholder="Agência"
                      value={bankAgency}
                      onChange={e => setBankAgency(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800"
                    />
                    <input
                      type="text"
                      placeholder="Conta"
                      value={bankAccount}
                      onChange={e => setBankAccount(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* SEÇÃO 3: FARDAMENTO & MEDIDAS OPERACIONAIS */}
              <div className="space-y-3.5 pt-3 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <HardHat size={14} className="text-sky-600" />
                  <span>Fardamento & Medidas Operacionais</span>
                </span>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Botina / Calçado</label>
                    <input
                      type="text"
                      placeholder="Ex: 41, 42"
                      value={bootSize}
                      onChange={e => setBootSize(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-center text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Camisa</label>
                    <input
                      type="text"
                      placeholder="Ex: M, G, GG"
                      value={shirtSize}
                      onChange={e => setShirtSize(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-center text-slate-900 uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Calça</label>
                    <input
                      type="text"
                      placeholder="Ex: 42, 44"
                      value={pantsSize}
                      onChange={e => setPantsSize(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-center text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Observações ou Restrições</label>
                  <textarea
                    rows={2}
                    placeholder="Alergias, restrições ou notas operacionais..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 resize-none focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              {/* SEÇÃO 4: ACESSO AO SISTEMA */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Key size={14} className="text-sky-600" />
                      <span>{employeeToEdit?.has_system_access ? 'Acesso Ativo no Sistema' : 'Conceder Acesso ao Lume (Login)'}</span>
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {employeeToEdit?.has_system_access
                        ? 'O colaborador já possui login cadastrado'
                        : 'Permite que o colaborador acerte a sua senha e use o aplicativo'}
                    </span>
                  </div>

                  {!employeeToEdit?.has_system_access && (
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={grantAccess}
                        onChange={e => setGrantAccess(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
                    </label>
                  )}
                </div>

                {(grantAccess || employeeToEdit?.has_system_access) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-sky-50/50 border border-sky-100 rounded-2xl animate-in fade-in duration-150">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">E-mail Corporativo *</label>
                      <input
                        type="email"
                        required={grantAccess}
                        placeholder="colaborador@empresa.com.br"
                        value={accessEmail}
                        onChange={e => setAccessEmail(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nível de Permissão</label>
                      <select
                        value={accessRoleId}
                        onChange={e => setAccessRoleId(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                      >
                        <option value="">Manter atual / Selecione...</option>
                        {companyRoles.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Rodapé Fixo */}
            <div className="px-5 py-3.5 bg-slate-50/90 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-2xs disabled:opacity-50 transition-all cursor-pointer active:scale-98"
              >
                {loading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    {employeeToEdit ? 'Salvar Alterações' : 'Cadastrar Colaborador'}
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default CreateEmployeeModal;