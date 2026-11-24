import { TermIndexPage, termIndexMetadata } from "@/components/site/term-page";

export const generateMetadata = () => termIndexMetadata("LICENSING_MODEL");
export const revalidate = 900;

export default function Page() {
  return <TermIndexPage kind="LICENSING_MODEL" />;
}
