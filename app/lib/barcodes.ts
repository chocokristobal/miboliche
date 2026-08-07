export type BarcodeProduct = {
  barcode: string;
  name: string;
  brand?: string;
  quantity?: string;
  category: string;
  source: string;
};

export const normalizeBarcode = (value: string) => value.replace(/\D/g, "").slice(0, 14);

export const isLookupBarcode = (value: string) => {
  const normalized = normalizeBarcode(value);
  return normalized.length >= 8 && normalized.length <= 14;
};

export async function lookupBarcode(barcode: string): Promise<BarcodeProduct | null> {
  const normalized = normalizeBarcode(barcode);
  if (!isLookupBarcode(normalized)) return null;

  const response = await fetch(`/api/barcode/${normalized}`, {
    headers: { Accept: "application/json" },
  });

  if (response.status === 404) return null;
  if (!response.ok) throw new Error("barcode_lookup_failed");
  return response.json() as Promise<BarcodeProduct>;
}
