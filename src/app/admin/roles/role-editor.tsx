"use client";

import { Fragment, useEffect, useState } from "react";
import { Check, Eye, Minus, Plus, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, useConfirm } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { Badge, Panel, PanelHeader } from "@/components/ui/misc";
import { useServerAction } from "@/components/admin/use-action";
import { cn } from "@/lib/utils";
import { deleteRoleAction, saveRoleAction } from "../users/actions";

interface Role { id: string; key: string; name: string; description: string | null; isSystem: boolean; users: number; permissions: string[] }
/** One row of the matrix: a module and the permission behind each action (null when it has no such action). */
export interface MatrixModule { key: string; label: string; section: string; view: string | null; create: string | null; edit: string | null; delete: string | null; extras: { key: string; label: string }[] }
type Col = "view" | "create" | "edit" | "delete";
const COLS: { key: Col; label: string }[] = [{ key: "view", label: "View" }, { key: "create", label: "Create" }, { key: "edit", label: "Edit" }, { key: "delete", label: "Delete" }];

const ADD_EVENT = "roles:add";

/** "Custom role" button for the page header (top right). */
export function NewRoleButton() {
  return (
    <Button size="sm" onClick={() => window.dispatchEvent(new Event(ADD_EVENT))}>
      <Plus className="h-4 w-4" aria-hidden /> Custom role
    </Button>
  );
}

const keysOf = (m: MatrixModule) => [m.view, m.create, m.edit, m.delete, ...m.extras.map((x) => x.key)].filter((k): k is string => Boolean(k));

