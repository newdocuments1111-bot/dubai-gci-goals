import { describe, expect, it } from "vitest";
import { isOwnerEmail } from "./owner";

describe("owner access", () => {
  it("allows the owner email (any case)", () => {
    expect(isOwnerEmail("newdocuments1111@gmail.com")).toBe(true);
    expect(isOwnerEmail(" NewDocuments1111@gmail.com ")).toBe(true);
  });
  it("blocks anyone else or no email", () => {
    expect(isOwnerEmail("someone@gmail.com")).toBe(false);
    expect(isOwnerEmail(null)).toBe(false);
    expect(isOwnerEmail("")).toBe(false);
  });
});
