import type {
  ExtractedWorkExperience,
  ExtractedProject,
  ExtractedProfile,
  ExtractedData,
} from "@/types";

const RESUME_JSON_REGEX = /```resume-json\s*([\s\S]*?)```/;
const PLAIN_JSON_REGEX = /```json\s*([\s\S]*?)```/;

function parseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw.trim()) as T;
  } catch {
    return null;
  }
}

function classifyJsonToExtracted(json: Record<string, unknown>): ExtractedData | null {
  if ("company" in json && "role" in json) {
    return { type: "work_experience", data: json as unknown as ExtractedWorkExperience };
  }
  if ("title" in json && typeof (json as { title: string }).title === "string") {
    return { type: "project", data: json as unknown as ExtractedProject };
  }
  if (
    "bio" in json ||
    "current_job_role" in json ||
    "career_summary" in json ||
    "skills" in json
  ) {
    return { type: "profile", data: json as unknown as ExtractedProfile };
  }
  return null;
}

/**
 * Extract a single resume-json block from assistant text.
 * Returns null if none found or JSON is invalid.
 */
export function extractResumeJsonFromText(text: string): ExtractedData | null {
  const match = text.match(RESUME_JSON_REGEX);
  if (!match) return null;
  const json = parseJson<Record<string, unknown>>(match[1]);
  if (!json || typeof json !== "object") return null;
  return classifyJsonToExtracted(json);
}

/**
 * Extract all resume-json (and fallback ```json) blocks from assistant text.
 * Populates live notes from whatever structured blocks the model outputs.
 */
export function extractAllResumeJsonFromText(text: string): ExtractedData[] {
  const results: ExtractedData[] = [];
  const seen = new Set<string>();

  function add(extracted: ExtractedData | null) {
    if (!extracted) return;
    const key = JSON.stringify(extracted);
    if (seen.has(key)) return;
    seen.add(key);
    results.push(extracted);
  }

  for (const regex of [RESUME_JSON_REGEX, PLAIN_JSON_REGEX]) {
    let match: RegExpExecArray | null;
    const re = new RegExp(regex.source, "g");
    while ((match = re.exec(text)) !== null) {
      const json = parseJson<Record<string, unknown>>(match[1]);
      if (json && typeof json === "object") add(classifyJsonToExtracted(json));
    }
  }
  return results;
}
