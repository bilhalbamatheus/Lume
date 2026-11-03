import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import type { Department, JobPosition, EmployeeItem } from './HRView';
import { InventoryMovementModal } from './InventoryMovementModal';
import { PrintEpiTermModal } from './PrintEpiTermModal';
import {
  ArrowLeft,
  Edit2,
  FileText,
  Briefcase,
  Gift,
  HardHat,
  TrendingUp,
  Phone,
  Paperclip,
  Upload,
  Eye,
  Trash2,
  Plus,
  Flame,
  Scale,
  DollarSign,
  ShieldCheck,
  Key,
  Loader2,
  MoreVertical,
  Sun,
  AlertOctagon,
  UserMinus,
  RotateCcw,
  ShieldBan,
  Printer
} from 'lucide-react';

interface EmployeeDetailPageProps {
  employee: EmployeeItem;
  departments: Department[];
  jobPositions: (JobPosition & { contract_type?: string; monthly_work_hours?: number; weekly_hours?: number })[];
  onBack: () => void;
  onEdit: () => void;
  onOpenAccessModal: () => void;
  onReload: () => void;
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

interface EmployeeEpiMovement {
  id: string;
  item_id: string;
  quantity: number;
  size?: string | null;
  created_at: string;
  notes?: string | null;
  item?: {
    name: string;
    ca_number?: string | null;
    lifespan_days?: number | null;
    unit?: string;
  } | null;
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

const maskPhone = (val: string | null | undefined): string => {
  if (!val) return '';
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

const formatCurrency = (val: number) => {
  return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const getInitials = (name: string) => {
  if (!name) return 'EX';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const EmployeeDetailPage: React.FC<EmployeeDetailPageProps> = ({
  employee,
  departments,
  jobPositions,
  onBack,
  onEdit,
  onOpenAccessModal,
  onReload
}) => {
  const { user } = useAuth();
  const { permissions } = usePermissions();

  const isMaster = Boolean(permissions?.isOwnerOrAdmin);
  const canManageEmployees = isMaster || Boolean(permissions?.canManageEmployees);
  const canManageAdmissions = isMaster || Boolean(permissions?.canManageAdmissionsLeaves);

  const [activeTab, setActiveTab] = useState<'pessoal' | 'setor_cargo' | 'beneficios' | 'fardamentos' | 'salario'>('pessoal');

  // Menu Dropdown de Opções no Topo
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Modal de Confirmação de Ações
  const [actionConfirm, setActionConfirm] = useState<'ferias' | 'afastar' | 'reativar' | 'desligar' | 'remover_acesso' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [companyCltRate, setCompanyCltRate] = useState<number>(64.5);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Benefícios
  const [companyCatalogBenefits, setCompanyCatalogBenefits] = useState<CompanyBenefitItem[]>([]);
  const [assignedBenefits, setAssignedBenefits] = useState<EmployeeBenefitAssigned[]>([]);
  const [selectedBenefitCatalogId, setSelectedBenefitCatalogId] = useState('');
  const [benefitAmountInput, setBenefitAmountInput] = useState('');
  const [benefitDeductionInput, setBenefitDeductionInput] = useState('');
  const [savingBenefitAssign, setSavingBenefitAssign] = useState(false);

  // EPIs via Almoxarifado Central (inventory_movements)
  const [allItems, setAllItems] = useState<any[]>([]);
  const [epiMovements, setEpiMovements] = useState<EmployeeEpiMovement[]>([]);
  const [loadingEpis, setLoadingEpis] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Histórico Salarial
  const [empSalaryHistory, setEmpSalaryHistory] = useState<SalaryHistoryItem[]>([]);
  const [loadingSalaryHistory, setLoadingSalaryHistory] = useState(false);
  const [showAddSalaryChange, setShowAddSalaryChange] = useState(false);
  const [newSalaryValue, setNewSalaryValue] = useState('');
  const [salaryChangeReason, setSalaryChangeReason] = useState('promocao');
  const [salaryChangeDate, setSalaryChangeDate] = useState(new Date().toISOString().split('T')[0]);
  const [savingSalaryChange, setSavingSalaryChange] = useState(false);

  // Fechar menu ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const loadDocuments = async (recordId: string) => {
    const { data } = await supabase
      .from('employee_documents')
      .select('*')
      .eq('employee_record_id', recordId)
      .order('created_at', { ascending: false });
    if (data) setDocuments(data);
  };

  const loadAssignedBenefits = async (recordId: string) => {
    const { data } = await supabase
      .from('employee_benefits')
      .select('*')
      .eq('employee_record_id', recordId)
      .order('created_at', { ascending: false });
    if (data) setAssignedBenefits(data);
  };

  // Busca do almoxarifado (inventory_movements) testando recipient_profile_id tanto com user_id quanto com id
  const loadEpiMovements = async () => {
    const targetUserId = employee.user_id || employee.id;
    if (!targetUserId) return;

    try {
      setLoadingEpis(true);

      const targetIds = Array.from(new Set([employee.user_id, employee.id].filter(Boolean))) as string[];

      const [movRes, itemsRes] = await Promise.all([
        supabase
          .from('inventory_movements')
          .select('id, item_id, quantity, size, created_at, notes, movement_type')
          .in('recipient_profile_id', targetIds)
          .eq('movement_type', 'saida_epi')
          .order('created_at', { ascending: false }),
        supabase
          .from('inventory_items')
          .select('id, name, ca_number, lifespan_days, unit')
      ]);

      const itemMap = new Map<string, any>();
      (itemsRes.data || []).forEach(it => itemMap.set(it.id, it));

      const formatted: EmployeeEpiMovement[] = (movRes.data || []).map((m: any) => ({
        id: m.id,
        item_id: m.item_id,
        quantity: Number(m.quantity) || 1,
        size: m.size || null,
        created_at: m.created_at,
        notes: m.notes || null,
        item: itemMap.get(m.item_id) || { name: 'Item do Almoxarifado', ca_number: null, unit: 'un' }
      }));

      setEpiMovements(formatted);
    } catch (err: any) {
      console.warn('Erro ao carregar cautelas do colaborador:', err.message);
    } finally {
      setLoadingEpis(false);
    }
  };

  useEffect(() => {
    if (!user?.company?.id) return;

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

    supabase
      .from('company_benefits')
      .select('id, name, category, default_value')
      .eq('company_id', user.company.id)
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        if (data) setCompanyCatalogBenefits(data);
      });

    // Puxa catálogo de itens do Almoxarifado
    supabase
      .from('inventory_items')
      .select('*')
      .eq('company_id', user.company.id)
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        if (data) setAllItems(data);
      });

    if (employee.record_id) {
      loadDocuments(employee.record_id);
      loadAssignedBenefits(employee.record_id);
    }

    loadEpiMovements();

    if (employee.record_id) {
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
  }, [employee.record_id, employee.user_id, employee.id, user?.company?.id]);

