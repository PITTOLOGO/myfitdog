"use client";

import { motion } from "framer-motion";
import React from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md";

export function TapButton({
  children,
  onClick,
  variant = "secondary",
  size = "md",
  fullWidth = true,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}) {
  const base =
    "rounded-3xl font-extrabold tracking-tight inline-flex items-center justify-center gap-2 " +
    "shadow-[0_14px_40px_rgba(17,24,39,0.10)] " +
    "ring-1 ring-black/5 " +
    "transition";

  const padding = size === "sm" ? "px-3 py-2 text-sm" : "px-4 py-3 text-base";
  const width = fullWidth ? "w-full" : "w-auto";

  const cls =
    variant === "primary"
      ? `${base} ${padding} ${width} bg-zinc-950 text-white hover:bg-zinc-900`
      : variant === "ghost"
      ? `${base} ${padding} ${width} bg-transparent text-zinc-900 shadow-none ring-0 hover:bg-black/5`
      : `${base} ${padding} ${width} bg-white/80 text-zinc-900 hover:bg-white`;

  return (
    <motion.button
      whileTap={{ scale: 0.985 }}
      whileHover={{ y: -1 }}
      transition={{ type: "spring", stiffness: 520, damping: 32 }}
      className={cls}
      onClick={onClick}
    >
      {children}
    </motion.button>
  );
}
