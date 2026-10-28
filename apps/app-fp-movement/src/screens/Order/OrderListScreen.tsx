import React, { useCallback, useState, useLayoutEffect, useMemo } from 'react';
import { ListRenderItem, SectionList, SectionListData } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';

import { useSelector } from '@lib/store';
import {
  globalStyles as styles,
  FilterButtons,
  ItemSeparator,
  Status,
  AppScreen,
  SubTitle,
  ScreenListItem,
  IListItemProps,
  EmptyList,
  navBackDrawer,
  AppActivityIndicator,
} from '@lib/mobile-ui';

import { StackNavigationProp } from '@react-navigation/stack';

import { getDateString, keyExtractor } from '@lib/mobile-hooks';

import { IOrderDocument } from '../../store/types';
import { OrderStackParamList } from '../../navigation/Root/types';

export interface OrderListSectionProps {
  title: string;
}

export type SectionDataProps = SectionListData<IListItemProps, OrderListSectionProps>[];

export const OrderListScreen = () => {
  const navigation = useNavigation<StackNavigationProp<OrderStackParamList, 'OrderList'>>();

  const list = (
    useSelector((state) => state.documents.list)?.filter((i) => i.documentType?.name === 'order') as IOrderDocument[]
  ).sort((a, b) => new Date(b.documentDate).getTime() - new Date(a.documentDate).getTime());

  const [status, setStatus] = useState<Status>('all');

  const filteredList: IListItemProps[] = useMemo(() => {
    const res =
      status === 'all'
        ? list
        : status === 'active'
          ? list.filter((e) => e.status !== 'PROCESSED')
          : status === 'archive'
            ? list.filter((e) => e.status === 'PROCESSED')
            : [];

    return res.map(
      (i) =>
        ({
          id: i.id,
          title: i.head.outlet?.name || '',
          documentDate: getDateString(i.documentDate),
          status: i.status,
          subtitle: `№ ${i.number} на ${getDateString(i.documentDate)}\n${i.head.depart?.name || ''}` || '',
          lineCount: i.lines.length,
          errorMessage: i.errorMessage,
          sentDate: i.sentDate,
          erpCreationDate: i.erpCreationDate,
        }) as IListItemProps,
    );
  }, [status, list]);

  const sections = useMemo(
    () =>
      filteredList.reduce<SectionDataProps>((prev, item) => {
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
    [filteredList],
  );

  // const renderRight = useCallback(
  //   () => (
  //     <View style={styles.buttons}>
  //       {isSendList ? (
  //         <View style={styles.buttons}>
  //           <SendButton onPress={() => setVisibleSendDialog(true)} />
  //         </View>
  //       ) : (
  //         <></>
  //         // <AddButton onPress={() => navigation.navigate('OrderEdit')} />
  //       )}
  //     </View>
  //   ),
  //   [isSendList],
  // );

  // const renderLeft = useCallback(() => isSendList && <CloseButton onPress={() => setSendList({})} />, [isSendList]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: navBackDrawer,
      // headerRight: renderRight,
      title: 'Документы',
    });
  }, [navigation]);

  const renderItem: ListRenderItem<IListItemProps> = useCallback(
    ({ item }) => (
      <ScreenListItem key={item.id} {...item} onPress={() => navigation.navigate('OrderView', { id: item.id })} />
    ),
    [navigation],
  );

  const renderSectionHeader = ({ section }: any) => (
    <SubTitle style={[styles.header, styles.sectionTitle]}>{section.title}</SubTitle>
  );

  const isFocused = useIsFocused();
  if (!isFocused) {
    return <AppActivityIndicator />;
  }

  return (
    <AppScreen>
      <FilterButtons status={status} onPress={setStatus} style={styles.marginBottom5} />
      <SectionList
        sections={sections}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ItemSeparatorComponent={ItemSeparator}
        renderSectionHeader={renderSectionHeader}
        ListEmptyComponent={EmptyList}
      />
    </AppScreen>
  );
};
