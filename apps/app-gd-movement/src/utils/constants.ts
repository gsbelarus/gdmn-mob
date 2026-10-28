import { IListItem } from '@lib/mobile-types';
import { mainSettingGroup } from '@lib/store';
import { Settings, StatusType } from '@lib/types';
import { BarCodeScanner } from 'expo-barcode-scanner';

import { IGood } from '../store/app/types';

const statusColors = ['#E91E63', '#06567D', '#80B12C', '#FFA700'] as const;

export const cellColors = {
  default: '#5aa176',
  barcode: '#226182',
  free: '#d5dce3',
  textWhite: 'white',
};

export const ONE_SECOND_IN_MS = 1000;

export const contactTypes: IListItem[] = [
  { id: 'department', value: 'Подразделение' },
  { id: 'contact', value: 'Организация' },
  { id: 'employee', value: 'Сотрудник' },
];

export interface IBarcodeTypes extends IListItem {
  selected?: boolean;
  type: string;
}

export const barcodeList: IBarcodeTypes[] = [
  { id: 'ean8', value: 'EAN-8', type: BarCodeScanner.Constants.BarCodeType.ean8, selected: true },
  { id: 'ean13', value: 'EAN-13', type: BarCodeScanner.Constants.BarCodeType.ean13, selected: true },
  { id: 'code128', value: 'Code 128', type: BarCodeScanner.Constants.BarCodeType.code128, selected: true },
  { id: 'datamatrix', value: 'Data Matrix', type: BarCodeScanner.Constants.BarCodeType.datamatrix },
  { id: 'qr', value: 'QR code', type: BarCodeScanner.Constants.BarCodeType.qr },
];

export const docContactTypes: IListItem[] = [{ id: 'all', value: 'Все' }];

export const statusTypes: IListItem[] = [
  {
    id: 'all',
    value: 'Все',
  },
  {
    id: 'active',
    value: 'Активные',
  },
  {
    id: 'DRAFT',
    value: 'Черновик',
  },
  {
    id: 'READY',
    value: 'Готово',
  },
  {
    id: 'SENT',
    value: 'Отправлено',
  },
  {
    id: 'PROCESSED',
    value: 'Обработано',
  },
];

export const dataTypes: IListItem[] = [
  {
    id: 'new',
    value: 'Сначала новые',
  },
  {
    id: 'old',
    value: 'Сначала старые',
  },
];

export const STATUS_LIST: IListItem[] = [
  { id: 'DRAFT', value: 'Черновик' },
  { id: 'READY', value: 'Готов' },
];

export const getStatusColor = (status: StatusType) => {
  let statusColor: (typeof statusColors)[number];

  switch (status) {
    case 'DRAFT':
      statusColor = statusColors[0];
      break;

    case 'PROCESSED':
      statusColor = statusColors[1];
      break;

    case 'READY':
      statusColor = statusColors[2];
      break;

    case 'SENT':
      statusColor = statusColors[3];
      break;

    default:
      statusColor = statusColors[0];
      break;
  }

  return statusColor;
};

const goodGroup = { id: 'goodScan', name: 'Весовой товар', sortOrder: 1 };
const scanSettings = { id: 'scanSettings', name: 'Настройки сканера', sortOrder: 3 };

export const appSettings: Settings = {
  scannerUse: {
    id: 'scannerUse',
    sortOrder: 30,
    description: 'Использовать сканер',
    data: true,
    type: 'boolean',
    visible: true,
    group: scanSettings,
  },
  lineConfirm: {
    id: 'lineConfirm',
    sortOrder: 38,
    description: 'Подтверждать позицию',
    data: true,
    type: 'boolean',
    visible: true,
    group: mainSettingGroup,
  },
  barcodeTypes: {
    id: 'barcodeTypes',
    sortOrder: 31,
    description: 'Типы штрихкодов',
    data: barcodeList,
    type: 'number',
    visible: true,
    group: scanSettings,
  },
  weightCode: {
    id: 'weightCode',
    sortOrder: 32,
    description: 'ID весового товара',
    data: '22',
    type: 'string',
    visible: true,
    group: scanSettings,
    groupInGroup: goodGroup,
  },
  countCode: {
    id: 'countCode',
    sortOrder: 33,
    description: 'Кол-во символов кода товара',
    data: 5,
    type: 'number',
    visible: true,
    group: scanSettings,
    groupInGroup: goodGroup,
  },
  countWeight: {
    id: 'countWeight',
    sortOrder: 34,
    description: 'Кол-во символов веса (в гр.)',
    data: 5,
    type: 'number',
    visible: true,
    group: scanSettings,
    groupInGroup: goodGroup,
  },
  prefixGtin: {
    id: 'prefixGtin',
    sortOrder: 36,
    description: 'Префикс ГТИН',
    data: '01',
    type: 'string',
    visible: true,
    group: scanSettings,
  },
  prefixISN: {
    id: 'prefixISN',
    sortOrder: 36,
    description: 'Префикс ИСН',
    data: '21',
    type: 'string',
    visible: true,
    group: scanSettings,
  },
  screenKeyboard: {
    id: 'screenKeyboard',
    sortOrder: 8,
    description: 'Экранная клавиатура',
    data: true,
    type: 'boolean',
    visible: true,
    group: mainSettingGroup,
  },
  quantityInput: {
    id: 'quantityInput',
    sortOrder: 9,
    description: 'Заполнять количество',
    data: false,
    type: 'boolean',
    visible: true,
    group: mainSettingGroup,
  },
  showZeroRemains: {
    id: 'showZeroRemains',
    sortOrder: 10,
    description: 'Нулевые остатки в склад. документах',
    data: true,
    type: 'boolean',
    visible: true,
    group: mainSettingGroup,
  },
  showRemainsQuantity: {
    id: 'showRemainsQuantity',
    sortOrder: 11,
    description: 'Показывать остатки в документах',
    data: true,
    type: 'boolean',
    visible: true,
    group: mainSettingGroup,
    checkSettingsCode: true,
  },
  editInventoryPrice: {
    id: 'editInventoryPrice',
    sortOrder: 12,
    description: 'Редактировать цены в инвентаризации',
    data: false,
    type: 'boolean',
    visible: true,
    group: mainSettingGroup,
  },
};

export const unknownGood: IGood = {
  id: 'unknown',
  alias: 'unknown',
  name: 'Неизвестный товар',
  goodGroup: { id: 'unknown', name: 'Неизвестная группа' },
};

export const lineTypes: IListItem[] = [
  {
    id: 'all',
    value: 'все',
  },
  {
    id: 'last',
    value: 'позиция',
  },
];
