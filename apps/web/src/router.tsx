import { createBrowserRouter } from 'react-router-dom';
import { MeetingListPage } from './pages/MeetingListPage';
import { SharedMeetingPage } from './pages/SharedMeetingPage';
import { FacilitatorMeetingPage } from './pages/FacilitatorMeetingPage';
import { TranscriptPage } from './pages/TranscriptPage';
import { LoggedDecisionPage } from './pages/LoggedDecisionPage';
import { PrototypeGallery } from './pages/PrototypeGallery';

export const router = createBrowserRouter([
  // ── Prototype gallery (dev only) ────────────────────────────────
  { path: '/prototype', element: <PrototypeGallery /> },

  // ── Route 1: Meeting list ────────────────────────────────────────
  { path: '/', element: <MeetingListPage /> },

  // ── Route 2: Shared display (projected) ─────────────────────────
  { path: '/meetings/:id', element: <SharedMeetingPage /> },

  // ── Route 3: Facilitator meeting view ───────────────────────────
  { path: '/meetings/:id/facilitator', element: <FacilitatorMeetingPage /> },

  // ── Route 4: Segment selection ───────────────────────────────────
  { path: '/meetings/:id/facilitator/transcript', element: <TranscriptPage /> },

  // ── Route 5: Logged decision (projectable) ───────────────────────
  { path: '/decisions/:id', element: <LoggedDecisionPage /> },
]);
