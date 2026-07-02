import { redirect } from "next/navigation";

// Observations merged into the Insights tab (Patterns segment) — one AI
// intelligence surface instead of two. Old links land in the right place.
export default function ObservationsPage() {
  redirect("/insights?tab=patterns");
}
