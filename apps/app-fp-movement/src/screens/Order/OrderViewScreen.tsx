import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { View, TextInput, Keyboard, StyleProp, ViewStyle, Alert } from 'react-native';
import { RouteProp, useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Audio } from 'expo-av';

import { docSelectors, documentActions, refSelectors, useDispatch, useSelector } from '@lib/store';
import {
  MenuButton,
  useActionSheet,
  globalStyles as styles,
  InfoBlock,
  ItemSeparator,
  AppActivityIndicator,
  MediumText,
  AppDialog,
  LargeText,
  ScanButton,
  navBackButton,
  SaveDocument,
  DateInfo,
  ListItemLine,
} from '@lib/mobile-ui';

import { getDateString, keyExtractor } from '@lib/mobile-hooks';

import { ScreenState } from '@lib/types';

import { FlashList } from '@shopify/flash-list';

import { barcodeSettings, IOrderDocument, IOrderLine } from '../../store/types';
import { OrderStackParamList } from '../../navigation/Root/types';
import { getStatusColor, ONE_SECOND_IN_MS } from '../../utils/constants';

import { alertWithSound, getBarcode, getLineGood } from '../../utils/helpers';
import { IGood } from '../../store/app/types';

import ViewTotal from '../../components/ViewTotal';
export interface IScanerObject {
  item?: IOrderLine;
  barcode: string;
  state: 'scan' | 'added' | 'notFound';
}

export const OrderViewScreen = () => {
  const showActionSheet = useActionSheet();
  const dispatch = useDispatch();
  const navigation = useNavigation<StackNavigationProp<OrderStackParamList, 'OrderView'>>();
  const isFocused = useIsFocused();

  const id = useRoute<RouteProp<OrderStackParamList, 'OrderView'>>().params?.id;

  const doc = docSelectors.selectByDocId<IOrderDocument>(id);

  const lines = useMemo(() => doc?.lines, [doc?.lines]);
  const lineSum = lines?.reduce(
    (sum, line) => {
      return { ...sum, weight: sum.weight + (line.weight || 0) };
    },
    { weight: 0 },
  );

  const isBlocked = doc?.status !== 'DRAFT';
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

  const [screenState, setScreenState] = useState<ScreenState>('idle');
  const [visibleDialog, setVisibleDialog] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const sound = Audio.Sound.createAsync(require('../../../assets/ok.wav'));

  const playSound = useCallback(async () => {
    (await sound).sound.playAsync();
  }, [sound]);

  const [scanned, setScanned] = useState(false);
  const ref = useRef<TextInput>(null);

  const scheduleScannerFocus = useCallback(() => {
    setTimeout(() => {
      ref.current?.focus();
      ref.current?.clear();
    }, ONE_SECOND_IN_MS);
  }, []);

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

  const actionsMenu = useCallback(() => {
    showActionSheet(
      isBlocked
        ? [
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
              title: 'Отмена',
              type: 'cancel',
              onPress: handleFocus,
            },
          ],
    );
  }, [showActionSheet, isBlocked]);

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
            <MenuButton actionsMenu={actionsMenu} disabled={screenState !== 'idle'} />
          </View>
        ) : (
          <MenuButton actionsMenu={actionsMenu} disabled={screenState !== 'idle'} />
        )
      ) : (
        <View style={styles.buttons}>
          {doc?.status === 'DRAFT' && <SaveDocument onPress={handleSaveDocument} disabled={screenState !== 'idle'} />}
          <ScanButton onPress={handleFocus} disabled={screenState !== 'idle'} />
          <MenuButton actionsMenu={actionsMenu} disabled={screenState !== 'idle'} />
        </View>
      ),
    [actionsMenu, doc?.status, handleSaveDocument, isBlocked, screenState],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: navBackButton,
      headerRight: renderRight,
    });
  }, [navigation, renderRight]);

  const renderItem = useCallback(
    ({ item }: { item: IOrderLine }) => {
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

      if (!lineGood.isRightWeight) {
        handleErrorMessage(visibleDialog, 'Вес товара превышает вес в остатках!');
        return;
      }

      const line = doc?.lines?.find((i) => i.good.id === lineGood?.good?.id);

      if (line) {
        Alert.alert('', `Товар: ${lineGood?.good?.name} \nВес: ${line?.weight} кг`);
        return;
      }

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

    [doc, minBarcodeLength, maxBarcodeLength, goodBarcodeSettings, goods, playSound, visibleDialog, handleErrorMessage],
  );

  const handleSearchBarcode = () => {
    getScannedObject(barcode);
  };

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

  const viewStyle: StyleProp<ViewStyle> = useMemo(() => ({ ...styles.container, justifyContent: 'center' }), []);

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
        onPress={() => setIsDateVisible(!isDateVisible)}
        editable={false}
        isBlocked={isBlocked}
      >
        <View style={styles.infoBlock}>
          <MediumText>{doc.head.outlet?.name || ''}</MediumText>
          <MediumText>{`№ ${doc.number} на ${getDateString(doc.head?.onDate || doc.documentDate)}`}</MediumText>
          {isDateVisible && <DateInfo sentDate={doc.sentDate} erpCreationDate={doc.erpCreationDate} />}
        </View>
      </InfoBlock>
      <TextInput
        style={styles.scanInput}
        key={key}
        autoFocus={true}
        selectionColor="transparent"
        ref={ref}
        showSoftInputOnFocus={false}
        onChangeText={(text) => !scanned && setScan(text)}
      />

      <FlashList
        data={lines}
        renderItem={renderItem}
        estimatedItemSize={60}
        ItemSeparatorComponent={ItemSeparator}
        keyExtractor={keyExtractor}
        extraData={[lines, isBlocked]}
        keyboardShouldPersistTaps={'always'}
      />
      {lines?.length ? <ViewTotal weight={lineSum?.weight || 0} /> : null}

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
    </View>
  );
};
