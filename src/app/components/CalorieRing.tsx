"use client";

import React from "react";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

type Props = {
  eaten: number;
  target: number;
  burned?: number;
  size?: number; // px
};

export function CalorieRing({ eaten, target, burned = 0, size = 92 }: Props) {
  const safeTarget = Math.max(0, Number.isFinite(target) ? target : 0);
  const safeEaten = Math.max(0, Number.isFinite(eaten) ? eaten : 0);
  const safeBurned = Math.max(0, Number.isFinite(burned) ? burned : 0);

  const remaining = Math.max(0, safeTarget - safeEaten);
  const pct = safeTarget > 0 ? clamp(safeEaten / safeTarget, 0, 1) : 0;

  const stroke = Math.max(8, Math.round(size * 0.12));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * pct;
  const gap = c - dash;

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
      <Metric label="Mangiate" value={safeEaten} />

      <div className="relative grid place-items-center">
        <svg width={size} height={size} className="block">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            className="text-zinc-900/10"
            stroke="currentColor"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${gap}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className="text-emerald-500"
            stroke="currentColor"
          />
        </svg>

        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center leading-none">
            <div className="text-xl font-black tracking-tight">{remaining}</div>
            <div className="text-[11px] text-zinc-700/70 font-semibold mt-1">
              Rimanenti
            </div>
          </div>
        </div>
      </div>

      <Metric label="Bruciate" value={safeBurned} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-[11px] text-zinc-700/70 font-extrabold">{label}</div>
      <div className="text-lg font-black tracking-tight tabular-nums">
        {Math.round(value)}
      </div>
    </div>
  );
}
