import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

const ELECTION_PROMPT = `You are an election data extraction assistant for the Bangladesh 13th National Parliament Election held on February 12, 2026.

Search for the LATEST election results from Bangladesh. Extract constituency-level results.

For each constituency result you find, provide this JSON format:
{
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
          "partyId": "bnp" | "jamaat" | "jp-ershad" | "gonoforum" | "jasod" | "workers-party" | "islami-andolan" | "independent" | "others",
          "votes": <number>,
          "isWinner": <boolean>,
          "isLeading": <boolean>
        }
      ],
      "totalVotes": <number>,
      "winMargin": <number>
    }
  ],
  "summary": {
    "totalDeclared": <number>,
    "totalCounting": <number>,
    "partyStandings": {
      "bnp": { "won": <number>, "leading": <number> },
      "jamaat": { "won": <number>, "leading": <number> }
    }
  },
  "sourcesUsed": ["<source1>", "<source2>"],
  "confidenceLevel": "high" | "medium" | "low",
  "timestamp": "<ISO timestamp>"
}

IMPORTANT:
- Only include results you are confident about from reliable news sources
- Include the source URLs you found the information from
- If no new results are available, return {"results": [], "summary": null, "confidenceLevel": "low"}
- Map party names to their IDs: BNP="bnp", Jamaat-e-Islami="jamaat", Jatiya Party="jp-ershad", Independent="independent"
- Focus on newly declared or recently updated constituencies`;

const DIVISION_PROMPT = (division: string) => `Search for the latest Bangladesh 13th National Parliament Election results specifically for ${division} division constituencies. 

Return results in this exact JSON format:
{
  "results": [
    {
      "constituencyNumber": <number>,
      "constituencyName": "<name>",
      "division": "${division}",
      "district": "<district>",
      "status": "counting" | "declared" | "result_confirmed",
      "candidates": [
        {
          "name": "<candidate name>",
          "party": "<party>",
          "partyId": "bnp"|"jamaat"|"jp-ershad"|"independent"|"others",
          "votes": <number>,
          "isWinner": <boolean>,
          "isLeading": <boolean>
        }
      ],
      "totalVotes": <number>,
      "winMargin": <number>
    }
  ],
  "sourcesUsed": ["<url1>"],
  "confidenceLevel": "high"|"medium"|"low"
}

Only return data you are confident about. Map party names correctly.`;

export interface GeminiResult {
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
    summary?: {
        totalDeclared: number;
        totalCounting: number;
        partyStandings: Record<string, { won: number; leading: number }>;
    } | null;
    sourcesUsed: string[];
    confidenceLevel: 'high' | 'medium' | 'low';
    timestamp?: string;
}

// Track content hashes to avoid duplicate updates
const contentHashes = new Map<string, string>();

function hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(36);
}

export async function fetchElectionResults(): Promise<GeminiResult | null> {
    try {
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash-lite',
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 8192,
            },
            tools: [{ googleSearch: {} } as any],
        });

        const result = await model.generateContent(ELECTION_PROMPT);
        const text = result.response.text();

        // Check if content changed
        const hash = hashContent(text);
        if (contentHashes.get('main') === hash) {
            console.log('[Gemini] No new data (hash unchanged)');
            return null;
        }
        contentHashes.set('main', hash);

        return parseGeminiResponse(text);
    } catch (error) {
        console.error('[Gemini] Error fetching results:', error);
        return null;
    }
}

export async function fetchDivisionResults(division: string): Promise<GeminiResult | null> {
    try {
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash-lite',
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 4096,
            },
            tools: [{ googleSearch: {} } as any],
        });

        const result = await model.generateContent(DIVISION_PROMPT(division));
        const text = result.response.text();

        const hash = hashContent(text);
        if (contentHashes.get(division) === hash) {
            console.log(`[Gemini] No new data for ${division}`);
            return null;
        }
        contentHashes.set(division, hash);

        return parseGeminiResponse(text);
    } catch (error) {
        console.error(`[Gemini] Error fetching ${division}:`, error);
        return null;
    }
}

function parseGeminiResponse(text: string): GeminiResult | null {
    try {
        // Try to extract JSON from the response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.warn('[Gemini] No JSON found in response');
            return null;
        }

        const parsed = JSON.parse(jsonMatch[0]) as GeminiResult;

        // Validate structure
        if (!parsed.results || !Array.isArray(parsed.results)) {
            console.warn('[Gemini] Invalid response structure');
            return null;
        }

        return parsed;
    } catch (e) {
        console.error('[Gemini] Parse error:', e);
        return null;
    }
}

export function getApiCallCount(): number {
    return contentHashes.size;
}
