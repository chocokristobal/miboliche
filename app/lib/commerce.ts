import type { SupabaseClient } from "@supabase/supabase-js";
import type { Product } from "./products";

export type PaymentMethod = "Efectivo" | "Tarjeta" | "Transferencia";

export type SaleItem = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
};

export type Sale = {
  id: string;
  date: string;
  items: SaleItem[];
  payment: PaymentMethod;
  status: "completed" | "voided";
  voidReason?: string;
  voidedAt?: string;
};

export type Expense = {
  id: string;
  label: string;
  amount: number;
  date: string;
  category?: string;
};

export type CashClosure = {
  id: string;
  businessDate: string;
  openingCash: number;
  cashSales: number;
  otherCashIn: number;
  cashOut: number;
  expectedCash: number;
  countedCash: number;
  difference: number;
  note?: string;
  closedAt: string;
};

type SupabaseErrorLike = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
};

type SaleItemRow = {
  product_id: string;
  product_name: string;
  quantity: number | string;
  unit_price: number | string;
  unit_cost: number | string;
};

type SaleRow = {
  id: string;
  payment_method: string;
  sold_at: string | null;
  created_at: string;
  status?: "completed" | "voided";
  void_reason?: string | null;
  voided_at?: string | null;
  sale_items: SaleItemRow[] | null;
};

type ExpenseRow = {
  id: string;
  description: string;
  category: string | null;
  amount: number | string;
  created_at: string;
};

type CashClosureRow = {
  id: string;
  business_date: string;
  opening_cash: number | string;
  cash_sales: number | string;
  other_cash_in: number | string;
  cash_out: number | string;
  expected_cash: number | string;
  counted_cash: number | string;
  difference: number | string;
  note: string | null;
  closed_at: string;
};

const paymentFromDatabase = (value: string): PaymentMethod => {
  if (value === "card" || value.toLocaleLowerCase("es").includes("tarjeta")) return "Tarjeta";
  if (value === "transfer" || value.toLocaleLowerCase("es").includes("transfer")) return "Transferencia";
  return "Efectivo";
};

const paymentToDatabase = (value: PaymentMethod) => {
  if (value === "Tarjeta") return "card";
  if (value === "Transferencia") return "transfer";
  return "cash";
};

export function saleErrorMessage(error: unknown): string {
  const problem =
    error && typeof error === "object"
      ? (error as SupabaseErrorLike)
      : {};
  const message = (problem.message || "").toLocaleLowerCase("es");

  if (message.includes("stock insuficiente")) {
    return problem.message || "No hay stock suficiente para completar la venta.";
  }
  if (message.includes("producto no encontrado")) {
    return "Uno de los productos ya no está disponible. Actualiza la venta e inténtalo nuevamente.";
  }
  if (
    message.includes("debes iniciar sesión") ||
    problem.code === "PGRST301"
  ) {
    return "Tu sesión venció. Vuelve a iniciar sesión antes de registrar la venta.";
  }
  if (message.includes("negocio no está habilitado")) {
    return "Este negocio no está habilitado para registrar ventas. Revisa el estado de su cuenta.";
  }
  if (
    problem.code === "PGRST202" ||
    message.includes("schema cache") ||
    message.includes("could not find the function")
  ) {
    return "La función de ventas aún no está disponible en Supabase. Recarga la página e inténtalo nuevamente.";
  }
  if (message.includes("regla de integridad")) {
    return problem.message || "Una regla de integridad rechazó la venta.";
  }
  if (problem.code === "23514") {
    const diagnosticText = [
      problem.message,
      problem.details,
      problem.hint,
    ]
      .filter(Boolean)
      .join(" ");
    const constraint = diagnosticText.match(/constraint\s+"([^"]+)"/i)?.[1];
    const rule = constraint ? ` Regla: ${constraint}.` : "";
    return `Una regla de integridad de Supabase rechazó la venta. No se registró ni se descontó stock.${rule} Código: 23514.`;
  }

  const reference = problem.code ? ` Código: ${problem.code}.` : "";
  return `Supabase rechazó la venta y no se descontó stock.${reference}`;
}

