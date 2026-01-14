"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { auth, db } from "./lib/firebase";
import { calcDailyCalories } from "./lib/calories";

import { PremiumCard } from "./components/PremiumCard";
import { TapButton } from "./components/TapButton";

import {
  Target,
  Drumstick,
  Activity as ActivityIcon,
  Sparkles,
  PawPrint,
  LogOut,
  Plus,
  Flame,
  Timer,
} from "lucide-react";

function startOfTodayTimestamp() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(d);
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

export default function Home() {
  const router = useRouter();

  const [uid, setUid] = useState<string | null>(null);

  // dog + kcal
  const [activeDogId, setActiveDogId] = useState<string | null>(null);
  const [activeDogName, setActiveDogName] = useState<string | null>(null);

  const [targetKcal, setTargetKcal] = useState<number | null>(null);
  const [targetRange, setTargetRange] = useState<{ low: number; high: number } | null>(null);

  // today logs
  const [eatenToday, setEatenToday] = useState<number>(0);
  const [activityToday, setActivityToday] = useState<number>(0);

  // 1) auth
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      if (!u) router.push("/login");
      else setUid(u.uid);
    });
  }, [router]);

  // 2) load active dog + calc kcal
  useEffect(() => {
    async function loadDogAndCalc() {
      if (!uid) return;

      const userSnap = await getDoc(doc(db, "users", uid));
      const dogId = (userSnap.data() as any)?.activeDogId as string | undefined;

      if (!dogId) {
        setActiveDogId(null);
        setActiveDogName(null);
        setTargetKcal(null);
        setTargetRange(null);
        setEatenToday(0);
        setActivityToday(0);
        return;
      }

      setActiveDogId(dogId);

      const dogSnap = await getDoc(doc(db, "users", uid, "dogs", dogId));
      if (!dogSnap.exists()) return;

      const d = dogSnap.data() as any;
      setActiveDogName(d.name ?? null);

      const out = calcDailyCalories({
        weightKg: Number(d.weightKg),
        targetWeightKg: Number(d.targetWeightKg),
        neutered: Boolean(d.neutered),
        activityLevel: (d.activityLevel ?? "normal"),
      });

      setTargetKcal(out.recommended);
      setTargetRange(out.range);
    }

    loadDogAndCalc().catch(() => {
      setActiveDogId(null);
      setActiveDogName(null);
      setTargetKcal(null);
      setTargetRange(null);
      setEatenToday(0);
      setActivityToday(0);
    });
  }, [uid]);

  // 3) load today logs
  useEffect(() => {
    async function loadToday() {
      if (!uid || !activeDogId) return;

      const start = startOfTodayTimestamp();

      const foodRef = collection(db, "users", uid, "dogs", activeDogId, "foodLogs");
      const foodSnap = await getDocs(query(foodRef, where("createdAt", ">=", start)));

      let kcalSum = 0;
      foodSnap.forEach((x) => {
        const v = x.data() as any;
        kcalSum += Number(v.kcal ?? 0);
      });
      setEatenToday(kcalSum);

      const actRef = collection(db, "users", uid, "dogs", activeDogId, "activityLogs");
      const actSnap = await getDocs(query(actRef, where("createdAt", ">=", start)));

      let minSum = 0;
      actSnap.forEach((x) => {
        const v = x.data() as any;
        minSum += Number(v.minutes ?? 0);
      });
      setActivityToday(minSum);
    }

    loadToday().catch(() => {
      setEatenToday(0);
      setActivityToday(0);
    });
  }, [uid, activeDogId]);

  const progress = useMemo(() => {
    if (!targetKcal || targetKcal <= 0) return 0;
    return clamp01(eatenToday / targetKcal);
  }, [eatenToday, targetKcal]);

  const pct = Math.max(0.02, progress);
  const progressPct = `${Math.round(pct * 100)}%`;

  const delta = useMemo(() => {
    if (!targetKcal) return null;
    return targetKcal - eatenToday;
  }, [targetKcal, eatenToday]);

  if (!uid) return null;

  return (
    <div className="max-w-xl mx-auto p-4 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mt-2 gap-3">
        <div>
          <h2 className="m-0 text-xl font-black tracking-tight">Oggi</h2>
          <div className="text-sm text-zinc-700/80 flex items-center gap-1.5">
            <PawPrint className="h-4 w-4" />
            {activeDogName ? `Cane attivo: ${activeDogName}` : "Seleziona un cane per iniziare"}
          </div>
        </div>

        <TapButton
          size="sm"
          fullWidth={false}
          variant="secondary"
          onClick={() => signOut(auth)}
        >
          <LogOut className="h-4 w-4" />
          Logout
        </TapButton>
      </div>

      {/* Cards */}
      <div className="grid gap-3 mt-4">
        {/* Target */}
        <PremiumCard
          tone="mint"
          icon={<Target className="h-5 w-5" />}
          title={activeDogName ? `Target kcal • ${activeDogName}` : "Target kcal"}
          subtitle={
            targetKcal && targetRange
              ? `${targetRange.low}–${targetRange.high} kcal (consigliato: ${targetKcal})`
              : "Aggiungi un cane per calcolare"
          }
          right={
            <span className="text-xs font-extrabold px-2 py-1 rounded-xl bg-white/80 ring-1 ring-black/5 shadow-sm">
              Oggi
            </span>
          }
        >
          {/* Big numbers */}
          <div className="mt-2 grid gap-3">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xs font-extrabold text-zinc-700/80">Mangiate oggi</div>
                <div className="text-3xl leading-none font-black tracking-tight text-zinc-950">
                  {targetKcal ? eatenToday : "—"}
                  <span className="text-sm font-semibold text-zinc-600/80 ml-1">kcal</span>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs font-extrabold text-zinc-700/80">Target</div>
                <div className="text-2xl leading-none font-black tracking-tight text-zinc-950">
                  {targetKcal ?? "—"}
                  <span className="text-sm font-semibold text-zinc-600/80 ml-1">kcal</span>
                </div>
              </div>
            </div>

            {/* Premium progress */}
            <div className="relative">
              <div className="h-3 rounded-full bg-white/70 ring-1 ring-black/5 shadow-inner overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-300 relative"
                  style={{ width: progressPct }}
                >
                  {/* glow */}
                  <div className="absolute inset-0 bg-white/35" />
                  <div className="absolute -right-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-emerald-300 blur-[6px] opacity-70" />
                </div>
              </div>

              <div className="mt-2 text-xs text-zinc-700/75">
                {targetKcal
                  ? progress >= 1
                    ? "Target raggiunto"
                    : delta !== null
                      ? `Ti restano ~${Math.max(0, delta)} kcal`
                      : "—"
                  : "Vai su Cane e salva i dati"}
              </div>
            </div>

            {/* mini chips */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-white/75 ring-1 ring-black/5 px-3 py-2 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-extrabold text-zinc-700/80">
                  <Flame className="h-4 w-4" />
                  Cibo
                </div>
                <div className="text-sm font-black text-zinc-950 mt-0.5">
                  {targetKcal ? `${eatenToday} kcal` : "—"}
                </div>
              </div>

              <div className="rounded-2xl bg-white/75 ring-1 ring-black/5 px-3 py-2 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-extrabold text-zinc-700/80">
                  <Timer className="h-4 w-4" />
                  Attività
                </div>
                <div className="text-sm font-black text-zinc-950 mt-0.5">
                  {activityToday ? `${activityToday} min` : "—"}
                </div>
              </div>
            </div>
          </div>
        </PremiumCard>

        {/* Quick cards */}
        <div className="grid grid-cols-2 gap-3">
          <PremiumCard
            tone="peach"
            icon={<Drumstick className="h-5 w-5" />}
            title="Mangiate"
            subtitle={targetKcal ? `${eatenToday} kcal` : "—"}
            onClick={() => router.push("/log")}
          />
          <PremiumCard
            tone="sky"
            icon={<ActivityIcon className="h-5 w-5" />}
            title="Attività"
            subtitle={activityToday ? `${activityToday} min` : "—"}
            onClick={() => router.push("/log")}
          />
        </div>

        <PremiumCard
          tone="cream"
          icon={<Sparkles className="h-5 w-5" />}
          title="Coach AI"
          subtitle={
            activeDogName
              ? "Presto: consigli automatici su porzioni e pasti"
              : "Aggiungi il tuo cane per iniziare"
          }
          onClick={() => router.push("/dog")}
        />
      </div>

      {/* Buttons */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <TapButton variant="primary" onClick={() => router.push("/log")}>
          <Plus className="h-4 w-4" />
          Pasto
        </TapButton>
        <TapButton variant="primary" onClick={() => router.push("/log")}>
          <Plus className="h-4 w-4" />
          Attività
        </TapButton>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <TapButton onClick={() => router.push("/dog")}>Cane</TapButton>
        <TapButton onClick={() => router.push("/foods")}>Cibi</TapButton>
      </div>
    </div>
  );
}
