import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Ensure the user_stats row exists, activate trial if not yet started, and return current stats.
export const initUserStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // Upsert defaults
    await supabase.from("user_stats").upsert({ user_id: userId }, { onConflict: "user_id" });
    const { data: stats } = await supabase.from("user_stats").select("*").eq("user_id", userId).maybeSingle();
    return stats;
  });

// Manually activate the 2-day premium trial. Only allowed once per user.
export const activateTrial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase.from("user_stats").select("*").eq("user_id", userId).maybeSingle();
    if (existing?.trial_started_at) {
      throw new Error("Trial already activated");
    }
    const now = new Date();
    const end = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    await supabase.from("user_stats").update({
      trial_started_at: now.toISOString(),
      trial_ends_at: end.toISOString(),
    }).eq("user_id", userId);
    const { data: stats } = await supabase.from("user_stats").select("*").eq("user_id", userId).maybeSingle();
    return stats;
  });

export const addCapacity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((amount: number) => Math.max(0, Math.min(50, Math.floor(amount || 0))))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: cur } = await supabase.from("user_stats").select("capacity, capacity_max").eq("user_id", userId).maybeSingle();
    if (!cur) return null;
    const next = Math.min(cur.capacity_max, cur.capacity + data);
    await supabase.from("user_stats").update({ capacity: next }).eq("user_id", userId);
    return { capacity: next, capacity_max: cur.capacity_max };
  });