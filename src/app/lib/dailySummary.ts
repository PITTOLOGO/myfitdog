import {
  Timestamp,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

/**
 * Timestamp all'inizio del giorno (00:00)
 */
export function startOfDayTs(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(d);
}

/**
 * Chiave stabile YYYY-MM-DD
 */
export function dayKey(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export function dailySummaryRef(uid: string, dogId: string, key: string) {
  return doc(db, "users", uid, "dogs", dogId, "dailySummaries", key);
}

/**
 * Ricalcola e salva il riepilogo giornaliero
 */
export async function recomputeDailySummary(opts: {
  uid: string;
  dogId: string;
  day?: Timestamp;
  target: number;
}) {
  const { uid, dogId, target } = opts;
  const day = opts.day ?? startOfDayTs(new Date());
  const key = dayKey(day.toDate());

  const foodRef = collection(db, "users", uid, "dogs", dogId, "foodLogs");
  const actRef = collection(db, "users", uid, "dogs", dogId, "activityLogs");

  const foodSnap = await getDocs(query(foodRef, where("day", "==", day)));
  const actSnap = await getDocs(query(actRef, where("day", "==", day)));

  let caloriesIn = 0;
  foodSnap.forEach((d) => {
    caloriesIn += Number(d.data().kcal ?? 0);
  });

  let caloriesOut = 0;
  actSnap.forEach((d) => {
    caloriesOut += Number(d.data().kcal ?? 0);
  });

  const net = Math.round(caloriesIn - caloriesOut);
  const delta = Math.round(net - target);

  await setDoc(
    dailySummaryRef(uid, dogId, key),
    {
      day,
      caloriesIn: Math.round(caloriesIn),
      caloriesOut: Math.round(caloriesOut),
      net,
      target: Math.round(target),
      delta,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );

  return { key, caloriesIn, caloriesOut, net, target, delta };
}
