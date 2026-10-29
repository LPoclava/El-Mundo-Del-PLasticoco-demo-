"use client";

import { useCallback, useRef, useState } from "react";
import type { Toast } from "./ui";

/** Avisos emergentes del panel: los de error duran más para dar tiempo a leerlos. */
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);
  const push = useCallback((message: string, tone: Toast["tone"] = "ok") => {
    const id = ++counter.current;
    setToasts((t) => [...t, { id, message, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 8000 : 4000);
  }, []);
  return { toasts, push };
}
