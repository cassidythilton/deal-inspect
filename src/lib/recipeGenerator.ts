import { Deal, TDRSessionSummary } from '@/types/tdr';
import { accountIntel } from '@/lib/accountIntel';

// Asset Catalog Config
export const ASSET_CATALOG: Record<string, { asset: string, description: string }> = {
  "Data Apps": { asset: "App Prototype Spec", description: "A detailed specification for a custom data application, including UI/UX requirements and data models." },
  "Data Integration": { asset: "Integration Architecture Diagram", description: "A technical diagram and document detailing data sources, pipelines, and integration strategies." },
  "BI & Analytics": { asset: "Dashboard Wireframes", description: "Wireframes and metric definitions for core BI dashboards." },
  "Governance": { asset: "Security & Governance Addendum", description: "A detailed document covering data governance, role-based access control, and compliance." },
  "Default": { asset: "Solution Brief", description: "A comprehensive executive summary of the proposed solution." },
  "Pitch": { asset: "Executive Pitch Deck Outline", description: "A slide-by-slide outline for the executive pitch deck." }
};

export async function fetchAvailableSkills(): Promise<string[]> {
  try {
    const response = await fetch('https://api.github.com/repos/stahura/domo-ai-vibe-rules/contents/skills');
    if (!response.ok) {
      console.warn('Failed to fetch skills from GitHub, using fallback list.');
      return ['domo-js', 'domo-dataset-query', 'domo-data-api', 'domo-toolkit-wrapper', 'domo-appdb', 'domo-code-engine', 'domo-manifest'];
    }
    const data = await response.json();
    if (Array.isArray(data)) {
      return data.filter(item => item.type === 'dir').map(item => item.name);
    }
    return [];
  } catch (err) {
    console.error('Error fetching skills:', err);
    return ['domo-js', 'domo-dataset-query', 'domo-data-api', 'domo-toolkit-wrapper', 'domo-appdb', 'domo-code-engine', 'domo-manifest'];
  }
}

export async function generateRecipeMarkdown(
  deal: Deal,
  session: TDRSessionSummary | null,
  inputs: Record<string, any>
): Promise<string> {
  // Aggregate Context
  const accountIntel = await accountIntel.getLatestIntel(deal.id);
  const skills = await fetchAvailableSkills();

  // Determine Assets based on Domo Layers
  const assetsToGenerate = [ASSET_CATALOG["Default"], ASSET_CATALOG["Pitch"]];
  
  // Find Domo Layers from inputs (assuming step 'solution' or similar contains domo_layers)
  let domoLayers: string[] = [];
  for (const stepId in inputs) {
    for (const fieldId in inputs[stepId]) {
      if (fieldId === 'domo_layers' && Array.isArray(inputs[stepId][fieldId])) {
        domoLayers = inputs[stepId][fieldId];
      }
    }
  }

  domoLayers.forEach(layer => {
    if (ASSET_CATALOG[layer]) {
      assetsToGenerate.push(ASSET_CATALOG[layer]);
    }
  });

  // Format Markdown
  let md = `# Sales Asset Generation Recipe: ${deal.name}\n\n`;
  md += `**Deal ID:** ${deal.id}\n`;
  md += `**Amount:** ${deal.amount ? `$${deal.amount.toLocaleString()}` : 'N/A'}\n`;
  md += `**Stage:** ${deal.stage}\n\n`;

  md += `## System Prompt\n\n`;
  md += `You are an expert Solutions Architect (SA) and Sales Engineer (SE). Your task is to generate highly tailored sales assets for the deal described below.\n\n`;

  md += `### Required Assets to Generate\n\n`;
  assetsToGenerate.forEach(asset => {
    md += `- **${asset.asset}**: ${asset.description}\n`;
  });
  md += `\n`;

  md += `### Available Agent Skills\n\n`;
  md += `You must leverage the following skills from the \`stahura/domo-ai-vibe-rules\` repository where appropriate to ensure the assets align with Domo best practices:\n`;
  skills.forEach(skill => {
    md += `- \`${skill}\`\n`;
  });
  md += `\n`;

  md += `### Deal Context\n\n`;
  
  if (session) {
    md += `#### TDR Session Summary\n`;
    md += `- **Complexity:** ${session.complexity}\n`;
    md += `- **Status:** ${session.status}\n\n`;
  }

  md += `#### TDR Inputs\n`;
  for (const stepId in inputs) {
    md += `**Step: ${stepId}**\n`;
    for (const fieldId in inputs[stepId]) {
      const val = inputs[stepId][fieldId];
      if (val && val.toString().trim() !== '') {
        md += `- **${fieldId}**: ${Array.isArray(val) ? val.join(', ') : val}\n`;
      }
    }
    md += `\n`;
  }

  md += `#### Enrichment Data (Perplexity / Sumble)\n`;
  if (accountIntel.hasPerplexity && accountIntel.perplexity) {
    md += `${accountIntel.perplexity.summary || 'No summary available.'}\n\n`;
    if (accountIntel.perplexity.technologySignals && accountIntel.perplexity.technologySignals.length > 0) {
      md += `**Key Technologies:** ${accountIntel.perplexity.technologySignals.join(', ')}\n\n`;
    }
    if (accountIntel.perplexity.recentInitiatives && accountIntel.perplexity.recentInitiatives.length > 0) {
      md += `**Business Initiatives:**\n`;
      accountIntel.perplexity.recentInitiatives.forEach(init => md += `- ${init}\n`);
      md += `\n`;
    }
  } else if (accountIntel.hasSumble && accountIntel.sumble) {
    md += `**Technologies Found:** ${accountIntel.sumble.technologiesFound || 'None'}\n\n`;
  } else {
    md += `*No enrichment data available for this account.*\n\n`;
  }

  // TODO: Add Gong transcripts if available
  md += `#### Gong Transcripts\n`;
  md += `*(Gong transcripts and summaries would be injected here)*\n\n`;

  return md;
}

export async function pushRecipeToGitHub(dealId: string, mdContent: string): Promise<{ success: boolean, url?: string }> {
  // Mock implementation for pushing to a bespoke GitHub repo
  console.log(`[GitHub] Pushing recipe for deal ${dealId} to bespoke repository...`);
  await new Promise(resolve => setTimeout(resolve, 1500));
  console.log(`[GitHub] Successfully pushed recipe for deal ${dealId}.`);
  return { success: true, url: `https://github.com/bespoke-org/deal-recipes/blob/main/${dealId}-recipe.md` };
}

export async function sendSlackNotification(dealName: string, githubUrl: string): Promise<boolean> {
  // Mock implementation for sending a Slack notification
  console.log(`[Slack] Sending notification to #tdr-channel for deal ${dealName}...`);
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log(`[Slack] Notification sent.`);
  return true;
}
