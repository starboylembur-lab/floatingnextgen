import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

/**
 * Consumes Supabase auth artifacts from the current URL.
 * Supports the implicit/hash flow (#access_token=...) and PKCE (?code=...).
 * Returns true when a session exists after processing.
 */
let initializationPromise: Promise<Session | null> | undefined;

async function initializeAuthSession(): Promise<Session | null> {
  if (typeof window === "undefined") return null;

  try {
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));

    const access_token = hash.get("access_token");
    const refresh_token = hash.get("refresh_token");

    if (access_token && refresh_token) {
  console.log("Found OAuth hash");
  const { data, error } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });

  console.log("setSession:", data, error);

  if (error) throw error;

  window.history.replaceState({}, "", url.pathname);

  return data.session;
}
  } catch (err) {
    console.error("[auth] consumeAuthFromUrl", err);
  }

  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Runs once per page load and restores hash, PKCE, or persisted sessions. */
export function initializeAuth(): Promise<Session | null> {
  initializationPromise ??= initializeAuthSession();
  return initializationPromise;
}

export async function consumeAuthFromUrl(): Promise<boolean> {
  const session = await initializeAuth();
  return Boolean(session?.user);
}

export function hasAuthArtifactsInUrl(): boolean {
  if (typeof window === "undefined") return false;
  const url = new URL(window.location.href);
  return url.hash.includes("access_token=") || url.searchParams.has("code");
}