  const currentJobObj = jobPositions.find(j => j.id === employee.job_position_id);
  const currentDeptObj = departments.find(d => d.id === employee.department_id);

  const financialCostAnalysis = useMemo(() => {
    const rawSalary = Number(employee.base_salary) || 0;
    const isDiaria = (currentJobObj?.salary_type || employee.salary_type) === 'diaria';
    const effectiveBaseSalary = isDiaria ? rawSalary * 22 : rawSalary;

    const hazardPercent = Number(employee.hazard_pay_percent) || 30.0;
    const hazardPayAmount = employee.has_hazard_pay ? (effectiveBaseSalary * hazardPercent) / 100 : 0;

    const companyBenefitsTotal = assignedBenefits.reduce((acc, b) => {
      const netForCompany = Math.max(0, (b.amount || 0) - (b.deduction_amount || 0));
      return acc + netForCompany;
    }, 0);

    const totalDirectCost = effectiveBaseSalary + hazardPayAmount + companyBenefitsTotal;

    const contractType = (currentJobObj?.contract_type || employee.contract_type || 'clt').toLowerCase();
    const isClt = contractType === 'clt';
    const baseForCharges = effectiveBaseSalary + hazardPayAmount;

    let totalIndirectCost = 0;
    let inssPatronal = 0;
    let fgtsProvision = 0;
    let thirteenthProvision = 0;
    let vacationProvision = 0;

    if (isClt && baseForCharges > 0) {
      inssPatronal = baseForCharges * 0.20;
      fgtsProvision = baseForCharges * 0.08;
      thirteenthProvision = baseForCharges * (1 / 12);
      vacationProvision = (baseForCharges * (1 / 12)) * (4 / 3);
      totalIndirectCost = (baseForCharges * companyCltRate) / 100;
    }

    const totalEmployeeCost = totalDirectCost + totalIndirectCost;
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
  }, [employee, currentJobObj, assignedBenefits, companyCltRate]);

