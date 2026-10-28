import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { View, TextInput, Alert, useWindowDimensions, Keyboard } from 'react-native';
import { RouteProp, useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { Audio } from 'expo-av';

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
  ScanButton,
  SendButton,
  AppActivityIndicator,
  MediumText,
  LargeText,
  ListItemLine,
  navBackButton,
  SaveDocument,
  SimpleDialog,
  DateInfo,
  AppDialog,
  DeleteButton,
  CloseButton,
  EditDocument,
  PrintButton,
} from '@lib/mobile-ui';

import {
  generateId,
  getDateString,
  shortenString,
  useSendDocs,
  sleep,
  keyExtractor,
  deleteSelectedLineItems,
  getDelLineList,
} from '@lib/mobile-hooks';

import { ScreenState } from '@lib/types';

import { FlashList } from '@shopify/flash-list';

import * as Print from 'expo-print';

import { IPalletDocument, IPalletLine } from '../../store/types';
import { PalletStackParamList } from '../../navigation/Root/types';
import { getStatusColor, SCAN_REFOCUS_DELAY_MS } from '../../utils/constants';

import { alertWithSound } from '../../utils/helpers';
import {
  isLegacyNumericBarcode,
  isMarkingCode,
  isPalletMarkDuplicate,
  resolvePalletMark,
} from '../../utils/markingCodeHelpers';
import { ILabel } from '../../store/app/types';

import { BarcodeImage } from './components/Barcode';
import ViewTotal from './components/ViewTotal';

const EMPTY_LABELS: ILabel[] = [];
const EMPTY_LINES: IPalletLine[] = [];

