import { log, round } from '@lib/mobile-hooks';

import { Alert } from 'react-native';

import { Audio } from 'expo-av';

import {
  IMoveDocument,
  IFreeShipmentDocument,
  IShipmentDocument,
  barcodeSettings,
  ICell,
  ICellRef,
  IMoveLine,
  ICellName,
  IInventoryDocument,
  IBasedLine,
  ILaboratoryDocument,
  IReceiptDocument,
  IReturnDocument,
  ISendingLine,
  IFreeShipmentLine,
  IPalletDocument,
} from '../store/types';
import {
  IBarcode,
  ICellData,
  IGood,
  IGoodQuantity,
  IMGoodData,
  IModelData,
  IModelRem,
  IRemGood,
  IRemainsData,
} from '../store/app/types';

import { ONE_KG_IN_G, ONE_T_IN_KG } from './constants';

export const getNextDocNumber = (
  documents: IMoveDocument[] | IShipmentDocument[] | IFreeShipmentDocument[] | IInventoryDocument[] | IPalletDocument[],
) => {
  return (
    documents
      ?.map((item) => parseInt(item.number, 10))
      .reduce((newId, currId) => (newId > currId ? newId : currId), 0) + 1 || 1
  ).toString();
};

export const getBarcode = (barcode: string, settings: barcodeSettings) => {
  const weightLast = settings.countWeight;
  const dayLast = weightLast + settings.countDay;
  const monthLast = dayLast + settings.countMonth;
  const yearLast = monthLast + settings.countYear;
  const timeLast = yearLast + 4;
  const shcodeLast = timeLast + settings.countCode;
  const quantPackLast = shcodeLast + settings.countQuantPack;
  const numReceivedLast = quantPackLast + settings.countNumReceived;
  const flagLast = numReceivedLast + settings.flag;

  const weight = barcode.slice(0, weightLast);
  const day = barcode.slice(weightLast, dayLast);
  const month = barcode.slice(dayLast, monthLast);
  const year = '20' + barcode.slice(monthLast, yearLast);
  const shcode = barcode.slice(yearLast + 4, shcodeLast);
  const quantPack = barcode.slice(shcodeLast, quantPackLast);
  const numReceived = barcode.slice(quantPackLast, numReceivedLast);
  const flag = barcode.slice(numReceivedLast, flagLast);

  const time = barcode.slice(yearLast, timeLast);

  const workDate = new Date(Number(year), Number(month) - 1, Number(day)).toISOString();

  const barcodeObj: IBarcode = {
    barcode: barcode,
    weight: round(Number(weight) / ONE_KG_IN_G, 3),
    workDate,
    shcode: shcode,
    numReceived: numReceived,
    quantPack: flag ? Number(quantPack) : Number(weight) < settings.boxWeight * ONE_KG_IN_G ? 1 : Number(quantPack),
    time,
  };

  return flag.trim() ? { ...barcodeObj, flag } : barcodeObj;
};

export const getBarcodeString = (barcodeObj: IBarcode, settings: barcodeSettings) => {
  const day = `00${new Date(barcodeObj.workDate).getDate().toLocaleString()}`.slice(-2);
  const month = `00${(new Date(barcodeObj.workDate).getMonth() + 1).toLocaleString()}`.slice(-2);
  const year = `00${new Date(barcodeObj.workDate).getFullYear().toLocaleString().slice(2)}`.slice(-2);

  const shcode = getCodeForCheck(barcodeObj.shcode, settings?.countCode || 4);
  const quantPack = getCodeForCheck(barcodeObj.quantPack.toLocaleString(), settings?.countQuantPack || 4);

  const weight =
    barcodeObj.weight < ONE_T_IN_KG
      ? getCodeForCheck(round(barcodeObj.weight * ONE_KG_IN_G, 3).toString(), settings?.countWeight || 6)
      : round(barcodeObj.weight * ONE_KG_IN_G, 3).toString();

  const barcode =
    weight +
    day +
    month +
    year +
    (barcodeObj.time || '0000') +
    shcode +
    quantPack +
    barcodeObj.numReceived +
    (barcodeObj.flag ? barcodeObj.flag : '');
  return barcode;
};

