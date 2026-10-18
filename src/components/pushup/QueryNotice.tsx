import { Button } from "@/components/ui/button";

export function QueryNotice({ failed, retry }: { failed: boolean; retry: () => void }) {
  if (!failed) return null;
  return (
    <div
      role="alert"
      className="my-3 flex items-center justify-between gap-3 text-sm text-destructive"
    >
      <span>Some details could not load.</span>
      <Button variant="outline" size="sm" onClick={retry}>
        Retry
      </Button>
    </div>
  );
}
