"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

import { auth, db } from "../lib/firebase";
import { PremiumCard } from "../components/PremiumCard";
import { TapButton } from "../components/TapButton";
import { upsertTodayCoachTip } from "./lib/coachTips";
import { Dog, LogIn, UserPlus, Mail, Lock, AlertTriangle, User, Globe } from "lucide-react";

type Mode = "login" | "signup";

function isValidEmail(v: string) {
  return /\S+@\S+\.\S+/.test(v);
}

const COUNTRY_OPTIONS = [
  "Italia",
  "Svizzera",
  "San Marino",
  "Città del Vaticano",
  "Francia",
  "Germania",
  "Spagna",
  "Regno Unito",
  "Irlanda",
  "Portogallo",
  "Paesi Bassi",
  "Belgio",
  "Austria",
  "Polonia",
  "Svezia",
  "Norvegia",
  "Danimarca",
  "Finlandia",
  "Grecia",
  "Croazia",
  "Slovenia",
  "Romania",
  "Ungheria",
  "Repubblica Ceca",
  "Ucraina",
  "Stati Uniti",
  "Canada",
  "Brasile",
  "Argentina",
  "Messico",
  "Australia",
  "Nuova Zelanda",
];

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // signup extra fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [country, setCountry] = useState(COUNTRY_OPTIONS[0]);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // se già loggato -> Home
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      if (u) router.push("/");
    });
  }, [router]);

  const canSubmit = useMemo(() => {
    if (!isValidEmail(email.trim())) return false;
    if (password.length < 6) return false;

    if (mode === "signup") {
      if (firstName.trim().length < 2) return false;
      if (lastName.trim().length < 2) return false;
      if (!country) return false;
    }
    return true;
  }, [email, password, mode, firstName, lastName, country]);

  function switchMode(next: Mode) {
    setErr(null);
    setMode(next);
  }

  async function submit() {
    setErr(null);
    setBusy(true);

    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        router.push("/");
        return;
      }

      // signup
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);

      // salva profilo utente
      await setDoc(
        doc(db, "users", cred.user.uid),
        {
          email: email.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          country,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      router.push("/");
    } catch (e: any) {
      const code = String(e?.code ?? "");
      if (code.includes("auth/invalid-credential") || code.includes("auth/wrong-password")) {
        setErr("Email o password non corretti.");
      } else if (code.includes("auth/user-not-found")) {
        setErr("Nessun account trovato con questa email. Crea un account.");
      } else if (code.includes("auth/email-already-in-use")) {
        setErr("Questa email è già registrata. Vai su “Accedi”.");
      } else if (code.includes("auth/weak-password")) {
        setErr("Password troppo debole. Usa almeno 6 caratteri.");
      } else if (code.includes("auth/invalid-email")) {
        setErr("Inserisci un’email valida.");
      } else {
        setErr(e?.message ?? "Errore. Riprova.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto p-4 min-h-screen">
      <div className="mt-10 grid gap-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-white/80 ring-1 ring-black/5 shadow-sm">
            <Dog className="h-6 w-6" />
          </div>
          <h1 className="mt-3 text-2xl font-black tracking-tight">myFitDog</h1>
          <p className="text-sm text-zinc-700/75">
            {mode === "login" ? "Accedi per continuare." : "Crea un account e completa il profilo."}
          </p>
        </div>

        <PremiumCard
          tone="cream"
          icon={mode === "login" ? <LogIn className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
          title={mode === "login" ? "Accedi" : "Crea account"}
          subtitle={mode === "login" ? "Inserisci email e password." : "Inserisci i dati e scegli il paese."}
          right={
            <div className="inline-flex rounded-2xl bg-white/80 ring-1 ring-black/5 p-1 shadow-sm">
              <button
                type="button"
                onClick={() => switchMode("login")}
                className={
                  mode === "login"
                    ? "px-3 py-1.5 rounded-xl text-sm font-extrabold bg-zinc-950 text-white"
                    : "px-3 py-1.5 rounded-xl text-sm font-extrabold text-zinc-800/80 hover:bg-black/5"
                }
              >
                Accedi
              </button>
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className={
                  mode === "signup"
                    ? "px-3 py-1.5 rounded-xl text-sm font-extrabold bg-zinc-950 text-white"
                    : "px-3 py-1.5 rounded-xl text-sm font-extrabold text-zinc-800/80 hover:bg-black/5"
                }
              >
                Registrati
              </button>
            </div>
          }
        >
          <div className="grid gap-3 mt-2">
            {/* Extra fields only for signup */}
            {mode === "signup" ? (
              <>
                <div className="grid gap-1">
                  <div className="text-xs font-extrabold text-zinc-700/80">Nome</div>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <input
                      className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white/80 ring-1 ring-black/5 shadow-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Es. Pietro"
                      autoComplete="given-name"
                    />
                  </div>
                </div>

                <div className="grid gap-1">
                  <div className="text-xs font-extrabold text-zinc-700/80">Cognome</div>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <input
                      className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white/80 ring-1 ring-black/5 shadow-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Es. Rossi"
                      autoComplete="family-name"
                    />
                  </div>
                </div>

                <div className="grid gap-1">
                  <div className="text-xs font-extrabold text-zinc-700/80">Paese di residenza</div>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <select
                      className="ui-select w-full pl-10 pr-4 py-3 rounded-2xl bg-white/80 ring-1 ring-black/5"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                    >
                      {COUNTRY_OPTIONS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="text-xs text-zinc-700/60">
                    Lo useremo per personalizzare unità e suggerimenti.
                  </div>
                </div>
              </>
            ) : null}

            <div className="grid gap-1">
              <div className="text-xs font-extrabold text-zinc-700/80">Email</div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <input
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white/80 ring-1 ring-black/5 shadow-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@email.com"
                  inputMode="email"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="grid gap-1">
              <div className="text-xs font-extrabold text-zinc-700/80">Password</div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <input
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white/80 ring-1 ring-black/5 shadow-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimo 6 caratteri"
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
              </div>
            </div>

            {err ? (
              <div className="text-sm text-red-700 font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {err}
              </div>
            ) : null}

            <TapButton variant="primary" onClick={submit} fullWidth>
              {busy ? "Attendi..." : mode === "login" ? "Accedi" : "Crea account"}
            </TapButton>

            <div className="text-xs text-zinc-700/70 text-center">
              {mode === "login" ? (
                <>
                  Non hai un account?{" "}
                  <button
                    type="button"
                    className="font-extrabold underline underline-offset-4"
                    onClick={() => switchMode("signup")}
                  >
                    Registrati
                  </button>
                </>
              ) : (
                <>
                  Hai già un account?{" "}
                  <button
                    type="button"
                    className="font-extrabold underline underline-offset-4"
                    onClick={() => switchMode("login")}
                  >
                    Accedi
                  </button>
                </>
              )}
            </div>
          </div>
        </PremiumCard>
      </div>
    </div>
  );
}
