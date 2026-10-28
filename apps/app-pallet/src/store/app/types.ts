import { INamedEntity } from '@lib/types';

export type AppPalletState = {
  readonly loading: boolean;
  readonly loadingData: boolean;
  readonly errorMessage: string;
  readonly loadingError: string;
};

// Товары
export interface IGood extends INamedEntity {
  alias: string;
  barcode?: string;
  vat?: string; //НДС
  weightCode?: string;
  goodGroup: INamedEntity; // группа товаров
  valueName?: string; // Наименование ед. изм.
  invWeight?: number; // Вес единицы товара
  price?: number; //Цена
  buyingPrice?: number;
  scale?: number; //количество единиц в месте
}

export interface IEmployee extends INamedEntity {
  firstName?: string;
  lastName?: string;
  middleName?: string;
  position: INamedEntity;
}

export interface IBarcodeSum {
  evenSum: number; //чётные
  oddSum: number; //нечётные
}

export interface ILabel {
  id: string;
  code: string;
  goodId?: string;
  levelCode?: 0 | 1 | 2;
}
