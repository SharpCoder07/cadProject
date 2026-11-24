import Script from "next/script";
import type { Settings } from "@/server/settings/schemas";

export type TrackerAllow = { gtm: boolean; ga4: boolean; clarity: boolean; metaPixel: boolean };

/**
 * Loads tracking scripts only for IDs configured in Settings → Analytics (IDs are validated formats) and only
 * those the visitor allowed in the cookie banner (rendered by CookieConsent, components/site/cookie-consent.tsx).
 */
export function Analytics({ ids, allow }: { ids: Settings["analytics"]; allow: TrackerAllow }) {
  return (
    <>
      {ids.gtmContainerId && allow.gtm && (
        <Script id="gtm" strategy="afterInteractive">{`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${ids.gtmContainerId}');`}</Script>
      )}
      {ids.ga4MeasurementId && allow.ga4 && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ids.ga4MeasurementId}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ids.ga4MeasurementId}');`}</Script>
        </>
      )}
      {ids.metaPixelId && allow.metaPixel && (
        <Script id="meta-pixel" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${ids.metaPixelId}');fbq('track','PageView');`}</Script>
      )}
      {ids.clarityProjectId && allow.clarity && (
        <Script id="clarity" strategy="afterInteractive">{`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${ids.clarityProjectId}");`}</Script>
      )}
    </>
  );
}
