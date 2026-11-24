import { TermIndexPage, termIndexMetadata } from "@/components/site/term-page";

export const generateMetadata = () => termIndexMetadata("CUSTOMER_TYPE");
export const revalidate = 900;

export default function Page() {
  return <TermIndexPage kind="CUSTOMER_TYPE" />;
}
