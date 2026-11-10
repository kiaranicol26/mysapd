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

const CERTIFICATE_META: Record<string, { title: string; subtitle: string }> = {
  M4: { title: "ARMAMENTO", subtitle: "FUSIL M4" },
  EDC: { title: "ARMAMENTO", subtitle: "ESCOPETA SPAS-12" },
  "AK-47": { title: "ARMAMENTO", subtitle: "FUSIL AK-47" },
  SNIPER: { title: "ARMAMENTO", subtitle: "FUSIL DE PRECISIÓN" },
  MARY: { title: "UNIDAD TERRESTRE", subtitle: "UNIDAD MOTORIZADA MARY" },
  AIR: { title: "UNIDAD AÉREA", subtitle: "UNIDAD AÉREA · AIR" },
  OTRA: { title: "FORMACIÓN ESPECIAL", subtitle: "CAPACITACIÓN ESPECIAL" },
};

export function CertCard({ data, downloadable = false, autoGenerate = false, onGenerated, onError }: { data: CertificateForm; downloadable?: boolean; autoGenerate?: boolean; onGenerated?: (dataUrl: string) => void; onError?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const tipo = TIPOS.find(t => t.value === data.tipo) ?? TIPOS[0];
  const meta = CERTIFICATE_META[tipo.categoria] ?? CERTIFICATE_META.OTRA;

  useEffect(() => {
    if (!autoGenerate || !ref.current || !onGenerated) return;
    let active = true;
    const node = ref.current;
    const width = node.offsetWidth || 900;
    toPng(node, { cacheBust: true, pixelRatio: Math.max(2, 1357 / width) })
      .then(url => { if (active) onGenerated(url); })
      .catch(error => { if (active) { toast.error("No se pudo generar el certificado: " + (error?.message ?? "error")); onError?.(); } });
    return () => { active = false; };
  }, [autoGenerate, onGenerated, onError, data]);

  async function download() {
    if (!ref.current) return;
    try {
      const w = ref.current.offsetWidth || 1357;
      const dataUrl = await toPng(ref.current, { cacheBust: true, pixelRatio: Math.max(2, 1357 / w) });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `Certificado_${(data.nombre || "SAPD").replace(/\\s+/g, "_")}_${tipo.categoria}.png`;
      a.click();
    } catch (e: any) {
      toast.error("No se pudo descargar: " + (e?.message ?? "error"));
    }
  }

  return (
    <div className="space-y-3">
      <div ref={ref} className="relative mx-auto w-full overflow-hidden select-none" style={{ aspectRatio: "1357 / 960", background: "#f5f3ed", color: NAVY, fontFamily: "Arial, Helvetica, sans-serif" }}>
        <div className="absolute inset-[2.2%] border-[3px]" style={{ borderColor: GOLD }} />
        <div className="absolute inset-[3.2%] border" style={{ borderColor: "#d9c99f" }} />
        <div className="absolute left-0 top-0 h-full w-[1.1%]" style={{ background: NAVY }} />
        <div className="absolute right-0 top-0 h-full w-[1.1%]" style={{ background: NAVY }} />

        <div className="absolute left-[6%] top-[7%] flex items-center gap-[1.4%]">
          <div className="flex h-[74px] w-[74px] items-center justify-center rounded-full border-2 bg-white p-2" style={{ borderColor: GOLD }}>
            <img src={sapdLogo.url} alt="SAPD" className="h-full w-full object-contain" draggable={false} />
          </div>
          <div>
            <p className="text-[17px] font-black uppercase tracking-[0.28em]" style={{ color: NAVY }}>San Andreas Police Department</p>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.34em]" style={{ color: "#8b7548" }}>Formación · Excelencia · Servicio</p>
          </div>
        </div>

        <div className="absolute right-[6%] top-[9%] text-right">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em]" style={{ color: "#8b7548" }}>Documento oficial</p>
          <p className="mt-1 font-mono text-[13px] font-bold tracking-wider">{data.numero || "000000"}</p>
        </div>

        <div className="absolute left-0 top-[24%] w-full text-center">
          <p className="text-[13px] font-black uppercase tracking-[0.48em]" style={{ color: "#9b8048" }}>Certificado de capacitación</p>
          <div className="mx-auto mt-3 h-[3px] w-[12%]" style={{ background: GOLD }} />
          <p className="mt-4 text-[15px] font-medium tracking-[0.12em]" style={{ color: "#5e6877" }}>Se certifica que</p>
          <p className="mt-2 text-[38px] font-black uppercase tracking-[0.055em]" style={{ color: NAVY }}>{data.nombre || "NOMBRE DEL OFICIAL"}</p>
          <p className="mt-2 text-[14px] font-medium" style={{ color: "#5e6877" }}>ha completado satisfactoriamente la siguiente formación</p>
        </div>

        <div className="absolute left-[9%] top-[55%] flex h-[25%] w-[82%] items-center rounded-xl border bg-white/70 px-[4%]" style={{ borderColor: "#dfd5bd", boxShadow: "0 8px 24px rgba(16,31,56,.07)" }}>
          <div className="flex h-full w-[23%] items-center justify-center border-r" style={{ borderColor: "#e4dccb" }}>
            {PICTOS[tipo.categoria] ? <img src={PICTOS[tipo.categoria]} alt={tipo.categoria} className="max-h-[82%] max-w-[82%] object-contain" draggable={false} /> :
              <div className="flex h-[74px] w-[74px] items-center justify-center rounded-full border-2 text-[19px] font-black" style={{ borderColor: GOLD, color: NAVY }}>SAPD</div>}
          </div>
          <div className="flex-1 pl-[4%]">
            <p className="text-[12px] font-black uppercase tracking-[0.28em]" style={{ color: "#9b8048" }}>{meta.title}</p>
            <p className="mt-2 text-[27px] font-black uppercase tracking-[0.04em]" style={{ color: NAVY }}>{tipo.categoria === "OTRA" ? (data.tipo || "CAPACITACIÓN ESPECIAL") : meta.subtitle}</p>
            <p className="mt-2 text-[12px] font-semibold uppercase tracking-[0.16em]" style={{ color: "#697586" }}>Acreditación de competencia · SAPD</p>
          </div>
          <div className="mr-[1%] flex h-[90px] w-[90px] items-center justify-center rounded-full border-[3px] text-center" style={{ borderColor: "#d8c69a", color: "#9b8048" }}>
            <div><p className="text-[10px] font-black tracking-widest">SAPD</p><p className="mt-1 text-[8px] font-bold tracking-wider">VERIFICADO</p></div>
          </div>
        </div>

        <div className="absolute bottom-[12%] left-[9%] flex w-[82%] items-end justify-between">
          <div className="w-[34%] border-t pt-2 text-center" style={{ borderColor: "#9d927d" }}>
            <p className="text-[13px] font-black uppercase">{data.instructor || "INSTRUCTOR"}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "#7b8491" }}>Instructor responsable</p>
          </div>
          <div className="w-[25%] text-center">
            <p className="text-[17px] font-black tracking-wider">{data.fecha || "DD/MM/AAAA"}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "#7b8491" }}>Fecha de otorgamiento</p>
          </div>
          <div className="w-[34%] border-t pt-2 text-center" style={{ borderColor: "#9d927d" }}>
            <p className="text-[13px] font-black uppercase">{data.comisario || "SAN ANDREAS POLICE DEPARTMENT"}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "#7b8491" }}>Comisario · instructor que cargó la capacitación</p>
          </div>
        </div>

        <div className="absolute bottom-[4.2%] left-0 w-full text-center text-[9px] font-bold uppercase tracking-[0.34em]" style={{ color: "#8b7548" }}>
          San Andreas Police Department · mySAPD · Certificación institucional
        </div>
      </div>

      {downloadable && <div className="flex justify-end"><Button onClick={download} className="rounded-none bg-blue-600 text-white hover:bg-blue-700"><Download className="mr-1 h-4 w-4" /> Descargar PNG</Button></div>}
    </div>
  );
}

