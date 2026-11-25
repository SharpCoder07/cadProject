import { describe, expect, it } from "vitest";
import { keywords, matchFaqs, scoreFaq, whatsappUrl } from "@/lib/chatbot";

const FAQS = [
  { question: "Is Cadgram free to use for buyers?", answer: "Yes. Comparing products, reading reviews and getting quotes is free." },
  { question: "How do I list my software on Cadgram?", answer: "Create a vendor account and add your product. Our team reviews it before it goes live." },
  { question: "How are reviews verified?", answer: "We check every review before it is published." },
  { question: "Can I get a demo of a product?", answer: "Use “Request a demo” on the product page and the vendor will contact you." },
];

describe("help chat matching", () => {
  it("keeps only the meaningful words, stemmed", () => {
    expect(keywords("How do I list my software?")).toEqual(["list", "software"]);
    expect(keywords("Pricing and prices")).toEqual(["pric", "price"]);
  });

  it("finds the FAQ for a reworded question", () => {
    expect(matchFaqs("how can I list our product software", FAQS).best?.question).toBe("How do I list my software on Cadgram?");
    expect(matchFaqs("is it free for buyers?", FAQS).best?.question).toBe("Is Cadgram free to use for buyers?");
    expect(matchFaqs("are the reviews verified", FAQS).best?.question).toBe("How are reviews verified?");
  });

  it("answers nothing for unrelated questions", () => {
    expect(matchFaqs("what is the weather in Mumbai", FAQS).best).toBeNull();
    expect(matchFaqs("hello", FAQS).best).toBeNull();
  });

  it("needs a word from the question, not only the answer", () => {
    expect(scoreFaq(keywords("vendor account"), FAQS[2]!)).toBe(0);
    expect(scoreFaq(keywords("vendor account"), FAQS[1]!)).toBe(0);
  });

  it("suggests related questions without repeating the answer", () => {
    const r = matchFaqs("demo of a product review", FAQS);
    expect(r.best?.question).toBe("Can I get a demo of a product?");
    expect(r.related).not.toContain(r.best);
  });

  it("builds WhatsApp links", () => {
    expect(whatsappUrl("+91 80000 00001", "Hi there")).toBe("https://wa.me/918000000001?text=Hi%20there");
    expect(whatsappUrl("")).toBeNull();
  });
});