export const getLastMovingPos = (pos: ICellRef, lines: IMoveLine[]) => {
  const from = lines.find((i) => i.fromCell === pos.name);
  const to = lines.find((i) => i.toCell === pos.name);
  return { from, to };
};

export const getCellItem = (str: string): ICellName => {
  const parts = str.split('-').filter((p) => p.length > 0);

  if (parts.length >= 3) {
    const [chamber, row, cell] = parts.slice(-3);
    return { chamber, row, cell } as ICellName;
  }

  if (parts.length === 2) {
    const [first, second] = parts;
    const hasLetter = /[A-Za-zА-Яа-я]/.test(first);

    // If first part has a letter, treat it as chamber (no row).
    // Otherwise treat it as row (no chamber).
    if (hasLetter) {
      return { chamber: first, row: '', cell: second } as ICellName;
    }

    return { chamber: '', row: first, cell: second } as ICellName;
  }

  if (parts.length === 1) {
    return { chamber: '', row: '', cell: parts[0] } as ICellName;
  }

  // Fallback for empty/invalid strings
  return { chamber: '', row: '', cell: '' } as ICellName;
};

// Формирует модель с ячейками по подразделениям
export const getCellList = (list: ICellRef[], lines: IMoveLine[]) => {
  const model = list?.reduce((prev: IModelData, cur) => {
    const cellNameItem = getCellItem(cur.name);
    const cellItem: ICell = { ...cellNameItem, tier: cur.tier };

    const chamber = prev?.[cellItem?.chamber];

    const { from, to } = getLastMovingPos(cur, lines);

    const newCell: ICellData = {
      name: cur.name,
      cell: cellItem.cell,
      barcode: from ? '' : to ? to.barcode : cur.barcode || '',
      // barcode: cur.barcode || '',
      tier: cur.tier,
      disabled: cur.disabled || false,
      defaultGroup: cur.defaultGroup,
      sortOrder: cur.sortOrder,
    };

    if (!chamber) {
      prev[cellItem?.chamber] = {};

      prev[cellItem?.chamber][cellItem?.row] = {};
      prev[cellItem?.chamber][cellItem?.row][cellItem.tier] = [newCell];
    } else {
      const row = chamber[cellItem?.row];

      if (!row) {
        prev[cellItem?.chamber][cellItem?.row] = {};
        prev[cellItem?.chamber][cellItem?.row][cellItem.tier] = [newCell];
      } else {
        const tier = row[cellItem?.tier];

        if (!tier) {
          prev[cellItem?.chamber][cellItem?.row][cellItem?.tier] = [newCell];
        } else {
          prev[cellItem?.chamber][cellItem?.row][cellItem?.tier] = [
            ...prev[cellItem?.chamber][cellItem?.row][cellItem?.tier],
            newCell,
          ];
        }
      }
    }
    return prev;
  }, {});

  return model;
};

// Формирует справочник из модели с ячейками
export const getCellListRef = (model: IModelData) => {
  const list: ICellRef[] = Object.entries(model).reduce((prev: ICellRef[], curChamber) => {
    const chamberData = curChamber[1];
    const cellListByChamber = Object.entries(chamberData).reduce((listByChamber: ICellRef[], curRow) => {
      const rowData = curRow[1];

      const cellListByRow: ICellRef[] = Object.values(rowData).reduce((listByRow: ICellRef[], curCell) => {
        const cellInRow = curCell.map((i) => {
          const cell: ICellRef = {
            name: i.name,
            tier: i.tier,
            barcode: i.barcode,
            defaultGroup: i.defaultGroup,
            disabled: i.disabled,
            sortOrder: i.sortOrder,
          };
          return cell;
        });

        listByRow = [...listByRow, ...cellInRow];
        return listByRow;
      }, []);
      listByChamber = [...listByChamber, ...cellListByRow];
      return listByChamber;
    }, []);
    prev = [...prev, ...cellListByChamber];
    return prev;
  }, []);

  const sortedList = list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  return sortedList;
};

export const jsonFormat = (str: any) => {
  return JSON.stringify(str, null, '\t');
};

