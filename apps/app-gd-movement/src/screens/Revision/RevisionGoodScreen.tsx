import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';

import { useNavigation, RouteProp, useRoute, useIsFocused } from '@react-navigation/native';

import { AppActivityIndicator, globalStyles, LargeText, navBackButton, ScanBarcode } from '@lib/mobile-ui';
import { docSelectors, useDispatch, documentActions, useSelector, appActions, refSelectors } from '@lib/store';

import { StackNavigationProp } from '@react-navigation/stack';

import { IScannedObject } from '@lib/client-types';

import { generateId } from '@lib/mobile-hooks';

import { INamedEntity, ISettingsOption } from '@lib/types';

import { RevisionStackParamList } from '../../navigation/Root/types';
import { IRevisionDocument, IRevisionLine } from '../../store/types';
import { IGood, IMGoodData, IMGoodRemain, IRemains } from '../../store/app/types';
import { getBrc, getRemGoodByContact } from '../../utils/helpers';
import { unknownGood } from '../../utils/constants';

const RevisionGoodScreen = () => {
  const docId = useRoute<RouteProp<RevisionStackParamList, 'RevisionGood'>>().params?.docId;
  const navigation = useNavigation<StackNavigationProp<RevisionStackParamList, 'RevisionGood'>>();

  const dispatch = useDispatch();

  const [scaner, setScaner] = useState<IScannedObject>({ state: 'init' });
  const [scannedObject, setScannedObject] = useState<IRevisionLine>();

  const [isButtonBlocked, setIsButtonBlocked] = useState(false);

  useEffect(() => {
    return () => {
      dispatch(appActions.clearFormParams());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: navBackButton,
    });
  }, [navigation]);

  const doc = docSelectors.selectByDocId<IRevisionDocument>(docId);
  const lines = useMemo(() => doc?.lines?.sort((a, b) => (b.sortOrder || 0) - (a.sortOrder || 0)), [doc?.lines]);
  const isBlocked = doc?.status !== 'DRAFT';

  const settings = useSelector((state) => state.settings?.data);
  const prefixGtin = (settings.prefixGtin as ISettingsOption<string>)?.data || '';

  const goods = refSelectors.selectByName<IGood>('good')?.data;

  const remains = refSelectors.selectByName<IRemains>('remains')?.data[0];

  const contactId = useMemo(() => doc?.head?.department?.id, [doc?.head?.department?.id]);

  const [goodRemains] = useState<IMGoodData<IMGoodRemain>>(() =>
    contactId ? getRemGoodByContact(goods, remains[contactId], true) : {},
  );

  const handleGetScannedObject = useCallback(
    (brc: string) => {
      if (!doc) {
        return;
      }

      if (isBlocked) {
        return;
      }

      const line = lines?.find((i) => i.barcode === brc);
      const remItem = getBrc(brc, prefixGtin, goodRemains);

      const scannedGood = {
        id: generateId(),
        barcode: brc,
      };

      if (remItem) {
        if (line) {
          setScaner({
            state: 'error',
            message: `Цена: ${line.price || 0} р., остаток: ${line.remains || 0}\n\nТовар уже добавлен`,
          });
          setScannedObject({
            ...scannedGood,
            good: { id: remItem.good.id, name: remItem.good.name },
            price: line.price || 0,
            remains: line.remains || 0,
          });
          setIsButtonBlocked(true);
          return;
        }

        setScaner({ state: 'found' });
        setScannedObject({
          ...scannedGood,
          good: { id: remItem.good.id, name: remItem.good.name },
          price: remItem.remains?.length ? remItem.remains[0].price : 0,
          remains: remItem.remains?.length ? remItem.remains?.[0].q : 0,
          barcode: remItem.good.barcode || brc || '',
        });
        setIsButtonBlocked(false);
        return;
      }

      const refGood = goods.find((i) => i.barcode === brc);
      if (refGood) {
        if (line) {
          setScaner({ state: 'error', message: `Цена: ${line.price || 0} р.\n\nТовар уже добавлен` });
          setScannedObject({
            ...scannedGood,
            good: { id: refGood.id, name: refGood.name },
            price: line.price || 0,
          });
          setIsButtonBlocked(true);
          return;
        }

        setScaner({ state: 'found' });
        setScannedObject({
          ...scannedGood,
          good: { id: refGood.id, name: refGood.name },
          barcode: brc,
          price: refGood.price || 0,
        });
        setIsButtonBlocked(false);
        return;
      }

      if (line) {
        setIsButtonBlocked(false);
        setScannedObject({
          ...scannedGood,
          good: { id: line.good?.id || unknownGood.id, name: line.good?.name || unknownGood.name },
          price: line.price || 0,
        });
        setScaner({
          state: 'error',
          message: line.withGood
            ? `Штрихкод ${brc} уже привязан\n${line.good?.name || ''}\nЦена: ${line.price || 0} р.`
            : `Штрихкод ${brc} уже добавлен`,
        });
        return;
      }

      setScannedObject({
        ...scannedGood,
        good: { id: unknownGood.id, name: unknownGood.name },
        barcode: brc,
      });
      setScaner({ state: 'error', message: 'Товар не найден' });
      setIsButtonBlocked(false);
    },
    [doc, goodRemains, goods, isBlocked, lines, prefixGtin],
  );

  const [currentLineId, setCurrentLineId] = useState('');
  const good = useSelector((state) => state.app.formParams?.good) as INamedEntity | undefined;

  useEffect(() => {
    if (doc && good && currentLineId) {
      const currentLine = doc.lines?.find((l) => l.id === currentLineId);
      if (currentLine && currentLine.good?.id !== good?.id) {
        dispatch(
          documentActions.updateDocumentLine({
            docId: doc.id,
            line: { ...currentLine, good, withGood: true } as IRevisionLine,
          }),
        );
        setCurrentLineId('');
        dispatch(appActions.setFormParams({ good: undefined }));
      }
    }
  }, [currentLineId, dispatch, doc, good]);

  const handleSaveScannedItem = useCallback(
    (isWithGood: boolean) => {
      if (!scannedObject) {
        return;
      }

      if (!doc || isBlocked) {
        return;
      }
      if (isWithGood) {
        const line = doc.lines.find((i) => i.barcode === scannedObject.barcode);

        if (line) {
          setCurrentLineId(line.id);
          navigation.navigate('SelectRefItem', {
            refName: 'good',
            fieldName: 'good',
          });
        } else {
          const newLine: IRevisionLine = { ...scannedObject, sortOrder: (lines?.[0]?.sortOrder || 0) + 1 };
          dispatch(documentActions.addDocumentLine({ docId, line: newLine }));

          setCurrentLineId(newLine.id);
          navigation.navigate('SelectRefItem', {
            refName: 'good',
            fieldName: 'good',
          });
        }
      } else {
        const line: IRevisionLine = { ...scannedObject, sortOrder: (lines?.[0]?.sortOrder || 0) + 1 };

        dispatch(documentActions.addDocumentLine({ docId, line }));
      }

      setScaner({ state: 'init' });
    },
    [scannedObject, doc, isBlocked, navigation, lines, dispatch, docId],
  );

  const handleClearScaner = () => {
    setScaner({ state: 'init' });
    setIsButtonBlocked(false);
  };

  const isFocused = useIsFocused();
  if (!isFocused) {
    return <AppActivityIndicator />;
  }

  if (!doc) {
    return (
      <View style={[globalStyles.container, globalStyles.alignItemsCenter]}>
        <LargeText>Документ не найден</LargeText>
      </View>
    );
  }

  return (
    <ScanBarcode
      onSave={() => !isButtonBlocked && handleSaveScannedItem(false)}
      onGetScannedObject={handleGetScannedObject}
      onClearScannedObject={handleClearScaner}
      scaner={scaner}
      barCodeTypes={[]}
      showExtraButton={scannedObject?.good?.id === 'unknown'}
      extraButtonIcon="clipboard-text-search-outline"
      extraButtonName="Привязать ТМЦ"
      onPressExtraButton={() => handleSaveScannedItem(true)}
    >
      {scannedObject ? (
        <View style={localStyles.itemInfo}>
          <View style={localStyles.goodInfo}>
            {scannedObject?.good?.id !== 'unknown' ? (
              <>
                <Text style={localStyles.goodName} numberOfLines={3}>
                  {scannedObject?.good?.name || ''}
                </Text>
                <Text style={localStyles.barcode}>{scannedObject?.barcode}</Text>
                <Text style={localStyles.barcode}>
                  цена: {scannedObject?.price || 0} р.
                  {scannedObject?.remains || scannedObject?.remains === 0 ? `, остаток: ${scannedObject?.remains}` : ''}
                </Text>
                {doc?.lines?.find((l) => l.barcode === scannedObject.barcode) ? (
                  <Text style={localStyles.goodName} numberOfLines={3}>
                    Баркод уже добавлен
                  </Text>
                ) : null}
              </>
            ) : (
              <>
                <Text style={localStyles.goodName} numberOfLines={3}>
                  {scannedObject?.barcode}
                </Text>
                <Text style={localStyles.barcode} numberOfLines={3}>
                  {scannedObject?.good?.name || ''}
                </Text>
                {doc?.lines?.find((l) => l.barcode === scannedObject.barcode) ? (
                  <Text style={localStyles.goodName} numberOfLines={3}>
                    Баркод уже добавлен
                  </Text>
                ) : null}
              </>
            )}
          </View>
        </View>
      ) : undefined}
    </ScanBarcode>
  );
};

export default RevisionGoodScreen;

const localStyles = StyleSheet.create({
  itemInfo: {
    flexShrink: 1,
    paddingRight: 10,
  },

  goodInfo: {
    flexShrink: 1,
    paddingRight: 10,
  },
  goodName: {
    color: '#fff',
    fontSize: 18,
    textTransform: 'uppercase',
  },
  barcode: {
    color: '#fff',
    fontSize: 16,
    opacity: 0.5,
  },
});
