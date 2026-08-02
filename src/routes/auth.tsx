import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import { Logo, Wordmark } from "@/components/logo";
import { ArrowLeft, Mail, Phone, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Floating Space" },
      { name: "description", content: "Sign in to unlock your 2-day premium trial and start exploring Floating Space." },
    ],
  }),
  component: AuthPage,
});

type Tab = "email" | "phone";

function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("email");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/home", replace: true });
    });
  }, [navigate]);

  return (
    <div className="stars relative min-h-screen">
      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col px-6 pb-10 pt-6 safe-top">
        <Link to="/" className="btn-ghost h-9 w-9 !p-0 self-start"><ArrowLeft className="h-4 w-4" /></Link>

        <div className="mt-8 flex flex-col items-center text-center">
          <Logo size={72} />
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">
            Welcome to <Wordmark />
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Sign in to activate your 2-day premium trial.
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-border p-5">
          <button
            disabled={loading}
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

                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-full py-2 font-medium capitalize transition-all ${tab === t ? "bg-background text-foreground" : "text-muted-foreground"}`}
              >
                {t === "email" ? "Email" : "Phone"}
              </button>
            ))}
          </div>

          {tab === "email" ? <EmailForm setLoading={setLoading} loading={loading} /> : <PhoneForm setLoading={setLoading} loading={loading} />}
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          By continuing you agree to our futuristic terms and mystical privacy policy.
        </p>
      </div>
    </div>
  );
}

function EmailForm({ setLoading, loading }: { setLoading: (b: boolean) => void; loading: boolean }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Account created", { description: "Check your inbox to confirm your email, then sign in." });
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
        navigate({ to: "/home", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally { setLoading(false); }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="flex items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2.5 focus-within:border-ring">
        <Mail className="h-4 w-4 text-muted-foreground" />
        <input
          type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="you@futuristic.ai"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </label>
      <input
        type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="rounded-xl border border-border bg-muted px-3 py-2.5 text-sm outline-none focus:border-ring"
      />
      <button disabled={loading} className="btn-primary h-11 mt-1">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "signup" ? "Create account" : "Sign in"}
      </button>
      <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="text-center text-xs text-muted-foreground hover:text-foreground">
        {mode === "signin" ? "New here? Create an account" : "Have an account? Sign in"}
      </button>
    </form>
  );
}

function PhoneForm({ setLoading, loading }: { setLoading: (b: boolean) => void; loading: boolean }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) throw error;
      setSent(true);
      toast.success("Code sent", { description: "Enter the 6-digit code we sent to your phone." });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send code");
    } finally { setLoading(false); }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ phone, token: code, type: "sms" });
      if (error) throw error;
      toast.success("Signed in");
      navigate({ to: "/home", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
    } finally { setLoading(false); }
  }

  if (!sent) {
    return (
      <form onSubmit={sendCode} className="flex flex-col gap-3">
        <label className="flex items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2.5 focus-within:border-ring">
          <Phone className="h-4 w-4 text-muted-foreground" />
          <input
            type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="+62 812 3456 7890"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
        <button disabled={loading} className="btn-primary h-11">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send verification code"}
        </button>
        <p className="text-center text-[11px] text-muted-foreground">Standard SMS rates may apply.</p>
      </form>
    );
  }
  return (
    <form onSubmit={verify} className="flex flex-col gap-3">
      <p className="text-center text-xs text-muted-foreground">Code sent to <span className="text-foreground">{phone}</span></p>
      <input
        inputMode="numeric" required maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        placeholder="123456"
        className="rounded-xl border border-border bg-muted px-3 py-3 text-center font-mono text-lg tracking-[0.5em] outline-none focus:border-ring"
      />
      <button disabled={loading || code.length < 6} className="btn-primary h-11">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & continue"}
      </button>
      <button type="button" onClick={() => setSent(false)} className="text-center text-xs text-muted-foreground hover:text-foreground">
        Use a different number
      </button>
    </form>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.3-1.7 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.3 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12S6.7 21.6 12 21.6c6.9 0 11.5-4.9 11.5-11.7 0-.8-.1-1.4-.2-1.9H12z"/>
    </svg>
  );
}
