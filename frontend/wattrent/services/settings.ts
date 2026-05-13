import { UserSettings } from '@/types';
import { resolveApiUrl } from '@/lib/apiUrl';

const API_BASE_URL = resolveApiUrl();

// 與後端 models.UserSettings 對齊的欄位（不含 userId — 由 token 決定）
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
  return fetch(`${API_BASE_URL}${path}`, { ...init, headers });
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
      console.warn(`settings: GET /settings failed (${API_BASE_URL}), 使用預設值`, err);
      return DEFAULT_SETTINGS;
    }
  }

  /** 完整覆寫 */
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

  /** 局部更新；只送有值的欄位 */
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
      const res = await fetch(`${API_BASE_URL}/health`, { method: 'GET' });
      return res.ok;
    } catch {
      return false;
    }
  }
}

export default new SettingsService();
