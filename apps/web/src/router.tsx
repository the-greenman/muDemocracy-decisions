import { createBrowserRouter } from "react-router-dom";
import { MeetingListPage } from "./pages/MeetingListPage";
import { SharedMeetingPage } from "./pages/SharedMeetingPage";
import { FacilitatorMeetingPage } from "./pages/FacilitatorMeetingPage";
import { FacilitatorMeetingHomePage } from "./pages/FacilitatorMeetingHomePage";
import { FacilitatorStreamPage } from "./pages/FacilitatorStreamPage";
import { FacilitatorStreamDiagnosticsPage } from "./pages/FacilitatorStreamDiagnosticsPage";
import { TranscriptPage } from "./pages/TranscriptPage";
import { LoggedDecisionPage } from "./pages/LoggedDecisionPage";

export const router = createBrowserRouter([
  // ── Route 1: Meeting list ────────────────────────────────────────
  { path: "/", element: <MeetingListPage /> },

  // ── Route 2: Shared display (projected) ─────────────────────────
  { path: "/meetings/:id", element: <SharedMeetingPage /> },

  // ── Route 3: Facilitator meeting view ───────────────────────────
  { path: "/meetings/:id/facilitator/home", element: <FacilitatorMeetingHomePage /> },
  { path: "/meetings/:id/facilitator", element: <FacilitatorMeetingPage /> },
  { path: "/meetings/:id/facilitator/stream", element: <FacilitatorStreamPage /> },
  { path: "/meetings/:id/facilitator/stream/diagnostics", element: <FacilitatorStreamDiagnosticsPage /> },

  // ── Route 4: Segment selection ───────────────────────────────────
  { path: "/meetings/:id/facilitator/transcript", element: <TranscriptPage /> },

  // ── Route 5: Logged decision (projectable) ───────────────────────
  { path: "/decisions/:id", element: <LoggedDecisionPage /> },
]);
