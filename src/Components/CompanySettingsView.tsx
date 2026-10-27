import React, { useState, useEffect, useRef, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { usePermissions } from '../hooks/usePermissions';
import { supabase } from '../lib/supabase';
import { 
  Building2, 
  Camera, 
  MapPin, 
  Mail, 
  Phone, 
  FileText, 
  CheckCircle2, 
  Save, 
  Loader2, 
  Users, 
  ShieldCheck, 
  Plus, 
  UserPlus, 
  X, 
  Send, 
  UserCheck, 
  Clock, 
  Briefcase, 
  Check, 
  Edit2, 
  Trash2, 
  Lock, 
  Eye, 
  ZoomIn,
  MoreVertical,
  UserCog,
  UserMinus,
  Link2,
  Kanban,
  ChevronUp,
  ChevronDown,
  Edit3,
  AlertTriangle,
  RotateCcw,
  Package,
  Percent,
  Network,
  Crown,
  UserCheck2
} from 'lucide-react';

interface CropArea {
  width: number;
  height: number;
  x: number;
  y: number;
}

interface CompanySettingsViewProps {
  companyId: string;
  onCompanyUpdated?: (name: string, logoUrl?: string) => void;
}

export interface TeamMember {
  id: string;
  user_id?: string;
  full_name: string;
  email: string;
  role_title?: string;
  access_role: string;
  avatar_url?: string | null;
  status: 'active' | 'invited' | 'inactive';
  team_id?: string | null;
  team_name?: string | null;
  department_name?: string | null;
  token?: string;
  created_at?: string;
}

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

export interface TeamItem {
  id: string;
  company_id: string;
  department_id?: string | null;
  name: string;
  description?: string | null;
  color?: string | null;
  leader_id?: string | null;
  leader?: {
    id: string;
    full_name: string;
    avatar_url?: string | null;
  } | null;
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

export interface PipelineStageConfig {
  id: string;
  company_id?: string;
  pipeline_id?: string;
  name: string;
  color: string;
  sort_order: number;
  default_probability?: number;
}

export interface CompanyServiceType {
  id: string;
  name: string;
  sort_order: number;
}

export interface CatalogItem {
  id: string;
  name: string;
  item_type: 'equipamento' | 'material' | 'servico' | 'outros';
  unit: string;
  cost_price: number;
  markup_percent: number;
  sale_price: number;
  notes?: string | null;
  is_active: boolean;
}

// 5 MÓDULOS COM SUPORTE COMPLETO A RH & PESSOAS
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
  { id: 'hr_salaries_manage', label: 'Visualizar e alterar salários, remunerações e benefícios', category: 'RH & Pessoas', dependsOn: 'hr_view' },
  { id: 'hr_admissions_leaves', label: 'Gerenciar admissões, desligamentos e afastamentos', category: 'RH & Pessoas', dependsOn: 'hr_view' },

  // --- 5. MÓDULO: GESTÃO DA EMPRESA ---
  { id: 'company_settings', label: 'Alterar dados fiscais, logotipo e endereço', category: 'Gestão da Empresa' },
  { id: 'team_manage', label: 'Gerenciar equipe, setores e equipes operacionais', category: 'Gestão da Empresa' },
  { id: 'custom_fields_manage', label: 'Personalizar funil, serviços e catálogo de itens', category: 'Gestão da Empresa' },
];

const CATEGORIES: ('Contatos' | 'Oportunidades' | 'Obras' | 'RH & Pessoas' | 'Gestão da Empresa')[] = [
  'Contatos',
  'Oportunidades',
  'Obras',
  'RH & Pessoas',
  'Gestão da Empresa'
];

const sendNotification = async (payload: {
  userId: string;
  companyId: string;
  title: string;
  message: string;
  category: string;
  actionUrl?: string;
}) => {
  try {
    await supabase.rpc('create_notification_checked', {
      p_user_id: payload.userId,
      p_company_id: payload.companyId,
      p_title: payload.title,
      p_message: payload.message,
      p_category: payload.category,
      p_action_url: payload.actionUrl || null,
      p_entity_id: null,
      p_entity_type: null,
    });
  } catch (err) {
    console.warn('[CompanySettingsView] Falha silenciosa ao enviar notificação:', err);
  }
};

const parsePtBrCurrency = (val: string): number => {
  if (!val) return 0;
  const clean = val.replace(/\./g, '').replace(',', '.');
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
};

const formatCurrency = (val: number | null | undefined): string => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
};

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

async function getCroppedImg(
  imageSrc: string,
  pixelCrop: CropArea
): Promise<{ blob: Blob; url: string }> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Falha ao obter contexto 2D do Canvas.');
  }

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas vazio.'));
        return;
      }
      const url = URL.createObjectURL(blob);
      resolve({ blob, url });
    }, 'image/png');
  });
}

const maskCNPJ = (value: string) => {
  return value
    .replace(/\D/g, '')
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};

const maskPhone = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
};

const maskCEP = (value: string) => {
  return value
    .replace(/\D/g, '')
    .slice(0, 8)
    .replace(/^(\d{5})(\d)/, '$1-$2');
};

