"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// La clé « publishable » est conçue pour être exposée côté navigateur : la sécurité repose
// sur les règles RLS de la table (chaque utilisateur ne lit et n'écrit que sa propre ligne).
// Les variables d'environnement permettent de pointer vers un autre projet sans toucher au code.
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://stezujqonilgqjggbhph.supabase.co";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_x1NnXE_4wpgNmKxQD0fLxg_Ra6aajf8";

let client: SupabaseClient | null = null;

export function supabase() {
  if (!client) {
    client = createClient(URL, KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" },
    });
  }
  return client;
}
