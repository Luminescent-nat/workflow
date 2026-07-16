import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Download, Trash2, Copy, Users, Terminal, Shield, BookOpen, Command } from "lucide-react";
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
    <span className={clsx("pill", active ? "pill-success" : "pill-muted")}>
      {active && <CheckCircle2 size={9} />}
      {label}
    </span>
  );
}

function RoleListItem({ pack, selected, onSelect }: { pack: RolePack; selected: boolean; onSelect: () => void }) {
  const { t } = useI18n();
  const local = (key: string, fallback: string) => { const v = t(key); return v === key ? fallback : v; };
  return (
    <button
      type="button"
      onClick={onSelect}
      className={clsx(
        "surface-card w-full p-3.5 text-left transition-all duration-150",
        selected
          ? "border-[var(--accent-500)] ring-1 ring-[var(--accent-100)] shadow-sm"
          : "surface-card-hover",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-100)] text-[var(--brand-500)]">
          <Users size={13} />
        </div>
        <span className="min-w-0 truncate text-sm font-semibold text-[var(--brand-900)]">{local(`catalog.role.${pack.id}.name`, pack.name)}</span>
      </div>
      <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-[var(--brand-500)]">{local(`catalog.role.${pack.id}.description`, pack.description)}</div>
      <div className="mt-2 flex flex-wrap gap-1">
        <StatusPill active={pack.claude_applied} label={t(pack.claude_applied ? "roles.targetApplied" : "roles.targetNotApplied", { target: "Claude" })} />
        <StatusPill active={pack.codex_applied} label={t(pack.codex_applied ? "roles.targetApplied" : "roles.targetNotApplied", { target: "Codex" })} />
      </div>
      <div className="mt-1.5 text-[10px] font-medium text-[var(--brand-400)]">
        {pack.agents.length} agents · {pack.commands.length} commands · {pack.memory ? t("roles.memory") : t("roles.noMemory")}
      </div>
    </button>
  );
}

