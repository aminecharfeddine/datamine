"use client";

import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { EMPTY_DATA, pickData, useProgress, DATA_KEYS, type ProgressData } from "@/lib/store";
import { mergeProgress, sameData } from "./merge";
import { withEarnedBadges } from "@/lib/gamification";

// Synchronisation de la progression avec Supabase.
// Principe : l'état local reste la source immédiate (l'interface ne bloque jamais) ; à la connexion,
// au retour sur l'onglet et après chaque modification (avec un délai), on fait « lire → fusionner → écrire ».
// La fusion est monotone : un appareil ne peut pas effacer les progrès d'un autre.

export type SyncStatus = "loading" | "anon" | "syncing" | "synced" | "error";

type AuthState = {
  status: SyncStatus;
  userId: string | null;
  email: string | null;
  /** Profil public, stocké dans les métadonnées de l'utilisateur Supabase. */
  pseudo: string | null;
  color: string | null;
  /** Vrai après un clic sur le lien « mot de passe oublié » : on affiche le formulaire de nouveau mot de passe. */
  recovery: boolean;
  error: string | null;
  lastSync: string | null;
};

export const useAuth = create<AuthState>(() => ({
  status: "loading",
  userId: null,
  email: null,
  pseudo: null,
  color: null,
  recovery: false,
  error: null,
  lastSync: null,
}));

const PUSH_DELAY = 1500;
let started = false;
let applying = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let queue: Promise<void> = Promise.resolve();

function friendlyError(e: unknown): string {
  const err = e as { code?: string; message?: string };
  if (err?.code === "42P01" || err?.code === "PGRST205" || /relation|schema cache/i.test(err?.message ?? ""))
    return "La table « progress » n'existe pas encore dans Supabase : exécute le script SQL de configuration.";
  if (/fetch|network/i.test(err?.message ?? "")) return "Connexion impossible pour l'instant. Ta progression reste enregistrée sur cet appareil.";
  return err?.message ?? "Erreur de synchronisation inconnue.";
}

async function fetchRemote(userId: string): Promise<Partial<ProgressData> | null> {
  const { data, error } = await supabase().from("progress").select("state").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return (data?.state as Partial<ProgressData> | undefined) ?? null;
}

async function writeRemote(userId: string, state: ProgressData) {
  const { error } = await supabase()
    .from("progress")
    .upsert({ user_id: userId, state, updated_at: new Date().toISOString() });
  if (error) throw error;
}

function apply(data: ProgressData, ownerId: string | null) {
  applying = true;
  try {
    useProgress.getState().setData(data, ownerId);
  } finally {
    applying = false;
  }
}

/** Lire → fusionner → écrire. Les appels sont mis en file pour ne jamais se chevaucher. */
export function syncNow(): Promise<void> {
  queue = queue.then(async () => {
    const { userId } = useAuth.getState();
    if (!userId) return;
    useAuth.setState({ status: "syncing" });
    try {
      const remote = await fetchRemote(userId);
      const st = useProgress.getState();
      const local = pickData(st);
      // L'état local appartient à un autre compte : on ne le mélange pas.
      const base = st.ownerId && st.ownerId !== userId ? null : local;
      const merged = withEarnedBadges(mergeProgress(base, remote));
      if (st.ownerId !== userId || !sameData(merged, local)) apply(merged, userId);
      if (!remote || !sameData(merged, mergeProgress(remote, null))) await writeRemote(userId, merged);
      useAuth.setState({ status: "synced", error: null, lastSync: new Date().toISOString() });
    } catch (e) {
      useAuth.setState({ status: "error", error: friendlyError(e) });
    }
  });
  return queue;
}

function schedulePush() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void syncNow();
  }, PUSH_DELAY);
}

function handleSession(session: Session | null) {
  const user = session?.user;
  const current = useAuth.getState();
  if (user) {
    const meta = (user.user_metadata ?? {}) as { pseudo?: string; color?: string };
    useAuth.setState({ email: user.email ?? null, pseudo: meta.pseudo ?? null, color: meta.color ?? null });
    if (current.userId !== user.id) {
      useAuth.setState({ userId: user.id, status: "syncing", error: null });
      void syncNow();
    }
  } else if (current.status === "loading" || current.userId) {
    useAuth.setState({ userId: null, email: null, pseudo: null, color: null, status: "anon", error: null });
  }
}

/** À appeler une fois au démarrage de l'application (côté client). */
export function startSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  const sb = supabase();

  sb.auth
    .getSession()
    .then(({ data }) => handleSession(data.session))
    .catch(() => useAuth.setState({ status: "anon" }));

  // Ne pas appeler Supabase directement dans ce callback (recommandation de supabase-js) : on diffère.
  sb.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") useAuth.setState({ recovery: true });
    setTimeout(() => handleSession(session), 0);
  });

  useProgress.subscribe((s, prev) => {
    if (applying || !useAuth.getState().userId) return;
    if (DATA_KEYS.every((k) => s[k] === prev[k])) return; // seuls les toasts ont changé
    schedulePush();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && useAuth.getState().userId) void syncNow();
    flushOnHide();
  });
  window.addEventListener("pagehide", flushOnHide);
}

export async function signInWithEmail(email: string) {
  const { error } = await supabase().auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/compte` },
  });
  if (error) throw error;
}

/**
 * Déconnexion. On sauvegarde d'abord tout ce qui est local ; si cette sauvegarde échoue,
 * on ne vide rien et on renvoie { saved: false } pour que l'interface demande confirmation
 * (sinon les progrès non synchronisés seraient perdus). `force` déconnecte quand même.
 */
export async function signOut({ force = false } = {}): Promise<{ saved: boolean }> {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  await syncNow(); // dernière sauvegarde avant de partir
  const saved = useAuth.getState().status === "synced";
  if (!saved && !force) return { saved: false };
  await supabase().auth.signOut();
  useProgress.getState().reset(); // l'appareil repasse en mode invité, vierge
  useAuth.setState({ userId: null, email: null, pseudo: null, color: null, recovery: false, status: "anon", error: null, lastSync: null });
  return { saved };
}

/** Sauvegarde rapide quand l'onglet passe en arrière-plan ou se ferme (si une écriture était en attente). */
function flushOnHide() {
  if (document.visibilityState === "hidden" && pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
    void syncNow();
  }
}

/** Réinitialise la progression, y compris dans le cloud si on est connecté (sinon la fusion la ferait revenir). */
export async function resetProgress() {
  const { userId } = useAuth.getState();
  if (pushTimer) clearTimeout(pushTimer);
  if (!userId) {
    useProgress.getState().reset();
    return;
  }
  queue = queue.then(async () => {
    try {
      await writeRemote(userId, EMPTY_DATA);
      apply(EMPTY_DATA, userId);
      useAuth.setState({ status: "synced", error: null, lastSync: new Date().toISOString() });
    } catch (e) {
      useAuth.setState({ status: "error", error: friendlyError(e) });
    }
  });
  await queue;
}
