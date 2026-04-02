import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, View, type ScrollViewProps, type ViewStyle } from 'react-native';

import { colors } from '../lib/theme';

export function Screen({ children, scroll = false, contentContainerStyle }: { children: React.ReactNode; scroll?: boolean; contentContainerStyle?: ScrollViewProps['contentContainerStyle'] | ViewStyle; }) {
  if (scroll) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.ink }}>
        <ScrollView contentContainerStyle={contentContainerStyle} style={{ flex: 1, backgroundColor: colors.ink }}>
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.ink }}>
      <View style={[{ flex: 1 }, contentContainerStyle as ViewStyle]}>{children}</View>
    </SafeAreaView>
  );
}
