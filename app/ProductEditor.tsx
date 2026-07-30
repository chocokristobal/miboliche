"use client";

import { Camera, Check, PackagePlus, Search, X } from "lucide-react";
import { FormEvent, useCallback, useState } from "react";
import BarcodeScanner from "./BarcodeScanner";
import { lookupBarcode, normalizeBarcode } from "./lib/barcodes";
import {
  ALL_CATEGORIES,
  CATEGORY_GROUPS,
  categoryDisplayName,
} from "./lib/categories";
import type { NewProduct, Product } from "./lib/products";

type ProductEditorProps = {
  busy: boolean;
  existingProducts: Product[];
  product?: Product | null;
  onClose: () => void;
  onCreate: (product: NewProduct) => Promise<void>;
  onUpdate: (product: Product, changes: NewProduct) => Promise<void>;
  onEditExisting: (product: Product) => void;
};

type Draft = {
  name: string;
  category: string;
  barcode: string;
  cost: string;
  price: string;
  stock: string;
  minStock: string;
  expiry: string;
};

const blankDraft: Draft = {
  name: "",
  category: "",
  barcode: "",
  cost: "",
  price: "",
  stock: "0",
  minStock: "5",
  expiry: "",
};

const draftFromProduct = (product: Product): Draft => ({
  name: product.name,
  category: product.category,
  barcode: product.barcode,
  cost: String(product.cost),
  price: String(product.price),
  stock: String(product.stock),
  minStock: String(product.minStock),
  expiry: product.expiry || "",
});

