"use client";

export const dynamic = "force-dynamic";

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
import { calcDailyCaloriesV2 } from "./lib/caloriesV2";

import { PremiumCard } from "./components/PremiumCard";
import { TapButton } from "./components/TapButton";

import {
  Target,
  Drumstick,
  Activity,
  Sparkles,
  PawPrint,
  LogOut,
  Plus,
  Info,
  Scale,
  Goal,
} from "lucide-react";

function startOfTodayTimestamp() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(d);
}

function deriveSeasonFromMonth(): "cold" | "mild" | "hot" {
  const m = new Date().getMonth() + 1;
  if (m === 12 || m === 1 || m === 2) return "cold";
  if (m >= 6 && m <= 8) return "hot";
  return "mild";
}

export default function Home() {
  const router = useRouter();

  const [uid, setUid] = useState<string | null>(null);

  // dog
  const [activeDogId, setActiveDogId] = useState<string | null>(null);
  const [activeDogName, setActiveDogName] = useState<string | null>(null);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [targetWeightKg, setTargetWeightKg] = useState<number | null>(null);

  // kcal
  const [targetKcal, setTargetKcal] = useState<number | null>(null);
  const [targetRange, setTargetRange] = useState<{ low: number; high: number } | null>(null);
  const [kcalNotes, setKcalNotes] = useState<string[]>([]);

  // today logs
  const [eatenToday, setEatenToday] = useState<number>(0);
  const [activityToday, setActivityToday] = useState<number>(0);

  // auth
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      if (!u) router.push("/login");
      else setUid(u.uid);
    });
  }, [router]);

  // load active dog + calc kcal v2
  useEffect(() => {
    async function loadDogAndCalc() {
      if (!uid) return;

      const userSnap = await getDoc(doc(db, "users", uid));
      const dogId = (userSnap.data() as any)?.activeDogId as string | undefined;

      if (!dogId) {
        setActiveDogId(null);
        setActiveDogName(null);
        setWeightKg(null);
        setTargetWeightKg(null);

        setTargetKcal(null);
        setTargetRange(null);
        setKcalNotes([]);
        setEatenToday(0);
        setActivityToday(0);
        return;
      }

      setActiveDogId(dogId);

      const dogSnap = await getDoc(doc(db, "users", uid, "dogs", dogId));
      if (!dogSnap.exists()) return;

      const d = dogSnap.data() as any;

      setActiveDogName(d.name ?? null);
      setWeightKg(Number(d.weightKg ?? null));
      setTargetWeightKg(Number(d.targetWeightKg ?? null));

      const season =
        (d.seasonFactor ?? "auto") === "auto" ? deriveSeasonFromMonth() : (d.seasonFactor ?? "mild");

      const out = calcDailyCaloriesV2({
        weightKg: Number(d.weightKg),
        targetWeightKg: Number(d.targetWeightKg),
        neutered: Boolean(d.neutered),
        activityLevel: (d.activityLevel ?? "normal"),

        bcs: Number(d.bcs ?? 5),
        lifeStage: (d.lifeStage ?? "adult"),
        environment: (d.environment ?? "indoor"),
        seasonFactor: season,
        goalMode: (d.goalMode ?? "maintain"),
        weeklyLossRatePct: Number(d.weeklyLossRatePct ?? 0.75),
        breed: String(d.breed ?? ""),
      });

      setTargetKcal(out.recommended);
      setTargetRange(out.range);
      setKcalNotes(out.notes ?? []);
    }

    loadDogAndCalc().catch(() => {
      setActiveDogId(null);
      setActiveDogName(null);
      setWeightKg(null);
      setTargetWeightKg(null);

      setTargetKcal(null);
      setTargetRange(null);
      setKcalNotes([]);
      setEatenToday(0);
      setActivityToday(0);
    });
  }, [uid]);

  // load today logs
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
    return Math.max(0, Math.min(1, eatenToday / targetKcal));
  }, [eatenToday, targetKcal]);

  const progressPct = `${Math.max(2, Math.round(progress * 100))}%`;

  if (!uid) return null;

  return (
    <div className="max-w-xl mx-auto p-4 min-h-screen bg-[#FFFBF5]">
      {/* Header */}
      <div className="flex justify-between items-center mt-2 gap-3">
        <div>
          <h2 className="m-0 text-xl font-black tracking-tight">Oggi</h2>
          <div className="text-sm text-zinc-700/80 flex items-center gap-1.5">
            <PawPrint className="h-4 w-4" />
            {activeDogName ? `Cane attivo: ${activeDogName}` : "Seleziona un cane per iniziare"}
          </div>

          {/* peso + obiettivo sempre visibili */}
          {activeDogName ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="text-xs font-extrabold px-2 py-1 rounded-xl bg-white/80 ring-1 ring-black/5 shadow-sm flex items-center gap-1">
                <Scale className="h-3.5 w-3.5" />
                Peso: {weightKg ?? "—"} kg
              </span>
              <span className="text-xs font-extrabold px-2 py-1 rounded-xl bg-white/80 ring-1 ring-black/5 shadow-sm flex items-center gap-1">
                <Goal className="h-3.5 w-3.5" />
                Obiettivo: {targetWeightKg ?? "—"} kg
              </span>
            </div>
          ) : null}
        </div>

        <TapButton size="sm" fullWidth={false} variant="secondary" onClick={() => signOut(auth)}>
          <LogOut className="h-4 w-4" />
          Logout
        </TapButton>
      </div>

      {/* Cards */}
      <div className="grid gap-3 mt-4">
        <PremiumCard
          tone="mint"
          icon={<Target className="h-5 w-5" />}
          title={activeDogName ? `Target kcal • ${activeDogName}` : "Target kcal"}
          subtitle={
            targetKcal && targetRange
              ? `${targetKcal} kcal (≈ ${targetRange.low}–${targetRange.high})`
              : "Aggiungi un cane per calcolare"
          }
          right={
            <span className="text-xs font-extrabold px-2 py-1 rounded-xl bg-white/80 ring-1 ring-black/5 shadow-sm">
              Oggi
            </span>
          }
        >
          <div className="mt-1">
            <div className="flex justify-between text-xs text-zinc-700/80 mb-1">
              <span>Mangiate oggi</span>
              <span className="font-semibold">
                {targetKcal ? `${eatenToday} / ${targetKcal}` : "—"}
              </span>
            </div>

            <div className="h-3 rounded-full bg-white/70 ring-1 ring-black/5 shadow-inner overflow-hidden">
              <div className="h-full rounded-full bg-emerald-300" style={{ width: progressPct }} />
            </div>

            <div className="mt-2 text-xs text-zinc-700/70">
              {targetKcal
                ? progress >= 1
                  ? "Hai raggiunto il target"
                  : "Obiettivo di oggi: restare nel range"
                : "Vai su Cane e salva i dati"}
            </div>

            {kcalNotes.length ? (
              <div className="mt-3 rounded-2xl bg-white/70 ring-1 ring-black/5 p-3">
                <div className="flex items-center gap-2 text-xs font-extrabold text-zinc-700/80">
                  <Info className="h-4 w-4" />
                  Calcolo su misura
                </div>
                <ul className="mt-2 text-xs text-zinc-700/70 list-disc pl-4 space-y-1">
                  {kcalNotes.slice(0, 4).map((n, idx) => (
                    <li key={idx}>{n}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </PremiumCard>

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
            icon={<Activity className="h-5 w-5" />}
            title="Attività"
            subtitle={activityToday ? `${activityToday} min` : "—"}
            onClick={() => router.push("/log")}
          />
        </div>

        <PremiumCard
          tone="cream"
          icon={<Sparkles className="h-5 w-5" />}
          title="Coach"
          subtitle={activeDogName ? "Consigli automatici basati sui log" : "Aggiungi il tuo cane per iniziare"}
          onClick={() => router.push("/log")}
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
