import { addHours, endOfMonth, format, isSameDay, startOfMonth, subDays } from 'date-fns';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { colors, radius, spacing, type as typeScale } from '../lib/theme';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'DateSelection'>;

export function DateSelectionScreen({ navigation, route }: Props) {
  const { lot } = route.params;
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(today);
  const [startHour, setStartHour] = useState(0);
  const [durationHours, setDurationHours] = useState(2);

  const days = useMemo(() => {
    const start = startOfMonth(today);
    const end = endOfMonth(today);
    const result: Date[] = [];
    for (let current = start; current <= end; current = addHours(current, 24)) {
      result.push(current);
    }
    return result;
  }, [today]);

  const startTime = new Date(selectedDate);
  startTime.setHours(8 + startHour, 0, 0, 0);
  const endTime = addHours(startTime, durationHours);

  return (
    <Screen scroll contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}>
      <View style={{ backgroundColor: colors.surface, borderRadius: 40, padding: spacing.xl, gap: spacing.lg }}>
        <Text style={{ fontSize: typeScale.h1, fontWeight: '800', color: colors.text, lineHeight: 44 }}>When do you need to park?</Text>

        <View style={{ minHeight: 60, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, paddingHorizontal: spacing.md, justifyContent: 'center' }}>
          <Text style={{ fontSize: 14, color: '#8F8F8F' }}>Where</Text>
          <Text style={{ fontSize: 18, color: colors.text, fontWeight: '600' }}>{lot.address}</Text>
        </View>

        <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 28, padding: spacing.lg, gap: spacing.md }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{format(today, 'MMMM yyyy')}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day) => (
              <Text key={day} style={{ width: 32, textAlign: 'center', color: colors.textMuted }}>{day}</Text>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {days.map((day) => {
              const active = isSameDay(day, selectedDate);
              const disabled = day < subDays(today, 1);
              return (
                <Pressable
                  key={day.toISOString()}
                  onPress={() => !disabled && setSelectedDate(day)}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: active ? colors.primary : disabled ? '#F1F1F1' : colors.primarySoft,
                    opacity: disabled ? 0.5 : 1,
                  }}
                >
                  <Text style={{ color: active ? colors.surface : colors.text, fontWeight: '700' }}>{format(day, 'd')}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text style={{ fontSize: typeScale.h4, fontWeight: '700', color: colors.text }}>Start time</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[0, 1, 2, 3, 4, 5].map((offset) => {
              const active = offset === startHour;
              return (
                <Pressable
                  key={offset}
                  onPress={() => setStartHour(offset)}
                  style={{
                    paddingHorizontal: 14,
                    minHeight: 42,
                    borderRadius: radius.pill,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: active ? colors.primary : colors.surfaceMuted,
                  }}
                >
                  <Text style={{ color: active ? colors.surface : colors.text, fontWeight: '700' }}>{format(addHours(new Date().setHours(8, 0, 0, 0), offset), 'h:mm a')}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text style={{ fontSize: typeScale.h4, fontWeight: '700', color: colors.text }}>Duration</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[1, 2, 3, 4].map((hours) => {
              const active = hours === durationHours;
              return (
                <Pressable
                  key={hours}
                  onPress={() => setDurationHours(hours)}
                  style={{
                    flex: 1,
                    minHeight: 46,
                    borderRadius: radius.md,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: active ? colors.primary : colors.surfaceMuted,
                  }}
                >
                  <Text style={{ color: active ? colors.surface : colors.text, fontWeight: '700' }}>{hours} hr</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      <PrimaryButton
        label="Continue"
        onPress={() => navigation.navigate('Checkout', { lot, startTime: startTime.toISOString(), endTime: endTime.toISOString() })}
      />
    </Screen>
  );
}
