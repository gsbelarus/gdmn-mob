import { IReferenceData } from '@lib/types';

import { IInventoryLine, IMoveLine } from '../../store/types';

export type IRefSelectParams = {
  screenName: string;
  refName: string;
  fieldName: string;
  value?: IReferenceData[];
  clause?: Record<string, string>;
  clauseType?: string;
  isMulti?: boolean;
  docType?: string;
  refFieldName?: string;
  descrFieldName?: string;
  additionalField?: string;
};

export type RefParamList = {
  SelectRefItem: IRefSelectParams;
};

export type MoveParamList = RefParamList & {
  MoveView: { id: string; docType?: string };
  MoveEdit: { id: string; docType?: string } | undefined;
  ScanGood: { docId: string };
  SelectCell: { docId: string; item: IMoveLine; mode: number; docType?: string };
  InventoryView: { id: string; docType?: string };
  PalletList: undefined;
};

export type MoveStackParamList = { MoveList: undefined } & MoveParamList;

export type MoveFromParamList = RefParamList & {
  MoveFromView: { id: string; docType?: string };
  MoveFromEdit: { id: string; docType?: string } | undefined;
  ScanGood: { docId: string };
  SelectCell: { docId: string; item: IMoveLine; mode: number; docType?: string };
  InventoryView: { id: string; docType?: string };
};

export type MoveFromStackParamList = { MoveFromList: undefined } & MoveFromParamList;

export type MoveToParamList = RefParamList & {
  MoveToView: { id: string; docType?: string };
  MoveToEdit: { id: string; docType?: string } | undefined;
  ScanGood: { docId: string };
  SelectCell: { docId: string; item: IMoveLine; mode: number; docType?: string };
  InventoryView: { id: string; docType?: string };
};

export type MoveToStackParamList = { MoveToList: undefined } & MoveToParamList;

export type ReceiptParamList = RefParamList & {
  ReceiptView: { id: string; docType?: string };
  ReceiptEdit: { id: string; docType?: string } | undefined;
  ScanGood: { docId: string };
};

export type ReceiptStackParamList = { ReceiptList: undefined } & ReceiptParamList;

export type ShipmentParamList = RefParamList & {
  ShipmentEdit: { id: string; isCurr: boolean };
  ShipmentView: { id: string; isCurr: boolean };
  ScanOrder: { isCurr: boolean };
  ScanGood: { docId: string; isCurr: boolean };
  SelectCell: { docId: string; item: IMoveLine; mode?: number; docType?: string };
};

export type ShipmentStackParamList = { ShipmentList: undefined } & ShipmentParamList;

export type CurrShipmentParamList = RefParamList & {
  ShipmentEdit: { id: string; isCurr: boolean };
  ShipmentView: { id: string; isCurr: boolean };
  ScanOrder: { isCurr: boolean };
  ScanGood: { docId: string; isCurr: boolean };
};

export type CurrShipmentStackParamList = { CurrShipmentList: undefined } & CurrShipmentParamList;

export type FreeShipmentParamList = RefParamList & {
  FreeShipmentView: { id: string; isCurr: boolean };
  FreeShipmentEdit: { id?: string; isCurr: boolean };
  ScanGood: { docId: string; docType?: string };
};

export type FreeShipmentStackParamList = { FreeShipmentList: undefined } & FreeShipmentParamList;

export type CurrFreeShipmentParamList = RefParamList & {
  FreeShipmentView: { id: string; isCurr: boolean };
  FreeShipmentEdit: { id?: string; isCurr: boolean };
  ScanGood: { docId: string; docType?: string };
};

export type CurrFreeShipmentStackParamList = { CurrFreeShipmentList: undefined } & CurrFreeShipmentParamList;

export type ReturnParamList = RefParamList & {
  ReturnView: { id: string; docType?: string };
  ReturnEdit: { id: string; docType?: string } | undefined;
  ScanGood: { docId: string; docType?: string };
};

export type ReturnStackParamList = { ReturnList: undefined } & ReturnParamList;

export type LaboratoryParamList = RefParamList & {
  LaboratoryView: { id: string; docType?: string };
  LaboratoryEdit: { id: string; docType?: string } | undefined;
  ScanGood: { docId: string; docType?: string };
};

export type LaboratoryStackParamList = { LaboratoryList: undefined } & LaboratoryParamList;

export type InventoryParamList = RefParamList & {
  InventoryView: { id: string; docType?: string };
  InventoryEdit: { id: string; docType?: string } | undefined;
  ScanGood: { docId: string; docType?: string };
  InventorySelectCell: { docId: string; item: IInventoryLine; mode?: number; docType?: string };
};

export type InventoryStackParamList = { InventoryList: undefined } & InventoryParamList;

export type CellsParamList = RefParamList & {
  CellsView: { contactId: string };
  GoodLine: { item: any };
};

export type CellsStackParamList = { ContactList: undefined } & CellsParamList;

export type RemainsParamList = RefParamList & {
  GoodList: { id: string };
  GoodLine: { item: any };
};

export type RemainsStackParamList = { ContactList: undefined } & RemainsParamList;

export type PalletStackParamList = RefParamList & {
  PalletList: undefined;
  SelectCell: { docId: string; item: IMoveLine; mode: number; docType?: string };
};

export type OrderParamList = RefParamList & {
  OrderView: { id: string; docType?: string };
  OrderEdit: { id: string; docType?: string } | undefined;
  ScanGood: { docId: string; docType?: string };
};

export type OrderStackParamList = { OrderList: undefined } & OrderParamList;
