import type { SupabaseClient } from "@supabase/supabase-js";

export type BusinessProfile = {
  businessId: string;
  businessName: string;
  businessType: string;
  administratorName: string;
  rut: string;
  phone: string;
  address: string;
  commune: string;
  region: string;
  weeklyGoal: number;
};

export type AdminBusiness = {
  id: string;
  name: string;
  ownerName: string;
  ownerEmail: string;
  rut: string;
  phone: string;
  address: string;
  commune: string;
  region: string;
  businessType: string;
  plan: string;
  monthlyFee: number;
  paymentState: "paid" | "late" | "unpaid";
  accountStatus:
    | "trialing"
    | "active"
    | "past_due"
    | "grace_period"
    | "suspended"
    | "canceled"
    | "archived";
  dueDate?: string;
  graceEndsAt?: string;
  lastPayment?: string;
  registeredAt?: string;
  users: number;
  products: number;
  sales: number;
  salesVolume: number;
  lastSaleAt?: string;
  notes: string;
};

export type SupportTicket = {
  id: string;
  businessId: string;
  businessName: string;
  requesterEmail: string;
  subject: string;
  description: string;
  priority: "low" | "medium" | "high";
  status: "new" | "in_progress" | "resolved" | "closed";
  adminResponse: string;
  createdAt: string;
  updatedAt: string;
};

type BusinessProfileRow = {
  business_id: string;
  business_name: string;
  business_type: string | null;
  administrator_name: string | null;
  rut: string | null;
  phone: string | null;
  address: string | null;
  commune: string | null;
  region: string | null;
  weekly_goal: number | string;
};

type CurrentBusinessRow = {
  business_id: string;
  business_name: string;
  created_now: boolean;
};

type AdminBusinessRow = {
  business_id: string;
  business_name: string;
  owner_name: string | null;
  owner_email: string | null;
  rut: string | null;
  phone: string | null;
  address: string | null;
  commune: string | null;
  region: string | null;
  business_type: string | null;
  plan_name: string | null;
  monthly_fee: number | string | null;
  payment_state: AdminBusiness["paymentState"];
  account_status: AdminBusiness["accountStatus"];
  due_date: string | null;
  grace_ends_at: string | null;
  last_payment: string | null;
  registered_at: string | null;
  user_count: number | string | null;
  product_count: number | string | null;
  sale_count: number | string | null;
  sales_volume: number | string | null;
  last_sale_at: string | null;
  notes: string | null;
};

const mapProfile = (row: BusinessProfileRow): BusinessProfile => ({
  businessId: row.business_id,
  businessName: row.business_name,
  businessType: row.business_type || "Minimarket",
  administratorName: row.administrator_name || "",
  rut: row.rut || "",
  phone: row.phone || "",
  address: row.address || "",
  commune: row.commune || "",
  region: row.region || "Metropolitana",
  weeklyGoal: Number(row.weekly_goal) || 1_000_000,
});

export async function ensureCurrentUserBusiness(
  client: SupabaseClient,
): Promise<{ id: string; name: string; createdNow: boolean } | null> {
  const { data, error } = await client.rpc("ensure_current_user_business");
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as CurrentBusinessRow | undefined;
  if (!row?.business_id) return null;
  return {
    id: row.business_id,
    name: row.business_name || "Mi negocio",
    createdNow: Boolean(row.created_now),
  };
}

