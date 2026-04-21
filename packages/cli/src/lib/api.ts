import axios, { type AxiosInstance } from 'axios';
import { loadConfig } from './config.js';

let client: AxiosInstance | null = null;

export function resetApiClient() {
  client = null;
}

export async function getApi(): Promise<AxiosInstance> {
  if (client) return client;

  const config = await loadConfig();
  client = axios.create({
    baseURL: config.apiUrl,
    headers: {
      ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
      'Content-Type': 'application/json',
    },
    timeout: 30_000,
  });

  return client;
}
