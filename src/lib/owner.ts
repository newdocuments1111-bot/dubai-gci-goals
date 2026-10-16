/** The only account allowed to see real HubSpot leads. */
export const OWNER_EMAIL = "newdocuments1111@gmail.com";

export function isOwnerEmail(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase() === OWNER_EMAIL;
}
