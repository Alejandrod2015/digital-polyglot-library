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

type Props = {
  uri: string;
  style: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
  skeletonStyle?: StyleProp<ViewStyle>;
};

export function ProgressiveImage({ uri, style, resizeMode = "cover", skeletonStyle }: Props) {
  const imageOpacity = useRef(new Animated.Value(0)).current;
  const skeletonOpacity = useRef(new Animated.Value(0.55)).current;
  const [loaded, setLoaded] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(true);

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
    setLoaded(false);
    setShowSkeleton(true);
    imageOpacity.setValue(0);
  }, [uri, imageOpacity]);

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
        onError={finishLoad}
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
