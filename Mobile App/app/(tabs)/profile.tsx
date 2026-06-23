import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ImageZoomModal } from '@/components/ImageZoomModal';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useNotificationsHeader } from '@/hooks/useNotificationsHeader';
import { useAuth } from '@/context/AuthContext';
import { getProfile, updateProfile } from '@/api/profile';
import { uploadLocalFile } from '@/api/upload';
import { extractApiError } from '@/api/client';
import { setItem, StorageKeys } from '@/storage/secure';
import { radius, shadows, spacing, typography } from '@/theme';
import { useTheme, useThemedStyles, type ThemeColors } from '@/context/ThemeContext';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

export default function ProfileScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors, isDark, toggle } = useTheme();
  const router = useRouter();
  const { user, setUser, signOut } = useAuth();
  const qc = useQueryClient();
  const headerBell = useNotificationsHeader();
  const [uploading, setUploading] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
    initialData: user || undefined,
  });

  // Sync the freshly-fetched profileImage back into AuthContext so the header
  // avatar (and any cached AuthUser persisted to storage) stays in step with
  // the latest /profile/me response — otherwise the header would lag behind
  // a fresh avatar upload until the next app restart.
  useEffect(() => {
    const fresh = (data as any)?.profileImage as string | undefined;
    if (!user) return;
    if (fresh === user.profileImage) return;
    const next = { ...user, profileImage: fresh ?? null };
    setUser(next);
    setItem(StorageKeys.user, JSON.stringify(next)).catch(() => {});
  }, [data, user, setUser]);

  const updateMut = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  });

  const uploadAvatarAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    const email = data?.email ?? user?.email;
    if (!email) {
      Alert.alert('Please wait', 'Profile is still loading. Try again in a moment.');
      return;
    }
    setUploading(true);
    try {
      const publicUrl = await uploadLocalFile(asset.uri, asset.mimeType || 'image/jpeg', 'avatars');
      // /profile/update validates that name + phone are present, so echo the
      // current values along with the new profile image. Without these the
      // backend returns 400 "Name is required. Phone is required."
      await updateMut.mutateAsync({
        email,
        name: data?.name ?? user?.name ?? undefined,
        phone: data?.phone ?? user?.phone ?? undefined,
        profileImage: publicUrl,
      });
    } catch (err) {
      Alert.alert('Upload failed', extractApiError(err));
    } finally {
      setUploading(false);
    }
  };

  const pickFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow camera access to take a profile photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    await uploadAvatarAsset(result.assets[0]);
  };

  const pickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to change your profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    await uploadAvatarAsset(result.assets[0]);
  };

  // Alert.alert with three buttons works as a cross-platform action sheet —
  // avoids pulling in ActionSheetIOS (iOS-only) or an extra dep.
  const onPickAvatar = () => {
    Alert.alert(
      'Update profile photo',
      'Choose a source for your new profile photo.',
      [
        { text: 'Take photo', onPress: pickFromCamera },
        { text: 'Choose from library', onPress: pickFromLibrary },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true },
    );
  };

  const onSignOut = () =>
    Alert.alert('Sign out?', 'You will be returned to the login screen.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);

  if (isLoading && !data) {
    return (
      <View style={styles.screen}>
        <ScreenHeader
          title="My Profile"
          subtitle="Account & settings"
          iconName="person-outline"
          {...headerBell}
        />
        <View style={styles.loadingScreen}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  const avatar = (data as any)?.profileImage as string | undefined;
  const displayName = data?.name || 'Unnamed';
  const initials = (displayName !== 'Unnamed' ? displayName : data?.email ?? '?')[0]?.toUpperCase();

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="My Profile"
        subtitle="Account & settings"
        iconName="person-outline"
        {...headerBell}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xxl * 2 }}
      >
        <View style={styles.hero}>
          <View style={styles.avatarWrap}>
            {/* Tapping the image opens the zoom viewer; tapping the badge below
                opens the photo picker. With no avatar there is nothing to
                zoom, so the image area falls back to opening the picker. */}
            <Pressable
              onPress={avatar ? () => setViewerOpen(true) : onPickAvatar}
              style={styles.avatarFill}
              accessibilityRole="imagebutton"
              accessibilityLabel={avatar ? 'View profile photo' : 'Add profile photo'}
            >
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.initials}>{initials}</Text>
                </View>
              )}
            </Pressable>
            {uploading ? (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : (
              <Pressable
                onPress={onPickAvatar}
                style={styles.avatarBadge}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Change profile photo"
              >
                <Ionicons name="camera" size={15} color="#fff" />
              </Pressable>
            )}
          </View>
          <Text style={styles.heroTitle} numberOfLines={1}>{displayName}</Text>
          <Text style={styles.heroSubtitle} numberOfLines={1}>{data?.email}</Text>
        </View>

        <ImageZoomModal
          uri={avatar}
          visible={viewerOpen}
          onClose={() => setViewerOpen(false)}
        />

        <View style={styles.content}>
          <Text style={styles.kicker}>CONTACT</Text>
          <Card padding="lg">
            <DetailRow label="Phone" value={data?.phone || '—'} />
            <Divider />
            <DetailRow label="Role" value={(data?.userType ?? data?.role ?? 'submitter') as string} capitalize />
          </Card>

          {user?.userType === 'client' && (
            <>
              <Text style={styles.kicker}>EXPLORE</Text>
              <Card padding={0}>
                <MenuRow
                  icon="business-outline"
                  label="Browse properties"
                  onPress={() => router.push('/(tabs)/client-browse')}
                />
                <Divider />
                <MenuRow
                  icon="calculator-outline"
                  label="JV Calc"
                  onPress={() => router.push('/(tabs)/jv-calculator')}
                />
              </Card>
            </>
          )}

          {user?.userType !== 'client' && (
            <>
              <Text style={styles.kicker}>LISTINGS</Text>
              <Card padding={0}>
                <MenuRow
                  icon="business-outline"
                  label="Browse properties"
                  onPress={() => router.push('/(tabs)/browse')}
                />
                <Divider />
                <MenuRow
                  icon="add-circle-outline"
                  label="Submit a property"
                  onPress={() => router.push('/(tabs)/submit')}
                />
                <Divider />
                <MenuRow
                  icon="document-text-outline"
                  label="My drafts"
                  onPress={() => router.push('/(tabs)/drafts')}
                />
              </Card>
            </>
          )}

          <Text style={styles.kicker}>APPEARANCE</Text>
          <Card padding={0}>
            <View style={styles.menuRow}>
              <View style={styles.menuIconWrap}>
                <Ionicons
                  name={isDark ? 'moon' : 'moon-outline'}
                  size={18}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.menuLabel}>Dark mode</Text>
              <Switch
                value={isDark}
                onValueChange={toggle}
                trackColor={{ false: colors.borderStrong, true: colors.primary }}
                thumbColor="#fff"
                ios_backgroundColor={colors.borderStrong}
              />
            </View>
          </Card>

          <Text style={styles.kicker}>ACCOUNT</Text>
          <Card padding={0}>
            <MenuRow
              icon="create-outline"
              label="Edit profile"
              onPress={() => router.push('/profile/edit')}
            />
            <Divider />
            <MenuRow
              icon="lock-closed-outline"
              label="Change password"
              onPress={() => router.push('/profile/change-password')}
            />
          </Card>

          <View style={{ marginTop: spacing.xl }}>
            <Button title="Sign out" variant="danger" onPress={onSignOut} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function DetailRow({
  label,
  value,
  capitalize,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, capitalize && { textTransform: 'capitalize' }]}>
        {value}
      </Text>
    </View>
  );
}

