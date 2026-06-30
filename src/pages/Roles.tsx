import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Download, Trash2, Copy, Users, Terminal } from "lucide-react";
import clsx from "clsx";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/Button";
import { ipc, type RolePack } from "@/ipc";

type Msg = { ok: boolean; text: string } | null;
const SCOPE = "global";

function PackCard({
  pack,
  busy,
  onApply,
  onRemove,
}: {
  pack: RolePack;
  busy: boolean;
  onApply: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={clsx(
        "rounded-xl border bg-white p-4",
        pack.applied ? "border-emerald-300 ring-1 ring-emerald-200" : "border-slate-200",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-slate-400" />
            <span className="text-sm font-semibold text-slate-800">{pack.name}</span>
            {pack.applied && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                <CheckCircle2 size={12} /> 已应用
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-slate-500">{pack.description}</div>
        </div>
        {pack.applied ? (
          <Button variant="danger" disabled={busy} onClick={onRemove}>
            <Trash2 size={16} /> 移除
          </Button>
        ) : (
          <Button variant="primary" disabled={busy} onClick={onApply}>
            <Download size={16} /> 应用
          </Button>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {pack.agents.map((a) => (
          <span
            key={a.name}
            className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
          >
            {a.name}
          </span>
        ))}
        {pack.commands.map((c) => (
          <span
            key={c.name}
            className="rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-600"
          >
            /{c.name}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Roles() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["roles"], queryFn: ipc.listRoles });
  const [msg, setMsg] = useState<Msg>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["roles"] });
  const apply = useMutation({
    mutationFn: (id: string) => ipc.applyRole(id, SCOPE),
    onSuccess: () => {
      setMsg({ ok: true, text: "已写入 ~/.claude 的 agents / commands / CLAUDE.md" });
      invalidate();
    },
    onError: (e) => setMsg({ ok: false, text: String(e) }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => ipc.removeRole(id, SCOPE),
    onSuccess: () => {
      setMsg({ ok: true, text: "已移除该预设包的文件" });
      invalidate();
    },
    onError: (e) => setMsg({ ok: false, text: String(e) }),
  });
  const busy = apply.isPending || remove.isPending;

  const copy = async (cmd: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      setMsg({ ok: true, text: "命令已复制到剪贴板" });
    } catch {
      setMsg({ ok: false, text: "复制失败,请手动选择复制" });
    }
  };

  const packs = data?.packs ?? [];
  const installers = data?.installers ?? [];

  return (
    <>
      <PageHeader
        title="角色工作流"
        description="选择预设的多角色工作流模板,应用到全局 Claude 配置(可还原)"
      />
      <div className="px-8 py-6">
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
          <div className="text-sm text-slate-500">加载中…</div>
        ) : (
          <>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              自研预设包
            </h2>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {packs.map((p) => (
                <PackCard
                  key={p.id}
                  pack={p}
                  busy={busy}
                  onApply={() => {
                    setMsg(null);
                    apply.mutate(p.id);
                  }}
                  onRemove={() => {
                    setMsg(null);
                    remove.mutate(p.id);
                  }}
                />
              ))}
            </div>

            <h2 className="mb-2 mt-8 text-xs font-semibold uppercase tracking-wide text-slate-400">
              官方框架(复制命令自行在项目中运行)
            </h2>
            <div className="space-y-2">
              {installers.map((it) => (
                <div
                  key={it.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800">{it.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{it.description}</div>
                    <div className="mt-1 flex items-center gap-1 truncate font-mono text-xs text-slate-400">
                      <Terminal size={12} /> {it.command}
                    </div>
                  </div>
                  <Button variant="default" onClick={() => copy(it.command)}>
                    <Copy size={16} /> 复制
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
