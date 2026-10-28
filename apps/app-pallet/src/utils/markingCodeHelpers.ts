import { ILabel } from '../store/app/types';
import { IPalletLine } from '../store/types';

/** GS1 group separator (ASCII 29). */
export const GS1_GROUP_SEPARATOR = '\x1D';

const LEGACY_NUMERIC_BARCODE = /^-{0,1}\d+$/;
const MARKING_CODE_PATTERN = /^.{0,1}01\d{13,14}/;
const AGGREGATION_LEVEL_PATTERN = /210[12]/;

const AIM_SCANNER_PREFIXES = [']C1', ']d2', ']Q3'] as const;
const ALTERNATE_GS_SEPARATORS = ['↔'] as const;
const SEMICOLON_BEFORE_AI = /;(?=(?:91|92|11\d{6}|10|2101|2102|37\d))/g;

const collapseGsSeparators = (code: string): string => code.replace(/[\u001d\x1d]+/g, GS1_GROUP_SEPARATOR);

export const stripScannerPrefix = (raw: string): string => {
  const upper = raw.toUpperCase();

  for (const prefix of AIM_SCANNER_PREFIXES) {
    if (upper.startsWith(prefix.toUpperCase())) {
      return raw.slice(prefix.length);
    }
  }

  return raw;
};

export const normalizeMarkSeparators = (raw: string): string => {
  let code = stripScannerPrefix(raw.trim());

  for (const separator of ALTERNATE_GS_SEPARATORS) {
    code = code.split(separator).join(GS1_GROUP_SEPARATOR);
  }

  code = code.replace(SEMICOLON_BEFORE_AI, GS1_GROUP_SEPARATOR);
  code = collapseGsSeparators(code);
  code = code.replace(/\s+/g, GS1_GROUP_SEPARATOR);

  return collapseGsSeparators(code);
};

export const normalizeScannedMarkCode = (raw: string): string => normalizeMarkSeparators(raw);

export const canonicalMarkCodeContent = (code: string): string => normalizeMarkSeparators(code).replace(/\x1D/g, '');

export const areMarkCodesEqual = (left: string, right: string): boolean =>
  canonicalMarkCodeContent(left) === canonicalMarkCodeContent(right);

export const matchesGs1MarkCodePattern = (brc: string): boolean => {
  if (!brc) {
    return false;
  }

  const normalized = normalizeScannedMarkCode(brc);
  return MARKING_CODE_PATTERN.test(normalized) || AGGREGATION_LEVEL_PATTERN.test(normalized);
};

export const isLegacyNumericBarcode = (brc: string): boolean =>
  LEGACY_NUMERIC_BARCODE.test(brc) && !matchesGs1MarkCodePattern(brc);

export const isMarkingCode = (brc: string): boolean => matchesGs1MarkCodePattern(brc);

// Индексы канонических кодов кэшируются по ссылке массива: Redux держит
// стабильную ссылку, пока данные не изменились, поэтому нормализация каждой
// метки/строки выполняется один раз, а не на каждом скане.
const labelIndexCache = new WeakMap<ILabel[], Map<string, ILabel>>();
const lineMarkCache = new WeakMap<IPalletLine[], Set<string>>();

const getLabelIndex = (labels: ILabel[]): Map<string, ILabel> => {
  const cached = labelIndexCache.get(labels);
  if (cached) {
    return cached;
  }

  const index = new Map<string, ILabel>();
  for (const label of labels) {
    const key = canonicalMarkCodeContent(label.code);
    if (!index.has(key)) {
      index.set(key, label);
    }
  }
  labelIndexCache.set(labels, index);
  return index;
};

const getLineMarkSet = (lines: IPalletLine[]): Set<string> => {
  const cached = lineMarkCache.get(lines);
  if (cached) {
    return cached;
  }

  const marks = new Set<string>();
  for (const line of lines) {
    if (line.mark?.code) {
      marks.add(canonicalMarkCodeContent(line.mark.code));
    }
  }
  lineMarkCache.set(lines, marks);
  return marks;
};

export const findLabelByCode = (code: string, labels: ILabel[]): ILabel | undefined =>
  getLabelIndex(labels).get(canonicalMarkCodeContent(code));

export const isPalletMarkDuplicate = (markCode: string, lines: IPalletLine[] | undefined): boolean =>
  !!lines && getLineMarkSet(lines).has(canonicalMarkCodeContent(markCode));

export type PalletMarkScanResult =
  | { kind: 'legacy' }
  | { kind: 'not_found'; markCode: string }
  | { kind: 'found'; label: ILabel; markCode: string };

export const resolvePalletMark = (rawCode: string, labels: ILabel[]): PalletMarkScanResult => {
  if (isLegacyNumericBarcode(rawCode)) {
    return { kind: 'legacy' };
  }

  const markCode = normalizeScannedMarkCode(rawCode);
  const label = findLabelByCode(markCode, labels);

  if (!label) {
    return { kind: 'not_found', markCode };
  }

  return { kind: 'found', label, markCode };
};
