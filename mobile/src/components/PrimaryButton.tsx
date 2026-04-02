import { Pressable, Text } from 'react-native';

import { colors, radius } from '../lib/theme';

export function PrimaryButton({ label, onPress, disabled = false }: { label: string; onPress?: () => void; disabled?: boolean; }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={{
        backgroundColor: disabled ? '#7CB98A' : colors.primary,
        borderRadius: radius.md,
        minHeight: 56,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: colors.surface, fontSize: 18, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}
