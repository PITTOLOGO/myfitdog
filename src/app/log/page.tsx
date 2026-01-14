"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { onAuthStateChanged } from "firebase/auth";
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { auth, db } from "../lib/firebase";
import { calcDailyCaloriesV2 } from "../lib/caloriesV2";

import { PremiumCard } from "../components/PremiumCard";
import { TapButton } from "../components/TapButton";

import { Sparkles, Info, TrendingDown, Flame } from "lucide-react";

function startOfTodayTimestamp() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(d);
}

function startOfDayTimestamp(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(d);
}

function deriveSeasonFromMonth(): "cold" | "mild" | "hot" {
  const m = new Date().getMonth() + 1;
  if (m === 12 || m === 1 || m === 2) return "cold";
  if (m >= 6 && m <= 8) return "hot";
  return "mild";
}

const FOOD_PRESETS = [
  { id: "kibble_standard", label: "Crocchette (standard)", kcalPer100g: 360 },
  { id: "kibble_light", label: "Crocchette (light)", kcalPer100g: 310 },
  { id: "wet_standard", label: "Umido (standard)", kcalPer100g: 110 },
  { id: "treats", label: "Snack/Biscotti", kcalPer100g: 420 },
  { id: "chicken", label: "Pollo (cotto)", kcalPer100g: 165 },
  { id: "rice", label: "Riso (cotto)", kcalPer100g: 130 },
];

const ACTIVITY_PRESETS = [
  { id: "walk_normal", label: "Passeggiata (normale)", kcalPerKgPerHour: 2.0 },
  { id: "walk_fast", label: "Passeggiata (svelta)", kcalPerKgPerHour: 2.6 },
  { id: "play_active", label: "Gioco (attivo)", kcalPerKgPerHour: 3.6 },
  { id: "run_easy", label: "Corsa (leggera)", kcalPerKgPerHour: 4.2 },
  { id: "fetch", label: "Riporto / pallina", kcalPerKgPerHour: 3.8 },
];