export async function listSales(
  client: SupabaseClient,
  businessId: string,
): Promise<Sale[]> {
  let { data, error } = await client
    .from("sales")
    .select(`
      id,
      payment_method,
      sold_at,
      created_at,
      status,
      void_reason,
      voided_at,
      sale_items (
        product_id,
        product_name,
        quantity,
        unit_price,
        unit_cost
      )
    `)
    .eq("business_id", businessId)
    .order("sold_at", { ascending: false })
    .limit(500);

  if (error && (error.code === "42703" || error.message.toLowerCase().includes("void_reason"))) {
    const legacyResult = await client
      .from("sales")
      .select(`
        id,
        payment_method,
        sold_at,
        created_at,
        status,
        sale_items (
          product_id,
          product_name,
          quantity,
          unit_price,
          unit_cost
        )
      `)
      .eq("business_id", businessId)
      .order("sold_at", { ascending: false })
      .limit(500);
    data = legacyResult.data;
    error = legacyResult.error;
  }

  if (error) throw error;
  return ((data || []) as SaleRow[]).map((sale) => ({
    id: sale.id,
    date: sale.sold_at || sale.created_at,
    payment: paymentFromDatabase(sale.payment_method),
    status: sale.status || "completed",
    voidReason: sale.void_reason || undefined,
    voidedAt: sale.voided_at || undefined,
    items: (sale.sale_items || []).map((item) => ({
      productId: item.product_id,
      name: item.product_name,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unit_price),
      unitCost: Number(item.unit_cost),
    })),
  }));
}

export async function listCashClosures(
  client: SupabaseClient,
  businessId: string,
): Promise<CashClosure[]> {
  const { data, error } = await client
    .from("cash_closures")
    .select("id,business_date,opening_cash,cash_sales,other_cash_in,cash_out,expected_cash,counted_cash,difference,note,closed_at")
    .eq("business_id", businessId)
    .order("business_date", { ascending: false })
    .limit(60);

  if (error) throw error;
  return ((data || []) as CashClosureRow[]).map((closure) => ({
    id: closure.id,
    businessDate: closure.business_date,
    openingCash: Number(closure.opening_cash),
    cashSales: Number(closure.cash_sales),
    otherCashIn: Number(closure.other_cash_in),
    cashOut: Number(closure.cash_out),
    expectedCash: Number(closure.expected_cash),
    countedCash: Number(closure.counted_cash),
    difference: Number(closure.difference),
    note: closure.note || undefined,
    closedAt: closure.closed_at,
  }));
}

export async function listExpenses(
  client: SupabaseClient,
  businessId: string,
): Promise<Expense[]> {
  const { data, error } = await client
    .from("expenses")
    .select("id,description,category,amount,created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw error;
  return ((data || []) as ExpenseRow[]).map((expense) => ({
    id: expense.id,
    label: expense.description,
    category: expense.category || undefined,
    amount: Number(expense.amount),
    date: expense.created_at,
  }));
}

export async function createExpense(
  client: SupabaseClient,
  userId: string,
  businessId: string,
  expense: { description: string; category: string; amount: number },
): Promise<Expense> {
  const { data, error } = await client
    .from("expenses")
    .insert({
      business_id: businessId,
      created_by: userId,
      description: expense.description.trim(),
      category: expense.category,
      amount: expense.amount,
    })
    .select("id,description,category,amount,created_at")
    .single();

  if (error) throw error;
  const row = data as ExpenseRow;
  return {
    id: row.id,
    label: row.description,
    category: row.category || undefined,
    amount: Number(row.amount),
    date: row.created_at,
  };
}

export async function registerSale(
  client: SupabaseClient,
  businessId: string,
  payment: PaymentMethod,
  items: Array<{ product: Product; quantity: number }>,
): Promise<string> {
  const { data, error } = await client.rpc("register_sale", {
    p_business_id: businessId,
    p_payment_method: paymentToDatabase(payment),
    p_items: items.map(({ product, quantity }) => ({
      product_id: product.id,
      quantity,
    })),
  });

  if (error) throw error;
  return String(data);
}

export async function voidSale(
  client: SupabaseClient,
  businessId: string,
  saleId: string,
  reason: string,
): Promise<void> {
  const { error } = await client.rpc("void_sale", {
    p_business_id: businessId,
    p_sale_id: saleId,
    p_reason: reason.trim(),
  });

  if (error) throw error;
}

export async function closeCashDay(
  client: SupabaseClient,
  businessId: string,
  values: {
    businessDate: string;
    openingCash: number;
    otherCashIn: number;
    cashOut: number;
    countedCash: number;
    note: string;
  },
): Promise<CashClosure> {
  const { data, error } = await client
    .rpc("close_cash_day", {
      p_business_id: businessId,
      p_business_date: values.businessDate,
      p_opening_cash: values.openingCash,
      p_other_cash_in: values.otherCashIn,
      p_cash_out: values.cashOut,
      p_counted_cash: values.countedCash,
      p_note: values.note.trim(),
    })
    .single();

  if (error) throw error;
  const closure = data as CashClosureRow;
  return {
    id: closure.id,
    businessDate: closure.business_date,
    openingCash: Number(closure.opening_cash),
    cashSales: Number(closure.cash_sales),
    otherCashIn: Number(closure.other_cash_in),
    cashOut: Number(closure.cash_out),
    expectedCash: Number(closure.expected_cash),
    countedCash: Number(closure.counted_cash),
    difference: Number(closure.difference),
    note: closure.note || undefined,
    closedAt: closure.closed_at,
  };
}
