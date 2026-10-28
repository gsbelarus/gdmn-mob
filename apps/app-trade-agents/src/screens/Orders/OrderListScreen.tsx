import React, { useCallback, useState, useLayoutEffect, useMemo, useEffect } from 'react';
import { ListRenderItem, Platform, SectionList, SectionListData, View, StyleSheet, Keyboard } from 'react-native';
import { useIsFocused, useNavigation, useTheme } from '@react-navigation/native';

import {
  globalStyles as styles,
  AddButton,
  FilterButtons,
  ItemSeparator,
  Status,
  AppScreen,
  SubTitle,
  ScreenListItem,
  IListItemProps,
  EmptyList,
  AppActivityIndicator,
  CloseButton,
  DeleteButton,
  navBackDrawer,
  MediumText,
  SelectableInput,
  FilterButton,
  PrimeButton,
  Checkbox,
} from '@lib/mobile-ui';

import { StackNavigationProp } from '@react-navigation/stack';
import DateTimePicker from '@react-native-community/datetimepicker';

import { deleteSelectedItems, formatValue, getDateString, getDelList, keyExtractor } from '@lib/mobile-hooks';

import { appActions, documentActions, refSelectors, useDispatch, useDocThunkDispatch, useSelector } from '@lib/store';

import { IDelList, IListItem } from '@lib/mobile-types';

import { Searchbar } from 'react-native-paper';

import { StatusTypes } from '@lib/mobile-ui/src/components/FilterButtons';

import { IDebt, IOrderDocument, IOrderListFormParam, IOutlet } from '../../store/types';
import { OrdersStackParamList } from '../../navigation/Root/types';

import { statusTypes } from '../../utils/constants';

import OrderListTotal from './components/OrderListTotal';

export interface OrderListSectionProps {
  title: string;
}

export type SectionDataProps = SectionListData<IListItemProps, OrderListSectionProps>[];

