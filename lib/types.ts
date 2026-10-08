export interface Mosque {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  phone: string | null;
  email: string | null;
  description: string | null;
  image_url: string | null;
  join_code: string | null;
  created_at: string;
}

export interface Need {
  id: string;
  mosque_id: string;
  name: string;
  description: string | null;
  category: string;
  quantity_needed: number;
  quantity_pledged: number;
  priority: string;
  purchase_link: string | null;
  tokens_per_unit: number;
  type: 'item' | 'money';
  amount_dollars: number | null;
  created_at: string;
  updated_at: string | null;
  archived: boolean;
  archived_at: string | null;
}

export interface Donor {
  id: string;
  email: string;
  name: string;
  token_balance: number;
  is_member: boolean;
  created_at: string;
}

export interface DonorMosqueToken {
  id: string;
  donor_id: string;
  mosque_id: string;
  token_balance: number;
}

export interface Pledge {
  id: string;
  need_id: string;
  donor_id: string;
  donor_name: string;
  donor_email: string;
  quantity: number;
  delivery_method: string | null;
  status: string;
  notes: string | null;
  tokens_earned: number;
  created_at: string;
}

export interface Poll {
  id: string;
  mosque_id: string;
  question: string;
  description: string | null;
  status: string;
  tokens_to_vote: number;
  max_votes_per_person: number;
  closes_at: string | null;
  created_at: string;
  updated_at: string | null;
  archived: boolean;
  archived_at: string | null;
}

export interface PollOption {
  id: string;
  poll_id: string;
  option_text: string;
  created_at: string;
}

export interface Vote {
  id: string;
  donor_id: string;
  poll_id: string;
  option_id: string;
  tokens_spent: number;
  created_at: string;
}

export interface MosqueAccount {
  id: string;
  mosque_id: string;
  email: string;
  password_hash: string;
  is_paid: boolean;
  created_at: string;
}

export interface MosqueMember {
  id: string;
  donor_id: string;
  mosque_id: string;
  joined_at: string;
}

export interface DonorRequest {
  id: string;
  donor_id: string;
  mosque_id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string | null;
  archived: boolean;
  archived_at: string | null;
}

export interface Announcement {
  id: string;
  mosque_id: string;
  title: string;
  body: string | null;
  pinned: boolean;
  archived: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export type UserRole = 'donor' | 'mosque' | null;

export interface AppState {
  role: UserRole;
  donor: Donor | null;
  mosqueAccount: MosqueAccount | null;
  mosqueName: string | null;
  mosqueCity: string | null;
  mosqueState: string | null;
  isPaid: boolean;
  isAdmin: boolean;
}
