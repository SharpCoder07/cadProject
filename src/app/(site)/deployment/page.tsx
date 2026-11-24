import { TermIndexPage, termIndexMetadata } from "@/components/site/term-page";

export const generateMetadata = () => termIndexMetadata("DEPLOYMENT_MODEL");
export const revalidate = 900;

export default function Page() {
  return <TermIndexPage kind="DEPLOYMENT_MODEL" />;
}
