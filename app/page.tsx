"use client";

import { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  LockKeyhole,
  Package,
  Search,
  ShoppingCart,
  Store,
  TrendingUp,
  UserRound,
} from "lucide-react";

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <Store size={24} />
        <Check size={13} />
      </span>
      <span>Mi Boliche</span>
    </div>
  );
}

function DemoDashboard({ onExit }: { onExit: () => void }) {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="business-pill">
          <span>MB</span>
          <div><strong>Mi Boliche Demo</strong><small>Negocio de prueba</small></div>
          <ChevronDown size={16} />
        </div>
        <nav>
          <p>GESTIÓN</p>
          <button className="active"><BarChart3 size={19} /> Resumen</button>
          <button><ShoppingCart size={19} /> Ventas</button>
          <button><Package size={19} /> Inventario</button>
        </nav>
        <div className="sidebar-bottom">
          <button onClick={onExit}><UserRound size={19} /> Cerrar demostración</button>
        </div>
      </aside>
      <section className="main-area">
        <header className="topbar">
          <label className="global-search">
            <Search size={18} />
            <input aria-label="Buscar" placeholder="Buscar productos, ventas o clientes..." />
          </label>
          <div className="top-actions">
            <div className="profile"><span>CV</span><div><strong>Usuario demo</strong><small>Administrador</small></div><ChevronDown size={15} /></div>
          </div>
        </header>
        <div className="page-content">
          <div className="page-heading">
            <div><span className="eyebrow">RESUMEN DEL NEGOCIO</span><h1>Buenos días 👋</h1><p>Todo lo importante de tu boliche, en un solo lugar.</p></div>
            <button className="primary-button"><ShoppingCart size={18} /> Nueva venta</button>
          </div>
          <div className="dashboard-grid">
            <article className="goal-card">
              <div className="goal-top"><div><span className="eyebrow">META MENSUAL</span><h2>Ventas de agosto</h2></div><TrendingUp size={21} color="#059669" /></div>
              <div className="goal-body">
                <div className="progress-ring" style={{ "--progress": "244deg" } as React.CSSProperties}><div><strong>68%</strong><span>COMPLETADO</span></div></div>
                <div className="goal-numbers"><span>Ventas acumuladas</span><strong>$1.360.000</strong><p>de una meta de $2.000.000</p><div className="goal-message"><Check size={16} /> Vas por muy buen camino</div></div>
              </div>
            </article>
            <div className="stats-stack">
              <article className="stat-card"><span className="icon-badge"><ShoppingCart size={21} /></span><div><p>Ventas de hoy</p><strong>$184.500</strong><small>12 transacciones</small></div></article>
              <article className="stat-card"><span className="icon-badge blue"><Package size={21} /></span><div><p>Productos activos</p><strong>248</strong><small>Inventario actualizado</small></div></article>
            </div>
            <article className="attention-card">
              <div className="attention-title"><span className="icon-badge amber"><Package size={21} /></span><div><span className="eyebrow amber-text">REQUIERE ATENCIÓN</span><h3>3 productos con poco stock</h3></div></div>
              <div className="attention-products">
                <button><span className="icon-badge">1</span><div><strong>Bebida 1,5 L</strong><small>Quedan 4 unidades</small></div><ArrowRight size={15} /></button>
                <button><span className="icon-badge">2</span><div><strong>Pan molde</strong><small>Quedan 3 unidades</small></div><ArrowRight size={15} /></button>
              </div>
              <button className="outline-button full">Revisar inventario</button>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function HomePage() {
  const [showPassword, setShowPassword] = useState(false);
  const [demo, setDemo] = useState(false);

  if (demo) return <DemoDashboard onExit={() => setDemo(false)} />;

  return (
    <main className="login-page">
      <section className="login-story">
        <Brand />
        <div className="story-copy">
          <span className="eyebrow light">TU NEGOCIO, MÁS SIMPLE</span>
          <h1>Haz crecer<br />tu boliche.</h1>
          <p>Controla ventas, inventario y resultados desde un solo lugar, pensado para los pequeños negocios de Chile.</p>
          <div className="story-points">
            <span><Check size={19} /> Registra ventas en segundos</span>
            <span><Check size={19} /> Mantén tu inventario al día</span>
            <span><Check size={19} /> Entiende cómo va tu negocio</span>
          </div>
        </div>
        <small>© 2026 Mi Boliche · Hecho para emprendedores</small>
      </section>
      <section className="login-panel">
        <div className="mobile-login-brand"><Brand /></div>
        <form className="login-card" onSubmit={(event) => { event.preventDefault(); setDemo(true); }}>
          <span className="icon-badge large"><LockKeyhole size={24} /></span>
          <h2>Bienvenido</h2>
          <p>Ingresa a tu cuenta para continuar.</p>
          <label>Correo electrónico
            <span className="input-wrap"><UserRound size={18} /><input required type="email" placeholder="tu@negocio.cl" /></span>
          </label>
          <label>Contraseña
            <span className="input-wrap"><LockKeyhole size={18} /><input required type={showPassword ? "text" : "password"} placeholder="Tu contraseña" /><button className="icon-button" type="button" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span>
          </label>
          <div className="login-options"><label className="checkbox-label"><input type="checkbox" /> Recordarme</label><button type="button" className="text-button">¿Olvidaste tu contraseña?</button></div>
          <button className="primary-button full" type="submit">Ingresar <ArrowRight size={18} /></button>
          <button className="demo-button" type="button" onClick={() => setDemo(true)}><BarChart3 size={18} /> Explorar modo demostración</button>
          <div className="register-note">¿Aún no tienes cuenta? <button type="button">Crear una cuenta</button></div>
        </form>
      </section>
    </main>
  );
}
