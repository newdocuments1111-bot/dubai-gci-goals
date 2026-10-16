import type { Lead } from "./leads";

/** Made-up sample leads shown to visitors. Not real people. */
export const DEMO_LEADS: Lead[] = [
  { id: "demo-1", name: "Sample Buyer A", email: null, url: null, score: "hot",
    signs: { budget: "AED 2.5M", location: "Dubai Marina", moveIn: "Within 3 months" },
    nextStep: "Send 3 Dubai Marina listings around AED 2.5M and book a viewing." },
  { id: "demo-2", name: "Sample Buyer B", email: null, url: null, score: "warm",
    signs: { budget: "AED 1.2M – 1.5M", location: "JVC", moveIn: null },
    nextStep: "Call to ask when they plan to buy or move in." },
  { id: "demo-3", name: "Sample Buyer C", email: null, url: null, score: "cold",
    signs: { budget: null, location: "Downtown", moveIn: null },
    nextStep: "Ask about their budget and timing before sending listings." },
];
