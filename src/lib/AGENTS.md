# Listings rules (src/lib)

- Listing freshness and future AI eligibility derive from timestamps in the browser-safe listings module; nightly SQL persists the check flag without replacing the exact-time read filter.
- Inventory sources use source/external_id identity and source adapters; connected adapters must upsert inventory before the nightly freshness check, never confirm unchanged listings automatically.
- Listing map fallback, filtering, permit validation and WhatsApp content use browser-safe listings helpers with unit tests; enforce permits again in the database to protect every write path.
- Listing details use their own authenticated route and Embla swipe gallery; duplicated listings copy uploaded photos, videos and floor plans into independent paths so deleting either unit cannot break the other.
- Store shareable photos separately from private videos/floor plans; resolve sharing through an owner-checked function that verifies permanent public access, never copy expiring signed or bundled asset URLs.
- Listing AI detail validation and field definitions live in a browser-safe helper shared by CSV, editor and details views to keep optional values consistent.
