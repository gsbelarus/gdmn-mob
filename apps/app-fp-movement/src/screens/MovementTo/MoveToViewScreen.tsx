import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { View, TextInput, Keyboard, TouchableHighlight, ViewStyle, StyleProp } from 'react-native';
import { RouteProp, useIsFocused, useNavigation, useRoute, useTheme } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { docSelectors, documentActions, refSelectors, useDispatch, useDocThunkDispatch, useSelector } from '@lib/store';
import {
  MenuButton,
  useActionSheet,
  globalStyles as styles,
  InfoBlock,
  ItemSeparator,
  SendButton,
  AppActivityIndicator,
  MediumText,
  LargeText,
  AppDialog,
  ScanButton,
  navBackButton,
  SimpleDialog,
  DateInfo,
  CloseButton,
  DeleteButton,
} from '@lib/mobile-ui';

import {
  generateId,
  getDateString,
  keyExtractor,
  useSendDocs,
  sleep,
  useSendOneRefRequest,
  isNumeric,
  round,
} from '@lib/mobile-hooks';

import { IDocumentType, INamedEntity, ScreenState } from '@lib/types';

import { FlashList } from '@shopify/flash-list';

import { barcodeSettings, IMoveDocument, IMoveLine, IShipmentDocument } from '../../store/types';
import { MoveToStackParamList } from '../../navigation/Root/types';
import { getStatusColor, lineTypes, SCAN_REFOCUS_DELAY_MS } from '../../utils/constants';

import {
  alertWithSound,
  alertWithSoundMulti,
  getBarcode,
  getCodeForCheck,
  getDocToSend,
  getLineGood,
  getNextDocNumber,
  getRemGoodListByContact,
  getUpdatedLine,
} from '../../utils/helpers';
import { IAddressStoreEntity, IBarcode, IGood, IRemains, IRemGood } from '../../store/app/types';

import ViewTotal from '../../components/ViewTotal';
import QuantDialog from '../../components/QuantDialog';
import LineItem from '../../components/LineItem';
import { useLineDeleteMode } from '../../utils/useLineDeleteMode';

export interface IScanerObject {
  item?: IMoveLine;
  barcode: string;
  state: 'scan' | 'added' | 'notFound';
}

