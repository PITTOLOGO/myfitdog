"use client";

import { motion } from "framer-motion";
import React from "react";

type Tone = "mint" | "sky" | "peach" | "cream";

type Props = {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
  onClick?: () => void;
  tone?: Tone;
};

const toneMap: Record<Tone, { bg: string; ring: string; glow: string }> = {
  mint: {
    bg: "from-emerald-50/80 via-white to-white",
    ring: "ring-emerald-100/70",
    glow: "bg-emerald-200/40",
  },
  sky: {
    bg: "from-sky-50/80 via-white to-white",
    ring: "ring-sky-100/70",
    glow: "bg-sky-200/40",
  },
  peach: {
    bg: "from-orange-50/80 via-white to-white",
    ring: "ring-orange-100/70",
    glow: "bg-orange-200/40",
  },
  cream: {
    bg: "from-amber-50/70 via-white to-white",
    ring: "ring-amber-100/70",
    glow: "bg-amber-200/35",
  },
};

export function PremiumCard({
  icon,
  title,
  subtitle,
  right,
  children,
  onClick,
  tone = "cream",
}: Props) {
  const t = toneMap[tone];

  return (
    <motion.div
      whileTap={onClick ? { scale: 0.99 } : undefined}
      whileHover={onClick ? { y: -1 } : undefined}
      transition={{ type: "spring", stiffness: 500, damping: 32 }}
      onClick={onClick}
      className={[
        "relative overflow-hidden rounded-[28px] p-4",
        "bg-gradient-to-br",
        t.bg,
        "ring-1",
        t.ring,
        "shadow-[0_10px_24px_rgba(0,0,0,0.06)]",
        onClick ? "cursor-pointer select-none" : "",
      ].join(" ")}
    >
      {/* soft glow */}
      <div
        className={[
          "pointer-events-none absolute -top-16 -right-12 h-44 w-44 rounded-full blur-3xl",
          t.glow,
        ].join(" ")}
      />
      <div className="pointer-events-none absolute -bottom-16 -left-12 h-44 w-44 rounded-full bg-white/50 blur-3xl" />

      <div className="flex items-start gap-3">
        <div className="h-11 w-11 rounded-2xl bg-white/80 ring-1 ring-black/5 shadow-sm grid place-items-center text-zinc-900">
          {icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-extrabold text-zinc-900 tracking-tight truncate">
            {title}
          </div>
          {subtitle ? (
            <div className="text-sm text-zinc-700/80 mt-0.5 leading-snug">
              {subtitle}
            </div>
          ) : null}
        </div>

        {right ? <div className="ml-2">{right}</div> : null}
      </div>

      {children ? <div className="mt-3">{children}</div> : null}
    </motion.div>
  );
}