// Возвращает новую дату со врменем 00:00:00
export const getNewDate = (date: string) => {
  const newDate = new Date(date);
  return new Date(newDate.getFullYear(), newDate.getMonth(), newDate.getDate()).toISOString();
};

//Возвращает суммарный вес товара в позициях документов
export const getTotalWeight = (good: IRemGood, docs: IShipmentDocument[]) => {
  const linesWeight = docs.reduce((prev, cur) => {
    const weight = cur.lines
      .filter((i) => i.good.id === good.good?.id)
      .reduce((sum, line) => {
        sum = sum + line.weight;
        return sum;
      }, 0);

    prev = prev + weight;
    return prev;
  }, 0);

  return linesWeight;
};

// Возвращает товар для добавления в позицию
export const getLineGood = (
  shcode: string,
  weight: number,
  goods: IGood[],
  goodRemains: IRemGood[],
  remainsUse: boolean,
  countCode: number,
) => {
  if (remainsUse) {
    if (goodRemains.length) {
      const good = goodRemains.find(
        (item) => item.good && getCodeForCheck(item.good.shcode, countCode || 4) === shcode,
      );

      if (good) {
        const isRightWeight = good.remains >= weight;

        return {
          good: {
            id: good.good.id,
            name: good.good.name,
            shcode: good.good.shcode,
            isCattle: good.good.isCattle,
            goodGroupId: good.good.goodGroupId,
          },
          isRightWeight,
        };
      } else {
        return { good: undefined, isRightWeight: false };
      }
    } else {
      return { good: undefined, isRightWeight: false };
    }
  } else {
    const good = goods.find((item) => getCodeForCheck(item.shcode, countCode || 4) === shcode);
    return {
      good: good
        ? {
            id: good.id,
            name: good.name,
            shcode: good.shcode,
            isCattle: good.isCattle,
            goodGroupId: good.goodGroupId,
            unitWeight: good.unitWeight,
          }
        : undefined,
      isRightWeight: true,
    };
  }
};

export const getTotalLines = (docList: IShipmentDocument[], departId: string) =>
  docList.reduce((prev: IGoodQuantity, cur) => {
    const isAdd = cur?.head?.toDepart?.id === departId;
    const isSubtr = cur?.head?.fromDepart?.id === departId;
    if (
      cur.documentType?.name !== 'order' &&
      cur.documentType?.name !== 'inventory' &&
      cur.documentType?.name !== 'return' &&
      cur.status !== 'PROCESSED' &&
      (isAdd || isSubtr)
    ) {
      cur.lines.forEach((line) => {
        const good = prev[line.good.id];

        const quantity = isAdd ? line.weight : -line.weight;

        if (good) {
          prev[line.good.id] = prev[line.good.id] + quantity;
        } else {
          prev[line.good.id] = quantity;
        }
      });
    }

    return prev;
  }, {});

export const getUpdatedLine = (
  settings: barcodeSettings,
  usedRemains: boolean,
  lineBarcode: IBarcode,
  line: IBasedLine,
  quantity: number,
  weight?: number,
) => {
  const newBarcode = weight
    ? getBarcodeString({ ...lineBarcode, quantPack: quantity, weight }, settings)
    : getBarcodeString({ ...lineBarcode, quantPack: quantity }, settings);

  return {
    ...line,
    quantPack: quantity,
    weight: weight ? weight : line.weight,
    scannedBarcode: line?.barcode,
    barcode: newBarcode,
    usedRemains,
  } as IBasedLine;
};

export const getDocToSend = (
  doc:
    | IShipmentDocument
    | IFreeShipmentDocument
    | IMoveDocument
    | ILaboratoryDocument
    | IInventoryDocument
    | IReceiptDocument
    | IReturnDocument,
) => {
  return {
    ...doc,
    head: { ...doc?.head, linesNumber: doc?.lines.length },
    lines: doc?.lines.map(
      (i) =>
        ({
          id: i.id,
          goodId: i.good.id,
          weight: i.weight,
          quantity: (i as IFreeShipmentLine).quantity,
          workDate: i.workDate,
          numReceived: i.numReceived,
          barcode: i.barcode,
          quantPack: i.quantPack,
          scannedBarcode: i.scannedBarcode,
          usedRemains: i.usedRemains,
          fromCell: (i as IMoveLine).fromCell,
          toCell: (i as IMoveLine).toCell,
          box: (i as IFreeShipmentLine).box,
          storeDate: (i as IMoveLine).storeDate,
          flag: i.flag,
          ...(i.mark
            ? {
                mark: {
                  id: i.mark.id,
                  code: i.mark.code,
                },
              }
            : {}),
        }) as ISendingLine,
    ),
  };
};

