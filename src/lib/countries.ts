/**
 * Countries for phone numbers: ISO code, name, calling code and how many digits the national number
 * has (min–max, without the leading 0). Lengths are set for common countries; others accept 6–12.
 * Shared by the phone field (browser) and validation (server).
 */
export interface Country { iso: string; name: string; dial: string; min: number; max: number }

// iso|name|dial|min|max  (min/max empty = 6–12)
const DATA = `AF|Afghanistan|93|9|9
AL|Albania|355|8|9
DZ|Algeria|213|9|9
AS|American Samoa|1684|7|7
AD|Andorra|376|6|9
AO|Angola|244|9|9
AI|Anguilla|1264|7|7
AG|Antigua and Barbuda|1268|7|7
AR|Argentina|54|10|11
AM|Armenia|374|8|8
AW|Aruba|297|7|7
AU|Australia|61|9|9
AT|Austria|43|7|13
AZ|Azerbaijan|994|9|9
BS|Bahamas|1242|7|7
BH|Bahrain|973|8|8
BD|Bangladesh|880|10|10
BB|Barbados|1246|7|7
BY|Belarus|375|9|9
BE|Belgium|32|8|9
BZ|Belize|501|7|7
BJ|Benin|229|8|10
BM|Bermuda|1441|7|7
BT|Bhutan|975|7|8
BO|Bolivia|591|8|8
BA|Bosnia and Herzegovina|387|8|9
BW|Botswana|267|7|8
BR|Brazil|55|10|11
BN|Brunei|673|7|7
BG|Bulgaria|359|8|9
BF|Burkina Faso|226|8|8
BI|Burundi|257|8|8
KH|Cambodia|855|8|9
CM|Cameroon|237|9|9
CA|Canada|1|10|10
CV|Cape Verde|238|7|7
KY|Cayman Islands|1345|7|7
CF|Central African Republic|236|8|8
TD|Chad|235|8|8
CL|Chile|56|9|9
CN|China|86|11|11
CO|Colombia|57|10|10
KM|Comoros|269|7|7
CG|Congo|242|9|9
CD|Congo (DRC)|243|9|9
CR|Costa Rica|506|8|8
CI|Côte d’Ivoire|225|10|10
HR|Croatia|385|8|9
CU|Cuba|53|8|8
CY|Cyprus|357|8|8
CZ|Czechia|420|9|9
DK|Denmark|45|8|8
DJ|Djibouti|253|8|8
DM|Dominica|1767|7|7
DO|Dominican Republic|1809|7|7
EC|Ecuador|593|8|9
EG|Egypt|20|10|10
SV|El Salvador|503|8|8
GQ|Equatorial Guinea|240|9|9
ER|Eritrea|291|7|7
EE|Estonia|372|7|8
SZ|Eswatini|268|8|8
ET|Ethiopia|251|9|9
FJ|Fiji|679|7|7
FI|Finland|358|6|10
FR|France|33|9|9
GF|French Guiana|594|9|9
PF|French Polynesia|689|8|8
GA|Gabon|241|7|8
GM|Gambia|220|7|7
GE|Georgia|995|9|9
DE|Germany|49|10|11
GH|Ghana|233|9|9
GI|Gibraltar|350|8|8
GR|Greece|30|10|10
GL|Greenland|299|6|6
GD|Grenada|1473|7|7
GP|Guadeloupe|590|9|9
GU|Guam|1671|7|7
GT|Guatemala|502|8|8
GN|Guinea|224|9|9
GW|Guinea-Bissau|245|7|9
GY|Guyana|592|7|7
HT|Haiti|509|8|8
HN|Honduras|504|8|8
HK|Hong Kong|852|8|8
HU|Hungary|36|8|9
IS|Iceland|354|7|7
IN|India|91|10|10
ID|Indonesia|62|9|12
IR|Iran|98|10|10
IQ|Iraq|964|10|10
IE|Ireland|353|9|9
IL|Israel|972|9|9
IT|Italy|39|9|10
JM|Jamaica|1876|7|7
JP|Japan|81|10|10
JO|Jordan|962|9|9
KZ|Kazakhstan|7|10|10
KE|Kenya|254|9|9
KI|Kiribati|686|5|8
XK|Kosovo|383|8|9
KW|Kuwait|965|8|8
KG|Kyrgyzstan|996|9|9
LA|Laos|856|8|10
LV|Latvia|371|8|8
LB|Lebanon|961|7|8
LS|Lesotho|266|8|8
LR|Liberia|231|7|9
LY|Libya|218|9|9
LI|Liechtenstein|423|7|9
LT|Lithuania|370|8|8
LU|Luxembourg|352|8|11
MO|Macao|853|8|8
MG|Madagascar|261|9|9
MW|Malawi|265|7|9
MY|Malaysia|60|9|10
MV|Maldives|960|7|7
ML|Mali|223|8|8
MT|Malta|356|8|8
MH|Marshall Islands|692|7|7
MQ|Martinique|596|9|9
MR|Mauritania|222|8|8
MU|Mauritius|230|7|8
YT|Mayotte|262|9|9
MX|Mexico|52|10|10
FM|Micronesia|691|7|7
MD|Moldova|373|8|8
MC|Monaco|377|8|9
MN|Mongolia|976|8|8
ME|Montenegro|382|8|9
MS|Montserrat|1664|7|7
MA|Morocco|212|9|9
MZ|Mozambique|258|8|9
MM|Myanmar|95|8|10
NA|Namibia|264|8|9
NR|Nauru|674|7|7
NP|Nepal|977|10|10
NL|Netherlands|31|9|9
NC|New Caledonia|687|6|6
NZ|New Zealand|64|8|10
NI|Nicaragua|505|8|8
NE|Niger|227|8|8
NG|Nigeria|234|10|10
KP|North Korea|850|8|10
MK|North Macedonia|389|8|8
MP|Northern Mariana Islands|1670|7|7
NO|Norway|47|8|8
OM|Oman|968|8|8
PK|Pakistan|92|10|10
PW|Palau|680|7|7
PS|Palestine|970|9|9
PA|Panama|507|7|8
PG|Papua New Guinea|675|7|8
PY|Paraguay|595|9|9
PE|Peru|51|9|9
PH|Philippines|63|10|10
PL|Poland|48|9|9
PT|Portugal|351|9|9
PR|Puerto Rico|1787|7|7
QA|Qatar|974|8|8
RE|Réunion|262|9|9
RO|Romania|40|9|9
RU|Russia|7|10|10
RW|Rwanda|250|9|9
KN|Saint Kitts and Nevis|1869|7|7
LC|Saint Lucia|1758|7|7
VC|Saint Vincent and the Grenadines|1784|7|7
WS|Samoa|685|5|7
SM|San Marino|378|6|10
ST|São Tomé and Príncipe|239|7|7
SA|Saudi Arabia|966|9|9
SN|Senegal|221|9|9
RS|Serbia|381|8|9
SC|Seychelles|248|7|7
SL|Sierra Leone|232|8|8
SG|Singapore|65|8|8
SX|Sint Maarten|1721|7|7
SK|Slovakia|421|9|9
SI|Slovenia|386|8|8
SB|Solomon Islands|677|7|7
SO|Somalia|252|8|9
ZA|South Africa|27|9|9
KR|South Korea|82|9|10
SS|South Sudan|211|9|9
ES|Spain|34|9|9
LK|Sri Lanka|94|9|9
SD|Sudan|249|9|9
SR|Suriname|597|7|7
SE|Sweden|46|7|9
CH|Switzerland|41|9|9
SY|Syria|963|9|9
TW|Taiwan|886|9|9
TJ|Tajikistan|992|9|9
TZ|Tanzania|255|9|9
TH|Thailand|66|9|9
TL|Timor-Leste|670|7|8
TG|Togo|228|8|8
TO|Tonga|676|5|7
TT|Trinidad and Tobago|1868|7|7
TN|Tunisia|216|8|8
TR|Türkiye|90|10|10
TM|Turkmenistan|993|8|8
TC|Turks and Caicos Islands|1649|7|7
TV|Tuvalu|688|5|6
UG|Uganda|256|9|9
UA|Ukraine|380|9|9
AE|United Arab Emirates|971|9|9
GB|United Kingdom|44|10|10
US|United States|1|10|10
UY|Uruguay|598|8|8
UZ|Uzbekistan|998|9|9
VU|Vanuatu|678|7|7
VA|Vatican City|379|6|10
VE|Venezuela|58|10|10
VN|Vietnam|84|9|10
VG|British Virgin Islands|1284|7|7
VI|U.S. Virgin Islands|1340|7|7
YE|Yemen|967|9|9
ZM|Zambia|260|9|9
ZW|Zimbabwe|263|9|9`;

