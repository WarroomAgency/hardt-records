import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LiveRun, type LiveEvent, type RunRow } from "./live-run";

export default async function LiveRunPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const supabase = await createClient();
  const { data: run } = await supabase.from("runs").select("*").eq("id", id).maybeSingle();
  if (!run) notFound();
  const { data: events } = await supabase.from("events").select("id, ts, county, doc_type, doc_number, pdf_url, address, outcome, note")
    .eq("run_id", id).order("id", { ascending: true });
  return <LiveRun run={run as RunRow} initialEvents={(events ?? []) as LiveEvent[]} />;
}
