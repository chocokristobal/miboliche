"use client";

import {
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  CreditCard,
  Download,
  Headphones,
  LayoutDashboard,
  LogOut,
  Mail,
  MessageSquare,
  Menu,
  Package,
  Phone,
  Search,
  ShieldCheck,
  ShoppingCart,
  Store,
  TrendingUp,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import {
  listAdminBusinesses,
  listAdminSupportTickets,
  updateSupportTicket,
  updateAdminBusinessAccount,
  type AdminBusiness,
  type SupportTicket,
} from "./lib/business";
import { downloadCsv } from "./lib/reporting";

type AdminView = "resumen" | "negocios" | "finanzas" | "soporte";
type AccountStatus = AdminBusiness["accountStatus"];
type PaymentState = AdminBusiness["paymentState"];

const CLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});
const DATE = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const DATE_TIME = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const formatMoney = (value: number) => CLP.format(Math.round(value));
const formatDate = (value?: string) => (value ? DATE.format(new Date(value)) : "—");
const formatDateTime = (value?: string) => (value ? DATE_TIME.format(new Date(value)) : "Sin actividad");

const statusMeta: Record<AccountStatus, { label: string; className: string }> = {
  trialing: { label: "En prueba", className: "trial" },
  active: { label: "Activa", className: "active" },
  past_due: { label: "Pago atrasado", className: "late" },
  grace_period: { label: "En gracia", className: "grace" },
  suspended: { label: "Suspendida", className: "suspended" },
  canceled: { label: "Cancelada", className: "canceled" },
  archived: { label: "Archivada", className: "archived" },
};

const paymentMeta: Record<PaymentState, { label: string; className: string }> = {
  paid: { label: "Pago al día", className: "paid" },
  late: { label: "Pago atrasado", className: "late" },
  unpaid: { label: "No pagado", className: "unpaid" },
};

const adminNav: Array<{ id: AdminView; label: string; icon: LucideIcon }> = [
  { id: "resumen", label: "Resumen", icon: LayoutDashboard },
  { id: "negocios", label: "Negocios", icon: Building2 },
  { id: "finanzas", label: "Finanzas", icon: BarChart3 },
  { id: "soporte", label: "Soporte", icon: Headphones },
];

function AdminBrand() {
  return (
    <div className="admin-brand">
      <span><Store size={22} /><TrendingUp size={11} /></span>
      <div><strong>miboliche.cl</strong><small>Panel del propietario</small></div>
    </div>
  );
}

function AdminMetric({
  icon: Icon,
  label,
  value,
  detail,
  tone = "green",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone?: "green" | "amber" | "blue" | "red";
}) {
  return (
    <article className="admin-metric-card">
      <span className={`icon-badge ${tone}`}><Icon size={22} /></span>
      <div><p>{label}</p><strong>{value}</strong><small>{detail}</small></div>
    </article>
  );
}

function PaymentIndicator({ state }: { state: PaymentState }) {
  const meta = paymentMeta[state];
  return <span className={`payment-indicator ${meta.className}`}><i />{meta.label}</span>;
}

