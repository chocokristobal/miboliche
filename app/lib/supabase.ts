import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type RuntimeSupabaseConfig = {
  supabasePublishableKey?: string;
  supabaseUrl?: string;
};

/**
 * Browser client used only with Supabase's public/publishable key.
 * Authorization remains enforced by the Row Level Security policies in Supabase.
 */
export let supabase: SupabaseClient | null = null;

export const isSupabaseConfigured = () => Boolean(supabase);

export async function initializeSupabase(): Promise<SupabaseClient | null> {
  if (supabase) return supabase;
  if (typeof window === "undefined") return null;

  let supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  let supabasePublishableKey =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    try {
      const response = await fetch("/runtime-config.json", {
        cache: "no-store",
      });
      if (response.ok) {
        const runtimeConfig =
          (await response.json()) as RuntimeSupabaseConfig;
        supabaseUrl = runtimeConfig.supabaseUrl || "";
        supabasePublishableKey =
          runtimeConfig.supabasePublishableKey || "";
      }
    } catch {
      return null;
    }
  }

  if (!supabaseUrl || !supabasePublishableKey) return null;

  supabase = createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });

  return supabase;
}

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error("Supabase no está configurado. Define VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY.");
  }

  return supabase;
}
