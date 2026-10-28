import { IListItem } from '@lib/mobile-types';
import { mainSettingGroup } from '@lib/store';
import { Settings, StatusType } from '@lib/types';
import { BarCodeScanner } from 'expo-barcode-scanner';

// import { BarcodeType } from 'expo-camera';

import { IGood } from '../store/app/types';

const statusColors = ['#E91E63', '#06567D', '#80B12C', '#FFA700'] as const;

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

export const ONE_SECOND_IN_MS = 1000;

export const SCAN_REFOCUS_DELAY_MS = 1000;

export const ONE_KG_IN_G = 1000;

export const ONE_T_IN_KG = 1000;

export const contactTypes: IListItem[] = [
  { id: 'department', value: 'Подразделение' },
  { id: 'contact', value: 'Организация' },
  { id: 'employee', value: 'Сотрудник' },
];

export const docDepartTypes: IListItem[] = [{ id: 'all', value: 'Все' }];

export const statusTypes: IListItem[] = [
  {
    id: 'all',
    value: 'Все',
    statuses: ['DRAFT', 'READY', 'SENT', 'PROCESSED'],
  },
  {
    id: 'active',
    value: 'Активные',
    statuses: ['DRAFT', 'READY', 'SENT'],
  },
  {
    id: 'DRAFT',
    value: 'Черновик',
    statuses: ['DRAFT'],
  },
  {
    id: 'READY',
    value: 'Готово',
    statuses: ['READY'],
  },
  {
    id: 'SENT',
    value: 'Отправлено',
    statuses: ['SENT'],
  },
  {
    id: 'PROCESSED',
    value: 'Обработано',
    statuses: ['PROCESSED'],
  },
  {
    id: 'DRAFT_READY',
    value: 'Черновик и Готов',
    statuses: ['DRAFT', 'READY'],
  },
];

