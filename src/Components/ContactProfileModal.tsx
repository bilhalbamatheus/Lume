import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { EntityTimeline } from './EntityTimeline';
import { EntityDocuments } from './EntityDocuments';
import {
  X,
  User,
  Building2,
  Phone,
  Mail,
  MapPin,
  MessageCircle,
  Briefcase,
  Loader2,
  Edit3,
  Camera,
  Plus,
  Trash2,
  ZoomOut,
  ChevronDown,
  UserCheck,
  TrendingUp,
  Calendar,
  ExternalLink,
  Unlink,
  Paperclip,
  MoreVertical,
  ArrowLeft,
  Search,
  Star,
  Globe,
  Clock,
  FileUp,
  AlertTriangle,
  History as HistoryIcon
} from 'lucide-react';

interface ContactProfileModalProps {
  contactId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onContactUpdated?: () => void;
  onNavigateToContact?: (targetContactId: string) => void;
  onOpenOpportunity?: (opportunityId: string) => void;
  onCreateOpportunityForContact?: (contactId: string) => void;
  zIndexLevel?: 'base' | 'overlay';
}

interface PhoneItem {
  id?: string;
  phone_number: string;
  is_whatsapp: boolean;
  is_primary: boolean;
  notes?: string | null;
  label?: string | null;
}

interface EmailItem {
  id?: string;
  email: string;
  is_primary: boolean;
  notes?: string | null;
  label?: string | null;
}

interface AddressItem {
  id?: string;
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  is_primary?: boolean;
  notes?: string | null;
  label?: string | null;
}

interface FullContactData {
  id: string;
  company_id: string;
  type: 'person' | 'company';
  display_name: string;
  business_relation_type: string;
  lead_source?: string | null;
  visibility_type: string;
  avatar_url?: string | null;
  created_at: string;
  created_by?: string | null;
  assigned_to?: string | null;
  owner_name?: string | null;
  owner_email?: string | null;
  owner_avatar?: string | null;
  owner_role?: string | null;
  people?: {
    cpf_informado?: string | null;
    occupation?: string | null;
    rg?: string | null;
    birth_date?: string | null;
  };
  company?: {
    cnpj?: string | null;
    legal_name?: string | null;
    trade_name?: string | null;
    state_registration?: string | null;
    website?: string | null;
    industry?: string | null;
  };
  phones: PhoneItem[];
  emails: EmailItem[];
  addresses: AddressItem[];
}

interface RelatedLinkItem {
  id: string;
  related_contact_id: string;
  related_name: string;
  role_in_company?: string | null;
  department?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  is_whatsapp?: boolean;
  email?: string | null;
  city?: string | null;
  state?: string | null;
}

interface ContactOption {
  id: string;
  display_name: string;
  avatar_url?: string | null;
  type: 'person' | 'company';
}

interface MemberOption {
  id: string;
  full_name: string;
  email?: string;
  avatar_url?: string | null;
  role: string;
}

interface ContactOpportunityItem {
  id: string;
  title: string;
  estimated_value: number;
  expected_close_date?: string | null;
  status: 'em_andamento' | 'ganha' | 'perdida' | 'congelada';
  created_at: string;
  stage_name?: string;
  is_partner?: boolean;
}

const maskCPF = (val: string): string => {
  const digits = val.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
};

const maskCNPJ = (val: string): string => {
  const digits = val.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};

const formatPhone = (val: string) => {
  const digits = val.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
};

const formatCEP = (val: string) => {
  return val
    .replace(/\D/g, '')
    .slice(0, 8)
    .replace(/^(\d{5})(\d)/, '$1-$2');
};

const formatShortName = (fullName?: string | null): string => {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 2) return fullName;
  return `${parts[0]} ${parts[1]}`;
};

