
export type Language = 'ru' | 'uz';

export enum RegionName {
  Tashkent = "Ташкент (MTУ-1)",
  Kokand = "Коканд (MTУ-2)",
  Bukhara = "Бухара (MTУ-3)",
  Kungrad = "Кунград (MTУ-4)",
  Karshi = "Карши (MTУ-5)",
  Termez = "Термез (MTУ-6)",
  Other = "Другие ЖД / СНГ"
}

export interface MapPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  region: string;
}

export interface MtuRegion {
  id: string; // Unique ID for editing
  name: string;
  color: string;
  points: [number, number][]; // Array of lat/lng arrays
}

export interface Station {
  id: string; // The parsed 5-digit ID used for general display
  fullCode: string; // The original raw code (e.g., 750203) for advanced matching
  name: string;
  dor: number; // 73 for Uzbekistan
  otd?: number; // 1-6, optional
  regionName: string;
  isBorderPoint: boolean;
}

export interface Wagon {
  sequence: number;
  number: string; // Wagon number (8 digits)
  operationCode: string;
  cargoWeight: number; // Cargo weight in tonnes
  stationCode: string; // 5 digits
  cargoCode?: string; // Parsed cargo code (ETSNG)
  destinationStation?: string;
  matchedStation?: Station;
  entryPoint?: Station; // Incoming border point (CППB)
  trainIndex?: string; // The specific train identifier e.g. "(6980+05+7400)" or "(:902 ...)"
  arrivalDate?: Date; // Parsed arrival/entry time
  rawBlock?: string; // Original raw text block for this train
}

// --- CALENDAR TYPES ---
export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  type: 'day' | 'week' | 'month' | 'custom';
}

// --- DATABASE TYPES ---

export interface DailyReport {
  date: string; // YYYY-MM-DD (Primary Key)
  rawData: string; // The raw text file content
  wagons: Wagon[]; // Parsed wagons
  sections?: string[]; // Unique raw text blocks to save space
  stations: Station[]; // Parsed stations (if they change dynamically)
  timestamp: number; // When it was saved
  wagonCount?: number;
  totalWeight?: number;
}

export interface AppSettings {
  id: string; // 'map_config'
  mapPoints: MapPoint[];
  mtuRegions: MtuRegion[];
}

export type UserRole = 'superadmin' | 'admin' | 'user';

export interface AdminUser {
  username: string; // Document ID
  password?: string; // Stored (in a real app, should be hashed)
  role: UserRole;
  name?: string; // Display name
  lastLogin?: number;
  deviceInfo?: string;
  userAgent?: string;
  addedAt: number;
  createdBy?: string; // Username of the creator
}

export interface SystemLog {
  id: string;
  timestamp: number;
  action: 'LOGIN' | 'DATA_UPLOAD' | 'DATA_DELETE' | 'ADMIN_ADD' | 'ADMIN_DELETE' | 'ADMIN_UPDATE';
  username: string;
  details: string; // e.g., "Uploaded 50 wagons for 2024-02-20" or "Deleted train (6980+...)"
  ip?: string;
}

// ----------------------

export interface DashboardStats {
  totalWagons: number;
  wagonsAtBorder: number;
  wagonsByRegion: Record<string, number>;
  wagonsByCargo: Record<string, number>; // New field for cargo distribution
  topStations: { name: string; count: number; isBorder: boolean }[];
}

// Types for the Transit/Import Matrix Report
export type ReportCell = {
  wagons: number;
  tonnage: number;
};

export type TransitRowData = {
  mgsp: string; // e.g., "САРЫАГАЧ"
  tajikistan: ReportCell;
  turkmenistan: ReportCell;
  kazakhstan: ReportCell;
  kyrgyzstan: ReportCell;
  galaba: ReportCell; // Afghan direction usually via Galaba
  total: ReportCell;
};

export type ImportRowData = {
  mgsp: string;
  mtu1: ReportCell;
  mtu2: ReportCell;
  mtu3: ReportCell;
  mtu4: ReportCell;
  mtu5: ReportCell;
  mtu6: ReportCell;
  total: ReportCell;
};