/**
 * Starter locations installed by the seed and by "Install / repair starter locations" in Geo locations.
 * Parents always come before their children. Slugs are unique: a city or area slug is the first part
 * of a geo page URL (/gurugram/…), so states whose name matches a city get a suffix.
 */

export type StarterLevel = "COUNTRY" | "STATE" | "CITY" | "AREA";
export interface StarterLocation {
  name: string;
  slug: string;
  level: StarterLevel;
  parent?: string;
  priority?: number;
}

const slug = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const METROS = new Set(["mumbai", "delhi", "new-delhi", "bengaluru", "hyderabad", "chennai", "kolkata", "pune", "ahmedabad", "gurugram", "noida", "dubai", "riyadh"]);

/** [state name, state slug override, cities, areas by city] */
const INDIA: [string, string | null, string[], Record<string, string[]>?][] = [
  ["Andhra Pradesh", null, ["Visakhapatnam", "Vijayawada", "Guntur", "Tirupati"]],
  ["Arunachal Pradesh", null, ["Itanagar"]],
  ["Assam", null, ["Guwahati"]],
  ["Bihar", null, ["Patna"]],
  ["Chhattisgarh", null, ["Raipur"]],
  ["Goa", "goa-state", ["Panaji", "Margao"]],
  ["Gujarat", null, ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Gandhinagar"]],
  ["Haryana", null, ["Gurugram", "Faridabad", "Panipat", "Ambala"], { Gurugram: ["DLF Cyber City", "Sohna Road", "Udyog Vihar"] }],
  ["Himachal Pradesh", null, ["Shimla"]],
  ["Jharkhand", null, ["Ranchi", "Jamshedpur"]],
  ["Karnataka", null, ["Bengaluru", "Mysuru", "Mangaluru", "Hubballi"], { Bengaluru: ["Whitefield", "Koramangala", "Electronic City"] }],
  ["Kerala", null, ["Kochi", "Thiruvananthapuram", "Kozhikode"]],
  ["Madhya Pradesh", null, ["Indore", "Bhopal", "Jabalpur", "Gwalior"]],
  ["Maharashtra", null, ["Mumbai", "Pune", "Nagpur", "Nashik", "Thane", "Navi Mumbai", "Aurangabad"], { Mumbai: ["Andheri", "Powai", "Bandra Kurla Complex"], Pune: ["Hinjewadi"] }],
  ["Manipur", null, ["Imphal"]],
  ["Meghalaya", null, ["Shillong"]],
  ["Mizoram", null, ["Aizawl"]],
  ["Nagaland", null, ["Kohima"]],
  ["Odisha", null, ["Bhubaneswar", "Cuttack"]],
  ["Punjab", null, ["Ludhiana", "Amritsar", "Jalandhar", "Mohali"]],
  ["Rajasthan", null, ["Jaipur", "Jodhpur", "Udaipur", "Kota"]],
  ["Sikkim", null, ["Gangtok"]],
  ["Tamil Nadu", null, ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli"]],
  ["Telangana", null, ["Hyderabad", "Warangal"], { Hyderabad: ["HITEC City"] }],
  ["Tripura", null, ["Agartala"]],
  ["Uttar Pradesh", null, ["Noida", "Greater Noida", "Lucknow", "Kanpur", "Ghaziabad", "Agra", "Varanasi"], { Noida: ["Sector 62"] }],
  ["Uttarakhand", null, ["Dehradun"]],
  ["West Bengal", null, ["Kolkata", "Howrah", "Siliguri"]],
  ["Delhi", "delhi-state", ["Delhi", "New Delhi"]],
  ["Chandigarh", "chandigarh-ut", ["Chandigarh"]],
  ["Puducherry", "puducherry-ut", ["Puducherry"]],
  ["Jammu and Kashmir", null, ["Srinagar", "Jammu"]],
  ["Ladakh", null, ["Leh"]],
  ["Andaman and Nicobar Islands", null, ["Port Blair"]],
  ["Lakshadweep", null, ["Kavaratti"]],
  ["Dadra and Nagar Haveli and Daman and Diu", null, ["Daman", "Silvassa"]],
];

const GULF: [string, string, [string, string, string[]][]][] = [
  ["United Arab Emirates", "united-arab-emirates", [["Dubai", "dubai-emirate", ["Dubai"]], ["Abu Dhabi", "abu-dhabi-emirate", ["Abu Dhabi"]], ["Sharjah", "sharjah-emirate", ["Sharjah"]]]],
  ["Saudi Arabia", "saudi-arabia", [["Riyadh Province", "riyadh-province", ["Riyadh"]], ["Makkah Province", "makkah-province", ["Jeddah", "Mecca"]], ["Eastern Province", "eastern-province", ["Dammam", "Khobar"]]]],
];

function build(): StarterLocation[] {
  const out: StarterLocation[] = [{ name: "India", slug: "india", level: "COUNTRY", priority: 10 }];
  for (const [state, override, cities, areas] of INDIA) {
    const s = override ?? slug(state);
    out.push({ name: state, slug: s, level: "STATE", parent: "india" });
    for (const city of cities) {
      const c = slug(city);
      out.push({ name: city, slug: c, level: "CITY", parent: s, priority: METROS.has(c) ? 10 : 0 });
      for (const area of areas?.[city] ?? []) out.push({ name: area, slug: `${slug(area)}-${c}`, level: "AREA", parent: c });
    }
  }
  for (const [country, cs, states] of GULF) {
    out.push({ name: country, slug: cs, level: "COUNTRY" });
    for (const [state, ss, cities] of states) {
      out.push({ name: state, slug: ss, level: "STATE", parent: cs });
      for (const city of cities) out.push({ name: city, slug: slug(city), level: "CITY", parent: ss, priority: METROS.has(slug(city)) ? 10 : 0 });
    }
  }
  return out;
}

export const GEO_STARTER: StarterLocation[] = build();
