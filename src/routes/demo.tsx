import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Send, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendDemoMessage, getDemoAllowance } from "@/lib/demo.functions";
import apartment from "@/assets/sample-apartment.jpg";
const allowanceQuery = queryOptions({ queryKey: ["demo-allowance"], queryFn: () => getDemoAllowance(), staleTime: 0 });

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Try the AI — Live WhatsApp demo | Elite Visions" },
      {
        name: "description",
        content: "Chat like a Dubai property buyer and see how the AI answers, matches listings and books viewings.",
      },
      { property: "og:title", content: "Try the AI — Live WhatsApp demo" },
      { property: "og:description", content: "Chat like a Dubai property buyer and see how the AI answers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(allowanceQuery),
  component: DemoPage,
});
function DemoPage() {
  const send = useServerFn(sendDemoMessage);
  const { data: allowance } = useSuspenseQuery(allowanceQuery);
  const [messages, setMessages] = useState<{ role: "client" | "ai"; content: string }[]>([]);
  const [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [remaining, setRemaining] = useState(allowance.remaining);
  const submit = async () => {
    if (!text.trim() || busy || remaining <= 0) return;
    setBusy(true);
    setError("");
    const content = text.trim();
    try {
      const result = await send({ data: { message: content, history: messages.slice(-40) } });
      setMessages((prev) => [...prev, { role: "client", content }, { role: "ai", content: result.reply }]);
      setRemaining(result.remaining);
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reply.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="mb-5">
        <Link to="/">
          <ArrowLeft className="size-4" />
          Dubai AI GCI
        </Link>
      </Button>
      <header className="mb-6 flex items-center gap-4">
        <img src={apartment} alt="Dubai apartment" width={80} height={80} className="size-20 rounded-lg object-cover" />
        <div>
          <h1 className="text-3xl font-bold">Demo Agency</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live demo: write like a buyer on WhatsApp and see how the AI replies. Listings belong to a demo agency.
          </p>
        </div>
      </header>
      <section aria-label="Demo conversation" className="min-h-64 space-y-3 border-y border-border py-5">
        <p className="max-w-xl text-sm">Welcome to Demo Agency 👋 Tell us what you are looking for in Dubai.</p>
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "client" ? "justify-end" : "justify-start"}`}>
            <p
              className={`max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm ${m.role === "client" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
            >
              {m.content}
            </p>
          </div>
        ))}
        {busy && (
          <p role="status" className="text-sm text-muted-foreground">
            Replying…
          </p>
        )}
      </section>
      <form
        className="mt-4 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <textarea
          aria-label="Demo message"
          placeholder="Your message…"
          rows={2}
          maxLength={2000}
          className="min-w-0 flex-1 resize-y rounded-md border border-input bg-background px-3 py-2"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
        />
        <Button type="submit" aria-label="Send demo message" disabled={busy || !text.trim() || remaining <= 0}>
          <Send className="size-4" />
        </Button>
      </form>
      <p className="mt-2 text-xs text-muted-foreground">{remaining} of 20 messages remaining today</p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </main>
  );
}
