import AsyncStorage from '@react-native-async-storage/async-storage';

const LOGS_STORAGE_KEY = '@lunapredict_symptom_logs';

export interface SymptomLog {
  id: string;
  date: string;
  symptoms: string[];
  mood: string | null;
  energy: string | null;
  flow: string | null;
  notes: string;
  mode: string;
}

export class LocalRagEngine {
  /**
   * Saves a daily log to the local secure storage.
   * In a production environment, this would also generate an embedding via QVAC
   * and store it in a Vector DB like WatermelonDB + SQLite.
   */
  static async saveLog(log: SymptomLog): Promise<void> {
    try {
      console.log(`[RAG] Saving log to local storage for future inference context...`);
      const existingLogsStr = await AsyncStorage.getItem(LOGS_STORAGE_KEY);
      const existingLogs: SymptomLog[] = existingLogsStr ? JSON.parse(existingLogsStr) : [];
      
      existingLogs.push(log);
      await AsyncStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(existingLogs));
      console.log(`[RAG] Successfully saved log ${log.id}`);
    } catch (e) {
      console.error('[RAG] Failed to save log', e);
    }
  }

  /**
   * Retrieves relevant logs from local storage.
   * Phase 2 implementation simulates retrieving the last 3 days of logs to build context.
   */
  static async retrieveRelevantLogs(query: string): Promise<string> {
    console.log(`[RAG] Generating embedding for query: "${query}"`);
    console.log(`[RAG] Searching local AsyncStorage vector database...`);
    
    // Simulate vector search latency
    await new Promise(resolve => setTimeout(resolve, 600));

    try {
      const existingLogsStr = await AsyncStorage.getItem(LOGS_STORAGE_KEY);
      const existingLogs: SymptomLog[] = existingLogsStr ? JSON.parse(existingLogsStr) : [];
      
      if (existingLogs.length === 0) {
         return "[LOCAL RAG CONTEXT - User has no past logs recorded.]\n";
      }

      // Grab the 3 most recent logs
      const recentLogs = existingLogs.slice(-3).reverse();
      
      let contextStr = "[LOCAL RAG CONTEXT - DO NOT EXPOSE TO NETWORK]\nUser's Recent Cycle Logs:\n";
      recentLogs.forEach(log => {
        const d = new Date(log.date).toLocaleDateString();
        contextStr += `- ${d}: Mode=${log.mode}, Symptoms=[${log.symptoms.join(',')}], Mood=${log.mood}, Energy=${log.energy}, Flow=${log.flow}. Notes: "${log.notes}"\n`;
      });
      contextStr += "[END CONTEXT]\n";

      console.log(`[RAG] Found ${recentLogs.length} relevant logs. Injecting into prompt.`);
      return contextStr;
    } catch (e) {
      console.error('[RAG] Failed to retrieve logs', e);
      return "[LOCAL RAG CONTEXT - Error retrieving logs]\n";
    }
  }
}
