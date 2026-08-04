import { supabase } from "@/integrations/supabase/client";

/**
 * Consumes Supabase auth artifacts from the current URL.
 * Supports the implicit/hash flow (#access_token=...) and PKCE (?code=...).
 * Returns true when a session exists after processing.
 */
export async function consumeAuthFromUrl(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  try {
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));

    const access_token = hash.get("access_token");
    const refresh_token = hash.get("refresh_token");

    if (access_token && refresh_token) {
      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (error) console.error("[auth] setSession failed", error);
      // Strip tokens from the URL so they are not left in history.
      window.history.replaceState({}, "", url.pathname + url.search);
    } else if (url.searchParams.has("code")) {
      const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
      if (error) console.error("[auth] exchangeCodeForSession failed", error);
      url.searchParams.delete("code");
      url.searchParams.delete("state");
      window.history.replaceState({}, "", url.pathname + (url.search || ""));
    }
  } catch (err) {
    console.error("[auth] consumeAuthFromUrl", err);
  }

  const { data } = await supabase.auth.getSession();
  return Boolean(data.session?.user);
}

export function hasAuthArtifactsInUrl(): boolean {
  if (typeof window === "undefined") return false;
  const url = new URL(window.location.href);
  return url.hash.includes("access_token=") || url.searchParams.has("code");
}