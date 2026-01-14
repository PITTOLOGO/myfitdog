import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { CoachInsight } from "./coachRules";
import { dayKey } from "./dailySummary";

export async function upsertTodayCoachTip(opts: {
  uid: string;
  dogId: string;
  insight: CoachInsight;
  metrics?: {
    target?: number;
    avg7?: number;
    avg14?: number;
  };
}) {
  const { uid, dogId, insight, metrics } = opts;

  const key = dayKey(new Date());
  const ref = doc(db, "users", uid, "dogs", dogId, "coachTips", key);

  // Non riscriviamo all’infinito: se esiste già e same-day, facciamo merge (ok),
  // ma evitiamo di cambiare createdAt.
  const snap = await getDoc(ref);
  const exists = snap.exists();

  await setDoc(
    ref,
    {
      dayId: key,
      title: insight.title,
      bullets: insight.bullets,
      severity: insight.severity,
      metrics: {
        target: metrics?.target ?? null,
        avg7: metrics?.avg7 ?? null,
        avg14: metrics?.avg14 ?? null,
      },
      updatedAt: serverTimestamp(),
      ...(exists ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true }
  );

  return key;
}