export const MoveToViewScreen = () => {
  const showActionSheet = useActionSheet();
  const dispatch = useDispatch();
  const docDispatch = useDocThunkDispatch();
  const navigation = useNavigation<StackNavigationProp<MoveToStackParamList, 'MoveToView'>>();
  const isFocused = useIsFocused();

  const { colors } = useTheme();

  const [screenState, setScreenState] = useState<ScreenState>('idle');
  const [visibleDialog, setVisibleDialog] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [isDateVisible, setIsDateVisible] = useState(false);

  const [scanned, setScanned] = useState(false);

  const [visibleQuantPackDialog, setVisibleQuantPackDialog] = useState(false);
  const [quantPack, setQuantPack] = useState('');
  const [quantPallet, setQuantPallet] = useState('');
  const [newwLine, setNewLine] = useState<IMoveLine | undefined>(undefined);

  const id = useRoute<RouteProp<MoveToStackParamList, 'MoveToView'>>().params?.id;
  const doc = docSelectors.selectByDocId<IMoveDocument>(id);
  const isScanerReader = useSelector((state) => state.settings?.data)?.scannerUse?.data;
  const loading = useSelector((state) => state.app.loading);

  const [visibleSendDialog, setVisibleSendDialog] = useState(false);

  const ref = useRef<TextInput>(null);

  const scheduleScannerFocus = useCallback(() => {
    setTimeout(() => {
      ref.current?.focus();
      ref.current?.clear();
    }, SCAN_REFOCUS_DELAY_MS);
  }, []);

  const lines = useMemo(
    () => (doc?.lines ? [...doc.lines].sort((a, b) => (b.sortOrder || 0) - (a.sortOrder || 0)) : undefined),
    [doc?.lines],
  );
  const lineSum = lines?.reduce(
    (sum, line) => {
      return { ...sum, quantPack: sum.quantPack + (line.quantPack || 0), weight: sum.weight + (line.weight || 0) };
    },
    { quantPack: 0, weight: 0 },
  );

  // const [wMode, setWmode] = useState(false);

  const isBlocked = doc?.status !== 'DRAFT';

  const goods = refSelectors.selectByName<IGood>('good').data;
  const settings = useSelector((state) => state.settings?.data);
  const allowLineDelete = Boolean(settings.allowLineDelete?.data);
  const { delList, isDelList, handleDeleteSelectedLines, getLineHandlers, clearSelection } = useLineDeleteMode({
    allowLineDelete,
    isBlocked,
  });
  const departs = refSelectors.selectByName<IAddressStoreEntity>('depart').data;

  const handleDeleteLines = useCallback(() => {
    handleDeleteSelectedLines(() => {
      dispatch(documentActions.removeDocumentLines({ docId: id, lineIds: delList }));
      clearSelection();
      setScanned(false);
      scheduleScannerFocus();
    });
  }, [clearSelection, delList, dispatch, handleDeleteSelectedLines, id, scheduleScannerFocus]);

  const goodBarcodeSettings = Object.entries(settings).reduce((prev: barcodeSettings, [idx, item]) => {
    if (item && item.group?.id !== 'base' && typeof item.data === 'number') {
      prev[idx] = item.data;
    }
    return prev;
  }, {});

  const minBarcodeLength = (settings.minBarcodeLength?.data as number) || 0;
  const maxBarcodeLength = (settings.maxBarcodeLength?.data as number) || 0;

  const addPalletQuantPack = Boolean(settings.addPalletQuantPack?.data);

  const isAddressStore = Boolean(settings.addressStore?.data);

  // const storeMan = useSelector((state) => state.auth.user);

  const docList = useSelector((state) => state.documents.list) as IShipmentDocument[];

  const documentTypes = refSelectors.selectByName<IDocumentType>('documentType')?.data;
  const documentType = useMemo(
    () => documentTypes?.find((d) => d.id === doc?.documentType.id),
    [doc?.documentType.id, documentTypes],
  );

  const defaultDepart = useSelector((state) => state.settings?.userData?.depart?.data) as INamedEntity;

  const remainsUse =
    (doc?.head.fromDepart.id === defaultDepart?.id || Boolean(documentType?.isRemains)) &&
    Boolean(settings.remainsUse?.data);

  const remains = refSelectors.selectByName<IRemains>('remains')?.data?.[0];

  const goodRemains = useMemo<IRemGood[]>(() => {
    return doc?.head?.fromDepart?.id && isFocused && remains
      ? getRemGoodListByContact(goods, remains[doc.head.fromDepart.id] /*, docList, doc.head.fromDepart.id*/)
      : [];
  }, [doc?.head?.fromDepart?.id, goods, isFocused, remains]);

  const handleShowDialog = () => {
    setVisibleDialog(true);
  };

  const handleFocus = () => {
    ref?.current?.focus();
  };

  const handleDismissBarcode = () => {
    setVisibleDialog(false);
    setBarcode('');
    setErrorMessage('');
    setScanned(false);
    Keyboard.dismiss();
    handleFocus();
  };

  // const [barcodeGeneration, setBarcodeGeneration] = useState(false);

  // const [visibleQuantPackDialog, setVisibleQuantPackDialog] = useState(false);
  // const [quantPack, setQuantPack] = useState('');

  // const handleAddQuantPack = useCallback(
  //   (quantity: number) => {
  //     const line = lines?.[0];
  //     if (!line) {
  //       return;
  //     }

  //     const lineBarcode: IBarcode = {
  //       barcode: line.barcode || '',
  //       numReceived: line.numReceived,
  //       quantPack: line.quantPack,
  //       shcode: line.good.shcode,
  //       weight: line.weight,
  //       workDate: line.workDate,
  //       time: line.time,
  //     };

  //     if (line?.weight >= goodBarcodeSettings?.boxWeight) {
  //       const newBarcode = getBarcodeString({ ...lineBarcode, quantPack: quantity });
  //       const newLine: IMoveLine = {
  //         ...line,
  //         quantPack: quantity,
  //         scannedBarcode: line?.barcode,
  //         barcode: newBarcode,
  //         usedRemains: remainsUse,
  //       };
  //       dispatch(documentActions.updateDocumentLine({ docId: id, line: newLine }));
  //     }
  //   },
  //   [dispatch, goodBarcodeSettings?.boxWeight, id, lines, remainsUse],
  // );

  // const handleEditQuantPack = () => {
  //   handleAddQuantPack(Number(quantPack));
  //   setVisibleQuantPackDialog(false);
  //   setQuantPack('');
  //   Keyboard.dismiss();
  //   handleFocus();
  // };

  // const handleDismissQuantPack = () => {
  //   setVisibleQuantPackDialog(false);
  //   setQuantPack('');
  //   Keyboard.dismiss();
  //   handleFocus();
  // };

  const handleAddQuantPack = useCallback(
    (quantity: number) => {
      const line = newwLine;
      if (!line) {
        return;
      }

      const lineBarcode: IBarcode = {
        barcode: line.barcode || '',
        numReceived: line.numReceived,
        quantPack: line.quantPack,
        shcode: line.good.shcode,
        weight: line.weight,
        workDate: line.workDate,
        time: line.time,
      };

      const weight = round(line?.weight * quantity, 3);

      const good =
        remainsUse && goodRemains.length
          ? goodRemains.find(
              (item) =>
                getCodeForCheck(item.good.shcode, goodBarcodeSettings?.countCode || 4) ===
                getCodeForCheck(line.good.shcode, goodBarcodeSettings?.countCode || 4),
            )
          : undefined;

      if (remainsUse && goodRemains.length) {
        if (!good) {
          alertWithSound('Ошибка!', 'Товар не найден.', handleFocus);

          return;
        } else if (good.remains < weight - line.weight) {
          alertWithSound('Внимание!', 'Вес товара превышает вес в остатках.', handleFocus);

          return;
        }
      }

      const newLine: IMoveLine = getUpdatedLine(goodBarcodeSettings, remainsUse, lineBarcode, line, quantity, weight);

      navigation.navigate('SelectCell', { docId: id, item: newLine, mode: 0 });

      // dispatch(documentActions.updateDocumentLine({ docId: id, line: newLine }));
    },
    [goodBarcodeSettings, goodRemains, id, navigation, newwLine, remainsUse],
  );

  const handleEditQuantPack = useCallback(() => {
    if (!isNumeric(quantPack)) {
      alertWithSound('Ошибка!', 'Неправильное количество.', handleFocus);
      return;
    }
    setScanned(false);
    handleAddQuantPack(Number(quantPack));

    setVisibleQuantPackDialog(false);
    setQuantPack('');
    setQuantPallet('');
    Keyboard.dismiss();
    handleFocus();
  }, [handleAddQuantPack, quantPack]);

  const handleDismissQuantPack = () => {
    setScanned(false);

    setVisibleQuantPackDialog(false);
    setQuantPack('');
    setQuantPallet('');
    Keyboard.dismiss();
    handleFocus();
  };

  const handleEditDocHead = useCallback(() => {
    navigation.navigate('MoveToEdit', { id });
  }, [navigation, id]);

  const handleCopyDoc = useCallback(async () => {
    if (!doc) {
      return;
    }
    setScreenState('copying');
    await sleep(1);
    const newId = generateId();

    const newDocDate = new Date().toISOString();

    const docs = docList.filter((i) => i.documentType.name === 'movement');

    const newNumber = getNextDocNumber(docs);

    const newDoc: IMoveDocument = {
      ...doc,
      id: newId,
      number: newNumber,
      status: 'DRAFT',
      documentDate: newDocDate,
      creationDate: newDocDate,
      editionDate: newDocDate,
    };

    docDispatch(documentActions.addDocument(newDoc));
    navigation.navigate('MoveToView', { id: newId });

    setScreenState('copied');
  }, [doc, docList, docDispatch, navigation]);

  const handleDelete = useCallback(() => {
    if (!id) {
      return;
    }

    alertWithSoundMulti(
      'Вы уверены, что хотите удалить документ?',
      '',
      async () => {
        setScreenState('deleting');
        await sleep(1);
        const res = await docDispatch(documentActions.removeDocument(id));
        if (res.type === 'DOCUMENTS/REMOVE_ONE_SUCCESS') {
          setScreenState('deleted');
        } else {
          setScreenState('idle');
        }
      },
      handleFocus,
    );
  }, [docDispatch, id]);

  const hanldeCancelLastScan = useCallback(() => {
    const lastId = doc?.lines?.[0]?.id;
    if (lastId) {
      dispatch(documentActions.removeDocumentLine({ docId: id, lineId: lastId }));
    }
    setScanned(false);
    scheduleScannerFocus();
  }, [dispatch, doc?.lines, id, scheduleScannerFocus]);

  const sendDoc = useSendDocs(doc ? [doc] : [], doc ? [getDocToSend(doc)] : []);

  const sendCellRequest = useSendOneRefRequest('Ячейки', { name: 'cell' });

  const handleSendCellRequest = useCallback(async () => {
    setVisibleDialog(false);
    await sendCellRequest();
  }, [sendCellRequest]);

  const sendRemainsRequest = useSendOneRefRequest('Остатки', { name: 'remains' });

  const handleSendRemainsRequest = useCallback(async () => {
    setVisibleDialog(false);
    await sendRemainsRequest();
  }, [sendRemainsRequest]);

  const handleSendDocument = useCallback(async () => {
    setVisibleSendDialog(false);
    setScreenState('sending');
    await sendDoc();
    if (isAddressStore) {
      await handleSendCellRequest();
    }
    await handleSendRemainsRequest();
    setScreenState('sent');
  }, [handleSendCellRequest, handleSendRemainsRequest, isAddressStore, sendDoc]);

  const actionsMenu = useCallback(() => {
    showActionSheet(
      isBlocked
        ? doc?.status === 'SENT'
          ? [
              {
                title: 'Копировать документ',
                onPress: handleCopyDoc,
              },
              {
                title: 'Отмена',
                type: 'cancel',
              },
            ]
          : [
              {
                title: 'Копировать документ',
                onPress: handleCopyDoc,
              },
              {
                title: 'Удалить документ',
                type: 'destructive',
                onPress: handleDelete,
              },
              {
                title: 'Отмена',
                type: 'cancel',
              },
            ]
        : [
            {
              title: 'Запросить справочник ячеек',
              onPress: handleSendCellRequest,
            },
            {
              title: 'Ввести штрих-код',
              onPress: handleShowDialog,
            },
            {
              title: 'Отменить последнее сканирование',
              onPress: hanldeCancelLastScan,
            },
            {
              title: 'Редактировать данные',
              onPress: handleEditDocHead,
            },
            {
              title: 'Копировать документ',
              onPress: handleCopyDoc,
            },
            {
              title: 'Удалить документ',
              type: 'destructive',
              onPress: handleDelete,
            },
            {
              title: 'Отмена',
              type: 'cancel',
              onPress: handleFocus,
            },
          ],
    );
  }, [
    showActionSheet,
    isBlocked,
    doc?.status,
    handleCopyDoc,
    handleDelete,
    handleSendCellRequest,
    hanldeCancelLastScan,
    handleEditDocHead,
  ]);

  const renderRight = useCallback(
    () =>
      isBlocked ? (
        doc?.status === 'READY' ? (
          <View style={styles.buttons}>
            <SendButton
              onPress={() => setVisibleSendDialog(true)}
              disabled={screenState !== 'idle' || loading || !lines?.length}
            />
            <MenuButton actionsMenu={actionsMenu} disabled={screenState !== 'idle'} />
          </View>
        ) : (
          <MenuButton actionsMenu={actionsMenu} disabled={screenState !== 'idle'} />
        )
      ) : isDelList ? (
        <DeleteButton onPress={handleDeleteLines} />
      ) : (
        <View style={styles.buttons}>
          <SendButton
            onPress={() => setVisibleSendDialog(true)}
            disabled={screenState !== 'idle' || loading || !lines?.length}
          />
          <ScanButton
            onPress={() => (isScanerReader ? handleFocus() : navigation.navigate('ScanGood', { docId: id }))}
            disabled={screenState !== 'idle'}
          />
          <MenuButton actionsMenu={actionsMenu} disabled={screenState !== 'idle'} />
        </View>
      ),
    [
      actionsMenu,
      doc?.status,
      handleDeleteLines,
      id,
      isBlocked,
      isDelList,
      isScanerReader,
      lines?.length,
      loading,
      navigation,
      screenState,
    ],
  );

  const renderLeft = useCallback(
    () => (isDelList ? <CloseButton onPress={clearSelection} /> : navBackButton()),
    [clearSelection, isDelList],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: renderLeft,
      headerRight: renderRight,
      title: isDelList ? `Выделено позиций: ${delList.length}` : '',
    });
  }, [delList.length, isDelList, navigation, renderLeft, renderRight]);

  //////////////////////// Не удалять //////////////////////////////////
  // const linesList = doc.lines?.reduce((sum: IMoveLine[], line) => {
  //   if (!sum.length) {
  //     sum.push(line);
  //   }

  //   if (sum.find((i) => i.id !== line.id)) {
  //     const lineSum = sum.find((i) => i.good.id === line.good.id && i.numReceived === line.numReceived);
  //     if (lineSum) {
  //       const lineTotal: IMoveLine = { ...lineSum, weight: round(lineSum.weight + line.weight) };
  //       sum.splice(sum.indexOf(lineSum), 1, lineTotal);
  //     } else {
  //       sum.push(line);
  //     }
  //   }
  //   return sum;
  // }, []);

  const [lineType, setLineType] = useState(lineTypes[1].id);

  const LineTypes = useCallback(
    () => (
      <View style={styles.containerCenter}>
        {lineTypes.map((e, i) => {
          return (
            <TouchableHighlight
              activeOpacity={0.7}
              underlayColor="#DDDDDD"
              key={e.id}
              style={[
                styles.btnTab,
                i === 0 && styles.firstBtnTab,
                i === lineTypes.length - 1 && styles.lastBtnTab,
                e.id === lineType && { backgroundColor: colors.primary },
                { borderColor: colors.primary },
              ]}
              onPress={() => setLineType(e.id)}
            >
              <LargeText style={{ color: e.id === lineType ? colors.background : colors.text }}>{e.value}</LargeText>
            </TouchableHighlight>
          );
        })}
      </View>
    ),
    [colors.background, colors.primary, colors.text, lineType],
  );

  const renderItem = useCallback(
    ({ item }: { item: IMoveLine }) => {
      const handlers = getLineHandlers(item.id);

      return (
        <LineItem
          item={item}
          checked={handlers.checked}
          onPress={handlers.onPress}
          onLongPress={handlers.onLongPress}
          disabled={
            !isDelList && (doc?.status !== 'DRAFT' || item.sortOrder !== lines?.length || Boolean(item.scannedBarcode))
          }
          isFromAddressed={doc?.head.fromDepart?.isAddressStore}
          isToAddressed={doc?.head.toDepart?.isAddressStore}
        />
      );
    },
    [
      doc?.head.fromDepart?.isAddressStore,
      doc?.head.toDepart?.isAddressStore,
      doc?.status,
      getLineHandlers,
      isDelList,
      lines?.length,
    ],
  );

  const handleErrorMessage = useCallback((visible: boolean, text: string) => {
    if (visible) {
      setErrorMessage(text);
    } else {
      alertWithSound('Внимание!', `${text}.`, handleFocus);
      setScanned(false);
    }
  }, []);

  // const [selectedLine, setSelectedLine] = useState<IMoveLine | undefined>(undefined);
  // const [visiblePalletDialog, setVisiblePalletDialog] = useState(false);

  // const handleAddDocument = useCallback(
  //   (barcodeObj: IMoveLine) => {
  //     // if (!palletType) {
  //     //   handleErrorMessage(visibleDialog, 'Не найден тип документа!');
  //     //   return;
  //     // }
  //     // const doc = list?.[0];
  //     if (!doc) {
  //       return;
  //     }
  //     const isFromAddressed = departs.find((i) => i.id === doc.head.fromDepart?.id && i.isAddressStore);
  //     const isToAddressed = departs.find((i) => i.id === doc.head.toDepart?.id && i.isAddressStore);

  //     if (
  //       doc.head.toDepart?.isAddressStore ||
  //       doc.head.fromDepart?.isAddressStore ||
  //       isFromAddressed ||
  //       isToAddressed
  //     ) {
  //       if (goodBarcodeSettings.boxWeight > barcodeObj.weight) {
  //         setVisibleQuantPackDialog(true);
  //         setNewLine(barcodeObj);
  //         return;
  //       }

  //       navigation.navigate('SelectCell', { docId: id, item: barcodeObj, mode: 0 });
  //     }
  //     setVisiblePalletDialog(false);
  //   },
  //   [departs, doc, goodBarcodeSettings.boxWeight, id, navigation],
  // );

  const getScannedObject = useCallback(
    (brc: string) => {
      if (!doc) {
        return;
      }

      if (doc?.status !== 'DRAFT') {
        return;
      }

      if (isDelList) {
        return;
      }
      // if (barcodeGeneration) {

      //   Alert.alert('!', brc);
      //   return;
      // }

      if (!brc.match(/^-{0,1}\d+$/)) {
        handleErrorMessage(visibleDialog, 'Штрих-код не определён. Повторите сканирование!');
        return;
      }

      if (brc.length < minBarcodeLength) {
        handleErrorMessage(
          visibleDialog,
          'Длина штрих-кода меньше минимальной длины, указанной в настройках. Повторите сканирование!',
        );
        return;
      }

      if (brc.length > maxBarcodeLength) {
        handleErrorMessage(
          visibleDialog,
          'Длина штрих-кода больше максимальной длины, указанной в настройках. Повторите сканирование!',
        );
        return;
      }

      const barc = getBarcode(brc, goodBarcodeSettings);

      const lineGood = getLineGood(
        barc.shcode,
        barc.weight,
        goods,
        goodRemains,
        remainsUse,
        goodBarcodeSettings?.countCode || 4,
      );

      if (!lineGood.good) {
        handleErrorMessage(visibleDialog, 'Товар не найден!');
        return;
      }

      // if (barc.weight < goodBarcodeSettings?.boxWeight) {
      //   handleErrorMessage(visibleDialog, 'Отсканированный товар не является поддоном!');
      //   return;
      // }

      if (!lineGood.isRightWeight) {
        handleErrorMessage(visibleDialog, 'Вес товара превышает вес в остатках!');
        return;
      }

      const line = doc.lines?.find((i) => i.barcode === barc.barcode || i.scannedBarcode === barc.barcode);

      if (line) {
        handleErrorMessage(visibleDialog, 'Данный штрих-код уже добавлен!');
        return;
      }
      // if (wMode) {
      //   const weight = round(doc?.lines?.[0].weight + barc.weight, 3);
      //   const nquantPack = round(doc?.lines?.[0].quantPack + barc.quantPack, 3);
      //   const newObj: IMoveLine = {
      //     ...doc?.lines?.[0],
      //     quantPack: nquantPack,
      //     weight,
      //   };

      //   const newBrc = getBarcodeString({ ...newObj, shcode: newObj.good.shcode }, goodBarcodeSettings);
      //   const newLine: IMoveLine = {
      //     ...newObj,
      //     barcode: newBrc,
      //     // storeMan,
      //   };
      //   dispatch(
      //     documentActions.updateDocumentLine({
      //       docId: doc.id,
      //       line: newLine,
      //     }),
      //   );
      //   if (visibleDialog) {
      //     setVisibleDialog(false);
      //     setErrorMessage('');
      //     setBarcode('');
      //   } else {
      //     setScanned(false);
      //   }
      //   handleFocus();
      //   return;
      // }

      const newLine: IMoveLine = {
        good: lineGood.good,
        id: generateId(),
        weight: barc.weight,
        barcode: barc.barcode,
        workDate: barc.workDate,
        time: barc.time,
        numReceived: barc.numReceived,
        quantPack: barc.quantPack,
        sortOrder: doc.lines?.length + 1,
        usedRemains: remainsUse,
      };
      // if (barcodeGeneration) {
      //   setSelectedLine(newLine);
      //   // handleFocus();
      //   setVisiblePalletDialog(true);
      //   return;
      // }

      const isFromAddressed = departs.find((i) => i.id === doc.head.fromDepart?.id && i.isAddressStore);
      const isToAddressed = departs.find((i) => i.id === doc.head.toDepart?.id && i.isAddressStore);

      if (
        doc.head.toDepart?.isAddressStore ||
        doc.head.fromDepart?.isAddressStore ||
        isFromAddressed ||
        isToAddressed
      ) {
        if (goodBarcodeSettings.boxWeight > newLine.weight) {
          setVisibleQuantPackDialog(true);
          setNewLine(newLine);
          return;
        }

        navigation.navigate('SelectCell', { docId: id, item: newLine, mode: 0 });
      }

      if (visibleDialog) {
        setVisibleDialog(false);
        setErrorMessage('');
        setBarcode('');
      } else {
        setScanned(false);
      }
      handleFocus();

      if (addPalletQuantPack && newLine.weight >= goodBarcodeSettings?.boxWeight) {
        // setIsPack(false);
        setVisibleQuantPackDialog(true);
      }
    },

    [
      doc,
      isDelList,
      minBarcodeLength,
      maxBarcodeLength,
      goodBarcodeSettings,
      goods,
      goodRemains,
      remainsUse,
      departs,
      visibleDialog,
      addPalletQuantPack,
      handleErrorMessage,
      navigation,
      id,
    ],
  );
  // const handleGetBarcode = (obj: IMoveLine) => {
  //   return getBarcodeString({ ...obj, shcode: obj.good.shcode }, goodBarcodeSettings);
  // };

  // const handleContinue = useCallback(
  //   (obj: IMoveLine) => {
  //     if (!doc) {
  //       return;
  //     }
  //     if (!barcodeGeneration) {
  //       return;
  //     }
  //     if (
  //       doc.lines?.[0] &&
  //       ((doc?.head.fromDepart?.isAddressStore && !lines?.[0].fromCell) ||
  //         (doc?.head.toDepart?.isAddressStore && !lines?.[0].toCell))
  //     ) {
  //       // dispatch(documentActions.updateDocumentLine({ docId: doc.id, line: obj }));
  //     } else {
  //       dispatch(documentActions.addDocumentLine({ docId: doc.id, line: obj }));
  //     }
  //     setWmode(true);
  //     setVisiblePalletDialog(false);
  //     if (visibleDialog) {
  //       setVisibleDialog(false);
  //       setErrorMessage('');
  //       setBarcode('');
  //     } else {
  //       setScanned(false);
  //     }
  //     handleFocus();
  //   },
  //   [barcodeGeneration, dispatch, doc, lines, visibleDialog],
  // );

  const handleSearchBarcode = () => {
    getScannedObject(barcode);
  };

  const viewStyle: StyleProp<ViewStyle> = useMemo(
    () => ({ ...styles.container, justifyContent: lineType === 'last' ? 'flex-start' : 'center' }),
    [lineType],
  );

  const [key, setKey] = useState(1);

  const setScan = (brc: string) => {
    setKey(key + 1);
    setScanned(true);
    getScannedObject(brc);
  };

  useEffect(() => {
    if (!visibleDialog && !scanned && ref?.current) {
      scheduleScannerFocus();
    }
  }, [scanned, ref, scheduleScannerFocus, visibleDialog, visibleQuantPackDialog]);

  useEffect(() => {
    if (screenState === 'sent' || screenState === 'deleted' || screenState === 'copied') {
      setScreenState('idle');
      if (screenState !== 'copied') {
        navigation.goBack();
      }
    }
  }, [navigation, screenState]);

  const isEditable = useMemo(() => (doc ? ['DRAFT', 'READY'].includes(doc?.status) : false), [doc]);

  if (!isFocused) {
    return <AppActivityIndicator />;
  }

  if (screenState === 'deleting' || screenState === 'copying' || screenState === 'sending') {
    return (
      <View style={styles.container}>
        <View style={styles.containerCenter}>
          <LargeText>
            {screenState === 'deleting'
              ? 'Удаление документа...'
              : screenState === 'copying'
                ? 'Копирование документа...'
                : 'Отправка документа...'}
          </LargeText>
          <AppActivityIndicator style={{}} />
        </View>
      </View>
    );
  }

  if (!doc) {
    return (
      <View style={[styles.container, styles.alignItemsCenter]}>
        <LargeText>Документ не найден</LargeText>
      </View>
    );
  }

  return (
    <View style={viewStyle}>
      <InfoBlock
        colorLabel={getStatusColor(doc?.status || 'DRAFT')}
        title={doc.head.subtype.name || ''}
        onPress={() => (isEditable ? handleEditDocHead() : setIsDateVisible(!isDateVisible))}
        editable={isEditable}
        disabled={delList.length > 0}
        isBlocked={isBlocked}
      >
        <>
          <MediumText style={styles.rowCenter}>
            {`№ ${doc.number} от ${getDateString(doc.documentDate)}` || ''}
          </MediumText>
          <MediumText style={styles.rowCenter}>Откуда: {doc.head.fromDepart?.name || ''}</MediumText>
          <View style={styles.rowCenter}>
            <MediumText>Куда: {doc.head.toDepart?.name || ''}</MediumText>
          </View>
          {isDateVisible && <DateInfo sentDate={doc.sentDate} erpCreationDate={doc.erpCreationDate} />}
        </>
      </InfoBlock>
      {/* <View style={localStyles.container}>
        <MediumText>Формирование поддона</MediumText>
        <Switch
          value={barcodeGeneration}
          onValueChange={() => setBarcodeGeneration(!barcodeGeneration)}
          // disabled={disabled}
        />
      </View> */}
      <LineTypes />
      <TextInput
        style={styles.scanInput}
        key={key}
        autoFocus={true}
        selectionColor="transparent"
        ref={ref}
        showSoftInputOnFocus={false}
        onChangeText={(text) => !scanned && setScan(text)}
      />
      {lineType === 'all' ? (
        <>
          <FlashList
            data={lines}
            renderItem={renderItem}
            estimatedItemSize={60}
            ItemSeparatorComponent={ItemSeparator}
            keyExtractor={keyExtractor}
            extraData={[lines, isBlocked, delList, isDelList]}
            keyboardShouldPersistTaps={'always'}
          />
          {doc?.lines?.length ? <ViewTotal quantPack={lineSum?.quantPack || 0} weight={lineSum?.weight || 0} /> : null}
        </>
      ) : lineType === 'last' && lines?.[0] ? (
        <View style={styles.spaceBetween}>
          {(() => {
            const handlers = getLineHandlers(lines[0].id);

            return (
              <LineItem
                item={lines[0]}
                checked={handlers.checked}
                onPress={handlers.onPress}
                onLongPress={handlers.onLongPress}
                disabled={!isDelList && (doc?.status !== 'DRAFT' || Boolean(lines[0].scannedBarcode))}
                isFromAddressed={doc?.head.fromDepart?.isAddressStore}
                isToAddressed={doc?.head.toDepart?.isAddressStore}
              />
            );
          })()}
          {doc?.lines?.length ? <ViewTotal quantPack={lineSum?.quantPack || 0} weight={lineSum?.weight || 0} /> : null}
        </View>
      ) : null}
      {/* <PalletDialog
        visible={visiblePalletDialog}
        onCancel={() => setVisiblePalletDialog(false)}
        onOk={handleAddDocument}
        // pallet={selectedPallet}
        storeMan={`${storeMan?.lastName} ${storeMan?.firstName}`}
        palletHead={selectedLine}
        getBarcode={handleGetBarcode}
        onContinue={handleContinue}
      /> */}
      <AppDialog
        title="Введите штрих-код"
        visible={visibleDialog}
        text={barcode}
        onChangeText={setBarcode}
        onCancel={handleDismissBarcode}
        onOk={handleSearchBarcode}
        okLabel={'Найти'}
        errorMessage={errorMessage}
        keyboardType="number-pad"
      />
      <QuantDialog
        visible={visibleQuantPackDialog}
        textPack={quantPack}
        textPallet={quantPallet}
        onChangeTextPack={setQuantPack}
        onChangeTextPallet={setQuantPallet}
        onCancel={handleDismissQuantPack}
        onOk={handleEditQuantPack}
        okLabel={'Ок'}
        isPack={true}
        keyboardType="number-pad"
        okDisabled={!quantPack || (newwLine?.weight || 0) * Number(quantPack) < goodBarcodeSettings.boxWeight}
      />
      <SimpleDialog
        visible={visibleSendDialog}
        title={'Внимание!'}
        text={'Вы уверены, что хотите отправить документ?'}
        onCancel={() => setVisibleSendDialog(false)}
        onOk={handleSendDocument}
        okDisabled={loading}
      />
    </View>
  );
};

// const localStyles = StyleSheet.create({
//   container: {
//     alignItems: 'center',
//     flexDirection: 'row',
//     paddingHorizontal: 12,
//     fontSize: 20,
//     justifyContent: 'space-between',
//     paddingVertical: 3,
//     marginVertical: 6,
//   },
//   settingsContainer: {
//     flexDirection: 'column',
//     paddingTop: 6,
//     width: '100%',
//   },
//   status: {
//     margin: 5,
//     flexDirection: 'row',
//     flexWrap: 'wrap',
//   },
//   title: {
//     margin: 3,
//     textAlign: 'center',
//   },
// });
