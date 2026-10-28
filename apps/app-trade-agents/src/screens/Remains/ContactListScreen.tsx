import { getDateString, keyExtractor } from '@lib/mobile-hooks';
import {
  AppScreen,
  EmptyList,
  globalStyles as styles,
  ItemSeparator,
  navBackDrawer,
  SearchButton,
  SubTitle,
} from '@lib/mobile-ui';
import { refSelectors, useSelector } from '@lib/store';
import { IDepartment, INamedEntity, IReference } from '@lib/types';
import { useNavigation, useTheme } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { SectionList, SectionListData, View } from 'react-native';
import { Searchbar } from 'react-native-paper';

import { RemainsStackParamList } from '../../navigation/Root/types';
import { IRemains } from '../../store/app/types';

import ContactItem from './components/ContactItem';

export type RefListItem = IReference & { refName: string };

export interface ContactListSectionProps {
  title: string;
}

export type SectionDataProps = SectionListData<IDepartment, ContactListSectionProps>[];

const ContactListScreen = () => {
  const navigation = useNavigation<StackNavigationProp<RemainsStackParamList, 'ContactList'>>();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVisible, setFilterVisible] = useState(false);
  const { colors } = useTheme();

  const remains = refSelectors.selectByName<IRemains>('remains')?.data[0];
  const department = refSelectors.selectByName<IDepartment>('department')?.data || [];
  const employee = refSelectors.selectByName<INamedEntity>('employee')?.data || [];
  const contacts = department?.concat(employee)?.filter((i) => remains?.[i.id]);

  const syncDate = useSelector((state) => state.app.syncDate);

  const filteredList = useMemo(() => {
    return (
      contacts
        ?.filter((i) => (i.name ? i.name.toUpperCase().includes(searchQuery.toUpperCase()) : true))
        ?.sort((a, b) => (a.name < b.name ? -1 : 1)) || []
    );
  }, [contacts, searchQuery]);

  const sections = useMemo(
    () =>
      filteredList.reduce<SectionDataProps>((prev, item) => {
        const sectionTitle = syncDate ? getDateString(syncDate) : getDateString(new Date());
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
    [filteredList, syncDate],
  );

  useEffect(() => {
    if (!filterVisible && searchQuery) {
      setSearchQuery('');
    }
  }, [filterVisible, searchQuery]);

  const renderRight = useCallback(
    () => <SearchButton onPress={() => setFilterVisible((prev) => !prev)} visible={filterVisible} />,
    [filterVisible],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: navBackDrawer,
      headerRight: renderRight,
    });
  }, [navigation, renderRight]);

  const renderItem = ({ item }: { item: IDepartment }) => <ContactItem item={item} />;

  const renderSectionHeader = useCallback(
    ({ section }: any) => <SubTitle style={[styles.header, styles.sectionTitle]}>{section.title}</SubTitle>,
    [],
  );

  return (
    <AppScreen>
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
      <SectionList
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ItemSeparatorComponent={ItemSeparator}
        renderSectionHeader={renderSectionHeader}
        scrollEventThrottle={400}
        ListEmptyComponent={!contacts || !remains ? EmptyList : null}
      />
    </AppScreen>
  );
};

export default ContactListScreen;
