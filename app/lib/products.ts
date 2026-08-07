import type { SupabaseClient } from "@supabase/supabase-js";

export type Product = {
  id: string;
  name: string;
  category: string;
  barcode: string;
  cost: number;
  price: number;
  stock: number;
  minStock: number;
  expiry?: string;
};

type ProductRow = {
  id: string;
  name: string;
  category: string | null;
  barcode: string | null;
  purchase_price: number | string;
  sale_price: number | string;
  current_stock: number | string;
  minimum_stock: number | string;
  expires_on: string | null;
};

export type NewProduct = Omit<Product, "id">;

export type InventoryMovement = {
  id: string;
  productId: string;
  movementType: "in" | "out" | "adjustment_in" | "adjustment_out";
  quantity: number;
  reason: string;
  createdAt: string;
  referenceSaleId?: string;
};

type InventoryMovementRow = {
  id: string;
  product_id: string;
  movement_type: InventoryMovement["movementType"];
  quantity: number | string;
  reason: string | null;
  created_at: string;
  reference_sale_id: string | null;
};

const PRODUCT_COLUMNS = [
  "id",
  "name",
  "category",
  "barcode",
  "purchase_price",
  "sale_price",
  "current_stock",
  "minimum_stock",
  "expires_on",
].join(",");

const fromRow = (row: ProductRow): Product => ({
  id: row.id,
  name: row.name,
  category: row.category || "Sin categoría",
  barcode: row.barcode || "",
  cost: Number(row.purchase_price),
  price: Number(row.sale_price),
  stock: Number(row.current_stock),
  minStock: Number(row.minimum_stock),
  expiry: row.expires_on || undefined,
});

export async function listProducts(client: SupabaseClient, businessId: string): Promise<Product[]> {
  const { data, error } = await client
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("business_id", businessId)
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data || []) as unknown as ProductRow[]).map(fromRow);
}

export async function listInventoryMovements(
  client: SupabaseClient,
  businessId: string,
): Promise<InventoryMovement[]> {
  const { data, error } = await client
    .from("inventory_movements")
    .select("id,product_id,movement_type,quantity,reason,created_at,reference_sale_id")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;
  return ((data || []) as InventoryMovementRow[]).map((movement) => ({
    id: movement.id,
    productId: movement.product_id,
    movementType: movement.movement_type,
    quantity: Number(movement.quantity),
    reason: movement.reason || "Movimiento de inventario",
    createdAt: movement.created_at,
    referenceSaleId: movement.reference_sale_id || undefined,
  }));
}

export async function createProduct(
  client: SupabaseClient,
  businessId: string,
  product: NewProduct,
): Promise<Product> {
  const { data, error } = await client
    .from("products")
    .insert({
      business_id: businessId,
      name: product.name.trim(),
      category: product.category.trim(),
      barcode: product.barcode.trim() || null,
      purchase_price: product.cost,
      sale_price: product.price,
      current_stock: product.stock,
      minimum_stock: product.minStock,
      expires_on: product.expiry || null,
      active: true,
    })
    .select(PRODUCT_COLUMNS)
    .single();

  if (error) throw error;
  return fromRow(data as unknown as ProductRow);
}

export async function importProducts(
  client: SupabaseClient,
  businessId: string,
  products: NewProduct[],
): Promise<Product[]> {
  const rows = products.map((product) => ({
    business_id: businessId,
    name: product.name.trim(),
    category: product.category.trim(),
    barcode: product.barcode.trim() || null,
    purchase_price: product.cost,
    sale_price: product.price,
    current_stock: product.stock,
    minimum_stock: product.minStock,
    expires_on: product.expiry || null,
    active: true,
  }));
  const imported: Product[] = [];

  for (let index = 0; index < rows.length; index += 250) {
    const { data, error } = await client
      .from("products")
      .insert(rows.slice(index, index + 250))
      .select(PRODUCT_COLUMNS);
    if (error) throw error;
    imported.push(...((data || []) as unknown as ProductRow[]).map(fromRow));
  }
  return imported;
}

export async function updateProduct(
  client: SupabaseClient,
  businessId: string,
  productId: string,
  product: NewProduct,
): Promise<Product> {
  const { data, error } = await client
    .from("products")
    .update({
      name: product.name.trim(),
      category: product.category.trim(),
      barcode: product.barcode.trim() || null,
      purchase_price: product.cost,
      sale_price: product.price,
      minimum_stock: product.minStock,
      expires_on: product.expiry || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId)
    .eq("business_id", businessId)
    .select(PRODUCT_COLUMNS)
    .single();

  if (error) throw error;
  return fromRow(data as unknown as ProductRow);
}

export async function addProductStock(
  client: SupabaseClient,
  userId: string,
  businessId: string,
  product: Product,
  quantity: number,
): Promise<Product> {
  const { error: movementError } = await client.from("inventory_movements").insert({
    business_id: businessId,
    product_id: product.id,
    created_by: userId,
    movement_type: "in",
    quantity,
    reason: "Reposición de inventario",
  });

  if (movementError) throw movementError;

  const { data, error } = await client
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("id", product.id)
    .eq("business_id", businessId)
    .single();

  if (error) throw error;
  return fromRow(data as unknown as ProductRow);
}

export async function setProductStock(
  client: SupabaseClient,
  businessId: string,
  product: Product,
  newStock: number,
  reason: string,
): Promise<Product> {
  const { error: movementError } = await client.rpc("adjust_inventory_stock", {
    p_business_id: businessId,
    p_product_id: product.id,
    p_new_stock: newStock,
    p_reason: reason.trim(),
  });

  if (movementError) throw movementError;

  const { data, error } = await client
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("id", product.id)
    .eq("business_id", businessId)
    .single();

  if (error) throw error;
  return fromRow(data as unknown as ProductRow);
}
