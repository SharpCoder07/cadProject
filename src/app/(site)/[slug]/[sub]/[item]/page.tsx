import { ProductGeoPage, productGeoMetadata } from "@/components/site/geo-page";

/** Geo landing page for a product in a city or area, e.g. /gurugram/software/autocad. */
type Props = { params: Promise<{ slug: string; sub: string; item: string }> };

export const generateMetadata = (props: Props) => productGeoMetadata(props);

export default function Page(props: Props) {
  return <ProductGeoPage {...props} />;
}
