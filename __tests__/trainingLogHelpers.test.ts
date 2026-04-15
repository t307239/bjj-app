import { describe, it, expect } from "vitest";
import {
  formatDuration,
  encodeCompNotes,
  decodeCompNotes,
  encodeRollNotes,
  decodeRollNotes,
  formatRollBadge,
  buildXShareUrl,
  emptyCompData,
  COMP_PREFIX,
  ROLL_PREFIX,
} from "@/lib/trainingLogHelpers";

describe("formatDuration", () => {
  it("formats minutes under 60", () => {
    expect(formatDuration(45)).toBe("45m");
  });

  it("formats exact hours", () => {
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(120)).toBe("2h");
  });

  it("formats hours with minutes", () => {
    expect(formatDuration(90)).toBe("1h30m");
    expect(formatDuration(75)).toBe("1h15m");
  });

  it("formats 0 minutes", () => {
    expect(formatDuration(0)).toBe("0m");
  });
});

describe("encodeCompNotes / decodeCompNotes", () => {
  const comp = {
    result: "win",
    opponent: "Tanaka",
    finish: "arm bar",
    event: "Local Open",
    opponent_rank: "blue",
    gi_type: "gi",
  };

  it("encodes comp data with user notes", () => {
    const encoded = encodeCompNotes(comp, "Great match!");
    expect(encoded).toContain(COMP_PREFIX);
    expect(encoded).toContain("Great match!");
  });

  it("encodes comp data without user notes", () => {
    const encoded = encodeCompNotes(comp, "");
    expect(encoded.startsWith(COMP_PREFIX)).toBe(true);
    expect(encoded).not.toContain("\n");
  });

  it("returns only user notes when comp data is empty", () => {
    const emptyComp = emptyCompData();
    expect(encodeCompNotes(emptyComp, "Just notes")).toBe("Just notes");
  });

  it("round-trips comp data with notes", () => {
    const encoded = encodeCompNotes(comp, "Post-match thoughts");
    const decoded = decodeCompNotes(encoded);
    expect(decoded.comp).toEqual(comp);
    expect(decoded.userNotes).toBe("Post-match thoughts");
  });

  it("round-trips comp data without notes", () => {
    const encoded = encodeCompNotes(comp, "");
    const decoded = decodeCompNotes(encoded);
    expect(decoded.comp).toEqual(comp);
    expect(decoded.userNotes).toBe("");
  });

  it("returns null comp for plain notes", () => {
    const decoded = decodeCompNotes("Just regular notes");
    expect(decoded.comp).toBeNull();
    expect(decoded.userNotes).toBe("Just regular notes");
  });

  it("returns null comp for empty string", () => {
    const decoded = decodeCompNotes("");
    expect(decoded.comp).toBeNull();
  });

  it("handles malformed JSON gracefully", () => {
    const decoded = decodeCompNotes(`${COMP_PREFIX}{invalid json}`);
    expect(decoded.comp).toBeNull();
  });
});

describe("encodeRollNotes / decodeRollNotes", () => {
  it("encodes roll metadata with user notes", () => {
    const encoded = encodeRollNotes("flow", "blue", "similar", "Good rolls");
    expect(encoded).toContain(ROLL_PREFIX);
    expect(encoded).toContain("Good rolls");
  });

  it("returns only notes when no metadata provided", () => {
    expect(encodeRollNotes("", "", "", "Just notes")).toBe("Just notes");
  });

  it("round-trips roll metadata", () => {
    const encoded = encodeRollNotes("hard", "purple", "heavier", "Tough round", "Shoyoroll");
    const decoded = decodeRollNotes(encoded);
    expect(decoded.roll).toEqual({
      focus: "hard",
      partner_belt: "purple",
      size_diff: "heavier",
      gi_name: "Shoyoroll",
    });
    expect(decoded.userNotes).toBe("Tough round");
  });

  it("handles missing gi_name", () => {
    const encoded = encodeRollNotes("flow", "white", "lighter", "Light roll");
    const decoded = decodeRollNotes(encoded);
    expect(decoded.roll?.gi_name).toBeUndefined();
    expect(decoded.userNotes).toBe("Light roll");
  });

  it("returns null for plain notes", () => {
    const decoded = decodeRollNotes("No prefix here");
    expect(decoded.roll).toBeNull();
  });
});

describe("formatRollBadge", () => {
  it("formats a full roll badge", () => {
    const badge = formatRollBadge({
      focus: "flow",
      partner_belt: "blue",
      size_diff: "heavier",
    });
    expect(badge).toContain("Flow");
    expect(badge).toContain("Blue Belt");
    expect(badge).toContain("Heavier");
  });

  it("formats with gi name", () => {
    const badge = formatRollBadge({
      focus: "hard",
      partner_belt: "",
      size_diff: "",
      gi_name: "Shoyoroll",
    });
    expect(badge).toContain("Hard Roll");
    expect(badge).toContain("Shoyoroll");
  });

  it("returns empty string when no metadata", () => {
    expect(formatRollBadge({ focus: "", partner_belt: "", size_diff: "" })).toBe("");
  });
});

describe("buildXShareUrl", () => {
  it("generates a valid X share URL", () => {
    const url = buildXShareUrl({
      date: "2026-04-15",
      duration_min: 90,
      type: "gi",
      notes: "Worked on guard passing",
    });
    expect(url).toContain("https://x.com/intent/tweet");
    expect(url).toContain(encodeURIComponent("1h30m"));
    expect(url).toContain(encodeURIComponent("Gi"));
    expect(url).toContain(encodeURIComponent("Worked on guard passing"));
  });

  it("omits notes line when notes are empty", () => {
    const url = buildXShareUrl({
      date: "2026-04-15",
      duration_min: 60,
      type: "nogi",
      notes: "",
    });
    expect(url).not.toContain(encodeURIComponent("📝"));
  });

  it("formats sub-hour duration as minutes", () => {
    const url = buildXShareUrl({
      date: "2026-04-15",
      duration_min: 30,
      type: "drilling",
      notes: "",
    });
    expect(url).toContain(encodeURIComponent("30m"));
  });
});

describe("emptyCompData", () => {
  it("returns all empty strings", () => {
    const data = emptyCompData();
    Object.values(data).forEach((v) => {
      expect(v).toBe("");
    });
  });
});
