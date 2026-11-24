import { TermIndexPage, termIndexMetadata } from "@/components/site/term-page";

export const generateMetadata = () => termIndexMetadata("OPERATING_SYSTEM");
export const revalidate = 900;

export default function Page() {
  return <TermIndexPage kind="OPERATING_SYSTEM" />;
}
