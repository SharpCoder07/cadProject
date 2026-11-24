import { TermPage, termMetadata } from "@/components/site/term-page";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

export const generateMetadata = (props: Props) => termMetadata("LICENSING_MODEL", props);

export default function Page(props: Props) {
  return <TermPage kind="LICENSING_MODEL" {...props} />;
}
