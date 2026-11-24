import { TermIndexPage, termIndexMetadata } from "@/components/site/term-page";

export const generateMetadata = () => termIndexMetadata("USE_CASE");
export const revalidate = 900;

export default function Page() {
  return <TermIndexPage kind="USE_CASE" />;
}
