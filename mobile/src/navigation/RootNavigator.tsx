import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, Text, View } from 'react-native';

import { colors } from '../lib/theme';
import { useAuth } from '../providers/AuthProvider';
import { CheckoutScreen } from '../screens/CheckoutScreen';
import { DateSelectionScreen } from '../screens/DateSelectionScreen';
import { BookingConfirmationScreen } from '../screens/BookingConfirmationScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { LotDetailScreen } from '../screens/LotDetailScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { ReservationsScreen } from '../screens/ReservationsScreen';
import { SearchScreen } from '../screens/SearchScreen';
import type { MobileLot } from '../lib/types';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Search: undefined;
  LotDetail: { lot: MobileLot };
  DateSelection: { lot: MobileLot };
  Checkout: { lot: MobileLot; startTime: string; endTime: string };
  BookingConfirmation: { lot: MobileLot; startTime: string; endTime: string };
  Reservations: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.ink,
    card: colors.ink,
    text: colors.surface,
    border: colors.ink,
    primary: colors.primary,
  },
};

function BootScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={{ color: colors.surface, fontSize: 16 }}>Loading Plot...</Text>
    </View>
  );
}

export function RootNavigator() {
  const { bootstrapped, token } = useAuth();

  if (!bootstrapped) {
    return <BootScreen />;
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ink } }}>
        {token ? (
          <>
            <Stack.Screen name="Search" component={SearchScreen} />
            <Stack.Screen name="LotDetail" component={LotDetailScreen} />
            <Stack.Screen name="DateSelection" component={DateSelectionScreen} />
            <Stack.Screen name="Checkout" component={CheckoutScreen} />
            <Stack.Screen name="BookingConfirmation" component={BookingConfirmationScreen} />
            <Stack.Screen name="Reservations" component={ReservationsScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
