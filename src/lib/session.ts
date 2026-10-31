import { useEffect, useState } from "react";
import { db, setToken } from "@/lib/db";

export type Session = {
  id: string;
  name: string;
  is_alto_mando: boolean;
  can_delete: boolean;
  can_emit_rnap: boolean;
  can_edit_files?: boolean;
  can_edit_pd?: boolean;
  can_edit_capacitaciones?: boolean;
  role?: string | null;
  secciones?: string[];


  avatar_url?: string | null;
  descripcion?: string | null;
};

const KEY = "instructor_session";

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    // Sessions saved before the signed-token system have no token: treat them as expired.
    if (!localStorage.getItem("instructor_token")) {
      localStorage.removeItem(KEY);
      return null;
    }
    const s = JSON.parse(raw) as Session;
    // Sessions from before per-section access must log in again to receive their sections.
    if (!Array.isArray(s.secciones)) {
      localStorage.removeItem(KEY);
      localStorage.removeItem("instructor_token");
      return null;
    }
    return s;
  } catch {
    return null;
  }
}


export function setSession(s: Session | null) {
  if (typeof window === "undefined") return;
  if (s) localStorage.setItem(KEY, JSON.stringify(s));
  else {
    localStorage.removeItem(KEY);
    setToken(null);
  }
  window.dispatchEvent(new Event("session-change"));
}

export function useSessionState() {
  const [session, setSess] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setSess(getSession());
    setReady(true);
    const h = () => setSess(getSession());
    window.addEventListener("session-change", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("session-change", h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return { session, ready };
}

export function useSession() {
  return useSessionState().session;
}


export async function logAction(
  _client: unknown,
  session: Session | null,
  action: string,
  details?: Record<string, unknown>,
) {
  try {
    await db.from("logs").insert({
      instructor_id: session?.id ?? null,
      instructor_name: session?.name ?? null,
      action,
      details: details ?? null,
    });
  } catch (e) {
    console.error("log failed", e);
  }
}