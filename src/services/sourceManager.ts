import { GoogleGenerativeAI } from '@google/generative-ai';
import { TavilyService } from './tavilyService';
import type { SourceStatus } from '../types/election';
import { logError } from './errorLogger';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
const USE_TAVILY_FOR_AUTO = true; // Feature flag for auto-collection

// ─── Source Registry ─────────────────────────────────────────────

export interface SourceConfig {
    id: string;
    name: string;
    tier: 1 | 2 | 3 | 4;
    domain: string;
    isActive: boolean;
    prompt: string;
}

const SOURCE_CONFIGS: SourceConfig[] = [
    {
        id: 'ec-bss',
        name: 'EC / BSS (Official)',
        tier: 1,
        domain: 'ec.org.bd / bssnews.net',
        isActive: true,
        prompt: `Search Bangladesh Election Commission (ec.org.bd) and Bangladesh Sangbad Sangstha (bssnews.net) for the latest official 13th National Parliament Election 2026 results declared on February 12, 2026. Focus on officially declared constituencies only. Return data in JSON.`,
    },
    {
        id: 'bdnews24',
        name: 'bdnews24.com',
        tier: 2,
        domain: 'bdnews24.com',
        isActive: true,
        prompt: `Search bdnews24.com for the latest Bangladesh 13th National Parliament Election 2026 results from February 12, 2026. Include any constituency-level vote counts, winner declarations, and leading candidates. Return data in JSON.`,
    },
    {
        id: 'daily-star',
        name: 'The Daily Star',
        tier: 2,
        domain: 'thedailystar.net',
        isActive: true,
        prompt: `Search thedailystar.net for the latest Bangladesh 13th National Parliament Election 2026 results from February 12, 2026. Include constituency results, vote counts, and any winner declarations. Return data in JSON.`,
    },
    {
        id: 'prothom-alo',
        name: 'Prothom Alo',
        tier: 2,
        domain: 'prothomalo.com',
        isActive: true,
        prompt: `Search prothomalo.com for the latest Bangladesh 13th National Parliament Election 2026 results from February 12, 2026. Include constituency results, vote counts, and leading candidates. Return data in JSON.`,
    },
    {
        id: 'dhaka-tribune',
        name: 'Dhaka Tribune',
        tier: 2,
        domain: 'dhakatribune.com',
        isActive: true,
        prompt: `Search dhakatribune.com for the latest Bangladesh 13th National Parliament Election 2026 results from February 12, 2026. Include constituency results and vote tallies. Return data in JSON.`,
    },
    {
        id: 'international',
        name: 'International Media',
        tier: 3,
        domain: 'ndtv.com / indiatoday.in / aljazeera.com',
        isActive: true,
        prompt: `Search international news media (NDTV, India Today, Al Jazeera, BBC) for the latest Bangladesh 13th National Parliament Election 2026 results from February 12, 2026. Include any constituency-level results and overall trends. Return data in JSON.`,
    },
];

// ─── Source State ────────────────────────────────────────────────

const sourceStates = new Map<string, SourceStatus>();

// Initialize states
SOURCE_CONFIGS.forEach(config => {
    sourceStates.set(config.id, {
        id: config.id,
        name: config.name,
        tier: config.tier,
        lastFetchTime: 0,
        lastSuccessTime: 0,
        fetchCount: 0,
        errorCount: 0,
        successCount: 0,
        constituenciesReported: 0,
        isActive: config.isActive,
        avgResponseTime: 0,
    });
});

// ─── JSON Response Format (shared across all sources) ────────────

const RESULT_JSON_FORMAT = `{
  "results": [
    {
      "constituencyNumber": <number>,
      "constituencyName": "<name>",
      "division": "<division>",
      "district": "<district>",
      "status": "counting" | "declared" | "result_confirmed",
      "candidates": [
        {
          "name": "<candidate name>",
          "party": "<party name>",
          "partyId": "bnp" | "jamaat" | "jp-ershad" | "gonoforum" | "jasod" | "workers-party" | "islami-andolan" | "ncp" | "independent" | "others",
          "votes": <number>,
          "isWinner": <boolean>,
          "isLeading": <boolean>
        }
      ],
      "totalVotes": <number>,
      "winMargin": <number>
    }
  ],
  "sourcesUsed": ["<source1>", "<source2>"],
  "confidenceLevel": "high" | "medium" | "low"
}`;

