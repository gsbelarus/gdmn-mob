import { SelectRefItemScreen } from '../../components/SelectRefItemScreen';

import { DocListScreen, DocEditScreen, DocViewScreen, DocLineScreen, SelectRemainsScreen } from '../../screens/Doc';

import ScanBarcodeScreen from '../../screens/Doc/ScanBarcodeScreen';
import InvoiceScanBarcodeScreen from '../../screens/Invoice/ScanBarcodeScreen';
import WaybillScanBarcodeScreen from '../../screens/Waybill/ScanBarcodeScreen';

import { ContactListScreen, GoodListScreen, GoodLineScreen } from '../../screens/Remains';

import { ScanListScreen, ScanViewScreen, ScanEditScreen, ScanGoodScreen } from '../../screens/Scan';

import { RevisionGoodScreen, RevisionEditScreen, RevisionListScreen, RevisionViewScreen } from '../../screens/Revision';

import { InvoiceListScreen, InvoiceViewScreen, InvoiceEditScreen, InvoiceLineScreen } from '../../screens/Invoice';
import { WaybillListScreen, WaybillViewScreen, WaybillEditScreen } from '../../screens/Waybill';
import {
  CellMovementListScreen,
  CellMovementViewScreen,
  CellMovementEditScreen,
  SelectCellScreen,
} from '../../screens/CellsMovement';

export const docScreens = {
  DocEdit: { title: 'Документ', component: DocEditScreen },
  DocView: { title: '', component: DocViewScreen },
  DocLine: { title: 'Позиция документа', component: DocLineScreen },
  SelectRefItem: { title: 'Выбор из справочника', component: SelectRefItemScreen },
  SelectRemainsItem: { title: 'Выбор из остатков', component: SelectRemainsScreen },
  ScanBarcode: { title: 'Сканер', component: ScanBarcodeScreen },
};

export const docListScreens = {
  DocList: { title: 'Документы', component: DocListScreen },
};

export const remainsListScreens = {
  ContactList: { title: 'Остатки', component: ContactListScreen },
};

export const remainsScreens = {
  GoodList: { title: 'Остатки', component: GoodListScreen },
  GoodLine: { title: 'Позиция остатков', component: GoodLineScreen },
};

export const scanListScreens = {
  ScanList: { title: 'Сканирование', component: ScanListScreen },
};

export const scanScreens = {
  ScanView: { title: 'Документ', component: ScanViewScreen },
  ScanEdit: { title: 'Документ', component: ScanEditScreen },
  SelectRefItem: { title: 'Выбор из справочника', component: SelectRefItemScreen },
  ScanGood: { title: 'Сканер', component: ScanGoodScreen },
};

export const revisionListScreens = {
  RevisionList: { title: 'Сверка', component: RevisionListScreen },
};

export const revisionScreens = {
  RevisionView: { title: 'Документ', component: RevisionViewScreen },
  RevisionEdit: { title: 'Документ', component: RevisionEditScreen },
  SelectRefItem: { title: 'Выбор из справочника', component: SelectRefItemScreen },
  RevisionGood: { title: 'Сканер', component: RevisionGoodScreen },
};

export const invoiceScreens = {
  InvoiceEdit: { title: 'Счёт-заказ', component: InvoiceEditScreen },
  InvoiceView: { title: '', component: InvoiceViewScreen },
  InvoiceLine: { title: 'Позиция счёт-заказа', component: InvoiceLineScreen },
  SelectRefItem: { title: 'Выбор из справочника', component: SelectRefItemScreen },
  // SelectRemainsItem: { title: 'Выбор из остатков', component: SelectRemainsScreen },
  ScanBarcode: { title: 'Сканер', component: InvoiceScanBarcodeScreen },
};

export const invoiceListScreens = {
  InvoiceList: { title: 'Счёт-заказы', component: InvoiceListScreen },
};

export const waybillScreens = {
  WaybillEdit: { title: 'ЭТТН', component: WaybillEditScreen },
  WaybillView: { title: '', component: WaybillViewScreen },
  ScanBarcode: { title: 'Сканер', component: WaybillScanBarcodeScreen },
};

export const waybillListScreens = {
  WaybillList: { title: 'ЭТТН', component: WaybillListScreen },
};

export const cellMovementScreens = {
  CellMovementEdit: { title: 'Ячейки', component: CellMovementEditScreen },
  CellMovementView: { title: '', component: CellMovementViewScreen },
  ScanBarcode: { title: 'Сканер', component: ScanBarcodeScreen },
  SelectCell: { title: 'Выбор ячейки', component: SelectCellScreen },
  SelectRefItem: { title: 'Выбор из справочника', component: SelectRefItemScreen },
};

export const cellMovementListScreens = {
  WaybillList: { title: 'ЭТТН', component: CellMovementListScreen },
};