export const PalletViewScreen = () => {
  const showActionSheet = useActionSheet();
  const dispatch = useDispatch();
  const docDispatch = useDocThunkDispatch();

  const navigation = useNavigation<StackNavigationProp<PalletStackParamList, 'PalletView'>>();

  const [screenState, setScreenState] = useState<ScreenState>('idle');
  const [visibleDialog, setVisibleDialog] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const id = useRoute<RouteProp<PalletStackParamList, 'PalletView'>>().params?.id;
  const doc = docSelectors.selectByDocId<IPalletDocument>(id);
  const lines = useMemo(
    () => (doc?.lines ? [...doc.lines].sort((a, b) => (b.sortOrder || 0) - (a.sortOrder || 0)) : EMPTY_LINES),
    [doc?.lines],
  );
  const loading = useSelector((state) => state.app.loading);

  const isBlocked = doc?.status !== 'DRAFT';

  const isScanerReader = useSelector((state) => state.settings?.data?.scannerUse?.data);
  const prefixErp = useSelector((state) => state.settings?.data?.prefixErp?.data);
  const prefixS = useSelector((state) => state.settings?.data?.prefixS?.data);
  const labels = refSelectors.selectByName<ILabel>('label')?.data ?? EMPTY_LABELS;

  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadSound = async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(require('../../../assets/ok.wav'));
        if (cancelled) {
          await sound.unloadAsync();
          return;
        }
        soundRef.current = sound;
      } catch {
        // ошибка загрузки звука не должна мешать сканированию
      }
    };

    loadSound().catch(() => undefined);

    return () => {
      cancelled = true;
      soundRef.current?.unloadAsync();
      soundRef.current = null;
    };
  }, []);

  const playSound = useCallback(() => {
    soundRef.current?.replayAsync();
  }, []);

  const html = `
  <html>
    <head>
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no"
    />
    </head>
    <body style="text-align: center; margin-top: 20px">
      <h1 style="font-size: 22px; font-family: Helvetica Neue; font-weight: normal;">
      ${`№ ${doc?.number || '-'} от ${getDateString(doc?.documentDate || '')}` || ''}</h1>
      <h1 style="font-size: 30px; font-family: Helvetica Neue; font-weight: normal;">${doc?.head.palletId || ''}</h1>
    </body>
  </html>
`;

  const [selectedPrinter, setSelectedPrinter] = useState<Print.Printer>();

  const print = useCallback(async () => {
    // On iOS/android prints the given html. On web prints the HTML from the current page.
    await Print.printAsync({
      html,
      printerUrl: selectedPrinter?.url, // iOS only
    });
  }, [html, selectedPrinter?.url]);

  useEffect(() => {
    return () => {
      dispatch(appActions.clearFormParams());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [isDateVisible, setIsDateVisible] = useState(false);

  const ref = useRef<TextInput>(null);

  const handleFocus = () => {
    ref?.current?.focus();
  };

  const handleDelete = useCallback(() => {
    if (!id) {
      return;
    }

    Alert.alert('Вы уверены, что хотите удалить документ?', '', [
      {
        text: 'Да',
        onPress: async () => {
          setScreenState('deleting');
          await sleep(1);
          const res = await docDispatch(documentActions.removeDocument(id));
          if (res.type === 'DOCUMENTS/REMOVE_ONE_SUCCESS') {
            setScreenState('deleted');
          } else {
            setScreenState('idle');
          }
        },
      },
      {
        text: 'Отмена',
        onPress: () => handleFocus(),
      },
    ]);
  }, [docDispatch, id]);

  const [delList, setDelList] = useState<string[]>([]);
  const isDelList = !!Object.keys(delList).length;

  const handleDeleteLines = useCallback(() => {
    const deleteDocs = () => {
      dispatch(documentActions.removeDocumentLines({ docId: id, lineIds: delList }));
      setDelList([]);
    };

    deleteSelectedLineItems(deleteDocs);
  }, [delList, dispatch, id, setDelList]);

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
  }, [dispatch, id, doc, navigation]);

  const handleEditDocument = useCallback(() => {
    if (!doc) {
      return;
    }
    dispatch(
      documentActions.updateDocument({
        docId: id,
        document: { ...doc, status: 'DRAFT' },
      }),
    );
  }, [dispatch, id, doc]);

  const hanldeCancelLastPallet = useCallback(() => {
    const lastId = doc?.lines?.[0]?.id;

    if (lastId) {
      dispatch(documentActions.removeDocumentLine({ docId: id, lineId: lastId }));
    }
    handleFocus();
  }, [dispatch, doc?.lines, id]);

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
  const sendDoc = useSendDocs(doc ? [doc] : []);

  const [visibleSendDialog, setVisibleSendDialog] = useState(false);

  const handleSendDocument = useCallback(async () => {
    setVisibleSendDialog(false);
    setScreenState('sending');
    await sendDoc();
    setScreenState('sent');
  }, [sendDoc]);

  const actionsMenu = useCallback(() => {
    showActionSheet([
      {
        title: 'Отменить последнее сканирование',
        onPress: hanldeCancelLastPallet,
      },
      {
        title: 'Ввести штрих-код',
        onPress: handleShowDialog,
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
    ]);
  }, [showActionSheet, hanldeCancelLastPallet, handleDelete]);

  const renderRight = useCallback(
    () =>
      isBlocked ? (
        doc?.status === 'READY' ? (
          <View style={styles.buttons}>
            <PrintButton onPress={() => print()} disabled={screenState !== 'idle'} />
            <EditDocument onPress={handleEditDocument} disabled={screenState !== 'idle'} />
            <SendButton onPress={() => setVisibleSendDialog(true)} disabled={screenState !== 'idle' || loading} />
          </View>
        ) : (
          <PrintButton onPress={() => print()} disabled={screenState !== 'idle'} />
        )
      ) : (
        <View style={styles.buttons}>
          {isDelList ? (
            <DeleteButton onPress={handleDeleteLines} />
          ) : (
            <>
              <PrintButton onPress={() => print()} disabled={screenState !== 'idle'} />
              {doc?.status === 'DRAFT' && (
                <SaveDocument onPress={handleSaveDocument} disabled={screenState !== 'idle'} />
              )}
              <SendButton onPress={() => setVisibleSendDialog(true)} disabled={screenState !== 'idle' || loading} />
              <ScanButton
                onPress={() => (isScanerReader ? handleFocus() : navigation.navigate('PalletGood', { docId: id }))}
                disabled={screenState !== 'idle'}
              />
              <MenuButton actionsMenu={actionsMenu} disabled={screenState !== 'idle'} />
            </>
          )}
        </View>
      ),
    [
      actionsMenu,
      doc?.status,
      handleDeleteLines,
      handleEditDocument,
      handleSaveDocument,
      id,
      isBlocked,
      isDelList,
      isScanerReader,
      loading,
      navigation,
      print,
      screenState,
    ],
  );

  const handleEditPalletHead = useCallback(() => {
    navigation.navigate('PalletEdit', { id });
  }, [navigation, id]);

  const windowWidth = useWindowDimensions().width;

  const renderLeft = useCallback(
    () => !isBlocked && isDelList && <CloseButton onPress={() => setDelList([])} />,
    [isBlocked, isDelList],
  );
  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: isDelList ? renderLeft : navBackButton,
      headerRight: renderRight,
      title: '',
    });
  }, [isDelList, navigation, renderLeft, renderRight, windowWidth]);

  const renderItem = ({ item }: { item: IPalletLine }) => (
    <ListItemLine
      {...item}
      onPress={() => isDelList && setDelList(getDelLineList(delList, item.id))}
      onLongPress={() => !isBlocked && setDelList(getDelLineList(delList, item.id))}
      checked={delList.includes(item.id)}
    >
      <View style={styles.details}>
        <LargeText>{shortenString(item.mark?.code || item.barcode, 30)}</LargeText>
      </View>
    </ListItemLine>
  );

  const handleErrorMessage = useCallback((visible: boolean, text: string) => {
    if (visible) {
      setErrorMessage(text);
    } else {
      alertWithSound('Внимание!', `${text}.`, handleFocus);

      setScanned(false);
    }
    handleFocus();
  }, []);
  const [scanned, setScanned] = useState(false);

  const [key, setKey] = useState(1);

  const getScannedObject = useCallback(
    (brc: string) => {
      if (!doc) {
        setScanned(false);
        handleFocus();
        return;
      }

      if (isBlocked) {
        setScanned(false);
        handleFocus();
        return;
      }

      if (!isLegacyNumericBarcode(brc)) {
        const markingResult = resolvePalletMark(brc, labels);

        if (markingResult.kind === 'not_found') {
          handleErrorMessage(
            visibleDialog,
            isMarkingCode(brc) ? 'Код маркировки не найден' : 'Баркод неверного формата',
          );
          setScanned(false);
          handleFocus();
          return;
        }

        if (markingResult.kind === 'found') {
          const { label, markCode } = markingResult;

          if (isPalletMarkDuplicate(markCode, doc.lines)) {
            handleErrorMessage(visibleDialog, 'Данный код маркировки уже добавлен');
            setScanned(false);
            handleFocus();
            return;
          }

          const line: IPalletLine = {
            id: generateId(),
            barcode: '',
            sortOrder: (lines?.[0]?.sortOrder || 0) + 1,
            mark: { id: label.id, code: label.code },
          };
          dispatch(documentActions.addDocumentLine({ docId: id, line }));
          playSound();

          if (visibleDialog) {
            setVisibleDialog(false);
            setErrorMessage('');
            setBarcode('');
          } else {
            setScanned(false);
          }

          handleFocus();
          return;
        }
      }

      if (brc.slice(0, 2) !== prefixErp && brc.slice(0, 2) !== prefixS) {
        handleErrorMessage(visibleDialog, 'Баркод неверного формата');

        setScanned(false);
        handleFocus();
        return;
      }

      if (doc.lines?.find((l) => l.barcode === brc)) {
        handleErrorMessage(visibleDialog, 'Штрихкод уже добавлен');

        setScanned(false);
        handleFocus();
        return;
      }

      const line: IPalletLine = { id: generateId(), barcode: brc, sortOrder: (lines?.[0]?.sortOrder || 0) + 1 };
      dispatch(documentActions.addDocumentLine({ docId: id, line }));
      playSound();

      if (visibleDialog) {
        setVisibleDialog(false);
        setErrorMessage('');
        setBarcode('');
      } else {
        setScanned(false);
      }

      handleFocus();
    },
    [dispatch, doc, handleErrorMessage, id, isBlocked, labels, lines, playSound, prefixErp, prefixS, visibleDialog],
  );

  const handleSearchBarcode = () => {
    getScannedObject(barcode);
  };

  const setPallet = (brc: string) => {
    setKey(key + 1);
    setScanned(true);
    getScannedObject(brc);
  };

  useEffect(() => {
    if (!scanned && ref?.current) {
      ref?.current &&
        setTimeout(() => {
          ref.current?.focus();
          ref.current?.clear();
        }, SCAN_REFOCUS_DELAY_MS);
    }
  }, [scanned, ref]);

  useEffect(() => {
    if (screenState === 'sent' || screenState === 'deleted') {
      setScreenState('idle');
      navigation.goBack();
    }
  }, [navigation, screenState]);

  const isEditable = useMemo(() => (doc ? ['DRAFT', 'READY'].includes(doc?.status) : false), [doc]);

  const isFocused = useIsFocused();
  if (!isFocused) {
    return <AppActivityIndicator />;
  }

  if (screenState === 'deleting' || screenState === 'sending') {
    return (
      <View style={styles.container}>
        <View style={styles.containerCenter}>
          <LargeText>{screenState === 'deleting' ? 'Удаление документа...' : 'Отправка документа...'}</LargeText>
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
    <>
      <View style={styles.container}>
        <InfoBlock
          colorLabel={getStatusColor(doc?.status || 'DRAFT')}
          title={doc.documentType.description || ''}
          onPress={() => (isEditable ? handleEditPalletHead() : setIsDateVisible(!isDateVisible))}
          isBlocked={isBlocked}
          disabled={delList.length > 0}
        >
          <>
            <View style={styles.rowCenter}>
              <MediumText>{`№ ${doc.number} от ${getDateString(doc.documentDate)}`}</MediumText>
            </View>
            <View style={styles.rowCenter}>
              <MediumText>Вес коробки: {(doc.head.boxWeight || 0).toString()} кг</MediumText>
            </View>
            <View style={styles.rowCenter}>
              <MediumText>Вес поддона: {(doc.head.palletWeight || 0).toString()} кг</MediumText>
            </View>
            <BarcodeImage barcode={doc?.head.palletId} />

            {isDateVisible && <DateInfo sentDate={doc.sentDate} erpCreationDate={doc.erpCreationDate} />}
          </>
        </InfoBlock>
        <TextInput
          style={styles.scanInput}
          key={key}
          autoFocus={true}
          selectionColor="transparent"
          ref={ref}
          showSoftInputOnFocus={false}
          onChangeText={(text) => !scanned && setPallet(text)}
        />
        <FlashList
          data={lines}
          renderItem={renderItem}
          estimatedItemSize={60}
          ItemSeparatorComponent={ItemSeparator}
          keyboardShouldPersistTaps="handled"
          keyExtractor={keyExtractor}
          extraData={[lines, isBlocked, delList, isDelList]}
        />
        {lines?.length ? <ViewTotal total={lines?.length || 0} /> : null}
        <AppDialog
          title="Введите штрих-код"
          visible={visibleDialog}
          text={barcode}
          onChangeText={setBarcode}
          onCancel={handleDismissBarcode}
          onOk={handleSearchBarcode}
          okLabel={'ОК'}
          errorMessage={errorMessage}
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
    </>
  );
};
