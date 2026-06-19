import { redirect } from "next/navigation";

export default function Home() {
  // Logged in -> dashboard (Today). Not logged in -> proxy.ts bounces to /login.
  redirect("/dashboard");
}
