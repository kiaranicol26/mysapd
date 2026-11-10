import { ShieldCheck } from "lucide-react";

export function DiscordLogin() {
  return (
    <div className="mt-6 border-t border-blue-200 pt-5">
      <div className="flex items-start gap-3 border border-blue-200 bg-blue-50/60 p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#17345c]" />
        <div className="space-y-1">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#17345c]">
            Token de acceso individual
          </p>
          <p className="text-sm leading-6 text-slate-700">
            Si ya te encuentras dentro del Discord Oficial de SAPD, solicítale a un comisario o cúpula tu token de acceso individual. No lo compartas con nadie.
          </p>
        </div>
      </div>
    </div>
  );
}
