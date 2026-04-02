import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { TextInputField } from '../components/TextInputField';
import { colors, spacing, type as typeScale } from '../lib/theme';
import { useAuth } from '../providers/AuthProvider';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    try {
      setLoading(true);
      setError(null);
      await register({ fullName, email, password });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll contentContainerStyle={{ flexGrow: 1, padding: spacing.xl, justifyContent: 'center', gap: spacing.lg }}>
      <Text style={{ color: colors.surface, fontSize: typeScale.h1, fontWeight: '800', lineHeight: 44 }}>Create your Plot account.</Text>
      <Text style={{ color: '#D0D0D0', fontSize: 18 }}>We’ll use this to reserve spots and keep your reservations in sync.</Text>

      <View style={{ gap: spacing.md }}>
        <TextInputField label="Full name" value={fullName} onChangeText={setFullName} placeholder="Prab Singh" />
        <TextInputField label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" />
        <TextInputField label="Password" value={password} onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry />
      </View>

      {error ? <Text style={{ color: '#FF8C82', fontSize: 14 }}>{error}</Text> : null}

      <PrimaryButton label={loading ? 'Creating account...' : 'Create account'} onPress={submit} disabled={loading} />

      <Pressable onPress={() => navigation.navigate('Login')}>
        <Text style={{ color: colors.surface, fontSize: 16, textAlign: 'center' }}>Already have an account? <Text style={{ color: colors.primary, fontWeight: '700' }}>Sign in</Text></Text>
      </Pressable>
    </Screen>
  );
}
