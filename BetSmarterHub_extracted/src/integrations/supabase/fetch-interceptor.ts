// Client-side fetch interceptor: attaches the current Supabase access token
// to all TanStack Start server-function requests (/_serverFn/*) so that
// `requireSupabaseAuth` middleware receives a Bearer token.
import { supabase } from "./client";

let installed = false;

export function installSupabaseFetchInterceptor() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    try {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
          ? input.toString()
          : input.url;

      if (url && url.includes("/_serverFn/")) {
        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
        if (!headers.has("authorization")) {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          if (token) headers.set("authorization", `Bearer ${token}`);
        }
        return originalFetch(input as RequestInfo, { ...init, headers });
      }
    } catch {
      // fall through to original fetch
    }
    return originalFetch(input as RequestInfo, init);
  };
}
