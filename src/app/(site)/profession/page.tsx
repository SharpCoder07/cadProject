import { TermIndexPage, termIndexMetadata } from "@/components/site/term-page";

export const generateMetadata = () => termIndexMetadata("PROFESSION");
export const revalidate = 900;

export default function Page() {
  return <TermIndexPage kind="PROFESSION" />;
}
