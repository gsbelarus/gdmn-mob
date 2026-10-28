import React, { useCallback, useLayoutEffect, useState } from 'react';

import { useNavigation, useIsFocused, useRoute, RouteProp, StackActions } from '@react-navigation/native';

import { useSelector, refSelectors, docSelectors, documentActions, useDispatch } from '@lib/store';

import { IDocumentType } from '@lib/types';

import { generateId } from '@lib/mobile-hooks';

import { StackNavigationProp } from '@react-navigation/stack';

import {
  AppActivityIndicator,
  globalStyles,
  LargeText,
  navBackButton,
  ScanBarcode,
  ScanBarcodeReader,
} from '@lib/mobile-ui';

import { View, Text, StyleSheet } from 'react-native';

import { IScannedObject } from '@lib/client-types';

import { ShipmentStackParamList } from '../../navigation/Root/types';
import { IOrderDocument, IShipmentDocument, ITempDocument } from '../../store/types';

import { ICodeEntity } from '../../store/app/types';

import { actions as fpActions } from '../../store/app/actions';
import { useSelector as useFpSelector } from '../../store/index';

import { barCodeTypes } from '../../utils/constants';

const ScanOrderScreen = () => {
  const { isCurr } = useRoute<RouteProp<ShipmentStackParamList, 'ScanOrder'>>().params;

  const shipmentType = refSelectors
    .selectByName<IDocumentType>('documentType')
    ?.data?.find((i) => (isCurr ? i.name === 'currShipment' : i.name === 'shipment'));

  const navigation = useNavigation<StackNavigationProp<ShipmentStackParamList, 'ScanOrder'>>();

  const settings = useSelector((state) => state.settings?.data);

  const dispatch = useDispatch();

  const isScanerReader = settings.scannerUse?.data;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: navBackButton,
    });
  }, [navigation]);

  const orders = docSelectors.selectByDocType<IOrderDocument>('order');
  const docs = useSelector((state) => state.documents.list) as IShipmentDocument[];

  const shipments = docs.filter((i) => i.documentType?.name === 'currShipment' || i.documentType?.name === 'shipment');

  const defaultDepart = useSelector((state) => state.settings?.userData?.depart?.data) as ICodeEntity;

  const tempOrders = useFpSelector((state) => state.fpMovement.list);

  const [scannedObject, setScannedObject] = useState<IOrderDocument>();

  const [scaner, setScaner] = useState<IScannedObject>({ state: 'init' });

  const handleGetScannedObject = useCallback(
    (brc: string) => {
      if (!brc.match(/^-{0,1}\d+$/)) {
        setScaner({ state: 'error', message: 'Штрих-код неверного формата' });
        return;
      }
      const order = orders.find((item) => item.head.barcode === brc);
      if (!order) {
        setScaner({ state: 'error', message: 'Заявка не найдена' });
        return;
      }

      const shipment = shipments.find((i) => i.head.orderId === order.id);

      if (shipment) {
        setScaner({ state: 'error', message: 'Заявка уже добавлена' });
        setScannedObject(shipment);
        return;
      } else {
        if (new Date(order.head.onDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0)) {
          setScaner({ state: 'error', message: 'Нельзя выбрать дату меньше текущей' });
          return;
        }
        setScannedObject(order);
        setScaner({ state: 'found' });
      }

      // if (shipment) {
      //   navigation.dispatch(
      //     StackActions.replace('ShipmentView', {
      //       id: shipment.id,
      //       isCurr,
      //     }),
      //   );
      // }

      const tempOrder = tempOrders.find((i) => i.orderId === order.head.orderId);
      if (!tempOrder) {
        const newTempOrder: ITempDocument = {
          id: generateId(),
          orderId: order.id,
          lines: order.lines,
        };

        dispatch(fpActions.addTempOrder(newTempOrder));
      }

      const depart = defaultDepart || order.head.depart;

      const shipmentDoc: IShipmentDocument = {
        id: generateId(),
        documentType: shipmentType!,
        number: order.number,
        documentDate: new Date().toISOString(),
        status: 'DRAFT',
        head: {
          barcode: order.head.barcode,
          contact: order.head.contact,
          fromDepart: depart,
          outlet: order.head.outlet,
          onDate: order.head.onDate,
          orderId: order.id,
        },
        lines: [],
        creationDate: new Date().toISOString(),
        editionDate: new Date().toISOString(),
      };

      dispatch(documentActions.addDocument(shipmentDoc));

      if (depart) {
        navigation.dispatch(
          StackActions.replace('ShipmentView', {
            id: shipmentDoc.id,
            isCurr,
          }),
        );
      } else {
        navigation.dispatch(
          StackActions.replace('ShipmentEdit', {
            id: shipmentDoc.id,
            isCurr,
          }),
        );
      }
    },
    [orders, shipments, tempOrders, defaultDepart, shipmentType, dispatch, navigation, isCurr],
  );

  const handleClearScaner = () => setScaner({ state: 'init' });

  const handleNavigate = useCallback(() => {
    if (scannedObject && scannedObject?.id) {
      navigation.navigate('ShipmentView', { id: scannedObject?.id, isCurr });
    }
  }, [isCurr, navigation, scannedObject]);

  const ScanItem = useCallback(
    () =>
      scannedObject ? (
        <View style={localStyles.itemInfo}>
          <Text style={localStyles.barcode}>{scannedObject.head.barcode}</Text>
          <Text style={localStyles.itemName} numberOfLines={3}>
            {scannedObject.head.outlet.name}
          </Text>
        </View>
      ) : null,
    [scannedObject],
  );

  const isFocused = useIsFocused();
  if (!isFocused) {
    return <AppActivityIndicator />;
  }

  if (!shipmentType) {
    return (
      <View style={globalStyles.container}>
        <View style={globalStyles.containerCenter}>
          <LargeText>Тип документа для отвесов не найден</LargeText>
        </View>
      </View>
    );
  }

  return (
    <>
      {isScanerReader ? (
        <ScanBarcodeReader
          onGetScannedObject={handleGetScannedObject}
          onClearScannedObject={handleClearScaner}
          scaner={scaner}
          onErrorSave={handleNavigate}
          isErrorTouchable={true}
        >
          <ScanItem />
        </ScanBarcodeReader>
      ) : (
        <ScanBarcode
          onGetScannedObject={handleGetScannedObject}
          onClearScannedObject={handleClearScaner}
          scaner={scaner}
          barCodeTypes={barCodeTypes}
        >
          <ScanItem />
        </ScanBarcode>
      )}
    </>
  );
};

export default ScanOrderScreen;

const localStyles = StyleSheet.create({
  itemInfo: {
    flexShrink: 1,
    paddingRight: 10,
  },
  itemName: {
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
