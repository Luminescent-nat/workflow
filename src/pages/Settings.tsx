import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Copy, History, Loader2 } from "lucide-react";
import clsx from "clsx";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/Button";
import { ipc } from "@/ipc";
import { languageOptions, translate, type Language, useI18n } from "@/i18n";

type Msg = { ok: boolean; text: string } | null;

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500";

const LEVEL_COLOR: Record<string, string> = {
  info: "text-slate-500",
  warn: "text-amber-600",
  error: "text-red-600",
};

function AppInfoCard() {
  const { t } = useI18n();
  const { data } = useQuery({ queryKey: ["appInfo"], queryFn: ipc.appInfo });
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
      <div className="flex justify-between py-1">
        <span className="text-slate-500">{t("settings.app.name")}</span>
        <span className="text-slate-800">{data?.name ?? "—"}</span>
      </div>
      <div className="flex justify-between py-1">
        <span className="text-slate-500">{t("settings.app.version")}</span>
        <span className="text-slate-800">{data?.version ?? "—"}</span>
      </div>
      <div className="flex justify-between gap-4 py-1">
        <span className="text-slate-500">{t("settings.app.dataDir")}</span>
        <span className="truncate font-mono text-xs text-slate-600">{data?.data_dir ?? "—"}</span>
      </div>
    </div>
  );
}

function LanguageCard({ onMsg }: { onMsg: (m: Msg) => void }) {
  const { language, setLanguage, t } = useI18n();
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-1 text-sm font-medium text-slate-700">{t("settings.language.title")}</div>
      <div className="mb-3 text-xs text-slate-400">{t("settings.language.description")}</div>
      <label className="block max-w-sm">
        <span className="mb-1 block text-xs font-medium text-slate-600">
          {t("settings.language.select")}
        </span>
        <select
          className={inputCls}
          value={language}
          onChange={(e) => {
            const nextLanguage = e.target.value as Language;
            setLanguage(nextLanguage);
            onMsg({ ok: true, text: translate(nextLanguage, "settings.language.saved") });
          }}
        >
          {languageOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function CatalogUrlCard({ onMsg }: { onMsg: (m: Msg) => void }) {
  const { t } = useI18n();
  const [url, setUrl] = useState(() => localStorage.getItem("catalogUrl") ?? "");
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 text-sm font-medium text-slate-700">{t("settings.catalog.title")}</div>
      <div className="flex gap-2">
        <input
          className={inputCls}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t("settings.catalog.placeholder")}
        />
        <Button
          variant="default"
          onClick={() => {
            localStorage.setItem("catalogUrl", url);
            onMsg({ ok: true, text: t("settings.catalog.saved") });
          }}
        >
          {t("settings.catalog.save")}
        </Button>
      </div>
      <div className="mt-2 text-xs text-slate-400">
        {t("settings.catalog.help")}
      </div>
    </div>
  );
}

