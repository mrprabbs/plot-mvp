import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { Screen } from '../components/Screen';
import { apiFetch } from '../lib/api';
import { colors, radius, spacing, type as typeScale } from '../lib/theme';
import type { DriverReservation } from '../lib/types';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../providers/AuthProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'Reservations'>;

export function ReservationsScreen({ navigation }: Props) {
  const { token } = useAuth();
  const reservations = useQuery({
    queryKey: ['mobile-reservations'],
    queryFn: async () => apiFetch<DriverReservation[]>('/api/mobile/reservations', {}, token ?? undefined),
    enabled: Boolean(token),
  });

  return (
    <Screen scroll contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable onPress={() => navigation.goBack()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#171717', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={20} color={colors.surface} />
        </Pressable>
        <Text style={{ color: colors.surface, fontSize: typeScale.h2, fontWeight: '800' }}>Reservations</Text>
        <View style={{ width: 40 }} />
      </View>

      {reservations.isLoading ? <ActivityIndicator color={colors.primary} /> : null}

      {(reservations.data ?? []).map((reservation) => (
        <View key={reservation.id} style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, gap: 10 }}>
          <View style={{ height: 86, borderRadius: radius.md, backgroundColor: '#D2D2D2' }} />
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{reservation.lotName}</Text>
          <Text style={{ color: colors.textMuted }}>{reservation.lotAddress}</Text>
          <Text style={{ color: colors.textMuted }}>{format(new Date(reservation.startTime), 'EEE, MMM d, h:mm a')}</Text>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{reservation.status}</Text>
        </View>
      ))}
    </Screen>
  );
}
