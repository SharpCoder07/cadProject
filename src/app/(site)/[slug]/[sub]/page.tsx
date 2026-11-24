import { BrandGeoPage, brandGeoMetadata } from "@/components/site/geo-page";

/** Geo landing page for a brand in a city or area, e.g. /gurugram/autodesk (see Geo pages in the admin). */
type Props = { params: Promise<{ slug: string; sub: string }> };

export const generateMetadata = (props: Props) => brandGeoMetadata(props);

export default function Page(props: Props) {
  return <BrandGeoPage {...props} />;
}
