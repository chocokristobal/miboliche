"use client";

import {
  AlertTriangle,
  CalendarCheck2,
  Check,
  CircleDollarSign,
  ClipboardCheck,
  Package,
  RotateCcw,
  Scale,
  WalletCards,
  X,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import type { CashClosure, Sale } from "./lib/commerce";
import type { Product } from "./lib/products";

type FormatMoney = (amount: number) => string;

export function CashOperationsView({
  closures,
  today,
  todayCashSales,
  loading,
  formatMoney,
  onCloseCash,
}: {
  closures: CashClosure[];
  today: string;
  todayCashSales: number;
  loading: boolean;
  formatMoney: FormatMoney;
  onCloseCash: () => void;
}) {
  const todayClosure = closures.find((closure) => closure.businessDate === today);
  const latestClosure = closures[0];

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">CONTROL DIARIO</span>
          <h1>Caja</h1>
          <p>Compara el efectivo esperado con lo que realmente contaste.</p>
        </div>
        <button className="primary-button" onClick={onCloseCash}>
          <ClipboardCheck size={20} /> {todayClosure ? "Revisar cierre" : "Cerrar caja"}
        </button>
      </div>

      <div className="summary-grid three">
        <article className="stat-card">
          <span className="icon-badge green"><CircleDollarSign size={22} /></span>
          <div><p>Ventas en efectivo hoy</p><strong>{formatMoney(todayCashSales)}</strong><small>Solo ventas vigentes</small></div>
        </article>
        <article className="stat-card">
          <span className="icon-badge blue"><WalletCards size={22} /></span>
          <div><p>Último efectivo contado</p><strong>{formatMoney(latestClosure?.countedCash || 0)}</strong><small>{latestClosure ? `Cierre del ${latestClosure.businessDate}` : "Aún no hay cierres"}</small></div>
        </article>
        <article className="stat-card">
          <span className="icon-badge amber"><Scale size={22} /></span>
          <div><p>Diferencia de hoy</p><strong>{formatMoney(todayClosure?.difference || 0)}</strong><small>{todayClosure ? (todayClosure.difference === 0 ? "Caja cuadrada" : "Revisa la diferencia") : "Pendiente de cierre"}</small></div>
        </article>
      </div>

      {todayClosure && (
        <article className={`cash-status ${todayClosure.difference === 0 ? "balanced" : "warning"}`}>
          <span>{todayClosure.difference === 0 ? <Check size={24} /> : <AlertTriangle size={24} />}</span>
          <div>
            <strong>{todayClosure.difference === 0 ? "La caja de hoy está cuadrada" : "La caja de hoy tiene una diferencia"}</strong>
            <p>Esperado {formatMoney(todayClosure.expectedCash)} · contado {formatMoney(todayClosure.countedCash)}.</p>
          </div>
          <button className="outline-button" onClick={onCloseCash}>Ver o corregir</button>
        </article>
      )}

      <article className="panel table-panel">
        <div className="panel-title">
          <div><span className="icon-badge green"><CalendarCheck2 size={21} /></span><div><h3>Historial de cierres</h3><p>Cada fecha conserva lo esperado, contado y su diferencia.</p></div></div>
        </div>
        {loading ? (
          <div className="operation-empty"><strong>Cargando cierres</strong><p>Estamos recuperando la información de caja.</p></div>
        ) : closures.length ? (
          <div className="responsive-table cash-table">
            <table>
              <thead><tr><th>Fecha</th><th>Ventas efectivo</th><th>Esperado</th><th>Contado</th><th>Diferencia</th><th>Estado</th></tr></thead>
              <tbody>{closures.map((closure) => (
                <tr key={closure.id}>
                  <td><b>{new Intl.DateTimeFormat("es-CL", { dateStyle: "medium" }).format(new Date(`${closure.businessDate}T12:00:00`))}</b></td>
                  <td>{formatMoney(closure.cashSales)}</td>
                  <td>{formatMoney(closure.expectedCash)}</td>
                  <td>{formatMoney(closure.countedCash)}</td>
                  <td><b className={closure.difference === 0 ? "difference-ok" : "difference-warning"}>{formatMoney(closure.difference)}</b></td>
                  <td><span className={`status-pill ${closure.difference === 0 ? "success" : "danger"}`}>{closure.difference === 0 ? "Cuadrada" : "Con diferencia"}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : (
          <div className="operation-empty"><span className="icon-badge green"><ClipboardCheck size={25} /></span><strong>Aún no hay cierres de caja</strong><p>Haz tu primer cierre al terminar la jornada.</p></div>
        )}
      </article>
    </>
  );
}

export function CashCloseModal({
  current,
  today,
  todayCashSales,
  busy,
  formatMoney,
  onClose,
  onSubmit,
}: {
  current?: CashClosure;
  today: string;
  todayCashSales: number;
  busy: boolean;
  formatMoney: FormatMoney;
  onClose: () => void;
  onSubmit: (values: { businessDate: string; openingCash: number; otherCashIn: number; cashOut: number; countedCash: number; note: string }) => Promise<void>;
}) {
  const [openingCash, setOpeningCash] = useState(current?.openingCash || 0);
  const [otherCashIn, setOtherCashIn] = useState(current?.otherCashIn || 0);
  const [cashOut, setCashOut] = useState(current?.cashOut || 0);
  const [countedCash, setCountedCash] = useState(current?.countedCash || 0);
  const expected = openingCash + todayCashSales + otherCashIn - cashOut;
  const difference = countedCash - expected;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await onSubmit({
      businessDate: today,
      openingCash,
      otherCashIn,
      cashOut,
      countedCash,
      note: String(data.get("note") || ""),
    });
  };

  return (
    <div className="modal-backdrop" onMouseDown={() => { if (!busy) onClose(); }}>
      <section className="modal small-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head"><div><span className="eyebrow">CIERRE DEL DÍA</span><h2>Cuadrar caja</h2></div><button className="icon-button" disabled={busy} onClick={onClose}><X size={23} /></button></div>
        <form className="stack-form cash-close-form" onSubmit={(event) => void submit(event)}>
          <div className="cash-date"><CalendarCheck2 size={19} /><div><span>Fecha del cierre</span><strong>{new Intl.DateTimeFormat("es-CL", { dateStyle: "full" }).format(new Date(`${today}T12:00:00`))}</strong></div></div>
          <div className="cash-form-grid">
            <label>Efectivo al abrir<span className="money-input">$ <input type="number" min="0" value={openingCash} onChange={(event) => setOpeningCash(Number(event.target.value))} /></span></label>
            <label>Ventas en efectivo<span className="readonly-money">{formatMoney(todayCashSales)}</span></label>
            <label>Otros ingresos de efectivo<span className="money-input">$ <input type="number" min="0" value={otherCashIn} onChange={(event) => setOtherCashIn(Number(event.target.value))} /></span></label>
            <label>Retiros de efectivo<span className="money-input">$ <input type="number" min="0" value={cashOut} onChange={(event) => setCashOut(Number(event.target.value))} /></span></label>
          </div>
          <div className="cash-expected"><span>Efectivo esperado</span><strong>{formatMoney(expected)}</strong></div>
          <label>Efectivo contado<span className="money-input">$ <input type="number" min="0" value={countedCash} onChange={(event) => setCountedCash(Number(event.target.value))} required /></span></label>
          <div className={`cash-difference ${difference === 0 ? "balanced" : "warning"}`}><span>Diferencia</span><strong>{formatMoney(difference)}</strong></div>
          <label>Nota opcional<input name="note" defaultValue={current?.note || ""} placeholder="Ej: retiro para pago a proveedor" /></label>
          <button className="primary-button full" type="submit" disabled={busy || expected < 0}><ClipboardCheck size={19} /> {busy ? "Guardando…" : current ? "Actualizar cierre" : "Guardar cierre"}</button>
        </form>
      </section>
    </div>
  );
}

export function VoidSaleModal({
  sale,
  busy,
  formatMoney,
  onClose,
  onConfirm,
}: {
  sale: Sale;
  busy: boolean;
  formatMoney: FormatMoney;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const total = sale.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const reason = String(data.get("reason") || "");
    const note = String(data.get("note") || "").trim();
    await onConfirm(note ? `${reason}: ${note}` : reason);
  };

  return (
    <div className="modal-backdrop" onMouseDown={() => { if (!busy) onClose(); }}>
      <section className="modal tiny-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head"><div><span className="eyebrow">CORREGIR MOVIMIENTO</span><h2>Anular venta</h2></div><button className="icon-button" disabled={busy} onClick={onClose}><X size={23} /></button></div>
        <form className="stack-form" onSubmit={(event) => void submit(event)}>
          <div className="operation-warning"><RotateCcw size={21} /><p>Se devolverán {sale.items.reduce((sum, item) => sum + item.quantity, 0)} unidades al inventario y la venta dejará de contar en Caja, Finanzas y Reportes.</p></div>
          <div className="sale-to-void"><span>Venta #{sale.id.slice(-6)}</span><strong>{formatMoney(total)}</strong><small>{sale.payment} · {new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeStyle: "short" }).format(new Date(sale.date))}</small></div>
          <label>Motivo<select name="reason" defaultValue="Error al registrar" required><option>Error al registrar</option><option>Devolución del cliente</option><option>Producto equivocado</option><option>Medio de pago incorrecto</option><option>Otro motivo</option></select></label>
          <label>Detalle opcional<input name="note" placeholder="Agrega información para la trazabilidad" /></label>
          <button className="danger-button full" type="submit" disabled={busy}><RotateCcw size={18} /> {busy ? "Anulando…" : "Confirmar anulación"}</button>
        </form>
      </section>
    </div>
  );
}

const adjustmentOptions = [
  { value: "restock", label: "Reposición / compra", direction: "in" },
  { value: "count", label: "Corrección por conteo físico", direction: "count" },
  { value: "waste", label: "Merma o producto dañado", direction: "out" },
  { value: "expired", label: "Producto vencido", direction: "out" },
  { value: "loss", label: "Pérdida o robo", direction: "out" },
  { value: "supplier", label: "Devolución a proveedor", direction: "out" },
] as const;

export function StockAdjustmentModal({
  product,
  busy,
  onClose,
  onConfirm,
}: {
  product: Product;
  busy: boolean;
  onClose: () => void;
  onConfirm: (newStock: number, reason: string) => Promise<void>;
}) {
  const [kind, setKind] = useState<(typeof adjustmentOptions)[number]["value"]>("restock");
  const [quantity, setQuantity] = useState(5);
  const selected = adjustmentOptions.find((option) => option.value === kind)!;
  const projectedStock = useMemo(() => {
    if (selected.direction === "in") return product.stock + quantity;
    if (selected.direction === "out") return product.stock - quantity;
    return quantity;
  }, [product.stock, quantity, selected.direction]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const note = String(data.get("note") || "").trim();
    const reason = note ? `${selected.label}: ${note}` : selected.label;
    await onConfirm(projectedStock, reason);
  };

  return (
    <div className="modal-backdrop" onMouseDown={() => { if (!busy) onClose(); }}>
      <section className="modal tiny-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head"><div><span className="eyebrow">INVENTARIO</span><h2>Ajustar stock</h2></div><button className="icon-button" disabled={busy} onClick={onClose}><X size={23} /></button></div>
        <form className="stack-form" onSubmit={(event) => void submit(event)}>
          <div className="adjust-product"><span className="product-mini-icon"><Package size={20} /></span><div><strong>{product.name}</strong><small>Stock actual: {product.stock} unidades</small></div></div>
          <label>Tipo de ajuste<select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>{adjustmentOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label>{selected.direction === "count" ? "Stock real contado" : selected.direction === "in" ? "Unidades que ingresan" : "Unidades que salen"}<input type="number" min={selected.direction === "count" ? 0 : 1} step="1" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} required /></label>
          <div className={`stock-projection ${projectedStock < 0 ? "invalid" : ""}`}><span>Stock después del ajuste</span><strong>{projectedStock}</strong></div>
          {projectedStock < 0 && <p className="field-message warning">No puedes retirar más unidades que las disponibles.</p>}
          <label>Detalle opcional<input name="note" placeholder="Ej: 2 envases dañados en bodega" /></label>
          <button className="primary-button full" type="submit" disabled={busy || projectedStock < 0 || projectedStock === product.stock}><Scale size={18} /> {busy ? "Guardando…" : "Aplicar ajuste"}</button>
        </form>
      </section>
    </div>
  );
}
