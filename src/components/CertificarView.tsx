import { useEffect, useMemo, useRef, useState } from "react";
import sapdLogo from "@/assets/sapd-logo.png.asset.json";
import tpl from "@/assets/certificado-new-capacitacion.png";
import pictoM4 from "@/assets/picto-m4.png.asset.json";
import pictoEdc from "@/assets/picto-edc.png.asset.json";
import pictoSniper from "@/assets/picto-sniper.png.asset.json";
import pictoAk from "@/assets/picto-ak.png.asset.json";
import pictoMary from "@/assets/picto-mary.png.asset.json";
import pictoAir from "@/assets/picto-air.png.asset.json";
import { db } from "@/lib/db";
import { Session, logAction } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Download } from "lucide-react";
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

function randomNumero() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function emptyForm(session: Session): CertificateForm {
  const d = new Date();
  const fecha = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  return {
    tipo: TIPOS[0].value,
    nombre: "",
    instructor: session.name,
    comisario: "",
    fecha,
    numero: randomNumero(),
  };
}

type CertificateRecord = { id: string; pd_member_id: string; section: string; training: string; training_other: string | null; awarded_at: string | null; instructor_pd_member_id: string | null; certificate_image_url: string | null; is_legacy?: boolean };

export function CertificarView({ session }: { session: Session }) {
  const [records, setRecords] = useState<CertificateRecord[]>([]);
  const [members, setMembers] = useState<{ id: string; nombre: string; legajo: number }[]>([]);
  const [filterMember, setFilterMember] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [filterTraining, setFilterTraining] = useState("");
  const [filterInstructor, setFilterInstructor] = useState("");
  const [searchText, setSearchText] = useState("");
  const [form, setForm] = useState<CertificateForm | null>(null);
  const [preview, setPreview] = useState<CertificateForm | null>(null);

  useEffect(() => {
    Promise.all([
      db.from("pd_trainings").select("id, pd_member_id, section, training, training_other, awarded_at, instructor_pd_member_id, certificate_image_url, is_legacy").order("awarded_at", { ascending: false }),
      db.from("pd_members").select("id, nombre, legajo").order("nombre", { ascending: true }),
    ]).then(([trainingRows, memberRows]) => {
      if (trainingRows.error) toast.error(trainingRows.error.message); else setRecords((trainingRows.data ?? []) as CertificateRecord[]);
      if (memberRows.error) toast.error(memberRows.error.message); else setMembers((memberRows.data ?? []) as { id: string; nombre: string; legajo: number }[]);
    });
  }, []);

  const visibleRecords = useMemo(() => records.filter(row => {
    const target = members.find(m => m.id === row.pd_member_id);
    const instructor = members.find(m => m.id === row.instructor_pd_member_id);
    const haystack = [target?.nombre, instructor?.nombre, String(target?.legajo ?? ""), row.training, row.training_other ?? ""].join(" ").toLowerCase();
    return (!filterMember || row.pd_member_id === filterMember) && (!filterSection || row.section === filterSection) && (!filterTraining || row.training === filterTraining) && (!filterInstructor || row.instructor_pd_member_id === filterInstructor) && (!searchText || haystack.includes(searchText.toLowerCase()));
  }), [records, members, filterMember, filterSection, filterTraining, filterInstructor, searchText]);

  function openCreate() {
    setForm(emptyForm(session));
  }

  async function generar() {
    if (!form) return;
    if (!form.nombre.trim()) return toast.error("Escribí el nombre de la persona a certificar");
    if (!form.instructor.trim()) return toast.error("Escribí el nombre del instructor");
    if (!form.comisario.trim()) return toast.error("Escribí el nombre del comisario");
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(form.fecha.trim()))
      return toast.error("La fecha debe tener el formato DD/MM/AAAA");
    setPreview(form);
    setForm(null);
    await logAction(db, session, "CREATE_CERTIFICADO", { nombre: form.nombre, tipo: form.tipo });
  }

  return (
    <div className="space-y-4">
      <div className="w-full bg-white border border-blue-200 shadow-sm p-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 flex items-center justify-center bg-white border border-blue-200 p-1">
            <img src={sapdLogo.url} alt="SAPD" className="w-full h-full object-contain" />
          </div>
          <div className="flex-1">
            <p className="text-blue-600 text-xs uppercase tracking-[0.3em] font-bold">
              San Andreas Police Department
            </p>
            <h2 className="text-2xl font-black text-slate-900 uppercase font-display">
              Certificar — Certificados de Capacitación
            </h2>
            <p className="text-slate-500 text-sm">
              Completá el formulario y descargá el certificado en PNG de alta resolución.
            </p>
          </div>
          <Button onClick={openCreate} className="rounded-none bg-blue-600 hover:bg-blue-700 text-white font-semibold">
            <Plus className="w-4 h-4 mr-1" /> Crear Certificado
          </Button>
        </div>
      </div>

      <div className="w-full border border-blue-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-lg font-black uppercase text-slate-900">Biblioteca de certificados</h3><p className="text-sm text-slate-500">Certificados generados automáticamente desde Capacitaciones.</p></div><span className="text-xs font-bold text-blue-700">{visibleRecords.length} / {records.length} registros</span></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Input value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Buscar agente o legajo…" className="rounded-none" />
          <select value={filterMember} onChange={e => setFilterMember(e.target.value)} className="h-10 border border-slate-300 bg-white px-2 text-sm"><option value="">Todos los SAPD</option>{members.map(m => <option key={m.id} value={m.id}>{m.nombre} · {m.legajo}</option>)}</select>
          <select value={filterSection} onChange={e => setFilterSection(e.target.value)} className="h-10 border border-slate-300 bg-white px-2 text-sm"><option value="">Armas y vehículos</option><option>Armas</option><option>Vehículos</option></select>
          <select value={filterTraining} onChange={e => setFilterTraining(e.target.value)} className="h-10 border border-slate-300 bg-white px-2 text-sm"><option value="">Todas las capacitaciones</option>{["M4","EDC","AK-47","SNIPER","MARY","AIR","OTRA"].map(v => <option key={v}>{v}</option>)}</select>
          <select value={filterInstructor} onChange={e => setFilterInstructor(e.target.value)} className="h-10 border border-slate-300 bg-white px-2 text-sm"><option value="">Todos los instructores</option>{members.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select>
        </div>
        {visibleRecords.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visibleRecords.map(row => {
          const target = members.find(m => m.id === row.pd_member_id);
          const instructor = members.find(m => m.id === row.instructor_pd_member_id);
          return <article key={row.id} className="overflow-hidden border border-slate-200 bg-slate-50">
            {row.certificate_image_url ? <a href={row.certificate_image_url} target="_blank" rel="noreferrer"><img src={row.certificate_image_url} alt={"Certificado de " + (target?.nombre ?? "agente SAPD")} className="aspect-[1357/1920] w-full bg-white object-contain" /></a> : <div className="bg-white p-2"><CertCard data={{
              tipo: ({ M4: "Fusil M4", EDC: "Escopeta Spas12", "AK-47": "Fusil de Asalto AK-47", SNIPER: "Fusil de Precisión", MARY: "Unidad Motorizada Mary", AIR: "Unidad Aerea", OTRA: "Capacitación Especial" } as Record<string, string>)[row.training] ?? "Fusil M4",
              nombre: target?.nombre ?? "NOMBRE APELLIDO",
              instructor: instructor?.nombre ?? "Instructor SAPD",
              comisario: "San Andreas Police Department",
              fecha: row.awarded_at ? row.awarded_at.split("-").reverse().join("/") : "Fecha no registrada",
              numero: row.id.replace(/\D/g, "").slice(-6).padStart(6, "0"),
            }} downloadable /></div>}
            <div className="space-y-1 p-3 text-sm"><p className="font-black text-slate-900">{target?.nombre ?? "Agente no disponible"} <span className="font-mono text-xs text-slate-500">#{target?.legajo ?? "—"}</span></p><p className="text-xs text-slate-600">{row.section} · {row.training === "OTRA" ? row.training_other : row.training}</p><p className="text-xs text-slate-500">Instructor: {instructor?.nombre ?? "Nada"} · {row.awarded_at ?? "Fecha histórica no disponible"}</p>{row.certificate_image_url && <a href={row.certificate_image_url} download className="mt-2 inline-flex text-xs font-bold text-blue-700 underline">Abrir / descargar PNG</a>}</div>
          </article>;
        })}</div> : <p className="py-8 text-center text-sm text-slate-400">No hay certificados que coincidan con los filtros.</p>}
      </div>
      {preview ? (
        <div className="w-full bg-white border border-blue-200 shadow-sm p-5">
          <CertCard data={preview} downloadable />
        </div>
      ) : (
        <p className="text-slate-500 italic">
          Todavía no generaste ningún certificado. Pulsá “Crear Certificado”.
        </p>
      )}

      {form && (
        <Dialog open onOpenChange={(v) => !v && setForm(null)}>
          <DialogContent className="max-w-6xl bg-white border border-blue-200 text-slate-900 rounded-none max-h-[95vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl uppercase tracking-wide text-blue-700">
                Crear Certificado
              </DialogTitle>
            </DialogHeader>

            <div className="grid md:grid-cols-2 gap-6 py-2">
              <div className="space-y-3">
                <Field label="Tipo de certificado">
                  <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                    <SelectTrigger className="rounded-none border-blue-300 bg-white text-slate-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-none">
                      {TIPOS.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.value}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Persona a certificar">
                  <Input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
                    className="rounded-none border-blue-300 bg-white text-slate-800" placeholder="Nombre Apellido" />
                </Field>
                <Field label="Instructor">
                  <Input value={form.instructor} onChange={e => setForm({ ...form, instructor: e.target.value })}
                    className="rounded-none border-blue-300 bg-white text-slate-800" placeholder="Nombre Apellido" />
                </Field>
                <Field label="Comisario">
                  <Input value={form.comisario} onChange={e => setForm({ ...form, comisario: e.target.value })}
                    className="rounded-none border-blue-300 bg-white text-slate-800" placeholder="Nombre Apellido" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Fecha (DD/MM/AAAA)">
                    <Input value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })}
                      className="rounded-none border-blue-300 bg-white text-slate-800" placeholder="01/01/2026" />
                  </Field>
                  <Field label="Nº de certificado">
                    <Input value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })}
                      className="rounded-none border-blue-300 bg-white text-slate-800" />
                  </Field>
                </div>
              </div>

              <div>
                <div className="text-xs text-blue-600 uppercase tracking-wider mb-2">Vista Previa</div>
                <CertCard data={form} />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setForm(null)} className="rounded-none border-blue-300">
                Cancelar
              </Button>
              <Button onClick={generar} className="rounded-none bg-blue-600 hover:bg-blue-700 text-white">
                Generar Certificado
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <Label className="text-blue-600 text-xs uppercase tracking-wider">{label}</Label>
      {children}
    </div>
  );
}

