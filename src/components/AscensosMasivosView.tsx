import { useEffect, useMemo, useState } from "react";
import sapdLogo from "@/assets/sapd-logo.png.asset.json";
import { AlertTriangle, ArrowUpCircle, CheckCircle2, ClipboardPaste, Loader2, RefreshCw, Settings2, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db, getToken } from "@/lib/db";
import { logAction, type Session } from "@/lib/session";
import { applyBulkPromotions } from "@/lib/data.functions";
import { DEFAULT_PROMOTION_ROLE_CONFIG, externalRoleIdsByRank, formatRankIdLines, parsePromotionAnnouncement, parsePromotionRoleConfig, parseRankIdLines, policeRankOrder, rankTextMatches, type ParsedPromotion, type PoliceRank, type PromotionRoleConfig } from "@/lib/promociones";

type Instructor = { id: string; name: string; discord_id: string | null; discord_inhabilitado: boolean | null };
type PdMember = { id: string; instructor_id: string | null; nombre: string; rango: string | null };
type PreviewRow = ParsedPromotion & {
  instructor: Instructor | null;
  pdMember: PdMember | null;
  blockedReason: string | null;
  previousRankMatches: boolean;
};
type ApplyResult = { discordId: string; name?: string; rank?: string; status: "success" | "warning" | "error"; message: string };

