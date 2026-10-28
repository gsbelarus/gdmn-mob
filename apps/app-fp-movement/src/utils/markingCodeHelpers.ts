import { round } from '@lib/mobile-hooks';

import { IGood, ILabel, IRemGood } from '../store/app/types';
import { IBasedLine } from '../store/types';

import { ONE_KG_IN_G } from './constants';

/** GS1 group separator (ASCII 29). Same character used in gd-movement regexes for DataMatrix. */
export const GS1_GROUP_SEPARATOR = '\x1D';

const LEGACY_NUMERIC_BARCODE = /^-{0,1}\d+$/;
const MARKING_CODE_PATTERN = /^.{0,1}01\d{13,14}/;
const AGGREGATION_LEVEL_PATTERN = /210[12]/;

/** AIM symbology prefixes that hardware scanners prepend (see ScanBarcodeReader in mobile-ui). */
const AIM_SCANNER_PREFIXES = [']C1', ']d2', ']Q3'] as const;

/** Visual/alternate GS substitutes seen in mock data, Gedymin payloads and scanners. */
const ALTERNATE_GS_SEPARATORS = ['↔'] as const;

/** Semicolon as GS only before known AIs — not inside AI 21 serial (e.g. `587;QMOC`). */
const SEMICOLON_BEFORE_AI = /;(?=(?:91|92|11\d{6}|10|2101|2102|37\d))/g;
const GS_SEPARATOR_RUN = new RegExp(`${GS1_GROUP_SEPARATOR}+`, 'g');
const AGGREGATION_QTY_PATTERN = new RegExp(`01(\\d{13,14})37(\\d+?)(?=${GS1_GROUP_SEPARATOR}|11|10|2101|2102|$)`);

const collapseGsSeparators = (code: string): string => code.replace(GS_SEPARATOR_RUN, GS1_GROUP_SEPARATOR);

/** GS1 human-readable form wraps AIs in parentheses, e.g. `(01)0481…(11)260811`. Scanners may emit this verbatim. */
export const stripGs1Parentheses = (code: string): string => code.replace(/[()]/g, '');

/** Converts spaces and alternate separators to canonical `\x1D` GS (preserves existing GS). */
export const normalizeMarkSeparators = (raw: string): string => {
  let code = stripGs1Parentheses(stripScannerPrefix(raw.trim()));

  for (const separator of ALTERNATE_GS_SEPARATORS) {
    code = code.split(separator).join(GS1_GROUP_SEPARATOR);
  }

  code = code.replace(SEMICOLON_BEFORE_AI, GS1_GROUP_SEPARATOR);

  code = collapseGsSeparators(code);
  code = code.replace(/\s+/g, GS1_GROUP_SEPARATOR);

  return collapseGsSeparators(code);
};

/** Normalizes raw scan to canonical GS1 string with `\x1D` separators. */
export const normalizeScannedMarkCode = (raw: string): string => normalizeMarkSeparators(raw);

/** Content-only form for lookup (ignores GS vs space representation). */
export const canonicalMarkCodeContent = (code: string): string =>
  normalizeMarkSeparators(code).split(GS1_GROUP_SEPARATOR).join('');

/** Makes GS visible in Metro/console logs. */
export const formatMarkCodeForLog = (code: string): string => code.split(GS1_GROUP_SEPARATOR).join('[GS]');

export const logMarkingScanDebug = ({
  rawCode,
  markCode,
  result,
  labels,
}: {
  rawCode: string;
  markCode: string;
  result: MarkingScanResult;
  labels: ILabel[];
}): void => {
  const scanCanonical = canonicalMarkCodeContent(rawCode);
  const gtin = parseGtinFromCode(rawCode);

  console.log('[marking] --- scan debug ---');
  console.log('[marking] raw:', formatMarkCodeForLog(rawCode), `(len=${rawCode.length})`);
  console.log('[marking] normalized:', formatMarkCodeForLog(markCode), `(len=${markCode.length})`);
  console.log('[marking] canonical:', scanCanonical, `(len=${scanCanonical.length})`);
  console.log('[marking] gtin:', gtin ?? 'n/a');

  if (result.kind === 'found') {
    console.log('[marking] result: FOUND', {
      labelId: result.label.id,
      levelCode: result.levelCode,
      goodId: result.good.id,
      weightKg: result.weight,
    });
    console.log('[marking] ref code:', formatMarkCodeForLog(result.label.code));
    console.log('[marking] ref canonical:', canonicalMarkCodeContent(result.label.code));
    return;
  }

  console.log('[marking] result: NOT FOUND', result.kind === 'not_found' ? result.reason : '');

  const candidates = gtin ? labels.filter((label) => parseGtinFromCode(label.code) === gtin) : labels;

  console.log('[marking] labels total:', labels.length, 'gtin candidates:', candidates.length);

  candidates.slice(0, 10).forEach((label) => {
    const refCanonical = canonicalMarkCodeContent(label.code);
    console.log('[marking] ref candidate:', {
      id: label.id,
      levelCode: label.levelCode,
      refCode: formatMarkCodeForLog(label.code),
      refCanonical,
      canonicalMatch: refCanonical === scanCanonical,
    });
  });

  if (candidates.length > 10) {
    console.log('[marking] ... and', candidates.length - 10, 'more gtin candidates');
  }
};

