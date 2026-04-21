import EventSource from 'eventsource';
import { loadConfig } from './config.js';

export async function streamBuildLogs(
  orgSlug: string,
  buildId: string,
  onLine: (line: string, level: string) => void,
  onDone: (status: string) => void,
): Promise<void> {
  const config = await loadConfig();
  const url = `${config.apiUrl}/orgs/${orgSlug}/builds/${buildId}/logs`;

  return new Promise((resolve, reject) => {
    const es = new EventSource(url, {
      headers: {
        Authorization: `Bearer ${config.token}`,
      },
    } as any);

    es.onmessage = (event: any) => {
      try {
        const data = JSON.parse(event.data);
        onLine(data.line, data.level ?? 'info');
      } catch {
        onLine(event.data, 'info');
      }
    };

    es.addEventListener('done', (event: any) => {
      const data = JSON.parse(event.data);
      onDone(data.status);
      es.close();
      resolve();
    });

    es.addEventListener('status', (event: any) => {
      const data = JSON.parse(event.data);
      if (['success', 'failed', 'cancelled'].includes(data.status)) {
        onDone(data.status);
        es.close();
        resolve();
      }
    });

    es.onerror = (err: any) => {
      es.close();
      reject(new Error('Log stream connection lost'));
    };
  });
}
