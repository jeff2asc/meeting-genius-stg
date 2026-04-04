export type CanvasBlock =
  | { type: "heading"; text: string; level: number }
  | { type: "paragraph"; text: string }
  | { type: "bullet_list"; items: string[] };

export interface MinutesTemplate {
  id: string;
  title: string;
  description?: string;
  scope: "company" | "building";
  company_id: string | null;
  building_id: string | null;
  canvas_content: CanvasBlock[];
}
