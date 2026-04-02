import { Alert, Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';

import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { colors, radius, spacing, type as typeScale } from '../lib/theme';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Checkout'>;

export function CheckoutScreen({ navigation, route }: Props) {
  const { lot, startTime, endTime } = route.params;
  const totalCents = lot.pricePerHour * 2;
  const feeCents = Math.round(totalCents * 0.15);

  return (
    <Screen scroll contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable onPress={() => navigation.goBack()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#171717', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={20} color={colors.surface} />
        </Pressable>
        <Text style={{ color: colors.surface, fontSize: 18, fontWeight: '700' }}>Checkout</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.lg }}>
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: typeScale.h2, fontWeight: '800', color: colors.text }}>{lot.name}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 15 }}>{lot.address}</Text>
        </View>

        <View style={{ height: 180, borderRadius: radius.md, backgroundColor: '#CECECE' }} />

        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: typeScale.h4, fontWeight: '700', color: colors.text }}>Reservation window</Text>
          <Text style={{ color: colors.textMuted, fontSize: 15 }}>{format(new Date(startTime), 'EEE, MMM d, h:mm a')} to {format(new Date(endTime), 'h:mm a')}</Text>
        </View>

        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: typeScale.h4, fontWeight: '700', color: colors.text }}>Price details</Text>
          <Row label="Parking" value={`$${(totalCents / 100).toFixed(2)}`} />
          <Row label="Platform fee" value={`$${(feeCents / 100).toFixed(2)}`} />
          <View style={{ height: 1, backgroundColor: colors.line }} />
          <Row label="Estimated total" value={`$${((totalCents + feeCents) / 100).toFixed(2)}`} strong />
        </View>

        <View style={{ gap: 8, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, padding: spacing.md }}>
          <Text style={{ fontWeight: '700', color: colors.text }}>Free cancellation</Text>
          <Text style={{ color: colors.textMuted, lineHeight: 20 }}>Cancel for free up to one hour before your reservation starts.</Text>
        </View>
      </View>

      <PrimaryButton
        label="Continue to secure payment"
        onPress={() => Alert.alert('Payment handoff next', 'The dedicated checkout screen is in place. Next we will wire the in-app payment handoff to Stripe.')}
      />
    </Screen>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 16, color: strong ? colors.text : colors.textMuted, fontWeight: strong ? '700' : '500' }}>{label}</Text>
      <Text style={{ fontSize: 16, color: colors.text, fontWeight: strong ? '800' : '600' }}>{value}</Text>
    </View>
  );
}
