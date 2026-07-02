import { redirect } from "next/navigation";

// Trends is now the Health tab (category browser + /health/[category]
// details). Old links and muscle memory land safely.
export default function TrendsPage() {
  redirect("/health");
}
