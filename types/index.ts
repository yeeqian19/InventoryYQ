// ============================================
// SHARED TYPE DEFINITIONS
// ============================================

// --- User & Auth Types ---
export type UserRole = 'SUPERADMIN' | 'ADMIN_HQ' | 'USER_RM' | 'USER_BM';
export const ALL_ROLES: UserRole[] = ['SUPERADMIN', 'ADMIN_HQ', 'USER_RM', 'USER_BM'];

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  branch_name?: string;
}

// --- Inventory Types ---
export interface InventoryItem {
  student_id: number;
  doc_no?: string | null;
  doc_date?: Date | null;
  branch_code?: string | null;
  student_name?: string | null;
  package?: string | null;
  type?: string | null;
  sk_prep?: boolean;
  sk_prep_date?: Date | null;
  eg_prep?: boolean;
  eg_prep_date?: Date | null;
  bm_pickup?: boolean;
  bm_pickup_date?: Date | null;
  bm_pickup_photo?: string | null;
  student_received?: boolean;
  student_received_date?: Date | null;
  barcode_sk?: string | null;
  barcode_eg?: string | null;
  proof_photo?: string | null;
  remark?: string | null;
}

// --- Serialized Inventory (for client components) ---
export interface SerializedInventoryItem {
  student_id: string;
  name: string;
  branch: string;
  sk_prep: boolean;
  eg_prep: boolean;
  bm_pickup: boolean;
  student_received: boolean;
  type: string;
  package: string;
  hasSK: boolean;
  hasEG: boolean;
  giftType: string | null;
  created_at?: string;
}

// --- Branch Types ---
export type Region = 'A' | 'B' | 'C' | 'HQ';

export interface Branch {
  code: string;
  name: string;
  region: Region;
}

// --- API Request/Response Types ---
export interface ScanRequestBody {
  barcode: string;
  station?: number;
}

export interface ScanResponse {
  success?: boolean;
  message?: string;
  student_name?: string;
  station?: number;
  photoSaved?: boolean;
  itemType?: string;
  branch?: string;
  error?: string;
}

export interface BmPickupRequestBody {
  base64Data: string;
  barcode: string;
  branchCode: string;
}

export interface HandoverRequestBody {
  base64Data: string;
  barcode: string;
  studentName: string;
  branchCode: string;
}

export interface ApiError {
  error: string;
}

// --- Scan Log Types ---
export type ActionType = 'PREPARED' | 'PICKED UP' | 'RECEIVED';
export type ItemType = 'SK' | 'EG';

export interface ScanLogEntry {
  id?: string;
  timestamp?: Date;
  doc_no?: string | null;
  barcode: string;
  student_name: string;
  item_type: ItemType;
  branch: string;
  action_type: ActionType;
  processed_by: string;
}

// --- Stock Management Types ---
export interface StockItem {
  id: number;
  name: string;
  count: number;
  threshold: number;
  link?: string | null;
  isKitItem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// --- Dashboard Stats Types ---
export interface BranchStats {
  name: string;
  code: string;
  region: Region;
  prepared: number;
  pickup: number;
  received: number;
  total: number;
  list: SerializedInventoryItem[];
}

// --- Form/Filter Types ---
export interface DateFilter {
  quickDate: string;
  startDate: string;
  endDate: string;
}

export interface SearchFilter {
  searchTerm: string;
  appliedSearchTerm: string;
  appliedStartDate: string;
  appliedEndDate: string;
}