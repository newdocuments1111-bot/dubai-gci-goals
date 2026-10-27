import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

const URL = "https://dubai-gci-goals.lovable.app/privacy";
const EMAIL = "newdocuments1111@gmail.com";
const Mail = () => <a href={`mailto:${EMAIL}`} className="text-primary underline">{EMAIL}</a>;

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Elite Visions | Dubai AI GCI" },
      { name: "description", content: "How Elite Visions collects, uses and protects personal information in the AI Vision app and WhatsApp service." },
      { property: "og:title", content: "Privacy Policy — Elite Visions" },
      { property: "og:description", content: "How Elite Visions handles personal information, WhatsApp messages and data deletion requests." },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: PrivacyPage,
});

function S({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return <section id={id} className="space-y-3"><h2 className="text-xl font-semibold">{title}</h2>{children}</section>;
}
function L({ items, ordered }: { items: ReactNode[]; ordered?: boolean }) {
  const Tag = ordered ? "ol" : "ul";
  return <Tag className={`${ordered ? "list-decimal" : "list-disc"} space-y-1 pl-6`}>{items.map((x, i) => <li key={i}>{x}</li>)}</Tag>;
}

function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link to="/" className="text-sm text-muted-foreground hover:underline">← Dubai AI GCI</Link>
      <article className="mt-6 space-y-8 leading-relaxed text-foreground">
        <header className="space-y-1">
          <h1 className="text-3xl font-bold">Privacy Policy</h1>
          <p>Elite Visions (Udyam Registration No. UDYAM-AP-24-0073483)</p>
          <p>56/59, Bhattu Street, Rayachoty, Annamayya District, Andhra Pradesh 516269, India</p>
          <p>Contact: <Mail /> · +91 99896 49633</p>
          <p className="text-sm text-muted-foreground">Last updated: 27 October 2026</p>
        </header>
        <p>This policy explains how Elite Visions ("we", "us") collects, uses and protects personal information when you use our website (elitevisions.in), our AI Vision app, and the WhatsApp messaging service we operate for real estate agencies.</p>
        <S title="1. Who we are and our role"><p>Elite Visions builds AI tools for real estate agencies. When a buyer, tenant, landlord or seller messages a real estate agency that uses our service (for example on WhatsApp), we process that conversation on behalf of that agency. In that case the agency decides how your information is used, and we act as its service provider. For our own website and for agencies who sign up with us, we decide how information is used.</p></S>
        <S title="2. Information we collect"><L items={[
          "Contact details: name, phone number, WhatsApp profile name, email address.",
          "Messages: the text, voice notes, images, documents and locations you send to an agency through our service, and the replies sent to you.",
          "Property preferences: budget, preferred areas, property type, timing and similar details you share in the conversation.",
          "Viewing and deal information: viewing appointments, offers and documents needed to complete a property transaction, where you choose to share them.",
          "Consent records: whether you agreed to receive messages, and when you asked us to stop.",
          "Agency user accounts: name, email and login details of agency owners and agents who use our app.",
          "Technical data: basic logs such as message delivery status, dates and times, used to run and secure the service.",
        ]} /></S>
        <S title="3. How we use information"><L items={[
          "To reply to your enquiry and answer questions about properties listed by the agency.",
          "To book, remind you about and follow up on property viewings.",
          "To keep the agency's records up to date so the right agent can help you.",
          "To send messages you have agreed to receive, such as updates about matching properties, payment reminders or tenancy renewals.",
          "To meet legal duties such as anti-money-laundering checks that the agency must carry out.",
          "To keep the service secure, fix problems and improve it.",
        ]} /><p>We do not sell your personal information, and we do not use your messages for advertising.</p></S>
        <S title="4. AI processing"><p>Replies in conversations may be written by an AI assistant on behalf of the agency, and voice notes may be transcribed into text. A human agent from the agency can see the conversation and take over at any time. The assistant does not make binding offers or negotiate prices on anyone's behalf.</p></S>
        <S title="5. WhatsApp"><p>Our messaging service uses the WhatsApp Business Platform provided by Meta. Messages pass through Meta's systems in line with WhatsApp's own terms and privacy policy. We only message you on WhatsApp after you contact the agency, or if you have agreed to receive messages. You can reply STOP at any time and we will not message you again.</p></S>
        <S title="6. Who we share information with"><L items={[
          "The real estate agency you contacted, and its agents.",
          "Service providers who host or run parts of our service (for example cloud hosting, database, AI and messaging providers), only as needed to provide it.",
          "Authorities, where the law requires it.",
        ]} /></S>
        <S title="7. How long we keep information"><p>We keep information only as long as needed for the purposes above, or as long as the agency or the law requires (for example, record-keeping rules for property transactions). When it is no longer needed, it is deleted or anonymised.</p></S>
        <S title="8. Security"><p>We use access controls so each agency sees only its own data, encrypted connections, and private storage for documents with access logs. No system is completely secure, but we work to protect your information.</p></S>
        <S title="9. Your rights"><p>Depending on where you live (including under India's Digital Personal Data Protection Act, 2023 and the UAE Personal Data Protection Law), you may ask to access, correct or delete your personal information, or withdraw your consent to messages. Contact us using the details below; if your request concerns an agency's records, we will pass it to that agency and help it respond.</p></S>
        <S id="delete-data" title="10. How to delete your data"><p>To ask us to delete your information:</p><L ordered items={[
          <>Email <Mail /> with the subject "Delete my data", and include the phone number you used on WhatsApp; or</>,
          "Reply STOP in the WhatsApp conversation, then send the email above.",
        ]} /><p>We will confirm and complete the deletion within 30 days, except for information we must keep by law.</p></S>
        <S title="11. Children"><p>Our service is meant for adults involved in property transactions. We do not knowingly collect information from children.</p></S>
        <S title="12. Changes to this policy"><p>We may update this policy. The "Last updated" date at the top shows when it last changed.</p></S>
        <S title="13. Contact"><p>Elite Visions, 56/59, Bhattu Street, Rayachoty, Annamayya District, Andhra Pradesh 516269, India</p><p>Email: <Mail /> · Phone: +91 99896 49633</p></S>
      </article>
    </main>
  );
}
