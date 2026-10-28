import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Alert, View, StyleSheet } from 'react-native';
import { RouteProp, useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { docSelectors, documentActions, refSelectors, useDispatch, useDocThunkDispatch, useSelector } from '@lib/store';
import {
  AddButton,
  MenuButton,
  useActionSheet,
  globalStyles as styles,
  InfoBlock,
  SendButton,
  MediumText,
  AppActivityIndicator,
  DeleteButton,
  CloseButton,
  LargeText,
  navBackButton,
  ItemSeparator,
  SaveDocument,
  SimpleDialog,
  globalColors,
  DateInfo,
} from '@lib/mobile-ui';

import {
  formatValue,
  generateId,
  getDateString,
  useSendDocs,
  keyExtractor,
  sleep,
  useSendOneRefRequest,
  round,
} from '@lib/mobile-hooks';

import { INamedEntity, ScreenState } from '@lib/types';

import { useTheme, MD2Theme } from 'react-native-paper';

import { FlashList } from '@shopify/flash-list';

import {
  IContact,
  IDebt,
  IGood,
  IGoodGroup,
  IOrderDocument,
  IOrderLine,
  IOutlet,
  IPackageGood,
  IRouteDocument,
  IVisitDocument,
  visitDocumentType,
} from '../../store/types';

import { OrdersStackParamList } from '../../navigation/Root/types';

import { getStatusColor } from '../../utils/constants';

import { getNextDocNumber, getOrderSumVat, totalList, totalListByGroup } from '../../utils/helpers';

import { ICoords } from '../../store/geo/types';

import { getCurrentPosition } from '../../utils/expoFunctions';

import OrderItem from './components/OrderItem';
import OrderTotal from './components/OrderTotal';
import OrderLineEdit, { IOrderItemLine } from './components/OrderLineEdit';
import { OrderCopyDialog } from './components/OrderCopyDialog';

export type ICheckedLines = {
  copyLines: IOrderLine[];
  absentLines: IOrderLine[];
};

const OrderViewScreen = () => {
  const showActionSheet = useActionSheet();
  const docDispatch = useDocThunkDispatch();
  const navigation = useNavigation<StackNavigationProp<OrdersStackParamList, 'OrderView'>>();
  const { id, routeId, readonly } = useRoute<RouteProp<OrdersStackParamList, 'OrderView'>>().params;

  const dispatch = useDispatch();

  const [screenState, setScreenState] = useState<ScreenState>('idle');
  const [delList, setDelList] = useState<string[]>([]);
  const isDelList = !!Object.keys(delList).length;

  const [isDateVisible, setIsDateVisible] = useState(false);

  const [isGroupVisible, setIsGroupVisible] = useState(false);
  const loading = useSelector((state) => state.app.loading);
  const order = docSelectors.selectByDocId<IOrderDocument>(id);

  const isBlocked = readonly || order?.status !== 'DRAFT';

  const debt = refSelectors.selectByRefId<IDebt>('debt', order?.head?.contact.id);

  const { colors } = useTheme<MD2Theme>();

  const debtTextStyle = { color: debt?.saldoDebt && debt?.saldoDebt > 0 ? colors.error : colors.text };

  const contact = refSelectors.selectByRefId<IContact>('contact', order?.head?.contact.id);

  const address = refSelectors.selectByRefId<IOutlet>('outlet', order?.head?.outlet.id)?.address;
  const limitSum = refSelectors.selectByRefId<IContact>('contact', order?.head?.contact.id)?.limitSum;

  const packages = refSelectors.selectByName<IPackageGood>('packageGood')?.data;
  const goods = refSelectors.selectByName<IGood>('good')?.data;
  const goodGroups = refSelectors.selectByName<IGoodGroup>('goodGroup')?.data;

  const settings = useSelector((state) => state.settings.data);
  const isUseRemains = settings?.isUseRemains?.data as boolean;
  const isUseUnitMeasure = (settings?.isUseUnitMeasure?.data ?? true) as boolean;
  const isUseLimitControl = (settings?.isUseLimitControl?.data ?? true) as boolean;
  const depart = refSelectors.selectByRefId<INamedEntity>('department', order?.head?.depart?.id)?.name;

  const docs = useSelector((state) => state.documents.list) as IOrderDocument[];

  const orderTotalSum = useMemo(() => {
    if (!isUseLimitControl || !Number(limitSum) || !order) {
      return 0;
    }
    const firstLevelGroups = goodGroups?.filter((item) => !item.parent?.id);
    const total = totalList(
      totalListByGroup(firstLevelGroups, goodGroups, order.lines, isUseUnitMeasure, isUseRemains),
    );

    return total?.sumVat || 0;
  }, [isUseLimitControl, limitSum, order, goodGroups, isUseUnitMeasure, isUseRemains]);

  //Сумма позиций других незавизированных (DRAFT/READY) заявок того же договора -
  //они тоже расходуют доступный лимит
  const othersUnsentSum = useMemo(() => {
    if (!isUseLimitControl || !Number(limitSum) || !order?.head?.contact.id) {
      return 0;
    }
    return docs.reduce((sum, o) => {
      if (
        o.id !== id &&
        o.head?.contact?.id === order.head.contact.id &&
        (o.status === 'DRAFT' || o.status === 'READY')
      ) {
        sum += getOrderSumVat(o.lines ?? [], isUseUnitMeasure);
      }
      return sum;
    }, 0);
  }, [docs, id, order?.head?.contact.id, limitSum, isUseLimitControl, isUseUnitMeasure]);

  //Доступно по лимиту: лимит минус задолженность минус другие неотправленные заявки;
  //limitExceeded - на сколько текущая заявка превышает остаток
  const limitExceeded = useMemo(() => {
    const limit = Number(limitSum);
    if (!isUseLimitControl || !limit) {
      return 0;
    }
    const excess = round(othersUnsentSum + orderTotalSum + (debt?.saldo ?? 0) - limit, 2);

    return excess > 0 ? excess : 0;
  }, [isUseLimitControl, limitSum, othersUnsentSum, orderTotalSum, debt?.saldo]);

  const handleAddOrderLine = useCallback(() => {
    if (limitExceeded) {
      setVisibleLimitDialog(true);
    } else {
      navigation.navigate('SelectGood', {
        docId: id,
      });
    }
  }, [limitExceeded, id, navigation]);

  const handleAddExceededLimit = useCallback(() => {
    setVisibleLimitDialog(false);
    navigation.navigate('SelectGood', {
      docId: id,
    });
  }, [id, navigation]);

  const handleEditOrderHead = useCallback(() => {
    navigation.navigate('OrderEdit', { id, routeId });
  }, [navigation, id, routeId]);

  const orderList = docSelectors.selectByDocType<IOrderDocument>('order');

  const route = docSelectors.selectByDocId<IRouteDocument>(routeId);

  const routeLineId = route?.lines.find((i) => i.outlet.id === order?.head.outlet.id)?.id;

  const visit = docSelectors.selectByDocType<IVisitDocument>('visit')?.find((e) => e.head.routeLineId === routeLineId);

  const [visibleDebtDialog, setVisibleDebtDialog] = useState(false);
  const [visibleLimitDialog, setVisibleLimitDialog] = useState(false);

  const sendRequest = useSendOneRefRequest('Дебиторская задолженность', {
    name: 'debt',
    contactId: order?.head?.contact?.id,
  });

  const handleSendDebtRequest = useCallback(async () => {
    setVisibleDebtDialog(false);
    await sendRequest();
  }, [sendRequest]);

  const sendRemainsRequest = useSendOneRefRequest('Остатки', { name: 'remains' });

  const handleSendRemainsRequest = useCallback(async () => {
    if (isUseRemains) {
      try {
        await sendRemainsRequest();
      } catch (e) {
        console.warn('Не удалось обновить остатки', e);
      }
    }
  }, [isUseRemains, sendRemainsRequest]);

  const handleOpenDebtDialog = () => {
    setVisibleDebtDialog(true);
  };

  const [visibleCopyDialog, setVisibleCopyDialog] = useState(false);
  const [absentLines, setAbsentLines] = useState<IOrderLine[]>([]);
  const [copyLines, setCopyLines] = useState<IOrderLine[]>([]);

  const handleCopyOrder = useCallback(async () => {
    if (!order) {
      return;
    }

    setScreenState('copying');
    await sleep(1);
    const newId = generateId();

    const tomorrow = new Date();
    const newDocDate = tomorrow.toISOString();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const newOnDate = tomorrow.toISOString();

    const orderDocs = routeId
      ? orderList?.filter((doc) => doc.head?.route?.id === routeId && doc.head.outlet?.id === order?.head.outlet?.id)
      : orderList;

    const newNumber = getNextDocNumber(orderDocs);

    const newDoc: IOrderDocument = {
      ...order,
      id: newId,
      number: newNumber,
      status: 'DRAFT',
      head: {
        ...order.head,
        route: routeId ? ({ id: routeId, name: '' } as INamedEntity) : undefined,
        onDate: newOnDate,
      },
      lines: absentLines?.length ? copyLines : order.lines,
      documentDate: newDocDate,
      creationDate: newDocDate,
      editionDate: newDocDate,
      sentDate: undefined,
      errorMessage: undefined,
      erpCreationDate: undefined,
    };

    if (routeId && routeLineId && !orderDocs.length) {
      let beginGeoPoint: ICoords | undefined;

      try {
        //Если копируется первая заявка
        //и есть визит по точке маршрута, то редактируем его
        //и нет визита - создаем
        if (!orderDocs.length) {
          beginGeoPoint = await getCurrentPosition();
          const visitDate = new Date().toISOString();

          if (visit) {
            const updatedVisit: IVisitDocument = {
              ...visit,
              documentDate: visitDate,
              head: {
                ...visit.head,
                dateBegin: visitDate,
                beginGeoPoint,
                routeLineId,
              },
              creationDate: visitDate,
              editionDate: visitDate,
            };
            dispatch(documentActions.updateDocument({ docId: visit.id, document: updatedVisit }));
          } else {
            const visitId = generateId();

            const newVisit: IVisitDocument = {
              id: visitId,
              documentType: visitDocumentType,
              number: visitId,
              documentDate: visitDate,
              status: 'DRAFT',
              head: {
                routeLineId,
                dateBegin: visitDate,
                beginGeoPoint,
                takenType: 'ON_PLACE',
              },
              creationDate: visitDate,
              editionDate: visitDate,
            };
            dispatch(documentActions.addDocument(newVisit));
          }

          dispatch(documentActions.addDocument(newDoc));
        }
        navigation.navigate('OrderView', { id: newId, routeId });
      } catch (e) {
        setScreenState('idle');
      }
    } else {
      docDispatch(documentActions.addDocument(newDoc));
      navigation.navigate('OrderView', { id: newId, routeId });
    }
    setScreenState('copied');
  }, [
    order,
    routeId,
    orderList,
    absentLines?.length,
    copyLines,
    routeLineId,
    navigation,
    visit,
    dispatch,
    docDispatch,
  ]);

  const handleCheckLines = useCallback(async () => {
    if (!order) {
      return;
    }

    const linesList: ICheckedLines = order.lines?.reduce(
      (prev: ICheckedLines, cur) => {
        const good = goods.find((g) => g.id === cur.good.id);
        if (good) {
          prev = { ...prev, copyLines: [...prev.copyLines, cur] };
        } else {
          prev = { ...prev, absentLines: [...prev.absentLines, cur] };
        }
        return prev;
      },
      { copyLines: [], absentLines: [] },
    );

    if (linesList.absentLines?.length) {
      setAbsentLines(linesList.absentLines);
      setCopyLines(linesList.copyLines);
      setVisibleCopyDialog(true);
    } else {
      handleCopyOrder();
    }
  }, [goods, handleCopyOrder, order]);

  const handleDelete = useCallback(() => {
    if (!id) {
      return;
    }

    Alert.alert('Вы уверены, что хотите удалить заявку?', '', [
      {
        text: 'Да',
        onPress: async () => {
          setScreenState('deleting');
          await sleep(1);
          const res = await docDispatch(documentActions.removeDocument(id));
          if (res.type === 'DOCUMENTS/REMOVE_ONE_SUCCESS') {
            setScreenState('deleted');
          } else {
            setScreenState('idle');
          }
        },
      },
      {
        text: 'Отмена',
      },
    ]);
  }, [docDispatch, id]);

  const handleAddDeletelList = useCallback(
    (lineId: string, checkedId: string) => {
      if (checkedId) {
        const newList = delList.filter((i) => i !== checkedId);
        setDelList(newList);
      } else {
        setDelList([...delList, lineId]);
      }
    },
    [delList],
  );

  const handleDeleteDocLine = useCallback(() => {
    Alert.alert('Вы уверены, что хотите удалить позиции документа?', '', [
      {
        text: 'Да',
        onPress: () => {
          for (const item of delList) {
            dispatch(documentActions.removeDocumentLine({ docId: id, lineId: item }));
          }
          setDelList([]);
        },
      },
      {
        text: 'Отмена',
      },
    ]);
  }, [delList, dispatch, id]);

  const sendDoc = useSendDocs(order ? [order] : []);

  const [visibleSendDialog, setVisibleSendDialog] = useState(false);

  const handleSendDocument = useCallback(async () => {
    setVisibleSendDialog(false);
    setScreenState('sending');
    await sendDoc();
    await handleSendRemainsRequest();
    setScreenState('sent');
  }, [handleSendRemainsRequest, sendDoc]);

  const handleSaveDocument = useCallback(() => {
    if (!order) {
      return;
    }
    dispatch(
      documentActions.updateDocument({
        docId: id,
        document: { ...order, status: 'READY' },
      }),
    );
    navigation.goBack();
  }, [dispatch, id, navigation, order]);

  useEffect(() => {
    if (screenState === 'sent' || screenState === 'deleted' || screenState === 'copied') {
      setScreenState('idle');
      if (screenState !== 'copied') {
        navigation.goBack();
      }
    }
  }, [navigation, screenState]);

  const actionsMenu = useCallback(() => {
    showActionSheet(
      isBlocked
        ? order?.status === 'SENT' || readonly
          ? [
              {
                title: 'Копировать заявку',
                onPress: handleCheckLines,
              },
              {
                title: 'Отмена',
                type: 'cancel',
              },
            ]
          : [
              {
                title: 'Копировать заявку',
                onPress: handleCheckLines,
              },
              {
                title: 'Удалить заявку',
                type: 'destructive',
                onPress: handleDelete,
              },
              {
                title: 'Отмена',
                type: 'cancel',
              },
            ]
        : [
            {
              title: 'Добавить товар',
              onPress: handleAddOrderLine,
            },
            {
              title: 'Редактировать данные',
              onPress: handleEditOrderHead,
            },
            {
              title: 'Отправить запрос за дебиторской задолженностью',
              onPress: handleOpenDebtDialog,
            },
            {
              title: 'Копировать заявку',
              onPress: handleCheckLines,
            },
            {
              title: 'Удалить заявку',
              type: 'destructive',
              onPress: handleDelete,
            },
            {
              title: 'Отмена',
              type: 'cancel',
            },
          ],
    );
  }, [
    showActionSheet,
    isBlocked,
    order?.status,
    readonly,
    handleCheckLines,
    handleDelete,
    handleAddOrderLine,
    handleEditOrderHead,
  ]);

  const renderRight = useCallback(
    () =>
      isBlocked ? (
        <View style={styles.buttons}>
          {order?.status === 'READY' && (
            <SendButton onPress={() => setVisibleSendDialog(true)} disabled={screenState !== 'idle' || loading} />
          )}
          <MenuButton actionsMenu={actionsMenu} disabled={screenState !== 'idle'} />
        </View>
      ) : (
        <View style={styles.buttons}>
          {isDelList ? (
            <DeleteButton onPress={handleDeleteDocLine} />
          ) : (
            <>
              {order?.status === 'DRAFT' && (
                <SaveDocument onPress={handleSaveDocument} disabled={screenState !== 'idle'} />
              )}
              <SendButton onPress={() => setVisibleSendDialog(true)} disabled={screenState !== 'idle' || loading} />
              <AddButton onPress={handleAddOrderLine} disabled={screenState !== 'idle'} />
              <MenuButton actionsMenu={actionsMenu} disabled={screenState !== 'idle'} />
            </>
          )}
        </View>
      ),
    [
      isBlocked,
      order?.status,
      screenState,
      actionsMenu,
      isDelList,
      handleDeleteDocLine,
      handleSaveDocument,
      loading,
      handleAddOrderLine,
    ],
  );

  const renderLeft = useCallback(
    () => !isBlocked && isDelList && <CloseButton onPress={() => setDelList([])} />,
    [isDelList, isBlocked],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: isDelList ? renderLeft : navBackButton,
      headerRight: renderRight,
      title: isDelList ? `Выделено позиций: ${delList.length}` : 'Заявка',
    });
  }, [delList.length, isDelList, navigation, renderLeft, renderRight]);

  const [orderLine, setOrderLine] = useState<IOrderItemLine | undefined>();

  const handlePressOrderLine = useCallback(
    (item: IOrderLine) => !isBlocked && setOrderLine({ mode: 1, docId: id, item }),
    [id, isBlocked],
  );

  const renderItem = useCallback(
    ({ item }: { item: IOrderLine }) => {
      const checkedId = delList.find((i) => i === item.id) || '';
      const itemPackages = packages?.filter((e) => e.good.id === item.good.id);

      return (
        <View style={!item.package && itemPackages?.length > 0 ? { backgroundColor: globalColors.lavenderLight } : {}}>
          <OrderItem
            key={item.id}
            item={item}
            onPress={() => handlePressOrderLine(item)}
            isChecked={checkedId ? true : false}
            onLongPress={() => !isBlocked && handleAddDeletelList(item.id, checkedId)}
            isDelList={isDelList}
            isUseRemains={isUseRemains}
          />
        </View>
      );
    },
    [delList, handleAddDeletelList, handlePressOrderLine, isBlocked, isDelList, isUseRemains, packages],
  );

  const isEditable = useMemo(() => (order ? ['DRAFT', 'READY'].includes(order?.status) : false), [order]);

  const isFocused = useIsFocused();
  if (!isFocused) {
    return <AppActivityIndicator />;
  }

  if (screenState === 'deleting' || screenState === 'copying') {
    return (
      <View style={styles.container}>
        <View style={styles.containerCenter}>
          <LargeText>{screenState === 'deleting' ? 'Удаление документа...' : 'Копирование документа...'}</LargeText>
          <AppActivityIndicator style={{}} />
        </View>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[styles.container, styles.alignItemsCenter]}>
        <LargeText>Документ не найден</LargeText>
      </View>
    );
  }

  return (
    <>
      <View style={styles.container}>
        {orderLine && (
          <OrderLineEdit
            orderLine={orderLine}
            onDismiss={() => setOrderLine(undefined)}
            isUseUnitMeasure={isUseUnitMeasure}
          />
        )}
        <InfoBlock
          colorLabel={getStatusColor(order?.status || 'DRAFT')}
          title={order.head?.outlet?.name}
          onPress={() => (isEditable ? handleEditOrderHead() : setIsDateVisible(!isDateVisible))}
          editable={isEditable}
          disabled={isDelList}
          isBlocked={isBlocked}
          isFromRoute={order.head.route ? true : false}
        >
          <View style={styles.directionColumn}>
            {address ? <MediumText>Адрес: {address}</MediumText> : null}
            {order.head.road ? <MediumText>Маршрут: {order.head.road.name}</MediumText> : null}
            <MediumText>{`№ ${order.number} от ${getDateString(order.documentDate)} на ${getDateString(
              order.head?.onDate,
            )}`}</MediumText>
            {!routeId && contact ? (
              <>
                <LargeText style={localStyles.contract}>{`Договор №${contact?.contractNumber || '-'} от ${getDateString(
                  contact.contractDate,
                )}`}</LargeText>
                <MediumText>{`Условия оплаты: ${contact.paycond}`}</MediumText>
              </>
            ) : null}

            <MediumText style={debtTextStyle}>
              {(!!debt?.saldo && debt.saldo < 0
                ? `Предоплата: ${formatValue({ type: 'currency', decimals: 2 }, Math.abs(debt.saldo))}`
                : `Задолженность: ${formatValue({ type: 'currency', decimals: 2 }, debt?.saldo ?? 0)}`) || 0}
            </MediumText>
            {!!debt?.saldoDebt && (
              <MediumText>
                {`Просрочено: ${formatValue({ type: 'currency', decimals: 2 }, debt.saldoDebt)}, ${
                  debt.dayLeft || 0
                } дн.`}
              </MediumText>
            )}
            {limitSum ? (
              <View style={styles.rowCenter}>
                <MediumText>Лимит: {formatValue({ type: 'currency', decimals: 2 }, limitSum)}</MediumText>
              </View>
            ) : null}
            {isUseRemains && depart ? <LargeText style={localStyles.contract}>{`Склад: ${depart}`}</LargeText> : null}
            {isUseRemains && order.head.expeditor ? (
              <LargeText style={localStyles.contract}>{`Экспедитор: ${order.head.expeditor.name}`}</LargeText>
            ) : null}

            {order.head.comment ? (
              <View style={styles.rowCenter}>
                <MediumText>Комментарий: {order.head.comment || ''}</MediumText>
              </View>
            ) : null}
            {isDateVisible && <DateInfo sentDate={order.sentDate} erpCreationDate={order.erpCreationDate} />}
          </View>
        </InfoBlock>
        <FlashList
          data={order.lines}
          renderItem={renderItem}
          estimatedItemSize={60}
          ItemSeparatorComponent={ItemSeparator}
          keyExtractor={keyExtractor}
          extraData={[delList, isBlocked]}
          keyboardShouldPersistTaps={'handled'}
        />
      </View>
      {!!order.lines.length && (
        <OrderTotal
          onPress={() => setIsGroupVisible(!isGroupVisible)}
          isGroupVisible={isGroupVisible}
          isUseUnitMeasure={isUseUnitMeasure}
          order={order}
        />
      )}
      <SimpleDialog
        visible={visibleSendDialog}
        title={'Внимание!'}
        text={'Вы уверены, что хотите отправить документ?'}
        onCancel={() => setVisibleSendDialog(false)}
        onOk={handleSendDocument}
        okDisabled={loading}
      />
      <SimpleDialog
        visible={visibleLimitDialog}
        title={'Внимание! Превышение лимита!'}
        text={`Лимит превышен на сумму ${formatValue(
          { type: 'currency', decimals: 2 },
          limitExceeded,
        )}. Хотите продолжить добавление товаров?`}
        onCancel={() => setVisibleLimitDialog(false)}
        onOk={handleAddExceededLimit}
        okDisabled={loading}
      />
      <SimpleDialog
        visible={visibleDebtDialog}
        title={'Внимание!'}
        text={'Отправить запрос на получение дебиторской задолженности?'}
        onCancel={() => setVisibleDebtDialog(false)}
        onOk={handleSendDebtRequest}
        okDisabled={loading}
      />
      <OrderCopyDialog
        lines={absentLines}
        visible={visibleCopyDialog}
        onOk={() => {
          setVisibleCopyDialog(false);
          handleCopyOrder();
        }}
        onCancel={() => setVisibleCopyDialog(false)}
      />
    </>
  );
};

export default OrderViewScreen;

const localStyles = StyleSheet.create({
  contract: { fontWeight: 'bold', opacity: 0.9, fontSize: 15 },
});
