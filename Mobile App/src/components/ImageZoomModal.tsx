import React from 'react';
import {
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

/**
 * Full-screen single-image viewer with the same pinch / pan / double-tap zoom
 * used for property photos (see ImageCarousel's ZoomableImage). Used for tapping
 * the profile avatar to inspect it close up. Renders nothing when there is no
 * image.
 */
export function ImageZoomModal({
  uri,
  visible,
  onClose,
}: {
  uri?: string | null;
  visible: boolean;
  onClose: () => void;
}) {
  if (!uri) return null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      {/* Mount only while visible so each open starts un-zoomed. The Modal
          renders in its own native view tree that the app-root
          GestureHandlerRootView does NOT cover, so the pinch/pan/double-tap
          gestures only fire when we wrap the modal content in its own root. */}
      {visible && (
        <GestureHandlerRootView style={styles.root}>
          <ZoomableImage uri={uri} />
          <Pressable
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close photo"
          >
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
        </GestureHandlerRootView>
      )}
    </Modal>
  );
}

const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;

/**
 * Pinch / pan / double-tap zoomable image — same behaviour as the property
 * lightbox, minus the FlatList paging concerns (a single avatar).
 *
 * - Pinch:      scales 1×–MAX_SCALE around the gesture's focal point.
 * - Pan:        only translates while zoomed; clamped to the image edges.
 * - Double tap: toggles between 1× and DOUBLE_TAP_SCALE.
 */
function ZoomableImage({ uri }: { uri: string }) {
  const { width, height } = useWindowDimensions();

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  // Pinch focal point (image-local coords) keeps the spot under the user's
  // fingers anchored as scale changes, like Photos.app.
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);

  const clampTranslation = (s: number) => {
    'worklet';
    const maxX = Math.max(0, (width * s - width) / 2);
    const maxY = Math.max(0, (height * s - height) / 2);
    translateX.value = Math.min(maxX, Math.max(-maxX, translateX.value));
    translateY.value = Math.min(maxY, Math.max(-maxY, translateY.value));
    savedTranslateX.value = translateX.value;
    savedTranslateY.value = translateY.value;
  };

  const resetZoom = () => {
    'worklet';
    scale.value = withTiming(1);
    savedScale.value = 1;
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  };

  const pinch = Gesture.Pinch()
    .onStart((e) => {
      focalX.value = e.focalX - width / 2;
      focalY.value = e.focalY - height / 2;
    })
    .onUpdate((e) => {
      const next = Math.min(MAX_SCALE, Math.max(0.8, savedScale.value * e.scale));
      translateX.value =
        focalX.value -
        ((focalX.value - savedTranslateX.value) / savedScale.value) * next;
      translateY.value =
        focalY.value -
        ((focalY.value - savedTranslateY.value) / savedScale.value) * next;
      scale.value = next;
    })
    .onEnd(() => {
      if (scale.value <= 1) {
        resetZoom();
      } else {
        savedScale.value = scale.value;
        clampTranslation(scale.value);
      }
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
    .manualActivation(true)
    .onTouchesMove((_e, state) => {
      if (scale.value > 1) {
        state.activate();
      } else {
        state.fail();
      }
    })
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      clampTranslation(scale.value);
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(300)
    .onEnd((_e, success) => {
      if (!success) return;
      if (scale.value > 1) {
        resetZoom();
      } else {
        scale.value = withTiming(DOUBLE_TAP_SCALE);
        savedScale.value = DOUBLE_TAP_SCALE;
      }
    });

  const composed = Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan));

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        style={{
          width,
          height,
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
        }}
      >
        <Animated.View style={[{ width, height }, animatedStyle]}>
          <Image
            source={{ uri }}
            style={{ width, height }}
            contentFit="contain"
            accessibilityLabel="Profile photo, pinch to zoom"
            cachePolicy="memory-disk"
            recyclingKey={uri}
            transition={150}
          />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  closeBtn: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
