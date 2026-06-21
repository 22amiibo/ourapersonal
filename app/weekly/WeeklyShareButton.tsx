"use client";

type Props = {
  weekRange: string;
  sleep: string;
  readiness: string;
  hrv: string;
  note?: string;
};

export default function WeeklyShareButton({ weekRange, sleep, readiness, hrv, note }: Props) {
  const canShare = typeof navigator !== "undefined" && !!navigator.share;

  function share() {
    const lines = [
      `Weekly Report · ${weekRange}`,
      "",
      `Sleep avg:     ${sleep}`,
      `Readiness avg: ${readiness}`,
      `HRV avg:       ${hrv}`,
    ];
    if (note) lines.push("", `"${note}"`);
    const text = lines.join("\n");

    if (canShare) {
      navigator.share({ title: "Weekly Health Report", text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  }

  return (
    <button
      onClick={share}
      className="flex items-center gap-1.5 rounded-control border border-line px-3 py-1.5 text-[12px] font-medium text-ink-2 transition-colors hover:text-ink active:scale-95 min-h-[36px]"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
      Share
    </button>
  );
}
