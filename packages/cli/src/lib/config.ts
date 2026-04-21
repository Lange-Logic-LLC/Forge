import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.forge');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export interface CliConfig {
  apiUrl: string;
  token: string | null;
  activeOrg: string | null; // org slug
}

const DEFAULT_CONFIG: CliConfig = {
  apiUrl: 'http://localhost:3000',
  token: null,
  activeOrg: null,
};

export async function loadConfig(): Promise<CliConfig> {
  try {
    const raw = await fs.readFile(CONFIG_FILE, 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(config: Partial<CliConfig>): Promise<void> {
  const current = await loadConfig();
  const merged = { ...current, ...config };
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(merged, null, 2));
}

export async function requireAuth(): Promise<{ config: CliConfig; token: string; org: string }> {
  const config = await loadConfig();
  if (!config.token) {
    console.error('Not logged in. Run: forge login');
    process.exit(1);
  }
  if (!config.activeOrg) {
    console.error('No active organization. Run: forge org:switch <slug>');
    process.exit(1);
  }
  return { config, token: config.token, org: config.activeOrg };
}

// Read eas.json from the project directory
export async function loadEasConfig(): Promise<Record<string, any> | null> {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), 'eas.json'), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
