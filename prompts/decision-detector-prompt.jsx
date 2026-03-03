import { useState } from "react";

const CATEGORIES = [
  {
    id: "decision",
    label: "DECISION",
    color: "#4ade80",
    bg: "rgba(74, 222, 128, 0.08)",
    border: "rgba(74, 222, 128, 0.25)",
    description: "Explicit agreement reached. Both parties have converged.",
    signals: [
      "Affirmative closure after exchange: \"Good, good.\" / \"Yeah, yeah.\" / \"That's it.\"",
      "One speaker restates the point as settled fact and moves on",
      "Explicit named commitment: \"So we're saying…\" / \"That's baked in\"",
      "Conditional resolution: \"As long as X, then Y\"",
    ],
    flag: "The decision statement · Who affirmed it · Any stated conditions or exceptions",
  },
  {
    id: "implicit",
    label: "IMPLICIT DECISION",
    color: "#fb923c",
    bg: "rgba(251, 146, 60, 0.08)",
    border: "rgba(251, 146, 60, 0.25)",
    description:
      "A constraint, assumption, or closure is embedded without being named as a choice.",
    signals: [
      "A constraint stated as fact rather than proposed as option",
      "An alternative is ruled out without being explicitly considered",
      "Framing that forecloses a future option mid-flow",
      "Shared assumption that underlies multiple subsequent statements",
    ],
    flag: "The exact statement · What option it forecloses · That it was unnamed as a decision",
  },
  {
    id: "exploration",
    label: "EXPLORATION",
    color: "#818cf8",
    bg: "rgba(129, 140, 248, 0.08)",
    border: "rgba(129, 140, 248, 0.25)",
    description:
      "Topic raised but unresolved. No convergence reached. Not yet a decision.",
    signals: [
      "Trailing language: \"Something about…\" / \"I don't know if…\" / \"I'm just thinking…\"",
      "Questions that remain questions at the end of a thread",
      "Explicit deferral: \"That's tomorrow work\" / \"We'll come back to that\"",
      "Topic returns multiple times without landing",
      "Both sides named without a resolution direction",
    ],
    flag: "The topic · The core tension or unresolved question · Whether deliberately deferred or simply unfinished",
  },
];

const PROMPT_CORE = `You are analysing a meeting transcript for decision-making signals.

For each meaningful unit of discussion, classify it as one of:

DECISION
Explicit agreement reached. Both parties have converged.
Flag: the decision statement, who affirmed it, and any stated conditions.

IMPLICIT DECISION
A constraint, assumption or closure is embedded in the conversation 
without being named as a choice.
Flag: the statement, what option it forecloses, and that it was unnamed.

EXPLORATION
Topic raised but unresolved. No convergence reached.
Flag: the topic, the tension or question at its centre, and any signal 
that it was deliberately deferred vs. simply unfinished.

---

SIGNAL PATTERNS TO WATCH FOR

Decisions:
- Affirmative closure after exchange: "Good, good." / "Yeah, yeah." / "That's it."
- One speaker restates the point as settled fact and the conversation moves on
- Explicit named commitment or conditional resolution

Implicit decisions:
- A constraint stated as fact rather than proposed as option
- An alternative is ruled out without being explicitly considered
- Framing that forecloses a future option mid-flow

Explorations:
- Trailing or tentative language: "Something about..." / "I'm just thinking..."
- Questions that remain questions at the end of the thread
- Explicit deferral markers: "That's tomorrow work" / "We'll come back to that"
- Topic returns multiple times without landing

---

DISAMBIGUATION RULE
The hardest distinction is between EXPLORATION and IMPLICIT DECISION.
Both can look like statements. Apply this test:
Does this statement foreclose a future option?
  → YES: flag as IMPLICIT DECISION
  → NO (opens or circles): flag as EXPLORATION

---

OUTPUT FORMAT

For each item found:

[CATEGORY]
Content: [what was said, paraphrased precisely]
Signal: [which pattern triggered this classification]
Flag: [the specific thing to capture — decision statement / foreclosed option / unresolved question]
Confidence: HIGH / MEDIUM / LOW

---

TRANSCRIPT TO ANALYSE:

[PASTE TRANSCRIPT HERE]`;

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "prompt", label: "Full Prompt" },
  { id: "signals", label: "Signal Patterns" },
];

