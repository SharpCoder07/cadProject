"use client";

import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Code, CodeSquare, Highlighter, ImagePlus, Italic, Link2, Link2Off, List, ListOrdered,
  BetweenHorizontalEnd, BetweenHorizontalStart, BetweenVerticalEnd, BetweenVerticalStart, Columns3, PanelTop, Rows3, Table as TableIcon, TableCellsMerge, TableCellsSplit, Trash2,
  Baseline, ChevronDown, Maximize2, Minimize2, Minus, Quote, Redo2, RemoveFormatting, Strikethrough, Subscript as SubIcon, Superscript as SupIcon, Underline as UnderlineIcon, Undo2, WrapText,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { MediaLibraryDialog } from "./media-picker";
import { usePrompt } from "@/components/ui/dialog";
import { FONT_SIZES, FontSize, HIGHLIGHT_COLORS, Highlight, Image, Subscript, Superscript, TEXT_COLORS, TextAlign, TextColor, Underline, validFontSize, type Align } from "./rich-text-extensions";

function ToolbarButton({ onClick, active, disabled, label, children }: { onClick: () => void; active?: boolean; disabled?: boolean; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn("rounded p-1.5 text-muted hover:bg-ink/5 hover:text-ink disabled:pointer-events-none disabled:opacity-35", active && "bg-mint-soft text-mint-ink hover:bg-mint-soft hover:text-mint-ink")}
    >
      {children}
    </button>
  );
}

const SELECT = "h-8 rounded border border-line bg-surface px-1.5 text-sm text-ink hover:border-ink/30 focus:border-mint focus:outline-none";
type Level = 1 | 2 | 3 | 4 | 5 | 6;
const LEVELS: Level[] = [1, 2, 3, 4, 5, 6];

const Sep = () => <span className="mx-1 my-1 w-px self-stretch bg-line" aria-hidden />;
const I = "h-4 w-4";
const ALIGNS: { align: Align; label: string; Icon: typeof AlignLeft }[] = [
  { align: "left", label: "Align left", Icon: AlignLeft },
  { align: "center", label: "Align centre", Icon: AlignCenter },
  { align: "right", label: "Align right", Icon: AlignRight },
  { align: "justify", label: "Justify", Icon: AlignJustify },
];

