import { describe, expect, it } from "vitest";
import { icsEvent, viewingEvent } from "./calendar";

describe("calendar files", () => {
  it("writes a valid event in UTC with a reminder", () => {
    const ics = icsEvent({
      id: "v1",
      title: "Viewing · Sara; Marina, 2BR",
      startIso: "2026-11-21T07:00:00Z",
      minutes: 30,
      location: "Marina Gate",
      now: new Date("2026-11-18T10:00:00Z"),
    });
    const lines = ics.split("\r\n");
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines.at(-1)).toBe("END:VCALENDAR");
    expect(lines).toContain("DTSTART:20261121T070000Z");
    expect(lines).toContain("DTEND:20261121T073000Z");
    expect(lines).toContain("DTSTAMP:20261118T100000Z");
    expect(lines).toContain("SUMMARY:Viewing · Sara\\; Marina\\, 2BR");
    expect(lines).toContain("TRIGGER:-PT1H");
  });

  it("folds long lines and names the viewing", () => {
    const ics = viewingEvent({
      id: "v2",
      kind: "viewing",
      starts_at: "2026-11-21T07:00:00Z",
      leadName: "Sara Khan",
      listingTitle:
        "A very long listing title that goes on and on past the limit of one calendar line",
      community: "Dubai Marina",
    });
    expect(ics.split("\r\n").every((l) => l.length <= 75)).toBe(true);
    expect(ics).toContain("SUMMARY:Viewing · Sara Khan");
  });
});
