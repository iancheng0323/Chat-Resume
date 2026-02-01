import type {
  ExtractedWorkExperience,
  ExtractedProject,
  ExtractedProfile,
  ExtractedData,
} from "@/types";

const RESUME_JSON_REGEX = /```resume-json\s*([\s\S]*?)```/;

function parseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw.trim()) as T;
  } catch {
    return null;
  }
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

  if ("company" in json && "role" in json) {
    const data = json as unknown as ExtractedWorkExperience;
    return { type: "work_experience", data };
  }
  if ("title" in json && typeof (json as { title: string }).title === "string") {
    const data = json as unknown as ExtractedProject;
    return { type: "project", data };
  }
  if (
    "bio" in json ||
    "current_job_role" in json ||
    "career_summary" in json ||
    "skills" in json
  ) {
    const data = json as unknown as ExtractedProfile;
    return { type: "profile", data };
  }

  return null;
}

/**
 * Extract all resume-json blocks from assistant text (e.g. multiple jobs in one message).
 */
export function extractAllResumeJsonFromText(text: string): ExtractedData[] {
  const results: ExtractedData[] = [];
  let remaining = text;
  let match: RegExpExecArray | null;
  const regex = new RegExp(RESUME_JSON_REGEX.source, "g");
  while ((match = regex.exec(remaining)) !== null) {
    const parsed = extractResumeJsonFromText(match[0]);
    if (parsed) results.push(parsed);
  }
  return results;
}
