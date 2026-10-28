import React, { useState, useLayoutEffect, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ColorValue,
  Alert,
  useWindowDimensions,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
  Keyboard,
  Platform,
} from 'react-native';
import { RouteProp, useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { Badge, Chip, Divider, IconButton, MD2Theme, Searchbar, useTheme } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';

import {
  globalStyles as styles,
  SearchButton,
  navBackButton,
  MediumText,
  SubTitle,
  globalColors,
  ItemSeparator,
  AppActivityIndicator,
  AppScreen,
  Switch,
  SelectableInput,
  PrimeButton,
} from '@lib/mobile-ui';
import { appActions, docSelectors, documentActions, refSelectors, useDispatch, useSelector } from '@lib/store';

import { generateId, getDateString, keyExtractor, shortenString } from '@lib/mobile-hooks';

import { StackNavigationProp } from '@react-navigation/stack';

import { MaterialCommunityIcons } from '@expo/vector-icons';

import { INamedEntity } from '@lib/types';

import { OrdersStackParamList } from '../../navigation/Root/types';
import {
  IGood,
  IGoodGroup,
  IGoodMatrix,
  IGoodSales,
  IGroupFormParam,
  IMGroupModel,
  IOrderDocument,
  IOrderLine,
  IRemains,
  IRemGood,
} from '../../store/types';
import { UNKNOWN_GROUP } from '../../utils/constants';
import { getGoodMatrixByContact, getGroupModelByContact, getRemGoodListByContact } from '../../utils/helpers';

import { OrderLineDialog } from './components/OrderLineDialog';
import OrderLineEdit, { IOrderItemLine } from './components/OrderLineEdit';

const SelectGoodScreen = () => {
  const navigation = useNavigation<StackNavigationProp<OrdersStackParamList, 'SelectGood'>>();
  const { docId } = useRoute<RouteProp<OrdersStackParamList, 'SelectGood'>>().params;
  const dispatch = useDispatch();

  const { colors } = useTheme<MD2Theme>();

  const settings = useSelector((state) => state.settings.data);
  const isUseNetPrice = settings?.isUseNetPrice?.data as boolean;
  const isUseRemains = settings?.isUseRemains?.data as boolean;
  const isUseUnitMeasure = (settings?.isUseUnitMeasure?.data ?? true) as boolean;

  const [isUseMatrix, setIsUseMatrix] = useState(isUseNetPrice);
  const [useRemains, setUseRemains] = useState(isUseRemains);
  const [isShowPrev, setParamsVisible] = useState(false);

  const syncDate = useSelector((state) => state.app.syncDate);
  const isDemo = useSelector((state) => state.auth.isDemo);

  useEffect(() => {
    if (syncDate && getDateString(syncDate) !== getDateString(new Date()) && !isDemo) {
      return Alert.alert('Внимание!', 'В справочнике устаревшие данные, требуется синхронизация', [{ text: 'OK' }]);
    }
  }, [syncDate, isDemo]);

  const [filterDateBegin, setFilterDateBegin] = useState<string | undefined>(
    new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  );

  const [filterDateEnd, setFilterDateEnd] = useState<string | undefined>(
    new Date(new Date().getTime() + 1 * 24 * 60 * 60 * 1000).toISOString(),
  );
  const doc = docSelectors.selectByDocId<IOrderDocument>(docId);

  const goodMatrix = refSelectors.selectByName<IGoodMatrix>('goodMatrix')?.data?.[0];
  const goodSales = refSelectors.selectByName<IGoodSales>('goodSales')?.data?.[0];
  const goodsRef = refSelectors.selectByName<IGood>('good').data;
  const refGroup = refSelectors.selectByName<IGoodGroup>('goodGroup');
  const groups = useMemo(() => refGroup.data.concat(UNKNOWN_GROUP), [refGroup.data]);
  // const groupsConcat = useMemo(() => refGroup.data.concat(UNKNOWN_GROUP), [refGroup.data]);
  // const groups = useMemo(
  //   () =>
  //     isUseRemains && useRemains
  //       ? groupsConcat.filter((i) => (!i.parent?.id ? i.id === doc?.head.depart?.id : true))
  //       : groupsConcat,
  //   [doc?.head.depart?.id, groupsConcat, isUseRemains, useRemains],
  // );

  const remains = refSelectors.selectByName<IRemains>('remains')?.data?.[0];

  // const [goodRemains] = useState<IRemGood[]>(() =>
  //   doc?.head.depart?.id ? getRemGoodListByContact(goodsRef, remains?.[doc?.head.depart?.id], true) : [],
  // );
  const employeeData = refSelectors.selectByName<INamedEntity>('employee')?.data;
  const employee = useMemo(() => employeeData || [], [employeeData]);

  //useMemo, а не useState: список остатков должен обновляться после синхронизации,
  //пока экран открыт
  const goodRemains = useMemo<IRemGood[]>(
    () => (employee?.[0] ? getRemGoodListByContact(goodsRef, remains?.[employee?.[0].id], true) : []),
    [goodsRef, remains, employee],
  );
  const goods =
    useRemains && isUseRemains ? goodsRef.filter((item) => goodRemains.find((i) => i.good.id === item.id)) : goodsRef;

  const contactId = doc?.head.contact.id;
  const outletId = doc?.head.outlet.id;

  const priceRedByGoodId = useMemo(() => {
    const salesByOutlet = outletId ? goodSales?.[outletId] || [] : [];
    return salesByOutlet.reduce<Record<string, number>>((prev, item) => {
      prev[item.goodId] = item.priceRed;
      return prev;
    }, {});
  }, [goodSales, outletId]);

  const getGoodWithPriceRed = useCallback(
    (good: IGood) => {
      const priceRed = priceRedByGoodId[good.id];
      return typeof priceRed === 'number' ? { ...good, priceRed } : good;
    },
    [priceRedByGoodId],
  );

  const docs = useSelector((state) => state.documents.list) as IOrderDocument[];
  const prevOrderByOutlet = useMemo(
    () =>
      doc && isShowPrev && (filterDateBegin || filterDateEnd)
        ? docs
            .filter(
              (o) =>
                o.documentType.name === 'order' &&
                o.head.outlet.id === outletId &&
                o.id !== doc.id &&
                new Date(o.documentDate).getTime() < new Date(doc.documentDate).getTime() &&
                (filterDateBegin
                  ? new Date(o.head.onDate.slice(0, 10)).getTime() >= new Date(filterDateBegin.slice(0, 10)).getTime()
                  : true) &&
                (filterDateEnd
                  ? new Date(o.head.onDate.slice(0, 10)).getTime() <= new Date(filterDateEnd.slice(0, 10)).getTime()
                  : true),
            )
            .sort((a, b) => new Date(b.documentDate).getTime() - new Date(a.documentDate).getTime())
        : [],
    [doc, isShowPrev, docs, outletId, filterDateBegin, filterDateEnd],
  );

  const prevLines = useMemo(
    () =>
      prevOrderByOutlet.length
        ? prevOrderByOutlet.reduce((prev: IOrderLine[], cur) => {
            prev = [...prev, ...cur.lines];
            return prev;
          }, [])
        : [],
    [prevOrderByOutlet],
  );

  const { parentGroupId } = useSelector((state) => state.app.formParams as IGroupFormParam);

  const [filterVisible, setFilterVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const windowWidth = useWindowDimensions().width;
  const groupButtonStyle: StyleProp<ViewStyle> = useMemo(
    () => ({
      width: windowWidth > 550 ? '23%' : '31%',
    }),
    [windowWidth],
  );

  const model = useMemo(
    () =>
      (isShowPrev && !prevLines.length
        ? {}
        : contactId
          ? getGroupModelByContact(groups, goods, goodMatrix[contactId], isUseMatrix, isShowPrev ? prevLines : [])
          : {}) as IMGroupModel,
    [contactId, groups, goods, goodMatrix, isUseMatrix, isShowPrev, prevLines],
  );

  const firstLevelGroups = useMemo(() => Object.values(model).map((item) => item.parent), [model]);

  const [selectedParentGroup, setSelectedParentGroup] = useState<IGoodGroup | undefined>(
    parentGroupId ? groups.find((group) => group.id === parentGroupId) || firstLevelGroups[0] : firstLevelGroups[0],
  );

  const nextLevelGroups = useMemo(
    () => (selectedParentGroup ? model[selectedParentGroup.id]?.children?.map((gr) => gr.group) || [] : []),
    [selectedParentGroup, model],
  );

  const [selectedGroup, setSelectedGroup] = useState<IGoodGroup | undefined>(undefined);

  //После синхронизации модель групп может перестроиться - сбрасываем выбранную группу,
  //если её больше нет в модели, иначе список останется пустым до ручного пер тыка
  useEffect(() => {
    if (selectedParentGroup && !firstLevelGroups.some((group) => group.id === selectedParentGroup.id)) {
      setSelectedParentGroup(firstLevelGroups[0]);
      setSelectedGroup(undefined);
    } else if (selectedGroup && !nextLevelGroups.some((group) => group.id === selectedGroup.id)) {
      setSelectedGroup(undefined);
    }
  }, [firstLevelGroups, nextLevelGroups, selectedGroup, selectedParentGroup]);

  const goodModel = useMemo(
    () =>
      selectedParentGroup && selectedGroup
        ? model[selectedParentGroup.id]?.children
            ?.find((gr) => gr.group.id === selectedGroup?.id || '')
            ?.goods?.sort((a, b) => (a.name < b.name ? -1 : 1)) || []
        : [],
    [selectedGroup, selectedParentGroup, model],
  );

  const goodsByContact = useMemo(() => {
    if (contactId) {
      const goodList = getGoodMatrixByContact(goods, goodMatrix[contactId], isUseMatrix, undefined, searchQuery);
      return (isShowPrev ? goodList?.filter((g) => prevLines.some((p) => p.good.id === g.id)) : goodList)?.sort(
        (a, b) => (a.name < b.name ? -1 : 1),
      );
    } else {
      return [];
    }
  }, [contactId, goodMatrix, goods, isShowPrev, isUseMatrix, prevLines, searchQuery]);

  useEffect(() => {
    if (!filterVisible && searchQuery) {
      setSearchQuery('');
    }
  }, [filterVisible, searchQuery]);

  const [selectedLine, setSelectedLine] = useState<IOrderLine | undefined>(undefined);
  const [selectedGood, setSelectedGood] = useState<IGood | undefined>(undefined);

  const prevIconStyle = useMemo(
    () => (isShowPrev ? { backgroundColor: colors.background, opacity: 0.8 } : {}),
    [colors.background, isShowPrev],
  );

  const renderRight = useCallback(
    () => (
      <View style={styles.buttons}>
        <View style={styles.viewRight_30}>
          <IconButton
            icon={'page-previous-outline'}
            size={26}
            style={[styles.icon_30, prevIconStyle]}
            onPress={() => setParamsVisible((prev) => !prev)}
          />
        </View>
        <SearchButton
          onPress={() => {
            setFilterVisible((prev) => !prev);
          }}
          visible={filterVisible}
        />
      </View>
    ),
    [filterVisible, prevIconStyle],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: navBackButton,
      headerRight: renderRight,
    });
  }, [navigation, renderRight]);

  const [orderLine, setOrderLine] = useState<IOrderItemLine | undefined>();

  const handleAddLine = useCallback(() => {
    if (selectedLine) {
      setOrderLine({
        mode: 0,
        docId,
        item: {
          id: generateId(),
          good: selectedLine.good,
          quantity: 0,
          remains: selectedLine.remains,
          agentRemains: selectedLine.agentRemains,
        },
      });
      setSelectedLine(undefined);
    } else if (selectedGood) {
      const goodQuantity = isUseRemains ? goodRemains?.find((i) => i.good.id === selectedGood.id) : undefined;

      setOrderLine({
        mode: 0,
        docId,
        item: {
          id: generateId(),
          good: selectedGood,
          quantity: 0,
          remains: goodQuantity?.remains,
          agentRemains: goodQuantity?.agentRemains,
        },
      });
      setSelectedGood(undefined);
    }
  }, [selectedLine, selectedGood, docId, goodRemains, isUseRemains]);

  const handleEditLine = useCallback(() => {
    if (selectedLine) {
      setOrderLine({ mode: 1, docId, item: selectedLine });
      setSelectedLine(undefined);
    }
  }, [docId, selectedLine]);

  const handleDeleteLine = useCallback(() => {
    if (selectedLine) {
      Alert.alert('Вы уверены, что хотите удалить позицию?', '', [
        {
          text: 'Да',
          onPress: () => {
            dispatch(documentActions.removeDocumentLine({ docId, lineId: selectedLine.id }));
          },
        },
        {
          text: 'Отмена',
        },
      ]);
      hadndleDismissDialog();
    } else if (selectedGood && doc) {
      const lineIds: string[] = doc.lines?.filter((i) => i.good.id === selectedGood?.id)?.map((i) => i.id);
      Alert.alert(`Вы уверены, что хотите удалить ${lineIds.length > 1 ? 'все позиции' : 'позицию'} ?`, '', [
        {
          text: 'Да',
          onPress: () => {
            dispatch(documentActions.removeDocumentLines({ docId, lineIds }));
          },
        },
        {
          text: 'Отмена',
        },
      ]);
      hadndleDismissDialog();
    }
  }, [dispatch, doc, docId, selectedGood, selectedLine]);

  const hadndleDismissDialog = () => {
    setSelectedLine(undefined);
    setSelectedGood(undefined);
  };

  const [showDateBegin, setShowDateBegin] = useState(false);

  const handleApplyDateBegin = (_event: any, selectedDateBegin: Date | undefined) => {
    setShowDateBegin(false);

    if (selectedDateBegin && _event.type !== 'dismissed') {
      setFilterDateBegin(selectedDateBegin.toISOString().slice(0, 10));
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
      setFilterDateEnd(selectedDateEnd.toISOString().slice(0, 10));
    }
  };

  const handlePresentDateEnd = () => {
    Keyboard.dismiss();
    setShowDateEnd(true);
  };

  const handleCleanParams = () => {
    setFilterDateBegin('');
    setFilterDateEnd('');
  };

  const Group = useCallback(
    ({
      values,
      onPress,
      selectedGroupId,
      colorBack,
      colorSelected,
    }: {
      values: IGoodGroup[];
      onPress: (item: IGoodGroup) => void;
      selectedGroupId?: string;
      colorBack: ColorValue;
      colorSelected: ColorValue;
    }) => {
      return (
        <View style={localStyles.groupItem}>
          <View style={localStyles.flexRowWrap}>
            {values.map((item) => {
              const colorStyle = { color: item.id === selectedGroupId ? 'white' : colors.text };
              const backColorStyle = { backgroundColor: item.id === selectedGroupId ? colorSelected : colorBack };
              const badgeColor = {
                backgroundColor: item.decoration?.color ? item.decoration.color : 'transparent',
              };
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => onPress(item)}
                  style={[localStyles.button, backColorStyle, styles.flexDirectionRow, groupButtonStyle]}
                >
                  <Text style={[localStyles.buttonLabel, colorStyle]}>{shortenString(item.name, 60) || item.id}</Text>
                  {item.decoration?.name && (
                    <Badge style={[localStyles.badge, badgeColor]} size={10}>
                      {item.decoration.name.toUpperCase()}
                    </Badge>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      );
    },
    [colors.text, groupButtonStyle],
  );

  const handlePressGood = useCallback(
    (isAdded: boolean, item: IGood, goodQuantity?: IRemGood) => {
      if (isAdded) {
        setSelectedGood(item);
      } else {
        const newLine = {
          mode: 0,
          docId,
          item: {
            id: generateId(),
            good: item,
            quantity: 0,
            remains: goodQuantity?.remains,
            agentRemains: goodQuantity?.agentRemains,
          },
        };
        setOrderLine(newLine);
      }
    },
    [docId],
  );

  const renderGood = useCallback(
    ({ item }: { item: IGood }) => {
      const goodItem = getGoodWithPriceRed(item);
      const lines = doc?.lines?.filter((i) => i.good.id === item.id);
      const isAdded = !!lines?.length;
      const prevLine = prevLines.filter((i) => i.good.id === item.id);
      const iconStyle = [styles.icon, { backgroundColor: isAdded ? '#06567D' : '#E91E63' }];

      const goodStyle = {
        backgroundColor: isAdded ? globalColors.backgroundLight : 'transparent',
      };

      const goodQuantity = isUseRemains ? goodRemains?.find((i) => i.good.id === item.id) : undefined;
      return (
        <View key={item.id}>
          <TouchableOpacity onPress={() => handlePressGood(isAdded, goodItem, goodQuantity)}>
            <View style={[localStyles.goodItem, goodStyle]}>
              <View style={iconStyle}>
                <MaterialCommunityIcons name={'file-document'} size={20} color={'#FFF'} />
              </View>
              <View style={styles.details}>
                <MediumText style={styles.textBold}>{item.name || item.id}</MediumText>
                {!!item.barcode && isUseRemains && <MediumText style={localStyles.barcode}>{item.barcode}</MediumText>}
                {isUseRemains && useRemains && (
                  <View style={localStyles.remains}>
                    <IconButton icon={'store-check-outline'} size={18} iconColor={colors.text} />
                    <MediumText>Остаток: {goodQuantity?.remains || 0}</MediumText>
                  </View>
                )}
                {isUseRemains && useRemains && (
                  <View style={localStyles.remains}>
                    <IconButton icon={'store-check-outline'} size={18} iconColor={colors.text} />
                    <MediumText>Остаток по агенту: {goodQuantity?.agentRemains || 0}</MediumText>
                  </View>
                )}
                {isAdded && (
                  <View style={localStyles.lineView}>
                    {lines.map((line) => (
                      <Chip
                        key={line.id}
                        style={[localStyles.lineChip, { borderColor: colors.primary }]}
                        onPress={() => setSelectedLine(line)}
                      >
                        {line.quantity} кг, уп.: {line.package ? line.package.name : 'без упаковки'}
                      </Chip>
                    ))}
                  </View>
                )}
                {!!prevLine.length && (
                  <View style={localStyles.lineView}>
                    <MaterialCommunityIcons name={'page-previous-outline'} size={14} color={colors.placeholder} />
                    {prevLine.map((line) => (
                      <MediumText key={line.id} style={localStyles.prevText}>
                        {` ${line.quantity} кг, уп: ${line.package ? line.package.name : 'без упаковки'};`}
                      </MediumText>
                    ))}
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        </View>
      );
    },
    [
      colors.placeholder,
      colors.primary,
      colors.text,
      doc?.lines,
      goodRemains,
      handlePressGood,
      getGoodWithPriceRed,
      isUseRemains,
      prevLines,
      useRemains,
    ],
  );

  const handlePressGroup = useCallback(
    (paramName: string, item: IGoodGroup, setFunc: any) => {
      setFunc(item);
      dispatch(
        appActions.setFormParams({
          [paramName]: item?.id,
        }),
      );
    },
    [dispatch],
  );

  const renderGroupHeader = useCallback(
    () => (
      <View>
        <Group
          key={'firstLevelGroups'}
          values={firstLevelGroups}
          onPress={(item) => handlePressGroup('parentGroupId', item, setSelectedParentGroup)}
          selectedGroupId={selectedParentGroup?.id}
          colorBack={'#d5dce3'}
          colorSelected={colors.placeholder}
        />
        <Group
          key={'nextLevelGroups'}
          values={nextLevelGroups}
          onPress={(item) => handlePressGroup('groupId', item, setSelectedGroup)}
          selectedGroupId={selectedGroup?.id}
          colorBack={'#dbd5da'}
          colorSelected={'#854875'}
        />
      </View>
    ),
    [
      Group,
      colors.placeholder,
      firstLevelGroups,
      handlePressGroup,
      nextLevelGroups,
      selectedGroup?.id,
      selectedParentGroup?.id,
    ],
  );

  const hadndleDismiss = () => {
    setOrderLine(undefined);
    hadndleDismissDialog();
  };

  const isFocused = useIsFocused();
  if (!isFocused) {
    return <AppActivityIndicator />;
  }

  return (
    <AppScreen style={localStyles.container}>
      {!!orderLine && (
        <OrderLineEdit
          orderLine={orderLine}
          onDismiss={hadndleDismiss}
          isUseRemains={isUseRemains}
          isUseUnitMeasure={isUseUnitMeasure}
        />
      )}
      {filterVisible && (
        <View>
          <View style={styles.flexDirectionRow}>
            <Searchbar
              placeholder="Поиск"
              onChangeText={(text) => {
                setSearchQuery(text);
              }}
              value={searchQuery}
              style={[styles.flexGrow, styles.searchBar]}
              autoFocus
              selectionColor={colors.primary}
            />
          </View>
          <ItemSeparator />
        </View>
      )}
      <View>
        {contactId && goodMatrix[contactId] && (
          <View style={localStyles.switch}>
            <MediumText>Использовать матрицы</MediumText>
            <Switch value={isUseMatrix} onValueChange={() => setIsUseMatrix(!isUseMatrix)} />
          </View>
        )}
        {isUseRemains && (
          <View style={localStyles.switch}>
            <MediumText>Использовать остатки</MediumText>
            <Switch value={useRemains} onValueChange={() => setUseRemains(!useRemains)} />
          </View>
        )}
        {contactId && goodMatrix[contactId] && !isShowPrev && filterVisible && (
          <Divider style={{ backgroundColor: colors.primary }} />
        )}
      </View>

      {isShowPrev && (
        <>
          <View style={[localStyles.filter, { borderColor: colors.primary }]}>
            <View style={styles.flexDirectionRow}>
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

            <View style={localStyles.clearButton}>
              <PrimeButton
                icon={'delete-outline'}
                onPress={handleCleanParams}
                disabled={!(filterDateBegin || filterDateEnd)}
                style={localStyles.primeButton}
              >
                {'Очистить'}
              </PrimeButton>
            </View>
          </View>
        </>
      )}
      <FlashList
        data={filterVisible ? goodsByContact : goodModel}
        renderItem={renderGood}
        ListHeaderComponent={filterVisible ? undefined : renderGroupHeader}
        estimatedItemSize={60}
        ItemSeparatorComponent={ItemSeparator}
        keyExtractor={keyExtractor}
        extraData={[doc?.lines, docId]}
        keyboardShouldPersistTaps={'handled'}
        ListEmptyComponent={
          isUseRemains && useRemains ? (
            <SubTitle style={localStyles.emptyRemains}>
              {goodRemains.length
                ? 'Список пуст'
                : 'Нет данных по остаткам. Отключите режим «Использовать остатки» или выполните синхронизацию'}
            </SubTitle>
          ) : null
        }
      />
      {(selectedLine || selectedGood) && (
        <OrderLineDialog
          selectedLine={selectedLine}
          goodName={selectedLine?.good.name || selectedGood?.name || ''}
          onEditLine={handleEditLine}
          onAddLine={handleAddLine}
          onDeleteLine={handleDeleteLine}
          onDismissDialog={hadndleDismissDialog}
        />
      )}
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

export default SelectGoodScreen;

const localStyles = StyleSheet.create({
  container: {
    justifyContent: 'flex-start',
  },
  groupItem: {
    marginBottom: 2,
    flex: 1,
  },
  goodItem: {
    alignItems: 'center',
    flexDirection: 'row',
    padding: 3,
    minHeight: 50,
    fontWeight: 'bold',
    opacity: 0.9,
  },
  flexRowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  lineView: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  lineChip: {
    margin: 2,
  },
  button: {
    padding: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginHorizontal: '1%',
    margin: 3,
    textAlign: 'center',
    height: 78,
  },
  buttonLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    opacity: 0.9,
    lineHeight: 14,
    textAlignVertical: 'center',
    height: 70,
  },
  prevText: {
    fontSize: 10,
  },
  badge: {
    position: 'absolute',
    right: 2,
    top: 2,
  },
  switch: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 12,
    fontSize: 20,
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  filter: {
    paddingTop: 5,
    marginVertical: 5,
    marginBottom: 12,
    borderWidth: 1,
    borderRadius: 2,
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
  clearButton: {
    alignItems: 'center',
    marginTop: -10,
  },
  primeButton: { height: 40 },
  remains: { flexDirection: 'row', alignItems: 'center' },
  barcode: { fontSize: 12, opacity: 0.8 },
  emptyRemains: { textAlign: 'center', padding: 16 },
});
