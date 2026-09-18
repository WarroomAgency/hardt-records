import { redirect } from "next/navigation";
import { getViewer } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { addUser, removeUser } from "./actions";

export default async function AdminPage() {
  const { supabase, user, role } = await getViewer();
  if (role !== "admin") redirect("/");
  const { data } = await supabase.from("allowed_users").select("*").order("added_at", { ascending: true });
  const rows = (data ?? []) as { email: string; role: string; added_at: string }[];

  return (
    <>
      <PageHeader eyebrow="Team" title="Who can sign in" line="Add an email here first, then they create their own password on the sign-in page." />

      <form action={addUser} className="card p-4 mb-5 grid gap-3 md:grid-cols-[1fr_160px_auto]">
        <input className="input" name="email" type="email" required placeholder="name@company.com" aria-label="Email to add" />
        <select className="input" name="role" defaultValue="member" aria-label="Role">
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <button className="btn btn-primary">Add to team</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="data">
          <thead><tr><th>Email</th><th>Role</th><th>Added</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.email}>
                <td>{r.email}{r.email.toLowerCase() === user?.email?.toLowerCase() && <span className="text-gray"> (you)</span>}</td>
                <td className="capitalize">{r.role}</td>
                <td className="text-gray whitespace-nowrap">{fmtDate(r.added_at)}</td>
                <td className="text-right">
                  {r.email.toLowerCase() !== user?.email?.toLowerCase() && (
                    <form action={removeUser}>
                      <input type="hidden" name="email" value={r.email} />
                      <button className="btn btn-danger">Remove</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
