import { ApiResponse, Bill, MeterReading, OCRResult } from '@/types';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// 根據平台選擇正確的 API URL
const getApiUrl = () => {
  // 優先使用 app.config.js 中的配置
  if (Constants.expoConfig?.extra?.apiUrl) {
    return Constants.expoConfig.extra.apiUrl;
  }
  
  // 如果有環境變數，使用環境變數
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  
  // 開發環境下的 URL 配置
  if (__DEV__) {
    if (Platform.OS === 'web') {
      // Web 可以使用 localhost
      return 'http://localhost:8080/api/v1';
    } else {
      // 手機需要使用電腦的 IP 地址
      return 'http://192.168.0.172:8080/api/v1';
    }
  }
  
  // 生產環境
  return 'https://api.wattrent.com/api/v1';
};

const API_BASE_URL = getApiUrl();

class ApiService {
  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<ApiResponse<T>> {
    try {
      console.log(`API Request: ${API_BASE_URL}${endpoint}`);
      console.log('Using API URL:', API_BASE_URL);
      
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
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
      
      // 如果是網路錯誤，提供更友善的錯誤訊息
      if (error instanceof TypeError && error.message === 'Network request failed') {
        throw new Error('無法連線到伺服器，請確認：\n1. 後端服務是否已啟動\n2. 手機和電腦是否在同一網路\n3. 防火牆是否允許連線');
      }
      
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
    previousReading?: number;
    electricityUsage?: number;
    electricityRate: number;
    electricityCost?: number;
    rent: number;
    totalAmount?: number;
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

  async deleteBill(id: string): Promise<void> {
    await this.request<void>(`/bills/${id}`, {
      method: 'DELETE',
    });
  }

  async updateBill(id: string, data: Partial<Bill>): Promise<Bill> {
    const response = await this.request<Bill>(`/bills/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.data!;
  }
}

export default new ApiService(); 