import { Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { colors, radius, spacing, type as typeScale } from '../lib/theme';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'LotDetail'>;

export function LotDetailScreen({ navigation, route }: Props) {
  const { lot } = route.params;

  return (
    <Screen scroll contentContainerStyle={{ paddingBottom: spacing.xl }}>
      <View style={{ height: 360, backgroundColor: '#BABABA', margin: spacing.md, borderRadius: radius.lg, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: spacing.md }}>
          <Pressable onPress={() => navigation.goBack()} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="share-outline" size={18} color={colors.text} />
            </View>
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="heart-outline" size={18} color={colors.primary} />
            </View>
          </View>
        </View>
      </View>

      <View style={{ backgroundColor: colors.surface, marginHorizontal: spacing.md, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.lg }}>
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: typeScale.h2, fontWeight: '800', color: colors.text }}>{lot.name}</Text>
          <Text style={{ fontSize: 16, color: colors.textMuted }}>{lot.address}</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, gap: 4 }}>
            <Text style={{ fontSize: 24, fontWeight: '700', color: colors.text }}>4.0</Text>
            <Text style={{ fontSize: 12, color: colors.textMuted }}>driver rating</Text>
          </View>
          <View style={{ flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, gap: 4 }}>
            <Text style={{ fontSize: 24, fontWeight: '700', color: colors.text }}>{lot.availableSpots}</Text>
            <Text style={{ fontSize: 12, color: colors.textMuted }}>spots available</Text>
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: typeScale.h4, fontWeight: '700', color: colors.text }}>About this space</Text>
          <Text style={{ fontSize: 15, lineHeight: 22, color: colors.textMuted }}>{lot.description ?? 'Private garage parking with fast access and clear entry/exit instructions.'}</Text>
        </View>

        <View style={{ height: 120, backgroundColor: '#D0D0D0', borderRadius: radius.md }} />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
          <View>
            <Text style={{ fontSize: 32, fontWeight: '800', color: colors.text }}>{lot.priceLabel}</Text>
            <Text style={{ fontSize: 14, color: colors.textMuted }}>Hourly pricing for the selected reservation window</Text>
          </View>
          <View style={{ width: 140 }}>
            <PrimaryButton label="Reserve" onPress={() => navigation.navigate('DateSelection', { lot })} />
          </View>
        </View>
      </View>
    </Screen>
  );
}