export const ContactProfileModal: React.FC<ContactProfileModalProps> = ({
  contactId,
  isOpen,
  onClose,
  onContactUpdated,
  onNavigateToContact,
  onOpenOpportunity,
  onCreateOpportunityForContact
}) => {
  const { user } = useAuth();
  const { permissions } = usePermissions();

  const [activeContactId, setActiveContactId] = useState<string | null>(contactId);
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState<FullContactData | null>(null);

  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [activeTab, setActiveTab] = useState<'dados' | 'historico' | 'oportunidades' | 'anexos'>('dados');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentMembershipId, setCurrentMembershipId] = useState<string | null>(null);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  const [targetMainEl, setTargetMainEl] = useState<HTMLElement | null>(null);

  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement>(null);

  // Ações no Mobile
  const [isMobileActionSheetOpen, setIsMobileActionSheetOpen] = useState(false);
  const [isMobileTopMenuOpen, setIsMobileTopMenuOpen] = useState(false);

  const [isEditContactModalOpen, setIsEditContactModalOpen] = useState(false);
  const [savingContactEdit, setSavingContactEdit] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editRelation, setEditRelation] = useState('cliente');
  const [editSource, setEditSource] = useState('indicacao');
  const [editOccupation, setEditOccupation] = useState('');
  const [editCpf, setEditCpf] = useState('');
  const [editCnpj, setEditCnpj] = useState('');
  const [editTradeName, setEditTradeName] = useState('');
  const [editLegalName, setEditLegalName] = useState('');
  const [editStateRegistration, setEditStateRegistration] = useState('');
  const [editWebsite, setEditWebsite] = useState('');

  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [unlinkTarget, setUnlinkTarget] = useState<RelatedLinkItem | null>(null);
  const [unlinking, setUnlinking] = useState(false);

  const [methodModal, setMethodModal] = useState<{
    type: 'phone' | 'email' | 'address';
    mode: 'add' | 'edit';
    item?: any;
  } | null>(null);

  const [inputPhone, setInputPhone] = useState('');
  const [inputPhoneIsWhats, setInputPhoneIsWhats] = useState(true);
  const [inputPhoneIsPrimary, setInputPhoneIsPrimary] = useState(false);
  const [inputPhoneLabel, setInputPhoneLabel] = useState('');

  const [inputEmail, setInputEmail] = useState('');
  const [inputEmailIsPrimary, setInputEmailIsPrimary] = useState(false);
  const [inputEmailLabel, setInputEmailLabel] = useState('');

  const [inputCep, setInputCep] = useState('');
  const [inputStreet, setInputStreet] = useState('');
  const [inputNumber, setInputNumber] = useState('');
  const [inputComplement, setInputComplement] = useState('');
  const [inputNeighborhood, setInputNeighborhood] = useState('');
  const [inputCity, setInputCity] = useState('');
  const [inputState, setInputState] = useState('');
  const [inputAddressLabel, setInputAddressLabel] = useState('');
  const [inputAddressIsPrimary, setInputAddressIsPrimary] = useState(false);
  const [savingMethod, setSavingMethod] = useState(false);

  const [itemDropdownMenu, setItemDropdownMenu] = useState<{
    type: 'phone' | 'email' | 'address';
    item: any;
    top: number;
    left: number;
  } | null>(null);

  const [hoveredOwnerCoords, setHoveredOwnerCoords] = useState<{ top: number; left: number } | null>(null);
  const [hoveredLinkData, setHoveredLinkData] = useState<{ link: RelatedLinkItem; top: number; left: number } | null>(null);

  const [showInteractionForm, setShowInteractionForm] = useState(false);

  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);

  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [relatedLinks, setRelatedLinks] = useState<RelatedLinkItem[]>([]);
  const [availableToLink, setAvailableToLink] = useState<ContactOption[]>([]);
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [selectedTargetContactId, setSelectedTargetContactId] = useState('');
  const [linkRole, setLinkRole] = useState('');
  const [savingLink, setSavingLink] = useState(false);

  const [showChangeOwnerModal, setShowChangeOwnerModal] = useState(false);
  const [companyMembers, setCompanyMembers] = useState<MemberOption[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [savingNewOwner, setSavingNewOwner] = useState(false);

  const [opportunities, setOpportunities] = useState<ContactOpportunityItem[]>([]);
  const [loadingOpportunities, setLoadingOpportunities] = useState(false);

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

  useEffect(() => {
    async function loadUserMembership() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const activeUserId =
          user?.id ||
          (user as any)?.user?.id ||
          (user as any)?.profile?.id ||
          sessionData.session?.user?.id;

        if (!activeUserId) return;
        setResolvedUserId(activeUserId);

        const { data } = await supabase
          .from('memberships')
          .select('id')
          .eq('profile_id', activeUserId)
          .maybeSingle();

        if (data?.id) setCurrentMembershipId(data.id);
      } catch (err) {
        console.warn('Erro ao carregar membership:', err);
      }
    }
    loadUserMembership();
  }, [user]);

  const isContactOwner = useMemo(() => {
    if (!contact) return false;
    if (currentMembershipId && contact.created_by === currentMembershipId) return true;

    const currentUserId = resolvedUserId || user?.id || (user as any)?.user?.id || (user as any)?.profile?.id;
    const profileId = (user as any)?.profile?.id;

    if (currentUserId && contact.created_by === currentUserId) return true;
    if (profileId && contact.created_by === profileId) return true;

    const userFullName = user?.profile?.full_name || (user as any)?.user_metadata?.full_name;
    if (
      contact.owner_name &&
      userFullName &&
      contact.owner_name.trim().toLowerCase() === userFullName.trim().toLowerCase()
    ) {
      return true;
    }

    return false;
  }, [contact, user, currentMembershipId, resolvedUserId]);

  const canEditThisContact = useMemo(() => {
    return permissions.isOwnerOrAdmin || (permissions.canCreateEditContacts && isContactOwner);
  }, [permissions.isOwnerOrAdmin, permissions.canCreateEditContacts, isContactOwner]);

  const canDeleteThisContact = useMemo(() => {
    return permissions.isOwnerOrAdmin || (permissions.canDeleteContacts && isContactOwner);
  }, [permissions.isOwnerOrAdmin, permissions.canDeleteContacts, isContactOwner]);

  const canShowMobileFab = useMemo(() => {
    return canEditThisContact || Boolean(permissions?.canManageDeals);
  }, [canEditThisContact, permissions?.canManageDeals]);

  useEffect(() => {
    setActiveContactId(contactId);
  }, [contactId]);

  useEffect(() => {
    if (isOpen && activeContactId) {
      setIsEditContactModalOpen(false);
      setShowDeleteModal(false);
      setShowChangeOwnerModal(false);
      setIsActionsMenuOpen(false);
      setIsMobileActionSheetOpen(false);
      setIsMobileTopMenuOpen(false);
      setUnlinkTarget(null);
      setMethodModal(null);
      setItemDropdownMenu(null);
      setIsLinkModalOpen(false);
      setShowInteractionForm(false);
      setActiveTab('dados');
      loadFullContact(activeContactId);
      loadContactOpportunities(activeContactId);
    } else {
      setContact(null);
      setOpportunities([]);
      setActiveTab('dados');
      setIsEditContactModalOpen(false);
      setShowDeleteModal(false);
      setShowChangeOwnerModal(false);
      setIsActionsMenuOpen(false);
      setIsMobileActionSheetOpen(false);
      setIsMobileTopMenuOpen(false);
      setUnlinkTarget(null);
      setMethodModal(null);
      setItemDropdownMenu(null);
      setIsLinkModalOpen(false);
      setShowInteractionForm(false);
    }
  }, [isOpen, activeContactId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node)) {
        setIsActionsMenuOpen(false);
      }
      setItemDropdownMenu(null);
    };
    window.addEventListener('click', handleClickOutside);
    window.addEventListener('scroll', handleClickOutside, true);
    return () => {
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('scroll', handleClickOutside, true);
    };
  }, []);

  const handleNavigateToContact = (targetId: string) => {
    setHoveredLinkData(null);
    setIsEditContactModalOpen(false);
    setActiveContactId(targetId);
    if (onNavigateToContact) onNavigateToContact(targetId);
  };

  const loadContactOpportunities = async (targetContactId: string) => {
    try {
      setLoadingOpportunities(true);
      const { data, error } = await supabase
        .from('opportunities')
        .select(`
          id,
          title,
          estimated_value,
          expected_close_date,
          status,
          created_at,
          contact_id,
          partner_contact_id,
          stage:commercial_pipeline_stages!stage_id ( name )
        `)
        .or(`contact_id.eq.${targetContactId},partner_contact_id.eq.${targetContactId}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped: ContactOpportunityItem[] = (data || []).map((opp: any) => ({
        id: opp.id,
        title: opp.title,
        estimated_value: opp.estimated_value || 0,
        expected_close_date: opp.expected_close_date,
        status: opp.status || 'em_andamento',
        created_at: opp.created_at,
        stage_name: Array.isArray(opp.stage) ? opp.stage[0]?.name : opp.stage?.name,
        is_partner: opp.partner_contact_id === targetContactId && opp.contact_id !== targetContactId
      }));

      setOpportunities(mapped);
    } catch (err) {
      console.warn('Erro ao carregar oportunidades do contato:', err);
    } finally {
      setLoadingOpportunities(false);
    }
  };

  const confirmDeleteContact = async () => {
    if (!contact || !canDeleteThisContact) return;

    try {
      setDeleting(true);
      const { error } = await supabase
        .from('contacts')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', contact.id);

      if (error) throw error;

      setShowDeleteModal(false);
      if (onContactUpdated) onContactUpdated();
      onClose();
    } catch (err: any) {
      alert(`Falha ao excluir contato: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setDeleting(false);
    }
  };

  const loadFullContact = async (idToLoad: string) => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('contacts')
        .select(`
          id,
          company_id,
          type,
          display_name,
          business_relation_type,
          lead_source,
          visibility_type,
          avatar_url,
          created_at,
          created_by,
          contact_people ( * ),
          contact_companies ( * ),
          contact_phones ( * ),
          contact_emails ( * ),
          contact_addresses ( * )
        `)
        .eq('id', idToLoad)
        .single();

      if (error) throw error;

      if (data) {
        const pf = Array.isArray(data.contact_people) ? data.contact_people[0] : data.contact_people;
        const pj = Array.isArray(data.contact_companies) ? data.contact_companies[0] : data.contact_companies;

        let ownerName = 'Não atribuído';
        let ownerEmail = '';
        let ownerAvatar: string | null = null;
        let ownerRole = 'Membro';

        const responsibleId = data.created_by;

        if (responsibleId) {
          const { data: memberData } = await supabase
            .from('memberships')
            .select(`
              role,
              profile:profiles!profile_id (
                full_name,
                avatar_url,
                email
              )
            `)
            .or(`id.eq.${responsibleId},profile_id.eq.${responsibleId}`)
            .maybeSingle();

          if (memberData) {
            const prof = (memberData as any).profile || {};
            ownerName = prof.full_name || 'Usuário';
            ownerEmail = prof.email || '';
            ownerAvatar = prof.avatar_url || null;

            const roleMap: Record<string, string> = {
              owner: 'Proprietário',
              admin: 'Administrador',
              member: 'Membro',
              user: 'Colaborador'
            };
            ownerRole = roleMap[String(memberData.role).toLowerCase()] || String(memberData.role);
          }
        }

        const currentContact: FullContactData = {
          id: data.id,
          company_id: data.company_id,
          type: data.type,
          display_name: data.display_name,
          business_relation_type: data.business_relation_type || 'cliente',
          lead_source: (data as any).lead_source || null,
          visibility_type: data.visibility_type,
          avatar_url: data.avatar_url,
          created_at: data.created_at,
          created_by: data.created_by,
          assigned_to: data.created_by,
          owner_name: ownerName,
          owner_email: ownerEmail,
          owner_avatar: ownerAvatar,
          owner_role: ownerRole,
          people: pf || undefined,
          company: pj || undefined,
          phones: (data.contact_phones || []).map((p: any) => ({
            ...p,
            phone_number: formatPhone(p.phone_number || ''),
            notes: p.label || p.notes || null,
            label: p.label || p.notes || null
          })),
          emails: (data.contact_emails || []).map((e: any) => ({
            ...e,
            notes: e.label || e.notes || null,
            label: e.label || e.notes || null
          })),
          addresses: (data.contact_addresses || []).map((a: any) => ({
            ...a,
            cep: a.cep ? formatCEP(a.cep) : '',
            notes: a.label || a.notes || a.complement || null,
            label: a.label || a.notes || a.complement || null
          }))
        };

        setContact(currentContact);
        initEditState(currentContact);
        await loadRelatedLinks(currentContact);
      }
    } catch (err: any) {
      console.error('Erro ao carregar dados do contato:', err);
    } finally {
      setLoading(false);
    }
  };

  const initEditState = (c: FullContactData) => {
    setEditDisplayName(c.display_name);
    setEditRelation(c.business_relation_type || 'cliente');
    setEditSource(c.lead_source || 'indicacao');
    setEditOccupation(c.people?.occupation || '');
    setEditCpf(c.people?.cpf_informado ? maskCPF(c.people.cpf_informado) : '');
    setEditCnpj(c.company?.cnpj ? maskCNPJ(c.company.cnpj) : '');
    setEditTradeName(c.company?.trade_name || '');
    setEditLegalName(c.company?.legal_name || '');
    setEditStateRegistration(c.company?.state_registration || '');
    setEditWebsite(c.company?.website || '');
  };

  const loadRelatedLinks = async (current: FullContactData) => {
    try {
      if (current.type === 'company') {
        const { data: links } = await supabase
          .from('contact_person_company_links')
          .select(`
            id,
            role_in_company,
            department,
            person:contacts!person_contact_id (
              id,
              display_name,
              avatar_url,
              deleted_at,
              contact_phones (phone_number, is_whatsapp),
              contact_emails (email)
            )
          `)
          .eq('company_contact_id', current.id);

        const validLinks = (links || []).filter((l: any) => l.person && !l.person.deleted_at);

        const mapped: RelatedLinkItem[] = validLinks.map((l: any) => {
          const p = l.person || {};
          const ph = p.contact_phones?.[0];
          const em = p.contact_emails?.[0];
          return {
            id: l.id,
            related_contact_id: p.id,
            related_name: p.display_name || 'Sem Nome',
            role_in_company: l.role_in_company,
            department: l.department,
            avatar_url: p.avatar_url,
            phone: ph?.phone_number ? formatPhone(ph.phone_number) : null,
            is_whatsapp: ph?.is_whatsapp,
            email: em?.email
          };
        });
        setRelatedLinks(mapped);

        const { data: people } = await supabase
          .from('contacts')
          .select('id, display_name, avatar_url, type')
          .eq('company_id', current.company_id)
          .eq('type', 'person')
          .is('deleted_at', null);

        const alreadyLinkedIds = new Set(mapped.map(m => m.related_contact_id));
        setAvailableToLink((people || []).filter(p => !alreadyLinkedIds.has(p.id)) as ContactOption[]);
      } else {
        const { data: links } = await supabase
          .from('contact_person_company_links')
          .select(`
            id,
            role_in_company,
            department,
            company:contacts!company_contact_id (
              id,
              display_name,
              avatar_url,
              deleted_at,
              contact_phones (phone_number, is_whatsapp),
              contact_emails (email),
              contact_addresses (city, state)
            )
          `)
          .eq('person_contact_id', current.id);

        const validLinks = (links || []).filter((l: any) => l.company && !l.company.deleted_at);

        const mapped: RelatedLinkItem[] = validLinks.map((l: any) => {
          const comp = l.company || {};
          const ph = comp.contact_phones?.[0];
          const em = comp.contact_emails?.[0];
          const ad = comp.contact_addresses?.[0];
          return {
            id: l.id,
            related_contact_id: comp.id,
            related_name: comp.display_name || 'Sem Empresa',
            role_in_company: l.role_in_company,
            department: l.department,
            avatar_url: comp.avatar_url,
            phone: ph?.phone_number ? formatPhone(ph.phone_number) : null,
            is_whatsapp: ph?.is_whatsapp,
            email: em?.email,
            city: ad?.city,
            state: ad?.state
          };
        });
        setRelatedLinks(mapped);

        const { data: companies } = await supabase
          .from('contacts')
          .select('id, display_name, avatar_url, type')
          .eq('company_id', current.company_id)
          .eq('type', 'company')
          .is('deleted_at', null);

        const alreadyLinkedIds = new Set(mapped.map(m => m.related_contact_id));
        setAvailableToLink((companies || []).filter(c => !alreadyLinkedIds.has(c.id)) as ContactOption[]);
      }
    } catch (err) {
      console.warn('Erro ao carregar vínculos de contatos:', err);
    }
  };

  const handleOpenChangeOwnerModal = async () => {
    if (!contact || !canEditThisContact) return;
    try {
      setLoadingMembers(true);
      setShowChangeOwnerModal(true);

      const { data, error } = await supabase
        .from('memberships')
        .select(`
          id,
          role,
          profile:profiles!profile_id (
            id,
            full_name,
            avatar_url,
            email
          )
        `)
        .eq('company_id', contact.company_id);

      if (error) throw error;

      const roleMap: Record<string, string> = {
        owner: 'Proprietário',
        admin: 'Administrador',
        member: 'Membro',
        user: 'Colaborador'
      };

      const mapped: MemberOption[] = (data || []).map((m: any) => {
        const prof = m.profile || {};
        return {
          id: m.id,
          full_name: prof.full_name || 'Usuário',
          email: prof.email || '',
          avatar_url: prof.avatar_url || null,
          role: roleMap[String(m.role).toLowerCase()] || String(m.role)
        };
      });

      setCompanyMembers(mapped);
    } catch (err) {
      alert('Não foi possível carregar os colaboradores.');
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleSelectNewOwner = async (membershipId: string) => {
    if (!contact || !canEditThisContact) return;
    try {
      setSavingNewOwner(true);

      const { error } = await supabase
        .from('contacts')
        .update({ created_by: membershipId })
        .eq('id', contact.id);

      if (error) throw error;

      setShowChangeOwnerModal(false);
      await loadFullContact(contact.id);
      if (onContactUpdated) onContactUpdated();
    } catch (err: any) {
      alert(`Falha ao alterar responsável: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setSavingNewOwner(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEditThisContact) return;
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      setTempImageSrc(e.target?.result as string);
      setZoomLevel(1);
      setIsCropModalOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmCropAndUpload = async () => {
    if (!tempImageSrc || !contact || !canEditThisContact) return;

    try {
      setUploadingAvatar(true);

      const image = new Image();
      image.src = tempImageSrc;
      await new Promise((resolve) => (image.onload = resolve));

      const canvas = document.createElement('canvas');
      const size = 320;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);

        const scale = zoomLevel;
        const w = size * scale;
        const h = (image.height / image.width) * size * scale;
        const dx = (size - w) / 2;
        const dy = (size - h) / 2;

        ctx.drawImage(image, dx, dy, w, h);
      }

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9)
      );

      if (!blob) throw new Error('Falha ao processar recorte.');

      const filePath = `contacts/${contact.id}-${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload(filePath, blob, { contentType: 'image/jpeg', upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('company-assets')
        .getPublicUrl(filePath);

      await supabase
        .from('contacts')
        .update({ avatar_url: publicUrl })
        .eq('id', contact.id);

      setContact(prev => prev ? { ...prev, avatar_url: publicUrl } : null);
      if (onContactUpdated) onContactUpdated();
      setIsCropModalOpen(false);
      setTempImageSrc(null);
    } catch (err: any) {
      alert(`Falha ao salvar avatar: ${err.message}`);
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveContactEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact || !canEditThisContact) return;

    try {
      setSavingContactEdit(true);

      await supabase
        .from('contacts')
        .update({
          display_name: editDisplayName.trim(),
          business_relation_type: editRelation,
          lead_source: editSource
        })
        .eq('id', contact.id);

      if (contact.type === 'person') {
        await supabase
          .from('contact_people')
          .update({
            occupation: editOccupation.trim() || null,
            cpf_informado: editCpf.trim() ? editCpf.replace(/\D/g, '') : null
          })
          .eq('contact_id', contact.id);
      } else {
        await supabase
          .from('contact_companies')
          .update({
            trade_name: editTradeName.trim() || null,
            legal_name: editLegalName.trim() || editDisplayName.trim(),
            cnpj: editCnpj.trim() ? editCnpj.replace(/\D/g, '') : null,
            state_registration: editStateRegistration.trim() || null,
            website: editWebsite.trim() || null
          })
          .eq('contact_id', contact.id);
      }

      setIsEditContactModalOpen(false);
      if (activeContactId) await loadFullContact(activeContactId);
      if (onContactUpdated) onContactUpdated();
    } catch (err: any) {
      alert('Falha ao salvar alterações do contato.');
    } finally {
      setSavingContactEdit(false);
    }
  };

  const handleOpenMethodModal = (type: 'phone' | 'email' | 'address', mode: 'add' | 'edit', item?: any) => {
    setItemDropdownMenu(null);
    if (type === 'phone') {
      setInputPhone(mode === 'edit' ? item.phone_number : '');
      setInputPhoneIsWhats(mode === 'edit' ? item.is_whatsapp : true);
      setInputPhoneIsPrimary(mode === 'edit' ? item.is_primary : (contact?.phones.length === 0));
      setInputPhoneLabel(mode === 'edit' ? (item.label || item.notes || '') : '');
    } else if (type === 'email') {
      setInputEmail(mode === 'edit' ? item.email : '');
      setInputEmailIsPrimary(mode === 'edit' ? item.is_primary : (contact?.emails.length === 0));
      setInputEmailLabel(mode === 'edit' ? (item.label || item.notes || '') : '');
    } else if (type === 'address') {
      setInputCep(mode === 'edit' ? (item.cep || '') : '');
      setInputStreet(mode === 'edit' ? (item.street || '') : '');
      setInputNumber(mode === 'edit' ? (item.number || '') : '');
      setInputComplement(mode === 'edit' ? (item.complement || '') : '');
      setInputNeighborhood(mode === 'edit' ? (item.neighborhood || '') : '');
      setInputCity(mode === 'edit' ? (item.city || '') : '');
      setInputState(mode === 'edit' ? (item.state || '') : '');
      setInputAddressLabel(mode === 'edit' ? (item.label || item.notes || '') : '');
      setInputAddressIsPrimary(mode === 'edit' ? item.is_primary : (contact?.addresses.length === 0));
    }
    setMethodModal({ type, mode, item });
  };

  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact || !inputPhone.trim() || !canEditThisContact) return;

    try {
      setSavingMethod(true);
      if (inputPhoneIsPrimary) {
        await supabase
          .from('contact_phones')
          .update({ is_primary: false })
          .eq('contact_id', contact.id);
      }

      const desc = inputPhoneLabel.trim() || null;
      const phonePayload = {
        company_id: contact.company_id,
        contact_id: contact.id,
        phone_number: inputPhone.trim(),
        is_whatsapp: inputPhoneIsWhats,
        is_primary: inputPhoneIsPrimary || contact.phones.length === 0,
        label: desc
      };

      if (methodModal?.mode === 'edit' && methodModal.item?.id) {
        const { error } = await supabase
          .from('contact_phones')
          .update(phonePayload)
          .eq('id', methodModal.item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('contact_phones')
          .insert(phonePayload);
        if (error) throw error;
      }

      setMethodModal(null);
      await loadFullContact(contact.id);
      if (onContactUpdated) onContactUpdated();
    } catch (err: any) {
      alert('Erro ao salvar telefone');
    } finally {
      setSavingMethod(false);
    }
  };

  const handleDeletePhone = async (phoneId: string) => {
    if (!contact || !canEditThisContact) return;
    try {
      await supabase.from('contact_phones').delete().eq('id', phoneId);
      setItemDropdownMenu(null);
      await loadFullContact(contact.id);
      if (onContactUpdated) onContactUpdated();
    } catch (err: any) {
      alert('Erro ao excluir telefone');
    }
  };

  const handleSetPrimaryPhone = async (phoneId: string) => {
    if (!contact || !canEditThisContact) return;
    try {
      await supabase.from('contact_phones').update({ is_primary: false }).eq('contact_id', contact.id);
      await supabase.from('contact_phones').update({ is_primary: true }).eq('id', phoneId);
      setItemDropdownMenu(null);
      await loadFullContact(contact.id);
      if (onContactUpdated) onContactUpdated();
    } catch (err) {
      alert('Erro ao definir telefone principal');
    }
  };

  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact || !inputEmail.trim() || !canEditThisContact) return;

    try {
      setSavingMethod(true);
      if (inputEmailIsPrimary) {
        await supabase
          .from('contact_emails')
          .update({ is_primary: false })
          .eq('contact_id', contact.id);
      }

      const desc = inputEmailLabel.trim() || null;
      const emailPayload = {
        company_id: contact.company_id,
        contact_id: contact.id,
        email: inputEmail.trim().toLowerCase(),
        is_primary: inputEmailIsPrimary || contact.emails.length === 0,
        label: desc
      };

      if (methodModal?.mode === 'edit' && methodModal.item?.id) {
        const { error } = await supabase
          .from('contact_emails')
          .update(emailPayload)
          .eq('id', methodModal.item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('contact_emails')
          .insert(emailPayload);
        if (error) throw error;
      }

      setMethodModal(null);
      await loadFullContact(contact.id);
      if (onContactUpdated) onContactUpdated();
    } catch (err: any) {
      alert('Erro ao salvar e-mail');
    } finally {
      setSavingMethod(false);
    }
  };

  const handleDeleteEmail = async (emailId: string) => {
    if (!contact || !canEditThisContact) return;
    try {
      await supabase.from('contact_emails').delete().eq('id', emailId);
      setItemDropdownMenu(null);
      await loadFullContact(contact.id);
      if (onContactUpdated) onContactUpdated();
    } catch (err: any) {
      alert('Erro ao excluir e-mail');
    }
  };

  const handleSetPrimaryEmail = async (emailId: string) => {
    if (!contact || !canEditThisContact) return;
    try {
      await supabase.from('contact_emails').update({ is_primary: false }).eq('contact_id', contact.id);
      await supabase.from('contact_emails').update({ is_primary: true }).eq('id', emailId);
      setItemDropdownMenu(null);
      await loadFullContact(contact.id);
      if (onContactUpdated) onContactUpdated();
    } catch (err) {
      alert('Erro ao definir e-mail principal');
    }
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact || (!inputStreet.trim() && !inputCity.trim()) || !canEditThisContact) return;

    try {
      setSavingMethod(true);
      if (inputAddressIsPrimary) {
        await supabase
          .from('contact_addresses')
          .update({ is_primary: false })
          .eq('contact_id', contact.id);
      }

      const desc = inputAddressLabel.trim() || null;
      const addrPayload = {
        company_id: contact.company_id,
        contact_id: contact.id,
        cep: inputCep.replace(/\D/g, '') || null,
        street: inputStreet.trim() || null,
        number: inputNumber.trim() || null,
        complement: inputComplement.trim() || null,
        neighborhood: inputNeighborhood.trim() || null,
        city: inputCity.trim() || null,
        state: inputState.trim() || null,
        is_primary: inputAddressIsPrimary || contact.addresses.length === 0,
        label: desc
      };

      if (methodModal?.mode === 'edit' && methodModal.item?.id) {
        const { error } = await supabase
          .from('contact_addresses')
          .update(addrPayload)
          .eq('id', methodModal.item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('contact_addresses')
          .insert(addrPayload);
        if (error) throw error;
      }

      setMethodModal(null);
      await loadFullContact(contact.id);
      if (onContactUpdated) onContactUpdated();
    } catch (err: any) {
      alert('Erro ao salvar endereço');
    } finally {
      setSavingMethod(false);
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (!contact || !canEditThisContact) return;
    try {
      await supabase.from('contact_addresses').delete().eq('id', addressId);
      setItemDropdownMenu(null);
      await loadFullContact(contact.id);
      if (onContactUpdated) onContactUpdated();
    } catch (err: any) {
      alert('Erro ao excluir endereço');
    }
  };

  const handleSetPrimaryAddress = async (addressId: string) => {
    if (!contact || !canEditThisContact) return;
    try {
      await supabase.from('contact_addresses').update({ is_primary: false }).eq('contact_id', contact.id);
      await supabase.from('contact_addresses').update({ is_primary: true }).eq('id', addressId);
      setItemDropdownMenu(null);
      await loadFullContact(contact.id);
      if (onContactUpdated) onContactUpdated();
    } catch (err) {
      alert('Erro ao definir endereço principal');
    }
  };

  const handleCepQuickLookup = async (cepVal: string) => {
    const clean = cepVal.replace(/\D/g, '');
    if (clean.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setInputStreet(data.logradouro || '');
        setInputNeighborhood(data.bairro || '');
        setInputCity(data.localidade || '');
        setInputState((data.uf || '').toUpperCase());
      }
    } catch (err) {
      console.warn('Erro ao consultar CEP:', err);
    }
  };

  const handleSaveLink = async () => {
    if (!contact || !selectedTargetContactId || !canEditThisContact) return;

    try {
      setSavingLink(true);
      const personId = contact.type === 'person' ? contact.id : selectedTargetContactId;
      const companyId = contact.type === 'company' ? contact.id : selectedTargetContactId;

      const { error } = await supabase
        .from('contact_person_company_links')
        .insert({
          company_id: contact.company_id,
          person_contact_id: personId,
          company_contact_id: companyId,
          role_in_company: linkRole.trim() || null
        });

      if (error) throw error;

      setIsLinkModalOpen(false);
      setSelectedTargetContactId('');
      setLinkRole('');
      setLinkSearchQuery('');
      await loadRelatedLinks(contact);
    } catch (err: any) {
      alert('Não foi possível realizar o vínculo.');
    } finally {
      setSavingLink(false);
    }
  };

  const handleConfirmRemoveLink = async () => {
    if (!unlinkTarget || !canEditThisContact) return;

    try {
      setUnlinking(true);
      const { error } = await supabase
        .from('contact_person_company_links')
        .delete()
        .eq('id', unlinkTarget.id);

      if (error) throw error;

      setUnlinkTarget(null);
      if (contact) await loadRelatedLinks(contact);
    } catch (err: any) {
      alert('Falha ao desvincular contato.');
    } finally {
      setUnlinking(false);
    }
  };

  const openWhatsApp = (phoneStr: string) => {
    const cleanPhone = phoneStr.replace(/\D/g, '');
    const fullNumber = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
    window.open(`https://wa.me/${fullNumber}`, '_blank');
  };

  const formatSource = (src?: string | null) => {
    if (!src) return 'Não informada';
    const dict: Record<string, string> = {
      indicacao: 'Indicação / Boca a boca',
      instagram: 'Instagram / Redes Sociais',
      whatsapp: 'WhatsApp Direto',
      google: 'Google / Busca Orgânica',
      anuncio: 'Anúncio Pago (Meta / Google)',
      prospeccao: 'Prospecção Ativa',
      evento: 'Evento / Feira'
    };
    return dict[src] || src;
  };

  const getStatusBadge = (status: ContactOpportunityItem['status']) => {
    switch (status) {
      case 'ganha':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Ganha</span>;
      case 'perdida':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">Perdida</span>;
      case 'congelada':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">Congelada</span>;
      default:
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">Em andamento</span>;
    }
  };

  const handleOpenOpportunityCard = (oppId: string) => {
    if (onOpenOpportunity) onOpenOpportunity(oppId);
  };

  const handleCreateNewOpportunity = () => {
    if (!contact) return;
    if (onCreateOpportunityForContact) onCreateOpportunityForContact(contact.id);
  };

  const openItemMenu = (e: React.MouseEvent, type: 'phone' | 'email' | 'address', item: any) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setItemDropdownMenu({
      type,
      item,
      top: rect.bottom + 4,
      left: Math.min(rect.left, window.innerWidth - 170)
    });
  };

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
          .hide-mobile-doc-btn button:has(svg.lucide-folder-up),
          .hide-mobile-doc-btn button:has(svg.lucide-upload-cloud),
          .hide-mobile-doc-btn button:has(svg.lucide-upload),
          .hide-mobile-doc-btn button:has(svg.lucide-cloud-upload),
          .hide-mobile-doc-btn button:has(svg.lucide-file-up),
          .hide-mobile-doc-btn button:has(svg.lucide-plus),
          .hide-mobile-doc-btn div:has(> p) + button,
          .hide-mobile-doc-btn div:has(> p) button,
          .hide-mobile-doc-btn button.bg-sky-600,
          .hide-mobile-doc-btn button.bg-blue-600 {
            display: none !important;
          }
        }
      `}</style>

      {/* 1. TOPBAR NO MOBILE (< lg): 100% da tela, Voltar na esq, Título padronizado, Menu de Ações na dir */}
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
          Detalhes do Contato
        </span>

        {/* Botão de Menu do Topo no Mobile */}
        <button
          type="button"
          onClick={() => setIsMobileTopMenuOpen(true)}
          className="w-8 h-8 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 hover:text-slate-900 transition cursor-pointer shadow-2xs"
          title="Menu de Ações"
        >
          <MoreVertical size={16} />
        </button>
      </div>

      {/* 2. BARRA DE NAVEGAÇÃO DE ABAS NO MOBILE (< lg) */}
      <div className="flex lg:hidden bg-white border-b border-slate-200/90 px-3 shrink-0 overflow-x-auto no-scrollbar shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab('dados')}
          className={`py-3 px-3 border-b-2 text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'dados' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500'
          }`}
        >
          <User size={14} />
          <span>Dados</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('historico')}
          className={`py-3 px-3 border-b-2 text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'historico' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500'
          }`}
        >
          <HistoryIcon size={14} />
          <span>Histórico</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('oportunidades')}
          className={`py-3 px-3 border-b-2 text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'oportunidades' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500'
          }`}
        >
          <Briefcase size={14} />
          <span>Oportunidades</span>
          {opportunities.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700">
              {opportunities.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('anexos')}
          className={`py-3 px-3 border-b-2 text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'anexos' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500'
          }`}
        >
          <Paperclip size={14} />
          <span>Anexos</span>
        </button>
      </div>

      {/* 3. CORPO: DIVISÃO RESPONSIVA */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-y-auto lg:overflow-hidden">
        
        {/* COLUNA LATERAL ESQUERDA (+25% de largura: lg:w-[440px]) */}
        <aside className={`w-full lg:w-[440px] bg-white border-b lg:border-b-0 lg:border-r border-slate-200/90 flex flex-col shrink-0 overflow-y-auto lume-scrollbar p-4 sm:p-5 space-y-3.5 ${
          activeTab !== 'dados' ? 'hidden lg:flex' : 'flex'
        }`}>
          {loading || !contact ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              <Loader2 size={20} className="animate-spin text-sky-600 mx-auto mb-2" />
              Carregando dados...
            </div>
          ) : (
            <>
              {/* Botão Voltar no Desktop */}
              <button
                type="button"
                onClick={onClose}
                className="hidden lg:inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer self-start"
              >
                <ArrowLeft size={14} />
                <span>Voltar para a lista</span>
              </button>

              {/* Card do Avatar e Informações Gerais */}
              <div className="flex flex-col items-center text-center p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl relative group">
                
                {/* MENU DE OPÇÕES (EDITAR / EXCLUIR) NO DESKTOP */}
                {canEditThisContact && (
                  <div className="hidden lg:block absolute top-2.5 right-2.5" ref={actionsMenuRef}>
                    <button
                      type="button"
                      onClick={() => setIsActionsMenuOpen(!isActionsMenuOpen)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
                      title="Opções do Contato"
                    >
                      <MoreVertical size={16} />
                    </button>

                    {isActionsMenuOpen && (
                      <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-2xl shadow-xl py-1 z-40 text-xs text-left animate-in fade-in zoom-in-95 duration-100">
                        <button
                          type="button"
                          onClick={() => {
                            setIsActionsMenuOpen(false);
                            initEditState(contact);
                            setIsEditContactModalOpen(true);
                          }}
                          className="w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer font-medium"
                        >
                          <Edit3 size={14} className="text-sky-600" />
                          <span>Editar Contato</span>
                        </button>

                        {canDeleteThisContact && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsActionsMenuOpen(false);
                              setShowDeleteModal(true);
                            }}
                            className="w-full px-3.5 py-2 text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer font-medium border-t border-slate-100"
                          >
                            <Trash2 size={14} />
                            <span>Excluir Contato</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Avatar */}
                <div className="relative w-20 h-20 sm:w-22 sm:h-22 rounded-2xl overflow-hidden bg-slate-200 border-2 border-white shadow-md flex items-center justify-center mb-2">
                  {contact.avatar_url ? (
                    <img src={contact.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center font-black text-2xl text-white ${
                      contact.type === 'person' ? 'bg-gradient-to-tr from-sky-600 to-blue-500' : 'bg-gradient-to-tr from-indigo-600 to-violet-500'
                    }`}>
                      {contact.display_name.slice(0, 2).toUpperCase()}
                    </div>
                  )}

                  {canEditThisContact && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      title="Alterar foto"
                      className="absolute inset-0 bg-slate-900/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition cursor-pointer"
                    >
                      <Camera size={20} />
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>

                <h3 className="font-extrabold text-base text-slate-900 leading-tight">
                  {contact.display_name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {contact.type === 'person' 
                    ? (contact.people?.occupation || 'Pessoa Física')
                    : (contact.company?.trade_name || 'Pessoa Jurídica')}
                </p>

                <div className="flex items-center gap-1.5 mt-2 flex-wrap justify-center">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    contact.type === 'person' ? 'bg-sky-50 text-sky-700 border border-sky-200/60' : 'bg-indigo-50 text-indigo-700 border border-indigo-200/60'
                  }`}>
                    {contact.type === 'person' ? 'Pessoa Física' : 'Pessoa Jurídica'}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 capitalize">
                    {contact.business_relation_type}
                  </span>
                </div>
              </div>

              {/* Responsável & Origem com AVATAR E PRIMEIRO/SEGUNDO NOME */}
              <div className="p-3 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Origem:</span>
                  <span className="font-semibold text-slate-700">{formatSource(contact.lead_source)}</span>
                </div>

                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between relative">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Responsável:</span>
                  
                  <button
                    type="button"
                    onClick={handleOpenChangeOwnerModal}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredOwnerCoords({ top: rect.bottom + 6, left: Math.min(rect.left, window.innerWidth - 270) });
                    }}
                    onMouseLeave={() => setHoveredOwnerCoords(null)}
                    title={canEditThisContact ? "Alterar responsável" : undefined}
                    className="inline-flex items-center gap-1.5 font-bold text-slate-800 hover:text-sky-600 transition cursor-pointer"
                  >
                    <div className="w-5 h-5 rounded-full overflow-hidden bg-slate-200 shrink-0 border border-slate-300">
                      {contact.owner_avatar ? (
                        <img src={contact.owner_avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-sky-600 text-white flex items-center justify-center text-[9px] font-bold">
                          {(contact.owner_name || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <span>{formatShortName(contact.owner_name)}</span>
                    {canEditThisContact && <ChevronDown size={12} className="text-slate-400" />}
                  </button>
                </div>
              </div>

              {/* Documentação & Dados Cadastrais com máscaras aplicadas */}
              <div className="p-3 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-1.5 text-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Documentação & Dados Cadastrais
                </span>
                {contact.type === 'person' ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">CPF:</span>
                      <strong className="font-mono text-slate-800">
                        {contact.people?.cpf_informado ? maskCPF(contact.people.cpf_informado) : 'Não informado'}
                      </strong>
                    </div>
                    {contact.people?.rg && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">RG:</span>
                        <span className="text-slate-800">{contact.people.rg}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-slate-500 shrink-0">Razão Social:</span>
                      <strong className="text-slate-800 text-right leading-snug">
                        {contact.company?.legal_name || contact.display_name}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">CNPJ:</span>
                      <strong className="font-mono text-slate-800">
                        {contact.company?.cnpj ? maskCNPJ(contact.company.cnpj) : 'Não informado'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Inscrição Estadual (I.E.):</span>
                      <span className="text-slate-800">{contact.company?.state_registration || 'Não informada'}</span>
                    </div>
                    {contact.company?.website && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500 shrink-0">Website:</span>
                        <a
                          href={contact.company.website.startsWith('http') ? contact.company.website : `https://${contact.company.website}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sky-600 hover:underline truncate inline-flex items-center gap-1"
                        >
                          <Globe size={11} /> {contact.company.website}
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Telefones & Canais */}
              <div className="p-3 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Telefones & Canais
                  </span>
                  {canEditThisContact && (
                    <button
                      type="button"
                      onClick={() => handleOpenMethodModal('phone', 'add')}
                      className="text-[11px] font-bold text-sky-600 hover:underline cursor-pointer"
                    >
                      + Adicionar
                    </button>
                  )}
                </div>

                {contact.phones.length === 0 ? (
                  <span className="text-slate-400 italic">Sem telefone cadastrado</span>
                ) : (
                  <div className="space-y-2">
                    {contact.phones.map((p, idx) => (
                      <div key={idx} className="p-2.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs space-y-1">
                        {p.notes && (
                          <div className="flex items-center justify-between text-xs pb-0.5">
                            <span className="font-bold text-slate-700 truncate max-w-[200px]">
                              {p.notes}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {p.is_primary && (
                                <Star size={13} className="fill-amber-400 text-amber-500" title="Principal" />
                              )}
                              {canEditThisContact && (
                                <button
                                  type="button"
                                  onClick={(e) => openItemMenu(e, 'phone', p)}
                                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition"
                                >
                                  <MoreVertical size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Phone size={13} className="text-slate-400 shrink-0" />
                            <span className="font-mono text-xs font-bold text-slate-800 truncate">{p.phone_number}</span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {p.is_whatsapp && (
                              <button
                                type="button"
                                onClick={() => openWhatsApp(p.phone_number)}
                                title="Abrir no WhatsApp"
                                className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 transition cursor-pointer shrink-0"
                              >
                                <MessageCircle size={13} className="fill-emerald-500 text-white" />
                              </button>
                            )}

                            {!p.notes && p.is_primary && (
                              <Star size={13} className="fill-amber-400 text-amber-500" title="Principal" />
                            )}

                            {!p.notes && canEditThisContact && (
                              <button
                                type="button"
                                onClick={(e) => openItemMenu(e, 'phone', p)}
                                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition"
                              >
                                <MoreVertical size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* E-mails */}
              <div className="p-3 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    E-mails
                  </span>
                  {canEditThisContact && (
                    <button
                      type="button"
                      onClick={() => handleOpenMethodModal('email', 'add')}
                      className="text-[11px] font-bold text-sky-600 hover:underline cursor-pointer"
                    >
                      + Adicionar
                    </button>
                  )}
                </div>

                {contact.emails.length === 0 ? (
                  <span className="text-slate-400 italic">Sem e-mail cadastrado</span>
                ) : (
                  <div className="space-y-2">
                    {contact.emails.map((e, idx) => (
                      <div key={idx} className="p-2.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs space-y-1">
                        {e.notes && (
                          <div className="flex items-center justify-between text-xs pb-0.5">
                            <span className="font-bold text-slate-700 truncate max-w-[200px]">
                              {e.notes}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {e.is_primary && (
                                <Star size={13} className="fill-amber-400 text-amber-500" title="Principal" />
                              )}
                              {canEditThisContact && (
                                <button
                                  type="button"
                                  onClick={(ev) => openItemMenu(ev, 'email', e)}
                                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition"
                                >
                                  <MoreVertical size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Mail size={13} className="text-slate-400 shrink-0" />
                            <a
                              href={`mailto:${e.email}`}
                              className="text-xs font-semibold text-sky-600 hover:underline truncate"
                            >
                              {e.email}
                            </a>
                          </div>

                          {!e.notes && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              {e.is_primary && (
                                <Star size={13} className="fill-amber-400 text-amber-500" title="Principal" />
                              )}
                              {canEditThisContact && (
                                <button
                                  type="button"
                                  onClick={(ev) => openItemMenu(ev, 'email', e)}
                                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition"
                                >
                                  <MoreVertical size={14} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Localização */}
              <div className="p-3 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Localização
                  </span>
                  {canEditThisContact && (
                    <button
                      type="button"
                      onClick={() => handleOpenMethodModal('address', 'add')}
                      className="text-[11px] font-bold text-sky-600 hover:underline cursor-pointer"
                    >
                      + Adicionar
                    </button>
                  )}
                </div>

                {contact.addresses.length === 0 ? (
                  <span className="text-slate-400 italic">Sem endereço cadastrado</span>
                ) : (
                  <div className="space-y-2">
                    {contact.addresses.map((addr, idx) => {
                      const fullAddr = [addr.street, addr.number, addr.complement, addr.neighborhood, addr.city, addr.state, addr.cep].filter(Boolean).join(', ');
                      return (
                        <div key={idx} className="p-2.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs space-y-1.5">
                          {addr.notes && (
                            <div className="flex items-center justify-between text-xs pb-0.5">
                              <span className="font-bold text-slate-700 truncate max-w-[200px]">
                                {addr.notes}
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {addr.is_primary && (
                                  <Star size={13} className="fill-amber-400 text-amber-500" title="Principal" />
                                )}
                                {canEditThisContact && (
                                  <button
                                    type="button"
                                    onClick={(ev) => openItemMenu(ev, 'address', addr)}
                                    className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition"
                                  >
                                    <MoreVertical size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="flex items-start justify-between gap-2">
                            <p className="text-slate-600 text-xs leading-relaxed">{fullAddr}</p>
                            <div className="flex items-center gap-1 shrink-0">
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddr)}`}
                                target="_blank"
                                rel="noreferrer"
                                title="Abrir no Google Maps"
                                className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg border border-sky-100 transition shrink-0"
                              >
                                <MapPin size={13} />
                              </a>

                              {!addr.notes && (
                                <>
                                  {addr.is_primary && (
                                    <Star size={13} className="fill-amber-400 text-amber-500" title="Principal" />
                                  )}
                                  {canEditThisContact && (
                                    <button
                                      type="button"
                                      onClick={(ev) => openItemMenu(ev, 'address', addr)}
                                      className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition"
                                    >
                                      <MoreVertical size={14} />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Pessoas Relacionadas / Empresa Vinculada */}
              <div className="p-3 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {contact.type === 'company' ? 'Pessoas Relacionadas' : 'Empresa Vinculada'}
                  </span>
                  {canEditThisContact && (
                    <button
                      type="button"
                      onClick={() => setIsLinkModalOpen(true)}
                      className="text-[11px] font-bold text-sky-600 hover:underline cursor-pointer"
                    >
                      + Vincular
                    </button>
                  )}
                </div>

                {relatedLinks.length === 0 ? (
                  <span className="text-slate-400 italic">Nenhum vínculo cadastrado</span>
                ) : (
                  <div className="space-y-1.5">
                    {relatedLinks.map(link => (
                      <div
                        key={link.id}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const popoverHeight = 115;
                          const calculatedTop = rect.top - popoverHeight - 6;
                          const top = calculatedTop > 10 ? calculatedTop : rect.bottom + 6;
                          const left = Math.min(Math.max(10, rect.left), window.innerWidth - 280);
                          setHoveredLinkData({ link, top, left });
                        }}
                        onMouseLeave={() => setHoveredLinkData(null)}
                        className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2 shadow-2xs"
                      >
                        <div
                          onClick={() => handleNavigateToContact(link.related_contact_id)}
                          className="min-w-0 flex items-center gap-2 flex-1 cursor-pointer hover:text-sky-600"
                        >
                          <div className="w-6 h-6 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-700 shrink-0 border border-slate-200">
                            {link.avatar_url ? (
                              <img src={link.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              link.related_name.slice(0, 2).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <strong className="block truncate text-slate-800 text-xs">{formatShortName(link.related_name)}</strong>
                            <span className="text-[10px] text-slate-400 truncate">{link.role_in_company || 'Associado'}</span>
                          </div>
                        </div>

                        {canEditThisContact && (
                          <button
                            type="button"
                            onClick={() => setUnlinkTarget(link)}
                            className="p-1 text-slate-300 hover:text-red-500 rounded cursor-pointer"
                            title="Desvincular"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </aside>

        {/* PAINEL PRINCIPAL À DIREITA: ABAS (HISTÓRICO, OPORTUNIDADES, ANEXOS) */}
        <main className={`flex-1 flex flex-col min-w-0 bg-slate-50/60 overflow-hidden ${
          activeTab === 'dados' ? 'hidden lg:flex' : 'flex'
        }`}>
          
          {/* BARRA SUPERIOR DE NAVEGAÇÃO DE ABAS NO DESKTOP (lg) - DENTRO DO PAINEL DIREITO */}
          <div className="hidden lg:flex px-6 bg-white border-b border-slate-200/90 items-center justify-between shrink-0 shadow-2xs">
            <div className="flex items-center gap-6 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('historico')}
                className={`py-4 border-b-2 transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'historico' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <HistoryIcon size={15} />
                <span>Histórico</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('oportunidades')}
                className={`py-4 border-b-2 transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'oportunidades' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Briefcase size={15} />
                <span>Oportunidades</span>
                {opportunities.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700">
                    {opportunities.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('anexos')}
                className={`py-4 border-b-2 transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'anexos' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Paperclip size={15} />
                <span>Anexos</span>
              </button>
            </div>
          </div>

          {/* CONTEÚDO DAS ABAS */}
          <div className="flex-1 overflow-y-auto lume-scrollbar p-4 sm:p-6">
            
            {/* ABA HISTÓRICO: Formulário recolhido sem fechar involuntariamente */}
            {(activeTab === 'historico' || (activeTab === 'dados' && !isMobile)) && contact && (
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
                {/* Botão de Abrir / Fechar Formulário de Registro de Atividade (Apenas Desktop) */}
                {canEditThisContact && (
                  <div className="hidden md:flex bg-white border border-slate-200/90 rounded-2xl p-3 shadow-2xs items-center justify-between">
                    <span className="text-xs text-slate-600 font-medium">Registrar uma nova nota, ligação, reunião ou mensagem:</span>
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
                  entityType="contact"
                  entityId={contact.id}
                  companyId={contact.company_id}
                  readOnly={!canEditThisContact}
                  hideHeaderActions={!showInteractionForm}
                />
              </div>
            )}

            {/* ABA OPORTUNIDADES */}
            {activeTab === 'oportunidades' && contact && (
              <div className="max-w-4xl mx-auto space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Negociações no Funil Comercial ({opportunities.length})
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Total previsto em aberto: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                        opportunities.reduce((acc, curr) => acc + curr.estimated_value, 0)
                      )}
                    </p>
                  </div>

                  {permissions.canManageDeals && (
                    <button
                      type="button"
                      onClick={handleCreateNewOpportunity}
                      className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>Nova Oportunidade</span>
                    </button>
                  )}
                </div>

                {loadingOpportunities ? (
                  <div className="py-16 text-center text-slate-400 text-xs">
                    <Loader2 size={20} className="animate-spin text-sky-600 mx-auto mb-2" />
                    Carregando oportunidades...
                  </div>
                ) : opportunities.length === 0 ? (
                  <div className="py-16 text-center space-y-3 bg-white rounded-2xl border border-dashed border-slate-200">
                    <Briefcase size={28} className="text-slate-300 mx-auto" />
                    <h5 className="text-xs font-bold text-slate-700">Nenhuma oportunidade vinculada</h5>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      Crie propostas ou negociações no funil comercial para este contato.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {opportunities.map((opp) => (
                      <div
                        key={opp.id}
                        onClick={() => handleOpenOpportunityCard(opp.id)}
                        className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:border-sky-300 hover:shadow-xs transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 group cursor-pointer"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-sky-600 transition truncate flex items-center gap-1">
                              <span>{opp.title}</span>
                              <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 text-sky-500 transition-opacity" />
                            </h4>
                            {getStatusBadge(opp.status)}
                            {opp.is_partner && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-50 text-violet-700 border border-violet-200">
                                Indicador
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            {opp.stage_name && (
                              <span className="inline-flex items-center gap-1 font-semibold text-slate-600">
                                <TrendingUp size={12} className="text-slate-400" />
                                {opp.stage_name}
                              </span>
                            )}
                            {opp.expected_close_date && (
                              <span className="inline-flex items-center gap-1 font-medium text-slate-500">
                                <Calendar size={12} className="text-slate-400" />
                                {new Date(opp.expected_close_date).toLocaleDateString('pt-BR')}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-left sm:text-right shrink-0">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Valor Previsto</span>
                          <span className="text-xs sm:text-sm font-bold text-slate-900 font-mono">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(opp.estimated_value)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ABA ANEXOS */}
            {activeTab === 'anexos' && contact && (
              <div className="max-w-4xl mx-auto hide-mobile-doc-btn">
                <EntityDocuments
                  entityType="contact"
                  entityId={contact.id}
                  companyId={contact.company_id}
                  readOnly={!canEditThisContact}
                  hideHeaderActions={isMobile}
                />
              </div>
            )}
          </div>
        </main>
      </div>

      {/* BOTÃO FLUTUANTE (FAB) (+) EXCLUSIVO MOBILE */}
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
              Adicionar ao Contato
            </h3>

            <div className="space-y-2 pt-1">
              {canEditThisContact && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileActionSheetOpen(false);
                    setActiveTab('historico');
                    setShowInteractionForm(true);
                  }}
                  className="w-full p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center gap-3 text-slate-800 font-semibold text-xs transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                    <Clock size={18} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-slate-900">Registrar Interação / Tarefa</p>
                    <p className="text-[11px] text-slate-500 font-normal">Adicione notas, reuniões ou ligações</p>
                  </div>
                </button>
              )}

              {permissions.canManageDeals && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileActionSheetOpen(false);
                    handleCreateNewOpportunity();
                  }}
                  className="w-full p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center gap-3 text-slate-800 font-semibold text-xs transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <TrendingUp size={18} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-slate-900">Nova Oportunidade</p>
                    <p className="text-[11px] text-slate-500 font-normal">Criar negociação no funil comercial</p>
                  </div>
                </button>
              )}

              {canEditThisContact && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileActionSheetOpen(false);
                    setActiveTab('anexos');
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
                    <p className="text-[11px] text-slate-500 font-normal">Upload de arquivos ou contratos</p>
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

      {/* ACTION SHEET 2: ABERTURA PELO MENU DO TOPO (...) -> Editar e Excluir */}
      {isMobileTopMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[160] flex flex-col justify-end bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div 
            className="absolute inset-0" 
            onClick={() => setIsMobileTopMenuOpen(false)} 
          />

          <div className="relative bg-white rounded-t-3xl p-5 space-y-3 animate-in slide-in-from-bottom duration-200 border-t border-slate-200">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-2" />

            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
              Opções do Contato
            </h3>

            <div className="space-y-2 pt-1">
              {canEditThisContact && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileTopMenuOpen(false);
                    initEditState(contact!);
                    setIsEditContactModalOpen(true);
                  }}
                  className="w-full p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center gap-3 text-slate-800 font-semibold text-xs transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                    <Edit3 size={18} className="text-sky-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-slate-900">Editar Contato</p>
                    <p className="text-[11px] text-slate-500 font-normal">Alterar dados cadastrais e documentos</p>
                  </div>
                </button>
              )}

              {canDeleteThisContact && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileTopMenuOpen(false);
                    setShowDeleteModal(true);
                  }}
                  className="w-full p-3 bg-rose-50/70 hover:bg-rose-100/70 rounded-2xl flex items-center gap-3 text-rose-800 font-semibold text-xs transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                    <Trash2 size={18} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-rose-900">Excluir Contato</p>
                    <p className="text-[11px] text-rose-600 font-normal">Mover este contato para a lixeira</p>
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

      {/* POPOVER HOVER DO RESPONSÁVEL (PORTAL NO BODY) */}
      {hoveredOwnerCoords && contact && createPortal(
        <div
          style={{ position: 'fixed', top: `${hoveredOwnerCoords.top}px`, left: `${hoveredOwnerCoords.left}px` }}
          className="w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl p-3 z-[99999] pointer-events-none animate-in fade-in zoom-in-95 duration-100 text-left"
        >
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
            <div className="w-9 h-9 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
              {contact.owner_avatar ? (
                <img src={contact.owner_avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-sky-600 text-white flex items-center justify-center font-bold text-xs">
                  {(contact.owner_name || 'U').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <strong className="block text-xs font-bold text-slate-900 truncate">{contact.owner_name}</strong>
              <span className="text-[10px] text-slate-400">{contact.owner_role}</span>
            </div>
          </div>
          {contact.owner_email && (
            <p className="text-[11px] text-slate-500 pt-2 truncate flex items-center gap-1.5">
              <Mail size={12} className="text-slate-400 shrink-0" />
              <span>{contact.owner_email}</span>
            </p>
          )}
        </div>,
        document.body
      )}

      {/* POPOVER HOVER DO CONTATO VINCULADO (ABRE PARA CIMA VIA PORTAL) */}
      {hoveredLinkData && createPortal(
        <div
          style={{ position: 'fixed', top: `${hoveredLinkData.top}px`, left: `${hoveredLinkData.left}px` }}
          className="w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl p-3 z-[99999] pointer-events-none animate-in fade-in zoom-in-95 duration-100 text-left"
        >
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center font-bold text-xs shrink-0 border border-slate-200">
              {hoveredLinkData.link.avatar_url ? (
                <img src={hoveredLinkData.link.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : hoveredLinkData.link.related_name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <strong className="block text-xs font-bold text-slate-900 truncate">{hoveredLinkData.link.related_name}</strong>
              <span className="text-[10px] text-slate-400">{hoveredLinkData.link.role_in_company || 'Associado'}</span>
            </div>
          </div>
          <div className="pt-2 space-y-1">
            {hoveredLinkData.link.phone && (
              <p className="text-[11px] text-slate-600 truncate flex items-center gap-1.5">
                <Phone size={11} className="text-slate-400" />
                <span>{hoveredLinkData.link.phone}</span>
              </p>
            )}
            {hoveredLinkData.link.email && (
              <p className="text-[11px] text-slate-600 truncate flex items-center gap-1.5">
                <Mail size={11} className="text-slate-400" />
                <span>{hoveredLinkData.link.email}</span>
              </p>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* DROPDOWN FLUTUANTE DE AÇÕES DO ITEM */}
      {itemDropdownMenu && createPortal(
        <div
          style={{ position: 'fixed', top: `${itemDropdownMenu.top}px`, left: `${itemDropdownMenu.left}px` }}
          className="w-44 bg-white border border-slate-200 rounded-xl shadow-xl py-1 z-[99999] text-xs text-left animate-in fade-in zoom-in-95 duration-75"
          onClick={e => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => handleOpenMethodModal(itemDropdownMenu.type, 'edit', itemDropdownMenu.item)}
            className="w-full px-3 py-1.5 text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer font-medium"
          >
            <Edit3 size={13} className="text-sky-600" />
            <span>Editar</span>
          </button>

          {!itemDropdownMenu.item.is_primary && (
            <button
              type="button"
              onClick={() => {
                if (itemDropdownMenu.type === 'phone') handleSetPrimaryPhone(itemDropdownMenu.item.id);
                else if (itemDropdownMenu.type === 'email') handleSetPrimaryEmail(itemDropdownMenu.item.id);
                else if (itemDropdownMenu.type === 'address') handleSetPrimaryAddress(itemDropdownMenu.item.id);
              }}
              className="w-full px-3 py-1.5 text-amber-600 hover:bg-amber-50 flex items-center gap-2 cursor-pointer font-medium"
            >
              <Star size={13} className="fill-amber-400 text-amber-500" />
              <span>Tornar Principal</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (itemDropdownMenu.type === 'phone') handleDeletePhone(itemDropdownMenu.item.id);
              else if (itemDropdownMenu.type === 'email') handleDeleteEmail(itemDropdownMenu.item.id);
              else if (itemDropdownMenu.type === 'address') handleDeleteAddress(itemDropdownMenu.item.id);
            }}
            className="w-full px-3 py-1.5 text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer font-medium border-t border-slate-100"
          >
            <Trash2 size={13} />
            <span>Excluir</span>
          </button>
        </div>,
        document.body
      )}

      {/* MODAL DE EDIÇÃO COMPLETO DO CONTATO */}
      {isEditContactModalOpen && contact && (
        <div className="fixed inset-0 z-[260] flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl border border-slate-200 p-5 sm:p-6 w-full sm:max-w-lg shadow-2xl space-y-4 max-h-[85vh] sm:max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-200 sm:zoom-in-95">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-2 sm:hidden" />
            
            <div className="flex items-center justify-between border-b pb-3">
              <h4 className="font-bold text-sm sm:text-base text-slate-900">Editar Dados do Contato</h4>
              <button onClick={() => setIsEditContactModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveContactEdit} className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome Principal *</label>
                <input
                  type="text"
                  required
                  value={editDisplayName}
                  onChange={e => setEditDisplayName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Relação Comercial</label>
                  <select
                    value={editRelation}
                    onChange={e => setEditRelation(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  >
                    <option value="cliente">Cliente</option>
                    <option value="lead">Lead / Oportunidade</option>
                    <option value="fornecedor">Fornecedor</option>
                    <option value="parceiro">Parceiro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Origem do Contato</label>
                  <select
                    value={editSource}
                    onChange={e => setEditSource(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  >
                    <option value="indicacao">Indicação / Boca a boca</option>
                    <option value="instagram">Instagram / Redes</option>
                    <option value="whatsapp">WhatsApp Direto</option>
                    <option value="google">Google / Busca</option>
                    <option value="anuncio">Anúncio Pago</option>
                    <option value="prospeccao">Prospecção Ativa</option>
                    <option value="evento">Evento / Feira</option>
                  </select>
                </div>
              </div>

              {contact.type === 'person' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Cargo / Ocupação</label>
                    <input
                      type="text"
                      value={editOccupation}
                      onChange={e => setEditOccupation(e.target.value)}
                      placeholder="Ex: Engenheiro, Diretor..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">CPF</label>
                    <input
                      type="text"
                      value={editCpf}
                      onChange={e => setEditCpf(maskCPF(e.target.value))}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Nome Fantasia</label>
                      <input
                        type="text"
                        value={editTradeName}
                        onChange={e => setEditTradeName(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">CNPJ</label>
                      <input
                        type="text"
                        value={editCnpj}
                        onChange={e => setEditCnpj(maskCNPJ(e.target.value))}
                        placeholder="00.000.000/0000-00"
                        maxLength={18}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Razão Social</label>
                    <input
                      type="text"
                      value={editLegalName}
                      onChange={e => setEditLegalName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Inscrição Estadual (I.E.)</label>
                      <input
                        type="text"
                        value={editStateRegistration}
                        onChange={e => setEditStateRegistration(e.target.value)}
                        placeholder="Isento ou nº"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Website</label>
                      <input
                        type="text"
                        value={editWebsite}
                        onChange={e => setEditWebsite(e.target.value)}
                        placeholder="www.empresa.com.br"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsEditContactModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingContactEdit || !editDisplayName.trim()}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-2xs disabled:opacity-50 cursor-pointer"
                >
                  {savingContactEdit ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE ADIÇÃO OU EDIÇÃO DE TELEFONE, EMAIL OU ENDEREÇO */}
      {methodModal && (
        <div className="fixed inset-0 z-[270] flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl border border-slate-200 p-5 sm:p-6 w-full sm:max-w-sm shadow-2xl space-y-4 animate-in slide-in-from-bottom duration-200 sm:zoom-in-95">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-2 sm:hidden" />
            
            <div className="flex items-center justify-between border-b pb-2.5">
              <h4 className="text-sm font-bold text-slate-900">
                {methodModal.mode === 'edit' ? 'Editar' : 'Adicionar'} {methodModal.type === 'phone' ? 'Telefone' : methodModal.type === 'email' ? 'E-mail' : 'Endereço'}
              </h4>
              <button onClick={() => setMethodModal(null)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            {methodModal.type === 'phone' && (
              <form onSubmit={handleSavePhone} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Número do Telefone *</label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="(00) 00000-0000"
                    value={inputPhone}
                    onChange={e => setInputPhone(formatPhone(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Descrição / Rótulo</label>
                  <input
                    type="text"
                    placeholder="Ex: Comercial, Recados, Pessoal"
                    value={inputPhoneLabel}
                    onChange={e => setInputPhoneLabel(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div className="flex items-center gap-4 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={inputPhoneIsWhats}
                      onChange={e => setInputPhoneIsWhats(e.target.checked)}
                      className="accent-emerald-600"
                    />
                    <span>WhatsApp</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={inputPhoneIsPrimary}
                      onChange={e => setInputPhoneIsPrimary(e.target.checked)}
                      className="accent-sky-600"
                    />
                    <span>Principal</span>
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button type="button" onClick={() => setMethodModal(null)} className="px-3 py-1.5 text-slate-600">Cancelar</button>
                  <button type="submit" disabled={savingMethod || !inputPhone.trim()} className="px-4 py-1.5 bg-sky-600 text-white rounded-xl font-bold">Salvar</button>
                </div>
              </form>
            )}

            {methodModal.type === 'email' && (
              <form onSubmit={handleSaveEmail} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Endereço de E-mail *</label>
                  <input
                    type="email"
                    required
                    autoFocus
                    placeholder="email@dominio.com"
                    value={inputEmail}
                    onChange={e => setInputEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Descrição / Rótulo</label>
                  <input
                    type="text"
                    placeholder="Ex: Financeiro, NFe, Pessoal"
                    value={inputEmailLabel}
                    onChange={e => setInputEmailLabel(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 pt-1">
                  <input
                    type="checkbox"
                    checked={inputEmailIsPrimary}
                    onChange={e => setInputEmailIsPrimary(e.target.checked)}
                    className="accent-sky-600"
                  />
                  <span>Definir como Principal</span>
                </label>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button type="button" onClick={() => setMethodModal(null)} className="px-3 py-1.5 text-slate-600">Cancelar</button>
                  <button type="submit" disabled={savingMethod || !inputEmail.trim()} className="px-4 py-1.5 bg-sky-600 text-white rounded-xl font-bold">Salvar</button>
                </div>
              </form>
            )}

            {methodModal.type === 'address' && (
              <form onSubmit={handleSaveAddress} className="space-y-2.5 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-0.5">Descrição / Rótulo</label>
                  <input
                    type="text"
                    placeholder="Ex: Sede, Canteiro de Obras, Entrega"
                    value={inputAddressLabel}
                    onChange={e => setInputAddressLabel(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-0.5">CEP</label>
                  <input
                    type="text"
                    placeholder="00000-000"
                    value={inputCep}
                    onBlur={e => handleCepQuickLookup(e.target.value)}
                    onChange={e => setInputCep(formatCEP(e.target.value))}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-0.5">Rua / Logradouro</label>
                  <input
                    type="text"
                    placeholder="Rua..."
                    value={inputStreet}
                    onChange={e => setInputStreet(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Número"
                    value={inputNumber}
                    onChange={e => setInputNumber(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                  <input
                    type="text"
                    placeholder="Complemento"
                    value={inputComplement}
                    onChange={e => setInputComplement(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Bairro"
                    value={inputNeighborhood}
                    onChange={e => setInputNeighborhood(e.target.value)}
                    className="col-span-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                  <input
                    type="text"
                    placeholder="Cidade"
                    value={inputCity}
                    onChange={e => setInputCity(e.target.value)}
                    className="col-span-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                  <input
                    type="text"
                    placeholder="UF"
                    maxLength={2}
                    value={inputState}
                    onChange={e => setInputState(e.target.value.toUpperCase())}
                    className="col-span-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-center"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button type="button" onClick={() => setMethodModal(null)} className="px-3 py-1.5 text-slate-600">Cancelar</button>
                  <button type="submit" disabled={savingMethod || (!inputStreet.trim() && !inputCity.trim())} className="px-4 py-1.5 bg-sky-600 text-white rounded-xl font-bold">Salvar</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE VINCULAR PESSOA OU EMPRESA */}
      {isLinkModalOpen && contact && (
        <div className="fixed inset-0 z-[260] flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl border border-slate-200 p-5 sm:p-6 w-full sm:max-w-md shadow-2xl space-y-4 animate-in slide-in-from-bottom duration-200 sm:zoom-in-95">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-2 sm:hidden" />
            
            <div className="flex items-center justify-between border-b pb-3">
              <h4 className="font-bold text-sm sm:text-base text-slate-900">
                {contact.type === 'company' ? 'Vincular Pessoa' : 'Vincular Empresa'}
              </h4>
              <button onClick={() => setIsLinkModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {contact.type === 'company' ? 'Selecione a Pessoa' : 'Selecione a Empresa'} *
                </label>
                <div className="relative mb-1.5">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filtrar por nome..."
                    value={linkSearchQuery}
                    onChange={e => setLinkSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div className="max-h-40 overflow-y-auto lume-scrollbar border border-slate-200 rounded-xl divide-y divide-slate-100">
                  {availableToLink
                    .filter(c => c.display_name.toLowerCase().includes(linkSearchQuery.toLowerCase()))
                    .map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedTargetContactId(item.id)}
                        className={`w-full p-2 flex items-center gap-2 text-left transition cursor-pointer ${
                          selectedTargetContactId === item.id ? 'bg-sky-50 font-bold text-sky-900' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center font-bold text-[10px]">
                          {item.display_name.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="truncate">{item.display_name}</span>
                      </button>
                    ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Cargo ou Relação *</label>
                <input
                  type="text"
                  placeholder="Ex: Diretor de Obras, Representante, Sócio..."
                  value={linkRole}
                  onChange={e => setLinkRole(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsLinkModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={savingLink || !selectedTargetContactId || !linkRole.trim()}
                  onClick={handleSaveLink}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-2xs disabled:opacity-50"
                >
                  {savingLink ? 'Vinculando...' : 'Confirmar Vínculo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ALTERAÇÃO DE RESPONSÁVEL */}
      {showChangeOwnerModal && contact && (
        <div className="fixed inset-0 z-[260] flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl border border-slate-200 p-5 max-w-sm w-full shadow-2xl space-y-4 animate-in slide-in-from-bottom duration-200 sm:zoom-in-95">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-2 sm:hidden" />

            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <UserCheck size={16} className="text-sky-600" />
                <span>Alterar Responsável</span>
              </h4>
              <button onClick={() => setShowChangeOwnerModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto lume-scrollbar space-y-1.5">
              {companyMembers.map(member => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => handleSelectNewOwner(member.id)}
                  disabled={savingNewOwner || contact.assigned_to === member.id}
                  className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-sky-300 hover:bg-slate-50 flex items-center justify-between text-left transition cursor-pointer text-xs"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full overflow-hidden bg-slate-200">
                      {member.avatar_url ? (
                        <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-sky-600 text-white flex items-center justify-center text-[10px] font-bold">
                          {(member.full_name || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <span className="font-semibold text-slate-800">{member.full_name}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">{member.role}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DESVINCULAR CONTATO */}
      {unlinkTarget && contact && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-sm w-full shadow-2xl text-center space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-100">
              <Unlink size={24} />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-900">Desvincular Contato</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Deseja desvincular <strong className="text-slate-800">{unlinkTarget.related_name}</strong> deste cadastro?
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setUnlinkTarget(null)}
                className="flex-1 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={unlinking}
                onClick={handleConfirmRemoveLink}
                className="flex-1 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
              >
                {unlinking ? 'Desvinculando...' : 'Desvincular'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EXCLUSÃO */}
      {showDeleteModal && contact && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-sm w-full shadow-2xl text-center space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-100">
              <AlertTriangle size={24} />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-900">Excluir Contato</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Tem certeza que deseja mover <strong className="text-slate-800">{contact.display_name}</strong> para a lixeira?
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDeleteContact}
                className="flex-1 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
              >
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE RECORTE DA FOTO */}
      {isCropModalOpen && tempImageSrc && (
        <div className="fixed inset-0 z-[270] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b">
              <h4 className="font-bold text-sm text-slate-900">Ajustar Foto do Contato</h4>
              <button onClick={() => { setIsCropModalOpen(false); setTempImageSrc(null); }} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <div className="w-48 h-48 rounded-2xl border-2 border-dashed border-sky-400 mx-auto overflow-hidden bg-slate-100 flex items-center justify-center">
              <img
                src={tempImageSrc}
                alt="Ajuste"
                style={{ transform: `scale(${zoomLevel})` }}
                className="w-full h-full object-cover rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                <span className="flex items-center gap-1"><ZoomOut size={13} /> Zoom</span>
                <span>{Math.round(zoomLevel * 100)}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="2.5"
                step="0.05"
                value={zoomLevel}
                onChange={e => setZoomLevel(parseFloat(e.target.value))}
                className="w-full accent-sky-600 cursor-pointer"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => { setIsCropModalOpen(false); setTempImageSrc(null); }}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={uploadingAvatar}
                onClick={handleConfirmCropAndUpload}
                className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-2xs disabled:opacity-50"
              >
                {uploadingAvatar ? 'Salvando...' : 'Salvar Foto'}
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

export default ContactProfileModal;