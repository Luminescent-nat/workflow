import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  RefreshCw,
  Download,
  Trash2,
  CheckCircle2,
  Plus,
  Settings2,
  Loader2,
  PackageSearch,
  Puzzle,
  Blocks,
  Sparkles,
} from "lucide-react";
import clsx from "clsx";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import { ipc, type McpServer, type McpTarget } from "@/ipc";
import { categoryLabel } from "@/roleCategories";
import { useI18n } from "@/i18n";

type Msg = { ok: boolean; text: string } | null;

const MCP_TARGETS: { key: McpTarget; labelKey: string; fallback: string }[] = [
  { key: "claude_code", labelKey: "mcp.target.claudeCode", fallback: "Claude Code" },
  { key: "claude_desktop", labelKey: "mcp.target.claudeDesktop", fallback: "Claude Desktop" },
  { key: "codex", labelKey: "mcp.target.codex", fallback: "Codex" },
];

function useMcpTargetLabel() {
  const { t } = useI18n();
  return (target: McpTarget) => {
    const item = MCP_TARGETS.find((m) => m.key === target);
    if (!item) return target;
    const label = t(item.labelKey);
    return label === item.labelKey ? item.fallback : label;
  };
}

function Banner({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <div
      className={clsx(
        "mb-4 rounded-xl border px-4 py-2.5 text-xs animate-fade-in",
        msg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700",
      )}
    >
      {msg.text}
    </div>
  );
}

