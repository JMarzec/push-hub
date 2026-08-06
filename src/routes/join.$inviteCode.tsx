import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { joinTeam } from "@/lib/teams.functions";

export const Route = createFileRoute("/join/$inviteCode")({
  head: ({ params }) => ({
    meta: [
      { title: `Join the push-up team — code ${params.inviteCode}` },
      {
        name: "description",
        content:
          "You have been invited to a Push Daily team. Create a free account or sign in to join, get daily push-up targets and share the streak.",
      },
      { property: "og:title", content: "You're invited to a Push Daily team" },
      {
        property: "og:description",
        content:
          "Create a free account or sign in to join the team and start hitting daily push-up targets together.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const { inviteCode } = Route.useParams();
  const session = useSession();
  const navigate = useNavigate();
  const joining = useRef(false);
  const [teamName, setTeamName] = useState<string | null>(null);

  // Show who invited them before sign-in.
  useEffect(() => {
    let cancelled = false;
    void supabase
      .rpc("team_preview_by_code", { _code: inviteCode })
      .then(({ data }) => {
        const row = Array.isArray(data) ? data[0] : null;
        if (!cancelled && row) setTeamName(row.team_name);
      });
    return () => {
      cancelled = true;
    };
  }, [inviteCode]);

  // Once signed in, accept the invite, then land on the squad screen.
  useEffect(() => {
    if (!session || joining.current) return;
    joining.current = true;
    void (async () => {
      try {
        await joinTeam({ data: { code: inviteCode } });
        toast.success("You're in! Welcome to the squad.");
        void navigate({ to: "/squad", replace: true });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not join that team.");
        void navigate({ to: "/today", replace: true });
      }
    })();
  }, [session, inviteCode, navigate]);

  return (
    <main className="flex min-h-screen flex-col justify-center bg-foreground px-5 py-12 text-card">
      <div className="mx-auto w-full max-w-sm text-center">
        <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-primary">
          <Users className="size-7 text-primary-foreground" aria-hidden="true" />
        </span>
        <h1 className="mt-6 text-3xl font-bold leading-tight">
          {teamName ? `You're invited to ${teamName}` : "You're invited to a team"}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-card/70">
          Invite code{" "}
          <span className="font-mono font-semibold text-card">{inviteCode}</span>. Create a free
          account or sign in to join — only registered members can log push-ups.
        </p>

        <div className="mt-7 space-y-2">
          <Button asChild className="h-13 w-full rounded-full py-4 text-base font-bold">
            <Link to="/auth" search={{ redirect: `/join/${inviteCode}` }}>
              Create account &amp; join
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            className="h-12 w-full rounded-full text-base font-semibold text-card hover:bg-card/10 hover:text-card"
          >
            <Link to="/auth" search={{ redirect: `/join/${inviteCode}` }}>
              Sign in to join
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
