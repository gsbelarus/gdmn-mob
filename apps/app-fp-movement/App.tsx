import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { Provider } from 'react-redux';
import { MobileApp } from '@lib/mobile-app';
import { GDMN_EMAIL, GDMN_PHONE, GDMN_SITE_ADDRESS, INavItem } from '@lib/mobile-navigation';
import ErrorBoundary from 'react-native-error-boundary';

import { StatusBar } from 'expo-status-bar';

import {
  appActions,
  appSelectors,
  authSelectors,
  documentActions,
  referenceActions,
  settingsActions,
  useDispatch,
  useDocThunkDispatch,
  useRefThunkDispatch,
  useSelector,
  useSettingsThunkDispatch,
} from '@lib/store';
import {
  AppScreen,
  globalStyles as styles,
  Theme as defaultTheme,
  Provider as UIProvider,
  AppFallback,
  PrimeButton,
} from '@lib/mobile-ui';

import { ActivityIndicator, Caption, Text } from 'react-native-paper';

import { IDocument, IReferences, IUserSettings } from '@lib/types';

import { sleep, dialCall } from '@lib/mobile-hooks';

import { TouchableOpacity, Linking, ScrollView, View } from 'react-native';

import Constants from 'expo-constants';

import { MoveNavigator } from './src/navigation/MoveNavigator';

import { store, useSelector as useFpSelector, fpMovementActions, useDispatch as useFpDispatch } from './src/store';

import { appSettings, ONE_SECOND_IN_MS } from './src/utils/constants';

import { messageFpMovement, tempOrders } from './src/store/mock';
import { FreeShipmentNavigator } from './src/navigation/FreeShipmentNavigator';
import { ShipmentNavigator } from './src/navigation/ShipmentNavigator';
import { CellsNavigator } from './src/navigation/CellsNavigator';
import { InventoryNavigator } from './src/navigation/InventoryNavigator';
import { ReturnNavigator } from './src/navigation/ReturnNavigator';
import { LaboratoryNavigator } from './src/navigation/LaboratoryNavigator';
import { MoveToNavigator } from './src/navigation/MoveToNavigator';
import { MoveFromNavigator } from './src/navigation/MoveFromNavigator';
import RemainsNavigator from './src/navigation/RemainsNavigator';
import { CurrShipmentNavigator } from './src/navigation/CurrShipmentNavigator';
import { CurrFreeShipmentNavigator } from './src/navigation/CurrFreeShipmentNavigator';
import { ReceiptNavigator } from './src/navigation/ReceiptNavigator';
import {
  currFreeShipmentScreens,
  currShipmentScreens,
  freeShipmentScreens,
  inventoryScreens,
  laboratoryScreens,
  moveFromScreens,
  moveScreens,
  moveToScreens,
  palletScreens,
  receiptScreens,
  returnScreens,
  shipmentScreens,
} from './src/navigation/Root/screens';

import { PalletNavigator } from './src/navigation/PalletNavigator';
import { OrderNavigator } from './src/navigation/OrderNavigator';

