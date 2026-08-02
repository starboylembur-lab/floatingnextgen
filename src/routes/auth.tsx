<button
  disabled={loading}
  onClick={async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
      });
      if (error) throw error;
    } catch (e: any) {
      toast.error(e?.message || "Google sign-in failed");
      setLoading(false);
    }
  }}
  className="btn-ghost h-11 w-full !gap-3 !text-[14px] flex items-center justify-center"
>
