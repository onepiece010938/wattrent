import { ApiResponse, Bill, OCRResult } from '@/types';
import { resolveApiUrl } from '@/lib/apiUrl';
import i18n from '@/lib/i18n';

const API_BASE_URL = resolveApiUrl();

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

class ApiService {
  /** Will be replaced with a Firebase Auth token provider once auth is wired in. */
  private authTokenProvider: (() => Promise<string | null>) | null = null;

  setAuthTokenProvider(provider: () => Promise<string | null>) {
    this.authTokenProvider = provider;
  }

  getBaseUrl(): string {
    return API_BASE_URL;
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<ApiResponse<T>> {
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

    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
    } catch (err) {
      if (err instanceof TypeError) {
        throw new Error(
          i18n.t('errors.backend.unreachable', { url: API_BASE_URL }),
        );
      }
      throw err;
    }

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