  // Execução de ações de situação e remoção de acesso
  const handleConfirmAction = async () => {
    if (!actionConfirm || !user?.company?.id) return;
    try {
      setActionLoading(true);
      const companyId = user.company.id;

      if (actionConfirm === 'remover_acesso') {
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

        if (actionConfirm === 'ferias') newStatus = 'ferias';
        else if (actionConfirm === 'afastar') newStatus = 'afastado';
        else if (actionConfirm === 'desligar') {
          newStatus = 'desligado';
          resignationDate = new Date().toISOString().split('T')[0];
        }

        await supabase
          .from('employee_records')
          .update({
            work_status: newStatus,
            has_system_access: actionConfirm === 'desligar' ? false : employee.has_system_access,
            resignation_date: resignationDate,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', employee.user_id)
          .eq('company_id', companyId);

        if (actionConfirm === 'desligar') {
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

        if (actionConfirm === 'reativar') {
          await supabase
            .from('profiles')
            .update({ is_active: true })
            .eq('id', employee.user_id);
        }
      }

      setActionConfirm(null);
      onReload();
    } catch (err: any) {
      alert('Erro ao executar ação: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user?.company?.id || !employee.record_id) return;

    try {
      setUploadingDoc(true);
      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop();
        const filePath = `employees/${employee.record_id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadErr } = await supabase.storage.from('company-assets').upload(filePath, file);
        if (uploadErr) throw uploadErr;

        const { data: publicUrlData } = supabase.storage.from('company-assets').getPublicUrl(filePath);

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
      alert('Erro ao remover arquivo: ' + err.message);
    }
  };

  const handleAssignBenefit = async () => {
    if (!selectedBenefitCatalogId || !employee.record_id || !user?.company?.id) return;
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

  // Exclusão de entrega estorna o saldo no Almoxarifado
  const handleDeleteEpiMovement = async (mov: EmployeeEpiMovement) => {
    if (!window.confirm('Deseja estornar esta entrega de EPI? O saldo voltará ao estoque do Almoxarifado.')) {
      return;
    }

    try {
      const { data: freshItem } = await supabase
        .from('inventory_items')
        .select('current_stock, sizes_stock, requires_size')
        .eq('id', mov.item_id)
        .single();

      if (freshItem) {
        const newStock = Number(freshItem.current_stock || 0) + Number(mov.quantity || 1);
        let updatedSizes = freshItem.sizes_stock && typeof freshItem.sizes_stock === 'object' ? { ...freshItem.sizes_stock } : {};

        if (freshItem.requires_size && mov.size) {
          updatedSizes[mov.size] = (Number(updatedSizes[mov.size]) || 0) + Number(mov.quantity || 1);
        }

        await supabase
          .from('inventory_items')
          .update({
            current_stock: newStock,
            sizes_stock: updatedSizes,
            updated_at: new Date().toISOString()
          })
          .eq('id', mov.item_id);
      }

      await supabase.from('inventory_movements').delete().eq('id', mov.id);
      setEpiMovements(prev => prev.filter(d => d.id !== mov.id));
    } catch (err: any) {
      alert('Erro ao estornar entrega de EPI: ' + err.message);
    }
  };

  const handleAddSalaryChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee.record_id || !user?.company?.id) return;

    try {
      setSavingSalaryChange(true);
      const newSalaryNum = parseFloat(newSalaryValue.replace(/\./g, '').replace(',', '.')) || 0;

      const { data: histData, error: histErr } = await supabase
        .from('employee_salary_history')
        .insert({
          company_id: user.company.id,
          employee_record_id: employee.record_id,
          previous_salary: employee.base_salary,
          new_salary: newSalaryNum,
          effective_date: salaryChangeDate,
          change_type: salaryChangeReason
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

      setEmpSalaryHistory(prev => [histData, ...prev]);
      setShowAddSalaryChange(false);
      setNewSalaryValue('');
      onReload();
    } catch (err: any) {
      alert('Erro ao registrar reajuste salarial: ' + err.message);
    } finally {
      setSavingSalaryChange(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 bg-slate-50/50 overflow-y-auto">
      
      {/* BARRA SUPERIOR DE NAVEGAÇÃO E AÇÕES */}
      <header className="px-4 sm:px-8 py-4 bg-white border-b border-slate-200/80 flex items-center justify-between shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            title="Voltar ao Quadro de RH"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="w-10 h-10 rounded-2xl bg-sky-100 text-sky-800 font-bold text-xs flex items-center justify-center shrink-0 border border-sky-200">
            {getInitials(employee.full_name)}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-slate-900 truncate">
                {employee.full_name}
              </h1>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize border ${
                employee.work_status === 'ativo'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : employee.work_status === 'desligado'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {employee.work_status}
              </span>
            </div>
            <p className="text-xs text-slate-500 truncate mt-0.5">
              {currentJobObj?.title || employee.role_title || 'Colaborador'} • {currentDeptObj?.name || 'Sem setor'}
            </p>
          </div>
        </div>

        {/* BOTÃO DE OPÇÕES (MENU DROPDOWN) */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen(prev => !prev);
            }}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
            title="Mais opções do colaborador"
          >
            <MoreVertical size={18} />
          </button>

          {isMenuOpen && (
            <div
              className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-slate-200 rounded-2xl shadow-xl py-1.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-100 text-left"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 1. Editar Informações */}
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onEdit();
                }}
                className="w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium cursor-pointer"
              >
                <Edit2 size={13} className="text-sky-600" />
                <span>Editar Informações</span>
              </button>

              {/* 2. Gestão de Acesso */}
              {canManageEmployees && (
                <>
                  <div className="border-t border-slate-100 my-1" />
                  {!employee.has_system_access ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenAccessModal();
                      }}
                      className="w-full px-3.5 py-2 text-sky-700 hover:bg-sky-50 flex items-center gap-2 font-medium cursor-pointer"
                    >
                      <Key size={13} className="text-sky-600" />
                      <span>Conceder Acesso</span>
                    </button>
                  ) : (
                    employee.user_id !== user?.id && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsMenuOpen(false);
                          setActionConfirm('remover_acesso');
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

              {/* 3. Situação Funcional (Férias, INSS, Desligar) */}
              {canManageAdmissions && (
                <>
                  <div className="border-t border-slate-100 my-1" />

                  {employee.work_status === 'ativo' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setIsMenuOpen(false);
                          setActionConfirm('ferias');
                        }}
                        className="w-full px-3.5 py-2 text-amber-700 hover:bg-amber-50 flex items-center gap-2 cursor-pointer font-medium"
                      >
                        <Sun size={13} className="text-amber-600" />
                        <span>Dar Férias</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsMenuOpen(false);
                          setActionConfirm('afastar');
                        }}
                        className="w-full px-3.5 py-2 text-purple-700 hover:bg-purple-50 flex items-center gap-2 cursor-pointer font-medium"
                      >
                        <AlertOctagon size={13} className="text-purple-600" />
                        <span>Baixar INSS / Afastar</span>
                      </button>

                      {employee.user_id !== user?.id && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsMenuOpen(false);
                            setActionConfirm('desligar');
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
                        setIsMenuOpen(false);
                        setActionConfirm('reativar');
                      }}
                      className="w-full px-3.5 py-2 text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 cursor-pointer font-medium"
                    >
                      <RotateCcw size={13} className="text-emerald-600" />
                      <span>Reativar Colaborador</span>
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ABAS DO DOSSIÊ */}
      <nav className="px-4 sm:px-8 bg-white border-b border-slate-200/80 flex items-center gap-1 shrink-0 overflow-x-auto text-xs font-bold scrollbar-none">
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

        <button
          type="button"
          onClick={() => setActiveTab('fardamentos')}
          className={`py-3 px-3.5 border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'fardamentos' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <HardHat size={14} />
          <span>Fardamento & EPI ({epiMovements.length})</span>
        </button>

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
      </nav>

      {/* ÁREA DE CONTEÚDO PRINCIPAL */}
      <main className="p-4 sm:p-8 max-w-6xl w-full mx-auto space-y-6">
        
        {/* ABA 1: DADOS PESSOAIS & DOCUMENTOS */}
        {activeTab === 'pessoal' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 bg-white border border-slate-200 rounded-3xl space-y-4 shadow-2xs">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                  Identificação Civil
                </span>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">CPF</span>
                    <strong className="text-slate-900 font-bold text-xs">{maskCPF(employee.cpf) || 'Não informado'}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">RG</span>
                    <strong className="text-slate-900 font-bold text-xs">
                      {employee.rg ? `${employee.rg} (${employee.rg_issuer || 'SSP'})` : 'Não informado'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Data de Nascimento</span>
                    <strong className="text-slate-900 font-bold text-xs">
                      {employee.birth_date ? new Date(employee.birth_date + 'T00:00:00').toLocaleDateString('pt-BR') : 'Não informada'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">E-mail Cadastrado</span>
                    <strong className="text-slate-900 font-bold text-xs truncate block">{employee.email || 'Sem e-mail'}</strong>
                  </div>
                </div>
              </div>

              <div className="p-5 bg-white border border-slate-200 rounded-3xl space-y-4 shadow-2xs">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                  Contato de Emergência no Canteiro
                </span>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Nome do Responsável</span>
                    <strong className="text-slate-900 font-bold text-xs block">
                      {employee.emergency_contact_name || 'Nenhum contato registrado'}
                    </strong>
                  </div>
                  {employee.emergency_contact_phone && (
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Telefone</span>
                      <p className="text-xs text-slate-700 flex items-center gap-1.5 font-bold">
                        <Phone size={13} className="text-slate-400" />
                        <span>{maskPhone(employee.emergency_contact_phone)}</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Documentos Anexados */}
            <div className="p-5 bg-white border border-slate-200 rounded-3xl space-y-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                    Documentos Pessoais & Trabalhistas ({documents.length})
                  </span>
                  <span className="text-[11px] text-slate-400">Contratos, ficha cadastral, exames admissionais</span>
                </div>

                <input type="file" ref={fileInputRef} onChange={handleFileUpload} multiple className="hidden" />
                <button
                  type="button"
                  disabled={uploadingDoc}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  {uploadingDoc ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                  <span>Anexar Arquivo</span>
                </button>
              </div>

              {documents.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 border border-dashed rounded-2xl bg-slate-50/50">
                  Nenhum documento anexado ainda.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {documents.map(doc => (
                    <div key={doc.id} className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Paperclip size={14} className="text-slate-400 shrink-0" />
                        <span className="font-bold text-slate-800 text-xs truncate">{doc.name}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <a href={doc.file_url} target="_blank" rel="noreferrer" className="p-1.5 text-slate-400 hover:text-sky-600 rounded">
                          <Eye size={14} />
                        </a>
                        <button type="button" onClick={() => handleDeleteDocument(doc.id)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ABA 2: SETOR, CARGO & CUSTOS */}
        {activeTab === 'setor_cargo' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 bg-white border border-slate-200 rounded-3xl shadow-2xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cargo Oficial</span>
                <strong className="text-slate-900 font-bold text-xs block truncate">{currentJobObj?.title || employee.role_title || 'Colaborador'}</strong>
                {currentJobObj?.cbo_code && <span className="text-[9px] text-slate-400 font-mono">CBO: {currentJobObj.cbo_code}</span>}
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Setor</span>
                <strong className="text-slate-900 font-bold text-xs block truncate">{currentDeptObj?.name || 'Sem Setor'}</strong>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Contratação</span>
                <span className="inline-block uppercase text-[10px] font-extrabold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 mt-0.5">
                  {financialCostAnalysis.contractType.toUpperCase()}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Data de Admissão</span>
                <strong className="text-slate-900 font-bold text-xs block">
                  {employee.admission_date ? new Date(employee.admission_date + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                </strong>
              </div>
            </div>

            {/* Containers de Custos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border border-sky-100 rounded-3xl p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-sky-50">
                  <span className="font-extrabold text-xs text-sky-950 uppercase tracking-wider flex items-center gap-1.5">
                    <DollarSign size={15} className="text-sky-600" />
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
                  {employee.has_hazard_pay && (
                    <div className="flex items-center justify-between text-amber-900">
                      <span className="flex items-center gap-1 text-slate-500">
                        <Flame size={12} className="text-amber-500" />
                        <span>Periculosidade (+{employee.hazard_pay_percent}%):</span>
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

              <div className="bg-white border border-indigo-100 rounded-3xl p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-indigo-50">
                  <span className="font-extrabold text-xs text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                    <Scale size={15} className="text-indigo-600" />
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

            {/* Resumo Total da Empresa */}
            <div className="p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-3xl shadow-md space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-700">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                    Custo Total da Empresa
                  </span>
                  <div className="flex items-baseline gap-2">
                    <strong className="text-2xl sm:text-3xl font-black text-white">
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
                    <strong className="text-lg sm:text-xl font-black text-sky-400">
                      {formatCurrency(financialCostAnalysis.hourlyCost)}
                    </strong>
                    <span className="text-[11px] text-slate-400">/ hora</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>Jornada Base: <strong>{financialCostAnalysis.monthlyHours}h/mês</strong></span>
                <span>Fator sobre Salário: <strong className="text-emerald-400">{financialCostAnalysis.costMultiplier.toFixed(2)}x</strong></span>
              </div>
            </div>

            {/* Dados Bancários */}
            <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-2xs space-y-2 text-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Dados para Pagamento
              </span>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Chave Pix:</span>
                <strong className="font-mono text-slate-900">{employee.pix_key || 'Não cadastrada'}</strong>
              </div>
              {employee.bank_name && (
                <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                  <span className="text-slate-500 font-medium">Banco / Agência / Conta:</span>
                  <strong className="text-slate-900">
                    {employee.bank_name} • Ag: {employee.bank_agency || '—'} • CC: {employee.bank_account || '—'}
                  </strong>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ABA 3: BENEFÍCIOS */}
        {activeTab === 'beneficios' && (
          <div className="space-y-5">
            <div className="p-5 bg-emerald-50/60 border border-emerald-200 rounded-3xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                  Total em Benefícios
                </span>
                <strong className="text-xl font-black text-emerald-950 block">
                  {formatCurrency(financialCostAnalysis.companyBenefitsTotal)} / mês
                </strong>
              </div>
              <span className="text-xs font-semibold text-emerald-700 bg-white border border-emerald-200 px-3 py-1 rounded-xl">
                {assignedBenefits.length} benefício(s) ativo(s)
              </span>
            </div>

            <div className="p-5 bg-white border border-slate-200 rounded-3xl space-y-4 shadow-2xs">
              <span className="font-extrabold text-slate-900 text-xs block uppercase tracking-wider">
                + Conceder Benefício do Catálogo
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Benefício *</label>
                  <select
                    value={selectedBenefitCatalogId}
                    onChange={e => {
                      setSelectedBenefitCatalogId(e.target.value);
                      const b = companyCatalogBenefits.find(item => item.id === e.target.value);
                      if (b && b.default_value > 0) setBenefitAmountInput(b.default_value.toString());
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  >
                    <option value="">Selecione...</option>
                    {companyCatalogBenefits.map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({formatCurrency(b.default_value)})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Valor Mensal (R$) *</label>
                  <input
                    type="text"
                    placeholder="0,00"
                    value={benefitAmountInput}
                    onChange={e => setBenefitAmountInput(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Desconto em Folha (R$)</label>
                  <input
                    type="text"
                    placeholder="0,00"
                    value={benefitDeductionInput}
                    onChange={e => setBenefitDeductionInput(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={savingBenefitAssign || !selectedBenefitCatalogId}
                  onClick={handleAssignBenefit}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingBenefitAssign ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  <span>Adicionar ao Colaborador</span>
                </button>
              </div>
            </div>

            <div className="border border-slate-200 rounded-3xl overflow-hidden divide-y divide-slate-100 bg-white shadow-2xs">
              {assignedBenefits.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 italic">Nenhum benefício vinculado.</div>
              ) : (
                assignedBenefits.map(b => (
                  <div key={b.id} className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50 text-xs">
                    <div>
                      <strong className="font-bold text-slate-900 block">{b.custom_name}</strong>
                      <span className="text-[10px] text-slate-400">
                        {b.deduction_amount > 0 ? `Desconto em folha: ${formatCurrency(b.deduction_amount)}` : '100% pago pela empresa'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <strong className="font-black text-slate-900">{formatCurrency(b.amount)}</strong>
                      <button type="button" onClick={() => handleDeleteAssignedBenefit(b.id)} className="p-1 text-slate-400 hover:text-rose-600">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ABA 4: FARDAMENTO & EPI (DIRETO DE INVENTORY_MOVEMENTS) */}
        {activeTab === 'fardamentos' && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-white border border-slate-200 rounded-3xl text-center shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Botina</span>
                <strong className="text-xl font-black text-slate-900">{employee.boot_size || '—'}</strong>
              </div>
              <div className="p-4 bg-white border border-slate-200 rounded-3xl text-center shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Camisa</span>
                <strong className="text-xl font-black text-slate-900 uppercase">{employee.uniform_shirt_size || '—'}</strong>
              </div>
              <div className="p-4 bg-white border border-slate-200 rounded-3xl text-center shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Calça</span>
                <strong className="text-xl font-black text-slate-900">{employee.uniform_pants_size || '—'}</strong>
              </div>
            </div>

            {employee.notes && (
              <div className="p-4 bg-white border border-slate-200 rounded-3xl space-y-1 shadow-2xs text-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Observações</span>
                <p className="text-slate-700 leading-relaxed">{employee.notes}</p>
              </div>
            )}

            {/* Ficha de Cautela Nominal */}
            <div className="p-5 bg-white border border-slate-200 rounded-3xl space-y-4 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="font-extrabold text-slate-900 text-xs block uppercase tracking-wider">
                    Ficha de Cautela & Entregas de EPI (NR-06)
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Equipamentos entregues nominalmente via Almoxarifado Central.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPrintModalOpen(true)}
                    disabled={epiMovements.length === 0}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    title="Imprimir folha A4 com declaração da NR-06 para assinatura do colaborador"
                  >
                    <Printer size={14} />
                    <span>Imprimir Termo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsMovementModalOpen(true)}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-98 transition"
                  >
                    <Plus size={14} />
                    <span>+ Entregar EPI</span>
                  </button>
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 bg-white">
                {loadingEpis ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    <Loader2 size={16} className="animate-spin mx-auto mb-2 text-sky-600" />
                    Carregando cautela do almoxarifado...
                  </div>
                ) : epiMovements.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 italic">
                    Nenhum EPI entregue a este colaborador ainda.
                  </div>
                ) : (
                  epiMovements.map(mov => (
                    <div key={mov.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 text-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center shrink-0">
                          <HardHat size={16} />
                        </div>
                        <div className="min-w-0">
                          <strong className="font-bold text-slate-900 block truncate">
                            {mov.quantity}x {mov.item?.name || 'Equipamento'} {mov.size ? `(Tam. ${mov.size})` : ''}
                          </strong>
                          <span className="text-[10px] text-slate-400 block truncate">
                            {mov.item?.ca_number ? `CA: ${mov.item.ca_number}` : 'Sem CA'}
                            {mov.notes ? ` • ${mov.notes}` : ''}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {new Date(mov.created_at).toLocaleDateString('pt-BR')}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteEpiMovement(mov)}
                          className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer transition"
                          title="Estornar entrega e devolver saldo ao Almoxarifado"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ABA 5: HISTÓRICO SALARIAL */}
        {activeTab === 'salario' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between p-5 bg-white border border-slate-200 rounded-3xl shadow-2xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Salário Atual</span>
                <strong className="text-xl font-black text-slate-900">
                  {formatCurrency(employee.base_salary || 0)} ({employee.salary_type || 'mensal'})
                </strong>
              </div>

              {!showAddSalaryChange && (
                <button
                  type="button"
                  onClick={() => setShowAddSalaryChange(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-2xs cursor-pointer"
                >
                  + Novo Reajuste
                </button>
              )}
            </div>

            {showAddSalaryChange && (
              <form onSubmit={handleAddSalaryChange} className="p-5 bg-emerald-50/50 border border-emerald-200 rounded-3xl space-y-3 text-xs">
                <span className="font-bold text-emerald-950 block">Novo Reajuste Individual</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Novo Salário (R$)"
                    value={newSalaryValue}
                    onChange={e => setNewSalaryValue(e.target.value)}
                    className="px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold"
                  />
                  <select
                    value={salaryChangeReason}
                    onChange={e => setSalaryChangeReason(e.target.value)}
                    className="px-3 py-2 bg-white border border-slate-300 rounded-xl"
                  >
                    <option value="promocao">Promoção</option>
                    <option value="merito">Mérito</option>
                    <option value="dissidio">Dissídio</option>
                  </select>
                  <input
                    type="date"
                    value={salaryChangeDate}
                    onChange={e => setSalaryChangeDate(e.target.value)}
                    className="px-3 py-2 bg-white border border-slate-300 rounded-xl"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setShowAddSalaryChange(false)} className="px-3 py-1.5 text-slate-600 font-semibold cursor-pointer">
                    Cancelar
                  </button>
                  <button type="submit" disabled={savingSalaryChange || !newSalaryValue} className="px-4 py-1.5 bg-emerald-600 text-white rounded-xl font-bold cursor-pointer">
                    Confirmar Reajuste
                  </button>
                </div>
              </form>
            )}

            <div className="border border-slate-200 rounded-3xl overflow-hidden divide-y divide-slate-100 bg-white shadow-2xs">
              {loadingSalaryHistory ? (
                <div className="p-8 text-center text-xs text-slate-400">Carregando histórico...</div>
              ) : empSalaryHistory.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 italic">Nenhum reajuste salarial registrado.</div>
              ) : (
                empSalaryHistory.map(hist => (
                  <div key={hist.id} className="p-4 flex items-center justify-between text-xs">
                    <div>
                      <strong className="block text-slate-900 font-bold capitalize">{hist.change_type}</strong>
                      <span className="text-[10px] text-slate-400">{new Date(hist.effective_date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 line-through block">{formatCurrency(hist.previous_salary)}</span>
                      <strong className="text-emerald-700 font-black text-xs block">{formatCurrency(hist.new_salary)}</strong>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </main>

      {/* MODAL DE CONFIRMAÇÃO DE AÇÃO */}
      {actionConfirm && (
        <div className="fixed inset-0 z-[360] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-3 animate-in zoom-in-95 duration-150">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto border ${
              actionConfirm === 'desligar' 
                ? 'bg-rose-50 text-rose-600 border-rose-100' 
                : actionConfirm === 'remover_acesso'
                ? 'bg-amber-50 text-amber-600 border-amber-100'
                : actionConfirm === 'ferias'
                ? 'bg-amber-50 text-amber-600 border-amber-100'
                : actionConfirm === 'afastar'
                ? 'bg-purple-50 text-purple-600 border-purple-100'
                : 'bg-emerald-50 text-emerald-600 border-emerald-100'
            }`}>
              {actionConfirm === 'desligar' ? (
                <UserMinus size={22} />
              ) : actionConfirm === 'remover_acesso' ? (
                <ShieldBan size={22} />
              ) : actionConfirm === 'ferias' ? (
                <Sun size={22} />
              ) : actionConfirm === 'afastar' ? (
                <AlertOctagon size={22} />
              ) : (
                <RotateCcw size={22} />
              )}
            </div>

            <h4 className="font-bold text-slate-900 text-sm">
              {actionConfirm === 'desligar' 
                ? 'Confirmar Desligamento' 
                : actionConfirm === 'remover_acesso'
                ? 'Revogar Acesso ao Sistema'
                : actionConfirm === 'ferias'
                ? 'Registrar Início de Férias'
                : actionConfirm === 'afastar'
                ? 'Registrar Afastamento / INSS'
                : 'Reativar Colaborador'}
            </h4>

            <p className="text-xs text-slate-500 leading-relaxed">
              Deseja alterar a situação de <strong className="text-slate-900">"{employee.full_name}"</strong>?
              {actionConfirm === 'desligar' && (
                <span className="block mt-1 text-rose-600 font-semibold text-[11px]">
                  O histórico completo permanece intacto. O colaborador será marcado como desligado e seu login revogado.
                </span>
              )}
              {actionConfirm === 'remover_acesso' && (
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
                  actionConfirm === 'desligar' 
                    ? 'bg-rose-600 hover:bg-rose-500' 
                    : actionConfirm === 'remover_acesso'
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

      {/* MODAL DE ENTREGA DE EPI DIRETO DO ALMOXARIFADO */}
      {isMovementModalOpen && (
        <InventoryMovementModal
          isOpen={isMovementModalOpen}
          onClose={() => setIsMovementModalOpen(false)}
          onSuccess={() => {
            setIsMovementModalOpen(false);
            loadEpiMovements();
          }}
          allItems={allItems}
          defaultMovementType="saida_epi"
          defaultRecipientId={employee.user_id || employee.id}
          defaultRecipientName={employee.full_name}
        />
      )}

      {/* MODAL DE IMPRESSÃO DA FICHA DE CAUTELA (NR-06) */}
      {isPrintModalOpen && (
        <PrintEpiTermModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          employee={employee}
          movements={epiMovements}
        />
      )}

    </div>
  );
};

export default EmployeeDetailPage;