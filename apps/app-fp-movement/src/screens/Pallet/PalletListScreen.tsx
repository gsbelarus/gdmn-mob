import {
  globalStyles as styles,
  AddButton,
  AppScreen,
  CloseButton,
  DeleteButton,
  IListItemProps,
  navBackDrawer,
  AppActivityIndicator,
  SubTitle,
  ScreenListItem,
  ItemSeparator,
  EmptyList,
  AppDialog,
  MediumText,
  PackageButton,
  ScanButton,
} from '@lib/mobile-ui';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Keyboard, ListRenderItem, SectionList, SectionListData, TextInput, View } from 'react-native';

import { documentActions, refSelectors, useDispatch, useDocThunkDispatch, useSelector } from '@lib/store';

import { IDelList } from '@lib/mobile-types';

import {
  deleteSelectedItems,
  generateId,
  getDateString,
  getDelList,
  keyExtractor,
  round,
  useFilteredDocList,
} from '@lib/mobile-hooks';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { IDocumentType, INamedEntity, IReference } from '@lib/types';

import * as Print from 'expo-print';

import { barcodeToSvg } from '@adrianso/react-native-barcode-builder';

import { MaterialCommunityIcons } from '@expo/vector-icons';

import { PalletStackParamList } from '../../navigation/Root/types';
import {
  barcodeSettings,
  IMoveDocument,
  IMoveLine,
  IPalletDocument,
  IPalletHead,
  IPalletLine,
} from '../../store/types';

import { alertWithSound, getBarcode, getBarcodeString, getLineGood, getNextDocNumber } from '../../utils/helpers';

import { SCAN_REFOCUS_DELAY_MS } from '../../utils/constants';
import { IAddressStoreEntity, IGood } from '../../store/app/types';

import { PalletDialog, print } from './components/PalletDialog';

import { LineDialog } from './components/LineDialog';

export interface PalletListSectionProps {
  title: string;
}

export type SectionDataProps = SectionListData<IListItemProps, PalletListSectionProps>[];

