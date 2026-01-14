"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { useRouter } from "next/navigation";

import { PremiumCard } from "../components/PremiumCard";
import { TapButton } from "../components/TapButton";

import {
  ChevronLeft,
  Dog,
  PawPrint,
  BadgeCheck,
  Plus,
  Scale,
  Target,
  Calendar,
  ShieldCheck,
  ShieldX,
  Thermometer,
  Home as HomeIcon,
  Trees,
  TrendingDown,
  Gauge,
  HeartPulse,
} from "lucide-react";

type ActivityLevel = "low" | "normal" | "high";
type Sex = "M" | "F";

type LifeStage = "puppy" | "adult" | "senior";
type Environment = "indoor" | "outdoor" | "mixed";
type SeasonFactor = "auto" | "cold" | "mild" | "hot";
type GoalMode = "maintain" | "lose";

type DogDoc = {
  id: string;
  name: string;
  breed?: string;
  sex: Sex;
  neutered: boolean;
  weightKg: number;
  targetWeightKg: number;
  ageYears?: number; // legacy
  ageMonths?: number; // new
  activityLevel: ActivityLevel;

  // NEW advanced profile
  bcs?: number; // 1-9
  lifeStage?: LifeStage;
  environment?: Environment;
  seasonFactor?: SeasonFactor;
  goalMode?: GoalMode;
  weeklyLossRatePct?: number; // es 0.5, 0.75, 1.0
};

const BREED_PRESETS = [
  "Meticcio",
  "Labrador Retriever",
  "Golden Retriever",
  "Pastore Tedesco",
  "Bulldog Francese",
  "Barboncino",
  "Border Collie",
  "Beagle",
  "Jack Russell Terrier",
  "Chihuahua",
  "Maltese",
  "Carlino",
  "Bassotto",
  "Siberian Husky",
  "Rottweiler",
  "Cane Corso",
];

function buildWeightOptions(min = 1, max = 80, step = 0.5) {
  const arr: number[] = [];
  for (let x = min; x <= max + 1e-9; x += step) arr.push(Math.round(x * 10) / 10);
  return arr;
}
const WEIGHT_OPTIONS = buildWeightOptions(1, 80, 0.5);

