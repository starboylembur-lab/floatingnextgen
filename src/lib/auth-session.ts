import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

let initializationPromise: Promise<Session | null> | undefined;

async function initializeAuthSession(): Promise<Session | null> {
  if (typeof window === "undefined") return null;

  try {
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.substring(1));

    const access_token = hash.get("access_token");
    const refresh_token = hash.get("refresh_token");

    if (access_token && refresh_token) {
      const { data, error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      if (error) throw error;

      // tunggu session benar-benar tersimpan
      for (let i = 0; i < 10; i++) {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          window.history.replaceState({}, "", url.pathname);
          return session;
        }

        await new Promise((r) => setTimeout(r, 200));
      }
    }

    // PKCE flow
    if (url.searchParams.has("code")) {
      const { error } = await supabase.auth.exchangeCodeForSession(
        window.location.href
      );

      if (error) throw error;

      const {
        data: { session },
      } = await supabase.auth.getSession();

      return session;
    }
  } catch (err) {
    console.error(err);
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session;
}

export function initializeAuth() {
  initializationPromise ??= initializeAuthSession();
  return initializationPromise;
}

export async function consumeAuthFromUrl() {
  const session = await initializeAuth();
  return !!session;
}

export function hasAuthArtifactsInUrl() {
  if (typeof window === "undefined") return false;

  const url = new URL(window.location.href);

  return (
    url.hash.includes("access_token=") ||
    url.searchParams.has("code")
  );
}
