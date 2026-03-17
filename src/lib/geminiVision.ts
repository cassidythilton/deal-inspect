import { callCodeEngine, extractResult, isDomoEnvironment } from './snowflakeStore';

export interface GeminiVisionResult {
  success: boolean;
  technologies: string[];
  error?: string;
}

export async function parseTechStackScreenshot(imageBase64: string, mimeType: string): Promise<GeminiVisionResult> {
  if (!isDomoEnvironment()) {
    return { success: false, technologies: [], error: 'Screenshot parsing requires Domo environment (Code Engine)' };
  }

  try {
    const raw = await callCodeEngine<unknown>('parseScreenshotTechStack', {
      imageBase64,
      mimeType: mimeType || 'image/png',
    });
    const result = extractResult<GeminiVisionResult>(raw);
    if (!result?.success) {
      return { success: false, technologies: [], error: result?.error || 'Code Engine returned no result' };
    }
    return result;
  } catch (err) {
    return { success: false, technologies: [], error: err instanceof Error ? err.message : 'Code Engine call failed' };
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
