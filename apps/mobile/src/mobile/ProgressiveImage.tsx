import { useMemo } from "react";
import { StyleSheet, View, type ImageResizeMode, type ImageStyle, type StyleProp, type ViewStyle } from "react-native";
import { Image, type ImageContentFit } from "expo-image";

// Backed by expo-image: persistent memory+disk cache (covers survive cold
// starts and load instantly the second time) plus a ThumbHash placeholder so a
// card renders an instant blurred preview of the real cover on first paint,
// with zero network wait. Replaces the previous RN core <Image> + manual
// skeleton, which had no durable disk cache and re-downloaded every cold start.

type Props = {
  uri: string;
  style: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
  skeletonStyle?: StyleProp<ViewStyle>;
  /** Base64 ThumbHash from the API payload. When present, shown as an instant
   *  blurred placeholder of the real cover while the full image loads. */
  thumbhash?: string | null;
  // Bubbled up so callers (e.g. the reader) can swap to a fallback URL when
  // a local file:// cached copy turns out to be missing / corrupt.
  onError?: () => void;
};

function toContentFit(resizeMode: ImageResizeMode): ImageContentFit {
  switch (resizeMode) {
    case "contain":
      return "contain";
    case "stretch":
      return "fill";
    case "center":
      return "none";
    default:
      return "cover";
  }
}

export function ProgressiveImage({ uri, style, resizeMode = "cover", skeletonStyle, thumbhash, onError }: Props) {
  const flattenedStyle = useMemo(() => StyleSheet.flatten(style) ?? {}, [style]);
  const wrapperStyle = useMemo(
    () => [
      flattenedStyle,
      styles.wrapper,
      flattenedStyle.borderRadius ? { borderRadius: flattenedStyle.borderRadius } : null,
    ],
    [flattenedStyle]
  );

  return (
    <View style={[wrapperStyle, skeletonStyle]}>
      <Image
        source={{ uri }}
        placeholder={thumbhash ? { thumbhash } : undefined}
        contentFit={toContentFit(resizeMode)}
        cachePolicy="memory-disk"
        transition={220}
        onError={onError}
        style={StyleSheet.absoluteFillObject}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: "hidden",
    // Shown behind the image before the (thumbhash) placeholder / image paint.
    backgroundColor: "#102238",
  },
});
