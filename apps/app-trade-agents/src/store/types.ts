import { AnyAction } from 'redux';
import { ThunkAction } from 'redux-thunk';

import {
  StatusType,
  IEntity,
  IDocument,
  MandateProps,
  IHead,
  IReferenceData,
  IDocumentType,
  INamedEntity,
} from '@lib/types';

import { IFormParam } from '@lib/store';

import { IListItem } from '@lib/mobile-types';

import { ICoords } from './geo/types';
import { IGood } from './app/types';

export * from './app/types';

export interface IOrderFormParam extends IFormParam {
  contact?: IReferenceData;
  outlet?: IReferenceData;
  depart?: IReferenceData;
  number?: string;
  documentDate?: string;
  onDate?: string;
  status?: StatusType;
  route?: IReferenceData;
  road?: IReferenceData;
  expeditor?: IReferenceData;
  comment?: string;
}

export interface IOrderListFormParam extends IFormParam {
  filterContact?: IReferenceData;
  filterOutlet?: IReferenceData;
  filterDateBegin?: string;
  filterDateEnd?: string;
  filterGood?: IReferenceData;
  filterStatusList: IListItem[];
}

export interface IReportListFormParam extends IFormParam {
  report: IListItem;
  filterReportContact?: IReferenceData;
  filterReportOutlet?: IReferenceData;
  filterReportDB?: string;
  filterReportDE?: string;
  filterReportOnDB?: string;
  filterReportOnDE?: string;
  filterReportGroup?: IReferenceData[];
  filterReportGood?: IReferenceData[];
  filterReportStatusList: IListItem[];
}

export interface IShipmentListFormParam extends IFormParam {
  shipment: IListItem;
  filterShipmentContact?: IReferenceData;
  filterShipmentOutlet?: IReferenceData;
  filterShipmentGood?: IReferenceData[];
}

export interface IReportItem {
  address: string;
  onDate: string;
  totalList?: IReportTotalLine[];
  outlet: INamedEntity;
}

export interface IReportItemByGroup {
  group: INamedEntity;
  quantity: number;
}

export interface IReportItemByGood {
  good: INamedEntity;
  quantity: number;
}

export interface IReportItemByGoods {
  type: 'parent' | 'group' | 'good';
  name: string;
  n?: string;
  quantity?: number;
}

export interface IReportTotalLine {
  package: INamedEntity;
  quantity: number;
}

export interface IRouteFormParam extends IFormParam {
  routeItemId?: number;
}

export interface IGroupFormParam extends IFormParam {
  parentGroupId?: string;
  groupId?: string;
}

export interface ISellBillFormParam extends IFormParam {
  dateBegin?: string;
  dateEnd?: string;
  good?: INamedEntity;
}

//Организации
export interface IContact extends INamedEntity, IReferenceData {
  contractNumber: string; // Номер договора
  contractDate: string; // Дата договора
  paycond: string; // Условие оплаты
  phoneNumber: string; // Номер телефона
  limitSum?: string; // Лимит задолженности
}
//Магазины
export interface IOutlet extends INamedEntity, IReferenceData {
  company: INamedEntity; //организация-плательщик
  address: string; //Адрес разгрузки
  phoneNumber: string; // Номер телефона
  lat: number; // широта
  lon: number; // долгота
}
//Задолженности
export interface IDebt extends INamedEntity {
  ondate: string; //на дату
  saldo: number; //Задолженность
  saldoDebt: number; //Просроченная задолженность
  dayLeft?: number;
}

//Подразделения-склады
export type IDepartment = INamedEntity;

export interface IGoodMatrix {
  [id: string]: IMatrixData[];
}

export interface IMatrixData {
  goodId: string;
  priceFso: number; // цена ФСО
  priceFsn: number; // цена ФСН
  priceFsoSklad: number; // цена ФСО склад
  priceFsnSklad: number; // цена ФСН склад
}

export interface IMatrixDataNamed extends IMatrixData {
  [fieldName: string]: number | string | undefined;
  goodName: string;
}

export interface IGoodSales {
  [id: string]: ISalesData[];
}

export interface ISalesData {
  goodId: string;
  priceRed: number; // цена ФСО
}

export interface ISalesDataNamed extends IMatrixData {
  [fieldName: string]: number | string | undefined;
  goodName: string;
}

