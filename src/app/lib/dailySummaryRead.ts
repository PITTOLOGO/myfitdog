import { doc, getDoc, Timestamp } from "firebase/firestore";
import { db } from "./firebase";
import { dayKey, startOfDayTs } from "./dailySummary";

export type DailySummary = {
  day: Timestamp;
  caloriesIn: number;
  caloriesOut: number;
  net: number;
  target: number;
  delta: number;
  updatedAt?: any;
  createdAt?: any;
};

export async function getTodaySummary(uid: string, dogId: string) {
  const key = dayKey(new Date());
  const ref = doc(db, "users", uid, "dogs", dogId, "dailySummaries", key);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as DailySummary;
}

/**
 * Se oggi non esiste ancora dailySummary (es. non hai loggato nulla),
 * lo creiamo “vuoto” con caloriesIn/out 0 e target attuale, così Home mostra comunque i numeri.
 */
export async function ensureTodaySummary(opts: { uid: string; dogId: string; target: number }) {
  const { uid, dogId, target } = opts;
  const key = dayKey(new Date());
  const ref = doc(db, "users", uid, "dogs", dogId, "dailySummaries", key);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data() as DailySummary;

  // lo crea sfruttando la funzione che hai già: recomputeDailySummary
  const { recomputeDailySummary } = await import("./dailySummary");
  await recomputeDailySummary({
    uid,
    dogId,
    day: startOfDayTs(new Date()),
    target,
  });

  const snap2 = await getDoc(ref);
  return snap2.exists() ? (snap2.data() as DailySummary) : null;
}
