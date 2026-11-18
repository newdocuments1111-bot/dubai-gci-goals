import { describe, expect, it } from "vitest";
import { BOM, actorName, csvCell, exportFileName, toCsv } from "./records";

describe("records", () => {
  it("quotes commas, quotes and new lines", () => {
    expect(csvCell("Marina, 2BR")).toBe('"Marina, 2BR"');
    expect(csvCell('He said "yes"')).toBe('"He said ""yes"""');
    expect(csvCell("a\nb")).toBe('"a\nb"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(true)).toBe("Yes");
    expect(csvCell(2400000)).toBe("2400000");
  });

  it("stops typed text from running as a spreadsheet formula", () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe('"\'=HYPERLINK(""http://x"")"');
    expect(csvCell("+971501234567")).toBe("+971501234567");
    expect(csvCell("+1+cmd|' /C calc'!A0")).toBe("'+1+cmd|' /C calc'!A0");
    expect(csvCell("@sum")).toBe("'@sum");
    expect(csvCell(-5)).toBe("-5");
  });

  it("builds a file with fixed columns in order", () => {
    const csv = toCsv("owners", [
      { name: "Aisha", phone: "+971500000001", kind: "landlord", secret: "not exported" },
    ]);
    const [head, row] = csv.replace(BOM, "").trim().split("\r\n");
    expect(csv.startsWith(BOM)).toBe(true);
    expect(head).toBe(
      "Name,Phone,Kind,Wants to,Step,Area,Building,Asking price (AED),Tenant,Yearly rent (AED),Lease ends,Created",
    );
    expect(row).toBe("Aisha,+971500000001,landlord,,,,,,,,,");
    expect(csv).not.toContain("not exported");
  });

  it("names the file by kind and day", () => {
    expect(exportFileName("leads", new Date("2026-11-18T10:00:00Z"))).toBe("leads-2026-11-18.csv");
  });

  it("names who did it", () => {
    const members = [{ user_id: "u1", display_name: "", email: "sara@x.ae" }];
    expect(actorName("u1", members)).toBe("sara@x.ae");
    expect(actorName(null, members)).toBe("The app");
    expect(actorName("gone", members)).toBe("Former team member");
  });
});
