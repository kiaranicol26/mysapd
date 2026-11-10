import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import sapdLogo from "@/assets/sapd-logo.png.asset.json";
import pictoM4 from "@/assets/picto-m4.png.asset.json";
import pictoEdc from "@/assets/picto-edc.png.asset.json";
import pictoSniper from "@/assets/picto-sniper.png.asset.json";
import pictoAk from "@/assets/picto-ak.png.asset.json";
import pictoMary from "@/assets/picto-mary.png.asset.json";
import pictoAir from "@/assets/picto-air.png.asset.json";
import { db, getToken } from "@/lib/db";
import { publishTrainingCertificate } from "@/lib/data.functions";
import type { Session } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Download, Share2, CheckCircle2 } from "lucide-react";
import { toPng } from "html-to-image";

const TIPOS = [
  { value: "Fusil M4", clase: "Fusil de Asalto M4A1", categoria: "M4" },
  { value: "Escopeta Spas12", clase: "Escopeta de Asalto F-Spas12", categoria: "EDC" },
  { value: "Fusil de Precisión", clase: "Fusil de Francotirador R-700", categoria: "SNIPER" },
  { value: "Fusil de Asalto AK-47", clase: "Fusil de Combate AK-47", categoria: "AK-47" },
  { value: "Unidad Motorizada Mary", clase: "Unidad Motorizada - Mary", categoria: "MARY" },
  { value: "Unidad Aerea", clase: "Unidad Aerea - AIR", categoria: "AIR" },
  { value: "Capacitación Especial", clase: "Capacitación Especial", categoria: "OTRA" },
] as const;

export type CertificateForm = {
  tipo: string;
  seccion: string;
  nombre: string;
  instructor: string;
  comisario: string;
  fecha: string;
  numero: string;
};

type CertificateRecord = {
  id: string;
  pd_member_id: string;
  section: string;
  training: string;
  training_other: string | null;
  awarded_at: string | null;
  instructor_pd_member_id: string | null;
  created_by_name: string | null;
  certificate_image_url: string | null;
  discord_published_at: string | null;
  discord_published_forum_id: string | null;
  is_legacy?: boolean;
};

const TRAINING_CERTIFICATE_TYPES: Record<string, string> = {
  M4: "Fusil M4",
  EDC: "Escopeta Spas12",
  "AK-47": "Fusil de Asalto AK-47",
  SNIPER: "Fusil de Precisión",
  MARY: "Unidad Motorizada Mary",
  AIR: "Unidad Aerea",
  OTRA: "Capacitación Especial",
};

function certificateTipo(training: string) {
  return TRAINING_CERTIFICATE_TYPES[training] ?? "Fusil M4";
}

function certificateDate(value: string | null) {
  if (!value) return "Nada";
  const datePart = value.trim().split("T")[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart.split("-").reverse().join("/");
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(datePart)) return datePart;
  return value;
}

async function loadAllCertificateRecords(): Promise<CertificateRecord[]> {
  const all: CertificateRecord[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("pd_trainings")
      .select("id, pd_member_id, section, training, training_other, awarded_at, instructor_pd_member_id, created_by_name, certificate_image_url, discord_published_at, discord_published_forum_id, is_legacy")
      .order("awarded_at", { ascending: false })
      .range(from, from + 999);
    if (error) throw error;
    const page = (data ?? []) as CertificateRecord[];
    all.push(...page);
    if (page.length < 1000) return all;
  }
}

