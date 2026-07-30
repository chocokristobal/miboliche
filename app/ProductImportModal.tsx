"use client";

import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload, X } from "lucide-react";
import { ChangeEvent, useMemo, useState } from "react";
import type { NewProduct, Product } from "./lib/products";

type ImportRow = NewProduct & {
  rowNumber: number;
  errors: string[];
};

type ProductImportModalProps = {
  busy: boolean;
  existingProducts: Product[];
  onClose: () => void;
  onImport: (products: NewProduct[]) => Promise<void>;
};

const headers = [
  "codigo_barras",
  "nombre",
  "categoria",
  "costo",
  "precio_venta",
  "stock_inicial",
  "stock_minimo",
  "vencimiento",
];

const cleanHeader = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");

const numberValue = (value: unknown) => {
  if (typeof value === "number") return value;
  const normalized = String(value ?? "")
    .replace(/\$/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  return Number(normalized);
};

const dateValue = (value: unknown) => {
  if (!value) return undefined;
  if (typeof value === "number") {
    const parsed = new Date(Date.UTC(1899, 11, 30) + value * 86_400_000);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  return match ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}` : undefined;
};

const parseWorkbook = async (buffer: ArrayBuffer, existingProducts: Product[]) => {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("El archivo no contiene una hoja.");
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  if (!matrix.length) throw new Error("El archivo está vacío.");

  const fileHeaders = matrix[0].map(cleanHeader);
  const missing = headers.filter((header) => !fileHeaders.includes(header));
  if (missing.length) throw new Error(`Faltan columnas: ${missing.join(", ")}.`);

  const index = Object.fromEntries(headers.map((header) => [header, fileHeaders.indexOf(header)]));
  const existingBarcodes = new Set(existingProducts.map((product) => product.barcode).filter(Boolean));
  const fileBarcodes = new Set<string>();

  return matrix.slice(1).map((cells, rowIndex): ImportRow | null => {
    if (!cells.some((cell) => String(cell).trim())) return null;
    const barcode = String(cells[index.codigo_barras] ?? "").replace(/\D/g, "");
    const name = String(cells[index.nombre] ?? "").trim();
    const category = String(cells[index.categoria] ?? "").trim();
    const cost = numberValue(cells[index.costo]);
    const price = numberValue(cells[index.precio_venta]);
    const stock = numberValue(cells[index.stock_inicial]);
    const minStock = numberValue(cells[index.stock_minimo]);
    const expiryRaw = cells[index.vencimiento];
    const expiry = dateValue(expiryRaw);
    const errors: string[] = [];

    if (!name) errors.push("Falta nombre");
    if (!category) errors.push("Falta categoría");
    if (![cost, price, stock, minStock].every(Number.isFinite)) errors.push("Hay valores numéricos inválidos");
    if ([cost, price, stock, minStock].some((value) => value < 0)) errors.push("Los montos y stock no pueden ser negativos");
    if (barcode && existingBarcodes.has(barcode)) errors.push("Código ya existe en el inventario");
    if (barcode && fileBarcodes.has(barcode)) errors.push("Código repetido en el archivo");
    if (expiryRaw && !expiry) errors.push("Fecha inválida");
    if (barcode) fileBarcodes.add(barcode);

    return { rowNumber: rowIndex + 2, barcode, name, category, cost, price, stock, minStock, expiry, errors };
  }).filter((row): row is ImportRow => Boolean(row));
};

export default function ProductImportModal({
  busy,
  existingProducts,
  onClose,
  onImport,
}: ProductImportModalProps) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState("");
  const invalidRows = useMemo(() => rows.filter((row) => row.errors.length), [rows]);

  const downloadTemplate = async () => {
    const XLSX = await import("xlsx");
    const sample = [
      headers,
      ["7801234567890", "Bebida cola 1,5 L", "Bebidas gaseosas", 1200, 1890, 24, 6, "2026-12-31"],
      ["", "Pan molde", "Panadería", 1500, 2190, 10, 3, ""],
    ];
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet(sample);
    sheet["!cols"] = [18, 28, 24, 12, 14, 14, 14, 14].map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(workbook, sheet, "Productos");
    XLSX.writeFile(workbook, "plantilla-productos-miboliche.xlsx");
  };

  const readFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMessage("");
    try {
      const parsed = await parseWorkbook(await file.arrayBuffer(), existingProducts);
      if (!parsed.length) throw new Error("No encontramos productos en el archivo.");
      setRows(parsed);
      setFileName(file.name);
    } catch (error) {
      setRows([]);
      setFileName("");
      setMessage(error instanceof Error ? error.message : "No pudimos leer el archivo.");
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={() => { if (!busy) onClose(); }}>
      <section className="modal import-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div><span className="eyebrow">INVENTARIO</span><h2>Importar productos</h2></div>
          <button className="icon-button" disabled={busy} onClick={onClose} aria-label="Cerrar"><X size={23} /></button>
        </div>

        <div className="import-steps">
          <button className="outline-button" type="button" onClick={() => void downloadTemplate()}><Download size={18} /> Descargar plantilla Excel</button>
          <label className="primary-button import-file-button">
            <Upload size={18} /> Seleccionar Excel o CSV
            <input type="file" accept=".xlsx,.xls,.csv" onChange={(event) => void readFile(event)} />
          </label>
        </div>
        <p className="block-note">Usa la plantilla sin cambiar los títulos de las columnas. El código de barras y el vencimiento son opcionales.</p>

        {message && <div className="import-alert danger"><AlertTriangle size={19} /><span>{message}</span></div>}
        {rows.length > 0 && (
          <>
            <div className={`import-alert ${invalidRows.length ? "warning" : "success"}`}>
              {invalidRows.length ? <AlertTriangle size={19} /> : <CheckCircle2 size={19} />}
              <span><b>{fileName}</b>: {rows.length} productos detectados. {invalidRows.length ? `${invalidRows.length} filas necesitan corrección.` : "Todo listo para importar."}</span>
            </div>
            <div className="responsive-table import-preview">
              <table>
                <thead><tr><th>Fila</th><th>Producto</th><th>Código</th><th>Precio</th><th>Stock</th><th>Validación</th></tr></thead>
                <tbody>{rows.slice(0, 100).map((row) => <tr key={row.rowNumber} className={row.errors.length ? "invalid-row" : ""}><td>{row.rowNumber}</td><td><b>{row.name || "Sin nombre"}</b><small className="block-note">{row.category || "Sin categoría"}</small></td><td>{row.barcode || "—"}</td><td>${Number.isFinite(row.price) ? row.price.toLocaleString("es-CL") : "—"}</td><td>{Number.isFinite(row.stock) ? row.stock : "—"}</td><td>{row.errors.length ? row.errors.join(" · ") : <span className="status-pill success">Lista</span>}</td></tr>)}</tbody>
              </table>
            </div>
            {rows.length > 100 && <p className="block-note">Vista previa de las primeras 100 filas. Se importarán las {rows.length} filas.</p>}
            <button className="primary-button full" disabled={busy || invalidRows.length > 0} onClick={() => void onImport(rows.map((row) => ({ name: row.name, category: row.category, barcode: row.barcode, cost: row.cost, price: row.price, stock: row.stock, minStock: row.minStock, expiry: row.expiry })))}>
              <FileSpreadsheet size={19} /> {busy ? "Importando…" : `Importar ${rows.length} productos`}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
