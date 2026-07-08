import { Store } from '../storage/Store';
import { SymptomLog } from '../types';

/**
 * Local RAG over the on-device log store.
 * Production: QVAC embeddings + a local vector index (SQLite/WatermelonDB);
 * here retrieval is recency + keyword scored, which behaves similarly for
 * short personal-log corpora.
 */
export class LocalRagEngine {
  /** Retrieve the logs most relevant to the query for prompt context. */
  static async retrieveRelevantLogs(query: string, limit = 5): Promise<SymptomLog[]> {
    console.log(`[RAG] Scoring local logs against query: "${query.slice(0, 60)}"`);
    const logs = await Store.getLogs();
    if (logs.length === 0) return [];

    const terms = query.toLowerCase().split(/\W+/).filter(w => w.length > 3);
    const now = Date.now();

    const scored = logs.map(log => {
      const haystack = [
        ...log.symptoms, log.mood ?? '', log.energy ?? '', log.flow ?? '', log.notes,
      ].join(' ').toLowerCase();
      const keywordHits = terms.filter(t => haystack.includes(t)).length;
      const ageDays = Math.max(0, (now - new Date(log.date).getTime()) / 86400000);
      const recency = Math.max(0, 1 - ageDays / 60); // decays over ~2 months
      return { log, score: keywordHits * 2 + recency };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.log)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /** Format retrieved logs as a prompt context block. Never leaves the device on Tier 3. */
  static formatContext(logs: SymptomLog[]): string {
    if (logs.length === 0) {
      return '[LOCAL RAG CONTEXT — user has no past logs recorded]\n';
    }
    let out = '[LOCAL RAG CONTEXT — DO NOT EXPOSE TO NETWORK]\nRelevant cycle logs:\n';
    for (const log of logs) {
      const d = new Date(log.date).toLocaleDateString();
      out += `- ${d}: mode=${log.mode}, symptoms=[${log.symptoms.join(',')}], mood=${log.mood}, energy=${log.energy}, flow=${log.flow}${log.notes ? `, notes="${log.notes}"` : ''}\n`;
    }
    return out + '[END CONTEXT]\n';
  }
}
