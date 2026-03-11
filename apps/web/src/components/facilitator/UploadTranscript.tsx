import { useState, useRef } from "react";
import { Upload, FileText, CheckCircle2, X } from "lucide-react";

type UploadState = "idle" | "ready" | "processing" | "done";
type InputMode = "file" | "paste";

interface UploadTranscriptProps {
  onComplete: (filename: string, rowCount: number) => void;
  onCancel: () => void;
}

export function UploadTranscript({ onComplete, onCancel }: UploadTranscriptProps) {
  const [state, setState] = useState<UploadState>("idle");
  const [mode, setMode] = useState<InputMode>("file");
  const [filename, setFilename] = useState("");
  const [rowCount, setRowCount] = useState(0);
  const [pastedText, setPastedText] = useState("");
  const [attribution, setAttribution] = useState<"none" | "speaker">("none");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    // In the prototype we don't actually read the file — simulate row count
    setRowCount(Math.floor(Math.random() * 300) + 80);
    setState("ready");
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.name.endsWith(".txt")) return;
    setFilename(file.name);
    setRowCount(Math.floor(Math.random() * 300) + 80);
    setState("ready");
  }

  function handleProcess() {
    setState("processing");
    // Simulate 1.5s processing
    setTimeout(() => {
      setState("done");
    }, 1500);
  }

  function handlePreparePastedTranscript() {
    const normalized = pastedText.replace(/\r\n/g, "\n");
    const lines = normalized
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    setFilename("Pasted transcript");
    setRowCount(lines.length);
    setState("ready");
  }

  if (state === "done") {
    return (
      <div className="flex flex-col gap-3 p-4 rounded-card border border-settled/30 bg-settled-dim/20">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-settled" />
          <span className="text-fac-field text-text-primary font-medium">Transcript processed</span>
        </div>
        <p className="text-fac-meta text-text-secondary">
          <span className="font-medium">{filename}</span> — {rowCount} segments detected. Reviewing
          for decision candidates…
        </p>
        <button
          onClick={() => onComplete(filename, rowCount)}
          className="self-start px-3 py-1.5 text-fac-meta bg-accent text-white rounded hover:bg-accent/90 transition-colors"
        >
          View candidates
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4 rounded-card border border-border bg-surface">
      <div className="flex items-center gap-2 justify-between">
        <span className="text-fac-field text-text-primary font-medium flex items-center gap-2">
          <Upload size={15} className="text-accent" />
          Add transcript
        </span>
        <button
          onClick={onCancel}
          className="text-text-muted hover:text-text-primary transition-colors"
        >
          <X size={15} />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setMode("file")}
          className={`px-2.5 py-1 rounded text-fac-meta border transition-colors ${
            mode === "file"
              ? "border-accent/40 text-accent bg-accent-dim/20"
              : "border-border text-text-muted hover:text-text-primary"
          }`}
        >
          Upload file
        </button>
        <button
          onClick={() => setMode("paste")}
          className={`px-2.5 py-1 rounded text-fac-meta border transition-colors ${
            mode === "paste"
              ? "border-accent/40 text-accent bg-accent-dim/20"
              : "border-border text-text-muted hover:text-text-primary"
          }`}
        >
          Paste text
        </button>
      </div>

      {state === "idle" && mode === "file" && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center gap-2 py-8 border-2 border-dashed border-border rounded-card cursor-pointer hover:border-accent/50 hover:bg-accent-dim/5 transition-colors"
        >
          <FileText size={24} className="text-text-muted" />
          <p className="text-fac-meta text-text-secondary text-center">
            Drop a <code>.txt</code> file here, or click to browse
          </p>
          <p className="text-fac-meta text-text-muted">No speaker attribution required</p>
          <input
            ref={inputRef}
            type="file"
            accept=".txt"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      )}

      {state === "idle" && mode === "paste" && (
        <div className="flex flex-col gap-2">
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            rows={8}
            placeholder="Paste transcript text here. One line per segment works best."
            className="w-full p-3 rounded border border-border bg-overlay text-fac-meta text-text-primary resize-y focus:outline-none focus:border-accent placeholder:text-text-muted"
          />
          <div className="flex items-center justify-between">
            <p className="text-fac-meta text-text-muted">
              Copy/paste from any live transcript tool.
            </p>
            <button
              onClick={handlePreparePastedTranscript}
              disabled={!pastedText.trim()}
              className="px-3 py-1.5 text-fac-meta bg-accent text-white rounded hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Use pasted transcript
            </button>
          </div>
        </div>
      )}

      {state === "ready" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded border border-border bg-overlay/30">
            <FileText size={14} className="text-accent" />
            <span className="text-fac-meta text-text-primary flex-1 truncate">{filename}</span>
            <span className="text-fac-meta text-text-muted">{rowCount} lines</span>
            <button
              onClick={() => {
                setState("idle");
                setFilename("");
                setRowCount(0);
              }}
              className="text-text-muted hover:text-danger transition-colors"
            >
              <X size={13} />
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-fac-label text-text-secondary uppercase tracking-wider">
              Speaker attribution
            </label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 text-fac-meta text-text-secondary cursor-pointer">
                <input
                  type="radio"
                  name="attr"
                  value="none"
                  checked={attribution === "none"}
                  onChange={() => setAttribution("none")}
                  className="accent-accent"
                />
                None — plain text
              </label>
              <label className="flex items-center gap-2 text-fac-meta text-text-secondary cursor-pointer">
                <input
                  type="radio"
                  name="attr"
                  value="speaker"
                  checked={attribution === "speaker"}
                  onChange={() => setAttribution("speaker")}
                  className="accent-accent"
                />
                Speaker labels present
              </label>
            </div>
          </div>

          <button
            onClick={handleProcess}
            className="self-start flex items-center gap-1.5 px-4 py-2 text-fac-meta bg-accent text-white rounded hover:bg-accent/90 transition-colors"
          >
            Process &amp; detect decisions
          </button>
        </div>
      )}

      {state === "processing" && (
        <div className="flex items-center gap-3 py-4">
          <div className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <span className="text-fac-meta text-text-secondary">
            Processing transcript — detecting decisions…
          </span>
        </div>
      )}
    </div>
  );
}
