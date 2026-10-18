import type { QueryClient } from "@tanstack/react-query";

export async function refreshProgress(client: QueryClient) {
  await Promise.all(
    ["today", "stats", "team", "day-logs", "plans"].map((key) =>
      client.invalidateQueries({ queryKey: [key] }),
    ),
  );
}