function RoleDetails({ pack, busy, onApply, onRemove }: {
  pack: RolePack | null; busy: boolean; onApply: (t: RoleTarget) => void; onRemove: (t: RoleTarget) => void;
}) {
  const { t } = useI18n();
  const local = (key: string, fallback: string) => { const v = t(key); return v === key ? fallback : v; };
  if (!pack) {
    return (
      <div className="empty-state">
        <Shield size={36} className="mb-2 text-[var(--brand-300)]" />
        {t("roles.noPacks")}
      </div>
    );
  }
  return (
    <div className="surface-card min-w-0 overflow-hidden">
      <div className="border-b border-[var(--brand-100)] px-5 py-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-100)] text-[var(--brand-600)]">
            <BookOpen size={16} />
          </div>
          <h2 className="text-sm font-semibold text-[var(--brand-900)]">{local(`catalog.role.${pack.id}.name`, pack.name)}</h2>
          <StatusPill active={pack.claude_applied} label={t(pack.claude_applied ? "roles.targetApplied" : "roles.targetNotApplied", { target: "Claude" })} />
          <StatusPill active={pack.codex_applied} label={t(pack.codex_applied ? "roles.targetApplied" : "roles.targetNotApplied", { target: "Codex" })} />
        </div>
        <p className="mt-1.5 text-xs leading-5 text-[var(--brand-600)]">{local(`catalog.role.${pack.id}.description`, pack.description)}</p>
      </div>

      <div className="grid gap-3 border-b border-[var(--brand-100)] p-5 lg:grid-cols-2">
        {(["claude", "codex"] as const).map((target) => (
          <div key={target} className="surface-card bg-[var(--brand-50)]/60 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[var(--brand-600)] shadow-xs">
                  <Command size={13} />
                </div>
                <div className="text-sm font-semibold text-[var(--brand-800)]">{targetLabel(target)}</div>
              </div>
              <StatusPill active={targetApplied(pack, target)} label={targetApplied(pack, target) ? t("roles.applied") : t("roles.notApplied")} />
            </div>
            <div className="mb-3 rounded-lg bg-white px-3 py-2 text-xs leading-5 text-[var(--brand-500)] shadow-xs">
              {t("roles.writeTarget", {
                home: target === "claude" ? "~/.claude" : "~/.codex",
                memory: pack.memory ? t("roles.memorySuffix", { file: target === "claude" ? "CLAUDE.md" : "AGENTS.md" }) : "",
              })}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button className="justify-center" variant="primary" size="sm" disabled={busy} onClick={() => onApply(target)}>
                <Download size={13} /> {t("common.apply")}
              </Button>
              <Button className="justify-center" variant="danger" size="sm" disabled={busy} onClick={() => onRemove(target)}>
                <Trash2 size={13} /> {t("common.remove")}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 p-5 xl:grid-cols-2">
        <section className="min-w-0">
          <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-400)]">
            <Users size={11} /> Agents
          </h3>
          <div className="space-y-1.5">
            {pack.agents.map((a) => (
              <div key={a.name} className="flex items-center gap-2 rounded-lg bg-[var(--brand-50)] px-3 py-2">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <div className="break-all font-mono text-xs font-semibold text-[var(--brand-700)]">{a.name}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="min-w-0">
          <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-400)]">
            <Terminal size={11} /> Commands
          </h3>
          {pack.commands.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--brand-200)] p-4 text-xs text-[var(--brand-400)]">{t("roles.noCommands")}</div>
          ) : (
            <div className="space-y-1.5">
              {pack.commands.map((c) => (
                <div key={c.name} className="flex items-center gap-2 rounded-lg bg-[var(--accent-50)] px-3 py-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent-500)]" />
                  <div className="break-all font-mono text-xs font-semibold text-[var(--accent-700)]">/{c.name}</div>
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
  const local = (key: string, fallback: string) => { const v = t(key); return v === key ? fallback : v; };
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["roles"], queryFn: ipc.listRoles });
  const [msg, setMsg] = useState<Msg>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["roles"] });
  const apply = useMutation({
    mutationFn: ({ id, target }: { id: string; target: RoleTarget }) => ipc.applyRole(id, scopeFor(target)),
    onSuccess: (_v, vars) => {
      setMsg({ ok: true, text: vars.target === "claude" ? t("roles.applyClaudeSuccess") : t("roles.applyCodexSuccess") });
      invalidate();
    },
    onError: (e) => setMsg({ ok: false, text: String(e) }),
  });
  const remove = useMutation({
    mutationFn: ({ id, target }: { id: string; target: RoleTarget }) => ipc.removeRole(id, scopeFor(target)),
    onSuccess: () => { setMsg({ ok: true, text: t("roles.removed") }); invalidate(); },
    onError: (e) => setMsg({ ok: false, text: String(e) }),
  });
  const busy = apply.isPending || remove.isPending;

  const copy = async (cmd: string) => {
    try { await navigator.clipboard.writeText(cmd); setMsg({ ok: true, text: t("roles.copySuccess") }); }
    catch { setMsg({ ok: false, text: t("roles.copyFailed") }); }
  };

  const packs = data?.packs ?? [];
  const installers = data?.installers ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedPack = packs.find((p) => p.id === selectedId) ?? packs[0] ?? null;

  return (
    <>
      <PageHeader title={t("roles.title")} description={t("roles.description")} />
      <div className="overflow-x-hidden px-6 py-5">
        {msg && (
          <div className={clsx("mb-4 rounded-xl border px-4 py-2.5 text-xs animate-fade-in", msg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700")}>
            {msg.text}
          </div>
        )}

        {isLoading ? (
          <div className="text-sm text-[var(--brand-500)]">{t("common.loading")}</div>
        ) : (
          <>
            <div className="grid max-w-7xl gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
              <aside className="min-w-0">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--brand-100)] text-[var(--brand-500)]"><Users size={13} /></div>
                  <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-400)]">{t("roles.customPacks")}</h2>
                  <div className="section-divider" />
                </div>
                <div className="space-y-2">
                  {packs.map((p) => (
                    <RoleListItem key={p.id} pack={p} selected={selectedPack?.id === p.id} onSelect={() => setSelectedId(p.id)} />
                  ))}
                </div>
              </aside>
              <RoleDetails
                pack={selectedPack}
                busy={busy}
                onApply={(target) => { if (!selectedPack) return; setMsg(null); apply.mutate({ id: selectedPack.id, target }); }}
                onRemove={(target) => { if (!selectedPack) return; setMsg(null); remove.mutate({ id: selectedPack.id, target }); }}
              />
            </div>

            <div className="mt-6">
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--brand-100)] text-[var(--brand-500)]"><Terminal size={13} /></div>
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-400)]">{t("roles.officialFrameworks")}</h2>
                <div className="section-divider" />
              </div>
              <div className="w-full max-w-5xl space-y-2">
                {installers.map((it) => (
                  <div key={it.id} className="surface-card surface-card-hover flex min-w-0 flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--brand-800)]">{it.name}</div>
                      <div className="mt-0.5 text-xs text-[var(--brand-500)]">{local(`catalog.installer.${it.id}.description`, it.description)}</div>
                      <div className="mt-1 flex items-center gap-1.5 truncate font-mono text-[11px] text-[var(--brand-400)]">
                        <div className="h-1.5 w-1.5 rounded-full bg-[var(--brand-300)]" />
                        {it.command}
                      </div>
                    </div>
                    <Button variant="default" size="sm" onClick={() => copy(it.command)}>
                      <Copy size={13} /> {t("common.copy")}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
