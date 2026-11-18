import { useState } from "react";
import { Share2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SOCIAL_APPS, postCheck, socialCaption, type SocialListing } from "@/lib/social";
import { dubaiToday } from "@/lib/advert";
import { getBrochureContact } from "@/lib/listings.functions";

const contactQuery = queryOptions({
  queryKey: ["brochure-contact"],
  queryFn: () => getBrochureContact(),
});

/**
 * Post a listing on Instagram, Facebook or LinkedIn: the photo is saved to this device and the
 * caption copied, then the app opens. Nothing is posted by the CRM and no account is connected.
 */
export function ListingSocialButton({
  listing,
  photo,
}: {
  listing: SocialListing;
  photo?: string | undefined;
}) {
  const { data: contact, isError: contactFailed } = useQuery(contactQuery);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  // Until the agency details have loaded the check cannot pass, so nothing can be copied.
  const check = contact ? postCheck(listing, contact, dubaiToday()) : null;
  const blocked = !check || check.blockers.length > 0;
  const caption = socialCaption(listing, {
    agency: contact?.agency ?? "",
    agent: contact?.agent ?? "",
    mobile: contact?.mobile ?? "",
    reraBrn: contact?.reraBrn ?? "",
  });

  const copy = async () => {
    setError("");
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Could not copy. Select the caption and copy it by hand.");
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" className="w-full" onClick={() => setOpen(true)}>
        <Share2 className="size-4" />
        Post on Instagram, Facebook or LinkedIn
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogTitle>Post this listing</DialogTitle>
          <DialogDescription>
            Save the photo, copy the caption, then open the app and paste. Nothing is posted for
            you, and no account is connected to the CRM.
          </DialogDescription>
          {!check && (
            <p role={contactFailed ? "alert" : "status"} className="text-sm text-muted-foreground">
              {contactFailed
                ? "Could not check this advert. Close this and try again."
                : "Checking this advert…"}
            </p>
          )}
          {check && check.blockers.length > 0 && (
            <div role="alert" className="space-y-1 text-sm text-destructive">
              <p className="font-semibold">This listing cannot be posted yet:</p>
              <ul className="list-disc space-y-1 ps-5">
                {check.blockers.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          {check && check.warnings.length > 0 && (
            <ul className="list-disc space-y-1 rounded-md bg-secondary py-2 pe-3 ps-8 text-sm">
              {check.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          {!blocked && (
            <>
              <textarea
                aria-label="Caption"
                readOnly
                className="h-60 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={caption}
              />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void copy()}>
                  {copied ? "Caption copied" : "Copy caption"}
                </Button>
                {photo && (
                  <Button asChild size="sm" variant="outline">
                    <a
                      href={photo}
                      download={`${listing.title.slice(0, 60)}.jpg`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Save the photo
                    </a>
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                {SOCIAL_APPS.map((app) => (
                  <Button key={app.key} asChild size="sm" variant="ghost">
                    <a href={app.url} target="_blank" rel="noreferrer">
                      Open {app.label}
                    </a>
                  </Button>
                ))}
              </div>
            </>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
