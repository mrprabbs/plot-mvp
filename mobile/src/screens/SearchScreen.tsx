import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { Screen } from '../components/Screen';
import { apiFetch } from '../lib/api';
import { colors, radius, spacing, type as typeScale } from '../lib/theme';
import type { MobileLot } from '../lib/types';
import { useAuth } from '../providers/AuthProvider';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Search'>;

const defaultRegion: Region = {
  latitude: 42.3601,
  longitude: -71.0589,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

export function SearchScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [region, setRegion] = useState<Region>(defaultRegion);
  const [selectedLotId, setSelectedLotId] = useState<number | null>(null);

  const lotsQuery = useQuery({
    queryKey: ['mobile-lots', region.latitude, region.longitude],
    queryFn: async () => apiFetch<MobileLot[]>(`/api/mobile/lots/nearby?latitude=${region.latitude}&longitude=${region.longitude}`),
  });

  useEffect(() => {
    void (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        return;
      }

      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setRegion((prev) => ({
        ...prev,
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      }));
    })();
  }, []);

  const selectedLot = lotsQuery.data?.find((lot) => lot.id === selectedLotId) ?? lotsQuery.data?.[0] ?? null;

  return (
    <Screen contentContainerStyle={{ flex: 1 }}>
      <View style={styles.headerRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={22} color="#8C8C8C" />
          <TextInput placeholder="Search" placeholderTextColor="#9A9A9A" style={styles.searchInput} />
        </View>
        <Pressable style={styles.iconButton} onPress={() => navigation.navigate('Reservations')}>
          <Ionicons name="calendar-outline" size={20} color={colors.surface} />
        </Pressable>
        <Pressable style={styles.iconButton} onPress={() => navigation.navigate('Profile')}>
          <Ionicons name="person-outline" size={20} color={colors.surface} />
        </Pressable>
      </View>

      <View style={styles.mapShell}>
        <MapView
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFill}
          initialRegion={region}
          onRegionChangeComplete={setRegion}
          customMapStyle={mapStyle}
        >
          {(lotsQuery.data ?? []).map((lot) => (
            <Marker
              key={lot.id}
              coordinate={{ latitude: lot.latitude, longitude: lot.longitude }}
              onPress={() => setSelectedLotId(lot.id)}
            >
              <View style={styles.pricePin}>
                <Text style={styles.pricePinText}>${Math.round(lot.pricePerHour / 100)}</Text>
              </View>
            </Marker>
          ))}
        </MapView>

        {lotsQuery.isLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.centerStateText}>Loading nearby lots...</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.greetingRow}>
        <Text style={styles.greetingTitle}>Hi{user ? `, ${user.fullName.split(' ')[0]}` : ''}</Text>
        <Text style={styles.greetingText}>Current location map, nearby lots pinned, and quick reserve flow.</Text>
      </View>

      {selectedLot ? (
        <Pressable style={styles.selectedCard} onPress={() => navigation.navigate('LotDetail', { lot: selectedLot })}>
          <View style={styles.imagePlaceholder} />
          <View style={styles.selectedCardBody}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.cardTitle}>{selectedLot.name}</Text>
              <Text style={styles.cardSubtext}>{selectedLot.address}</Text>
            </View>
            <Text style={styles.priceLabel}>{selectedLot.priceLabel}</Text>
          </View>
        </Pressable>
      ) : null}

      {selectedLot ? (
        <View style={styles.bottomSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetCard}>
            <View style={styles.sheetImage} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.cardTitle}>{selectedLot.name}</Text>
              <Text style={styles.cardSubtext}>{selectedLot.address}</Text>
              <Text style={styles.cardSubtext}>{selectedLot.availableSpots} spots available</Text>
            </View>
            <Text style={styles.priceLabel}>{selectedLot.priceLabel}</Text>
          </View>
          <Pressable style={styles.favoriteRow} onPress={() => navigation.navigate('LotDetail', { lot: selectedLot })}>
            <Text style={styles.favoriteRowText}>Open details</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.text} />
          </Pressable>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  searchBar: {
    flex: 1,
    minHeight: 52,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#171717',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapShell: {
    flex: 1,
    marginHorizontal: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.mapShell,
  },
  centerState: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11,11,11,0.22)',
    gap: 10,
  },
  centerStateText: { color: colors.surface, fontSize: 16, fontWeight: '600' },
  greetingRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: 4,
  },
  greetingTitle: { color: colors.surface, fontSize: typeScale.h2, fontWeight: '800' },
  greetingText: { color: '#C9C9C9', fontSize: 14 },
  selectedCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  imagePlaceholder: { height: 160, backgroundColor: '#CFCFCF' },
  selectedCardBody: {
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  cardSubtext: { fontSize: 13, color: colors.textMuted },
  priceLabel: { fontSize: 20, fontWeight: '700', color: colors.text },
  bottomSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.md,
    gap: spacing.md,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 72,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#D7D7D7',
  },
  sheetCard: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  sheetImage: {
    width: 96,
    height: 96,
    borderRadius: radius.md,
    backgroundColor: '#D0D0D0',
  },
  favoriteRow: {
    minHeight: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  favoriteRowText: { fontSize: 16, fontWeight: '600', color: colors.text },
  pricePin: {
    minWidth: 42,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 10,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D9D9D9',
  },
  pricePinText: { color: colors.text, fontSize: 12, fontWeight: '700' },
});

const mapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1b1b1b' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8d8d8d' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1b1b1b' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#343434' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0F2742' }] },
];
