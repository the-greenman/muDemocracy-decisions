import { useMemo, useState } from 'react';
import { Plus, FolderOpen, CalendarDays, Users, X, UserPlus, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { MEETINGS } from '@/lib/mock-data';
import type { Meeting } from '@/lib/mock-data';

export function MeetingListPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [pastQuery, setPastQuery] = useState('');
  const [pastMonth, setPastMonth] = useState(new Date().toISOString().slice(0, 7));
  const [pastTag, setPastTag] = useState('all');
  const todayIso = new Date().toISOString().slice(0, 10);

  const upcomingMeetings = useMemo(
    () =>
      [...MEETINGS]
        .filter((meeting) => meeting.date >= todayIso)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [todayIso],
  );

  const allMeetingTags = useMemo(
    () => Array.from(new Set(MEETINGS.flatMap((meeting) => getMeetingTags(meeting.id)))).sort(),
    [],
  );

  const filteredPastMeetings = useMemo(() => {
    const q = pastQuery.trim().toLowerCase();
    return [...MEETINGS]
      .filter((meeting) => meeting.date < todayIso)
      .filter((meeting) => {
        if (pastMonth && !meeting.date.startsWith(pastMonth)) return false;
        if (pastTag !== 'all' && !getMeetingTags(meeting.id).includes(pastTag)) return false;
        if (!q) return true;
        if (meeting.title.toLowerCase().includes(q)) return true;
        if (meeting.date.includes(q)) return true;
        if (meeting.participants.some((p) => p.toLowerCase().includes(q))) return true;
        if (getMeetingTags(meeting.id).some((tag) => tag.toLowerCase().includes(q))) return true;
        return false;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [pastMonth, pastQuery, pastTag, todayIso]);

  return (
    <div className="density-facilitator min-h-screen bg-base">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-fac-title text-text-primary">Decision Logger</h1>
          <p className="text-fac-meta text-text-secondary mt-0.5">Meeting sessions</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-card bg-accent text-white text-fac-field font-medium hover:bg-accent/90 transition-colors"
        >
          <Plus size={16} />
          New meeting
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {showCreate && (
          <div className="mb-6">
            <NewMeetingForm onCancel={() => setShowCreate(false)} />
          </div>
        )}

        <section className="rounded-card border border-border bg-surface p-4 mb-5">
          <h2 className="text-fac-field text-text-primary font-medium mb-3">Upcoming meetings</h2>
          {upcomingMeetings.length === 0 ? (
            <p className="text-fac-meta text-text-muted">No upcoming meetings scheduled.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {upcomingMeetings.map((meeting) => (
                <MeetingRow key={meeting.id} meeting={meeting} />
              ))}
            </div>
          )}
        </section>

        <section className="rounded-card border border-border bg-surface p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-fac-field text-text-primary font-medium">Past meetings</h2>
            <span className="text-fac-meta text-text-muted">Browse by date and tag</span>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            <input
              type="text"
              value={pastQuery}
              onChange={(e) => setPastQuery(e.target.value)}
              placeholder="Search title, participant, date, tag..."
              className="min-w-72 flex-1 px-3 py-1.5 rounded border border-border bg-overlay text-fac-meta text-text-primary focus:outline-none focus:border-accent"
            />
            <input
              type="month"
              value={pastMonth}
              onChange={(e) => setPastMonth(e.target.value)}
              className="px-2.5 py-1.5 rounded border border-border bg-overlay text-fac-meta text-text-primary focus:outline-none focus:border-accent"
            />
            <select
              value={pastTag}
              onChange={(e) => setPastTag(e.target.value)}
              className="px-2.5 py-1.5 rounded border border-border bg-overlay text-fac-meta text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="all">All tags</option>
              {allMeetingTags.map((tag) => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>

          {filteredPastMeetings.length === 0 ? (
            <p className="text-fac-meta text-text-muted italic">No past meetings match current filters.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredPastMeetings.map((meeting) => (
                <MeetingRow key={meeting.id} meeting={meeting} showTags />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

// ── New meeting form ─────────────────────────────────────────────

function NewMeetingForm({ onCancel }: { onCancel: () => void }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0] ?? '');
  const [participants, setParticipants] = useState<string[]>([]);
  const [newParticipant, setNewParticipant] = useState('');

  function addParticipant() {
    const name = newParticipant.trim();
    if (!name || participants.includes(name)) return;
    setParticipants((prev) => [...prev, name]);
    setNewParticipant('');
  }

  function removeParticipant(name: string) {
    setParticipants((prev) => prev.filter((p) => p !== name));
  }

  function handleCreate() {
    if (!title.trim()) return;
    navigate('/meetings/mtg-1/facilitator/home', {
      state: {
        setupDraft: {
          meetingTitle: title.trim(),
          meetingDate: date,
          participants,
        },
      },
    });
  }

  return (
    <div className="rounded-card border border-accent/30 bg-accent-dim/10 p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-fac-field text-text-primary font-medium">New meeting</span>
        <button onClick={onCancel} className="text-text-muted hover:text-text-primary transition-colors">
          <X size={15} />
        </button>
      </div>

      {/* Title */}
      <div className="flex flex-col gap-1.5">
        <label className="text-fac-label text-text-secondary uppercase tracking-wider">
          Title <span className="text-danger">*</span>
        </label>
        <input
          type="text"
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Q4 Architecture Review"
          className="w-full px-3 py-2 rounded border border-border bg-surface text-fac-field text-text-primary focus:outline-none focus:border-accent placeholder:text-text-muted"
        />
      </div>

      {/* Date */}
      <div className="flex flex-col gap-1.5">
        <label className="text-fac-label text-text-secondary uppercase tracking-wider">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-48 px-3 py-2 rounded border border-border bg-surface text-fac-field text-text-primary focus:outline-none focus:border-accent"
        />
      </div>

      {/* Participants */}
      <div className="flex flex-col gap-2">
        <label className="text-fac-label text-text-secondary uppercase tracking-wider">Participants</label>
        <div className="flex flex-col gap-1">
          {participants.map((p) => (
            <div key={p} className="flex items-center gap-2 px-3 py-1.5 rounded border border-border bg-surface/60">
              <span className="text-fac-meta text-text-primary flex-1">{p}</span>
              <button
                onClick={() => removeParticipant(p)}
                className="text-text-muted hover:text-danger transition-colors"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Name…"
            value={newParticipant}
            onChange={(e) => setNewParticipant(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addParticipant()}
            className="flex-1 px-3 py-1.5 rounded border border-border bg-surface text-fac-meta text-text-primary focus:outline-none focus:border-accent placeholder:text-text-muted"
          />
          <button
            onClick={addParticipant}
            disabled={!newParticipant.trim()}
            className="flex items-center gap-1 px-3 py-1.5 text-fac-meta text-accent border border-accent/30 rounded hover:bg-accent-dim transition-colors disabled:opacity-30"
          >
            <UserPlus size={13} />
            Add
          </button>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-fac-meta text-text-muted hover:text-text-primary transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleCreate}
          disabled={!title.trim()}
          className="flex items-center gap-1.5 px-4 py-2 text-fac-meta bg-accent text-white rounded hover:bg-accent/90 transition-colors disabled:opacity-40"
        >
          <Plus size={13} />
          Create meeting
        </button>
      </div>
    </div>
  );
}

// ── Meeting row ──────────────────────────────────────────────────

function MeetingRow({ meeting, showTags = false }: { meeting: Meeting; showTags?: boolean }) {
  return (
    <Link
      to={`/meetings/${meeting.id}/facilitator/home`}
      className="block p-4 rounded-card border border-border bg-surface hover:border-border-strong transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <FolderOpen size={16} className="text-accent shrink-0" />
            <span className="text-fac-field text-text-primary font-medium truncate">
              {meeting.title}
            </span>
            {meeting.status === 'active' && (
              <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-badge text-[11px] bg-accent-dim text-accent border border-accent/30 font-medium">
                Active
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 mt-2">
            <span className="flex items-center gap-1 text-fac-meta text-text-muted">
              <CalendarDays size={12} />
              {meeting.date}
            </span>
            <span className="flex items-center gap-1 text-fac-meta text-text-muted">
              <Users size={12} />
              {meeting.participants.length} participants
            </span>
          </div>
          {showTags && (
            <p className="text-fac-meta text-text-muted mt-1">
              {getMeetingTags(meeting.id).join(', ')}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <StatChip label="Drafted" value={meeting.draftedCount} />
          <StatChip label="Logged" value={meeting.loggedCount} />
        </div>
      </div>
    </Link>
  );
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-fac-title text-text-primary">{value}</span>
      <span className="text-[11px] text-text-muted">{label}</span>
    </div>
  );
}

function getMeetingTags(meetingId: string): string[] {
  const mapping: Record<string, string[]> = {
    'mtg-1': ['architecture', 'platform', 'q4'],
    'mtg-2': ['budget', 'finance', 'planning'],
  };
  return mapping[meetingId] ?? ['general'];
}
