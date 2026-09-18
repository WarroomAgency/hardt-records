import { redirect } from "next/navigation";
import { getViewer } from "@/lib/supabase/server";
import { Nav } from "@/components/nav";
import { SignOutButton } from "./signout";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, allowed, role } = await getViewer();
  if (!user) redirect("/login");

  if (!allowed) {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="card p-8 max-w-md w-full text-center">
          <div className="eyebrow">HARDT Records</div>
          <h1 className="text-2xl mt-2">Access not set up yet</h1>
          <p className="text-gray mt-3">
            You are signed in as <span className="text-charcoal">{user.email}</span>, but this email has not been added to the team list.
            Ask Peter or Michael to add you, then sign in again.
          </p>
          <div className="mt-6"><SignOutButton /></div>
        </div>
      </main>
    );
  }

  return (
    <div className="flex-1 flex flex-col md:flex-row">
      <Nav email={user.email ?? ""} isAdmin={role === "admin"} />
      <main className="flex-1 min-w-0 px-5 py-6 md:px-10 md:py-10 max-w-[1240px]">{children}</main>
    </div>
  );
}