/** View / Create / Edit / Delete (+ more) for every module, as a grid of checkboxes or ticks. */
function Matrix({ modules, perms, onChange }: { modules: MatrixModule[]; perms: string[]; onChange?: (next: string[]) => void }) {
  const has = (k: string | null) => Boolean(k && perms.includes(k));
  // Any action on a module lets you view it (the server adds View the same way).
  const viewImplied = (m: MatrixModule) => keysOf(m).some((k) => k !== m.view && perms.includes(k));
  const toggle = (k: string, on: boolean) => onChange?.(on ? [...new Set([...perms, k])] : perms.filter((p) => p !== k));
  const sections = [...new Set(modules.map((m) => m.section))];
  return (
    <div className="overflow-x-auto rounded-panel border border-line">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-bg text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">Module</th>
            {COLS.map((c) => (
              <th key={c.key} className={cn("w-20 px-2 py-2 text-center font-semibold", c.key === "delete" && "text-danger")}>{c.label}</th>
            ))}
            <th className="px-3 py-2 text-left font-semibold">More</th>
            {onChange && <th className="w-24 px-2 py-2" />}
          </tr>
        </thead>
        <tbody>
          {sections.map((sec) => (
            <Fragment key={sec}>
              <tr className="border-t border-line bg-bg/60"><td colSpan={onChange ? 7 : 6} className="px-3 py-1.5 text-xs font-semibold text-muted">{sec}</td></tr>
              {modules.filter((m) => m.section === sec).map((m) => {
                const all = keysOf(m);
                const full = all.every((k) => perms.includes(k));
                return (
                  <tr key={m.key} className="border-t border-line">
                    <td className="px-3 py-2 font-medium text-ink">{m.label}</td>
                    {COLS.map((c) => {
                      const k = m[c.key];
                      if (!k) return <td key={c.key} className="px-2 py-2 text-center text-muted"><Minus className="mx-auto h-3.5 w-3.5 opacity-40" aria-label="Not applicable" /></td>;
                      const implied = c.key === "view" && !has(k) && viewImplied(m);
                      const on = has(k) || implied;
                      return (
                        <td key={c.key} className={cn("px-2 py-2 text-center", c.key === "delete" && on && "bg-danger/5")}>
                          {onChange ? (
                            <input type="checkbox" aria-label={`${m.label}: ${c.label}`} title={implied ? "Included: any other action on this module lets them view it" : k} className={cn("h-4 w-4 rounded border-line", c.key === "delete" ? "text-danger" : "text-primary")} checked={on} disabled={implied} onChange={(e) => toggle(k, e.target.checked)} />
                          ) : on ? <Check className={cn("mx-auto h-4 w-4", c.key === "delete" ? "text-danger" : "text-primary")} aria-label="Yes" /> : <span className="text-muted" aria-label="No">·</span>}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {m.extras.map((x) => onChange ? (
                          <Checkbox key={x.key} label={x.label} title={x.key} checked={has(x.key)} onChange={(e) => toggle(x.key, e.target.checked)} />
                        ) : has(x.key) ? <span key={x.key} className="rounded border border-line bg-bg px-1.5 py-0.5 text-xs">{x.label}</span> : null)}
                      </div>
                    </td>
                    {onChange && (
                      <td className="px-2 py-2 text-right">
                        <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => onChange(full ? perms.filter((p) => !all.includes(p)) : [...new Set([...perms, ...all])])}>
                          {full ? "Clear" : "Full access"}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RoleEditor({ roles, modules, other, canEdit }: { roles: Role[]; modules: MatrixModule[]; other: { key: string; label: string; group: string }[]; canEdit: boolean }) {
  const [edit, setEdit] = useState<Role | null>(null);
  const [view, setView] = useState<Role | null>(null);
  const labelOf = new Map(other.map((c) => [c.key, c.label]));
  const save = useServerAction(saveRoleAction, { onSuccess: () => setEdit(null), success: "Role saved" });
  const del = useServerAction(deleteRoleAction);
  const [ask, confirmDialog] = useConfirm();
  const groups = [...new Set(other.map((c) => c.group))];
  const deletes = new Set(modules.map((m) => m.delete).filter(Boolean) as string[]);
  useEffect(() => {
    const onAdd = () => setEdit({ id: "", key: "", name: "", description: null, isSystem: false, users: 0, permissions: [] });
    window.addEventListener(ADD_EVENT, onAdd);
    return () => window.removeEventListener(ADD_EVENT, onAdd);
  }, []);
  const count = (r: Role) => (r.key === "SUPER_ADMIN" ? "All permissions" : `${r.permissions.length} ${r.permissions.length === 1 ? "permission" : "permissions"}`);
  const deleteCount = (r: Role) => r.permissions.filter((p) => deletes.has(p)).length;
  const isVendorRole = (r: Role) => r.key === "VENDOR" || r.key.startsWith("VENDOR_") || r.permissions.some((p) => p.startsWith("vendor."));
  return (
    <>
      {confirmDialog}
      <div className="mb-4 flex items-start gap-3 rounded-panel border border-line bg-bg p-3 text-sm text-muted">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
        <p>
          Only the Super Admin deletes by default. A role needs <strong className="text-ink">Delete</strong> on a module to delete there, including removing a section,
          widget, button or list item inside a record; without it, people see “You don&apos;t have permission to delete this item.” Deleted items go to the Recycle Bin.
          Vendors and resellers never change anything directly: every action they take, deletions included, waits for your approval. Only the Super Admin can change
          roles or give people a role. Everything is checked on the server and recorded in the audit log.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {roles.map((r) => (
          <Panel key={r.id}>
            <PanelHeader
              title={<>{r.name} {r.isSystem && <Badge className="ml-1">Built-in</Badge>} {r.key !== "SUPER_ADMIN" && deleteCount(r) > 0 && <Badge className="ml-1 text-danger">Can delete in {deleteCount(r)}</Badge>}</>}
              description={r.description ?? undefined}
              actions={<>
                <Button size="sm" variant="secondary" onClick={() => setView(r)} title="See this role's permissions">
                  <Eye className="h-4 w-4" aria-hidden /> {r.users} {r.users === 1 ? "user" : "users"} · {count(r)}
                </Button>
                {canEdit && r.key !== "SUPER_ADMIN" && <>
                <Button size="sm" variant="secondary" onClick={() => setEdit(r)}>Edit permissions</Button>
                {!r.isSystem && <Button size="sm" variant="ghost" onClick={() => void ask({ title: `Delete the role “${r.name}”?`, message: "Only roles with no users can be deleted.", recycleBin: true }).then((yes) => yes && void del.run({ id: r.id }))}>Delete</Button>}
                </>}
              </>}
            />
          </Panel>
        ))}
      </div>
      <Dialog open={view !== null} onClose={() => setView(null)} title={view ? `${view.name}: permissions` : ""} description={view ? `${view.users} ${view.users === 1 ? "user has" : "users have"} this role · ${count(view).toLowerCase()}` : undefined} size="xl">
        {view && (view.key === "SUPER_ADMIN" ? (
          <p className="text-sm text-muted">The Super Admin can do everything: every module, every deletion, roles and permissions, deletion approvals, the recycle bin and backups. Its permissions can't be changed.</p>
        ) : (
          <div className="space-y-4">
            {!isVendorRole(view) && <Matrix modules={modules} perms={view.permissions} />}
            {groups.map((g) => {
              const keys = view.permissions.filter((p) => other.some((c) => c.key === p && c.group === g));
              if (!keys.length) return null;
              return (
                <section key={g}>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{g}</h3>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {keys.map((p) => <li key={p} title={p} className="rounded-lg border border-line bg-bg px-2.5 py-1 text-xs text-ink">{labelOf.get(p) ?? p}</li>)}
                  </ul>
                </section>
              );
            })}
            {view.permissions.length === 0 && <p className="text-sm text-muted">This role has no permissions yet.</p>}
          </div>
        ))}
        {view && canEdit && view.key !== "SUPER_ADMIN" && (
          <div className="mt-5 flex justify-end border-t border-line pt-4">
            <Button size="sm" onClick={() => { const r = view; setView(null); setEdit(r); }}>Edit permissions</Button>
          </div>
        )}
      </Dialog>
      <Dialog open={edit !== null} onClose={() => setEdit(null)} title={edit?.id ? `Edit ${edit.name}` : "New role"} size="xl">
        {edit && (
          <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); void save.run({ id: edit.id || null, key: edit.key, name: edit.name, description: edit.description, permissions: edit.permissions }); }}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" htmlFor="r-name" error={save.fieldErrors.name}><Input id="r-name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value, key: edit.id ? edit.key : e.target.value.toUpperCase().replace(/[^A-Z]+/g, "_").slice(0, 40) })} /></Field>
              <Field label="Key" htmlFor="r-key" error={save.fieldErrors.key}><Input id="r-key" value={edit.key} disabled={Boolean(edit.id)} onChange={(e) => setEdit({ ...edit, key: e.target.value })} /></Field>
              <Field label="Description" htmlFor="r-desc" className="sm:col-span-2"><Textarea id="r-desc" rows={2} value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value || null })} /></Field>
            </div>
            {!isVendorRole(edit) && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Admin panel</h3>
                <p className="text-xs text-muted">Tick what this role may do in each module. <span className="text-danger">Delete</span> also covers removing a section, widget, button, list item, plan or FAQ inside a record; without it, they can't delete there.</p>
                <Matrix modules={modules} perms={edit.permissions} onChange={(permissions) => setEdit({ ...edit, permissions })} />
              </section>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              {groups.map((g) => (
                <fieldset key={g} className="rounded-panel border border-line p-3">
                  <legend className="px-1 text-sm font-semibold">{g}</legend>
                  <div className="space-y-1.5">
                    {other.filter((c) => c.group === g).map((c) => (
                      <Checkbox key={c.key} label={c.label} hint={c.key} checked={edit.permissions.includes(c.key)} onChange={(e) => setEdit({ ...edit, permissions: e.target.checked ? [...edit.permissions, c.key] : edit.permissions.filter((p) => p !== c.key) })} />
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
            <div className="flex justify-end gap-2 border-t border-line pt-4"><Button size="sm" variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button size="sm" type="submit" loading={save.pending}>Save role</Button></div>
          </form>
        )}
      </Dialog>
    </>
  );
}
