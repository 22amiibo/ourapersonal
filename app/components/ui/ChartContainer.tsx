type ChartContainerProps = {
  title: string;
  value?: string;
  meta?: string;
  children: React.ReactNode;
};

export default function ChartContainer({ title, value, meta, children }: ChartContainerProps) {
  return (
    <section className="rounded-card border border-line bg-surface p-4 shadow-card">
      <header className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="text-[11px] font-medium uppercase tracking-wider text-ink-3">{title}</h2>
          {value && <p className="mt-1 font-mono text-xl font-medium tabular-nums text-ink">{value}</p>}
        </div>
        {meta && <span className="text-xs text-ink-2">{meta}</span>}
      </header>
      {children}
    </section>
  );
}