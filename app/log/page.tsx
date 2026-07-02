import { redirect } from "next/navigation";

// Inputs merged into the Reflect tab — logging and journaling are one write
// surface now. Old links land safely.
export default function LogPage() {
  redirect("/reflect");
}