const NAVY = "#12294f";

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
      const dataUrl = await toPng(ref.current, {
        cacheBust: true,
        pixelRatio: Math.max(2, 1357 / w),
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `Certificado_${(data.nombre || "SAPD").replace(/\s+/g, "_")}_${tipo.categoria}.png`;
      a.click();
    } catch (e: any) {
      toast.error("No se pudo descargar: " + (e?.message ?? "error"));
    }
  }

  return (
    <div className="space-y-3">
      <div
        ref={ref}
        className="relative w-full mx-auto select-none"
        style={{ aspectRatio: "1357 / 1920", containerType: "inline-size" }}
      >
        <img src={tpl} alt="Certificado" className="absolute inset-0 w-full h-full" draggable={false} />

        {/* Persona a certificar */}
        <Centered top="44.5%" size="4.6cqw" spacing="0.06em">
          {(data.nombre || "NOMBRE APELLIDO").toUpperCase()}
        </Centered>

        {/* Clase / categoría / objeto */}
        <Centered top="59.7%" size="2.1cqw" weight={700}>
          {tipo.clase}
        </Centered>

        {/* Pictograma del objeto dentro del recuadro */}
        <div
          className="absolute flex items-center justify-center"
          style={{
            top: "64.2%",
            left: "50%",
            width: "17.5%",
            aspectRatio: "1",
            padding: "3%",
            transform: "translateX(-50%)",
          }}
        >
          {tipo.categoria === "OTRA" ? (
            <div className="flex h-full w-full items-center justify-center rounded-full border-4 border-[#12294f] text-[2.5cqw] font-black text-[#12294f]">SAPD</div>
          ) : (
            <img src={PICTOS[tipo.categoria] ?? pictoM4.url} alt={tipo.categoria} className="max-w-full max-h-full object-contain" draggable={false} />
          )}
        </div>

        {/* Tapa el "CATEGORIA" impreso de la plantilla */}
        <div
          className="absolute"
          style={{
            top: "73.6%",
            left: "50%",
            width: "15%",
            height: "2.8%",
            transform: "translateX(-50%)",
            background: "#fcf6ed",
          }}
        />

        {/* Categoría dentro del recuadro */}
        <Centered top="74.2%" size="2.3cqw" weight={800} spacing="0.04em">
          {tipo.categoria}
        </Centered>

        {/* Firmas */}
        <Centered top="75.8%" left="24%" width="30%" size="2.2cqw" weight={600}>
          {(data.instructor || "NOMBRE APELLIDO").toUpperCase()}
        </Centered>
        <Centered top="75.8%" left="76%" width="30%" size="2.2cqw" weight={600}>
          {(data.comisario || "NOMBRE APELLIDO").toUpperCase()}
        </Centered>

        {/* Fecha */}
        <div
          className="absolute"
          style={{
            left: "24.5%", top: "89.6%", width: "22%",
            color: NAVY, fontSize: "1.8cqw", fontWeight: 600, textAlign: "center", lineHeight: 1,
          }}
        >
          {data.fecha || "DD/MM/AAAA"}
        </div>

        {/* Nº de certificado */}
        <div
          className="absolute"
          style={{
            left: "76%", top: "89.6%", width: "20%",
            color: NAVY, fontSize: "1.8cqw", fontWeight: 600, textAlign: "center", lineHeight: 1,
          }}
        >
          {data.numero}
        </div>
      </div>

      {downloadable && (
        <div className="flex justify-end">
          <Button onClick={download} className="rounded-none bg-blue-600 hover:bg-blue-700 text-white">
            <Download className="w-4 h-4 mr-1" /> Descargar PNG
          </Button>
        </div>
      )}
    </div>
  );
}

function Centered({
  top, left = "50%", width = "80%", size, weight = 500, spacing, children,
}: {
  top: string; left?: string; width?: string; size: string;
  weight?: number; spacing?: string; children: React.ReactNode;
}) {
  return (
    <div
      className="absolute"
      style={{
        top,
        left,
        width,
        transform: "translateX(-50%)",
        textAlign: "center",
        color: NAVY,
        fontSize: size,
        fontWeight: weight,
        letterSpacing: spacing,
        lineHeight: 1.1,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
}
