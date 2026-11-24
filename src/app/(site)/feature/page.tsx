import { TermIndexPage, termIndexMetadata } from "@/components/site/term-page";

export const generateMetadata = () => termIndexMetadata("FEATURE");
export const revalidate = 900;

export default function Page() {
  return <TermIndexPage kind="FEATURE" />;
}
