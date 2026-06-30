import { useState } from "react";
import type { ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Download, Pencil, Trash2, CheckCircle2, Power, Loader2, Plug } from "lucide-react";
import clsx from "clsx";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import { ipc, type Provider, type Tool } from "@/ipc";

const TOOLS: { key: Tool; label: string }[] = [
  { key: "claude", label: "Claude" },
  { key: "codex", label: "Codex" },
];

const emptyDraft = (tool: Tool): Provider => ({
  id: "",
  tool,
  name: "",
  base_url: "",
  key: "",
  model: null,
  wire_api: tool === "codex" ? "chat" : null,
  active: false,
});

function maskKey(k: string): string {
  if (!k) return "(未填密钥)";
  if (k.length <= 8) return "••••";
  return `${k.slice(0, 4)}••••${k.slice(-4)}`;
}

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function ProviderForm({
  draft,
  onChange,
  onSubmit,
  submitting,
}: {
  draft: Provider;
  onChange: (p: Provider) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const set = (patch: Partial<Provider>) => onChange({ ...draft, ...patch });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="space-y-3"
    >
      <Field label="名称">
        <input
          className={inputCls}
          value={draft.name}
          onChange={(e) => set({ name: e.target.value })}
          required
          placeholder="例如:某中转 / 官方"
        />
      </Field>
      <Field label="Base URL">
        <input
          className={inputCls}
          value={draft.base_url}
          onChange={(e) => set({ base_url: e.target.value })}
          required
          placeholder="https://api.example.com/v1"
        />
      </Field>
      <Field label="API Key / Token">
        <input
          className={inputCls}
          value={draft.key}
          onChange={(e) => set({ key: e.target.value })}
          type="password"
          placeholder="sk-..."
        />
      </Field>
      <Field label="模型(可选,留空用默认)">
        <input
          className={inputCls}
          value={draft.model ?? ""}
          onChange={(e) => set({ model: e.target.value || null })}
          placeholder={draft.tool === "claude" ? "claude-..." : "gpt-..."}
        />
      </Field>
      {draft.tool === "codex" && (
        <Field label="wire_api">
          <select
            className={inputCls}
            value={draft.wire_api ?? "chat"}
            onChange={(e) => set({ wire_api: e.target.value })}
          >
            <option value="chat">chat(OpenAI 兼容网关)</option>
            <option value="responses">responses(OpenAI 官方)</option>
          </select>
        </Field>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting && <Loader2 className="animate-spin" size={16} />}
          保存
        </Button>
      </div>
    </form>
  );
}

export default function Providers() {
  const qc = useQueryClient();
  const [tool, setTool] = useState<Tool>("claude");
  const [draft, setDraft] = useState<Provider | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data: providers, isLoading } = useQuery({
    queryKey: ["providers", tool],
    queryFn: () => ipc.listProviders(tool),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["providers", tool] });

  const upsert = useMutation({
    mutationFn: (p: Provider) => ipc.upsertProvider(p),
    onSuccess: () => {
      setDraft(null);
      invalidate();
    },
    onError: (e) => setMsg({ ok: false, text: String(e) }),
  });
  const del = useMutation({
    mutationFn: (id: string) => ipc.deleteProvider(id),
    onSuccess: () => {
      setConfirmingId(null);
      invalidate();
    },
    onError: (e) => setMsg({ ok: false, text: String(e) }),
  });
  const switchM = useMutation({
    mutationFn: (id: string) => ipc.switchProvider(id),
    onSuccess: () => {
      setMsg({ ok: true, text: "已切换并写入实时配置" });
      invalidate();
    },
    onError: (e) => setMsg({ ok: false, text: String(e) }),
  });
  const testM = useMutation({
    mutationFn: (baseUrl: string) => ipc.testProvider(baseUrl),
    onSuccess: (text) => setMsg({ ok: true, text }),
    onError: (e) => setMsg({ ok: false, text: String(e) }),
  });
  const importM = useMutation({
    mutationFn: () => ipc.importCurrentProvider(tool),
    onSuccess: (p) => setDraft(p),
    onError: (e) => setMsg({ ok: false, text: String(e) }),
  });

  const list = providers ?? [];

  return (
    <>
      <PageHeader
        title="API 供应商"
        description="为 Claude 与 Codex 管理并一键切换第三方 API 供应商"
        actions={
          <>
            <Button
              variant="default"
              onClick={() => {
                setMsg(null);
                importM.mutate();
              }}
              disabled={importM.isPending}
            >
              {importM.isPending ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Download size={16} />
              )}
              导入当前
            </Button>
            <Button variant="primary" onClick={() => setDraft(emptyDraft(tool))}>
              <Plus size={16} /> 新增
            </Button>
          </>
        }
      />

      <div className="px-8 py-6">
        <div className="mb-5 inline-flex rounded-lg border border-slate-200 bg-white p-1">
          {TOOLS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTool(t.key)}
              className={clsx(
                "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                tool === t.key
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

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
        ) : list.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            还没有 {tool === "claude" ? "Claude" : "Codex"} 供应商,点击右上角「新增」或「导入当前」。
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((p) => (
              <div
                key={p.id}
                className={clsx(
                  "rounded-xl border bg-white p-4",
                  p.active ? "border-emerald-300 ring-1 ring-emerald-200" : "border-slate-200",
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">{p.name}</span>
                      {p.active && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                          <CheckCircle2 size={12} /> 已激活
                        </span>
                      )}
                    </div>
                    <div className="mt-1 truncate text-xs text-slate-500">
                      {p.base_url || "(未填 Base URL)"}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      {maskKey(p.key)}
                      {p.model ? ` · ${p.model}` : ""}
                      {p.tool === "codex" && p.wire_api ? ` · ${p.wire_api}` : ""}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {!p.active && (
                      <Button
                        variant="primary"
                        disabled={switchM.isPending}
                        onClick={() => {
                          setMsg(null);
                          switchM.mutate(p.id);
                        }}
                      >
                        {switchM.isPending && switchM.variables === p.id ? (
                          <Loader2 className="animate-spin" size={16} />
                        ) : (
                          <Power size={16} />
                        )}
                        切换
                      </Button>
                    )}
                    <Button
                      variant="default"
                      disabled={testM.isPending}
                      onClick={() => {
                        setMsg(null);
                        testM.mutate(p.base_url);
                      }}
                    >
                      {testM.isPending && testM.variables === p.base_url ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        <Plug size={16} />
                      )}
                      测试
                    </Button>
                    <Button variant="default" onClick={() => setDraft(p)}>
                      <Pencil size={16} /> 编辑
                    </Button>
                    {confirmingId === p.id ? (
                      <>
                        <Button
                          variant="danger"
                          disabled={del.isPending}
                          onClick={() => del.mutate(p.id)}
                        >
                          确认删除
                        </Button>
                        <Button variant="ghost" onClick={() => setConfirmingId(null)}>
                          取消
                        </Button>
                      </>
                    ) : (
                      <Button variant="danger" onClick={() => setConfirmingId(p.id)}>
                        <Trash2 size={16} />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={draft !== null}
        title={draft?.id ? "编辑供应商" : "新增供应商"}
        onClose={() => setDraft(null)}
      >
        {draft && (
          <ProviderForm
            draft={draft}
            onChange={setDraft}
            onSubmit={() => upsert.mutate(draft)}
            submitting={upsert.isPending}
          />
        )}
      </Modal>
    </>
  );
}
