import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
useEffect(() => {
  async function init() {
    // Jika baru kembali dari Google OAuth
    if (window.location.search.includes("code=")) {
      const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);

      if (error) {
        console.error(error);
      }

      // Bersihkan URL
      window.history.replaceState({}, "", window.location.pathname);
    }

    const { data } = await supabase.auth.getSession();

    if (data.session) {
      navigate({ to: "/home", replace: true });
    } else {
      setReady(true);
    }
  }

  init();

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
      navigate({ to: "/home", replace: true });
    }
  });

  return () => subscription.unsubscribe();
}, [navigate]);

  if (!ready) {
    return (
      <div className="stars flex min-h-screen items-center justify-center bg-black">
        <div className="animate-pulse-glow"><Logo size={56} /></div>
      </div>
    );
  }

  return (
    <div className="stars relative min-h-screen overflow-hidden bg-black text-white">
      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col px-6 pb-10 pt-16 safe-top">
        <div className="flex items-center gap-3 animate-float-in">
          <Logo size={40} />
          <div>
            <Wordmark className="text-lg" />
            <p className="text-[11px] text-muted-foreground">by HanStack</p>
          </div>
        </div>

        <div className="mt-16 flex flex-1 flex-col items-center text-center">
          <Logo size={96} />
          <h1 className="mt-8 text-3xl font-semibold leading-tight tracking-tight">
            Ask anything.
          </h1>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
            Research, reasoning and image generation in one simple assistant.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3">
          <Link to="/auth" className="btn-primary h-12 text-[15px]">
            Get started <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="text-center text-[11px] text-muted-foreground">
            2-day premium trial · unlocked on sign-in
          </p>
        </div>
      </div>
    </div>
  );
}
