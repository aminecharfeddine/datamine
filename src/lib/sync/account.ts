"use client";

import { supabase } from "@/lib/supabase/client";
import { useAuth } from "./sync";

// Gestion du compte : inscription par mot de passe, connexion, mot de passe oublié, profil.

export const AVATAR_COLORS = ["#4f46e5", "#7c3aed", "#db2777", "#f43f5e", "#f97316", "#d97706", "#16a34a", "#0d9488", "#0284c7"];

const redirect = () => `${window.location.origin}/compte`;

/** Traduit les erreurs Supabase les plus courantes en français clair. */
export function authErrorMessage(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? "";
  if (/invalid login credentials/i.test(msg)) return "E-mail ou mot de passe incorrect.";
  if (/already registered|already exists/i.test(msg)) return "Un compte existe déjà avec cette adresse. Connecte-toi plutôt.";
  if (/email not confirmed/i.test(msg)) return "Ton adresse n'est pas encore confirmée : clique sur le lien reçu à l'inscription.";
  if (/password should be at least|weak password/i.test(msg)) return "Mot de passe trop court : 8 caractères minimum.";
  if (/rate limit|too many/i.test(msg)) return "Trop de tentatives. Réessaie dans quelques minutes.";
  if (/same password|different from the old/i.test(msg)) return "Le nouveau mot de passe doit être différent de l'ancien.";
  if (/invalid email|unable to validate email/i.test(msg)) return "Adresse e-mail invalide.";
  if (/fetch|network/i.test(msg)) return "Connexion impossible. Vérifie ta connexion internet.";
  return msg || "Une erreur est survenue.";
}

export function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "8 caractères minimum.";
  return null;
}

export function validatePseudo(p: string): string | null {
  const t = p.trim();
  if (t.length < 2) return "2 caractères minimum.";
  if (t.length > 24) return "24 caractères maximum.";
  return null;
}

/**
 * Crée un compte. Renvoie "signed-in" si la session est ouverte immédiatement,
 * "confirm" si Supabase exige une confirmation par e-mail d'abord.
 */
export async function signUp(email: string, password: string, pseudo: string): Promise<"signed-in" | "confirm"> {
  const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
  const { data, error } = await supabase().auth.signUp({
    email: email.trim(),
    password,
    options: { data: { pseudo: pseudo.trim(), color }, emailRedirectTo: redirect() },
  });
  if (error) throw error;
  // Adresse déjà inscrite (Supabase ne le dit pas explicitement, pour éviter l'énumération) : aucune identité créée.
  if (data.user && data.user.identities && data.user.identities.length === 0)
    throw new Error("User already registered");
  return data.session ? "signed-in" : "confirm";
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
}

export async function sendMagicLink(email: string) {
  const { error } = await supabase().auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirect() } });
  if (error) throw error;
}

export async function sendPasswordReset(email: string) {
  const { error } = await supabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: redirect() });
  if (error) throw error;
}

export async function updatePassword(password: string) {
  const { error } = await supabase().auth.updateUser({ password });
  if (error) throw error;
  useAuth.setState({ recovery: false });
}

export async function updateProfile(profile: { pseudo?: string; color?: string }) {
  const clean = { ...profile, ...(profile.pseudo !== undefined ? { pseudo: profile.pseudo.trim() } : {}) };
  const { data, error } = await supabase().auth.updateUser({ data: clean });
  if (error) throw error;
  const meta = (data.user?.user_metadata ?? {}) as { pseudo?: string; color?: string };
  useAuth.setState({ pseudo: meta.pseudo ?? null, color: meta.color ?? null });
}
