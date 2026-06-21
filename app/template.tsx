// Templates remount on every navigation (unlike layout), so this gives each
// route a gentle enter transition. Honors prefers-reduced-motion via the
// global reduced-motion rule, which neutralizes the animation duration.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
