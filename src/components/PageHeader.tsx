import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

interface Props {
  title: string;
  description?: string;
  actions?: ReactNode;
  back?: () => void;
}

export default function PageHeader({ title, description, actions, back }: Props) {
  return (
    <div className="sticky top-0 z-20 flex items-center justify-between border-b border-[var(--brand-200)] bg-white/80 px-6 py-4 backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-3">
        {back && (
          <button
            onClick={back}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--brand-400)] transition-colors hover:bg-[var(--brand-100)] hover:text-[var(--brand-700)]"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold tracking-tight text-[var(--brand-900)]">
            {title}
          </h1>
          {description && (
            <p className="mt-0.5 truncate text-xs text-[var(--brand-500)]">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
