import { db } from "@/lib/db";

const CHANGES_KEY = "discord_webhook_url";
const RNAP_KEY = "discord_rnap_webhook_url";
const ARCHIVO_KEY = "discord_archivo_webhook_url";
const DISCORD_LOGIN_KEY = "discord_code_login_enabled";

const cache: Record<string, { value: string; at: number }> = {};

async function getKey(key: string, force = false): Promise<string> {
  const now = Date.now();
  const c = cache[key];
  if (!force && c && now - c.at < 30_000) return c.value;
  const { data } = await db
    .from("app_settings").select("value").eq("key", key).maybeSingle();
  const value = (data?.value ?? "").trim();
  cache[key] = { value, at: now };
  return value;
}

async function setKey(key: string, url: string) {
  cache[key] = { value: url.trim(), at: Date.now() };
  const { error } = await db
    .from("app_settings")
    .upsert({ key, value: url.trim(), updated_at: new Date().toISOString() });
  if (error) throw error;
}

export const getWebhookUrl = (force = false) => getKey(CHANGES_KEY, force);
export const setWebhookUrl = (url: string) => setKey(CHANGES_KEY, url);
export const getRnapWebhookUrl = (force = false) => getKey(RNAP_KEY, force);
export const setRnapWebhookUrl = (url: string) => setKey(RNAP_KEY, url);
export const getArchivoWebhookUrl = (force = false) => getKey(ARCHIVO_KEY, force);
export const setArchivoWebhookUrl = (url: string) => setKey(ARCHIVO_KEY, url);

export async function getDiscordCodeLoginEnabled(force = false): Promise<boolean> {
  const value = await getKey(DISCORD_LOGIN_KEY, force);
  return value !== "false";
}

export const setDiscordCodeLoginEnabled = (enabled: boolean) =>
  setKey(DISCORD_LOGIN_KEY, enabled ? "true" : "false");

export async function sendArchivoToDiscord(params: {
  editorName: string;
  nombre: string;
  esPolicia: boolean;
  gameId?: string | null;
  foto?: string | null;
  vetos: { sapd: boolean; edsa: boolean; staff: boolean };
  capacitaciones: { m4: boolean; edc: boolean; mary: boolean };
  notas: { autor: string | null; texto: string }[];
}) {
  const url = await getArchivoWebhookUrl();
  if (!url) throw new Error("Webhook de Archivo no configurado");
  const si = (v: boolean) => (v ? "✅ SÍ" : "❌ NO");
  const fields: any[] = [
    { name: "Nombre", value: params.nombre || "—", inline: true },
    { name: "Es Policía", value: si(params.esPolicia), inline: true },
    { name: "#ID", value: params.gameId ? `${params.gameId}\n-# Ver en /id ${params.gameId}` : "—", inline: true },
    {
      name: "Corresponde a Vetos",
      value: `SAPD: ${si(params.vetos.sapd)}\nEDSA: ${si(params.vetos.edsa)}\nSTAFF: ${si(params.vetos.staff)}`,
      inline: false,
    },
    {
      name: "Capacitaciones",
      value: params.esPolicia
        ? `M4: ${si(params.capacitaciones.m4)}\nEDC: ${si(params.capacitaciones.edc)}\nMARY: ${si(params.capacitaciones.mary)}`
        : "NO ES POLICÍA",
      inline: false,
    },
  ];
  if (params.notas.length) {
    fields.push({
      name: "Notas",
      value: params.notas
        .map(n => `• **Nota de ${n.autor ?? "—"}:** ${n.texto}`)
        .join("\n")
        .slice(0, 1000),
      inline: false,
    });
  }
  const body = {
    username: "SAPD · Archivo de Personas",
    embeds: [{
      title: `Archivo — ${params.nombre}`,
      color: 0x1d4ed8,
      fields,
      thumbnail: params.foto && /^https?:/.test(params.foto) ? { url: params.foto } : undefined,
      footer: { text: `Enviado por ${params.editorName} · San Andreas Police Department` },
      timestamp: new Date().toISOString(),
    }],
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Discord respondió ${res.status}`);
}

export async function sendRnapToDiscord(params: {
  editorName: string;
  targetName: string;
  imageBlob: Blob;
}) {
  const url = await getRnapWebhookUrl();
  if (!url) throw new Error("Webhook de RNAP no configurado");
  const fd = new FormData();
  const payload = {
    username: "SAPD · R.N.A.P",
    embeds: [{
      title: "Certificado R.N.A.P Emitido",
      color: 0xeab308,
      fields: [
        { name: "Emitido por", value: params.editorName, inline: true },
        { name: "Persona", value: params.targetName || "—", inline: true },
      ],
      image: { url: "attachment://rnap.png" },
      timestamp: new Date().toISOString(),
      footer: { text: "San Andreas Police Department" },
    }],
  };
  fd.append("payload_json", JSON.stringify(payload));
  fd.append("files[0]", params.imageBlob, "rnap.png");
  const res = await fetch(url, { method: "POST", body: fd });
  if (!res.ok) throw new Error(`Discord respondió ${res.status}`);
}

export type ChangeAction = "Creado" | "Editado" | "Borrado";

export async function notifyDiscord(params: {
  policiaId?: string;
  policiaName: string;
  action: ChangeAction;
  section: "Ex Policía" | "Aspirante";
  targetName: string;
  changes?: { field: string; from?: any; to?: any }[];
}) {
  const url = await getWebhookUrl();
  if (!url) return;

  const color =
    params.action === "Creado" ? 0x22c55e :
    params.action === "Borrado" ? 0xef4444 : 0x3b82f6;

  const fields: any[] = [
    { name: "Editado por", value: params.policiaName, inline: true },
    { name: "Persona", value: params.targetName || "—", inline: true },
    { name: "Acción", value: `**${params.action}** · ${params.section}`, inline: false },
  ];

  const FIELD_LABELS: Record<string, string> = {
    rango_old: "Ex Rango",
    rango_new: "Rango Reingreso",
    nombre_old: "Nombre Anterior",
    nombre_new: "Nombre Nuevo",
    motivo: "Motivo",
    discord: "Discord",
    pasa: "Pasa",
    nota_final: "Nota Final",
    instructor_asignado: "Nota Adicional",
    nombre: "Nombre",
    dp: "DP",
    instructor: "Instructor",
    puntuacion_seleccion: "Punt. Selección",
    puntuacion_final: "Punt. Final",
    notas: "Notas",
  };

  if (params.changes && params.changes.length) {
    const txt = params.changes.map(c => {
      const from = c.from === undefined || c.from === null || c.from === "" ? "—" : String(c.from);
      const to = c.to === undefined || c.to === null || c.to === "" ? "—" : String(c.to);
      const label = FIELD_LABELS[c.field] ?? c.field;
      return `• **${label}**: \`${from}\` → \`${to}\``;
    }).join("\n").slice(0, 1000);
    fields.push({ name: "Valores editados", value: txt, inline: false });
  }

  const body = {
    username: "SAPD · Gestión Policial",
    embeds: [{
      title: `${params.action} — ${params.section}`,
      color,
      fields,
      timestamp: new Date().toISOString(),
      footer: { text: "San Andreas Police Department" },
    }],
  };

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.error("discord webhook failed", e);
  }
}