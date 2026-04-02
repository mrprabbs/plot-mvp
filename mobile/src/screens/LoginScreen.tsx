import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { TextInputField } from '../components/TextInputField';
import { colors, spacing, type as typeScale } from '../lib/theme';
import { useAuth } from '../providers/AuthProvider';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    try {
      setLoading(true);
      setError(null);
      await login(email, password);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll contentContainerStyle={{ flexGrow: 1, padding: spacing.xl, justifyContent: 'center', gap: spacing.lg }}>
      <Text style={{ color: colors.surface, fontSize: typeScale.h1, fontWeight: '800', lineHeight: 44 }}>Find parking fast.</Text>
      <Text style={{ color: '#D0D0D0', fontSize: 18 }}>Sign in to browse nearby lots, reserve, and manage your bookings.</Text>

      <View style={{ gap: spacing.md }}>
        <TextInputField label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" />
        <TextInputField label="Password" value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry />
      </View>

      {error ? <Text style={{ color: '#FF8C82', fontSize: 14 }}>{error}</Text> : null}

      <PrimaryButton label={loading ? 'Signing in...' : 'Sign in'} onPress={submit} disabled={loading} />

      <Pressable onPress={() => navigation.navigate('Register')}>
        <Text style={{ color: colors.surface, fontSize: 16, textAlign: 'center' }}>Need an account? <Text style={{ color: colors.primary, fontWeight: '700' }}>Create one</Text></Text>
      </Pressable>
    </Screen>
  );
}