export const COUNTRIES: Country[] = DATA.split("\n")
  .map((l) => {
    const [iso = "", name = "", dial = "", min, max] = l.split("|");
    return { iso, name, dial, min: Number(min) || 6, max: Number(max) || 12 };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

export const DEFAULT_COUNTRY = "IN";
export const countryByIso = (iso: string) => COUNTRIES.find((c) => c.iso === iso) ?? COUNTRIES.find((c) => c.iso === DEFAULT_COUNTRY)!;

/** Where a calling code is shared (+1, +7, +44…), the main country is picked when reading a number. */
const PREFERRED: Record<string, string> = { "1": "US", "7": "RU", "262": "RE", "44": "GB" };

/** Splits "+919876543210" into its country and national number. Numbers without "+" are read as Indian. */
export function splitPhone(value: string | null | undefined): { country: Country; national: string } {
  const raw = (value ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  if (!raw.startsWith("+")) {
    const ind = digits.match(/^(?:91|0)?([6-9]\d{9})$/);
    return { country: countryByIso("IN"), national: ind ? ind[1]! : digits.replace(/^0+/, "") };
  }
  let best: Country | null = null;
  for (const c of COUNTRIES) {
    if (!digits.startsWith(c.dial)) continue;
    if (!best || c.dial.length > best.dial.length || (c.dial.length === best.dial.length && PREFERRED[c.dial] === c.iso)) best = c;
  }
  if (!best) return { country: countryByIso("IN"), national: digits };
  return { country: best, national: digits.slice(best.dial.length) };
}

/** Problem with a number, or null when it is fine. `mobile`: Indian numbers must be mobiles (start 6–9); off for office numbers, which may be landlines with an area code. */
export function phoneProblem(country: Country, national: string, { mobile = true }: { mobile?: boolean } = {}): string | null {
  if (!national) return mobile ? "Enter your mobile number" : "Enter a phone number";
  if (!/^\d+$/.test(national)) return "Use digits only";
  if (mobile && country.iso === "IN" && !/^[6-9]\d{9}$/.test(national)) return national.length === 10 ? "Indian mobile numbers start with 6, 7, 8 or 9" : "Enter a 10-digit mobile number";
  if (national.length < country.min || national.length > country.max) {
    return country.min === country.max ? `Enter a ${country.min}-digit number for ${country.name}` : `Enter ${country.min}–${country.max} digits for ${country.name}`;
  }
  return null;
}

/** "+919876543210" → "+91 98765 43210" (Indian numbers grouped 5-5; others in threes). */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return "";
  const { country, national } = splitPhone(value);
  if (!national) return value;
  const body = country.iso === "IN" && national.length === 10 ? `${national.slice(0, 5)} ${national.slice(5)}` : national.replace(/(\d{3})(?=\d{3,})/g, "$1 ");
  return `+${country.dial} ${body}`;
}

/** Flag image for a country (flagcdn.com), since Windows doesn't draw flag emoji. */
export const flagUrl = (iso: string) => `https://flagcdn.com/w40/${iso.toLowerCase()}.png`;