export type IPackage = INamedEntity;

export interface IPackageGood extends IEntity {
  good: INamedEntity;
  package: INamedEntity;
  isDefault?: number;
}

export interface IOrderHead extends IHead {
  contact: IReferenceData; //организация-плательщик
  outlet: IReferenceData; // магазин –подразделение организации плательщика
  route?: IReferenceData; // 	Маршрут
  road?: IReferenceData; // 	Маршрут
  depart?: IReferenceData; // Необязательное поле склад (подразделение предприятия-производителя)
  onDate: string; //  Дата отгрузки
  takenOrder?: TakeOrderType; //тип взятия заявки
  comment?: string;
  expeditor?: IReferenceData; // экспедитор
}

export interface IOrderLine extends IEntity {
  good: IGood;
  quantity: number;
  package?: INamedEntity; // Вид упаковки
  remains?: number;
  agentRemains?: number;
}

export interface IOrderTotalLine {
  group: INamedEntity;
  weight: number;
  pieces: number;
  sum: number;
  sumVat: number;
}

export type IOrderDocument = MandateProps<IDocument<IOrderHead, IOrderLine>, 'head' | 'lines'>;

interface IRouteHead extends IHead {
  agent: INamedEntity;
}

export interface IRouteLine extends IEntity {
  outlet: INamedEntity;
  ordNumber: number; // порядковый номер
  comment?: string;
  visited: boolean;
}

export interface IRouteLineItem extends IEntity {
  outletName: string;
  ordNumber: number;
  address: string;
  dateEnd: string;
  status: number;
}

export interface IRouteTotalLine {
  group: INamedEntity;
  quantity: number;
}

export type IRouteDocument = MandateProps<IDocument<IRouteHead, IRouteLine>, 'head' | 'lines'>;

export interface ISellBill extends IEntity {
  number: string;
  contract?: INamedEntity;
  depart?: INamedEntity;
  documentdate: string;
  quantity: number;
  price: number;
}

export interface ISellBillHead extends IHead {
  outlet?: INamedEntity;
  contact?: INamedEntity;
  route?: INamedEntity;
  depart?: INamedEntity;
  dateBegin?: string;
  dateEnd?: string;
}

export interface ISellBillLine extends IEntity {
  good?: INamedEntity;
  quantity: number;
}

export type ISellBillDocument = MandateProps<IDocument<ISellBillHead, ISellBillLine>, 'head' | 'lines'>;

export type TakeOrderType = 'ON_PLACE' | 'BY_PHONE' | 'BY_EMAIL';

export type VisitResultType = 'ALL_COMPLETED' | 'NOT_COMPLETED' | 'PARTLY_COMPLETED';

interface IVisitHead extends IHead {
  routeLineId: string;
  comment?: string;
  dateBegin: string; //начало визита
  dateEnd?: string; // конец визита
  beginGeoPoint?: ICoords; //место начало визита
  endGeoPoint?: ICoords; // место завершения визита
  result?: VisitResultType;
  takenType: TakeOrderType; //тип визита - это поле забрать из заявки
}

export type IVisitDocument = MandateProps<IDocument<IVisitHead>, 'head'>;

export interface IShipmentHead {
  id: string;
  orderId: string;
  number: string;
  contactId: string;
  outletId: string;
  documentDate: string;
  shipmentNumber?: string;
}

export interface IShipmentLine {
  goodId: string;
  packageId?: string;
  orderQ: number;
  sellQ: number;
  diff: number;
}

export interface IShipmentLinesRef {
  [id: string]: IShipmentLine[];
}

export interface IOrderData {
  [id: string]: IShipmentLine[];
}

export interface IContactData {
  [id: string]: IOutletData;
}

export interface IOutletData {
  [id: string]: IOrderData;
}

export interface IShipmentListItem {
  [fieldname: string]: any;
  id: string;
  lineId?: string;
  name: string;
  type: 'contact' | 'outlet' | 'order' | 'good' | 'total' | 'parentGroup';
}

export const visitDocumentType: IDocumentType = {
  id: 'visit',
  name: 'visit',
  description: 'Визит',
};

export interface IToken {
  access_token: string;
}

export type AppThunk<ReturnType = void, S = void, A extends AnyAction = AnyAction> = ThunkAction<
  ReturnType,
  S,
  unknown,
  A
>;
