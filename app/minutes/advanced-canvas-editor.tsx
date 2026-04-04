// app/minutes/advanced-canvas-editor/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { CanvasBlock, MinutesTemplate } from "@/types/minutes";

interface PageProps {
  searchParams?: {
    templateId?: string;
  };
}

export default function AdvancedCanvasEditorPage({ searchParams }: PageProps) {
  const templateId = searchParams?.templateId;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<"company" | "building">("company");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [buildingId, setBuildingId] = useState<string | null>(null);

  const [canvasBlocks, setCanvasBlocks] = useState<CanvasBlock[]>([
    { type: "heading", text: "Minutes of Meeting", level: 1 },
    { type: "paragraph", text: "Date: {{meeting_date}}" },
    { type: "paragraph", text: "Attendees: {{attendees}}" },
  ]);

  // Load existing template when editing (templateId in URL)
  useEffect(() => {
    if (!templateId) return;

    const loadTemplate = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("minutes_templates")
        .select(
          "id, title, description, scope, company_id, building_id, canvas_content"
        )
        .eq("id", templateId)
        .single();

      if (error) {
        console.error(
          "Error loading minutes canvas template:",
          JSON.stringify(error, null, 2)
        );
        setLoading(false);
        return;
      }

      const tpl = data as MinutesTemplate;
      setTitle(tpl.title);
      setDescription(tpl.description ?? "");
      setScope(tpl.scope);
      setCompanyId(tpl.company_id);
      setBuildingId(tpl.building_id);

      if (tpl.canvas_content && Array.isArray(tpl.canvas_content)) {
        setCanvasBlocks(tpl.canvas_content as CanvasBlock[]);
      }

      setLoading(false);
    };

    loadTemplate();
  }, [templateId]);

  const addParagraph = () => {
    setCanvasBlocks((prev) => [
      ...prev,
      { type: "paragraph", text: "New paragraph" },
    ]);
  };

  const addBulletList = () => {
    setCanvasBlocks((prev) => [
      ...prev,
      { type: "bullet_list", items: ["Item 1", "Item 2"] },
    ]);
  };

  const updateBlockText = (index: number, text: string) => {
    setCanvasBlocks((prev) =>
      prev.map((block, i) =>
        i === index && (block.type === "heading" || block.type === "paragraph")
          ? { ...block, text }
          : block
      )
    );
  };

  const updateBulletItem = (
    blockIndex: number,
    itemIndex: number,
    text: string
  ) => {
    setCanvasBlocks((prev) =>
      prev.map((block, i) =>
        i === blockIndex && block.type === "bullet_list"
          ? {
              ...block,
              items: block.items.map((item, idx) =>
                idx === itemIndex ? text : item
              ),
            }
          : block
      )
    );
  };

  const saveTemplate = async () => {
    if (!title.trim()) {
      alert("Title is required");
      return;
    }

    setSaving(true);

    const scopeValue = scope;
    const company_id = scopeValue === "company" ? companyId : null;
    const building_id = scopeValue === "building" ? buildingId : null;

    const payload = {
      id: templateId || undefined, // upsert when editing, insert when new
      title: title.trim(),
      description: description.trim() || null,
      scope: scopeValue,
      company_id,
      building_id,
      canvas_content: canvasBlocks,
    };

    const { data, error } = await supabase
      .from("minutes_templates")
      .upsert(payload, { onConflict: "id" })
      .select()
      .single();

    if (error) {
      console.error(
        "Error creating minutes canvas template:",
        JSON.stringify(error, null, 2)
      );
      alert("Failed to save minutes canvas template.");
      setSaving(false);
      return;
    }

    console.log("Saved minutes canvas template:", data);
    alert("Minutes canvas template saved.");
    setSaving(false);
  };

  return (
    <div className="p-4 flex gap-6">
      <div className="flex-1 max-w-xl space-y-4">
        <h1 className="text-xl font-semibold">
          Advanced Canvas Editor – Minutes Template
        </h1>

        {loading && <p>Loading template…</p>}

        <div className="space-y-2">
          <label className="block text-sm font-medium">Title</label>
          <input
            className="border rounded px-2 py-1 w-full"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Description</label>
          <textarea
            className="border rounded px-2 py-1 w-full"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Scope</label>
          <select
            className="border rounded px-2 py-1"
            value={scope}
            onChange={(e) => setScope(e.target.value as "company" | "building")}
          >
            <option value="company">Company</option>
            <option value="building">Building</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">
            Company / Building (demo: free text ids)
          </label>
          {scope === "company" ? (
            <input
              className="border rounded px-2 py-1 w-full"
              placeholder="company_id (uuid)"
              value={companyId ?? ""}
              onChange={(e) => setCompanyId(e.target.value || null)}
            />
          ) : (
            <input
              className="border rounded px-2 py-1 w-full"
              placeholder="building_id (uuid)"
              value={buildingId ?? ""}
              onChange={(e) => setBuildingId(e.target.value || null)}
            />
          )}
        </div>

        <hr className="my-4" />

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Canvas Blocks</h2>
            <div className="flex gap-2">
              <button
                className="border px-2 py-1 text-sm rounded"
                onClick={addParagraph}
              >
                + Paragraph
              </button>
              <button
                className="border px-2 py-1 text-sm rounded"
                onClick={addBulletList}
              >
                + Bullet List
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {canvasBlocks.map((block, index) => (
              <div
                key={index}
                className="border rounded px-3 py-2 bg-gray-50 space-y-2"
              >
                <div className="text-xs text-gray-500">
                  Block #{index + 1} – {block.type}
                </div>

                {(block.type === "heading" || block.type === "paragraph") && (
                  <textarea
                    className="border rounded px-2 py-1 w-full"
                    rows={block.type === "heading" ? 1 : 2}
                    value={block.text}
                    onChange={(e) => updateBlockText(index, e.target.value)}
                  />
                )}

                {block.type === "bullet_list" && (
                  <div className="space-y-1">
                    {block.items.map((item, itemIndex) => (
                      <input
                        key={itemIndex}
                        className="border rounded px-2 py-1 w-full mb-1"
                        value={item}
                        onChange={(e) =>
                          updateBulletItem(index, itemIndex, e.target.value)
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <button
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          onClick={saveTemplate}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Minutes Template"}
        </button>
      </div>

      <div className="flex-1 max-w-xl border-l pl-4">
        <h2 className="text-lg font-semibold mb-2">Preview (same as PDF)</h2>
        <MinutesPreview canvasBlocks={canvasBlocks} />
      </div>
    </div>
  );
}

export function MinutesPreview({ canvasBlocks }: { canvasBlocks: CanvasBlock[] }) {
  return (
    <div className="border rounded px-4 py-4 bg-white max-h-[80vh] overflow-auto">
      {canvasBlocks.map((block, index) => {
        if (block.type === "heading") {
          const Tag = block.level === 1 ? "h1" : block.level === 2 ? "h2" : "h3";
          return (
            <Tag key={index} className="font-bold mb-2">
              {block.text}
            </Tag>
          );
        }
        if (block.type === "paragraph") {
          return (
            <p key={index} className="mb-2 whitespace-pre-wrap">
              {block.text}
            </p>
          );
        }
        if (block.type === "bullet_list") {
          return (
            <ul key={index} className="list-disc pl-5 mb-2">
              {block.items.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          );
        }
        return null;
      })}
    </div>
  );
}
