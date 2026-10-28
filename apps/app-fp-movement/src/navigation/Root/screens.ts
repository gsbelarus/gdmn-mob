import { MoveListScreen, MoveEditScreen, MoveViewScreen, SelectCellScreen } from '../../screens/Movements';
import { MoveFromListScreen, MoveFromEditScreen, MoveFromViewScreen } from '../../screens/MovementFrom';
import { MoveToListScreen, MoveToEditScreen, MoveToViewScreen } from '../../screens/MovementTo';

import {
  ShipmentListScreen,
  ShipmentEditScreen,
  ShipmentViewScreen,
  ScanOrderScreen,
  ScanGoodScreen,
} from '../../screens/Shipment';

import { FreeShipmentListScreen, FreeShipmentEditScreen, FreeShipmentViewScreen } from '../../screens/FreeShipment';
import {
  InventoryListScreen,
  InventoryEditScreen,
  InventoryViewScreen,
  SelectCellScreen as InvSelectCellScreen,
} from '../../screens/Inventory';
import { CellsViewScreen, ContactListScreen, GoodLineScreen } from '../../screens/Cells';
import { LaboratoryListScreen, LaboratoryEditScreen, LaboratoryViewScreen } from '../../screens/Laboratory';
import { ReturnListScreen, ReturnEditScreen, ReturnViewScreen } from '../../screens/Return';
import {
  ContactListScreen as ContactRemListScreen,
  GoodListScreen,
  GoodLineScreen as GoodRemLineScreen,
} from '../../screens/Remains';

import { SelectRefItemScreen } from '../../components';
import { ReceiptEditScreen, ReceiptListScreen, ReceiptViewScreen } from '../../screens/Receipt';

import { PalletListScreen } from '../../screens/Pallet';
import { OrderListScreen, OrderViewScreen } from '../../screens/Order';

export const moveScreens = {
  MoveEdit: { title: 'Перемещение', component: MoveEditScreen },
  MoveView: { title: '', component: MoveViewScreen },
  SelectRefItem: { title: 'Выбор из справочника', component: SelectRefItemScreen },
  ScanGood: { title: 'Сканер', component: ScanGoodScreen },
  SelectCell: { title: 'Выбор ячейки', component: SelectCellScreen },
};

export const moveListScreens = {
  MoveList: { title: 'Перемещение', component: MoveListScreen },
};

export const moveFromScreens = {
  MoveFromEdit: { title: 'С хранения', component: MoveFromEditScreen },
  MoveFromView: { title: '', component: MoveFromViewScreen },
  SelectRefItem: { title: 'Выбор из справочника', component: SelectRefItemScreen },
  ScanGood: { title: 'Сканер', component: ScanGoodScreen },
  SelectCell: { title: 'Выбор ячейки', component: SelectCellScreen },
};

export const moveFromListScreens = {
  MoveFromList: { title: 'С хранения', component: MoveFromListScreen },
};

export const moveToScreens = {
  MoveToEdit: { title: 'На хранение', component: MoveToEditScreen },
  MoveToView: { title: '', component: MoveToViewScreen },
  SelectRefItem: { title: 'Выбор из справочника', component: SelectRefItemScreen },
  ScanGood: { title: 'Сканер', component: ScanGoodScreen },
  SelectCell: { title: 'Выбор ячейки', component: SelectCellScreen },
};

export const moveToListScreens = {
  MoveToList: { title: 'На хранение', component: MoveToListScreen },
};

export const receiptScreens = {
  ReceiptEdit: { title: 'Приход', component: ReceiptEditScreen },
  ReceiptView: { title: '', component: ReceiptViewScreen },
  SelectRefItem: { title: 'Выбор из справочника', component: SelectRefItemScreen },
  ScanGood: { title: 'Сканер', component: ScanGoodScreen },
};

export const receiptListScreens = {
  ReceiptList: { title: 'Приход', component: ReceiptListScreen },
};

export const shipmentScreens = {
  ShipmentEdit: { title: 'Отвес по заявке', component: ShipmentEditScreen },
  ShipmentView: { title: '', component: ShipmentViewScreen },
  ScanOrder: { title: 'Сканер заявки', component: ScanOrderScreen },
  ScanGood: { title: 'Сканер', component: ScanGoodScreen },
  SelectCell: { title: 'Выбор ячейки', component: SelectCellScreen },
  SelectRefItem: { title: 'Выбор из справочника', component: SelectRefItemScreen },
};

