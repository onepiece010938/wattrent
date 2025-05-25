import { ApiResponse, Bill, MeterReading, OCRResult } from '@/types';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

class ApiService {
  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.message || '請求失敗');
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // OCR 相關
  async processImage(imageBase64: string): Promise<OCRResult> {
    const response = await this.request<OCRResult>('/ocr/process', {
      method: 'POST',
      body: JSON.stringify({ imageBase64 }),
    });
    return response.data!;
  }

  // 帳單相關
  async createBill(data: {
    meterReading: number;
    electricityRate: number;
    rent: number;
    period: string;
    imageUrl?: string;
  }): Promise<Bill> {
    const response = await this.request<Bill>('/bills', {
      method: 'POST',
      body: JSON.stringify(data),
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

  async updateBillPayment(id: string): Promise<Bill> {
    const response = await this.request<Bill>(`/bills/${id}/payment`, {
      method: 'PUT',
    });
    return response.data!;
  }
}

export default new ApiService(); 