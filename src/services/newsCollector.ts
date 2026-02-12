import { GoogleGenerativeAI } from '@google/generative-ai';
import { addNewsItem } from './firestore';
import type { NewsItem } from '../types/election';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

// ─── News Collection Configuration ──────────────────────────────

const NEWS_PROMPT = `You are a news aggregator for the Bangladesh 13th National Parliament Election held on February 12, 2026.

Search for the LATEST election news, updates, and breaking developments from major Bangladesh and international news outlets including bdnews24.com, The Daily Star, Prothom Alo, Dhaka Tribune, NDTV, India Today, Al Jazeera, and BBC.

For each news item, provide this JSON format:
{
  "news": [
    {
      "headline": "<headline>",
      "summary": "<2-3 sentence summary>",
      "source": "<source name>",
      "sourceUrl": "<url>",
      "category": "breaking" | "result" | "analysis" | "incident" | "general",
      "importance": "high" | "medium" | "low"
    }
  ],
  "timestamp": "<ISO timestamp>"
}

Focus on:
- Breaking results declarations
- Voter turnout updates
- Election irregularities or incidents
- Major party reactions and statements
- Referendum updates
- International reactions
- Analysis and projections

IMPORTANT: Only include verified news from reliable sources. Maximum 10 items.`;

// ─── Deduplication ───────────────────────────────────────────────

const seenHeadlines = new Set<string>();
const MAX_SEEN_HEADLINES = 500;

function normalizeHeadline(headline: string): string {
    return headline
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function hashHeadline(headline: string): string {
    const normalized = normalizeHeadline(headline);
    // Simple hash for dedup
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
        const char = normalized.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(36);
}

function isDuplicate(headline: string): boolean {
    const hash = hashHeadline(headline);
    return seenHeadlines.has(hash);
}

function markAsSeen(headline: string): void {
    const hash = hashHeadline(headline);
    seenHeadlines.add(hash);

    // Prevent unbounded growth
    if (seenHeadlines.size > MAX_SEEN_HEADLINES) {
        const iterator = seenHeadlines.values();
        for (let i = 0; i < 100; i++) {
            const val = iterator.next().value;
            if (val) seenHeadlines.delete(val);
        }
    }
}

// ─── News Collection Engine ─────────────────────────────────────

let lastNewsFetchTime = 0;
const NEWS_COOLDOWN_MS = 120_000; // 2 minutes minimum between fetches
let autoNewsEnabled = true;
let totalAutoNewsFetched = 0;

export interface NewsCollectionResult {
    success: boolean;
    itemsAdded: number;
    itemsSkipped: number;
    message: string;
}

export async function collectNews(): Promise<NewsCollectionResult> {
    if (!autoNewsEnabled) {
        return { success: false, itemsAdded: 0, itemsSkipped: 0, message: 'Auto-news disabled' };
    }

    const now = Date.now();
    if (now - lastNewsFetchTime < NEWS_COOLDOWN_MS) {
        const remaining = Math.ceil((NEWS_COOLDOWN_MS - (now - lastNewsFetchTime)) / 1000);
        return { success: false, itemsAdded: 0, itemsSkipped: 0, message: `Cooldown: ${remaining}s remaining` };
    }

    lastNewsFetchTime = now;

    try {
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash-lite',
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 4096,
            },
            tools: [{ googleSearch: {} } as any],
        });

        const result = await model.generateContent(NEWS_PROMPT);
        const text = result.response.text();

        const parsed = parseNewsResponse(text);
        if (!parsed || !parsed.news.length) {
            return { success: true, itemsAdded: 0, itemsSkipped: 0, message: 'No new news items found' };
        }

        let added = 0;
        let skipped = 0;

        for (const item of parsed.news) {
            if (!item.headline?.trim()) {
                skipped++;
                continue;
            }

            if (isDuplicate(item.headline)) {
                skipped++;
                continue;
            }

            markAsSeen(item.headline);

            const newsItem: Omit<NewsItem, 'id'> = {
                headline: item.headline,
                summary: item.summary || '',
                source: item.source || 'Auto-collected',
                sourceUrl: item.sourceUrl || '',
                timestamp: Date.now(),
                category: validateCategory(item.category),
                isVerified: item.importance === 'high', // Only high-importance auto-verified
            };

            await addNewsItem(newsItem);
            added++;
            totalAutoNewsFetched++;
        }

        console.log(`[NewsCollector] Added ${added} items, skipped ${skipped} duplicates`);
        return {
            success: true,
            itemsAdded: added,
            itemsSkipped: skipped,
            message: `Collected ${added} news items`,
        };

    } catch (error) {
        console.error('[NewsCollector] Error:', error);
        return { success: false, itemsAdded: 0, itemsSkipped: 0, message: `Error: ${error}` };
    }
}

// ─── Parse Gemini News Response ──────────────────────────────────

interface ParsedNewsItem {
    headline: string;
    summary: string;
    source: string;
    sourceUrl: string;
    category: string;
    importance: string;
}

function parseNewsResponse(text: string): { news: ParsedNewsItem[] } | null {
    try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;

        const parsed = JSON.parse(jsonMatch[0]);
        if (!parsed.news || !Array.isArray(parsed.news)) return null;

        return parsed;
    } catch {
        return null;
    }
}

function validateCategory(cat: string): NewsItem['category'] {
    const valid: NewsItem['category'][] = ['breaking', 'result', 'analysis', 'incident', 'general'];
    return valid.includes(cat as unknown as NewsItem['category']) ? cat as NewsItem['category'] : 'general';
}

// ─── Controls ────────────────────────────────────────────────────

export function setAutoNewsEnabled(enabled: boolean): void {
    autoNewsEnabled = enabled;
    console.log(`[NewsCollector] Auto-news ${enabled ? 'enabled' : 'disabled'}`);
}

export function isAutoNewsEnabled(): boolean {
    return autoNewsEnabled;
}

export function getNewsCollectorStats() {
    return {
        autoEnabled: autoNewsEnabled,
        lastFetchTime: lastNewsFetchTime,
        totalAutoFetched: totalAutoNewsFetched,
        seenHeadlines: seenHeadlines.size,
        cooldownMs: NEWS_COOLDOWN_MS,
    };
}