function ShareCertificateButton({ row, memberName, instructorName, onPublished }: {
  row: CertificateRecord;
  memberName: string;
  instructorName: string;
  onPublished: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [generateImage, setGenerateImage] = useState(false);
  const formData: CertificateForm = {
    tipo: certificateTipo(row.training),
    seccion: row.section,
    nombre: memberName,
    instructor: instructorName,
    comisario: row.created_by_name ?? "San Andreas Police Department",
    fecha: certificateDate(row.awarded_at),
    numero: row.id.replace(/\D/g, "").slice(-6).padStart(6, "0"),
  };

  const send = useCallback(async (image?: string) => {
    setBusy(true);
    setGenerateImage(false);
    try {
      const token = getToken();
      if (!token) throw new Error("Tu sesión expiró.");
      const result = await publishTrainingCertificate({
        data: { token, trainingId: row.id, ...(image ? { certificateImage: image } : {}) },
      });
      if (!result.ok) throw new Error(result.error);
      toast.success("Certificado compartido en la publicación de foro de " + memberName + ".");
      onPublished();
    } catch (error) {
      toast.error("No se pudo compartir el certificado: " + (error instanceof Error ? error.message : "error"));
    } finally {
      setBusy(false);
    }
  }, [row.id, memberName, onPublished]);

  const onGenerated = useCallback((image: string) => { void send(image); }, [send]);
  const onError = useCallback(() => { setGenerateImage(false); setBusy(false); }, []);

  async function share() {
    if (busy) return;
    if (row.discord_published_at && row.discord_published_forum_id === "1569585390355218482") return toast.info("Este certificado ya fue compartido con Discord.");
    if (row.certificate_image_url) {
      await send();
    } else {
      setBusy(true);
      setGenerateImage(true);
    }
  }

  return <>
    <Button type="button" size="sm" onClick={share} disabled={busy || ( !!row.discord_published_at && row.discord_published_forum_id === "1569585390355218482") }
      className="mt-2 w-full rounded-none bg-[#5865F2] text-white hover:bg-[#4752C4] disabled:opacity-70">
      {busy ? <><Share2 className="mr-2 h-4 w-4 animate-pulse" /> Generando / enviando…</> :
        row.discord_published_at && row.discord_published_forum_id === "1569585390355218482" ? <><CheckCircle2 className="mr-2 h-4 w-4" /> Compartido con DC</> :
        <><Share2 className="mr-2 h-4 w-4" /> Compartir con DC</>}
    </Button>
    {generateImage && <div aria-hidden="true" className="pointer-events-none fixed left-[-10000px] top-0 w-[900px]">
      <CertCard data={formData} autoGenerate onGenerated={onGenerated} onError={onError} />
    </div>}
  </>;
}

export function CertificarView({ session: _session }: { session: Session }) {
  void _session;
  const [records, setRecords] = useState<CertificateRecord[]>([]);
  const [members, setMembers] = useState<{ id: string; nombre: string; legajo: number }[]>([]);
  const [filterMember, setFilterMember] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [filterTraining, setFilterTraining] = useState("");
  const [filterInstructor, setFilterInstructor] = useState("");
  const [searchText, setSearchText] = useState("");

  const reload = useCallback(async () => {
    const [rows, memberRows] = await Promise.all([
      loadAllCertificateRecords(),
      db.from("pd_members").select("id, nombre, legajo").order("nombre", { ascending: true }),
    ]);
    setRecords(rows);
    if (memberRows.error) throw memberRows.error;
    setMembers((memberRows.data ?? []) as { id: string; nombre: string; legajo: number }[]);
  }, []);

  useEffect(() => {
    reload().catch(error => toast.error(error instanceof Error ? error.message : "No se pudieron cargar los certificados."));
  }, [reload]);

  const visibleRecords = useMemo(() => records.filter(row => {
    const target = members.find(m => m.id === row.pd_member_id);
    const instructor = members.find(m => m.id === row.instructor_pd_member_id);
    const haystack = [target?.nombre, instructor?.nombre, String(target?.legajo ?? ""), row.training, row.training_other ?? ""].join(" ").toLowerCase();
    return (!filterMember || row.pd_member_id === filterMember) &&
      (!filterSection || row.section === filterSection) &&
      (!filterTraining || row.training === filterTraining) &&
      (!filterInstructor || row.instructor_pd_member_id === filterInstructor) &&
      (!searchText || haystack.includes(searchText.toLowerCase()));
  }), [records, members, filterMember, filterSection, filterTraining, filterInstructor, searchText]);

  const markPublished = useCallback((id: string) => {
    setRecords(current => current.map(row => row.id === id ? { ...row, discord_published_at: new Date().toISOString(), discord_published_forum_id: "1569585390355218482" } : row));
  }, []);

  return <div className="space-y-4">
    <div className="w-full border border-blue-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center border border-blue-200 bg-white p-1">
          <img src={sapdLogo.url} alt="SAPD" className="h-full w-full object-contain" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-blue-600">San Andreas Police Department</p>
          <h2 className="font-display text-2xl font-black uppercase text-slate-900">Certificados</h2>
          <p className="text-sm text-slate-500">Certificados generados automáticamente desde Capacitaciones.</p>
        </div>
        <span className="text-xs font-bold text-blue-700">{visibleRecords.length} / {records.length} registros</span>
      </div>
    </div>

    <div className="w-full space-y-4 border border-blue-200 bg-white p-5 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Input value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Buscar agente o legajo…" className="rounded-none" />
        <select value={filterMember} onChange={e => setFilterMember(e.target.value)} className="h-10 border border-slate-300 bg-white px-2 text-sm"><option value="">Todos los SAPD</option>{members.map(m => <option key={m.id} value={m.id}>{m.nombre} · {m.legajo}</option>)}</select>
        <select value={filterSection} onChange={e => setFilterSection(e.target.value)} className="h-10 border border-slate-300 bg-white px-2 text-sm"><option value="">Armas y vehículos</option><option>Armas</option><option>Vehículos</option></select>
        <select value={filterTraining} onChange={e => setFilterTraining(e.target.value)} className="h-10 border border-slate-300 bg-white px-2 text-sm"><option value="">Todas las capacitaciones</option>{["M4","EDC","AK-47","SNIPER","MARY","AIR","OTRA"].map(v => <option key={v}>{v}</option>)}</select>
        <select value={filterInstructor} onChange={e => setFilterInstructor(e.target.value)} className="h-10 border border-slate-300 bg-white px-2 text-sm"><option value="">Todos los instructores</option>{members.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select>
      </div>
      {visibleRecords.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleRecords.map(row => {
          const target = members.find(m => m.id === row.pd_member_id);
          const instructor = members.find(m => m.id === row.instructor_pd_member_id);
          const memberName = target?.nombre ?? "Agente no disponible";
          return <article key={row.id} className="overflow-hidden border border-slate-200 bg-slate-50">
            {row.certificate_image_url ? <a href={row.certificate_image_url} target="_blank" rel="noreferrer"><img src={row.certificate_image_url} alt={"Certificado de " + memberName} className="aspect-[1357/1920] w-full bg-white object-contain" /></a> :
              <div className="bg-white"><CertCard data={{
                tipo: certificateTipo(row.training),
                seccion: row.section,
                nombre: memberName,
                instructor: instructor?.nombre ?? "Nada",
                comisario: row.created_by_name ?? "San Andreas Police Department",
                fecha: certificateDate(row.awarded_at),
                numero: row.id.replace(/\D/g, "").slice(-6).padStart(6, "0"),
              }} downloadable /></div>}
            <div className="space-y-1 p-3 text-sm">
              <p className="font-black text-slate-900">{memberName} <span className="font-mono text-xs text-slate-500">#{target?.legajo ?? "—"}</span></p>
              <p className="text-xs text-slate-600">{row.section} · {row.training === "OTRA" ? row.training_other : row.training}</p>
              <p className="text-xs text-slate-500">Instructor: {instructor?.nombre ?? "Nada"} · {row.awarded_at ?? "Fecha histórica no disponible"}</p>
              {row.certificate_image_url && <a href={row.certificate_image_url} download className="inline-flex text-xs font-bold text-blue-700 underline"><Download className="mr-1 h-3 w-3" /> Abrir / descargar PNG</a>}
              <ShareCertificateButton row={row} memberName={memberName} instructorName={instructor?.nombre ?? "Nada"} onPublished={() => markPublished(row.id)} />
            </div>
          </article>;
        })}
      </div> : <p className="py-8 text-center text-sm text-slate-400">No hay certificados que coincidan con los filtros.</p>}
    </div>
  </div>;
}

const NAVY = "#101f38";
const GOLD = "#c6a45b";

const PICTOS: Record<string, string> = {
  M4: pictoM4.url,
  EDC: pictoEdc.url,
  SNIPER: pictoSniper.url,
  "AK-47": pictoAk.url,
  MARY: pictoMary.url,
  AIR: pictoAir.url,
};

export function CertCard({ data, downloadable = false, autoGenerate = false, onGenerated, onError }: { data: CertificateForm; downloadable?: boolean; autoGenerate?: boolean; onGenerated?: (dataUrl: string) => void; onError?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const tipo = TIPOS.find(t => t.value === data.tipo) ?? TIPOS[0];
  const isVehicle = data.seccion === "Vehículos";
  const certificateName = isVehicle ? "Licencia de conducción" : "Licencia de armamento";
  const categoryLabel = isVehicle ? "AUTO" : "ARMA";
  const detail = tipo.categoria === "OTRA" ? (data.tipo || "Capacitación especial") : tipo.categoria;

  useEffect(() => {
    if (!autoGenerate || !ref.current || !onGenerated) return;
    let active = true;
    const node = ref.current;
    const width = node.offsetWidth || 900;
    toPng(node, { cacheBust: true, pixelRatio: Math.max(2, 1800 / width) })
      .then(url => { if (active) onGenerated(url); })
      .catch(error => { if (active) { toast.error("No se pudo generar la credencial: " + (error?.message ?? "error")); onError?.(); } });
    return () => { active = false; };
  }, [autoGenerate, onGenerated, onError, data]);

  async function download() {
    if (!ref.current) return;
    try {
      const w = ref.current.offsetWidth || 900;
      const dataUrl = await toPng(ref.current, { cacheBust: true, pixelRatio: Math.max(2, 1800 / w) });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = \`Licencia_\${(data.nombre || "SAPD").replace(/\s+/g, "_")}_\${tipo.categoria}.png\`;
      a.click();
    } catch (e: any) {
      toast.error("No se pudo descargar: " + (e?.message ?? "error"));
    }
  }

  return (
    <div className="space-y-3">
      <div ref={ref} className="relative mx-auto w-full overflow-hidden select-none" style={{ aspectRatio: "1.586 / 1", background: "#f4f5f3", color: NAVY, fontFamily: "Arial, Helvetica, sans-serif", borderRadius: "2.2%", border: "1px solid #c8cdd2", boxShadow: "0 12px 34px rgba(15,31,56,.16)" }}>
        <div className="absolute inset-0" style={{ background: "linear-gradient(112deg, #f9faf8 0%, #eef1f0 54%, #e5e9e8 100%)" }} />
        <div className="absolute inset-0 flex items-center justify-end pr-[4%]">
          <img src={sapdLogo.url} alt="" aria-hidden="true" draggable={false} className="h-[88%] w-[48%] object-contain" style={{ opacity: 0.075, filter: "grayscale(1)" }} />
        </div>
        <div className="absolute left-0 top-0 h-[13%] w-full" style={{ background: "linear-gradient(90deg, #101f38 0%, #1c3557 72%, #263f60 100%)" }} />
        <div className="absolute left-[3.2%] top-[2.2%] flex h-[8.5%] items-center gap-[1.2%]">
          <div className="flex h-full aspect-square items-center justify-center rounded-full bg-white p-[2px]">
            <img src={sapdLogo.url} alt="SAPD" className="h-full w-full object-contain" draggable={false} />
          </div>
          <div className="leading-tight">
            <p className="text-[13px] font-black uppercase tracking-[0.16em] text-white">San Andreas Police Department</p>
            <p className="mt-[2px] text-[8px] font-bold uppercase tracking-[0.28em]" style={{ color: "#d6bd82" }}>Credencial oficial · mySAPD</p>
          </div>
        </div>
        <div className="absolute right-[3.4%] top-[4.1%] text-right text-[8px] font-bold uppercase tracking-[0.2em]" style={{ color: "#e7d7b4" }}>Certificación institucional</div>

        <div className="absolute left-[4%] top-[19%] w-[62%]">
          <p className="text-[8px] font-black uppercase tracking-[0.28em]" style={{ color: "#9a7b3d" }}>Nombre del certificado</p>
          <p className="mt-[3px] text-[23px] font-black uppercase tracking-[0.025em] leading-none" style={{ color: NAVY }}>{certificateName}</p>
          <div className="mt-[3.4%] h-[1px] w-full" style={{ background: "linear-gradient(90deg, #b99a5b, rgba(185,154,91,0))" }} />
          <div className="mt-[3.4%]">
            <p className="text-[7px] font-bold uppercase tracking-[0.25em]" style={{ color: "#7b8793" }}>Titular de la licencia</p>
            <p className="mt-[2px] text-[19px] font-black uppercase tracking-[0.035em]" style={{ color: "#152b48" }}>{data.nombre || "NOMBRE DEL OFICIAL"}</p>
          </div>
          <div className="mt-[3.2%] flex gap-[8%]">
            <div className="min-w-0">
              <p className="text-[7px] font-bold uppercase tracking-[0.18em]" style={{ color: "#7b8793" }}>Tipo de certificación</p>
              <p className="mt-[3px] text-[13px] font-black uppercase" style={{ color: NAVY }}>{categoryLabel} <span style={{ color: "#a18143" }}>·</span> {detail}</p>
            </div>
            <div>
              <p className="text-[7px] font-bold uppercase tracking-[0.18em]" style={{ color: "#7b8793" }}>Fecha de otorgamiento</p>
              <p className="mt-[3px] text-[13px] font-black tracking-[0.08em]" style={{ color: NAVY }}>{data.fecha || "—"}</p>
            </div>
          </div>
          <div className="mt-[3.4%] border-t pt-[2.3%]" style={{ borderColor: "#cbd1d2" }}>
            <p className="text-[7px] font-bold uppercase tracking-[0.2em]" style={{ color: "#7b8793" }}>Otorgada por</p>
            <p className="mt-[2px] text-[12px] font-black uppercase" style={{ color: NAVY }}>{data.comisario || "SAN ANDREAS POLICE DEPARTMENT"}</p>
          </div>
        </div>

        <div className="absolute right-[4%] top-[21%] flex h-[59%] w-[25%] flex-col items-center justify-center rounded-[7px] border bg-white/45 px-[2%]" style={{ borderColor: "rgba(174,148,93,.55)", boxShadow: "inset 0 0 0 3px rgba(255,255,255,.3)" }}>
          <img src={sapdLogo.url} alt="Escudo SAPD" draggable={false} className="h-[48%] w-[78%] object-contain" style={{ opacity: 0.9 }} />
          <div className="mt-[4%] h-[1px] w-[72%]" style={{ background: "#c6a45b" }} />
          <p className="mt-[5%] text-[8px] font-black uppercase tracking-[0.2em]" style={{ color: NAVY }}>SAPD</p>
          <p className="mt-[2%] text-[6px] font-bold uppercase tracking-[0.16em] text-center" style={{ color: "#8a754d" }}>Licencia válida</p>
        </div>

        <div className="absolute bottom-[4.5%] left-[4%] flex w-[92%] items-center justify-between border-t pt-[1.7%]" style={{ borderColor: "#c4cbd0" }}>
          <p className="text-[7px] font-bold uppercase tracking-[0.2em]" style={{ color: "#7b8793" }}>San Andreas Police Department · Documento de acreditación</p>
          <p className="font-mono text-[9px] font-black tracking-[0.14em]" style={{ color: "#8d713e" }}>ID {data.numero || "000000"}</p>
        </div>
        <div className="absolute bottom-0 left-0 h-[1.2%] w-full" style={{ background: "linear-gradient(90deg, #101f38, #c6a45b, #101f38)" }} />
      </div>

      {downloadable && <div className="flex justify-end"><Button onClick={download} className="rounded-none bg-blue-600 text-white hover:bg-blue-700"><Download className="mr-1 h-4 w-4" /> Descargar credencial PNG</Button></div>}
    </div>
  );
}
