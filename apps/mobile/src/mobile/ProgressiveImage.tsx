import { useMemo } from "react";
import { StyleSheet, type ImageStyle, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";

type Props = {
  uri: string;
  style: StyleProp<ImageStyle>;
  resizeMode?: "cover" | "contain" | "center" | "stretch";
  skeletonStyle?: StyleProp<ViewStyle>;
};

export function ProgressiveImage({ uri, style, resizeMode = "cover" }: Props) {
  const flattenedStyle = useMemo(() => StyleSheet.flatten(style) ?? {}, [style]);

  return (
    <Image
      source={{ uri }}
      style={[flattenedStyle, styles.base]}
      contentFit={resizeMode}
      transition={220}
      cachePolicy="disk"
      recyclingKey={uri}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: "#102238",
  },
});
