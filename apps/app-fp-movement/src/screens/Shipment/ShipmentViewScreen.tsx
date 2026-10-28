import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { View, TouchableHighlight, TextInput, Keyboard, StyleProp, ViewStyle } from 'react-native';
import { RouteProp, useIsFocused, useNavigation, useRoute, useTheme } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import {
  appActions,
  docSelectors,
  documentActions,
  refSelectors,
  useDispatch,
  useDocThunkDispatch,
  useSelector,
} from '@lib/store';
import {
  MenuButton,
  useActionSheet,
  globalStyles as styles,
  InfoBlock,
  ItemSeparator,
  AppActivityIndicator,
  MediumText,
  LargeText,
  BackButton,
  ListItemLine,
  AppDialog,
  SendButton,
  ScanButton,
  SaveDocument,
  SimpleDialog,
  DateInfo,
  PackageButton,
  CloseButton,
  DeleteButton,
} from '@lib/mobile-ui';

import {
  sleep,
  generateId,
  getDateString,
  round,
  useSendDocs,
  useSendOneRefRequest,
  isNumeric,
} from '@lib/mobile-hooks';

import { ScreenState } from '@lib/types';

import { MaterialCommunityIcons } from '@expo/vector-icons';

import { FlashList } from '@shopify/flash-list';

import { DashboardStackParamList } from '@lib/mobile-navigation';

import { barcodeSettings, IBox, IOrderDocument, IShipmentDocument, IShipmentLine, ITempLine } from '../../store/types';

import { ShipmentStackParamList } from '../../navigation/Root/types';

import { useScanSound } from '../../utils/useScanSound';
import { getStatusColor, shipmentLineTypes, SCAN_REFOCUS_DELAY_MS } from '../../utils/constants';

import { IBarcode, IGood, ILabel, IRemains, IRemGood } from '../../store/app/types';
import { useSelector as useFpSelector, fpMovementActions, useDispatch as useFpDispatch } from '../../store/index';

import {
  alertWithSound,
  alertWithSoundMulti,
  getBarcode,
  getCodeForCheck,
  getDocToSend,
  getLineGood,
  getRemGoodListByContact,
  getUpdatedLine,
} from '../../utils/helpers';
import {
  buildMarkingLineFields,
  getMarkingNotFoundMessage,
  isLegacyNumericBarcode,
  isMarkCodeDuplicate,
  isMarkingCode,
  resolveMarkingScan,
  shouldFallbackToLegacyBarcode,
} from '../../utils/markingCodeHelpers';
import ViewTotal from '../../components/ViewTotal';
import QuantDialog from '../../components/QuantDialog';
import BoxDialog from '../../components/BoxDialog';
import BarcodeDialog from '../../components/BarcodeDialog';
import { useLineDeleteMode } from '../../utils/useLineDeleteMode';

const keyExtractor = (item: IShipmentLine | ITempLine) => item.id;

const EMPTY_LABELS: ILabel[] = [];

