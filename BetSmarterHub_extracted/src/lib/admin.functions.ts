import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const [users, picks, votes, chats, bets] = await Promise.all([
      supabaseAdmin.from("user_profiles").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("match_predictions").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("match_votes").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("match_chat").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("bets").select("*", { count: "exact", head: true }),
    ]);
    return {
      users: users.count ?? 0,
      predictions: picks.count ?? 0,
      votes: votes.count ?? 0,
      chats: chats.count ?? 0,
      bets: bets.count ?? 0,
    };
  });

export interface AdminUserRow {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  xp: number;
  badges: string[];
  favorite_team: string | null;
  is_admin: boolean;
  created_at: string;
}

export const listAdminUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { search?: string }) => ({ search: (input?.search ?? "").trim().slice(0, 100) }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    let q = supabaseAdmin.from("user_profiles").select("*").order("created_at", { ascending: false }).limit(200);
    if (data.search) q = q.or(`username.ilike.%${data.search}%,display_name.ilike.%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const ids = (rows ?? []).map(r => r.user_id);
    const adminSet = new Set<string>();
    if (ids.length) {
      const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin").in("user_id", ids);
      (roles ?? []).forEach(r => adminSet.add(r.user_id));
    }
    return (rows ?? []).map(r => ({ ...r, is_admin: adminSet.has(r.user_id) })) as AdminUserRow[];
  });

export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { user_id: string; xp?: number; badges?: string[] }) => {
    if (!input?.user_id) throw new Error("user_id required");
    return input;
  })
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const patch: { xp?: number; badges?: string[] } = {};
    if (typeof data.xp === "number") patch.xp = Math.max(0, Math.floor(data.xp));
    if (Array.isArray(data.badges)) patch.badges = data.badges.slice(0, 30);
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabaseAdmin.from("user_profiles").update(patch).eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminToggleAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { user_id: string; make_admin: boolean }) => input)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    if (data.user_id === context.userId && !data.make_admin) {
      throw new Error("You cannot remove your own admin role");
    }
    if (data.make_admin) {
      await supabaseAdmin.from("user_roles").upsert([{ user_id: data.user_id, role: "admin" }], { onConflict: "user_id,role" });
    } else {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id).eq("role", "admin");
    }
    return { ok: true };
  });

export interface AdminChatRow {
  id: string;
  match_id: string;
  user_id: string;
  display_name: string;
  message: string;
  created_at: string;
}

export const listRecentChat = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("match_chat")
      .select("id, match_id, user_id, display_name, message, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []) as AdminChatRow[];
  });

export const adminDeleteChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("match_chat").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