function Divider() {
  const styles = useThemedStyles(makeStyles);
  return <View style={styles.divider} />;
}

function MenuRow({
  icon,
  label,
  onPress,
}: {
  icon: IoniconsName;
  label: string;
  onPress: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuRow, pressed && { backgroundColor: colors.bgAlt }]}
    >
      <View style={styles.menuIconWrap}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const AVATAR = 96;

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgAlt },
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgAlt },
  hero: {
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  heroTitle: {
    ...typography.h2,
    color: colors.text,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  heroSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  avatarWrap: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: colors.bg,
    padding: 4,
    ...shadows.cardStrong,
  },
  avatarFill: { width: '100%', height: '100%', borderRadius: AVATAR / 2 },
  avatar: { width: '100%', height: '100%', borderRadius: AVATAR / 2 },
  avatarPlaceholder: {
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { ...typography.h1, color: colors.primary },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: AVATAR / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryAccent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },

  content: { paddingHorizontal: spacing.lg, marginTop: spacing.md },
  kicker: {
    ...typography.captionStrong,
    color: colors.textMuted,
    letterSpacing: 1.2,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  detailLabel: { ...typography.caption, color: colors.textMuted },
  detailValue: { ...typography.bodyStrong, color: colors.text },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },

  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  menuIcon: { fontSize: 16, color: colors.primary },
  menuLabel: { ...typography.body, color: colors.text, flex: 1, fontWeight: '500' },
  chevron: { fontSize: 22, color: colors.textMuted },
});
