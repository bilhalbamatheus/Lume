export interface WorkTask {
  id: string;
  work_item_id: string;
  title: string;
  description?: string | null;
  executed_by?: string[] | null;
  status: 'pendente' | 'em_andamento' | 'bloqueada' | 'concluida';
  has_progress_tracking: boolean;
  quantity_planned: number;
  quantity_executed: number;
  unit: string;
  unit_price: number;
  is_measured: boolean;
  weight: number;
  start_date?: string | null;
  due_date?: string | null;
  completed_at?: string | null;
  depends_on_task_id?: string | null;
}

export interface WorkItem {
  id: string;
  parent_id?: string | null;
  template_item_id?: string | null;
  code: string | null;
  title: string;
  description?: string | null;
  location?: string | null;
  unit_price: number;
  weight: number;
  progress_percent: number;
  status: 'nao_iniciado' | 'em_andamento' | 'bloqueado' | 'concluido';
  start_date?: string | null;
  due_date?: string | null;
  depends_on_item_id?: string | null;
  tasks?: WorkTask[];
  children?: WorkItem[];
}

export interface TeamMember {
  id: string;
  name: string;
  role?: string;
  avatar_url?: string | null;
}

export interface UserProfile {
  id: string;
  full_name: string;
  email?: string | null;
  avatar_url?: string | null;
}

export interface ContactEntity {
  id: string;
  display_name: string;
  type: 'person' | 'company';
  avatar_url?: string | null;
  code?: string | null;
  document?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface WorkData {
  id: string;
  code: string | null;
  title: string;
  stage: string;
  status: string;
  contact_id: string;
  opportunity_id?: string | null;
  template_id: string | null;
  measurement_type: 'por_subitem' | 'por_item' | 'sem_medicao';
  assigned_to: string | null;
  start_date: string | null;
  estimated_completion_date: string | null;
  actual_completion_date: string | null;
  progress_percent: number;
  notes: string | null;
  contact?: ContactEntity;
  assignee?: UserProfile;
  template?: { id: string; name: string; measurement_type: string };
  opportunity?: {
    id: string;
    code?: string | null;
    title: string;
    assigned_to?: string | null;
    final_value?: number | null;
    commercial_agent?: UserProfile;
    selected_quote?: {
      id: string;
      code?: string | null;
      quote_number?: number;
      title: string;
      total_value: number;
    } | null;
  } | null;
}
