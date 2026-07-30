"use client";

import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Store,
  TrendingUp,
  User,
} from "lucide-react";
import { FormEvent, useState } from "react";
import { isSupabaseConfigured, requireSupabase } from "./lib/supabase";
import LegalDocument, { type LegalDocumentType } from "./LegalDocument";

type AuthMode = "login" | "register" | "forgot" | "recovery";

type AuthPanelProps = {
  recoveryMode: boolean;
  notice?: string;
  onRecoveryComplete: () => void;
};

const authErrorMessage = (message: string) => {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) return "El correo o la contraseña no son correctos.";
  if (normalized.includes("email not confirmed")) return "Debes confirmar tu correo antes de ingresar.";
  if (normalized.includes("user already registered")) return "Ya existe una cuenta asociada a este correo.";
  if (normalized.includes("password should be")) return "La contraseña debe tener al menos 8 caracteres.";
  if (normalized.includes("rate limit")) return "Se hicieron demasiados intentos. Espera unos minutos e inténtalo nuevamente.";
  return "No pudimos completar la solicitud. Revisa los datos e inténtalo nuevamente.";
};

function Brand() {
  return (
    <div className="brand" aria-label="miboliche.cl">
      <span className="brand-mark" aria-hidden="true">
        <Store size={24} strokeWidth={2.4} />
        <TrendingUp size={12} strokeWidth={3} />
      </span>
      <span>miboliche.cl</span>
    </div>
  );
}

