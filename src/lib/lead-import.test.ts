import { describe, expect, it } from "vitest";
import { buildLeads, guessMapping, looksLikeHeader, parseTable, phoneKey } from "./lead-import";

const now = new Date("2026-11-18T10:00:00Z");

describe("lead import", () => {
  it("reads commas, tabs and quoted cells", () => {
    expect(
      parseTable('Name,Phone,Notes\n"Khan, Sara",+971501112222,"said ""call me"""\n\n'),
    ).toEqual([
      ["Name", "Phone", "Notes"],
      ["Khan, Sara", "+971501112222", 'said "call me"'],
    ]);
    expect(parseTable("Name\tMobile\r\nOmar\t0501234567")).toEqual([
      ["Name", "Mobile"],
      ["Omar", "0501234567"],
    ]);
    expect(parseTable("a;b\n1;2")[1]).toEqual(["1", "2"]);
  });

  it("guesses columns from headers", () => {
    const header = [
      "Client Name",
      "Mobile No",
      "Email",
      "Lead Source",
      "Community",
      "Budget (AED)",
      "Comments",
      "Date Received",
    ];
    expect(looksLikeHeader(header)).toBe(true);
    expect(looksLikeHeader(["Sara", "+971501112222"])).toBe(false);
    expect(guessMapping(header)).toMatchObject({
      name: 0,
      phone: 1,
      email: 2,
      source: 3,
      area: 4,
      budget: 5,
      notes: 6,
      date: 7,
    });
  });

  it("cleans leads, skips bad rows and repeats", () => {
    const mapping = guessMapping(["Name", "Phone", "Source", "Area", "Type", "Date"]);
    const r = buildLeads(
      [
        ["Sara", "050 111 2222", "bayut.com", "Marina", "Tenant", "05/11/2026"],
        ["Sara again", "+971501112222", "", "", "", ""],
        ["", "", "", "", "", ""],
        ["Ivan", "12345", "", "", "", ""],
        ["Omar", "", "PF", "JVC", "", "2031-01-01"],
      ],
      mapping,
      { firstRowNumber: 2, now },
    );
    expect(r.leads).toHaveLength(2);
    expect(r.leads[0]).toMatchObject({
      name: "Sara",
      phone: "+971501112222",
      source: "Bayut",
      area: "Marina",
      type: "tenant",
      created_at: "2026-11-05T08:00:00.000Z",
    });
    expect(r.leads[1]).toMatchObject({
      name: "Omar",
      phone: "",
      source: "Property Finder",
      created_at: null,
    });
    expect(r.duplicatesInFile).toBe(1);
    expect(r.skipped.map((s) => s.row)).toEqual([4, 5]);
  });

  it("matches phones written different ways", () => {
    expect(phoneKey("+971 50 111 2222")).toBe(phoneKey("0501112222"));
    expect(phoneKey("00971501112222")).toBe("971501112222");
  });
});
