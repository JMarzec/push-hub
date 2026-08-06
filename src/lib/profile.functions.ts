import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AVATAR_BUCKET = "avatars";
const SIGNED_URL_TTL = 60 * 60; // 1 hour

export const getProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("display_name, created_at, avatar_url")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    let avatarUrl: string | null = null;
    const path = data?.avatar_url ?? null;
    if (path) {
      const signed = await supabase.storage
        .from(AVATAR_BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL);
      avatarUrl = signed.data?.signedUrl ?? null;
    }

    return {
      displayName: data?.display_name ?? "",
      memberSince: data?.created_at ?? null,
      avatarPath: path,
      avatarUrl,
    };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ displayName: z.string().trim().min(1).max(40) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: data.displayName })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { displayName: data.displayName };
  });

/**
 * Records the storage path of an avatar the browser just uploaded into the
 * caller's own folder, and returns a fresh signed URL for it. The path is
 * re-derived from the authenticated user id so nobody can point their profile
 * at another member's file.
 */
export const setAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ path: z.string().min(1).max(300) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!data.path.startsWith(`${userId}/`)) {
      throw new Error("Invalid avatar path.");
    }

    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: data.path })
      .eq("id", userId);
    if (error) throw new Error(error.message);

    const signed = await supabase.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(data.path, SIGNED_URL_TTL);
    return { avatarPath: data.path, avatarUrl: signed.data?.signedUrl ?? null };
  });

export const removeAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.avatar_url) {
      await supabase.storage.from(AVATAR_BUCKET).remove([profile.avatar_url]);
    }
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
