import { describe, expect, it } from "vitest";
import {
  ALERT_TEMPLATE,
  alertTitle,
  mobileDigits,
  pushMessage,
  templateParams,
  timeAgo,
} from "./alerts";

describe("alerts", () => {
  it("titles each kind", () => {
    expect(alertTitle("assigned")).toBe("New lead for you");
    expect(alertTitle("reminder")).toBe("Lead still waiting");
    expect(alertTitle("pool")).toBe("Lead back in the pool");
  });

  it("builds the phone notification", () => {
    expect(
      pushMessage({ id: "a1", kind: "assigned", message: "New lead for you: Sara", lead_id: "L1" }),
    ).toEqual({
      title: "New lead for you",
      body: "New lead for you: Sara",
      url: "/lead/L1",
      tag: "lead-L1",
    });
    expect(pushMessage({ id: "a2", kind: "pool", message: "x", lead_id: null }).url).toBe("/inbox");
  });

  it("fills template parameters without new lines", () => {
    expect(
      templateParams({ name: "Sara\nK", source: "Bayut", area: "" }, "https://x/lead/1"),
    ).toEqual(["Sara K", "Bayut", "area not given", "https://x/lead/1"]);
  });

  it("keeps the template body valid for Meta", () => {
    expect(ALERT_TEMPLATE.body.startsWith("{{")).toBe(false);
    expect(ALERT_TEMPLATE.body.endsWith("}}")).toBe(false);
    expect(ALERT_TEMPLATE.body.match(/\{\{\d\}\}/g)).toHaveLength(ALERT_TEMPLATE.examples.length);
  });

  it("reads mobile numbers", () => {
    expect(mobileDigits("+971 50 111 2222")).toBe("971501112222");
    expect(mobileDigits("0501112222")).toBe("971501112222");
    expect(mobileDigits("00447700900123")).toBe("447700900123");
    expect(mobileDigits("123")).toBeNull();
  });

  it("says how long ago", () => {
    const now = new Date("2026-11-18T10:00:00Z");
    expect(timeAgo("2026-11-18T09:59:40Z", now)).toBe("now");
    expect(timeAgo("2026-11-18T09:56:00Z", now)).toBe("4 min");
    expect(timeAgo("2026-11-18T07:00:00Z", now)).toBe("3 h");
  });
});
