import { generateId, getDateString, keyExtractor } from '@lib/mobile-hooks';
import { IListItem } from '@lib/mobile-types';
import {
  AppActivityIndicator,
  AppScreen,
  EmptyList,
  globalStyles as styles,
  ItemSeparator,
  Menu,
  navBackDrawer,
  SelectableInput,
  PrimeButton,
  FilterButton,
} from '@lib/mobile-ui';
import { appActions, docSelectors, documentActions, refSelectors, useDispatch, useSelector } from '@lib/store';
import { IDocumentType, IReference } from '@lib/types';
import { useIsFocused, useNavigation, useTheme } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { FlashList } from '@shopify/flash-list';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { SectionListData, View, StyleSheet, Alert } from 'react-native';

import { ShipmentStackParamList } from '../../navigation/Root/types';
import {
  IContact,
  IContactData,
  IDebt,
  IGood,
  IGoodGroup,
  IShipmentListItem,
  IOrderDocument,
  IOrderLine,
  IOutlet,
  IShipmentHead,
  IShipmentLine,
  IShipmentLinesRef,
  IShipmentListFormParam,
} from '../../store/types';
import { shipments, UNKNOWN_GROUP } from '../../utils/constants';
import { getNextDocNumber } from '../../utils/helpers';

import ShipmentItem from './components/ShipmentItem';

export type RefListItem = IReference & { refName: string };

export interface ShipmentListSectionProps {
  title: string;
}

export type SectionDataProps = SectionListData<IDebt, ShipmentListSectionProps>[];

