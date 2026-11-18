import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth as authenticate } from "@/integrations/supabase/auth-middleware";
import { localToday } from "@/lib/local-date";

/** Synchronize the authenticated browser calendar before any personal operation. */
export const requireSupabaseAuth = createMiddleware({ type: "function" })
  .middleware([authenticate])
  .server(async ({ next, context }) => {
    const timezone = getRequest().headers.get("x-personal-timezone");
    const { data, error } = await context.supabase.rpc(
      "sync_personal_calendar",
      timezone ? { p_timezone: timezone } : {},
    );
    if (error) throw new Error(error.message);
    const calendarTimezone = typeof data === "string" ? data : "UTC";
    return next({
      context: {
        calendarTimezone,
        calendarToday: localToday(new Date(), calendarTimezone),
      },
    });
  });
