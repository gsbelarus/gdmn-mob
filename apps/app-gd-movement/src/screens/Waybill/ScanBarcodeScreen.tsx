import React, { useCallback, useLayoutEffect, useState } from 'react';
import { Alert, View } from 'react-native';

import { useNavigation, RouteProp, useRoute, useIsFocused } from '@react-navigation/native';

import { AppActivityIndicator, globalStyles, LargeText, navBackButton, ScanBarcode } from '@lib/mobile-ui';
import { docSelectors, documentActions, refSelectors, useDispatch, useSelector } from '@lib/store';

import { ISettingsOption } from '@lib/types';

import { generateId } from '@lib/mobile-hooks';

import { StackNavigationProp } from '@react-navigation/stack';

import { IScannedObject } from '@lib/client-types';

import { WaybillStackParamList } from '../../navigation/Root/types';
import { IWaybillDocument, IWaybillLine } from '../../store/types';
import { IGood } from '../../store/app/types';
import { IBarcodeTypes } from '../../utils/constants';

const ScanBarcodeScreen = () => {
  const docId = useRoute<RouteProp<WaybillStackParamList, 'ScanBarcode'>>().params?.docId;
  const navigation = useNavigation<StackNavigationProp<WaybillStackParamList, 'ScanBarcode'>>();
  const dispatch = useDispatch();
  const settings = useSelector((state) => state.settings?.data);

  const prefixGtin = (settings.prefixGtin as ISettingsOption<string>)?.data || '';
  const prefixISN = (settings.prefixISN as ISettingsOption<string>)?.data || '';
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

  const document = docSelectors.selectByDocId<IWaybillDocument>(docId);
  const isBlocked = document?.status !== 'DRAFT';
  const goods = refSelectors.selectByName<IGood>('good')?.data;

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

      if (brc.length === 8 || brc.length === 13) {
        const barcodeLine = document.lines.find(
          (item) => item.barcode === brc && item.checkedQuantity !== item.quantity,
        );

        if (barcodeLine) {
          const newLine: IWaybillLine = {
            ...barcodeLine,
            checked:
              barcodeLine?.checkedQuantity && barcodeLine?.checkedQuantity + 1 === barcodeLine?.quantity ? true : false,
            checkedQuantity: barcodeLine?.checkedQuantity ? barcodeLine?.checkedQuantity + 1 : 1,
          };

          dispatch(documentActions.updateDocumentLine({ docId, line: newLine }));
          setScaner({ state: 'init' });
          return;
        }

        setScaner({ state: 'error', message: 'Позиция данным штрихкодом не найдена.' });
        return;
      }

      const eidLine = document.lines.find(
        (item) => JSON.parse(JSON.stringify(item.EID)) === JSON.parse(JSON.stringify(brc)),
      );
      if (eidLine) {
        const newLine: IWaybillLine = { ...eidLine, checked: true };
        dispatch(documentActions.updateDocumentLine({ docId, line: newLine }));
        setScaner({ state: 'init' });
        return;
      }

      const gtin = brc.match(RegExp(`${prefixGtin}0?\\d{13}${prefixISN}`));

      const good = goods?.find(
        (e) => gtin && (e.barcode === gtin[0].slice(2, -2) || gtin[0].slice(3, -2) === e?.barcode),
      );
      const matchedLine = document.lines.find(
        (item) =>
          (item.barcode === gtin?.[0].slice(2, -2) || gtin?.[0].slice(3, -2) === item?.barcode) &&
          item.checkedQuantity !== item.quantity,
      );

      if (matchedLine) {
        const newLine: IWaybillLine = {
          ...matchedLine,
          checked:
            matchedLine?.checkedQuantity && matchedLine?.checkedQuantity + 1 === matchedLine?.quantity ? true : false,
          checkedQuantity: matchedLine?.checkedQuantity ? matchedLine?.checkedQuantity + 1 : 1,
        };

        dispatch(documentActions.updateDocumentLine({ docId, line: newLine }));
        setScaner({ state: 'init' });
        return;
      }

      Alert.alert(
        `${good ? `${good.name}` : 'Внимание!'} `,
        'Позиция с данным кодом маркировки не найдена.  \n\nДобавить в документ?',
        [
          {
            text: 'ОК',
            onPress: () => {
              const newLine: IWaybillLine = {
                id: generateId(),
                goodId: good?.id || 'unknown',
                added: true,
                sortOrder: (document.lines?.length || 0) + 1,
                EID: brc,
              };
              dispatch(documentActions.addDocumentLine({ docId, line: newLine }));
              setScaner({ state: 'init' });
            },
          },
          {
            text: 'Отмена',
            onPress: () => setScaner({ state: 'init' }),
          },
        ],
      );
    },
    [dispatch, docId, document, goods, isBlocked, prefixGtin, prefixISN],
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
