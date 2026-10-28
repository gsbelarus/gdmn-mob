import React, { useCallback, useMemo, useState } from 'react';
import { View, Alert, StyleSheet, Modal, SafeAreaView } from 'react-native';

import { documentActions, docSelectors, refSelectors, useDispatch, useSelector } from '@lib/store';
import { SaveButton } from '@lib/mobile-ui';

import { IconButton, Title } from 'react-native-paper';

import { ScreenState } from '@lib/types';

import { useTheme } from '@react-navigation/native';

import { formatValue, round } from '@lib/mobile-hooks';

import { IContact, IDebt, IOrderDocument, IOrderLine, IPackageGood } from '../../../store/types';

import { getOrderSumVat } from '../../../utils/helpers';

import OrderLine from './OrderLine';

export interface IOrderItemLine {
  mode: number;
  docId: string;
  item: IOrderLine;
}

interface IProps {
  orderLine: IOrderItemLine;
  onDismiss: () => void;
  isUseRemains?: boolean;
  isUseUnitMeasure?: boolean;
}

const OrderLineEdit = ({ orderLine, onDismiss, isUseRemains = false, isUseUnitMeasure = true }: IProps) => {
  const dispatch = useDispatch();
  const { mode, item, docId } = orderLine;

  const [line, setLine] = useState<IOrderLine>(item);
  const [screenState, setScreenState] = useState<ScreenState>('idle');
  const { colors } = useTheme();

  const packages = refSelectors
    .selectByName<IPackageGood>('packageGood')
    ?.data?.filter((e) => e.good.id === item.good.id);

  const doc = docSelectors.selectByDocId<IOrderDocument>(docId);
  const contactId = doc?.head?.contact.id;
  const limitSum = refSelectors.selectByRefId<IContact>('contact', contactId)?.limitSum;
  const saldo = refSelectors.selectByRefId<IDebt>('debt', contactId)?.saldo ?? 0;
  const isUseLimitControl = useSelector((state) => state.settings.data.isUseLimitControl?.data) as boolean;
  const docs = useSelector((state) => state.documents.list) as IOrderDocument[];

  //Сумма позиций других незавизированных (DRAFT/READY) заявок того же договора -
  //они тоже расходуют доступный лимит
  const othersUnsentSum = useMemo(() => {
    if (!isUseLimitControl || !Number(limitSum) || !contactId) {
      return 0;
    }
    return docs.reduce((sum, o) => {
      if (o.id !== docId && o.head?.contact?.id === contactId && (o.status === 'DRAFT' || o.status === 'READY')) {
        sum += getOrderSumVat(o.lines ?? [], isUseUnitMeasure);
      }
      return sum;
    }, 0);
  }, [docs, docId, contactId, limitSum, isUseLimitControl, isUseUnitMeasure]);

  const handleSaveLine = useCallback(() => {
    setScreenState('saving');
    const { priceRed, ...good } = line.good;
    const lineForSave: IOrderLine = {
      ...line,
      good: typeof priceRed === 'number' ? { ...good, priceFsn: priceRed } : good,
    };

    const saveLine = () => {
      if (line.quantity) {
        dispatch(
          mode === 0
            ? documentActions.addDocumentLine({ docId, line: lineForSave })
            : documentActions.updateDocumentLine({ docId, line: lineForSave }),
        );
        setScreenState('idle');
        onDismiss();
      } else {
        Alert.alert('Внимание!', 'В позиции не указан вес товара.\nВсе равно продолжить сохранение?', [
          {
            text: 'Да',
            onPress: () => {
              dispatch(
                mode === 0
                  ? documentActions.addDocumentLine({ docId, line: lineForSave })
                  : documentActions.updateDocumentLine({ docId, line: lineForSave }),
              );
              setScreenState('idle');
              onDismiss();
            },
          },
          { text: 'Отмена', onPress: () => setScreenState('idle') },
        ]);
      }
    };

    if (!line.package && packages?.length > 0) {
      Alert.alert('Ошибка!', 'Не указана упаковка', [{ text: 'Ок' }]);
      setScreenState('idle');
      return;
    }
    if (line.quantity < 0) {
      Alert.alert('Ошибка!', 'Вес товара не может быть меньше нуля!', [{ text: 'Ок' }]);
      setScreenState('idle');
      return;
    }
    if (isUseRemains && typeof line.remains !== 'number') {
      Alert.alert('Ошибка!', 'Товар отсутствует в остатках.', [{ text: 'Ок' }]);
      setScreenState('idle');
      return;
    }

    //Контроль лимита задолженности: лимит минус текущая задолженность минус суммы
    //других неотправленных заявок договора - на остаток можно набирать
    const limit = Number(limitSum);
    if (isUseLimitControl && limit) {
      const newSum =
        othersUnsentSum +
        getOrderSumVat([...(doc?.lines ?? []).filter((l) => l.id !== line.id), lineForSave], isUseUnitMeasure);
      const oldSum = othersUnsentSum + getOrderSumVat(doc?.lines ?? [], isUseUnitMeasure);
      const excess = round(newSum + saldo - limit, 2);
      if (excess > 0 && newSum > oldSum) {
        Alert.alert(
          'Внимание! Превышение лимита!',
          `Лимит превышен на сумму ${formatValue(
            { type: 'currency', decimals: 2 },
            excess,
          )}. Всё равно сохранить позицию?`,
          [
            {
              text: 'Да',
              onPress: saveLine,
            },
            { text: 'Отмена', onPress: () => setScreenState('idle') },
          ],
        );
        return;
      }
    }

    saveLine();
  }, [
    dispatch,
    doc,
    docId,
    isUseLimitControl,
    isUseRemains,
    isUseUnitMeasure,
    line,
    limitSum,
    mode,
    onDismiss,
    othersUnsentSum,
    packages?.length,
    saldo,
  ]);

  return (
    <Modal animationType="fade" visible={true}>
      <SafeAreaView style={localStyles.container}>
        <View style={localStyles.container1}>
          <View style={localStyles.navigation}>
            <IconButton icon="chevron-left" onPress={onDismiss} size={30} />
            <Title>Позиция заявки</Title>
            <View style={localStyles.btnOk}>
              <SaveButton onPress={handleSaveLine} disabled={screenState === 'saving'} />
            </View>
          </View>
          <View style={[{ backgroundColor: colors.background }, localStyles.orderLineItem]}>
            <OrderLine
              item={line}
              packages={packages}
              onSetLine={setLine}
              isUseRemains={isUseRemains}
              isUseUnitMeasure={isUseUnitMeasure}
            />
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

export default OrderLineEdit;

const localStyles = StyleSheet.create({
  container1: {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    display: 'flex',
    backgroundColor: 'transparent',
  },
  btnOk: {
    flex: 1,
    alignItems: 'flex-end',
  },
  container: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  orderLineItem: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
  },
});
