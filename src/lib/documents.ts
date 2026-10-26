import { z } from 'zod';

/** Document checklist per lead type (UAE). */
export const documentChecklists: Record<string, string[]> = {
  buyer: ['Passport', 'Emirates ID and visa (if UAE resident)', 'Proof of address', 'Source of funds', 'Mortgage pre-approval letter (if financing)'],
  buyer_company: ['Trade licence', 'Incorporation documents', 'Shareholder register', 'Ultimate beneficial owner (UBO) declaration', 'Board resolution or POA', "Signatory's passport"],
  seller: ['Title deed', 'Passport', 'Emirates ID / visa (if resident)', 'Developer NOC (requested before transfer)', 'Mortgage liability letter (if mortgaged)'],
  landlord: ['Title deed', 'Passport', 'Emirates ID / visa (if resident)'],
  tenant: ['Passport', 'Visa', 'Emirates ID'],
};
export const POA_ITEM = 'Valid Power of Attorney (when signing for someone else)';

export function checklistFor(type: string, opts: { company?: boolean; poa?: boolean } = {}) {
  const base = type === 'buyer' && opts.company ? documentChecklists['buyer_company']! : (documentChecklists[type] ?? []);
  return opts.poa ? [...base, POA_ITEM] : [...base];
}

export const clientNameSchema = z.string().trim().min(1, 'Client name is required').max(200)
  .refine(v => !/[/\\]/.test(v), 'No slashes in client names');

/** Vault folder: one folder per client inside the agency's own folder of the private documents bucket. */
export function clientFolder(agencyId: string, client: string) {
  return `${agencyId}/${client.trim().replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, 100) || 'client'}`;
}
export function documentPath(agencyId: string, client: string, filename: string) {
  const safeFile = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
  return `${clientFolder(agencyId, client)}/${Date.now()}-${safeFile}`;
}
/** A checklist item counts as received when an uploaded file name contains its first word. */
export function documentReceived(item: string, fileNames: string[]) {
  const key = item.split(' ')[0]!.toLowerCase().replace(/[^a-z]/g, '');
  return key.length > 2 && fileNames.some(n => n.toLowerCase().includes(key));
}

/** Compliance records younger than the retention period cannot be deleted on request. */
export function deleteBlocked(uploadedAt: string, retentionYears: number, now = Date.now()) {
  const time = Date.parse(uploadedAt);
  if (!Number.isFinite(time)) return true;
  return now - time < retentionYears * 365.25 * 24 * 60 * 60 * 1000;
}

export const SIGNED_URL_SECONDS = 600; // 10 minutes
