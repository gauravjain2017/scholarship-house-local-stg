import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { spacing, typography } from '@/theme';
import { useTheme, useThemedStyles, type ThemeColors } from '@/context/ThemeContext';
import { ClientDashboard } from '@/screens/ClientHome';
import { SubmitterDashboard } from '@/screens/SubmitterHome';

export default function HomeScreen() {
  const { user } = useAuth();
  const userType = String(user?.userType ?? 'submitter').toLowerCase();

  if (userType === 'client') return <ClientDashboard />;
  if (userType === 'admin')  return <ComingSoonDashboard userType="admin" />;
  return <SubmitterDashboard />;
}

// ─── Admin placeholder ───────────────────────────────────────────────────────

function ComingSoonDashboard({ userType }: { userType: string }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.xl }]}>
      <View style={styles.center}>
        <Ionicons name="construct-outline" size={56} color={colors.textMuted} />
        <Text style={styles.h2}>Dashboard coming soon</Text>
        <Text style={[styles.lead, { textAlign: 'center', paddingHorizontal: spacing.xl }]}>
          The {userType} dashboard is under construction. For now, use the other tabs to
          manage your account.
        </Text>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgAlt },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  h2: { ...typography.h2, color: colors.text, marginTop: spacing.md },
  lead: { ...typography.body, color: colors.textMuted, marginTop: spacing.xs },
});
