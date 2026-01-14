export type CoachInsight = {
  title: string;
  bullets: string[];
  severity: "good" | "warn" | "bad";
};

function avg(arr: number[]) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function consecutiveDays(condition: (x: number) => boolean, arr: number[]) {
  // conta streak dalla fine (oggi indietro)
  let s = 0;
  for (let i = arr.length - 1; i >= 0; i--) {
    if (condition(arr[i])) s++;
    else break;
  }
  return s;
}

export function buildCoachInsight(params: {
  target: number;        // target kcal/die
  last7: number[];       // net kcal ultimi 7 giorni (in-out)
  last14: number[];      // net kcal ultimi 14 giorni
}) : CoachInsight {
  const { target, last7, last14 } = params;

  const avg7 = avg(last7);
  const avg14 = avg(last14);

  const diff7 = Math.round(avg7 - target);
  const diff14 = Math.round(avg14 - target);

  const streakAbove = consecutiveDays((x) => x - target > 150, last14);
  const streakBelow = consecutiveDays((x) => x - target < -250, last14);

  // Regole semplici ma “professionali”
  if (streakAbove >= 3) {
    return {
      title: "Sei sopra target da qualche giorno",
      severity: "warn",
      bullets: [
        `Da ${streakAbove} giorni consecutivi sei spesso sopra target (≈ +150 kcal o più).`,
        "Riduci snack/extra del 5–10% e pesa gli snack per 3 giorni.",
        "Obiettivo: rientrare nel range senza fare tagli drastici.",
      ],
    };
  }

  if (streakBelow >= 3) {
    return {
      title: "Deficit troppo aggressivo",
      severity: "bad",
      bullets: [
        `Da ${streakBelow} giorni consecutivi sei molto sotto target (≈ -250 kcal o più).`,
        "Rischio: fame, calo aderenza e metabolismo che si adatta.",
        "Aumenta leggermente porzioni (5–10%) e punta alla costanza.",
      ],
    };
  }

  if (diff7 > 150) {
    return {
      title: "Stai andando sopra target",
      severity: "warn",
      bullets: [
        `Media 7 giorni sopra target di ~${diff7} kcal.`,
        "Riduci snack/porzioni del 5–10% (una piccola correzione basta).",
        "Tip: gli snack sono spesso la causa #1.",
      ],
    };
  }

  if (diff7 < -250) {
    return {
      title: "Stai troppo sotto target",
      severity: "bad",
      bullets: [
        `Media 7 giorni sotto target di ~${Math.abs(diff7)} kcal.`,
        "Meglio un deficit moderato: aumenta leggermente le porzioni.",
        "Se il cane è già nervoso/affamato, evita ulteriori tagli.",
      ],
    };
  }

  // In linea
  const extra = Math.abs(diff14) <= 120
    ? "Anche su 14 giorni sei stabile: ottima costanza."
    : `Su 14 giorni sei a ~${diff14 >= 0 ? "+" : ""}${diff14} kcal dal target: ok, ma cura la regolarità.`;

  return {
    title: "Ottima aderenza",
    severity: "good",
    bullets: [
      "Media 7 giorni in linea col target: continua così.",
      extra,
      "Tip: mantieni orari e porzioni costanti per 7–10 giorni prima di cambiare strategia.",
    ],
  };
}