export default function AuthPanel({ recoveryMode, notice, onRecoveryComplete }: AuthPanelProps) {
  const [mode, setMode] = useState<AuthMode>(recoveryMode ? "recovery" : "login");
  const [showPassword, setShowPassword] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState(notice || "");
  const [isError, setIsError] = useState(Boolean(notice));
  const [legalDocument, setLegalDocument] = useState<LegalDocumentType | null>(null);

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setMessage("");
    setIsError(false);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setWorking(true);
    setMessage("");
    setIsError(false);

    if (!isSupabaseConfigured()) {
      setMessage("La conexión segura con Supabase aún no está configurada en este entorno.");
      setIsError(true);
      setWorking(false);
      return;
    }

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    const client = requireSupabase();

    try {
      if (mode === "login") {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setMessage("Ingreso correcto. Estamos cargando tu negocio…");
        return;
      }

      if (mode === "register") {
        const fullName = String(form.get("fullName") || "").trim();
        const businessName = String(form.get("businessName") || "").trim();
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: fullName,
              business_name: businessName,
            },
          },
        });
        if (error) throw error;
        if (data.session) {
          setMessage("Cuenta creada. Estamos preparando tu negocio…");
        } else {
          setMessage("Cuenta creada. Revisa tu correo y confirma el enlace para continuar.");
        }
        return;
      }

      if (mode === "forgot") {
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setMessage("Te enviamos un enlace para crear una nueva contraseña.");
        return;
      }

      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      setMessage("Tu contraseña fue actualizada correctamente.");
      onRecoveryComplete();
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "";
      setMessage(authErrorMessage(rawMessage));
      setIsError(true);
    } finally {
      setWorking(false);
    }
  };

  const title =
    mode === "register" ? "Crea tu cuenta" :
    mode === "forgot" ? "Recupera tu acceso" :
    mode === "recovery" ? "Nueva contraseña" :
    "Bienvenido";

  const description =
    mode === "register" ? "Comienza con 14 días de prueba para ordenar tu negocio." :
    mode === "forgot" ? "Ingresa tu correo y te enviaremos un enlace seguro." :
    mode === "recovery" ? "Elige una contraseña nueva de al menos 8 caracteres." :
    "Ingresa para ver cómo va tu negocio.";

  return (
    <main className="login-page">
      <section className="login-story">
        <Brand />
        <div className="story-copy">
          <span className="eyebrow light">SIMPLE · CLARO · DESDE CUALQUIER EQUIPO</span>
          <h1>Tu boliche,<br />más ordenado.</h1>
          <p>Ventas, inventario y metas explicadas sin enredos. Úsalo desde el computador o desde tu teléfono.</p>
          <div className="story-points">
            <span><Check size={17} /> Registra una venta en segundos</span>
            <span><Check size={17} /> Recibe alertas antes de quedarte sin stock</span>
            <span><Check size={17} /> Entiende cuánto está dejando tu negocio</span>
          </div>
        </div>
        <small>Hecho para almacenes y minimarkets de Chile.</small>
      </section>

      <section className="login-panel">
        <div className="mobile-login-brand"><Brand /></div>
        <form className="login-card" onSubmit={submit}>
          <span className="icon-badge green large">
            {mode === "forgot" || mode === "recovery" ? <LockKeyhole size={26} /> : <User size={26} />}
          </span>
          <h2>{title}</h2>
          <p>{description}</p>

          {mode === "register" && (
            <>
              <label>
                Tu nombre
                <span className="input-wrap"><User size={19} /><input name="fullName" autoComplete="name" placeholder="Nombre y apellido" required /></span>
              </label>
              <label>
                Nombre del negocio
                <span className="input-wrap"><Store size={19} /><input name="businessName" autoComplete="organization" placeholder="Ej: Almacén El Ahorrito" required /></span>
              </label>
            </>
          )}

          {mode !== "recovery" && (
            <label>
              Correo
              <span className="input-wrap"><Mail size={19} /><input name="email" type="email" autoComplete="email" placeholder="nombre@correo.cl" required /></span>
            </label>
          )}

          {mode !== "forgot" && (
            <label>
              Contraseña
              <span className="input-wrap">
                <LockKeyhole size={19} />
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  minLength={8}
                  placeholder="Mínimo 8 caracteres"
                  required
                />
                <button type="button" className="icon-button" onClick={() => setShowPassword(!showPassword)} aria-label="Mostrar u ocultar contraseña">
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </span>
            </label>
          )}

          {mode === "register" && (
            <label className="legal-consent">
              <input name="legalConsent" type="checkbox" required />
              <span>
                Acepto los{" "}
                <button type="button" onClick={() => setLegalDocument("terms")}>Términos de uso</button>
                {" "}y la{" "}
                <button type="button" onClick={() => setLegalDocument("privacy")}>Política de privacidad</button>.
              </span>
            </label>
          )}

          {mode === "login" && (
            <div className="login-options">
              <span />
              <button type="button" className="text-button" onClick={() => changeMode("forgot")}>¿Olvidaste tu contraseña?</button>
            </div>
          )}

          {message && <div className={`auth-message ${isError ? "error" : "success"}`} role={isError ? "alert" : "status"}>{message}</div>}

          <button className="primary-button full" type="submit" disabled={working}>
            {working ? "Procesando…" : mode === "register" ? "Crear cuenta" : mode === "forgot" ? "Enviar enlace" : mode === "recovery" ? "Guardar contraseña" : "Ingresar"}
            {!working && <ArrowUpRight size={19} />}
          </button>

          {mode === "login" && <div className="register-note">¿Aún no tienes cuenta? <button type="button" onClick={() => changeMode("register")}>Crear cuenta</button></div>}
          {mode === "register" && <div className="register-note">¿Ya tienes una cuenta? <button type="button" onClick={() => changeMode("login")}>Ingresar</button></div>}
          {mode === "forgot" && <button className="auth-back-button" type="button" onClick={() => changeMode("login")}><ArrowLeft size={17} /> Volver al ingreso</button>}
          <div className="auth-legal-links">
            <button type="button" onClick={() => setLegalDocument("terms")}>Términos</button>
            <span aria-hidden="true">·</span>
            <button type="button" onClick={() => setLegalDocument("privacy")}>Privacidad</button>
          </div>
        </form>
      </section>
      {legalDocument && <LegalDocument type={legalDocument} onClose={() => setLegalDocument(null)} />}
    </main>
  );
}
