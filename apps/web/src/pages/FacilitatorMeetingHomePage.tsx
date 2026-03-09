import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Plus, UserPlus, Trash2, ClipboardList, Link2, ArrowRight } from 'lucide-react';
import { OPEN_CONTEXTS } from '@/lib/mock-data';
import { OpenContextPicker } from '@/components/shared/OpenContextPicker';

type SetupDraftState = {
  setupDraft?: {
    meetingTitle?: string;
    meetingDate?: string;
    participants?: string[];
  };
};

export function FacilitatorMeetingHomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setupDraft = (location.state as SetupDraftState | null)?.setupDraft;

  const [meetingTitle, setMeetingTitle] = useState(setupDraft?.meetingTitle ?? 'New Meeting');
  const [meetingDate, setMeetingDate] = useState(
    setupDraft?.meetingDate ?? new Date().toISOString().slice(0, 10),
  );
  const [participants, setParticipants] = useState<string[]>(setupDraft?.participants ?? []);
  const [newParticipant, setNewParticipant] = useState('');

  const [agendaTab, setAgendaTab] = useState<'stubs' | 'open-contexts'>('stubs');
  const [stubTitle, setStubTitle] = useState('');
  const [agendaStubs, setAgendaStubs] = useState<string[]>([]);
  const [selectedContextIds, setSelectedContextIds] = useState<string[]>([]);

  const selectedOpenContexts = OPEN_CONTEXTS.filter((ctx) => selectedContextIds.includes(ctx.id));

  function addParticipant() {
    const name = newParticipant.trim();
    if (!name || participants.includes(name)) return;
    setParticipants((prev) => [...prev, name]);
    setNewParticipant('');
  }

  function removeParticipant(name: string) {
    setParticipants((prev) => prev.filter((p) => p !== name));
  }

  function addAgendaStub() {
    const next = stubTitle.trim();
    if (!next) return;
    if (agendaStubs.some((item) => item.toLowerCase() === next.toLowerCase())) {
      setStubTitle('');
      return;
    }
    setAgendaStubs((prev) => [...prev, next]);
    setStubTitle('');
  }

  function removeAgendaStub(value: string) {
    setAgendaStubs((prev) => prev.filter((item) => item !== value));
  }

  return (
    <div className="density-facilitator min-h-screen bg-base">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-fac-title text-text-primary">{meetingTitle}</h1>
          <p className="text-fac-meta text-text-secondary mt-0.5">
            Meeting home — no active decision context yet
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/meetings/mtg-1"
            className="px-3 py-2 rounded border border-border text-fac-meta text-text-muted hover:text-text-primary"
          >
            Shared screen
          </Link>
          <button
            onClick={() =>
              navigate('/meetings/mtg-1/facilitator', {
                state: {
                  setupDraft: {
                    meetingTitle,
                    meetingDate,
                    participants,
                    initialAgenda: {
                      stubs: agendaStubs,
                      openContexts: selectedOpenContexts.map((ctx) => ({
                        id: ctx.id,
                        title: ctx.title,
                        sourceMeetingTitle: ctx.sourceMeetingTitle,
                        sourceMeetingDate: ctx.sourceMeetingDate,
                      })),
                    },
                  },
                },
              })
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-accent text-white text-fac-meta hover:bg-accent/90"
          >
            Open facilitator workspace
            <ArrowRight size={13} />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="rounded-card border border-border bg-surface p-4 flex flex-col gap-3">
          <h2 className="text-fac-field text-text-primary font-medium">Meeting details</h2>
          <input
            type="text"
            value={meetingTitle}
            onChange={(e) => setMeetingTitle(e.target.value)}
            className="w-full px-3 py-2 rounded border border-border bg-overlay text-fac-meta text-text-primary focus:outline-none focus:border-accent"
          />
          <input
            type="date"
            value={meetingDate}
            onChange={(e) => setMeetingDate(e.target.value)}
            className="w-48 px-3 py-2 rounded border border-border bg-overlay text-fac-meta text-text-primary focus:outline-none focus:border-accent"
          />
          <div className="flex flex-col gap-1.5">
            {participants.map((p) => (
              <div key={p} className="flex items-center gap-2 px-3 py-1.5 rounded border border-border bg-overlay/60">
                <span className="text-fac-meta text-text-primary flex-1">{p}</span>
                <button onClick={() => removeParticipant(p)} className="text-text-muted hover:text-danger">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add participant..."
                value={newParticipant}
                onChange={(e) => setNewParticipant(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addParticipant()}
                className="flex-1 px-3 py-1.5 rounded border border-border bg-overlay text-fac-meta text-text-primary focus:outline-none focus:border-accent"
              />
              <button
                onClick={addParticipant}
                disabled={!newParticipant.trim()}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-accent/30 text-accent text-fac-meta hover:bg-accent-dim disabled:opacity-40"
              >
                <UserPlus size={13} />
                Add
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-card border border-border bg-surface p-4 flex flex-col gap-3">
          <h2 className="text-fac-field text-text-primary font-medium">Initial decision agenda</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAgendaTab('stubs')}
              className={`px-2.5 py-1.5 rounded text-fac-meta border ${
                agendaTab === 'stubs'
                  ? 'border-accent/40 text-accent bg-accent-dim/20'
                  : 'border-border text-text-muted hover:text-text-primary'
              }`}
            >
              New stubs
            </button>
            <button
              onClick={() => setAgendaTab('open-contexts')}
              className={`px-2.5 py-1.5 rounded text-fac-meta border ${
                agendaTab === 'open-contexts'
                  ? 'border-accent/40 text-accent bg-accent-dim/20'
                  : 'border-border text-text-muted hover:text-text-primary'
              }`}
            >
              Browse open contexts
            </button>
          </div>

          {agendaTab === 'stubs' ? (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Decision stub title..."
                  value={stubTitle}
                  onChange={(e) => setStubTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addAgendaStub()}
                  className="flex-1 px-3 py-1.5 rounded border border-border bg-overlay text-fac-meta text-text-primary focus:outline-none focus:border-accent"
                />
                <button
                  onClick={addAgendaStub}
                  disabled={!stubTitle.trim()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-accent/30 text-accent text-fac-meta hover:bg-accent-dim disabled:opacity-40"
                >
                  <Plus size={13} />
                  Add
                </button>
              </div>
              {agendaStubs.map((item) => (
                <div key={item} className="flex items-center gap-2 px-3 py-1.5 rounded border border-border bg-overlay/60">
                  <ClipboardList size={13} className="text-text-muted" />
                  <span className="text-fac-meta text-text-primary flex-1">{item}</span>
                  <button onClick={() => removeAgendaStub(item)} className="text-text-muted hover:text-danger">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <OpenContextPicker
                idPrefix="meeting-home-open-contexts"
                contexts={OPEN_CONTEXTS}
                currentMeeting={{ title: meetingTitle, date: meetingDate }}
                selectionMode="multiple"
                selectedIds={selectedContextIds}
                onChange={setSelectedContextIds}
              />
            </div>
          )}
        </section>

        <section className="lg:col-span-2 rounded-card border border-border bg-surface p-4">
          <h2 className="text-fac-field text-text-primary font-medium">Planned agenda (draft)</h2>
          {agendaStubs.length === 0 && selectedOpenContexts.length === 0 ? (
            <p className="text-fac-meta text-text-muted mt-1">
              Add stubs or existing contexts to build the initial agenda before opening a decision workspace.
            </p>
          ) : (
            <div className="mt-2 flex flex-col gap-1">
              {agendaStubs.map((item) => (
                <p key={`stub-${item}`} className="text-fac-meta text-text-primary">
                  • {item} <span className="text-text-muted">(stub)</span>
                </p>
              ))}
              {selectedOpenContexts.map((ctx) => (
                <p key={`ctx-${ctx.id}`} className="text-fac-meta text-text-primary">
                  • {ctx.title} <span className="text-text-muted">(open context)</span>
                </p>
              ))}
            </div>
          )}
          <div className="mt-3 flex items-center gap-2 text-fac-meta text-text-muted">
            <Link2 size={13} />
            Cross-meeting context linking is applied when open contexts are attached in facilitator workspace.
          </div>
        </section>
      </main>
    </div>
  );
}
