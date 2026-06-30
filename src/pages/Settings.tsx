import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Copy, History, Loader2 } from "lucide-react";
import clsx from "clsx";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/Button";
import { ipc } from "@/ipc";

type Msg = { ok: boolean; text: string } | null;

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500";

const LEVEL_COLOR: Record<string, string> = {
  info: "text-slate-500",
  warn: "text-amber-600",
  error: "text-red-600",
};

function AppInfoCard() {
  const { data } = useQuery({ queryKey: ["appInfo"], queryFn: ipc.appInfo });
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
      <div className="flex justify-between py-1">
        <span className="text-slate-500">名称</span>
        <span className="text-slate-800">{data?.name ?? "—"}</span>
      </div>
      <div className="flex justify-between py-1">
        <span className="text-slate-500">版本</span>
        <span className="text-slate-800">{data?.version ?? "—"}</span>
      </div>
      <div className="flex justify-between gap-4 py-1">
        <span className="text-slate-500">数据目录</span>
        <span className="truncate font-mono text-xs text-slate-600">{data?.data_dir ?? "—"}</span>
      </div>
    </div>
  );
}

function CatalogUrlCard({ onMsg }: { onMsg: (m: Msg) => void }) {
  const [url, setUrl] = useState(() => localStorage.getItem("catalogUrl") ?? "");
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 text-sm font-medium text-slate-700">在线目录地址</div>
      <div className="flex gap-2">
        <input
          className={inputCls}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://.../catalog.json(供市场在线刷新)"
        />
        <Button
          variant="default"
          onClick={() => {
            localStorage.setItem("catalogUrl", url);
            onMsg({ ok: true, text: "已保存目录地址" });
          }}
        >
          保存
        </Button>
      </div>
      <div className="mt-2 text-xs text-slate-400">
        市场页「在线刷新」会从该地址拉取 {"{ skills, mcp }"} JSON;留空则仅用内置精选目录。
      </div>
    </div>
  );
}

function DebugCenter({ onMsg }: { onMsg: (m: Msg) => void }) {
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
      onMsg({ ok: true, text: "诊断日志已复制" });
    } catch {
      onMsg({ ok: false, text: "复制失败" });
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="text-sm font-medium text-slate-700">调试中心</div>
        <select
          className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
          value={level}
          onChange={(e) => setLevel(e.target.value)}
        >
          <option value="all">全部级别</option>
          <option value="info">info</option>
          <option value="warn">warn</option>
          <option value="error">error</option>
        </select>
        <input
          className="w-32 rounded-lg border border-slate-300 px-2 py-1 text-xs"
          placeholder="模块过滤"
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
        />
        <div className="ml-auto flex gap-2">
          <Button variant="default" disabled={isFetching} onClick={() => refetch()}>
            <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} /> 刷新
          </Button>
          <Button variant="default" onClick={copy}>
            <Copy size={14} /> 复制
          </Button>
        </div>
      </div>
      <div className="max-h-72 overflow-auto rounded-lg bg-slate-50 p-2 font-mono text-xs">
        {logs.length === 0 ? (
          <div className="p-2 text-slate-400">(无日志)</div>
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
      onMsg({ ok: true, text: "已还原到该快照(相关页面已刷新)" });
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
        <div className="text-sm font-medium text-slate-700">快照与一键还原</div>
        <Button variant="default" className="ml-auto" onClick={() => refetch()}>
          <RefreshCw size={14} /> 刷新
        </Button>
      </div>
      {isLoading ? (
        <div className="text-sm text-slate-500">加载中…</div>
      ) : list.length === 0 ? (
        <div className="text-sm text-slate-400">
          暂无快照。切换供应商、安装 Skill、配置 MCP、应用角色等操作会自动创建快照。
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
                    确认还原
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmId(null)}>
                    取消
                  </Button>
                </div>
              ) : (
                <Button variant="default" onClick={() => setConfirmId(s.id)}>
                  还原
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
  const [msg, setMsg] = useState<Msg>(null);
  return (
    <>
      <PageHeader title="设置" description="应用设置、调试中心与快照还原" />
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
        <CatalogUrlCard onMsg={setMsg} />
        <DebugCenter onMsg={setMsg} />
        <SnapshotsCard onMsg={setMsg} />
      </div>
    </>
  );
}
