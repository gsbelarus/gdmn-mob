import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';

import { useNavigation, RouteProp, useRoute, useIsFocused } from '@react-navigation/native';

import { AppActivityIndicator, globalStyles, LargeText, MediumText, navBackButton, ScanBarcode } from '@lib/mobile-ui';
import { docSelectors, useDispatch, documentActions, useSelector, appActions } from '@lib/store';

import { StackNavigationProp } from '@react-navigation/stack';

import { IScannedObject } from '@lib/client-types';

import { generateId } from '@lib/mobile-hooks';

import { INamedEntity } from '@lib/types';

import { ScanStackParamList } from '../../navigation/Root/types';
import { IScanLine, IScanDocument } from '../../store/types';

const ScanGoodScreen = () => {
  const docId = useRoute<RouteProp<ScanStackParamList, 'ScanGood'>>().params?.docId;
  const navigation = useNavigation<StackNavigationProp<ScanStackParamList, 'ScanGood'>>();

  const dispatch = useDispatch();

  const [scaner, setScaner] = useState<IScannedObject>({ state: 'init' });
  const [scannedObject, setScannedObject] = useState<IScanLine>();

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

  const doc = docSelectors.selectByDocId<IScanDocument>(docId);
  const isBlocked = doc?.status !== 'DRAFT';

  const handleGetScannedObject = useCallback(
    (brc: string) => {
      if (!doc) {
        return;
      }

      if (isBlocked) {
        return;
      }

      if (doc.head.isBindGood && doc?.lines?.find((l) => l.barcode === brc)) {
        setScaner({
          state: 'error',
          message: 'Баркод  уже добавлен',
        });
        return;
      }

      setScannedObject({ id: generateId(), barcode: brc });

      setScaner({ state: 'found' });
    },
    [doc, isBlocked],
  );

  const [currentLineId, setCurrentLineId] = useState('');
  const good = useSelector((state) => state.app.formParams?.good) as INamedEntity | undefined;

  useEffect(() => {
    if (doc?.head.isBindGood && currentLineId) {
      const currentLine = doc.lines?.find((l) => l.id === currentLineId);
      if (currentLine && currentLine.good?.id !== good?.id) {
        dispatch(
          documentActions.updateDocumentLine({
            docId: doc.id,
            line: { ...currentLine, good } as IScanLine,
          }),
        );
        setCurrentLineId('');
        dispatch(appActions.setFormParams({ good: undefined }));
      }
    }
  }, [currentLineId, dispatch, doc, good]);

  const handleSaveScannedItem = useCallback(() => {
    if (!scannedObject) {
      return;
    }

    if (!doc || isBlocked) {
      return;
    }

    const line: IScanLine = { ...scannedObject, sortOrder: (doc.lines?.length || 0) + 1 };

    dispatch(documentActions.addDocumentLine({ docId, line }));

    if (doc.head.isBindGood) {
      setCurrentLineId(line.id);
      navigation.navigate('SelectRefItem', {
        refName: 'good',
        fieldName: 'good',
      });
    }

    setScaner({ state: 'init' });
  }, [scannedObject, doc, isBlocked, dispatch, docId, navigation]);

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
          <MediumText style={localStyles.text}>{scannedObject.barcode}</MediumText>
        </View>
      ) : undefined}
    </ScanBarcode>
  );
};

export default ScanGoodScreen;

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
