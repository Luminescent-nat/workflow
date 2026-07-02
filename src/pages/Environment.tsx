import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Download,
  ArrowUpCircle,
  Trash2,
  Loader2,
} from "lucide-react";
import clsx from "clsx";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/Button";
import { ipc, type ToolStatus } from "@/ipc";
import { useI18n } from "@/i18n";

type ActionKind = "install" | "uninstall" | "update";

function ToolRow({
  t,
  onAction,
  pendingTarget,
  busy,
}: {
  t: ToolStatus;
  onAction: (kind: ActionKind) => void;
  pendingTarget: string | undefined;
  busy: boolean;
}) {
  const { t: tr } = useI18n();
  const local = (key: string, fallback: string) => {
    const value = tr(key);
    return value === key ? fallback : value;
  };
  const isPending = pendingTarget != null && pendingTarget === t.install_target;
  const displayName = local(`env.tool.${t.key}.name`, t.name);
  const displayNote = t.note ? local(`env.tool.${t.key}.note`, t.note) : null;
  const currentVersion = t.installed ? t.version ?? tr("common.installed") : tr("common.notInstalled");
  const availableVersion = t.available_version ?? tr("environment.tool.versionUnknown");
  const availableLabel = t.installed
    ? tr("environment.tool.updateVersion")
    : tr("environment.tool.installVersion");
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center gap-3">
        {t.installed ? (
          <CheckCircle2 className="text-emerald-500" size={20} />
        ) : (
          <XCircle className="text-slate-300" size={20} />
        )}
        <div>
          <div className="text-sm font-medium text-slate-800">{displayName}</div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
            <span>
              {tr("environment.tool.installedVersion")}: {currentVersion}
            </span>
            {t.install_target && (
              <span>
                {availableLabel}: {availableVersion}
              </span>
            )}
          </div>
          {displayNote && <div className="mt-0.5 text-xs text-slate-400">{displayNote}</div>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {t.install_target == null ? (
          <span className="text-xs text-slate-400">{tr("common.notApplicable")}</span>
        ) : t.installed ? (
          <>
            <Button variant="default" disabled={busy} onClick={() => onAction("update")}>
              {isPending ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <ArrowUpCircle size={16} />
              )}
              {tr("common.update")}
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => onAction("uninstall")}>
              <Trash2 size={16} />
              {tr("common.uninstall")}
            </Button>
          </>
        ) : (
          <Button variant="primary" disabled={busy} onClick={() => onAction("install")}>
            {isPending ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Download size={16} />
            )}
            {tr("common.install")}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function Environment() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["env"],
    queryFn: ipc.detectEnvironment,
  });
  const { data: appInfo } = useQuery({ queryKey: ["appInfo"], queryFn: ipc.appInfo });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const refreshTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (refreshTimer.current != null) {
        window.clearInterval(refreshTimer.current);
      }
    },
    [],
  );

  const startAutoRefresh = () => {
    if (refreshTimer.current != null) {
      window.clearInterval(refreshTimer.current);
    }
    let ticks = 0;
    refreshTimer.current = window.setInterval(() => {
      ticks += 1;
      qc.invalidateQueries({ queryKey: ["env"] });
      if (ticks >= 6 && refreshTimer.current != null) {
        window.clearInterval(refreshTimer.current);
        refreshTimer.current = null;
      }
    }, 3000);
  };

  const mutation = useMutation({
    mutationFn: ({ kind, target }: { kind: ActionKind; target: string }) =>
      kind === "install"
        ? ipc.installTool(target)
        : kind === "uninstall"
          ? ipc.uninstallTool(target)
          : ipc.updateTool(target),
    onSuccess: (out) => {
      setMsg({
        ok: out.success,
        text: out.success
          ? t("environment.actionSuccess")
          : t("environment.actionFailed", {
              error: (out.stderr || out.stdout || t("environment.unknownError")).slice(0, 240),
            }),
      });
      qc.invalidateQueries({ queryKey: ["env"] });
      startAutoRefresh();
    },
    onError: (e) => setMsg({ ok: false, text: String(e) }),
  });

  const tools = data ?? [];
  const node = tools.find((t) => t.key === "node");
  const npm = tools.find((t) => t.key === "npm");
  const minimalOk = !!node?.installed && !!npm?.installed;
  const pendingTarget = mutation.isPending ? mutation.variables?.target : undefined;

  const groups = (["runtime", "cli", "desktop"] as const).map((cat) => ({
    cat,
    items: tools.filter((t) => t.category === cat),
  }));

  return (
    <>
      <PageHeader
        title={t("environment.title")}
        description={t("environment.description")}
        actions={
          <Button
            variant="default"
            onClick={() => qc.invalidateQueries({ queryKey: ["env"] })}
            disabled={isFetching}
          >
            <RefreshCw size={16} className={isFetching ? "animate-spin" : ""} />
            {t("environment.refresh")}
          </Button>
        }
      />

      <div className="px-8 py-6">
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {t("environment.version.current")}
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-800">
              v{appInfo?.version ?? "—"}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {t("environment.version.update")}
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-800">
              v{appInfo?.update_version ?? "—"}
              {appInfo && appInfo.update_version === appInfo.version && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  {t("environment.version.currentBuild")}
                </span>
              )}
            </div>
          </div>
        </div>

        <div
          className={clsx(
            "mb-6 rounded-xl border p-4",
            minimalOk ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50",
          )}
        >
          <div className="flex items-center gap-3">
            {minimalOk ? (
              <CheckCircle2 className="text-emerald-600" size={22} />
            ) : (
              <XCircle className="text-amber-600" size={22} />
            )}
            <div>
              <div className="text-sm font-medium text-slate-800">
                {minimalOk ? t("environment.ready") : t("environment.incomplete")}
              </div>
              <div className="text-xs text-slate-600">
                {minimalOk
                  ? t("environment.readyDesc")
                  : t("environment.incompleteDesc")}
              </div>
            </div>
            {!minimalOk && node && !node.installed && (
              <Button
                variant="primary"
                className="ml-auto"
                disabled={mutation.isPending}
                onClick={() => {
                  setMsg(null);
                  mutation.mutate({ kind: "install", target: "node" });
                }}
              >
                {pendingTarget === "node" ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Download size={16} />
                )}
                {t("environment.installNode")}
              </Button>
            )}
          </div>
        </div>

        {minimalOk && (
          <div className="mb-6 rounded-xl border border-sky-200 bg-sky-50 p-4">
            <div className="text-sm font-medium text-slate-800">{t("environment.next.title")}</div>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-slate-600">
              <li>{t("environment.next.provider")}</li>
              <li>{t("environment.next.workspace")}</li>
              <li>{t("environment.next.launch")}</li>
            </ol>
            <div className="mt-3 flex gap-2">
              <Link to="/providers">
                <Button variant="primary">{t("environment.next.providersButton")}</Button>
              </Link>
              <Link to="/workspaces">
                <Button variant="default">{t("environment.next.workspaceButton")}</Button>
              </Link>
            </div>
          </div>
        )}

        {msg && (
          <div
            className={clsx(
              "mb-4 rounded-lg border px-4 py-2 text-sm",
              msg.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700",
            )}
          >
            {msg.text}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="animate-spin" size={16} /> {t("environment.checking")}
          </div>
        ) : (
          groups.map((g) => (
            <section key={g.cat} className="mb-6">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t(`environment.category.${g.cat}`)}
              </h2>
              <div className="space-y-2">
                {g.items.map((t) => (
                  <ToolRow
                    key={t.key}
                    t={t}
                    pendingTarget={pendingTarget}
                    busy={mutation.isPending}
                    onAction={(kind) => {
                      setMsg(null);
                      if (t.install_target) {
                        mutation.mutate({ kind, target: t.install_target });
                      }
                    }}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </>
  );
}
