async function initializeAuthSession(): Promise<Session | null> {
  if (typeof window === "undefined") return null;

  try {
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));

    const access_token = hash.get("access_token");
    const refresh_token = hash.get("refresh_token");

    if (access_token && refresh_token) {
      alert("Found OAuth hash");

      const { data, error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      alert(
        JSON.stringify(
          {
            session: !!data.session,
            error: error?.message ?? null,
          },
          null,
          2
        )
      );

      if (error) throw error;

      window.history.replaceState({}, "", url.pathname);

      return data.session;
    }
  } catch (err) {
    alert(
      JSON.stringify(
        {
          authError:
            err instanceof Error ? err.message : String(err),
        },
        null,
        2
      )
    );

    console.error("[auth] consumeAuthFromUrl", err);
  }

  const { data } = await supabase.auth.getSession();

  alert(
    JSON.stringify(
      {
        existingSession: !!data.session,
      },
      null,
      2
    )
  );

  return data.session;
}
