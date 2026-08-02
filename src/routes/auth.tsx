import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Logo, Wordmark } from "@/components/logo";

type Tab = "email" | "phone";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("email");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  return (
    <div className="stars relative min-h-screen bg-black text-white flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="relative z-10 mx-auto w-full max-w-md px-4">
        <Link to="/" className="btn-ghost mb-6 inline-flex items-center gap-2 text-sm">
          ← Back to home
        </Link>

        <div className="mt-8 flex flex-col items-center text-center">
          <Logo size={72} />
          <h1 className="mt-5 text-2xl font-bold">
            Welcome to <Wordmark />
          </h1>
          <p className="mt-1.5 text-sm text-gray-400">
            Sign in to activate your 2-day free trial
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <button
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              try {
                const { error } = await supabase.auth.signInWithOAuth({
                  provider: "google",
                  options: {
                    redirectTo: `${window.location.origin}/`,
                  },
                });
                if (error) throw error;
              } catch (e: any) {
                toast.error(e?.message || "Google sign-in failed");
                setLoading(false);
              }
            }}
            className="btn-ghost h-11 w-full !gap-3 !text-[14px] flex items-center justify-center"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3 text-xs text-gray-500">
            <div className="h-px flex-1 bg-white/10" />
            OR
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <div className="flex rounded-lg bg-white/5 p-1 mb-6">
            {(["email", "phone"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-md py-1.5 text-xs font-medium capitalize transition-all ${
                  tab === t ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                {t === "email" ? "Email" : "Phone"}
              </button>
            ))}
          </div>

          <p className="mt-6 text-center text-xs text-gray-400">
            By continuing you agree to our terms of service and privacy policy.
          </p>
        </div>
      </div>
    </div>
  );
}