export async function getBusinessProfile(
  client: SupabaseClient,
  businessId: string,
): Promise<BusinessProfile> {
  const { data, error } = await client.rpc("get_business_profile", {
    p_business_id: businessId,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as BusinessProfileRow;
  if (!row) throw new Error("No se encontró la ficha del negocio.");
  return mapProfile(row);
}

export async function saveBusinessProfile(
  client: SupabaseClient,
  profile: BusinessProfile,
): Promise<BusinessProfile> {
  const { data, error } = await client.rpc("update_business_profile", {
    p_business_id: profile.businessId,
    p_business_name: profile.businessName,
    p_business_type: profile.businessType,
    p_administrator_name: profile.administratorName,
    p_rut: profile.rut,
    p_phone: profile.phone,
    p_address: profile.address,
    p_commune: profile.commune,
    p_region: profile.region,
    p_weekly_goal: profile.weeklyGoal,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as BusinessProfileRow;
  if (!row) throw new Error("Supabase no devolvió la ficha actualizada.");
  return mapProfile(row);
}

export async function saveWeeklyGoal(
  client: SupabaseClient,
  businessId: string,
  weeklyGoal: number,
): Promise<number> {
  const { data, error } = await client.rpc("update_weekly_goal", {
    p_business_id: businessId,
    p_weekly_goal: weeklyGoal,
  });
  if (error) throw error;
  const savedGoal = Number(data);
  if (!Number.isFinite(savedGoal)) {
    throw new Error("Supabase no devolvió la meta semanal actualizada.");
  }
  return savedGoal;
}

export async function getCurrentAccountRole(
  client: SupabaseClient,
): Promise<"client" | "admin"> {
  const { data, error } = await client.rpc("current_user_account_role");
  if (error) throw error;
  return data === "admin" ? "admin" : "client";
}

export async function listAdminBusinesses(
  client: SupabaseClient,
): Promise<AdminBusiness[]> {
  const { data, error } = await client.rpc("admin_list_businesses");
  if (error) throw error;
  return ((data || []) as AdminBusinessRow[]).map((row) => ({
    id: row.business_id,
    name: row.business_name,
    ownerName: row.owner_name || "Sin nombre",
    ownerEmail: row.owner_email || "",
    rut: row.rut || "",
    phone: row.phone || "",
    address: row.address || "",
    commune: row.commune || "",
    region: row.region || "",
    businessType: row.business_type || "Minimarket",
    plan: row.plan_name || "Sin plan",
    monthlyFee: Number(row.monthly_fee) || 0,
    paymentState: row.payment_state || "unpaid",
    accountStatus: row.account_status || "trialing",
    dueDate: row.due_date || undefined,
    graceEndsAt: row.grace_ends_at || undefined,
    lastPayment: row.last_payment || undefined,
    registeredAt: row.registered_at || undefined,
    users: Number(row.user_count) || 0,
    products: Number(row.product_count) || 0,
    sales: Number(row.sale_count) || 0,
    salesVolume: Number(row.sales_volume) || 0,
    lastSaleAt: row.last_sale_at || undefined,
    notes: row.notes || "",
  }));
}

export async function updateAdminBusinessAccount(
  client: SupabaseClient,
  businessId: string,
  planName: string,
  monthlyFee: number,
  accountStatus: AdminBusiness["accountStatus"],
  paymentState: AdminBusiness["paymentState"],
  dueDate: string | null,
  lastPayment: string | null,
  reason: string,
): Promise<void> {
  const { error } = await client.rpc("admin_manage_subscription", {
    p_business_id: businessId,
    p_plan_name: planName,
    p_monthly_fee: monthlyFee,
    p_account_status: accountStatus,
    p_payment_state: paymentState,
    p_due_date: dueDate,
    p_last_payment: lastPayment,
    p_reason: reason,
  });
  if (error) throw error;
}

export async function addBusinessMember(
  client: SupabaseClient,
  businessId: string,
  email: string,
  role: "manager" | "seller",
): Promise<void> {
  const { error } = await client.rpc("manage_business_member", {
    p_business_id: businessId,
    p_email: email,
    p_role: role,
  });
  if (error) throw error;
}

export async function createSupportTicket(
  client: SupabaseClient,
  businessId: string,
  subject: string,
  description: string,
  priority: SupportTicket["priority"],
): Promise<void> {
  const { error } = await client.rpc("create_support_ticket", {
    p_business_id: businessId,
    p_subject: subject,
    p_description: description,
    p_priority: priority,
  });
  if (error) throw error;
}

export async function listAdminSupportTickets(
  client: SupabaseClient,
): Promise<SupportTicket[]> {
  const { data, error } = await client.rpc("admin_list_support_tickets");
  if (error) throw error;
  return (data || []).map((row: Record<string, unknown>) => ({
    id: String(row.ticket_id),
    businessId: String(row.business_id),
    businessName: String(row.business_name || "Sin negocio"),
    requesterEmail: String(row.requester_email || ""),
    subject: String(row.subject || ""),
    description: String(row.description || ""),
    priority: row.priority as SupportTicket["priority"],
    status: row.status as SupportTicket["status"],
    adminResponse: String(row.admin_response || ""),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }));
}

export async function updateSupportTicket(
  client: SupabaseClient,
  ticketId: string,
  status: SupportTicket["status"],
  response: string,
): Promise<void> {
  const { error } = await client.rpc("admin_update_support_ticket", {
    p_ticket_id: ticketId,
    p_status: status,
    p_response: response,
  });
  if (error) throw error;
}
