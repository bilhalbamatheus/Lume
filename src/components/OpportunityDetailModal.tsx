import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { ContactProfileModal } from './ContactProfileModal';
import { QuoteBuilderModal } from './QuoteBuilderModal';
import { QuotePrintView } from './QuotePrintView';
import { EntityTimeline } from './EntityTimeline';
import { EntityDocuments } from './EntityDocuments';
import {
  X,
  Plus,
  CheckCircle2,
  XCircle,
  Loader2,
  Check,
  FileText,
  Building2,
  Snowflake,
  RotateCcw,
  Briefcase,
  Handshake,
  Edit3,
  Trash2,
  Mail,
  ExternalLink,
  Trophy,
  Printer,
  MoreVertical,
  Copy,
  Clock,
  Paperclip,
  HardHat,
  Compass,
  ArrowLeft,
  FileUp,
  History as HistoryIcon
} from 'lucide-react';

interface OpportunityDetailModalProps {
  opportunityId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
  onOpenContactModal?: (contactId: string) => void;
  zIndexLevel?: 'base' | 'overlay';
}

interface QuoteItem {
  id: string;
  code?: string | null;
  quote_number: number;
  title: string;
  total_value: number;
  status: string;
  is_selected: boolean;
  notes?: string | null;
  created_at: string;
}

interface OpportunityData {
  id: string;
  code?: string | null;
  title: string;
  description: string | null;
  status: 'em_andamento' | 'ganha' | 'perdida' | 'congelada';
  priority: string;
  estimated_value: number | null;
  final_value: number | null;
  stage_id: string;
  pipeline_id: string;
  contact_id: string;
  company_id?: string;
  expected_close_date: string | null;
  service_type?: string | null;
  partner_contact_id?: string | null;
  assigned_to?: string | null;
  lost_reason?: string | null;
  frozen_reason?: string | null;
  lost_at?: string | null;
  frozen_at?: string | null;
  won_at?: string | null;
  contact?: {
    id: string;
    code?: string | null;
    display_name: string;
    type: 'person' | 'company';
    avatar_url?: string | null;
    document?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  partner?: {
    id: string;
    code?: string | null;
    display_name: string;
    type: 'person' | 'company';
    avatar_url?: string | null;
    document?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  stage?: {
    id: string;
    name: string;
    color?: string;
  };
}

interface ServiceTypeOption {
  id: string;
  name: string;
}

const parsePtBrCurrency = (val: string): number => {
  if (!val) return 0;
  const clean = val.replace(/\./g, '').replace(',', '.');
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
};

const formatCurrency = (val: number | null | undefined): string => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
};

const formatPhoneNumber = (phone: string | null | undefined): string => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
};

const formatShortName = (fullName?: string | null): string => {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 2) return fullName;
  return `${parts[0]} ${parts[1]}`;
};

