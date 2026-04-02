import * as Clipboard from 'expo-clipboard';
import { Alert, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { format } from 'date-fns';

import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { colors, radius, spacing, type as typeScale } from '../lib/theme';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'BookingConfirmation'>;

export function BookingConfirmationScreen({ navigation, route }: Props) {
  const { lot, startTime, endTime } = route.params;

  return (
    <Screen scroll contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, justifyContent: 'center', flexGrow: 1 }}>
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.lg }}>
        <Text style={{ fontSize: typeScale.h1, fontWeight: '800', color: colors.text, lineHeight: 44 }}>Reservation confirmed.</Text>
        <Text style={{ color: colors.textMuted, fontSize: 16, lineHeight: 24 }}>{lot.name} is booked from {format(new Date(startTime), 'EEE, MMM d, h:mm a')} to {format(new Date(endTime), 'h:mm a')}.</Text>
        <View style={{ height: 1, backgroundColor: colors.line }} />
        <Text style={{ fontSize: typeScale.h4, fontWeight: '700', color: colors.text }}>{lot.address}</Text>
      </View>

      <PrimaryButton label="Copy address" onPress={() => void Clipboard.setStringAsync(lot.address).then(() => Alert.alert('Address copied'))} />
      <PrimaryButton label="View reservations" onPress={() => navigation.navigate('Reservations')} />
    </Screen>
  );
}