function SkillsTab() {
  const { t } = useI18n();
  const local = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };
  const skillName = (s: { id: string; name: string }) => local(`catalog.skill.${s.id}.name`, s.name);
  const skillDescription = (s: { id: string; description: string }) =>
    local(`catalog.skill.${s.id}.description`, s.description);
  const categoryName = (category: string) => categoryLabel(local, category);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["skills"], queryFn: ipc.listSkills });
  const [msg, setMsg] = useState<Msg>(null);
  const [currentCli, setCurrentCli] = useState<"claude" | "codex">("claude");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["skills"] });
  const install = useMutation({
    mutationFn: ({ id, target }: { id: string; target: "claude" | "codex" | "both" }) => ipc.installSkill(id, target),
    onSuccess: () => { setMsg({ ok: true, text: t("market.skillInstalled") }); invalidate(); },
    onError: (e) => setMsg({ ok: false, text: String(e) }),
  });
  const remove = useMutation({
    mutationFn: ({ id, target }: { id: string; target: "claude" | "codex" | "both" }) => ipc.removeSkill(id, target),
    onSuccess: () => invalidate(),
    onError: (e) => setMsg({ ok: false, text: String(e) }),
  });
  const busy = install.isPending || remove.isPending;

  const skills = data ?? [];
  const categories = Array.from(new Set(skills.map((s) => s.category)));
  const installedForCli = skills.filter((s) => (currentCli === "claude" ? s.claude_installed : s.codex_installed));
  const installedCategories = Array.from(new Set(installedForCli.map((s) => s.category)));

  if (isLoading) return <div className="text-sm text-[var(--brand-500)]">{t("common.loading")}</div>;

  return (
    <div className="space-y-5">
      <Banner msg={msg} />

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={13} />
            </div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-600)]">
              {t("market.currentInstalled")}
            </h3>
            <span className="pill pill-muted">{installedForCli.length}</span>
            <div className="section-divider" />
          </div>
          <div className="inline-flex rounded-lg border border-[var(--brand-200)] bg-white p-0.5">
            {(["claude", "codex"] as const).map((cli) => (
              <button
                key={cli}
                onClick={() => setCurrentCli(cli)}
                className={clsx(
                  "rounded-md px-3 py-1 text-xs font-semibold transition-all",
                  currentCli === cli
                    ? "bg-[var(--accent-600)] text-white shadow-sm"
                    : "text-[var(--brand-500)] hover:bg-[var(--brand-50)]",
                )}
              >
                {cli === "claude" ? "Claude" : "Codex"}
              </button>
            ))}
          </div>
        </div>
        {installedForCli.length === 0 ? (
          <div className="surface-card flex items-center gap-2 px-4 py-3 text-xs text-[var(--brand-400)]">
            <Puzzle size={14} />
            {t("market.noInstalledSkills")}
          </div>
        ) : (
          <div className="surface-card overflow-hidden">
            {installedCategories.map((cat) =>
              installedForCli
                .filter((s) => s.category === cat)
                .map((s) => (
                  <div
                    key={`${currentCli}-${s.id}`}
                    className="flex items-center justify-between gap-3 border-b border-[var(--brand-100)] px-4 py-3 last:border-0 hover:bg-[var(--brand-50)]/60"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-[var(--brand-900)]">{skillName(s)}</span>
                        <span className="text-xs text-[var(--brand-400)]">· {categoryName(cat)}</span>
                      </div>
                      <div className="mt-0.5 truncate text-xs text-[var(--brand-500)]">{skillDescription(s)}</div>
                    </div>
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => remove.mutate({ id: s.id, target: currentCli })}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                )),
            )}
          </div>
        )}
      </section>

      {categories.map((cat) => {
        const catSkills = skills.filter((s) => s.category === cat);
        return (
          <section key={cat}>
            <div className="mb-2 flex items-center gap-2">
              <Sparkles size={13} className="text-[var(--brand-500)]" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-600)]">
                {t("market.installableCategory", { category: categoryName(cat) })}
              </h3>
              <span className="pill pill-muted">{catSkills.length}</span>
              <div className="section-divider" />
            </div>
            <div className="surface-card overflow-hidden">
              {catSkills.map((s) => (
                <div
                  key={s.id}
                  className="flex items-start justify-between gap-3 border-b border-[var(--brand-100)] px-4 py-3 last:border-0 hover:bg-[var(--brand-50)]/60"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium text-[var(--brand-900)]">{skillName(s)}</span>
                      {s.claude_installed && <span className="pill pill-success">Claude</span>}
                      {s.codex_installed && <span className="pill pill-info">Codex</span>}
                    </div>
                    <div className="mt-0.5 text-xs text-[var(--brand-500)]">{skillDescription(s)}</div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    {!s.claude_installed && (
                      <Button variant="default" size="sm" disabled={busy} onClick={() => install.mutate({ id: s.id, target: "claude" })}>
                        <Download size={13} /> Claude
                      </Button>
                    )}
                    {!s.codex_installed && (
                      <Button variant="default" size="sm" disabled={busy} onClick={() => install.mutate({ id: s.id, target: "codex" })}>
                        <Download size={13} /> Codex
                      </Button>
                    )}
                    {s.installed && (
                      <Button variant="ghost" size="sm" disabled={busy} onClick={() => remove.mutate({ id: s.id, target: "both" })}>
                        <Trash2 size={13} />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function McpForm({
  initial,
  onApply,
  submitting,
}: {
  initial: McpServer;
  onApply: (server: McpServer, targets: McpTarget[]) => void;
  submitting: boolean;
}) {
  const { t } = useI18n();
  const targetLabel = useMcpTargetLabel();
  const [name, setName] = useState(initial.name);
  const [command, setCommand] = useState(initial.command);
  const [argsText, setArgsText] = useState(initial.args.join("\n"));
  const [envText, setEnvText] = useState(Object.entries(initial.env).map(([k, v]) => `${k}=${v}`).join("\n"));
  const [targets, setTargets] = useState<McpTarget[]>(["claude_code"]);

  const toggle = (t: McpTarget) => setTargets((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]));
  const submit = () => {
    const args = argsText.split("\n").map((s) => s.trim()).filter(Boolean);
    const env: Record<string, string> = {};
    envText.split("\n").forEach((line) => {
      const i = line.indexOf("=");
      if (i > 0) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    });
    onApply({ ...initial, name, command, args, env }, targets);
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-[var(--brand-700)]">{t("market.mcpName")}</span>
        <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-[var(--brand-700)]">command</span>
        <input className="form-input" value={command} onChange={(e) => setCommand(e.target.value)} required placeholder="npx / uvx / node ..." />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-[var(--brand-700)]">{t("market.argsHelp")}</span>
        <textarea className="form-input h-20 font-mono text-xs" value={argsText} onChange={(e) => setArgsText(e.target.value)} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-[var(--brand-700)]">{t("market.envHelp")}</span>
        <textarea className="form-input h-16 font-mono text-xs" value={envText} onChange={(e) => setEnvText(e.target.value)} />
      </label>
      <div>
        <span className="mb-1.5 block text-xs font-semibold text-[var(--brand-700)]">{t("market.writeTargets")}</span>
        <div className="flex flex-wrap gap-2">
          {MCP_TARGETS.map((t) => (
            <label
              key={t.key}
              className={clsx(
                "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                targets.includes(t.key)
                  ? "border-[var(--accent-600)] bg-[var(--accent-600)] text-white"
                  : "border-[var(--brand-200)] bg-white text-[var(--brand-600)] hover:border-[var(--brand-300)]",
              )}
            >
              <input type="checkbox" checked={targets.includes(t.key)} onChange={() => toggle(t.key)} className="hidden" />
              {targetLabel(t.key)}
            </label>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="submit" variant="primary" disabled={submitting || targets.length === 0}>
          {submitting && <Loader2 className="animate-spin" size={13} />}
          {t("common.apply")}
        </Button>
      </div>
    </form>
  );
}

function McpTab() {
  const { t } = useI18n();
  const local = (key: string, fallback: string) => { const value = t(key); return value === key ? fallback : value; };
  const mcpDescription = (s: { id: string; description: string }) => local(`catalog.mcp.${s.id}.description`, s.description);
  const targetLabel = useMcpTargetLabel();
  const { data, isLoading } = useQuery({ queryKey: ["mcp"], queryFn: ipc.listMcp });
  const [draft, setDraft] = useState<McpServer | null>(null);
  const [imported, setImported] = useState<{ target: McpTarget; list: McpServer[] } | null>(null);
  const [msg, setMsg] = useState<Msg>(null);

  const apply = useMutation({
    mutationFn: ({ server, targets }: { server: McpServer; targets: McpTarget[] }) => ipc.applyMcp(server, targets),
    onSuccess: () => { setDraft(null); setMsg({ ok: true, text: t("market.mcpApplied") }); },
    onError: (e) => setMsg({ ok: false, text: String(e) }),
  });
  const importM = useMutation({
    mutationFn: (t: McpTarget) => ipc.importMcp(t),
    onSuccess: (list, t) => { setImported({ target: t, list }); setMsg(null); },
    onError: (e) => setMsg({ ok: false, text: String(e) }),
  });
  const removeM = useMutation({
    mutationFn: ({ name, targets }: { name: string; targets: McpTarget[] }) => ipc.removeMcp(name, targets),
    onSuccess: (_v, vars) => { setMsg({ ok: true, text: t("market.removed") }); importM.mutate(vars.targets[0]); },
    onError: (e) => setMsg({ ok: false, text: String(e) }),
  });

  const catalog = data ?? [];

  return (
    <div className="space-y-4">
      <Banner msg={msg} />

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" onClick={() => setDraft({ id: "", name: "", description: "", command: "npx", args: [], env: {} })}>
          <Plus size={13} /> {t("market.addMcp")}
        </Button>
        <span className="text-xs text-[var(--brand-400)]">{t("market.importExisting")}</span>
        {MCP_TARGETS.map((t) => (
          <Button key={t.key} variant="default" size="sm" disabled={importM.isPending} onClick={() => importM.mutate(t.key)}>
            <PackageSearch size={13} /> {targetLabel(t.key)}
          </Button>
        ))}
      </div>

      {imported && (
        <div className="surface-card p-4">
          <div className="mb-2 text-xs font-semibold text-[var(--brand-700)]">
            {t("market.configuredMcp", { target: targetLabel(imported.target), count: imported.list.length })}
          </div>
          {imported.list.length === 0 ? (
            <div className="text-sm text-[var(--brand-400)]">{t("common.none")}</div>
          ) : (
            <div className="surface-card overflow-hidden">
              {imported.list.map((s) => (
                <div key={s.name} className="flex items-center justify-between gap-3 border-b border-[var(--brand-100)] px-4 py-3 last:border-0 hover:bg-[var(--brand-50)]/60">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[var(--brand-900)]">{s.name}</div>
                    <div className="truncate font-mono text-[11px] text-[var(--brand-400)]">{s.command} {s.args.join(" ")}</div>
                  </div>
                  <Button variant="ghost" size="sm" disabled={removeM.isPending} onClick={() => removeM.mutate({ name: s.name, targets: [imported.target] })}>
                    <Trash2 size={13} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-[var(--brand-500)]">{t("common.loading")}</div>
      ) : (
        <div className="surface-card overflow-hidden">
          {catalog.map((s) => (
            <div key={s.id} className="flex items-start justify-between gap-3 border-b border-[var(--brand-100)] px-4 py-3 last:border-0 hover:bg-[var(--brand-50)]/60">
              <div className="min-w-0">
                <div className="text-sm font-medium text-[var(--brand-900)]">{s.name}</div>
                <div className="mt-0.5 text-xs text-[var(--brand-500)]">{mcpDescription(s)}</div>
                <div className="mt-0.5 truncate font-mono text-[11px] text-[var(--brand-400)]">{s.command} {s.args.join(" ")}</div>
              </div>
              <Button variant="default" size="sm" onClick={() => setDraft(s)}>
                <Settings2 size={13} />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Modal open={draft !== null} title={t("market.configureMcp")} onClose={() => setDraft(null)} size="lg">
        {draft && <McpForm initial={draft} submitting={apply.isPending} onApply={(server, targets) => apply.mutate({ server, targets })} />}
      </Modal>
    </div>
  );
}

export default function Market() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"skills" | "mcp">("skills");
  const [url, setUrl] = useState(() => localStorage.getItem("catalogUrl") ?? "");
  const [msg, setMsg] = useState<Msg>(null);

  const refresh = useMutation({
    mutationFn: () => { localStorage.setItem("catalogUrl", url); return ipc.refreshCatalog(url); },
    onSuccess: (text) => { setMsg({ ok: true, text }); qc.invalidateQueries({ queryKey: ["skills"] }); qc.invalidateQueries({ queryKey: ["mcp"] }); },
    onError: (e) => setMsg({ ok: false, text: String(e) }),
  });

  return (
    <>
      <PageHeader
        title={t("market.title")}
        description={t("market.description")}
        actions={
          <div className="flex items-center gap-2">
            <input className="form-input w-48 text-xs" placeholder={t("market.catalogPlaceholder")} value={url} onChange={(e) => setUrl(e.target.value)} />
            <Button variant="default" size="sm" disabled={refresh.isPending} onClick={() => refresh.mutate()}>
              <RefreshCw size={13} className={refresh.isPending ? "animate-spin" : ""} />
              {t("market.refreshOnline")}
            </Button>
          </div>
        }
      />
      <div className="px-6 py-5">
        <div className="mb-5 inline-flex rounded-lg border border-[var(--brand-200)] bg-white p-0.5">
          {[
            { key: "skills" as const, label: "Skills", icon: Puzzle },
            { key: "mcp" as const, label: "MCP", icon: Blocks },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={clsx(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
                tab === key
                  ? "bg-[var(--accent-600)] text-white shadow-sm"
                  : "text-[var(--brand-500)] hover:bg-[var(--brand-50)]",
              )}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
        <Banner msg={msg} />
        {tab === "skills" ? <SkillsTab /> : <McpTab />}
      </div>
    </>
  );
}
