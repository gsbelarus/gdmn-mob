import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { useNavigation, RouteProp, useRoute, useIsFocused } from '@react-navigation/native';

import { AppActivityIndicator, globalStyles, LargeText, navBackButton, ScanBarcode } from '@lib/mobile-ui';
import { useSelector, refSelectors, useDispatch, documentActions } from '@lib/store';

import { IDocumentType, ISettingsOption } from '@lib/types';

import { generateId } from '@lib/mobile-hooks';

import { StackNavigationProp } from '@react-navigation/stack';

import { IScannedObject } from '@lib/client-types';

import { DocStackParamList } from '../../navigation/Root/types';
import { IMovementLine, IMovementDocument } from '../../store/types';
import { IGood, IMGoodData, IMGoodRemain, IRemains } from '../../store/app/types';
import { getBrc, getDataMarkType, getRemGoodByContact } from '../../utils/helpers';
import { IBarcodeTypes, unknownGood } from '../../utils/constants';
import { appInventoryActions, useSelector as useInvSelector } from '../../store';

const ScanBarcodeScreen = () => {
  const docId = useRoute<RouteProp<DocStackParamList, 'ScanBarcode'>>().params?.docId;
  const navigation = useNavigation<StackNavigationProp<DocStackParamList, 'ScanBarcode'>>();
  const dispatch = useDispatch();
  const settings = useSelector((state) => state.settings?.data);

  const showZeroRemains = settings?.showZeroRemains?.data;
  const isInputQuantity = settings?.quantityInput?.data;
  const lineConfirm = settings?.lineConfirm?.data;

  const prefixGtin = (settings.prefixGtin as ISettingsOption<string>)?.data || '';
  const prefixISN = (settings.prefixISN as ISettingsOption<string>)?.data || '';
  const weightSettingsWeightCode = (settings.weightCode as ISettingsOption<string>) || '';
  const weightSettingsCountCode = (settings.countCode as ISettingsOption<number>)?.data || 0;
  const weightSettingsCountWeight = (settings.countWeight as ISettingsOption<number>)?.data || 0;
  const barcodeTypes =
    (settings.barcodeTypes as ISettingsOption<Array<IBarcodeTypes>>)?.data
      ?.filter((t) => t.selected)
      .map((t) => t.type) || [];

  const unknownGoods = useInvSelector((state) => state.appInventory.unknownGoods);

  const [scaner, setScaner] = useState<IScannedObject>({ state: 'init' });
  const handleClearScaner = () => setScaner({ state: 'init' });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: navBackButton,
    });
  }, [navigation]);

  const handleShowRemains = useCallback(() => {
    navigation.navigate('SelectRemainsItem', { docId });
  }, [docId, navigation]);

  const document = useSelector((state) => state.documents.list).find((item) => item.id === docId) as IMovementDocument;

  const lines = useMemo(
    () => document?.lines?.sort((a, b) => (b.sortOrder || 0) - (a.sortOrder || 0)),
    [document?.lines],
  );
  const isBlocked = document?.status !== 'DRAFT';

  const goods = refSelectors.selectByName<IGood>('good')?.data;
  const remains = refSelectors.selectByName<IRemains>('remains')?.data[0];

  const documentTypes = refSelectors.selectByName<IDocumentType>('documentType')?.data;
  const documentType = useMemo(
    () => documentTypes?.find((d) => d.id === document?.documentType.id),
    [document?.documentType.id, documentTypes],
  );

  const contactId = useMemo(
    () =>
      documentType?.remainsField === 'fromContact' ? document?.head?.fromContact?.id : document?.head?.toContact?.id,
    [document?.head?.fromContact?.id, document?.head?.toContact?.id, documentType?.remainsField],
  );

  const noZeroRemains = useMemo(
    () => !!documentType?.isControlRemains && !showZeroRemains && !!documentType?.isRemains,
    [documentType?.isControlRemains, documentType?.isRemains, showZeroRemains],
  );

  const goodRemains = useMemo<IMGoodData<IMGoodRemain>>(
    () =>
      contactId
        ? getRemGoodByContact(
            goods.concat(unknownGoods.map((item) => item.good)),
            remains[contactId],
            documentType?.isRemains,
            noZeroRemains,
          )
        : {},
    [contactId, documentType?.isRemains, goods, noZeroRemains, remains, unknownGoods],
  );

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

      const dataMarkType = getDataMarkType(brc, prefixGtin, prefixISN);

      let charFrom = 0;
      let charTo = weightSettingsWeightCode.data.length;

      let scannedObject: IMovementLine;

      if (brc.substring(charFrom, charTo) !== weightSettingsWeightCode.data) {
        const remItem =
          getBrc(brc, prefixGtin, goodRemains, prefixISN) ||
          (documentType?.isRemains ? undefined : { good: { ...unknownGood, barcode: brc } });

        if (!remItem) {
          setScaner({
            state: 'error',
            message: dataMarkType === '2' ? 'Товар не найден. Возможно отсканирован код УКЗ.' : 'Товар не найден',
          });
          return;
        }

        scannedObject = {
          good: { id: remItem.good.id, name: remItem.good.name },
          id: generateId(),
          quantity: dataMarkType === '1' ? 1 : isInputQuantity ? 1 : 0,
          price: remItem.remains?.length ? remItem.remains[0].price : 0,
          buyingPrice: remItem.remains?.length ? remItem.remains[0].buyingPrice : 0,
          remains: remItem.remains?.length ? remItem.remains?.[0].q : 0,
          barcode: remItem.good.barcode,
          sortOrder: (lines?.[0]?.sortOrder || 0) + 1,
          alias: remItem.good.alias || '',
          weightCode: remItem.good.weightCode?.trim() || '',
          EID: dataMarkType === '1' ? brc : undefined,
        };
      } else {
        charFrom = charTo;
        charTo = charFrom + weightSettingsCountCode;
        const code = Number(brc.substring(charFrom, charTo)).toString();

        charFrom = charTo;
        charTo = charFrom + weightSettingsCountWeight;

        const qty = Number(brc.substring(charFrom, charTo)) / 1000;

        const remItem =
          Object.values(goodRemains)?.find((item: IMGoodRemain) => item.good.weightCode?.trim() === code) ||
          (documentType?.isRemains ? undefined : { good: { ...unknownGood, barcode: brc } });

        if (!remItem) {
          setScaner({ state: 'error', message: 'Товар не найден' });
          return;
        }

        scannedObject = {
          good: { id: remItem.good.id, name: remItem.good.name },
          id: generateId(),
          quantity: qty,
          price: remItem.remains?.length ? remItem.remains[0].price : 0,
          buyingPrice: remItem.remains?.length ? remItem.remains[0].buyingPrice : 0,
          remains: remItem.remains?.length ? remItem.remains?.[0].q : 0,
          barcode: remItem.good.barcode,
          sortOrder: (lines?.[0]?.sortOrder || 0) + 1,
          alias: remItem.good.alias || '',
          weightCode: remItem.good.weightCode?.trim() || '',
          EID: dataMarkType === '1' ? brc : undefined,
        };
      }

      if (lineConfirm) {
        navigation.navigate('DocLine', {
          mode: 0,
          docId,
          item: scannedObject,
        });
      } else {
        let newLine = { ...scannedObject, quantity: 1 };
        if (scannedObject.good.id === 'unknown') {
          const newLineId = `unknown_${generateId()}`;
          dispatch(
            appInventoryActions.addUnknownGood({
              ...unknownGood,
              ...scannedObject.good,
              barcode: scannedObject.barcode,
              id: newLineId,
            }),
          );
          newLine = { ...newLine, good: { ...newLine.good, id: newLineId } };
        }
        dispatch(documentActions.addDocumentLine({ docId, line: newLine }));
      }

      setScaner({ state: 'init' });
    },
    [
      dispatch,
      docId,
      document,
      documentType?.isRemains,
      goodRemains,
      isBlocked,
      isInputQuantity,
      lineConfirm,
      lines,
      navigation,
      prefixGtin,
      prefixISN,
      weightSettingsCountCode,
      weightSettingsCountWeight,
      weightSettingsWeightCode.data,
    ],
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
      onSearch={handleShowRemains}
    />
  );
};

export default ScanBarcodeScreen;
