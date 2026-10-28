import { INamedEntity } from '@lib/types';

export type AppTradeState = {
  readonly goodModel: IModelData<IGoodModel>;
  readonly loading: boolean;
  readonly loadingData: boolean;
  readonly errorMessage: string;
  readonly loadingError: string;
  readonly userToken: string | undefined;
};

// Товары
export interface IGood extends INamedEntity {
  [fieldName: string]: unknown;
  alias: string;
  barcode: string;
  vat: string; //НДС
  goodgroup: INamedEntity; // группа товаров
  valueName: string; // Наименование ед. изм.
  invWeight: number; // Вес единицы товара
  priceFso: number; // цена ФСО
  priceFsn: number; // цена ФСН
  priceRed?: number; // цена со скидкой
  priceFsoSklad: number; // цена ФСО склад
  priceFsnSklad: number; // цена ФСН склад
  scale: number; //количество единиц в месте
}

export interface IGoodGroupDecoration {
  name: string;
  color: string;
}

//Группы товаров
export interface IGoodGroup extends INamedEntity {
  parent?: INamedEntity;
  decoration?: IGoodGroupDecoration;
}

//* Model *//
export type IMGood = Omit<IGood, 'goodgroup' | 'id'>;

export interface IGoodModel {
  contactName: string;
  onDate: Date;
  goods: IMParentGroupData<IMGroupData<IMGoodData<IGood>>>;
}

export interface IGoodModelNew {
  [parentGroupId: string]: IMGroupData<number>;
}
export interface IMParentGroupData<T = unknown> {
  [id: string]: T;
}

export interface IMGroupData<T = unknown> {
  [id: string]: T;
}

export interface IMGoodData<T = unknown> {
  [id: string]: T;
}

export interface IModelData<T = unknown> {
  [contactId: string]: T;
}

export interface IMGroup {
  group: IGoodGroup;
  goodCount?: number;
  goods?: IGood[];
}

export interface IMGroupParent {
  parent: IGoodGroup;
  children?: IMGroup[];
}

export interface IMGroupModel {
  [parentId: string]: IMGroupParent;
}

export interface IRemains {
  [id: string]: IRemainsData[];
}

export interface IRemainsData {
  goodId: string;
  q?: number;
  qAgent?: number; // остатки по пользователю
  priceFso?: number;
  priceFsn?: number; // цена ФСН
  priceFsoSklad?: number; // цена ФСО склад
  priceFsnSklad?: number; // цена ФСН склад
}

export interface IRemGood {
  good: IGood;
  priceFso: number;
  priceFsn: number; // цена ФСН
  priceFsoSklad: number; // цена ФСО склад
  priceFsnSklad: number; // цена ФСН склад
  remains: number;
  agentRemains?: number; // остатки по агенту
}

export interface IModelRem {
  priceFso: number;
  priceFsn: number; // цена ФСН
  priceFsoSklad: number; // цена ФСО склад
  priceFsnSklad: number; // цена ФСН склад
  q: number;
  qAgent?: number;
}
