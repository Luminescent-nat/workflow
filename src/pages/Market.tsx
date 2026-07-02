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
} from "lucide-react";
import clsx from "clsx";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import { ipc, type McpServer, type McpTarget } from "@/ipc";
import { useI18n } from "@/i18n";

type Msg = { ok: boolean; text: string } | null;

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500";

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
        "mb-4 rounded-lg border px-4 py-2 text-sm",
        msg.ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700",
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
  const skillName = (s: { id: string; name: string }) =>
    local(`catalog.skill.${s.id}.name`, s.name);
  const skillDescription = (s: { id: string; description: string }) =>
    local(`catalog.skill.${s.id}.description`, s.description);
  const categoryName = (category: string) => local(`catalog.skillCategory.${category}`, category);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["skills"], queryFn: ipc.listSkills });
  const [msg, setMsg] = useState<Msg>(null);
  const [currentCli, setCurrentCli] = useState<"claude" | "codex">("claude");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["skills"] });
  const install = useMutation({
    mutationFn: ({ id, target }: { id: string; target: "claude" | "codex" | "both" }) =>
      ipc.installSkill(id, target),
    onSuccess: () => {
      setMsg({ ok: true, text: t("market.skillInstalled") });
      invalidate();
    },
    onError: (e) => setMsg({ ok: false, text: String(e) }),
  });
  const remove = useMutation({
    mutationFn: ({ id, target }: { id: string; target: "claude" | "codex" | "both" }) =>
      ipc.removeSkill(id, target),
    onSuccess: () => invalidate(),
    onError: (e) => setMsg({ ok: false, text: String(e) }),
  });
  const busy = install.isPending || remove.isPending;

  const skills = data ?? [];
  const categories = Array.from(new Set(skills.map((s) => s.category)));
  const installedForCli = skills.filter((s) =>
    currentCli === "claude" ? s.claude_installed : s.codex_installed,
  );
  const installedCategories = Array.from(new Set(installedForCli.map((s) => s.category)));

  if (isLoading) return <div className="text-sm text-slate-500">{t("common.loading")}</div>;

  return (
    <div>
      <Banner msg={msg} />
      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t("market.currentInstalled")}
          </h3>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
            {(["claude", "codex"] as const).map((cli) => (
              <button
                key={cli}
                onClick={() => setCurrentCli(cli)}
                className={clsx(
                  "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                  currentCli === cli ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100",
                )}
              >
                {cli === "claude" ? "Claude" : "Codex"}
              </button>
            ))}
          </div>
        </div>
        {installedForCli.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
            {t("market.noInstalledSkills")}
          </div>
        ) : (
          installedCategories.map((cat) => (
            <div key={cat} className="mb-4">
              <div className="mb-2 text-xs font-medium text-slate-500">{categoryName(cat)}</div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {installedForCli
                  .filter((s) => s.category === cat)
                  .map((s) => (
                    <div
                      key={`${currentCli}-${s.id}`}
                      className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-800">{skillName(s)}</div>
                        <div className="mt-1 text-xs text-slate-500">{skillDescription(s)}</div>
                      </div>
                      <Button
                        variant="danger"
                        disabled={busy}
                        onClick={() => remove.mutate({ id: s.id, target: currentCli })}
                      >
                        <Trash2 size={16} /> {t("common.remove")}
                      </Button>
                    </div>
                  ))}
              </div>
            </div>
          ))
        )}
      </section>

      {categories.map((cat) => (
        <section key={cat} className="mb-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t("market.installableCategory", { category: categoryName(cat) })}
          </h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {skills
              .filter((s) => s.category === cat)
              .map((s) => (
                <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800">{skillName(s)}</span>
                        {s.claude_installed && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                            <CheckCircle2 size={12} /> Claude
                          </span>
                        )}
                        {s.codex_installed && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-700">
                            <CheckCircle2 size={12} /> Codex
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">{skillDescription(s)}</div>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-2">
                      {!s.claude_installed && (
                        <Button
                          variant="primary"
                          disabled={busy}
                          onClick={() => install.mutate({ id: s.id, target: "claude" })}
                        >
                          <Download size={16} /> Claude
                        </Button>
                      )}
                      {!s.codex_installed && (
                        <Button
                          variant="primary"
                          disabled={busy}
                          onClick={() => install.mutate({ id: s.id, target: "codex" })}
                        >
                          <Download size={16} /> Codex
                        </Button>
                      )}
                      {s.installed && (
                        <Button
                          variant="danger"
                          disabled={busy}
                          onClick={() => remove.mutate({ id: s.id, target: "both" })}
                        >
                          <Trash2 size={16} /> {t("common.remove")}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </section>
      ))}
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
  const [envText, setEnvText] = useState(
    Object.entries(initial.env)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n"),
  );
  const [targets, setTargets] = useState<McpTarget[]>(["claude_code"]);

  const toggle = (t: McpTarget) =>
    setTargets((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]));

  const submit = () => {
    const args = argsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const env: Record<string, string> = {};
    envText.split("\n").forEach((line) => {
      const i = line.indexOf("=");
      if (i > 0) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    });
    onApply({ ...initial, name, command, args, env }, targets);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-3"
    >
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">{t("market.mcpName")}</span>
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">command</span>
        <input
          className={inputCls}
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          required
          placeholder="npx / uvx / node ..."
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">{t("market.argsHelp")}</span>
        <textarea
          className={clsx(inputCls, "h-20 font-mono")}
          value={argsText}
          onChange={(e) => setArgsText(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">{t("market.envHelp")}</span>
        <textarea
          className={clsx(inputCls, "h-16 font-mono")}
          value={envText}
          onChange={(e) => setEnvText(e.target.value)}
        />
      </label>
      <div>
        <span className="mb-1 block text-xs font-medium text-slate-600">{t("market.writeTargets")}</span>
        <div className="flex flex-wrap gap-3">
          {MCP_TARGETS.map((t) => (
            <label key={t.key} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={targets.includes(t.key)}
                onChange={() => toggle(t.key)}
              />
              {targetLabel(t.key)}
            </label>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" variant="primary" disabled={submitting || targets.length === 0}>
          {submitting && <Loader2 className="animate-spin" size={16} />}
          {t("common.apply")}
        </Button>
      </div>
    </form>
  );
}

function McpTab() {
  const { t } = useI18n();
  const local = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };
  const mcpDescription = (s: { id: string; description: string }) =>
    local(`catalog.mcp.${s.id}.description`, s.description);
  const targetLabel = useMcpTargetLabel();
  const { data, isLoading } = useQuery({ queryKey: ["mcp"], queryFn: ipc.listMcp });
  const [draft, setDraft] = useState<McpServer | null>(null);
  const [imported, setImported] = useState<{ target: McpTarget; list: McpServer[] } | null>(null);
  const [msg, setMsg] = useState<Msg>(null);

  const apply = useMutation({
    mutationFn: ({ server, targets }: { server: McpServer; targets: McpTarget[] }) =>
      ipc.applyMcp(server, targets),
    onSuccess: () => {
      setDraft(null);
      setMsg({ ok: true, text: t("market.mcpApplied") });
    },
    onError: (e) => setMsg({ ok: false, text: String(e) }),
  });
  const importM = useMutation({
    mutationFn: (t: McpTarget) => ipc.importMcp(t),
    onSuccess: (list, t) => {
      setImported({ target: t, list });
      setMsg(null);
    },
    onError: (e) => setMsg({ ok: false, text: String(e) }),
  });
  const removeM = useMutation({
    mutationFn: ({ name, targets }: { name: string; targets: McpTarget[] }) =>
      ipc.removeMcp(name, targets),
    onSuccess: (_v, vars) => {
      setMsg({ ok: true, text: t("market.removed") });
      importM.mutate(vars.targets[0]);
    },
    onError: (e) => setMsg({ ok: false, text: String(e) }),
  });

  const catalog = data ?? [];

  return (
    <div>
      <Banner msg={msg} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          onClick={() =>
            setDraft({ id: "", name: "", description: "", command: "npx", args: [], env: {} })
          }
        >
          <Plus size={16} /> {t("market.addMcp")}
        </Button>
        <span className="ml-2 text-xs text-slate-400">{t("market.importExisting")}</span>
        {MCP_TARGETS.map((t) => (
          <Button key={t.key} variant="default" disabled={importM.isPending} onClick={() => importM.mutate(t.key)}>
            <PackageSearch size={14} /> {targetLabel(t.key)}
          </Button>
        ))}
      </div>

      {imported && (
        <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 text-xs font-semibold text-slate-500">
            {t("market.configuredMcp", {
              target: targetLabel(imported.target),
              count: imported.list.length,
            })}
          </div>
          {imported.list.length === 0 ? (
            <div className="text-sm text-slate-400">{t("common.none")}</div>
          ) : (
            <div className="space-y-2">
              {imported.list.map((s) => (
                <div
                  key={s.name}
                  className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-800">{s.name}</div>
                    <div className="truncate font-mono text-xs text-slate-400">
                      {s.command} {s.args.join(" ")}
                    </div>
                  </div>
                  <Button
                    variant="danger"
                    disabled={removeM.isPending}
                    onClick={() => removeM.mutate({ name: s.name, targets: [imported.target] })}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-slate-500">{t("common.loading")}</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {catalog.map((s) => (
            <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-800">{s.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{mcpDescription(s)}</div>
                  <div className="mt-1 truncate font-mono text-xs text-slate-400">
                    {s.command} {s.args.join(" ")}
                  </div>
                </div>
                <Button variant="default" onClick={() => setDraft(s)}>
                  <Settings2 size={16} /> {t("common.configure")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={draft !== null} title={t("market.configureMcp")} onClose={() => setDraft(null)}>
        {draft && (
          <McpForm
            initial={draft}
            submitting={apply.isPending}
            onApply={(server, targets) => apply.mutate({ server, targets })}
          />
        )}
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
    mutationFn: () => {
      localStorage.setItem("catalogUrl", url);
      return ipc.refreshCatalog(url);
    },
    onSuccess: (text) => {
      setMsg({ ok: true, text });
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.invalidateQueries({ queryKey: ["mcp"] });
    },
    onError: (e) => setMsg({ ok: false, text: String(e) }),
  });

  return (
    <>
      <PageHeader
        title={t("market.title")}
        description={t("market.description")}
        actions={
          <>
            <input
              className="w-56 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-500"
              placeholder={t("market.catalogPlaceholder")}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <Button variant="default" disabled={refresh.isPending} onClick={() => refresh.mutate()}>
              <RefreshCw size={16} className={refresh.isPending ? "animate-spin" : ""} />
              {t("market.refreshOnline")}
            </Button>
          </>
        }
      />
      <div className="px-8 py-6">
        <div className="mb-5 inline-flex rounded-lg border border-slate-200 bg-white p-1">
          {(["skills", "mcp"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                tab === t ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100",
              )}
            >
              {t === "skills" ? "Skills" : "MCP"}
            </button>
          ))}
        </div>

        <Banner msg={msg} />

        {tab === "skills" ? <SkillsTab /> : <McpTab />}
      </div>
    </>
  );
}
