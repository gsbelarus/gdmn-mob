import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { styles } from '@lib/mobile-navigation';
import { Searchbar } from 'react-native-paper';
import { RouteProp, useNavigation, useRoute, useTheme } from '@react-navigation/native';
import {
  AppScreen,
  ItemSeparator,
  SubTitle,
  globalStyles,
  Menu,
  SearchButton,
  navBackButton,
  EmptyList,
} from '@lib/mobile-ui';

import { refSelectors, useSelector } from '@lib/store';

import { IDepartment, IReferences } from '@lib/types';

import { IListItem } from '@lib/mobile-types';

import { FlashList } from '@shopify/flash-list';

import { RemainsStackParamList } from '../../navigation/Root/types';

import { IGood, IRemains, IRemGood } from '../../store/app/types';
import { getRemGoodListByContact } from '../../utils/helpers';

import GoodItem from './components/GoodItem';

interface IFilteredList {
  searchQuery: string;
  goodRemains: IRemGood[];
}

const keyExtractor = (item: IRemGood) => String(item.good.id);

const GoodListScreen = () => {
  const { id } = useRoute<RouteProp<RemainsStackParamList, 'GoodList'>>().params;
  const references = useSelector((state) => state.references.list) as IReferences;

  const contacts = Object.entries(references).find((item) => item[1].data.find((i) => i.id === id))?.[1]
    .data as IDepartment[];
  const contact = contacts?.find((i) => i.id === id);

  const remains = refSelectors.selectByName<IRemains>('remains')?.data[0];

  const goods = refSelectors.selectByName<IGood>('good')?.data;

  const [goodRemains] = useState<IRemGood[]>(() =>
    contact?.id ? getRemGoodListByContact(goods, remains?.[contact.id], true) : [],
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [filterVisible, setFilterVisible] = useState(false);
  const { colors } = useTheme();
  const navigation = useNavigation();

  const [visibleMenu, setVisibleMenu] = useState(false);

  const remainsList: IListItem[] = useMemo(
    () => [
      {
        id: 'all',
        value: 'Все',
      },
      {
        id: 'notNull',
        value: 'Ненулевые',
      },
    ],
    [],
  );

  const [rem, setRem] = useState(remainsList[0]);

  const [filteredList, setFilteredList] = useState<IFilteredList>({
    searchQuery: '',
    goodRemains,
  });

  const handleApply = useCallback(
    (option: IListItem) => {
      setVisibleMenu(false);
      setFilteredList({
        searchQuery,
        goodRemains: option.id === 'all' ? goodRemains : goodRemains.filter((item) => item.remains > 0),
      });

      setRem(option);
    },
    [goodRemains, searchQuery],
  );

  useEffect(() => {
    if (searchQuery !== filteredList.searchQuery) {
      if (!searchQuery) {
        setFilteredList({
          searchQuery,
          goodRemains,
        });
      } else {
        const lower = searchQuery.toLowerCase();

        const fn = isNaN(Number(lower))
          ? ({ good }: IRemGood) => good.name?.toLowerCase().includes(lower)
          : ({ good }: IRemGood) => good.barcode?.includes(searchQuery) || good.name?.toLowerCase().includes(lower);

        let gr;

        if (
          filteredList.searchQuery &&
          searchQuery.length > filteredList.searchQuery.length &&
          searchQuery.startsWith(filteredList.searchQuery)
        ) {
          gr = filteredList.goodRemains.filter(fn);
        } else {
          gr = goodRemains.filter(fn);
        }

        setFilteredList({
          searchQuery,
          goodRemains: gr,
        });
      }
    }
  }, [goodRemains, filteredList, searchQuery]);

  useEffect(() => {
    if (!filterVisible && searchQuery) {
      setSearchQuery('');
    }
  }, [filterVisible, searchQuery]);

  const renderRight = useCallback(
    () => (
      <View style={globalStyles.buttons}>
        <SearchButton onPress={() => setFilterVisible((prev) => !prev)} visible={filterVisible} />
        <Menu
          key={'MenuType'}
          visible={visibleMenu}
          onChange={handleApply}
          onDismiss={() => setVisibleMenu(false)}
          onPress={() => setVisibleMenu(true)}
          options={remainsList}
          activeOptionId={rem.id}
          iconName="filter-outline"
          iconSize={25}
        />
      </View>
    ),
    [filterVisible, handleApply, rem.id, remainsList, visibleMenu],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: navBackButton,
      headerRight: renderRight,
    });
  }, [navigation, renderRight]);

  const renderItem = ({ item }: { item: IRemGood }) => <GoodItem item={item} />;

  return (
    <AppScreen>
      <SubTitle style={[localStyles.title]}>{contact?.name}</SubTitle>
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
        data={filteredList.goodRemains}
        estimatedItemSize={60}
        renderItem={renderItem}
        ItemSeparatorComponent={ItemSeparator}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={!goods || !goodRemains.length ? EmptyList : null}
        keyExtractor={keyExtractor}
      />
    </AppScreen>
  );
};

export default GoodListScreen;

const localStyles = StyleSheet.create({
  title: {
    fontSize: 20,
    textAlign: 'center',
    padding: 5,
  },
});
