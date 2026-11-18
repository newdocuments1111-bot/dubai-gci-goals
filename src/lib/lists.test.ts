import { describe, expect, it } from "vitest";
import {
  EMPTY_FILTER,
  applyFilter,
  filterSchema,
  isFiltered,
  suggestName,
  type ListLead,
} from "./lists";

const lead = (o: Partial<ListLead>): ListLead => ({
  name: "Sara Khan",
  phone: "+971501112222",
  area: "Dubai Marina",
  budget: "2.1M",
  score: "Hot",
  source: "Bayut",
  type: "buyer",
  stage: 4,
  outcome: "open",
  first_reply_at: "2026-11-18T08:00:00Z",
  assigned_agent_id: "a1",
  ...o,
});
const leads = [
  lead({}),
  lead({
    name: "Ivan",
    score: "Cold",
    source: "Website",
    stage: 1,
    first_reply_at: null,
    assigned_agent_id: null,
    area: "JVC",
  }),
  lead({ name: "Old", outcome: "lost" }),
];

describe("lead lists", () => {
  it("shows open leads by default", () => {
    expect(applyFilter(leads, EMPTY_FILTER).map((l) => l.name)).toEqual(["Sara Khan", "Ivan"]);
    expect(isFiltered(EMPTY_FILTER)).toBe(false);
  });

  it("filters by score, step, reply, pool and search", () => {
    const f = (o: object) => filterSchema.parse(o);
    expect(applyFilter(leads, f({ score: "Hot" }))).toHaveLength(1);
    expect(applyFilter(leads, f({ step: "new" })).map((l) => l.name)).toEqual(["Ivan"]);
    expect(applyFilter(leads, f({ reply: "waiting" })).map((l) => l.name)).toEqual(["Ivan"]);
    expect(applyFilter(leads, f({ agent: "pool" })).map((l) => l.name)).toEqual(["Ivan"]);
    expect(applyFilter(leads, f({ q: "marina" })).map((l) => l.name)).toEqual(["Sara Khan"]);
    expect(applyFilter(leads, f({ q: "1112222", outcome: "all" }))).toHaveLength(3);
    expect(applyFilter(leads, f({ outcome: "lost" })).map((l) => l.name)).toEqual(["Old"]);
  });

  it("drops unknown saved values instead of failing", () => {
    expect(filterSchema.safeParse({ score: "Boiling" }).success).toBe(false);
    expect(filterSchema.parse({ q: "x", extra: 1 })).toMatchObject({ q: "x", outcome: "open" });
  });

  it("suggests a list name", () => {
    expect(suggestName(filterSchema.parse({ score: "Hot", source: "Bayut", q: "Marina" }))).toBe(
      "Hot · Bayut · Marina",
    );
    expect(isFiltered(filterSchema.parse({ score: "Hot" }))).toBe(true);
  });
});