export default function LogPage() {
  const router = useRouter();

  const [uid, setUid] = useState<string | null>(null);
  const [activeDogId, setActiveDogId] = useState<string | null>(null);

  const [dogName, setDogName] = useState<string | null>(null);
  const [dogWeightKg, setDogWeightKg] = useState<number | null>(null);

  // V2 target
  const [targetKcal, setTargetKcal] = useState<number | null>(null);
  const [targetRange, setTargetRange] = useState<{ low: number; high: number } | null>(null);
  const [goalMode, setGoalMode] = useState<"maintain" | "lose">("maintain");
  const [notes, setNotes] = useState<string[]>([]);

  // coach stats
  const [avg7, setAvg7] = useState<number | null>(null);
  const [avg14, setAvg14] = useState<number | null>(null);

  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // --- Meal form ---
  const [foodId, setFoodId] = useState(FOOD_PRESETS[0].id);
  const [grams, setGrams] = useState<number>(100);
  const [savingMeal, setSavingMeal] = useState(false);

  const food = useMemo(
    () => FOOD_PRESETS.find((f) => f.id === foodId) ?? FOOD_PRESETS[0],
    [foodId]
  );

  const mealKcal = useMemo(() => Math.round((grams * food.kcalPer100g) / 100), [grams, food]);

  // --- Activity form ---
  const [actId, setActId] = useState(ACTIVITY_PRESETS[0].id);
  const [minutes, setMinutes] = useState<number>(30);
  const [savingAct, setSavingAct] = useState(false);

  const act = useMemo(
    () => ACTIVITY_PRESETS.find((a) => a.id === actId) ?? ACTIVITY_PRESETS[0],
    [actId]
  );

  const activityKcal = useMemo(() => {
    if (!dogWeightKg) return null;
    const hours = minutes / 60;
    return Math.round(dogWeightKg * act.kcalPerKgPerHour * hours);
  }, [dogWeightKg, minutes, act]);

  // Auth
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      if (!u) router.push("/login");
      else setUid(u.uid);
    });
  }, [router]);

  // Load active dog + calc target v2
  useEffect(() => {
    async function loadDog() {
      if (!uid) return;

      setErr(null);

      const userSnap = await getDoc(doc(db, "users", uid));
      const dogId = (userSnap.data() as any)?.activeDogId as string | undefined;

      if (!dogId) {
        setActiveDogId(null);
        setDogName(null);
        setDogWeightKg(null);
        setTargetKcal(null);
        setTargetRange(null);
        setGoalMode("maintain");
        setNotes([]);
        return;
      }

      const dogSnap = await getDoc(doc(db, "users", uid, "dogs", dogId));
      if (!dogSnap.exists()) return;

      const d = dogSnap.data() as any;

      setActiveDogId(dogId);
      setDogName(d.name ?? null);
      setDogWeightKg(Number(d.weightKg ?? 0));

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
      setGoalMode((d.goalMode ?? "maintain") as any);
      setNotes(out.notes ?? []);
    }

    loadDog().catch((e: any) => setErr(e?.message ?? "Errore caricamento cane"));
  }, [uid]);

  // Coach: media 7 e 14 giorni di calorie (foodLogs)
  useEffect(() => {
    async function loadCoachStats() {
      if (!uid || !activeDogId) return;

      const start14 = startOfDayTimestamp(13); // oggi incluso = 14 giorni
      const foodRef = collection(db, "users", uid, "dogs", activeDogId, "foodLogs");
      const snap = await getDocs(query(foodRef, where("createdAt", ">=", start14)));

      // bucket per giorno
      const dayMap = new Map<string, number>();
      snap.forEach((docu) => {
        const v = docu.data() as any;
        const ts = v.createdAt as Timestamp | undefined;
        const kcal = Number(v.kcal ?? 0);
        if (!ts) return;
        const d = ts.toDate();
        d.setHours(0, 0, 0, 0);
        const key = d.toISOString().slice(0, 10);
        dayMap.set(key, (dayMap.get(key) ?? 0) + kcal);
      });

      // crea array giorni (ultimi 14)
      const arr14: number[] = [];
      for (let i = 13; i >= 0; i--) {
        const dt = new Date();
        dt.setDate(dt.getDate() - i);
        dt.setHours(0, 0, 0, 0);
        const key = dt.toISOString().slice(0, 10);
        arr14.push(dayMap.get(key) ?? 0);
      }

      const sum14 = arr14.reduce((a, b) => a + b, 0);
      const avg14 = sum14 / 14;

      const last7 = arr14.slice(7);
      const avg7 = last7.reduce((a, b) => a + b, 0) / 7;

      setAvg14(Math.round(avg14));
      setAvg7(Math.round(avg7));
    }

    loadCoachStats().catch(() => {
      setAvg7(null);
      setAvg14(null);
    });
  }, [uid, activeDogId]);

  async function addMeal() {
    const u = uid;
    const dogId = activeDogId;
    if (!u || !dogId) {
      setErr("Seleziona un cane prima (vai su Cane).");
      return;
    }

    setErr(null);
    setOk(null);
    setSavingMeal(true);

    try {
      const ref = collection(db, "users", u, "dogs", dogId, "foodLogs");
      await addDoc(ref, {
        type: food.id,
        label: food.label,
        grams,
        kcal: mealKcal,
        createdAt: serverTimestamp(),
        day: startOfTodayTimestamp(),
      });

      setOk("Pasto salvato ✅");
      setTimeout(() => setOk(null), 1500);
    } catch (e: any) {
      setErr(e?.message ?? "Errore salvataggio pasto");
    } finally {
      setSavingMeal(false);
    }
  }

  async function addActivity() {
    const u = uid;
    const dogId = activeDogId;
    if (!u || !dogId) {
      setErr("Seleziona un cane prima (vai su Cane).");
      return;
    }

    setErr(null);
    setOk(null);
    setSavingAct(true);

    try {
      const ref = collection(db, "users", u, "dogs", dogId, "activityLogs");
      await addDoc(ref, {
        type: act.id,
        label: act.label,
        minutes,
        kcal: activityKcal ?? null,
        createdAt: serverTimestamp(),
        day: startOfTodayTimestamp(),
      });

      setOk("Attività salvata ✅");
      setTimeout(() => setOk(null), 1500);
    } catch (e: any) {
      setErr(e?.message ?? "Errore salvataggio attività");
    } finally {
      setSavingAct(false);
    }
  }

  // Coach text (rule-based)
  const coach = useMemo(() => {
    if (!targetKcal) {
      return {
        title: "Coach",
        bullets: ["Aggiungi un cane e completa il profilo per calcolare il target."],
      };
    }

    const bullets: string[] = [];
    if (goalMode === "lose") bullets.push("Modalità dimagrimento attiva: mantieni costanza per 14 giorni.");

    if (avg7 !== null) {
      const diff = avg7 - targetKcal;
      if (diff > 120) {
        bullets.push(`Media 7 giorni sopra target di ~${diff} kcal: riduci porzioni/snack del 5–10%.`);
      } else if (diff < -120) {
        bullets.push(`Media 7 giorni sotto target di ~${Math.abs(diff)} kcal: ok, ma evita deficit eccessivo.`);
      } else {
        bullets.push("Media 7 giorni in linea col target: continua così.");
      }
    } else {
      bullets.push("Inizia a loggare i pasti: dopo 7 giorni avrò consigli più precisi.");
    }

    if (targetRange) bullets.push(`Range utile: ${targetRange.low}–${targetRange.high} kcal/die.`);

    bullets.push("Tip: pesa gli snack—sono quelli che sballano di più le calorie.");

    return { title: "Coach", bullets };
  }, [targetKcal, targetRange, avg7, goalMode]);

  return (
    <div className="max-w-xl mx-auto p-4 min-h-screen bg-[#FFFBF5]">
      <div className="flex items-center justify-between mt-2">
        <div>
          <h2 className="text-xl font-black m-0">Log</h2>
          <div className="text-sm text-zinc-700/80">
            {dogName ? `Per: ${dogName}` : "Nessun cane attivo (vai su Cane)"}
          </div>
        </div>

        <TapButton onClick={() => router.push("/")}>← Home</TapButton>
      </div>

      {err ? <div className="mt-3 text-sm text-red-600">{err}</div> : null}
      {ok ? <div className="mt-3 text-sm text-green-700 font-semibold">{ok}</div> : null}

      {/* COACH CARD */}
      <div className="mt-4">
        <PremiumCard
          tone="cream"
          icon={<Sparkles className="h-5 w-5" />}
          title={coach.title}
          subtitle={targetKcal ? `Target di oggi: ${targetKcal} kcal` : "Completa profilo cane"}
          right={
            targetKcal ? (
              <span className="text-xs font-extrabold px-2 py-1 rounded-xl bg-white/80 ring-1 ring-black/5 shadow-sm flex items-center gap-1">
                <Flame className="h-3.5 w-3.5" />
                {avg7 !== null ? `Media 7g: ${avg7}` : "Media 7g: —"}
              </span>
            ) : null
          }
        >
          {notes.length ? (
            <div className="mb-3 rounded-2xl bg-white/70 ring-1 ring-black/5 p-3">
              <div className="flex items-center gap-2 text-xs font-extrabold text-zinc-700/80">
                <Info className="h-4 w-4" />
                Calcolo su misura
              </div>
              <div className="mt-2 text-xs text-zinc-700/70 grid gap-1">
                {notes.slice(0, 3).map((n, idx) => (
                  <div key={idx}>• {n}</div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="text-sm text-zinc-800/80">
            <div className="font-extrabold flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Consigli
            </div>
            <div className="mt-2 text-sm text-zinc-700/80 grid gap-1.5">
              {coach.bullets.map((b, i) => (
                <div key={i}>• {b}</div>
              ))}
            </div>
          </div>
        </PremiumCard>
      </div>

      <div className="grid gap-3 mt-4">
        <PremiumCard tone="peach" icon="🍗" title="Aggiungi Pasto" subtitle="Scegli tipo e grammi">
          <div className="grid gap-3">
            <div className="grid gap-1">
              <div className="text-xs font-extrabold text-zinc-700/80">Tipo</div>
              <select
                className="w-full p-3 rounded-2xl border bg-white"
                value={foodId}
                onChange={(e) => setFoodId(e.target.value)}
              >
                {FOOD_PRESETS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-1">
              <div className="flex justify-between text-xs text-zinc-700/80">
                <span className="font-extrabold">Grammi</span>
                <span className="font-semibold">{grams} g</span>
              </div>
              <input
                type="range"
                min={10}
                max={400}
                step={5}
                value={grams}
                onChange={(e) => setGrams(Number(e.target.value))}
              />
              <div className="text-sm font-extrabold">Stima: {mealKcal} kcal</div>
            </div>

            <TapButton variant="dark" onClick={addMeal}>
              {savingMeal ? "Salvo..." : "Salva pasto"}
            </TapButton>
          </div>
        </PremiumCard>

        <PremiumCard tone="sky" icon="🎾" title="Aggiungi Attività" subtitle="Scegli tipo e durata">
          <div className="grid gap-3">
            <div className="grid gap-1">
              <div className="text-xs font-extrabold text-zinc-700/80">Tipo</div>
              <select
                className="w-full p-3 rounded-2xl border bg-white"
                value={actId}
                onChange={(e) => setActId(e.target.value)}
              >
                {ACTIVITY_PRESETS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-1">
              <div className="flex justify-between text-xs text-zinc-700/80">
                <span className="font-extrabold">Durata</span>
                <span className="font-semibold">{minutes} min</span>
              </div>
              <input
                type="range"
                min={5}
                max={180}
                step={5}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
              />
              <div className="text-sm font-extrabold">
                {activityKcal !== null ? `Stima: ${activityKcal} kcal` : "Stima: —"}
              </div>
              {dogWeightKg ? (
                <div className="text-xs text-zinc-700/70">Peso usato: {dogWeightKg} kg</div>
              ) : null}
            </div>

            <TapButton variant="dark" onClick={addActivity}>
              {savingAct ? "Salvo..." : "Salva attività"}
            </TapButton>
          </div>
        </PremiumCard>
      </div>
    </div>
  );
}
