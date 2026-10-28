import React, { useCallback, useLayoutEffect, useState, useEffect, useMemo } from 'react';
import { Alert, View } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp, useIsFocused, useNavigation, useRoute } from '@react-navigation/native';

import { docSelectors, documentActions, refSelectors, useDispatch, useSelector } from '@lib/store';
import {
  SaveButton,
  globalStyles as styles,
  AppActivityIndicator,
  navBackButton,
  AppInputScreen,
} from '@lib/mobile-ui';

import { IDocumentType, ScreenState } from '@lib/types';

import { AsyncAlert, generateId } from '@lib/mobile-hooks';

import KeyEvent from 'react-native-keyevent';

import { DocStackParamList } from '../../navigation/Root/types';

import { IMovementDocument, IMovementLine } from '../../store/types';
import { appInventoryActions } from '../../store';

import { unknownGood } from '../../utils/constants';

import { IGood } from '../../store/app/types';

import { DocLine } from './components/DocLine';

export const DocLineScreen = () => {
  const navigation = useNavigation<StackNavigationProp<DocStackParamList | DocStackParamList, 'DocLine'>>();
  const dispatch = useDispatch();
  const { mode, docId, item } = useRoute<RouteProp<DocStackParamList, 'DocLine'>>().params;
  const [line, setLine] = useState<IMovementLine>(item);
  const [disabledSave, setDisabledSave] = useState(false);

  const [screenState, setScreenState] = useState<ScreenState>('idle');

  const settings = useSelector((state) => state.settings?.data);
  const showZeroRemains = settings?.showZeroRemains?.data;
  const editInventoryPrice = settings?.editInventoryPrice?.data as boolean;

  const document = docSelectors.selectByDocId<IMovementDocument>(docId);
  const documentTypes = refSelectors.selectByName<IDocumentType>('documentType')?.data;

  const documentType = useMemo(
    () => documentTypes?.find((d) => d.id === document?.documentType.id),
    [document?.documentType.id, documentTypes],
  );

  const goods = refSelectors.selectByName<IGood>('good')?.data;

  const isInventoryDoc =
    document?.documentType?.subtype === 'inventory' && document?.documentType?.name === 'inventory';
  const canEditPrice = !isInventoryDoc || editInventoryPrice;

  useEffect(() => {
    KeyEvent.onKeyDownListener((keyEvent: any) => {
      if (keyEvent.keyCode === 66 && !disabledSave) {
        setScreenState('saving');
      }
    });

    return () => {
      KeyEvent.removeKeyDownListener();
    };
  }, [disabledSave]);

  useEffect(() => {
    if (screenState === 'saving') {
      let newLine = line;
      if (line.good.id === 'unknown' && mode === 0) {
        const id = `unknown_${generateId()}`;
        dispatch(
          appInventoryActions.addUnknownGood({
            ...unknownGood,
            ...line.good,
            barcode: line.barcode,
            id,
            price: line.price || 0,
            buyingPrice: line.buyingPrice || 0,
          }),
        );
        newLine = { ...newLine, good: { ...newLine.good, id } };
      }
      dispatch(
        mode === 0
          ? documentActions.addDocumentLine({ docId, line: newLine })
          : documentActions.updateDocumentLine({ docId, line }),
      );
      navigation.goBack();
    }
  }, [
    dispatch,
    docId,
    documentType?.isControlRemains,
    documentType?.isRemains,
    line,
    mode,
    navigation,
    screenState,
    showZeroRemains,
  ]);

  const renderRight = useCallback(
    () => (
      <View style={styles.buttons}>
        <SaveButton
          onPress={async () => {
            if (line.quantity < 0) {
              Alert.alert('Ошибка!', 'Количество товара не может быть меньше нуля!', [{ text: 'Ок' }]);
              return;
            }
            if (line.EID && line.quantity !== 1 && document?.documentType.name !== 'inventory') {
              Alert.alert('Ошибка!', 'Количество товара с кодом маркировки должно быть равно 1.', [{ text: 'Ок' }]);
              return;
            }
            //Предупреждение, если количество по товару больше остатков
            if (
              (!!documentType?.isControlRemains &&
                (line.quantity > (line.remains || 0) || (line.remains || 0) === 0)) ||
              !line.quantity
            ) {
              const response = await AsyncAlert(
                'Внимание!',
                !line.quantity
                  ? 'В позиции не указано количество товара.\nПродолжить сохранение?'
                  : 'Указанное количество превышает остаток.\nПродолжить сохранение?',
              );
              if (response === 'NO') {
                return;
              }
            }
            const goodIsMark = goods?.find((e) => e.id === item?.good.id)?.isMark;

            if (!!goodIsMark && !line.EID && document?.documentType.name !== 'inventory') {
              Alert.alert('Ошибка!', 'Поле EID должно быть заполнено! Отсканируйте штрих-код.', [{ text: 'Ок' }]);
              return;
            }
            setScreenState('saving');
          }}
          disabled={screenState === 'saving' || disabledSave}
        />
      </View>
    ),
    [
      disabledSave,
      document?.documentType,
      documentType?.isControlRemains,
      goods,
      item?.good.id,
      line.EID,
      line.quantity,
      line.remains,
      screenState,
    ],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: navBackButton,
      headerRight: renderRight,
    });
  }, [navigation, renderRight]);

  const isFocused = useIsFocused();
  if (!isFocused) {
    return <AppActivityIndicator />;
  }

  return (
    <AppInputScreen>
      <DocLine
        item={line}
        onSetLine={setLine}
        onSetDisabledSave={setDisabledSave}
        isSumWNds={Boolean(document?.documentType.isSumWNds)}
        canEditPrice={canEditPrice}
      />
    </AppInputScreen>
  );
};
