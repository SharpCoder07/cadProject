import { TermIndexPage, termIndexMetadata } from "@/components/site/term-page";

export const generateMetadata = () => termIndexMetadata("BUDGET_RANGE");
export const revalidate = 900;

export default function Page() {
  return <TermIndexPage kind="BUDGET_RANGE" />;
}
