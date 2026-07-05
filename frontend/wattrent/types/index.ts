// Meter reading record.
export interface MeterReading {
  id: string;
  userId?: string;
  reading: number; // meter reading (kWh)
  imageUrl?: string; // meter photo URL
  createdAt: string;
  previousReading?: number; // previous reading
  usage?: number; // usage for the current period
}

// OCR result (embedded inside Bill).
export interface BillOcrResult {
  confidence: number;
  model: string;
  rawText?: string;
  processedAt: string;
}

// Bill (mirrors backend models.Bill; userId is omitted, derived from token).
export interface Bill {
  id: string;
  period: string; // billing period (YYYY-MM)
  periodStart?: string; // ISO8601 produced by the backend
  meterReading: number;
  previousReading: number;
  electricityUsage: number;
  electricityRate: number;
  electricityCost: number;
  rent: number;
  totalAmount: number;
  imageUrl?: string;
  imageViewUrl?: string; // short-lived signed GET URL, populated only on detail fetch
  paidAt?: string;
  ocr?: BillOcrResult;
  createdAt: string;
  updatedAt?: string;

  // Client-only fields (used by generateBillMessage; not round-tripped to the backend)
  message?: string;
  // legacy / mock; remove in the future
  userId?: string;
  meterReadingId?: string;
}

// User settings (mirrors backend models.UserSettings; userId is derived from token).
export interface UserSettings {
  defaultElectricityRate: number;
  defaultRent: number;
  previousMeterReading: number;
  landlordName?: string;
  paymentMethod?: string;
  messageTemplate?: string;
  setupCompleted?: boolean;
  language?: string;
  notificationsEnabled?: boolean;
  autoBackup?: boolean;
  updatedAt?: string;

  // legacy; still used by old screens, remove in the future
  userId?: string;
}

// Unified API response envelope.
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// OCR result returned by /ocr/process.
export interface OCRResult {
  reading: number;
  confidence: number;
  rawText?: string;
  model?: string;
}