export default function AdminPanel({ onLogout }: { onLogout: () => void }) {
  const [view, setView] = useState<AdminView>("resumen");
  const [businesses, setBusinesses] = useState<AdminBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [businessQuery, setBusinessQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState<"all" | AccountStatus>("all");
  const [expandedBusiness, setExpandedBusiness] = useState<string | null>(null);
  const [editingBusiness, setEditingBusiness] = useState<AdminBusiness | null>(null);
  const [saving, setSaving] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [toast, setToast] = useState("");
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [editingTicket, setEditingTicket] = useState<SupportTicket | null>(null);

  const loadBusinesses = async () => {
    if (!supabase) {
      setLoadError("La conexión con Supabase no está disponible.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError("");
    try {
      setBusinesses(await listAdminBusinesses(supabase));
    } catch (error) {
      const message = error instanceof Error ? error.message.toLocaleLowerCase("es") : "";
      setLoadError(
        message.includes("could not find") || message.includes("schema cache")
          ? "Activa el panel administrativo real en Supabase para cargar los negocios."
          : "No pudimos cargar los negocios. Revisa la conexión e inténtalo nuevamente.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadBusinesses();
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    void listAdminSupportTickets(supabase).then(setTickets).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const activeBusinesses = businesses.filter((business) => business.accountStatus === "active");
  const trials = businesses.filter((business) => business.accountStatus === "trialing");
  const paymentsToReview = businesses.filter((business) => business.paymentState !== "paid");
  const suspendedBusinesses = businesses.filter((business) => business.accountStatus === "suspended");
  const mrr = businesses
    .filter((business) => business.accountStatus === "active" && business.paymentState === "paid")
    .reduce((sum, business) => sum + business.monthlyFee, 0);
  const processedSales = businesses.reduce((sum, business) => sum + business.salesVolume, 0);

  const filteredBusinesses = useMemo(() => {
    const query = businessQuery.trim().toLocaleLowerCase("es");
    return businesses.filter((business) => {
      const matchesStatus = accountFilter === "all" || business.accountStatus === accountFilter;
      const matchesQuery = !query || [
        business.name,
        business.ownerName,
        business.ownerEmail,
        business.rut,
        business.phone,
        business.commune,
      ].some((value) => value.toLocaleLowerCase("es").includes(query));
      return matchesStatus && matchesQuery;
    });
  }, [accountFilter, businessQuery, businesses]);

  const navigate = (next: AdminView) => {
    setView(next);
    setMobileMenu(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const exportBusinesses = () => {
    downloadCsv("negocios-mi-boliche.csv", [
      ["Negocio", "Responsable", "Correo", "RUT", "Teléfono", "Comuna", "Región", "Plan", "Pago", "Cuenta", "Usuarios", "Productos", "Ventas", "Volumen vendido"],
      ...filteredBusinesses.map((business) => [
        business.name,
        business.ownerName,
        business.ownerEmail,
        business.rut,
        business.phone,
        business.commune,
        business.region,
        business.plan,
        paymentMeta[business.paymentState].label,
        statusMeta[business.accountStatus].label,
        business.users,
        business.products,
        business.sales,
        business.salesVolume,
      ]),
    ]);
    setToast("Listado real de negocios descargado");
  };

  const saveAccountState = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !editingBusiness) return;
    const data = new FormData(event.currentTarget);
    const nextStatus = String(data.get("accountStatus")) as AccountStatus;
    const nextPayment = String(data.get("paymentState")) as PaymentState;
    const planName = String(data.get("planName") || "").trim();
    const monthlyFee = Number(data.get("monthlyFee"));
    const dueDate = String(data.get("dueDate") || "") || null;
    const lastPayment = String(data.get("lastPayment") || "") || null;
    const reason = String(data.get("reason") || "").trim();
    setSaving(true);
    try {
      await updateAdminBusinessAccount(
        supabase,
        editingBusiness.id,
        planName,
        monthlyFee,
        nextStatus,
        nextPayment,
        dueDate,
        lastPayment,
        reason,
      );
      setBusinesses((current) => current.map((business) =>
        business.id === editingBusiness.id
          ? { ...business, plan: planName, monthlyFee, accountStatus: nextStatus, paymentState: nextPayment, dueDate: dueDate || undefined, lastPayment: lastPayment || undefined }
          : business
      ));
      setEditingBusiness(null);
      setToast("Estado actualizado y registrado en auditoría");
    } catch {
      setToast("No pudimos actualizar el estado de la cuenta");
    } finally {
      setSaving(false);
    }
  };

  const saveTicket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !editingTicket) return;
    const data = new FormData(event.currentTarget);
    const status = String(data.get("ticketStatus")) as SupportTicket["status"];
    const response = String(data.get("ticketResponse") || "").trim();
    setSaving(true);
    try {
      await updateSupportTicket(supabase, editingTicket.id, status, response);
      setTickets((current) => current.map((ticket) =>
        ticket.id === editingTicket.id ? { ...ticket, status, adminResponse: response, updatedAt: new Date().toISOString() } : ticket
      ));
      setEditingTicket(null);
      setToast("Ticket actualizado");
    } catch {
      setToast("No pudimos actualizar el ticket");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <AdminBrand />
        <div className="owner-card"><span>CV</span><div><strong>Cristóbal Villablanca</strong><small>Propietario · acceso total</small></div><ShieldCheck size={17} /></div>
        <nav aria-label="Navegación de propietario">
          <p>ADMINISTRACIÓN</p>
          {adminNav.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => navigate(item.id)}><item.icon size={20} />{item.label}</button>)}
        </nav>
        <div className="admin-sidebar-foot"><span><ShieldCheck size={16} /> Datos reales protegidos</span><button onClick={onLogout}><LogOut size={19} />Cerrar sesión</button></div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <button className="admin-menu-button" onClick={() => setMobileMenu(true)} aria-label="Abrir menú"><Menu size={23} /></button>
          <div className="admin-topbar-copy"><span className="eyebrow">PANEL DEL PROPIETARIO</span><strong>{adminNav.find((item) => item.id === view)?.label}</strong></div>
          <div className="admin-top-actions"><div className="admin-profile"><span>CV</span><div><strong>Cristóbal Villablanca</strong><small>Superadministrador</small></div><ChevronDown size={16} /></div></div>
        </header>

        <section className="admin-content">
          {loadError && <div className="auth-message error"><AlertTriangle size={18} /> {loadError}</div>}

          {view === "resumen" && (
            <>
              <div className="admin-page-heading"><div><span className="eyebrow">INFORMACIÓN REAL</span><h1>Mi Boliche, de un vistazo</h1><p>Negocios, uso y estados cargados directamente desde Supabase.</p></div><button className="admin-primary-button" onClick={() => navigate("negocios")}><Building2 size={18} /> Ver negocios</button></div>
              <div className="admin-metric-grid">
                <AdminMetric icon={Building2} label="Negocios" value={loading ? "…" : String(businesses.length)} detail={`${activeBusinesses.length} activos · ${trials.length} en prueba`} />
                <AdminMetric icon={AlertTriangle} label="Pagos por revisar" value={loading ? "…" : String(paymentsToReview.length)} detail={`${suspendedBusinesses.length} cuentas suspendidas`} tone="amber" />
                <AdminMetric icon={CircleDollarSign} label="Ingreso mensual" value={loading ? "…" : formatMoney(mrr)} detail="Planes activos y pagados" tone="blue" />
                <AdminMetric icon={ShoppingCart} label="Ventas procesadas" value={loading ? "…" : formatMoney(processedSales)} detail="Acumulado de todos los negocios" />
              </div>
              <div className="admin-overview-grid">
                <article className="admin-panel">
                  <div className="admin-panel-title"><div><span className="icon-badge amber"><AlertTriangle size={21} /></span><div><span className="eyebrow">REQUIERE ATENCIÓN</span><h2>Pagos y cuentas</h2></div></div><button onClick={() => navigate("negocios")}>Ver todas</button></div>
                  <div className="admin-priority-list">
                    {paymentsToReview.slice(0, 4).map((business) => <button key={business.id} onClick={() => { setExpandedBusiness(business.id); navigate("negocios"); }}><PaymentIndicator state={business.paymentState} /><div><strong>{business.name}</strong><small>{statusMeta[business.accountStatus].label} · vence {formatDate(business.dueDate)}</small></div><ChevronDown size={18} /></button>)}
                    {!loading && paymentsToReview.length === 0 && <div className="admin-empty"><CheckCircle2 size={27} /><strong>No hay pagos pendientes</strong><p>Las cuentas cargadas aparecen al día.</p></div>}
                  </div>
                </article>
                <article className="admin-panel">
                  <div className="admin-panel-title"><div><span className="icon-badge blue"><TrendingUp size={21} /></span><div><span className="eyebrow">ACTIVIDAD</span><h2>Negocios con ventas</h2></div></div></div>
                  <div className="admin-priority-list">
                    {[...businesses].sort((a, b) => b.salesVolume - a.salesVolume).slice(0, 4).map((business) => <button key={business.id} onClick={() => { setExpandedBusiness(business.id); navigate("negocios"); }}><span className="icon-badge green"><Store size={18} /></span><div><strong>{business.name}</strong><small>{business.sales} ventas · {formatDateTime(business.lastSaleAt)}</small></div><b>{formatMoney(business.salesVolume)}</b></button>)}
                  </div>
                </article>
              </div>
            </>
          )}

          {view === "negocios" && (
            <>
              <div className="admin-page-heading"><div><span className="eyebrow">CLIENTES Y CUENTAS</span><h1>Negocios reales</h1><p>Revisa uso, contacto y estado de cada cuenta.</p></div><button className="admin-secondary-button" disabled={!filteredBusinesses.length} onClick={exportBusinesses}><Download size={18} /> Exportar CSV</button></div>
              <div className="business-summary-strip">
                <button className={accountFilter === "all" ? "active" : ""} onClick={() => setAccountFilter("all")}><b>{businesses.length}</b><span>Todos</span></button>
                <button className={accountFilter === "active" ? "active" : ""} onClick={() => setAccountFilter("active")}><b>{activeBusinesses.length}</b><span>Activos</span></button>
                <button className={accountFilter === "past_due" ? "active" : ""} onClick={() => setAccountFilter("past_due")}><b>{businesses.filter((item) => item.accountStatus === "past_due").length}</b><span>Atrasados</span></button>
                <button className={accountFilter === "suspended" ? "active" : ""} onClick={() => setAccountFilter("suspended")}><b>{suspendedBusinesses.length}</b><span>Suspendidos</span></button>
                <button className={accountFilter === "trialing" ? "active" : ""} onClick={() => setAccountFilter("trialing")}><b>{trials.length}</b><span>En prueba</span></button>
              </div>
              <article className="admin-panel business-manager">
                <div className="business-toolbar"><div className="admin-search"><Search size={19} /><input value={businessQuery} onChange={(event) => setBusinessQuery(event.target.value)} placeholder="Buscar negocio, nombre, RUT o teléfono..." /></div><div className="business-filter"><select value={accountFilter} onChange={(event) => setAccountFilter(event.target.value as "all" | AccountStatus)}><option value="all">Todos los estados</option>{Object.entries(statusMeta).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}</select></div></div>
                <div className="business-list">
                  <div className="business-list-head"><span>Negocio</span><span>Estado de pago</span><span>Última actividad</span><span>Estado de cuenta</span><span /></div>
                  {filteredBusinesses.map((business) => (
                    <div className={`business-record ${expandedBusiness === business.id ? "expanded" : ""}`} key={business.id}>
                      <div className="business-row" role="button" tabIndex={0} onClick={() => setExpandedBusiness(expandedBusiness === business.id ? null : business.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setExpandedBusiness(expandedBusiness === business.id ? null : business.id); }}>
                        <div className="business-name-cell"><span>{business.name.split(" ").map((word) => word[0]).join("").slice(0, 2)}</span><div><strong>{business.name}</strong><small>{business.ownerName} · {business.commune || "Sin comuna"}</small></div></div>
                        <PaymentIndicator state={business.paymentState} />
                        <div className="business-due"><strong>{formatDateTime(business.lastSaleAt)}</strong><small>{business.sales} ventas registradas</small></div>
                        <span className={`account-select ${statusMeta[business.accountStatus].className}`}>{statusMeta[business.accountStatus].label}</span>
                        <ChevronDown className="business-chevron" size={20} />
                      </div>
                      {expandedBusiness === business.id && (
                        <div className="business-details">
                          <div className="business-detail-grid">
                            <div><span>Responsable</span><strong>{business.ownerName}</strong><small>{business.rut || "RUT no informado"}</small></div>
                            <div><span>Contacto</span><strong>{business.phone || "Sin teléfono"}</strong><small>{business.ownerEmail}</small></div>
                            <div><span>Dirección</span><strong>{business.address || "Sin dirección"}</strong><small>{[business.commune, business.region].filter(Boolean).join(", ") || "Ubicación no informada"}</small></div>
                            <div><span>Suscripción</span><strong>{business.plan}</strong><small>{business.monthlyFee ? `${formatMoney(business.monthlyFee)} al mes` : "Sin cobro configurado"}</small></div>
                          </div>
                          <div className="business-usage"><span><Users size={17} /><b>{business.users}</b> usuarios</span><span><Package size={17} /><b>{business.products}</b> productos</span><span><ShoppingCart size={17} /><b>{business.sales}</b> ventas</span><span><CircleDollarSign size={17} /><b>{formatMoney(business.salesVolume)}</b> procesados</span></div>
                          <div className="business-actions">
                            {business.ownerEmail && <a href={`mailto:${business.ownerEmail}`}><Mail size={16} /> Enviar correo</a>}
                            {business.phone && <a href={`tel:${business.phone.replaceAll(" ", "")}`}><Phone size={16} /> Llamar</a>}
                            <button className={business.accountStatus === "suspended" ? "reactivate" : "suspend"} onClick={() => setEditingBusiness(business)}><CreditCard size={16} /> Cambiar estado</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {!loading && filteredBusinesses.length === 0 && <div className="admin-empty"><Search size={27} /><strong>No encontramos negocios</strong><p>Prueba con otra búsqueda o cambia el filtro.</p></div>}
                </div>
              </article>
            </>
          )}

          {view === "finanzas" && (
            <>
              <div className="admin-page-heading"><div><span className="eyebrow">FINANZAS DE LA PLATAFORMA</span><h1>Suscripciones</h1><p>Administra planes, vencimientos, pagos y reactivaciones. Los cobros bancarios aún no se ejecutan desde Mi Boliche.</p></div></div>
              <div className="admin-metric-grid">
                <AdminMetric icon={CircleDollarSign} label="MRR actual" value={formatMoney(mrr)} detail="Planes activos y pagados" />
                <AdminMetric icon={CreditCard} label="Por revisar" value={String(paymentsToReview.length)} detail="Atrasos y pagos no conciliados" tone="amber" />
                <AdminMetric icon={Building2} label="Planes activos" value={String(activeBusinesses.length)} detail={`${trials.length} negocios aún en prueba`} tone="blue" />
                <AdminMetric icon={ShoppingCart} label="Operación gestionada" value={formatMoney(processedSales)} detail="Ventas registradas por los clientes" />
              </div>
              <article className="admin-panel payment-table-panel">
                <div className="admin-panel-title"><div><span className="icon-badge blue"><CreditCard size={21} /></span><div><span className="eyebrow">CUENTAS</span><h2>Planes y próximos cobros</h2></div></div></div>
                <div className="responsive-table"><table><thead><tr><th>Negocio</th><th>Plan</th><th>Pago</th><th>Último pago</th><th>Vencimiento</th><th>Monto</th></tr></thead><tbody>{businesses.map((business) => <tr key={business.id}><td><b>{business.name}</b></td><td>{business.plan}</td><td><PaymentIndicator state={business.paymentState} /></td><td>{formatDate(business.lastPayment)}</td><td>{formatDate(business.dueDate)}</td><td><b>{formatMoney(business.monthlyFee)}</b></td></tr>)}</tbody></table></div>
              </article>
            </>
          )}

          {view === "soporte" && (
            <>
              <div className="admin-page-heading"><div><span className="eyebrow">AYUDA A CLIENTES</span><h1>Soporte técnico</h1><p>Solicitudes reales enviadas desde cada negocio.</p></div></div>
              <div className="admin-metric-grid support-metrics">
                <AdminMetric icon={MessageSquare} label="Nuevos" value={String(tickets.filter((ticket) => ticket.status === "new").length)} detail="Aún sin revisar" tone="red" />
                <AdminMetric icon={Headphones} label="En atención" value={String(tickets.filter((ticket) => ticket.status === "in_progress").length)} detail="Actualmente en proceso" tone="amber" />
                <AdminMetric icon={CheckCircle2} label="Resueltos" value={String(tickets.filter((ticket) => ticket.status === "resolved").length)} detail="Con respuesta registrada" />
                <AdminMetric icon={Building2} label="Total" value={String(tickets.length)} detail="Historial completo" tone="blue" />
              </div>
              <article className="admin-panel support-manager">
                <div className="ticket-list">
                  {tickets.map((ticket) => (
                    <div className="ticket-record" key={ticket.id}>
                      <button className="ticket-row" onClick={() => setEditingTicket(ticket)}>
                        <span className={`priority-mark ${ticket.priority}`}><MessageSquare size={19} /></span>
                        <span className="ticket-title"><strong>{ticket.subject}</strong><small>{ticket.businessName} · {ticket.requesterEmail}</small></span>
                        <span className={`ticket-status ${ticket.status}`}>{ticket.status === "new" ? "Nuevo" : ticket.status === "in_progress" ? "En atención" : ticket.status === "resolved" ? "Resuelto" : "Cerrado"}</span>
                        <span className="ticket-time"><strong>{formatDateTime(ticket.createdAt)}</strong><small>Prioridad {ticket.priority === "high" ? "alta" : ticket.priority === "medium" ? "media" : "baja"}</small></span>
                        <ChevronDown size={19} />
                      </button>
                    </div>
                  ))}
                  {!tickets.length && <div className="admin-empty"><Headphones size={28} /><strong>No hay solicitudes</strong><p>Los tickets enviados por los negocios aparecerán aquí.</p></div>}
                </div>
              </article>
            </>
          )}
        </section>
      </main>

      {mobileMenu && <div className="admin-mobile-backdrop" onClick={() => setMobileMenu(false)}><aside onClick={(event) => event.stopPropagation()}><div><AdminBrand /><button className="icon-button" onClick={() => setMobileMenu(false)}><X size={22} /></button></div><nav>{adminNav.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => navigate(item.id)}><item.icon size={20} />{item.label}</button>)}<button onClick={onLogout}><LogOut size={20} />Cerrar sesión</button></nav></aside></div>}

      {editingBusiness && (
        <div className="modal-backdrop" onMouseDown={() => { if (!saving) setEditingBusiness(null); }}>
          <section className="admin-confirm-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="admin-confirm-icon"><AlertTriangle size={27} /></div>
            <span className="eyebrow">CAMBIO ADMINISTRATIVO</span>
            <h2>Estado de {editingBusiness.name}</h2>
            <p>El cambio quedará guardado y registrado en la auditoría de la plataforma.</p>
            <form onSubmit={(event) => void saveAccountState(event)}>
              <label>Plan<input name="planName" required defaultValue={editingBusiness.plan} placeholder="Ej: Básico o Premium" /></label>
              <label>Valor mensual<input name="monthlyFee" required type="number" min="0" step="1" defaultValue={editingBusiness.monthlyFee} /></label>
              <label>Estado de cuenta<select name="accountStatus" defaultValue={editingBusiness.accountStatus}>{Object.entries(statusMeta).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}</select></label>
              <label>Estado de pago<select name="paymentState" defaultValue={editingBusiness.paymentState}>{Object.entries(paymentMeta).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}</select></label>
              <label>Próximo vencimiento<input name="dueDate" type="date" defaultValue={editingBusiness.dueDate || ""} /></label>
              <label>Último pago<input name="lastPayment" type="date" defaultValue={editingBusiness.lastPayment || ""} /></label>
              <label>Motivo<input name="reason" required placeholder="Ej: Pago recibido o vencimiento pendiente" /></label>
              <div><button type="button" className="admin-secondary-button" disabled={saving} onClick={() => setEditingBusiness(null)}>Volver</button><button type="submit" className="admin-danger-button" disabled={saving}><CreditCard size={17} /> {saving ? "Guardando…" : "Confirmar cambio"}</button></div>
            </form>
          </section>
        </div>
      )}

      {editingTicket && (
        <div className="modal-backdrop" onMouseDown={() => { if (!saving) setEditingTicket(null); }}>
          <section className="admin-confirm-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="admin-confirm-icon"><Headphones size={27} /></div>
            <span className="eyebrow">SOPORTE TÉCNICO</span>
            <h2>{editingTicket.subject}</h2>
            <p><b>{editingTicket.businessName}</b> · {editingTicket.requesterEmail}<br />{editingTicket.description}</p>
            <form onSubmit={(event) => void saveTicket(event)}>
              <label>Estado<select name="ticketStatus" defaultValue={editingTicket.status}><option value="new">Nuevo</option><option value="in_progress">En atención</option><option value="resolved">Resuelto</option><option value="closed">Cerrado</option></select></label>
              <label>Respuesta<textarea name="ticketResponse" defaultValue={editingTicket.adminResponse} placeholder="Escribe la solución o el seguimiento realizado." /></label>
              <div><button type="button" className="admin-secondary-button" disabled={saving} onClick={() => setEditingTicket(null)}>Volver</button><button className="admin-primary-button" disabled={saving}><CheckCircle2 size={17} /> {saving ? "Guardando…" : "Guardar respuesta"}</button></div>
            </form>
          </section>
        </div>
      )}

      {toast && <div className="toast"><CheckCircle2 size={20} /> {toast}</div>}
    </div>
  );
}