export default function DecisionDetector() {
  const [activeTab, setActiveTab] = useState("overview");
  const [copied, setCopied] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(PROMPT_CORE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      // Could show an error message to the user here
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0d0f14",
        color: "#e2e8f0",
        fontFamily: "'Georgia', 'Times New Roman', serif",
        padding: "0",
      }}
    >
      {/* Header */}
      <div
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          padding: "2.5rem 2.5rem 0",
        }}
      >
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div
            style={{
              fontSize: "0.65rem",
              letterSpacing: "0.2em",
              color: "#64748b",
              fontFamily: "monospace",
              marginBottom: "0.75rem",
              textTransform: "uppercase",
            }}
          >
            Decision Detection System · Prompt v1.0
          </div>
          <h1
            style={{
              fontSize: "clamp(1.6rem, 4vw, 2.2rem)",
              fontWeight: 400,
              letterSpacing: "-0.02em",
              margin: "0 0 0.4rem",
              lineHeight: 1.2,
              color: "#f1f5f9",
            }}
          >
            Meeting Transcript
            <br />
            <span style={{ color: "#4ade80" }}>Decision Classifier</span>
          </h1>
          <p
            style={{
              color: "#64748b",
              fontSize: "0.9rem",
              margin: "0 0 2rem",
              lineHeight: 1.6,
              fontFamily: "monospace",
            }}
          >
            Identifies decisions, implicit decisions, and not-yet-ready
            explorations in unstructured conversation.
          </p>

          {/* Tabs */}
          <div style={{ display: "flex", gap: "0" }}>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: "none",
                  border: "none",
                  borderBottom: `2px solid ${
                    activeTab === tab.id
                      ? "#4ade80"
                      : "transparent"
                  }`,
                  color:
                    activeTab === tab.id ? "#f1f5f9" : "#64748b",
                  padding: "0.6rem 1.2rem",
                  fontSize: "0.8rem",
                  fontFamily: "monospace",
                  letterSpacing: "0.08em",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  textTransform: "uppercase",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "2.5rem" }}>

        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div>
            <p
              style={{
                color: "#94a3b8",
                fontSize: "0.95rem",
                lineHeight: 1.8,
                marginBottom: "2.5rem",
                fontFamily: "monospace",
              }}
            >
              This prompt gives an AI model the pattern-recognition framework to
              classify conversation fragments in real-time or post-hoc. Three
              categories. One disambiguation rule. A consistent output structure.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {CATEGORIES.map((cat) => (
                <div
                  key={cat.id}
                  onClick={() =>
                    setExpandedCategory(
                      expandedCategory === cat.id ? null : cat.id
                    )
                  }
                  style={{
                    background: expandedCategory === cat.id ? cat.bg : "rgba(255,255,255,0.02)",
                    border: `1px solid ${
                      expandedCategory === cat.id ? cat.border : "rgba(255,255,255,0.06)"
                    }`,
                    borderRadius: 4,
                    padding: "1.25rem 1.5rem",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: "0.65rem",
                          fontFamily: "monospace",
                          letterSpacing: "0.15em",
                          color: cat.color,
                          fontWeight: 600,
                        }}
                      >
                        {cat.label}
                      </span>
                      <p
                        style={{
                          margin: "0.3rem 0 0",
                          color: "#94a3b8",
                          fontSize: "0.85rem",
                          fontFamily: "monospace",
                        }}
                      >
                        {cat.description}
                      </p>
                    </div>
                    <span
                      style={{
                        color: "#475569",
                        fontSize: "1.2rem",
                        transition: "transform 0.2s",
                        transform:
                          expandedCategory === cat.id
                            ? "rotate(45deg)"
                            : "none",
                      }}
                    >
                      +
                    </span>
                  </div>

                  {expandedCategory === cat.id && (
                    <div style={{ marginTop: "1.25rem" }}>
                      <div
                        style={{
                          fontSize: "0.65rem",
                          fontFamily: "monospace",
                          letterSpacing: "0.12em",
                          color: "#475569",
                          textTransform: "uppercase",
                          marginBottom: "0.6rem",
                        }}
                      >
                        Signal patterns
                      </div>
                      <ul style={{ margin: 0, padding: "0 0 0 1rem" }}>
                        {cat.signals.map((s, i) => (
                          <li
                            key={i}
                            style={{
                              color: "#94a3b8",
                              fontSize: "0.82rem",
                              fontFamily: "monospace",
                              lineHeight: 1.7,
                              marginBottom: "0.2rem",
                            }}
                          >
                            {s}
                          </li>
                        ))}
                      </ul>
                      <div
                        style={{
                          marginTop: "1rem",
                          paddingTop: "1rem",
                          borderTop: `1px solid ${cat.border}`,
                        }}
                      >
                        <span
                          style={{
                            fontSize: "0.65rem",
                            fontFamily: "monospace",
                            letterSpacing: "0.12em",
                            color: "#475569",
                            textTransform: "uppercase",
                          }}
                        >
                          Flag:{" "}
                        </span>
                        <span
                          style={{
                            fontSize: "0.82rem",
                            fontFamily: "monospace",
                            color: cat.color,
                            opacity: 0.8,
                          }}
                        >
                          {cat.flag}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Disambiguation rule */}
            <div
              style={{
                marginTop: "2rem",
                padding: "1.5rem",
                background: "rgba(129, 140, 248, 0.05)",
                border: "1px solid rgba(129, 140, 248, 0.15)",
                borderRadius: 4,
              }}
            >
              <div
                style={{
                  fontSize: "0.65rem",
                  fontFamily: "monospace",
                  letterSpacing: "0.15em",
                  color: "#818cf8",
                  textTransform: "uppercase",
                  marginBottom: "0.75rem",
                }}
              >
                Disambiguation Rule
              </div>
              <p
                style={{
                  margin: "0 0 0.75rem",
                  color: "#94a3b8",
                  fontSize: "0.85rem",
                  fontFamily: "monospace",
                  lineHeight: 1.7,
                }}
              >
                The hardest distinction is{" "}
                <span style={{ color: "#e2e8f0" }}>
                  EXPLORATION vs IMPLICIT DECISION
                </span>
                . Both can look like statements. Apply this test:
              </p>
              <div
                style={{
                  background: "rgba(0,0,0,0.3)",
                  padding: "1rem 1.25rem",
                  borderRadius: 3,
                  fontFamily: "monospace",
                  fontSize: "0.82rem",
                  lineHeight: 1.8,
                  color: "#cbd5e1",
                }}
              >
                Does this statement foreclose a future option?
                <br />
                <span style={{ color: "#fb923c" }}>→ YES</span> — flag as
                IMPLICIT DECISION
                <br />
                <span style={{ color: "#818cf8" }}>
                  → NO (opens or circles)
                </span>{" "}
                — flag as EXPLORATION
              </div>
            </div>
          </div>
        )}

        {/* PROMPT TAB */}
        {activeTab === "prompt" && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1.25rem",
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: "#64748b",
                  fontSize: "0.8rem",
                  fontFamily: "monospace",
                }}
              >
                Copy and paste into your AI model's system prompt or user turn.
              </p>
              <button
                onClick={handleCopy}
                style={{
                  background: copied
                    ? "rgba(74, 222, 128, 0.15)"
                    : "rgba(255,255,255,0.05)",
                  border: `1px solid ${
                    copied
                      ? "rgba(74, 222, 128, 0.4)"
                      : "rgba(255,255,255,0.1)"
                  }`,
                  color: copied ? "#4ade80" : "#94a3b8",
                  padding: "0.5rem 1rem",
                  borderRadius: 3,
                  cursor: "pointer",
                  fontFamily: "monospace",
                  fontSize: "0.75rem",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  transition: "all 0.2s",
                }}
              >
                {copied ? "Copied ✓" : "Copy Prompt"}
              </button>
            </div>

            <pre
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 4,
                padding: "1.75rem",
                fontFamily: "monospace",
                fontSize: "0.78rem",
                lineHeight: 1.85,
                color: "#94a3b8",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                margin: 0,
                overflowX: "auto",
              }}
            >
              {PROMPT_CORE.split("\n").map((line, i) => {
                const isHeading =
                  line === "DECISION" ||
                  line === "IMPLICIT DECISION" ||
                  line === "EXPLORATION" ||
                  line === "SIGNAL PATTERNS TO WATCH FOR" ||
                  line === "DISAMBIGUATION RULE" ||
                  line === "OUTPUT FORMAT" ||
                  line === "TRANSCRIPT TO ANALYSE:";
                const isSeparator = line.startsWith("---");
                const isSubheading =
                  line === "Decisions:" ||
                  line === "Implicit decisions:" ||
                  line === "Explorations:";
                return (
                  <span
                    key={i}
                    style={{
                      color: isHeading
                        ? "#f1f5f9"
                        : isSeparator
                        ? "#334155"
                        : isSubheading
                        ? "#818cf8"
                        : undefined,
                      display: "block",
                    }}
                  >
                    {line || "\u00A0"}
                  </span>
                );
              })}
            </pre>
          </div>
        )}

        {/* SIGNALS TAB */}
        {activeTab === "signals" && (
          <div>
            <p
              style={{
                color: "#94a3b8",
                fontSize: "0.85rem",
                fontFamily: "monospace",
                lineHeight: 1.8,
                marginBottom: "2rem",
              }}
            >
              Linguistic and structural patterns that indicate each category. These are the core recognitions the model needs to internalise.
            </p>

            {CATEGORIES.map((cat) => (
              <div key={cat.id} style={{ marginBottom: "2.5rem" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    marginBottom: "1rem",
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: cat.color,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontFamily: "monospace",
                      letterSpacing: "0.15em",
                      color: cat.color,
                      textTransform: "uppercase",
                    }}
                  >
                    {cat.label}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {cat.signals.map((signal, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        gap: "0.75rem",
                        padding: "0.75rem 1rem",
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.05)",
                        borderLeft: `2px solid ${cat.color}`,
                        borderRadius: "0 3px 3px 0",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.65rem",
                          fontFamily: "monospace",
                          color: cat.color,
                          opacity: 0.5,
                          paddingTop: "0.1rem",
                          flexShrink: 0,
                        }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span
                        style={{
                          fontSize: "0.82rem",
                          fontFamily: "monospace",
                          color: "#94a3b8",
                          lineHeight: 1.6,
                        }}
                      >
                        {signal}
                      </span>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    marginTop: "0.75rem",
                    padding: "0.75rem 1rem",
                    background: cat.bg,
                    border: `1px solid ${cat.border}`,
                    borderRadius: 3,
                    display: "flex",
                    gap: "0.75rem",
                    alignItems: "flex-start",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.65rem",
                      fontFamily: "monospace",
                      letterSpacing: "0.1em",
                      color: cat.color,
                      textTransform: "uppercase",
                      flexShrink: 0,
                      paddingTop: "0.15rem",
                    }}
                  >
                    Flag
                  </span>
                  <span
                    style={{
                      fontSize: "0.82rem",
                      fontFamily: "monospace",
                      color: "#cbd5e1",
                      lineHeight: 1.6,
                    }}
                  >
                    {cat.flag}
                  </span>
                </div>
              </div>
            ))}

            {/* Output format reminder */}
            <div
              style={{
                padding: "1.5rem",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 4,
                marginTop: "1rem",
              }}
            >
              <div
                style={{
                  fontSize: "0.65rem",
                  fontFamily: "monospace",
                  letterSpacing: "0.15em",
                  color: "#475569",
                  textTransform: "uppercase",
                  marginBottom: "1rem",
                }}
              >
                Output Format
              </div>
              <pre
                style={{
                  margin: 0,
                  fontFamily: "monospace",
                  fontSize: "0.78rem",
                  lineHeight: 1.8,
                  color: "#64748b",
                  whiteSpace: "pre-wrap",
                }}
              >{`[CATEGORY]
Content: [what was said, paraphrased precisely]
Signal: [which pattern triggered this classification]
Flag: [decision statement / foreclosed option / unresolved question]
Confidence: HIGH / MEDIUM / LOW`}</pre>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.05)",
          padding: "1.5rem 2.5rem",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontSize: "0.65rem",
            fontFamily: "monospace",
            color: "#334155",
            letterSpacing: "0.1em",
          }}
        >
          DECISION DETECTION SYSTEM · OPERATIONAL TEST BUILD
        </span>
      </div>
    </div>
  );
}
