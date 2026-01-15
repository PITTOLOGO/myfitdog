"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { onAuthStateChanged, signOut } from "firebase/auth";
import { Timestamp, doc, getDoc } from "firebase/firestore";

import { auth, db } from "./lib/firebase";
import { calcDailyCaloriesV2 } from "./lib/caloriesV2";
import { ensureTodaySummary } from "./lib/dailySummaryRead";
import { getDailySummaries } from "./lib/dailySummaryList";
import { buildCoachInsight } from "./lib/coachRules";
import { upsertTodayCoachTip } from "./lib/coachTips";

import { PremiumCard } from "./components/PremiumCard";
import { CalorieRing } from "./components/CalorieRing";
import { TapButton } from "./components/TapButton";

import {
  Sparkles,
  PawPrint,
  LogOut,
  Plus,
  Info,
  Scale,
  Goal,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
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
  const [authReady, setAuthReady] = useState(false);

  // dog
  const [activeDogId, setActiveDogId] = useState<string | null>(null);
  const [activeDogName, setActiveDogName] = useState<string | null>(null);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [targetWeightKg, setTargetWeightKg] = useState<number | null>(null);

  // kcal
  const [targetKcal, setTargetKcal] = useState<number | null>(null);
  const [targetRange, setTargetRange] = useState<{ low: number; high: number } | null>(null);
  const [kcalNotes, setKcalNotes] = useState<string[]>([]);

  // daily summary
  const [todaySummary, setTodaySummary] = useState<{
    caloriesIn: number;
    caloriesOut: number;
    net: number;
    target: number;
    delta: number;
  } | null>(null);

  // coach
  const [coachInsight, setCoachInsight] = useState<{
    title: string;
    severity: "good" | "warn" | "bad";
    bullets: string[];
  } | null>(null);

  // ✅ Auth listener: set uid + authReady
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUid(u?.uid ?? null);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // ✅ Redirect stabile a /login quando non loggato
  useEffect(() => {
    if (!authReady) return;
    if (uid) return;

    router.replace("/login");

    // fallback hard (utile su Vercel se la navigazione si incarta)
    const t = setTimeout(() => {
      if (window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
    }, 80);

    return () => clearTimeout(t);
  }, [authReady, uid, router]);

  // ✅ Logout stabile
  async function doLogout() {
    await signOut(auth);
    router.replace("/login");
    setTimeout(() => {
      if (window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
    }, 80);
  }

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
        setTodaySummary(null);
        setCoachInsight(null);
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
        activityLevel: d.activityLevel ?? "normal",
        bcs: Number(d.bcs ?? 5),
        lifeStage: d.lifeStage ?? "adult",
        environment: d.environment ?? "indoor",
        seasonFactor: season,
        goalMode: d.goalMode ?? "maintain",
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
      setTodaySummary(null);
      setCoachInsight(null);
    });
  }, [uid]);

  // dailySummary
  useEffect(() => {
    async function loadSummary() {
      if (!uid || !activeDogId || !targetKcal) return;
      const s = await ensureTodaySummary({ uid, dogId: activeDogId, target: targetKcal });
      setTodaySummary(s);
    }
    loadSummary().catch(() => setTodaySummary(null));
  }, [uid, activeDogId, targetKcal]);

  // coach
  useEffect(() => {
    async function loadCoach() {
      if (!uid || !activeDogId || !targetKcal) return;

      const rows = await getDailySummaries(uid, activeDogId);
      const last14Arr = rows.slice(-14).map((r) => Number(r.net ?? 0));
      const last7Arr = rows.slice(-7).map((r) => Number(r.net ?? 0));

      if (!last7Arr.length) {
        setCoachInsight({
          title: "Coach",
          severity: "good",
          bullets: ["Inizia a loggare: dopo 7 giorni avrò consigli più precisi."],
        });
        return;
      }

      const insight = buildCoachInsight({
        target: targetKcal,
        last7: last7Arr,
        last14: last14Arr.length ? last14Arr : last7Arr,
      });

      setCoachInsight(insight);

      await upsertTodayCoachTip({
        uid,
        dogId: activeDogId,
        insight,
        metrics: {
          target: targetKcal,
          avg7: Math.round(last7Arr.reduce((a, b) => a + b, 0) / last7Arr.length),
          avg14: Math.round(
            (last14Arr.length ? last14Arr : last7Arr).reduce((a, b) => a + b, 0) /
              (last14Arr.length ? last14Arr.length : last7Arr.length)
          ),
        },
      });
    }

    loadCoach().catch(() => setCoachInsight(null));
  }, [uid, activeDogId, targetKcal]);

  const headerBadges = useMemo(() => {
    const w = weightKg != null ? `${weightKg} kg` : "—";
    const t = targetWeightKg != null ? `${targetWeightKg} kg` : "—";
    return { w, t };
  }, [weightKg, targetWeightKg]);

  // ✅ Loader mentre Firebase decide se sei loggato
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

  // ✅ Non loggato -> redirect in corso -> non renderizzare home
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

        {/* ✅ Logout corretto */}
        <TapButton size="sm" fullWidth={false} variant="secondary" onClick={doLogout}>
          <LogOut className="h-4 w-4" />
          Logout
        </TapButton>
      </div>

      <div className="grid gap-3 mt-4">
        {/* Oggi (ring) */}
        {todaySummary ? (
          <PremiumCard
            tone="cream"
            icon="📊"
            title="Oggi"
            subtitle={`Target: ${todaySummary.target} kcal`}
            right={
              <span className="text-xs font-extrabold px-2 py-1 rounded-xl bg-white/80 ring-1 ring-black/5 shadow-sm">
                Δ {todaySummary.delta >= 0 ? "+" : ""}
                {todaySummary.delta}
              </span>
            }
            onClick={() => router.push("/log")}
          >
            <div className="grid gap-3">
              <CalorieRing
                eaten={todaySummary.caloriesIn}
                target={todaySummary.target}
                burned={todaySummary.caloriesOut}
              />

              <div className="flex items-center justify-between rounded-2xl bg-white/70 ring-1 ring-black/5 px-3 py-2">
                <div className="text-xs text-zinc-700/70 font-extrabold">Net</div>
                <div className="text-sm font-black tabular-nums">{todaySummary.net}</div>
              </div>

              {targetKcal && kcalNotes.length ? (
                <details className="rounded-2xl bg-white/70 ring-1 ring-black/5 p-3">
                  <summary className="list-none [&::-webkit-details-marker]:hidden flex items-center justify-between cursor-pointer select-none">
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-zinc-700/70" />
                      <span className="text-xs font-extrabold text-zinc-800">Dettagli calcolo</span>
                    </div>
                    <span className="text-[11px] font-extrabold text-zinc-700/70">
                      {targetKcal}
                      {targetRange ? ` (≈ ${targetRange.low}–${targetRange.high})` : ""} kcal
                    </span>
                  </summary>

                  <ul className="mt-2 text-[13px] leading-relaxed text-zinc-800/90 space-y-1.5">
                    {kcalNotes.slice(0, 6).map((n, idx) => (
                      <li key={idx} className="flex gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-zinc-900/25 shrink-0" />
                        <span>{n}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          </PremiumCard>
        ) : null}

        {/* Coach */}
        {coachInsight ? (
          <PremiumCard
            tone={
              coachInsight.severity === "good"
                ? "mint"
                : coachInsight.severity === "warn"
                ? "peach"
                : "peach"
            }
            icon={<Sparkles className="h-5 w-5" />}
            title={coachInsight.title}
            subtitle="Consigli basati sui tuoi ultimi giorni"
            onClick={() => router.push("/log")}
          >
            <div className="grid gap-3">
              <ul className="grid gap-2">
                {coachInsight.bullets.slice(0, 3).map((b, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-0.5 shrink-0">
                      {coachInsight.severity === "good" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : coachInsight.severity === "warn" ? (
                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                    </span>
                    <span className="text-[13px] leading-relaxed text-zinc-800/90">{b}</span>
                  </li>
                ))}
              </ul>

              <div className="text-[11px] font-extrabold text-zinc-700/70">
                Tocca per aprire il log e vedere i dettagli.
              </div>
            </div>
          </PremiumCard>
        ) : null}

        {/* Azioni principali (riordinate) */}
        <div className="grid grid-cols-2 gap-3 mt-2">
          <TapButton variant="primary" onClick={() => router.push("/log")}>
            <Plus className="h-4 w-4" />
            Pasto
          </TapButton>

          <TapButton variant="primary" onClick={() => router.push("/log")}>
            <Plus className="h-4 w-4" />
            Attività
          </TapButton>
        </div>

        {/* ✅ SOLO Cane (Cibi rimosso) */}
        <div className="mt-2">
          <TapButton onClick={() => router.push("/dog")}>Cane</TapButton>
        </div>
      </div>
    </div>
  );
}