export function AscensosMasivosView({ session }: { session: Session }) {
  const [rawText, setRawText] = useState("");
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [pdMembers, setPdMembers] = useState<PdMember[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(true);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [parsed, setParsed] = useState<ParsedPromotion[]>([]);
  const [issues, setIssues] = useState<{ line: number; text: string; reason: string }[]>([]);
  const [results, setResults] = useState<ApplyResult[]>([]);
  const [roleConfig, setRoleConfig] = useState<PromotionRoleConfig>(DEFAULT_PROMOTION_ROLE_CONFIG);
  const [externalRoleText, setExternalRoleText] = useState(formatRankIdLines(externalRoleIdsByRank(DEFAULT_PROMOTION_ROLE_CONFIG)));
  const [factionRoleText, setFactionRoleText] = useState(formatRankIdLines(DEFAULT_PROMOTION_ROLE_CONFIG.faction));
  const [roleConfigLoading, setRoleConfigLoading] = useState(true);
  const [savingRoleConfig, setSavingRoleConfig] = useState(false);
  const [showRoleConfig, setShowRoleConfig] = useState(false);

  async function loadRoster() {
    setLoadingRoster(true);
    try {
      const [instructorResult, pdResult] = await Promise.all([
        db.from("instructors").select("id,name,discord_id,discord_inhabilitado").order("name", { ascending: true }),
        db.from("pd_members").select("id,instructor_id,nombre,rango").order("nombre", { ascending: true }),
      ]);
      if (instructorResult.error) throw new Error(instructorResult.error.message);
      if (pdResult.error) throw new Error(pdResult.error.message);
      setInstructors((instructorResult.data ?? []) as Instructor[]);
      setPdMembers((pdResult.data ?? []) as PdMember[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar el Registro PD.");
    } finally {
      setLoadingRoster(false);
    }
  }

  async function loadRoleConfig() {
    setRoleConfigLoading(true);
    try {
      const { data, error } = await db.from("app_settings").select("value")
        .eq("key", "bulk_promotion_role_mappings").maybeSingle();
      if (error) throw new Error(error.message);
      const config = parsePromotionRoleConfig(data?.value);
      setRoleConfig(config);
      setExternalRoleText(formatRankIdLines(externalRoleIdsByRank(config)));
      setFactionRoleText(formatRankIdLines(config.faction));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar la equivalencia de roles.");
    } finally {
      setRoleConfigLoading(false);
    }
  }

  async function saveRoleConfig() {
    setSavingRoleConfig(true);
    try {
      const externalByRank = parseRankIdLines(externalRoleText);
      const faction = parseRankIdLines(factionRoleText);
      const external = Object.fromEntries(
        Object.entries(externalByRank).map(([rank, roleId]) => [roleId, rank]),
      ) as Record<string, PoliceRank>;
      const config: PromotionRoleConfig = { external, faction };
      const { error } = await db.from("app_settings").upsert({
        key: "bulk_promotion_role_mappings",
        value: JSON.stringify(config),
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
      setRoleConfig(config);
      setParsed([]);
      setIssues([]);
      await logAction(db, session, "UPDATE_PROMOTION_ROLE_MAPPINGS", { ranks: 9 });
      toast.success("Equivalencias de rangos guardadas.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron guardar las equivalencias.");
    } finally {
      setSavingRoleConfig(false);
    }
  }

  useEffect(() => { void loadRoster(); void loadRoleConfig(); }, []);

  const preview = useMemo<PreviewRow[]>(() => {
    return parsed.map(item => {
      const matches = instructors.filter(row => row.discord_id === item.discordId);
      const instructor = matches.length === 1 ? matches[0] : null;
      const linked = instructor ? pdMembers.filter(row => row.instructor_id === instructor.id) : [];
      const pdMember = linked.length === 1 ? linked[0] : null;
      let blockedReason: string | null = null;
      if (matches.length === 0) blockedReason = "Discord ID no registrado en mySAPD.";
      else if (matches.length > 1) blockedReason = "Discord ID duplicado entre cuentas.";
      else if (instructor?.discord_inhabilitado) blockedReason = "La cuenta figura inhabilitada en mySAPD.";
      else if (linked.length === 0) blockedReason = "No tiene ficha vinculada en Registro PD.";
      else if (linked.length > 1) blockedReason = "Tiene varias fichas vinculadas; requiere revisión.";
      else if (pdMember && policeRankOrder(pdMember.rango) >= 0 && policeRankOrder(item.newRank) >= policeRankOrder(pdMember.rango)) blockedReason = "El nuevo rango no es superior al rango actual; no se aplican descensos ni cambios duplicados.";
      return {
        ...item,
        instructor,
        pdMember,
        blockedReason,
        previousRankMatches: !!pdMember && rankTextMatches(pdMember.rango, item.previousRankText),
      };
    });
  }, [parsed, instructors, pdMembers]);

  const readyRows = preview.filter(row => !row.blockedReason);
  const blockedRows = preview.filter(row => !!row.blockedReason);
  const mismatchRows = preview.filter(row => !row.blockedReason && !row.previousRankMatches);

  async function analyze() {
    setLoading(true);
    setResults([]);
    try {
      if (!rawText.trim()) throw new Error("Pegá primero el comunicado de ascensos.");
      if (loadingRoster) throw new Error("Esperá a que termine de cargar el Registro PD.");
      if (roleConfigLoading) throw new Error("Esperá a que termine de cargar la equivalencia de roles.");
      const parsedResult = parsePromotionAnnouncement(rawText, roleConfig.external);
      if (!parsedResult.promotions.length && !parsedResult.issues.length) {
        throw new Error("No encontré líneas de ascenso con menciones de Discord válidas.");
      }
      setParsed(parsedResult.promotions);
      setIssues(parsedResult.issues);
      if (parsedResult.promotions.length) {
        toast.success(`Se detectaron ${parsedResult.promotions.length} ascensos para revisar.`);
      } else {
        toast.error("No se detectaron ascensos aplicables.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo analizar el comunicado.");
    } finally {
      setLoading(false);
    }
  }

  async function apply() {
    if (!readyRows.length) return toast.error("No hay ascensos válidos para aplicar.");
    const mismatchMessage = mismatchRows.length
      ? `\\n\\nAviso: ${mismatchRows.length} policía(s) tienen un rango anterior distinto al de Registro PD.`
      : "";
    const confirmMessage = `Se actualizarán ${readyRows.length} policía(s) en Registro PD y en Discord. Solo se reemplazarán roles policiales; los roles de división y demás permisos se conservarán.${mismatchMessage}\\n\\n¿Querés continuar?`;
    if (!window.confirm(confirmMessage)) return;

    setApplying(true);
    setResults([]);
    try {
      const token = getToken();
      if (!token) throw new Error("Tu sesión expiró. Volvé a iniciar sesión.");
      const response = await applyBulkPromotions({
        data: {
          token,
          items: readyRows.map(row => ({ discordId: row.discordId, externalRoleId: row.externalRoleId })),
        },
      });
      if (!response.ok) throw new Error(response.error);
      setResults(response.results as ApplyResult[]);
      await logAction(db, session, "BULK_POLICE_PROMOTION_BATCH", {
        total: response.total,
        success: response.success,
        warnings: response.warnings,
        failed: response.failed,
      });
      await loadRoster();
      toast.success(`Proceso terminado: ${response.success} correctos, ${response.warnings} con advertencias y ${response.failed} fallidos.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo aplicar el lote.");
    } finally {
      setApplying(false);
    }
  }

  function reset() {
    setRawText("");
    setParsed([]);
    setIssues([]);
    setResults([]);
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-2 border-blue-300 bg-white shadow-md rounded-none">
        <div className="h-1.5 bg-blue-700" />
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 border-2 border-blue-300 flex items-center justify-center">
              <ArrowUpCircle className="w-6 h-6 text-blue-700" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] font-extrabold text-blue-700">San Andreas Police Department</p>
              <h1 className="text-2xl font-black uppercase text-slate-900 font-display">Cargas Masivas</h1>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Ascensos policiales</p>
            </div>
          </div>
          <p className="text-sm text-slate-600">
            Pegá el comunicado del Discord externo. mySAPD identificará cada policía por su Discord ID y traducirá el rol externo al rango equivalente de Westzone PD.
          </p>
        </div>
      </Card>

      <Card className="border border-blue-200 bg-white rounded-none overflow-hidden">
        <div className="h-1 bg-blue-600" />
        <div className="p-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-blue-700" />
            <div>
              <p className="font-black uppercase text-slate-900 text-sm">Equivalencias de rangos</p>
              <p className="text-xs text-slate-500">Configuración de roles externos y roles de Westzone PD.</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => setShowRoleConfig(value => !value)} className="ml-auto rounded-none">
            {showRoleConfig ? "Ocultar configuración" : "Configurar equivalencias"}
          </Button>
        </div>
        {showRoleConfig && (
          <div className="border-t p-5 space-y-4">
            <p className="text-xs text-slate-600">
              Una línea por rango, con el formato <span className="font-mono font-bold">Rango=ID_DEL_ROL</span>. Deben estar los nueve rangos y no se pueden repetir IDs.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <h3 className="text-sm font-black uppercase text-slate-900">Discord externo (origen)</h3>
                <Textarea value={externalRoleText} onChange={event => setExternalRoleText(event.target.value)} rows={9} className="rounded-none font-mono text-xs" />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-black uppercase text-slate-900">Westzone PD (destino)</h3>
                <Textarea value={factionRoleText} onChange={event => setFactionRoleText(event.target.value)} rows={9} className="rounded-none font-mono text-xs" />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-500">{roleConfigLoading ? "Cargando equivalencias…" : "Los cambios se aplican a los próximos análisis y ascensos."}</p>
              <Button onClick={saveRoleConfig} disabled={savingRoleConfig || roleConfigLoading} className="rounded-none bg-blue-700 hover:bg-blue-800 text-white font-bold">
                {savingRoleConfig ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                Guardar equivalencias
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="border border-blue-200 bg-white rounded-none overflow-hidden">
        <div className="h-1 bg-blue-600" />
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <ClipboardPaste className="w-5 h-5 text-blue-700" />
            <h2 className="text-lg font-black uppercase text-slate-900">Carga de ascensos</h2>
            <Badge variant="outline" className="ml-auto rounded-none">Discord externo</Badge>
          </div>
          <Textarea
            value={rawText}
            onChange={event => setRawText(event.target.value)}
            placeholder={"Pegá acá el comunicado completo...\n\n( <@&...> ) El **Teniente** <@1283191049874833458> asciende a <@&890703789340913675>"}
            className="min-h-[520px] h-[520px] resize-y rounded-none border-blue-200 bg-white font-mono text-sm leading-relaxed text-slate-800"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={analyze} disabled={loading || loadingRoster || roleConfigLoading || !rawText.trim()} className="rounded-none bg-blue-700 hover:bg-blue-800 text-white font-bold">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardPaste className="mr-2 h-4 w-4" />}
              Analizar comunicado
            </Button>
            <Button variant="outline" onClick={reset} disabled={applying} className="rounded-none">Limpiar</Button>
            <Button variant="ghost" onClick={() => void loadRoster()} disabled={loadingRoster || applying} className="rounded-none ml-auto">
              <RefreshCw className={`mr-2 h-4 w-4 ${loadingRoster ? "animate-spin" : ""}`} /> Actualizar Registro PD
            </Button>
            {loadingRoster && <span className="text-xs text-slate-500">Cargando personal…</span>}
          </div>
        </div>
      </Card>

      {(!!preview.length || !!issues.length) && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="rounded-none border border-emerald-200 bg-white p-4">
              <p className="text-xs uppercase font-bold tracking-wider text-emerald-700">Listos para aplicar</p>
              <p className="text-2xl font-black text-slate-900">{readyRows.length}</p>
            </Card>
            <Card className="rounded-none border border-amber-200 bg-white p-4">
              <p className="text-xs uppercase font-bold tracking-wider text-amber-700">Revisar rango anterior</p>
              <p className="text-2xl font-black text-slate-900">{mismatchRows.length}</p>
            </Card>
            <Card className="rounded-none border border-red-200 bg-white p-4">
              <p className="text-xs uppercase font-bold tracking-wider text-red-700">No aplicables</p>
              <p className="text-2xl font-black text-slate-900">{blockedRows.length + issues.length}</p>
            </Card>
          </div>

          <Card className="border border-blue-200 bg-white rounded-none overflow-hidden">
            <div className="h-1 bg-blue-600" />
            <div className="p-5 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-black uppercase text-slate-900">Vista previa</h2>
                <Badge variant="outline" className="rounded-none">{preview.length} detectados</Badge>
                <span className="ml-auto text-xs text-slate-500">La aplicación no comienza hasta confirmar.</span>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Policía</TableHead>
                      <TableHead>Discord ID</TableHead>
                      <TableHead>Rango actual</TableHead>
                      <TableHead>Nuevo rango</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map(row => (
                      <TableRow key={row.discordId}>
                        <TableCell className="font-bold">{row.pdMember?.nombre ?? row.instructor?.name ?? "Sin registro"}</TableCell>
                        <TableCell className="font-mono text-xs">{row.discordId}</TableCell>
                        <TableCell>
                          <span>{row.pdMember?.rango ?? "—"}</span>
                          {!row.blockedReason && !row.previousRankMatches && (
                            <p className="text-[11px] text-amber-700">El comunicado indica: {row.previousRankText}</p>
                          )}
                        </TableCell>
                        <TableCell className="font-bold text-blue-700">{row.newRank}</TableCell>
                        <TableCell>
                          {row.blockedReason ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700"><XCircle className="h-3.5 w-3.5" /> {row.blockedReason}</span>
                          ) : !row.previousRankMatches ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700"><AlertTriangle className="h-3.5 w-3.5" /> Revisar rango anterior</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Listo</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {!!issues.length && (
                <div className="space-y-2 border-t pt-3">
                  <p className="text-sm font-black uppercase text-amber-700">Líneas no interpretadas</p>
                  {issues.map(issue => (
                    <div key={issue.line} className="text-xs text-slate-600">
                      <span className="font-bold">Línea {issue.line}:</span> {issue.reason}
                      <p className="font-mono break-all text-slate-400">{issue.text}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <ShieldCheck className="h-4 w-4 text-blue-700" />
                  Solo se reemplazan los 9 roles policiales configurados.
                </div>
                <Button onClick={apply} disabled={applying || !readyRows.length} className="rounded-none bg-emerald-700 hover:bg-emerald-800 text-white font-bold">
                  {applying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowUpCircle className="mr-2 h-4 w-4" />}
                  {applying ? "Aplicando ascensos…" : `Aplicar ${readyRows.length} ascenso(s)`}
                </Button>
              </div>
            </div>
          </Card>
        </>
      )}

      {!!results.length && (
        <Card className="border border-blue-200 bg-white rounded-none overflow-hidden">
          <div className="h-1 bg-blue-600" />
          <div className="p-5 space-y-3">
            <h2 className="text-lg font-black uppercase text-slate-900">Resultado de la operación</h2>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="bg-emerald-50 p-3"><p className="text-xs font-bold uppercase text-emerald-700">Correctos</p><p className="text-xl font-black text-emerald-800">{results.filter(row => row.status === "success").length}</p></div>
              <div className="bg-amber-50 p-3"><p className="text-xs font-bold uppercase text-amber-700">Advertencias</p><p className="text-xl font-black text-amber-800">{results.filter(row => row.status === "warning").length}</p></div>
              <div className="bg-red-50 p-3"><p className="text-xs font-bold uppercase text-red-700">Fallidos</p><p className="text-xl font-black text-red-800">{results.filter(row => row.status === "error").length}</p></div>
            </div>
            <div className="space-y-2">
              {results.map(row => (
                <div key={row.discordId} className="flex flex-wrap items-start gap-2 border-b pb-2 text-sm">
                  {row.status === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-700" /> : row.status === "warning" ? <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-700" /> : <XCircle className="mt-0.5 h-4 w-4 text-red-700" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{row.name ?? row.discordId} {row.rank ? `· ${row.rank}` : ""}</p>
                    <p className="text-xs text-slate-500">{row.message}</p>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400">{row.discordId}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
