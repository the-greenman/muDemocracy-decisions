import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ConnectionContext } from "@/context/ConnectionContext";
import { initConnection, BASE_URL } from "@/api/client";
import { getGlobalContext } from "@/api/endpoints";
import type { GlobalContext } from "@/api/types";

export function RootLayout() {
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [globalContext, setGlobalContext] = useState<GlobalContext | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const prevMeetingIdRef = useRef<string | undefined>(undefined);

  // Always holds the latest applyNavigationRule so SSE listeners never call a stale closure
  const applyNavigationRuleRef = useRef<(ctx: GlobalContext) => void>(() => {});

  // Rewrite the ref on every render — captures fresh location.pathname and navigate
  applyNavigationRuleRef.current = function applyNavigationRule(ctx: GlobalContext) {
    const pathname = location.pathname;

    // Determine the meeting ID currently reflected in the URL (if any)
    const urlMeetingMatch = pathname.match(/^\/meetings\/([^/]+)/);
    const urlMeetingId = urlMeetingMatch?.[1] ?? null;

    if (!ctx.activeMeetingId) {
      // Meeting was cleared — go back to root if currently on a meeting page
      if (urlMeetingId) {
        navigate("/");
      }
      prevMeetingIdRef.current = undefined;
      return;
    }

    if (pathname === "/") {
      // Landing page — navigate to the active meeting
      navigate(`/meetings/${ctx.activeMeetingId}/facilitator`);
      prevMeetingIdRef.current = ctx.activeMeetingId;
      return;
    }

    if (urlMeetingId && urlMeetingId !== ctx.activeMeetingId) {
      // Switched to a different meeting while on a meeting page
      navigate(`/meetings/${ctx.activeMeetingId}/facilitator`);
      prevMeetingIdRef.current = ctx.activeMeetingId;
      return;
    }

    // Same meeting — decision/field changes are handled by component-level sync
    prevMeetingIdRef.current = ctx.activeMeetingId;
  };

  // Bootstrap the connection ID once on mount
  useEffect(() => {
    initConnection()
      .then(setConnectionId)
      .catch((err) => console.error("[ConnectionSync] Failed to init connection:", err));
  }, []);

  // Open SSE subscription once we have a connection ID
  useEffect(() => {
    if (!connectionId) return;

    const url = `${BASE_URL}/api/connections/${connectionId}/events`;
    const es = new EventSource(url);

    es.addEventListener("context", (e: MessageEvent) => {
      const incoming = JSON.parse(e.data) as GlobalContext;
      setGlobalContext(incoming);
      applyNavigationRuleRef.current(incoming);
    });

    es.addEventListener("resync", () => {
      getGlobalContext()
        .then((ctx) => {
          setGlobalContext(ctx);
          applyNavigationRuleRef.current(ctx);
        })
        .catch(() => {});
    });

    es.onerror = () => {
      // Browser will auto-reconnect; CLOSED state during StrictMode cleanup is expected
    };

    return () => {
      es.close();
    };
  }, [connectionId]);

  return (
    <ConnectionContext.Provider value={{ connectionId, globalContext }}>
      <Outlet />
    </ConnectionContext.Provider>
  );
}