export default function ProductEditor({
  busy,
  existingProducts,
  product,
  onClose,
  onCreate,
  onUpdate,
  onEditExisting,
}: ProductEditorProps) {
  const [draft, setDraft] = useState<Draft>(product ? draftFromProduct(product) : blankDraft);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupMessage, setLookupMessage] = useState("");
  const editing = Boolean(product);

  const update = (field: keyof Draft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const findDuplicate = useCallback((barcode: string) => {
    const normalized = normalizeBarcode(barcode);
    return existingProducts.find(
      (item) => item.barcode === normalized && item.id !== product?.id,
    );
  }, [existingProducts, product?.id]);

  const completeBarcode = useCallback(async (rawBarcode: string) => {
    const barcode = normalizeBarcode(rawBarcode);
    update("barcode", barcode);
    setScannerOpen(false);
    setLookupMessage("");

    const duplicate = findDuplicate(barcode);
    if (duplicate) {
      setLookupMessage(`Este código ya pertenece a “${duplicate.name}”. Puedes actualizar su precio.`);
      return;
    }

    if (barcode.length < 8) return;
    setLookupBusy(true);
    setLookupMessage("Buscando datos del producto…");
    try {
      const match = await lookupBarcode(barcode);
      if (!match) {
        setLookupMessage("No está en los catálogos abiertos. Completa los datos una vez y quedarán guardados.");
        return;
      }
      setDraft((current) => ({
        ...current,
        barcode,
        name: current.name.trim() || match.name,
        category: current.category || match.category,
      }));
      setLookupMessage(`Datos encontrados en ${match.source}. Revisa el nombre y agrega tus precios.`);
    } catch {
      setLookupMessage("No pudimos consultar el catálogo ahora. Puedes completar los datos manualmente.");
    } finally {
      setLookupBusy(false);
    }
  }, [findDuplicate]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const duplicate = findDuplicate(draft.barcode);
    if (duplicate) {
      onEditExisting(duplicate);
      return;
    }

    const payload: NewProduct = {
      name: draft.name,
      category: draft.category,
      barcode: normalizeBarcode(draft.barcode),
      cost: Number(draft.cost),
      price: Number(draft.price),
      stock: Number(draft.stock),
      minStock: Number(draft.minStock),
      expiry: draft.expiry || undefined,
    };

    if (product) await onUpdate(product, payload);
    else await onCreate(payload);
  };

  const duplicate = findDuplicate(draft.barcode);

  return (
    <div className="modal-backdrop" onMouseDown={() => { if (!busy) onClose(); }}>
      <section className="modal product-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <span className="eyebrow">INVENTARIO</span>
            <h2>{editing ? "Editar producto" : "Agregar producto"}</h2>
          </div>
          <button className="icon-button" disabled={busy} onClick={onClose} aria-label="Cerrar">
            <X size={23} />
          </button>
        </div>

        {scannerOpen && (
          <BarcodeScanner
            onClose={() => setScannerOpen(false)}
            onDetected={(barcode) => void completeBarcode(barcode)}
          />
        )}

        <form className="form-grid product-form" onSubmit={submit}>
          <div className="wide barcode-entry">
            <label>
              Código de barras
              <span className="barcode-input">
                <input
                  name="barcode"
                  inputMode="numeric"
                  autoComplete="off"
                  value={draft.barcode}
                  onChange={(event) => update("barcode", normalizeBarcode(event.target.value))}
                  onBlur={() => { if (draft.barcode.length >= 8 && !duplicate) void completeBarcode(draft.barcode); }}
                  placeholder="780…"
                />
                <button type="button" onClick={() => void completeBarcode(draft.barcode)} disabled={lookupBusy || draft.barcode.length < 8}>
                  <Search size={17} /> {lookupBusy ? "Buscando…" : "Autocompletar"}
                </button>
                <button type="button" className="scan-button" onClick={() => setScannerOpen(true)}>
                  <Camera size={18} /> Escanear
                </button>
              </span>
            </label>
            {lookupMessage && <p className={duplicate ? "field-message warning" : "field-message"}>{lookupMessage}</p>}
            {duplicate && <button type="button" className="text-button duplicate-link" onClick={() => onEditExisting(duplicate)}>Editar producto existente</button>}
          </div>

          <label className="wide">
            Nombre del producto
            <input name="name" value={draft.name} onChange={(event) => update("name", event.target.value)} placeholder="Ej: Queso mantecoso 500 g" required />
          </label>
          <label>
            Categoría
            <select name="category" value={draft.category} onChange={(event) => update("category", event.target.value)} required>
              <option value="" disabled>Selecciona una categoría</option>
              {draft.category && !ALL_CATEGORIES.includes(draft.category) && (
                <option value={draft.category}>{categoryDisplayName(draft.category)} (categoría guardada)</option>
              )}
              {CATEGORY_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.categories.map((category) => (
                    <option key={category} value={category}>{categoryDisplayName(category)}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label>
            Fecha de vencimiento (opcional)
            <input name="expiry" type="date" value={draft.expiry} onChange={(event) => update("expiry", event.target.value)} />
          </label>
          <label>
            Costo unitario
            <input name="cost" type="number" min="0" value={draft.cost} onChange={(event) => update("cost", event.target.value)} required />
            <small>Actualízalo cuando cambie tu proveedor.</small>
          </label>
          <label>
            Precio de venta
            <input name="price" type="number" min="0" value={draft.price} onChange={(event) => update("price", event.target.value)} required />
            <small>Se usará automáticamente en próximas ventas.</small>
          </label>
          <label>
            {editing ? "Stock actual" : "Stock inicial"}
            <input name="stock" type="number" min="0" value={draft.stock} onChange={(event) => update("stock", event.target.value)} readOnly={editing} required />
            {editing && <small>Usa “Reponer” para conservar el historial.</small>}
          </label>
          <label>
            Stock mínimo
            <input name="minStock" type="number" min="0" value={draft.minStock} onChange={(event) => update("minStock", event.target.value)} required />
          </label>
          <button className="primary-button full wide" type="submit" disabled={busy || Boolean(duplicate)}>
            {editing ? <Check size={19} /> : <PackagePlus size={19} />}
            {busy ? "Guardando…" : editing ? "Guardar cambios" : "Agregar al inventario"}
          </button>
        </form>
      </section>
    </div>
  );
}
