// 電表讀數記錄
export interface MeterReading {
  id: string;
  userId: string;
  reading: number; // 電表度數
  imageUrl?: string; // 電表照片 URL
  createdAt: string;
  previousReading?: number; // 上次讀數
  usage?: number; // 本期用電度數
}

// 帳單
export interface Bill {
  id: string;
  userId: string;
  meterReadingId: string;
  meterReading: number; // 電表讀數
  electricityUsage: number; // 用電度數
  electricityRate: number; // 每度電費
  electricityCost: number; // 電費總額
  rent: number; // 房租
  totalAmount: number; // 總金額
  period: string; // 帳單期間
  createdAt: string;
  paidAt?: string;
  message?: string; // 生成的付款訊息
}

// 用戶設定
export interface UserSettings {
  userId: string;
  defaultElectricityRate: number; // 預設電費單價
  defaultRent: number; // 預設房租
  previousMeterReading: number; // 前次(月)電表度數(初始電表度數)
  landlordName?: string; // 房東名稱
  paymentMethod?: string; // 付款方式
}

// API 回應格式
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// OCR 結果
export interface OCRResult {
  reading: number;
  confidence: number;
  rawText?: string;
} 