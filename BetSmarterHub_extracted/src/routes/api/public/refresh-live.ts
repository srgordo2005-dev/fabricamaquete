import { createFileRoute } from "@tanstack/react-router";
import { refreshLiveMatches } from "@/lib/server-fns/odds.functions";

export const Route = createFileRoute("/api/public/refresh-live")({
  server: {
    handlers: {
      POST: async () => {
        const result = await refreshLiveMatches();
        return new Response(JSON.stringify(result), {
          status: result.ok ? 200 : 500,
          headers: { "Content-Type": "application/json" },
        });
      },
      GET: async () => {
        const result = await refreshLiveMatches();
        return new Response(JSON.stringify(result), {
          status: result.ok ? 200 : 500,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
