import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Copy, History, Loader2, Info, Globe, Bug, Archive } from "lucide-react";
import clsx from "clsx";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/Button";
import { ipc } from "@/ipc";
import { languageOptions, translate, type Language, useI18n } from "@/i18n";

type Msg = { ok: boolean; text: string } | null;

const LEVEL_COLOR: Record<string, string> = {
  info: "text-[var(--brand-500)]",
  warn: "text-amber-600",
  error: "text-red-600",
};

function Banner({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <div className={clsx("mb-4 rounded-xl border px-4 py-2.5 text-xs animate-fade-in", msg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700")}>
      {msg.text}
    </div>
  );
}

function AppInfoCard() {
  const { t } = useI18n();
  const { data } = useQuery({ queryKey: ["appInfo"], queryFn: ipc.appInfo });
  return (
    <div className="surface-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--brand-100)] text-[var(--brand-500)]"><Info size={14} /></div>
        <div className="text-sm font-semibold text-[var(--brand-900)]">{t("settings.app.title")}</div>
      </div>
      <div className="space-y-2 text-xs">
        <div className="flex justify-between py-1"><span className="text-[var(--brand-500)]">{t("settings.app.name")}</span><span className="font-medium text-[var(--brand-800)]">{data?.name ?? "—"}</span></div>
        <div className="flex justify-between py-1"><span className="text-[var(--brand-500)]">{t("settings.app.version")}</span><span className="font-medium text-[var(--brand-800)]">{data?.version ?? "—"}</span></div>
        <div className="flex justify-between gap-4 py-1"><span className="text-[var(--brand-500)]">{t("settings.app.dataDir")}</span><span className="truncate font-mono text-[11px] text-[var(--brand-600)]">{data?.data_dir ?? "—"}</span></div>
      </div>
    </div>
  );
}

function LanguageCard({ onMsg }: { onMsg: (m: Msg) => void }) {
  const { language, setLanguage, t } = useI18n();
  return (
    <div className="surface-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--brand-100)] text-[var(--brand-500)]"><Globe size={14} /></div>
        <div className="text-sm font-semibold text-[var(--brand-900)]">{t("settings.language.title")}</div>
      </div>
      <div className="mb-3 text-xs text-[var(--brand-500)]">{t("settings.language.description")}</div>
      <select className="form-input max-w-xs" value={language} onChange={(e) => { const next = e.target.value as Language; setLanguage(next); onMsg({ ok: true, text: translate(next, "settings.language.saved") }); }}>
        {languageOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}

function CatalogUrlCard({ onMsg }: { onMsg: (m: Msg) => void }) {
  const { t } = useI18n();
  const [url, setUrl] = useState(() => localStorage.getItem("catalogUrl") ?? "");
  return (
    <div className="surface-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--brand-100)] text-[var(--brand-500)]"><Archive size={14} /></div>
        <div className="text-sm font-semibold text-[var(--brand-900)]">{t("settings.catalog.title")}</div>
      </div>
      <div className="flex gap-2">
        <input className="form-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t("settings.catalog.placeholder")} />
        <Button variant="default" size="sm" onClick={() => { localStorage.setItem("catalogUrl", url); onMsg({ ok: true, text: t("settings.catalog.saved") }); }}>{t("settings.catalog.save")}</Button>
      </div>
      <div className="mt-2 text-[11px] text-[var(--brand-400)]">{t("settings.catalog.help")}</div>
    </div>
  );
}

function DebugCenter({ onMsg }: { onMsg: (m: Msg) => void }) {
  const { t } = useI18n();
  const { data, isFetching, refetch } = useQuery({ queryKey: ["logs"], queryFn: () => ipc.readLogs(500) });
  const [level, setLevel] = useState("all");
  const [moduleFilter, setModuleFilter] = useState("");
  const logs = (data ?? []).filter((l) => (level === "all" || l.level === level) && (moduleFilter === "" || l.module.includes(moduleFilter)));
  const copy = async () => {
    try { await navigator.clipboard.writeText(JSON.stringify(data ?? [], null, 2)); onMsg({ ok: true, text: t("settings.debug.copied") }); } catch { onMsg({ ok: false, text: t("settings.debug.copyFailed") }); }
  };
  return (
    <div className="surface-card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--brand-100)] text-[var(--brand-500)]"><Bug size={14} /></div>
        <div className="text-sm font-semibold text-[var(--brand-900)]">{t("settings.debug.title")}</div>
        <select className="form-input w-auto px-2 py-1 text-xs" value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="all">{t("settings.debug.allLevels")}</option>
          <option value="info">info</option>
          <option value="warn">warn</option>
          <option value="error">error</option>
        </select>
        <input className="form-input w-32 px-2 py-1 text-xs" placeholder={t("settings.debug.moduleFilter")} value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} />
        <div className="ml-auto flex gap-2">
          <Button variant="default" size="sm" disabled={isFetching} onClick={() => refetch()}><RefreshCw size={13} className={isFetching ? "animate-spin" : ""} /> {t("settings.debug.refresh")}</Button>
          <Button variant="default" size="sm" onClick={copy}><Copy size={13} /> {t("settings.debug.copy")}</Button>
        </div>
      </div>
      <div className="max-h-60 overflow-auto rounded-lg bg-[var(--brand-50)] p-2 font-mono text-[11px]">
        {logs.length === 0 ? <div className="p-2 text-[var(--brand-400)]">{t("settings.debug.empty")}</div> : logs.map((l, i) => (
          <div key={i} className="flex gap-2 py-0.5">
            <span className="shrink-0 text-[var(--brand-400)]">{l.ts.slice(11, 19)}</span>
            <span className={clsx("shrink-0 uppercase font-bold", LEVEL_COLOR[l.level] ?? "text-[var(--brand-500)]")}>{l.level}</span>
            <span className="shrink-0 text-[var(--accent-500)]">[{l.module}]</span>
            <span className="text-[var(--brand-700)]">{l.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SnapshotsCard({ onMsg }: { onMsg: (m: Msg) => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({ queryKey: ["snapshots"], queryFn: ipc.listAllSnapshots });
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const restore = useMutation({
    mutationFn: ({ scope, id }: { scope: string; id: string }) => ipc.restoreSnapshot(scope, id),
    onSuccess: () => {
      setConfirmId(null);
      onMsg({ ok: true, text: t("settings.snapshots.restored") });
      ["env", "providers", "skills", "mcp", "roles", "sessions", "snapshots"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
    onError: (e) => onMsg({ ok: false, text: String(e) }),
  });
  const list = data ?? [];
  return (
    <div className="surface-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--brand-100)] text-[var(--brand-500)]"><History size={14} /></div>
        <div className="text-sm font-semibold text-[var(--brand-900)]">{t("settings.snapshots.title")}</div>
        <Button variant="default" size="sm" className="ml-auto" onClick={() => refetch()}><RefreshCw size={13} /> {t("settings.debug.refresh")}</Button>
      </div>
      {isLoading ? <div className="text-sm text-[var(--brand-500)]">{t("common.loading")}</div> : list.length === 0 ? <div className="text-sm text-[var(--brand-400)]">{t("settings.snapshots.empty")}</div> : (
        <div className="max-h-80 space-y-2 overflow-auto">
          {list.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--brand-100)] bg-[var(--brand-50)]/50 px-3 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-[var(--brand-200)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--brand-600)]">{s.scope}</span>
                  <span className="truncate text-xs font-medium text-[var(--brand-700)]">{s.note}</span>
                </div>
                <div className="text-[11px] text-[var(--brand-400)]">{s.created_at.slice(0, 19).replace("T", " ")}</div>
              </div>
              {confirmId === s.id ? (
                <div className="flex shrink-0 gap-2">
                  <Button variant="danger" size="sm" disabled={restore.isPending} onClick={() => restore.mutate({ scope: s.scope, id: s.id })}>
                    {restore.isPending ? <Loader2 className="animate-spin" size={13} /> : null}
                    {t("settings.snapshots.confirmRestore")}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmId(null)}>{t("settings.snapshots.cancel")}</Button>
                </div>
              ) : (
                <Button variant="default" size="sm" onClick={() => setConfirmId(s.id)}>{t("settings.snapshots.restore")}</Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const { t } = useI18n();
  const [msg, setMsg] = useState<Msg>(null);
  return (
    <>
      <PageHeader title={t("settings.title")} description={t("settings.description")} />
      <div className="space-y-4 px-6 py-5">
        <Banner msg={msg} />
        <div className="grid gap-4 lg:grid-cols-2">
          <AppInfoCard />
          <LanguageCard onMsg={setMsg} />
          <CatalogUrlCard onMsg={setMsg} />
          <div className="lg:col-span-2"><DebugCenter onMsg={setMsg} /></div>
          <div className="lg:col-span-2"><SnapshotsCard onMsg={setMsg} /></div>
        </div>
      </div>
    </>
  );
}
