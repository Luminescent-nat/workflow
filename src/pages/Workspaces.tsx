import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Play,
  Pencil,
  Trash2,
  Loader2,
  FileDown,
  FolderKanban,
  MessageSquare,
} from "lucide-react";
import clsx from "clsx";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import { ipc, type Workspace, type Provider, type RolePack, type SkillItem, type SessionInfo } from "@/ipc";
import { useI18n } from "@/i18n";

type Msg = { ok: boolean; text: string } | null;

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500";

// 新建工作区默认推荐配置:预选全流程团队角色 + 常用 skills,降低新人上手门槛
const emptyWs = (): Workspace => ({
  id: "",
  name: "",
  project_path: "",
  tool: "claude",
  provider_id: null,
  claude_provider_id: null,
  codex_provider_id: null,
  model: null,
  skills: ["code-reviewer", "git-commit", "debugging"],
  role_id: "fullstack-team",
});

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

function WorkspaceForm({
  draft,
  providers,
  roles,
  skills,
  submitting,
  onChange,
  onSubmit,
}: {
  draft: Workspace;
  providers: Provider[];
  roles: RolePack[];
  skills: SkillItem[];
  submitting: boolean;
  onChange: (w: Workspace) => void;
  onSubmit: () => void;
}) {
  const { t } = useI18n();
  const local = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };
  const set = (patch: Partial<Workspace>) => onChange({ ...draft, ...patch });
  const claudeProvs = providers.filter((p) => p.tool === "claude");
  const codexProvs = providers.filter((p) => p.tool === "codex");
  const showClaude = draft.tool === "claude" || draft.tool === "both";
  const showCodex = draft.tool === "codex" || draft.tool === "both";
  // 引导:检测可能让新人卡住的缺配置
  const noClaudeProv = showClaude && claudeProvs.length === 0;
  const noCodexProv = showCodex && codexProvs.length === 0;
  const claudeUnset = showClaude && claudeProvs.length > 0 && !draft.claude_provider_id;
  const codexUnset = showCodex && codexProvs.length > 0 && !draft.codex_provider_id;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="space-y-3"
    >
      {(noClaudeProv || noCodexProv) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {noClaudeProv && <div>{t("workspaces.noClaudeProvider")}</div>}
          {noCodexProv && <div>{t("workspaces.noCodexProvider")}</div>}
        </div>
      )}
      {(claudeUnset || codexUnset) && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
          {t("workspaces.globalProviderHelp")}
        </div>
      )}
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">{t("workspaces.name")}</span>
        <input className={inputCls} value={draft.name} onChange={(e) => set({ name: e.target.value })} required />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">{t("workspaces.projectPath")}</span>
        <div className="flex gap-2">
          <input
            className={inputCls}
            value={draft.project_path}
            onChange={(e) => set({ project_path: e.target.value })}
            required
            placeholder="D:\\path\\to\\project"
          />
          <Button
            type="button"
            variant="default"
            onClick={async () => {
              const dir = await ipc.pickDirectory(draft.project_path || undefined);
              if (dir) set({ project_path: dir });
            }}
          >
            {t("common.browse")}
          </Button>
        </div>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">{t("workspaces.tool")}</span>
        <select
          className={inputCls}
          value={draft.tool}
          onChange={(e) => set({ tool: e.target.value as Workspace["tool"] })}
        >
          <option value="claude">Claude</option>
          <option value="codex">Codex</option>
          <option value="both">{t("common.both")}</option>
        </select>
      </label>
      {showClaude && (
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">{t("workspaces.claudeProvider")}</span>
          <select
            className={inputCls}
            value={draft.claude_provider_id ?? ""}
            onChange={(e) => set({ claude_provider_id: e.target.value || null })}
          >
            <option value="">{t("common.globalDefault")}</option>
            {claudeProvs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {showCodex && (
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">{t("workspaces.codexProvider")}</span>
          <select
            className={inputCls}
            value={draft.codex_provider_id ?? ""}
            onChange={(e) => set({ codex_provider_id: e.target.value || null })}
          >
            <option value="">{t("common.globalDefault")}</option>
            {codexProvs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">{t("workspaces.modelOptional")}</span>
        <input
          className={inputCls}
          value={draft.model ?? ""}
          onChange={(e) => set({ model: e.target.value || null })}
          placeholder={t("workspaces.modelPlaceholder")}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">{t("workspaces.roleOptional")}</span>
        <select
          className={inputCls}
          value={draft.role_id ?? ""}
          onChange={(e) => set({ role_id: e.target.value || null })}
        >
          <option value="">{t("common.doNotApply")}</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {local(`catalog.role.${r.id}.name`, r.name)}
            </option>
          ))}
        </select>
      </label>
      {skills.length > 0 && (
        <div>
          <span className="mb-1 block text-xs font-medium text-slate-600">
            {t("workspaces.skillsOptional")}
          </span>
          <div className="flex flex-wrap gap-2">
            {skills.map((s) => {
              const checked = draft.skills.includes(s.id);
              return (
                <label
                  key={s.id}
                  className="flex items-center gap-1.5 rounded border border-slate-200 px-2 py-1 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      set({
                        skills: checked
                          ? draft.skills.filter((x) => x !== s.id)
                          : [...draft.skills, s.id],
                      })
                    }
                  />
                  {local(`catalog.skill.${s.id}.name`, s.name)}
                </label>
              );
            })}
          </div>
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting && <Loader2 className="animate-spin" size={16} />}
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
}

