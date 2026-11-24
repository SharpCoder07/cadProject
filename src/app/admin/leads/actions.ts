"use server";

import { z } from "zod";
import { action, ok } from "@/server/action";
import { leadNote, leadUpdateForm, LEAD_STATUSES } from "@/lib/validation/leads";
import { addLeadNote, bulkUpdateLeads, updateLead } from "@/server/services/leads";
import { actor, refresh } from "../_lib";

export const updateLeadAction = action(
  leadUpdateForm,
  async (input) => {
    await updateLead(await actor(), input);
    refresh(`/admin/leads/${input.id}`, "/admin/leads");
    return ok(undefined, "Lead updated");
  },
);

export const addNoteAction = action(leadNote, async ({ leadId, body }) => {
  await addLeadNote(await actor(), leadId, body);
  refresh(`/admin/leads/${leadId}`);
  return ok(undefined, "Note added");
});

export const bulkLeadAction = action(
  z.object({ ids: z.array(z.string().cuid()).min(1).max(200), status: z.enum(LEAD_STATUSES).optional(), assignedToId: z.string().cuid().nullable().optional() }),
  async ({ ids, ...patch }) => {
    const n = await bulkUpdateLeads(await actor(), ids, patch);
    refresh("/admin/leads");
    return ok(n, `Updated ${n} lead(s)`);
  },
);