export const getRemGoodListByContact = (
  goods: IGood[],
  remains: IRemainsData[] = [],
  // docList: IShipmentDocument[] = [],
  // departId: string,
) => {
  log('getRemGoodListByContact', 'Начало построения массива товаров по подразделению');

  const remGoods: IRemGood[] = [];
  if (goods.length) {
    //Если есть остатки, то формируем модель остатков по ид товара
    if (remains.length) {
      //Формируем объект остатков тмц
      // const linesQuantity = getTotalLines(docList, departId) || undefined;

      const remainsByGoodId = getRemainsByGoodId(remains /*, linesQuantity*/);

      //Формируем массив товаров, добавив свойствоостатка
      //Если по товару нет остатков и если модель не для выбора из справочника тмц, (не из остатков)
      //то добавляем запись с нулевыми значениями остатка
      for (const good of goods) {
        if (remainsByGoodId && remainsByGoodId[good.id]) {
          for (const r of remainsByGoodId[good.id]) {
            //Если isRemains true, то в модель такие товары не добавляем
            if (r.q !== 0) {
              remGoods.push({
                good,
                remains: r.q,
              });
            }
          }
        }
        // else if (
        //   remainsByGoodId &&
        //   linesQuantity &&
        //   isNumeric(linesQuantity[good.id]) &&
        //   linesQuantity[good.id] !== 0
        // ) {
        //   remGoods.push({
        //     good,
        //     remains: linesQuantity[good.id],
        //   });
        // }
      }
    }
  }

  log('getRemGoodListByContact', 'Окончание построения массива товаров по подразделению');
  return remGoods;
};

//Возвращает объект остатков тмц, пример: {"1": [{ q: 1 }, { q: 2 }]}
const getRemainsByGoodId = (remains: IRemainsData[] /*, linesQuantity: IGoodQuantity*/) => {
  return remains.reduce((p: IMGoodData<IModelRem[]>, { goodId, q = 0 }: IRemainsData) => {
    const x = p[goodId];
    // const goodQ = linesQuantity[goodId] || 0;

    // const newQ = q + goodQ;
    if (q !== 0) {
      if (!x) {
        p[goodId] = [{ q }];
      } else {
        x.push({ q });
      }
    }
    return p;
  }, {});
};

// Звук ошибки загружается один раз: создание нового Audio.Sound на каждый
// неудачный скан течёт и замедляет серию ошибок
let errorSoundPromise: Promise<Audio.Sound> | undefined;

const getErrorSound = (): Promise<Audio.Sound> => {
  if (!errorSoundPromise) {
    errorSoundPromise = Audio.Sound.createAsync(require('../../assets/error.wav')).then(({ sound }) => sound);
  }
  return errorSoundPromise;
};

const playErrorSound = async () => {
  try {
    (await getErrorSound()).replayAsync();
  } catch {
    // ошибка загрузки звука не должна мешать алерту
  }
};

export const alertWithSound = (label: string, text: string, onClose?: () => void) => {
  playErrorSound();
  Alert.alert(label, text, [{ text: 'OK', onPress: onClose }]);
};

export const alertWithSoundMulti = (label: string, text: string, onOk: () => void, onClose?: () => void) => {
  playErrorSound();

  Alert.alert(`${label}`, `${text}`, [
    {
      text: 'Отмена',
      onPress: onClose,
    },
    {
      text: 'Да',
      onPress: () => onOk(),
    },
  ]);
};

export const getCodeForCheck = (value: string, count: number) =>
  `${'0'.repeat(count || 4)}${value}`.slice(-(count || 4));
