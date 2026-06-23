import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { PropertyDetailView } from '@/components/property-detail/PropertyDetailView';
import { PropertyDetailSkeleton } from '@/components/Skeleton';
import { useAuth } from '@/context/AuthContext';
import { getDealById } from '@/api/deals';
import { useTheme, useThemedStyles, type ThemeColors } from '@/context/ThemeContext';

/**
 * Property detail route — a thin container.
 *
 * The full presentation lives in the shared `<PropertyDetailView>` so the
 * client and submitter interfaces render the SAME page (same sections, same
 * order, same calculations as the web `DealDetailView`). The only difference is
 * `mode`: clients see the Claim / Copy / Favorite CTA row; submitters see
 * Edit / Unsubmit. Computed from `user.userType`.
 */
export default function PropertyDetailScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useAuth();
  const isClient = String(user?.userType ?? '').toLowerCase() === 'client';

  const goBack = () => {
    if (navigation.canGoBack()) router.back();
    else router.replace(isClient ? '/(tabs)/client-browse' : '/(tabs)');
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['deal', id],
    queryFn: () => getDealById(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return <PropertyDetailSkeleton />;
  }

  if (error || !data) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.danger }}>Property not found</Text>
      </View>
    );
  }

  return <PropertyDetailView data={data} mode={isClient ? 'client' : 'submitter'} onBack={goBack} />;
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