function Toolbar({ editor }: { editor: Editor }) {
  const [pickImage, setPickImage] = useState(false);
  // Re-render the buttons when the selection or formatting changes.
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      level: (LEVELS.find((l) => e.isActive("heading", { level: l })) ?? 0) as Level | 0,
      size: (e.getAttributes("fontSize").size as string | undefined) ?? "",
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      highlight: e.isActive("highlight"),
      highlightColor: (e.getAttributes("highlight").color as string | undefined) ?? "",
      color: (e.getAttributes("textColor").color as string | undefined) ?? "",
      code: e.isActive("code"),
      sub: e.isActive("subscript"),
      sup: e.isActive("superscript"),
      link: e.isActive("link"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      codeBlock: e.isActive("codeBlock"),
      table: e.isActive("table"),
      canMerge: e.can().mergeCells(),
      canSplit: e.can().splitCell(),
      align: (["center", "right", "justify"] as Align[]).find((a) => e.isActive({ textAlign: a })) ?? "left",
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();
  const [ask, promptDialog] = usePrompt();
  const setLink = async () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = await ask({
      title: prev ? "Edit link" : "Add a link",
      label: "Link address",
      initial: prev ?? "",
      placeholder: "https://example.com or /contact",
      hint: "A full https:// address, a page on this site starting with /, mailto: or tel:. Leave empty to remove the link.",
      confirmLabel: prev ? "Update link" : "Add link",
      validate: (v) => (v.trim() === "" || /^(https?:\/\/|\/|mailto:|tel:)/.test(v.trim()) ? null : "Use a full https:// address, a site path starting with /, mailto: or tel:"),
    });
    if (url === null) return;
    if (url.trim() === "") return void chain().extendMarkRange("link").unsetLink().run();
    chain().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };
  const customSize = async () => {
    const typed = await ask({
      title: "Custom text size",
      label: "Size",
      initial: s.size || "",
      placeholder: "e.g. 17px, 1.25rem, 120%",
      hint: "A number with px, rem, em or %. A plain number is pixels. 1rem = 16px on this site.",
      suggestions: ["14px", "18px", "1.25rem", "1.5rem", "2rem", "120%", "150%"],
      confirmLabel: "Apply size",
      validate: (v) => {
        const val = /^\d+(\.\d+)?$/.test(v.trim()) ? `${v.trim()}px` : v.trim().toLowerCase();
        return validFontSize(val) ? null : "Use 6–200px, 0.5–12rem or em, or 50–400%.";
      },
    });
    if (typed === null) return;
    const val = /^\d+(\.\d+)?$/.test(typed.trim()) ? `${typed.trim()}px` : typed.trim().toLowerCase();
    chain().setFontSize(val).run();
  };
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-line bg-bg px-1.5 py-1" role="toolbar" aria-label="Formatting">
      {/* Text style */}
      <select
        aria-label="Text style"
        title="Text style"
        className={cn(SELECT, "w-32")}
        value={s.level}
        onChange={(e) => {
          const l = Number(e.target.value) as Level | 0;
          if (l === 0) chain().setParagraph().run();
          else chain().setHeading({ level: l }).run();
        }}
      >
        <option value={0}>Paragraph</option>
        {LEVELS.map((l) => (
          <option key={l} value={l}>Heading {l}{l === 1 ? " (title)" : ""}</option>
        ))}
      </select>
      <select
        aria-label="Font size"
        title="Font size (select text first)"
        className={cn(SELECT, "ml-1 w-[4.75rem]")}
        value={s.size}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "custom") return void customSize();
          return v ? chain().setFontSize(v).run() : chain().unsetFontSize().run();
        }}
      >
        <option value="">Size</option>
        {FONT_SIZES.map((n) => (
          <option key={n} value={`${n}px`}>{n}px</option>
        ))}
        {s.size && !FONT_SIZES.some((n) => `${n}px` === s.size) && <option value={s.size}>{s.size}</option>}
        <option value="custom">Custom…</option>
      </select>
      <ColorMenu
        label="Text colour"
        value={s.color}
        colors={TEXT_COLORS}
        icon={<Baseline className={I} />}
        onPick={(c) => chain().setTextColor(c).run()}
        onClear={() => chain().unsetTextColor().run()}
        clearLabel="Default colour"
      />
      <ColorMenu
        label="Highlight colour"
        value={s.highlight ? s.highlightColor || "#fef08a" : ""}
        colors={HIGHLIGHT_COLORS}
        icon={<Highlighter className={I} />}
        onPick={(c) => chain().setHighlight(c).run()}
        onClear={() => chain().unsetHighlight().run()}
        clearLabel="No highlight"
      />
      <Sep />
      {/* Character formatting */}
      <ToolbarButton label="Bold (Ctrl+B)" onClick={() => chain().toggleBold().run()} active={s.bold}><Bold className={I} /></ToolbarButton>
      <ToolbarButton label="Italic (Ctrl+I)" onClick={() => chain().toggleItalic().run()} active={s.italic}><Italic className={I} /></ToolbarButton>
      <ToolbarButton label="Underline (Ctrl+U)" onClick={() => chain().toggleUnderline().run()} active={s.underline}><UnderlineIcon className={I} /></ToolbarButton>
      <ToolbarButton label="Strikethrough" onClick={() => chain().toggleStrike().run()} active={s.strike}><Strikethrough className={I} /></ToolbarButton>
      <ToolbarButton label="Inline code" onClick={() => chain().toggleCode().run()} active={s.code}><Code className={I} /></ToolbarButton>
      <ToolbarButton label="Subscript" onClick={() => chain().toggleSubscript().run()} active={s.sub}><SubIcon className={I} /></ToolbarButton>
      <ToolbarButton label="Superscript" onClick={() => chain().toggleSuperscript().run()} active={s.sup}><SupIcon className={I} /></ToolbarButton>
      <Sep />
      {/* Alignment */}
      {ALIGNS.map(({ align, label, Icon }) => (
        <ToolbarButton key={align} label={label} onClick={() => chain().setTextAlign(align).run()} active={s.align === align}><Icon className={I} /></ToolbarButton>
      ))}
      <Sep />
      {/* Blocks */}
      <ToolbarButton label="Bulleted list" onClick={() => chain().toggleBulletList().run()} active={s.bullet}><List className={I} /></ToolbarButton>
      <ToolbarButton label="Numbered list" onClick={() => chain().toggleOrderedList().run()} active={s.ordered}><ListOrdered className={I} /></ToolbarButton>
      <ToolbarButton label="Quote" onClick={() => chain().toggleBlockquote().run()} active={s.quote}><Quote className={I} /></ToolbarButton>
      <ToolbarButton label="Code block" onClick={() => chain().toggleCodeBlock().run()} active={s.codeBlock}><CodeSquare className={I} /></ToolbarButton>
      <ToolbarButton label="Divider" onClick={() => chain().setHorizontalRule().run()}><Minus className={I} /></ToolbarButton>
      <ToolbarButton label="Line break (Shift+Enter)" onClick={() => chain().setHardBreak().run()}><WrapText className={I} /></ToolbarButton>
      <Sep />
      {/* Links and media */}
      <ToolbarButton label="Link" onClick={() => void setLink()} active={s.link}><Link2 className={I} /></ToolbarButton>
      <ToolbarButton label="Remove link" onClick={() => chain().extendMarkRange("link").unsetLink().run()} disabled={!s.link}><Link2Off className={I} /></ToolbarButton>
      <ToolbarButton label="Image" onClick={() => setPickImage(true)}><ImagePlus className={I} /></ToolbarButton>
      <ToolbarButton label="Insert table" onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} active={s.table}><TableIcon className={I} /></ToolbarButton>
      <Sep />
      <ToolbarButton label="Clear formatting" onClick={() => chain().unsetAllMarks().clearNodes().unsetTextAlign().run()}><RemoveFormatting className={I} /></ToolbarButton>
      <ToolbarButton label="Undo (Ctrl+Z)" onClick={() => chain().undo().run()} disabled={!s.canUndo}><Undo2 className={I} /></ToolbarButton>
      <ToolbarButton label="Redo (Ctrl+Y)" onClick={() => chain().redo().run()} disabled={!s.canRedo}><Redo2 className={I} /></ToolbarButton>
      {s.table && (
        <div className="flex w-full flex-wrap items-center gap-0.5 border-t border-line pt-1" role="group" aria-label="Table">
          <span className="px-1.5 text-xs font-medium text-muted">Table</span>
          <ToolbarButton label="Add row above" onClick={() => chain().addRowBefore().run()}><BetweenHorizontalStart className={I} /></ToolbarButton>
          <ToolbarButton label="Add row below" onClick={() => chain().addRowAfter().run()}><BetweenHorizontalEnd className={I} /></ToolbarButton>
          <ToolbarButton label="Delete row" onClick={() => chain().deleteRow().run()}><Rows3 className={I} /></ToolbarButton>
          <Sep />
          <ToolbarButton label="Add column left" onClick={() => chain().addColumnBefore().run()}><BetweenVerticalStart className={I} /></ToolbarButton>
          <ToolbarButton label="Add column right" onClick={() => chain().addColumnAfter().run()}><BetweenVerticalEnd className={I} /></ToolbarButton>
          <ToolbarButton label="Delete column" onClick={() => chain().deleteColumn().run()}><Columns3 className={I} /></ToolbarButton>
          <Sep />
          <ToolbarButton label="Header row on/off" onClick={() => chain().toggleHeaderRow().run()}><PanelTop className={I} /></ToolbarButton>
          <ToolbarButton label="Merge cells (select several cells first)" onClick={() => chain().mergeCells().run()} disabled={!s.canMerge}><TableCellsMerge className={I} /></ToolbarButton>
          <ToolbarButton label="Split cell" onClick={() => chain().splitCell().run()} disabled={!s.canSplit}><TableCellsSplit className={I} /></ToolbarButton>
          <Sep />
          <ToolbarButton label="Delete table" onClick={() => chain().deleteTable().run()}><Trash2 className={I} /></ToolbarButton>
        </div>
      )}
      {promptDialog}
      <MediaLibraryDialog
        open={pickImage}
        onClose={() => setPickImage(false)}
        kind="image"
        onSelect={(items) => {
          const it = items[0];
          setPickImage(false);
          if (it) chain().setImage({ src: it.url, alt: it.alt ?? "" }).run();
        }}
      />
    </div>
  );
}