export type MarkingNotFoundReason = 'label_missing' | 'good_missing' | 'code_mismatch';

export type MarkingScanResult =
  | { kind: 'legacy' }
  | { kind: 'not_found'; markCode: string; reason: MarkingNotFoundReason }
  | {
      kind: 'found';
      label: ILabel;
      good: IGood;
      weight: number;
      markCode: string;
      levelCode: number;
      isRightWeight: boolean;
    };

export type MarkingLineFields = Pick<
  IBasedLine,
  'good' | 'weight' | 'mark' | 'barcode' | 'workDate' | 'numReceived' | 'quantPack' | 'usedRemains' | 'sortOrder'
>;

/** Removes AIM prefixes (`]C1`, `]d2`, `]Q3`) like ScanBarcodeReader does for `]C1`. */
export const stripScannerPrefix = (raw: string): string => {
  const upper = raw.toUpperCase();

  for (const prefix of AIM_SCANNER_PREFIXES) {
    if (upper.startsWith(prefix.toUpperCase())) {
      return raw.slice(prefix.length);
    }
  }

  return raw;
};

/**
 * Compares mark codes ignoring separator representation.
 * Reference may store spaces, GS, or no separators at all; scanners may send `\x1D`, `↔`, `;`, or spaces.
 */
export const areMarkCodesEqual = (left: string, right: string): boolean =>
  canonicalMarkCodeContent(left) === canonicalMarkCodeContent(right);

/** Legacy tech barcode date starts after the 6-digit weight field (see getBarcode). */
const LEGACY_TECH_BARCODE_DATE_OFFSET = 6;

/**
 * Numeric tech barcode layout (weight + DDMMYY + …).
 * Weight can start with `01`, which falsely matches GS1 AI 01 (GTIN).
 */
export const looksLikeLegacyTechBarcode = (brc: string): boolean => {
  if (!LEGACY_NUMERIC_BARCODE.test(brc) || brc.length < LEGACY_TECH_BARCODE_DATE_OFFSET + 6) {
    return false;
  }

  if (brc.length > 35) {
    return false;
  }

  const day = Number(brc.slice(LEGACY_TECH_BARCODE_DATE_OFFSET, LEGACY_TECH_BARCODE_DATE_OFFSET + 2));
  const month = Number(brc.slice(LEGACY_TECH_BARCODE_DATE_OFFSET + 2, LEGACY_TECH_BARCODE_DATE_OFFSET + 4));
  const year = Number(brc.slice(LEGACY_TECH_BARCODE_DATE_OFFSET + 4, LEGACY_TECH_BARCODE_DATE_OFFSET + 6));

  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) {
    return false;
  }

  if (day < 1 || day > 31 || month < 1 || month > 12) {
    return false;
  }

  const date = new Date(2000 + year, month - 1, day);

  return date.getFullYear() === 2000 + year && date.getMonth() === month - 1 && date.getDate() === day;
};

/** GS1 DataMatrix / aggregation content (01… or 2101/2102), including collapsed all-digit codes. */
export const matchesGs1MarkCodePattern = (brc: string): boolean => {
  if (!brc || looksLikeLegacyTechBarcode(brc)) {
    return false;
  }

  const normalized = normalizeScannedMarkCode(brc);
  return MARKING_CODE_PATTERN.test(normalized) || AGGREGATION_LEVEL_PATTERN.test(normalized);
};

export const isLegacyNumericBarcode = (brc: string): boolean =>
  LEGACY_NUMERIC_BARCODE.test(brc) && !matchesGs1MarkCodePattern(brc);

export const shouldFallbackToLegacyBarcode = (brc: string, markingResult: MarkingScanResult): boolean =>
  markingResult.kind === 'not_found' && looksLikeLegacyTechBarcode(brc);

export const isMarkingCode = (brc: string): boolean => matchesGs1MarkCodePattern(brc);

