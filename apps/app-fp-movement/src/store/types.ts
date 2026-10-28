import { AnyAction } from 'redux';
import { ThunkAction } from 'redux-thunk';

import { INamedEntity, IEntity, IDocument, MandateProps, IHead, StatusType, IReferenceData } from '@lib/types';
import { IFormParam } from '@lib/store';

import { IAddressStoreEntity, ICodeEntity, IGood } from './app/types';

export { ITempLine, ITempDocument } from './app/types';

export interface IMoveFormParam extends IFormParam {
  number?: string;
  documentDate?: string;
  status?: StatusType;
  fromDepart?: IAddressStoreEntity;
  toDepart?: IAddressStoreEntity;
  comment?: string;
  documentSubtype?: INamedEntity;
}

export interface IReceiptFormParam extends IFormParam {
  number?: string;
  documentDate?: string;
  status?: StatusType;
  fromDepart?: IAddressStoreEntity;
  toDepart?: IAddressStoreEntity;
  comment?: string;
}

export interface IShipmentFormParam extends IFormParam {
  number?: string;
  documentDate?: string;
  status?: StatusType;
  comment?: string;
  fromDepart?: ICodeEntity;
}

export interface IFreeShipmentFormParam extends IFormParam {
  number?: string;
  documentDate?: string;
  status?: StatusType;
  fromDepart?: ICodeEntity;
  comment?: string;
}

export interface IInventoryFormParam extends IFormParam {
  number?: string;
  documentDate?: string;
  status?: StatusType;
  contact?: ICodeEntity;
  outlet?: ICodeEntity;
  fromDepart?: ICodeEntity;
  comment?: string;
}

export interface ILaboratoryFormParam extends IFormParam {
  number?: string;
  documentDate?: string;
  status?: StatusType;
  fromDepart?: ICodeEntity;
  comment?: string;
}

export interface IReturnFormParam extends IFormParam {
  number?: string;
  documentDate?: string;
  status?: StatusType;
  fromDepart?: ICodeEntity;
  comment?: string;
}

//Подразделения-склады
export type Department = INamedEntity;
export type DepartmentType = INamedEntity;

export interface IContact extends INamedEntity, IReferenceData {
  contractNumber: string; // Номер договора
  contractDate: string; // Дата договора
  paycond: string; // Условие оплаты
  phoneNumber: string; // Номер телефона
}

export interface ICellName {
  chamber: string;
  row: string;
  cell: string;
}

export interface ICell extends ICellName {
  tier: string;
}

export interface ICellRef {
  name: string;
  tier: string;
  barcode?: string;
  disabled?: boolean;
  defaultGroup?: INamedEntity;
  sortOrder?: number;
}
export interface IMoveHead extends IHead {
  fromDepart: IAddressStoreEntity;
  toDepart: IAddressStoreEntity; //Подразделение
  subtype: INamedEntity; //Подтип документа
  comment?: string; // Комvентарий
}

export interface IBasedLine extends IEntity {
  good: IGood; // товар
  weight: number; //вес
  workDate: string; // Дата производства
  time?: string; // Время производства
  numReceived: string; // Номер партии
  barcode: string; // технологический код
  quantPack: number; // порядковый номер сканирования в документе
  sortOrder?: number; // порядок сортировки
  scannedBarcode?: string;
  usedRemains?: boolean; // используются остатки в приложении
  flag?: string; // флаг (последний символ), означает тип тары
  mark?: IMark; // маркировка (КМ / КА)
}

export interface IMark {
  id: string; // id записи справочника label
  code: string; // code записи справочника label
}

export interface ISendingLine extends IEntity {
  goodId: string; // ид товара
  weight: number; //вес
  workDate: string; // Дата производства
  numReceived: string; // Номер партии
  barcode: string; // технологический код
  quantPack: number; // порядковый номер сканирования в документе
  scannedBarcode?: string;
  usedRemains?: boolean; // используются остатки в приложении
  fromCell?: string; // номер ячейки
  toCell?: string; // номер ячейки
  storeDate?: string; // дата постановки в ячейку
  mark?: IMark; // маркировка (КМ / КА)
}

export interface IMoveLine extends IBasedLine {
  fromCell?: string; // номер ячейки
  toCell?: string; // номер ячейки
  storeDate?: string;
  storeMan?: string;
  isPack?: boolean;
}

export type IMoveDocument = MandateProps<IDocument<IMoveHead, IMoveLine>, 'head' | 'lines'>;

export interface IReceiptHead extends IHead {
  fromDepart: IAddressStoreEntity;
  toDepart: IAddressStoreEntity; //Подразделение
  comment?: string; // Комvентарий
}

