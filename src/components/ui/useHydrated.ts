"use client";
import { useEffect, useState } from "react";

/** Évite les écarts SSR / localStorage : true seulement après montage côté client. */
export function useHydrated() {
  const [h, setH] = useState(false);
  useEffect(() => setH(true), []);
  return h;
}
