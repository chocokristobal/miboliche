"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, BarChart3, Check, ChevronDown, CircleDollarSign, Eye, EyeOff,
  FileBarChart, LockKeyhole, Package, Plus, ReceiptText, RotateCcw, Search,
  ShoppingBasket, ShoppingCart, Store, Truck, UserRound, Users, WalletCards,
  X,
} from "lucide-react";

type View = "resumen" | "ventas" | "inventario" | "productos" | "clientes" | "proveedores" | "gastos" | "reportes" | "administracion";
type Product = { id: number; name: string; category: string; price: number; stock: number };
type Sale = { id: number; date: string; items: number; total: number; payment: string };
type Client = { id: number; name: string; phone: string };
type Expense = { id: number; detail: string; amount: number; date: string };
type DemoData = { products: Product[]; sales: Sale[]; clients: Client[]; expenses: Expense[] };

const initialData: DemoData = {
  products: [
    { id: 1, name: "Bebida cola 1,5 L", category: "Bebidas", price: 2200, stock: 4 },
    { id: 2, name: "Pan de molde", category: "Abarrotes", price: 2600, stock: 3 },
    { id: 3, name: "Leche entera 1 L", category: "Lácteos", price: 1350, stock: 18 },
    { id: 4, name: "Arroz grado 1 kg", category: "Abarrotes", price: 1890, stock: 12 },
    { id: 5, name: "Aceite vegetal 900 ml", category: "Abarrotes", price: 2490, stock: 8 },
    { id: 6, name: "Galletas de chocolate", category: "Snacks", price: 990, stock: 24 },
  ],
  sales: [
    { id: 1004, date: "Hoy, 11:42", items: 3, total: 6590, payment: "Débito" },
    { id: 1003, date: "Hoy, 10:18", items: 5, total: 12850, payment: "Efectivo" },
    { id: 1002, date: "Ayer, 18:32", items: 2, total: 4380, payment: "Crédito" },
  ],
  clients: [
    { id: 1, name: "María González", phone: "+56 9 6123 4587" },
    { id: 2, name: "Pedro Soto", phone: "+56 9 7881 2034" },
    { id: 3, name: "Almacén Don Luis", phone: "+56 9 4455 6633" },
  ],
  expenses: [
    { id: 1, detail: "Reposición de mercadería", amount: 78500, date: "06 ago" },
    { id: 2, detail: "Cuenta de electricidad", amount: 42300, date: "03 ago" },
  ],
};

const money = (value: number) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
const labels: Record<View, string> = {
  resumen: "Resumen", ventas: "Ventas", inventario: "Inventario", productos: "Productos",
  clientes: "Clientes", proveedores: "Proveedores", gastos: "Gastos", reportes: "Reportes",
  administracion: "Administración",
};

function Brand() {
  return <div className="brand"><span className="brand-mark"><Store size={24}/><Check size={13}/></span><span>Mi Boliche</span></div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="demo-modal-backdrop" onMouseDown={onClose}><section className="demo-modal" onMouseDown={e => e.stopPropagation()}><header><h2>{title}</h2><button aria-label="Cerrar" onClick={onClose}><X size={20}/></button></header>{children}</section></div>;
}