const OrderListScreen = () => {
  const navigation = useNavigation<StackNavigationProp<OrdersStackParamList, 'OrderList'>>();
  const dispatch = useDispatch();
  const docDispatch = useDocThunkDispatch();
  const { colors } = useTheme();

  const orders = useSelector((state) => state.documents.list) as IOrderDocument[];
  const outlets = refSelectors.selectByName<IOutlet>('outlet')?.data;

  const searchStyle = useMemo(() => colors.primary, [colors.primary]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterVisible, setFilterVisible] = useState(false);

  const {
    filterContact,
    filterOutlet,
    filterDateBegin,
    filterDateEnd,
    filterStatusList = [],
  } = useSelector((state) => state.app.formParams as IOrderListFormParam);

  const handleCleanFormParams = useCallback(() => {
    dispatch(
      appActions.setFormParams({
        filterContact: undefined,
        filterOutlet: undefined,
        filterDateBegin: '',
        filterDateEnd: '',
        filterStatusList: undefined,
      }),
    );
    setSearchQuery('');
  }, [dispatch]);

  const outlet = refSelectors.selectByName<IOutlet>('outlet')?.data?.find((e) => e.id === filterOutlet?.id);

  useEffect(() => {
    if (!!filterContact && !!filterOutlet && filterContact.id !== outlet?.company.id) {
      dispatch(
        appActions.setFormParams({
          filterOutlet: undefined,
        }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, filterContact?.id, outlet?.company.id]);

  useEffect(() => {
    // Инициализируем параметры
    handleCleanFormParams();
  }, [handleCleanFormParams]);

  const orderList = useMemo(
    () =>
      orders
        ?.filter((i) =>
          i.documentType?.name === 'order'
            ? i?.head?.contact.name ||
              i?.head?.outlet.name ||
              i.number ||
              i.documentDate ||
              i.head.onDate ||
              outlets?.find((a) => a.id === i.head.outlet.id)?.address
              ? i?.head?.contact?.name.toUpperCase().includes(searchQuery.toUpperCase()) ||
                i?.head?.outlet?.name.toUpperCase().includes(searchQuery.toUpperCase()) ||
                i.number.toUpperCase().includes(searchQuery.toUpperCase()) ||
                getDateString(i.documentDate).toUpperCase().includes(searchQuery.toUpperCase()) ||
                getDateString(i.head.onDate).toUpperCase().includes(searchQuery.toUpperCase()) ||
                outlets
                  ?.find((a) => a.id === i.head.outlet.id)
                  ?.address.toUpperCase()
                  .includes(searchQuery.toUpperCase())
              : true
            : false,
        )
        ?.sort(
          (a, b) =>
            new Date(b.documentDate.slice(0, 10)).getTime() - new Date(a.documentDate.slice(0, 10)).getTime() ||
            new Date(b.head.onDate).getTime() - new Date(a.head.onDate).getTime(),
        ),
    [orders, outlets, searchQuery],
  );

  const withParams =
    !!filterContact || !!filterOutlet || !!filterDateBegin || !!filterDateEnd || filterStatusList.length > 0;

  const filteredOrderList = useMemo(() => {
    if (filterContact || filterOutlet || filterDateBegin || filterDateEnd || filterStatusList.length) {
      return orderList.filter(
        (i) =>
          (filterContact?.id ? i.head.contact.id === filterContact.id : true) &&
          (filterOutlet?.id ? i.head.outlet.id === filterOutlet.id : true) &&
          (filterDateBegin
            ? new Date(filterDateBegin).getTime() <= new Date(i.head.onDate.slice(0, 10)).getTime()
            : true) &&
          (filterDateEnd
            ? new Date(filterDateEnd).getTime() >= new Date(i.head.onDate.slice(0, 10)).getTime()
            : true) &&
          (filterStatusList.length
            ? filterStatusList.find((item) => item.id.toUpperCase() === i.status.toUpperCase())
            : true),
      );
    } else {
      return orderList;
    }
  }, [filterContact, filterDateBegin, filterDateEnd, filterOutlet, filterStatusList, orderList]);

  const debets = refSelectors.selectByName<IDebt>('debt')?.data;

  const [status, setStatus] = useState<Status>('all');

  const filteredListByStatus: IListItemProps[] = useMemo(() => {
    const res =
      status === 'all'
        ? filteredOrderList
        : status === 'active'
          ? filteredOrderList.filter((e) => e.status !== 'PROCESSED')
          : status === 'archive'
            ? filteredOrderList.filter((e) => e.status === 'PROCESSED')
            : status === 'refuse'
              ? filteredOrderList.filter((e) => e.status === 'DRAFT' && e.errorMessage)
              : [];

    return res.map((i) => {
      const address = outlets?.find((o) => i?.head?.outlet.id === o.id)?.address;
      return {
        id: i.id,
        title: i.head.outlet?.name,
        documentDate: getDateString(i.documentDate),
        status: i.status,
        subtitle: `${address ? `${address}\n` : ''}№ ${i.number} от ${getDateString(i.documentDate)} на ${getDateString(
          i.head?.onDate,
        )}`,
        isFromRoute: !!i.head.route,
        lineCount: i.lines.length,
        errorMessage: i.errorMessage,
        sentDate: i.sentDate,
        erpCreationDate: i.erpCreationDate,
      } as IListItemProps;
    });
  }, [status, filteredOrderList, outlets]);

  const sections = useMemo(
    () =>
      filteredListByStatus.reduce<SectionDataProps>((prev, item) => {
        const sectionTitle = item.documentDate;
        const sectionExists = prev.some(({ title }) => title === sectionTitle);
        if (sectionExists) {
          return prev.map((section) =>
            section.title === sectionTitle ? { ...section, data: [...section.data, item] } : section,
          );
        }

        return [
          ...prev,
          {
            title: sectionTitle,
            data: [item],
          },
        ];
      }, []),
    [filteredListByStatus],
  );

  const statusTypesSection = useMemo(
    () =>
      status === 'all'
        ? statusTypes
        : status === 'active'
          ? statusTypes.filter((e) => e.id !== 'PROCESSED')
          : status === 'archive'
            ? statusTypes.filter((e) => e.id === 'PROCESSED')
            : [],
    [status],
  );

  const [delList, setDelList] = useState<IDelList>({});
  const isDelList = useMemo(() => !!Object.keys(delList).length, [delList]);

  const handleDeleteDocs = useCallback(() => {
    const docIds = Object.keys(delList);

    const deleteDocs = () => {
      docDispatch(documentActions.removeDocuments(docIds));
      setDelList({});
    };

    deleteSelectedItems(delList, deleteDocs);
  }, [delList, docDispatch]);

  const handleAddDocument = useCallback(() => {
    navigation.navigate('OrderEdit');
  }, [navigation]);

  const renderRight = useCallback(
    () => (
      <View style={styles.buttons}>
        {isDelList ? (
          <DeleteButton onPress={handleDeleteDocs} />
        ) : (
          <>
            <AddButton onPress={handleAddDocument} />
            <FilterButton
              onPress={() => setFilterVisible((prev) => !prev)}
              visible={filterVisible}
              withParams={withParams || !!searchQuery}
            />
          </>
        )}
      </View>
    ),
    [filterVisible, handleAddDocument, handleDeleteDocs, isDelList, searchQuery, withParams],
  );

  const renderLeft = useCallback(() => isDelList && <CloseButton onPress={() => setDelList({})} />, [isDelList]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: isDelList ? renderLeft : navBackDrawer,
      headerRight: renderRight,
      title: isDelList ? `Выделено заявок: ${Object.values(delList).length}` : 'Заявки',
    });
  }, [delList, isDelList, navigation, renderLeft, renderRight]);

  const [showDateBegin, setShowDateBegin] = useState(false);
  const handleApplyDateBegin = (_event: any, selectedDateBegin: Date | undefined) => {
    setShowDateBegin(false);

    if (selectedDateBegin && _event.type !== 'dismissed') {
      dispatch(appActions.setFormParams({ filterDateBegin: selectedDateBegin.toISOString().slice(0, 10) }));
    }
  };
  const handlePresentDateBegin = () => {
    Keyboard.dismiss();
    setShowDateBegin(true);
  };

  const [showDateEnd, setShowDateEnd] = useState(false);

  const handleApplyDateEnd = (_event: any, selectedDateEnd: Date | undefined) => {
    setShowDateEnd(false);

    if (selectedDateEnd && _event.type !== 'dismissed') {
      dispatch(appActions.setFormParams({ filterDateEnd: selectedDateEnd.toISOString().slice(0, 10) }));
    }
  };

  const handlePresentDateEnd = () => {
    Keyboard.dismiss();
    setShowDateEnd(true);
  };

  const handleSearchContact = useCallback(() => {
    navigation.navigate('SelectRefItem', {
      refName: 'contact',
      fieldName: 'filterContact',
      value: filterContact && [filterContact],
    });
  }, [filterContact, navigation]);

  const handleSearchOutlet = useCallback(() => {
    navigation.navigate('SelectRefItem', {
      refName: 'outlet',
      fieldName: 'filterOutlet',
      clause: filterContact?.id
        ? {
            companyId: filterContact?.id,
          }
        : undefined,
      value: filterOutlet && [filterOutlet],
      descrFieldName: 'address',
    });
  }, [filterContact?.id, filterOutlet, navigation]);

  const handleFilterStatus = useCallback(
    (value: IListItem) => {
      dispatch(
        appActions.setFormParams({
          filterStatusList: filterStatusList.find((item) => item.id === value.id)
            ? filterStatusList.filter((i) => i.id !== value.id)
            : [...filterStatusList, value],
        }),
      );
    },
    [dispatch, filterStatusList],
  );

  const renderItem: ListRenderItem<IListItemProps> = ({ item }) => {
    const debt = debets?.find((d) => d.id === orderList.find((o) => o.id === item.id)?.head?.contact.id);
    const ex = orderList.find((o) => o.id === item.id);

    return (
      <ScreenListItem
        key={item.id}
        {...item}
        onPress={() =>
          isDelList
            ? setDelList(getDelList(delList, item.id, item.status!))
            : navigation.navigate('OrderView', { id: item.id })
        }
        onLongPress={() => setDelList(getDelList(delList, item.id, item.status!))}
        checked={!!delList[item.id]}
      >
        {!!debt?.saldoDebt && (
          <MediumText>
            {`Просрочено: ${formatValue({ type: 'currency', decimals: 2 }, debt?.saldoDebt ?? 0)}, ${debt.dayLeft} дн.`}
          </MediumText>
        )}
        {ex?.head?.expeditor ? <MediumText>Экспедитор: {ex?.head?.expeditor?.name}</MediumText> : null}
      </ScreenListItem>
    );
  };

  const renderSectionHeader = ({ section }: any) => (
    <SubTitle style={[styles.header, styles.sectionTitle]}>{section.title}</SubTitle>
  );

  const renderSectionFooter = useCallback(
    (item: any) => (status === 'all' && sections ? <OrderListTotal sectionOrders={item.section} /> : null),
    [sections, status],
  );

  const isFocused = useIsFocused();
  if (!isFocused) {
    return <AppActivityIndicator />;
  }

  const statusList: StatusTypes[] = [
    {
      name: 'Все',
      status: 'all',
    },
    {
      name: 'Текущие',
      status: 'active',
    },
    {
      name: 'Отказ',
      status: 'refuse',
    },
    {
      name: 'Архив',
      status: 'archive',
    },
  ];
  return (
    <AppScreen>
      <FilterButtons status={status} onPress={setStatus} style={styles.marginBottom5} statusList={statusList} />
      {filterVisible && (
        <>
          <View style={styles.flexDirectionRow}>
            <Searchbar
              placeholder="Поиск"
              onChangeText={setSearchQuery}
              value={searchQuery}
              style={[styles.flexGrow, styles.searchBar]}
              selectionColor={searchStyle}
            />
          </View>
          <View style={[localStyles.filter, { borderColor: colors.primary }]}>
            <SelectableInput label="Организация" value={filterContact?.name || ''} onPress={handleSearchContact} />
            <View style={localStyles.marginTop}>
              <SelectableInput label="Магазин" value={filterOutlet?.name || ''} onPress={handleSearchOutlet} />
            </View>
            <View style={[styles.flexDirectionRow, localStyles.marginTop]}>
              <View style={localStyles.width}>
                <SelectableInput
                  label="С даты отгрузки"
                  value={filterDateBegin ? getDateString(filterDateBegin) : ''}
                  onPress={handlePresentDateBegin}
                  style={[!filterDateBegin && localStyles.fontSize]}
                />
              </View>
              <View style={localStyles.width}>
                <SelectableInput
                  label="По дату отгрузки"
                  value={filterDateEnd ? getDateString(filterDateEnd || '') : ''}
                  onPress={handlePresentDateEnd}
                  style={[!filterDateEnd && localStyles.fontSize, localStyles.marginInput]}
                />
              </View>
            </View>
            <View style={[localStyles.marginTop, localStyles.status]}>
              {statusTypesSection.map((elem) => (
                <View key={elem.id}>
                  <Checkbox
                    key={elem.id}
                    title={elem.value}
                    selected={!!filterStatusList.find((i) => i.id === elem.id)}
                    onSelect={() => handleFilterStatus(elem)}
                  />
                </View>
              ))}
            </View>
            <View style={localStyles.container}>
              <PrimeButton
                icon={'delete-outline'}
                onPress={handleCleanFormParams}
                disabled={
                  !(
                    filterContact ||
                    filterOutlet ||
                    filterDateBegin ||
                    filterDateEnd ||
                    filterStatusList.length ||
                    searchQuery
                  )
                }
              >
                {'Очистить'}
              </PrimeButton>
            </View>
          </View>
          <ItemSeparator />
        </>
      )}
      <SectionList
        sections={sections}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ItemSeparatorComponent={ItemSeparator}
        renderSectionHeader={renderSectionHeader}
        ListEmptyComponent={EmptyList}
        renderSectionFooter={renderSectionFooter}
        keyboardShouldPersistTaps={'handled'}
      />
      {showDateBegin && (
        <DateTimePicker
          testID="dateTimePicker"
          value={new Date(filterDateBegin || new Date())}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={handleApplyDateBegin}
        />
      )}
      {showDateEnd && (
        <DateTimePicker
          testID="dateTimePicker"
          value={new Date(filterDateEnd || new Date())}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={handleApplyDateEnd}
        />
      )}
    </AppScreen>
  );
};

export default OrderListScreen;

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
  width: {
    width: '50%',
  },
  fontSize: {
    fontSize: 14,
  },
  marginInput: {
    marginLeft: 5,
  },
  container: {
    alignItems: 'center',
    marginTop: -4,
  },
  status: {
    marginHorizontal: 5,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