const formatServiceTypeName = (raw: string | null | undefined): string => {
  if (!raw) return 'Não especificado';
  const dictionary: Record<string, string> = {
    energia_solar: 'Energia Solar',
    eletrica_industrial: 'Elétrica Industrial',
    projetos_engenharia: 'Projetos de Engenharia',
    manutencao_subestacao: 'Manutenção de Subestação',
    laudos_spda: 'Laudos SPDA'
  };
  return dictionary[raw] || raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

export const OpportunityDetailModal: React.FC<OpportunityDetailModalProps> = ({
  opportunityId,
  isOpen,
  onClose,
  onUpdated,
  onOpenContactModal
}) => {
  const { user } = useAuth();
  const { permissions } = usePermissions();

  const [loading, setLoading] = useState(true);
  const [opportunity, setOpportunity] = useState<OpportunityData | null>(null);
  const [quotes, setQuotes] = useState<QuoteItem[]>([]);
  const [stages, setStages] = useState<Array<{ id: string; name: string; color?: string; sort_order?: number }>>([]);

  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [activeTab, setActiveTab] = useState<'dados' | 'timeline' | 'quotes' | 'documents'>('dados');
  const [targetMainEl, setTargetMainEl] = useState<HTMLElement | null>(null);

  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; name: string; email?: string; avatar_url?: string | null }>>([]);
  const [partners, setPartners] = useState<Array<{ id: string; name: string; type?: string; avatar_url?: string | null }>>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceTypeOption[]>([]);

  // Menu de Ações no Desktop
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement>(null);

  // Ações Rápidas Mobile
  const [isMobileActionSheetOpen, setIsMobileActionSheetOpen] = useState(false);
  const [isMobileTopMenuOpen, setIsMobileTopMenuOpen] = useState(false);

  // Histórico recolhível
  const [showInteractionForm, setShowInteractionForm] = useState(false);

  // Modais Auxiliares
  const [internalContactModalOpen, setInternalContactModalOpen] = useState(false);
  const [internalContactId, setInternalContactId] = useState<string | null>(null);

  const [selectedQuoteIdForBuild, setSelectedQuoteIdForBuild] = useState<string | null>(null);
  const [quoteBuilderInitialEdit, setQuoteBuilderInitialEdit] = useState(false);
  const [selectedQuoteIdForPrint, setSelectedQuoteIdForPrint] = useState<string | null>(null);

  // Modal de Exclusão de Proposta
  const [quoteToDelete, setQuoteToDelete] = useState<{ id: string; title: string } | null>(null);
  const [deletingQuote, setDeletingQuote] = useState(false);

  // Modo de Edição Geral da Oportunidade
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editEstimatedValue, setEditEstimatedValue] = useState('');
  const [editServiceType, setEditServiceType] = useState('');
  const [editAssignedTo, setEditAssignedTo] = useState('');
  const [editPartnerContactId, setEditPartnerContactId] = useState('');
  const [editExpectedCloseDate, setEditExpectedCloseDate] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const [openQuoteMenuId, setOpenQuoteMenuId] = useState<string | null>(null);
  const quoteMenuBoxRef = useRef<HTMLDivElement>(null);

  // Popover do Responsável
  const [hoveredOwnerCoords, setHoveredOwnerCoords] = useState<{ top: number; left: number } | null>(null);

  // Modais de Estado
  const [statusModalType, setStatusModalType] = useState<'perdida' | 'congelada' | null>(null);
  const [statusModalReason, setStatusModalReason] = useState('');
  const [statusModalDate, setStatusModalDate] = useState(new Date().toISOString().split('T')[0]);
  const [savingStatusModal, setSavingStatusModal] = useState(false);

  // Modal de Vitória
  const [showWinModal, setShowWinModal] = useState(false);
  const [winModalDate, setWinModalDate] = useState(new Date().toISOString().split('T')[0]);
  const [winModalFinalValue, setWinModalFinalValue] = useState('');
  const [winSelectedQuoteId, setWinSelectedQuoteId] = useState<string>('');
  const [savingWinModal, setSavingWinModal] = useState(false);

  const [createProject, setCreateProject] = useState(false);
  const [createWork, setCreateWork] = useState(true);
  const [workAssignedTo, setWorkAssignedTo] = useState('');

  // Modal de Retomada
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [resumingOpportunity, setResumingOpportunity] = useState(false);

  // Criação / Duplicação de Orçamento
  const [savingQuote, setSavingQuote] = useState(false);
  const [duplicatingQuoteId, setDuplicatingQuoteId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const main = document.querySelector('main');
    if (main && !isMobile) {
      main.style.position = 'relative';
      setTargetMainEl(main);
    }
    return () => {
      if (main) main.style.position = '';
    };
  }, [isOpen, isMobile]);

  const currentUserId = user?.id || (user as any)?.user?.id || (user as any)?.profile?.id;

  const isOpportunityOwner = useMemo(() => {
    if (!opportunity || !currentUserId) return false;
    return opportunity.assigned_to === currentUserId;
  }, [opportunity, currentUserId]);

  const canEditOpportunity = useMemo(() => {
    return permissions.isOwnerOrAdmin || (permissions.canManageDeals && isOpportunityOwner);
  }, [permissions.isOwnerOrAdmin, permissions.canManageDeals, isOpportunityOwner]);

  const canDeleteOpportunity = useMemo(() => {
    const hasDeletePermission = (permissions as any).canDeleteDeals !== undefined
      ? (permissions as any).canDeleteDeals
      : permissions.canManageDeals;

    return permissions.isOwnerOrAdmin || (hasDeletePermission && isOpportunityOwner);
  }, [permissions, isOpportunityOwner]);

  const canManageQuotes = useMemo(() => {
    const hasCreateQuotes = Boolean((permissions as any).canCreateQuotes);
    return permissions.isOwnerOrAdmin || (hasCreateQuotes && isOpportunityOwner);
  }, [permissions.isOwnerOrAdmin, (permissions as any).canCreateQuotes, isOpportunityOwner]);

  const canDeleteQuotes = useMemo(() => {
    const hasDeleteQuotes = Boolean((permissions as any).canDeleteQuotes);
    return permissions.isOwnerOrAdmin || (hasDeleteQuotes && isOpportunityOwner);
  }, [permissions.isOwnerOrAdmin, (permissions as any).canDeleteQuotes, isOpportunityOwner]);

  const canChangeStatus = useMemo(() => {
    return permissions.isOwnerOrAdmin || (permissions.canWinLoseDeals && isOpportunityOwner);
  }, [permissions.isOwnerOrAdmin, permissions.canWinLoseDeals, isOpportunityOwner]);

  const canShowMobileFab = useMemo(() => {
    return canEditOpportunity || canManageQuotes;
  }, [canEditOpportunity, canManageQuotes]);

  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      const target = event.target as Node;
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(target)) {
        setIsActionsMenuOpen(false);
      }
      if (quoteMenuBoxRef.current && !quoteMenuBoxRef.current.contains(target)) {
        setOpenQuoteMenuId(null);
      }
    };
    window.addEventListener('click', handleClickOutside);
    window.addEventListener('scroll', handleClickOutside, true);
    return () => {
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('scroll', handleClickOutside, true);
    };
  }, []);

  const loadQuotes = useCallback(async (id: string) => {
    const { data: quotesData, error } = await supabase
      .from('opportunity_quotes')
      .select('id, code, quote_number, title, total_value, status, is_selected, notes, created_at')
      .eq('opportunity_id', id)
      .order('is_selected', { ascending: false })
      .order('created_at', { ascending: false });

    if (!error && quotesData) {
      setQuotes(quotesData);
    }
  }, []);

  const loadOpportunityData = useCallback(async (id: string) => {
    try {
      setLoading(true);

      const { data: opp, error: oppErr } = await supabase
        .from('opportunities')
        .select(`
          id,
          code,
          title,
          description,
          status,
          priority,
          estimated_value,
          final_value,
          stage_id,
          pipeline_id,
          contact_id,
          company_id,
          expected_close_date,
          service_type,
          partner_contact_id,
          assigned_to,
          lost_reason,
          frozen_reason,
          lost_at,
          frozen_at,
          won_at,
          contact:contacts!contact_id (
            id,
            code,
            display_name,
            type,
            avatar_url
          ),
          partner:contacts!partner_contact_id (
            id,
            code,
            display_name,
            type,
            avatar_url
          ),
          stage:commercial_pipeline_stages!stage_id (
            id,
            name,
            color
          )
        `)
        .eq('id', id)
        .single();

      if (oppErr) throw oppErr;

      let contactObj = Array.isArray(opp.contact) ? opp.contact[0] : opp.contact;
      if (contactObj?.id) {
        const [{ data: phones }, { data: emails }] = await Promise.all([
          supabase.from('contact_phones').select('phone_number').eq('contact_id', contactObj.id).limit(1),
          supabase.from('contact_emails').select('email').eq('contact_id', contactObj.id).limit(1)
        ]);

        contactObj = {
          ...contactObj,
          phone: phones?.[0]?.phone_number || null,
          email: emails?.[0]?.email || null
        } as any;
      }

      let partnerObj = Array.isArray(opp.partner) ? opp.partner[0] : opp.partner;
      if (partnerObj?.id) {
        const [{ data: pPhones }, { data: pEmails }] = await Promise.all([
          supabase.from('contact_phones').select('phone_number').eq('contact_id', partnerObj.id).limit(1),
          supabase.from('contact_emails').select('email').eq('contact_id', partnerObj.id).limit(1)
        ]);

        partnerObj = {
          ...partnerObj,
          phone: pPhones?.[0]?.phone_number || null,
          email: pEmails?.[0]?.email || null
        }as any;
      }

      const formattedOpp: OpportunityData = {
        ...opp,
        contact: contactObj,
        partner: partnerObj,
        stage: Array.isArray(opp.stage) ? opp.stage[0] : opp.stage
      };

      setOpportunity(formattedOpp);

      setEditTitle(formattedOpp.title || '');
      setEditEstimatedValue(
        formattedOpp.estimated_value
          ? formattedOpp.estimated_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
          : ''
      );
      setEditServiceType(formattedOpp.service_type || '');
      setEditAssignedTo(formattedOpp.assigned_to || '');
      setEditPartnerContactId(formattedOpp.partner_contact_id || '');
      setEditExpectedCloseDate(
        formattedOpp.expected_close_date ? formattedOpp.expected_close_date.split('T')[0] : ''
      );
      setEditDescription(formattedOpp.description || '');

      if (opp.pipeline_id) {
        const { data: stagesData } = await supabase
          .from('commercial_pipeline_stages')
          .select('id, name, color, sort_order')
          .eq('pipeline_id', opp.pipeline_id)
          .order('sort_order', { ascending: true });

        setStages(stagesData || []);
      }

      await loadQuotes(id);
    } catch (err) {
      console.error('Erro ao carregar oportunidade:', err);
    } finally {
      setLoading(false);
    }
  }, [loadQuotes]);

  const loadAuxiliaryData = useCallback(async () => {
    try {
      const companyId = user?.company?.id;
      if (!companyId) return;

      const [membersRes, partnersRes, servicesRes] = await Promise.all([
        supabase
          .from('memberships')
          .select(`
            id,
            profile_id,
            status,
            profile:profiles!profile_id (
              id,
              full_name,
              email,
              avatar_url
            )
          `)
          .eq('company_id', companyId)
          .eq('status', 'ativo'),

        supabase
          .from('contacts')
          .select('id, code, display_name, type, avatar_url')
          .eq('company_id', companyId)
          .is('deleted_at', null)
          .order('display_name', { ascending: true }),

        supabase
          .from('company_service_types')
          .select('id, name')
          .eq('company_id', companyId)
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true })
      ]);

      const activeMembers = (membersRes.data || [])
        .map((m: any) => {
          const prof = Array.isArray(m.profile) ? m.profile[0] : m.profile;
          if (!prof) return null;
          return {
            id: prof.id,
            name: prof.full_name || 'Usuário Sem Nome',
            email: prof.email,
            avatar_url: prof.avatar_url || null
          };
        })
        .filter(Boolean);

      setTeamMembers((activeMembers)as any);

      setPartners((partnersRes.data || []).map((p: any) => ({
        id: p.id,
        code: p.code,
        name: p.display_name,
        type: p.type,
        avatar_url: p.avatar_url || null
      })));

      setServiceTypes(servicesRes.data || []);
    } catch (err) {
      console.warn('Erro ao carregar dados auxiliares:', err);
    }
  }, [user?.company?.id]);

  useEffect(() => {
    if (isOpen && opportunityId) {
      setIsEditingInfo(false);
      setStatusModalType(null);
      setShowWinModal(false);
      setShowResumeModal(false);
      setIsActionsMenuOpen(false);
      setIsMobileActionSheetOpen(false);
      setIsMobileTopMenuOpen(false);
      setShowInteractionForm(false);
      setActiveTab('dados');
      loadOpportunityData(opportunityId);
      loadAuxiliaryData();
    } else {
      setOpportunity(null);
      setQuotes([]);
      setIsEditingInfo(false);
      setStatusModalType(null);
      setShowWinModal(false);
      setShowResumeModal(false);
      setIsActionsMenuOpen(false);
      setIsMobileActionSheetOpen(false);
      setIsMobileTopMenuOpen(false);
      setShowInteractionForm(false);
      setActiveTab('dados');
    }
  }, [isOpen, opportunityId, loadOpportunityData, loadAuxiliaryData]);

  const handleStageChange = async (newStageId: string) => {
    if (!opportunity || !canEditOpportunity) {
      alert('Você não tem permissão para movimentar esta oportunidade.');
      return;
    }

    try {
      setOpportunity((prev) => (prev ? { ...prev, stage_id: newStageId } : null));

      const { error } = await supabase
        .from('opportunities')
        .update({ stage_id: newStageId, updated_at: new Date().toISOString() })
        .eq('id', opportunity.id);

      if (error) throw error;
      onUpdated();
    } catch (err: any) {
      alert('Falha ao mudar de etapa.');
    }
  };

  const handleSaveInfo = async () => {
    if (!opportunity || !canEditOpportunity) return;

    try {
      setSavingInfo(true);
      const numValue = parsePtBrCurrency(editEstimatedValue);

      const payload = {
        title: editTitle.trim() || opportunity.title,
        estimated_value: numValue,
        service_type: editServiceType.trim() || null,
        assigned_to: permissions.isOwnerOrAdmin ? (editAssignedTo || null) : opportunity.assigned_to,
        partner_contact_id: editPartnerContactId || null,
        expected_close_date: editExpectedCloseDate ? new Date(editExpectedCloseDate).toISOString() : null,
        description: editDescription.trim() || null,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('opportunities')
        .update(payload)
        .eq('id', opportunity.id);

      if (error) throw error;

      await loadOpportunityData(opportunity.id);
      setIsEditingInfo(false);
      onUpdated();
    } catch (err: any) {
      alert('Falha ao salvar alterações.');
    } finally {
      setSavingInfo(false);
    }
  };

  const handleDeleteOpportunity = async () => {
    if (!opportunity || !canDeleteOpportunity) return;

    if (!window.confirm(`Deseja realmente excluir a oportunidade "${opportunity.title}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('opportunities')
        .delete()
        .eq('id', opportunity.id);

      if (error) throw error;

      onUpdated();
      onClose();
    } catch (err: any) {
      alert(`Erro ao excluir negociação: ${err.message}`);
    }
  };

  const handleOpenWinModal = () => {
    if (!opportunity || !canChangeStatus) return;
    setWinModalDate(new Date().toISOString().split('T')[0]);

    const currentWinning = quotes.find((q) => q.is_selected) || quotes[0];
    if (currentWinning) {
      setWinSelectedQuoteId(currentWinning.id);
      setWinModalFinalValue(
        currentWinning.total_value
          ? currentWinning.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
          : ''
      );
    } else {
      setWinSelectedQuoteId('');
      const val = opportunity.final_value || opportunity.estimated_value || 0;
      setWinModalFinalValue(val ? val.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
    }

    setCreateProject(false);
    setCreateWork(true);
    setWorkAssignedTo(opportunity.assigned_to || '');

    setShowWinModal(true);
  };

  const handleConfirmWinOpportunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opportunity || !canChangeStatus) return;

    try {
      setSavingWinModal(true);
      const numFinalValue = winModalFinalValue.trim()
        ? parsePtBrCurrency(winModalFinalValue)
        : (opportunity.final_value || opportunity.estimated_value || 0);

      const { error: oppError } = await supabase
        .from('opportunities')
        .update({
          status: 'ganha',
          won_at: new Date(winModalDate).toISOString(),
          final_value: numFinalValue,
          updated_at: new Date().toISOString()
        })
        .eq('id', opportunity.id);

      if (oppError) throw oppError;

      if (winSelectedQuoteId) {
        await supabase
          .from('opportunity_quotes')
          .update({ is_selected: false })
          .eq('opportunity_id', opportunity.id);

        await supabase
          .from('opportunity_quotes')
          .update({ is_selected: true, status: 'aprovado' })
          .eq('id', winSelectedQuoteId);
      }

      await loadOpportunityData(opportunity.id);
      setShowWinModal(false);
      onUpdated();
    } catch (err: any) {
      alert(`Erro ao salvar ganho da oportunidade: ${err.message}`);
    } finally {
      setSavingWinModal(false);
    }
  };

  const handleConfirmResumeOpportunity = async () => {
    if (!opportunity || !canChangeStatus) return;

    try {
      setResumingOpportunity(true);

      const { error } = await supabase
        .from('opportunities')
        .update({
          status: 'em_andamento',
          won_at: null,
          lost_at: null,
          lost_reason: null,
          frozen_at: null,
          frozen_reason: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', opportunity.id);

      if (error) throw error;

      await loadOpportunityData(opportunity.id);
      setShowResumeModal(false);
      onUpdated();
    } catch (err: any) {
      alert(`Erro ao retomar negociação: ${err.message}`);
    } finally {
      setResumingOpportunity(false);
    }
  };

  const handleSubmitStatusModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opportunity || !statusModalType || !canChangeStatus) return;
    if (!statusModalReason.trim()) {
      alert('Por favor, informe o motivo.');
      return;
    }

    try {
      setSavingStatusModal(true);

      const updateData: any = {
        status: statusModalType,
        updated_at: new Date().toISOString()
      };

      if (statusModalType === 'perdida') {
        updateData.lost_at = new Date(statusModalDate).toISOString();
        updateData.lost_reason = statusModalReason.trim();
      } else {
        updateData.frozen_at = new Date(statusModalDate).toISOString();
        updateData.frozen_reason = statusModalReason.trim();
      }

      const { error } = await supabase
        .from('opportunities')
        .update(updateData)
        .eq('id', opportunity.id);

      if (error) throw error;

      setOpportunity((prev) => (prev ? { ...prev, ...updateData } : null));
      setStatusModalType(null);
      setStatusModalReason('');
      onUpdated();
    } catch (err: any) {
      alert(`Erro ao atualizar: ${err.message}`);
    } finally {
      setSavingStatusModal(false);
    }
  };

  const handleOpenContact = (contactId: string) => {
    if (onOpenContactModal) {
      onOpenContactModal(contactId);
    } else {
      setInternalContactId(contactId);
      setInternalContactModalOpen(true);
    }
  };

  const handleCreateQuote = async () => {
    if (!opportunity || !user?.company?.id || !canManageQuotes) return;

    try {
      setSavingQuote(true);
      const nextNumber = quotes.length > 0 ? Math.max(...quotes.map((q) => q.quote_number || 0)) + 1 : 1;
      const insertPayload: any = {
        company_id: user.company.id,
        opportunity_id: opportunity.id,
        quote_number: nextNumber,
        title: `Proposta #${nextNumber}`,
        total_value: 0,
        status: 'rascunho',
        is_selected: false
      };

      const { data: createdQuote, error } = await supabase
        .from('opportunity_quotes')
        .insert(insertPayload)
        .select('id')
        .single();

      if (error) throw error;

      await loadQuotes(opportunity.id);
      onUpdated();

      if (createdQuote?.id) {
        setQuoteBuilderInitialEdit(true);
        setSelectedQuoteIdForBuild(createdQuote.id);
      }
    } catch (err: any) {
      alert(`Falha ao gerar proposta: ${err.message}`);
    } finally {
      setSavingQuote(false);
    }
  };

  const handleDuplicateQuote = async (sourceQuoteId: string) => {
    if (!opportunity || !user?.company?.id || !canManageQuotes) return;

    try {
      setDuplicatingQuoteId(sourceQuoteId);

      const { data: sourceQuote, error: qErr } = await supabase
        .from('opportunity_quotes')
        .select('*')
        .eq('id', sourceQuoteId)
        .single();

      if (qErr) throw qErr;

      const { data: sourceItems, error: iErr } = await supabase
        .from('opportunity_quote_items')
        .select('*')
        .eq('quote_id', sourceQuoteId)
        .order('sort_order', { ascending: true });

      if (iErr) throw iErr;

      const nextNumber = quotes.length > 0 ? Math.max(...quotes.map((q) => q.quote_number || 0)) + 1 : 1;

      const { data: newQuote, error: createErr } = await supabase
        .from('opportunity_quotes')
        .insert({
          company_id: user.company.id,
          opportunity_id: opportunity.id,
          quote_number: nextNumber,
          title: `${sourceQuote.title} (Revisão)`,
          total_value: sourceQuote.total_value || 0,
          discount_value: sourceQuote.discount_value || 0,
          discount_type: sourceQuote.discount_type || 'currency',
          payment_terms: sourceQuote.payment_terms || null,
          delivery_deadline: sourceQuote.delivery_deadline || null,
          validity_days: sourceQuote.validity_days || 15,
          notes: sourceQuote.notes || null,
          status: 'rascunho',
          is_selected: false
        })
        .select('id')
        .single();

      if (createErr) throw createErr;

      if (newQuote?.id && sourceItems && sourceItems.length > 0) {
        const clonedLines = sourceItems.map((it: any, idx: number) => ({
          company_id: user.company.id,
          quote_id: newQuote.id,
          catalog_item_id: it.catalog_item_id || null,
          name: it.name,
          description: it.description || it.name,
          item_type: it.item_type || 'equipamento',
          unit: it.unit || 'un',
          quantity: it.quantity || 1,
          unit_cost: it.unit_cost || 0,
          unit_price: it.unit_price || 0,
          sort_order: idx + 1,
          notes: it.notes || null
        }));

        await supabase.from('opportunity_quote_items').insert(clonedLines);
      }

      setOpenQuoteMenuId(null);
      await loadQuotes(opportunity.id);
      onUpdated();

      if (newQuote?.id) {
        setQuoteBuilderInitialEdit(true);
        setSelectedQuoteIdForBuild(newQuote.id);
      }
    } catch (err: any) {
      alert(`Falha ao duplicar proposta: ${err.message}`);
    } finally {
      setDuplicatingQuoteId(null);
    }
  };

  const handleConfirmDeleteQuote = async () => {
    if (!quoteToDelete || !canDeleteQuotes) return;

    try {
      setDeletingQuote(true);
      const { error } = await supabase
        .from('opportunity_quotes')
        .delete()
        .eq('id', quoteToDelete.id);

      if (error) throw error;

      if (opportunity) {
        await loadQuotes(opportunity.id);
      }
      setQuoteToDelete(null);
      onUpdated();
    } catch (err: any) {
      alert(`Erro ao excluir proposta: ${err.message}`);
    } finally {
      setDeletingQuote(false);
    }
  };

  const currentAssigned = teamMembers.find((m) => m.id === opportunity?.assigned_to);
  const currentStageIndex = useMemo(() => {
    if (!opportunity || stages.length === 0) return -1;
    return stages.findIndex(s => s.id === opportunity.stage_id);
  }, [opportunity, stages]);

  if (!isOpen) return null;

  const content = (
    <div className={`bg-slate-100 flex flex-col z-40 overflow-hidden animate-in fade-in duration-150 ${
      isMobile 
        ? 'fixed inset-0 z-[150] w-screen h-screen' 
        : 'absolute inset-0'
    }`}>
      
      {/* Estilos para rolagem leve, formulário timeline recolhido e botão de anexo no mobile */}
      <style>{`
        .lume-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .lume-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .lume-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 9999px;
        }
        .lume-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        .lume-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 transparent;
        }
        .timeline-form-hidden .rounded-2xl:has(textarea),
        .timeline-form-hidden .rounded-xl:has(textarea),
        .timeline-form-hidden form:has(textarea),
        .timeline-form-hidden .timeline-create-card {
          display: none !important;
        }
        @media (max-width: 1023px) {
          .hide-mobile-doc-btn button:has(svg.lucide-plus),
          .hide-mobile-doc-btn button:has(svg.lucide-file-up),
          .hide-mobile-doc-btn button:has(svg.lucide-upload),
          .hide-mobile-doc-btn button.bg-sky-600 {
            display: none !important;
          }
        }
      `}</style>

      {/* 1. TOPBAR EXCLUSIVA NO MOBILE (< lg): 100% da tela, Voltar na esq, Menu de Ações na dir */}
      <div className="flex lg:hidden items-center justify-between px-3.5 py-2.5 bg-white border-b border-slate-200/90 shrink-0 z-30 shadow-2xs">
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 hover:text-slate-900 transition cursor-pointer shadow-2xs"
          title="Voltar"
        >
          <ArrowLeft size={16} />
        </button>

        <span className="text-xs font-bold text-slate-800 tracking-tight uppercase">
          Detalhes da Oportunidade
        </span>

        {/* Botão de Menu do Topo */}
        <button
          type="button"
          onClick={() => setIsMobileTopMenuOpen(true)}
          className="w-8 h-8 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 hover:text-slate-900 transition cursor-pointer shadow-2xs"
          title="Menu de Ações"
        >
          <MoreVertical size={16} />
        </button>
      </div>

      {/* 2. CABEÇALHO RESTAURADO COM CARROSSEL DAS ETAPAS, FONTES ORIGINAIS E ETIQUETAS */}
      {opportunity && (
        <header className="bg-white border-b border-slate-200/90 p-4 sm:px-6 sm:py-4 shrink-0 shadow-2xs z-30 space-y-3">
          
          {/* Linha 1: Título e Botões na Extremidade Direita no Desktop */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1.5 min-w-0">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight truncate">
                {opportunity.title}
              </h2>

              {/* Etiquetas na linha de baixo alinhadas à esquerda com o título */}
              <div className="flex items-center gap-2 flex-wrap">
                {opportunity.code && (
                  <span className="font-mono text-[11px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-lg shrink-0">
                    {opportunity.code}
                  </span>
                )}

                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shrink-0 ${
                  opportunity.status === 'ganha'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : opportunity.status === 'perdida'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : opportunity.status === 'congelada'
                    ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                    : 'bg-sky-50 text-sky-700 border-sky-200'
                }`}>
                  {opportunity.status === 'em_andamento'
                    ? 'Em Negociação'
                    : opportunity.status === 'congelada'
                    ? '❄️ Congelada'
                    : opportunity.status === 'ganha'
                    ? '🏆 Ganha'
                    : 'Perdida'}
                </span>
              </div>
            </div>

            {/* Extremidade Direita no Desktop: Botões (Ganhar/Perder/Congelar), Menu (...) e Fechar (X) */}
            <div className="hidden lg:flex items-center gap-2.5 shrink-0 self-center">
              {canChangeStatus && (
                <div className="flex items-center gap-1.5">
                  {opportunity.status === 'em_andamento' ? (
                    <>
                      <button
                        type="button"
                        onClick={handleOpenWinModal}
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-2xs transition active:scale-98 cursor-pointer"
                      >
                        <CheckCircle2 size={14} />
                        <span>Ganhar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusModalType('perdida')}
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-2xs transition active:scale-98 cursor-pointer"
                      >
                        <XCircle size={14} />
                        <span>Perder</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusModalType('congelada')}
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 rounded-xl text-xs font-bold transition active:scale-98 cursor-pointer"
                      >
                        <Snowflake size={14} />
                        <span>Congelar</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowResumeModal(true)}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-2xs transition active:scale-98 cursor-pointer"
                    >
                      <RotateCcw size={14} />
                      <span>Retomar Negociação</span>
                    </button>
                  )}
                </div>
              )}

              {/* Menu de Ações (...) e Botão Fechar (X) no Desktop */}
              <div className="flex items-center gap-1 pl-1.5 border-l border-slate-200" ref={actionsMenuRef}>
                {canEditOpportunity && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsActionsMenuOpen(!isActionsMenuOpen)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                      title="Mais Opções"
                    >
                      <MoreVertical size={16} />
                    </button>

                    {isActionsMenuOpen && (
                      <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-2xl shadow-xl py-1 z-50 text-xs text-left animate-in fade-in zoom-in-95 duration-100">
                        <button
                          type="button"
                          onClick={() => {
                            setIsActionsMenuOpen(false);
                            setIsEditingInfo(true);
                          }}
                          className="w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer font-medium"
                        >
                          <Edit3 size={14} className="text-sky-600" />
                          <span>Editar Negócio</span>
                        </button>

                        {canDeleteOpportunity && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsActionsMenuOpen(false);
                              handleDeleteOpportunity();
                            }}
                            className="w-full px-3.5 py-2 text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer font-medium border-t border-slate-100"
                          >
                            <Trash2 size={14} />
                            <span>Excluir Negócio</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                  title="Fechar"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* Linha 2: Carrossel das Etapas tipo Bandeira / Chevron contínuo */}
          {stages.length > 0 && (
            <div className="w-full overflow-x-auto no-scrollbar pt-1.5">
              <div className="flex items-center w-full min-w-max border border-slate-200/90 rounded-xl overflow-hidden bg-slate-50 shadow-2xs">
                {stages.map((st, idx) => {
                  const isCurrent = st.id === opportunity.stage_id;
                  const isPassed = currentStageIndex > idx;
                  const isFirst = idx === 0;
                  const isLast = idx === stages.length - 1;

                  const clipStyle = !isLast
                    ? isFirst
                      ? { clipPath: 'polygon(0% 0%, calc(100% - 14px) 0%, 100% 50%, calc(100% - 14px) 100%, 0% 100%)' }
                      : { clipPath: 'polygon(0% 0%, calc(100% - 14px) 0%, 100% 50%, calc(100% - 14px) 100%, 0% 100%, 14px 50%)' }
                    : { clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 14px 50%)' };

                  return (
                    <button
                      key={st.id}
                      type="button"
                      disabled={!canEditOpportunity || opportunity.status !== 'em_andamento'}
                      onClick={() => handleStageChange(st.id)}
                      style={clipStyle}
                      className={`flex-1 min-w-[120px] py-2.5 px-4 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed -mr-3.5 last:mr-0 z-[${
                        stages.length - idx
                      }] ${
                        isCurrent
                          ? 'bg-sky-600 text-white shadow-xs z-10'
                          : isPassed
                          ? 'bg-sky-100/80 text-sky-800 hover:bg-sky-200/80'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200/70'
                      }`}
                    >
                      {isPassed ? (
                        <Check size={12} className="stroke-[3] text-sky-700 shrink-0" />
                      ) : (
                        <span className={`w-3.5 h-3.5 rounded-full text-[9px] flex items-center justify-center font-mono shrink-0 ${
                          isCurrent ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {idx + 1}
                        </span>
                      )}
                      <span className="truncate">{st.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </header>
      )}

      {/* 3. BARRA DE NAVEGAÇÃO DE ABAS NO MOBILE (< lg) */}
      <div className="flex lg:hidden bg-white border-b border-slate-200/90 px-3 shrink-0 overflow-x-auto no-scrollbar shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab('dados')}
          className={`py-3 px-3 border-b-2 text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'dados' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500'
          }`}
        >
          <Briefcase size={14} />
          <span>Dados</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('timeline')}
          className={`py-3 px-3 border-b-2 text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'timeline' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500'
          }`}
        >
          <HistoryIcon size={14} />
          <span>Histórico</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('quotes')}
          className={`py-3 px-3 border-b-2 text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'quotes' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500'
          }`}
        >
          <FileText size={14} />
          <span>Propostas ({quotes.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('documents')}
          className={`py-3 px-3 border-b-2 text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'documents' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500'
          }`}
        >
          <Paperclip size={14} />
          <span>Anexos</span>
        </button>
      </div>

      {/* 4. CORPO: DADOS DA NEGOCIAÇÃO À ESQUERDA + ABAS À DIREITA */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-y-auto lg:overflow-hidden">
        
        {/* COLUNA LATERAL ESQUERDA (lg:w-[420px]) */}
        <aside className={`w-full lg:w-[420px] bg-white border-b lg:border-b-0 lg:border-r border-slate-200/90 flex flex-col shrink-0 overflow-y-auto lume-scrollbar p-4 sm:p-5 space-y-3.5 ${
          activeTab !== 'dados' ? 'hidden lg:flex' : 'flex'
        }`}>
          {loading || !opportunity ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              <Loader2 size={20} className="animate-spin text-sky-600 mx-auto mb-2" />
              Carregando dados...
            </div>
          ) : (
            <>
              {/* 1. Card de Valores */}
              <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl grid grid-cols-2 gap-2.5">
                <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Valor Estimado
                  </span>
                  <strong className="text-xs sm:text-sm font-extrabold text-slate-800 font-mono">
                    {formatCurrency(opportunity.estimated_value)}
                  </strong>
                </div>

                <div className={`p-2.5 rounded-xl border ${
                  opportunity.status === 'ganha' ? 'bg-emerald-50/70 border-emerald-200' : 'bg-white border-slate-200/80'
                }`}>
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                    Valor Fechado
                  </span>
                  <strong className="text-xs sm:text-sm font-extrabold text-emerald-800 font-mono">
                    {opportunity.final_value ? formatCurrency(opportunity.final_value) : '—'}
                  </strong>
                </div>
              </div>

              {/* 2. Dados do Negócio (Abaixo dos valores, acima do contato) */}
              <div className="p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-2 text-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Dados do Negócio
                </span>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Tipo de Serviço:</span>
                    <span className="font-semibold text-slate-800">{formatServiceTypeName(opportunity.service_type)}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Previsão Fechamento:</span>
                    <span className="font-semibold text-slate-800">
                      {opportunity.expected_close_date
                        ? new Date(opportunity.expected_close_date).toLocaleDateString('pt-BR')
                        : 'Não definida'}
                    </span>
                  </div>

                  {opportunity.description && (
                    <div className="pt-2 border-t border-slate-200/60">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Observações
                      </span>
                      <p className="text-slate-600 leading-relaxed bg-white p-2.5 rounded-xl border border-slate-200/70 whitespace-pre-line text-[11px]">
                        {opportunity.description}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Contato / Cliente */}
              <div className="p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-2 text-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Cliente / Contato
                </span>

                {opportunity.contact ? (
                  <div
                    onClick={() => handleOpenContact(opportunity.contact!.id)}
                    className="p-2.5 bg-white rounded-xl border border-slate-200/80 hover:border-sky-300 hover:shadow-2xs transition flex items-center justify-between gap-2.5 cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-xs shrink-0 border border-slate-200">
                        {opportunity.contact.avatar_url ? (
                          <img src={opportunity.contact.avatar_url} alt="" className="w-full h-full object-cover rounded-xl" />
                        ) : opportunity.contact.type === 'company' ? (
                          <Building2 size={16} />
                        ) : (
                          opportunity.contact.display_name.slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <strong className="block text-xs font-bold text-slate-900 group-hover:text-sky-600 transition truncate">
                          {opportunity.contact.display_name}
                        </strong>
                        <span className="text-[10px] text-slate-400 truncate block">
                          {opportunity.contact.phone ? formatPhoneNumber(opportunity.contact.phone) : 'Sem telefone cadastrado'}
                        </span>
                      </div>
                    </div>
                    <ExternalLink size={13} className="text-slate-400 group-hover:text-sky-600 shrink-0" />
                  </div>
                ) : (
                  <p className="text-slate-400 italic">Nenhum cliente vinculado.</p>
                )}
              </div>

              {/* 4. Responsável Comercial */}
              <div className="p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Responsável:</span>
                  
                  <div
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredOwnerCoords({ top: rect.bottom + 6, left: Math.min(rect.left, window.innerWidth - 270) });
                    }}
                    onMouseLeave={() => setHoveredOwnerCoords(null)}
                    className="inline-flex items-center gap-1.5 font-bold text-slate-800 hover:text-sky-600 transition cursor-pointer"
                  >
                    <div className="w-5 h-5 rounded-full overflow-hidden bg-slate-200 shrink-0 border border-slate-300">
                      {currentAssigned?.avatar_url ? (
                        <img src={currentAssigned.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-sky-600 text-white flex items-center justify-center text-[9px] font-bold">
                          {(currentAssigned?.name || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <span>{formatShortName(currentAssigned?.name || 'Não atribuído')}</span>
                  </div>
                </div>
              </div>

              {/* 5. Parceiro / Indicador (SÓ APARECE SE TIVER PARCEIRO CADASTRADO) */}
              {opportunity.partner && (
                <div className="p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-2 text-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Parceiro / Indicador
                  </span>

                  <div
                    onClick={() => handleOpenContact(opportunity.partner!.id)}
                    className="p-2.5 bg-white rounded-xl border border-slate-200/80 hover:border-sky-300 hover:shadow-2xs transition flex items-center justify-between gap-2.5 cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0 border border-slate-200">
                        {opportunity.partner.avatar_url ? (
                          <img src={opportunity.partner.avatar_url} alt="" className="w-full h-full object-cover rounded-xl" />
                        ) : (
                          <Handshake size={16} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <strong className="block text-xs font-bold text-slate-900 group-hover:text-sky-600 transition truncate">
                          {opportunity.partner.display_name}
                        </strong>
                        <span className="text-[10px] text-slate-400 truncate block">
                          {opportunity.partner.phone ? formatPhoneNumber(opportunity.partner.phone) : 'Indicador parceiro'}
                        </span>
                      </div>
                    </div>
                    <ExternalLink size={13} className="text-slate-400 group-hover:text-sky-600 shrink-0" />
                  </div>
                </div>
              )}
            </>
          )}
        </aside>

        {/* PAINEL PRINCIPAL À DIREITA: ABAS (HISTÓRICO, PROPOSTAS, ANEXOS) */}
        <main className={`flex-1 flex flex-col min-w-0 bg-slate-50/60 overflow-hidden ${
          activeTab === 'dados' ? 'hidden lg:flex' : 'flex'
        }`}>
          
          {/* BARRA DE NAVEGAÇÃO DE ABAS NO DESKTOP (lg) */}
          <div className="hidden lg:flex px-6 bg-white border-b border-slate-200/90 items-center justify-between shrink-0 shadow-2xs">
            <div className="flex items-center gap-6 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('timeline')}
                className={`py-4 border-b-2 transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'timeline' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <HistoryIcon size={15} />
                <span>Histórico</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('quotes')}
                className={`py-4 border-b-2 transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'quotes' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileText size={15} />
                <span>Propostas & Orçamentos</span>
                {quotes.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700">
                    {quotes.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('documents')}
                className={`py-4 border-b-2 transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'documents' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Paperclip size={15} />
                <span>Anexos & Documentos</span>
              </button>
            </div>
          </div>

          {/* CONTEÚDO DAS ABAS */}
          <div className="flex-1 overflow-y-auto lume-scrollbar p-4 sm:p-6">
            
            {/* ABA HISTÓRICO */}
            {(activeTab === 'timeline' || (activeTab === 'dados' && !isMobile)) && opportunity && (
              <div 
                className={`max-w-4xl mx-auto space-y-4 ${!showInteractionForm ? 'timeline-form-hidden' : ''}`}
                onClickCapture={(e) => {
                  const target = e.target as HTMLElement;
                  const btn = target.closest('button');
                  if (!btn) return;
                  if (btn.getAttribute('data-toggle-interaction') === 'true') return;

                  const text = (btn.innerText || btn.textContent || '').toLowerCase().trim();
                  if (text === 'cancelar') {
                    setShowInteractionForm(false);
                  } else if (text === 'salvar' && btn.type === 'submit') {
                    setTimeout(() => setShowInteractionForm(false), 500);
                  }
                }}
                onSubmitCapture={() => {
                  setTimeout(() => setShowInteractionForm(false), 500);
                }}
              >
                {/* Botão de Registro de Interação (Apenas Desktop) */}
                {canEditOpportunity && (
                  <div className="hidden md:flex bg-white border border-slate-200/90 rounded-2xl p-3 shadow-2xs items-center justify-between">
                    <span className="text-xs text-slate-600 font-medium">Registrar nota, ligação, reunião ou mensagem para esta negociação:</span>
                    <button
                      type="button"
                      data-toggle-interaction="true"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowInteractionForm(prev => !prev);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>{showInteractionForm ? 'Recolher' : 'Registrar Interação'}</span>
                    </button>
                  </div>
                )}

                <EntityTimeline
                  entityType="opportunity"
                  entityId={opportunity.id}
                  companyId={opportunity.company_id || user?.company?.id || ''}
                  contactId={opportunity.contact_id}
                />
              </div>
            )}

            {/* ABA PROPOSTAS & ORÇAMENTOS */}
            {activeTab === 'quotes' && opportunity && (
              <div className="max-w-4xl mx-auto space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Orçamentos & Cotações ({quotes.length})
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Crie propostas e envie opções com composições personalizadas.
                    </p>
                  </div>

                  {canManageQuotes && (
                    <button
                      type="button"
                      disabled={savingQuote}
                      onClick={handleCreateQuote}
                      className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer disabled:opacity-50"
                    >
                      <Plus size={14} />
                      <span>Novo Orçamento</span>
                    </button>
                  )}
                </div>

                {quotes.length === 0 ? (
                  <div className="py-16 text-center space-y-3 bg-white rounded-2xl border border-dashed border-slate-200">
                    <FileText size={28} className="text-slate-300 mx-auto" />
                    <h5 className="text-xs font-bold text-slate-700">Nenhum orçamento montado</h5>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      Clique em "Novo Orçamento" para compor preços e emitir a folha timbrada.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {quotes.map((q) => (
                      <div
                        key={q.id}
                        onClick={() => {
                          setQuoteBuilderInitialEdit(false);
                          setSelectedQuoteIdForBuild(q.id);
                        }}
                        className={`p-3.5 sm:p-4 rounded-2xl border transition flex items-center justify-between gap-3 group cursor-pointer ${
                          q.is_selected
                            ? 'bg-emerald-50/60 border-emerald-300 ring-2 ring-emerald-400/40 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-sky-300 hover:shadow-2xs'
                        }`}
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg">
                              {q.code || `#${q.quote_number}`}
                            </span>
                            <strong className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-sky-700 transition-colors truncate">
                              {q.title}
                            </strong>
                            {q.is_selected && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white shadow-2xs">
                                <Trophy size={11} /> Proposta Vencedora
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400">
                            Emitido em {new Date(q.created_at).toLocaleDateString('pt-BR')}
                            {q.notes && ` • ${q.notes}`}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 shrink-0" onClick={e => e.stopPropagation()}>
                          <strong className="text-xs sm:text-sm font-extrabold text-slate-900 font-mono">
                            {formatCurrency(q.total_value)}
                          </strong>

                          <button
                            type="button"
                            onClick={() => setSelectedQuoteIdForPrint(q.id)}
                            title="Imprimir / PDF Timbrado"
                            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer"
                          >
                            <Printer size={15} />
                          </button>

                          {(canManageQuotes || canDeleteQuotes) && (
                            <div className="relative" ref={openQuoteMenuId === q.id ? quoteMenuBoxRef : null}>
                              <button
                                type="button"
                                onClick={() => setOpenQuoteMenuId(openQuoteMenuId === q.id ? null : q.id)}
                                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer"
                              >
                                <MoreVertical size={15} />
                              </button>

                              {openQuoteMenuId === q.id && (
                                <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-2xl shadow-xl py-1 z-50 text-xs animate-in fade-in duration-100">
                                  {canManageQuotes && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenQuoteMenuId(null);
                                          setQuoteBuilderInitialEdit(true);
                                          setSelectedQuoteIdForBuild(q.id);
                                        }}
                                        className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer font-medium"
                                      >
                                        <Edit3 size={14} className="text-sky-600" />
                                        <span>Editar Proposta</span>
                                      </button>
                                      <button
                                        type="button"
                                        disabled={Boolean(duplicatingQuoteId)}
                                        onClick={() => handleDuplicateQuote(q.id)}
                                        className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer font-medium"
                                      >
                                        <Copy size={14} className="text-emerald-600" />
                                        <span>Duplicar (Revisão)</span>
                                      </button>
                                    </>
                                  )}

                                  {canDeleteQuotes && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenQuoteMenuId(null);
                                        setQuoteToDelete({ id: q.id, title: q.title });
                                      }}
                                      className="w-full text-left px-3 py-2 text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer font-medium border-t border-slate-100"
                                    >
                                      <Trash2 size={14} />
                                      <span>Excluir Proposta</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ABA ANEXOS */}
            {activeTab === 'documents' && opportunity && (
              <div className="max-w-4xl mx-auto hide-mobile-doc-btn">
                <EntityDocuments
                  entityType="opportunity"
                  entityId={opportunity.id}
                  companyId={opportunity.company_id || user?.company?.id || ''}
                />
              </div>
            )}
          </div>
        </main>
      </div>

      {/* BOTÃO FLUTUANTE (FAB +) EXCLUSIVO MOBILE */}
      {canShowMobileFab && (
        <button
          type="button"
          onClick={() => setIsMobileActionSheetOpen(true)}
          className="md:hidden fixed bottom-6 right-6 z-[60] w-14 h-14 bg-sky-600 hover:bg-sky-500 active:scale-95 text-white rounded-full shadow-2xl flex items-center justify-center cursor-pointer transition-all border border-sky-400/40"
          title="Ações Rápidas"
        >
          <Plus size={26} strokeWidth={2.5} />
        </button>
      )}

      {/* ACTION SHEET 1: ABERTURA PELO BOTÃO FLUTUANTE (+) */}
      {isMobileActionSheetOpen && (
        <div className="md:hidden fixed inset-0 z-[160] flex flex-col justify-end bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div 
            className="absolute inset-0" 
            onClick={() => setIsMobileActionSheetOpen(false)} 
          />

          <div className="relative bg-white rounded-t-3xl p-5 space-y-3 animate-in slide-in-from-bottom duration-200 border-t border-slate-200">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-2" />

            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
              Adicionar à Negociação
            </h3>

            <div className="space-y-2 pt-1">
              {canManageQuotes && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileActionSheetOpen(false);
                    handleCreateQuote();
                  }}
                  className="w-full p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center gap-3 text-slate-800 font-semibold text-xs transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <FileText size={18} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-slate-900">Novo Orçamento</p>
                    <p className="text-[11px] text-slate-500 font-normal">Compor proposta comercial</p>
                  </div>
                </button>
              )}

              {canEditOpportunity && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileActionSheetOpen(false);
                    setActiveTab('timeline');
                    setShowInteractionForm(true);
                  }}
                  className="w-full p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center gap-3 text-slate-800 font-semibold text-xs transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                    <Clock size={18} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-slate-900">Registrar Interação / Tarefa</p>
                    <p className="text-[11px] text-slate-500 font-normal">Notas, ligações ou reuniões</p>
                  </div>
                </button>
              )}

              {canEditOpportunity && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileActionSheetOpen(false);
                    setActiveTab('documents');
                    setTimeout(() => {
                      const fileInput = document.querySelector('.hide-mobile-doc-btn input[type="file"]') as HTMLInputElement;
                      if (fileInput) fileInput.click();
                    }, 300);
                  }}
                  className="w-full p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center gap-3 text-slate-800 font-semibold text-xs transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                    <FileUp size={18} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-slate-900">Anexar Documento</p>
                    <p className="text-[11px] text-slate-500 font-normal">Upload de contratos e propostas</p>
                  </div>
                </button>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsMobileActionSheetOpen(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACTION SHEET 2: ABERTURA PELO MENU DO TOPO (...) */}
      {isMobileTopMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[160] flex flex-col justify-end bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div 
            className="absolute inset-0" 
            onClick={() => setIsMobileTopMenuOpen(false)} 
          />

          <div className="relative bg-white rounded-t-3xl p-5 space-y-3 animate-in slide-in-from-bottom duration-200 border-t border-slate-200">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-2" />

            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
              Gerenciar Oportunidade
            </h3>

            {/* Linha de Status: Ganhar, Perder e Congelar (ou Retomar) */}
            {canChangeStatus && opportunity && (
              <div className="pb-2 border-b border-slate-100">
                {opportunity.status === 'em_andamento' ? (
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileTopMenuOpen(false);
                        handleOpenWinModal();
                      }}
                      className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs flex flex-col items-center gap-1 active:scale-95 transition"
                    >
                      <CheckCircle2 size={18} />
                      <span>Ganhar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileTopMenuOpen(false);
                        setStatusModalType('perdida');
                      }}
                      className="p-2.5 rounded-2xl bg-rose-50 text-rose-700 border border-rose-200 font-bold text-xs flex flex-col items-center gap-1 active:scale-95 transition"
                    >
                      <XCircle size={18} />
                      <span>Perder</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileTopMenuOpen(false);
                        setStatusModalType('congelada');
                      }}
                      className="p-2.5 rounded-2xl bg-cyan-50 text-cyan-800 border border-cyan-200 font-bold text-xs flex flex-col items-center gap-1 active:scale-95 transition"
                    >
                      <Snowflake size={18} />
                      <span>Congelar</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileTopMenuOpen(false);
                      setShowResumeModal(true);
                    }}
                    className="w-full p-2.5 rounded-2xl bg-sky-50 text-sky-800 border border-sky-200 font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition"
                  >
                    <RotateCcw size={16} />
                    <span>Retomar Negociação</span>
                  </button>
                )}
              </div>
            )}

            <div className="space-y-2 pt-1">
              {canEditOpportunity && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileTopMenuOpen(false);
                    setIsEditingInfo(true);
                  }}
                  className="w-full p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center gap-3 text-slate-800 font-semibold text-xs transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                    <Edit3 size={18} className="text-sky-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-slate-900">Editar Negócio</p>
                    <p className="text-[11px] text-slate-500 font-normal">Altere valores, prazos e detalhes</p>
                  </div>
                </button>
              )}

              {canDeleteOpportunity && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileTopMenuOpen(false);
                    handleDeleteOpportunity();
                  }}
                  className="w-full p-3 bg-rose-50/70 hover:bg-rose-100/70 rounded-2xl flex items-center gap-3 text-rose-800 font-semibold text-xs transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                    <Trash2 size={18} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-rose-900">Excluir Negócio</p>
                    <p className="text-[11px] text-rose-600 font-normal">Remover esta oportunidade do funil</p>
                  </div>
                </button>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsMobileTopMenuOpen(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPOVER HOVER DO RESPONSÁVEL */}
      {hoveredOwnerCoords && currentAssigned && createPortal(
        <div
          style={{ position: 'fixed', top: `${hoveredOwnerCoords.top}px`, left: `${hoveredOwnerCoords.left}px` }}
          className="w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl p-3 z-[99999] pointer-events-none animate-in fade-in zoom-in-95 duration-100 text-left"
        >
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
            <div className="w-9 h-9 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
              {currentAssigned.avatar_url ? (
                <img src={currentAssigned.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-sky-600 text-white flex items-center justify-center font-bold text-xs">
                  {currentAssigned.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <strong className="block text-xs font-bold text-slate-900 truncate">{currentAssigned.name}</strong>
              <span className="text-[10px] text-slate-400">Responsável Comercial</span>
            </div>
          </div>
          {currentAssigned.email && (
            <p className="text-[11px] text-slate-500 pt-2 truncate flex items-center gap-1.5">
              <Mail size={12} className="text-slate-400 shrink-0" />
              <span>{currentAssigned.email}</span>
            </p>
          )}
        </div>,
        document.body
      )}

      {/* MODAL DE EDIÇÃO DA OPORTUNIDADE */}
      {isEditingInfo && opportunity && (
        <div className="fixed inset-0 z-[260] flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl border border-slate-200 p-5 sm:p-6 w-full sm:max-w-lg shadow-2xl space-y-4 max-h-[85vh] sm:max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-200 sm:zoom-in-95">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-2 sm:hidden" />
            
            <div className="flex items-center justify-between border-b pb-3">
              <h4 className="font-bold text-sm sm:text-base text-slate-900">Editar Detalhes da Oportunidade</h4>
              <button onClick={() => setIsEditingInfo(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Título da Negociação *</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Valor Estimado (R$)</label>
                  <input
                    type="text"
                    value={editEstimatedValue}
                    onChange={(e) => setEditEstimatedValue(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tipo de Serviço</label>
                  <select
                    value={editServiceType}
                    onChange={(e) => setEditServiceType(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500 cursor-pointer"
                  >
                    <option value="">Não informado</option>
                    {serviceTypes.map((opt) => (
                      <option key={opt.id} value={opt.name}>{opt.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Responsável</label>
                  <select
                    value={editAssignedTo}
                    disabled={!permissions.isOwnerOrAdmin}
                    onChange={(e) => setEditAssignedTo(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500 cursor-pointer disabled:opacity-60"
                  >
                    <option value="">Não atribuído</option>
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Previsão Fechamento</label>
                  <input
                    type="date"
                    value={editExpectedCloseDate}
                    onChange={(e) => setEditExpectedCloseDate(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Parceiro / Indicador</label>
                <select
                  value={editPartnerContactId}
                  onChange={(e) => setEditPartnerContactId(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500 cursor-pointer"
                >
                  <option value="">Nenhum (Origem direta)</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Observações</label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Detalhes ou condições da negociação..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-sky-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsEditingInfo(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingInfo}
                  onClick={handleSaveInfo}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-2xs disabled:opacity-50 cursor-pointer"
                >
                  {savingInfo ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE GANHO (SEM MODELO DE OBRA) */}
      {showWinModal && opportunity && (
        <div className="fixed inset-0 z-[260] flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl border border-slate-200 p-5 sm:p-7 w-full sm:max-w-md shadow-2xl animate-in slide-in-from-bottom duration-200 sm:zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-2 sm:hidden" />

            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                  <Trophy size={18} />
                </div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  Marcar Negociação como Ganha
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowWinModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handleConfirmWinOpportunity} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Data de Fechamento / Ganho *
                </label>
                <input
                  type="date"
                  required
                  value={winModalDate}
                  onChange={(e) => setWinModalDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {quotes.length > 0 && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Qual proposta foi aceita pelo cliente?
                  </label>
                  <select
                    value={winSelectedQuoteId}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      setWinSelectedQuoteId(selectedId);
                      const qMatch = quotes.find((q) => q.id === selectedId);
                      if (qMatch) {
                        setWinModalFinalValue(
                          qMatch.total_value
                            ? qMatch.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                            : ''
                        );
                      }
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="">Nenhuma proposta específica (Digitar valor livre)</option>
                    {quotes.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.code ? `${q.code} - ` : ''}{q.title} ({formatCurrency(q.total_value)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Valor Final Fechado (R$) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="0,00"
                  value={winModalFinalValue}
                  onChange={(e) => setWinModalFinalValue(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold focus:ring-2 focus:ring-emerald-500 text-sm font-mono"
                />
              </div>

              {/* Seção Operacional sem modelo */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                  Desdobramento Operacional
                </span>

                {/* Obra Física */}
                <div className="p-3 bg-amber-50/50 rounded-2xl border border-amber-200/80 space-y-3">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="flex items-center gap-2 font-bold text-amber-900 text-xs">
                      <HardHat size={16} className="text-amber-600" />
                      Criar Obra (Execução em Campo)
                    </span>
                    <input
                      type="checkbox"
                      checked={createWork}
                      onChange={(e) => setCreateWork(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 accent-amber-600 cursor-pointer"
                    />
                  </label>

                  {createWork && (
                    <div className="pt-2 border-t border-amber-200/60">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Responsável Técnico pela Obra
                      </label>
                      <select
                        value={workAssignedTo}
                        onChange={(e) => setWorkAssignedTo(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:ring-2 focus:ring-amber-500 cursor-pointer"
                      >
                        <option value="">Manter responsável da oportunidade</option>
                        {teamMembers.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Projeto */}
                <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200/90 space-y-3">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="flex items-center gap-2 font-bold text-slate-800 text-xs">
                      <Compass size={15} className="text-sky-600" />
                      Criar Projeto (Engenharia / Homologação)
                    </span>
                    <input
                      type="checkbox"
                      checked={createProject}
                      onChange={(e) => setCreateProject(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 accent-sky-600 cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowWinModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingWinModal}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold shadow-2xs cursor-pointer active:scale-98 disabled:opacity-50"
                >
                  {savingWinModal ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  <span>Confirmar Vitória</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE PERDA OU CONGELAMENTO */}
      {statusModalType && (
        <div className="fixed inset-0 z-[260] flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl border border-slate-200 p-5 sm:p-7 w-full sm:max-w-md shadow-2xl animate-in slide-in-from-bottom duration-200 sm:zoom-in-95">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-2 sm:hidden" />

            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                {statusModalType === 'perdida' ? (
                  <XCircle size={18} className="text-rose-600" />
                ) : (
                  <Snowflake size={18} className="text-cyan-600" />
                )}
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  {statusModalType === 'perdida' ? 'Marcar como Negócio Perdido' : 'Congelar Negociação'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setStatusModalType(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handleSubmitStatusModal} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Data do Evento *
                </label>
                <input
                  type="date"
                  required
                  value={statusModalDate}
                  onChange={(e) => setStatusModalDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {statusModalType === 'perdida' ? 'Por que o negócio foi perdido? *' : 'Por que a negociação será congelada? *'}
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder={
                    statusModalType === 'perdida'
                      ? 'Ex: Cliente optou por concorrente com preço mais baixo...'
                      : 'Ex: Projeto postergado para o próximo trimestre...'
                  }
                  value={statusModalReason}
                  onChange={(e) => setStatusModalReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-sky-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStatusModalType(null)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingStatusModal}
                  className={`inline-flex items-center gap-1.5 px-5 py-2 text-white rounded-xl font-semibold shadow-2xs cursor-pointer active:scale-98 disabled:opacity-50 ${
                    statusModalType === 'perdida'
                      ? 'bg-rose-600 hover:bg-rose-500'
                      : 'bg-cyan-600 hover:bg-cyan-500'
                  }`}
                >
                  {savingStatusModal ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  <span>Confirmar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE RETOMADA */}
      {showResumeModal && opportunity && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl text-center space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto border border-sky-100">
              <RotateCcw size={22} />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-900">Retomar Negociação</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Deseja reativar a oportunidade <strong className="text-slate-800">"{opportunity.title}"</strong> e colocá-la em andamento novamente no funil comercial?
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                disabled={resumingOpportunity}
                onClick={() => setShowResumeModal(false)}
                className="flex-1 py-2 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={resumingOpportunity}
                onClick={handleConfirmResumeOpportunity}
                className="flex-1 py-2 px-3 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {resumingOpportunity ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                <span>Retomar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE COMPOSIÇÃO DE ITENS DO ORÇAMENTO */}
      {selectedQuoteIdForBuild && opportunity && (
        <QuoteBuilderModal
          quoteId={selectedQuoteIdForBuild}
          opportunityId={opportunity.id}
          isOpen={Boolean(selectedQuoteIdForBuild)}
          initialEditMode={quoteBuilderInitialEdit}
          onClose={() => {
            setSelectedQuoteIdForBuild(null);
            setQuoteBuilderInitialEdit(false);
          }}
          onSaved={() => {
            loadQuotes(opportunity.id);
            loadOpportunityData(opportunity.id);
            onUpdated();
          }}
          onOpenPrint={(qId) => {
            setSelectedQuoteIdForBuild(null);
            setQuoteBuilderInitialEdit(false);
            setSelectedQuoteIdForPrint(qId);
          }}
        />
      )}

      {/* MODAL DE FOLHA TIMBRADA / IMPRESSÃO EM PDF */}
      {selectedQuoteIdForPrint && opportunity && (
        <QuotePrintView
          quoteId={selectedQuoteIdForPrint}
          opportunityId={opportunity.id}
          isOpen={Boolean(selectedQuoteIdForPrint)}
          onClose={() => setSelectedQuoteIdForPrint(null)}
        />
      )}

      {/* MODAL DE PERFIL DE CONTATO QUANDO ABERTO DE DENTRO DA OPORTUNIDADE */}
      {internalContactModalOpen && internalContactId && (
        <ContactProfileModal
          contactId={internalContactId}
          isOpen={internalContactModalOpen}
          zIndexLevel="overlay"
          onClose={() => {
            setInternalContactModalOpen(false);
            setInternalContactId(null);
          }}
        />
      )}

      {/* MODAL CUSTOMIZADO: EXCLUSÃO DE PROPOSTA */}
      {quoteToDelete && (
        <div className="fixed inset-0 z-[280] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-150 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <Trash2 size={22} />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-900 leading-tight">
                Excluir Proposta
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Tem certeza que deseja excluir a <strong className="text-slate-800 font-bold">"{quoteToDelete.title}"</strong>? Esta ação não pode ser desfeita.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                disabled={deletingQuote}
                onClick={() => setQuoteToDelete(null)}
                className="w-1/2 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingQuote}
                onClick={handleConfirmDeleteQuote}
                className="w-1/2 inline-flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-2xs transition cursor-pointer active:scale-98 disabled:opacity-50"
              >
                {deletingQuote ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (isMobile || !targetMainEl)
    ? createPortal(content, document.body)
    : createPortal(content, targetMainEl);
};

export default OpportunityDetailModal;