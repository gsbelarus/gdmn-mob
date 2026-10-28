import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { View, TextInput, Keyboard, TouchableHighlight, StyleProp, ViewStyle } from 'react-native';
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
  AppDialog,
  LargeText,
  ScanButton,
  navBackButton,
  SaveDocument,
  SimpleDialog,
  DateInfo,
  CloseButton,
  DeleteButton,
} from '@lib/mobile-ui';

import { generateId, getDateString, keyExtractor, useSendDocs, sleep, round, isNumeric } from '@lib/mobile-hooks';

import { ScreenState } from '@lib/types';

import { FlashList } from '@shopify/flash-list';

import { DashboardStackParamList } from '@lib/mobile-navigation';

import { barcodeSettings, IInventoryDocument, IInventoryLine } from '../../store/types';
import { InventoryStackParamList } from '../../navigation/Root/types';
import { useScanSound } from '../../utils/useScanSound';
import { getStatusColor, lineTypes, SCAN_REFOCUS_DELAY_MS } from '../../utils/constants';

import {
  alertWithSound,
  alertWithSoundMulti,
  getBarcode,
  getCodeForCheck,
  getDocToSend,
  getNextDocNumber,
  getUpdatedLine,
} from '../../utils/helpers';
import { IAddressStoreEntity, IBarcode, IGood, ILabel } from '../../store/app/types';

import ViewTotal from '../../components/ViewTotal';
import QuantDialog from '../../components/QuantDialog';
import LineItem from '../../components/LineItem';
import {
  buildMarkingLineFields,
  getMarkingNotFoundMessage,
  isLegacyNumericBarcode,
  isMarkCodeDuplicate,
  isMarkingCode,
  resolveMarkingScan,
  shouldFallbackToLegacyBarcode,
} from '../../utils/markingCodeHelpers';
import { useLineDeleteMode } from '../../utils/useLineDeleteMode';

const EMPTY_LABELS: ILabel[] = [];

export interface IScanerObject {
  item?: IInventoryLine;
  barcode: string;
  state: 'scan' | 'added' | 'notFound';
}

