/**
 * Documentation Page — Sprint 25
 *
 * Comprehensive in-app reference for the TDR Deal Inspection platform.
 * Includes scoring methodology, app capabilities, integrations, data model,
 * AI model registry, glossary, and interactive architecture diagrams.
 *
 * Seven sections, each in an expandable accordion with a Table of Contents.
 */

import { useRef, useCallback } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Target,
  Layers,
  Puzzle,
  Database,
  Brain,
  BookOpen,
  Network,
  Shield,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';

import { ScoringReference } from '@/components/docs/ScoringReference';
import { CapabilitiesGuide } from '@/components/docs/CapabilitiesGuide';
import { IntegrationsReference } from '@/components/docs/IntegrationsReference';
import { DataModelReference } from '@/components/docs/DataModelReference';
import { AIModelsReference } from '@/components/docs/AIModelsReference';
import { GlossaryReference } from '@/components/docs/GlossaryReference';
import { ArchitectureDiagram } from '@/components/docs/ArchitectureDiagram';

// ─── Section definitions ──────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'architecture', label: 'Architecture Diagram', icon: Network, description: 'Interactive 5-layer system visualization' },
  { id: 'scoring', label: 'TDR Index Score', icon: Target, description: 'Scoring methodology, factors, and bands' },
  { id: 'capabilities', label: 'App Capabilities', icon: Layers, description: 'Every feature surface explained' },
  { id: 'integrations', label: 'Integrations', icon: Puzzle, description: 'External systems and data flows' },
  { id: 'datamodel', label: 'Data Model', icon: Database, description: 'Snowflake tables and schema' },
  { id: 'aimodels', label: 'AI Models', icon: Brain, description: 'Model registry and selection' },
  { id: 'glossary', label: 'Glossary & FAQ', icon: BookOpen, description: 'Key terms and common questions' },
] as const;

const SECTION_COMPONENTS: Record<string, React.FC> = {
  architecture: ArchitectureDiagram,
  scoring: ScoringReference,
  capabilities: CapabilitiesGuide,
  integrations: IntegrationsReference,
  datamodel: DataModelReference,
  aimodels: AIModelsReference,
  glossary: GlossaryReference,
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Documentation() {
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const scrollToSection = useCallback((id: string) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-violet-500 shadow-sm shadow-purple-900/40">
              <div className="relative h-4 w-4">
                <Shield className="h-full w-full text-white/90" strokeWidth={1.8} />
                <Search className="absolute bottom-0 right-0 h-[55%] w-[55%] text-white/80" strokeWidth={2.2} />
              </div>
            </div>
            <div>
              <h1 className="text-lg font-semibold">DealInspect Documentation</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                TDR Deal Inspection — Platform Reference & Architecture
              </p>
            </div>
          </div>
          <span className="text-[10px] text-muted-foreground/50 font-mono">v1.52.0</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sticky Table of Contents ──────────────────────────────────────── */}
        <aside className="hidden lg:flex w-56 shrink-0 flex-col border-r border-border/40 bg-card/30 overflow-y-auto">
          <div className="px-4 py-4">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Contents
            </p>
            <nav className="space-y-0.5">
              {SECTIONS.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className={cn(
                      'flex items-center gap-2.5 w-full rounded-md px-2.5 py-2 text-left transition-colors',
                      'text-xs text-slate-300 hover:text-slate-100 hover:bg-[#1B1630]/40'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 text-violet-400/60" />
                    <div>
                      <p className="font-medium leading-tight">{section.label}</p>
                      <p className="text-[9px] text-slate-400 leading-tight mt-0.5">{section.description}</p>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Bottom branding */}
          <div className="mt-auto px-4 py-3 border-t border-border/20">
            <p className="text-[9px] text-slate-400 leading-relaxed">
              Built on Snowflake Cortex AI, Domo App Studio, Sumble, & Perplexity.
            </p>
            <p className="text-[9px] text-slate-500 mt-1">
              26 sprints · 25 Code Engine functions · 11 AI models
            </p>
          </div>
        </aside>

        {/* ── Main Content ─────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-6 py-6 space-y-2">

            {/* Intro text */}
            <div className="rounded-xl border border-[#2a2540]/40 bg-[#1B1630]/20 px-5 py-4 mb-6">
              <p className="text-xs text-slate-300 leading-relaxed">
                <strong className="text-slate-100">DealInspect</strong> is a Technical Deal Review platform that combines
                structured SE workflows with AI-powered intelligence to help sales engineering teams inspect, score,
                and act on complex deals. It integrates Snowflake Cortex AI for in-database LLM functions, Sumble for
                firmographic and technographic enrichment, Perplexity for web-grounded research, and Domo's platform
                for data, hosting, and distribution.
              </p>
              <p className="text-xs text-slate-400 mt-2">
                This documentation covers every aspect of the platform — from scoring methodology to architecture diagrams.
                Expand any section below or use the table of contents to jump to a specific topic.
              </p>
            </div>

            {/* Sections accordion */}
            <Accordion type="multiple" defaultValue={['architecture']} className="space-y-3">
              {SECTIONS.map((section) => {
                const Icon = section.icon;
                const SectionContent = SECTION_COMPONENTS[section.id];

                return (
                  <AccordionItem
                    key={section.id}
                    value={section.id}
                    className="border border-[#2a2540]/40 rounded-xl overflow-hidden"
                  >
                    <div ref={(el) => { sectionRefs.current[section.id] = el; }}>
                      <AccordionTrigger className="px-5 py-4 hover:bg-[#1B1630]/30 [&[data-state=open]]:bg-[#1B1630]/40">
                        <div className="flex items-center gap-3 text-left">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 border border-violet-500/20">
                            <Icon className="h-4 w-4 text-violet-400" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-200">{section.label}</p>
                            <p className="text-[11px] text-slate-400">{section.description}</p>
                          </div>
                        </div>
                      </AccordionTrigger>
                    </div>
                    <AccordionContent className="px-5 pb-5">
                      {SectionContent && <SectionContent />}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>

            {/* Footer */}
            <div className="pt-6 pb-8 text-center">
              <p className="text-[10px] text-slate-500">
                DealInspect · TDR Intelligence Platform · v1.52.0 · Sprint 25
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