interface ILineDialog {
  visible: boolean;
  id: string;
}
export const PalletListScreen = () => {
  const navigation = useNavigation<StackNavigationProp<PalletStackParamList, 'PalletList'>>();
  const docDispatch = useDocThunkDispatch();

  const dispatch = useDispatch();
  const storeMan = useSelector((state) => state.auth.user);
  const [barcodeGeneration, setBarcodeGeneration] = useState(false);

  const list = (
    useSelector((state) => state.documents.list)?.filter((i) => i.documentType?.name === 'pallet') as IPalletDocument[]
  ).sort((a, b) => new Date(b.documentDate).getTime() - new Date(a.documentDate).getTime());

  const sectionList = list.map(
    (i) =>
      ({
        id: i.id,
        title: i.head.barcode || '',
        documentDate: getDateString(i.documentDate),
        status: i.status,
        errorMessage: i.errorMessage,
        addInfo: (
          <View>
            <MediumText>{i.head.good.name || ''}</MediumText>
            <View style={styles.flexDirectionRow}>
              <MaterialCommunityIcons name="shopping-outline" size={18} />
              <MediumText>
                {(i.head.weight || 0).toString()}кг, {(i.head.quantPack || 0).toString()} кор.
              </MediumText>
            </View>
            <MediumText>
              Партия № {i.head.numReceived || ''} от {getDateString(i.head.workDate) || ''}
            </MediumText>
            {i.head.toCell ? <MediumText>Ячейка {i.head.toCell}</MediumText> : null}
          </View>
        ),
        sentDate: i.sentDate,
        erpCreationDate: i.erpCreationDate,
      }) as IListItemProps,
  );

  const palletType = refSelectors
    .selectByName<IReference<IDocumentType>>('documentType')
    ?.data.find((t) => t.name === 'pallet');

  const movements = useFilteredDocList<IMoveDocument>('movement');

  // const doc = movements?.find((e) => e.id === id);

  const departs = refSelectors.selectByName<IAddressStoreEntity>('depart')?.data;

  const userDefaultDepart = useSelector((state) => state.settings?.userData?.depart?.data) as INamedEntity;
  const defaultDepart = departs?.find((i) => i.id === userDefaultDepart?.id);
  const userDefaultSecondDepart = useSelector((state) => state.settings?.userData?.secondDepart?.data) as INamedEntity;
  const defaultSecondDepart = departs?.find((i) => i.id === userDefaultSecondDepart?.id);

  const movementType = refSelectors
    .selectByName<IReference<IDocumentType>>('documentType')
    ?.data.find((t) => t.name === 'movement');

  const movementSubtype = refSelectors
    .selectByName<IReference<INamedEntity>>('documentSubtype')
    ?.data.find((t) => t.id === 'internalMovement');

  // const loading = useSelector((state) => state.app.loading);
  const [delList, setDelList] = useState<IDelList>({});
  const isDelList = useMemo(() => !!Object.keys(delList).length, [delList]);

  const [lineDialog, setLineDialog] = useState<ILineDialog>({ id: '', visible: false });
  const [visiblePalletDialog, setVisiblePalletDialog] = useState(false);

  const [currentDocumentId, setCurrentDocumentId] = useState<string | undefined>('');

  const sections = useMemo(
    () =>
      sectionList.reduce<SectionDataProps>((prev, item) => {
        const sectionTitle = item.documentDate;
        const sectionExists = prev.some(({ title }) => title === sectionTitle);
        if (sectionExists) {
          return prev.map((section) =>
            section.title === sectionTitle ? { ...section, data: [...section.data, item] } : section,
          );
        }

        return [
          ...prev,
          {
            title: sectionTitle,
            data: [item],
          },
        ];
      }, []),
    [sectionList],
  );

  const handleDeleteDocs = useCallback(() => {
    const docIds = Object.keys(delList);

    const deleteDocs = () => {
      docDispatch(documentActions.removeDocuments(docIds));
      setDelList({});
    };

    deleteSelectedItems(delList, deleteDocs);
  }, [delList, docDispatch]);

  const handleDismissBarcode = () => {
    setVisibleDialog(false);
    setBarcode('');
    setErrorMessage('');
    Keyboard.dismiss();
    handleFocus();
  };

  const renderRight = useCallback(
    () => (
      <View style={styles.buttons}>
        {isDelList ? (
          <View style={styles.buttons}>
            <DeleteButton onPress={handleDeleteDocs} />
          </View>
        ) : (
          <View style={styles.buttons}>
            <ScanButton onPress={() => handleFocus()} />
            <AddButton onPress={() => setVisibleDialog(true)} />
            <PackageButton onPress={() => setBarcodeGeneration(false)} disabled={!barcodeGeneration} />
          </View>
        )}
      </View>
    ),
    [barcodeGeneration, handleDeleteDocs, isDelList],
  );

  const renderLeft = useCallback(() => isDelList && <CloseButton onPress={() => setDelList({})} />, [isDelList]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: isDelList ? renderLeft : navBackDrawer,
      headerRight: renderRight,
      title: isDelList ? `${Object.values(delList).length}` : 'Документы',
    });
  }, [delList, isDelList, navigation, renderLeft, renderRight]);

  const goods = refSelectors.selectByName<IGood>('good').data;

  const settings = useSelector((state) => state.settings?.data);

  const goodBarcodeSettings = Object.entries(settings).reduce((prev: barcodeSettings, [idx, item]) => {
    if (item && item.group?.id !== 'base' && typeof item.data === 'number') {
      prev[idx] = item.data;
    }
    return prev;
  }, {});

  const minBarcodeLength = (settings.minBarcodeLength?.data as number) || 0;
  const maxBarcodeLength = (settings.maxBarcodeLength?.data as number) || 0;

  const [selectedPalletHead, setSelectedPalletHead] = useState<IPalletHead | undefined>(undefined);
  const [selectedPrinter, _] = useState<Print.Printer>();

  const [visibleDialog, setVisibleDialog] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [scanned, setScanned] = useState(false);

  const handleErrorMessage = useCallback((visible: boolean, text: string) => {
    if (visible) {
      setErrorMessage(text);
    } else {
      alertWithSound('Внимание!', `${text}.`, handleFocus);
      setScanned(false);
    }
  }, []);

  const handleOnPress = useCallback(
    async (id: string) => {
      const doc = list.find((i) => i.id === id);
      if (!doc || !doc?.head || !doc?.head?.barcode) {
        return;
      }

      const SVGBarcode = barcodeToSvg({
        value: doc?.head?.barcode,
        width: 500,
        height: 160,
      });

      await print(
        { ...doc?.head, storeMan: `${storeMan?.lastName} ${storeMan?.firstName}` },
        SVGBarcode,
        selectedPrinter,
      );
      setLineDialog({ id: '', visible: false });
    },
    [list, selectedPrinter, storeMan?.firstName, storeMan?.lastName],
  );

  const handleOnSetCell = useCallback(
    (id: string) => {
      const doc = list?.find((i) => i.id === id);
      if (!doc?.head.good) {
        handleErrorMessage(visibleDialog, 'Товар не найден!');
        return;
      }

      if (!doc?.head.good) {
        handleErrorMessage(visibleDialog, 'Товар не найден!');
        return;
      }
      if (goodBarcodeSettings.boxWeight > doc?.head?.weight) {
        handleErrorMessage(visibleDialog, 'Вес меньше минимального веса поддона.');
        return;
      }
      const newLine: IMoveLine = { ...doc?.head, id: generateId() };

      const docId = currentDocumentId ? currentDocumentId : generateId();
      const docc = movements.find((i) => i.id === currentDocumentId);
      if (!currentDocumentId || (currentDocumentId && docc && docc.status !== 'DRAFT')) {
        if (!movementType || !movementSubtype) {
          handleErrorMessage(visibleDialog, 'Не найден тип документа!');
          return;
        }
        if (!defaultDepart || !defaultSecondDepart) {
          handleErrorMessage(visibleDialog, 'Не найдены подразделения!');
          return;
        }

        const createdDate = new Date().toISOString();
        const newNumber = getNextDocNumber(movements);

        const newDoc: IMoveDocument = {
          id: docId,
          documentType: movementType,
          number: newNumber.trim(),
          documentDate: createdDate,
          status: 'DRAFT',
          head: {
            fromDepart: defaultDepart,
            toDepart: defaultSecondDepart,
            subtype: movementSubtype,
          },
          lines: [],
          creationDate: createdDate,
          editionDate: createdDate,
        };

        dispatch(documentActions.addDocument(newDoc));
        setCurrentDocumentId(docId);
      }

      // navigation.dispatch(StackActions.replace('MoveToView', { id: newDoc.id }));

      // const newNumber = getNextDocNumber(list); // из На хранение надо номер

      setVisiblePalletDialog(false);
      setLineDialog({ id: '', visible: false });
      setBarcodeGeneration(false);
      navigation.navigate('SelectCell', { docId, item: newLine, mode: 0, docType: `pallet${id}` });
    },
    [
      currentDocumentId,
      defaultDepart,
      defaultSecondDepart,
      dispatch,
      goodBarcodeSettings.boxWeight,
      handleErrorMessage,
      list,
      movementSubtype,
      movementType,
      movements,
      navigation,
      visibleDialog,
    ],
  );

  const renderItem: ListRenderItem<IListItemProps> = useCallback(
    ({ item }) => (
      <ScreenListItem
        key={item.id}
        {...item}
        onPress={() =>
          isDelList
            ? setDelList(getDelList(delList, item.id, item.status!))
            : setLineDialog({ id: item.id, visible: true })
        }
        onLongPress={() => setDelList(getDelList(delList, item.id, item.status!))}
        checked={!!delList[item.id]}
      />
    ),
    [delList, isDelList],
  );

  const ref = useRef<TextInput>(null);
  const handleFocus = () => {
    ref?.current?.focus();
  };

  const handleAddDocument = useCallback(
    (barcodeObj: IPalletHead) => {
      if (!palletType) {
        handleErrorMessage(visibleDialog, 'Не найден тип документа!');
        return;
      }
      // const doc = list?.[0];

      const newNumber = getNextDocNumber(list);

      const date = new Date().toISOString();
      const newDoc: IPalletDocument = {
        id: generateId(),
        documentType: palletType,
        // number: docNumber && docNumber.trim(),
        number: newNumber,
        documentDate: date,
        status: 'DRAFT',
        head: barcodeObj,
        lines: [
          {
            ...barcodeObj,
            id: generateId(),
          },
        ],
        creationDate: date,
        editionDate: date,
      };
      dispatch(documentActions.addDocument(newDoc));
      setVisiblePalletDialog(false);
      handleFocus();
    },
    [dispatch, handleErrorMessage, list, palletType, visibleDialog],
  );

  const handleAddLine = useCallback(
    (barcodeObj: IPalletHead, mode: 'add' | 'update') => {
      if (!palletType) {
        handleErrorMessage(visibleDialog, 'Не найден тип документа!');
        return;
      }
      if (mode === 'add') {
        //((!list.length || !list?.[0] || !list?.[0].head)) {
        handleAddDocument(barcodeObj);
        setBarcodeGeneration(true);

        handleFocus();
      } else {
        const line = list?.[0].lines?.find(
          (i) => i.barcode === barcodeObj.barcode || i.scannedBarcode === barcodeObj.barcode,
        );
        if (line) {
          handleErrorMessage(visibleDialog, 'Данный штрих-код уже добавлен!');
          return;
        }

        const numReceivedCheck =
          list?.[0].head?.numReceived !== barcodeObj.numReceived || list?.[0].head?.workDate !== barcodeObj.workDate;

        if (numReceivedCheck) {
          handleErrorMessage(visibleDialog, 'Номер партии или дата не совпадают!');
          return;
        }

        const weight = round(list?.[0].head?.weight + barcodeObj.weight, 3);
        const quantPack = round(list?.[0].head?.quantPack + barcodeObj.quantPack, 3);
        const newObj: IPalletHead = {
          ...list?.[0].head,
          quantPack,
          weight,
        };
        const newBrc = getBarcodeString({ ...newObj, shcode: newObj.good.shcode }, goodBarcodeSettings);

        const newLine: IPalletLine = { ...barcodeObj, id: generateId() };
        // dispatch(documentActions.addDocumentLine({ docId: list?.[0]?.id, line: newLine }));

        dispatch(
          documentActions.updateDocument({
            docId: list?.[0]?.id,
            document: {
              ...list?.[0],
              head: {
                ...newObj,
                barcode: newBrc,
              },
              lines: list?.[0].lines?.length ? [...list[0].lines, newLine] : [newLine],
            },
          }),
        );
        setVisiblePalletDialog(false);
        setBarcodeGeneration(true);
        handleFocus();
      }
    },
    [dispatch, goodBarcodeSettings, handleAddDocument, handleErrorMessage, list, palletType, visibleDialog],
  );

  const getScannedObject = useCallback(
    (brc: string) => {
      // if (!doc) {
      //   return;
      // }

      // if (doc?.status !== 'DRAFT') {
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

      const lineGood = getLineGood(barc.shcode, barc.weight, goods, [], false, goodBarcodeSettings?.countCode || 4);

      if (!lineGood.good) {
        handleErrorMessage(visibleDialog, 'Товар не найден!');
        return;
      }

      if (barcodeGeneration) {
        handleAddLine({ ...barc, good: lineGood.good, scannedBarcode: brc }, 'update');
      } else {
        setSelectedPalletHead({ ...barc, good: lineGood.good, scannedBarcode: brc });
      }

      if (visibleDialog) {
        setVisibleDialog(false);
        setErrorMessage('');
        setBarcode('');
      } else {
        setScanned(false);
      }

      !barcodeGeneration && setVisiblePalletDialog(true);
    },

    [
      minBarcodeLength,
      maxBarcodeLength,
      goodBarcodeSettings,
      goods,
      barcodeGeneration,
      visibleDialog,
      handleErrorMessage,
      handleAddLine,
    ],
  );

  const handleSearchBarcode = () => {
    getScannedObject(barcode);
  };

  const handleGetBarcode = (obj: IPalletHead) => {
    return getBarcodeString({ ...obj, shcode: obj.good.shcode }, goodBarcodeSettings);
  };

  // const viewStyle: StyleProp<ViewStyle> = useMemo(
  //   () => ({ ...styles.container, justifyContent: lineType === 'last' ? 'flex-start' : 'center' }),
  //   [lineType],
  // );

  const [key, setKey] = useState(1);

  const setScan = (brc: string) => {
    setKey(key + 1);
    setScanned(true);
    getScannedObject(brc);
  };

  useEffect(() => {
    if (!visibleDialog && !scanned && ref?.current) {
      ref?.current &&
        setTimeout(() => {
          ref.current?.focus();
          ref.current?.clear();
        }, SCAN_REFOCUS_DELAY_MS);
    }
  }, [scanned, ref, visibleDialog]);

  const renderSectionHeader = ({ section }: any) => (
    <SubTitle style={[styles.header, styles.sectionTitle]}>{section.title}</SubTitle>
  );

  const isFocused = useIsFocused();
  if (!isFocused) {
    return <AppActivityIndicator />;
  }

  return (
    <AppScreen>
      <TextInput
        style={styles.scanInput}
        key={key}
        autoFocus={true}
        selectionColor="transparent"
        ref={ref}
        showSoftInputOnFocus={false}
        onChangeText={(text) => !scanned && setScan(text)}
      />
      <SectionList
        sections={sections}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ItemSeparatorComponent={ItemSeparator}
        renderSectionHeader={renderSectionHeader}
        ListEmptyComponent={EmptyList}
      />
      <PalletDialog
        visible={visiblePalletDialog}
        onCancel={() => setVisiblePalletDialog(false)}
        onOk={handleAddDocument}
        // pallet={selectedPallet}
        storeMan={`${storeMan?.lastName} ${storeMan?.firstName}`}
        palletHead={selectedPalletHead}
        getBarcode={handleGetBarcode}
        onContinue={(barcodeObj: IPalletHead) => handleAddLine(barcodeObj, 'add')}
      />
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
      <LineDialog
        visible={lineDialog.visible}
        title={'Внимание!'}
        text={'Выберите действие'}
        onCancel={() => setLineDialog({ id: '', visible: false })}
        onPrint={() => handleOnPress(lineDialog.id)}
        onCellSet={() => handleOnSetCell(lineDialog.id)}
        // okDisabled={toCellDisabled}
      />
    </AppScreen>
  );
};
