"use client";
import { useEffect } from "react";
import { startSync } from "@/lib/sync/sync";

export function SyncProvider() {
  useEffect(() => startSync(), []);
  return null;
}
