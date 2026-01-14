"use client";

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
} from "lucide-react";

type ActivityLevel = "low" | "normal" | "high";
type Sex = "M" | "F";

type DogDoc = {
  id: string;
  name: string;
  breed?: string;
  sex: Sex;
  neutered: boolean;
  weightKg: number;
  targetWeightKg: number;
  ageYears?: number;     // legacy
  ageMonths?: number;    // new
  activityLevel: ActivityLevel;
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
      totalAgeMonths <= 12 * 30 // 30 anni max “sicurezza”
    );
  }, [name, resolvedWeight, resolvedGoal, totalAgeMonths]);

  // Auth guard
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      if (!u) router.push("/login");
      else setUid(u.uid);
    });
  }, [router]);
// Load user + dogs
useEffect(() => {
  async function load() {
    if (!uid) return;            // ✅ check dentro l'async
    const userId = uid;          // ✅ ora è string (non null)

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
    const u = uid;
    if (!u) return;

    setErr(null);
    setOk(null);

    try {
      await setDoc(doc(db, "users", u), { activeDogId: id }, { merge: true });
      setActiveDogId(id);
      setOk("Cane attivo aggiornato");
      setTimeout(() => setOk(null), 1500);
    } catch (e: any) {
      setErr(e?.message ?? "Errore aggiornamento");
    }
  }

  async function saveDog() {
    const u = uid;
    if (!u) return;

    setErr(null);
    setOk(null);

    if (!canSave) {
      setErr("Compila i campi obbligatori (nome, peso, obiettivo, età).");
      return;
    }

    setSaving(true);
    try {
      const dogsRef = collection(db, "users", u, "dogs");

      const docRef = await addDoc(dogsRef, {
        name: name.trim(),
        breed: resolvedBreed || "",
        sex,
        neutered,
        weightKg: resolvedWeight,
        targetWeightKg: resolvedGoal,
        ageMonths: totalAgeMonths,             // ✅ new
        ageYears: Math.floor(totalAgeMonths / 12), // ✅ legacy compat
        activityLevel,
        createdAt: serverTimestamp(),
      });

      await setDoc(doc(db, "users", u), { activeDogId: docRef.id }, { merge: true });

      setActiveDogId(docRef.id);
      setOk("Cane salvato");
      setTimeout(() => setOk(null), 2000);

      // reset form (soft defaults)
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

      // reload list
      const snap = await getDocs(collection(db, "users", u, "dogs"));
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
            Gestisci profilo e obiettivi
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
              subtitle="Dati base + obiettivo"
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
