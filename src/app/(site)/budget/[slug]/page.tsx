import { TermPage, termMetadata } from "@/components/site/term-page";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

export const generateMetadata = (props: Props) => termMetadata("BUDGET_RANGE", props);

export default function Page(props: Props) {
  return <TermPage kind="BUDGET_RANGE" {...props} />;
}
