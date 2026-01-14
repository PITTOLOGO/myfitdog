"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { onAuthStateChanged } from "firebase/auth";
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";

import { auth, db } from "../lib/firebase";
import { PremiumCard } from "../components/PremiumCard";
import { TapButton } from "../components/TapButton";

import {
  ChevronLeft,
  Drumstick,
  Activity,
  Utensils,
  Timer,
  PawPrint,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

function startOfTodayTimestamp() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(d);
}

const FOOD_PRESETS = [
  { id: "kibble_standard", label: "Crocchette (standard)", kcalPer100g: 360 },
  { id: "kibble_light", label: "Crocchette (light)", kcalPer100g: 310 },
  { id: "kibble_puppy", label: "Crocchette (puppy)", kcalPer100g: 400 },

  { id: "wet_standard", label: "Umido (standard)", kcalPer100g: 110 },
  { id: "wet_pate", label: "Umido (paté)", kcalPer100g: 140 },
  { id: "wet_mousse", label: "Umido (mousse)", kcalPer100g: 125 },

  { id: "raw_mix", label: "Dieta cruda (mix)", kcalPer100g: 160 },
  { id: "cooked_home", label: "Cotto casalingo (medio)", kcalPer100g: 140 },

  { id: "treats_small", label: "Snack (piccoli)", kcalPer100g: 380 },
  { id: "treats_biscuits", label: "Biscotti", kcalPer100g: 420 },
  { id: "chew", label: "Masticativo (medio)", kcalPer100g: 350 },

  // “extra” comuni (valori medi)
  { id: "chicken", label: "Pollo (cotto)", kcalPer100g: 165 },
  { id: "turkey", label: "Tacchino (cotto)", kcalPer100g: 150 },
  { id: "rice", label: "Riso (cotto)", kcalPer100g: 130 },
  { id: "pasta", label: "Pasta (cotta)", kcalPer100g: 150 },
  { id: "carrots", label: "Carote", kcalPer100g: 41 },
];


const ACTIVITY_PRESETS = [
  { id: "walk_easy", label: "Passeggiata (lenta)", kcalPerKgPerHour: 1.5 },
  { id: "walk_normal", label: "Passeggiata (normale)", kcalPerKgPerHour: 2.0 },
  { id: "walk_fast", label: "Passeggiata (svelta)", kcalPerKgPerHour: 2.6 },

  { id: "play_light", label: "Gioco (leggero)", kcalPerKgPerHour: 2.8 },
  { id: "play_active", label: "Gioco (attivo)", kcalPerKgPerHour: 3.6 },

  { id: "run_easy", label: "Corsa (leggera)", kcalPerKgPerHour: 4.2 },
  { id: "run_fast", label: "Corsa (intensa)", kcalPerKgPerHour: 5.5 },

  { id: "fetch", label: "Riporto / pallina", kcalPerKgPerHour: 3.8 },
  { id: "hike", label: "Trekking", kcalPerKgPerHour: 3.2 },
  { id: "swim", label: "Nuoto", kcalPerKgPerHour: 4.8 },

  { id: "training", label: "Addestramento", kcalPerKgPerHour: 2.4 },
];

