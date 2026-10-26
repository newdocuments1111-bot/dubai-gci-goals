import { describe, expect, it } from 'vitest';
import { marketInsights } from './market';

describe('market insights', () => {
  it('averages price per sq ft by area, type and month, with the month-on-month trend', () => {
    const rows = [
      { area: 'Dubai Marina', property_type: 'apartment', transaction_date: '2026-08-03', size_sqft: 1000, price_aed: 2_000_000 },
      { area: 'Dubai Marina', property_type: 'apartment', transaction_date: '2026-08-20', size_sqft: 1000, price_aed: 2_200_000 },
      { area: 'Dubai Marina', property_type: 'apartment', transaction_date: '2026-09-10', size_sqft: 1000, price_aed: 2_310_000 },
      { area: 'Dubai Marina', property_type: 'villa', transaction_date: '2026-09-10', size_sqft: 0, price_aed: 9_000_000 },
      { area: 'JVC', property_type: '', transaction_date: '2026-09-01', size_sqft: 800, price_aed: 800_000 },
    ];
    const result = marketInsights(rows);
    expect(result).toHaveLength(2);
    const marina = result[0]!;
    expect(marina.months).toEqual([{ month: '2026-08', avgPpsf: 2100, count: 2 }, { month: '2026-09', avgPpsf: 2310, count: 1 }]);
    expect(marina.trendPct).toBe(10);
    expect(result[1]).toMatchObject({ area: 'JVC', propertyType: 'Any type', latestPpsf: 1000, trendPct: null });
  });
});
