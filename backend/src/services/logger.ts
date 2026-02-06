import { getDatabase, saveDatabase } from '../database/db';
import { LogEntry } from '../types';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private log(level: LogLevel, source: string, message: string, details?: Record<string, unknown>): void {
    try {
      const db = getDatabase();
      const detailsJson = details ? JSON.stringify(details) : null;
      const createdAt = new Date().toISOString();

      db.run(
        `INSERT INTO logs (level, source, message, details, created_at) VALUES (?, ?, ?, ?, ?)`,
        [level, source, message, detailsJson, createdAt]
      );
      saveDatabase();
    } catch (e) {
      // Database might not be initialized yet
    }

    // Also log to console
    const timestamp = new Date().toISOString();
    const detailsStr = details ? ` ${JSON.stringify(details)}` : '';
    console.log(`[${timestamp}] [${level.toUpperCase()}] [${source}] ${message}${detailsStr}`);
  }

  debug(source: string, message: string, details?: Record<string, unknown>): void {
    this.log('debug', source, message, details);
  }

  info(source: string, message: string, details?: Record<string, unknown>): void {
    this.log('info', source, message, details);
  }

  warn(source: string, message: string, details?: Record<string, unknown>): void {
    this.log('warn', source, message, details);
  }

  error(source: string, message: string, details?: Record<string, unknown>): void {
    this.log('error', source, message, details);
  }

  getLogs(options: {
    level?: LogLevel;
    source?: string;
    limit?: number;
    offset?: number;
  } = {}): LogEntry[] {
    const db = getDatabase();
    const { level, source, limit = 100, offset = 0 } = options;

    let query = 'SELECT * FROM logs WHERE 1=1';
    const params: (string | number)[] = [];

    if (level) {
      query += ' AND level = ?';
      params.push(level);
    }

    if (source) {
      query += ' AND source = ?';
      params.push(source);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const results = db.exec(query, params);

    if (results.length === 0 || results[0].values.length === 0) {
      return [];
    }

    const columns = results[0].columns;
    return results[0].values.map(row => {
      const obj: Record<string, unknown> = {};
      columns.forEach((col, i) => {
        obj[col] = row[i];
      });
      return {
        id: obj.id as number,
        level: obj.level as LogLevel,
        source: obj.source as string,
        message: obj.message as string,
        details: obj.details ? JSON.parse(obj.details as string) : undefined,
        created_at: obj.created_at as string,
      };
    });
  }

  clearLogs(olderThanDays?: number): void {
    const db = getDatabase();

    if (olderThanDays) {
      db.run(
        `DELETE FROM logs WHERE created_at < datetime('now', '-' || ? || ' days')`,
        [olderThanDays]
      );
    } else {
      db.run('DELETE FROM logs');
    }
    saveDatabase();
  }
}

export const logger = new Logger();
