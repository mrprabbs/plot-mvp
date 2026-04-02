import { Text, TextInput, View } from 'react-native';

import { colors, radius, spacing } from '../lib/theme';

export function TextInputField({ label, value, onChangeText, secureTextEntry = false, placeholder }: { label: string; value: string; onChangeText: (next: string) => void; secureTextEntry?: boolean; placeholder?: string; }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.surface, fontSize: 14, fontWeight: '600' }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        placeholder={placeholder}
        placeholderTextColor="#8F8F8F"
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          minHeight: 56,
          paddingHorizontal: spacing.md,
          color: colors.text,
          fontSize: 16,
        }}
      />
    </View>
  );
}
