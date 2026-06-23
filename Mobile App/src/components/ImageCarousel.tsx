import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  LayoutChangeEvent,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { radius, spacing, typography } from '@/theme';
import { useTheme, useThemedStyles, type ThemeColors } from '@/context/ThemeContext';

interface ImageCarouselProps {
  /** Image URIs to render. Empty array shows the fallback. */
  images: string[];
  /**
   * Optional video URIs. Appended as swipeable pages AFTER the images, each
   * rendered with native play/pause/fullscreen controls. A video auto-pauses
   * when you swipe to another page. Omit for an images-only gallery (default).
   */
  videos?: string[];
  /** Height of the carousel viewport in px. Width is always the window width. */
  height: number;
  /**
   * Optional controlled active index. When omitted the carousel manages it
   * internally (the common case). If you do supply it, also pass
   * `onIndexChange` to receive updates from swipes / chevron taps.
   */
  index?: number;
  onIndexChange?: (index: number) => void;
  /**
   * What to render when `images` is empty. Defaults to a centred home icon.
   */
  emptyContent?: React.ReactNode;
  /**
   * Absolutely-positioned overlays (back chevron, status badge, etc.) the
   * parent wants on top of the gallery. Rendered as the last children so they
   * paint above the dots/counter row.
   */
  children?: React.ReactNode;
  /**
   * When true (default), tapping any image opens a fullscreen lightbox modal
   * that lets the user swipe through the gallery at full resolution. Set to
   * false on screens that already render their own fullscreen viewer.
   */
  enableLightbox?: boolean;
}

/**
 * Horizontal, swipeable property image gallery.
 *
 * Uses a horizontal FlatList with `pagingEnabled` so users can swipe left /
 * right on touch devices (iOS, Android, mobile web) and use the on-screen
 * chevrons everywhere. The carousel is the sole owner of `imgIndex`, so the
 * dots, counter, chevrons, and swipe gesture all stay in sync via one source
 * of truth.
 */
type MediaItem = { uri: string; kind: 'image' | 'video' };

