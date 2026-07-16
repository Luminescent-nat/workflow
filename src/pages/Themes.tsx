import { useEffect, useState } from "react";
import { Command } from "@tauri-apps/plugin-shell";
import { resourceDir, join } from "@tauri-apps/api/path";
import { Paintbrush, RotateCcw, Loader2, CheckCircle2, AlertCircle, Palette } from "lucide-react";
import clsx from "clsx";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/Button";
import { useI18n } from "@/i18n";

interface ThemeMeta {
  id: string;
  name: string;
  description?: string;
  preview?: { accent: string; surface: string; ink: string };
}

type Msg = { ok: boolean; text: string } | null;

function Banner({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <div
      className={clsx(
        "mb-4 rounded-xl border px-4 py-2.5 text-xs animate-fade-in",
        msg.ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700",
      )}
    >
      {msg.text}
    </div>
  );
}

function ThemePreview({ preview }: { preview?: ThemeMeta["preview"] }) {
  if (!preview) return null;
  return (
    <div className="flex items-center gap-2">
      <div className="flex overflow-hidden rounded-full border border-[var(--brand-200)]">
        <span className="block h-5 w-5" style={{ background: preview.accent }} />
        <span className="block h-5 w-5" style={{ background: preview.surface }} />
        <span className="block h-5 w-5" style={{ background: preview.ink }} />
      </div>
    </div>
  );
}

export default function Themes() {
  const { t } = useI18n();
  const [themes, setThemes] = useState<ThemeMeta[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [cliPath, setCliPath] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const res = await resourceDir();
        const cli = await join(res, "codex-theme-switcher", "dist", "cli.js");
        setCliPath(cli);
        const list = await listThemes(cli);
        setThemes(list);
      } catch (e) {
        setMsg({ ok: false, text: String(e) });
      }
    })();
  }, []);

  const listThemes = async (cli: string): Promise<ThemeMeta[]> => {
    const output = await runCli(cli, ["list"]);
    return JSON.parse(output) as ThemeMeta[];
  };

  const runCli = async (cli: string, args: string[]): Promise<string> => {
    const command = Command.create("node", [cli, ...args]);
    const result = await command.execute();
    if (result.code !== 0) {
      throw new Error(result.stderr || `Command failed with code ${result.code}`);
    }
    return result.stdout;
  };

  const applyTheme = async () => {
    if (!selected || selected === "default") {
      setMsg({ ok: false, text: t("themes.selectFirst") });
      return;
    }
    if (!cliPath) {
      setMsg({ ok: false, text: "CLI not ready" });
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const output = await runCli(cliPath, ["apply", selected, "--restart-existing"]);
      const parsed = JSON.parse(output);
      setMsg({ ok: true, text: t("themes.applied", { name: themes.find((t) => t.id === selected)?.name ?? selected }) });
      console.log("[themes] apply result:", parsed);
    } catch (e) {
      setMsg({ ok: false, text: String(e) });
    } finally {
      setLoading(false);
    }
  };

  const removeTheme = async () => {
    if (!cliPath) {
      setMsg({ ok: false, text: "CLI not ready" });
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      await runCli(cliPath, ["remove"]);
      setMsg({ ok: true, text: t("themes.restored") });
    } catch (e) {
      setMsg({ ok: false, text: String(e) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeader title={t("themes.title")} description={t("themes.description")} />
      <div className="space-y-4 px-6 py-5">
        <Banner msg={msg} />

        <div className="surface-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--brand-100)] text-[var(--brand-500)]">
              <Palette size={14} />
            </div>
            <div className="text-sm font-semibold text-[var(--brand-900)]">{t("themes.select")}</div>
          </div>

          <div className="mb-3 text-xs text-[var(--brand-500)]">{t("themes.help")}</div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              className="form-input max-w-md"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">{t("themes.choose")}</option>
              {themes.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {theme.name}
                </option>
              ))}
            </select>
            <ThemePreview preview={themes.find((t) => t.id === selected)?.preview} />
          </div>

          {selected && (
            <div className="mt-3 text-xs text-[var(--brand-500)]">
              {themes.find((t) => t.id === selected)?.description}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="default" size="sm" disabled={loading || !selected} onClick={applyTheme}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Paintbrush size={14} />}
              {t("themes.apply")}
            </Button>
            <Button variant="ghost" size="sm" disabled={loading} onClick={removeTheme}>
              <RotateCcw size={14} />
              {t("themes.restore")}
            </Button>
          </div>
        </div>

        <div className="surface-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--brand-100)] text-[var(--brand-500)]">
              <CheckCircle2 size={14} />
            </div>
            <div className="text-sm font-semibold text-[var(--brand-900)]">{t("themes.available")}</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {themes.map((theme) => (
              <button
                key={theme.id}
                onClick={() => setSelected(theme.id)}
                className={clsx(
                  "flex items-center gap-3 rounded-xl border p-3 text-left transition-all",
                  selected === theme.id
                    ? "border-[var(--accent-500)] bg-[var(--accent-50)]"
                    : "border-[var(--brand-200)] bg-white hover:border-[var(--brand-300)]",
                )}
              >
                <ThemePreview preview={theme.preview} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-[var(--brand-800)]">{theme.name}</div>
                  <div className="truncate text-[11px] text-[var(--brand-400)]">{theme.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="surface-card p-4">
          <div className="mb-2 flex items-start gap-2 text-xs text-[var(--brand-500)]">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-[var(--brand-700)]">{t("themes.safety.title")}</p>
              <p className="mt-1">{t("themes.safety.body")}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