function DemoDashboard({ onExit }: { onExit: () => void }) {
  const [view, setView] = useState<View>("resumen");
  const [data, setData] = useState<DemoData>(initialData);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<"sale" | "product" | "client" | "expense" | null>(null);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("mi-boliche-demo-v1");
    if (saved) { try { setData(JSON.parse(saved)); } catch {} }
  }, []);
  useEffect(() => { localStorage.setItem("mi-boliche-demo-v1", JSON.stringify(data)); }, [data]);

  const todaySales = data.sales.reduce((sum, sale) => sum + sale.total, 0);
  const lowStock = data.products.filter(product => product.stock <= 5);
  const cartTotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const product = data.products.find(item => item.id === Number(id));
    return sum + (product?.price || 0) * qty;
  }, 0);
  const filteredProducts = useMemo(() => data.products.filter(p => (p.name + p.category).toLowerCase().includes(query.toLowerCase())), [data.products, query]);

  const go = (next: View) => { setView(next); setQuery(""); };
  const flash = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2600); };
  const resetDemo = () => { setData(initialData); setCart({}); localStorage.removeItem("mi-boliche-demo-v1"); flash("Datos de demostración reiniciados"); };

  const completeSale = () => {
    const units = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
    if (!units) return;
    setData(current => ({
      ...current,
      products: current.products.map(product => ({ ...product, stock: Math.max(0, product.stock - (cart[product.id] || 0)) })),
      sales: [{ id: Math.max(...current.sales.map(s => s.id), 1000) + 1, date: "Ahora", items: units, total: cartTotal, payment: "Efectivo" }, ...current.sales],
    }));
    setCart({}); setModal(null); flash("Venta registrada y stock actualizado");
  };

  const nav: { id: View; icon: React.ReactNode }[] = [
    { id: "resumen", icon: <BarChart3 size={18}/> }, { id: "ventas", icon: <ShoppingCart size={18}/> },
    { id: "inventario", icon: <Package size={18}/> }, { id: "productos", icon: <ShoppingBasket size={18}/> },
    { id: "clientes", icon: <Users size={18}/> }, { id: "proveedores", icon: <Truck size={18}/> },
    { id: "gastos", icon: <WalletCards size={18}/> }, { id: "reportes", icon: <FileBarChart size={18}/> },
    { id: "administracion", icon: <UserRound size={18}/> },
  ];

  const TableProducts = ({ inventory = false }: { inventory?: boolean }) => <div className="demo-table-wrap"><table className="demo-table"><thead><tr><th>Producto</th><th>Categoría</th><th>Precio</th><th>Stock</th><th>Estado</th></tr></thead><tbody>{filteredProducts.map(product => <tr key={product.id}><td><strong>{product.name}</strong></td><td>{product.category}</td><td>{money(product.price)}</td><td>{product.stock} un.</td><td><span className={"status-pill " + (product.stock <= 5 ? "warning" : "ok")}>{product.stock <= 5 ? "Stock bajo" : inventory ? "Disponible" : "Activo"}</span></td></tr>)}</tbody></table></div>;

  return <main className="app-shell">
    <aside className="sidebar">
      <Brand/>
      <div className="business-pill"><span>MB</span><div><strong>Mi Boliche Demo</strong><small>Datos de prueba</small></div><ChevronDown size={16}/></div>
      <nav><p>GESTIÓN</p>{nav.map(item => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => go(item.id)}>{item.icon}{labels[item.id]}</button>)}</nav>
      <div className="sidebar-bottom"><button onClick={onExit}><ArrowLeft size={18}/> Cerrar demostración</button></div>
    </aside>
    <section className="main-area">
      <header className="topbar">
        <label className="global-search"><Search size={18}/><input aria-label="Buscar productos" value={query} onChange={e => setQuery(e.target.value)} onFocus={() => view !== "productos" && go("productos")} placeholder="Buscar productos..."/></label>
        <div className="top-actions"><div className="profile"><span>CV</span><div><strong>Usuario demo</strong><small>Administrador</small></div><ChevronDown size={15}/></div></div>
      </header>
      <div className="page-content">
        {view === "resumen" && <>
          <div className="page-heading"><div><span className="eyebrow">RESUMEN DEL NEGOCIO</span><h1>Buenos días 👋</h1><p>Todo lo importante de tu boliche, en un solo lugar.</p></div><button className="primary-button" onClick={() => setModal("sale")}><ShoppingCart size={18}/> Nueva venta</button></div>
          <div className="demo-metrics">
            <article><span><CircleDollarSign size={21}/></span><div><p>Ventas registradas</p><strong>{money(todaySales)}</strong><small>{data.sales.length} transacciones demo</small></div></article>
            <article><span className="blue"><Package size={21}/></span><div><p>Productos activos</p><strong>{data.products.length}</strong><small>Inventario actualizado</small></div></article>
            <article><span className="amber"><WalletCards size={21}/></span><div><p>Gastos registrados</p><strong>{money(data.expenses.reduce((s,e) => s + e.amount, 0))}</strong><small>Durante la demostración</small></div></article>
          </div>
          <div className="demo-two-cols">
            <article className="demo-panel"><div className="demo-panel-head"><div><span className="eyebrow">ÚLTIMOS MOVIMIENTOS</span><h2>Ventas recientes</h2></div><button onClick={() => go("ventas")}>Ver todas</button></div>{data.sales.slice(0,4).map(sale => <div className="demo-list-row" key={sale.id}><span className="round-icon"><ReceiptText size={18}/></span><div><strong>Venta #{sale.id}</strong><small>{sale.date} · {sale.items} productos</small></div><b>{money(sale.total)}</b></div>)}</article>
            <article className="demo-panel"><div className="demo-panel-head"><div><span className="eyebrow amber-text">REQUIERE ATENCIÓN</span><h2>{lowStock.length} productos con poco stock</h2></div></div>{lowStock.map(product => <button className="demo-list-row row-button" key={product.id} onClick={() => go("inventario")}><span className="round-icon amber">{product.stock}</span><div><strong>{product.name}</strong><small>Quedan {product.stock} unidades</small></div></button>)}<button className="outline-button full" onClick={() => go("inventario")}>Revisar inventario</button></article>
          </div>
        </>}

        {view !== "resumen" && <div className="page-heading"><div><span className="eyebrow">MODO DEMOSTRACIÓN</span><h1>{labels[view]}</h1><p>Prueba esta sección con datos locales; no afecta información real.</p></div>
          {view === "ventas" && <button className="primary-button" onClick={() => setModal("sale")}><Plus size={18}/> Nueva venta</button>}
          {view === "productos" && <button className="primary-button" onClick={() => setModal("product")}><Plus size={18}/> Agregar producto</button>}
          {view === "clientes" && <button className="primary-button" onClick={() => setModal("client")}><Plus size={18}/> Nuevo cliente</button>}
          {view === "gastos" && <button className="primary-button" onClick={() => setModal("expense")}><Plus size={18}/> Registrar gasto</button>}
        </div>}

        {(view === "inventario" || view === "productos") && <section className="demo-panel"><div className="demo-panel-head"><div><h2>{view === "inventario" ? "Estado del inventario" : "Catálogo de productos"}</h2><p>{filteredProducts.length} resultados</p></div></div><TableProducts inventory={view === "inventario"}/></section>}

        {view === "ventas" && <section className="demo-panel"><div className="demo-panel-head"><div><h2>Historial de ventas</h2><p>Operaciones simuladas</p></div></div><div className="demo-table-wrap"><table className="demo-table"><thead><tr><th>Folio</th><th>Fecha</th><th>Productos</th><th>Pago</th><th>Total</th></tr></thead><tbody>{data.sales.map(s => <tr key={s.id}><td>#{s.id}</td><td>{s.date}</td><td>{s.items}</td><td>{s.payment}</td><td><strong>{money(s.total)}</strong></td></tr>)}</tbody></table></div></section>}

        {view === "clientes" && <section className="demo-card-grid">{data.clients.map(client => <article className="person-card" key={client.id}><span><UserRound size={22}/></span><div><strong>{client.name}</strong><small>{client.phone}</small></div></article>)}</section>}

        {view === "proveedores" && <section className="demo-card-grid">{["Distribuidora Central","Comercial Los Andes","Bebidas del Sur"].map((name, i) => <article className="person-card" key={name}><span><Truck size={22}/></span><div><strong>{name}</strong><small>{i === 0 ? "Entrega los lunes" : i === 1 ? "Abarrotes y limpieza" : "Bebidas y refrigerados"}</small></div></article>)}</section>}

        {view === "gastos" && <section className="demo-panel">{data.expenses.map(expense => <div className="demo-list-row" key={expense.id}><span className="round-icon red"><WalletCards size={18}/></span><div><strong>{expense.detail}</strong><small>{expense.date}</small></div><b>{money(expense.amount)}</b></div>)}</section>}

        {view === "reportes" && <div className="report-grid"><article className="demo-panel report-chart"><span className="eyebrow">VENTAS DE LA SEMANA</span><h2>{money(todaySales)}</h2><div className="bars">{[42,68,51,82,64,91,76].map((height,i) => <div key={i}><i style={{height: height + "%"}}/><small>{["L","M","X","J","V","S","D"][i]}</small></div>)}</div></article><article className="demo-panel report-summary"><h2>Resumen demo</h2><p><span>Ingresos</span><b>{money(todaySales)}</b></p><p><span>Gastos</span><b>{money(data.expenses.reduce((s,e)=>s+e.amount,0))}</b></p><p className="total"><span>Resultado</span><b>{money(todaySales-data.expenses.reduce((s,e)=>s+e.amount,0))}</b></p></article></div>}

        {view === "administracion" && <section className="demo-panel settings-demo"><h2>Configuración de demostración</h2><p>Los cambios se guardan únicamente en este navegador.</p><div className="settings-business"><span className="brand-mark"><Store size={22}/></span><div><strong>Mi Boliche Demo</strong><small>Administrador · Pesos chilenos (CLP)</small></div></div><button className="outline-button" onClick={resetDemo}><RotateCcw size={17}/> Reiniciar todos los datos de prueba</button></section>}
      </div>
    </section>

    {modal === "sale" && <Modal title="Nueva venta" onClose={() => setModal(null)}><div className="sale-products">{data.products.map(product => <button key={product.id} disabled={!product.stock} onClick={() => setCart(c => ({...c, [product.id]: (c[product.id] || 0) + 1}))}><div><strong>{product.name}</strong><small>{money(product.price)} · {product.stock} disponibles</small></div><span>{cart[product.id] || 0}<Plus size={15}/></span></button>)}</div><footer className="modal-total"><div><small>Total</small><strong>{money(cartTotal)}</strong></div><button className="primary-button" disabled={!cartTotal} onClick={completeSale}>Completar venta</button></footer></Modal>}

    {modal === "product" && <Modal title="Agregar producto" onClose={() => setModal(null)}><form className="demo-form" onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); setData(d => ({...d, products:[...d.products,{id:Date.now(),name:String(f.get("name")),category:String(f.get("category")),price:Number(f.get("price")),stock:Number(f.get("stock"))}]})); setModal(null); flash("Producto agregado al catálogo"); }}><label>Nombre<input name="name" required placeholder="Ej. Café instantáneo"/></label><label>Categoría<input name="category" required placeholder="Abarrotes"/></label><div><label>Precio<input name="price" required min="1" type="number"/></label><label>Stock inicial<input name="stock" required min="0" type="number"/></label></div><button className="primary-button" type="submit">Guardar producto</button></form></Modal>}

    {modal === "client" && <Modal title="Nuevo cliente" onClose={() => setModal(null)}><form className="demo-form" onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f=new FormData(e.currentTarget); setData(d=>({...d,clients:[...d.clients,{id:Date.now(),name:String(f.get("name")),phone:String(f.get("phone"))}]})); setModal(null); flash("Cliente agregado"); }}><label>Nombre<input name="name" required/></label><label>Teléfono<input name="phone" required placeholder="+56 9..."/></label><button className="primary-button">Guardar cliente</button></form></Modal>}

    {modal === "expense" && <Modal title="Registrar gasto" onClose={() => setModal(null)}><form className="demo-form" onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f=new FormData(e.currentTarget); setData(d=>({...d,expenses:[{id:Date.now(),detail:String(f.get("detail")),amount:Number(f.get("amount")),date:"Hoy"},...d.expenses]})); setModal(null); flash("Gasto registrado"); }}><label>Descripción<input name="detail" required placeholder="Ej. Compra de mercadería"/></label><label>Monto<input name="amount" required min="1" type="number"/></label><button className="primary-button">Guardar gasto</button></form></Modal>}

    {notice && <div className="demo-toast"><Check size={18}/>{notice}</div>}
  </main>;
}

