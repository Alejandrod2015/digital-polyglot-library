import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  type ImageResizeMode,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from "react-native";

// Module-level cache: tracks URIs that have already been loaded this session.
// When a component remounts with a known URI, we skip the skeleton animation entirely.
const loadedUriCache = new Set<string>();

type Props = {
  uri: string;
  style: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
  skeletonStyle?: StyleProp<ViewStyle>;
  // Bubbled up so callers (e.g. the reader) can swap to a fallback URL when
  // a local file:// cached copy turns out to be missing / corrupt.
  onError?: () => void;
};

export function ProgressiveImage({ uri, style, resizeMode = "cover", skeletonStyle, onError }: Props) {
  const alreadyLoaded = loadedUriCache.has(uri);
  const imageOpacity = useRef(new Animated.Value(alreadyLoaded ? 1 : 0)).current;
  const skeletonOpacity = useRef(new Animated.Value(alreadyLoaded ? 0 : 0.55)).current;
  const [loaded, setLoaded] = useState(alreadyLoaded);
  const [showSkeleton, setShowSkeleton] = useState(!alreadyLoaded);

  const flattenedStyle = useMemo(() => StyleSheet.flatten(style) ?? {}, [style]);
  const wrapperStyle = useMemo(
    () => [
      flattenedStyle,
      styles.wrapper,
      flattenedStyle.borderRadius ? { borderRadius: flattenedStyle.borderRadius } : null,
    ],
    [flattenedStyle]
  );

  useEffect(() => {
    if (loadedUriCache.has(uri)) {
      setLoaded(true);
      setShowSkeleton(false);
      imageOpacity.setValue(1);
      skeletonOpacity.setValue(0);
    } else {
      setLoaded(false);
      setShowSkeleton(true);
      imageOpacity.setValue(0);
      skeletonOpacity.setValue(0.55);
    }
  }, [uri, imageOpacity, skeletonOpacity]);

  useEffect(() => {
    if (!showSkeleton) return undefined;

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(skeletonOpacity, {
          toValue: 0.82,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(skeletonOpacity, {
          toValue: 0.42,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    pulse.start();

    return () => {
      pulse.stop();
    };
  }, [showSkeleton, skeletonOpacity]);

  function finishLoad() {
    if (loaded) return;
    loadedUriCache.add(uri);
    setLoaded(true);

    Animated.parallel([
      Animated.timing(imageOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(skeletonOpacity, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setShowSkeleton(false);
      }
    });
  }

  return (
    <View style={wrapperStyle}>
      {showSkeleton ? (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            styles.skeleton,
            skeletonStyle,
            { opacity: skeletonOpacity },
          ]}
        />
      ) : null}
      <Animated.Image
        source={{ uri }}
        resizeMode={resizeMode}
        onLoad={finishLoad}
        onError={() => {
          finishLoad();
          onError?.();
        }}
        style={[StyleSheet.absoluteFillObject, { opacity: imageOpacity }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: "hidden",
    backgroundColor: "#102238",
  },
  skeleton: {
    backgroundColor: "#213753",
  },
});
