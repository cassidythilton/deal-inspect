import { getAppSettings } from './appSettings';

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const EXTRACTION_PROMPT = `You are a technology stack analyst. Analyze this screenshot from Sumble's tech stack page and extract every technology/tool name you can see.

Return ONLY a JSON array of strings — each string is a technology name exactly as shown in the screenshot.
Example: ["React", "Node.js", "AWS", "Snowflake", "Salesforce"]

Rules:
- Include ALL technologies visible, across all categories (Engineering, Data, Security, etc.)
- Use the official product name as shown (e.g. "Microsoft Power BI" not "PowerBI")
- Do NOT include category headers (like "Engineering & R&D", "Data & Analytics")
- Do NOT include subcategory labels (like "JS Frameworks", "Database", "BI")
- Return ONLY the JSON array, no markdown fencing or explanation`;

export interface GeminiVisionResult {
  success: boolean;
  technologies: string[];
  error?: string;
}

export async function parseTechStackScreenshot(imageBase64: string, mimeType: string): Promise<GeminiVisionResult> {
  const settings = getAppSettings();
  const apiKey = settings.geminiApiKey;

  if (!apiKey) {
    return { success: false, technologies: [], error: 'Gemini API key not configured. Add it in Settings.' };
  }

  try {
    const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: EXTRACTION_PROMPT },
            { inline_data: { mime_type: mimeType, data: imageBase64 } },
          ],
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, technologies: [], error: `Gemini API error ${response.status}: ${errText.substring(0, 200)}` };
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return { success: false, technologies: [], error: 'Could not parse Gemini response as tech list' };
    }

    const techs: string[] = JSON.parse(jsonMatch[0]).filter((t: unknown) => typeof t === 'string' && t.trim());
    return { success: true, technologies: techs };
  } catch (err) {
    return { success: false, technologies: [], error: err instanceof Error ? err.message : 'Gemini request failed' };
  }
}

export function buildSumbleUrl(accountName: string, domain: string): string {
  const slug = accountName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `https://sumble.com/orgs/${slug}/techs?sort=Employees&desc=1&q=${encodeURIComponent(domain)}`;
}