// ─── Fetch from a Specific Source ────────────────────────────────

export interface SourceFetchResult {
    sourceId: string;
    sourceName: string;
    sourceTier: number;
    results: Array<{
        constituencyNumber: number;
        constituencyName: string;
        division: string;
        district: string;
        status: string;
        candidates: Array<{
            name: string;
            party: string;
            partyId: string;
            votes: number;
            isWinner: boolean;
            isLeading: boolean;
        }>;
        totalVotes: number;
        winMargin: number;
    }>;
    sourcesUsed: string[];
    confidenceLevel: 'high' | 'medium' | 'low';
    fetchTime: number;
}

export async function fetchFromSource(sourceId: string, options?: { forceGemini?: boolean }): Promise<SourceFetchResult | null> {
    const config = SOURCE_CONFIGS.find(s => s.id === sourceId);
    if (!config || !config.isActive) return null;

    // Use Tavily if enabled AND not forced to use Gemini
    if (USE_TAVILY_FOR_AUTO && !options?.forceGemini) {
        return fetchFromSourceTavily(config);
    }

    const state = sourceStates.get(sourceId)!;
    const startTime = Date.now();

    state.fetchCount++;
    state.lastFetchTime = startTime;

    try {
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash-lite',
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 8192,
            },
            tools: [{ googleSearch: {} } as any],
        });

        const fullPrompt = `${config.prompt}\n\nReturn results in this exact JSON format:\n${RESULT_JSON_FORMAT}\n\nIMPORTANT: Only include data you are confident about. Map party names to IDs: BNP="bnp", Jamaat-e-Islami="jamaat", Jatiya Party="jp-ershad", National Citizen Party="ncp", Independent="independent".`;

        const result = await model.generateContent(fullPrompt);
        const text = result.response.text();

        const parsed = parseSourceResponse(text);
        if (!parsed) {
            state.errorCount++;
            state.lastError = 'Failed to parse response';

            await logError(
                'parsing',
                `Failed to parse response from ${config.name}`,
                text.substring(0, 200) + '...',
                config.id
            );

            return null;
        }

        const elapsed = Date.now() - startTime;
        state.successCount++;
        state.lastSuccessTime = Date.now();
        state.constituenciesReported = parsed.results.length;
        state.avgResponseTime = state.avgResponseTime > 0
            ? (state.avgResponseTime * 0.7 + elapsed * 0.3)
            : elapsed;
        state.lastError = undefined;

        console.log(`[SourceManager] ${config.name}: ${parsed.results.length} constituencies in ${elapsed}ms`);

        return {
            sourceId: config.id,
            sourceName: config.name,
            sourceTier: config.tier,
            results: parsed.results as any[],
            sourcesUsed: parsed.sourcesUsed || [config.domain],
            confidenceLevel: (parsed.confidenceLevel as 'high' | 'medium' | 'low') || 'medium',
            fetchTime: Date.now(),
        };

    } catch (error) {
        state.errorCount++;
        state.lastError = String(error);
        console.error(`[SourceManager] ${config.name} error:`, error);

        await logError(
            'source_fetch',
            `Failed to fetch from ${config.name}`,
            String(error),
            config.id
        );

        return null;
    }
}

