import { db } from "@/lib/db";

const BG_KEY = "site_background_url";
const LOGIN_BG_KEY = "site_login_background_url";

export async function getBackground(): Promise<string> {
  const { data } = await db
    .from("app_settings")
    .select("value")
    .eq("key", BG_KEY)
    .maybeSingle();
  return (data?.value ?? "").trim();
}

export async function setBackground(value: string) {
  const { error } = await db.from("app_settings").upsert({
    key: BG_KEY,
    value: value.trim(),
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("background-change"));
  }
}

/** Compress an uploaded image into a data URL so it can be stored as a setting. */
export function fileToCompressedDataUrl(file: File, maxWidth = 1920): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Imagen inválida"));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas no disponible"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