function DebugCenter({ onMsg }: { onMsg: (m: Msg) => void }) {
  const { t } = useI18n();
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["logs"],
    queryFn: () => ipc.readLogs(500),
  });
  const [level, setLevel] = useState("all");
  const [moduleFilter, setModuleFilter] = useState("");

  const logs = (data ?? []).filter(
    (l) =>
      (level === "all" || l.level === level) &&
      (moduleFilter === "" || l.module.includes(moduleFilter)),
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data ?? [], null, 2));
      onMsg({ ok: true, text: t("settings.debug.copied") });
    } catch {
      onMsg({ ok: false, text: t("settings.debug.copyFailed") });
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="text-sm font-medium text-slate-700">{t("settings.debug.title")}</div>
        <select
          className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
          value={level}
          onChange={(e) => setLevel(e.target.value)}
        >
          <option value="all">{t("settings.debug.allLevels")}</option>
          <option value="info">info</option>
          <option value="warn">warn</option>
          <option value="error">error</option>
        </select>
        <input
          className="w-32 rounded-lg border border-slate-300 px-2 py-1 text-xs"
          placeholder={t("settings.debug.moduleFilter")}
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
        />
        <div className="ml-auto flex gap-2">
          <Button variant="default" disabled={isFetching} onClick={() => refetch()}>
            <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} /> {t("settings.debug.refresh")}
          </Button>
          <Button variant="default" onClick={copy}>
            <Copy size={14} /> {t("settings.debug.copy")}
          </Button>
        </div>
      </div>
      <div className="max-h-72 overflow-auto rounded-lg bg-slate-50 p-2 font-mono text-xs">
        {logs.length === 0 ? (
          <div className="p-2 text-slate-400">{t("settings.debug.empty")}</div>
        ) : (
          logs.map((l, i) => (
            <div key={i} className="flex gap-2 py-0.5">
              <span className="shrink-0 text-slate-400">{l.ts.slice(11, 19)}</span>
              <span className={clsx("shrink-0 uppercase", LEVEL_COLOR[l.level] ?? "text-slate-500")}>
                {l.level}
              </span>
              <span className="shrink-0 text-indigo-500">[{l.module}]</span>
              <span className="text-slate-700">{l.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SnapshotsCard({ onMsg }: { onMsg: (m: Msg) => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["snapshots"],
    queryFn: ipc.listAllSnapshots,
  });
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const restore = useMutation({
    mutationFn: ({ scope, id }: { scope: string; id: string }) => ipc.restoreSnapshot(scope, id),
    onSuccess: () => {
      setConfirmId(null);
      onMsg({ ok: true, text: t("settings.snapshots.restored") });
      ["env", "providers", "skills", "mcp", "roles", "sessions", "snapshots"].forEach((k) =>
        qc.invalidateQueries({ queryKey: [k] }),
      );
    },
    onError: (e) => onMsg({ ok: false, text: String(e) }),
  });

  const list = data ?? [];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <History size={16} className="text-slate-400" />
        <div className="text-sm font-medium text-slate-700">{t("settings.snapshots.title")}</div>
        <Button variant="default" className="ml-auto" onClick={() => refetch()}>
          <RefreshCw size={14} /> {t("settings.debug.refresh")}
        </Button>
      </div>
      {isLoading ? (
        <div className="text-sm text-slate-500">{t("common.loading")}</div>
      ) : list.length === 0 ? (
        <div className="text-sm text-slate-400">
          {t("settings.snapshots.empty")}
        </div>
      ) : (
        <div className="max-h-80 space-y-2 overflow-auto">
          {list.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {s.scope}
                  </span>
                  <span className="truncate text-sm text-slate-700">{s.note}</span>
                </div>
                <div className="text-xs text-slate-400">{s.created_at.slice(0, 19).replace("T", " ")}</div>
              </div>
              {confirmId === s.id ? (
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="danger"
                    disabled={restore.isPending}
                    onClick={() => restore.mutate({ scope: s.scope, id: s.id })}
                  >
                    {restore.isPending ? <Loader2 className="animate-spin" size={16} /> : null}
                    {t("settings.snapshots.confirmRestore")}
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmId(null)}>
                    {t("settings.snapshots.cancel")}
                  </Button>
                </div>
              ) : (
                <Button variant="default" onClick={() => setConfirmId(s.id)}>
                  {t("settings.snapshots.restore")}
                </Button>
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
      <div className="space-y-5 px-8 py-6">
        {msg && (
          <div
            className={clsx(
              "rounded-lg border px-4 py-2 text-sm",
              msg.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700",
            )}
          >
            {msg.text}
          </div>
        )}
        <AppInfoCard />
        <LanguageCard onMsg={setMsg} />
        <CatalogUrlCard onMsg={setMsg} />
        <DebugCenter onMsg={setMsg} />
        <SnapshotsCard onMsg={setMsg} />
      </div>
    </>
  );
}
