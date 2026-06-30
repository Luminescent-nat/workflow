import { useState } from "react";
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

const CATEGORY_LABEL: Record<string, string> = {
  runtime: "运行环境",
  cli: "命令行工具 (CLI)",
  desktop: "桌面版",
};

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
  const isPending = pendingTarget != null && pendingTarget === t.install_target;
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center gap-3">
        {t.installed ? (
          <CheckCircle2 className="text-emerald-500" size={20} />
        ) : (
          <XCircle className="text-slate-300" size={20} />
        )}
        <div>
          <div className="text-sm font-medium text-slate-800">{t.name}</div>
          <div className="text-xs text-slate-500">
            {t.installed ? t.version ?? "已安装" : t.note ?? "未安装"}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {t.install_target == null ? (
          <span className="text-xs text-slate-400">不适用</span>
        ) : t.installed ? (
          <>
            <Button variant="default" disabled={busy} onClick={() => onAction("update")}>
              {isPending ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <ArrowUpCircle size={16} />
              )}
              更新
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => onAction("uninstall")}>
              <Trash2 size={16} />
              卸载
            </Button>
          </>
        ) : (
          <Button variant="primary" disabled={busy} onClick={() => onAction("install")}>
            {isPending ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Download size={16} />
            )}
            安装
          </Button>
        )}
      </div>
    </div>
  );
}

export default function Environment() {
  const qc = useQueryClient();
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["env"],
    queryFn: ipc.detectEnvironment,
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

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
          ? "操作完成"
          : `操作失败:${(out.stderr || out.stdout || "未知错误").slice(0, 240)}`,
      });
      qc.invalidateQueries({ queryKey: ["env"] });
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
        title="环境"
        description="检测并修复 Node / npm 与 Claude、Codex 的 CLI 及桌面版运行环境"
        actions={
          <Button
            variant="default"
            onClick={() => qc.invalidateQueries({ queryKey: ["env"] })}
            disabled={isFetching}
          >
            <RefreshCw size={16} className={isFetching ? "animate-spin" : ""} />
            重新检测
          </Button>
        }
      />

      <div className="px-8 py-6">
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
                {minimalOk ? "基础环境就绪" : "基础环境不完整"}
              </div>
              <div className="text-xs text-slate-600">
                {minimalOk
                  ? "Node.js 与 npm 可用,满足 Claude / Codex 运行底线"
                  : "需要 Node.js 与 npm,可点击右侧一键安装 Node"}
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
                一键安装 Node
              </Button>
            )}
          </div>
        </div>

        {minimalOk && (
          <div className="mb-6 rounded-xl border border-sky-200 bg-sky-50 p-4">
            <div className="text-sm font-medium text-slate-800">下一步:开始你的第一个工作流</div>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-slate-600">
              <li>到「API 供应商」页添加并测试 Claude / Codex 供应商(点"测试"确认连接正常)</li>
              <li>到「工作区」页新建工作区(已默认预选全流程团队角色 + 常用 Skills),选好项目路径与供应商</li>
              <li>点工作区的「Claude」/「Codex」按钮,在隔离环境中启动开始开发</li>
            </ol>
            <div className="mt-3 flex gap-2">
              <Link to="/providers">
                <Button variant="primary">配置供应商</Button>
              </Link>
              <Link to="/workspaces">
                <Button variant="default">新建工作区</Button>
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
            <Loader2 className="animate-spin" size={16} /> 检测中…
          </div>
        ) : (
          groups.map((g) => (
            <section key={g.cat} className="mb-6">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {CATEGORY_LABEL[g.cat]}
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
