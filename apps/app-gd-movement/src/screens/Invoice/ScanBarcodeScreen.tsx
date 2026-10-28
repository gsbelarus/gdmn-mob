import React, { useCallback, useLayoutEffect, useState } from 'react';
import { View } from 'react-native';

import { useNavigation, RouteProp, useRoute, useIsFocused } from '@react-navigation/native';

import { AppActivityIndicator, globalStyles, LargeText, navBackButton, ScanBarcode } from '@lib/mobile-ui';
import { docSelectors, useSelector } from '@lib/store';

import { ISettingsOption } from '@lib/types';

import { StackNavigationProp } from '@react-navigation/stack';

import { IScannedObject } from '@lib/client-types';

import { InvoiceStackParamList } from '../../navigation/Root/types';
import { IInvoiceDocument } from '../../store/types';
import { IBarcodeTypes } from '../../utils/constants';

const ScanBarcodeScreen = () => {
  const docId = useRoute<RouteProp<InvoiceStackParamList, 'ScanBarcode'>>().params?.docId;
  const navigation = useNavigation<StackNavigationProp<InvoiceStackParamList, 'ScanBarcode'>>();
  const settings = useSelector((state) => state.settings?.data);

  const barcodeTypes =
    (settings.barcodeTypes as ISettingsOption<Array<IBarcodeTypes>>)?.data
      ?.filter((t) => t.selected)
      .map((t) => t.type) || [];

  const [scaner, setScaner] = useState<IScannedObject>({ state: 'init' });
  const handleClearScaner = () => setScaner({ state: 'init' });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: navBackButton,
    });
  }, [navigation]);

  const document = docSelectors.selectByDocId<IInvoiceDocument>(docId);
  const isBlocked = document?.status !== 'DRAFT';

  const getScannedObject = useCallback(
    (brc: string, typeOk = true) => {
      if (!document) {
        return;
      }

      if (isBlocked) {
        return;
      }

      if (!brc) {
        return;
      }

      if (!typeOk) {
        setScaner({
          state: 'error',
          message: 'Неверный тип штрихкода',
        });
        return;
      }

      const line = document.lines.find((item) => item.barcode === brc);

      if (!line) {
        setScaner({ state: 'error', message: 'Позиция с данным товаром не найдена' });
        return;
      }

      navigation.navigate('InvoiceLine', { mode: 1, docId, item: line });
      setScaner({ state: 'init' });
    },
    [docId, document, isBlocked, navigation],
  );

  const isFocused = useIsFocused();
  if (!isFocused) {
    return <AppActivityIndicator />;
  }

  if (!document) {
    return (
      <View style={[globalStyles.container, globalStyles.alignItemsCenter]}>
        <LargeText>Документ не найден</LargeText>
      </View>
    );
  }

  return (
    <ScanBarcode
      onGetScannedObject={getScannedObject}
      onClearScannedObject={handleClearScaner}
      scaner={scaner}
      barCodeTypes={barcodeTypes}
    />
  );
};

export default ScanBarcodeScreen;
