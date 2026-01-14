export type ActivityLevel = "low" | "normal" | "high";

export type DogForCalc = {
  weightKg: number;
  targetWeightKg: number;
  neutered: boolean;
  activityLevel: ActivityLevel;
};

export function rer(weightKg: number) {
  return 70 * Math.pow(weightKg, 0.75);
}

export function calcDailyCalories(dog: DogForCalc) {
  const w = Number(dog.weightKg);
  const tw = Number(dog.targetWeightKg);

  const activityFactor =
    dog.activityLevel === "low" ? 1.2 : dog.activityLevel === "high" ? 1.6 : 1.4;

  const neuterFactor = dog.neutered ? 0.9 : 1.0;

  const maintenance = rer(w) * activityFactor * neuterFactor;
  const weightLossBase = rer(tw) * 1.0;
  const moderateDeficit = maintenance * 0.8;

  const recommended = Math.round(Math.min(weightLossBase, moderateDeficit));
  const low = Math.round(recommended * 0.95);
  const high = Math.round(recommended * 1.05);

  return {
    recommended,
    range: { low, high },
    maintenance: Math.round(maintenance),
  };
}
