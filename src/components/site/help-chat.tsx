"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUp, Headset, MessageCircle, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { whatsappUrl, type ChatAnswer, type FaqLike } from "@/lib/chatbot";
import type { Settings } from "@/server/settings/schemas";
import { useLeadDialog } from "./lead-dialog";
import { useT } from "./texts";

type ChatConfig = Settings["chat"];
type QuickReply = ChatConfig["quickReplies"][number];
type Msg = {
  id: number;
  from: "bot" | "user";
  text: string;
  href?: string;
  links?: ChatAnswer["links"];
  related?: FaqLike[];
  /** Show the quick buttons under this message (the greeting). */
  quick?: boolean;
  /** Offer the expert and WhatsApp buttons in this message. */
  handoff?: boolean;
};

const isExternal = (href: string) => /^https?:\/\//.test(href);

/**
 * Help chat: the guided chatbot at the bottom right of every website page (Website settings › Help chat).
 * Answers come from the FAQs and the catalogue through app/api/chat; no AI is involved.
 */
export function HelpChat({ config, whatsappNumber, businessHours }: { config: ChatConfig; whatsappNumber: string; businessHours: string }) {
  const t = useT();
  const { open: openLead } = useLeadDialog();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const nextId = useRef(1);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const wa = config.whatsapp ? whatsappUrl(whatsappNumber, config.whatsappMessage) : null;

  const greet = (): Msg[] => [{ id: nextId.current++, from: "bot", text: config.greeting, quick: true }];
  const push = (...m: Omit<Msg, "id">[]) => setMsgs((cur) => [...cur, ...m.map((x) => ({ ...x, id: nextId.current++ }))]);

  // The greeting appears the first time the chat opens; the conversation then stays while the visitor browses.
  useEffect(() => {
    if (!open) return;
    setMsgs((cur) => (cur.length ? cur : greet()));
    const id = window.setTimeout(() => input.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => { window.clearTimeout(id); window.removeEventListener("keydown", onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when it opens or closes
  }, [open]);

  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [msgs, busy]);

  const ask = async (q: string) => {
    const question = q.trim().slice(0, 200);
    if (!question || busy) return;
    push({ from: "user", text: question });
    setText("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q: question }) });
      const data = (await res.json().catch(() => null)) as (ChatAnswer & { error?: string }) | null;
      if (!res.ok || !data || !("links" in data)) {
        push({ from: "bot", text: data?.error || t("chat.error"), handoff: true });
      } else if (data.faq) {
        push({ from: "bot", text: data.faq.answer, related: data.related, links: data.links.slice(0, 3) });
      } else if (data.links.length || data.related.length) {
        push({ from: "bot", text: t("chat.found"), links: data.links, related: data.related, handoff: true });
      } else {
        push({ from: "bot", text: t("chat.noAnswer"), handoff: true });
      }
    } catch {
      push({ from: "bot", text: t("chat.error"), handoff: true });
    } finally {
      setBusy(false);
    }
  };

  const showFaq = (f: FaqLike) => push({ from: "user", text: f.question }, { from: "bot", text: f.answer });

  const quick = (r: QuickReply) => {
    if (r.action === "expert") return openLead({ source: "GET_ADVICE" });
    if (r.action === "whatsapp") return wa ? void window.open(wa, "_blank", "noopener") : openLead({ source: "GET_ADVICE" });
    if (r.action === "search" || (!r.answer && !r.href)) return void ask(r.label);
    push({ from: "user", text: r.label }, { from: "bot", text: r.answer || r.label, href: r.href || undefined });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void ask(text);
  };

  const restart = () => {
    setMsgs(greet());
    setText("");
    input.current?.focus();
  };

  const LinkButton = ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    isExternal(href) ? (
      <a href={href} target="_blank" rel="noopener" className={className}>{children}</a>
    ) : (
      <Link href={href} className={className} onClick={() => window.innerWidth < 640 && setOpen(false)}>{children}</Link>
    );

  const handoff = (
    <div className="mt-2 flex flex-wrap gap-2">
      <button type="button" onClick={() => openLead({ source: "GET_ADVICE" })} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90">
        <Headset className="h-3.5 w-3.5" aria-hidden />{t("chat.expert")}
      </button>
      {wa && (
        <a href={wa} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:border-primary/50">
          <MessageCircle className="h-3.5 w-3.5 text-[#25D366]" aria-hidden />{t("chat.whatsapp")}
        </a>
      )}
    </div>
  );

  return (
    <div data-no-motion className={cn(!config.showOnMobile && "hidden sm:block")}>
      {open && (
        <section
          id="cg-help-chat"
          role="dialog"
          aria-label={config.title}
          className="cg-chat-panel fixed right-3 z-[56] flex w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-panel border border-line bg-surface text-ink shadow-[0_24px_60px_-20px_rgb(var(--color-ink)/0.45)] sm:right-5"
          style={{ bottom: "calc(var(--cg-tray-h, 0px) + 5.25rem)", height: "min(34rem, calc(100dvh - var(--cg-tray-h, 0px) - 7rem))" }}
        >
          <header className="flex items-center gap-3 bg-primary px-4 py-3 text-white">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15" aria-hidden><Headset className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-sans text-[15px] font-semibold text-white">{config.title}</h2>
              {businessHours && <p className="truncate text-xs text-white/75">{t("chat.hours", { hours: businessHours })}</p>}
            </div>
            <button type="button" onClick={restart} className="rounded-full p-1.5 text-white/80 hover:bg-white/15 hover:text-white" aria-label={t("chat.restart")} title={t("chat.restart")}><RotateCcw className="h-4 w-4" /></button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1.5 text-white/80 hover:bg-white/15 hover:text-white" aria-label={t("chat.close")}><X className="h-5 w-5" /></button>
          </header>

          <div ref={list} className="show-scrollbar flex-1 space-y-3 overflow-y-auto bg-bg px-4 py-4" aria-live="polite">
            {msgs.map((m) =>
              m.from === "user" ? (
                <p key={m.id} className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-white">
                  <span className="sr-only">{t("chat.you")}: </span>{m.text}
                </p>
              ) : (
                <div key={m.id} className="max-w-[92%]">
                  <div className="rounded-2xl rounded-bl-md border border-line bg-surface px-3.5 py-2.5 text-sm leading-relaxed">
                    <p className="whitespace-pre-line">{m.text}</p>
                    {m.href && (
                      <LinkButton href={m.href} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                        {t("chat.openLink")}<ArrowRight className="h-3.5 w-3.5" aria-hidden />
                      </LinkButton>
                    )}
                    {m.links && m.links.length > 0 && (
                      <div className="mt-2">
                        {m.text !== t("chat.found") && <p className="mb-1 text-xs font-semibold text-muted">{t("chat.suggestions")}</p>}
                        <ul className="space-y-1">
                          {m.links.map((l) => (
                            <li key={l.href}>
                              <LinkButton href={l.href} className="group flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 hover:border-primary/50 hover:bg-primary-soft/40">
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate font-medium">{l.label}</span>
                                  {l.meta && <span className="block truncate text-xs text-muted">{l.meta}</span>}
                                </span>
                                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted group-hover:text-primary" aria-hidden />
                              </LinkButton>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {m.related && m.related.length > 0 && (
                      <div className="mt-2">
                        <p className="mb-1 text-xs font-semibold text-muted">{t("chat.related")}</p>
                        <ul className="space-y-1">
                          {m.related.map((f) => (
                            <li key={f.question}><button type="button" onClick={() => showFaq(f)} className="text-left text-sm text-primary hover:underline">{f.question}</button></li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {m.handoff && (
                      <div className="mt-2 border-t border-line pt-2">
                        <p className="text-xs text-muted">{t("chat.handoff")}</p>
                        {handoff}
                      </div>
                    )}
                  </div>
                  {m.quick && config.quickReplies.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {config.quickReplies.map((r, i) => (
                        <button key={i} type="button" onClick={() => quick(r)} className="rounded-full border border-primary/40 bg-surface px-3 py-1.5 text-left text-xs font-semibold text-primary transition hover:bg-primary hover:text-white">
                          {r.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ),
            )}
            {busy && (
              <div className="flex w-fit gap-1 rounded-2xl rounded-bl-md border border-line bg-surface px-3.5 py-3" aria-hidden>
                <span className="cg-chat-dot h-1.5 w-1.5 rounded-full bg-muted" />
                <span className="cg-chat-dot h-1.5 w-1.5 rounded-full bg-muted [animation-delay:150ms]" />
                <span className="cg-chat-dot h-1.5 w-1.5 rounded-full bg-muted [animation-delay:300ms]" />
              </div>
            )}
          </div>

          <form onSubmit={submit} className="flex items-center gap-2 border-t border-line bg-surface p-3">
            <input
              ref={input}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={200}
              placeholder={t("chat.placeholder")}
              aria-label={t("chat.placeholder")}
              className="h-10 min-w-0 flex-1 rounded-full border border-line bg-bg px-4 text-sm outline-none focus:border-primary"
            />
            <button type="submit" disabled={!text.trim() || busy} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-white disabled:opacity-40" aria-label={t("chat.send")}>
              <ArrowUp className="h-5 w-5" />
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="cg-help-chat"
        aria-label={open ? t("chat.close") : t("chat.open")}
        title={open ? undefined : t("chat.open")}
        className="cg-chat-button fixed right-3 z-[56] grid h-14 w-14 place-items-center rounded-full bg-primary text-white shadow-[0_14px_32px_-10px_rgb(var(--color-ink)/0.55)] transition hover:scale-105 sm:right-5"
        style={{ bottom: "calc(var(--cg-tray-h, 0px) + 1rem)" }}
      >
        {open ? <X className="h-6 w-6" aria-hidden /> : <MessageCircle className="h-6 w-6" aria-hidden />}
      </button>
    </div>
  );
}