const ShipmentViewScreen = () => {
  const { colors } = useTheme();
  const showActionSheet = useActionSheet();
  const docDispatch = useDocThunkDispatch();
  const isFocused = useIsFocused();

  const navigation =
    useNavigation<StackNavigationProp<ShipmentStackParamList & DashboardStackParamList, 'ShipmentView'>>();

  const { id, isCurr } = useRoute<RouteProp<ShipmentStackParamList, 'ShipmentView'>>().params;

  const navState = navigation.getState();
  const isDashboard = navState.routes.some((route) => route.name === 'Dashboard');

  const dispatch = useDispatch();
  const fpDispatch = useFpDispatch();
  const settings = useSelector((state) => state.settings?.data);
  const isScanerReader = useSelector((state) => state.settings?.data)?.scannerUse?.data;
  const loading = useSelector((state) => state.app.loading);

  const [lineType, setLineType] = useState(shipmentLineTypes[2].id);

  const shipment = docSelectors.selectByDocId<IShipmentDocument>(id);
  const shipmentLines = useMemo(
    () => (shipment?.lines ? [...shipment.lines].sort((a, b) => (b.sortOrder || 0) - (a.sortOrder || 0)) : []),
    [shipment?.lines],
  );

  const tempOrder = useFpSelector((state) => state.fpMovement.list).find((i) => i.orderId === shipment?.head?.orderId);
  const order = docSelectors.selectByDocId<IOrderDocument>(shipment?.head?.orderId);

  const tempOrderLines = tempOrder?.lines?.filter((i) => i.weight > 0) as ITempLine[];

  const isBlocked = shipment?.status !== 'DRAFT';

  const allowLineDelete = Boolean(settings.allowLineDelete?.data);
  const { delList, isDelList, handleDeleteSelectedLines, getLineHandlers, clearSelection } = useLineDeleteMode({
    allowLineDelete,
    isBlocked,
  });

  const isCattle = useMemo(
    () => (shipmentLines?.length > 0 ? shipmentLines?.[0].good.isCattle : undefined),
    [shipmentLines],
  );

  const shipmentLineSum = shipmentLines?.reduce(
    (sum, line) => {
      return {
        ...sum,
        quantPack: sum.quantPack + (line.flag === '0' ? 1 : line.quantPack || 0),
        weight: sum.weight + (line.weight || 0),
        quantity: sum.quantity + (line.quantity || 0),
      };
    },
    { quantPack: 0, weight: 0, quantity: 0 },
  );

  const tempLineSum = tempOrderLines?.reduce(
    (sum, line) => {
      return { ...sum, weight: sum.weight + (line.weight || 0) };
    },
    { quantPack: 0, weight: 0, quantity: 0 },
  );

  const [visibleDialog, setVisibleDialog] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [visibleQuantPackDialog, setVisibleQuantPackDialog] = useState(false);
  const [quantPack, setQuantPack] = useState('');
  const [quantPallet, setQuantPallet] = useState('');
  const [isPack, setIsPack] = useState(true);

  const [visibleBoxDialog, setVisibleBoxDialog] = useState<boolean>(false);
  const [box, setBox] = useState<IBox | undefined>(undefined);

  const [visibleBarcodeDialog, setVisibleBarcodeDialog] = useState<boolean>(false);
  const [brcLine, setBrcLine] = useState<IShipmentLine | undefined>(undefined);

  useEffect(() => {
    return () => {
      dispatch(appActions.clearScreenFormParams('ShipmentView'));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goods = refSelectors.selectByName<IGood>('good').data;
  const labels = refSelectors.selectByName<ILabel>('label')?.data ?? EMPTY_LABELS;

  const goodBarcodeSettings = Object.entries(settings).reduce((prev: barcodeSettings, [idx, item]) => {
    if (item && item.group?.id !== 'base' && typeof item.data === 'number') {
      prev[idx] = item.data;
    }
    return prev;
  }, {});

  const minBarcodeLength = (settings.minBarcodeLength?.data as number) || 0;
  const maxBarcodeLength = (settings.maxBarcodeLength?.data as number) || 0;

  const addPalletQuantPack = Boolean(settings.addPalletQuantPack?.data);

  const usePackage = Boolean(settings.usePackage?.data);
  const limitDelta = (settings.limitDelta?.data as number) || 0;

  // const docList = useSelector((state) => state.documents.list) as IShipmentDocument[];
  const scanUnit = Boolean(settings.scanUnit?.data);

  const remainsUse = Boolean(settings.remainsUse?.data);

  const remains = refSelectors.selectByName<IRemains>('remains')?.data?.[0];

  const goodRemains = useMemo<IRemGood[]>(() => {
    return shipment?.head?.fromDepart?.id && isFocused && remains
      ? getRemGoodListByContact(goods, remains[shipment.head.fromDepart.id] /*, docList, shipment.head.fromDepart.id*/)
      : [];
  }, [goods, remains, shipment?.head?.fromDepart?.id, isFocused]);

  const playSound = useScanSound(require('../../../assets/ok.wav'));

  const [scanned, setScanned] = useState(false);
  const ref = useRef<TextInput>(null);

  const scheduleScannerFocus = useCallback(() => {
    setTimeout(() => {
      ref.current?.focus();
      ref.current?.clear();
    }, SCAN_REFOCUS_DELAY_MS);
  }, []);

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
    Keyboard.dismiss();
    handleFocus();
  };

  const handleAddQuantPack = useCallback(
    (quantity: number, pallet: number) => {
      const line = shipmentLines?.[0];
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
        flag: line.flag,
      };

      const weight =
        line?.weight >= goodBarcodeSettings?.boxWeight
          ? round(line?.weight * pallet, 3)
          : round(line?.weight * quantity, 3);

      const tempLine = tempOrder?.lines?.find((i) => line.good.id === i.good.id);

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

      if (tempLine && tempOrder) {
        const newTempLine = { ...tempLine, weight: round(tempLine?.weight + line.weight - weight, 3) };
        if (newTempLine.weight >= 0) {
          fpDispatch(
            fpMovementActions.updateTempOrderLine({
              docId: tempOrder?.id,
              line: newTempLine,
            }),
          );
          const newLine: IShipmentLine = getUpdatedLine(
            goodBarcodeSettings,
            remainsUse,
            lineBarcode,
            line,
            line?.weight >= goodBarcodeSettings?.boxWeight ? round(quantity * pallet, 3) : quantity,
            weight,
          );

          dispatch(documentActions.updateDocumentLine({ docId: id, line: newLine }));
        } else {
          alertWithSoundMulti(
            'Данное количество превышает количество в заявке.',
            'Добавить позицию?',
            () => {
              fpDispatch(
                fpMovementActions.updateTempOrderLine({
                  docId: tempOrder?.id,
                  line: newTempLine,
                }),
              );
              const newLine: IShipmentLine = getUpdatedLine(
                goodBarcodeSettings,
                remainsUse,
                lineBarcode,
                line,
                line?.weight >= goodBarcodeSettings?.boxWeight ? round(quantity * pallet, 3) : quantity,
                weight,
              );

              dispatch(documentActions.updateDocumentLine({ docId: id, line: newLine }));
            },
            handleFocus,
          );
        }
      } else {
        const newLine: IShipmentLine = getUpdatedLine(
          goodBarcodeSettings,
          remainsUse,
          lineBarcode,
          line,
          line?.weight >= goodBarcodeSettings?.boxWeight ? round(quantity * pallet, 3) : quantity,
          weight,
        );

        dispatch(documentActions.updateDocumentLine({ docId: id, line: newLine }));
      }
    },
    [dispatch, fpDispatch, goodBarcodeSettings, goodRemains, id, remainsUse, shipmentLines, tempOrder],
  );

  const handleEditQuantPack = useCallback(() => {
    if (!isNumeric(quantPack) || !isNumeric(quantPallet)) {
      alertWithSound('Ошибка!', 'Неправильное количество.', handleFocus);
      return;
    }

    handleAddQuantPack(Number(quantPack), Number(quantPallet));
    setVisibleQuantPackDialog(false);
    setQuantPack('');
    setQuantPallet('');
    Keyboard.dismiss();
    handleFocus();
  }, [handleAddQuantPack, quantPack, quantPallet]);

  const handleDismissQuantPack = () => {
    setVisibleQuantPackDialog(false);
    setQuantPack('');
    setQuantPallet('');
    Keyboard.dismiss();
    handleFocus();
  };

  const handleEditShipmentHead = useCallback(
    () => navigation.navigate('ShipmentEdit', { id, isCurr }),
    [id, isCurr, navigation],
  );

  const handleCopyDoc = useCallback(async () => {
    if (!shipment) {
      return;
    }
    setScreenState('copying');
    await sleep(1);
    const newId = generateId();

    const newDocDate = new Date().toISOString();

    const newDoc: IShipmentDocument = {
      ...shipment,
      id: newId,
      status: 'DRAFT',
      documentDate: newDocDate,
      creationDate: newDocDate,
      editionDate: newDocDate,
    };

    docDispatch(documentActions.addDocument(newDoc));
    navigation.navigate('ShipmentView', { id: newId, isCurr });

    setScreenState('copied');
  }, [shipment, docDispatch, navigation, isCurr]);

  const handleDeleteShipment = useCallback(async () => {
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

        if (tempOrder) {
          dispatch(fpMovementActions.removeTempOrders([tempOrder?.id]));
        }

        if (res.type === 'DOCUMENTS/REMOVE_ONE_SUCCESS') {
          setScreenState('deleted');
        } else {
          setScreenState('idle');
        }
      },
      handleFocus,
    );
  }, [dispatch, docDispatch, id, tempOrder]);

  const restoreTempLine = useCallback(
    (shipmentLine: IShipmentLine) => {
      const tempLine = tempOrder?.lines?.find((i) => shipmentLine.good.id === i.good.id);
      const good = scanUnit ? goods?.find((i) => shipmentLine.good.id === i.id) : undefined;

      if (tempLine && tempOrder) {
        fpDispatch(
          fpMovementActions.updateTempOrderLine({
            docId: tempOrder.id,
            line:
              scanUnit && good && shipmentLine.quantity
                ? { ...tempLine, weight: round(tempLine.weight + shipmentLine.quantity, 3) }
                : {
                    ...tempLine,
                    weight: round(
                      tempLine.weight +
                        (shipmentLine.good.unitWeight && shipmentLine.good.unitWeight !== 1
                          ? round(shipmentLine.weight / shipmentLine.good.unitWeight, 3)
                          : shipmentLine.weight),
                      3,
                    ),
                  },
          }),
        );
      }
    },
    [fpDispatch, goods, scanUnit, tempOrder],
  );

  const handleDeleteLines = useCallback(() => {
    handleDeleteSelectedLines(() => {
      delList.forEach((lineId) => {
        const line = shipmentLines.find((l) => l.id === lineId);
        if (line) {
          restoreTempLine(line);
        }
      });
      dispatch(documentActions.removeDocumentLines({ docId: id, lineIds: delList }));
      clearSelection();
      setScanned(false);
      scheduleScannerFocus();
    });
  }, [
    clearSelection,
    delList,
    dispatch,
    handleDeleteSelectedLines,
    id,
    restoreTempLine,
    scheduleScannerFocus,
    shipmentLines,
  ]);

  const hanldeCancelLastScan = useCallback(() => {
    if (shipmentLines?.length) {
      const shipmentLine = shipmentLines?.[0];
      dispatch(documentActions.removeDocumentLine({ docId: id, lineId: shipmentLine.id }));

      const tempLine = tempOrder?.lines?.find((i) => shipmentLine.good.id === i.good.id);
      const good = scanUnit ? goods?.find((i) => shipmentLine.good.id === i.id) : undefined;
      if (tempLine && tempOrder) {
        fpDispatch(
          fpMovementActions.updateTempOrderLine({
            docId: tempOrder.id,
            line:
              scanUnit && good && shipmentLine.quantity
                ? { ...tempLine, weight: round(tempLine.weight + shipmentLine.quantity, 3) }
                : {
                    ...tempLine,
                    weight: round(
                      tempLine.weight +
                        (shipmentLine.good.unitWeight && shipmentLine.good.unitWeight !== 1
                          ? round(shipmentLine.weight / shipmentLine.good.unitWeight, 3)
                          : shipmentLine.weight),
                      3,
                    ),
                  },
          }),
        );
      }
    }
    setScanned(false);
    scheduleScannerFocus();
  }, [dispatch, fpDispatch, goods, id, scanUnit, scheduleScannerFocus, shipmentLines, tempOrder]);

  const handleSetNewBox = (newBox: IBox) => {
    setBox(newBox);
    setVisibleBoxDialog(false);
    handleFocus();
  };

  const handleCancelBoxDialog = () => {
    setVisibleBoxDialog(false);
    handleFocus();
  };

  const handleAddUnitLine = useCallback(
    async (line: IShipmentLine) => {
      const newLine = box ? { ...line, box } : line;

      const tempLine = tempOrder?.lines?.find((i) => line.good?.id === i.good.id);

      if (tempLine && tempOrder && line.quantity) {
        const newTempLine = { ...tempLine, weight: round(tempLine.weight - line.quantity, 3) };
        if (newTempLine.weight > 0) {
          fpDispatch(
            fpMovementActions.updateTempOrderLine({
              docId: tempOrder?.id,
              line: newTempLine,
            }),
          );
          dispatch(documentActions.addDocumentLine({ docId: id, line: newLine }));
          playSound();
        } else if (newTempLine.weight === 0) {
          fpDispatch(
            fpMovementActions.updateTempOrderLine({
              docId: tempOrder?.id,
              line: newTempLine,
            }),
          );
          dispatch(documentActions.addDocumentLine({ docId: id, line: newLine }));
          playSound();
        } else {
          const currTempLine = tempOrderLines.find((i) => i.id === newTempLine.id);
          const orderLineWeight = order?.lines?.find((i) => i.good.id === newLine.good?.id)?.weight; // текущее количество в заявке
          const delta = orderLineWeight ? round(orderLineWeight * limitDelta) : 0;
          if (limitDelta && delta && currTempLine?.weight && Math.abs(newTempLine.weight) <= delta) {
            dispatch(documentActions.addDocumentLine({ docId: id, line: newLine }));
            fpDispatch(
              fpMovementActions.updateTempOrderLine({
                docId: tempOrder?.id,
                line: newTempLine,
              }),
            );
            playSound();
          } else {
            alertWithSoundMulti(
              'Данное количество превышает количество в заявке.',
              'Добавить позицию?',
              () => {
                dispatch(documentActions.addDocumentLine({ docId: id, line: newLine }));
                fpDispatch(
                  fpMovementActions.updateTempOrderLine({
                    docId: tempOrder?.id,
                    line: newTempLine,
                  }),
                );
                playSound();
              },
              handleFocus,
            );
          }
        }
      } else {
        alertWithSoundMulti(
          'Данный товар отсутствует в позициях заявки.',
          'Добавить позицию?',
          () => {
            dispatch(documentActions.addDocumentLine({ docId: id, line: newLine }));
            playSound();
          },
          handleFocus,
        );
      }
      // dispatch(documentActions.addDocumentLine({ docId: id, line: box ? { ...line, box } : line }));

      if (box && !(box.numReceived && box.workDate)) {
        setBox({ ...box, numReceived: line.numReceived, workDate: line.workDate });
      }

      setVisibleBarcodeDialog(false);

      handleFocus();
    },
    [box, dispatch, fpDispatch, id, limitDelta, order?.lines, playSound, tempOrder, tempOrderLines],
  );

  const handleCancelUnitDialog = () => {
    setVisibleBarcodeDialog(false);
    handleFocus();
  };

  const actionsMenu = useCallback(() => {
    showActionSheet(
      isBlocked
        ? shipment?.status === 'SENT'
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
                onPress: handleDeleteShipment,
              },
              {
                title: 'Отмена',
                type: 'cancel',
              },
            ]
        : [
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
              onPress: handleEditShipmentHead,
            },
            {
              title: 'Копировать документ',
              onPress: handleCopyDoc,
            },
            {
              title: 'Удалить документ',
              type: 'destructive',
              onPress: handleDeleteShipment,
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
    shipment?.status,
    handleCopyDoc,
    handleDeleteShipment,
    hanldeCancelLastScan,
    handleEditShipmentHead,
  ]);

  const [screenState, setScreenState] = useState<ScreenState>('idle');

  const handleSaveDocument = useCallback(() => {
    if (!shipment) {
      return;
    }
    dispatch(
      documentActions.updateDocument({
        docId: id,
        document: { ...shipment, status: 'READY' },
      }),
    );
    navigation.goBack();
  }, [dispatch, id, navigation, shipment]);

  const [visibleSendDialog, setVisibleSendDialog] = useState(false);
  const [visibleRequestDialog, setVisibleRequestDialog] = useState(false);

  const sendDoc = useSendDocs(shipment ? [shipment] : [], shipment ? [getDocToSend(shipment)] : []);

  const sendRemainsRequest = useSendOneRefRequest('Остатки', { name: 'remains' });

  const handleSendRemainsRequest = useCallback(async () => {
    setVisibleDialog(false);
    await sendRemainsRequest();
  }, [sendRemainsRequest]);

  const handleSendRequest = useCallback(async () => {
    setVisibleRequestDialog(false);
    await sendRemainsRequest();
  }, [sendRemainsRequest]);

  const handleSendDocument = useCallback(async () => {
    setVisibleSendDialog(false);
    setScreenState('sending');
    await sendDoc();

    await handleSendRemainsRequest();
    setScreenState('sent');
  }, [handleSendRemainsRequest, sendDoc]);

  const renderRight = useCallback(
    () =>
      isBlocked ? (
        shipment?.status === 'READY' ? (
          <View style={styles.buttons}>
            <SendButton
              onPress={() => setVisibleSendDialog(true)}
              disabled={screenState !== 'idle' || loading || !shipmentLines?.length}
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
          {shipment?.status === 'DRAFT' && (
            <SaveDocument onPress={handleSaveDocument} disabled={screenState !== 'idle'} />
          )}
          <SendButton
            onPress={() => setVisibleSendDialog(true)}
            disabled={screenState !== 'idle' || loading || !shipmentLines?.length}
          />

          <ScanButton
            onPress={() => (isScanerReader ? handleFocus() : navigation.navigate('ScanGood', { docId: id, isCurr }))}
            disabled={screenState !== 'idle'}
          />
          {usePackage && (
            <PackageButton
              onPress={() => (box ? setBox(undefined) : setVisibleBoxDialog(true))}
              iconColor={box ? 'red' : undefined}
              disabled={screenState !== 'idle'}
            />
          )}
          <MenuButton actionsMenu={actionsMenu} disabled={screenState !== 'idle'} />
        </View>
      ),
    [
      actionsMenu,
      box,
      handleDeleteLines,
      handleSaveDocument,
      id,
      isBlocked,
      isCurr,
      isDelList,
      isScanerReader,
      loading,
      navigation,
      screenState,
      shipment?.status,
      shipmentLines?.length,
      usePackage,
    ],
  );

  const renderLeft = useCallback(
    () =>
      isDelList ? (
        <CloseButton onPress={clearSelection} />
      ) : (
        <BackButton
          onPress={() =>
            isDashboard ? navigation.goBack() : navigation.navigate(isCurr ? 'CurrShipmentList' : 'ShipmentList')
          }
        />
      ),
    [clearSelection, isCurr, isDashboard, isDelList, navigation],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: renderLeft,
      headerRight: renderRight,
      title: isDelList ? `Выделено позиций: ${delList.length}` : '',
    });
  }, [delList.length, isDelList, navigation, renderLeft, renderRight]);

  const [isDateVisible, setIsDateVisible] = useState(false);

  const handleErrorMessage = useCallback((visible: boolean, text: string) => {
    if (visible) {
      setErrorMessage(text);
    } else {
      alertWithSound('Внимание!', `${text}.`, handleFocus);
      setScanned(false);
    }
  }, []);

  const getScannedObject = useCallback(
    (brc: string) => {
      if (!shipment) {
        return;
      }

      if (shipment?.status !== 'DRAFT') {
        return;
      }

      if (isDelList) {
        return;
      }

      if (!isLegacyNumericBarcode(brc)) {
        const markingResult = resolveMarkingScan({
          rawCode: brc,
          labels,
          goods,
          goodRemains,
          remainsUse,
        });

        if (markingResult.kind === 'not_found') {
          if (!shouldFallbackToLegacyBarcode(brc, markingResult)) {
            const message = isMarkingCode(brc)
              ? getMarkingNotFoundMessage(markingResult.reason)
              : 'Штрих-код не определён. Повторите сканирование!';
            handleErrorMessage(visibleDialog, message);
            setScanned(false);
            return;
          }
        } else if (markingResult.kind === 'found') {
          const { good: lineGood, markCode, label, isRightWeight } = markingResult;
          const isGoodCattle = lineGood.isCattle;

          if (isCattle === 1 && !isGoodCattle) {
            handleErrorMessage(visibleDialog, 'Товар не относится к группе КРС!');
            return;
          } else if (isCattle === 0 && isGoodCattle) {
            handleErrorMessage(visibleDialog, 'Товар относится к группе КРС!');
            return;
          }

          if (!isRightWeight) {
            handleErrorMessage(visibleDialog, 'Вес товара превышает вес в остатках!');
            return;
          }

          if (isMarkCodeDuplicate(markCode, shipmentLines)) {
            handleErrorMessage(visibleDialog, 'Данный код маркировки уже добавлен!');
            return;
          }

          const tempLine = tempOrder?.lines?.find((i) => lineGood.id === i.good.id);

          const shipmentLine: IShipmentLine = {
            ...buildMarkingLineFields({
              label,
              labels,
              good: lineGood,
              sortOrder: (shipmentLines?.length || 0) + 1,
              remainsUse,
            }),
            id: generateId(),
            quantity: 0,
          };

          const boxLine = box
            ? shipmentLines?.find(
                (i) =>
                  i.box?.id === box?.id &&
                  (i.good.id !== shipmentLine.good.id || i.numReceived !== shipmentLine.numReceived),
              )
            : null;

          if (boxLine) {
            handleErrorMessage(
              visibleDialog,
              'Нельзя поместить разные товары или товары с разными партиями в одну коробку!',
            );
            return;
          }

          const newLine = box ? { ...shipmentLine, box } : shipmentLine;

          if (tempLine && tempOrder) {
            const markingWeight = shipmentLine.weight;
            const newTempLine = {
              ...tempLine,
              weight: round(
                lineGood.unitWeight && lineGood.unitWeight !== 1
                  ? tempLine.weight - round(markingWeight / lineGood.unitWeight, 3)
                  : tempLine.weight - newLine.weight,
                3,
              ),
            };
            if (newTempLine.weight > 0) {
              fpDispatch(
                fpMovementActions.updateTempOrderLine({
                  docId: tempOrder?.id,
                  line: newTempLine,
                }),
              );
              dispatch(documentActions.addDocumentLine({ docId: id, line: newLine }));
              playSound();
            } else if (newTempLine.weight === 0) {
              fpDispatch(
                fpMovementActions.updateTempOrderLine({
                  docId: tempOrder?.id,
                  line: newTempLine,
                }),
              );
              dispatch(documentActions.addDocumentLine({ docId: id, line: newLine }));
              playSound();
            } else {
              const currTempLine = tempOrder?.lines?.find((i) => i.id === newTempLine.id);
              const orderLineWeight = order?.lines?.find((i) => i.good.id === lineGood.id)?.weight;
              const delta = orderLineWeight ? round(orderLineWeight * limitDelta) : 0;
              if (limitDelta && delta && currTempLine?.weight && Math.abs(newTempLine.weight) <= delta) {
                dispatch(documentActions.addDocumentLine({ docId: id, line: newLine }));
                fpDispatch(
                  fpMovementActions.updateTempOrderLine({
                    docId: tempOrder?.id,
                    line: newTempLine,
                  }),
                );
                playSound();
              } else {
                alertWithSoundMulti(
                  'Данное количество превышает количество в заявке.',
                  'Добавить позицию?',
                  () => {
                    dispatch(documentActions.addDocumentLine({ docId: id, line: newLine }));
                    fpDispatch(
                      fpMovementActions.updateTempOrderLine({
                        docId: tempOrder?.id,
                        line: newTempLine,
                      }),
                    );
                    playSound();
                  },
                  handleFocus,
                );
              }
            }
          } else {
            alertWithSoundMulti(
              'Данный товар отсутствует в позициях заявки.',
              'Добавить позицию?',
              () => {
                dispatch(documentActions.addDocumentLine({ docId: id, line: newLine }));
                playSound();
              },
              handleFocus,
            );
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
            setIsPack(false);
            setVisibleQuantPackDialog(true);
          }

          return;
        }
      }

      if (scanUnit && brc.length === 13) {
        const goodRem = goodRemains.find((item) => item.good.shcode === brc);
        if (!goodRem) {
          setVisibleRequestDialog(true);
          setScanned(false);
          return;
        }

        /////////////////////////////////////////////////////////////
        // if (good.remains >= weight) {
        //   handleErrorMessage(visibleDialog, 'Вес товара превышает вес в остатках!');
        //   return;
        // }

        const good = goods.find((item) => item.shcode === brc && item.isUnit);
        if (!good) {
          handleErrorMessage(visibleDialog, 'Товар не является штучным. Проверьте товар в справочнике!');
          return;
        }

        const newLine: IShipmentLine = {
          good: {
            id: good.id,
            name: good.name,
            shcode: good.shcode,
            isCattle: good?.isCattle,
            goodGroupId: good?.goodGroupId,
            isUnit: Boolean(good?.isUnit),
            unitWeight: good.unitWeight,
          },
          id: generateId(),
          quantity: 0,
          barcode: brc,
          workDate: '',
          numReceived: '',
          sortOrder: shipment?.lines?.length + 1,
          usedRemains: remainsUse,
          quantPack: 0,
          weight: goodRem.remains,
          unitWeight: good.unitWeight,
        };

        setBrcLine(newLine);
        if (visibleDialog) {
          setVisibleDialog(false);
          setErrorMessage('');
          setBarcode('');
        } else {
          setScanned(false);
        }

        setVisibleBarcodeDialog(true);
        handleFocus();
        return;
      }

      if (!scanUnit && brc.length < minBarcodeLength) {
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
        setVisibleRequestDialog(true);
        setScanned(false);
        return;
      }

      const isGoodCattle = lineGood.good.isCattle;

      if (isCattle === 1 && !isGoodCattle) {
        handleErrorMessage(visibleDialog, 'Товар не относится к группе КРС!');

        return;
      } else if (isCattle === 0 && isGoodCattle) {
        handleErrorMessage(visibleDialog, 'Товар относится к группе КРС!');

        return;
      }

      if (!lineGood.isRightWeight) {
        handleErrorMessage(visibleDialog, 'Вес товара превышает вес в остатках!');
        return;
      }

      const line = shipmentLines?.find((i) => i.barcode === barc.barcode || i.scannedBarcode === barc.barcode);

      if (line) {
        handleErrorMessage(visibleDialog, 'Данный штрих-код уже добавлен!');
        return;
      }

      const tempLine = tempOrder?.lines?.find((i) => lineGood.good?.id === i.good.id);

      const shipmentLine: IShipmentLine = {
        good: lineGood.good,
        id: generateId(),
        weight: barc.weight,
        barcode: barc.barcode,
        workDate: barc.workDate,
        numReceived: barc.numReceived,
        time: barc.time,
        quantPack: barc.quantPack,
        sortOrder: (shipmentLines?.length || 0) + 1,
        usedRemains: remainsUse,
        flag: barc.flag,
      };

      const boxLine = box
        ? shipmentLines?.find(
            (i) => i.box?.id === box?.id && (i.good.id !== newLine.good.id || i.numReceived !== newLine.numReceived),
          )
        : null;

      if (boxLine) {
        handleErrorMessage(
          visibleDialog,
          'Нельзя поместить разные товары или товары с разными партиями в одну коробку!',
        );
        return;
      }

      const newLine = box ? { ...shipmentLine, box } : shipmentLine;

      if (tempLine && tempOrder) {
        const newTempLine = {
          ...tempLine,
          weight: round(
            lineGood.good.unitWeight && lineGood.good.unitWeight !== 1
              ? tempLine.weight - round(barc.weight / lineGood.good.unitWeight, 3)
              : tempLine.weight - newLine.weight,
            3,
          ),
        }; // новое количество в заявке
        if (newTempLine.weight > 0) {
          fpDispatch(
            fpMovementActions.updateTempOrderLine({
              docId: tempOrder?.id,
              line: newTempLine,
            }),
          );
          dispatch(documentActions.addDocumentLine({ docId: id, line: newLine }));
          playSound();
        } else if (newTempLine.weight === 0) {
          fpDispatch(
            fpMovementActions.updateTempOrderLine({
              docId: tempOrder?.id,
              line: newTempLine,
            }),
          );
          dispatch(documentActions.addDocumentLine({ docId: id, line: newLine }));
          playSound();
        } else {
          const currTempLine = tempOrder?.lines?.find((i) => i.id === newTempLine.id); // текущее количество в заявке
          const orderLineWeight = order?.lines?.find((i) => i.good.id === lineGood.good?.id)?.weight; // текущее количество в заявке
          const delta = orderLineWeight ? round(orderLineWeight * limitDelta) : 0;
          if (limitDelta && delta && currTempLine?.weight && Math.abs(newTempLine.weight) <= delta) {
            dispatch(documentActions.addDocumentLine({ docId: id, line: newLine }));
            fpDispatch(
              fpMovementActions.updateTempOrderLine({
                docId: tempOrder?.id,
                line: newTempLine,
              }),
            );
            playSound();
          } else {
            alertWithSoundMulti(
              'Данное количество превышает количество в заявке.',
              'Добавить позицию?',
              () => {
                dispatch(documentActions.addDocumentLine({ docId: id, line: newLine }));
                fpDispatch(
                  fpMovementActions.updateTempOrderLine({
                    docId: tempOrder?.id,
                    line: newTempLine,
                  }),
                );
                playSound();
              },
              handleFocus,
            );
          }
        }
      } else {
        alertWithSoundMulti(
          'Данный товар отсутствует в позициях заявки.',
          'Добавить позицию?',
          () => {
            dispatch(documentActions.addDocumentLine({ docId: id, line: newLine }));
            playSound();
          },
          handleFocus,
        );
      }

      if (box && !(box.numReceived && box.workDate)) {
        setBox({ ...box, numReceived: newLine.numReceived, workDate: box.workDate });
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
        setIsPack(false);
        setVisibleQuantPackDialog(true);
      }
    },

    [
      shipment,
      isDelList,
      scanUnit,
      labels,
      minBarcodeLength,
      maxBarcodeLength,
      goodBarcodeSettings,
      goods,
      goodRemains,
      remainsUse,
      isCattle,
      shipmentLines,
      tempOrder,
      box,
      visibleDialog,
      addPalletQuantPack,
      handleErrorMessage,
      fpDispatch,
      dispatch,
      id,
      playSound,
      order?.lines,
      limitDelta,
    ],
  );

  const handleSearchBarcode = () => {
    getScannedObject(barcode);
  };

  //Для отрисовки при каждом новом сканировании
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
  }, [scanned, ref, scheduleScannerFocus, visibleDialog]);

  useEffect(() => {
    if (screenState === 'sent' || screenState === 'deleted' || screenState === 'copied') {
      setScreenState('idle');
      if (screenState !== 'copied') {
        navigation.goBack();
      }
    }
  }, [navigation, screenState]);

  const LineTypes = useCallback(
    () => (
      <View style={styles.containerCenter}>
        {shipmentLineTypes.map((e, i) => {
          return (
            <TouchableHighlight
              activeOpacity={0.7}
              underlayColor="#DDDDDD"
              key={e.id}
              style={[
                styles.btnTab,
                i === 0 && styles.firstBtnTab,
                i === shipmentLineTypes.length - 1 && styles.lastBtnTab,
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

  const handlePressLine = useCallback(
    (weight: number) => {
      setQuantPack('');
      setQuantPallet('1');
      setVisibleQuantPackDialog(true);
      weight >= goodBarcodeSettings?.boxWeight ? setIsPack(false) : setIsPack(true);
    },
    [goodBarcodeSettings?.boxWeight],
  );

  const renderShipmentItem = useCallback(
    ({ item }: { item: IShipmentLine }) => {
      const handlers = getLineHandlers(item.id, () => handlePressLine(item.weight));

      return (
        <ListItemLine
          readonly={
            !isDelList &&
            (shipment?.status !== 'DRAFT' ||
              scanUnit ||
              item?.sortOrder !== shipmentLines?.length ||
              Boolean(item.scannedBarcode))
          }
          checked={handlers.checked}
          onPress={handlers.onPress}
          onLongPress={handlers.onLongPress}
        >
          <View style={styles.details}>
            <LargeText style={styles.textBold}>{item.good.name}</LargeText>
            <View style={styles.flexDirectionRow}>
              <MaterialCommunityIcons name="shopping-outline" size={18} />
              <MediumText>
                {item.good.isUnit ? `${(item.quantity || 0).toString()} шт.` : `${(item.weight || 0).toString()} кг`}
                {item.good.unitWeight && item.good.unitWeight !== 1
                  ? `, ${round(item.weight / item.good.unitWeight, 3).toString()} шт.`
                  : ''}
                {item.good.isUnit
                  ? `, ${round((item.unitWeight || 0) * (item.quantity || 0), 3)} кг`
                  : item.flag
                    ? item.flag === '1' || item.flag === '0'
                      ? `, ${(item.quantPack || 0).toString()} уп.`
                      : ''
                    : `, ${(item.quantPack || 0).toString()} кор.`}
                {/* {(item.weight || 0).toString()} кг, {(item.quantPack || 0).toString()} кор. */}
              </MediumText>
            </View>
            <View style={styles.flexDirectionRow}>
              <MediumText>
                Партия № {item.numReceived || ''} от {getDateString(item.workDate) || ''}
              </MediumText>
            </View>
          </View>
        </ListItemLine>
      );
    },
    [getLineHandlers, handlePressLine, isDelList, scanUnit, shipment?.status, shipmentLines?.length],
  );

  const renderTempItem = useCallback(
    ({ item }: { item: ITempLine }) => {
      const good = goods.find((i) => i.id === item.good.id && i.unitWeight && i.unitWeight !== 1);
      // const good = scanUnit ? goods.find((i) => i.id === item.good.id && i.isUnit) : undefined;
      return (
        <ListItemLine key={item.id} readonly={true}>
          <View style={styles.details}>
            <LargeText style={styles.textBold}>{item.good.name}</LargeText>
            <View style={styles.directionRow}>
              {
                /*scanUnit &&*/ good ? (
                  <MediumText>Количество: {(item.weight || 0).toString()} шт.</MediumText>
                ) : (
                  <MediumText>Вес: {(item.weight || 0).toString()} кг</MediumText>
                )
              }
            </View>
          </View>
        </ListItemLine>
      );
    },
    [goods],
  );

  const LastLine = useMemo(() => renderShipmentItem, [renderShipmentItem]);

  const isEditable = useMemo(() => (shipment ? ['DRAFT', 'READY'].includes(shipment?.status) : false), [shipment]);

  const viewStyle: StyleProp<ViewStyle> = useMemo(
    () => ({ ...styles.container, justifyContent: lineType === 'last' ? 'flex-start' : 'center' }),
    [lineType],
  );

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

  if (!shipment) {
    return (
      <View style={[styles.container, styles.alignItemsCenter]}>
        <LargeText>Документ не найден</LargeText>
      </View>
    );
  }

  return (
    <View style={viewStyle}>
      <InfoBlock
        colorLabel={getStatusColor(shipment?.status || 'DRAFT')}
        title={shipment.documentType.description || ''}
        onPress={() => (isEditable ? handleEditShipmentHead() : setIsDateVisible(!isDateVisible))}
        editable={isEditable}
        disabled={delList.length > 0}
        isBlocked={isBlocked}
      >
        <View style={styles.infoBlock}>
          <MediumText>{shipment.head.outlet?.name || ''}</MediumText>
          <MediumText>{`№ ${shipment.number} на ${getDateString(shipment.head?.onDate)}`}</MediumText>
          {isDateVisible && <DateInfo sentDate={shipment.sentDate} erpCreationDate={shipment.erpCreationDate} />}
        </View>
      </InfoBlock>
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
      {lineType === 'shipment' ? (
        <>
          <FlashList
            key={lineType}
            data={shipmentLines}
            renderItem={renderShipmentItem}
            estimatedItemSize={60}
            ItemSeparatorComponent={ItemSeparator}
            keyExtractor={keyExtractor}
            extraData={[shipmentLines, isBlocked, delList, isDelList]}
            keyboardShouldPersistTaps={'always'}
          />
          <ViewTotal
            quantPack={shipmentLineSum?.quantPack}
            weight={shipmentLineSum?.weight || 0}
            quantity={shipmentLineSum?.quantity || 0}
          />
        </>
      ) : lineType === 'order' ? (
        <>
          <FlashList
            key={lineType}
            data={tempOrderLines}
            renderItem={renderTempItem}
            estimatedItemSize={60}
            ItemSeparatorComponent={ItemSeparator}
            keyExtractor={keyExtractor}
            extraData={[tempOrderLines, isBlocked]}
            keyboardShouldPersistTaps={'always'}
          />
          <ViewTotal weight={tempLineSum?.weight || 0} />
        </>
      ) : lineType === 'last' && shipmentLines?.[0] ? (
        <View style={styles.spaceBetween}>
          <LastLine item={shipmentLines?.[0]} />
          <ViewTotal
            quantPack={shipmentLineSum?.quantPack}
            weight={shipmentLineSum?.weight || 0}
            quantity={shipmentLineSum?.quantity || 0}
          />
        </View>
      ) : null}
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
        isPack={isPack}
        keyboardType="number-pad"
        okDisabled={!quantPack || !quantPallet}
      />
      {usePackage && (
        <BoxDialog
          visible={visibleBoxDialog}
          onCancel={handleCancelBoxDialog}
          onOk={handleSetNewBox}
          okLabel={'Ок'}
          keyboardType="number-pad"
          okDisabled={!quantPack || !quantPallet}
          screenName="ShipmentView"
          lastBox={shipmentLines?.[0]?.box || undefined}
        />
      )}
      {scanUnit && (
        <BarcodeDialog
          visible={visibleBarcodeDialog}
          onCancel={handleCancelUnitDialog}
          onOk={handleAddUnitLine}
          okLabel={'Ок'}
          keyboardType="number-pad"
          okDisabled={!quantPack || !quantPallet}
          screenName="ShipmentView"
          line={brcLine}
          box={box}
          remainsUse={remainsUse}
        />
      )}
      <SimpleDialog
        visible={visibleSendDialog}
        title={'Внимание!'}
        text={'Сформировано полностью?'}
        onCancel={() => setVisibleSendDialog(false)}
        onOk={handleSendDocument}
        okDisabled={loading}
      />
      <SimpleDialog
        visible={visibleRequestDialog}
        title={'Внимание!'}
        text={'Товар не найден. Отправить запрос за остатками?'}
        onCancel={() => setVisibleRequestDialog(false)}
        onOk={handleSendRequest}
        okDisabled={loading}
      />
    </View>
  );
};

export default ShipmentViewScreen;
