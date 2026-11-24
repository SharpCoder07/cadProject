/**
 * Re-created on every page change (unlike the layout), so each page's content is fresh: the page-title
 * animation and scroll reveals (app/motion.css, components/site/motion.tsx) play again on every visit,
 * also when moving between two pages of the same kind (one category to another).
 */
export default function SiteTemplate({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
