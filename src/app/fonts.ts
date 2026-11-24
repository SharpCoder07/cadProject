import {
  Bricolage_Grotesque, DM_Sans, Figtree, IBM_Plex_Sans, Inter, Lato, Lexend, Manrope, Merriweather, Montserrat, Nunito_Sans, Open_Sans, Outfit,
  Playfair_Display, Plus_Jakarta_Sans, Poppins, Raleway, Roboto, Rubik, Sora, Source_Serif_4, Space_Grotesk, Urbanist, Work_Sans,
} from "next/font/google";
import { FONTS, fontVar } from "@/lib/font-choices";

// Fonts selectable in Settings › Website design (list: lib/font-choices.ts). next/font serves them from
// this site; only the defaults are preloaded, the rest download only on pages that use them.
// next/font needs every option written out (no shared object or spread), so each call repeats them.
export const bricolage = Bricolage_Grotesque({ subsets: ["latin"], display: "swap", preload: true, variable: "--f-bricolage", weight: ["500", "600", "700"] });
export const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], display: "swap", preload: true, variable: "--f-jakarta", weight: ["400", "500", "600", "700"] });
const plex = IBM_Plex_Sans({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-plex", weight: ["400", "500", "600"] });
const inter = Inter({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-inter" });
const manrope = Manrope({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-manrope" });
const sourceSerif = Source_Serif_4({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-source-serif" });
const dmSans = DM_Sans({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-dm-sans" });
const figtree = Figtree({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-figtree" });
const outfit = Outfit({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-outfit" });
const urbanist = Urbanist({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-urbanist" });
const lexend = Lexend({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-lexend" });
const sora = Sora({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-sora" });
const poppins = Poppins({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-poppins", weight: ["400", "500", "600", "700"] });
// Roboto is a variable font on Google Fonts now: asking for single weights returns "/l/font?kit=…&skey=…"
// file links that Turbopack can't load ("next/font/google queries have exactly one entry"). The variable
// version (all weights in one file) uses normal links and works with both Turbopack and webpack.
const roboto = Roboto({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-roboto" });
const openSans = Open_Sans({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-open-sans" });
const lato = Lato({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-lato", weight: ["400", "700"] });
const montserrat = Montserrat({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-montserrat" });
const nunitoSans = Nunito_Sans({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-nunito-sans" });
const workSans = Work_Sans({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-work-sans" });
const rubik = Rubik({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-rubik" });
const raleway = Raleway({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-raleway" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-space-grotesk" });
const merriweather = Merriweather({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-merriweather", weight: ["400", "700"] });
const playfair = Playfair_Display({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-playfair" });

export const fontVariables = [
  bricolage, jakarta, plex, inter, manrope, sourceSerif, dmSans, figtree, outfit, urbanist, lexend, sora, poppins, roboto, openSans, lato,
  montserrat, nunitoSans, workSans, rubik, raleway, spaceGrotesk, merriweather, playfair,
].map((f) => f.variable).join(" ");

export const FONT_VAR: Record<string, string> = Object.fromEntries(FONTS.map((f) => [f.key, fontVar(f.key)]));
