export default function VoiceWave({ className = "" }: { className?: string }) {
  const bar = (delay: string) => (
    <span
      style={{
        display: "block",
        width: 2,
        borderRadius: 2,
        background: "rgba(255,255,255,0.6)",
        animation: `voice-wave 1s ease-in-out infinite`,
        animationDelay: delay,
      }}
    />
  );

  return (
    <span
      className={className}
      aria-hidden
      style={{
        display: "inline-flex",
        width: 18,
        height: 18,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.18)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        flexShrink: 0,
      }}
    >
      {bar("0s")}
      {bar("0.2s")}
      {bar("0.4s")}
    </span>
  );
}
