export type Role = "student" | "admin";
export type UserStatus = "pending" | "approved" | "rejected";
export type RequestStatus = "pending" | "approved" | "rejected" | "returned";

export interface Profile {
  id: string;
  full_name: string;
  student_id: string;
  email: string;
  phone: string | null;
  department: string;
  year: number;
  role: Role;
  status: UserStatus;
  created_at: string;
}

export interface Item {
  id: string;
  name: string;
  category: string;
  sku: string | null;
  location: string | null;
  condition: string;
  total_qty: number;
  available_qty: number;
  low_stock_threshold: number;
  notes: string | null;
  updated_at: string;
}

export interface RequestLine {
  item_id: string;
  qty: number;
  lost_qty: number;
  items: Pick<Item, "id" | "name" | "category" | "available_qty"> | null;
}

export interface BorrowRequest {
  id: string;
  student_id: string;
  project: string;
  purpose: string | null;
  due_date: string;
  letter_path: string | null;
  status: RequestStatus;
  admin_note: string | null;
  reviewed_at: string | null;
  returned_at: string | null;
  created_at: string;
  profiles?: Pick<Profile, "full_name" | "student_id" | "email" | "phone" | "department" | "year"> | null;
  request_items?: RequestLine[];
}

export interface Settings {
  checkin_day: number;
  checkin_notice_days: number;
  due_soon_days: number;
  last_checkin_at: string | null;
}

export function isLowStock(item: Pick<Item, "available_qty" | "low_stock_threshold">) {
  return item.available_qty <= item.low_stock_threshold;
}
