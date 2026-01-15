"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "./lib/firebase";
import { TapButton } from "./components/TapButton";

import { PawPrint, LogOut, Scale, Goal, Plus, Loader2 } from "lucide-react";

export default function Home() {
  const router = useRouter();

  // --- AUTH STATE ---
  const [uid, setUid] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  // --- HEADER DOG INFO (minimo, per non avere home "vuota") ---
  const [activeDogName, setActiveDogName] = useState<string | null>(null);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [targetWeightKg, setTargetWeightKg] = useState<number | null>(null);

  // 1) listener auth (solo setState, niente return/redirect qui)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUid(u?.uid ?? null);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // 2) redirect quando authReady e NON loggato
  useEffect(() => {
    if (!authReady) return;
    if (uid) return;

    router.replace("/login");

    // fallback hard (se Next su Vercel si incarta)
    const t = setTimeout(() => {
      if (window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
    }, 80);

    return () => clearTimeout(t);
  }, [authReady, uid, router]);

  // 3) logout
  async function doLogout() {
    await signOut(auth);
    router.replace("/login");
    setTimeout(() => {
      if (window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
    }, 80);
  }

  // 4) carica header cane (solo se uid presente)
  useEffect(() => {
    async function loadDogHeader() {
      if (!uid) {
        setActiveDogName(null);
        setWeightKg(null);
        setTargetWeightKg(null);
        return;
      }

      const userSnap = await getDoc(doc(db, "users", uid));
      const dogId = (userSnap.data() as any)?.activeDogId as string | undefined;

      if (!dogId) {
        setActiveDogName(null);
        setWeightKg(null);
        setTargetWeightKg(null);
        return;
      }

      const dogSnap = await getDoc(doc(db, "users", uid, "dogs", dogId));
      if (!dogSnap.exists()) return;

      const d = dogSnap.data() as any;
      setActiveDogName(d.name ?? null);
      setWeightKg(d.weightKg != null ? Number(d.weightKg) : null);
      setTargetWeightKg(d.targetWeightKg != null ? Number(d.targetWeightKg) : null);
    }

    loadDogHeader().catch(() => {});
  }, [uid]);

  const headerBadges = useMemo(() => {
    return {
      w: weightKg != null ? `${weightKg} kg` : "—",
      t: targetWeightKg != null ? `${targetWeightKg} kg` : "—",
    };
  }, [weightKg, targetWeightKg]);

  // ---- RENDER ----
  // NB: qui possiamo fare return “condizionali”, perché gli hook sono già tutti sopra.

  if (!authReady) {
    return (
      <div className="max-w-md mx-auto p-4 min-h-screen grid place-items-center">
        <div className="flex items-center gap-2 text-zinc-700/70 font-extrabold">
          <Loader2 className="h-5 w-5 animate-spin" />
          Caricamento…
        </div>
      </div>
    );
  }

  // se non loggato: stiamo già redirectando → non renderizzare home
  if (!uid) return null;

  return (
    <div className="max-w-md mx-auto p-4 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-2xl font-black tracking-tight">Oggi</div>
          <div className="text-sm text-zinc-700/80 font-semibold mt-0.5 flex items-center gap-2">
            <PawPrint className="h-4 w-4" />
            Cane attivo: <span className="font-extrabold">{activeDogName ?? "—"}</span>
          </div>

          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs font-extrabold px-2 py-1 rounded-xl bg-white/80 ring-1 ring-black/5 shadow-sm inline-flex items-center gap-1">
              <Scale className="h-3.5 w-3.5" />
              Peso: {headerBadges.w}
            </span>

            <span className="text-xs font-extrabold px-2 py-1 rounded-xl bg-white/80 ring-1 ring-black/5 shadow-sm inline-flex items-center gap-1">
              <Goal className="h-3.5 w-3.5" />
              Obiettivo: {headerBadges.t}
            </span>
          </div>
        </div>

        <TapButton size="sm" fullWidth={false} variant="secondary" onClick={doLogout}>
          <LogOut className="h-4 w-4" />
          Logout
        </TapButton>
      </div>

      {/* Azioni principali */}
      <div className="grid grid-cols-2 gap-3 mt-6">
        <TapButton variant="primary" onClick={() => router.push("/log")}>
          <Plus className="h-4 w-4" />
          Pasto
        </TapButton>

        <TapButton variant="primary" onClick={() => router.push("/log")}>
          <Plus className="h-4 w-4" />
          Attività
        </TapButton>
      </div>

      <div className="mt-3">
        <TapButton onClick={() => router.push("/dog")}>Cane</TapButton>
      </div>
    </div>
  );
}
