import React, { useState, useEffect, useCallback, useLayoutEffect, useMemo } from 'react';
import { View, FlatList, Alert, TouchableOpacity } from 'react-native';
import { Searchbar, Divider, Checkbox } from 'react-native-paper';

import { RouteProp, useNavigation, useRoute, useScrollToTop, useTheme } from '@react-navigation/native';
import { IReferenceData, ScreenState } from '@lib/types';
import { appActions, refSelectors } from '@lib/store';
import {
  AppScreen,
  ItemSeparator,
  SaveButton,
  SearchButton,
  SubTitle,
  globalStyles as styles,
  LargeText,
  navBackButton,
} from '@lib/mobile-ui';

import { extraPredicate, keyExtractor } from '@lib/mobile-hooks';

import { FlashList } from '@shopify/flash-list';

import { useDispatch } from '../store';

import { RefParamList } from '../navigation/Root/types';
import { IOutlet } from '../store/types';

const SelectRefItemScreen = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const {
    refName,
    isMulti,
    fieldName,
    value,
    clause,
    refFieldName = 'name',
    descrFieldName,
  } = useRoute<RouteProp<RefParamList, 'SelectRefItem'>>().params;
  const { colors } = useTheme();

  const refObj = refSelectors.selectByName<IReferenceData>(refName);

  const list = useMemo(() => {
    if (clause && refObj?.data) {
      return refObj?.data
        .filter((item) => {
          const newParams = Object.assign({}, clause);

          let companyFound = true;
          let parentFound = true;

          Object.keys(clause).forEach((i) => {
            if (i in item) {
              if (typeof clause[i] !== 'object' && typeof item[i] !== 'object' && item[i] === clause[i]) {
              }
            }
          });
          companyFound = newParams.companyId ? (item as IOutlet).company.id.includes(newParams.companyId) : true;
          delete newParams.companyId;

          parentFound =
            newParams.groupParent === 'notNull'
              ? !!item.parent?.id
              : newParams.groupParent && item.parent?.id
                ? item.parent.id.includes(newParams.groupParent)
                : true;
          delete newParams.groupParent;

          return companyFound && parentFound && extraPredicate(item, newParams);
        })
        .sort((a, b) => (a[refFieldName] < b[refFieldName] ? -1 : 1));
    }

    return refObj?.data?.sort((a, b) => (a[refFieldName] < b[refFieldName] ? -1 : 1));
  }, [clause, refFieldName, refObj?.data]);

  const title = refObj?.description || refObj?.name;

  const [screenState, setScreenState] = useState<ScreenState>('idle');

  const [searchQuery, setSearchQuery] = useState('');
  const [filterVisible, setFilterVisible] = useState(false);
  const [filteredList, setFilteredList] = useState<IReferenceData[]>();
  const [checkedItem, setCheckedItem] = useState<IReferenceData[]>(value || []);

  useEffect(() => {
    if (!list) {
      return;
    }
    const query = searchQuery.toUpperCase();
    setFilteredList(
      list
        .filter(
          (i) =>
            i[refFieldName]?.toUpperCase().includes(query) ||
            (descrFieldName ? i[descrFieldName]?.toUpperCase().includes(query) : false),
        )
        .sort((a) => {
          return checkedItem?.find((v) => v.id === a.id) ? -1 : 1;
        }),
    );

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMulti, list, refFieldName, descrFieldName, searchQuery, value]);

  useEffect(() => {
    if (!filterVisible && searchQuery) {
      setSearchQuery('');
    }
  }, [filterVisible, searchQuery]);

  // FlashList совместим с хуком в рантайме (scrollToOffset), но типы useScrollToTop
  // не учитывают null из useRef в типах React 19 — приводим явно
  const refList = React.useRef<FlashList<IReferenceData> | null>(null);
  useScrollToTop(refList as unknown as React.RefObject<FlatList<IReferenceData>>);

  const handleSelectItem = useCallback(
    (item: IReferenceData) => {
      if (isMulti) {
        setCheckedItem((prev) =>
          prev.find((i) => i.id === item.id) ? prev.filter((i) => i.id !== item.id) : [...prev, item],
        );
      } else if (checkedItem.find((i) => i.id === item.id)) {
        setCheckedItem([]);
        dispatch(
          appActions.setFormParams({
            [fieldName]: undefined,
          }),
        );
      } else {
        setScreenState('saving');
        dispatch(
          appActions.setFormParams({
            [fieldName]: item,
          }),
        );
        navigation.goBack();
      }
    },
    [isMulti, checkedItem, dispatch, fieldName, navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: IReferenceData }) => {
      const isChecked = !!checkedItem?.find((i) => i.id === item.id);
      return (
        <LineItem
          item={item}
          isChecked={isChecked}
          onCheck={handleSelectItem}
          refFieldName={refFieldName}
          descrFieldName={descrFieldName}
          disabled={screenState === 'saving' ? true : false}
        />
      );
    },
    [checkedItem, handleSelectItem, refFieldName, descrFieldName, screenState],
  );

  const renderRight = useCallback(
    () => (
      <View style={styles.buttons}>
        <SearchButton visible={filterVisible} onPress={() => setFilterVisible((prev) => !prev)} />
        {isMulti && (
          <SaveButton
            onPress={() => {
              if (!checkedItem) {
                Alert.alert('Ошибка!', 'Необходимо выбрать элемент.', [{ text: 'OK' }]);
                return;
              }
              dispatch(appActions.setFormParams({ [fieldName]: checkedItem }));
              navigation.goBack();
            }}
          />
        )}
      </View>
    ),
    [checkedItem, dispatch, fieldName, filterVisible, isMulti, navigation],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: navBackButton,
      headerRight: renderRight,
    });
  }, [navigation, renderRight]);

  return (
    <AppScreen>
      <SubTitle style={styles.title}>{title}</SubTitle>
      <Divider />
      {filterVisible && (
        <>
          <View style={styles.flexDirectionRow}>
            <Searchbar
              placeholder="Поиск"
              onChangeText={setSearchQuery}
              value={searchQuery}
              style={[styles.flexGrow, styles.searchBar]}
              autoFocus
              selectionColor={colors.primary}
            />
          </View>
          <ItemSeparator />
        </>
      )}
      <FlashList
        data={filteredList}
        renderItem={renderItem}
        estimatedItemSize={40}
        ItemSeparatorComponent={ItemSeparator}
        keyExtractor={keyExtractor}
        keyboardShouldPersistTaps={'handled'}
        extraData={[checkedItem, screenState]}
      />
    </AppScreen>
  );
};

const LineItem = React.memo(
  ({
    item,
    isChecked,
    onCheck,
    refFieldName,
    descrFieldName,
    disabled,
  }: {
    item: IReferenceData;
    isChecked: boolean;
    onCheck: (id: IReferenceData) => void;
    refFieldName: string;
    descrFieldName?: string;
    disabled?: boolean;
  }) => {
    const { colors } = useTheme();
    const viewStyle = [styles.item, { backgroundColor: colors.background }];
    const handleCheckItem = () => onCheck(item);

    return (
      <TouchableOpacity onPress={handleCheckItem} disabled={disabled}>
        <View style={viewStyle}>
          <Checkbox status={isChecked ? 'checked' : 'unchecked'} color={colors.primary} />
          <View style={styles.details}>
            <View style={styles.rowCenter}>
              <LargeText style={styles.textBold}>{item[refFieldName] || item.id}</LargeText>
            </View>
            {descrFieldName ? (
              <View style={styles.rowCenter}>
                <LargeText style={styles.textDescription}>{item[descrFieldName]}</LargeText>
              </View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  },
);

export default SelectRefItemScreen;
