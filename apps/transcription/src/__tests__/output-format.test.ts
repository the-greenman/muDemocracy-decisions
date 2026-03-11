import { describe, expect, it } from "vitest";
import { formatEventPreviewLine, formatEventsAsSrt, formatEventsAsText } from "../output-format.js";

describe("output formatters", () => {
  it("formats transcript events as plain text", () => {
    const text = formatEventsAsText([
      { text: " First line " },
      { text: "Second line" },
      { text: "   " },
    ]);

    expect(text).toBe("First line\nSecond line");
  });

  it("formats transcript events as srt", () => {
    const srt = formatEventsAsSrt([
      {
        text: "Hello world",
        startTimeSeconds: 1.25,
        endTimeSeconds: 3.5,
      },
      {
        text: "Follow-up",
        startTimeSeconds: 4,
      },
    ]);

    expect(srt).toBe(
      [
        "1",
        "00:00:01,250 --> 00:00:03,500",
        "Hello world",
        "",
        "2",
        "00:00:04,000 --> 00:00:06,000",
        "Follow-up",
        "",
      ].join("\n"),
    );
  });

  it("formats preview line with timestamps", () => {
    const line = formatEventPreviewLine(3, {
      text: "Decision text",
      startTimeSeconds: 9,
      endTimeSeconds: 12,
    });

    expect(line).toBe("3. [00:00:09 -> 00:00:12] Decision text");
  });
});
