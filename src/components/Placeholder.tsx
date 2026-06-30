interface Props {
  feature: string;
  points: string[];
}

export default function Placeholder({ feature, points }: Props) {
  return (
    <div className="px-8 py-6">
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6">
        <div className="text-sm font-medium text-slate-700">
          {feature} · 即将实现
        </div>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-500">
          {points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
