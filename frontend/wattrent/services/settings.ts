import { UserSettings } from '@/types';
import { resolveApiUrl } from '@/lib/apiUrl';

// Resolved per call so the dev-mode override and runtime config picks up
// immediately (rather than freezing whatever was set at module load time).
const baseUrl = (): string => resolveApiUrl();

// Fields aligned with backend models.UserSettings (no userId; that is determined by the token).
type SettingsPayload = Omit<UserSettings, 'userId' | 'updatedAt'>;

const DEFAULT_SETTINGS: UserSettings = {
  defaultElectricityRate: 4.5,
  defaultRent: 8000,
  previousMeterReading: 0,
  landlordName: '',
  paymentMethod: 'bank_transfer',
};

let authTokenProvider: (() => Promise<string | null>) | null = null;

export function setAuthTokenProvider(p: () => Promise<string | null>) {
  authTokenProvider = p;
}

async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (authTokenProvider) {
    try {
      const token = await authTokenProvider();
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch (err) {
      console.warn('settings: failed to get auth token', err);
    }
  }
  return fetch(`${baseUrl()}${path}`, { ...init, headers });
}

function toPayload(s: UserSettings): SettingsPayload {
  return {
    defaultElectricityRate: s.defaultElectricityRate,
    defaultRent: s.defaultRent,
    previousMeterReading: s.previousMeterReading,
    landlordName: s.landlordName ?? '',
    paymentMethod: s.paymentMethod ?? '',
    language: s.language,
    notificationsEnabled: s.notificationsEnabled,
    autoBackup: s.autoBackup,
  };
}

class SettingsService {
  async getSettings(): Promise<UserSettings> {
    try {
      const res = await authedFetch('/settings');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      if (result.success && result.data) {
        return { ...DEFAULT_SETTINGS, ...result.data };
      }
      return DEFAULT_SETTINGS;
    } catch (err) {
      console.warn(`settings: GET /settings failed (${baseUrl()}), using defaults`, err);
      return DEFAULT_SETTINGS;
    }
  }

  /** Full overwrite */
  async saveSettings(settings: UserSettings): Promise<void> {
    const res = await authedFetch('/settings', {
      method: 'PUT',
      body: JSON.stringify(toPayload(settings)),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`save settings failed: HTTP ${res.status} ${txt}`);
    }
  }

  /** Partial update; only sends fields that are present */
  async patchSettings(partial: Partial<SettingsPayload>): Promise<UserSettings> {
    const res = await authedFetch('/settings', {
      method: 'PATCH',
      body: JSON.stringify(partial),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`patch settings failed: HTTP ${res.status} ${txt}`);
    }
    const result = await res.json();
    return { ...DEFAULT_SETTINGS, ...result.data };
  }

  async updatePreviousMeterReading(reading: number): Promise<void> {
    await this.patchSettings({ previousMeterReading: reading });
  }

  async clearSettings(): Promise<void> {
    const res = await authedFetch('/settings', { method: 'DELETE' });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`clear settings failed: HTTP ${res.status} ${txt}`);
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const res = await fetch(`${baseUrl()}/health`, { method: 'GET' });
      return res.ok;
    } catch {
      return false;
    }
  }
}

export default new SettingsService();
