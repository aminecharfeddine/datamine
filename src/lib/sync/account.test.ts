// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

const calls: Record<string, unknown[]> = {};
let signUpResult: unknown = { data: { user: { identities: [{}] }, session: null }, error: null };

vi.mock("@/lib/supabase/client", () => ({
  supabase: () => ({
    auth: {
      signUp: async (args: unknown) => ((calls.signUp = [args]), signUpResult),
      signInWithPassword: async (args: { password: string }) =>
        args.password === "bon-mot-de-passe" ? { error: null } : { error: { message: "Invalid login credentials" } },
      resetPasswordForEmail: async (...a: unknown[]) => ((calls.reset = a), { error: null }),
      updateUser: async (args: { data?: Record<string, string> }) => ({ data: { user: { user_metadata: args.data ?? {} } }, error: null }),
    },
  }),
}));

import { authErrorMessage, signIn, signUp, sendPasswordReset, updateProfile, validatePassword, validatePseudo } from "./account";
import { useAuth } from "./sync";

describe("compte", () => {
  it("inscription avec confirmation e-mail requise", async () => {
    expect(await signUp(" a@b.fr ", "motdepasse", " Amine ")).toBe("confirm");
    const args = calls.signUp[0] as { email: string; options: { data: { pseudo: string; color: string } } };
    expect(args.email).toBe("a@b.fr");
    expect(args.options.data.pseudo).toBe("Amine");
    expect(args.options.data.color).toMatch(/^#/);
  });
  it("inscription avec session immédiate", async () => {
    signUpResult = { data: { user: { identities: [{}] }, session: {} }, error: null };
    expect(await signUp("a@b.fr", "motdepasse", "Amine")).toBe("signed-in");
  });
  it("adresse déjà inscrite détectée", async () => {
    signUpResult = { data: { user: { identities: [] }, session: null }, error: null };
    await expect(signUp("a@b.fr", "motdepasse", "Amine")).rejects.toThrow();
    try {
      await signUp("a@b.fr", "motdepasse", "Amine");
    } catch (e) {
      expect(authErrorMessage(e)).toMatch(/existe déjà/);
    }
  });
  it("mauvais mot de passe → message français", async () => {
    await expect(signIn("a@b.fr", "faux")).rejects.toBeTruthy();
    try {
      await signIn("a@b.fr", "faux");
    } catch (e) {
      expect(authErrorMessage(e)).toBe("E-mail ou mot de passe incorrect.");
    }
    await expect(signIn("a@b.fr", "bon-mot-de-passe")).resolves.toBeUndefined();
  });
  it("mot de passe oublié redirige vers /compte", async () => {
    await sendPasswordReset("a@b.fr");
    expect((calls.reset[1] as { redirectTo: string }).redirectTo).toMatch(/\/compte$/);
  });
  it("mise à jour du profil", async () => {
    await updateProfile({ pseudo: "  Neo ", color: "#16a34a" });
    expect(useAuth.getState().pseudo).toBe("Neo");
    expect(useAuth.getState().color).toBe("#16a34a");
  });
  it("validations", () => {
    expect(validatePassword("court")).toBeTruthy();
    expect(validatePassword("assez-long")).toBeNull();
    expect(validatePseudo("a")).toBeTruthy();
    expect(validatePseudo("Amine")).toBeNull();
  });
});