function WorkspacesTab() {
  const { t } = useI18n();
  const local = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };
  const qc = useQueryClient();
  const { data: workspaces, isLoading } = useQuery({
    queryKey: ["workspaces"],
    queryFn: ipc.listWorkspaces,
  });
  const { data: claudeProv } = useQuery({
    queryKey: ["providers", "claude"],
    queryFn: () => ipc.listProviders("claude"),
  });
  const { data: codexProv } = useQuery({
    queryKey: ["providers", "codex"],
    queryFn: () => ipc.listProviders("codex"),
  });
  const { data: rolesView } = useQuery({ queryKey: ["roles"], queryFn: ipc.listRoles });
  const { data: skillList } = useQuery({ queryKey: ["skills"], queryFn: ipc.listSkills });
  const [draft, setDraft] = useState<Workspace | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);

  const providers = [...(claudeProv ?? []), ...(codexProv ?? [])];
  const roles = rolesView?.packs ?? [];
  const skills = skillList ?? [];
  const invalidate = () => qc.invalidateQueries({ queryKey: ["workspaces"] });

  const upsert = useMutation({
    mutationFn: (w: Workspace) => ipc.upsertWorkspace(w),
    onSuccess: () => {
      setDraft(null);
      invalidate();
    },
    onError: (e) => setMsg({ ok: false, text: String(e) }),
  });
  const del = useMutation({
    mutationFn: (id: string) => ipc.deleteWorkspace(id),
    onSuccess: () => {
      setConfirmId(null);
      invalidate();
    },
    onError: (e) => setMsg({ ok: false, text: String(e) }),
  });
  const launch = useMutation({
    mutationFn: ({ id, tool }: { id: string; tool: string }) => ipc.launchWorkspace(id, tool),
    onSuccess: () => setMsg({ ok: true, text: t("workspaces.launchSuccess") }),
    onError: (e) => setMsg({ ok: false, text: String(e) }),
  });

  const list = workspaces ?? [];
  const provName = (id: string | null) => providers.find((p) => p.id === id)?.name;
  const roleName = (id: string | null) => {
    const role = roles.find((r) => r.id === id);
    return role ? local(`catalog.role.${role.id}.name`, role.name) : null;
  };
  const skillName = (id: string) => {
    const skill = skills.find((s) => s.id === id);
    return skill ? local(`catalog.skill.${skill.id}.name`, skill.name) : id;
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button variant="primary" onClick={() => setDraft(emptyWs())}>
          <Plus size={16} /> {t("workspaces.add")}
        </Button>
      </div>
      <Banner msg={msg} />
      {isLoading ? (
        <div className="text-sm text-slate-500">{t("common.loading")}</div>
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          {t("workspaces.empty")}
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((w) => (
            <div key={w.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">{w.name}</span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {w.tool}
                    </span>
                  </div>
                  <div className="mt-1 truncate font-mono text-xs text-slate-500">
                    {w.project_path}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-400">
                    {(w.tool === "claude" || w.tool === "both") &&
                      t("workspaces.providerLine", {
                        tool: "Claude",
                        provider:
                          provName(w.claude_provider_id ?? w.provider_id) ??
                          t("common.globalDefault"),
                      })}
                    {w.tool === "both" ? " · " : ""}
                    {(w.tool === "codex" || w.tool === "both") &&
                      t("workspaces.providerLine", {
                        tool: "Codex",
                        provider:
                          provName(w.codex_provider_id ?? w.provider_id) ??
                          t("common.globalDefault"),
                      })}
                    {w.model ? ` · ${w.model}` : ""}
                    {w.role_id
                      ? ` · ${t("workspaces.roleLine", {
                          role: roleName(w.role_id) ?? w.role_id,
                        })}`
                      : ""}
                  </div>
                  {w.skills.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {w.skills.map((id) => (
                        <span key={id} className="rounded bg-sky-50 px-2 py-0.5 text-xs text-sky-700">
                          {skillName(id)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  {(w.tool === "claude" || w.tool === "both") && (
                    <Button
                      variant="primary"
                      disabled={launch.isPending}
                      onClick={() => {
                        setMsg(null);
                        launch.mutate({ id: w.id, tool: "claude" });
                      }}
                    >
                      <Play size={16} /> Claude
                    </Button>
                  )}
                  {(w.tool === "codex" || w.tool === "both") && (
                    <Button
                      variant="primary"
                      disabled={launch.isPending}
                      onClick={() => {
                        setMsg(null);
                        launch.mutate({ id: w.id, tool: "codex" });
                      }}
                    >
                      <Play size={16} /> Codex
                    </Button>
                  )}
                  <Button variant="default" onClick={() => setDraft(w)}>
                    <Pencil size={16} />
                  </Button>
                  {confirmId === w.id ? (
                    <>
                      <Button variant="danger" disabled={del.isPending} onClick={() => del.mutate(w.id)}>
                        {t("common.confirmDelete")}
                      </Button>
                      <Button variant="ghost" onClick={() => setConfirmId(null)}>
                        {t("common.cancel")}
                      </Button>
                    </>
                  ) : (
                    <Button variant="danger" onClick={() => setConfirmId(w.id)}>
                      <Trash2 size={16} />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={draft !== null}
        title={draft?.id ? t("workspaces.editTitle") : t("workspaces.addTitle")}
        onClose={() => setDraft(null)}
      >
        {draft && (
          <WorkspaceForm
            draft={draft}
            providers={providers}
            roles={roles}
            skills={skillList ?? []}
            submitting={upsert.isPending}
            onChange={setDraft}
            onSubmit={() => upsert.mutate(draft)}
          />
        )}
      </Modal>
    </div>
  );
}

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function SessionsTab() {
  const { t } = useI18n();
  const [tool, setTool] = useState<"claude" | "codex">("claude");
  const { data: workspaces } = useQuery({
    queryKey: ["workspaces"],
    queryFn: ipc.listWorkspaces,
  });
  const workspaceList = workspaces ?? [];
  const [sessionSource, setSessionSource] = useState("global");
  const selectedWorkspace =
    sessionSource === "global"
      ? null
      : workspaceList.find((w) => w.id === sessionSource) ?? null;
  const configDir =
    selectedWorkspace == null
      ? undefined
      : `${selectedWorkspace.project_path}\\.aiconsole\\${tool === "claude" ? "claude-home" : "codex-home"}`;
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["sessions", tool, configDir],
    queryFn: () => ipc.listSessions(tool, configDir),
  });
  const [thinking, setThinking] = useState(false);
  const [confirmPath, setConfirmPath] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ session: SessionInfo; text: string } | null>(null);
  const [msg, setMsg] = useState<Msg>(null);

  const exportM = useMutation({
    mutationFn: async (s: SessionInfo) => {
      // 默认目录 = 该对话的工作目录(cwd);弹原生文件夹选择器供自选
      const dir = await ipc.pickExportDir(s.cwd ?? undefined);
      if (dir == null) return null; // 用户取消
      return ipc.exportSession(tool, s.path, thinking, dir);
    },
    onSuccess: (out) =>
      setMsg(out ? { ok: true, text: t("sessions.exported", { path: out }) } : null),
    onError: (e) => setMsg({ ok: false, text: String(e) }),
  });
  const del = useMutation({
    mutationFn: (path: string) => ipc.deleteSession(path),
    onSuccess: () => {
      setConfirmPath(null);
      setMsg({ ok: true, text: t("sessions.deleted") });
      refetch();
    },
    onError: (e) => setMsg({ ok: false, text: String(e) }),
  });
  const previewM = useMutation({
    mutationFn: (s: SessionInfo) => ipc.previewSession(tool, s.path, thinking),
    onSuccess: (text, s) => setPreview({ session: s, text }),
    onError: (e) => setMsg({ ok: false, text: String(e) }),
  });

  const list = data ?? [];

  useEffect(() => {
    if (isLoading) return;
    if (list.length === 0) {
      setPreview(null);
      return;
    }
    const current = preview?.session;
    const next = current && list.some((s) => s.path === current.path) ? current : list[0];
    previewM.mutate(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, isLoading, thinking, tool]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
          {(["claude", "codex"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTool(t)}
              className={clsx(
                "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                tool === t ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100",
              )}
            >
              {t === "claude" ? "Claude" : "Codex"}
            </button>
          ))}
        </div>
        <select
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-slate-500"
          value={sessionSource}
          onChange={(e) => {
            setPreview(null);
            setSessionSource(e.target.value);
          }}
        >
          <option value="global">{t("sessions.globalHistory")}</option>
          {workspaceList.map((w) => (
            <option key={w.id} value={w.id}>
              {t("sessions.workspaceSource", { name: w.name })}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={thinking} onChange={(e) => setThinking(e.target.checked)} />
          {t("sessions.includeThinking")}
        </label>
        <span className="text-xs text-slate-400">
          {t("sessions.source")}
          {sessionSource === "global"
            ? tool === "claude"
              ? "~/.claude"
              : "~/.codex"
            : configDir}
        </span>
      </div>
      <Banner msg={msg} />
      {isLoading ? (
        <div className="text-sm text-slate-500">{t("common.loading")}</div>
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          {t("sessions.empty", { tool: tool === "claude" ? "Claude" : "Codex" })}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(360px,1fr)_minmax(380px,42%)]">
          <div className="max-h-[calc(100vh-230px)] min-h-[460px] space-y-2 overflow-auto pr-1">
            {list.map((s) => {
              const active = preview?.session.path === s.path;
              return (
                <div
                  key={s.path}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setMsg(null);
                    previewM.mutate(s);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setMsg(null);
                      previewM.mutate(s);
                    }
                  }}
                  className={clsx(
                    "cursor-pointer rounded-xl border bg-white p-3 transition-colors hover:bg-slate-50",
                    active ? "border-slate-500 ring-1 ring-slate-300" : "border-slate-200",
                  )}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-800">{s.title}</div>
                    <div className="text-xs text-slate-400">
                      {s.modified} · {fmtSize(s.size)}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      variant="default"
                      disabled={exportM.isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMsg(null);
                        exportM.mutate(s);
                      }}
                    >
                      {exportM.isPending && exportM.variables?.path === s.path ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        <FileDown size={16} />
                      )}
                      {t("sessions.exportMd")}
                    </Button>
                    {confirmPath === s.path ? (
                      <>
                        <Button
                          variant="danger"
                          disabled={del.isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            del.mutate(s.path);
                          }}
                        >
                          {t("common.confirmDelete")}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmPath(null);
                          }}
                        >
                          {t("common.cancel")}
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmPath(s.path);
                        }}
                      >
                        <Trash2 size={16} />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <aside className="h-[calc(100vh-230px)] min-h-[460px] overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex h-12 items-center justify-between border-b border-slate-200 px-4">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-800">
                  {preview?.session.title ?? t("sessions.previewTitle")}
                </div>
                {preview && (
                  <div className="truncate text-xs text-slate-400">{preview.session.path}</div>
                )}
              </div>
            </div>
            <div className="h-[calc(100%-3rem)] overflow-auto bg-slate-50 p-4">
              {preview ? (
                <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">
                  {preview.text || t("sessions.emptySession")}
                </pre>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">
                  {t("sessions.previewHint")}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

export default function Workspaces() {
  const { t } = useI18n();
  const [tab, setTab] = useState<"ws" | "sessions">("ws");
  return (
    <>
      <PageHeader
        title={t("workspaces.title")}
        description={t("workspaces.description")}
      />
      <div className="px-8 py-6">
        <div className="mb-5 inline-flex rounded-lg border border-slate-200 bg-white p-1">
          <button
            onClick={() => setTab("ws")}
            className={clsx(
              "flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              tab === "ws" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100",
            )}
          >
            <FolderKanban size={16} /> {t("workspaces.tab.workspaces")}
          </button>
          <button
            onClick={() => setTab("sessions")}
            className={clsx(
              "flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              tab === "sessions" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100",
            )}
          >
            <MessageSquare size={16} /> {t("workspaces.tab.sessions")}
          </button>
        </div>

        {tab === "ws" ? <WorkspacesTab /> : <SessionsTab />}
      </div>
    </>
  );
}