function formatAgeFromMonths(totalMonths: number) {
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  if (y <= 0) return `${m} mesi`;
  if (m === 0) return `${y} anni`;
  return `${y} anni ${m} mesi`;
}

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function DogPage() {
  const router = useRouter();

  const [uid, setUid] = useState<string | null>(null);
  const [dogs, setDogs] = useState<DogDoc[]>([]);
  const [activeDogId, setActiveDogId] = useState<string | null>(null);

  // form
  const [name, setName] = useState("");
  const [breedPreset, setBreedPreset] = useState<string>(BREED_PRESETS[0]);
  const [breedCustom, setBreedCustom] = useState("");
  const [sex, setSex] = useState<Sex>("M");
  const [neutered, setNeutered] = useState<boolean>(false);

  const [weightPreset, setWeightPreset] = useState<string>("10"); // select value
  const [weightCustom, setWeightCustom] = useState<string>("");

  const [goalPreset, setGoalPreset] = useState<string>("10");
  const [goalCustom, setGoalCustom] = useState<string>("");

  const [ageYears, setAgeYears] = useState<number>(2);
  const [ageMonths, setAgeMonths] = useState<number>(0);

  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("normal");

  // NEW advanced fields
  const [bcs, setBcs] = useState<number>(5); // 1..9
  const [lifeStage, setLifeStage] = useState<LifeStage>("adult");
  const [environment, setEnvironment] = useState<Environment>("indoor");
  const [seasonFactor, setSeasonFactor] = useState<SeasonFactor>("auto");
  const [goalMode, setGoalMode] = useState<GoalMode>("maintain");
  const [weeklyLossRatePct, setWeeklyLossRatePct] = useState<number>(0.75);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const resolvedBreed = useMemo(() => {
    if (breedPreset === "__custom__") return breedCustom.trim();
    return breedPreset.trim();
  }, [breedPreset, breedCustom]);

  const resolvedWeight = useMemo(() => {
    if (weightPreset === "__custom__") return Number(weightCustom);
    return Number(weightPreset);
  }, [weightPreset, weightCustom]);

  const resolvedGoal = useMemo(() => {
    if (goalPreset === "__custom__") return Number(goalCustom);
    return Number(goalPreset);
  }, [goalPreset, goalCustom]);

  const totalAgeMonths = useMemo(() => {
    const y = Number(ageYears) || 0;
    const m = Number(ageMonths) || 0;
    return Math.max(0, y * 12 + m);
  }, [ageYears, ageMonths]);

  const canSave = useMemo(() => {
    const w = resolvedWeight;
    const g = resolvedGoal;
    return (
      name.trim().length >= 1 &&
      Number.isFinite(w) &&
      w > 0 &&
      Number.isFinite(g) &&
      g > 0 &&
      totalAgeMonths >= 0 &&
      totalAgeMonths <= 12 * 30
    );
  }, [name, resolvedWeight, resolvedGoal, totalAgeMonths]);

  // Auth guard
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      if (!u) router.push("/login");
      else setUid(u.uid);
    });
  }, [router]);

  // Load user + dogs (fix TS + Vercel)
  useEffect(() => {
    async function load() {
      if (!uid) return;
      const userId = uid;

      setLoading(true);
      setErr(null);

      try {
        const userRef = doc(db, "users", userId);
        await setDoc(userRef, { createdAt: serverTimestamp() }, { merge: true });

        const userSnap = await getDoc(userRef);
        const userData = userSnap.data() as any;
        setActiveDogId(userData?.activeDogId ?? null);

        const dogsRef = collection(db, "users", userId, "dogs");
        const snap = await getDocs(dogsRef);

        const list: DogDoc[] = snap.docs.map((d) => {
          const x = d.data() as any;
          const legacyYears = Number(x.ageYears ?? 0);
          const months = Number.isFinite(Number(x.ageMonths))
            ? Number(x.ageMonths)
            : Math.round(legacyYears * 12);

          return {
            id: d.id,
            name: x.name ?? "",
            breed: x.breed ?? "",
            sex: (x.sex ?? "M") as Sex,
            neutered: Boolean(x.neutered),
            weightKg: Number(x.weightKg ?? 0),
            targetWeightKg: Number(x.targetWeightKg ?? 0),
            ageYears: legacyYears,
            ageMonths: months,
            activityLevel: (x.activityLevel ?? "normal") as ActivityLevel,

            // NEW defaults if missing
            bcs: Number(x.bcs ?? 5),
            lifeStage: (x.lifeStage ?? "adult") as LifeStage,
            environment: (x.environment ?? "indoor") as Environment,
            seasonFactor: (x.seasonFactor ?? "auto") as SeasonFactor,
            goalMode: (x.goalMode ?? "maintain") as GoalMode,
            weeklyLossRatePct: Number(x.weeklyLossRatePct ?? 0.75),
          };
        });

        list.sort((a, b) => a.name.localeCompare(b.name));
        setDogs(list);
      } catch (e: any) {
        setErr(e?.message ?? "Errore caricamento");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [uid]);

  async function setActive(id: string) {
    if (!uid) return;
    const userId = uid;

    setErr(null);
    setOk(null);

    try {
      await setDoc(doc(db, "users", userId), { activeDogId: id }, { merge: true });
      setActiveDogId(id);
      setOk("Cane attivo aggiornato");
      setTimeout(() => setOk(null), 1500);
    } catch (e: any) {
      setErr(e?.message ?? "Errore aggiornamento");
    }
  }

  async function saveDog() {
    if (!uid) return;
    const userId = uid;

    setErr(null);
    setOk(null);

    if (!canSave) {
      setErr("Compila i campi obbligatori (nome, peso, obiettivo, età).");
      return;
    }

    setSaving(true);
    try {
      const dogsRef = collection(db, "users", userId, "dogs");

      const docRef = await addDoc(dogsRef, {
        name: name.trim(),
        breed: resolvedBreed || "",
        sex,
        neutered,
        weightKg: resolvedWeight,
        targetWeightKg: resolvedGoal,
        ageMonths: totalAgeMonths,
        ageYears: Math.floor(totalAgeMonths / 12),
        activityLevel,

        // NEW advanced profile
        bcs: Math.max(1, Math.min(9, Number(bcs) || 5)),
        lifeStage,
        environment,
        seasonFactor,
        goalMode,
        weeklyLossRatePct: goalMode === "lose" ? Number(weeklyLossRatePct) || 0.75 : null,

        createdAt: serverTimestamp(),
      });

      await setDoc(doc(db, "users", userId), { activeDogId: docRef.id }, { merge: true });

      setActiveDogId(docRef.id);
      setOk("Cane salvato");
      setTimeout(() => setOk(null), 2000);

      // reset form
      setName("");
      setBreedPreset(BREED_PRESETS[0]);
      setBreedCustom("");
      setSex("M");
      setNeutered(false);

      setWeightPreset("10");
      setWeightCustom("");
      setGoalPreset("10");
      setGoalCustom("");

      setAgeYears(2);
      setAgeMonths(0);
      setActivityLevel("normal");

      // reset advanced
      setBcs(5);
      setLifeStage("adult");
      setEnvironment("indoor");
      setSeasonFactor("auto");
      setGoalMode("maintain");
      setWeeklyLossRatePct(0.75);

      // reload list
      const snap = await getDocs(collection(db, "users", userId, "dogs"));
      const list: DogDoc[] = snap.docs.map((d) => {
        const x = d.data() as any;
        const legacyYears = Number(x.ageYears ?? 0);
        const months = Number.isFinite(Number(x.ageMonths))
          ? Number(x.ageMonths)
          : Math.round(legacyYears * 12);

        return {
          id: d.id,
          name: x.name ?? "",
          breed: x.breed ?? "",
          sex: (x.sex ?? "M") as Sex,
          neutered: Boolean(x.neutered),
          weightKg: Number(x.weightKg ?? 0),
          targetWeightKg: Number(x.targetWeightKg ?? 0),
          ageYears: legacyYears,
          ageMonths: months,
          activityLevel: (x.activityLevel ?? "normal") as ActivityLevel,

          bcs: Number(x.bcs ?? 5),
          lifeStage: (x.lifeStage ?? "adult") as LifeStage,
          environment: (x.environment ?? "indoor") as Environment,
          seasonFactor: (x.seasonFactor ?? "auto") as SeasonFactor,
          goalMode: (x.goalMode ?? "maintain") as GoalMode,
          weeklyLossRatePct: Number(x.weeklyLossRatePct ?? 0.75),
        };
      });
      list.sort((a, b) => a.name.localeCompare(b.name));
      setDogs(list);
    } catch (e: any) {
      setErr(e?.message ?? "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto p-4 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mt-2 gap-3">
        <div>
          <h2 className="text-xl font-black m-0 tracking-tight">Il tuo cane</h2>
          <div className="text-sm text-zinc-700/80 flex items-center gap-1.5">
            <Dog className="h-4 w-4" />
            Profilo + obiettivi su misura
          </div>
        </div>

        <TapButton size="sm" fullWidth={false} variant="secondary" onClick={() => router.push("/")}>
          <ChevronLeft className="h-4 w-4" />
          Home
        </TapButton>
      </div>

      {loading ? (
        <div className="mt-4">
          <PremiumCard tone="cream" icon={<PawPrint className="h-5 w-5" />} title="Caricamento" subtitle="Sto recuperando i dati..." />
        </div>
      ) : (
        <>
          {/* Lista cani */}
          <div className="mt-4">
            <PremiumCard
              tone="cream"
              icon={<PawPrint className="h-5 w-5" />}
              title="Cani salvati"
              subtitle={dogs.length ? "Tocca un cane per impostarlo attivo" : "Aggiungi il primo cane qui sotto"}
              right={
                activeDogId ? (
                  <span className="text-xs font-extrabold px-2 py-1 rounded-xl bg-white/80 ring-1 ring-black/5 shadow-sm">
                    Attivo
                  </span>
                ) : null
              }
            >
              {dogs.length === 0 ? (
                <div className="text-sm text-zinc-700/70 mt-2">
                  Nessun cane ancora. Compila il form per iniziare.
                </div>
              ) : (
                <div className="mt-3 grid gap-2">
                  {dogs.map((d) => {
                    const isActive = activeDogId === d.id;
                    const months = Number(d.ageMonths ?? Math.round((d.ageYears ?? 0) * 12));
                    return (
                      <button
                        key={d.id}
                        onClick={() => setActive(d.id)}
                        className={cn(
                          "text-left rounded-2xl p-3 transition",
                          "ring-1 ring-black/5",
                          "shadow-[0_14px_40px_rgba(17,24,39,0.06)]",
                          isActive ? "bg-emerald-50/70" : "bg-white/80 hover:bg-white"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-extrabold text-zinc-950">
                              {d.name}
                              {d.breed ? (
                                <span className="text-zinc-600/80 font-semibold"> • {d.breed}</span>
                              ) : null}
                            </div>

                            <div className="text-sm text-zinc-700/75 mt-1">
                              Peso: {d.weightKg} kg · Obiettivo: {d.targetWeightKg} kg · Età:{" "}
                              {formatAgeFromMonths(months)} · Attività: {d.activityLevel}
                            </div>

                            <div className="text-xs text-zinc-700/70 mt-1">
                              BCS: {d.bcs ?? 5}/9 · {d.goalMode === "lose" ? "Dimagrimento" : "Mantenimento"} · Stagione:{" "}
                              {d.seasonFactor ?? "auto"}
                            </div>
                          </div>

                          {isActive ? (
                            <div className="flex items-center gap-1 text-emerald-900 font-extrabold text-xs">
                              <BadgeCheck className="h-4 w-4" />
                              ATTIVO
                            </div>
                          ) : (
                            <div className="text-xs font-semibold text-zinc-600/80">
                              Imposta attivo
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </PremiumCard>
          </div>

          {/* Form */}
          <div className="mt-4">
            <PremiumCard
              tone="sky"
              icon={<Plus className="h-5 w-5" />}
              title="Aggiungi cane"
              subtitle="Dati base + profilo avanzato"
            >
              {/* Nome */}
              <div className="grid gap-1">
                <div className="text-xs font-extrabold text-zinc-700/80">Nome *</div>
                <input
                  className="w-full px-4 py-3 rounded-2xl bg-white/80 ring-1 ring-black/5 shadow-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Es. Rocky"
                />
              </div>

              {/* Razza */}
              <div className="grid gap-1 mt-3">
                <div className="text-xs font-extrabold text-zinc-700/80">Razza</div>
                <select
                  className="ui-select w-full px-4 py-3 rounded-2xl bg-white/80 ring-1 ring-black/5"
                  value={breedPreset}
                  onChange={(e) => setBreedPreset(e.target.value)}
                >
                  {BREED_PRESETS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                  <option value="__custom__">Altro…</option>
                </select>

                {breedPreset === "__custom__" ? (
                  <input
                    className="w-full mt-2 px-4 py-3 rounded-2xl bg-white/80 ring-1 ring-black/5 shadow-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                    value={breedCustom}
                    onChange={(e) => setBreedCustom(e.target.value)}
                    placeholder="Scrivi la razza"
                  />
                ) : null}
              </div>

              {/* Sesso + attività */}
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="grid gap-1">
                  <div className="text-xs font-extrabold text-zinc-700/80">Sesso</div>
                  <select
                    className="ui-select w-full px-4 py-3 rounded-2xl bg-white/80 ring-1 ring-black/5"
                    value={sex}
                    onChange={(e) => setSex(e.target.value as Sex)}
                  >
                    <option value="M">Maschio</option>
                    <option value="F">Femmina</option>
                  </select>
                </div>

                <div className="grid gap-1">
                  <div className="text-xs font-extrabold text-zinc-700/80">Livello attività</div>
                  <select
                    className="ui-select w-full px-4 py-3 rounded-2xl bg-white/80 ring-1 ring-black/5"
                    value={activityLevel}
                    onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}
                  >
                    <option value="low">Basso</option>
                    <option value="normal">Normale</option>
                    <option value="high">Alto</option>
                  </select>
                </div>
              </div>

              {/* Neutered toggle */}
              <div className="mt-4">
                <div className="text-xs font-extrabold text-zinc-700/80 mb-2">
                  Sterilizzato / Castrato
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNeutered(true)}
                    className={cn(
                      "rounded-2xl px-4 py-3 text-left ring-1 shadow-sm transition",
                      neutered
                        ? "bg-emerald-50/70 ring-emerald-200/60"
                        : "bg-white/80 ring-black/5 hover:bg-white"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" />
                      <div className="font-extrabold">Sì</div>
                    </div>
                    <div className="text-xs text-zinc-700/70 mt-1">
                      Metabolismo spesso più basso
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNeutered(false)}
                    className={cn(
                      "rounded-2xl px-4 py-3 text-left ring-1 shadow-sm transition",
                      !neutered
                        ? "bg-emerald-50/70 ring-emerald-200/60"
                        : "bg-white/80 ring-black/5 hover:bg-white"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <ShieldX className="h-4 w-4" />
                      <div className="font-extrabold">No</div>
                    </div>
                    <div className="text-xs text-zinc-700/70 mt-1">
                      Valori standard
                    </div>
                  </button>
                </div>
              </div>

              {/* Peso + Obiettivo */}
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="grid gap-1">
                  <div className="text-xs font-extrabold text-zinc-700/80 flex items-center gap-2">
                    <Scale className="h-4 w-4" />
                    Peso (kg) *
                  </div>

                  <select
                    className="ui-select w-full px-4 py-3 rounded-2xl bg-white/80 ring-1 ring-black/5"
                    value={weightPreset}
                    onChange={(e) => setWeightPreset(e.target.value)}
                  >
                    {WEIGHT_OPTIONS.map((w) => (
                      <option key={w} value={String(w)}>
                        {w}
                      </option>
                    ))}
                    <option value="__custom__">Personalizzato…</option>
                  </select>

                  {weightPreset === "__custom__" ? (
                    <input
                      className="w-full mt-2 px-4 py-3 rounded-2xl bg-white/80 ring-1 ring-black/5 shadow-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                      value={weightCustom}
                      onChange={(e) => setWeightCustom(e.target.value)}
                      placeholder="Es. 12.5"
                      inputMode="decimal"
                    />
                  ) : null}
                </div>

                <div className="grid gap-1">
                  <div className="text-xs font-extrabold text-zinc-700/80 flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Obiettivo peso (kg) *
                  </div>

                  <select
                    className="ui-select w-full px-4 py-3 rounded-2xl bg-white/80 ring-1 ring-black/5"
                    value={goalPreset}
                    onChange={(e) => setGoalPreset(e.target.value)}
                  >
                    {WEIGHT_OPTIONS.map((w) => (
                      <option key={w} value={String(w)}>
                        {w}
                      </option>
                    ))}
                    <option value="__custom__">Personalizzato…</option>
                  </select>

                  {goalPreset === "__custom__" ? (
                    <input
                      className="w-full mt-2 px-4 py-3 rounded-2xl bg-white/80 ring-1 ring-black/5 shadow-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                      value={goalCustom}
                      onChange={(e) => setGoalCustom(e.target.value)}
                      placeholder="Es. 10.0"
                      inputMode="decimal"
                    />
                  ) : null}
                </div>
              </div>

              {/* Età */}
              <div className="mt-4">
                <div className="text-xs font-extrabold text-zinc-700/80 flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4" />
                  Età *
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1">
                    <div className="text-xs font-semibold text-zinc-700/70">Anni</div>
                    <select
                      className="ui-select w-full px-4 py-3 rounded-2xl bg-white/80 ring-1 ring-black/5"
                      value={String(ageYears)}
                      onChange={(e) => setAgeYears(Number(e.target.value))}
                    >
                      {Array.from({ length: 21 }).map((_, i) => (
                        <option key={i} value={String(i)}>
                          {i}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-1">
                    <div className="text-xs font-semibold text-zinc-700/70">Mesi</div>
                    <select
                      className="ui-select w-full px-4 py-3 rounded-2xl bg-white/80 ring-1 ring-black/5"
                      value={String(ageMonths)}
                      onChange={(e) => setAgeMonths(Number(e.target.value))}
                    >
                      {Array.from({ length: 12 }).map((_, i) => (
                        <option key={i} value={String(i)}>
                          {i}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="text-xs text-zinc-700/70 mt-2">
                  Età impostata: <span className="font-semibold">{formatAgeFromMonths(totalAgeMonths)}</span>
                </div>
              </div>

              {/* ===== ADVANCED PROFILE ===== */}
              <div className="mt-5 pt-4 border-t border-black/5">
                <div className="flex items-center gap-2 text-xs font-extrabold text-zinc-700/80 mb-2">
                  <HeartPulse className="h-4 w-4" />
                  Profilo avanzato (per calorie su misura)
                </div>

                {/* BCS + Life stage */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1">
                    <div className="text-xs font-extrabold text-zinc-700/80 flex items-center gap-2">
                      <Gauge className="h-4 w-4" />
                      BCS (1–9)
                    </div>
                    <select
                      className="ui-select w-full px-4 py-3 rounded-2xl bg-white/80 ring-1 ring-black/5"
                      value={String(bcs)}
                      onChange={(e) => setBcs(Number(e.target.value))}
                    >
                      {Array.from({ length: 9 }).map((_, i) => {
                        const v = i + 1;
                        const label =
                          v <= 3 ? `${v} (magro)` :
                          v <= 5 ? `${v} (ok)` :
                          v <= 7 ? `${v} (sovrappeso)` :
                          `${v} (obeso)`;
                        return (
                          <option key={v} value={String(v)}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                    <div className="text-[11px] text-zinc-700/60">
                      Se non sai: metti 5 (normale).
                    </div>
                  </div>

                  <div className="grid gap-1">
                    <div className="text-xs font-extrabold text-zinc-700/80">Fase vita</div>
                    <select
                      className="ui-select w-full px-4 py-3 rounded-2xl bg-white/80 ring-1 ring-black/5"
                      value={lifeStage}
                      onChange={(e) => setLifeStage(e.target.value as LifeStage)}
                    >
                      <option value="puppy">Cucciolo</option>
                      <option value="adult">Adulto</option>
                      <option value="senior">Senior</option>
                    </select>
                  </div>
                </div>

                {/* Environment + Season */}
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className="grid gap-1">
                    <div className="text-xs font-extrabold text-zinc-700/80 flex items-center gap-2">
                      <HomeIcon className="h-4 w-4" />
                      Ambiente
                    </div>
                    <select
                      className="ui-select w-full px-4 py-3 rounded-2xl bg-white/80 ring-1 ring-black/5"
                      value={environment}
                      onChange={(e) => setEnvironment(e.target.value as Environment)}
                    >
                      <option value="indoor">In casa</option>
                      <option value="mixed">Misto</option>
                      <option value="outdoor">Fuori</option>
                    </select>
                  </div>

                  <div className="grid gap-1">
                    <div className="text-xs font-extrabold text-zinc-700/80 flex items-center gap-2">
                      <Thermometer className="h-4 w-4" />
                      Stagione / clima
                    </div>
                    <select
                      className="ui-select w-full px-4 py-3 rounded-2xl bg-white/80 ring-1 ring-black/5"
                      value={seasonFactor}
                      onChange={(e) => setSeasonFactor(e.target.value as SeasonFactor)}
                    >
                      <option value="auto">Auto (consigliato)</option>
                      <option value="cold">Freddo</option>
                      <option value="mild">Mite</option>
                      <option value="hot">Caldo</option>
                    </select>
                    <div className="text-[11px] text-zinc-700/60">
                      “Auto” usa una stima stagionale.
                    </div>
                  </div>
                </div>

                {/* Goal mode */}
                <div className="mt-3">
                  <div className="text-xs font-extrabold text-zinc-700/80 flex items-center gap-2 mb-2">
                    <TrendingDown className="h-4 w-4" />
                    Obiettivo
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setGoalMode("maintain")}
                      className={cn(
                        "rounded-2xl px-4 py-3 text-left ring-1 shadow-sm transition",
                        goalMode === "maintain"
                          ? "bg-emerald-50/70 ring-emerald-200/60"
                          : "bg-white/80 ring-black/5 hover:bg-white"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Trees className="h-4 w-4" />
                        <div className="font-extrabold">Mantenimento</div>
                      </div>
                      <div className="text-xs text-zinc-700/70 mt-1">Calorie stabili</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setGoalMode("lose")}
                      className={cn(
                        "rounded-2xl px-4 py-3 text-left ring-1 shadow-sm transition",
                        goalMode === "lose"
                          ? "bg-emerald-50/70 ring-emerald-200/60"
                          : "bg-white/80 ring-black/5 hover:bg-white"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <TrendingDown className="h-4 w-4" />
                        <div className="font-extrabold">Dimagrimento</div>
                      </div>
                      <div className="text-xs text-zinc-700/70 mt-1">Deficit controllato</div>
                    </button>
                  </div>

                  {goalMode === "lose" ? (
                    <div className="grid gap-1 mt-3">
                      <div className="text-xs font-extrabold text-zinc-700/80">
                        Velocità calo (peso/settimana)
                      </div>
                      <select
                        className="ui-select w-full px-4 py-3 rounded-2xl bg-white/80 ring-1 ring-black/5"
                        value={String(weeklyLossRatePct)}
                        onChange={(e) => setWeeklyLossRatePct(Number(e.target.value))}
                      >
                        <option value="0.25">0.25% (molto soft)</option>
                        <option value="0.5">0.5% (soft)</option>
                        <option value="0.75">0.75% (standard)</option>
                        <option value="1">1.0% (deciso)</option>
                        <option value="1.25">1.25% (solo se molto sovrappeso)</option>
                      </select>
                      <div className="text-[11px] text-zinc-700/60">
                        Suggerito: 0.5–1.0%. Se il cane ha fame o è stanco, abbassa.
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Alerts */}
              {err ? <div className="mt-3 text-sm text-red-700 font-semibold">{err}</div> : null}
              {ok ? <div className="mt-3 text-sm text-emerald-800 font-semibold">{ok}</div> : null}

              {/* CTA */}
              <div className="mt-4">
                <TapButton variant="primary" onClick={saveDog} fullWidth>
                  {saving ? "Salvo..." : "Salva cane"}
                </TapButton>
                <div className="text-xs text-zinc-700/60 mt-2">* Campi obbligatori.</div>
              </div>
            </PremiumCard>
          </div>
        </>
      )}
    </div>
  );
}
