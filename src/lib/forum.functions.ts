import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MAX_BYTES = 5 * 1024 * 1024;

const uploadSchema = z.object({
  token: z.string().max(4096).nullable().optional(),
  filename: z.string().min(1).max(200),
  mime: z.string().max(120),
  base64: z.string().min(1),
});

/** Sube un archivo/imagen del FORUM (máx 5MB) al almacenamiento privado. */
export const uploadForumFile = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => uploadSchema.parse(data))
  .handler(async ({ data }) => {
    const { verifyToken, freshClaims } = await import("@/lib/dbAuth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const claims = await freshClaims(verifyToken(data.token ?? null), supabaseAdmin as any);
    if (!claims) return { ok: false as const, error: "No autorizado" };
    if (!claims.alto && !claims.sec?.includes("forum")) return { ok: false as const, error: "Sin acceso al Forum" };

    const bytes = Buffer.from(data.base64, "base64");
    if (bytes.byteLength > MAX_BYTES) return { ok: false as const, error: "El archivo supera los 5MB" };

    const safe = data.filename.replace(/[^\w.\-]+/g, "_").slice(-80);
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;

    const { error } = await supabaseAdmin.storage
      .from("forum")
      .upload(path, bytes, { contentType: data.mime || "application/octet-stream", upsert: false });
    if (error) return { ok: false as const, error: error.message };

    return { ok: true as const, path, url: `/api/public/forum/${encodeURIComponent(path)}` };
  });
