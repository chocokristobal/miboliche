import { inferCategory } from "@/lib/categories";

type OpenProduct = {
  product_name?: string;
  product_name_es?: string;
  abbreviated_product_name?: string;
  brands?: string;
  quantity?: string;
  categories_tags?: string[];
};

type OpenProductResponse = {
  status?: number;
  product?: OpenProduct;
};

const SOURCES = [
  { host: "world.openfoodfacts.org", label: "Open Food Facts" },
  { host: "world.openbeautyfacts.org", label: "Open Beauty Facts" },
  { host: "world.openproductsfacts.org", label: "Open Products Facts" },
];

const clean = (value?: string) => value?.replace(/\s+/g, " ").trim() || "";

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const barcode = code.replace(/\D/g, "");

  if (barcode.length < 8 || barcode.length > 14) {
    return Response.json({ error: "Código de barras inválido" }, { status: 400 });
  }

  for (const source of SOURCES) {
    try {
      const fields = [
        "product_name",
        "product_name_es",
        "abbreviated_product_name",
        "brands",
        "quantity",
        "categories_tags",
      ].join(",");
      const response = await fetch(
        `https://${source.host}/api/v2/product/${barcode}?fields=${fields}`,
        {
          headers: {
            Accept: "application/json",
            "User-Agent": "MiBoliche/1.0 (https://www.miboliche.cl)",
          },
          cf: { cacheTtl: 86400, cacheEverything: true },
        } as RequestInit,
      );

      if (!response.ok) continue;
      const result = await response.json() as OpenProductResponse;
      const product = result.product;
      const baseName = clean(
        product?.product_name_es ||
        product?.product_name ||
        product?.abbreviated_product_name,
      );
      if (!product || !baseName) continue;

      const brand = clean(product.brands);
      const quantity = clean(product.quantity);
      const name = [brand, baseName, quantity].filter(Boolean).join(" · ");

      return Response.json(
        {
          barcode,
          name,
          brand: brand || undefined,
          quantity: quantity || undefined,
          category: inferCategory(product.categories_tags || [], name),
          source: source.label,
        },
        {
          headers: {
            "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
          },
        },
      );
    } catch {
      // Try the next open catalogue.
    }
  }

  return Response.json(
    { error: "Producto no encontrado" },
    {
      status: 404,
      headers: { "Cache-Control": "public, max-age=3600" },
    },
  );
}