export default function HomePage() {
  const [showPassword, setShowPassword] = useState(false);
  const [demo, setDemo] = useState(false);
  if (demo) return <DemoDashboard onExit={() => setDemo(false)}/>;
  return <main className="login-page"><section className="login-story"><Brand/><div className="story-copy"><span className="eyebrow light">TU NEGOCIO, MÁS SIMPLE</span><h1>Haz crecer<br/>tu boliche.</h1><p>Controla ventas, inventario y resultados desde un solo lugar, pensado para los pequeños negocios de Chile.</p><div className="story-points"><span><Check size={19}/> Registra ventas en segundos</span><span><Check size={19}/> Mantén tu inventario al día</span><span><Check size={19}/> Entiende cómo va tu negocio</span></div></div><small>© 2026 Mi Boliche · Hecho para emprendedores</small></section><section className="login-panel"><div className="mobile-login-brand"><Brand/></div><form className="login-card" onSubmit={e => {e.preventDefault(); setDemo(true);}}><span className="icon-badge large"><LockKeyhole size={24}/></span><h2>Bienvenido</h2><p>Ingresa a tu cuenta para continuar.</p><label>Correo electrónico<span className="input-wrap"><UserRound size={18}/><input required type="email" placeholder="tu@negocio.cl"/></span></label><label>Contraseña<span className="input-wrap"><LockKeyhole size={18}/><input required type={showPassword ? "text" : "password"} placeholder="Tu contraseña"/><button className="icon-button" type="button" aria-label="Mostrar contraseña" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></span></label><button className="primary-button full" type="submit">Ingresar</button><button className="demo-button" type="button" onClick={() => setDemo(true)}><BarChart3 size={18}/> Explorar modo demostración</button><div className="register-note">La cuenta real se conectará en la siguiente etapa.</div></form></section></main>;
}