const Root = () => {
  const { isInit, data: settings } = useSelector((state) => state.settings);

  const isAddressStore = useMemo(() => settings.addressStore?.data || false, [settings.addressStore?.data]);

  const showOrders = useMemo(() => Boolean(settings.showOrders?.data), [settings.showOrders?.data]);

  const orderNavItem: INavItem = useMemo(
    () => ({
      name: 'Order',
      title: 'Заявки',
      icon: 'clipboard-list-outline',
      component: OrderNavigator,
      showInDashboard: true,
      sortNumber: 35,
    }),
    [],
  );

  const navItems: INavItem[] = useMemo(
    () =>
      isAddressStore
        ? [
            {
              name: 'MoveTo',
              title: 'На хранение',
              icon: 'store-plus-outline',
              component: MoveToNavigator,
              showInDashboard: true,
            },
            {
              name: 'MoveFrom',
              title: 'С хранения',
              icon: 'store-minus-outline',
              component: MoveFromNavigator,
              showInDashboard: true,
            },
            {
              name: 'Receipt',
              title: 'Приход',
              icon: 'file-document-outline',
              component: ReceiptNavigator,
              showInDashboard: true,
            },
            {
              name: 'Move',
              title: 'Перемещение',
              icon: 'transfer',
              component: MoveNavigator,
              showInDashboard: true,
            },
            {
              name: 'Shipment',
              title: 'Отвес по заявке',
              icon: 'playlist-check',
              component: ShipmentNavigator,
              showInDashboard: true,
              dashboardScreenName: 'ScanOrder',
              dashboardScreenParams: { isCurr: false },
            },
            {
              name: 'CurrShipment',
              title: 'Отвес по заявке $',
              icon: 'cash-check',
              showInDashboard: true,
              component: CurrShipmentNavigator,
              dashboardScreenName: 'ScanOrder',
              dashboardScreenParams: { isCurr: true },
            },
            ...(showOrders ? [orderNavItem] : []),
            {
              name: 'FreeShipment',
              title: 'Отвес',
              icon: 'playlist-plus',
              component: FreeShipmentNavigator,
              showInDashboard: true,
              dashboardScreenParams: { isCurr: false },
            },
            {
              name: 'CurrFreeShipment',
              title: 'Отвес $',
              icon: 'cash-plus',
              component: CurrFreeShipmentNavigator,
              showInDashboard: true,
              dashboardScreenName: 'FreeShipmentEdit',
              dashboardScreenParams: { isCurr: true },
            },
            {
              name: 'Cells',
              title: 'Ячейки',
              icon: 'table-split-cell',
              component: CellsNavigator,
            },
            {
              name: 'Remains',
              title: 'Остатки',
              icon: 'dolly',
              component: RemainsNavigator,
            },
            {
              name: 'Pallet',
              title: 'Паллеты',
              icon: 'barcode-scan',
              component: PalletNavigator,
              showInDashboard: true,
              dashboardScreenName: 'PalletList',
            },
            {
              name: 'Return',
              title: 'Возврат',
              icon: 'file-restore-outline',
              component: ReturnNavigator,
              showInDashboard: true,
            },
            {
              name: 'Inventory',
              title: 'Инвентаризация',
              icon: 'file-check-outline',
              component: InventoryNavigator,
              showInDashboard: true,
            },
            {
              name: 'Laboratory',
              title: 'Лаборатория',
              icon: 'flask-outline',
              component: LaboratoryNavigator,
              showInDashboard: true,
            },
          ]
        : [
            {
              name: 'Move',
              title: 'Перемещение',
              icon: 'transfer',
              component: MoveNavigator,
              showInDashboard: true,
              sortNumber: 10,
            },
            {
              name: 'Shipment',
              title: 'Отвес по заявке',
              icon: 'playlist-check',
              component: ShipmentNavigator,
              showInDashboard: true,
              dashboardScreenName: 'ScanOrder',
              dashboardScreenParams: { isCurr: false },
              sortNumber: 20,
            },
            {
              name: 'CurrShipment',
              title: 'Отвес по заявке $',
              icon: 'cash-check',
              showInDashboard: true,
              component: CurrShipmentNavigator,
              dashboardScreenName: 'ScanOrder',
              dashboardScreenParams: { isCurr: true },
              sortNumber: 30,
            },
            ...(showOrders ? [orderNavItem] : []),
            {
              name: 'FreeShipment',
              title: 'Отвес',
              icon: 'playlist-plus',
              component: FreeShipmentNavigator,
              showInDashboard: true,
              dashboardScreenParams: { isCurr: false },
              sortNumber: 40,
            },
            {
              name: 'CurrFreeShipment',
              title: 'Отвес $',
              icon: 'cash-plus',
              component: CurrFreeShipmentNavigator,
              showInDashboard: true,
              dashboardScreenName: 'FreeShipmentEdit',
              dashboardScreenParams: { isCurr: true },
              sortNumber: 50,
            },
            {
              name: 'Remains',
              title: 'Остатки',
              icon: 'dolly',
              component: RemainsNavigator,
            },
            {
              name: 'Pallet',
              title: 'Паллеты',
              icon: 'barcode-scan',
              component: PalletNavigator,
              showInDashboard: true,
              dashboardScreenName: 'PalletList',
            },
            {
              name: 'Receipt',
              title: 'Приход',
              icon: 'file-document-outline',
              component: ReceiptNavigator,
              showInDashboard: true,
              sortNumber: 60,
            },
            {
              name: 'Inventory',
              title: 'Инвентаризация',
              icon: 'file-document-outline',
              component: InventoryNavigator,
              showInDashboard: true,
              sortNumber: 11,
            },
            {
              name: 'Laboratory',
              title: 'Лаборатория',
              icon: 'flask-outline',
              component: LaboratoryNavigator,
              showInDashboard: true,
              sortNumber: 70,
            },
          ],
    [isAddressStore, orderNavItem, showOrders],
  );

  const docScreens = useMemo(
    () =>
      isAddressStore
        ? {
            ...moveToScreens,
            ...moveFromScreens,
            ...receiptScreens,
            ...moveScreens,
            ...shipmentScreens,
            ...currShipmentScreens,
            ...freeShipmentScreens,
            ...currFreeShipmentScreens,
            ...returnScreens,
            ...inventoryScreens,
            ...laboratoryScreens,
            ...palletScreens,
          }
        : {
            ...moveScreens,
            ...shipmentScreens,
            ...currShipmentScreens,
            ...freeShipmentScreens,
            ...currFreeShipmentScreens,
            ...returnScreens,
            ...inventoryScreens,
            ...laboratoryScreens,
            ...palletScreens,
          },
    [isAddressStore],
  );

  const dispatch = useDispatch();

  //Загружаем в стор дополнительные настройки приложения
  const appDataLoading = appSelectors.selectLoading();
  const isLogged = authSelectors.isLoggedWithCompany();
  const fpLoading = useFpSelector((state) => state.fpMovement.loading);
  const { connectionStatus, isDemo, loadingData: authLoading, user } = useSelector((state) => state.auth);

  const refDispatch = useRefThunkDispatch();
  const docDispatch = useDocThunkDispatch();
  const settingsDispatch = useSettingsThunkDispatch();

  const getMessages = useCallback(async () => {
    await sleep(ONE_SECOND_IN_MS);
    await refDispatch(
      referenceActions.setReferences(
        messageFpMovement.find((m) => m.body.type === 'REFS')?.body.payload as IReferences,
      ),
    );
    await docDispatch(
      documentActions.setDocuments(messageFpMovement.find((m) => m.body.type === 'DOCS')?.body.payload as IDocument[]),
    );
    await settingsDispatch(
      settingsActions.setUserSettings(
        messageFpMovement.find((m) => m.body.type === 'SETTINGS')?.body.payload as IUserSettings,
      ),
    );
  }, [docDispatch, refDispatch, settingsDispatch]);

  useEffect(() => {
    //isInit - true при открытии приложения или при ручном сбросе настроек
    //До загрузки данных пользователя устанавливаем настройки по умолчанию
    if (appSettings && isInit) {
      dispatch(settingsActions.addSettings(appSettings));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInit]);

  useEffect(() => {
    dispatch(appActions.loadGlobalDataFromDisc());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isLogged) {
      dispatch(appActions.loadSuperDataFromDisc());
    }
  }, [dispatch, isLogged]);

  const [loading, setLoading] = useState(true);
  const [addSettings, setAddSettings] = useState('INIT');

  useEffect(() => {
    //После загрузки данных пользователя устанавливаем настройки поверх настроек по умолчанию и загруженных из памяти
    //Необходимо при добавлении новых параметров
    if (appDataLoading) {
      if (addSettings === 'INIT') {
        setAddSettings('ADDING');
      }
    } else if (addSettings === 'ADDING') {
      dispatch(settingsActions.addSettings(appSettings));
      setAddSettings('ADDED');
    }
  }, [addSettings, appDataLoading, dispatch]);

  useEffect(() => {
    if (user) {
      setAddSettings('INIT');
    }
  }, [user]);

  useEffect(() => {
    //Для отрисовки при первом подключении
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const fpLoadingError = useFpSelector<string>((state) => state.fpMovement.loadingError);

  const [infoWindow, setInfoWindow] = useState(0);

  const handleSetInfoWindow_0 = useCallback(() => setInfoWindow(0), []);
  const handleSetInfoWindow_1 = useCallback(() => setInfoWindow(1), []);
  const handleSetInfoWindow_2 = useCallback(() => setInfoWindow(2), []);
  const handleSetInfoWindow_3 = useCallback(() => setInfoWindow(3), []);

  const fpDispatch = useFpDispatch();
  useEffect(() => {
    if (isDemo) {
      //Если включен демо режим, то запускаем получение данных из мока
      getMessages();
      fpDispatch(fpMovementActions.addTempOrders(tempOrders));
      if (connectionStatus === 'connected') {
        handleSetInfoWindow_1();
      }
    }
  }, [isDemo, getMessages, connectionStatus, handleSetInfoWindow_1, fpDispatch]);

  const onClearLoadingErrors = () => dispatch(fpMovementActions.setLoadingError(''));

  return (
    <ErrorBoundary FallbackComponent={AppFallback}>
      {infoWindow === 1 ? (
        <AppScreen>
          <ScrollView
            contentContainerStyle={styles.contentContainerStyle}
            maintainVisibleContentPosition={{ autoscrollToTopThreshold: 1, minIndexForVisible: 0 }}
            style={styles.scrollContainer}
          >
            <Text style={styles.textInfo}>
              {
                'Добро пожаловать в GDMN Отгрузка!\nПриложение облегчает рабочий процесс кладовщика при перемещении продукции между подразделениями предприятия и при отгрузке продукции покупателю. Приложение позволяет выполнить следующие действия: \n\n1. Оформить документы внутреннего перемещения товаров между складскими подразделениями и экспедициями путем сканирования технологического штрих-кода\n\n2. Создать отвес-накладные, а также отвес-накладные по заявкам c контролем заявленного количества'
              }
            </Text>
          </ScrollView>
          <View style={styles.infoButtons}>
            <TouchableOpacity
              onPress={() => {
                setInfoWindow(0);
                dispatch(appActions.loadGlobalDataFromDisc());
              }}
            >
              <Text style={styles.textInfo}>{'« Назад'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSetInfoWindow_2}>
              <Text style={styles.textInfo}>{'Далее »'}</Text>
            </TouchableOpacity>
          </View>
        </AppScreen>
      ) : infoWindow === 2 ? (
        <AppScreen>
          <Text style={styles.textInfo}>
            {
              'Вы находитесь в демонстрационном режиме и работаете с вымышленными данными.\n\nДля подключения приложения к торговой или складской системе вашего предприятия обратитесь в компанию ООО Амперсант (торговая марка Golden Software)\n'
            }
          </Text>
          <TouchableOpacity onPress={() => dialCall(GDMN_PHONE)}>
            <Text style={styles.textInfo}>{`Телефон: ${GDMN_PHONE}\n`}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL(`mailto:${GDMN_EMAIL}`)}>
            <Text style={styles.textInfo}>{`Email: ${GDMN_EMAIL}\n`}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL(GDMN_SITE_ADDRESS)}>
            <Text style={[styles.textInfo, styles.textReference]}>{GDMN_SITE_ADDRESS}</Text>
          </TouchableOpacity>
          <View style={styles.infoButtons}>
            <TouchableOpacity onPress={handleSetInfoWindow_1}>
              <Text style={styles.textInfo}>{'« Назад'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSetInfoWindow_3}>
              <Text style={styles.textInfo}>{'Далее »'}</Text>
            </TouchableOpacity>
          </View>
        </AppScreen>
      ) : infoWindow === 3 ? (
        <AppScreen>
          <Text style={styles.textInfo}>{'Подробную информацию об использовании приложения вы найдете в '}</Text>
          <TouchableOpacity onPress={() => Linking.openURL(Constants.expoConfig?.extra?.documentationUrl)}>
            <Text style={[styles.textInfo, styles.textDecorationLine]}>{'документации.'}</Text>
          </TouchableOpacity>
          <Text style={styles.textInfo}>
            {
              '\nВыявленные ошибки и пожелания оставляйте в системе регистрации.\n\nСпасибо за использование GDMN Отгрузка!\n\n'
            }
          </Text>
          <View style={styles.infoButtons}>
            <TouchableOpacity onPress={handleSetInfoWindow_2}>
              <Text style={styles.textInfo}>{'« Назад'}</Text>
            </TouchableOpacity>
          </View>
          <PrimeButton icon={'presentation-play'} onPress={handleSetInfoWindow_0}>
            Начать работу
          </PrimeButton>
        </AppScreen>
      ) : authLoading || loading || fpLoading || appDataLoading ? (
        <AppScreen>
          <ActivityIndicator size="large" color={defaultTheme.colors.primary} />
          <Caption style={styles.title}>
            {appDataLoading || fpLoading ? 'Загрузка данных...' : 'Пожалуйста, подождите..'}
          </Caption>
        </AppScreen>
      ) : (
        <MobileApp
          items={navItems}
          dashboardScreens={docScreens}
          loadingErrors={[fpLoadingError]}
          onClearLoadingErrors={onClearLoadingErrors}
        />
      )}
    </ErrorBoundary>
  );
};

const App = () => (
  <Provider store={store}>
    <UIProvider theme={defaultTheme}>
      <Root />
      <StatusBar style="auto" />
    </UIProvider>
  </Provider>
);

export default App;
