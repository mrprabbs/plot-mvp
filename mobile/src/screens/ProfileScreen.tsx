import { Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { Screen } from '../components/Screen';
import { colors, radius, spacing, type as typeScale } from '../lib/theme';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../providers/AuthProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

const rows = ['Payment methods', 'Notifications', 'Support', 'Privacy'];

export function ProfileScreen({ navigation }: Props) {
  const { user, logout } = useAuth();

  return (
    <Screen scroll contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable onPress={() => navigation.goBack()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#171717', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={20} color={colors.surface} />
        </Pressable>
        <Text style={{ color: colors.surface, fontSize: typeScale.h2, fontWeight: '800' }}>Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#D5D5D5' }} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>{user?.fullName}</Text>
            <Text style={{ fontSize: 14, color: colors.textMuted }}>{user?.email}</Text>
          </View>
        </View>

        {rows.map((row) => (
          <View key={row} style={{ minHeight: 54, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 16, color: colors.text }}>{row}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </View>
        ))}

        <Pressable onPress={() => void logout()} style={{ minHeight: 54, borderRadius: radius.md, backgroundColor: '#F3F3F3', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.danger, fontWeight: '700', fontSize: 16 }}>Sign out</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