/** Colour dropdown: palette, any colour (picker or #hex) and a reset. Shows the current colour under the icon. */
function ColorMenu({ label, value, colors, icon, onPick, onClear, clearLabel }: { label: string; value: string; colors: { name: string; value: string }[]; icon: React.ReactNode; onPick: (c: string) => void; onClear: () => void; clearLabel: string }) {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const pick = (c: string) => {
    onPick(c);
    setOpen(false);
  };
  const toHex = (c: string) => {
    const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c);
    return m ? `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("")}` : c;
  };
  const current = value ? toHex(value) : "";
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => { setOpen((o) => !o); setHex(current); }}
        aria-label={label}
        title={label}
        aria-expanded={open}
        className={cn("flex items-center gap-0.5 rounded p-1.5 text-muted hover:bg-ink/5 hover:text-ink", value && "text-ink")}
      >
        <span className="flex flex-col items-center">
          {icon}
          <span className="mt-0.5 h-1 w-4 rounded-sm ring-1 ring-line" style={{ background: current || "transparent" }} />
        </span>
        <ChevronDown className="h-3 w-3" aria-hidden />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-56 rounded-xl border border-line bg-surface p-3 shadow-[0_16px_40px_-16px_rgb(0_0_0/0.35)]" onMouseDown={(e) => e.preventDefault()}>
          <p className="mb-2 text-xs font-semibold text-muted">{label}</p>
          <div className="grid grid-cols-8 gap-1.5">
            {colors.map((c) => (
              <button key={c.value} type="button" title={c.name} aria-label={c.name} onClick={() => pick(c.value)} className={cn("h-5 w-5 rounded-full ring-1 ring-line transition hover:scale-110", current.toLowerCase() === c.value && "ring-2 ring-primary ring-offset-1")} style={{ background: c.value }} />
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input type="color" aria-label="Any colour" value={/^#[0-9a-f]{6}$/i.test(hex) ? hex : "#0f766e"} onChange={(e) => setHex(e.target.value)} className="h-8 w-9 cursor-pointer rounded border border-line bg-surface p-0.5" />
            <input value={hex} onChange={(e) => setHex(e.target.value)} placeholder="#0f766e" aria-label="Colour code" className="h-8 min-w-0 flex-1 rounded border border-line bg-surface px-2 font-mono text-xs text-ink focus:border-mint focus:outline-none" />
            <button type="button" disabled={!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)} onClick={() => pick(hex.toLowerCase())} className="h-8 rounded bg-primary px-2 text-xs font-semibold text-primary-fg disabled:opacity-40">Apply</button>
          </div>
          <button type="button" onClick={() => { onClear(); setOpen(false); }} className="mt-2 w-full rounded border border-line py-1 text-xs font-medium text-muted hover:bg-bg hover:text-ink">{clearLabel}</button>
        </div>
      )}
    </div>
  );
}

