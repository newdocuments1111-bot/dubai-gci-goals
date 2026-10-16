import { describe, expect, it } from "vitest";
import { scoreFromSigns } from "./leads";

describe("lead score", () => {
  it("3 signs is hot", () => expect(scoreFromSigns({ budget: "2M", location: "Marina", moveIn: "June" })).toBe("hot"));
  it("2 signs is warm", () => expect(scoreFromSigns({ budget: "2M", location: "Marina", moveIn: null })).toBe("warm"));
  it("1 sign is cold", () => expect(scoreFromSigns({ budget: "2M", location: null, moveIn: null })).toBe("cold"));
  it("0 signs is cold", () => expect(scoreFromSigns({ budget: null, location: "", moveIn: null })).toBe("cold"));
});
