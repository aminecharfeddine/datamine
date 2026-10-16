"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { Check, Eye, EyeOff, LogOut, Mail, RefreshCw } from "lucide-react";
import { useAuth, signOut, syncNow } from "@/lib/sync/sync";
import {
  AVATAR_COLORS,
  authErrorMessage,
  sendMagicLink,
  sendPasswordReset,
  signIn,
  signUp,
  updatePassword,
  updateProfile,
  validatePassword,
  validatePseudo,
} from "@/lib/sync/account";
import { useProgress } from "@/lib/store";
import { levelInfo } from "@/lib/gamification";
import { useHydrated } from "@/components/ui/useHydrated";

type Mode = "signup" | "login" | "forgot" | "magic";

export function Account() {
  const auth = useAuth();
  const [urlError, setUrlError] = useState<string | null>(null);

  // Lien expiré ou invalide : Supabase renvoie l'erreur dans le fragment d'URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const desc = params.get("error_description");
    if (desc) {
      setUrlError(params.get("error_code") === "otp_expired" ? "Ce lien a expiré ou a déjà servi. Demande-en un nouveau." : desc.replace(/\+/g, " "));
      history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  if (auth.status === "loading")
    return (
      <Shell>
        <p className="text-muted">Chargement…</p>
      </Shell>
    );

  if (auth.email && auth.recovery) return <Shell><NewPasswordForm /></Shell>;
  if (auth.email) return <Shell><Profile /></Shell>;
  return (
    <Shell>
      <AuthForms initialError={urlError} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl px-4 pt-10">
      <h1 className="mb-6 font-display text-4xl font-extrabold tracking-tight">Compte</h1>
      {children}
    </div>
  );
}

// ------------------------------------------------------------------ Formulaires

function Field({
  label,
  type = "text",
  value,
  onChange,
  autoComplete,
  hint,
  error,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  hint?: string;
  error?: string | null;
}) {
  const [show, setShow] = useState(false);
  const isPw = type === "password";
  const id = label.toLowerCase().replace(/\W+/g, "-");
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          id={id}
          type={isPw && show ? "text" : type}
          value={value}
          required
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          className={clsx(
            "w-full rounded-xl border-2 bg-surface px-4 py-2.5 outline-none transition-colors focus:border-accent",
            error ? "border-fp" : "border-line",
            isPw && "pr-11",
          )}
        />
        {isPw && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted hover:text-ink"
            aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error ? <p className="mt-1 text-sm text-[#b42318]">{error}</p> : hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

function AuthForms({ initialError }: { initialError: string | null }) {
  const [mode, setMode] = useState<Mode>("signup");
  const [pseudo, setPseudo] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [sent, setSent] = useState<null | { kind: "confirm" | "reset" | "magic"; email: string }>(null);
  const [touched, setTouched] = useState(false);
  const hydrated = useHydrated();
  const xp = useProgress((s) => s.xp);

  const pseudoErr = touched && mode === "signup" ? validatePseudo(pseudo) : null;
  const pwErr = touched && mode === "signup" ? validatePassword(password) : null;

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setTouched(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (mode === "signup" && (validatePseudo(pseudo) || validatePassword(password))) return;
    setBusy(true);
    try {
      if (mode === "signup") {
        const r = await signUp(email, password, pseudo);
        if (r === "confirm") setSent({ kind: "confirm", email });
      } else if (mode === "login") {
        await signIn(email, password);
      } else if (mode === "forgot") {
        await sendPasswordReset(email);
        setSent({ kind: "reset", email });
      } else {
        await sendMagicLink(email);
        setSent({ kind: "magic", email });
      }
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (sent)
    return (
      <div className="card max-w-md p-6">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <Mail size={24} strokeWidth={2.4} />
        </span>
        <p className="mt-4 font-display text-2xl font-bold">Vérifie ta boîte mail</p>
        <p className="mt-2 text-muted">
          {sent.kind === "confirm" && "Clique sur le lien de confirmation envoyé à "}
          {sent.kind === "reset" && "Un lien pour choisir un nouveau mot de passe a été envoyé à "}
          {sent.kind === "magic" && "Un lien de connexion a été envoyé à "}
          <span className="font-semibold text-ink">{sent.email}</span>.{" "}
          {sent.kind === "confirm" ? "Ensuite, tu te connecteras simplement avec ton mot de passe." : "Ouvre-le dans ce navigateur."}{" "}
          Pense à regarder dans les spams.
        </p>
        <button onClick={() => { setSent(null); switchMode("login"); }} className="btn-ghost mt-5 px-4 py-2 text-sm">
          Retour à la connexion
        </button>
      </div>
    );

  const titles: Record<Mode, string> = {
    signup: "Créer mon compte",
    login: "Se connecter",
    forgot: "Recevoir le lien",
    magic: "Recevoir le lien",
  };

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_0.9fr] md:items-start">
      <div className="card p-6">
        {(mode === "signup" || mode === "login") && (
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-2xl bg-sunken p-1" role="tablist">
            {(["signup", "login"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => switchMode(m)}
                className={clsx(
                  "rounded-xl py-2 text-sm font-bold transition-colors",
                  mode === m ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
                )}
              >
                {m === "signup" ? "Créer un compte" : "Se connecter"}
              </button>
            ))}
          </div>
        )}
        {mode === "forgot" && (
          <>
            <p className="font-display text-xl font-bold">Mot de passe oublié</p>
            <p className="mb-5 mt-1 text-sm text-muted">Indique ton adresse : tu recevras un lien pour en choisir un nouveau.</p>
          </>
        )}
        {mode === "magic" && (
          <>
            <p className="font-display text-xl font-bold">Connexion sans mot de passe</p>
            <p className="mb-5 mt-1 text-sm text-muted">Reçois un lien de connexion à usage unique par e-mail.</p>
          </>
        )}

        <form onSubmit={submit} className="space-y-4" noValidate>
          {mode === "signup" && (
            <Field label="Pseudo" value={pseudo} onChange={setPseudo} autoComplete="nickname" hint="Visible sur ton profil." error={pseudoErr} />
          )}
          <Field label="Adresse e-mail" type="email" value={email} onChange={setEmail} autoComplete="email" />
          {(mode === "signup" || mode === "login") && (
            <Field
              label="Mot de passe"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              hint={mode === "signup" ? "8 caractères minimum." : undefined}
              error={pwErr}
            />
          )}
          {error && <p className="rounded-xl bg-[#fef3f2] px-3 py-2 text-sm font-medium text-[#b42318]">{error}</p>}
          <button type="submit" disabled={busy} className="btn-3d w-full bg-accent py-3 text-white">
            {busy ? "Un instant…" : titles[mode]}
          </button>
        </form>

        <div className="mt-5 flex flex-wrap justify-between gap-2 text-sm">
          {mode === "login" && (
            <button onClick={() => switchMode("forgot")} className="font-semibold text-accent hover:underline">
              Mot de passe oublié ?
            </button>
          )}
          {(mode === "forgot" || mode === "magic") && (
            <button onClick={() => switchMode("login")} className="font-semibold text-accent hover:underline">
              Retour à la connexion
            </button>
          )}
          {mode !== "magic" && (
            <button onClick={() => switchMode("magic")} className="text-muted hover:text-ink hover:underline">
              Recevoir un lien par e-mail
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3 text-muted">
        <p className="font-display text-xl font-bold text-ink">Pourquoi un compte ?</p>
        <ul className="space-y-2">
          {[
            "Ta progression, tes séries et tes badges sur tous tes appareils",
            "Tes révisions planifiées au bon moment, où que tu sois",
            "Un profil à ton nom",
          ].map((t) => (
            <li key={t} className="flex gap-2">
              <Check size={18} strokeWidth={3} className="mt-0.5 shrink-0 text-good-bg" /> {t}
            </li>
          ))}
        </ul>
        {hydrated && xp > 0 && (
          <p className="rounded-xl bg-accent-soft px-3 py-2 text-sm text-accent-deep">
            Les {xp} XP gagnés sur cet appareil seront ajoutés à ton compte.
          </p>
        )}
      </div>
    </div>
  );
}

function NewPasswordForm() {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="card max-w-md space-y-4 p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        const v = validatePassword(pw);
        if (v) return setError(v);
        setBusy(true);
        setError(null);
        try {
          await updatePassword(pw);
        } catch (err) {
          setError(authErrorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="font-display text-xl font-bold">Choisis un nouveau mot de passe</p>
      <Field label="Nouveau mot de passe" type="password" value={pw} onChange={setPw} autoComplete="new-password" hint="8 caractères minimum." />
      {error && <p className="text-sm font-medium text-[#b42318]">{error}</p>}
      <button type="submit" disabled={busy} className="btn-3d w-full bg-accent py-3 text-white">
        {busy ? "Un instant…" : "Enregistrer le mot de passe"}
      </button>
    </form>
  );
}

// ------------------------------------------------------------------ Profil connecté

const STATUS: Record<string, string> = {
  synced: "Progression synchronisée",
  syncing: "Synchronisation…",
  error: "Erreur de synchronisation",
};

function Profile() {
  const auth = useAuth();
  const xp = useProgress((s) => s.xp);
  const lessons = useProgress((s) => Object.keys(s.completedLessons).length);
  const lvl = levelInfo(xp);
  const [pseudo, setPseudo] = useState(auth.pseudo ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const color = auth.color ?? AVATAR_COLORS[0];
  const name = auth.pseudo || auth.email!.split("@")[0];

  const save = async (patch: { pseudo?: string; color?: string }) => {
    if (patch.pseudo !== undefined) {
      const v = validatePseudo(patch.pseudo);
      if (v) return setError(v);
    }
    setSaving(true);
    setError(null);
    try {
      await updateProfile(patch);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
      <section className="card p-6">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl font-display text-3xl font-extrabold uppercase text-white" style={{ background: color }}>
            {name[0]}
          </span>
          <div className="min-w-0">
            <div className="truncate font-display text-2xl font-bold">{name}</div>
            <div className="truncate text-sm text-muted">{auth.email}</div>
            <div className="mt-1 text-sm font-semibold text-[#b45309]">
              Niveau {lvl.level} · {xp} XP · {lessons} leçon{lessons > 1 ? "s" : ""} terminée{lessons > 1 ? "s" : ""}
            </div>
          </div>
        </div>

        <form
          className="mt-6 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save({ pseudo });
          }}
        >
          <Field label="Pseudo" value={pseudo} onChange={setPseudo} autoComplete="nickname" />
          <div>
            <div className="text-sm font-semibold">Couleur de l'avatar</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => void save({ color: c })}
                  aria-label={`Couleur ${c}`}
                  aria-pressed={c === color}
                  className={clsx("h-9 w-9 rounded-xl transition-transform hover:scale-110", c === color && "ring-4 ring-offset-2")}
                  style={{ background: c, ["--tw-ring-color" as string]: `${c}55` }}
                />
              ))}
            </div>
          </div>
          {error && <p className="text-sm font-medium text-[#b42318]">{error}</p>}
          <div className="flex items-center gap-3 pt-1">
            <button type="submit" disabled={saving || pseudo.trim() === (auth.pseudo ?? "")} className="btn-3d bg-accent px-5 py-2.5 text-sm text-white">
              Enregistrer
            </button>
            {saved && (
              <span className="flex items-center gap-1 text-sm font-semibold text-good">
                <Check size={16} strokeWidth={3} /> Enregistré
              </span>
            )}
          </div>
        </form>
      </section>

      <div className="space-y-4">
        <section className="card p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span
              className={clsx(
                "inline-block h-2.5 w-2.5 rounded-full",
                auth.status === "synced" && "bg-good-bg",
                auth.status === "syncing" && "animate-pulse bg-fn",
                auth.status === "error" && "bg-flame",
              )}
            />
            {STATUS[auth.status] ?? ""}
            {auth.lastSync && auth.status === "synced" && (
              <span className="font-normal text-muted">
                à {new Date(auth.lastSync).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
          {auth.error && <p className="mt-2 text-sm text-[#b42318]">{auth.error}</p>}
          <button onClick={() => void syncNow()} className="btn-ghost mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm">
            <RefreshCw size={15} /> Synchroniser maintenant
          </button>
        </section>

        <section className="card p-5">
          {pwOpen ? (
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const v = validatePassword(pw);
                if (v) return setPwMsg(v);
                try {
                  await updatePassword(pw);
                  setPw("");
                  setPwOpen(false);
                  setPwMsg("Mot de passe modifié.");
                } catch (err) {
                  setPwMsg(authErrorMessage(err));
                }
              }}
            >
              <Field label="Nouveau mot de passe" type="password" value={pw} onChange={setPw} autoComplete="new-password" hint="8 caractères minimum." />
              {pwMsg && <p className="text-sm text-muted">{pwMsg}</p>}
              <div className="flex gap-2">
                <button type="submit" className="btn-3d bg-accent px-4 py-2 text-sm text-white">Modifier</button>
                <button type="button" onClick={() => setPwOpen(false)} className="btn-ghost px-4 py-2 text-sm">Annuler</button>
              </div>
            </form>
          ) : (
            <>
              <div className="text-sm font-semibold">Mot de passe</div>
              <p className="mt-1 text-sm text-muted">
                {pwMsg ?? "Si tu t'es inscrit avec un lien par e-mail, définis-en un pour te connecter plus vite."}
              </p>
              <button onClick={() => { setPwOpen(true); setPwMsg(null); }} className="btn-ghost mt-3 px-4 py-2 text-sm">
                Définir un nouveau mot de passe
              </button>
            </>
          )}
        </section>

        <button
          onClick={async () => {
            const r = await signOut();
            if (
              !r.saved &&
              confirm(
                "Ta progression récente n'a pas pu être sauvegardée dans ton compte (connexion impossible). Si tu te déconnectes maintenant, elle sera perdue. Se déconnecter quand même ?",
              )
            )
              await signOut({ force: true });
          }}
          className="btn-ghost inline-flex items-center gap-2 px-4 py-2 text-sm text-[#b42318]"
        >
          <LogOut size={15} /> Se déconnecter
        </button>
        <p className="text-xs text-muted">La déconnexion efface la progression de cet appareil ; elle reste en sécurité dans ton compte.</p>
      </div>
    </div>
  );
}
