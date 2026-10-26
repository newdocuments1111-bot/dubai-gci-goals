import { describe, expect, it } from 'vitest';
import { checklistWithStatus, DRAFT_LABEL, paperworkChecklist, paperworkDraft } from './paperwork';

const agency = { name: 'Demo Agency', rera_brn: 'BRN-1', agent_name: 'Sara' };
const listing = { title: 'Marina 2BR', community: 'Dubai Marina', project: 'Marina Gate', property_type: 'apartment', bedrooms: 2, size_sqft: 1200, permit_number: 'TEST-123' };

describe('paperwork', () => {
  it('sale needs Form F; rent needs Ejari documents', () => {
    expect(paperworkChecklist('sale').flatMap(g => g.items)).toContain('Signed Form F (MOU) by buyer, seller and agents');
    expect(paperworkChecklist('rent').flatMap(g => g.items)).toContain('DEWA premise number');
    expect(paperworkChecklist('rent').map(g => g.party)).toEqual(['Tenant', 'Landlord', 'Deal']);
  });
  it('marks vault files as received', () => {
    const groups = checklistWithStatus('rent', ['1700-passport.pdf']);
    expect(groups[0]!.items.find(i => i.item === 'Passport')?.received).toBe(true);
    expect(groups[0]!.items.find(i => i.item === 'Visa')?.received).toBe(false);
  });
  it('Form F draft is pre-filled and always marked as a draft', () => {
    const draft = paperworkDraft({ dealType: 'sale', lead: { name: 'Rehan', phone: '+971500000000' }, listing, deal: { price_aed: 2_000_000, commission_percent: 2, status: 'under offer' }, agency, today: '2026-10-26' });
    expect(draft.title).toContain('Form F');
    expect(draft.text).toContain(DRAFT_LABEL);
    expect(draft.text).toContain('Name: Rehan');
    expect(draft.text).toContain('Sale price: AED 2,000,000');
    expect(draft.text).toContain('Agent commission: 2% (AED 40,000)');
    expect(draft.text).toContain('Seller');
  });
  it('Ejari draft uses the deal price as annual rent', () => {
    const draft = paperworkDraft({ dealType: 'rent', lead: { name: 'Ana', phone: '' }, listing, deal: { price_aed: 120_000, commission_percent: 5, status: 'closed' }, agency });
    expect(draft.title).toContain('Ejari');
    expect(draft.text).toContain('Annual rent: AED 120,000');
    expect(draft.text).toContain('Phone: ________ (agent to fill)');
    expect(DRAFT_LABEL).toBe('Draft – agent must check');
  });
});