export default function LogPage() {
  const router = useRouter();

  const [uid, setUid] = useState<string | null>(null);
  const [activeDogId, setActiveDogId] = useState<string | null>(null);
  const [dogName, setDogName] = useState<string | null>(null);
  const [dogWeightKg, setDogWeightKg] = useState<number | null>(null);

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

  const mealKcal = useMemo(() => {
    return Math.round((grams * food.kcalPer100g) / 100);
  }, [grams, food]);

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

  // Load active dog
  useEffect(() => {
    async function loadActiveDog() {
      if (!uid) return;

      setErr(null);
      const userSnap = await getDoc(doc(db, "users", uid));
      const dogId = (userSnap.data() as any)?.activeDogId as string | undefined;

      if (!dogId) {
        setActiveDogId(null);
        setDogName(null);
        setDogWeightKg(null);
        return;
      }

      const dogSnap = await getDoc(doc(db, "users", uid, "dogs", dogId));
      if (!dogSnap.exists()) return;

      const d = dogSnap.data() as any;
      setActiveDogId(dogId);
      setDogName(d.name ?? null);
      setDogWeightKg(Number(d.weightKg ?? 0));
    }

    loadActiveDog().catch((e: any) =>
      setErr(e?.message ?? "Errore caricamento cane")
    );
  }, [uid]);

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

      setOk("Pasto salvato");
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

      setOk("Attività salvata");
      setTimeout(() => setOk(null), 1500);
    } catch (e: any) {
      setErr(e?.message ?? "Errore salvataggio attività");
    } finally {
      setSavingAct(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto p-4 min-h-screen bg-[#FFFBF5]">
      {/* Header */}
      <div className="flex items-center justify-between mt-2 gap-3">
        <div>
          <h2 className="text-xl font-black m-0 tracking-tight">Log</h2>
          <div className="text-sm text-zinc-700/80 flex items-center gap-1.5">
            <PawPrint className="h-4 w-4" />
            {dogName ? `Per: ${dogName}` : "Nessun cane attivo (vai su Cane)"}
          </div>
        </div>

        <TapButton
          size="sm"
          fullWidth={false}
          variant="secondary"
          onClick={() => router.push("/")}
        >
          <ChevronLeft className="h-4 w-4" />
          Home
        </TapButton>
      </div>

      {/* Alerts */}
      {err ? (
        <div className="mt-3 text-sm text-red-700 font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          {err}
        </div>
      ) : null}

      {ok ? (
        <div className="mt-3 text-sm text-emerald-800 font-semibold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          {ok}
        </div>
      ) : null}

      <div className="grid gap-3 mt-4">
        {/* Meal */}
        <PremiumCard
          tone="peach"
          icon={<Drumstick className="h-5 w-5" />}
          title="Aggiungi pasto"
          subtitle="Scegli tipo e grammi"
        >
          <div className="grid gap-3">
            <div className="grid gap-1">
              <div className="text-xs font-extrabold text-zinc-700/80">
                Tipo
              </div>

              <div className="relative">
                <Utensils className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <select
                  className="w-full pl-10 pr-3 py-3 rounded-2xl border border-black/10 bg-white/80 ring-1 ring-black/5 focus:outline-none focus:ring-2 focus:ring-black/10"
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
            </div>

            <div className="grid gap-1">
              <div className="flex justify-between text-xs text-zinc-700/80">
                <span className="font-extrabold">Grammi</span>
                <span className="font-semibold">{grams} g</span>
              </div>

              <input
                className="w-full accent-zinc-900"
                type="range"
                min={10}
                max={400}
                step={5}
                value={grams}
                onChange={(e) => setGrams(Number(e.target.value))}
              />

              <div className="text-sm font-extrabold">
                Stima: {mealKcal} kcal
              </div>
            </div>

            <TapButton variant="primary" onClick={addMeal}>
              {savingMeal ? "Salvo..." : "Salva pasto"}
            </TapButton>
          </div>
        </PremiumCard>

        {/* Activity */}
        <PremiumCard
          tone="sky"
          icon={<Activity className="h-5 w-5" />}
          title="Aggiungi attività"
          subtitle="Scegli tipo e durata"
        >
          <div className="grid gap-3">
            <div className="grid gap-1">
              <div className="text-xs font-extrabold text-zinc-700/80">
                Tipo
              </div>

              <div className="relative">
                <Activity className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <select
                  className="w-full pl-10 pr-3 py-3 rounded-2xl border border-black/10 bg-white/80 ring-1 ring-black/5 focus:outline-none focus:ring-2 focus:ring-black/10"
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
            </div>

            <div className="grid gap-1">
              <div className="flex justify-between text-xs text-zinc-700/80">
                <span className="font-extrabold">Durata</span>
                <span className="font-semibold">{minutes} min</span>
              </div>

              <input
                className="w-full accent-zinc-900"
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
                <div className="text-xs text-zinc-700/70 flex items-center gap-1.5">
                  <Timer className="h-4 w-4" />
                  Peso usato: {dogWeightKg} kg
                </div>
              ) : null}
            </div>

            <TapButton variant="primary" onClick={addActivity}>
              {savingAct ? "Salvo..." : "Salva attività"}
            </TapButton>
          </div>
        </PremiumCard>
      </div>
    </div>
  );
}