export const parseGtinFromCode = (code: string): string | undefined => {
  const normalized = normalizeScannedMarkCode(code);
  const match = normalized.match(/01(\d{13,14})/);
  if (!match) {
    return undefined;
  }

  const gtin = match[1];
  return gtin.length === 13 ? gtin : gtin.slice(-13);
};

export const parseAggregationLevel = (code: string): 0 | 1 | 2 | undefined => {
  const normalized = normalizeScannedMarkCode(code);

  if (normalized.includes('2102')) {
    return 2;
  }

  if (normalized.includes('2101')) {
    return 1;
  }

  if (MARKING_CODE_PATTERN.test(normalized)) {
    return 0;
  }

  return undefined;
};

/**
 * Индексы справочников и строк кэшируются по ссылке массива: Redux держит
 * ссылку стабильной, пока данные не изменились, поэтому нормализация каждой
 * метки/строки выполняется один раз, а не на каждом скане.
 */
interface LabelIndex {
  byCanonical: Map<string, ILabel>;
  gtins: Set<string>;
  childrenByKey: Map<string, ILabel[]>;
}

const labelIndexCache = new WeakMap<ILabel[], LabelIndex>();
const lineMarkCache = new WeakMap<IBasedLine[], Set<string>>();
const goodIndexCache = new WeakMap<IGood[], Map<string, IGood>>();

const getLabelIndex = (labels: ILabel[]): LabelIndex => {
  const cached = labelIndexCache.get(labels);
  if (cached) {
    return cached;
  }

  const index: LabelIndex = { byCanonical: new Map(), gtins: new Set(), childrenByKey: new Map() };
  for (const label of labels) {
    const canonical = canonicalMarkCodeContent(label.code);
    // семантика Array.find: первый совпавший код выигрывает
    if (!index.byCanonical.has(canonical)) {
      index.byCanonical.set(canonical, label);
    }

    const gtin = parseGtinFromCode(label.code);
    if (gtin) {
      index.gtins.add(gtin);
    }

    if (label.labelKey) {
      const siblings = index.childrenByKey.get(label.labelKey);
      if (siblings) {
        siblings.push(label);
      } else {
        index.childrenByKey.set(label.labelKey, [label]);
      }
    }
  }
  labelIndexCache.set(labels, index);
  return index;
};

const getLineMarkSet = (lines: IBasedLine[]): Set<string> => {
  const cached = lineMarkCache.get(lines);
  if (cached) {
    return cached;
  }

  const marks = new Set<string>();
  for (const line of lines) {
    if (line.mark?.code) {
      marks.add(canonicalMarkCodeContent(line.mark.code));
    }
    if (line.scannedBarcode) {
      marks.add(canonicalMarkCodeContent(line.scannedBarcode));
    }
  }
  lineMarkCache.set(lines, marks);
  return marks;
};

const getGoodIndex = (goods: IGood[]): Map<string, IGood> => {
  const cached = goodIndexCache.get(goods);
  if (cached) {
    return cached;
  }

  const index = new Map<string, IGood>();
  for (const good of goods) {
    const key = String(good.id);
    if (!index.has(key)) {
      index.set(key, good);
    }
  }
  goodIndexCache.set(goods, index);
  return index;
};

export const findLabelByCode = (code: string, labels: ILabel[]): ILabel | undefined =>
  getLabelIndex(labels).byCanonical.get(canonicalMarkCodeContent(code));

const hasLabelWithSameGtin = (code: string, labels: ILabel[]): boolean => {
  const gtin = parseGtinFromCode(code);
  return Boolean(gtin && getLabelIndex(labels).gtins.has(gtin));
};

export const getMarkingNotFoundMessage = (reason: MarkingNotFoundReason): string => {
  switch (reason) {
    case 'good_missing':
      return 'Товар для кода маркировки не найден в справочнике';
    case 'code_mismatch':
      return 'Код маркировки отличается от кода в справочнике';
    case 'label_missing':
      return 'Код маркировки не найден в справочнике';
  }
};

export const labelWeightToKg = (productWeight: number): number => round(productWeight / ONE_KG_IN_G, 3);

/** Parses AI 37 (count) from aggregation codes (level 1/2). */
export const parseAggregationQty = (code: string): number => {
  const normalized = normalizeMarkSeparators(code);
  const match = normalized.match(AGGREGATION_QTY_PATTERN);

  if (!match) {
    return 0;
  }

  const qty = Number(match[2]);
  return Number.isFinite(qty) && qty > 0 ? qty : 0;
};

export const findChildLabels = (parentId: string, labels: ILabel[]): ILabel[] =>
  getLabelIndex(labels).childrenByKey.get(parentId) ?? [];

