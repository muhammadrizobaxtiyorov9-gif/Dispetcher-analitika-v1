
import { Station } from '../types';

export interface MgspDefinition {
  name: string;
  codes: string[];
}

export const MGSP_DEFINITIONS: MgspDefinition[] = [
  { name: "САРЫАГАЧ", codes: ['69830', '6983', '6980', '68', '7077', '70771', '70770', '707701'] },
  { name: "СЫРДАРЬЯ", codes: ['72530', '7253', '7247'] },
  { name: "БЕКАБАД", codes: ['72620', '7262', '7261'] },
  { name: "ИСТИКЛОЛ", codes: ['73990', '7399', '7473'] },
  { name: "КИРГИЗИЯ", codes: ['71810', '71820', '7181', '7182', '7116', '7166', '71'] },
  { name: "ХОДЖИДАВЛЕТ", codes: ['73080', '7308', '7307', '7514'] },
  { name: "ТАЛИМАРДЖАН", codes: ['75930', '7593', '7527', '7528'] },
  { name: "РАЗЪЕЗД 161", codes: ['74990', '7499', '161'] },
  { name: "КУДУКЛИ", codes: ['73620', '7362', '7361', '7450'] },
  { name: "АМУЗАНГ", codes: ['73650', '73660', '7365', '7366'] },
  { name: "ГАЛАБА", codes: ['73640', '73630', '7364', '7363', '7496'] },
  { name: "ТАХИАТАШ", codes: ['73890', '7389'] },
  { name: "КАРАКАЛПАКСТАН", codes: ['73690', '7369', '7370'] }
];

/**
 * Identifies if a train index belongs to a specific border point protocol.
 */
export const identifyTrainProtocol = (trainIndex: string) => {
  const upper = trainIndex.toUpperCase();
  if (upper.includes("БEKAБ") || upper.includes("БЕКАБ") || upper.includes("BEKAB")) return { mgsp: "БЕКАБАД" };
  if (upper.includes("КУДУК") || upper.includes("KUDUK")) return { mgsp: "КУДУКЛИ" };
  if (upper.includes("ГАЛАБА") || upper.includes("GALABA")) return { mgsp: "ГАЛАБА" };
  if (upper.includes("ХОДЖИ") || upper.includes("HODJI")) return { mgsp: "ХОДЖИДАВЛЕТ" };
  if (upper.includes("САРЫ") || upper.includes("SARY")) return { mgsp: "САРЫАГАЧ" };
  if (upper.includes("КЕЛЕС") || upper.includes("KELES")) return { mgsp: "САРЫАГАЧ" };
  return null;
};

export const normalizeMgspName = (station?: Station, trainIndex?: string): string => {
  // PRIORITY 1: Explicit Station Object Match (FROM CППB)
  if (station) {
    const code = station.fullCode || station.id;
    const nameUpper = station.name.toUpperCase();
    
    // Check against definitions by Code Prefix
    for (const def of MGSP_DEFINITIONS) {
        if (def.codes.some(prefix => code.startsWith(prefix))) {
            return def.name;
        }
    }
    // Fallback: Check against definitions by Name
    for (const def of MGSP_DEFINITIONS) {
        if (nameUpper.includes(def.name.toUpperCase()) || def.name.toUpperCase().includes(nameUpper)) {
            return def.name;
        }
    }
  }

  // PRIORITY 2: Check Train Protocol
  if (trainIndex) {
    const protocol = identifyTrainProtocol(trainIndex);
    if (protocol) {
      return protocol.mgsp;
    }
  }

  // PRIORITY 3: DEEP ANALYSIS - Extract Code from Train Index
  if (trainIndex) {
      // Pattern 1: Machine Header (:902 XXXXX ...)
      const machineMatch = trainIndex.match(/:902\s+(\d{5})/);
      if (machineMatch) {
          const extractedCode = machineMatch[1];
          for (const def of MGSP_DEFINITIONS) {
              if (def.codes.some(prefix => extractedCode.startsWith(prefix))) {
                  return def.name;
              }
          }
      }

      // Pattern 2: Train Index (XXXX+...)
      const indexMatch = trainIndex.match(/\((\d+)\+/);
      if (indexMatch) {
          const extractedPrefix = indexMatch[1];
          for (const def of MGSP_DEFINITIONS) {
              if (def.codes.some(prefix => prefix.startsWith(extractedPrefix) || extractedPrefix.startsWith(prefix))) {
                  if (extractedPrefix.length >= 4) return def.name;
              }
          }
      }
  }
  
  // PRIORITY 4: Specific Fallback Name Checks
  const nameUpper = station?.name.toUpperCase() || "";
  if (nameUpper.includes("КЕЛЕС")) return "САРЫАГАЧ";
  if (nameUpper.includes("МАЛИК")) return "СЫРДАРЬЯ";
  if (nameUpper.includes("ОШ") || nameUpper.includes("КАРА-СУ")) return "КИРГИЗИЯ";
  if (nameUpper.includes("ХАЙРАТОН")) return "ГАЛАБА";
  if (nameUpper.includes("ОАЗИС")) return "КАРАКАЛПАКСТАН";

  return "ПРОЧИЕ";
};