export const shipmentListScreens = {
  ShipmentList: { title: 'Отвес по заявке', component: ShipmentListScreen },
};

export const currShipmentScreens = {
  ShipmentEdit: { title: 'Отвес по заявке', component: ShipmentEditScreen },
  ShipmentView: { title: '', component: ShipmentViewScreen },
  ScanOrder: { title: 'Сканер заявки', component: ScanOrderScreen },
  ScanGood: { title: 'Сканер', component: ScanGoodScreen },
};

export const currShipmentListScreens = {
  CurrShipmentList: { title: 'Отвес по заявке', component: ShipmentListScreen },
};

export const freeShipmentScreens = {
  FreeShipmentEdit: { title: 'Отвес', component: FreeShipmentEditScreen },
  FreeShipmentView: { title: '', component: FreeShipmentViewScreen },
  SelectRefItem: { title: 'Выбор из справочника', component: SelectRefItemScreen },
  ScanGood: { title: 'Сканер', component: ScanGoodScreen },
};

export const freeShipmentListScreens = {
  FreeShipmentList: { title: 'Отвес', component: FreeShipmentListScreen },
};

export const currFreeShipmentScreens = {
  FreeShipmentEdit: { title: 'Отвес $', component: FreeShipmentEditScreen },
  FreeShipmentView: { title: '', component: FreeShipmentViewScreen },
  SelectRefItem: { title: 'Выбор из справочника', component: SelectRefItemScreen },
  ScanGood: { title: 'Сканер', component: ScanGoodScreen },
};

export const currFreeShipmentListScreens = {
  CurrFreeShipmentList: { title: 'Отвес $', component: FreeShipmentListScreen },
};

export const inventoryScreens = {
  InventoryEdit: { title: 'Инвентаризация', component: InventoryEditScreen },
  InventoryView: { title: '', component: InventoryViewScreen },
  SelectRefItem: { title: 'Выбор из справочника', component: SelectRefItemScreen },
  ScanGood: { title: 'Сканер', component: ScanGoodScreen },
  InventorySelectCell: { title: 'Выбор ячейки', component: InvSelectCellScreen },
};

export const inventoryListScreens = {
  InventoryList: { title: 'Инвентаризация', component: InventoryListScreen },
};

export const cellsScreens = {
  CellsView: { title: 'Ячейки', component: CellsViewScreen },
  GoodLine: { title: 'Позиция ячейки', component: GoodLineScreen },
};

export const cellsListScreens = {
  ContactList: { title: 'Ячейки', component: ContactListScreen },
};

export const laboratoryScreens = {
  LaboratoryEdit: { title: 'Лаборатория', component: LaboratoryEditScreen },
  LaboratoryView: { title: '', component: LaboratoryViewScreen },
  SelectRefItem: { title: 'Выбор из справочника', component: SelectRefItemScreen },
  ScanGood: { title: 'Сканер', component: ScanGoodScreen },
};

export const laboratoryListScreens = {
  LaboratoryList: { title: 'Лаборатория', component: LaboratoryListScreen },
};

export const returnScreens = {
  ReturnEdit: { title: 'Возврат', component: ReturnEditScreen },
  ReturnView: { title: '', component: ReturnViewScreen },
  SelectRefItem: { title: 'Выбор из справочника', component: SelectRefItemScreen },
  ScanGood: { title: 'Сканер', component: ScanGoodScreen },
};

export const returnListScreens = {
  ReturnList: { title: 'Возвраты', component: ReturnListScreen },
};

export const remainsListScreens = {
  ContactList: { title: 'Остатки', component: ContactRemListScreen },
};

export const remainsScreens = {
  GoodList: { title: 'Остатки', component: GoodListScreen },
  GoodLine: { title: 'Позиция остатков', component: GoodRemLineScreen },
};

export const palletScreens = {
  PalletList: { title: 'Паллеты', component: PalletListScreen },
  SelectCell: { title: 'Выбор ячейки', component: SelectCellScreen },
};

export const orderScreens = {
  // OrderEdit: { title: 'Заявка', component: OrderEditScreen },
  OrderView: { title: '', component: OrderViewScreen },
  ScanGood: { title: 'Сканер', component: ScanGoodScreen },
};

export const orderListScreens = {
  OrderList: { title: 'Заявки', component: OrderListScreen },
};