const ShipmentListScreen = () => {
  const navigation = useNavigation<StackNavigationProp<ShipmentStackParamList, 'ShipmentList'>>();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterVisible, setFilterVisible] = useState(true);
  const [visibleShipment, setVisibleShipment] = useState(false);

  const { colors } = useTheme();

  const dispatch = useDispatch();

  const syncDate = useSelector((state) => state.app.syncDate);
  const isDemo = useSelector((state) => state.auth.isDemo);
  useEffect(() => {
    if (syncDate && getDateString(syncDate) !== getDateString(new Date()) && !isDemo) {
      return Alert.alert('Внимание!', 'В справочнике устаревшие данные, требуется синхронизация', [{ text: 'OK' }]);
    }
  }, [syncDate, isDemo]);

  const goods = refSelectors.selectByName<IGood>('good')?.data;
  const contacts = refSelectors.selectByName<IContact>('contact')?.data;
  const outlets = refSelectors.selectByName<IOutlet>('outlet')?.data;
  const goodGroups = refSelectors.selectByName<IGoodGroup>('goodGroup')?.data;

  const orders = docSelectors.selectByDocType<IOrderDocument>('order');
  const orderType = refSelectors
    .selectByName<IReference<IDocumentType>>('documentType')
    ?.data?.find((t) => t.name === 'order');

  const shipmentInfo = refSelectors.selectByName<IShipmentHead>('shipmentHead')?.data;
  const shipmentDetails: IShipmentLinesRef = refSelectors.selectByName<IShipmentLinesRef>('shipmentDetail')?.data?.[0];

  const [shipment, setShipment] = useState(shipments[0]);

  const { filterShipmentContact, filterShipmentOutlet, filterShipmentGood } = useSelector(
    (state) => state.app.formParams as IShipmentListFormParam,
  );

  // Полные данные — «Накладные» и «По группам»; во всех видах недогрузов — только строки с diff < 0
  const filteredShipmentDetails = useMemo(
    () =>
      shipmentDetails
        ? Object.entries(shipmentDetails).reduce((prev: IShipmentLinesRef, [orderId, lines]) => {
            const cur = lines?.filter(
              (i) =>
                (shipment.id === 'shipment' || shipment.id === 'group' ? true : i.diff < 0) &&
                (filterShipmentGood && filterShipmentGood?.length > 0
                  ? filterShipmentGood.find((g) => g.id === i.goodId)
                  : true),
            );

            if (cur.length > 0) {
              prev[orderId] = cur;
            }

            return prev;
          }, {})
        : {},

    [filterShipmentGood, shipment.id, shipmentDetails],
  );

  const filteredShipmentInfo = useMemo(
    () =>
      shipmentInfo?.filter(
        (i) =>
          (shipment.id === 'shipment' ? true : filteredShipmentDetails[i.id]) &&
          filteredShipmentDetails[i.id] &&
          (filterShipmentContact?.id ? i.contactId === filterShipmentContact.id : true) &&
          (filterShipmentOutlet?.id ? i.outletId === filterShipmentOutlet.id : true),
      ) || [],
    [filterShipmentContact?.id, filterShipmentOutlet?.id, filteredShipmentDetails, shipment.id, shipmentInfo],
  );

  const list: IContactData = filteredShipmentInfo.reduce((prev: IContactData, cur: IShipmentHead) => {
    const contact = prev[cur.contactId];
    if (!contact) {
      prev[cur?.contactId] = {};
      prev[cur.contactId][cur.outletId] = {};
      prev[cur.contactId][cur.outletId][cur.id] = filteredShipmentDetails[cur.id];
    } else {
      const outlet = contact[cur.outletId];

      if (!outlet) {
        prev[cur.contactId][cur.outletId] = {};
      }
      prev[cur.contactId][cur.outletId][cur.id] = filteredShipmentDetails[cur.id];
    }

    return prev;
  }, {});

  const filteredList: IShipmentListItem[] = Object.entries(list).reduce(
    (prev: IShipmentListItem[], [contactId, contactData]) => {
      const contact = contacts?.find((i) => i.id === contactId);

      if (contact) {
        const contactLine: IShipmentListItem = {
          id: generateId(),
          lineId: contact?.id,
          name: contact?.name,
          type: 'contact',
        };
        prev = [...prev, contactLine];

        const outletLines: IShipmentListItem[] = Object.entries(contactData).reduce(
          (outletList: IShipmentListItem[], [outletId, outletData]) => {
            const outlet = outlets?.find((i) => i.id === outletId);

            if (outlet) {
              const outletLine: IShipmentListItem = {
                id: generateId(),
                lineId: outlet?.id,
                name: `${outlet?.name}, ${outlet.address}`,
                type: 'outlet',
              };
              outletList = [...outletList, outletLine];
            }

            const orderLines: IShipmentListItem[] = Object.entries(outletData).reduce(
              (orderList: IShipmentListItem[], [orderId, orderData]) => {
                const refOrder = shipmentInfo?.find((i) => i.id === orderId);

                const order = orders?.find((i) => i.id === refOrder?.orderId);

                const orderLine: IShipmentListItem = {
                  id: generateId(),
                  lineId: orderId,
                  name: `Заявка №${refOrder?.number || '-'} ${order?.number ? `(${order?.number}) ` : ''}от ${
                    refOrder?.documentDate ? getDateString(refOrder?.documentDate) : '-'
                  } ${refOrder?.shipmentNumber ? `\nТТН №${refOrder?.shipmentNumber}` : ''}`,
                  type: 'order',
                };
                orderList = [...orderList, orderLine];

                const goodList = orderData.reduce(
                  (p, c) => {
                    const good = goods?.find((i) => i.id === c.goodId);

                    const goodLine: IShipmentListItem = {
                      id: generateId(),
                      lineId: good?.id || '',
                      name: good?.name || '',
                      orderQ: c.orderQ,
                      sellQ: c.sellQ,
                      diff: c.diff,
                      type: 'good',
                    };
                    p.goodLines = [...p.goodLines, goodLine];
                    p.total = {
                      orderQ: p.total.orderQ + goodLine.orderQ,
                      sellQ: p.total.sellQ + goodLine.sellQ,
                      diff: p.total.diff + goodLine.diff,
                    };
                    return p;
                  },
                  { goodLines: [] as IShipmentListItem[], total: { orderQ: 0, sellQ: 0, diff: 0 } },
                );

                orderList = [
                  ...orderList,
                  ...goodList.goodLines,
                  {
                    ...goodList.total,
                    id: generateId(),
                    name: `Итого по заявке №${refOrder?.number || '-'} ${
                      order?.number ? `(${order?.number}) ` : ''
                    } от ${refOrder?.documentDate ? getDateString(refOrder?.documentDate) : '-'}`,
                    type: 'total',
                  },
                ];
                return orderList;
              },
              [],
            );
            outletList = [...outletList, ...orderLines];
            return outletList;
          },
          [],
        );

        prev = [...prev, ...outletLines];
      }

      return prev;
    },
    [],
  );

  // Групповые виды отгрузки.
  // Плоские («Суммарно за день» — полные данные, «Недогрузы за день» — только недогрузы):
  // родительская группа → дочерние группы, суммы за день по всем точкам.
  // Иерархические («По группам» — полные данные, «Недогрузы по группам» — только недогрузы):
  // организация → магазин → родительская группа (шапка с колонками) → строки дочерних групп
  // и разбивка по накладным внутри группы
  const groupList: IShipmentListItem[] = useMemo(() => {
    const result: IShipmentListItem[] = [];

    type IGroupTotal = {
      name: string;
      orderQ: number;
      sellQ: number;
      diff: number;
      invoices: Record<string, { orderQ: number; sellQ: number; diff: number }>;
    };
    type IParentGroup = { name: string; groups: Record<string, IGroupTotal> };

    const addLine = (parents: Record<string, IParentGroup>, goodId: string, orderId: string, line: IShipmentLine) => {
      const good = goods?.find((i) => i.id === goodId);

      if (!good) {
        return;
      }

      // У товара в группе только id и название, родителя берём из справочника групп
      const groupEntity = goodGroups?.find((gg) => gg.id === good.goodgroup.id);
      const parent = groupEntity?.parent;
      const parentId = parent?.id || UNKNOWN_GROUP.id;
      const parentName = parent?.name || UNKNOWN_GROUP.name;
      const groupId = groupEntity?.id || good.goodgroup.id;
      const groupName = groupEntity?.name || good.goodgroup.name || groupId;

      const parentItem = parents[parentId] || { name: parentName, groups: {} };
      const group = parentItem.groups[groupId] || {
        name: groupName,
        orderQ: 0,
        sellQ: 0,
        diff: 0,
        invoices: {},
      };
      const invoice = group.invoices[orderId] || { orderQ: 0, sellQ: 0, diff: 0 };

      group.orderQ += line.orderQ;
      group.sellQ += line.sellQ;
      group.diff += line.diff;
      invoice.orderQ += line.orderQ;
      invoice.sellQ += line.sellQ;
      invoice.diff += line.diff;
      group.invoices[orderId] = invoice;
      parentItem.groups[groupId] = group;
      parents[parentId] = parentItem;
    };

    // Выводит группы с итогами; возвращает сумму по всем группам (для итога по магазину/за день)
    const pushGroups = (parents: Record<string, IParentGroup>, withInvoices: boolean) => {
      const total = { orderQ: 0, sellQ: 0, diff: 0 };

      Object.values(parents)
        .sort((a, b) => (a.name < b.name ? -1 : 1))
        .forEach((parent) => {
          result.push({ id: generateId(), name: parent.name, type: 'parentGroup' });

          const parentTotal = { orderQ: 0, sellQ: 0, diff: 0 };

          Object.values(parent.groups)
            .sort((a, b) => (a.name < b.name ? -1 : 1))
            .forEach((group) => {
              result.push({
                id: generateId(),
                name: group.name,
                orderQ: group.orderQ,
                sellQ: group.sellQ,
                diff: group.diff,
                type: 'good',
              });

              parentTotal.orderQ += group.orderQ;
              parentTotal.sellQ += group.sellQ;
              parentTotal.diff += group.diff;

              if (withInvoices) {
                Object.entries(group.invoices).forEach(([orderId, invoice]) => {
                  const refOrder = shipmentInfo?.find((i) => i.id === orderId);
                  result.push({
                    id: generateId(),
                    lineId: orderId,
                    indent: true,
                    name: `Заявка №${refOrder?.number || '-'} от ${
                      refOrder?.documentDate ? getDateString(refOrder?.documentDate) : '-'
                    } ${refOrder?.shipmentNumber ? `\nТТН №${refOrder?.shipmentNumber}` : ''}`,
                    orderQ: invoice.orderQ,
                    sellQ: invoice.sellQ,
                    diff: invoice.diff,
                    type: 'good',
                  });
                });
              }
            });

          result.push({
            id: generateId(),
            name: `Итого по группе «${parent.name}»`,
            ...parentTotal,
            type: 'total',
          });

          total.orderQ += parentTotal.orderQ;
          total.sellQ += parentTotal.sellQ;
          total.diff += parentTotal.diff;
        });

      return total;
    };

    // Плоские виды «Суммарно за день» (полные данные) и «Недогрузы за день» (только недогрузы):
    // родительская группа → дочерние группы, без разбивки по организациям и магазинам
    if (shipment.id === 'groupDay' || shipment.id === 'groupDayNoShipment') {
      const parents: Record<string, IParentGroup> = {};

      Object.values(list).forEach((contactData) => {
        Object.values(contactData).forEach((outletData) => {
          Object.entries(outletData).forEach(([orderId, orderLines]) => {
            orderLines.forEach((line) => addLine(parents, line.goodId, orderId, line));
          });
        });
      });

      const total = pushGroups(parents, false);

      result.push({
        id: generateId(),
        name: shipment.id === 'groupDay' ? 'Итого за день' : 'Итого недогрузов за день',
        ...total,
        type: 'total',
      });

      return result;
    }

    Object.entries(list).forEach(([contactId, contactData]) => {
      const contact = contacts?.find((i) => i.id === contactId);

      if (!contact) {
        return;
      }

      result.push({ id: generateId(), lineId: contact.id, name: contact.name, type: 'contact' });

      Object.entries(contactData).forEach(([outletId, outletData]) => {
        const outlet = outlets?.find((i) => i.id === outletId);

        if (!outlet) {
          return;
        }

        result.push({
          id: generateId(),
          lineId: outlet.id,
          name: `${outlet.name}, ${outlet.address}`,
          type: 'outlet',
        });

        const parents: Record<string, IParentGroup> = {};

        Object.entries(outletData).forEach(([orderId, orderLines]) => {
          orderLines.forEach((line) => addLine(parents, line.goodId, orderId, line));
        });

        const outletTotal = pushGroups(parents, true);

        result.push({
          id: generateId(),
          name: 'Итого по магазину',
          ...outletTotal,
          type: 'total',
        });
      });
    });

    return result;
  }, [contacts, goods, goodGroups, list, outlets, shipmentInfo, shipment.id]);

  const handleCleanFormParams = useCallback(() => {
    dispatch(
      appActions.setFormParams({
        filterShipmentContact: undefined,
        filterShipmentOutlet: undefined,
        filterShipmentGood: undefined,
      }),
    );
  }, [dispatch]);

  const handleAddOrder = useCallback(
    (orderId?: string) => {
      if (orderId) {
        const docId = generateId();
        // const docId = !id ? generateId() : id;
        const newOrderDate = new Date().toISOString();
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const newOnDate = tomorrow.toISOString();
        const newNumber = getNextDocNumber(orders);

        const head = shipmentInfo?.find((i) => i.id === orderId);
        const contact = contacts?.find((i) => i.id === head?.contactId);
        const outlet = outlets?.find((i) => i.id === head?.outletId);

        const lines =
          shipmentDetails[orderId]
            ?.filter((i) => i.diff < 0)
            ?.reduce((prev: IOrderLine[], cur) => {
              const good = goods?.find((e) => e.id === cur.goodId);

              if (good) {
                const line: IOrderLine = {
                  id: generateId(),
                  good: good,
                  quantity: Math.abs(cur.diff),
                };
                prev = [...prev, line];
              }
              return prev;
            }, []) || [];

        if (contact && outlet && orderType) {
          const newOrder: IOrderDocument = {
            id: docId,
            documentType: orderType,
            number: newNumber,
            documentDate: newOrderDate,
            status: 'DRAFT',
            head: {
              contact: contact,
              onDate: newOnDate,
              outlet: outlet,
              comment: '',
            },
            lines,
            creationDate: newOrderDate,
            editionDate: newOrderDate,
          };
          dispatch(documentActions.addDocument(newOrder));
          navigation.navigate('OrderView', { id: newOrder.id });
        }
      }
    },
    [contacts, dispatch, goods, navigation, orderType, orders, outlets, shipmentDetails, shipmentInfo],
  );

  const outlet = outlets?.find((e) => e.id === filterShipmentOutlet?.id);

  useEffect(() => {
    if (!!filterShipmentContact && !!filterShipmentOutlet && filterShipmentContact.id !== outlet?.company.id) {
      dispatch(
        appActions.setFormParams({
          filterShipmentOutlet: undefined,
        }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, filterShipmentContact?.id, outlet?.company.id]);

  useEffect(() => {
    // Инициализируем параметры
    handleCleanFormParams();
  }, [handleCleanFormParams]);

  const withParams = !!filterShipmentContact || !!filterShipmentOutlet || !!filterShipmentGood;

  useEffect(() => {
    if (!filterVisible && searchQuery) {
      setSearchQuery('');
    }
  }, [filterVisible, searchQuery]);

  const renderRight = useCallback(
    () => <FilterButton onPress={() => setFilterVisible((prev) => !prev)} visible={filterVisible} />,
    [filterVisible],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: navBackDrawer,
      headerRight: renderRight,
    });
  }, [navigation, renderRight]);

  const renderItem = useCallback(
    ({ item }: { item: IShipmentListItem }) => <ShipmentItem item={item} onPress={() => handleAddOrder(item.lineId)} />,
    [handleAddOrder],
  );

  const handleSearchContact = useCallback(() => {
    navigation.navigate('SelectRefItem', {
      refName: 'contact',
      fieldName: 'filterShipmentContact',
      value: filterShipmentContact && [filterShipmentContact],
    });
  }, [filterShipmentContact, navigation]);

  const handleSearchOutlet = useCallback(() => {
    navigation.navigate('SelectRefItem', {
      refName: 'outlet',
      fieldName: 'filterShipmentOutlet',
      clause: filterShipmentContact?.id
        ? {
            companyId: filterShipmentContact?.id,
          }
        : undefined,
      value: filterShipmentOutlet && [filterShipmentOutlet],
      descrFieldName: 'address',
    });
  }, [filterShipmentContact?.id, filterShipmentOutlet, navigation]);

  const handleSearchGood = useCallback(() => {
    navigation.navigate('SelectRefItem', {
      refName: 'good',
      fieldName: 'filterShipmentGood',
      isMulti: true,
      value: filterShipmentGood,
    });
  }, [filterShipmentGood, navigation]);

  const handleShipment = useCallback(
    (option: IListItem) => {
      if (!(option.id === shipment?.id)) {
        setShipment(option);
      }
      setVisibleShipment(false);
    },
    [shipment?.id],
  );

  const handlePressShipment = () => {
    setVisibleShipment(true);
  };

  const isFocused = useIsFocused();
  if (!isFocused) {
    return <AppActivityIndicator />;
  }

  return (
    <AppScreen style={styles.contentTop}>
      <View style={styles.marginRight12}>
        <Menu
          key={'shipment'}
          options={shipments}
          onChange={handleShipment}
          onPress={handlePressShipment}
          onDismiss={() => setVisibleShipment(false)}
          title={
            shipment?.id === 'shipment' && syncDate ? `${shipment.value} на ${getDateString(syncDate)}` : shipment.value
          }
          visible={visibleShipment}
          activeOptionId={shipment?.id}
          style={localStyles.btnTab}
          iconName={'chevron-down'}
          iconSize={26}
        />
      </View>
      {filterVisible && (
        <View style={[localStyles.filter, { borderColor: colors.primary }]}>
          <SelectableInput
            label="Организация"
            value={filterShipmentContact?.name || ''}
            onPress={handleSearchContact}
          />
          <View style={localStyles.marginTop}>
            <SelectableInput label="Магазин" value={filterShipmentOutlet?.name || ''} onPress={handleSearchOutlet} />
          </View>
          <View style={localStyles.marginTop}>
            <SelectableInput
              label="Товары"
              value={filterShipmentGood?.map((g) => g.name).join(',')}
              onPress={handleSearchGood}
            />
          </View>

          <View style={localStyles.container}>
            <PrimeButton icon={'delete-outline'} onPress={handleCleanFormParams} disabled={!withParams}>
              {'Очистить'}
            </PrimeButton>
          </View>
        </View>
      )}

      <FlashList
        data={
          shipment.id === 'group' ||
          shipment.id === 'groupInvoices' ||
          shipment.id === 'groupDay' ||
          shipment.id === 'groupDayNoShipment'
            ? groupList
            : filteredList
        }
        renderItem={renderItem}
        estimatedItemSize={60}
        ItemSeparatorComponent={ItemSeparator}
        keyExtractor={keyExtractor}
        keyboardShouldPersistTaps={'handled'}
        ListEmptyComponent={EmptyList}
      />
    </AppScreen>
  );
};

export default ShipmentListScreen;

const localStyles = StyleSheet.create({
  filter: {
    paddingTop: 5,
    marginVertical: 5,
    marginBottom: 12,
    borderWidth: 1,
    borderRadius: 2,
  },
  marginTop: {
    marginTop: -5,
  },
  container: {
    alignItems: 'center',
    marginTop: -4,
  },
  btnTab: {
    alignItems: 'flex-end',
  },
});
