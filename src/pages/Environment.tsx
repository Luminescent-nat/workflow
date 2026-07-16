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
  Shield,
  Cpu,
  Terminal,
  Zap,
} from "lucide-react";
import clsx from "clsx";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/Button";
import { ipc, type ToolStatus } from "@/ipc";
import { useI18n } from "@/i18n";

type ActionKind = "install" | "uninstall" | "update";

const categoryIcons: Record<string, typeof Cpu> = {
  runtime: Cpu,
  cli: Terminal,
  desktop: Shield,
};

function formatVersion(v: string | null, fallback: string): string {
  if (!v) return fallback;
  const clean = v.trim();
  return /^v?\d/.test(clean) ? `v${clean.replace(/^v/, "")}` : clean;
}

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
  const notInstalledText = tr("common.notInstalled");
  const installedText = tr("common.installed");
  const availableVersion = t.available_version ?? tr("environment.tool.versionUnknown");
  const hasUpdate = t.installed && t.available_version != null && t.version !== t.available_version;
  const versionLabel = t.installed ? formatVersion(t.version, installedText) : notInstalledText;

  return (
    <div className="group flex items-start justify-between gap-3 border-b border-[var(--brand-100)] px-4 py-3 transition-colors last:border-0 hover:bg-[var(--brand-50)]/60">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div
          className={clsx(
            "mt-1.5 h-2 w-2 shrink-0 rounded-full",
            t.installed ? "bg-emerald-500" : "bg-[var(--brand-300)]",
          )}
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-sm font-medium text-[var(--brand-900)]">{displayName}</span>
            <span className="text-xs text-[var(--brand-500)]">{versionLabel}</span>
            {hasUpdate && (
              <span className="shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-600">
                → v{availableVersion}
              </span>
            )}
          </div>
          {displayNote && <div className="mt-0.5 text-xs text-[var(--brand-400)]">{displayNote}</div>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {t.install_target == null ? (
          <span className="pill pill-muted">{tr("common.notApplicable")}</span>
        ) : t.installed ? (
          <>
            {hasUpdate && (
              <Button variant="default" size="sm" disabled={busy} onClick={() => onAction("update")}>
                {isPending ? <Loader2 className="animate-spin" size={13} /> : <ArrowUpCircle size={13} />}
                {tr("common.update")}
              </Button>
            )}
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => onAction("uninstall")}>
              <Trash2 size={13} />
            </Button>
          </>
        ) : (
          <Button variant="primary" size="sm" disabled={busy} onClick={() => onAction("install")}>
            {isPending ? <Loader2 className="animate-spin" size={13} /> : <Download size={13} />}
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
  const { data, isLoading, isFetching } = useQuery({ queryKey: ["env"], queryFn: ipc.detectEnvironment });
  const { data: appInfo } = useQuery({ queryKey: ["appInfo"], queryFn: ipc.appInfo });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const refreshTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (refreshTimer.current != null) window.clearInterval(refreshTimer.current);
    },
    [],
  );

  const startAutoRefresh = () => {
    if (refreshTimer.current != null) window.clearInterval(refreshTimer.current);
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
      kind === "install" ? ipc.installTool(target) : kind === "uninstall" ? ipc.uninstallTool(target) : ipc.updateTool(target),
    onSuccess: (out) => {
      setMsg({
        ok: out.success,
        text: out.success
          ? t("environment.actionSuccess")
          : t("environment.actionFailed", { error: (out.stderr || out.stdout || t("environment.unknownError")).slice(0, 240) }),
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
      <PageHeader title={t("environment.title")} description={t("environment.description")} />

      <div className="space-y-4 px-6 py-5">
        {/* 状态栏 */}
        <div className="surface-card p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div
                className={clsx(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  minimalOk
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-amber-50 text-amber-600",
                )}
              >
                {minimalOk ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[var(--brand-900)]">
                  {minimalOk ? t("environment.ready") : t("environment.incomplete")}
                </div>
                <div className="text-xs text-[var(--brand-500)]">
                  {minimalOk ? t("environment.readyDesc") : t("environment.incompleteDesc")}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:ml-auto sm:flex-row sm:items-center">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-[var(--brand-400)]">{t("environment.version.current")}</span>
                  <span className="font-semibold text-[var(--brand-800)]">v{appInfo?.version ?? "—"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[var(--brand-400)]">{t("environment.version.update")}</span>
                  <span className="font-semibold text-[var(--brand-800)]">
                    v{appInfo?.update_version ?? "—"}
                    {appInfo && appInfo.update_version === appInfo.version && (
                      <span className="ml-1 text-[10px] text-emerald-600">
                        ({t("environment.version.currentBuild")})
                      </span>
                    )}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!minimalOk && node && !node.installed && (
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={mutation.isPending}
                    onClick={() => {
                      setMsg(null);
                      mutation.mutate({ kind: "install", target: "node" });
                    }}
                  >
                    {pendingTarget === "node" ? <Loader2 className="animate-spin" size={13} /> : <Download size={13} />}
                    {t("environment.installNode")}
                  </Button>
                )}
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => qc.invalidateQueries({ queryKey: ["env"] })}
                  disabled={isFetching}
                >
                  <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
                  {t("environment.refresh")}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* 下一步指引 */}
        {minimalOk && (
          <div className="surface-card flex flex-col gap-3 border-[var(--accent-100)] bg-[var(--accent-50)]/50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <Zap size={14} className="shrink-0 text-[var(--accent-600)]" />
              <span className="font-semibold text-[var(--brand-900)]">{t("environment.next.title")}</span>
              <span className="text-[var(--brand-300)]">·</span>
              <span className="text-[var(--brand-500)]">{t("environment.next.provider")}</span>
              <span className="text-[var(--brand-300)]">→</span>
              <span className="text-[var(--brand-500)]">{t("environment.next.workspace")}</span>
              <span className="text-[var(--brand-300)]">→</span>
              <span className="text-[var(--brand-500)]">{t("environment.next.launch")}</span>
            </div>
            <div className="flex shrink-0 gap-2">
              <Link to="/providers">
                <Button variant="primary" size="sm">{t("environment.next.providersButton")}</Button>
              </Link>
              <Link to="/workspaces">
                <Button variant="default" size="sm">{t("environment.next.workspaceButton")}</Button>
              </Link>
            </div>
          </div>
        )}

        {/* 消息 */}
        {msg && (
          <div
            className={clsx(
              "animate-fade-in rounded-xl border px-4 py-2.5 text-xs",
              msg.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700",
            )}
          >
            {msg.text}
          </div>
        )}

        {/* 工具列表 */}
        {isLoading ? (
          <div className="surface-card flex items-center justify-center gap-2 py-8 text-sm text-[var(--brand-500)]">
            <Loader2 className="animate-spin" size={16} /> {t("environment.checking")}
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map((g) => {
              const Icon = categoryIcons[g.cat] || Terminal;
              const installedCount = g.items.filter((i) => i.installed).length;
              return (
                <section key={g.cat}>
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--brand-100)] text-[var(--brand-500)]">
                      <Icon size={13} />
                    </div>
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-600)]">
                      {t(`environment.category.${g.cat}`)}
                    </h2>
                    <span className="pill pill-muted">{installedCount}/{g.items.length}</span>
                    <div className="section-divider" />
                  </div>
                  <div className="surface-card overflow-hidden">
                    {g.items.map((t) => (
                      <ToolRow
                        key={t.key}
                        t={t}
                        pendingTarget={pendingTarget}
                        busy={mutation.isPending}
                        onAction={(kind) => {
                          setMsg(null);
                          if (t.install_target) mutation.mutate({ kind, target: t.install_target });
                        }}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
