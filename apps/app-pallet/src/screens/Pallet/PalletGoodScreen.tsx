import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';

import { useNavigation, RouteProp, useRoute, useIsFocused } from '@react-navigation/native';

import { AppActivityIndicator, globalStyles, LargeText, MediumText, navBackButton, ScanBarcode } from '@lib/mobile-ui';
import { docSelectors, useDispatch, documentActions, appActions, useSelector, refSelectors } from '@lib/store';

import { StackNavigationProp } from '@react-navigation/stack';

import { IScannedObject } from '@lib/client-types';

import { generateId } from '@lib/mobile-hooks';

import { PalletStackParamList } from '../../navigation/Root/types';
import { IPalletLine, IPalletDocument } from '../../store/types';
import { ILabel } from '../../store/app/types';
import {
  isLegacyNumericBarcode,
  isMarkingCode,
  isPalletMarkDuplicate,
  resolvePalletMark,
} from '../../utils/markingCodeHelpers';

const EMPTY_LABELS: ILabel[] = [];

const PalletGoodScreen = () => {
  const docId = useRoute<RouteProp<PalletStackParamList, 'PalletGood'>>().params?.docId;
  const navigation = useNavigation<StackNavigationProp<PalletStackParamList, 'PalletGood'>>();

  const dispatch = useDispatch();

  const [scaner, setScaner] = useState<IScannedObject>({ state: 'init' });
  const [scannedObject, setScannedObject] = useState<IPalletLine>();

  const prefixErp = useSelector((state) => state.settings?.data?.prefixErp?.data);
  const prefixS = useSelector((state) => state.settings?.data?.prefixS?.data);
  const labels = refSelectors.selectByName<ILabel>('label')?.data ?? EMPTY_LABELS;

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

  const doc = docSelectors.selectByDocId<IPalletDocument>(docId);

  const handleGetScannedObject = useCallback(
    (brc: string) => {
      if (!isLegacyNumericBarcode(brc)) {
        const markingResult = resolvePalletMark(brc, labels);

        if (markingResult.kind === 'not_found') {
          setScaner({
            state: 'error',
            message: isMarkingCode(brc) ? 'Код маркировки не найден' : 'Баркод неверного формата',
          });
          return;
        }

        if (markingResult.kind === 'found') {
          const { label, markCode } = markingResult;

          if (isPalletMarkDuplicate(markCode, doc?.lines)) {
            setScaner({
              state: 'error',
              message: 'Данный код маркировки уже добавлен',
            });
            return;
          }

          setScannedObject({
            id: generateId(),
            barcode: '',
            mark: { id: label.id, code: label.code },
          });
          setScaner({ state: 'found' });
          return;
        }
      }

      if (brc.slice(0, 2) !== prefixErp && brc.slice(0, 2) !== prefixS) {
        setScaner({
          state: 'error',
          message: 'Баркод  неверного формата',
        });
        return;
      }
      if (doc?.lines?.find((l) => l.barcode === brc)) {
        setScaner({
          state: 'error',
          message: 'Баркод  уже добавлен',
        });
        return;
      }

      setScannedObject({ id: generateId(), barcode: brc });

      setScaner({ state: 'found' });
    },
    [doc?.lines, labels, prefixErp, prefixS],
  );

  const handleSaveScannedItem = useCallback(() => {
    if (!scannedObject) {
      return;
    }

    if (!doc) {
      return;
    }

    const line: IPalletLine = { ...scannedObject, sortOrder: doc.lines?.length + 1 };

    dispatch(documentActions.addDocumentLine({ docId, line }));

    setScaner({ state: 'init' });
  }, [scannedObject, doc, dispatch, docId]);

  const handleClearScaner = () => setScaner({ state: 'init' });

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
      onSave={handleSaveScannedItem}
      onGetScannedObject={handleGetScannedObject}
      onClearScannedObject={handleClearScaner}
      scaner={scaner}
      barCodeTypes={[]}
    >
      {scannedObject ? (
        <View style={localStyles.itemInfo}>
          <MediumText style={localStyles.text}>{scannedObject.mark?.code || scannedObject.barcode}</MediumText>
        </View>
      ) : undefined}
    </ScanBarcode>
  );
};

export default PalletGoodScreen;

const localStyles = StyleSheet.create({
  itemInfo: {
    flexShrink: 1,
    paddingRight: 10,
  },
  text: {
    color: '#fff',
    textTransform: 'uppercase',
  },
});
