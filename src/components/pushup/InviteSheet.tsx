import { useState } from "react";
import { Check, Copy, MessageCircle, Share2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface InviteSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamName: string;
  onTeamNameChange: (name: string) => void;
  inviteCode: string;
}

export function InviteSheet({
  open,
  onOpenChange,
  teamName,
  onTeamNameChange,
  inviteCode,
}: InviteSheetProps) {
  const [copied, setCopied] = useState(false);
  const [draftName, setDraftName] = useState(teamName);

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const link = `${origin}/join/${inviteCode}`;
  const message = `Join my push-up challenge team "${draftName || teamName}" on Push Daily — ${link}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Invite link copied");
    } catch {
      toast.error("Couldn't copy — select the link and copy manually.");
    }
  }

  async function share() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Push Daily", text: message, url: link });
        return;
      } catch {
        /* user dismissed the share sheet */
      }
    }
    void copyLink();
  }

  function saveName() {
    const next = draftName.trim();
    if (!next) return;
    onTeamNameChange(next);
    toast.success(`Team renamed to ${next}`);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) setDraftName(teamName);
        onOpenChange(next);
      }}
    >
      <SheetContent side="bottom" className="rounded-t-3xl border-border">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2 text-foreground">
            <Users className="size-5 text-primary" aria-hidden="true" />
            Invite friends
          </SheetTitle>
          <SheetDescription>
            Share your link to start a team — you all see each other's daily progress.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-2">
          <label htmlFor="team-name" className="text-sm font-medium text-muted-foreground">
            Team name
          </label>
          <div className="flex gap-2">
            <Input
              id="team-name"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              maxLength={30}
              className="h-11"
            />
            <Button variant="secondary" className="h-11 shrink-0" onClick={saveName}>
              Save
            </Button>
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <span className="text-sm font-medium text-muted-foreground">Invite link</span>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-3">
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
              {link}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 shrink-0"
              aria-label="Copy invite link"
              onClick={copyLink}
            >
              {copied ? (
                <Check className="size-4 text-success" aria-hidden="true" />
              ) : (
                <Copy className="size-4" aria-hidden="true" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Code <span className="font-semibold tabular-nums text-foreground">{inviteCode}</span> —
            friends can also enter this manually.
          </p>
        </div>

        <div className="mt-6 space-y-2">
          <Button className="h-12 w-full rounded-full text-base font-bold" onClick={share}>
            <Share2 className="size-5" aria-hidden="true" />
            Share invite
          </Button>
          <Button
            variant="outline"
            className="h-12 w-full rounded-full text-base font-semibold"
            asChild
          >
            <a href={`sms:?&body=${encodeURIComponent(message)}`}>
              <MessageCircle className="size-5" aria-hidden="true" />
              Send as message
            </a>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
