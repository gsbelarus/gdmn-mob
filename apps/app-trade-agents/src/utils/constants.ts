import { IListItem } from '@lib/mobile-types';
import { mainSettingGroup } from '@lib/store';
import { INamedEntity, Settings, StatusType } from '@lib/types';

export const ONE_SECOND_IN_MS = 1000;

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

export const STATUS_LIST: IListItem[] = [
  { id: 'DRAFT', value: 'Черновик' },
  { id: 'READY', value: 'Готов' },
];

export const UNKNOWN_GROUP = { id: 'unknown', name: 'Другое' };

export const appSettings: Settings = {
  isUseNetPrice: {
    id: 'isUseNetPrice',
    description: 'Использовать матрицы',
    data: true,
    type: 'boolean',
    sortOrder: 3,
    visible: true,
    group: mainSettingGroup,
  },
  isUseRemains: {
    id: 'isUseRemains',
    description: 'Использовать остатки',
    data: false,
    type: 'boolean',
    sortOrder: 4,
    visible: true,
    group: mainSettingGroup,
  },
  isUseUnitMeasure: {
    id: 'isUseUnitMeasure',
    description: 'Учитывать ед. изм.',
    data: true,
    type: 'boolean',
    sortOrder: 5,
    visible: true,
    group: mainSettingGroup,
  },
};

export const viewTypeList: IListItem[] = [
  { id: 'groups', value: 'Товарные группы' },
  { id: 'goods', value: 'Справочник ТМЦ' },
];

export const debetTypes: IListItem[] = [
  { id: 'all', value: 'Все' },
  { id: 'credit', value: 'С задолженностью' },
  { id: 'minus', value: 'С просрочкой' },
  { id: 'debet', value: 'С предоплатой' },
];

export const lineTypes: IListItem[] = [
  {
    id: 'new',
    value: 'текущие',
  },
  {
    id: 'old',
    value: 'предыдущие',
  },
];

export const ROUTE_ITEM_HEIGHT = 80;

export const statusTypes: IListItem[] = [
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

export const noPackage: INamedEntity = { id: 'noPackage', name: 'Без упаковки' };

export const reports: IListItem[] = [
  { id: 'byContact', value: 'В разрезе даты отгрузки и ТО' },
  { id: 'byGroup', value: 'В разрезе групп' },
  { id: 'byGood', value: 'В разрезе товаров' },
  // { id: 'sellBill', value: 'Накладные' },
];

export const shipments: IListItem[] = [
  { id: 'shipment', value: 'Накладные' },
  { id: 'noShipment', value: 'Недогрузы' },
  { id: 'group', value: 'Накладные по группам' },
  { id: 'groupInvoices', value: 'Недогрузы по группам' },
  { id: 'groupDay', value: 'Суммарно за день' },
  { id: 'groupDayNoShipment', value: 'Недогрузы за день' },
];
