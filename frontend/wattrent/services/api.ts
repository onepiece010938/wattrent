import { ApiResponse, Bill, OCRResult } from '@/types';
import { resolveApiUrl } from '@/lib/apiUrl';
import i18n from '@/lib/i18n';

export interface CreateBillPayload {
  meterReading: number;
  electricityRate: number;
  rent: number;
  /** YYYY-MM */
  period: string;
  imageUrl?: string;
}

export interface SignedUploadResult {
  uploadUrl: string;
  gcsPath: string;
  expiresAt: string;
}

export interface RequestOptions extends Omit<RequestInit, 'signal'> {
  /** Request-specific timeout in milliseconds. Defaults to 15s. OCR uses 30s. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;

class ApiService {
  /** Will be replaced with a Firebase Auth token provider once auth is wired in. */
  private authTokenProvider: (() => Promise<string | null>) | null = null;

  setAuthTokenProvider(provider: () => Promise<string | null>) {
    this.authTokenProvider = provider;
  }

  /** Resolved per call so the dev-mode override picks up immediately. */
  getBaseUrl(): string {
    return resolveApiUrl();
  }

  private async request<T>(
    endpoint: string,
    options?: RequestOptions,
  ): Promise<ApiResponse<T>> {
    const baseUrl = this.getBaseUrl();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options?.headers as Record<string, string>) ?? {}),
    };

    if (this.authTokenProvider) {
      try {
        const token = await this.authTokenProvider();
        if (token) headers.Authorization = `Bearer ${token}`;
      } catch (err) {
        console.warn('failed to get auth token, sending request anonymously', err);
      }
    }

    const controller = new AbortController();
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      const { timeoutMs: _tmo, ...fetchOptions } = options ?? {};
      void _tmo;
      response = await fetch(`${baseUrl}${endpoint}`, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if ((err as Error)?.name === 'AbortError') {
        throw new Error(i18n.t('errors.backend.timeout', { seconds: Math.round(timeoutMs / 1000) }));
      }
      if (err instanceof TypeError) {
        throw new Error(i18n.t('errors.backend.unreachable', { url: baseUrl }));
      }
      throw err;
    }
    clearTimeout(timer);

    let data: ApiResponse<T>;
    try {
      data = (await response.json()) as ApiResponse<T>;
    } catch {
      throw new Error(i18n.t('errors.backend.parseFailed', { status: response.status }));
    }

    if (!response.ok || data.success === false) {
      throw new Error(data.error || data.message || `HTTP ${response.status}`);
    }
    return data;
  }

  // OCR
  async processImage(input: { imageBase64?: string; imageUrl?: string }): Promise<OCRResult> {
    const response = await this.request<OCRResult>('/ocr/process', {
      method: 'POST',
      body: JSON.stringify(input),
      // Gemini can take a few seconds; allow 30s before we give up
      timeoutMs: 30_000,
    });
    return response.data!;
  }

  // Uploads
  async signUpload(billId: string, contentType: string): Promise<SignedUploadResult> {
    const response = await this.request<SignedUploadResult>('/uploads/sign', {
      method: 'POST',
      body: JSON.stringify({ billId, contentType }),
    });
    return response.data!;
  }

  // Users
  /**
   * Idempotent: backend upserts /users/{uid}. Safe to call on every sign-in.
   */
  async bootstrapUser(profile?: { displayName?: string; photoURL?: string }): Promise<void> {
    await this.request<unknown>('/users/me', {
      method: 'POST',
      body: JSON.stringify({
        displayName: profile?.displayName ?? '',
        photoUrl: profile?.photoURL ?? '',
      }),
    });
  }

  async getMe(): Promise<{ uid: string; email: string; displayName?: string } | null> {
    try {
      const response = await this.request<{ uid: string; email: string; displayName?: string }>('/users/me');
      return response.data ?? null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('not_found')) return null;
      throw err;
    }
  }

  /**
   * PUT the binary body straight to a signed upload URL (returned by signUpload()).
   * Bypasses the API request envelope; the signed URL is hosted by GCS itself.
   */
  async putBinaryToSignedUrl(
    uploadUrl: string,
    body: ArrayBuffer | Blob | Uint8Array,
    contentType: string,
    timeoutMs: number = 30_000,
  ): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        body: body as any,
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`upload failed: HTTP ${res.status}`);
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        throw new Error(i18n.t('errors.backend.timeout', { seconds: Math.round(timeoutMs / 1000) }));
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  // Bills
  async createBill(payload: CreateBillPayload): Promise<Bill> {
    const response = await this.request<Bill>('/bills', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data!;
  }

  async getBills(): Promise<Bill[]> {
    const response = await this.request<Bill[]>('/bills');
    return response.data || [];
  }

  async getBill(id: string): Promise<Bill> {
    const response = await this.request<Bill>(`/bills/${id}`);
    return response.data!;
  }

  async getLatestBill(): Promise<Bill | null> {
    const response = await this.request<Bill>('/bills/latest');
    return response.data || null;
  }

  /** Toggle payment status (true = paid). */
  async setPaymentStatus(id: string, paid: boolean): Promise<Bill> {
    const response = await this.request<Bill>(`/bills/${id}/payment`, {
      method: 'PUT',
      body: JSON.stringify({ paid }),
    });
    return response.data!;
  }

  async deleteBill(id: string): Promise<void> {
    await this.request<void>(`/bills/${id}`, {
      method: 'DELETE',
    });
  }
}

export default new ApiService();
