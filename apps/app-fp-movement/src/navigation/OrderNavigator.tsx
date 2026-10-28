import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import { OrderStackParamList } from './Root/types';
import { orderListScreens, orderScreens } from './Root/screens';

const Stack = createStackNavigator<OrderStackParamList>();

export const OrderNavigator = () => {
  return (
    <Stack.Navigator initialRouteName="OrderList" screenOptions={{ headerShown: true, headerBackTitleVisible: false }}>
      {Object.entries({ ...orderListScreens, ...orderScreens }).map(([name, { title, component }]) => (
        <Stack.Screen name={name as keyof OrderStackParamList} component={component} key={name} options={{ title }} />
      ))}
    </Stack.Navigator>
  );
};
