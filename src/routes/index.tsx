import { useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Dumbbell, Flame, PiggyBank, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Push Daily — Daily push-up targets with friends" },
      {
        name: "description",
        content:
          "Set your own daily push-up target and how often you get it, log reps against a live progress ring, bank extra reps and take on the challenge with your friends.",
      },
      { property: "og:title", content: "Push Daily — Daily push-up targets with friends" },
      {
        property: "og:description",
        content:
          "Choose your daily push-up count and frequency, log reps, bank extras and challenge your friends.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: Flame,
    title: "Targets you control",
    body: "Pick your daily count and how many times a day you get a target — 1 big set or 6 small ones.",
  },
  {
    icon: PiggyBank,
    title: "Bank your extras",
    body: "Smashed today's number? Bank the surplus and spend it on a busy day later.",
  },
  {
    icon: Users,
    title: "Squad up",
    body: "Share one link, start a team and keep each other honest with streaks and stats.",
  },
];

function Landing() {
  const session = useSession();
  const navigate = useNavigate();

  // Signed-in members go straight to their ring.
  useEffect(() => {
    if (session) {
      const saved = sessionStorage.getItem("pushdaily:after-auth");
      sessionStorage.removeItem("pushdaily:after-auth");
      void navigate({
        to: saved && saved.startsWith("/") && !saved.startsWith("//") ? saved : "/today",
        replace: true,
      });
    }
  }, [session, navigate]);

  return (
    <div className="min-h-screen bg-foreground text-card">
      <main className="mx-auto flex max-w-md flex-col px-5 py-12">
        <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-primary">
          <Dumbbell className="size-7 text-primary-foreground" aria-hidden="true" />
        </span>
        <h1 className="mt-6 text-4xl font-bold leading-tight">
          Your push-up challenge, your rules.
        </h1>
        <p className="mt-3 text-base leading-relaxed text-card/70">
          Set the count, set the frequency, log reps as you go and bring your friends along for the
          streak.
        </p>

        <div className="mt-7 space-y-2">
          <Button asChild className="h-13 w-full rounded-full py-4 text-base font-bold">
            <Link to="/auth">Create your account</Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            className="h-12 w-full rounded-full text-base font-semibold text-card hover:bg-card/10 hover:text-card"
          >
            <Link to="/auth">I already have an account</Link>
          </Button>
        </div>

        <p className="mt-3 text-center text-xs text-card/50">
          An account is needed to log push-ups or join a team.
        </p>

        <ul className="mt-10 space-y-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-4 rounded-2xl bg-card/5 p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                <Icon className="size-5 text-primary" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-bold">{title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-card/70">{body}</p>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-10 text-xs leading-relaxed text-card/50">
          Push Daily is not medical advice. Consult your GP or physiotherapist before increasing
          exercise intensity.
        </p>
      </main>
    </div>
  );
}
