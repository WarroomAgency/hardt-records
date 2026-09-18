"use server";
import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/supabase/server";

export async function addUser(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "member") === "admin" ? "admin" : "member";
  if (!email || !email.includes("@")) return;
  const { supabase, role: myRole } = await getViewer();
  if (myRole !== "admin") return;
  await supabase.from("allowed_users").insert({ email, role });
  revalidatePath("/admin");
}

export async function removeUser(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const { supabase, user, role: myRole } = await getViewer();
  if (myRole !== "admin" || !email || email === user?.email?.toLowerCase()) return;
  await supabase.from("allowed_users").delete().ilike("email", email);
  revalidatePath("/admin");
}