export const findLevel0ChildLabels = (parentId: string, labels: ILabel[]): ILabel[] =>
  findChildLabels(parentId, labels).filter((label) => label.levelCode === 0);

export const sumLevel0WeightGrams = (parentId: string, labels: ILabel[]): number =>
  findLevel0ChildLabels(parentId, labels).reduce((sum, km) => sum + resolveLabelWeightGrams(km, labels), 0);

/** Resolves document line weight in grams by summing child KM weights via labelKey hierarchy. */
export const resolveLabelWeightGrams = (label: ILabel, labels: ILabel[]): number => {
  if (label.levelCode === 0) {
    const value = Number(label.productWeight ?? 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  if (label.levelCode === 1) {
    return sumLevel0WeightGrams(label.id, labels);
  }

  return findChildLabels(label.id, labels)
    .filter((child) => child.levelCode === 1)
    .reduce((sum, box) => sum + sumLevel0WeightGrams(box.id, labels), 0);
};

/** Maps label hierarchy weight (grams) to document line weight (kg). */
export const resolveLabelWeight = (label: ILabel, labels: ILabel[]): number =>
  labelWeightToKg(resolveLabelWeightGrams(label, labels));

/** Resolves document line quantPack by marking level (L0=0, L1=1, L2=child box count). */
export const resolveLabelQuantPack = (label: ILabel, labels: ILabel[]): number => {
  if (label.levelCode === 0) {
    return 0;
  }

  if (label.levelCode === 1) {
    return 1;
  }

  return findChildLabels(label.id, labels).filter((child) => child.levelCode === 1).length;
};

export const isMarkCodeDuplicate = (markCode: string, lines: IBasedLine[] | undefined): boolean =>
  !!lines && getLineMarkSet(lines).has(canonicalMarkCodeContent(markCode));

const resolveGoodWeight = (good: IGood, weight: number, goodRemains: IRemGood[], remainsUse: boolean): boolean => {
  if (!remainsUse || weight <= 0) {
    return true;
  }

  const rem = goodRemains.find((item) => item.good.id === good.id);
  return Boolean(rem && rem.remains >= weight);
};

export const resolveMarkingScan = ({
  rawCode,
  labels,
  goods,
  goodRemains,
  remainsUse,
}: {
  rawCode: string;
  labels: ILabel[];
  goods: IGood[];
  goodRemains: IRemGood[];
  remainsUse: boolean;
}): MarkingScanResult => {
  if (isLegacyNumericBarcode(rawCode)) {
    return { kind: 'legacy' };
  }

  const markCode = normalizeScannedMarkCode(rawCode);
  const label = findLabelByCode(markCode, labels);

  if (!label) {
    const reason: MarkingNotFoundReason = hasLabelWithSameGtin(markCode, labels) ? 'code_mismatch' : 'label_missing';
    return { kind: 'not_found', markCode, reason };
  }

  const good = getGoodIndex(goods).get(String(label.goodId));

  if (!good) {
    return { kind: 'not_found', markCode, reason: 'good_missing' };
  }

  const weight = resolveLabelWeight(label, labels);
  const isRightWeight = resolveGoodWeight(good, weight, goodRemains, remainsUse);

  return {
    kind: 'found',
    label,
    good,
    weight,
    markCode,
    levelCode: label.levelCode,
    isRightWeight,
  };
};

/** Maps label.workDate to document line workDate (ISO string). */
export const resolveLabelWorkDate = (label: ILabel): string => {
  if (!label.workDate) {
    return '';
  }

  const date = new Date(label.workDate);
  return Number.isNaN(date.getTime()) ? String(label.workDate) : date.toISOString();
};

/** Maps label.numReceived to document line numReceived (string). */
export const resolveLabelNumReceived = (label: ILabel): string => {
  if (label.numReceived == null || label.numReceived === '') {
    return '';
  }

  return String(label.numReceived);
};

export const buildMarkingLineFields = ({
  label,
  labels,
  good,
  sortOrder,
  remainsUse,
}: {
  label: ILabel;
  labels: ILabel[];
  good: IGood;
  sortOrder: number;
  remainsUse: boolean;
}): MarkingLineFields => ({
  good,
  weight: resolveLabelWeight(label, labels),
  mark: { id: label.id, code: label.code },
  barcode: '',
  workDate: resolveLabelWorkDate(label),
  numReceived: resolveLabelNumReceived(label),
  quantPack: resolveLabelQuantPack(label, labels),
  usedRemains: remainsUse,
  sortOrder,
});
