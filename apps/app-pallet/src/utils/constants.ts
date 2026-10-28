import { IListItem } from '@lib/mobile-types';
import { Settings, StatusType } from '@lib/types';
import { BarCodeScanner } from 'expo-barcode-scanner';

const statusColors = ['#E91E63', '#06567D', '#80B12C', '#FFA700'] as const;

export const ONE_SECOND_IN_MS = 1000;

export const SCAN_REFOCUS_DELAY_MS = 1000;

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

  barcodeTypes: {
    id: 'barcodeTypes',
    sortOrder: 31,
    description: 'Типы штрихкодов',
    data: barcodeList,
    type: 'number',
    visible: true,
    group: scanSettings,
  },
  prefixErp: {
    id: 'prefixErp',
    sortOrder: 33,
    description: 'Префикс ERP',
    data: '91',
    type: 'string',
    visible: true,
    group: scanSettings,
  },
  prefixS: {
    id: 'prefixS',
    sortOrder: 34,
    description: 'Префикс Summa',
    data: '92',
    type: 'string',
    visible: true,
    group: scanSettings,
  },
};
