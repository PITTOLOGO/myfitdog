import { collection, getDocs, Timestamp } from "firebase/firestore";
import { db } from "./firebase";

export type DailySummaryRow = {
  id: string; // YYYY-MM-DD
  day: Timestamp;
  net: number;
  target: number;
  delta: number;
  caloriesIn: number;
  caloriesOut: number;
};

export async function getDailySummaries(uid: string, dogId: string) {
  const ref = collection(db, "users", uid, "dogs", dogId, "dailySummaries");
  const snap = await getDocs(ref);

  const rows: DailySummaryRow[] = [];
  snap.forEach((d) => {
    const v = d.data() as any;
    if (!v.day) return;
    rows.push({
      id: d.id,
      day: v.day,
      net: Number(v.net ?? 0),
      target: Number(v.target ?? 0),
      delta: Number(v.delta ?? 0),
      caloriesIn: Number(v.caloriesIn ?? 0),
      caloriesOut: Number(v.caloriesOut ?? 0),
    });
  });

  rows.sort((a, b) => a.day.toMillis() - b.day.toMillis());
  return rows;
}
