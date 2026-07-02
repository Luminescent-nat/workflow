import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Download, Trash2, Copy, Users, Terminal } from "lucide-react";
import clsx from "clsx";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/Button";
import { ipc, type RolePack } from "@/ipc";
import { useI18n } from "@/i18n";

type Msg = { ok: boolean; text: string } | null;
type RoleTarget = "claude" | "codex";

const scopeFor = (target: RoleTarget) => (target === "claude" ? "global" : "codex-global");
const targetLabel = (target: RoleTarget) => (target === "claude" ? "Claude" : "Codex");
const targetApplied = (pack: RolePack, target: RoleTarget) =>
  target === "claude" ? pack.claude_applied : pack.codex_applied;

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
        active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500",
      )}
    >
      {active && <CheckCircle2 size={12} />}
      {label}
    </span>
  );
}

function RoleListItem({
  pack,
  selected,
  onSelect,
}: {
  pack: RolePack;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useI18n();
  const local = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };
  const packName = local(`catalog.role.${pack.id}.name`, pack.name);
  const packDescription = local(`catalog.role.${pack.id}.description`, pack.description);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={clsx(
        "w-full rounded-lg border bg-white p-3 text-left transition-colors",
        selected ? "border-slate-900 ring-1 ring-slate-300" : "border-slate-200 hover:bg-slate-50",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Users size={16} className="shrink-0 text-slate-400" />
        <span className="min-w-0 truncate text-sm font-semibold text-slate-800">{packName}</span>
      </div>
      <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{packDescription}</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <StatusPill
          active={pack.claude_applied}
          label={t(pack.claude_applied ? "roles.targetApplied" : "roles.targetNotApplied", {
            target: "Claude",
          })}
        />
        <StatusPill
          active={pack.codex_applied}
          label={t(pack.codex_applied ? "roles.targetApplied" : "roles.targetNotApplied", {
            target: "Codex",
          })}
        />
      </div>
      <div className="mt-2 text-xs text-slate-400">
        {pack.agents.length} agents · {pack.commands.length} commands · {pack.memory ? t("roles.memory") : t("roles.noMemory")}
      </div>
    </button>
  );
}

function RoleDetails({
  pack,
  busy,
  onApply,
  onRemove,
}: {
  pack: RolePack | null;
  busy: boolean;
  onApply: (target: RoleTarget) => void;
  onRemove: (target: RoleTarget) => void;
}) {
  const { t } = useI18n();
  const local = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };
  if (!pack) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
        {t("roles.noPacks")}
      </div>
    );
  }
  const packName = local(`catalog.role.${pack.id}.name`, pack.name);
  const packDescription = local(`catalog.role.${pack.id}.description`, pack.description);
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-slate-900">{packName}</h2>
          <StatusPill
            active={pack.claude_applied}
            label={t(pack.claude_applied ? "roles.targetApplied" : "roles.targetNotApplied", {
              target: "Claude",
            })}
          />
          <StatusPill
            active={pack.codex_applied}
            label={t(pack.codex_applied ? "roles.targetApplied" : "roles.targetNotApplied", {
              target: "Codex",
            })}
          />
        </div>
        <p className="mt-1 text-sm leading-6 text-slate-600">{packDescription}</p>
      </div>

      <div className="grid gap-4 border-b border-slate-200 p-5 lg:grid-cols-2">
        {(["claude", "codex"] as const).map((target) => (
          <div key={target} className="rounded-lg border border-slate-200 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-800">{targetLabel(target)}</div>
              <StatusPill
                active={targetApplied(pack, target)}
                label={targetApplied(pack, target) ? t("roles.applied") : t("roles.notApplied")}
              />
            </div>
            <div className="mb-3 rounded bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
              {t("roles.writeTarget", {
                home: target === "claude" ? "~/.claude" : "~/.codex",
                memory: pack.memory
                  ? t("roles.memorySuffix", {
                      file: target === "claude" ? "CLAUDE.md" : "AGENTS.md",
                    })
                  : "",
              })}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                className="justify-center"
                variant="primary"
                disabled={busy}
                onClick={() => onApply(target)}
              >
                <Download size={16} /> {t("common.apply")}
              </Button>
              <Button
                className="justify-center"
                variant="danger"
                disabled={busy}
                onClick={() => onRemove(target)}
              >
                <Trash2 size={16} /> {t("common.remove")}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 p-5 xl:grid-cols-2">
        <section className="min-w-0">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Agents
          </h3>
          <div className="space-y-2">
            {pack.agents.map((a) => (
              <div key={a.name} className="rounded-lg bg-slate-50 px-3 py-2">
                <div className="break-all font-mono text-xs font-semibold text-slate-700">{a.name}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="min-w-0">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Commands
          </h3>
          {pack.commands.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-400">
              {t("roles.noCommands")}
            </div>
          ) : (
            <div className="space-y-2">
              {pack.commands.map((c) => (
                <div key={c.name} className="rounded-lg bg-indigo-50 px-3 py-2">
                  <div className="break-all font-mono text-xs font-semibold text-indigo-700">/{c.name}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function Roles() {
  const { t } = useI18n();
  const local = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["roles"], queryFn: ipc.listRoles });
  const [msg, setMsg] = useState<Msg>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["roles"] });
  const apply = useMutation({
    mutationFn: ({ id, target }: { id: string; target: RoleTarget }) =>
      ipc.applyRole(id, scopeFor(target)),
    onSuccess: (_v, vars) => {
      setMsg({
        ok: true,
        text:
          vars.target === "claude"
            ? t("roles.applyClaudeSuccess")
            : t("roles.applyCodexSuccess"),
      });
      invalidate();
    },
    onError: (e) => setMsg({ ok: false, text: String(e) }),
  });
  const remove = useMutation({
    mutationFn: ({ id, target }: { id: string; target: RoleTarget }) =>
      ipc.removeRole(id, scopeFor(target)),
    onSuccess: () => {
      setMsg({ ok: true, text: t("roles.removed") });
      invalidate();
    },
    onError: (e) => setMsg({ ok: false, text: String(e) }),
  });
  const busy = apply.isPending || remove.isPending;

  const copy = async (cmd: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      setMsg({ ok: true, text: t("roles.copySuccess") });
    } catch {
      setMsg({ ok: false, text: t("roles.copyFailed") });
    }
  };

  const packs = data?.packs ?? [];
  const installers = data?.installers ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedPack = packs.find((p) => p.id === selectedId) ?? packs[0] ?? null;

  return (
    <>
      <PageHeader
        title={t("roles.title")}
        description={t("roles.description")}
      />
      <div className="overflow-x-hidden px-8 py-6">
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
          <div className="text-sm text-slate-500">{t("common.loading")}</div>
        ) : (
          <>
            <div className="grid max-w-7xl gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
              <aside className="min-w-0">
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {t("roles.customPacks")}
                </h2>
                <div className="space-y-2">
                  {packs.map((p) => (
                    <RoleListItem
                      key={p.id}
                      pack={p}
                      selected={selectedPack?.id === p.id}
                      onSelect={() => setSelectedId(p.id)}
                    />
                  ))}
                </div>
              </aside>
              <RoleDetails
                pack={selectedPack}
                busy={busy}
                onApply={(target) => {
                  if (!selectedPack) return;
                  setMsg(null);
                  apply.mutate({ id: selectedPack.id, target });
                }}
                onRemove={(target) => {
                  if (!selectedPack) return;
                  setMsg(null);
                  remove.mutate({ id: selectedPack.id, target });
                }}
              />
            </div>

            <h2 className="mb-2 mt-8 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {t("roles.officialFrameworks")}
            </h2>
            <div className="w-full max-w-5xl space-y-2">
              {installers.map((it) => (
                <div
                  key={it.id}
                  className="flex min-w-0 flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800">{it.name}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {local(`catalog.installer.${it.id}.description`, it.description)}
                    </div>
                    <div className="mt-1 flex items-center gap-1 truncate font-mono text-xs text-slate-400">
                      <Terminal size={12} /> {it.command}
                    </div>
                  </div>
                  <Button variant="default" onClick={() => copy(it.command)}>
                    <Copy size={16} /> {t("common.copy")}
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
