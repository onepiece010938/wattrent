// 電表讀數記錄
export interface MeterReading {
  id: string;
  userId?: string;
  reading: number; // 電表度數
  imageUrl?: string; // 電表照片 URL
  createdAt: string;
  previousReading?: number; // 上次讀數
  usage?: number; // 本期用電度數
}

// OCR 結果（嵌入 Bill 內）
export interface BillOcrResult {
  confidence: number;
  model: string;
  rawText?: string;
  processedAt: string;
}

// 帳單（與 backend models.Bill 對齊；userId 不回傳，由 token 決定）
export interface Bill {
  id: string;
  period: string; // 帳單期間（YYYY-MM）
  periodStart?: string; // 由後端產生的 ISO8601
  meterReading: number;
  previousReading: number;
  electricityUsage: number;
  electricityRate: number;
  electricityCost: number;
  rent: number;
  totalAmount: number;
  imageUrl?: string;
  paidAt?: string;
  ocr?: BillOcrResult;
  createdAt: string;
  updatedAt?: string;

  // 純客戶端欄位（generateBillMessage 用，不會 round-trip 到後端）
  message?: string;
  // legacy / mock 用，未來移除
  userId?: string;
  meterReadingId?: string;
}

// 用戶設定（與 backend models.UserSettings 對齊；userId 由 token 決定）
export interface UserSettings {
  defaultElectricityRate: number;
  defaultRent: number;
  previousMeterReading: number;
  landlordName?: string;
  paymentMethod?: string;
  language?: string;
  notificationsEnabled?: boolean;
  autoBackup?: boolean;
  updatedAt?: string;

  // legacy；舊頁面還在用，未來會移除
  userId?: string;
}

// API 回應格式
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// OCR 結果（/ocr/process 回傳）
export interface OCRResult {
  reading: number;
  confidence: number;
  rawText?: string;
  model?: string;
}
