import { FONT_VAR } from "@/app/fonts";
import { cssVarsBlock, themeVariables } from "@/lib/theme";
import type { Settings } from "@/server/settings/schemas";

/** Injects admin-configured theme tokens. Values are validated hex colours / enum keys, so this is safe to inline. */
export function ThemeStyle({ theme }: { theme: Settings["theme"] }) {
  const vars = {
    ...themeVariables(theme),
    "--font-display": FONT_VAR[theme.displayFont] ?? FONT_VAR.bricolage!,
    "--font-body": FONT_VAR[theme.bodyFont] ?? FONT_VAR.jakarta!,
  };
  return <style dangerouslySetInnerHTML={{ __html: cssVarsBlock(vars) }} />;
}
