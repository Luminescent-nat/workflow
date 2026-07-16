import { useState } from "react";
import type { ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Download, Pencil, Trash2, CheckCircle2, Power, Loader2, Plug, Eye, EyeOff, Globe, Server } from "lucide-react";
import clsx from "clsx";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import { ipc, type Provider, type Tool } from "@/ipc";
import { useI18n } from "@/i18n";

const TOOLS: { key: Tool; label: string; icon: typeof Server }[] = [
  { key: "claude", label: "Claude", icon: Server },
  { key: "codex", label: "Codex", icon: Server },
];

const emptyDraft = (tool: Tool): Provider => ({
  id: "", tool, name: "", base_url: "", key: "", model: null,
  wire_api: tool === "codex" ? "chat" : null, active: false,
});

function maskKey(k: string, missingText: string): string {
  if (!k) return missingText;
  if (k.length <= 8) return "••••";
  return `${k.slice(0, 4)}••••${k.slice(-4)}`;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-[var(--brand-700)]">{label}</span>
      {children}
    </label>
  );
}

function ProviderForm({ draft, onChange, onSubmit, submitting }: {
  draft: Provider; onChange: (p: Provider) => void; onSubmit: () => void; submitting: boolean;
}) {
  const { t } = useI18n();
  const set = (patch: Partial<Provider>) => onChange({ ...draft, ...patch });
  const [showKey, setShowKey] = useState(false);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-4">
      <Field label={t("providers.name")}>
        <input className="form-input" value={draft.name} onChange={(e) => set({ name: e.target.value })} required placeholder={t("providers.namePlaceholder")} />
      </Field>
      <Field label="Base URL">
        <input className="form-input" value={draft.base_url} onChange={(e) => set({ base_url: e.target.value })} required placeholder="https://api.example.com/v1" />
      </Field>
      <Field label="API Key / Token">
        <div className="flex gap-2">
          <input className="form-input" value={draft.key} onChange={(e) => set({ key: e.target.value })} type={showKey ? "text" : "password"} placeholder="sk-..." autoComplete="off" />
          <Button type="button" variant="default" size="sm" className="shrink-0" onClick={() => setShowKey((v) => !v)}>
            {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
            {showKey ? t("providers.hide") : t("providers.show")}
          </Button>
        </div>
        <div className="mt-1 text-[11px] text-[var(--brand-400)]">{t("providers.keyHelp")}</div>
      </Field>
      <Field label={t("providers.model")}>
        <input className="form-input" value={draft.model ?? ""} onChange={(e) => set({ model: e.target.value || null })} placeholder={draft.tool === "claude" ? "claude-..." : "gpt-..."} />
      </Field>
      {draft.tool === "codex" && (
        <Field label="wire_api">
          <select className="form-input" value={draft.wire_api ?? "chat"} onChange={(e) => set({ wire_api: e.target.value })}>
            <option value="chat">{t("providers.chatGateway")}</option>
            <option value="responses">{t("providers.responsesApi")}</option>
          </select>
        </Field>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting && <Loader2 className="animate-spin" size={13} />}
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
}

export default function Providers() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [tool, setTool] = useState<Tool>("claude");
  const [draft, setDraft] = useState<Provider | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data: providers, isLoading } = useQuery({ queryKey: ["providers", tool], queryFn: () => ipc.listProviders(tool) });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["providers", tool] });

  const upsert = useMutation({
    mutationFn: (p: Provider) => ipc.upsertProvider(p),
    onSuccess: () => { setDraft(null); invalidate(); },
    onError: (e) => setMsg({ ok: false, text: String(e) }),
  });
  const del = useMutation({
    mutationFn: (id: string) => ipc.deleteProvider(id),
    onSuccess: () => { setConfirmingId(null); invalidate(); },
    onError: (e) => setMsg({ ok: false, text: String(e) }),
  });
  const switchM = useMutation({
    mutationFn: (id: string) => ipc.switchProvider(id),
    onSuccess: () => { setMsg({ ok: true, text: t("providers.switched") }); invalidate(); },
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
        title={t("providers.title")}
        description={t("providers.description")}
        actions={
          <>
            <Button variant="default" size="sm" onClick={() => { setMsg(null); importM.mutate(); }} disabled={importM.isPending}>
              {importM.isPending ? <Loader2 className="animate-spin" size={13} /> : <Download size={13} />}
              {t("providers.importCurrent")}
            </Button>
            <Button variant="primary" size="sm" onClick={() => setDraft(emptyDraft(tool))}>
              <Plus size={13} /> {t("providers.add")}
            </Button>
          </>
        }
      />

      <div className="px-6 py-5">
        <div className="mb-5 inline-flex rounded-lg border border-[var(--brand-200)] bg-white p-0.5">
          {TOOLS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTool(t.key)}
              className={clsx(
                "flex items-center gap-2 rounded-md px-4 py-1.5 text-xs font-semibold transition-all",
                tool === t.key
                  ? "bg-[var(--accent-600)] text-white shadow-sm"
                  : "text-[var(--brand-500)] hover:bg-[var(--brand-50)]",
              )}
            >
              <t.icon size={13} />
              {t.label}
            </button>
          ))}
        </div>

        {msg && (
          <div className={clsx("mb-4 rounded-xl border px-4 py-2.5 text-xs animate-fade-in", msg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700")}>
            {msg.text}
          </div>
        )}

        {isLoading ? (
          <div className="text-sm text-[var(--brand-500)]">{t("common.loading")}</div>
        ) : list.length === 0 ? (
          <div className="empty-state">
            <Globe size={36} className="mb-2 text-[var(--brand-300)]" />
            {t("providers.empty", { tool: tool === "claude" ? "Claude" : "Codex" })}
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((p) => (
              <div
                key={p.id}
                className={clsx(
                  "surface-card surface-card-hover p-4",
                  p.active && "border-[var(--accent-500)] ring-1 ring-[var(--accent-100)]",
                )}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--brand-900)]">{p.name}</span>
                      {p.active && (
                        <span className="pill pill-success">
                          <CheckCircle2 size={10} /> {t("providers.active")}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-1 truncate text-xs text-[var(--brand-500)]">
                      <Globe size={11} />
                      {p.base_url || t("common.defaultMissingBaseUrl")}
                    </div>
                    <div className="mt-1 text-[11px] text-[var(--brand-400)]">
                      <span className="font-mono">{maskKey(p.key, t("providers.keyMissing"))}</span>
                      {p.model ? ` · ${p.model}` : ""}
                      {p.tool === "codex" && p.wire_api ? ` · ${p.wire_api}` : ""}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    {!p.active && (
                      <Button variant="primary" size="sm" disabled={switchM.isPending} onClick={() => { setMsg(null); switchM.mutate(p.id); }}>
                        {switchM.isPending && switchM.variables === p.id ? <Loader2 className="animate-spin" size={13} /> : <Power size={13} />}
                        {t("providers.switch")}
                      </Button>
                    )}
                    <Button variant="default" size="sm" disabled={testM.isPending} onClick={() => { setMsg(null); testM.mutate(p.base_url); }}>
                      {testM.isPending && testM.variables === p.base_url ? <Loader2 className="animate-spin" size={13} /> : <Plug size={13} />}
                      {t("providers.test")}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDraft(p)}>
                      <Pencil size={13} />
                    </Button>
                    {confirmingId === p.id ? (
                      <>
                        <Button variant="danger" size="sm" disabled={del.isPending} onClick={() => del.mutate(p.id)}>{t("common.confirmDelete")}</Button>
                        <Button variant="ghost" size="sm" onClick={() => setConfirmingId(null)}>{t("common.cancel")}</Button>
                      </>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => setConfirmingId(p.id)}>
                        <Trash2 size={13} />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={draft !== null} title={draft?.id ? t("providers.editTitle") : t("providers.addTitle")} onClose={() => setDraft(null)} size="lg">
        {draft && <ProviderForm draft={draft} onChange={setDraft} onSubmit={() => upsert.mutate(draft)} submitting={upsert.isPending} />}
      </Modal>
    </>
  );
}
