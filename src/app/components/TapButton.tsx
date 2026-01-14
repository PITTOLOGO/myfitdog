"use client";

import { motion } from "framer-motion";
import React from "react";

type Variant = "white" | "dark" | "primary" | "secondary";
type Size = "sm" | "md";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export function TapButton({
  children,
  onClick,
  variant = "white",
  size = "md",
  fullWidth = true,
  className,
  type = "button",
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  className?: string;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
}) {
  const base =
    "rounded-3xl font-extrabold ring-1 ring-black/5 shadow-[0_10px_30px_rgba(0,0,0,0.08)] select-none";
  const sizing = size === "sm" ? "px-4 py-2 text-sm" : "px-5 py-3 text-base";
  const width = fullWidth ? "w-full" : "w-auto";

  const styles =
    variant === "dark"
      ? "bg-zinc-900 text-white hover:bg-zinc-800"
      : variant === "primary"
      ? "bg-emerald-600 text-white hover:bg-emerald-500"
      : variant === "secondary"
      ? "bg-white/80 text-zinc-900 hover:bg-white"
      : "bg-white text-zinc-900 hover:bg-white"; // white

  const disabledCls = disabled ? "opacity-60 pointer-events-none" : "";

  return (
    <motion.button
      type={type}
      whileTap={{ scale: 0.98 }}
      whileHover={{ y: -1 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={cn(base, sizing, width, styles, disabledCls, className)}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </motion.button>
  );
}