export function ImageCarousel({
  images,
  videos = [],
  height,
  index,
  onIndexChange,
  emptyContent,
  children,
  enableLightbox = true,
}: ImageCarouselProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  // Combined, ordered media: images first, then any videos. Image items keep
  // their original index (so tapping one opens the image-only lightbox at the
  // same position); video pages render an inline player.
  const items: MediaItem[] = useMemo(
    () => [
      ...images.map((uri) => ({ uri, kind: 'image' as const })),
      ...videos.map((uri) => ({ uri, kind: 'video' as const })),
    ],
    [images, videos],
  );
  // Page width is the carousel's own container width (NOT the window width)
  // so the same component works for full-bleed detail-page heroes AND for
  // cards on the browse listing that have padding/margin around them.
  const { width: windowWidth } = useWindowDimensions();
  const [pageWidth, setPageWidth] = useState(0);
  const flatListRef = useRef<FlatList<MediaItem>>(null);
  const [internalIndex, setInternalIndex] = useState(0);
  const activeIndex = index ?? internalIndex;
  // The page the FlatList is *physically* showing. Used so the index-sync
  // effect never re-scrolls to a page the user just swiped to — re-issuing a
  // programmatic scroll there fights the gesture and makes the carousel
  // oscillate / "bubble" on rapid back-and-forth swipes.
  const visibleIndexRef = useRef(activeIndex);

  // Lightbox modal state. Opened by tapping an image; the modal owns its own
  // FlatList so swiping inside the lightbox doesn't fight with the card-level
  // carousel underneath.
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const openLightbox = (i: number) => {
    if (!enableLightbox) return;
    setLightboxIndex(i);
    setLightboxOpen(true);
  };

  const setIndex = (next: number) => {
    if (index === undefined) setInternalIndex(next);
    onIndexChange?.(next);
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== pageWidth) setPageWidth(w);
  };

  // Keep the FlatList visually in sync if a parent drives `index` externally.
  useEffect(() => {
    if (index === undefined || items.length === 0 || pageWidth === 0) return;
    // The list already shows this page (e.g. the index change came from the
    // user's own swipe) — re-scrolling there fights the gesture, so skip it.
    if (index === visibleIndexRef.current) return;
    visibleIndexRef.current = index;
    flatListRef.current?.scrollToOffset({
      offset: index * pageWidth,
      animated: true,
    });
  }, [index, pageWidth, items.length]);

  // After rotation / parent-resize, snap the visible image flush against the
  // new viewport edge so we don't end up between two pages.
  useEffect(() => {
    if (items.length === 0 || pageWidth === 0) return;
    flatListRef.current?.scrollToOffset({
      offset: activeIndex * pageWidth,
      animated: false,
    });
    visibleIndexRef.current = activeIndex;
    // We deliberately watch pageWidth (and window width as a proxy for rotation).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageWidth, windowWidth]);

  // Warm the cache for nearby pages so a swipe lands on an already-downloaded
  // image instead of a blank gray frame. Without this, expo-image only starts
  // fetching a photo when its page mounts — so flicking quickly through a
  // 60-image gallery shows the loader on every new page. `Image.prefetch`
  // dedupes and persists to disk, so this only pays the network cost once.
  useEffect(() => {
    if (images.length <= 1) return;
    const AHEAD = 3;
    const BEHIND = 1;
    const urls: string[] = [];
    for (let d = -BEHIND; d <= AHEAD; d++) {
      const i = activeIndex + d;
      if (i >= 0 && i < images.length && i !== activeIndex) urls.push(images[i]);
    }
    if (urls.length) {
      // Fire-and-forget; a failed prefetch (e.g. a dead URL) is non-fatal — the
      // image just loads on demand when swiped to. Surface it in dev only.
      Image.prefetch(urls, { cachePolicy: 'memory-disk' }).catch((e) => {
        if (__DEV__) console.warn('Image prefetch failed:', e);
      });
    }
  }, [activeIndex, images]);

  if (items.length === 0) {
    return (
      <View style={[styles.box, { height }]} onLayout={onLayout}>
        {emptyContent ?? (
          <View style={styles.fallback}>
            <Ionicons name="home-outline" size={64} color={colors.border} />
          </View>
        )}
        {children}
      </View>
    );
  }

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (pageWidth === 0) return;
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
    if (newIndex < 0 || newIndex >= items.length) return;
    // Record where the list physically landed so the index-sync effect won't
    // echo a programmatic scroll back onto this same page.
    visibleIndexRef.current = newIndex;
    if (newIndex !== activeIndex) setIndex(newIndex);
  };

  const go = (delta: number) => {
    // Clamp to the ends instead of wrapping — wrapping made the last→first jump
    // animate a long scroll across the whole strip ("bubbling").
    const next = Math.min(items.length - 1, Math.max(0, activeIndex + delta));
    if (next === activeIndex) return;
    visibleIndexRef.current = next;
    setIndex(next);
    if (pageWidth > 0) {
      flatListRef.current?.scrollToOffset({
        offset: next * pageWidth,
        animated: true,
      });
    }
  };

  return (
    <View style={[styles.box, { height }]} onLayout={onLayout}>
      {pageWidth > 0 && (
        <FlatList
          ref={flatListRef}
          data={items}
          keyExtractor={(it, i) => `${i}-${it.uri}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          // `decelerationRate=fast` gives crisp page-snap on iOS / web.
          decelerationRate="fast"
          onMomentumScrollEnd={onMomentumEnd}
          // Constant page width — required so swipes always settle on a page
          // and so scrollToOffset arithmetic stays accurate.
          getItemLayout={(_, i) => ({
            length: pageWidth,
            offset: pageWidth * i,
            index: i,
          })}
          // Virtualization hints — only mount images near the active page so
          // we don't try to load every photo in every card on the browse
          // listing at once. expo-image caches the rest after first view.
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          windowSize={3}
          removeClippedSubviews
          renderItem={({ item, index: i }) =>
            item.kind === 'video' ? (
              // Cinematic poster + play button. Tapping opens the fullscreen
              // lightbox where the video autoplays with native controls — far
              // more immersive than the cramped inline player. The preview frame
              // is the (muted, paused) first frame so the page never looks empty.
              <CarouselVideoPreview
                uri={item.uri}
                width={pageWidth}
                height={height}
                onPress={() => openLightbox(i)}
                onPrev={() => go(-1)}
                onNext={() => go(1)}
              />
            ) : (
              // Pressable wrapper: a quick tap fires onPress (open lightbox),
              // while a horizontal drag is forwarded to the FlatList because
              // Pressable doesn't claim pan gestures. Image items keep their
              // original index, so `i` is also the index into the image-only
              // lightbox.
              <Pressable
                onPress={() => openLightbox(i)}
                disabled={!enableLightbox}
                style={{ width: pageWidth, height }}
              >
                <Image
                  source={{ uri: item.uri }}
                  style={{ width: pageWidth, height }}
                  contentFit="cover"
                  accessibilityLabel={`Property photo ${i + 1} of ${items.length}`}
                  cachePolicy="memory-disk"
                  // Tie the cached/decoded image to its URI so a recycled
                  // FlatList cell doesn't briefly show the previous page's
                  // photo while the new one decodes.
                  recyclingKey={item.uri}
                  // The page the user is on loads ahead of the prefetched
                  // neighbours.
                  priority={i === activeIndex ? 'high' : 'normal'}
                  transition={150}
                />
              </Pressable>
            )
          }
        />
      )}

      {/*
        The chevrons live in a separate absolute overlay above the FlatList.
        The outer wrapper uses `pointerEvents="box-none"` so touches OUTSIDE
        the chevron buttons pass straight through to the FlatList — swipe /
        paging keeps working everywhere else.

        Each chevron is a plain View (not a Pressable) using the responder
        system directly:
          - `onStartShouldSetResponderCapture: () => true`
              Claims the touch in the CAPTURE phase, before the FlatList's
              pan responder gets a chance to. Pressable claims at the bubble
              phase, which is too late on a horizontal paging FlatList
              (especially on mobile, where the scroll container is greedy).
          - `onResponderTerminationRequest: () => false`
              If the FlatList later asks to take over the touch, refuse.
              Without this the scroll container can still steal the gesture
              after we've grabbed it.
          - `onResponderRelease`
              Fires `go()` on release — equivalent to onPress but routed
              through the responder system we explicitly own.
        Net effect: a tap on the chevron always fires; a swipe anywhere else
        still drives the FlatList.
      */}
      {items.length > 1 && (
        <View
          pointerEvents="box-none"
          style={[StyleSheet.absoluteFillObject, { zIndex: 2 }]}
        >
          <ChevronButton
            direction="left"
            top={height / 2 - 18}
            onPress={() => go(-1)}
          />
          <ChevronButton
            direction="right"
            top={height / 2 - 18}
            onPress={() => go(1)}
          />
        </View>
      )}

      {/* Page indicator. Dots for small galleries; a single corner counter pill
          for larger ones. They are mutually exclusive AND positioned in
          different spots (dots centred, pill bottom-right) so they can never
          overlap each other. */}
      {items.length > 1 &&
        (items.length <= 8 ? (
          <View style={styles.dotsRow} pointerEvents="none">
            {items.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === activeIndex && styles.dotActive]}
              />
            ))}
          </View>
        ) : (
          <View style={styles.counter} pointerEvents="none">
            <Ionicons name="images-outline" size={12} color="#fff" />
            <Text style={styles.counterText}>
              {activeIndex + 1} / {items.length}
            </Text>
          </View>
        ))}

      {children}

      <LightboxModal
        visible={lightboxOpen}
        media={items}
        initialIndex={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
      />
    </View>
  );
}

/**
 * Carousel video page rendered as a cinematic poster: the (muted, paused) first
 * frame fills the page behind a dark gradient veil, a glowing play button sits
 * dead-centre, and a "VIDEO" badge marks the page. Tapping anywhere opens the
 * fullscreen lightbox, where the clip autoplays with native controls — a far
 * more immersive "play in a popup" experience than the cramped inline player.
 */
function CarouselVideoPreview({
  uri,
  width,
  height,
  onPress,
  onPrev,
  onNext,
}: {
  uri: string;
  width: number;
  height: number;
  onPress: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  // Muted, never auto-played — we only want the still first frame as a poster.
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = true;
  });

  // The native VideoView surface eats the FlatList's horizontal pan, so a swipe
  // on a video page wouldn't change the page (only the chevrons did). We drive
  // the carousel ourselves with a Pan gesture, raced against a Tap that opens
  // the lightbox. `activeOffsetX` keeps vertical page scroll untouched.
  const tap = Gesture.Tap()
    .maxDuration(250)
    .runOnJS(true)
    .onEnd((_e, success) => {
      if (success) onPress();
    });
  const pan = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-12, 12])
    .runOnJS(true)
    .onEnd((e) => {
      if (e.translationX <= -40) onNext();
      else if (e.translationX >= 40) onPrev();
    });
  const gesture = Gesture.Race(pan, tap);

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={[styles.videoPage, { width, height }]}
        collapsable={false}
        accessibilityRole="button"
        accessibilityLabel="Play property video"
      >
        {/* Wrapped in a pointer-events-none View so the native player surface
            never swallows the tap/swipe the gesture detector above handles. */}
        <View style={{ width, height }} pointerEvents="none">
          <VideoView
            style={{ width, height }}
            player={player}
            nativeControls={false}
            contentFit="cover"
          />
        </View>
        {/* Dark veil so the play button always reads, even on a bright frame. */}
        <View style={styles.videoVeil} pointerEvents="none" />
        <View style={styles.videoOverlay} pointerEvents="none">
          <View style={styles.videoPlayRing}>
            <View style={styles.videoPlayBtn}>
              <Ionicons name="play" size={30} color="#fff" style={{ marginLeft: 4 }} />
            </View>
          </View>
          <Text style={styles.videoOverlayText}>Tap to play video</Text>
        </View>
        <View style={styles.videoBadge} pointerEvents="none">
          <Ionicons name="videocam" size={11} color="#fff" />
          <Text style={styles.videoBadgeText}>VIDEO</Text>
        </View>
      </View>
    </GestureDetector>
  );
}

/**
 * Fullscreen lightbox video. Autoplays (with native controls) when it is the
 * active page and pauses the moment you swipe away, so audio never lingers.
 */
function LightboxVideo({
  uri,
  width,
  height,
  isActive,
}: {
  uri: string;
  width: number;
  height: number;
  isActive: boolean;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });

  useEffect(() => {
    try {
      if (isActive) player.play();
      else player.pause();
    } catch {
      /* player may already be released during unmount */
    }
  }, [isActive, player]);

  return (
    <View style={[lb.videoWrap, { width, height }]}>
      <VideoView
        style={{ width, height }}
        player={player}
        nativeControls
        allowsFullscreen
        allowsPictureInPicture={false}
        contentFit="contain"
      />
    </View>
  );
}

/**
 * Fullscreen media viewer. Opens when the user taps an image or a video poster
 * in the carousel. Images are pinch-zoomable; videos autoplay with native
 * controls on a black backdrop. Independent FlatList so swiping inside the
 * lightbox doesn't bubble up to the card-level carousel underneath.
 */
function LightboxModal({
  visible,
  media,
  initialIndex,
  onClose,
}: {
  visible: boolean;
  media: MediaItem[];
  initialIndex: number;
  onClose: () => void;
}) {
  const { width: winW, height: winH } = useWindowDimensions();
  const listRef = useRef<FlatList<MediaItem>>(null);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  // True while any image is zoomed past 1x. We forward this to the FlatList
  // as `scrollEnabled={!currentZoomed}` so a pan-while-zoomed never gets
  // hijacked into a horizontal page swipe.
  const [currentZoomed, setCurrentZoomed] = useState(false);

  // Reset to the tapped item every time the modal opens. Without this the
  // viewer would otherwise remember the last lightbox position even after the
  // user swiped the card carousel to a new item.
  useEffect(() => {
    if (visible) {
      setActiveIndex(initialIndex);
      setCurrentZoomed(false);
    }
  }, [visible, initialIndex]);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (winW === 0) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / winW);
    if (i !== activeIndex && i >= 0 && i < media.length) setActiveIndex(i);
  };

  // Prefetch the immediate neighbours at full resolution so swiping inside the
  // lightbox doesn't wait on a fresh download for the next photo. Videos are
  // skipped — expo-video streams them on demand.
  useEffect(() => {
    if (!visible || media.length <= 1) return;
    const urls = [media[activeIndex + 1], media[activeIndex - 1]]
      .filter((m): m is MediaItem => !!m && m.kind === 'image')
      .map((m) => m.uri);
    if (urls.length) {
      Image.prefetch(urls, { cachePolicy: 'memory-disk' }).catch((e) => {
        if (__DEV__) console.warn('Lightbox image prefetch failed:', e);
      });
    }
  }, [visible, activeIndex, media]);

  if (media.length === 0) return null;

  const activeIsVideo = media[activeIndex]?.kind === 'video';

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      {/* Mount the gallery only while the modal is visible so each open gets
          fresh ZoomableImage state (no leftover zoom from the previous open).
          The Modal renders in its own native view tree that the app-root
          GestureHandlerRootView does NOT cover, so the pinch/pan/double-tap
          gestures inside ZoomableImage only fire when we wrap the modal
          content in its own root here (most visibly broken on Android). */}
      {visible && (
        <GestureHandlerRootView style={lb.root}>
          <FlatList
            ref={listRef}
            data={media}
            keyExtractor={(it, i) => `${i}-${it.uri}`}
            // Re-render rows when the active page changes so each LightboxVideo
            // receives the updated `isActive` — without this FlatList memoizes
            // the cells and a video keeps playing after you swipe / tap to
            // another page.
            extraData={activeIndex}
            horizontal
            pagingEnabled
            // Disable horizontal paging while an image is zoomed (so the pan
            // scrolls within it) and while a video is active (so drags reach
            // the native scrubber instead of flicking to the next page).
            scrollEnabled={!currentZoomed && !activeIsVideo}
            showsHorizontalScrollIndicator={false}
            bounces={false}
            decelerationRate="fast"
            initialScrollIndex={initialIndex}
            getItemLayout={(_, i) => ({ length: winW, offset: winW * i, index: i })}
            onMomentumScrollEnd={onMomentumEnd}
            renderItem={({ item, index: i }) =>
              item.kind === 'video' ? (
                <LightboxVideo
                  uri={item.uri}
                  width={winW}
                  height={winH}
                  isActive={visible && i === activeIndex}
                />
              ) : (
                <ZoomableImage
                  uri={item.uri}
                  width={winW}
                  height={winH}
                  onZoomedChange={setCurrentZoomed}
                />
              )
            }
          />

          {/* Left / right paging arrows — handy when paging is otherwise
              gated (e.g. while sitting on a video page). */}
          {media.length > 1 && !currentZoomed && (
            <>
              {activeIndex > 0 && (
                <Pressable
                  onPress={() => {
                    const next = activeIndex - 1;
                    setActiveIndex(next);
                    listRef.current?.scrollToOffset({ offset: next * winW, animated: true });
                  }}
                  hitSlop={10}
                  style={[lb.navBtn, { left: 12 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Previous"
                >
                  <Ionicons name="chevron-back" size={24} color="#fff" />
                </Pressable>
              )}
              {activeIndex < media.length - 1 && (
                <Pressable
                  onPress={() => {
                    const next = activeIndex + 1;
                    setActiveIndex(next);
                    listRef.current?.scrollToOffset({ offset: next * winW, animated: true });
                  }}
                  hitSlop={10}
                  style={[lb.navBtn, { right: 12 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Next"
                >
                  <Ionicons name="chevron-forward" size={24} color="#fff" />
                </Pressable>
              )}
            </>
          )}

          {/* Close (X) — top-right corner, safe-area-ish offset. */}
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={lb.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Close viewer"
          >
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>

          {/* Counter — bottom-centre, only when there's more than one item.
              Hidden while zoomed so it doesn't sit on top of the pan area. */}
          {media.length > 1 && !currentZoomed && (
            <View style={lb.counterWrap} pointerEvents="none">
              <Text style={lb.counterText}>
                {activeIndex + 1} / {media.length}
              </Text>
            </View>
          )}
        </GestureHandlerRootView>
      )}
    </Modal>
  );
}

/**
 * Pinch / pan / double-tap zoomable image used inside the lightbox.
 *
 * - Pinch:        scales the image between 1× and MAX_SCALE around the gesture's
 *                 focal point so the pinch tracks the user's fingers naturally.
 * - Pan:          only translates while zoomed; releases snap back if the
 *                 translation would expose the black background past the image
 *                 edge (basic clamping).
 * - Double tap:   toggles between 1× and DOUBLE_TAP_SCALE.
 *
 * Reports `onZoomedChange(true)` whenever scale crosses above 1 so the parent
 * FlatList can disable horizontal paging — otherwise a horizontal pan while
 * zoomed would advance to the next image instead of scrolling within this one.
 */
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;

function ZoomableImage({
  uri,
  width,
  height,
  onZoomedChange,
}: {
  uri: string;
  width: number;
  height: number;
  onZoomedChange: (zoomed: boolean) => void;
}) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  // Pinch focal point (image-local coords). We use these to keep the spot
  // under the user's fingers anchored as scale changes, like Photos.app.
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);

  const notifyZoom = (zoomed: boolean) => {
    onZoomedChange(zoomed);
  };

  const clampTranslation = (s: number) => {
    'worklet';
    // When the image is zoomed by `s`, the user can pan at most this many px
    // in each direction before the edge of the image meets the screen edge.
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
    runOnJS(notifyZoom)(false);
  };

  const pinch = Gesture.Pinch()
    .onStart((e) => {
      // Focal point relative to the centre of the image container, in screen
      // pixels. This is the geometric anchor: the image-local pixel currently
      // under the user's fingers stays put as the scale changes.
      focalX.value = e.focalX - width / 2;
      focalY.value = e.focalY - height / 2;
    })
    .onUpdate((e) => {
      // Allow scale to dip a hair below 1 during the gesture so the
      // pinch-to-shrink-back-to-fit feels rubbery; we snap to 1 on release.
      const next = Math.min(MAX_SCALE, Math.max(0.8, savedScale.value * e.scale));
      // Anchor formula — keep the image-local pixel under the focal point
      // stationary as scale goes from `savedScale` to `next`:
      //   tx' = fx − ((fx − savedTx) / savedScale) * next
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
        runOnJS(notifyZoom)(true);
      }
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
    // Only claim the touch when actually zoomed in. With manual activation we
    // decide per-drag whether to take over: at 1× we FAIL the pan so the
    // lightbox FlatList keeps its horizontal paging (swipe next/previous);
    // once zoomed we ACTIVATE so the drag pans within the image instead.
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
        runOnJS(notifyZoom)(true);
      }
    });

  // Race doubleTap against pinch/pan so a quick double-tap can't be eaten by
  // the pan recognizer's first touch-down.
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
            accessibilityLabel="Property photo, pinch to zoom"
            cachePolicy="memory-disk"
            recyclingKey={uri}
            transition={150}
          />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const lb = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  videoWrap: { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  navBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeBtn: {
    position: 'absolute',
    top: 44,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  counterWrap: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  counterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
  },
});

/**
 * Chevron tap target.
 *
 * Implemented with `react-native-gesture-handler`'s `Gesture.Tap()` instead of
 * `Pressable` or the JS responder system. The reason: on native iOS / Android,
 * `FlatList` uses a real native pan gesture recognizer (UIPanGestureRecognizer
 * on iOS, equivalent on Android). The JS responder system can't actually beat
 * a native recognizer once it engages, which is why Pressable / responder-
 * based attempts kept losing the tap to the underlying paging scroll.
 *
 * `react-native-gesture-handler` runs ITS gestures through the same native
 * recognizer pipeline the scroll uses, so the Tap can legitimately win the
 * gesture against the scroll pan when the touch starts inside the chevron's
 * 36×36 box. Works identically on Expo Go, APK / release builds, and RN Web.
 */
function ChevronButton({
  direction,
  top,
  onPress,
}: {
  direction: 'left' | 'right';
  top: number;
  onPress: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const [pressed, setPressed] = useState(false);
  const baseStyle =
    direction === 'left' ? styles.arrowLeft : styles.arrowRight;

  // Native gesture recognizer for a single quick tap.
  //   .maxDuration(500)         — finger-down longer than this isn't a tap
  //   .runOnJS(true)            — run callbacks on the JS thread directly
  //                               (no reanimated / worklets dependency).
  //   .onBegin / .onFinalize    — visual press-in / press-out state
  //   .onEnd(_, success)        — fire the action when a real tap is recognised
  const tap = Gesture.Tap()
    .runOnJS(true)
    .maxDuration(500)
    .onBegin(() => {
      setPressed(true);
    })
    .onEnd((_e, success) => {
      if (success) {
        onPress();
      }
    })
    .onFinalize(() => {
      setPressed(false);
    });

  return (
    <GestureDetector gesture={tap}>
      <View
        style={[baseStyle, { top }, pressed && { opacity: 0.75 }]}
        accessibilityRole="button"
        accessibilityLabel={
          direction === 'left' ? 'Previous image' : 'Next image'
        }
      >
        <Ionicons
          name={direction === 'left' ? 'chevron-back' : 'chevron-forward'}
          size={20}
          color="#fff"
        />
      </View>
    </GestureDetector>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  box: { width: '100%', position: 'relative', backgroundColor: colors.bgAlt },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  videoPage: { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  videoVeil: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.32)' },
  videoOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 10 },
  videoPlayRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlayBtn: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  videoOverlayText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  videoBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  videoBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  arrowLeft: {
    position: 'absolute',
    left: spacing.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    // Lift the chevron above the horizontal FlatList so its touch isn't
    // claimed by the underlying paging scroll (matters most when the
    // carousel is nested inside another scrollable list, e.g. the browse
    // listing cards). zIndex covers iOS / web; elevation covers Android.
    zIndex: 2,
    elevation: 2,
  },
  arrowRight: {
    position: 'absolute',
    right: spacing.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 2,
    elevation: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsRow: {
    position: 'absolute',
    bottom: spacing.sm,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  dotActive: {
    width: 18,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  counter: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  counterText: { ...typography.tiny, color: '#fff', fontWeight: '700' },
});
