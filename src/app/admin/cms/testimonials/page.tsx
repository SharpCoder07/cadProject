import { Eye, ImageOff, Quote, Star } from "lucide-react";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { PageHeader } from "@/components/admin/page-header";
import { CrudAddButton, CrudManager } from "@/components/admin/crud-manager";
import { PageStats } from "@/components/admin/page-stats";
import { ItemTitle } from "@/components/admin/list-panel";

import { deleteTestimonialAction, reorderTestimonialsAction, saveTestimonialAction, toggleTestimonialAction } from "../actions";

export const metadata = { title: "Testimonials" };

export default async function TestimonialsPage() {
  await requirePermission("cms.blocks.view", "/admin/cms/testimonials");
  const items = await db.testimonial.findMany({ orderBy: { sortOrder: "asc" }, include: { avatar: { select: { url: true } } } });
  const rated = items.filter((t) => t.rating);
  const avg = rated.length ? rated.reduce((n, t) => n + (t.rating ?? 0), 0) / rated.length : 0;
  return (
    <>
      <PageHeader title="Testimonials" description="Manage every buyer quote shown on your website." actions={<CrudAddButton entity="testimonial" label="Add testimonial" />} />
      <PageStats
        items={[
          { label: "Testimonials", value: items.length, icon: Quote, tone: "red", sub: "In total" },
          { label: "Visible", value: items.filter((t) => t.isActive).length, icon: Eye, tone: "green", sub: "Shown on the website" },
          { label: "Average rating", value: rated.length ? avg.toFixed(1) : "—", icon: Star, sub: "Out of 5" },
          { label: "Without a photo", value: items.filter((t) => !t.avatar).length, icon: ImageOff, sub: "Show initials instead" },
        ]}
      />
      <CrudManager
        addInHeader
        entity="testimonial"
        newLabel="Add testimonial"
        columns={["Person", "Quote"]}
        rows={items.map((t) => ({ id: t.id, active: t.isActive, name: t.name, searchText: `${t.name} ${t.company ?? ""} ${t.quote}`, cells: [<ItemTitle key="t" round image={t.avatar?.url} title={t.name} sub={[t.role, t.company].filter(Boolean).join(", ") || undefined} />, t.quote], values: { name: t.name, role: t.role, company: t.company, quote: t.quote, rating: t.rating, avatarId: t.avatarId, _avatar: t.avatar?.url, isActive: t.isActive } }))}
        fields={[
          { name: "name", label: "Name", type: "text", required: true },
          { name: "role", label: "Job title", type: "text" },
          { name: "company", label: "Company", type: "text" },
          { name: "rating", label: "Rating (1–5)", type: "number" },
          { name: "quote", label: "Quote", type: "textarea", required: true },
          { name: "avatarId", label: "Photo", type: "media", previewKey: "_avatar" },
          { name: "isActive", label: "Active", type: "switch" },
        ]}
        emptyValues={{ name: "", quote: "", isActive: true }}
        save={saveTestimonialAction}
        remove={deleteTestimonialAction}
        reorder={reorderTestimonialsAction}
        toggle={toggleTestimonialAction}
      />
    </>
  );
}