/** HTML laid out one block per line for the Code tab. */
function prettyHtml(html: string) {
  return html
    .replace(/>\s*\n\s*</g, "><")
    .replace(/(<\/(p|h[1-6]|ul|ol|li|blockquote|table|thead|tbody|tr|pre|figure|div)>|<hr\s*\/?>|<br\s*\/?>(?=\s*<\/?(p|ul|ol|h\d)))/gi, "$1\n")
    .replace(/(<(ul|ol|table|thead|tbody|tr)(\s[^>]*)?>)/gi, "$1\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/**
 * Structured rich-text editor (WordPress-style): Add Media above, Visual / Code tabs (Code = the
 * HTML itself) and full screen. Output HTML is sanitized again on the server before storage.
 */
export function RichTextEditor({ value, onChange, minHeight = "12rem", id }: { value: string; onChange: (html: string) => void; minHeight?: string; id?: string }) {
  const [mode, setMode] = useState<"visual" | "code">("visual");
  const [code, setCode] = useState("");
  const [full, setFull] = useState(false);
  const [addMedia, setAddMedia] = useState(false);
  const codeRef = useRef<HTMLTextAreaElement>(null);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] } }),
      Link.configure({ openOnClick: false, autolink: true }),
      Underline,
      Highlight,
      Subscript,
      Superscript,
      TextAlign,
      Image,
      FontSize,
      TextColor,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value,
    editorProps: { attributes: { class: "prose-content max-w-none px-4 py-3 focus:outline-none dark:prose-invert", style: `min-height:${minHeight}`, ...(id ? { id } : {}) } },
    onUpdate: ({ editor: e }) => onChange(e.getHTML() === "<p></p>" ? "" : e.getHTML()),
  });
  // Sync external value changes (e.g. restoring a revision) without clobbering typing.
  useEffect(() => {
    if (mode === "code") return; // the Code tab is the source while it's open
    if (editor && value !== editor.getHTML() && !editor.isFocused) editor.commands.setContent(value || "", false);
  }, [editor, value, mode]);
  // Full screen: Esc goes back.
  useEffect(() => {
    if (!full) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setFull(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [full]);

  const toCode = () => {
    if (!editor || mode === "code") return;
    setCode(prettyHtml(editor.getHTML() === "<p></p>" ? "" : editor.getHTML()));
    setMode("code");
  };
  const toVisual = () => {
    if (!editor || mode === "visual") return;
    editor.commands.setContent(code || "", false);
    onChange(editor.getHTML() === "<p></p>" ? "" : editor.getHTML());
    setMode("visual");
  };
  // Add Media: an image at the cursor (Visual) or its <img> tag (Code).
  const insertImage = (url: string, alt: string) => {
    if (mode === "visual") return void editor?.chain().focus().setImage({ src: url, alt }).run();
    const el = codeRef.current;
    const tag = `<img src="${url.replace(/"/g, "&quot;")}" alt="${alt.replace(/"/g, "&quot;")}">`;
    const at = el?.selectionStart ?? code.length;
    const next = code.slice(0, at) + tag + code.slice(el?.selectionEnd ?? at);
    setCode(next);
    onChange(next);
  };
  const tab = (active: boolean) => cn("h-8 rounded-t-md border border-b-0 px-3 text-xs font-medium", active ? "border-line bg-bg text-ink" : "border-transparent text-muted hover:text-ink");

  return (
    <div className={cn(full && "fixed inset-0 z-[90] flex flex-col bg-surface p-4 sm:p-6")} role={full ? "dialog" : undefined} aria-label={full ? "Full-screen editor" : undefined}>
      <div className="flex items-end justify-between gap-2">
        <button type="button" onClick={() => setAddMedia(true)} className="mb-1.5 inline-flex h-8 items-center gap-1.5 rounded-control border border-line bg-surface px-2.5 text-xs font-semibold text-ink hover:border-mint hover:text-mint-ink">
          <ImagePlus className="h-4 w-4" aria-hidden /> Add Media
        </button>
        <div className="flex items-end gap-1" role="tablist" aria-label="Editor view">
          <button type="button" role="tab" aria-selected={mode === "visual"} onClick={toVisual} className={tab(mode === "visual")}>Visual</button>
          <button type="button" role="tab" aria-selected={mode === "code"} onClick={toCode} className={tab(mode === "code")}>Code</button>
          <button type="button" onClick={() => setFull((v) => !v)} title={full ? "Exit full screen (Esc)" : "Full screen"} aria-label={full ? "Exit full screen" : "Full screen"} className="mb-1 ml-1 grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-bg hover:text-ink">
            {full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div className={cn("overflow-hidden rounded-control border border-line bg-surface focus-within:border-mint focus-within:ring-4 focus-within:ring-mint-soft", full && "flex min-h-0 flex-1 flex-col")}>
        {mode === "visual" ? (
          <>
            {editor && <Toolbar editor={editor} />}
            <div className={cn(full && "min-h-0 flex-1 overflow-y-auto")}><EditorContent editor={editor} /></div>
          </>
        ) : (
          <>
            <p className="border-b border-line bg-bg px-3 py-1.5 text-[11px] text-muted">HTML. Unsafe code (scripts, event handlers) is removed when saved; switching back to Visual tidies tags it doesn&apos;t support.</p>
            <textarea
              ref={codeRef}
              value={code}
              onChange={(e) => { setCode(e.target.value); onChange(e.target.value); }}
              spellCheck={false}
              aria-label="HTML code"
              className={cn("block w-full resize-y bg-surface px-4 py-3 font-mono text-[13px] leading-relaxed text-ink focus:outline-none", full && "min-h-0 flex-1 resize-none")}
              style={full ? undefined : { minHeight }}
            />
          </>
        )}
      </div>
      <MediaLibraryDialog
        open={addMedia}
        onClose={() => setAddMedia(false)}
        kind="image"
        onSelect={(items) => {
          const it = items[0];
          setAddMedia(false);
          if (it) insertImage(it.url, it.alt ?? "");
        }}
      />
    </div>
  );
}
