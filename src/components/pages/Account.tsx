"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { useAuth, signInWithEmail, signOut, syncNow } from "@/lib/sync/sync";
import { useProgress } from "@/lib/store";
import { useHydrated } from "@/components/ui/useHydrated";

const STATUS: Record<string, string> = {
  synced: "Synchronisé",
  syncing: "Synchronisation…",
  error: "Erreur de synchronisation",
  loading: "Chargement…",
};

export function Account() {
  const auth = useAuth();
  const hydrated = useHydrated();
  const xp = useProgress((s) => s.xp);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lien expiré ou invalide : Supabase renvoie l'erreur dans le fragment d'URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const desc = params.get("error_description");
    if (desc) {
      setError(params.get("error_code") === "otp_expired" ? "Ce lien a expiré ou a déjà servi. Demande-en un nouveau." : desc.replace(/\+/g, " "));
      history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  if (auth.status === "loading") return <Shell><p className="text-muted">Chargement…</p></Shell>;

  if (!auth.email)
    return (
      <Shell>
        <p className="max-w-lg text-lg text-muted">
          Un compte garde ta progression — XP, séries, badges et révisions — et la synchronise entre tous tes appareils.
        </p>

        <div className="mt-8 max-w-md card p-6">
          {sent ? (
            <div className="animate-rise">
              <p className="font-display text-xl">Vérifie ta boîte mail</p>
              <p className="mt-2 text-muted">
                Un lien de connexion a été envoyé à <span className="font-semibold text-ink">{sent}</span>. Ouvre-le dans ce
                navigateur. Pense à regarder dans les spams.
              </p>
              <button onClick={() => setSent(null)} className="mt-4 text-sm text-muted underline underline-offset-4 hover:text-ink">
                Utiliser une autre adresse
              </button>
            </div>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError(null);
                try {
                  await signInWithEmail(email.trim());
                  setSent(email.trim());
                } catch (err) {
                  const msg = (err as Error).message ?? "";
                  setError(/rate limit/i.test(msg) ? "Trop de demandes de lien. Réessaie dans quelques minutes." : msg || "Envoi impossible.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label className="block text-sm font-medium" htmlFor="email">
                Adresse e-mail
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="toi@exemple.com"
                className="mt-2 w-full rounded-xl border-2 border-line bg-surface px-4 py-2.5 outline-none focus:border-accent"
              />
              <button
                type="submit"
                disabled={busy}
                className="btn-3d mt-4 w-full bg-accent py-3 text-white"
              >
                {busy ? "Envoi…" : "Recevoir un lien de connexion"}
              </button>
              <p className="mt-3 text-xs text-muted">Pas de mot de passe : tu te connectes en cliquant sur le lien reçu par e-mail.</p>
            </form>
          )}
          {error && <p className="mt-4 text-sm font-medium text-accent">{error}</p>}
        </div>

        {hydrated && xp > 0 && (
          <p className="mt-6 max-w-md text-sm text-muted">
            Ta progression actuelle ({xp} XP) sera ajoutée à ton compte à la première connexion.
          </p>
        )}
      </Shell>
    );

  return (
    <Shell>
      <div className="max-w-md card p-6">
        <div className="text-xs text-muted">Connecté en tant que</div>
        <div className="mt-1 break-all font-display text-xl">{auth.email}</div>

        <div className="mt-5 flex items-center gap-2 text-sm">
          <span
            className={clsx(
              "inline-block h-2.5 w-2.5 rounded-full",
              auth.status === "synced" && "bg-good-bg",
              auth.status === "syncing" && "animate-pulse bg-fn",
              auth.status === "error" && "bg-flame",
            )}
          />
          <span className="font-medium">{STATUS[auth.status]}</span>
          {auth.lastSync && auth.status === "synced" && (
            <span className="text-muted">
              · {new Date(auth.lastSync).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
        {auth.error && <p className="mt-2 text-sm text-accent">{auth.error}</p>}

        <div className="mt-6 flex flex-wrap gap-2">
          <button onClick={() => void syncNow()} className="btn-ghost px-4 py-2 text-sm">
            Synchroniser maintenant
          </button>
          <button
            onClick={async () => {
              setBusy(true);
              await signOut();
              setBusy(false);
            }}
            disabled={busy}
            className="btn-3d bg-accent px-4 py-2 text-sm text-white"
          >
            Se déconnecter
          </button>
        </div>
        <p className="mt-4 text-xs text-muted">
          La déconnexion efface la progression de cet appareil ; elle reste en sécurité dans ton compte.
        </p>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl px-4 pt-12">
      <h1 className="mb-6 font-display text-4xl font-extrabold tracking-tight">Compte</h1>
      {children}
    </div>
  );
}