async function fetchFromSourceTavily(config: typeof SOURCE_CONFIGS[0]): Promise<SourceFetchResult | null> {
    const state = sourceStates.get(config.id)!;
    const startTime = Date.now();
    state.fetchCount++;
    state.lastFetchTime = startTime;

    try {
        // Construct a query that asks for JSON specifically
        const query = `${config.prompt} Output must be valid JSON matching the format: { "results": [], "sourcesUsed": [], "confidenceLevel": "high" }`;

        const response = await TavilyService.search(query, {
            includeAnswer: true,
            topic: "general",
            days: 1
        });

        if (!response || !response.answer) {
            throw new Error('No answer received from Tavily');
        }

        const parsed = parseSourceResponse(response.answer);
        if (!parsed) {
            throw new Error('Failed to parse Tavily answer as JSON');
        }

        const elapsed = Date.now() - startTime;
        state.successCount++;
        state.lastSuccessTime = Date.now();
        state.constituenciesReported = parsed.results.length || 0;
        state.avgResponseTime = state.avgResponseTime > 0
            ? (state.avgResponseTime * 0.7 + elapsed * 0.3)
            : elapsed;
        state.lastError = undefined;

        console.log(`[SourceManager] (Tavily) ${config.name}: ${parsed.results.length} constituencies`);

        return {
            sourceId: config.id,
            sourceName: config.name,
            sourceTier: config.tier,
            results: parsed.results as any[],
            sourcesUsed: response.results?.map(r => r.url) || [],
            confidenceLevel: (parsed.confidenceLevel as 'high' | 'medium' | 'low') || 'medium',
            fetchTime: Date.now(),
        };

    } catch (error) {
        state.errorCount++;
        state.lastError = String(error);
        console.error(`[SourceManager] (Tavily) ${config.name} error:`, error);
        await logError('source_fetch', `Failed to fetch from ${config.name} (Tavily)`, String(error), config.id);
        return null;
    }
}

function parseSourceResponse(text: string): { results: unknown[]; sourcesUsed: string[]; confidenceLevel: string } | null {
    try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;
        const parsed = JSON.parse(jsonMatch[0]);
        if (!parsed.results || !Array.isArray(parsed.results)) return null;
        return parsed as { results: unknown[]; sourcesUsed: string[]; confidenceLevel: 'high' | 'medium' | 'low' };
    } catch {
        return null;
    }
}

// ─── Multi-Source Fetch ──────────────────────────────────────────

/**
 * Fetch from multiple sources in parallel, returning results tagged by source.
 * Rotates through sources to conserve API quota.
 */
let sourceRotationIndex = 0;

export async function fetchFromMultipleSources(maxSources: number = 2, options?: { forceGemini?: boolean }): Promise<SourceFetchResult[]> {
    const activeSources = SOURCE_CONFIGS.filter(s => s.isActive);
    if (activeSources.length === 0) return [];

    // Pick sources in rotation
    const selected: SourceConfig[] = [];
    for (let i = 0; i < Math.min(maxSources, activeSources.length); i++) {
        const idx = (sourceRotationIndex + i) % activeSources.length;
        selected.push(activeSources[idx]);
    }
    sourceRotationIndex = (sourceRotationIndex + maxSources) % activeSources.length;

    console.log(`[SourceManager] Fetching from: ${selected.map(s => s.name).join(', ')}${options?.forceGemini ? ' (Force Gemini)' : ''}`);

    const promises = selected.map(s => fetchFromSource(s.id, options));
    const results = await Promise.allSettled(promises);

    return results
        .filter((r): r is PromiseFulfilledResult<SourceFetchResult | null> => r.status === 'fulfilled' && r.value !== null)
        .map(r => r.value!);
}

// ─── Source Management ───────────────────────────────────────────

export function getSourceConfigs(): SourceConfig[] {
    return SOURCE_CONFIGS;
}

export function getAllSourceStates(): SourceStatus[] {
    return Array.from(sourceStates.values());
}

export function getSourceState(sourceId: string): SourceStatus | undefined {
    return sourceStates.get(sourceId);
}

export function toggleSource(sourceId: string, active: boolean): void {
    const config = SOURCE_CONFIGS.find(s => s.id === sourceId);
    const state = sourceStates.get(sourceId);
    if (config) config.isActive = active;
    if (state) state.isActive = active;
}

export function getActiveSourceCount(): number {
    return SOURCE_CONFIGS.filter(s => s.isActive).length;
}

export function getSourceSummary() {
    const states = getAllSourceStates();
    return {
        totalSources: states.length,
        activeSources: states.filter(s => s.isActive).length,
        totalFetches: states.reduce((s, st) => s + st.fetchCount, 0),
        totalErrors: states.reduce((s, st) => s + st.errorCount, 0),
        totalConstituencies: states.reduce((s, st) => s + st.constituenciesReported, 0),
    };
}
