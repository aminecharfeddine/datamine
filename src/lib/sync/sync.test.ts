// @vitest-environment jsdom
import { describe, expect, it, vi, beforeAll } from "vitest";

// ---- Faux Supabase en mémoire
const db = new Map<string, unknown>();
let session: { user: { id: string; email: string } } | null = null;
let authCb: ((e: string, s: typeof session) => void) | null = null;
let failing = false;
const fail = { data: null, error: { message: "fetch failed" } };

vi.mock("@/lib/supabase/client", () => ({
  supabase: () => ({
    auth: {
      getSession: async () => ({ data: { session } }),
      onAuthStateChange: (cb: typeof authCb) => {
        authCb = cb;
        return { data: { subscription: { unsubscribe() {} } } };
      },
      signOut: async () => {
        session = null;
        authCb?.("SIGNED_OUT", null);
        return { error: null };
      },
      signInWithOtp: async () => ({ error: null }),
    },
    from: () => ({
      select: () => ({
        eq: (_c: string, id: string) => ({
          maybeSingle: async () =>
            failing ? fail : { data: db.has(id) ? { state: structuredClone(db.get(id)) } : null, error: null },
        }),
      }),
      upsert: async (row: { user_id: string; state: unknown }) => {
        if (failing) return fail;
        db.set(row.user_id, structuredClone(row.state));
        return { error: null };
      },
    }),
  }),
}));

import { useProgress, EMPTY_DATA, pickData } from "@/lib/store";
import { stableStringify } from "./merge";
import { startSync, useAuth, syncNow, signOut, resetProgress } from "./sync";

const login = async (id: string) => {
  session = { user: { id, email: `${id}@test.fr` } };
  authCb?.("SIGNED_IN", session);
  await new Promise((r) => setTimeout(r, 5));
  await syncNow();
};
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("synchronisation", () => {
  beforeAll(async () => {
    startSync();
    await wait(5);
  });

  it("démarre en mode invité", () => {
    expect(useAuth.getState().status).toBe("anon");
  });

  it("la progression invité est versée dans le compte à la connexion", async () => {
    useProgress.getState().award("guest:1", 40, "test");
    db.set("alice", { ...EMPTY_DATA, xp: 100, dailyXp: { "2020-01-01": 100 }, awarded: { "old:1": true } });
    await login("alice");
    const s = useProgress.getState();
    expect(s.ownerId).toBe("alice");
    expect(s.awarded["guest:1"]).toBe(true);
    expect(s.awarded["old:1"]).toBe(true);
    expect(s.xp).toBe(140);
    expect((db.get("alice") as { xp: number }).xp).toBe(140);
    expect(useAuth.getState().status).toBe("synced");
  });

  it("une modification est poussée après le délai", async () => {
    useProgress.getState().award("new:1", 10, "test");
    await wait(1700);
    await syncNow();
    expect((db.get("alice") as { awarded: Record<string, true> }).awarded["new:1"]).toBe(true);
  });

  it("déconnexion : l'appareil repasse en invité vierge, le cloud garde tout", async () => {
    await signOut();
    expect(useProgress.getState().xp).toBe(0);
    expect(useProgress.getState().ownerId).toBeNull();
    expect((db.get("alice") as { xp: number }).xp).toBe(150);
  });

  it("l'état d'un autre compte n'est jamais mélangé", async () => {
    await login("alice");
    expect(useProgress.getState().xp).toBe(150);
    // session expirée côté serveur sans déconnexion explicite, puis connexion de bob
    session = null;
    authCb?.("SIGNED_OUT", null);
    await wait(5);
    await login("bob");
    expect(useProgress.getState().ownerId).toBe("bob");
    expect(useProgress.getState().xp).toBe(0);
    expect((db.get("bob") as { xp: number }).xp).toBe(0);
  });

  it("réinitialiser efface aussi le cloud", async () => {
    await signOut();
    await login("alice");
    await resetProgress();
    expect(useProgress.getState().xp).toBe(0);
    expect((db.get("alice") as { xp: number }).xp).toBe(0);
    await syncNow();
    expect(useProgress.getState().xp).toBe(0);
  });

  it("cycle complet : leçons, défis, badges, révisions et série reviennent intacts après déconnexion / reconnexion", async () => {
    await signOut();
    await login("carla");
    const st = useProgress.getState();
    st.recordChallenge("lecon:challenge:a");
    st.recordPrediction("lecon:predict:b", true);
    st.completeLesson("matrice-de-confusion", ["f1", "threshold"]);
    const cardId = Object.keys(useProgress.getState().srs)[0];
    useProgress.getState().review(cardId, 3);
    const before = stableStringify(pickData(useProgress.getState()));
    expect(Object.keys(useProgress.getState().badges)).toEqual(expect.arrayContaining(["first-lesson", "first-challenge"]));
    const r = await signOut();
    expect(r.saved).toBe(true);
    expect(useProgress.getState().xp).toBe(0);
    await login("carla");
    expect(stableStringify(pickData(useProgress.getState()))).toBe(before);
  });

  it("si la sauvegarde échoue, la déconnexion ne vide rien sans confirmation", async () => {
    useProgress.getState().award("offline:1", 10, "test");
    const xp = useProgress.getState().xp;
    failing = true;
    const r = await signOut();
    expect(r.saved).toBe(false);
    expect(useProgress.getState().xp).toBe(xp);
    expect(useAuth.getState().userId).toBe("carla");
    failing = false;
    expect((await signOut()).saved).toBe(true);
    await login("carla");
    expect(useProgress.getState().awarded["offline:1"]).toBe(true);
  });

  it("les badges mérités sont recalculés après une fusion", async () => {
    await signOut();
    db.set("dan", { ...EMPTY_DATA, completedLessons: { bayes: "2026-10-10T00:00:00Z" }, challengesDone: 5 });
    await login("dan");
    const b = useProgress.getState().badges;
    expect(b["first-lesson"]).toBeDefined();
    expect(b["challenges-5"]).toBeDefined();
    expect((db.get("dan") as { badges: Record<string, string> }).badges["challenges-5"]).toBeDefined();
  });
});
