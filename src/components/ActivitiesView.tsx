import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { ActivitiesCalendarView } from './ActivitiesCalendarView';
import { ActivitiesKanbanView } from './ActivitiesKanbanView';
import { ActivityCardItem } from './ActivityCardItem';
import { ContactProfileModal } from './ContactProfileModal';
import { OpportunityDetailModal } from './OpportunityDetailModal';
import { CreateOpportunityModal } from './CreateOpportunityModal';
import {
  Mail,
  Phone,
  MessageCircle,
  FileText,
  MapPin,
  Users,
  CheckSquare,
  Calendar as CalendarIcon,
  List,
  Columns3,
  Search,
  Plus,
  X,
  ChevronDown,
  Loader2,
  Check,
  Trash2,
  Briefcase,
  Building2,
  User,
  SlidersHorizontal
} from 'lucide-react';

export interface ActivityEditData {
  id: string;
  title: string;
  description: string | null;
  activity_type: string;
  priority: string;
  due_date: string | null;
  opportunity_id?: string | null;
  contact_id?: string | null;
  assignee_ids?: string[];
}

interface ActivityItem {
  id: string;
  title: string;
  description: string | null;
  activity_type: string;
  priority: string;
  due_date: string | null;
  status: 'pendente' | 'concluida' | 'cancelada';
  completed_at: string | null;
  created_at: string;
  created_by?: string | null;
  opportunity_id?: string | null;
  contact_id?: string | null;
  opportunity?: {
    id: string;
    title: string;
    estimated_value?: number | null;
    status?: string | null;
  } | null;
  contact?: {
    id: string;
    display_name: string;
    type?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  assignees: Array<{ id: string; name: string; email?: string; avatar_url?: string | null }>;
}

interface TeamMember {
  id: string;
  name: string;
  email?: string;
  avatar_url?: string | null;
}

interface ActivitiesViewProps {
  initialFilterOptions?: {
    filter?: 'atrasadas' | 'pendentes' | 'concluidas';
  } | null;
}

const sendNotification = async (params: {
  userId: string;
  companyId: string;
  title: string;
  message: string;
  category: string;
  actionUrl?: string;
  entityId?: string;
  entityType?: string;
}) => {
  try {
    await supabase.rpc('create_notification_checked', {
      p_user_id: params.userId,
      p_company_id: params.companyId,
      p_title: params.title,
      p_message: params.message,
      p_category: params.category,
      p_action_url: params.actionUrl || null,
      p_entity_id: params.entityId || null,
      p_entity_type: params.entityType || null
    });
  } catch (err) {
    console.warn('Erro ao disparar notificação:', err);
  }
};

export const ActivitiesView: React.FC<ActivitiesViewProps> = ({ initialFilterOptions }) => {
  const { user } = useAuth();
  const { permissions } = usePermissions();

  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // Modos de Exibição
  const [displayMode, setDisplayMode] = useState<'list' | 'kanban' | 'calendar'>('list');

  // Filtros
  const [activeTab, setActiveTab] = useState<'pendentes' | 'concluidas' | 'todas' | 'atrasadas'>(() => {
    if (initialFilterOptions?.filter === 'atrasadas') return 'atrasadas';
    if (initialFilterOptions?.filter === 'concluidas') return 'concluidas';
    return 'pendentes';
  });

  const [typeFilter, setTypeFilter] = useState<string>('todos');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [duePeriodFilter, setDuePeriodFilter] = useState<'all' | 'today' | 'this_week' | 'this_month'>('all');
  const [searchText, setSearchText] = useState('');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Painel Inline de Criação/Edição
  const [isInlineCreateOpen, setIsInlineCreateOpen] = useState(false);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [savingInline, setSavingInline] = useState(false);
  const [inlineType, setInlineType] = useState<string>('email');
  const [inlinePriority, setInlinePriority] = useState<string>('media');
  const [inlineDescription, setInlineDescription] = useState<string>('');
  const [inlineDueDate, setInlineDueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [inlineDueTime, setInlineDueTime] = useState<string>('14:00');
  const [inlineSelectedAssignees, setInlineSelectedAssignees] = useState<string[]>([]);
  const [isAssigneeDropdownOpen, setIsAssigneeDropdownOpen] = useState(false);
  const assigneeDropdownRef = useRef<HTMLDivElement>(null);

  // Vínculos
  const [inlineLinkSearch, setInlineLinkSearch] = useState('');
  const [inlineSelectedOppId, setInlineSelectedOppId] = useState<string | null>(null);
  const [inlineSelectedContactId, setInlineSelectedContactId] = useState<string | null>(null);
  const [isLinkDropdownOpen, setIsLinkDropdownOpen] = useState(false);
  const linkDropdownRef = useRef<HTMLDivElement>(null);

  // Listas para busca
  const [oppList, setOppList] = useState<Array<{ id: string; title: string }>>([]);
  const [contactList, setContactList] = useState<Array<{ id: string; display_name: string; type: string }>>([]);

  // Modais
  const [activityToDelete, setActivityToDelete] = useState<ActivityItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);
  const [isOpportunityModalOpen, setIsOpportunityModalOpen] = useState(false);

  const [isCreateOpportunityOpen, setIsCreateOpportunityOpen] = useState(false);
  const [opportunityContactId, setOpportunityContactId] = useState<string | null>(null);

  const authUser = user as any;
  const currentUserId = authUser?.id || authUser?.profile?.id || authUser?.user?.id || null;
  const currentUserName = authUser?.profile?.full_name || authUser?.user_metadata?.full_name || 'Utilizador';
  const isAdmin = Boolean(permissions.isOwnerOrAdmin);

  useEffect(() => {
    if (initialFilterOptions?.filter === 'atrasadas') {
      setActiveTab('atrasadas');
    } else if (initialFilterOptions?.filter === 'concluidas') {
      setActiveTab('concluidas');
    } else if (initialFilterOptions?.filter === 'pendentes') {
      setActiveTab('pendentes');
    }
  }, [initialFilterOptions]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (assigneeDropdownRef.current && !assigneeDropdownRef.current.contains(target)) {
        setIsAssigneeDropdownOpen(false);
      }
      if (linkDropdownRef.current && !linkDropdownRef.current.contains(target)) {
        setIsLinkDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (user?.company?.id) {
      loadActivities();
      loadMetadata();
    }
  }, [user?.company?.id]);

  const loadMetadata = async () => {
    const companyId = user?.company?.id;
    if (!companyId) return;

    try {
      const [membersRes, oppsRes, contactsRes] = await Promise.all([
        supabase
          .from('memberships')
          .select(`profile:profiles!profile_id (id, full_name, email, avatar_url)`)
          .eq('company_id', companyId)
          .eq('status', 'ativo'),
        supabase
          .from('opportunities')
          .select('id, title')
          .eq('company_id', companyId)
          .is('deleted_at', null)
          .order('title', { ascending: true }),
        supabase
          .from('contacts')
          .select('id, display_name, type')
          .eq('company_id', companyId)
          .is('deleted_at', null)
          .order('display_name', { ascending: true })
      ]);

      const formattedMembers = (membersRes.data || [])
        .map((m: any) => {
          const prof = Array.isArray(m.profile) ? m.profile[0] : m.profile;
          if (!prof) return null;
          return {
            id: prof.id,
            name: prof.full_name || 'Usuário',
            email: prof.email || '',
            avatar_url: prof.avatar_url || null
          };
        })
        .filter(Boolean) as TeamMember[];

      setTeamMembers(formattedMembers);
      setOppList(oppsRes.data || []);
      setContactList(contactsRes.data || []);
    } catch (err) {
      console.warn('Erro ao carregar dados auxiliares:', err);
    }
  };

  const loadActivities = async () => {
    try {
      setLoading(true);
      const companyId = user?.company?.id;
      if (!companyId) return;

      const { data: actsData, error: actsErr } = await supabase
        .from('activities')
        .select(`
          id,
          title,
          description,
          activity_type,
          priority,
          due_date,
          status,
          completed_at,
          created_at,
          created_by,
          opportunity_id,
          contact_id,
          opportunity:opportunities!opportunity_id (
            id,
            title,
            estimated_value,
            status
          ),
          contact:contacts!contact_id (
            id,
            display_name,
            type
          )
        `)
        .eq('company_id', companyId)
        .order('due_date', { ascending: false });

      if (actsErr) throw actsErr;

      const activityIds = (actsData || []).map((a) => a.id);
      let assigneesMap: Record<string, Array<{ id: string; name: string; email?: string; avatar_url?: string | null }>> = {};

      if (activityIds.length > 0) {
        const { data: assigneesData } = await supabase
          .from('activity_assignees')
          .select(`
            activity_id,
            profile:profiles!profile_id (
              id,
              full_name,
              email,
              avatar_url
            )
          `)
          .in('activity_id', activityIds);

        (assigneesData || []).forEach((row: any) => {
          const prof = Array.isArray(row.profile) ? row.profile[0] : row.profile;
          if (prof) {
            if (!assigneesMap[row.activity_id]) {
              assigneesMap[row.activity_id] = [];
            }
            assigneesMap[row.activity_id].push({
              id: prof.id,
              name: prof.full_name || 'Usuário',
              email: prof.email || '',
              avatar_url: prof.avatar_url || null
            });
          }
        });
      }

      const contactIds = (actsData || [])
        .map((a: any) => (Array.isArray(a.contact) ? a.contact[0]?.id : a.contact?.id))
        .filter(Boolean);

      let contactDetailsMap: Record<string, { phone?: string | null; email?: string | null }> = {};
      if (contactIds.length > 0) {
        const [{ data: phones }, { data: emails }] = await Promise.all([
          supabase.from('contact_phones').select('*').in('contact_id', contactIds),
          supabase.from('contact_emails').select('*').in('contact_id', contactIds)
        ]);

        (phones || []).forEach((p: any) => {
          if (!contactDetailsMap[p.contact_id]) contactDetailsMap[p.contact_id] = {};
          if (!contactDetailsMap[p.contact_id].phone) {
            contactDetailsMap[p.contact_id].phone = p.phone_number || p.phone;
          }
        });

        (emails || []).forEach((e: any) => {
          if (!contactDetailsMap[e.contact_id]) contactDetailsMap[e.contact_id] = {};
          if (!contactDetailsMap[e.contact_id].email) {
            contactDetailsMap[e.contact_id].email = e.email;
          }
        });
      }

      const formatted: ActivityItem[] = (actsData || []).map((a: any) => {
        let cont = Array.isArray(a.contact) ? a.contact[0] : a.contact;
        if (cont?.id && contactDetailsMap[cont.id]) {
          cont = {
            ...cont,
            phone: contactDetailsMap[cont.id].phone || null,
            email: contactDetailsMap[cont.id].email || null
          };
        }

        return {
          ...a,
          opportunity: Array.isArray(a.opportunity) ? a.opportunity[0] : a.opportunity,
          contact: cont,
          assignees: assigneesMap[a.id] || []
        };
      });

      setActivities(formatted);
    } catch (err) {
      console.error('Erro ao carregar atividades:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleComplete = async (activity: ActivityItem) => {
    try {
      const newStatus = activity.status === 'pendente' ? 'concluida' : 'pendente';
      const completedAt = newStatus === 'concluida' ? new Date().toISOString() : null;

      setActivities((prev) =>
        prev.map((a) =>
          a.id === activity.id ? { ...a, status: newStatus, completed_at: completedAt } : a
        )
      );

      const { error } = await supabase
        .from('activities')
        .update({
          status: newStatus,
          completed_at: completedAt,
          updated_at: new Date().toISOString()
        })
        .eq('id', activity.id);

      if (error) throw error;

      window.dispatchEvent(new CustomEvent('activity-updated'));
    } catch (err: any) {
      alert(`Falha ao atualizar status: ${err.message}`);
      loadActivities();
    }
  };

  const handleUpdateActivityDateOrStatus = async (
    activityId: string,
    updates: { due_date?: string | null; status?: 'pendente' | 'concluida'; completed_at?: string | null }
  ) => {
    try {
      setActivities((prev) =>
        prev.map((a) => (a.id === activityId ? { ...a, ...updates } : a))
      );

      const { error } = await supabase
        .from('activities')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', activityId);

      if (error) throw error;

      window.dispatchEvent(new CustomEvent('activity-updated'));
    } catch (err: any) {
      alert(`Falha ao mover atividade: ${err.message}`);
      loadActivities();
    }
  };

  const handleConfirmDelete = async () => {
    if (!activityToDelete) return;
    try {
      setDeleting(true);
      const { error } = await supabase.from('activities').delete().eq('id', activityToDelete.id);
      if (error) throw error;

      setActivities((prev) => prev.filter((a) => a.id !== activityToDelete.id));
      setActivityToDelete(null);

      window.dispatchEvent(new CustomEvent('activity-updated'));
    } catch (err: any) {
      alert(`Erro ao excluir atividade: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleStartEdit = (act: ActivityItem) => {
    setEditingActivityId(act.id);
    setInlineType(act.activity_type || 'email');
    setInlinePriority(act.priority || 'media');
    setInlineDescription(act.description || '');

    if (act.due_date) {
      const d = new Date(act.due_date);
      setInlineDueDate(d.toISOString().split('T')[0]);
      setInlineDueTime(d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    }

    const linkedOppId = act.opportunity_id || act.opportunity?.id;
    const linkedContactId = act.contact_id || act.contact?.id;

    if (act.opportunity && linkedOppId) {
      setInlineSelectedOppId(linkedOppId);
      setInlineSelectedContactId(null);
      setInlineLinkSearch(`💼 ${act.opportunity.title}`);
    } else if (act.contact && linkedContactId) {
      setInlineSelectedContactId(linkedContactId);
      setInlineSelectedOppId(null);
      setInlineLinkSearch(`👤 ${act.contact.display_name}`);
    } else {
      setInlineSelectedOppId(null);
      setInlineSelectedContactId(null);
      setInlineLinkSearch('');
    }

    const otherAssigneeIds = act.assignees
      .map((a) => a.id)
      .filter((id) => id !== currentUserId && id !== (user as any)?.id);

    setInlineSelectedAssignees(otherAssigneeIds);
    setIsInlineCreateOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCloseInline = () => {
    setIsInlineCreateOpen(false);
    setEditingActivityId(null);
    setInlineDescription('');
    setInlinePriority('media');
    setInlineLinkSearch('');
    setInlineSelectedOppId(null);
    setInlineSelectedContactId(null);
    setInlineSelectedAssignees([]);
  };

  const handleSaveInlineActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineDescription.trim() || !user?.company?.id) return;

    try {
      setSavingInline(true);
      const activeUserId = currentUserId || authUser?.id;

      const combinedDueDateTime = inlineDueDate
        ? new Date(`${inlineDueDate}T${inlineDueTime || '12:00'}:00`).toISOString()
        : null;

      const titlesMap: Record<string, string> = {
        email: 'E-mail a enviar',
        ligacao: 'Ligação a fazer',
        whatsapp: 'WhatsApp a enviar',
        proposta: 'Proposta comercial',
        reuniao: 'Reunião agendada',
        visita: 'Visita técnica',
        tarefa: 'Tarefa'
      };

      const title = titlesMap[inlineType] || 'Nova atividade';
      let targetActivityId = editingActivityId;

      if (editingActivityId) {
        const { error: updateErr } = await supabase
          .from('activities')
          .update({
            title,
            description: inlineDescription.trim(),
            activity_type: inlineType,
            priority: inlinePriority,
            due_date: combinedDueDateTime,
            opportunity_id: inlineSelectedOppId || null,
            contact_id: inlineSelectedContactId || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingActivityId);

        if (updateErr) throw updateErr;
        await supabase.from('activity_assignees').delete().eq('activity_id', editingActivityId);
      } else {
        const { data: createdActivity, error: activityErr } = await supabase
          .from('activities')
          .insert({
            company_id: user.company.id,
            created_by: activeUserId,
            title,
            description: inlineDescription.trim(),
            activity_type: inlineType,
            priority: inlinePriority,
            due_date: combinedDueDateTime,
            status: 'pendente',
            completed_at: null,
            opportunity_id: inlineSelectedOppId || null,
            contact_id: inlineSelectedContactId || null
          })
          .select('id')
          .single();

        if (activityErr) throw activityErr;
        targetActivityId = createdActivity.id;
      }

      const finalAssignees = Array.from(new Set([activeUserId, ...inlineSelectedAssignees]));
      if (targetActivityId && finalAssignees.length > 0) {
        const assigneesPayload = finalAssignees.map((profileId) => ({
          activity_id: targetActivityId,
          profile_id: profileId,
          company_id: user.company.id
        }));

        await supabase.from('activity_assignees').insert(assigneesPayload);

        for (const assigneeId of inlineSelectedAssignees) {
          if (assigneeId !== activeUserId) {
            await sendNotification({
              userId: assigneeId,
              companyId: user.company.id,
              title: `📌 ${title} atribuída a você`,
              message: inlineDescription.trim(),
              category: 'assigned_task',
              actionUrl: '/activities',
              entityId: targetActivityId,
              entityType: 'activity'
            });
          }
        }
      }

      handleCloseInline();
      loadActivities();
      window.dispatchEvent(new CustomEvent('activity-updated'));
    } catch (err: any) {
      alert(`Falha ao registrar atividade: ${err.message}`);
    } finally {
      setSavingInline(false);
    }
  };

  const handleCalendarQuickCreate = async (data: {
    description: string;
    dueDate: string;
    dueTime: string;
    activityType: string;
    opportunityId?: string | null;
    contactId?: string | null;
    assigneeIds: string[];
  }) => {
    if (!user?.company?.id) return;

    const activeUserId = currentUserId || authUser?.id;
    const combinedDueDateTime = new Date(`${data.dueDate}T${data.dueTime || '12:00'}:00`).toISOString();

    const titlesMap: Record<string, string> = {
      email: 'E-mail a enviar',
      ligacao: 'Ligação a fazer',
      whatsapp: 'WhatsApp a enviar',
      proposta: 'Proposta comercial',
      reuniao: 'Reunião agendada',
      visita: 'Visita técnica',
      tarefa: 'Tarefa'
    };

    const title = titlesMap[data.activityType] || 'Nova atividade';

    const { data: createdActivity, error: activityErr } = await supabase
      .from('activities')
      .insert({
        company_id: user.company.id,
        created_by: activeUserId,
        title,
        description: data.description,
        activity_type: data.activityType,
        priority: 'media',
        due_date: combinedDueDateTime,
        status: 'pendente',
        completed_at: null,
        opportunity_id: data.opportunityId || null,
        contact_id: data.contactId || null
      })
      .select('id')
      .single();

    if (activityErr) throw activityErr;

    const finalAssignees = Array.from(new Set([activeUserId, ...data.assigneeIds]));
    if (createdActivity?.id && finalAssignees.length > 0) {
      const assigneesPayload = finalAssignees.map((profileId) => ({
        activity_id: createdActivity.id,
        profile_id: profileId,
        company_id: user.company.id
      }));

      await supabase.from('activity_assignees').insert(assigneesPayload);

      for (const assigneeId of data.assigneeIds) {
        if (assigneeId !== activeUserId) {
          await sendNotification({
            userId: assigneeId,
            companyId: user.company.id,
            title: `📌 ${title} agendada para você`,
            message: data.description,
            category: 'assigned_task',
            actionUrl: '/activities',
            entityId: createdActivity.id,
            entityType: 'activity'
          });
        }
      }
    }

    loadActivities();
    window.dispatchEvent(new CustomEvent('activity-updated'));
  };

  const handleOpenContactProfile = (contactId: string) => {
    if (!contactId) return;
    setSelectedContactId(contactId);
    setIsContactModalOpen(true);
  };

  const handleOpenOpportunityDetail = (opportunityId: string) => {
    if (!opportunityId) return;
    setSelectedOpportunityId(opportunityId);
    setIsOpportunityModalOpen(true);
  };

  // Filtragem
  const filteredActivities = useMemo(() => {
    const now = new Date();
    const activeId = currentUserId || (user as any)?.id;

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(startOfToday.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
    const endOfWeek = new Date(startOfWeek.getTime() + 6 * 24 * 60 * 60 * 1000 + 23 * 3600 * 1000 + 3599999);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    return activities.filter((a) => {
      // 1. Acesso
      if (!isAdmin && activeId) {
        const isAuthor = a.created_by === activeId;
        const isAssigned = a.assignees.some((asgn) => asgn.id === activeId);
        if (!isAuthor && !isAssigned) return false;
      }

      // 2. Status
      if (displayMode !== 'kanban') {
        if (activeTab === 'pendentes' && a.status !== 'pendente') return false;
        if (activeTab === 'concluidas' && a.status !== 'concluida') return false;
        if (activeTab === 'atrasadas') {
          const isPending = a.status === 'pendente';
          const isOverdue = a.due_date && new Date(a.due_date) < now;
          if (!isPending || !isOverdue) return false;
        }
      }

      // 3. Tipo
      if (typeFilter !== 'todos' && a.activity_type !== typeFilter) return false;

      // 4. Prioridade
      if (priorityFilter !== 'all' && a.priority !== priorityFilter) return false;

      // 5. Prazo
      if (duePeriodFilter !== 'all') {
        if (!a.due_date) return false;
        const dueDate = new Date(a.due_date);
        if (duePeriodFilter === 'today' && (dueDate < startOfToday || dueDate > endOfToday)) return false;
        if (duePeriodFilter === 'this_week' && (dueDate < startOfWeek || dueDate > endOfWeek)) return false;
        if (duePeriodFilter === 'this_month' && (dueDate < startOfMonth || dueDate > endOfMonth)) return false;
      }

      // 6. Responsável
      if (isAdmin) {
        if (assigneeFilter === 'me') {
          const isUserAssigned = a.assignees.some((assignee) => assignee.id === activeId);
          const isUserCreator = a.created_by === activeId;
          if (!isUserAssigned && !isUserCreator) return false;
        } else if (assigneeFilter !== 'all') {
          const isAssigned = a.assignees.some((assignee) => assignee.id === assigneeFilter);
          if (!isAssigned && a.created_by !== assigneeFilter) return false;
        }
      }

      // 7. Busca textual
      if (searchText.trim()) {
        const term = searchText.toLowerCase();
        const matchTitle = a.title.toLowerCase().includes(term);
        const matchDesc = a.description?.toLowerCase().includes(term);
        const matchOpp = a.opportunity?.title.toLowerCase().includes(term);
        const matchContact = a.contact?.display_name.toLowerCase().includes(term);
        if (!matchTitle && !matchDesc && !matchOpp && !matchContact) return false;
      }

      return true;
    });
  }, [activities, activeTab, typeFilter, priorityFilter, duePeriodFilter, assigneeFilter, searchText, currentUserId, (user as any)?.id, displayMode, isAdmin]);

  const availableTeamMembers = useMemo(() => {
    return teamMembers.filter((m) => {
      const isSelf =
        m.id === currentUserId ||
        m.id === (user as any)?.id ||
        m.name.toLowerCase() === currentUserName.toLowerCase() ||
        ((user as any)?.email && m.email && m.email.toLowerCase() === authUser?.email.toLowerCase());
      return !isSelf;
    });
  }, [teamMembers, currentUserId, (user as any)?.id, currentUserName, (user as any)?.email]);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-50/50 p-3 sm:p-6 lg:p-8 space-y-3.5">
      <div className={`w-full mx-auto space-y-3.5 ${displayMode === 'kanban' ? 'max-w-none' : 'max-w-6xl'}`}>
        
        {/* TOPO: Título + Alternância de Modos */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Atividades</h1>
            {!isAdmin && (
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                Suas tarefas operacionais e compromissos atribuídos.
              </p>
            )}
          </div>

          {/* Seletor de Modo Listagem / Kanban / Calendário */}
          <div className="flex items-center bg-slate-200/80 p-1 rounded-xl shadow-2xs self-start sm:self-auto w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setDisplayMode('list')}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                displayMode === 'list'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List size={14} />
              <span>Listagem</span>
            </button>

            <button
              type="button"
              onClick={() => setDisplayMode('kanban')}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                displayMode === 'kanban'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Columns3 size={14} />
              <span>Kanban</span>
            </button>

            <button
              type="button"
              onClick={() => setDisplayMode('calendar')}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                displayMode === 'calendar'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarIcon size={14} />
              <span>Calendário</span>
            </button>
          </div>
        </div>

        {/* BARRA DE FILTROS RESPONSIVA */}
        <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2.5">
          
          {/* Linha 1: Ícones de Tipo (com scroll lateral touch suave) */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar pb-0.5">
            <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl shrink-0">
              {[
                { id: 'todos', label: 'Todos', icon: CheckSquare },
                { id: 'email', label: 'E-mail', icon: Mail },
                { id: 'ligacao', label: 'Ligação', icon: Phone },
                { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
                { id: 'proposta', label: 'Proposta', icon: FileText },
                { id: 'visita', label: 'Visita', icon: MapPin },
                { id: 'reuniao', label: 'Reunião', icon: Users }
              ].map((t) => {
                const Icon = t.icon;
                const isActive = typeFilter === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTypeFilter(t.id)}
                    title={t.label}
                    className={`p-2 rounded-lg transition-all cursor-pointer shrink-0 ${
                      isActive
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/60'
                    }`}
                  >
                    <Icon size={15} />
                  </button>
                );
              })}
            </div>

            {/* Botão de Toggle para filtros adicionais no mobile */}
            <button
              type="button"
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className={`sm:hidden p-2 rounded-xl border flex items-center gap-1 text-xs font-bold shrink-0 ${
                showMobileFilters || priorityFilter !== 'all' || duePeriodFilter !== 'all' || (isAdmin && assigneeFilter !== 'all')
                  ? 'bg-sky-50 border-sky-300 text-sky-700'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              <SlidersHorizontal size={14} />
              <span>Filtros</span>
            </button>
          </div>

          {/* Linha 2: Abas de Status no modo Listagem */}
          {displayMode !== 'kanban' && (
            <div className="flex items-center bg-slate-100 p-1 rounded-xl overflow-x-auto no-scrollbar">
              {(['todas', 'pendentes', 'atrasadas', 'concluidas'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all capitalize cursor-pointer whitespace-nowrap text-center ${
                    activeTab === tab
                      ? tab === 'atrasadas'
                        ? 'bg-rose-50 text-rose-700 shadow-xs border border-rose-200/60'
                        : 'bg-white text-sky-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab === 'concluidas' ? 'Finalizadas' : tab === 'atrasadas' ? 'Atrasadas' : tab}
                </button>
              ))}
            </div>
          )}

          {/* Linha 3: Busca Textual */}
          <div className="relative w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Buscar por título, nota, contato ou negócio..."
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Linha 4: Filtros Avançados (Grid responsivo, expansível no mobile) */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1 border-t border-slate-100 ${
            showMobileFilters ? 'block' : 'hidden sm:grid'
          }`}>
            {/* Prioridade */}
            <div className="relative">
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full appearance-none pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer shadow-2xs"
              >
                <option value="all">Todas as prioridades</option>
                <option value="alta">🔴 Alta prioridade</option>
                <option value="media">🟡 Média prioridade</option>
                <option value="baixa">🟢 Baixa prioridade</option>
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* Prazo */}
            <div className="relative">
              <select
                value={duePeriodFilter}
                onChange={(e) => setDuePeriodFilter(e.target.value as any)}
                className="w-full appearance-none pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer shadow-2xs"
              >
                <option value="all">Qualquer data</option>
                <option value="today">Vencem hoje</option>
                <option value="this_week">Esta semana</option>
                <option value="this_month">Este mês</option>
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* Responsável (Admin) */}
            {isAdmin && (
              <div className="relative sm:col-span-2 md:col-span-1">
                <select
                  value={assigneeFilter}
                  onChange={(e) => setAssigneeFilter(e.target.value)}
                  className="w-full appearance-none pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer shadow-2xs"
                >
                  <option value="all">Toda a Equipe</option>
                  <option value="me">Eu ({currentUserName.split(' ')[0]})</option>
                  {availableTeamMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            )}
          </div>
        </div>

        {/* BOTÃO + ADICIONAR ATIVIDADE */}
        {displayMode !== 'calendar' && (
          <div className="flex items-center justify-between gap-3 pt-0.5">
            <button
              type="button"
              onClick={() => {
                if (isInlineCreateOpen) {
                  handleCloseInline();
                } else {
                  setIsInlineCreateOpen(true);
                }
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-98 ${
                isInlineCreateOpen
                  ? 'bg-slate-800 text-white'
                  : 'bg-sky-600 hover:bg-sky-500 text-white'
              }`}
            >
              <Plus size={15} className={`transition-transform duration-200 ${isInlineCreateOpen ? 'rotate-45' : ''}`} />
              <span>{isInlineCreateOpen ? 'Fechar' : 'Nova atividade'}</span>
            </button>

            <span className="text-xs text-slate-400 font-medium">
              {filteredActivities.length} {filteredActivities.length === 1 ? 'atividade' : 'atividades'}
            </span>
          </div>
        )}

        {/* PAINEL INLINE DE CRIAÇÃO / EDIÇÃO RESPONSIVO */}
        {displayMode !== 'calendar' && isInlineCreateOpen && (
          <form
            onSubmit={handleSaveInlineActivity}
            className="bg-white rounded-2xl sm:rounded-3xl border border-sky-300 shadow-xl p-3.5 sm:p-5 space-y-3.5 animate-in fade-in duration-200"
          >
            {/* Seletor de Tipo de Atividade */}
            <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-1 shrink-0">
                {[
                  { id: 'email', label: 'E-mail', icon: Mail },
                  { id: 'ligacao', label: 'Ligação', icon: Phone },
                  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
                  { id: 'proposta', label: 'Proposta', icon: FileText },
                  { id: 'reuniao', label: 'Reunião', icon: Users },
                  { id: 'visita', label: 'Visita', icon: MapPin }
                ].map((t) => {
                  const Icon = t.icon;
                  const isSelected = inlineType === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setInlineType(t.id)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        isSelected
                          ? 'bg-sky-50 text-sky-700 border border-sky-200 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <Icon size={13} />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>

              {editingActivityId && (
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 shrink-0">
                  Edição
                </span>
              )}
            </div>

            {/* Descrição */}
            <div>
              <textarea
                required
                rows={3}
                value={inlineDescription}
                onChange={(e) => setInlineDescription(e.target.value)}
                placeholder="O que foi feito e qual o próximo passo?"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white resize-none"
              />
            </div>

            {/* Grade de Campos Adaptável */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
              
              {/* Responsáveis */}
              <div className="relative" ref={assigneeDropdownRef}>
                <label className="block font-semibold text-slate-700 mb-1">Responsáveis</label>
                <div
                  onClick={() => setIsAssigneeDropdownOpen(!isAssigneeDropdownOpen)}
                  className="w-full min-h-[38px] px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl cursor-pointer flex items-center justify-between gap-1 shadow-2xs"
                >
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-900 text-white rounded-md text-[10px] font-bold">
                      Eu ({currentUserName.split(' ')[0]})
                    </span>
                    {inlineSelectedAssignees.map((id) => {
                      const m = teamMembers.find((item) => item.id === id);
                      return (
                        <span key={id} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-sky-100 text-sky-800 rounded-md text-[10px] font-bold">
                          {m?.name.split(' ')[0]}
                          <X
                            size={10}
                            className="hover:text-red-600 cursor-pointer"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setInlineSelectedAssignees((prev) => prev.filter((item) => item !== id));
                            }}
                          />
                        </span>
                      );
                    })}
                  </div>
                  <ChevronDown size={14} className="text-slate-400 shrink-0" />
                </div>

                {isAssigneeDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-48 overflow-y-auto z-50 p-1.5 space-y-0.5">
                    {availableTeamMembers.length === 0 ? (
                      <p className="p-2 text-center text-slate-400 text-xs">Nenhum colega disponível</p>
                    ) : (
                      availableTeamMembers.map((member) => {
                        const isSelected = inlineSelectedAssignees.includes(member.id);
                        return (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() =>
                              setInlineSelectedAssignees((prev) =>
                                isSelected ? prev.filter((id) => id !== member.id) : [...prev, member.id]
                              )
                            }
                            className={`w-full p-2 rounded-xl flex items-center justify-between text-left cursor-pointer text-xs ${
                              isSelected ? 'bg-sky-50 text-sky-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <span>{member.name}</span>
                            {isSelected && <Check size={12} className="text-sky-600" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Onde será criada? */}
              <div className="relative" ref={linkDropdownRef}>
                <label className="block font-semibold text-slate-700 mb-1">Onde será criada?</label>
                <input
                  type="text"
                  value={inlineLinkSearch}
                  onFocus={() => setIsLinkDropdownOpen(true)}
                  onChange={(e) => {
                    setInlineLinkSearch(e.target.value);
                    setIsLinkDropdownOpen(true);
                    if (!e.target.value) {
                      setInlineSelectedOppId(null);
                      setInlineSelectedContactId(null);
                    }
                  }}
                  placeholder="Empresa, pessoa ou negócio..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs font-medium"
                />

                {isLinkDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-52 overflow-y-auto z-50 p-1.5 space-y-0.5">
                    <p className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Oportunidades
                    </p>
                    {oppList
                      .filter((op) => op.title.toLowerCase().includes(inlineLinkSearch.toLowerCase()))
                      .slice(0, 5)
                      .map((op) => (
                        <button
                          key={op.id}
                          type="button"
                          onClick={() => {
                            setInlineSelectedOppId(op.id);
                            setInlineSelectedContactId(null);
                            setInlineLinkSearch(`💼 ${op.title}`);
                            setIsLinkDropdownOpen(false);
                          }}
                          className="w-full p-2 rounded-xl flex items-center gap-2 hover:bg-slate-50 text-left text-xs cursor-pointer text-slate-700"
                        >
                          <Briefcase size={12} className="text-sky-600 shrink-0" />
                          <span className="truncate">{op.title}</span>
                        </button>
                      ))}

                    <div className="border-t border-slate-100 my-1" />

                    <p className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Contatos / Empresas
                    </p>
                    {contactList
                      .filter((c) => c.display_name.toLowerCase().includes(inlineLinkSearch.toLowerCase()))
                      .slice(0, 5)
                      .map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setInlineSelectedContactId(c.id);
                            setInlineSelectedOppId(null);
                            setInlineLinkSearch(`👤 ${c.display_name}`);
                            setIsLinkDropdownOpen(false);
                          }}
                          className="w-full p-2 rounded-xl flex items-center gap-2 hover:bg-slate-50 text-left text-xs cursor-pointer text-slate-700"
                        >
                          {c.type === 'company' ? (
                            <Building2 size={12} className="text-indigo-600 shrink-0" />
                          ) : (
                            <User size={12} className="text-sky-600 shrink-0" />
                          )}
                          <span className="truncate">{c.display_name}</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {/* Prazo */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Prazo / Data</label>
                <input
                  type="date"
                  required
                  value={inlineDueDate}
                  onChange={(e) => setInlineDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500 shadow-2xs"
                />
              </div>

              {/* Horário + Prioridade */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Horário</label>
                  <input
                    type="time"
                    value={inlineDueTime}
                    onChange={(e) => setInlineDueTime(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-sky-500 shadow-2xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Prioridade</label>
                  <select
                    value={inlinePriority}
                    onChange={(e) => setInlinePriority(e.target.value)}
                    className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold focus:ring-2 focus:ring-sky-500 shadow-2xs"
                  >
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Ações do Formulário */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleCloseInline}
                className="px-4 py-2 text-slate-500 hover:text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingInline}
                className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer active:scale-98 disabled:opacity-50"
              >
                {savingInline ? 'Salvando...' : editingActivityId ? 'Salvar Alterações' : 'Salvar'}
              </button>
            </div>
          </form>
        )}

        {/* FEED COM AS 3 VISUALIZAÇÕES */}
        {loading ? (
          <div className="py-24 text-center text-slate-400">
            <Loader2 size={24} className="animate-spin mx-auto mb-2 text-sky-600" />
            Carregando atividades...
          </div>
        ) : displayMode === 'calendar' ? (
          <div className="overflow-x-auto no-scrollbar -mx-3 sm:mx-0">
            <div className="min-w-[650px] sm:min-w-0">
              <ActivitiesCalendarView
                activities={filteredActivities}
                teamMembers={teamMembers}
                currentUserId={currentUserId}
                currentUserName={currentUserName}
                oppList={oppList}
                contactList={contactList}
                onToggleComplete={handleToggleComplete}
                onEditActivity={handleStartEdit}
                onDeleteActivity={(act) => setActivityToDelete(act)}
                onOpenContact={handleOpenContactProfile}
                onOpenOpportunity={handleOpenOpportunityDetail}
                onQuickCreate={handleCalendarQuickCreate}
              />
            </div>
          </div>
        ) : displayMode === 'kanban' ? (
          <div className="overflow-x-auto no-scrollbar -mx-3 sm:mx-0">
            <ActivitiesKanbanView
              activities={filteredActivities}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
              teamMembers={teamMembers}
              onToggleComplete={handleToggleComplete}
              onEditActivity={handleStartEdit}
              onDeleteActivity={(act) => setActivityToDelete(act)}
              onOpenContact={handleOpenContactProfile}
              onOpenOpportunity={handleOpenOpportunityDetail}
              onUpdateActivityDateOrStatus={handleUpdateActivityDateOrStatus}
            />
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-2xl sm:rounded-3xl border-2 border-dashed border-slate-200 p-6 sm:p-8 space-y-2">
            <CheckSquare size={32} className="mx-auto text-slate-300" />
            <h3 className="font-bold text-slate-700 text-sm">Nenhuma atividade encontrada</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Utilize o botão acima para adicionar uma nova atividade à sua rotina operacional e comercial.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 sm:space-y-3">
            {filteredActivities.map((act) => (
              <ActivityCardItem
                key={act.id}
                activity={act}
                currentUserId={currentUserId}
                currentUserName={currentUserName}
                teamMembers={teamMembers}
                onToggleComplete={handleToggleComplete}
                onEdit={handleStartEdit}
                onDelete={(a) => setActivityToDelete(a)}
                onOpenContact={handleOpenContactProfile}
                onOpenOpportunity={handleOpenOpportunityDetail}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal Completo do Perfil do Contato */}
      <div className="relative z-[160]">
        <ContactProfileModal
          contactId={selectedContactId}
          isOpen={isContactModalOpen}
          onClose={() => {
            setIsContactModalOpen(false);
            setSelectedContactId(null);
          }}
          onContactUpdated={loadActivities}
          onNavigateToContact={(targetContactId) => {
            setSelectedContactId(targetContactId);
          }}
          onOpenOpportunity={(oppId) => {
            setSelectedOpportunityId(oppId);
            setIsOpportunityModalOpen(true);
          }}
          onCreateOpportunityForContact={(cId) => {
            setOpportunityContactId(cId);
            setIsCreateOpportunityOpen(true);
          }}
        />
      </div>

      {/* Modal de Detalhes da Oportunidade */}
      {selectedOpportunityId && (
        <div className="relative z-[160]">
          <OpportunityDetailModal
            isOpen={isOpportunityModalOpen}
            opportunityId={selectedOpportunityId}
            onClose={() => {
              setIsOpportunityModalOpen(false);
              setSelectedOpportunityId(null);
            }}
            onUpdated={loadActivities}
          />
        </div>
      )}

      {/* Modal de Criação de Oportunidade */}
      <div className="relative z-[170]">
        <CreateOpportunityModal
          isOpen={isCreateOpportunityOpen}
          initialContactId={opportunityContactId}
          onClose={() => {
            setIsCreateOpportunityOpen(false);
            setOpportunityContactId(null);
          }}
          onSuccess={() => {
            setIsCreateOpportunityOpen(false);
            setOpportunityContactId(null);
            loadActivities();
          }}
        />
      </div>

      {/* Modal Customizado de Confirmação de Exclusão */}
      {activityToDelete && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 max-w-sm w-full shadow-2xl text-center space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <Trash2 size={22} />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-900">Excluir Atividade</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Tem certeza que deseja excluir esta atividade? Esta ação não pode ser desfeita.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setActivityToDelete(null)}
                className="flex-1 py-2 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="flex-1 py-2 px-3 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivitiesView;