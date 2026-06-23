import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AuthHeroLayout } from '@/components/AuthHeroLayout';
import { Button } from '@/components/Button';
import { ErrorModal } from '@/components/ErrorModal';
import { requestPasswordReset, verifyResetOtp } from '@/api/auth';
import { extractApiError } from '@/api/client';
import { radius, spacing, typography } from '@/theme';
import { useThemedStyles, type ThemeColors } from '@/context/ThemeContext';

const OTP_LENGTH = 6;
// Mirror the backend's PASSWORD_RESET_OTP_EXPIRY_MINUTES (default 10 minutes).
const COUNTDOWN_SECONDS = 10 * 60;

const formatTime = (total: number) => {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

export default function VerifyOtpScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);
  const email = params.email ?? '';

  const [code, setCode] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  // Inline validation message (wrong / expired code), per the design.
  const [validationMsg, setValidationMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const hiddenInputRef = useRef<TextInput>(null);
  // Absolute wall-clock instant the code expires. We count down against this
  // rather than decrementing a counter, so the timer stays correct even when
  // the OS throttles/pauses JS timers while the app is backgrounded (which is
  // more aggressive in a release APK than in Expo Go). The OTP also expires
  // server-side at this same real-world time, so the UI stays in sync.
  const expiresAtRef = useRef<number>(Date.now() + COUNTDOWN_SECONDS * 1000);

  // Countdown tick — recomputed from the absolute expiry, plus an immediate
  // recompute whenever the app comes back to the foreground.
  useEffect(() => {
    const recompute = () =>
      setSecondsLeft(Math.max(0, Math.round((expiresAtRef.current - Date.now()) / 1000)));

    recompute();
    const id = setInterval(recompute, 1000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') recompute();
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, []);

  // Focus the (invisible) input so the keyboard opens on entry.
  useEffect(() => {
    const t = setTimeout(() => hiddenInputRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, []);

  const expired = secondsLeft <= 0;
  const cells = useMemo(() => Array.from({ length: OTP_LENGTH }), []);

  const handleChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setCode(digits);
    if (validationMsg) setValidationMsg(null);
    // Auto-submit once all six digits are in.
    if (digits.length === OTP_LENGTH && !expired) onVerify(digits);
  };

  const onVerify = async (value?: string) => {
    const otp = value ?? code;
    if (otp.length !== OTP_LENGTH || verifying) return;
    setVerifying(true);
    setValidationMsg(null);
    try {
      const res = await verifyResetOtp(email, otp);
      if (res.valid && res.token) {
        // Hand the verified token to the reset screen.
        router.replace({ pathname: '/(auth)/reset-password', params: { token: res.token } });
      } else {
        setValidationMsg('The code you entered is incorrect.');
      }
    } catch (err) {
      // 400s carry a friendly message (wrong / expired / too many attempts).
      setValidationMsg(extractApiError(err));
    } finally {
      setVerifying(false);
    }
  };

  const onResend = async () => {
    if (resending) return;
    setResending(true);
    setValidationMsg(null);
    setCode('');
    try {
      await requestPasswordReset(email);
      // Re-anchor the absolute expiry; the interval picks it up on the next tick.
      expiresAtRef.current = Date.now() + COUNTDOWN_SECONDS * 1000;
      setSecondsLeft(COUNTDOWN_SECONDS);
      hiddenInputRef.current?.focus();
    } catch (err) {
      setErrorMsg(extractApiError(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <>
      <AuthHeroLayout
        brandLogo
        eyebrow="VERIFY CODE"
        title="Enter the code"
        subtitle={
          email
            ? `We sent a 6-digit code to ${email}. It expires in 10 minutes.`
            : 'Enter the 6-digit code we emailed you.'
        }
        showBack
        backHref="/(auth)/forgot-password"
        footerText="Wrong email?"
        footerLinkLabel="Start over"
        footerLinkHref="/(auth)/forgot-password"
      >
        {/* Tapping anywhere on the boxes refocuses the hidden input. */}
        <Pressable onPress={() => hiddenInputRef.current?.focus()} style={styles.boxesRow}>
          {cells.map((_, i) => {
            const char = code[i] ?? '';
            const isActive = i === code.length;
            return (
              <View
                key={i}
                style={[
                  styles.box,
                  char ? styles.boxFilled : null,
                  isActive ? styles.boxActive : null,
                  validationMsg ? styles.boxError : null,
                ]}
              >
                <Text style={styles.boxText}>{char}</Text>
              </View>
            );
          })}
        </Pressable>

        {/* Invisible field that actually captures the digits. */}
        <TextInput
          ref={hiddenInputRef}
          value={code}
          onChangeText={handleChange}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          maxLength={OTP_LENGTH}
          style={styles.hiddenInput}
          caretHidden
          editable={!expired}
        />

        {validationMsg ? <Text style={styles.errorText}>{validationMsg}</Text> : null}

        <View style={styles.timerRow}>
          {expired ? (
            <Text style={styles.expiredText}>Your code has expired.</Text>
          ) : (
            <Text style={styles.timerText}>
              Code expires in <Text style={styles.timerStrong}>{formatTime(secondsLeft)}</Text>
            </Text>
          )}
        </View>

        <Button
          title="Verify code"
          onPress={() => onVerify()}
          loading={verifying}
          disabled={code.length !== OTP_LENGTH || expired}
        />

        <Pressable
          onPress={onResend}
          disabled={!expired || resending}
          hitSlop={8}
          style={styles.resendWrap}
        >
          <Text style={[styles.resendText, (!expired || resending) && styles.resendDisabled]}>
            {resending
              ? 'Sending…'
              : expired
                ? 'Resend code'
                : `Resend available when the code expires`}
          </Text>
        </Pressable>
      </AuthHeroLayout>

      <ErrorModal
        visible={!!errorMsg}
        title="Could not resend code"
        message={errorMsg ?? ''}
        ctaLabel="OK"
        onDismiss={() => setErrorMsg(null)}
      />
    </>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  boxesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: spacing.md,
  },
  box: {
    width: 46,
    height: 58,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFilled: { borderColor: colors.primary },
  boxActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  boxError: { borderColor: colors.danger },
  boxText: { ...typography.h2, color: colors.text },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.xs,
  },
  timerRow: {
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  timerText: { ...typography.body, color: colors.textMuted },
  timerStrong: { color: colors.text, fontWeight: '700' },
  expiredText: { ...typography.body, color: colors.danger },
  resendWrap: {
    alignItems: 'center',
    paddingTop: spacing.md,
  },
  resendText: { ...typography.bodyStrong, color: colors.primaryAccent },
  resendDisabled: { color: colors.textMuted },
});
