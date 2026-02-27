
// Ushbu fayl taqdim etilgan hujjat asosida poezd indekslari protokollarini saqlaydi.
// Format: "JO'NATUVCHI_KOD-QABUL_QILUVCHI_KOD" (o'rtadagi raqamni hisobga olmaganda)

export interface ProtocolRule {
  stationName: string;
  importRules: Set<string>; // Kabul (Kirish)
  exportRules: Set<string>; // Topshirish (Chiqish)
}

// Yordamchi funksiya: Indeks oralig'ini yaratish (agar kerak bo'lsa) yoki ro'yxatni shakllantirish
const createSet = (codes: string[]) => new Set(codes);

export const TRAIN_PROTOCOL_RULES: Record<string, ProtocolRule> = {
  "САРЫАГАЧ": {
    stationName: "САРЫАГАЧ",
    importRules: createSet([
      "6980-7200", "6980-7258", "6980-7478", "6980-7364", "6980-7400", 
      "6900-7200", "6600-7200", "7076-7200", "7076-7224", "7076-7235", 
      "7076-7227", "7076-7425", "9800-7200", "9859-7200", "9859-7227", 
      "9859-7235", "9859-7387"
    ]),
    exportRules: createSet([
      "7200-6980", "7200-7046", "7200-7076", "7200-6900", "7200-6600", 
      "7200-9859", "7200-7077"
    ])
  },
  "СЫРДАРЬЯ": {
    stationName: "СЫРДАРЬЯ",
    importRules: createSet(["7247-6970"]),
    exportRules: createSet(["6970-7247"])
  },
  "КАРАКАЛПАКСТАН": {
    stationName: "КАРАКАЛПАКСТАН",
    importRules: createSet(["6628-7372", "6611-7372"]),
    exportRules: createSet([
      "7372-6628", "7372-6611", "7300-6611", "7399-6611", "7398-6611", "7390-6611"
    ])
  },
  "БЕКАБАД": {
    stationName: "БЕКАБАД",
    importRules: createSet(["7478-7261", "7478-7258", "7478-6980"]),
    exportRules: createSet(["7261-7478", "6980-7478", "7258-7478", "7300-7478"])
  },
  "ИСТИКЛОЛ": {
    stationName: "ИСТИКЛОЛ",
    importRules: createSet(["7478-7400", "7476-7400"]),
    exportRules: createSet(["7400-7478", "7400-7476"])
  },
  "КУДУКЛИ": {
    stationName: "КУДУКЛИ",
    importRules: createSet([
      "7458-7351", "7258-7458", "7372-7452", "7372-7458", "7331-7458", 
      "7331-7452", "7331-7456", "7331-7453", "7300-7458", "7300-7452", 
      "7300-7456", "7300-7453", "7351-7452", "7356-7458"
    ]),
    exportRules: createSet(["7258-7452", "7258-7458"])
  },
  "АМУЗАНГ": {
    stationName: "АМУЗАНГ",
    importRules: createSet(["7464-7351", "7585-7372", "7585-7377"]),
    exportRules: createSet(["7351-7464", "7390-7585", "7377-7585"])
  },
  "ТАХИАТАШ": {
    stationName: "ТАХИАТАШ",
    importRules: createSet(["7585-7390", "7585-7372", "7585-7377"]),
    exportRules: createSet(["7372-7585", "7390-7585", "7377-7585"])
  },
  "ХОДЖИДАВЛЕТ": { // Hujjatda "Хожа давлет"
    stationName: "ХОДЖИДАВЛЕТ",
    importRules: createSet(["7571-7300", "7502-7300", "7504-7300"]),
    exportRules: createSet(["7300-7571", "7300-7569"])
  },
  "СУРХОНОБОД": { // Yangi stansiya
    stationName: "СУРХОНОБОД", // Hujjatda "Сурхонобод"
    importRules: createSet([
      "7568-7351", "7568-7453", "7568-7458", "7498-7351", "7498-7458", "7504-7453"
    ]),
    exportRules: createSet(["7351-7498"])
  },
  "КАРАСУ": {
    stationName: "КИРГИЗИЯ", // Karasu odatda Kirgiziya posti
    importRules: createSet(["7180-7437"]),
    exportRules: createSet(["7437-7180", "7400-7180", "7400-7196"])
  },
  "ШОЛЛИСОЙ": {
    stationName: "ШОЛЛИСОЙ", // Hujjatda bor, lekin asosiy MGSP ro'yxatida bo'lmasligi mumkin
    importRules: createSet(["7192-7414"]),
    exportRules: createSet(["7414-7192"])
  },
  "КИЗИЛКИЯ": {
    stationName: "КИЗИЛКИЯ",
    importRules: createSet(["7191-7429", "7191-7432"]),
    exportRules: createSet(["7432-7191", "7429-7191"])
  },
  "ГАЛАБА": {
    stationName: "ГАЛАБА",
    importRules: createSet(["7191-7429", "7364-7363"]), // Hujjatdagi Kizilkiya qatorlari aralashib ketgan bo'lishi mumkin, lekin Galaba 7364
    exportRules: createSet(["7432-7191", "7363-7364"])
  }
};

/**
 * Poezd indeksini tekshirish funksiyasi
 * @param fullIndex - "(6980+05+7200)" formatidagi indeks
 * @returns { mgsp: string, type: 'import' | 'export' } | null
 */
export const identifyTrainProtocol = (fullIndex: string): { mgsp: string, type: 'import' | 'export' } | null => {
  // Indeksdan raqamlarni ajratib olish: 6980, 05, 7200
  const match = fullIndex.match(/\(?\s*(\d+)\s*\+\s*\d+\s*\+\s*(\d+)\s*\)?/);
  
  if (!match) return null;

  const fromCode = match[1];
  const toCode = match[2];
  const key = `${fromCode}-${toCode}`;

  for (const [mgsp, rules] of Object.entries(TRAIN_PROTOCOL_RULES)) {
    if (rules.importRules.has(key)) {
      return { mgsp: rules.stationName, type: 'import' };
    }
    if (rules.exportRules.has(key)) {
      return { mgsp: rules.stationName, type: 'export' };
    }
  }

  return null;
};