export const InventoryViewScreen = () => {
  const showActionSheet = useActionSheet();
  const dispatch = useDispatch();
  const docDispatch = useDocThunkDispatch();
  const navigation =
    useNavigation<StackNavigationProp<InventoryStackParamList & DashboardStackParamList, 'InventoryView'>>();

  const { colors } = useTheme();

  const id = useRoute<RouteProp<InventoryStackParamList, 'InventoryView'>>().params?.id;
  const doc = docSelectors.selectByDocId<IInventoryDocument>(id);
  const isScanerReader = useSelector((state) => state.settings?.data)?.scannerUse?.data;

  const lines = useMemo(
    () => (doc?.lines ? [...doc.lines].sort((a, b) => (b.sortOrder || 0) - (a.sortOrder || 0)) : undefined),
    [doc?.lines],
  );
  const lineSum = lines?.reduce(
    (sum, line) => {
      return {
        ...sum,
        quantPack: sum.quantPack + (line.flag === '0' ? 1 : line.quantPack || 0),
        weight: sum.weight + (line.weight || 0),
      };
    },
    { quantPack: 0, weight: 0 },
  );

  const isBlocked = doc?.status !== 'DRAFT';

  const goods = refSelectors.selectByName<IGood>('good').data;
  const labels = refSelectors.selectByName<ILabel>('label')?.data ?? EMPTY_LABELS;
  const settings = useSelector((state) => state.settings?.data);
  const allowLineDelete = Boolean(settings.allowLineDelete?.data);
  const { delList, isDelList, handleDeleteSelectedLines, getLineHandlers, clearSelection } = useLineDeleteMode({
    allowLineDelete,
    isBlocked,
  });
  const loading = useSelector((state) => state.app.loading);
  const goodBarcodeSettings = Object.entries(settings).reduce((prev: barcodeSettings, [idx, item]) => {
    if (item && item.group?.id !== 'base' && typeof item.data === 'number') {
      prev[idx] = item.data;
    }
    return prev;
  }, {});

  const minBarcodeLength = (settings.minBarcodeLength?.data as number) || 0;
  const maxBarcodeLength = (settings.maxBarcodeLength?.data as number) || 0;

  const addPalletQuantPack = Boolean(settings.addPalletQuantPack?.data);

  const docList = useSelector((state) => state.documents.list).filter(
    (i) => i.documentType.name === 'inventory',
  ) as IInventoryDocument[];

  const [screenState, setScreenState] = useState<ScreenState>('idle');
  const [visibleDialog, setVisibleDialog] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [visibleQuantPackDialog, setVisibleQuantPackDialog] = useState(false);
  const [quantPack, setQuantPack] = useState('');
  const [quantPallet, setQuantPallet] = useState('');
  const [isPack, setIsPack] = useState(true);

  const departs = refSelectors.selectByName<IAddressStoreEntity>('depart').data;

  const playSound = useScanSound(require('../../../assets/ok.wav'));

  const [scanned, setScanned] = useState(false);
  const ref = useRef<TextInput>(null);

  const scheduleScannerFocus = useCallback(() => {
    setTimeout(() => {
      ref.current?.focus();
      ref.current?.clear();
    }, SCAN_REFOCUS_DELAY_MS);
  }, []);

  const handleDeleteLines = useCallback(() => {
    handleDeleteSelectedLines(() => {
      dispatch(documentActions.removeDocumentLines({ docId: id, lineIds: delList }));
      clearSelection();
      setScanned(false);
      scheduleScannerFocus();
    });
  }, [clearSelection, delList, dispatch, handleDeleteSelectedLines, id, scheduleScannerFocus]);

  const handleFocus = () => {
    ref?.current?.focus();
  };

  const handleShowDialog = () => {
    setVisibleDialog(true);
  };

  const handleDismissBarcode = () => {
    setVisibleDialog(false);
    setBarcode('');
    setErrorMessage('');
    Keyboard.dismiss();
    handleFocus();
  };

  const isFromAddressed = departs.find((i) => i.id === doc?.head.fromDepart?.id && i.isAddressStore);

  const isAddressedDoc = doc?.head.fromDepart?.isAddressStore || isFromAddressed;

  const handleAddQuantPack = useCallback(
    (quantity: number, pallet: number) => {
      const line = lines?.[0];
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
      if (!isAddressedDoc) {
        const weight =
          line?.weight >= goodBarcodeSettings?.boxWeight
            ? round(line?.weight * pallet, 3)
            : round(line?.weight * quantity, 3);

        const newLine: IInventoryLine = getUpdatedLine(
          goodBarcodeSettings,
          false,
          lineBarcode,
          line,
          line?.weight >= goodBarcodeSettings?.boxWeight ? round(quantity * pallet, 3) : quantity,
          weight,
        );

        dispatch(documentActions.updateDocumentLine({ docId: id, line: newLine }));
      }
    },
    [dispatch, goodBarcodeSettings, id, isAddressedDoc, lines],
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

  const handleEditDocHead = useCallback(() => {
    navigation.navigate('InventoryEdit', { id });
  }, [navigation, id]);

  const handleCopyDoc = useCallback(async () => {
    if (!doc) {
      return;
    }
    setScreenState('copying');
    await sleep(1);
    const newId = generateId();

    const newDocDate = new Date().toISOString();

    const newNumber = getNextDocNumber(docList);

    const newDoc: IInventoryDocument = {
      ...doc,
      id: newId,
      number: newNumber,
      status: 'DRAFT',
      documentDate: newDocDate,
      creationDate: newDocDate,
      editionDate: newDocDate,
    };

    docDispatch(documentActions.addDocument(newDoc));
    navigation.navigate('InventoryView', { id: newId });

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
    handleFocus();
  }, [docDispatch, id]);

  const hanldeCancelLastScan = useCallback(() => {
    if (lines?.length) {
      dispatch(documentActions.removeDocumentLine({ docId: id, lineId: lines[0].id }));
    }
    setScanned(false);
    scheduleScannerFocus();
  }, [dispatch, id, lines, scheduleScannerFocus]);

  const sendDoc = useSendDocs(doc ? [doc] : [], doc ? [getDocToSend(doc)] : []);

  const [visibleSendDialog, setVisibleSendDialog] = useState(false);

  const handleSendDocument = useCallback(async () => {
    setVisibleSendDialog(false);
    setScreenState('sending');
    await sendDoc();
    setScreenState('sent');
  }, [sendDoc]);

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
  }, [showActionSheet, isBlocked, doc?.status, handleCopyDoc, handleDelete, hanldeCancelLastScan, handleEditDocHead]);

  const handleSaveDocument = useCallback(() => {
    if (!doc) {
      return;
    }
    dispatch(
      documentActions.updateDocument({
        docId: id,
        document: { ...doc, status: 'READY' },
      }),
    );
    navigation.goBack();
  }, [dispatch, id, navigation, doc]);

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
          {doc?.status === 'DRAFT' && <SaveDocument onPress={handleSaveDocument} disabled={screenState !== 'idle'} />}
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
      handleSaveDocument,
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

  const handlePressLine = useCallback(
    (weight: number) => {
      setQuantPack('');
      setQuantPallet('1');
      setVisibleQuantPackDialog(true);
      weight >= goodBarcodeSettings?.boxWeight ? setIsPack(false) : setIsPack(true);
    },
    [goodBarcodeSettings?.boxWeight],
  );

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
    ({ item }: { item: IInventoryLine }) => {
      const handlers = getLineHandlers(item.id, () => handlePressLine(item.weight));

      return (
        <LineItem
          item={item}
          checked={handlers.checked}
          onPress={handlers.onPress}
          onLongPress={handlers.onLongPress}
          disabled={
            !isDelList && (doc?.status !== 'DRAFT' || item.sortOrder !== lines?.length || Boolean(item.scannedBarcode))
          }
          isToAddressed={doc?.head.fromDepart?.isAddressStore}
        />
      );
    },
    [doc?.head.fromDepart?.isAddressStore, doc?.status, getLineHandlers, handlePressLine, isDelList, lines?.length],
  );

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
      if (!doc) {
        return;
      }

      if (doc?.status !== 'DRAFT') {
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
          goodRemains: [],
          remainsUse: false,
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
          const { good: lineGood, markCode, label } = markingResult;

          if (isMarkCodeDuplicate(markCode, doc?.lines)) {
            handleErrorMessage(visibleDialog, 'Данный код маркировки уже добавлен!');
            return;
          }

          const newLine: IInventoryLine = {
            ...buildMarkingLineFields({
              label,
              labels,
              good: lineGood,
              sortOrder: (doc?.lines?.length || 0) + 1,
              remainsUse: false,
            }),
            id: generateId(),
          };

          if (isAddressedDoc) {
            navigation.navigate('InventorySelectCell', {
              docId: id,
              item: newLine,
              mode: 0,
              docType: doc.documentType.name,
            });
          } else {
            dispatch(documentActions.addDocumentLine({ docId: id, line: newLine }));
            playSound();
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

      const good = goods.find(
        (item) => getCodeForCheck(item.shcode, goodBarcodeSettings?.countCode || 4) === barc.shcode,
      );

      if (!good) {
        handleErrorMessage(visibleDialog, 'Товар не найден!');
        return;
      }

      const line = doc?.lines?.find((i) => i.barcode === barc.barcode || i.scannedBarcode === barc.barcode);

      if (line) {
        handleErrorMessage(visibleDialog, 'Данный штрих-код уже добавлен!');
        return;
      }

      const newLine: IInventoryLine = {
        good: { id: good.id, name: good.name, shcode: good.shcode, unitWeight: good.unitWeight },
        id: generateId(),
        weight: barc.weight,
        barcode: barc.barcode,
        workDate: barc.workDate,
        time: barc.time,
        numReceived: barc.numReceived,
        sortOrder: doc?.lines?.length + 1,
        quantPack: barc.quantPack,
        flag: barc.flag,
      };

      if (isAddressedDoc) {
        navigation.navigate('InventorySelectCell', {
          docId: id,
          item: newLine,
          mode: 0,
          docType: doc.documentType.name,
        });
      } else {
        dispatch(documentActions.addDocumentLine({ docId: id, line: newLine }));
        playSound();
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
      doc,
      isDelList,
      minBarcodeLength,
      maxBarcodeLength,
      goodBarcodeSettings,
      goods,
      labels,
      isAddressedDoc,
      visibleDialog,
      addPalletQuantPack,
      handleErrorMessage,
      navigation,
      id,
      dispatch,
      playSound,
    ],
  );

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
  }, [scanned, ref, scheduleScannerFocus, visibleDialog]);

  useEffect(() => {
    if (screenState === 'sent' || screenState === 'deleted' || screenState === 'copied') {
      setScreenState('idle');
      if (screenState !== 'copied') {
        navigation.goBack();
      }
    }
  }, [navigation, screenState]);

  const isEditable = useMemo(() => (doc ? ['DRAFT', 'READY'].includes(doc?.status) : false), [doc]);

  const isFocused = useIsFocused();
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
        title={doc.documentType.description || ''}
        onPress={() => (isEditable ? handleEditDocHead() : setIsDateVisible(!isDateVisible))}
        editable={isEditable}
        disabled={delList.length > 0}
        isBlocked={isBlocked}
      >
        <View style={styles.infoBlock}>
          <MediumText>{doc.head.fromDepart?.name || ''}</MediumText>
          <MediumText>{`№ ${doc.number} от ${getDateString(doc.documentDate)}`}</MediumText>
          {isDateVisible && <DateInfo sentDate={doc.sentDate} erpCreationDate={doc.erpCreationDate} />}
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
      {lineType === 'all' ? (
        <>
          <FlashList
            data={lines}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            ItemSeparatorComponent={ItemSeparator}
            estimatedItemSize={60}
            extraData={[lines, isBlocked, delList, isDelList]}
            keyboardShouldPersistTaps={'always'}
          />
          {lines?.length ? <ViewTotal quantPack={lineSum?.quantPack || 0} weight={lineSum?.weight || 0} /> : null}
        </>
      ) : lineType === 'last' && lines?.[0] ? (
        <View style={styles.spaceBetween}>
          {(() => {
            const handlers = getLineHandlers(lines[0].id, () => handlePressLine(lines[0].weight));

            return (
              <LineItem
                item={lines[0]}
                checked={handlers.checked}
                onPress={handlers.onPress}
                onLongPress={handlers.onLongPress}
                disabled={!isDelList && (doc?.status !== 'DRAFT' || Boolean(lines[0].scannedBarcode))}
                isToAddressed={doc?.head.fromDepart?.isAddressStore}
              />
            );
          })()}
          {lines?.length ? <ViewTotal quantPack={lineSum?.quantPack || 0} weight={lineSum?.weight || 0} /> : null}
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
