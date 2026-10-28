import React from 'react';
import { View, StyleSheet } from 'react-native';

import { globalStyles as styles, MediumText, globalColors } from '@lib/mobile-ui';

import { formatValue, round } from '@lib/mobile-hooks';

import { DataTable, IconButton, MD2Theme, useTheme } from 'react-native-paper';

import { IShipmentListItem } from '../../../store/types';

export interface IShipmentItem {
  item: IShipmentListItem;
  onPress?: () => void;
}

const ShipmentItem = ({ item, onPress }: IShipmentItem) => {
  const { colors } = useTheme<MD2Theme>();

  const textColor = { color: colors.text };

  const textStyle = [localStyles.cellText, textColor];
  const textBoldStyle = [textStyle, textColor, styles.textBold];
  const tableHeader = (
    <DataTable.Header style={localStyles.header}>
      {['Заявлено', 'Отгружено', 'Разница'].map((i) => {
        return (
          <DataTable.Title key={i} textStyle={textBoldStyle} style={localStyles.title} numeric>
            {i}
          </DataTable.Title>
        );
      })}
    </DataTable.Header>
  );

  return (
    <>
      {item.type !== 'good' && item.type !== 'total' ? (
        <>
          <View
            style={[
              localStyles.group,
              (item.type === 'order' || item.type === 'parentGroup') && [
                styles.directionRow,
                {
                  backgroundColor: globalColors.backgroundLight,
                },
              ],
            ]}
          >
            <MediumText
              style={
                item.type === 'contact'
                  ? [localStyles.contact, localStyles.textSize]
                  : item.type === 'outlet'
                    ? localStyles.outlet
                    : item.type === 'parentGroup'
                      ? [localStyles.order, localStyles.parentGroup]
                      : localStyles.order
              }
            >
              {item.name || ''}
            </MediumText>
            {item.type === 'order' && (
              <IconButton icon="clipboard-list-outline" size={20} onPress={() => onPress && onPress()} />
            )}
          </View>
          {(item.type === 'order' || item.type === 'parentGroup') && tableHeader}
        </>
      ) : (
        <>
          <DataTable.Row style={[localStyles.rowName, localStyles.borderBottomColor]}>
            <View>
              <MediumText style={[item.indent && localStyles.indent, item.type === 'total' && textBoldStyle]}>
                {item?.name || ''}
              </MediumText>
            </View>
          </DataTable.Row>
          <DataTable.Row style={[localStyles.row, localStyles.borderBottomColor]}>
            <DataTable.Cell textStyle={[item.type === 'total' ? textBoldStyle : textStyle]} numeric>
              {formatValue({ type: 'number' }, round(item.orderQ || 0, 3))}
            </DataTable.Cell>
            <DataTable.Cell textStyle={[item.type === 'total' ? textBoldStyle : textStyle]} numeric>
              {formatValue({ type: 'number' }, round(item.sellQ || 0, 3))}
            </DataTable.Cell>
            <DataTable.Cell textStyle={[item.type === 'total' ? textBoldStyle : textStyle]} numeric>
              {formatValue({ type: 'number' }, round(item.diff || 0, 3))}
            </DataTable.Cell>
          </DataTable.Row>
        </>
      )}
    </>
  );
};
export default ShipmentItem;

const localStyles = StyleSheet.create({
  contact: {
    fontWeight: 'bold',
    textAlignVertical: 'center',
    paddingHorizontal: 5,
    paddingVertical: 10,
    backgroundColor: globalColors.backgroundDark,
  },
  outlet: {
    fontWeight: 'bold',
    textAlignVertical: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: globalColors.backgroundDark,
  },
  order: {
    paddingLeft: 15,
    fontWeight: 'bold',
    paddingVertical: 10,
    textAlignVertical: 'center',
  },
  parentGroup: {
    fontStyle: 'italic',
  },
  indent: {
    paddingLeft: 20,
  },
  textSize: { fontSize: 16 },
  group: {
    width: '100%',
  },
  cellText: {
    fontSize: 15,
  },
  row: {
    minHeight: 20,
    paddingTop: -10,
    paddingBottom: 5,
    borderBottomWidth: 0,
  },
  rowName: {
    minHeight: 20,
    paddingTop: 5,
    borderBottomWidth: 0,
  },
  borderBottomColor: { borderBottomColor: 'transparent' },
  header: {
    display: 'flex',
    flexDirection: 'row',
    height: 40,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopWidth: StyleSheet.hairlineWidth,
    fontWeight: 'bold',
    backgroundColor: globalColors.backgroundLight, //
  },
  title: {
    paddingVertical: 0,
    alignItems: 'center',
  },
});
