import { z } from 'zod';

export const nearbyFields = [
  ['nearby_schools', 'Schools / nurseries'], ['nearby_parks', 'Parks'], ['nearby_clinics', 'Clinics'],
  ['nearby_metro', 'Metro'], ['nearby_malls', 'Malls'], ['nearby_beach', 'Beach'], ['nearby_supermarket', 'Supermarket'],
] as const;
export const amenityFields = [['amenity_pool', 'Pool'], ['amenity_gym', 'Gym'], ['amenity_kids_play_area', 'Kids’ play area'], ['amenity_security', 'Security']] as const;
export const aiTextFields = [
  ['floor', 'Floor'], ['view', 'View'], ['agent_highlights', 'Agent highlights'], ['do_not_mention', 'Do not mention'],
] as const;
const text = z.string().max(10000).default('');
const url = z.string().max(2000).refine(v => !v || /^https:\/\//i.test(v), 'Use an https:// link').default('');
export const aiDetailsSchema = z.object({
  nearby_schools: text, nearby_parks: text, nearby_clinics: text, nearby_metro: text, nearby_malls: text, nearby_beach: text, nearby_supermarket: text,
  amenity_pool: z.boolean().nullable().default(null), amenity_gym: z.boolean().nullable().default(null),
  amenity_kids_play_area: z.boolean().nullable().default(null), amenity_security: z.boolean().nullable().default(null),
  parking_spaces: z.number().int().min(0).max(100).nullable().default(null), floor: text, view: text,
  furnishing: z.enum(['', 'furnished', 'unfurnished']).default(''), developer: text, payment_plan: text,
  construction_percent: z.number().finite().min(0).max(100).nullable().default(null),
  service_charge_aed_sqft_year: z.number().finite().min(0).nullable().default(null), video_tour_url: url,
  floor_plan: z.string().max(2000).refine(v => !v || /^listings\/[a-zA-Z0-9/_\-.]+$/.test(v) || /^https:\/\//i.test(v), 'Invalid floor plan').default(''),
  agent_highlights: text, do_not_mention: text,
});
export const aiCsvColumns = Object.keys(aiDetailsSchema.shape);
export const optionalNumber = (value: string) => value.trim() === '' ? null : Number(value);
export function optionalBoolean(value?: string) {
  if (!value?.trim()) return null;
  if (/^(true|yes|1)$/i.test(value.trim())) return true;
  if (/^(false|no|0)$/i.test(value.trim())) return false;
  throw new Error('Amenities must be true/false, yes/no or blank.');
}