export const dateTypes: IListItem[] = [
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

const goodGroup = {
  id: 'goodScan',
  name: 'Код товара',
  sortOrder: 21,
  description: 'Количество символов',
  checkSettingsCode: true,
};
const orderGroup = {
  id: 'orderScan',
  name: 'Код заявки',
  sortOrder: 22,
  description: 'Количество символов',
  checkSettingsCode: true,
};

export const appSettings: Settings = {
  scannerUse: {
    id: 'scannerUse',
    sortOrder: 3,
    description: 'Использовать сканер',
    data: true,
    type: 'boolean',
    visible: true,
    group: mainSettingGroup,
  },
  addressStore: {
    id: 'addressStore',
    sortOrder: 4,
    description: 'Адресное хранение',
    data: false,
    type: 'boolean',
    visible: true,
    group: mainSettingGroup,
  },
  remainsUse: {
    id: 'remainsUse',
    sortOrder: 5,
    description: 'Использовать остатки',
    data: true,
    type: 'boolean',
    visible: true,
    group: mainSettingGroup,
    checkSettingsCode: true,
  },
  getRemains: {
    id: 'getRemains',
    sortOrder: 2,
    description: 'Запрашивать остатки',
    data: true,
    type: 'boolean',
    visible: true,
    group: mainSettingGroup,
    checkSettingsCode: true,
  },
  scanUnit: {
    id: 'scanUnit',
    sortOrder: 36,
    description: 'Сканирование в шт.',
    data: false,
    type: 'boolean',
    visible: true,
    group: mainSettingGroup,
    checkSettingsCode: true,
  },
  showOrders: {
    id: 'showOrders',
    sortOrder: 37,
    description: 'Показывать заявки',
    data: false,
    type: 'boolean',
    visible: true,
    group: mainSettingGroup,
    checkSettingsCode: true,
  },
  allowLineDelete: {
    id: 'allowLineDelete',
    sortOrder: 38,
    description: 'Разрешить удаление позиций',
    data: false,
    type: 'boolean',
    visible: true,
    group: mainSettingGroup,
    checkSettingsCode: true,
  },
  minBarcodeLength: {
    id: 'minBarcodeLength',
    sortOrder: 6,
    description: 'Мин. длина штрих-кода',
    data: 28,
    type: 'number',
    visible: true,
    group: goodGroup,
  },
  maxBarcodeLength: {
    id: 'maxBarcodeLength',
    sortOrder: 6,
    description: 'Макс. длина штрих-кода',
    data: 40,
    type: 'number',
    visible: true,
    group: goodGroup,
  },
  countWeight: {
    id: 'countWeight',
    sortOrder: 7,
    description: 'Вес товара, гр',
    data: 6,
    type: 'number',
    visible: true,
    group: goodGroup,
  },
  countDay: {
    id: 'countDay',
    sortOrder: 8,
    description: 'Дата (число)',
    data: 2,
    type: 'number',
    visible: true,
    group: goodGroup,
  },
  countMonth: {
    id: 'countMonth',
    sortOrder: 9,
    description: 'Дата (месяц)',
    data: 2,
    type: 'number',
    visible: true,
    group: goodGroup,
  },
  countYear: {
    id: 'countYear',
    sortOrder: 10,
    description: 'Дата (год)',
    data: 2,
    type: 'number',
    visible: true,
    group: goodGroup,
  },
  countCode: {
    id: 'countCode',
    sortOrder: 11,
    description: 'Код товара',
    data: 4,
    type: 'number',
    visible: true,
    group: goodGroup,
  },
  countQuantPack: {
    id: 'countQuantPack',
    sortOrder: 12,
    description: 'Номер взвешивания',
    data: 4,
    type: 'number',
    visible: true,
    group: goodGroup,
  },
  countNumReceived: {
    id: 'countNumReceived',
    sortOrder: 14,
    description: 'Номер партии',
    data: 6,
    type: 'number',
    visible: true,
    group: goodGroup,
  },
  boxNumber: {
    id: 'boxNumber',
    sortOrder: 15,
    description: 'Количество коробок',
    data: 0,
    type: 'number',
    visible: true,
    group: goodGroup,
  },
  boxWeight: {
    id: 'boxWeight',
    sortOrder: 16,
    description: 'Мин. вес поддона, кг',
    data: 30,
    type: 'number',
    visible: true,
    group: goodGroup,
  },
  addPalletQuantPack: {
    id: 'addPalletQuantPack',
    sortOrder: 17,
    description: 'Указывать кол-во коробок',
    data: false,
    type: 'boolean',
    visible: true,
    group: goodGroup,
  },
  flag: {
    id: 'flag',
    sortOrder: 18,
    description: 'Последний символ',
    data: 0,
    type: 'number',
    visible: true,
    group: goodGroup,
  },
  countOrderBarcodeLentgh: {
    id: 'countOrderBarcodeLentgh',
    sortOrder: 15,
    description: 'Мин. длина штрих-кода',
    data: 15,
    type: 'number',
    visible: true,
    group: orderGroup,
  },
  countCodeDepart: {
    id: 'countCodeDepart',
    sortOrder: 16,
    description: 'Код подразделения',
    data: 3,
    type: 'number',
    visible: true,
    group: orderGroup,
  },
  countOrderDay: {
    id: 'countOrderDay',
    sortOrder: 17,
    description: 'Дата (число)',
    data: 2,
    type: 'number',
    visible: true,
    group: orderGroup,
  },
  countOrderMonth: {
    id: 'countOrderMonth',
    sortOrder: 18,
    description: 'Дата (месяц)',
    data: 2,
    type: 'number',
    visible: true,
    group: orderGroup,
  },
  countOrderYear: {
    id: 'countOrderYear',
    sortOrder: 19,
    description: 'Дата (год)',
    data: 4,
    type: 'number',
    visible: true,
    group: orderGroup,
  },
  countID: {
    id: 'countID',
    sortOrder: 20,
    description: 'Идентификатор заявки',
    data: 11,
    type: 'number',
    visible: true,
    group: orderGroup,
  },
  limitDelta: {
    id: 'limitDelta',
    sortOrder: 21,
    description: 'Превышение количества, %',
    data: 0,
    type: 'number',
    visible: true,
    group: orderGroup,
  },
  usePackage: {
    id: 'usePackage',
    sortOrder: 22,
    description: 'Использовать тару',
    data: false,
    type: 'boolean',
    visible: true,
    group: goodGroup,
  },
};

export const unknownGood: IGood = {
  id: 'unknown',
  name: 'Неизвестный товар',
  shcode: '',
};

export const tempType = {
  id: '187891695',
  name: 'temp',
  description: 'Отвес',
};

export const shipmentLineTypes: IListItem[] = [
  {
    id: 'order',
    value: 'заявлено',
  },
  {
    id: 'shipment',
    value: 'отвешено',
  },
  {
    id: 'last',
    value: 'позиция',
  },
];

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

export const barCodeTypes = [
  BarCodeScanner.Constants.BarCodeType.qr,
  BarCodeScanner.Constants.BarCodeType.code128,
  BarCodeScanner.Constants.BarCodeType.ean13,
  BarCodeScanner.Constants.BarCodeType.ean8,
];

// export const barCodeTypes: BarcodeType[] = ['qr', 'code128', 'ean13', 'ean8'];

export const cellColors = {
  default: '#5aa176',
  barcode: '#226182',
  free: '#d5dce3',
  textWhite: 'white',
};
