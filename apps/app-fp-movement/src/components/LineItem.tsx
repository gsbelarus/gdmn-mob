import React, { ReactNode } from 'react';
import { View } from 'react-native';
import { globalStyles as styles, MediumText, ListItemLine, LargeText } from '@lib/mobile-ui';

import { getDateString, round } from '@lib/mobile-hooks';

import { MaterialCommunityIcons } from '@expo/vector-icons';

import { IFreeShipmentLine, IMoveLine } from '../store/types';

interface IItem {
  item: IMoveLine | IFreeShipmentLine; // | IBasedLine;
  disabled?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  checked?: boolean;
  children?: ReactNode;
  isLab?: boolean;
  isFromAddressed?: boolean;
  isToAddressed?: boolean;
}

const LineItem = ({
  item,
  disabled = false,
  onPress,
  onLongPress,
  checked = false,
  children,
  isLab = false,
  isFromAddressed = false,
  isToAddressed = false,
}: IItem) => {
  return (
    <ListItemLine readonly={disabled} onPress={onPress} onLongPress={onLongPress} checked={checked}>
      <View style={styles.details}>
        <LargeText style={styles.textBold}>{item.good.name}</LargeText>
        <View style={styles.flexDirectionRow}>
          <MaterialCommunityIcons name="shopping-outline" size={18} />
          <MediumText>
            {item.good.isUnit
              ? `${((item as IFreeShipmentLine).quantity || 0).toString()} шт.`
              : `${(item.weight || 0).toString()}${item.good.unitWeight && item.good.unitWeight !== 1 ? 'шт.' : 'кг'}`}
            {item.good.isUnit
              ? `, ${round(
                  ((item as IFreeShipmentLine).unitWeight || 0) * ((item as IFreeShipmentLine).quantity || 0),
                  3,
                )} кг`
              : isLab
                ? ''
                : item.flag
                  ? item.flag === '0'
                    ? ', 1 кор.'
                    : item.flag === '1'
                      ? `, ${(item.quantPack || 0).toString()} уп.`
                      : ''
                  : `, ${(item.quantPack || 0).toString()} кор.`}
          </MediumText>
        </View>
        <View style={styles.flexDirectionRow}>
          <MediumText>
            Партия № {item.numReceived || ''} от {getDateString(item.workDate) || ''}
          </MediumText>
        </View>
        {isFromAddressed ? (
          <View style={styles.flexDirectionRow}>
            <MediumText>Откуда: {(item as IMoveLine).fromCell || ''}</MediumText>
          </View>
        ) : null}
        {isToAddressed ? (
          <View style={styles.flexDirectionRow}>
            <MediumText>
              {isFromAddressed ? 'Куда:' : 'Ячейка №'} {(item as IMoveLine).toCell || ''}
            </MediumText>
          </View>
        ) : null}
        {children}
      </View>
    </ListItemLine>
  );
};

export default LineItem;