export const CompanySettingsView: React.FC<CompanySettingsViewProps> = ({ 
  companyId, 
  onCompanyUpdated 
}) => {
  const { permissions } = usePermissions();

  const [activeTab, setActiveTab] = useState<'geral' | 'organizacao' | 'funil' | 'servicos' | 'catalogo' | 'membros' | 'acessos'>('geral');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchingCep, setSearchingCep] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (permissions.isOwnerOrAdmin) return;
    if (activeTab === 'geral' && !permissions.canManageCompanySettings) {
      if (permissions.canCustomizeSystem) {
        setActiveTab('funil');
      } else if (permissions.canManageTeam) {
        setActiveTab('membros');
      }
    }
  }, [permissions, activeTab]);

  // Dados Fiscais e Cadastrais
  const [corporateName, setCorporateName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [stateRegistration, setStateRegistration] = useState('');
  const [commercialEmail, setCommercialEmail] = useState('');
  const [commercialPhone, setCommercialPhone] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Recorte da Logomarca
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);
  const [isCropping, setIsCropping] = useState(false);

  // Endereço
  const [cep, setCep] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  // Setores e Equipes (Organização)
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [loadingOrg, setLoadingOrg] = useState(false);

  // Modais de Setor
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [deptFormName, setDeptFormName] = useState('');
  const [deptFormDesc, setDeptFormDesc] = useState('');
  const [deptFormColor, setDeptFormColor] = useState('#0ea5e9');
  const [deptFormManagerId, setDeptFormManagerId] = useState<string>('');
  const [savingDept, setSavingDept] = useState(false);
  const [deptToDelete, setDeptToDelete] = useState<DepartmentItem | null>(null);
  const [deletingDept, setDeletingDept] = useState(false);

  // Modais de Equipe
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [teamFormName, setTeamFormName] = useState('');
  const [teamFormDesc, setTeamFormDesc] = useState('');
  const [teamFormDeptId, setTeamFormDeptId] = useState<string>('');
  const [teamFormLeaderId, setTeamFormLeaderId] = useState<string>('');
  const [savingTeam, setSavingTeam] = useState(false);
  const [teamToDelete, setTeamToDelete] = useState<TeamItem | null>(null);
  const [deletingTeam, setDeletingTeam] = useState(false);

  // Funil Comercial
  const [stages, setStages] = useState<PipelineStageConfig[]>([]);
  const [loadingStages, setLoadingStages] = useState(false);
  const [isEditingStageModal, setIsEditingStageModal] = useState(false);
  const [editingStage, setEditingStage] = useState<Partial<PipelineStageConfig> | null>(null);
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [stageToDelete, setStageToDelete] = useState<PipelineStageConfig | null>(null);
  const [deletingStage, setDeletingStage] = useState(false);
  const [stageOppCount, setStageOppCount] = useState<number>(0);
  const [checkingStageOpps, setCheckingStageOpps] = useState(false);

  // Tipos de Serviços
  const [services, setServices] = useState<CompanyServiceType[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [savingService, setSavingService] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editingServiceName, setEditingServiceName] = useState('');
  const [isAddServiceModalOpen, setIsAddServiceModalOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<CompanyServiceType | null>(null);
  const [deletingService, setDeletingService] = useState(false);

  // Catálogo de Itens
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [savingCatalogItem, setSavingCatalogItem] = useState(false);
  const [itemFormId, setItemFormId] = useState<string | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemType, setItemType] = useState<'equipamento' | 'material' | 'servico' | 'outros'>('equipamento');
  const [itemUnit, setItemUnit] = useState('un');
  const [itemCostPrice, setItemCostPrice] = useState('');
  const [itemMarkupPercent, setItemMarkupPercent] = useState('30');
  const [itemSalePrice, setItemSalePrice] = useState('');
  const [itemNotes, setItemNotes] = useState('');
  const [showCatalogModal, setShowCatalogModal] = useState(false);

  // Equipe & Membros
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [currentLoggedUserId, setCurrentLoggedUserId] = useState<string | null>(null);
  const [memberToDeactivate, setMemberToDeactivate] = useState<TeamMember | null>(null);
  const [deactivatingMember, setDeactivatingMember] = useState(false);

  const [activeDropdownMemberId, setActiveDropdownMemberId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Modais de Convite e Edição de Membro
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRoleTitle, setInviteRoleTitle] = useState('');
  const [inviteAccessRole, setInviteAccessRole] = useState('');
  const [inviteTeamId, setInviteTeamId] = useState<string>('');

  const [isEditMemberModalOpen, setIsEditMemberModalOpen] = useState(false);
  const [memberToEdit, setMemberToEdit] = useState<TeamMember | null>(null);
  const [editMemberRole, setEditMemberRole] = useState('');
  const [editMemberTeamId, setEditMemberTeamId] = useState('');
  const [savingMemberEdit, setSavingMemberEdit] = useState(false);

  // Níveis de Acesso
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [savingRole, setSavingRole] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<RoleDefinition | null>(null);
  const [deletingRole, setDeletingRole] = useState(false);

  // Modal de Nível de Acesso
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleFormName, setRoleFormName] = useState('');
  const [roleFormDescription, setRoleFormDescription] = useState('');
  const [roleFormPermissions, setRoleFormPermissions] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdownMemberId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    async function loadCompanyData() {
      if (!companyId) return;
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('companies')
          .select('*')
          .eq('id', companyId)
          .single();

        if (error) {
          console.error('Erro ao carregar empresa:', error.message);
        } else if (data) {
          setCorporateName(data.corporate_name || data.name || '');
          setTradeName(data.trade_name || data.name || '');
          setCnpj(maskCNPJ(data.document || data.cnpj || ''));
          setStateRegistration(data.state_registration || '');
          setCommercialEmail(data.commercial_email || '');
          setCommercialPhone(maskPhone(data.commercial_phone || ''));
          setLogoUrl(data.logo_url || null);

          setCep(maskCEP(data.cep || ''));
          setStreet(data.street || '');
          setNumber(data.number || '');
          setComplement(data.complement || '');
          setNeighborhood(data.neighborhood || '');
          setCity(data.city || '');
          setState((data.state || '').toUpperCase());
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadCompanyData();
  }, [companyId]);

  const loadOrganizationData = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoadingOrg(true);

      const [deptRes, teamRes] = await Promise.all([
        supabase
          .from('company_departments')
          .select(`
            id, company_id, name, description, color, manager_id,
            manager:profiles!manager_id(id, full_name, avatar_url)
          `)
          .eq('company_id', companyId)
          .order('name', { ascending: true }),
        supabase
          .from('company_teams')
          .select(`
            id, company_id, department_id, name, description, color, leader_id,
            leader:profiles!leader_id(id, full_name, avatar_url)
          `)
          .eq('company_id', companyId)
          .order('name', { ascending: true })
      ]);

      const loadedDepts: DepartmentItem[] = (deptRes.data || []).map((d: any) => ({
        ...d,
        manager: Array.isArray(d.manager) ? d.manager[0] : d.manager
      }));

      const loadedTeams: TeamItem[] = (teamRes.data || []).map((t: any) => ({
        ...t,
        leader: Array.isArray(t.leader) ? t.leader[0] : t.leader
      }));

      setDepartments(loadedDepts);
      setTeams(loadedTeams);

      if (loadedDepts.length > 0 && !selectedDepartmentId) {
        setSelectedDepartmentId(loadedDepts[0].id);
      }
    } catch (err) {
      console.error('Erro ao carregar organização:', err);
    } finally {
      setLoadingOrg(false);
    }
  }, [companyId, selectedDepartmentId]);

  useEffect(() => {
    if (activeTab === 'organizacao') {
      loadOrganizationData();
    }
  }, [activeTab, loadOrganizationData]);

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
        const { data, error } = await supabase
          .from('company_departments')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        if (data) setSelectedDepartmentId(data.id);
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
      setSelectedDepartmentId(null);
      await loadOrganizationData();
    } catch (err: any) {
      alert('Erro ao excluir setor: ' + err.message);
    } finally {
      setDeletingDept(false);
    }
  };

  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamFormName.trim() || !companyId) return;

    try {
      setSavingTeam(true);
      const payload = {
        company_id: companyId,
        department_id: teamFormDeptId || selectedDepartmentId || null,
        name: teamFormName.trim(),
        description: teamFormDesc.trim() || null,
        leader_id: teamFormLeaderId || null,
        updated_at: new Date().toISOString()
      };

      if (editingTeamId) {
        const { error } = await supabase
          .from('company_teams')
          .update(payload)
          .eq('id', editingTeamId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('company_teams')
          .insert(payload);
        if (error) throw error;
      }

      setIsTeamModalOpen(false);
      setEditingTeamId(null);
      await loadOrganizationData();
    } catch (err: any) {
      alert('Erro ao salvar equipe: ' + err.message);
    } finally {
      setSavingTeam(false);
    }
  };

  const handleConfirmDeleteTeam = async () => {
    if (!teamToDelete) return;
    try {
      setDeletingTeam(true);
      const { error } = await supabase
        .from('company_teams')
        .delete()
        .eq('id', teamToDelete.id);

      if (error) throw error;
      setTeamToDelete(null);
      await loadOrganizationData();
    } catch (err: any) {
      alert('Erro ao excluir equipe: ' + err.message);
    } finally {
      setDeletingTeam(false);
    }
  };

  const loadStages = async () => {
    if (!companyId) return;
    try {
      setLoadingStages(true);

      let { data: pipeline } = await supabase
        .from('commercial_pipelines')
        .select('id')
        .eq('company_id', companyId)
        .order('is_default', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!pipeline) {
        const { data: newPipe } = await supabase
          .from('commercial_pipelines')
          .insert({
            company_id: companyId,
            name: 'Funil Padrão',
            is_default: true,
          })
          .select('id')
          .single();
        pipeline = newPipe;
      }

      if (pipeline?.id) {
        setPipelineId(pipeline.id);

        const { data: stagesData, error: stagesError } = await supabase
          .from('commercial_pipeline_stages')
          .select('*')
          .eq('pipeline_id', pipeline.id)
          .order('sort_order', { ascending: true });

        if (stagesError) throw stagesError;
        setStages(stagesData || []);
      }
    } catch (err) {
      console.error('Erro ao carregar etapas do funil:', err);
    } finally {
      setLoadingStages(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'funil') {
      loadStages();
    }
  }, [activeTab, companyId]);

  const loadCompanyServices = async () => {
    if (!companyId) return;
    try {
      setLoadingServices(true);
      const { data, error } = await supabase
        .from('company_service_types')
        .select('id, name, sort_order')
        .eq('company_id', companyId)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setServices(data || []);
    } catch (err) {
      console.error('Erro ao buscar serviços:', err);
    } finally {
      setLoadingServices(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'servicos') {
      loadCompanyServices();
    }
  }, [activeTab, companyId]);

  const loadCatalogItems = async () => {
    if (!companyId) return;
    try {
      setLoadingCatalog(true);
      const { data, error } = await supabase
        .from('company_catalog_items')
        .select('id, name, item_type, unit, cost_price, markup_percent, sale_price, notes, is_active')
        .eq('company_id', companyId)
        .order('name', { ascending: true });

      if (error) throw error;
      setCatalogItems((data as CatalogItem[]) || []);
    } catch (err) {
      console.error('Erro ao buscar itens do catálogo:', err);
    } finally {
      setLoadingCatalog(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'catalogo') {
      loadCatalogItems();
    }
  }, [activeTab, companyId]);

  const handleCostOrMarkupChange = (newCostStr: string, newMarkupStr: string) => {
    setItemCostPrice(newCostStr);
    setItemMarkupPercent(newMarkupStr);

    const cost = parsePtBrCurrency(newCostStr);
    const markup = parseFloat(newMarkupStr) || 0;

    if (cost > 0) {
      const calculatedSale = cost * (1 + markup / 100);
      setItemSalePrice(calculatedSale.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    }
  };

  const handleSalePriceChange = (newSaleStr: string) => {
    setItemSalePrice(newSaleStr);

    const sale = parsePtBrCurrency(newSaleStr);
    const cost = parsePtBrCurrency(itemCostPrice);

    if (cost > 0 && sale >= cost) {
      const calculatedMarkup = ((sale - cost) / cost) * 100;
      setItemMarkupPercent(calculatedMarkup.toFixed(2));
    }
  };

  const handleOpenCatalogModal = (item?: CatalogItem) => {
    if (item) {
      setItemFormId(item.id);
      setItemName(item.name);
      setItemType(item.item_type || 'equipamento');
      setItemUnit(item.unit || 'un');
      setItemCostPrice(item.cost_price ? item.cost_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
      setItemMarkupPercent(item.markup_percent !== undefined ? String(item.markup_percent) : '30');
      setItemSalePrice(item.sale_price ? item.sale_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
      setItemNotes(item.notes || '');
    } else {
      setItemFormId(null);
      setItemName('');
      setItemType('equipamento');
      setItemUnit('un');
      setItemCostPrice('');
      setItemMarkupPercent('30');
      setItemSalePrice('');
      setItemNotes('');
    }
    setShowCatalogModal(true);
  };

  const handleSaveCatalogItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !itemName.trim()) return;

    try {
      setSavingCatalogItem(true);
      const cost = parsePtBrCurrency(itemCostPrice);
      const markup = parseFloat(itemMarkupPercent) || 0;
      const sale = itemSalePrice ? parsePtBrCurrency(itemSalePrice) : (cost * (1 + markup / 100));

      const payload = {
        company_id: companyId,
        name: itemName.trim(),
        item_type: itemType,
        unit: itemUnit.trim() || 'un',
        cost_price: cost,
        markup_percent: markup,
        sale_price: sale,
        notes: itemNotes.trim() || null,
        updated_at: new Date().toISOString()
      };

      if (itemFormId) {
        const { error } = await supabase
          .from('company_catalog_items')
          .update(payload)
          .eq('id', itemFormId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('company_catalog_items')
          .insert(payload);
        if (error) throw error;
      }

      setShowCatalogModal(false);
      await loadCatalogItems();
    } catch (err: any) {
      alert(`Erro ao salvar item do catálogo: ${err.message}`);
    } finally {
      setSavingCatalogItem(false);
    }
  };

  const handleDeleteCatalogItem = async (id: string, name: string) => {
    if (!window.confirm(`Deseja remover "${name}" do catálogo de itens?`)) return;
    try {
      const { error } = await supabase
        .from('company_catalog_items')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await loadCatalogItems();
    } catch (err: any) {
      alert(`Erro ao excluir item: ${err.message || ''}`);
    }
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName.trim() || !companyId) return;
    try {
      setSavingService(true);
      const nextOrder = services.length > 0 ? Math.max(...services.map(s => s.sort_order || 0)) + 1 : 1;
      const { error } = await supabase
        .from('company_service_types')
        .insert({
          company_id: companyId,
          name: newServiceName.trim(),
          sort_order: nextOrder
        });

      if (error) {
        if (error.code === '23505') {
          alert('Já existe um serviço cadastrado com este nome.');
          return;
        }
        throw error;
      }

      setNewServiceName('');
      setIsAddServiceModalOpen(false);
      await loadCompanyServices();
    } catch (err: any) {
      console.error('Erro ao adicionar serviço:', err);
      alert('Não foi possível salvar o tipo de serviço.');
    } finally {
      setSavingService(false);
    }
  };

  const handleUpdateService = async (id: string) => {
    if (!editingServiceName.trim() || !companyId) return;
    try {
      const { error } = await supabase
        .from('company_service_types')
        .update({ 
          name: editingServiceName.trim(),
          company_id: companyId
        })
        .eq('id', id);

      if (error) {
        if (error.code === '23505') {
          alert('Já existe outro serviço com esse nome.');
          return;
        }
        throw error;
      }

      setEditingServiceId(null);
      await loadCompanyServices();
    } catch (err: any) {
      console.error('Erro ao atualizar serviço:', err);
      alert(`Erro ao atualizar: ${err.message || 'Falha na requisição'}`);
    }
  };

  const handleConfirmDeleteService = async () => {
    if (!serviceToDelete) return;
    try {
      setDeletingService(true);
      const { error } = await supabase
        .from('company_service_types')
        .delete()
        .eq('id', serviceToDelete.id);

      if (error) throw error;
      setServices(prev => prev.filter(s => s.id !== serviceToDelete.id));
      setServiceToDelete(null);
    } catch (err: any) {
      console.error('Erro ao excluir serviço:', err);
      alert('Erro ao excluir tipo de serviço.');
    } finally {
      setDeletingService(false);
    }
  };

  const handleMoveStage = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= stages.length) return;

    const newStages = [...stages];
    const current = newStages[index];
    const target = newStages[targetIndex];

    const tempOrder = current.sort_order;
    current.sort_order = target.sort_order;
    target.sort_order = tempOrder;

    newStages[index] = target;
    newStages[targetIndex] = current;
    setStages(newStages);

    try {
      await supabase
        .from('commercial_pipeline_stages')
        .upsert([
          { id: current.id, sort_order: current.sort_order },
          { id: target.id, sort_order: target.sort_order }
        ]);
    } catch (err) {
      console.error('Erro ao reordenar etapa:', err);
      loadStages();
    }
  };

  const handleSaveStageModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStage?.name?.trim() || !pipelineId) return;

    try {
      if (editingStage.id) {
        const { error } = await supabase
          .from('commercial_pipeline_stages')
          .update({
            name: editingStage.name.trim(),
            color: editingStage.color || '#0ea5e9',
            default_probability: editingStage.default_probability || 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingStage.id);

        if (error) throw error;
      } else {
        const nextOrder = stages.length > 0 ? Math.max(...stages.map(s => s.sort_order)) + 1 : 1;
        const { error } = await supabase
          .from('commercial_pipeline_stages')
          .insert({
            company_id: companyId,
            pipeline_id: pipelineId,
            name: editingStage.name.trim(),
            color: editingStage.color || '#0ea5e9',
            sort_order: nextOrder,
            default_probability: editingStage.default_probability || 0
          });

        if (error) throw error;
      }

      setIsEditingStageModal(false);
      setEditingStage(null);
      loadStages();
    } catch (err) {
      console.error('Erro ao salvar etapa do funil:', err);
    }
  };

  const handleOpenDeleteStage = async (stage: PipelineStageConfig) => {
    try {
      setCheckingStageOpps(true);
      const { count, error } = await supabase
        .from('opportunities')
        .select('*', { count: 'exact', head: true })
        .eq('stage_id', stage.id);

      if (error) throw error;

      setStageOppCount(count || 0);
      setStageToDelete(stage);
    } catch (err) {
      console.error('Erro ao verificar oportunidades da etapa:', err);
      setStageOppCount(0);
      setStageToDelete(stage);
    } finally {
      setCheckingStageOpps(false);
    }
  };

  const handleConfirmDeleteStage = async () => {
    if (!stageToDelete || stageOppCount > 0) return;

    if (stages.length <= 1) {
      alert('O funil precisa manter ao menos 1 etapa.');
      setStageToDelete(null);
      return;
    }

    try {
      setDeletingStage(true);
      const { error } = await supabase
        .from('commercial_pipeline_stages')
        .delete()
        .eq('id', stageToDelete.id);

      if (error) throw error;

      setStages(prev => prev.filter(s => s.id !== stageToDelete.id));
      setStageToDelete(null);
    } catch (err: any) {
      console.error('Erro ao excluir etapa:', err);
      alert(`Não foi possível excluir a etapa: ${err.message || ''}`);
    } finally {
      setDeletingStage(false);
    }
  };

  const fetchRoles = async () => {
    if (!companyId) return;
    try {
      setLoadingRoles(true);
      const { data, error } = await supabase
        .from('company_roles')
        .select('*')
        .eq('company_id', companyId)
        .order('is_system', { ascending: false });

      if (error) {
        console.error('Erro ao carregar company_roles:', error.message);
        return;
      }

      if (data && data.length > 0) {
        const formatted: RoleDefinition[] = data.map((r: any) => ({
          id: r.id,
          name: r.name,
          description: r.description || '',
          is_system: r.is_system,
          permissions: Array.isArray(r.permissions) ? r.permissions : []
        }));
        setRoles(formatted);
        if (!inviteAccessRole && formatted.length > 0) {
          setInviteAccessRole(formatted[0].id);
        }
      } else {
        const initialRoles = [
          {
            company_id: companyId,
            name: 'Administrador',
            description: 'Acesso total irrestrito a configurações, dados fiscais, equipe, finanças e RH.',
            is_system: true,
            permissions: AVAILABLE_PERMISSIONS.map(p => p.id)
          },
          {
            company_id: companyId,
            name: 'Comercial / Vendas',
            description: 'Gerencia contatos, funil de vendas e emite propostas sem acesso a margens de lucro.',
            is_system: false,
            permissions: ['contacts_view', 'contacts_edit', 'kanban_view', 'kanban_edit', 'kanban_close', 'proposals_issue']
          },
          {
            company_id: companyId,
            name: 'Técnico / Obras',
            description: 'Acompanhamento de obras, tarefas de campo e consulta de cadastros de clientes.',
            is_system: false,
            permissions: ['contacts_view', 'contacts_edit', 'works_view', 'work_items_manage', 'work_tasks_complete', 'work_schedule_view']
          },
          {
            company_id: companyId,
            name: 'Gestão de Pessoas / RH',
            description: 'Acesso às fichas de colaboradores, admissões, férias e gestão de benefícios e remuneração.',
            is_system: false,
            permissions: ['hr_view', 'hr_employees_manage', 'hr_salaries_manage', 'hr_admissions_leaves']
          }
        ];

        const { data: insertedData } = await supabase
          .from('company_roles')
          .insert(initialRoles)
          .select();

        if (insertedData) {
          const formatted: RoleDefinition[] = insertedData.map((r: any) => ({
            id: r.id,
            name: r.name,
            description: r.description || '',
            is_system: r.is_system,
            permissions: Array.isArray(r.permissions) ? r.permissions : []
          }));
          setRoles(formatted);
          setInviteAccessRole(formatted[0]?.id || '');
        }
      }
    } catch (err) {
      console.error('Erro na requisição de roles:', err);
    } finally {
      setLoadingRoles(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, [companyId]);

  const fetchMembers = async () => {
    if (!companyId) return;

    try {
      setLoadingMembers(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData.session?.user?.id;
      setCurrentLoggedUserId(currentUserId || null);

      const { data: membersData, error: membersError } = await supabase
        .from('memberships')
        .select(`
          id,
          role,
          status,
          created_at,
          team_id,
          team:company_teams!team_id (
            id,
            name,
            department:company_departments!department_id (
              name
            )
          ),
          profile:profiles!profile_id (
            id,
            full_name,
            email,
            role_title,
            access_role,
            avatar_url
          )
        `)
        .eq('company_id', companyId);

      if (membersError) {
        console.error('Erro ao buscar membros na tabela memberships:', membersError.message);
      }

      const { data: invitesData, error: invitesError } = await supabase
        .from('company_invites')
        .select('*')
        .eq('company_id', companyId)
        .eq('status', 'pending');

      if (invitesError) {
        console.error('Erro ao buscar convites pendentes:', invitesError.message);
      }

      const allMembers: TeamMember[] = [];

      if (membersData && membersData.length > 0) {
        membersData.forEach((item: any) => {
          const prof = item.profile || {};
          const isInactive = item.status === 'inativo' || item.status === 'inactive';
          const teamObj = Array.isArray(item.team) ? item.team[0] : item.team;
          const deptObj = teamObj ? (Array.isArray(teamObj.department) ? teamObj.department[0] : teamObj.department) : null;

          allMembers.push({
            id: item.id,
            user_id: prof.id,
            full_name: prof.full_name || 'Usuário Sem Nome',
            email: prof.email || '—',
            role_title: prof.role_title || (item.role === 'owner' || item.role === 'admin' ? 'Administrador' : 'Colaborador'),
            access_role: prof.access_role || (item.role === 'owner' || item.role === 'admin' ? 'Administrador' : 'Colaborador'),
            avatar_url: prof.avatar_url || null,
            status: isInactive ? 'inactive' : 'active',
            team_id: item.team_id || null,
            team_name: teamObj?.name || null,
            department_name: deptObj?.name || null,
            created_at: item.created_at
          });
        });
      }

      if (invitesData && invitesData.length > 0) {
        invitesData.forEach((inv: any) => {
          allMembers.push({
            id: inv.id,
            full_name: inv.full_name || inv.email.split('@')[0],
            email: inv.email,
            role_title: inv.role_title || 'Colaborador',
            access_role: inv.role_id || 'Comercial',
            avatar_url: null,
            status: 'invited',
            team_id: inv.team_id || null,
            token: inv.token,
            created_at: inv.created_at
          });
        });
      }

      setMembers(allMembers);
    } catch (err) {
      console.error('Erro inesperado ao buscar membros e convites:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'membros' || activeTab === 'organizacao') {
      fetchMembers();
    }
  }, [activeTab, companyId]);

  const handleCepBlur = async () => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;

    try {
      setSearchingCep(true);
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setStreet(data.logradouro || '');
        setNeighborhood(data.bairro || '');
        setCity(data.localidade || '');
        setState((data.uf || '').toUpperCase());
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
    } finally {
      setSearchingCep(false);
    }
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setImageToCrop(reader.result as string);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const onCropComplete = useCallback((_: any, croppedPixels: CropArea) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleApplyCrop = async () => {
    if (!imageToCrop || !croppedAreaPixels) return;

    try {
      setIsCropping(true);
      const { blob, url } = await getCroppedImg(imageToCrop, croppedAreaPixels);

      setLogoUrl(url);
      setImageToCrop(null);

      const fileName = `${companyId}-logo-${Date.now()}.png`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(fileName, blob, { 
          contentType: 'image/png', 
          upsert: true 
        });

      if (!uploadError && uploadData) {
        const { data: publicUrlData } = supabase.storage
          .from('company-logos')
          .getPublicUrl(fileName);

        if (publicUrlData?.publicUrl) {
          const finalUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;
          setLogoUrl(finalUrl);
          await supabase
            .from('companies')
            .update({ logo_url: finalUrl })
            .eq('id', companyId);

          if (onCompanyUpdated) {
            onCompanyUpdated(tradeName || corporateName, finalUrl);
          }
        }
      }
    } catch (err) {
      console.error('Erro ao recortar logo:', err);
    } finally {
      setIsCropping(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setSaveSuccess(false);

      const updatePayload = {
        name: tradeName.trim() || corporateName.trim(),
        corporate_name: corporateName.trim(),
        trade_name: tradeName.trim(),
        document: cnpj.replace(/\D/g, ''),
        cnpj: cnpj.replace(/\D/g, ''),
        state_registration: stateRegistration.trim(),
        commercial_email: commercialEmail.trim(),
        commercial_phone: commercialPhone.trim(),
        logo_url: logoUrl,
        cep: cep.trim(),
        street: street.trim(),
        number: number.trim(),
        complement: complement.trim(),
        neighborhood: neighborhood.trim(),
        city: city.trim(),
        state: state.trim().toUpperCase(),
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('companies')
        .update(updatePayload)
        .eq('id', companyId);

      if (error) {
        console.error('Erro ao salvar empresa:', error);
        alert(`Erro ao salvar dados da empresa: ${error.message}`);
        return;
      }

      setSaveSuccess(true);
      if (onCompanyUpdated) {
        onCompanyUpdated(tradeName || corporateName, logoUrl || undefined);
      }
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      console.error('Falha na requisição:', err);
      alert('Ocorreu um erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    try {
      setInviting(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const inviterId = sessionData.session?.user?.id;

      const { data, error } = await supabase
        .from('company_invites')
        .insert({
          company_id: companyId,
          email: inviteEmail.trim().toLowerCase(),
          full_name: inviteName.trim() || inviteEmail.split('@')[0],
          role_title: inviteRoleTitle.trim() || 'Colaborador',
          role_id: inviteAccessRole,
          team_id: inviteTeamId || null,
          invited_by: inviterId
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          alert('Já existe um convite pendente para este e-mail nesta empresa.');
        } else {
          alert(`Erro ao enviar convite: ${error.message}`);
        }
        return;
      }

      if (data) {
        const matchedTeam = teams.find(t => t.id === data.team_id);
        const matchedDept = matchedTeam ? departments.find(d => d.id === matchedTeam.department_id) : null;

        const newMember: TeamMember = {
          id: data.id,
          full_name: data.full_name,
          email: data.email,
          role_title: data.role_title,
          access_role: data.role_id,
          avatar_url: null,
          status: 'invited',
          team_id: data.team_id,
          team_name: matchedTeam?.name || null,
          department_name: matchedDept?.name || null,
          token: data.token,
          created_at: data.created_at
        };
        setMembers((prev) => [newMember, ...prev]);
      }

      setIsInviteModalOpen(false);
      setInviteName('');
      setInviteEmail('');
      setInviteRoleTitle('');
      setInviteTeamId('');
    } catch (err) {
      console.error('Erro ao convidar colaborador:', err);
    } finally {
      setInviting(false);
    }
  };

  const handleCopyInviteLink = (token?: string) => {
    setActiveDropdownMemberId(null);
    if (!token) return;
    const inviteUrl = `${window.location.origin}/invite?token=${token}`;
    navigator.clipboard.writeText(inviteUrl);
    alert('Link de convite copiado para a área de transferência!');
  };

  const handleRevokeInvite = async (inviteId: string) => {
    setActiveDropdownMemberId(null);
    try {
      const { error } = await supabase
        .from('company_invites')
        .delete()
        .eq('id', inviteId);

      if (error) {
        alert(`Erro ao cancelar convite: ${error.message}`);
        return;
      }

      setMembers((prev) => prev.filter((m) => m.id !== inviteId));
    } catch (err) {
      console.error('Erro ao revogar convite:', err);
    }
  };

  const handleOpenEditMember = (member: TeamMember) => {
    setMemberToEdit(member);
    setEditMemberRole(member.access_role || (roles[0]?.id || ''));
    setEditMemberTeamId(member.team_id || '');
    setActiveDropdownMemberId(null);
    setIsEditMemberModalOpen(true);
  };

  const handleSaveMemberEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberToEdit) return;

    try {
      setSavingMemberEdit(true);
      const targetRoleName = roles.find(r => r.id === editMemberRole)?.name || 'Colaborador';
      const rolePayload = targetRoleName.toLowerCase().includes('admin') ? 'admin' : 'collaborator';

      if (memberToEdit.status === 'invited') {
        await supabase
          .from('company_invites')
          .update({
            role_id: editMemberRole,
            team_id: editMemberTeamId || null
          })
          .eq('id', memberToEdit.id);
      } else {
        if (memberToEdit.user_id) {
          await supabase
            .from('profiles')
            .update({ access_role: editMemberRole })
            .eq('id', memberToEdit.user_id);
        }

        await supabase
          .from('memberships')
          .update({
            role: rolePayload,
            team_id: editMemberTeamId || null
          })
          .eq('id', memberToEdit.id);

        if (memberToEdit.user_id && memberToEdit.user_id !== currentLoggedUserId) {
          await sendNotification({
            userId: memberToEdit.user_id,
            companyId,
            title: '🛡️ Nível de Acesso Atualizado',
            message: `Suas permissões e nível de acesso foram atualizados para "${targetRoleName}".`,
            category: 'access_change',
            actionUrl: '/settings'
          });
        }
      }

      const matchedTeam = teams.find(t => t.id === editMemberTeamId);
      const matchedDept = matchedTeam ? departments.find(d => d.id === matchedTeam.department_id) : null;

      setMembers(prev => prev.map(m => {
        if (m.id === memberToEdit.id) {
          return {
            ...m,
            access_role: editMemberRole,
            team_id: editMemberTeamId || null,
            team_name: matchedTeam?.name || null,
            department_name: matchedDept?.name || null
          };
        }
        return m;
      }));

      setIsEditMemberModalOpen(false);
    } catch (err: any) {
      console.error('Erro ao atualizar colaborador:', err);
      alert('Não foi possível alterar o colaborador.');
    } finally {
      setSavingMemberEdit(false);
    }
  };

  const handleConfirmDeactivateMember = async () => {
    if (!memberToDeactivate) return;
    setActiveDropdownMemberId(null);

    if (memberToDeactivate.user_id && currentLoggedUserId && memberToDeactivate.user_id === currentLoggedUserId) {
      alert('Você não pode inativar a sua própria conta.');
      setMemberToDeactivate(null);
      return;
    }

    try {
      setDeactivatingMember(true);

      if (memberToDeactivate.status === 'invited') {
        await supabase
          .from('company_invites')
          .delete()
          .eq('id', memberToDeactivate.id);

        setMembers(prev => prev.filter(m => m.id !== memberToDeactivate.id));
      } else {
        const { error: memErr } = await supabase
          .from('memberships')
          .update({ status: 'inativo' })
          .eq('id', memberToDeactivate.id);

        if (memErr) throw memErr;

        setMembers(prev => prev.map(m => {
          if (m.id === memberToDeactivate.id) {
            return { ...m, status: 'inactive' };
          }
          return m;
        }));
      }

      setMemberToDeactivate(null);
    } catch (err: any) {
      console.error('Erro ao inativar colaborador:', err);
      alert(`Erro ao inativar colaborador: ${err.message || ''}`);
    } finally {
      setDeactivatingMember(false);
    }
  };

  const handleReactivateMember = async (member: TeamMember) => {
    setActiveDropdownMemberId(null);
    try {
      const { error } = await supabase
        .from('memberships')
        .update({ status: 'ativo' })
        .eq('id', member.id);

      if (error) throw error;

      setMembers(prev => prev.map(m => {
        if (m.id === member.id) {
          return { ...m, status: 'active' };
        }
        return m;
      }));
    } catch (err: any) {
      console.error('Erro ao reativar colaborador:', err);
      alert('Não foi possível reativar o colaborador.');
    }
  };

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

  // SELEÇÃO EM CASCATA COM DEPENDÊNCIAS
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

        if (error) {
          alert(`Erro ao atualizar nível: ${error.message}`);
          return;
        }

        setRoles(prev => prev.map(r => {
          if (r.id === editingRoleId) {
            return { ...r, ...payload };
          }
          return r;
        }));
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

        if (error) {
          alert(`Erro ao criar nível: ${error.message}`);
          return;
        }

        if (data) {
          setRoles(prev => [...prev, data]);
        }
      }

      setIsRoleModalOpen(false);
      setIsEditMode(false);
    } catch (err) {
      console.error('Erro ao persistir cargo:', err);
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

      if (error) {
        alert(`Erro ao remover nível: ${error.message}`);
        return;
      }

      setRoles(prev => prev.filter(r => r.id !== roleToDelete.id));
      setRoleToDelete(null);
    } catch (err) {
      console.error('Erro ao deletar cargo:', err);
    } finally {
      setDeletingRole(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16 text-slate-400 text-sm">
        <Loader2 className="animate-spin mr-2" size={18} />
        Carregando configurações da empresa...
      </div>
    );
  }

  const selectedDepartment = departments.find(d => d.id === selectedDepartmentId);
  const departmentTeams = teams.filter(t => t.department_id === selectedDepartmentId);

  return (
    <div className="max-w-6xl mx-auto flex flex-col lg:h-[calc(100vh-7rem)] overflow-hidden">
      <div className="pb-4 mb-4 border-b border-slate-200 shrink-0">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Configurações da Empresa
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Gerencie a identidade visual, organograma, equipes, catálogo de itens e níveis de acesso da empresa no Lume.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start flex-1 min-h-0">
        {/* Painel Lateral Estático Centralizado */}
        <div className="lg:col-span-1 shrink-0">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs text-center flex flex-col items-center">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleLogoFileChange} 
              accept="image/*" 
              className="hidden" 
            />

            <div 
              onClick={() => {
                if (permissions.isOwnerOrAdmin || permissions.canManageCompanySettings) {
                  fileInputRef.current?.click();
                }
              }}
              title={
                permissions.isOwnerOrAdmin || permissions.canManageCompanySettings
                  ? "Clique para alterar e enquadrar a logomarca"
                  : undefined
              }
              className={`group relative w-full h-28 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/70 flex items-center justify-center transition-all overflow-hidden mb-3.5 ${
                permissions.isOwnerOrAdmin || permissions.canManageCompanySettings
                  ? 'hover:border-sky-500 hover:bg-sky-50/30 cursor-pointer'
                  : 'cursor-default'
              }`}
            >
              {logoUrl ? (
                <>
                  <img 
                    src={logoUrl} 
                    alt="Logo da Empresa" 
                    className="max-h-24 max-w-[90%] object-contain p-1" 
                  />
                  {(permissions.isOwnerOrAdmin || permissions.canManageCompanySettings) && (
                    <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[11px] font-semibold gap-1.5 backdrop-blur-[1px]">
                      <Camera size={14} />
                      Editar Logo
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                  <div className="h-8 w-8 rounded-full bg-slate-200/60 flex items-center justify-center mb-1">
                    <Plus size={16} />
                  </div>
                  <span className="text-[11px] font-semibold">Sem Logomarca</span>
                </div>
              )}
            </div>

            <h3 className="font-bold text-slate-900 text-sm truncate max-w-full">
              {tradeName || corporateName || 'Minha Empresa'}
            </h3>
            <p className="text-[11px] text-slate-400 truncate max-w-full uppercase tracking-wider mt-0.5">
              {corporateName || 'Razão Social'}
            </p>

            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Empresa Ativa
            </div>

            {/* Menu de Abas Condicional às Permissões */}
            <nav className="mt-4 pt-3 border-t border-slate-100 w-full space-y-1 text-xs text-left">
              {(permissions.isOwnerOrAdmin || Boolean((permissions as any).canManageCompanySettings)) && (
                <button
                  type="button"
                  onClick={() => setActiveTab('geral')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl font-medium transition-colors cursor-pointer ${
                    activeTab === 'geral'
                      ? 'bg-sky-50 text-sky-700 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Building2 size={15} />
                  Geral
                </button>
              )}

              {/* Aba Organização & Equipes */}
              {(permissions.isOwnerOrAdmin || Boolean((permissions as any).canManageTeam)) && (
                <button
                  type="button"
                  onClick={() => setActiveTab('organizacao')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl font-medium transition-colors cursor-pointer ${
                    activeTab === 'organizacao'
                      ? 'bg-sky-50 text-sky-700 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Network size={15} />
                  Organização & Equipes
                </button>
              )}

              {(permissions.isOwnerOrAdmin || Boolean((permissions as any).canCustomizeSystem)) && (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveTab('funil')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl font-medium transition-colors cursor-pointer ${
                      activeTab === 'funil'
                        ? 'bg-sky-50 text-sky-700 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Kanban size={15} />
                    Funil de Vendas
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('servicos')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl font-medium transition-colors cursor-pointer ${
                      activeTab === 'servicos'
                        ? 'bg-sky-50 text-sky-700 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Briefcase size={15} />
                    Tipos de Serviços
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('catalogo')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl font-medium transition-colors cursor-pointer ${
                      activeTab === 'catalogo'
                        ? 'bg-sky-50 text-sky-700 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Package size={15} />
                    Catálogo de Itens
                  </button>
                </>
              )}

              {(permissions.isOwnerOrAdmin || Boolean((permissions as any).canManageTeam)) && (
                <button
                  type="button"
                  onClick={() => setActiveTab('membros')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl font-medium transition-colors cursor-pointer ${
                    activeTab === 'membros'
                      ? 'bg-sky-50 text-sky-700 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Users size={15} />
                  Equipe e Membros
                </button>
              )}

              {permissions.isOwnerOrAdmin && (
                <button
                  type="button"
                  onClick={() => setActiveTab('acessos')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl font-medium transition-colors cursor-pointer ${
                    activeTab === 'acessos'
                      ? 'bg-sky-50 text-sky-700 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <ShieldCheck size={15} />
                  Níveis de Acesso
                </button>
              )}
            </nav>
          </div>
        </div>

        {/* Coluna Direita com Rolagem */}
        <div className="lg:col-span-3 h-full flex flex-col min-h-0">
          
          {/* ABA 1: GERAL */}
          {activeTab === 'geral' && (permissions.isOwnerOrAdmin || Boolean((permissions as any).canManageCompanySettings)) && (
            <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col h-full overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 pr-4 sm:pr-6">
                <div>
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <FileText size={16} className="text-slate-400" />
                    Identificação da Empresa
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                        Razão Social *
                      </label>
                      <input
                        type="text"
                        required
                        value={corporateName}
                        onChange={(e) => setCorporateName(e.target.value)}
                        placeholder="Ex: Ciclo Eletricidade e Energia LTDA"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all shadow-2xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                        Nome Fantasia
                      </label>
                      <input
                        type="text"
                        value={tradeName}
                        onChange={(e) => setTradeName(e.target.value)}
                        placeholder="Ex: Ciclo Solar"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all shadow-2xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                        CNPJ
                      </label>
                      <input
                        type="text"
                        value={cnpj}
                        onChange={(e) => setCnpj(maskCNPJ(e.target.value))}
                        placeholder="00.000.000/0000-00"
                        maxLength={18}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all shadow-2xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                        Inscrição Estadual (I.E.)
                      </label>
                      <input
                        type="text"
                        value={stateRegistration}
                        onChange={(e) => setStateRegistration(e.target.value)}
                        placeholder="Isento ou nº da inscrição"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all shadow-2xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                        Telefone Comercial / WhatsApp
                      </label>
                      <div className="relative">
                        <Phone size={15} className="absolute left-3.5 top-3 text-slate-400" />
                        <input
                          type="text"
                          value={commercialPhone}
                          onChange={(e) => setCommercialPhone(maskPhone(e.target.value))}
                          placeholder="(00) 00000-0000"
                          maxLength={15}
                          className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                        E-mail Comercial
                      </label>
                      <div className="relative">
                        <Mail size={15} className="absolute left-3.5 top-3 text-slate-400" />
                        <input
                          type="email"
                          value={commercialEmail}
                          onChange={(e) => setCommercialEmail(e.target.value)}
                          placeholder="contato@empresa.com.br"
                          className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all shadow-2xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <MapPin size={16} className="text-slate-400" />
                    Localidade da Sede Corporativa
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                        CEP {searchingCep && <span className="text-sky-600 text-[10px]">(Buscando...)</span>}
                      </label>
                      <input
                        type="text"
                        value={cep}
                        onBlur={handleCepBlur}
                        onChange={(e) => setCep(maskCEP(e.target.value))}
                        placeholder="00000-000"
                        maxLength={9}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all shadow-2xs"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                        Rua / Logradouro
                      </label>
                      <input
                        type="text"
                        value={street}
                        onChange={(e) => setStreet(e.target.value)}
                        placeholder="Rua, Avenida, Alameda..."
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all shadow-2xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                        Número
                      </label>
                      <input
                        type="text"
                        value={number}
                        onChange={(e) => setNumber(e.target.value)}
                        placeholder="Ex: 863"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all shadow-2xs"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                        Complemento
                      </label>
                      <input
                        type="text"
                        value={complement}
                        onChange={(e) => setComplement(e.target.value)}
                        placeholder="Sala 402, Bloco B, Galpão..."
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all shadow-2xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                        Bairro
                      </label>
                      <input
                        type="text"
                        value={neighborhood}
                        onChange={(e) => setNeighborhood(e.target.value)}
                        placeholder="Bairro"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all shadow-2xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                        Cidade
                      </label>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Cidade"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all shadow-2xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                        Estado (UF)
                      </label>
                      <input
                        type="text"
                        maxLength={2}
                        value={state}
                        onChange={(e) => setState(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase())}
                        placeholder="RS"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all shadow-2xs uppercase"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50/90 border-t border-slate-200 px-6 sm:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                <div>
                  {saveSuccess && (
                    <div className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200/80">
                      <CheckCircle2 size={15} />
                      Dados atualizados com sucesso!
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-2xs transition-all cursor-pointer active:scale-98 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Salvando alterações...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Salvar Alterações
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ABA ORGANIZAÇÃO & EQUIPES */}
          {activeTab === 'organizacao' && (permissions.isOwnerOrAdmin || Boolean((permissions as any).canManageTeam)) && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col h-full overflow-hidden">
              <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <Network size={20} className="text-sky-600" />
                    Organização, Setores e Equipes
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Estruture os departamentos da empresa, aponte gerentes de setor e crie equipes com seus respectivos líderes de campo.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
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
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Novo Setor</span>
                  </button>

                  <button
                    type="button"
                    disabled={departments.length === 0}
                    onClick={() => {
                      setEditingTeamId(null);
                      setTeamFormName('');
                      setTeamFormDesc('');
                      setTeamFormDeptId(selectedDepartmentId || (departments[0]?.id || ''));
                      setTeamFormLeaderId('');
                      setIsTeamModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold shadow-2xs transition cursor-pointer disabled:opacity-50"
                  >
                    <UserPlus size={14} />
                    <span>Nova Equipe</span>
                  </button>
                </div>
              </div>

              {loadingOrg ? (
                <div className="p-16 text-center text-slate-400 text-xs">
                  <Loader2 size={18} className="animate-spin mx-auto mb-2 text-sky-600" />
                  Carregando organograma da empresa...
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 flex-1 min-h-0 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                  <div className="p-4 sm:p-5 flex flex-col h-full overflow-y-auto space-y-2.5">
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Setores Cadastrados</span>
                      <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded-md">
                        {departments.length}
                      </span>
                    </div>

                    {departments.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                        Nenhum setor cadastrado. Comece criando setores como "Obras" ou "Comercial".
                      </div>
                    ) : (
                      departments.map(dept => {
                        const isSelected = selectedDepartmentId === dept.id;
                        const teamsCount = teams.filter(t => t.department_id === dept.id).length;

                        return (
                          <div
                            key={dept.id}
                            onClick={() => setSelectedDepartmentId(dept.id)}
                            className={`p-3 rounded-2xl border transition text-left cursor-pointer flex flex-col justify-between gap-2 ${
                              isSelected
                                ? 'bg-sky-50/80 border-sky-300 shadow-2xs ring-1 ring-sky-300'
                                : 'bg-white border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span 
                                  className="w-3 h-3 rounded-full shrink-0" 
                                  style={{ backgroundColor: dept.color || '#0ea5e9' }}
                                />
                                <strong className={`text-xs sm:text-sm font-bold truncate ${isSelected ? 'text-sky-950' : 'text-slate-800'}`}>
                                  {dept.name}
                                </strong>
                              </div>

                              <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
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
                                  className="p-1 text-slate-400 hover:text-sky-600 rounded-md transition"
                                  title="Editar setor"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeptToDelete(dept)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition"
                                  title="Excluir setor"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
                              <span className="text-slate-500 flex items-center gap-1">
                                <Crown size={11} className="text-amber-500" />
                                <strong className="text-slate-700 font-semibold truncate max-w-[120px]">
                                  {dept.manager?.full_name || 'Sem Gerente'}
                                </strong>
                              </span>
                              <span className="font-semibold text-slate-400 text-[10px]">
                                {teamsCount} {teamsCount === 1 ? 'equipe' : 'equipes'}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="md:col-span-2 p-4 sm:p-5 flex flex-col h-full overflow-y-auto space-y-3">
                    {selectedDepartment ? (
                      <>
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              Equipes vinculadas a
                            </span>
                            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center gap-1.5">
                              <span 
                                className="w-2.5 h-2.5 rounded-full inline-block shrink-0" 
                                style={{ backgroundColor: selectedDepartment.color || '#0ea5e9' }}
                              />
                              <span>Setor: {selectedDepartment.name}</span>
                            </h3>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingTeamId(null);
                              setTeamFormName('');
                              setTeamFormDesc('');
                              setTeamFormDeptId(selectedDepartment.id);
                              setTeamFormLeaderId('');
                              setIsTeamModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold shadow-2xs transition"
                          >
                            <Plus size={13} />
                            <span>Adicionar Equipe</span>
                          </button>
                        </div>

                        {departmentTeams.length === 0 ? (
                          <div className="p-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                            Nenhuma equipe vinculada a este setor ainda. Clique em "Adicionar Equipe".
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {departmentTeams.map(tm => {
                              const teamMembersList = members.filter(m => m.team_id === tm.id);

                              return (
                                <div 
                                  key={tm.id}
                                  className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col justify-between space-y-3"
                                >
                                  <div className="space-y-1.5">
                                    <div className="flex items-start justify-between gap-2">
                                      <h4 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                                        {tm.name}
                                      </h4>
                                      <div className="flex items-center gap-1 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingTeamId(tm.id);
                                            setTeamFormName(tm.name);
                                            setTeamFormDesc(tm.description || '');
                                            setTeamFormDeptId(tm.department_id || selectedDepartment.id);
                                            setTeamFormLeaderId(tm.leader_id || '');
                                            setIsTeamModalOpen(true);
                                          }}
                                          className="p-1 text-slate-400 hover:text-sky-600 rounded-md transition"
                                          title="Editar equipe"
                                        >
                                          <Edit2 size={13} />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setTeamToDelete(tm)}
                                          className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition"
                                          title="Excluir equipe"
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      </div>
                                    </div>

                                    {tm.description && (
                                      <p className="text-[11px] text-slate-500 leading-snug line-clamp-2">
                                        {tm.description}
                                      </p>
                                    )}

                                    <div className="pt-1 flex items-center gap-1.5 text-xs text-slate-700 font-semibold bg-sky-50/60 p-2 rounded-xl border border-sky-100">
                                      <UserCheck2 size={14} className="text-sky-600 shrink-0" />
                                      <span className="text-[10px] text-slate-400 font-medium">Líder:</span>
                                      <span className="truncate">{tm.leader?.full_name || 'Não definido'}</span>
                                    </div>
                                  </div>

                                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                                    <span className="text-slate-500 font-medium">Membros do Time:</span>
                                    <span className="font-extrabold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-full text-[10px]">
                                      {teamMembersList.length} colaboradores
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400 text-xs">
                        <Network size={28} className="mb-2 text-slate-300" />
                        Selecione ou crie um setor para gerenciar as equipes correspondentes.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ABA DO FUNIL DE VENDAS */}
          {activeTab === 'funil' && (permissions.isOwnerOrAdmin || Boolean((permissions as any).canCustomizeSystem)) && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col h-full overflow-hidden">
              <div className="p-6 sm:p-7 border-b border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <Kanban size={20} className="text-sky-600" />
                    Etapas do Funil Comercial
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Defina a ordem das colunas, nomes e cores que aparecem no quadro Kanban de negociações.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEditingStage({ name: '', color: '#0ea5e9', default_probability: 20 });
                    setIsEditingStageModal(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold shadow-2xs transition-all cursor-pointer active:scale-98"
                >
                  <Plus size={16} />
                  Nova Etapa
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {loadingStages ? (
                  <div className="p-12 text-center text-slate-400 text-xs">
                    <Loader2 size={18} className="animate-spin mx-auto mb-2" />
                    Carregando etapas do funil...
                  </div>
                ) : stages.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-xs">
                    Nenhuma etapa cadastrada no funil.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {stages.map((stage, idx) => (
                      <div
                        key={stage.id}
                        className="p-4 sm:px-6 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors"
                      >
                        <div className="flex items-center gap-3.5">
                          <span className="w-5 text-center text-xs font-bold text-slate-400">
                            {idx + 1}º
                          </span>
                          <span
                            className="w-4 h-4 rounded-full shrink-0 shadow-2xs border border-white"
                            style={{ backgroundColor: stage.color || '#0ea5e9' }}
                          />
                          <div>
                            <p className="text-xs sm:text-sm font-bold text-slate-900">{stage.name}</p>
                            <p className="text-[11px] text-slate-400 font-medium">
                              Probabilidade estimada: {stage.default_probability || 0}%
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveStage(idx, 'up')}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                            title="Mover para a esquerda"
                          >
                            <ChevronUp size={16} />
                          </button>

                          <button
                            type="button"
                            disabled={idx === stages.length - 1}
                            onClick={() => handleMoveStage(idx, 'down')}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                            title="Mover para a direita"
                          >
                            <ChevronDown size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingStage(stage);
                              setIsEditingStageModal(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
                            title="Editar etapa"
                          >
                            <Edit3 size={15} />
                          </button>

                          <button
                            type="button"
                            disabled={checkingStageOpps}
                            onClick={() => handleOpenDeleteStage(stage)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Excluir etapa"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ABA 3: TIPOS DE SERVIÇOS */}
          {activeTab === 'servicos' && (permissions.isOwnerOrAdmin || Boolean((permissions as any).canCustomizeSystem)) && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col h-full overflow-hidden">
              <div className="p-6 sm:p-7 border-b border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <Briefcase size={20} className="text-sky-600" />
                    Tipos de Serviços da Empresa
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Padronize os serviços comercializados pela sua organização nas negociações.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setNewServiceName('');
                    setIsAddServiceModalOpen(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold shadow-2xs transition-all cursor-pointer active:scale-98"
                >
                  <Plus size={16} />
                  Novo Serviço
                </button>
              </div>

              <div className="p-6 sm:p-7 flex-1 overflow-y-auto">
                <div className="border border-slate-200/80 rounded-2xl overflow-hidden divide-y divide-slate-100 max-w-2xl bg-white shadow-2xs">
                  {loadingServices ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      <Loader2 size={18} className="animate-spin mx-auto mb-1.5 text-sky-600" />
                      Carregando catálogo de serviços...
                    </div>
                  ) : services.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400 italic">
                      Nenhum serviço cadastrado ainda. Clique em "Novo Serviço" para adicionar.
                    </div>
                  ) : (
                    services.map((srv) => (
                      <div key={srv.id} className="p-3.5 flex items-center justify-between text-xs sm:text-sm hover:bg-slate-50/60 transition-colors">
                        {editingServiceId === srv.id ? (
                          <div className="flex items-center gap-2 flex-1 mr-3">
                            <input
                              type="text"
                              autoFocus
                              value={editingServiceName}
                              onChange={(e) => setEditingServiceName(e.target.value)}
                              className="flex-1 px-3 py-1 text-xs bg-white border border-sky-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateService(srv.id)}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md cursor-pointer"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingServiceId(null)}
                              className="p-1 text-slate-400 hover:bg-slate-200 rounded-md cursor-pointer"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="font-semibold text-slate-800">{srv.name}</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingServiceId(srv.id);
                                  setEditingServiceName(srv.name);
                                }}
                                className="p-1.5 text-slate-400 hover:text-sky-600 rounded-lg cursor-pointer transition-colors"
                                title="Editar nome"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setServiceToDelete(srv)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer transition-colors"
                                title="Excluir serviço"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ABA DO CATÁLOGO DE ITENS & INSUMOS */}
          {activeTab === 'catalogo' && (permissions.isOwnerOrAdmin || Boolean((permissions as any).canCustomizeSystem)) && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col h-full overflow-hidden">
              <div className="p-6 border-b border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <Package size={20} className="text-sky-600" />
                    Catálogo de Itens & Insumos
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Cadastre produtos, equipamentos e serviços com custo e mark-up para autopreenchimento ágil nas propostas.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenCatalogModal()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-2xs active:scale-98"
                >
                  <Plus size={14} />
                  <span>Novo Item</span>
                </button>
              </div>

              <div className="p-6 flex-1 overflow-y-auto space-y-4">
                <div className="max-w-md">
                  <input
                    type="text"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="Buscar por descrição, tipo ou unidade..."
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                  />
                </div>

                <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3">Item / Descrição</th>
                        <th className="py-2.5 px-3 w-28">Tipo</th>
                        <th className="py-2.5 px-3 w-20 text-center">Unid.</th>
                        <th className="py-2.5 px-3 w-28 text-right">Custo Base</th>
                        <th className="py-2.5 px-3 w-24 text-center">Margem</th>
                        <th className="py-2.5 px-3 w-28 text-right">Preço Venda</th>
                        <th className="py-2.5 px-3 w-20 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loadingCatalog ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400">
                            <Loader2 size={18} className="animate-spin mx-auto mb-1 text-sky-600" />
                            Carregando catálogo...
                          </td>
                        </tr>
                      ) : catalogItems.filter((i) =>
                          i.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                          i.item_type.toLowerCase().includes(catalogSearch.toLowerCase())
                        ).length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                            Nenhum item cadastrado no catálogo.
                          </td>
                        </tr>
                      ) : (
                        catalogItems
                          .filter((i) =>
                            i.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                            i.item_type.toLowerCase().includes(catalogSearch.toLowerCase())
                          )
                          .map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-2.5 px-3">
                                <p className="font-semibold text-slate-800">{item.name}</p>
                                {item.notes && <p className="text-[10px] text-slate-400 truncate max-w-xs">{item.notes}</p>}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                  item.item_type === 'equipamento'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : item.item_type === 'servico'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : item.item_type === 'material'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}>
                                  {item.item_type.charAt(0).toUpperCase() + item.item_type.slice(1)}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono text-slate-500">{item.unit}</td>
                              <td className="py-2.5 px-3 text-right text-slate-500">
                                {formatCurrency(item.cost_price)}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                  {item.markup_percent}%
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                                {formatCurrency(item.sale_price)}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenCatalogModal(item)}
                                    className="p-1.5 text-slate-400 hover:text-sky-600 rounded-lg cursor-pointer transition-colors"
                                    title="Editar item"
                                  >
                                    <Edit3 size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCatalogItem(item.id, item.name)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer transition-colors"
                                    title="Excluir item"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ABA 4: EQUIPE E MEMBROS */}
          {activeTab === 'membros' && (permissions.isOwnerOrAdmin || Boolean((permissions as any).canManageTeam)) && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col h-full overflow-hidden">
              <div className="p-6 sm:p-7 border-b border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <Users size={20} className="text-sky-600" />
                    Membros da Empresa
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Gerencie os colaboradores cadastrados, seus papéis e alocação de equipes.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(true)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold shadow-2xs transition-all cursor-pointer active:scale-98"
                >
                  <UserPlus size={16} />
                  Convidar Colaborador
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {loadingMembers ? (
                  <div className="p-12 text-center text-slate-400 text-xs">
                    <Loader2 size={18} className="animate-spin mx-auto mb-2" />
                    Carregando equipe...
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="px-6 py-3.5">Colaborador</th>
                        <th className="px-6 py-3.5">Cargo</th>
                        <th className="px-6 py-3.5">Equipe / Setor</th>
                        <th className="px-6 py-3.5">Nível de Acesso</th>
                        <th className="px-6 py-3.5">Status</th>
                        <th className="px-6 py-3.5 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {members.map((member) => {
                        const matchedRole = roles.find(r => r.id === member.access_role);
                        const isSelf = member.user_id && currentLoggedUserId && member.user_id === currentLoggedUserId;

                        return (
                          <tr key={member.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden border border-slate-200/50 ${
                                  member.status === 'inactive' ? 'bg-slate-200 text-slate-500' : 'bg-sky-600/10 text-sky-700'
                                }`}>
                                  {member.avatar_url ? (
                                    <img 
                                      src={member.avatar_url} 
                                      alt={member.full_name} 
                                      className={`h-full w-full object-cover ${member.status === 'inactive' ? 'grayscale opacity-75' : ''}`} 
                                    />
                                  ) : (
                                    member.full_name.charAt(0).toUpperCase()
                                  )}
                                </div>
                                <div>
                                  <p className={`font-semibold text-xs sm:text-sm ${member.status === 'inactive' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                                    {member.full_name}
                                  </p>
                                  <p className="text-[11px] text-slate-400">{member.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-slate-600 text-xs font-medium">
                              {member.role_title || 'Colaborador'}
                            </td>
                            <td className="px-6 py-4">
                              {member.team_name ? (
                                <div className="space-y-0.5">
                                  <span className="font-bold text-slate-800 block text-xs">{member.team_name}</span>
                                  {member.department_name && (
                                    <span className="text-[10px] text-slate-400 block">{member.department_name}</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">Sem equipe</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200/60">
                                {matchedRole?.name || member.access_role}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              {member.status === 'active' ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
                                  <UserCheck size={12} /> Ativo
                                </span>
                              ) : member.status === 'inactive' ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-300">
                                  Inativo
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200/60">
                                  <Clock size={12} /> Convite Pendente
                                </span>
                              )}
                            </td>
                            
                            <td className="px-6 py-4 text-right">
                              <div className="relative inline-block text-left" ref={activeDropdownMemberId === member.id ? dropdownRef : null}>
                                <button
                                  type="button"
                                  onClick={() => setActiveDropdownMemberId(activeDropdownMemberId === member.id ? null : member.id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                                  title="Opções do Colaborador"
                                >
                                  <MoreVertical size={16} />
                                </button>

                                {activeDropdownMemberId === member.id && (
                                  <div className="absolute right-0 mt-1 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl py-1.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                                    {member.status === 'invited' ? (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => handleCopyInviteLink(member.token)}
                                          className="w-full text-left px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer font-medium"
                                        >
                                          <Link2 size={15} className="text-sky-600" />
                                          Copiar Link de Convite
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => handleOpenEditMember(member)}
                                          className="w-full text-left px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer font-medium"
                                        >
                                          <UserCog size={15} className="text-slate-400" />
                                          Editar Acesso & Equipe
                                        </button>

                                        <div className="border-t border-slate-100 my-1" />

                                        <button
                                          type="button"
                                          onClick={() => handleRevokeInvite(member.id)}
                                          className="w-full text-left px-3.5 py-2 text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 cursor-pointer font-medium"
                                        >
                                          <Trash2 size={15} />
                                          Cancelar Convite
                                        </button>
                                      </>
                                    ) : member.status === 'inactive' ? (
                                      <button
                                        type="button"
                                        onClick={() => handleReactivateMember(member)}
                                        className="w-full text-left px-3.5 py-2 text-emerald-600 hover:bg-emerald-50 flex items-center gap-2.5 cursor-pointer font-medium"
                                      >
                                        <RotateCcw size={15} />
                                        Reativar Colaborador
                                      </button>
                                    ) : (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => handleOpenEditMember(member)}
                                          className="w-full text-left px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer font-medium"
                                        >
                                          <UserCog size={15} className="text-slate-400" />
                                          Editar Acesso & Equipe
                                        </button>

                                        {!isSelf && (
                                          <>
                                            <div className="border-t border-slate-100 my-1" />
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setActiveDropdownMemberId(null);
                                                setMemberToDeactivate(member);
                                              }}
                                              className="w-full text-left px-3.5 py-2 text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 cursor-pointer font-medium"
                                            >
                                              <UserMinus size={15} />
                                              Inativar Colaborador
                                            </button>
                                          </>
                                        )}
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ABA 5: NÍVEIS DE ACESSO */}
          {activeTab === 'acessos' && permissions.isOwnerOrAdmin && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col h-full overflow-hidden">
              <div className="p-6 sm:p-7 border-b border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <ShieldCheck size={20} className="text-sky-600" />
                    Níveis de Acesso
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Visualize os perfis de acesso da empresa e configure as permissões de cada um.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleOpenCreateRole}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold shadow-2xs transition-all cursor-pointer active:scale-98"
                >
                  <Plus size={16} />
                  Criar Nível de Acesso
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {loadingRoles ? (
                  <div className="p-12 text-center text-slate-400 text-xs">
                    <Loader2 size={18} className="animate-spin mx-auto mb-2" />
                    Carregando níveis de acesso...
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="px-6 py-3.5">Nome do Nível</th>
                        <th className="px-6 py-3.5">Descrição</th>
                        <th className="px-6 py-3.5">Permissões Habilitadas</th>
                        <th className="px-6 py-3.5 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {roles.map((role) => (
                        <tr key={role.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-xs sm:text-sm">{role.name}</span>
                              {role.is_system && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                  <Lock size={10} /> Sistema
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-6 py-4 text-slate-500 text-xs max-w-sm">
                            {role.description}
                          </td>

                          <td className="px-6 py-4">
                            {role.is_system ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200/80">
                                <Check size={12} className="stroke-[2.5]" />
                                Acesso Total
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200/60">
                                <Check size={12} className="stroke-[2.5]" />
                                {role.permissions.length} ativas
                              </span>
                            )}
                          </td>

                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {role.is_system ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenViewRole(role)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                                  title="Visualizar"
                                >
                                  <Eye size={13} className="text-slate-500" />
                                  Visualizar
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenViewRole(role)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                                    title="Visualizar Permissões"
                                  >
                                    <Eye size={13} className="text-slate-500" />
                                    Visualizar
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => setRoleToDelete(role)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                    title="Excluir Nível"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </>
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
      </div>

      {/* MODAL: CRIAR OU EDITAR SETOR */}
      {isDeptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                {editingDeptId ? 'Editar Setor' : 'Novo Setor'}
              </h3>
              <button 
                type="button" 
                onClick={() => setIsDeptModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveDepartment} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome do Setor *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Ex: Engenharia & Obras, Comercial, Financeiro"
                  value={deptFormName}
                  onChange={e => setDeptFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Cor de Destaque</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={deptFormColor}
                    onChange={e => setDeptFormColor(e.target.value)}
                    className="h-8 w-10 p-0 border border-slate-200 rounded-lg cursor-pointer"
                  />
                  <span className="font-mono text-slate-500">{deptFormColor}</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Gerente do Setor (Opcional)</label>
                <select
                  value={deptFormManagerId}
                  onChange={e => setDeptFormManagerId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-sky-500 cursor-pointer"
                >
                  <option value="">Selecione o gerente...</option>
                  {members.filter(m => m.user_id && m.status === 'active').map(m => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.full_name} ({m.role_title || 'Colaborador'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Descrição</label>
                <textarea
                  rows={2}
                  value={deptFormDesc}
                  onChange={e => setDeptFormDesc(e.target.value)}
                  placeholder="Atribuições e responsabilidades deste departamento..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium resize-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDeptModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingDept}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingDept ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>Salvar Setor</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR EXCLUSÃO DE SETOR */}
      {deptToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <Trash2 size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">Excluir Setor</h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Tem certeza que deseja remover o setor <strong>"{deptToDelete.name}"</strong>? As equipes vinculadas ficarão sem setor associado.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeptToDelete(null)}
                className="w-1/2 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingDept}
                onClick={handleConfirmDeleteDept}
                className="w-1/2 py-2.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {deletingDept ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CRIAR OU EDITAR EQUIPE */}
      {isTeamModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                {editingTeamId ? 'Editar Equipe' : 'Nova Equipe'}
              </h3>
              <button 
                type="button" 
                onClick={() => setIsTeamModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTeam} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome da Equipe *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Ex: Equipe Alfa - Predial, Time de Montagem 01"
                  value={teamFormName}
                  onChange={e => setTeamFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Setor / Departamento *</label>
                <select
                  required
                  value={teamFormDeptId}
                  onChange={e => setTeamFormDeptId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-sky-500 cursor-pointer"
                >
                  <option value="">Selecione o setor...</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Líder / Encarregado da Equipe</label>
                <select
                  value={teamFormLeaderId}
                  onChange={e => setTeamFormLeaderId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-sky-500 cursor-pointer"
                >
                  <option value="">Selecione o líder da equipe...</option>
                  {members.filter(m => m.user_id && m.status === 'active').map(m => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.full_name} ({m.role_title || 'Colaborador'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Descrição</label>
                <textarea
                  rows={2}
                  value={teamFormDesc}
                  onChange={e => setTeamFormDesc(e.target.value)}
                  placeholder="Finalidade e atuação desta equipe em campo..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium resize-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsTeamModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingTeam}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingTeam ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>Salvar Equipe</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR EXCLUSÃO DE EQUIPE */}
      {teamToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <Trash2 size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">Excluir Equipe</h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Deseja realmente remover a equipe <strong>"{teamToDelete.name}"</strong>? Os colaboradores continuarão cadastrados, mas ficarão sem equipe vinculada.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTeamToDelete(null)}
                className="w-1/2 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingTeam}
                onClick={handleConfirmDeleteTeam}
                className="w-1/2 py-2.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {deletingTeam ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR ACESSO E ALOCAÇÃO DO COLABORADOR */}
      {isEditMemberModalOpen && memberToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-2xs">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">Editar Acesso e Alocação</h3>
                <p className="text-xs text-slate-500 mt-0.5">Colaborador: {memberToEdit.full_name}</p>
              </div>
              <button 
                type="button" 
                onClick={() => setIsEditMemberModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveMemberEdit} className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Cargo / Nível de Acesso *</label>
                <select
                  value={editMemberRole}
                  onChange={(e) => setEditMemberRole(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all shadow-2xs cursor-pointer font-medium"
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Equipe Operacional / Setor</label>
                <select
                  value={editMemberTeamId}
                  onChange={(e) => setEditMemberTeamId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all shadow-2xs cursor-pointer font-medium"
                >
                  <option value="">Sem equipe atribuída...</option>
                  {teams.map(t => {
                    const dept = departments.find(d => d.id === t.department_id);
                    return (
                      <option key={t.id} value={t.id}>
                        {t.name} {dept ? `(${dept.name})` : ''}
                      </option>
                    );
                  })}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  O setor do colaborador é determinado automaticamente pela equipe em que ele está alocado.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditMemberModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingMemberEdit}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-2xs transition-colors cursor-pointer active:scale-98 disabled:opacity-50"
                >
                  {savingMemberEdit ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      Salvar Alterações
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONVIDAR COLABORADOR */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-2xs">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">Convidar Colaborador</h3>
                <p className="text-xs text-slate-500 mt-0.5">Adicione um novo membro para operar o Lume</p>
              </div>
              <button 
                type="button" 
                onClick={() => setIsInviteModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nome do Colaborador *</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ex: Carlos Silva"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs" 
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">E-mail Corporativo *</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-3 text-slate-400" />
                  <input 
                    type="email" 
                    required
                    placeholder="carlos@empresa.com.br"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Cargo / Ocupação</label>
                <div className="relative">
                  <Briefcase size={15} className="absolute left-3.5 top-3 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Ex: Consultor Solar, Orçamentista, Eletricista"
                    value={inviteRoleTitle}
                    onChange={(e) => setInviteRoleTitle(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nível de Acesso</label>
                  <select
                    value={inviteAccessRole}
                    onChange={(e) => setInviteAccessRole(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs cursor-pointer font-medium"
                  >
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Equipe (Opcional)</label>
                  <select
                    value={inviteTeamId}
                    onChange={(e) => setInviteTeamId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs cursor-pointer font-medium"
                  >
                    <option value="">Sem equipe...</option>
                    {teams.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-2xs cursor-pointer active:scale-98 disabled:opacity-50"
                >
                  {inviting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send size={13} />
                      Enviar Convite
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RECORTAR E ENQUADRAR LOGOMARCA */}
      {imageToCrop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-lg w-full shadow-2xl flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Enquadrar Logomarca</h3>
                <p className="text-xs text-slate-500">Arraste para centralizar o logotipo e regule o zoom</p>
              </div>
              <button 
                type="button" 
                onClick={() => setImageToCrop(null)} 
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="relative w-full h-72 bg-slate-900 rounded-2xl overflow-hidden shadow-inner">
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                aspect={16 / 9}
                cropShape="rect"
                showGrid={true}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            <div className="mt-4 px-2 flex items-center gap-3">
              <ZoomIn size={16} className="text-slate-400 shrink-0" />
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-sky-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-6 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setImageToCrop(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isCropping}
                onClick={handleApplyCrop}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-2xs cursor-pointer active:scale-98 disabled:opacity-50"
              >
                {isCropping ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Aplicando...
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    Aplicar Logomarca
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CRIAR OU EDITAR ETAPA DO FUNIL */}
      {isEditingStageModal && editingStage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-2xs">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  {editingStage.id ? 'Editar Etapa do Funil' : 'Criar Nova Etapa'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure o nome, cor de etiqueta e probabilidade de conversão.
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => {
                  setIsEditingStageModal(false);
                  setEditingStage(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveStageModal} className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nome da Etapa *</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ex: Visita Técnica, Proposta Enviada..."
                  value={editingStage.name || ''}
                  onChange={(e) => setEditingStage({ ...editingStage, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all shadow-2xs" 
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Cor da Etiqueta</label>
                <div className="flex items-center gap-2.5">
                  <input 
                    type="color" 
                    value={editingStage.color || '#0ea5e9'}
                    onChange={(e) => setEditingStage({ ...editingStage, color: e.target.value })}
                    className="h-9 w-12 p-0 border border-slate-200 rounded-lg cursor-pointer"
                  />
                  <span className="text-slate-600 font-mono text-xs">{editingStage.color || '#0ea5e9'}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Probabilidade Estimada de Fechamento (%)</label>
                <input 
                  type="number" 
                  min={0}
                  max={100}
                  value={editingStage.default_probability ?? 0}
                  onChange={(e) => setEditingStage({ ...editingStage, default_probability: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all shadow-2xs" 
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingStageModal(false);
                    setEditingStage(null);
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-2xs transition-colors cursor-pointer active:scale-98"
                >
                  <Save size={14} />
                  Salvar Etapa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR EXCLUSÃO DE ETAPA DO FUNIL */}
      {stageToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl text-center animate-in zoom-in-95 duration-150">
            {stageOppCount > 0 ? (
              <>
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3.5 border border-amber-200/80">
                  <AlertTriangle size={24} />
                </div>

                <h3 className="text-base font-bold text-slate-900 leading-tight mb-1.5">
                  Não é possível excluir esta etapa
                </h3>
                <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                  A etapa <strong className="text-slate-800 font-bold">"{stageToDelete.name}"</strong> possui{' '}
                  <span className="font-bold text-amber-600">
                    {stageOppCount} {stageOppCount === 1 ? 'negociação vinculada' : 'negociações vinculadas'}
                  </span>
                  . Mova ou encerre as negociações no Funil Comercial antes de excluir a coluna.
                </p>

                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => setStageToDelete(null)}
                    className="w-full py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                  >
                    Entendido, voltar
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3.5 border border-rose-100">
                  <Trash2 size={24} />
                </div>

                <h3 className="text-base font-bold text-slate-900 leading-tight mb-1.5">
                  Excluir Etapa do Funil
                </h3>
                <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                  Tem certeza que deseja excluir a etapa <strong className="text-slate-800 font-bold">"{stageToDelete.name}"</strong>? Ela está vazia e esta ação não poderá ser desfeita.
                </p>

                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStageToDelete(null)}
                    className="w-1/2 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={deletingStage}
                    onClick={handleConfirmDeleteStage}
                    className="w-1/2 inline-flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-2xs transition-colors cursor-pointer active:scale-98 disabled:opacity-50"
                  >
                    {deletingStage ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    <span>Excluir</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL: ADICIONAR NOVO TIPO DE SERVIÇO */}
      {isAddServiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
                  <Briefcase size={18} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">Novo Tipo de Serviço</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Cadastre uma nova modalidade de atendimento.</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setIsAddServiceModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddService} className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nome do Serviço *</label>
                <input 
                  type="text" 
                  required
                  autoFocus
                  placeholder="Ex: Consultoria Energética, Usina Solo..."
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all shadow-2xs" 
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddServiceModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingService || !newServiceName.trim()}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-2xs transition-colors cursor-pointer active:scale-98 disabled:opacity-50"
                >
                  {savingService ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>Salvar Serviço</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR EXCLUSÃO DE SERVIÇO */}
      {serviceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-150 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3.5 border border-rose-100">
              <Trash2 size={24} />
            </div>

            <h3 className="text-base font-bold text-slate-900 leading-tight mb-1.5">
              Excluir Tipo de Serviço
            </h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Deseja realmente excluir o tipo de serviço <strong className="text-slate-800 font-bold">"{serviceToDelete.name}"</strong>? Esta ação não pode ser desfeita.
            </p>

            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setServiceToDelete(null)}
                className="w-1/2 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingService}
                onClick={handleConfirmDeleteService}
                className="w-1/2 inline-flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-2xs transition-colors cursor-pointer active:scale-98 disabled:opacity-50"
              >
                {deletingService ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CRIAR OU EDITAR ITEM DO CATÁLOGO */}
      {showCatalogModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-sky-50 text-sky-600 rounded-lg border border-sky-100">
                  <Package size={16} />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {itemFormId ? 'Editar Item do Catálogo' : 'Novo Item do Catálogo'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCatalogModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveCatalogItem} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome / Descrição Técnica *</label>
                <input
                  type="text"
                  required
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="Ex: Módulo Fotovoltaico 550W Canadian Solar"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500 shadow-2xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tipo de Item</label>
                  <select
                    value={itemType}
                    onChange={(e) => setItemType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500 shadow-2xs"
                  >
                    <option value="equipamento">Equipamento</option>
                    <option value="material">Material</option>
                    <option value="servico">Serviço</option>
                    <option value="outros">Outros</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Unidade</label>
                  <select
                    value={itemUnit}
                    onChange={(e) => setItemUnit(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500 shadow-2xs"
                  >
                    <option value="un">un (Unidade)</option>
                    <option value="m">m (Metro linear)</option>
                    <option value="m²">m² (Metro quadrado)</option>
                    <option value="kWp">kWp (Potência)</option>
                    <option value="hora">hora (Horas)</option>
                    <option value="diaria">diaria (Diária)</option>
                    <option value="vb">vb (Verba global)</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Custo Base (R$) *</label>
                    <input
                      type="text"
                      required
                      value={itemCostPrice}
                      onChange={(e) => handleCostOrMarkupChange(e.target.value, itemMarkupPercent)}
                      placeholder="0,00"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 font-semibold focus:ring-2 focus:ring-sky-500 text-right shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Mark-up Sugerido</span>
                      <Percent size={11} className="text-slate-400" />
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        value={itemMarkupPercent}
                        onChange={(e) => handleCostOrMarkupChange(itemCostPrice, e.target.value)}
                        placeholder="30"
                        className="w-full pl-3 pr-7 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 font-semibold focus:ring-2 focus:ring-sky-500 text-right shadow-2xs"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[11px] pointer-events-none">%</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-sky-900 mb-1">
                    Preço de Venda Sugerido (R$) *
                  </label>
                  <input
                    type="text"
                    required
                    value={itemSalePrice}
                    onChange={(e) => handleSalePriceChange(e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3 py-2 bg-white border border-sky-300 rounded-xl text-sky-950 font-extrabold text-sm focus:ring-2 focus:ring-sky-500 text-right shadow-2xs"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Calculado por Mark-up ou ajustado manualmente.
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Observações Técnicas / Garantia</label>
                <input
                  type="text"
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  placeholder="Ex: Garantia de 12 anos do fabricante, faturamento direto..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-sky-500 shadow-2xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCatalogModal(false)}
                  className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingCatalogItem}
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-semibold shadow-2xs cursor-pointer active:scale-98 disabled:opacity-50"
                >
                  {savingCatalogItem ? 'Salvando...' : 'Salvar no Catálogo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR INATIVAÇÃO DE MEMBRO */}
      {memberToDeactivate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-150 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3.5 border border-rose-100">
              <UserMinus size={24} />
            </div>

            <h3 className="text-base font-bold text-slate-900 leading-tight mb-1.5">
              Inativar Colaborador
            </h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Deseja realmente inativar o colaborador <strong className="text-slate-800 font-bold">"{memberToDeactivate.full_name}"</strong>? Ele perderá o acesso aos dados da organização, mas o histórico de negociações será preservado.
            </p>

            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setMemberToDeactivate(null)}
                className="w-1/2 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deactivatingMember}
                onClick={handleConfirmDeleteRole}
                className="w-1/2 inline-flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-2xs transition-colors cursor-pointer active:scale-98 disabled:opacity-50"
              >
                {deactivatingMember ? <Loader2 size={14} className="animate-spin" /> : <UserMinus size={14} />}
                <span>Inativar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR EXCLUSÃO DE NÍVEL DE ACESSO */}
      {roleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-150 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3.5 border border-rose-100">
              <Trash2 size={24} />
            </div>

            <h3 className="text-base font-bold text-slate-900 leading-tight mb-1.5">
              Excluir Nível de Acesso
            </h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Tem certeza que deseja excluir o nível <strong className="text-slate-800 font-bold">"{roleToDelete.name}"</strong>?
            </p>

            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setRoleToDelete(null)}
                className="w-1/2 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingRole}
                onClick={handleConfirmDeleteRole}
                className="w-1/2 inline-flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-2xs transition-colors cursor-pointer active:scale-98 disabled:opacity-50"
              >
                {deletingRole ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VISUALIZAR / EDITAR NÍVEL COM CHECKBOXES */}
      {isRoleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-2xs">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 max-w-2xl w-full shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4 shrink-0">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  {editingRoleId && roles.find(r => r.id === editingRoleId)?.is_system 
                    ? 'Visualizar Permissões (Administrador)'
                    : isEditMode 
                      ? (editingRoleId ? 'Editar Nível de Acesso' : 'Criar Novo Nível de Acesso')
                      : `Visualizar Permissões: ${roleFormName}`}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editingRoleId && roles.find(r => r.id === editingRoleId)?.is_system
                    ? 'O perfil Administrador possui permissão total irrevogável no sistema.'
                    : isEditMode
                      ? 'Selecione as permissões que esse perfil de usuário poderá executar no Lume.'
                      : 'Permissões atribuídas a este nível de acesso.'}
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => {
                  setIsRoleModalOpen(false);
                  setIsEditMode(false);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="flex flex-col flex-1 min-h-0">
              <div className="overflow-y-auto pr-1 space-y-5 flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Nome do Nível *
                    </label>
                    <input 
                      type="text" 
                      required
                      disabled={!isEditMode || (!!editingRoleId && !!roles.find(r => r.id === editingRoleId)?.is_system)}
                      placeholder="Ex: Consultor Comercial Externo"
                      value={roleFormName}
                      onChange={(e) => setRoleFormName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-75 disabled:bg-slate-100 disabled:cursor-not-allowed" 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Descrição Sucinta
                    </label>
                    <input 
                      type="text" 
                      disabled={!isEditMode || (!!editingRoleId && !!roles.find(r => r.id === editingRoleId)?.is_system)}
                      placeholder="Ex: Atendimento, propostas e negociação"
                      value={roleFormDescription}
                      onChange={(e) => setRoleFormDescription(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-75 disabled:bg-slate-100 disabled:cursor-not-allowed" 
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Permissões de Acesso por Módulo
                    </h4>
                    {!isEditMode && (
                      <span className="text-[11px] text-slate-400 font-medium">
                        Modo somente leitura
                      </span>
                    )}
                  </div>

                  {/* 5 MÓDULOS MACRO INCLUINDO RH & PESSOAS */}
                  <div className="space-y-4">
                    {CATEGORIES.map((category) => {
                      const categoryPerms = AVAILABLE_PERMISSIONS.filter(p => p.category === category);
                      const allCatChecked = categoryPerms.every(p => roleFormPermissions.includes(p.id));

                      return (
                        <div key={category} className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/40">
                          <div className="px-4 py-2.5 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800">{category}</span>
                            
                            {isEditMode && (!editingRoleId || !roles.find(r => r.id === editingRoleId)?.is_system) && (
                              <button
                                type="button"
                                onClick={() => handleToggleCategory(category)}
                                className="text-[11px] text-sky-600 hover:text-sky-800 font-semibold cursor-pointer"
                              >
                                {allCatChecked ? 'Desmarcar todos' : 'Marcar todos'}
                              </button>
                            )}
                          </div>

                          <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {categoryPerms.map((perm) => {
                              const isChecked = roleFormPermissions.includes(perm.id);
                              const isPrerequisiteMet = !perm.dependsOn || roleFormPermissions.includes(perm.dependsOn);
                              const isDisabled = !isEditMode || 
                                (!!editingRoleId && !!roles.find(r => r.id === editingRoleId)?.is_system) ||
                                (!isPrerequisiteMet && !isChecked);

                              return (
                                <label
                                  key={perm.id}
                                  className={`flex items-start gap-2.5 p-2 rounded-lg border text-xs select-none transition-colors ${
                                    isChecked 
                                      ? 'bg-sky-50/60 border-sky-200 text-sky-950 font-medium' 
                                      : !isPrerequisiteMet
                                      ? 'bg-slate-100/50 border-slate-200 text-slate-400 opacity-60'
                                      : 'bg-white border-slate-200 text-slate-600'
                                  } ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-sky-50/40'}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={isDisabled}
                                    onChange={() => handleToggleFormPermission(perm.id)}
                                    className="mt-0.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500 disabled:cursor-not-allowed"
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

              <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-4 shrink-0">
                <div>
                  {!isEditMode && (!editingRoleId || !roles.find(r => r.id === editingRoleId)?.is_system) && (
                    <button
                      type="button"
                      onClick={() => setIsEditMode(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition-colors"
                    >
                      <Edit2 size={13} />
                      Editar Nível
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRoleModalOpen(false);
                      setIsEditMode(false);
                    }}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Fechar
                  </button>

                  {isEditMode && (!editingRoleId || !roles.find(r => r.id === editingRoleId)?.is_system) && (
                    <button
                      type="submit"
                      disabled={savingRole}
                      className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-2xs cursor-pointer active:scale-98 disabled:opacity-50"
                    >
                      {savingRole ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        'Salvar Alterações'
                      )}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanySettingsView;