import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Logo, Wordmark } from "@/components/logo";
import { GoogleIcon } from "@/components/google-icon";

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
            className="btn-ghost h-11 w-full !gap-3 !text-[14px]"
          >
            <GoogleIcon /> Continue with Google
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
            className="btn-ghost h-11 w-full !gap-3 !text-[14px]"
          >
            <GoogleIcon /> Continue with Google
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
