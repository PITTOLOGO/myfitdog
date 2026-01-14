export type LifeStage = "puppy" | "adult" | "senior";
export type Environment = "indoor" | "outdoor" | "mixed";
export type SeasonFactor = "auto" | "cold" | "mild" | "hot";
export type GoalMode = "maintain" | "lose";

export type CalorieInputV2 = {
  weightKg: number;
  targetWeightKg?: number;          // utile per dimagrimento
  neutered: boolean;
  activityLevel: "low" | "normal" | "high";

  // nuovi
  bcs?: number;                     // 1-9
  lifeStage?: LifeStage;
  environment?: Environment;
  seasonFactor?: SeasonFactor;
  goalMode?: GoalMode;
  weeklyLossRatePct?: number;       // 0.5 - 1.0 tipico
  breed?: string;                   // per note/modulatori leggeri
};

export type CalorieOutputV2 = {
  rer: number;
  mer: number;
  recommended: number;
  range: { low: number; high: number };
  deficitPct: number;
  notes: string[];
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function round10(n: number) {
  return Math.round(n / 10) * 10;
}

// RER standard
function calcRER(weightKg: number) {
  return 70 * Math.pow(weightKg, 0.75);
}

export function calcDailyCaloriesV2(input: CalorieInputV2): CalorieOutputV2 {
  const w = Math.max(0.5, input.weightKg);

  const rer = calcRER(w);

  // --- fattori MER base ---
  // (valori ragionevoli, conservativi)
  const neuterFactor = input.neutered ? 1.6 : 1.8;

  const activityFactor =
    input.activityLevel === "low" ? 0.9 :
    input.activityLevel === "high" ? 1.15 :
    1.0;

  const lifeStage = input.lifeStage ?? "adult";
  const lifeStageFactor =
    lifeStage === "puppy" ? 2.0 :  // semplificazione: puppy più alto
    lifeStage === "senior" ? 0.95 :
    1.0;

  // stagione (micro)
  const season = input.seasonFactor ?? "mild";
  const env = input.environment ?? "indoor";

  const seasonBase =
    season === "cold" ? 1.05 :
    season === "hot" ? 0.95 :
    1.0;

  // se vive outdoor la stagione pesa di più
  const envSeasonBoost =
    env === "outdoor" ? 1.03 :
    env === "mixed" ? 1.015 :
    1.0;

  const seasonFactor = seasonBase * envSeasonBoost;

  // BCS -> se sovrappeso riduciamo fattore
  const bcs = input.bcs;
  const overweightFactor =
    typeof bcs === "number"
      ? bcs >= 7 ? 0.85
        : bcs === 6 ? 0.92
        : bcs <= 3 ? 1.08
        : 1.0
      : 1.0;

  let mer = rer * neuterFactor * activityFactor * lifeStageFactor * seasonFactor * overweightFactor;

  const notes: string[] = [];
  notes.push(`RER stimato: ${round10(rer)} kcal`);

  // goal mode
  const goalMode = input.goalMode ?? "maintain";
  let deficitPct = 0;

  if (goalMode === "lose") {
    // deficit guidato (conservativo)
    const weekly = clamp(input.weeklyLossRatePct ?? 0.75, 0.25, 1.25);
    // mapping semplice: 0.25%->12% deficit, 1.25%->26% deficit
    deficitPct = clamp(0.12 + (weekly - 0.25) * (0.14 / 1.0), 0.12, 0.26);

    // se molto sovrappeso puoi spingere un filo, ma non troppo
    if (typeof bcs === "number" && bcs >= 8) deficitPct = clamp(deficitPct + 0.02, 0.12, 0.28);

    mer = mer * (1 - deficitPct);

    notes.push(`Modalità dimagrimento: deficit ~${Math.round(deficitPct * 100)}%`);
    notes.push(`Target calo: ~${weekly}% peso/settimana (stima)`);
  } else {
    notes.push("Modalità mantenimento");
  }

  const recommended = round10(mer);
  const range = {
    low: round10(recommended * 0.92),
    high: round10(recommended * 1.08),
  };

  // note “razza” (solo informative)
  if (input.breed) notes.push(`Razza indicata: ${input.breed} (usata per consigli, non per formula rigida)`);

  return {
    rer: round10(rer),
    mer: recommended,
    recommended,
    range,
    deficitPct,
    notes,
  };
}
