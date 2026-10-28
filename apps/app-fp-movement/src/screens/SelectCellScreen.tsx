import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Pressable } from 'react-native';
import { RouteProp, useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { docSelectors, documentActions, refSelectors, useDispatch, useSelector } from '@lib/store';
import {
  globalStyles as styles,
  LargeText,
  navBackButton,
  AppScreen,
  AppActivityIndicator,
  InfoButton,
} from '@lib/mobile-ui';

import { MD2Theme, useTheme } from 'react-native-paper';

import { ScrollView } from 'react-native-gesture-handler';

import { DashboardStackParamList } from '@lib/mobile-navigation';

import { ICell, ICellName, ICellRef, IInventoryLine, IMoveDocument, IMoveLine, IPalletDocument } from '../store/types';
import { MoveStackParamList, PalletStackParamList } from '../navigation/Root/types';

import { alertWithSound, getCellItem, getCellList, getCellListRef } from '../utils/helpers';
import { ICellRefList, ICellData } from '../store/app/types';
import { Group } from '../components/Group';
import { cellColors } from '../utils/constants';
import { InfoDialog } from '../components/InfoDialog';

export interface ICellList extends ICell, ICellRef {
  department?: string;
}

const NamedRow = ({ item }: { item: string }) => (
  <View key={item} style={[localStyles.flexColumn, localStyles.height]}>
    <TouchableOpacity style={localStyles.row}>
      <Text style={localStyles.buttonLabel}>{item}</Text>
    </TouchableOpacity>
  </View>
);

export const SelectCellScreen = () => {
  const dispatch = useDispatch();
  const navigation =
    useNavigation<
      StackNavigationProp<MoveStackParamList & PalletStackParamList & DashboardStackParamList, 'SelectCell'>
    >();
  const { colors } = useTheme<MD2Theme>();

  const [visibleDialog, setVisibleDialog] = useState(false);
  const { docId, item, mode, docType } = useRoute<RouteProp<MoveStackParamList, 'SelectCell'>>().params;

  const doc = docSelectors.selectByDocId<IMoveDocument>(docId);

  const cells = refSelectors.selectByName<ICellRefList>('cell')?.data[0];

  const [fromCell, setFromCell] = useState<IMoveLine | undefined>(undefined);
  const [toCell, setToCell] = useState<IMoveLine | IInventoryLine | undefined>(undefined);
  const [selectedChamber, setSelectedChamber] = useState<string | undefined>();
  const [selectedRow, setSelectedRow] = useState<string | undefined>();

  const [defaultCell, setDefaultCell] = useState<string[]>([]);

  const departId = useMemo(
    () =>
      doc?.head.fromDepart && doc?.head.fromDepart?.isAddressStore && !fromCell
        ? doc?.head.fromDepart?.id
        : doc?.head.toDepart?.id,
    [doc?.head, fromCell],
  );

  const docList = useSelector((state) => state.documents.list);

  const docs = useMemo(
    () =>
      docList
        ?.filter(
          (i) =>
            i.documentType?.name === (docType && !docType.includes('pallet') ? docType : 'movement') &&
            i.status !== 'PROCESSED' &&
            (i?.head?.fromDepart?.id === departId || i?.head?.toDepart?.id === departId),
        )
        .sort((a, b) => new Date(b.documentDate).getTime() - new Date(a.documentDate).getTime()) as IMoveDocument[],
    [departId, docList, docType],
  );

  const palletList = docList.filter((i) => i.documentType?.name === 'pallet') as IPalletDocument[];

  const lines = docs.reduce((prev: IMoveLine[], cur) => [...prev, ...cur.lines], []);

  const cellList = useMemo(
    () => getCellList(Array.isArray(cells?.[departId ?? '']) ? cells[departId ?? ''] : [], lines ?? []),
    [cells, departId, lines],
  );

  const handleAddLine = useCallback(
    (line: IMoveLine) => {
      dispatch(documentActions.addDocumentLine({ docId, line }));
      navigation.goBack();
    },
    [dispatch, docId, navigation],
  );

  useEffect(() => {
    if (item && item.toCell && mode === 1) {
      setSelectedChamber(getCellItem(item.toCell).chamber);
      setSelectedRow(getCellItem(item.toCell).row);
      setToCell(item);
    }
  }, [item, mode]);

  const defaultGoodCells = (cells?.[departId || ''] || []).filter(
    (i) => i.defaultGroup?.id && i.defaultGroup?.id === item.good.goodGroupId,
  );

  const dividedCells = defaultGoodCells.reduce((prev: ICellName[], cur) => {
    const dividedCell = getCellItem(cur.name);

    prev = [...prev, dividedCell];
    return prev;
  }, []);

  const currentCell = dividedCells.length
    ? cellList[dividedCells[0].chamber]?.[dividedCells[0].row]?.[defaultGoodCells[0].tier]?.find(
        (i) => i.cell === dividedCells[0].cell,
      )
    : undefined;

  const cellListRef = getCellListRef(cellList);

  const cell = cellListRef.find((i) => i.barcode === item.barcode)?.name;

  useEffect(() => {
    if (cell && doc?.head.fromDepart?.isAddressStore && mode === 0) {
      setSelectedChamber(getCellItem(cell).chamber);
      setSelectedRow(getCellItem(cell).row);
      setToCell(item);
    }
  }, [cell, doc?.head.fromDepart?.isAddressStore, item, mode]);

  useEffect(() => {
    if (currentCell && !currentCell?.barcode && doc?.head.toDepart?.isAddressStore) {
      setSelectedChamber(dividedCells[0].chamber);
      setSelectedRow(dividedCells[0].row);
      setDefaultCell(defaultGoodCells.map((i) => i.name));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCell?.barcode, mode]);

  const chamberKeys = useMemo(() => Object.keys(cellList || {}), [cellList]);
  const hasChamberLevel = useMemo(() => chamberKeys.filter((k) => k).length >= 1, [chamberKeys]);

  const rowKeysForSelected = useMemo(
    () => (selectedChamber !== undefined ? Object.keys(cellList?.[selectedChamber] || {}) : []),
    [cellList, selectedChamber],
  );

  const hasRowLevel = useMemo(() => rowKeysForSelected.filter((k) => k).length >= 1, [rowKeysForSelected]);

  useEffect(() => {
    if (selectedChamber === undefined && chamberKeys.length === 1) {
      setSelectedChamber(chamberKeys[0]);
    }
  }, [chamberKeys, selectedChamber]);

  useEffect(() => {
    if (selectedRow === undefined && rowKeysForSelected.length === 1) {
      setSelectedRow(rowKeysForSelected[0]);
    }
  }, [rowKeysForSelected, selectedRow]);

  const cellsByRow = useMemo(() => {
    if (selectedChamber === undefined) {
      return [];
    }

    const rowsObject = cellList?.[selectedChamber] || {};

    if (hasRowLevel) {
      if (!selectedRow) {
        return [];
      }
      return Object.entries(rowsObject?.[selectedRow] || {}).reverse();
    }

    const firstRowKey = Object.keys(rowsObject)[0];
    if (firstRowKey === undefined) {
      return [];
    }

    return Object.entries(rowsObject?.[firstRowKey] || {}).reverse();
  }, [cellList, hasRowLevel, selectedChamber, selectedRow]);

  const handleSaveLine = useCallback(
    (cellData: ICellData) => {
      let newCell: string;
      if (hasChamberLevel && hasRowLevel) {
        newCell = `${selectedChamber}-${selectedRow}-${cellData.cell}`;
      } else if (hasChamberLevel && !hasRowLevel) {
        newCell = `${selectedChamber}-${cellData.cell}`;
      } else if (!hasChamberLevel && hasRowLevel) {
        newCell = `${selectedRow}-${cellData.cell}`;
      } else {
        newCell = `${cellData.cell}`;
      }

      const storeDate = new Date().toISOString();
      if (mode === 0) {
        if (doc?.head.fromDepart?.isAddressStore) {
          if (!fromCell) {
            if (cellData.barcode === item?.barcode) {
              if (!doc?.head.toDepart?.isAddressStore) {
                const newLine: IMoveLine = { ...item, fromCell: newCell };
                handleAddLine(newLine);
              } else {
                setFromCell({ ...item, fromCell: newCell });
              }
            } else {
              alertWithSound('Ошибка выбора ячейки!', 'Данная ячейка занята другим товаром, выберите другую ячейку.');
            }
          } else {
            const newLine: IMoveLine = { ...fromCell, toCell: newCell, storeDate };
            handleAddLine(newLine);
          }
        } else {
          const newLine: IMoveLine = { ...item, toCell: newCell, storeDate };
          handleAddLine(newLine);
          if (docType?.includes('pallet')) {
            const palletId = docType.replace('pallet', '');
            const document1 = palletList.find((i) => i.id === palletId);
            if (document1) {
              dispatch(
                documentActions.updateDocument({
                  docId: palletId,
                  document: {
                    ...document1,
                    status: 'ARCHIVE',
                    head: { ...document1.head, toCell: newCell, storeDate },
                  },
                }),
              );
            }
          }
        }
      } else {
        const newLine: IMoveLine = { ...item, toCell: newCell, storeDate };
        dispatch(
          documentActions.updateDocumentLine({
            docId,
            line: newLine,
          }),
        );
        navigation.goBack();
      }
    },
    [
      dispatch,
      doc?.head.fromDepart?.isAddressStore,
      doc?.head.toDepart?.isAddressStore,
      docId,
      fromCell,
      handleAddLine,
      item,
      mode,
      navigation,
      palletList,
      docType,
      selectedChamber,
      selectedRow,
      hasChamberLevel,
      hasRowLevel,
    ],
  );

  const renderRight = useCallback(() => <InfoButton onPress={() => setVisibleDialog(true)} />, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: navBackButton,
      headerRight: renderRight,
    });
  }, [navigation, renderRight]);

  const Cell = useCallback(
    ({ i }: { i: ICellData }) => {
      const colorStyle = {
        color:
          defaultCell.length && defaultCell.find((e) => e === i.name)
            ? cellColors.textWhite
            : i.disabled || !i.barcode
              ? colors.backdrop
              : cellColors.textWhite,
      };
      const backColorStyle = {
        backgroundColor:
          (fromCell && fromCell.barcode === i.barcode) || (toCell && toCell.barcode === i.barcode)
            ? colors.error
            : i.disabled
              ? colors.backdrop
              : defaultCell.length && defaultCell.find((e) => e === i.name)
                ? cellColors.default
                : i.barcode
                  ? cellColors.barcode
                  : cellColors.free,
      };

      return (
        <Pressable
          key={`${i.name}-${i.sortOrder}`}
          style={({ pressed }) => [localStyles.buttons, backColorStyle, pressed && { backgroundColor: colors.accent }]}
          onPress={() => handleSaveLine(i)}
          disabled={
            (doc?.head.fromDepart?.isAddressStore && !fromCell ? !i.barcode : Boolean(i.barcode)) || Boolean(i.disabled)
          }
        >
          <Text style={[localStyles.buttonLabel, colorStyle]}>{i.cell}</Text>
        </Pressable>
      );
    },
    [
      colors.accent,
      colors.backdrop,
      colors.error,
      defaultCell,
      doc?.head.fromDepart?.isAddressStore,
      fromCell,
      handleSaveLine,
      toCell,
    ],
  );

  const CellsColumn = useCallback(
    ({ cellData }: { cellData: ICellData[] }) => (
      <View style={styles.flexDirectionRow}>
        {cellData?.map((i) => <Cell key={`${i.name}-${i.sortOrder}`} i={i} />)}
      </View>
    ),
    [Cell],
  );

  const isFocused = useIsFocused();
  if (!isFocused) {
    return <AppActivityIndicator />;
  }

  if (!doc) {
    return (
      <View style={[styles.container, styles.alignItemsCenter]}>
        <LargeText>Документ не найден</LargeText>
      </View>
    );
  }

  return (
    <AppScreen>
      <View style={localStyles.groupItem}>
        {fromCell ? (
          <View style={styles.alignItemsCenter}>
            <Text style={localStyles.buttonLabel}>Из {fromCell?.fromCell}</Text>
          </View>
        ) : null}
        <ScrollView>
          {hasChamberLevel && (
            <Group
              values={chamberKeys}
              onPress={(i) => setSelectedChamber(i)}
              selected={selectedChamber}
              colorBack="#d5dce3"
              colorSelected={colors.placeholder}
              title="Камера"
              heightBtn={54}
              widthBtn={106}
            />
          )}
          {selectedChamber && hasRowLevel ? (
            <Group
              values={rowKeysForSelected}
              onPress={(i) => setSelectedRow(i)}
              selected={selectedRow}
              colorBack="#dbd5da"
              colorSelected="#854875"
              title="Ряд"
            />
          ) : null}
          {((hasRowLevel && selectedRow && selectedChamber) || (!hasRowLevel && selectedChamber)) && (
            <View>
              <Text style={localStyles.cellItem}>Ячейки</Text>

              <View style={styles.flexDirectionRow}>
                <View style={styles.directionColumn}>
                  {cellsByRow.map(([key, _]) => (
                    <NamedRow key={key} item={key} />
                  ))}
                </View>

                <ScrollView horizontal>
                  <View style={styles.directionColumn}>
                    {cellsByRow.map(([key, data]) => (
                      <CellsColumn key={key} /*row={key}*/ cellData={data} />
                    ))}
                  </View>
                </ScrollView>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
      <InfoDialog onOk={() => setVisibleDialog(false)} title="Ячейки" visible={visibleDialog} />
    </AppScreen>
  );
};

const localStyles = StyleSheet.create({
  groupItem: {
    marginTop: 2,
    flex: 1,
  },
  flexColumn: {
    flexDirection: 'column',
    justifyContent: 'center',
    marginVertical: 3,
  },
  buttons: {
    padding: 4,
    borderRadius: 4,
    margin: 3,
    textAlign: 'center',
    height: 50,
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    opacity: 0.9,
    lineHeight: 14,
    textAlignVertical: 'center',
  },
  row: {
    alignItems: 'center',

    width: 20,
  },
  height: { height: 50 },
  cellItem: {
    textAlign: 'center',
    fontWeight: 'bold',
    marginTop: 4,
  },
});
