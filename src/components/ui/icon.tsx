import {
  BadgeCheck, Columns3, Search, Tag,
  BarChart3, Boxes, Briefcase, Building2, Calculator, Calendar, CircleDollarSign, ClipboardList, Cloud, Code2, CreditCard, Database,
  FileText, GraduationCap, HardHat, HeartPulse, Headphones, Factory, Landmark, LayoutGrid, Mail, Megaphone, MessageSquare, Package,
  Palette, Receipt, ShieldCheck, ShoppingCart, Stethoscope, Store, Truck, UserCog, Users, Utensils, Warehouse, Wrench, type LucideIcon,
} from "lucide-react";

/** Curated icon set selectable in the admin (categories, industries, features). Keeps the client bundle small. */
export const ICONS: Record<string, LucideIcon> = {
  "bar-chart": BarChart3, boxes: Boxes, briefcase: Briefcase, building: Building2, calculator: Calculator, calendar: Calendar,
  money: CircleDollarSign, clipboard: ClipboardList, cloud: Cloud, code: Code2, card: CreditCard, database: Database, file: FileText,
  education: GraduationCap, construction: HardHat, health: HeartPulse, support: Headphones, factory: Factory, bank: Landmark,
  grid: LayoutGrid, mail: Mail, megaphone: Megaphone, chat: MessageSquare, package: Package, design: Palette, receipt: Receipt,
  security: ShieldCheck, cart: ShoppingCart, clinic: Stethoscope, store: Store, truck: Truck, "user-cog": UserCog, users: Users,
  restaurant: Utensils, warehouse: Warehouse, tools: Wrench, search: Search, compare: Columns3, verified: BadgeCheck, offer: Tag,
};
export const ICON_NAMES = Object.keys(ICONS);

export function Icon({ name, className }: { name: string | null | undefined; className?: string }) {
  const C = (name && ICONS[name]) || LayoutGrid;
  return <C className={className} aria-hidden />;
}