export type IReceiptLine = IBasedLine;

export type IReceiptDocument = MandateProps<IDocument<IReceiptHead, IReceiptLine>, 'head' | 'lines'>;

export interface IOrderHead extends IHead {
  contact: ICodeEntity; //организация-плательщик
  outlet: ICodeEntity; // магазин –подразделение организации плательщика
  depart?: ICodeEntity; // магазин –подразделение организации плательщика
  onDate: string; //  Дата отгрузки
  barcode: string;
}

export interface IOrderLine extends IEntity {
  good: IGood;
  weight: number;
  packagekey?: INamedEntity; // Вид упаковки
}

export type IOrderDocument = MandateProps<IDocument<IOrderHead, IOrderLine>, 'head' | 'lines'>;

export interface IShipmentHead extends IHead {
  contact: ICodeEntity; //организация-плательщик
  outlet: ICodeEntity; // магазин –подразделение организации плательщика
  fromDepart: IAddressStoreEntity; // подразделение сотрудника (кладовщик, работающий с терминалом)
  onDate: string; // Дата отгрузки
  barcode: string; // штрих-код заявки, по которой создан
  // ovСode?: string; // штрих-код документа-отвеса
  orderId: string;
}

export interface IShipmentLine extends IBasedLine {
  box?: IBox;
  quantity?: number;
  unitWeight?: number;
}
export type IShipmentDocument = MandateProps<IDocument<IShipmentHead, IShipmentLine>, 'head' | 'lines'>;

export interface IFreeShipmentHead extends IHead {
  fromDepart: ICodeEntity;
  comment?: string; // Коментарий
}

export interface IBox extends IEntity {
  packageWeight: number; //вес тары
  packageId: string; // из справочника тары
  additionalWeight?: number; //дополнительный вес тары
  workDate?: string;
  numReceived?: string;
}

export interface IFreeShipmentLine extends IBasedLine {
  box?: IBox;
  quantity?: number;
  unitWeight?: number;
}

export type IFreeShipmentDocument = MandateProps<IDocument<IFreeShipmentHead, IFreeShipmentLine>, 'head' | 'lines'>;

export interface IInventoryHead extends IHead {
  fromDepart: IAddressStoreEntity;
  comment?: string; // Комvентарий
}

export interface IInventoryLine extends IBasedLine {
  // fromCell?: string; // номер ячейки
  toCell?: string; // номер ячейки
}

export type IInventoryDocument = MandateProps<IDocument<IInventoryHead, IInventoryLine>, 'head' | 'lines'>;

export interface ILaboratoryHead extends IHead {
  fromDepart: ICodeEntity;
  comment?: string; // Коментарий
}
export type ILaboratoryLine = IBasedLine;

export type ILaboratoryDocument = MandateProps<IDocument<ILaboratoryHead, ILaboratoryLine>, 'head' | 'lines'>;

export interface IReturnHead extends IHead {
  fromDepart: ICodeEntity;
  comment?: string; // Коментарий
}
export type IReturnLine = IBasedLine;
export type IReturnDocument = MandateProps<IDocument<IReturnHead, IReturnLine>, 'head' | 'lines'>;

export interface IPalletHead extends IHead {
  quantPack: number;
  barcode: string;
  scannedBarcode: string;
  good: IGood; // товар
  weight: number; //вес
  workDate: string; // Дата производства
  time?: string; // Время производства
  numReceived: string; // Номер партии
  storeMan?: string;
  boxQuantity?: number; // количество коробок как правильно
  toCell?: string; // номер ячейки
  storeDate?: string;
}

export interface IPalletLine extends IEntity {
  quantPack: number;
  barcode: string;
  scannedBarcode: string;
  good: IGood; // товар
  weight: number; //вес
  workDate: string; // Дата производства
  time?: string; // Время производства
  numReceived: string; // Номер партии
  // storeMan?: string;
}

export type IPalletDocument = MandateProps<IDocument<IPalletHead, IPalletLine>, 'head' | 'lines'>;

export type barcodeSettings = {
  [name: string]: number;
};

export interface IOutlet extends INamedEntity, IReferenceData {
  company: INamedEntity; //организация-плательщик
  address: string; //Адрес разгрузки
  phoneNumber: string; // Номер телефона
  lat: number; // широта
  lon: number; // долгота
}

export type TakeOrderType = 'ON_PLACE' | 'BY_PHONE' | 'BY_EMAIL';

export type AppThunk<ReturnType = void, S = void, A extends AnyAction = AnyAction> = ThunkAction<
  ReturnType,
  S,
  unknown,
  A
>;
