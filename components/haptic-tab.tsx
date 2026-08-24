import { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { PlatformPressable } from "@react-navigation/elements";
import * as Haptics from "expo-haptics";

export function HapticTab(props: BottomTabBarButtonProps) {
  return (
    <PlatformPressable
      {...props}
      onPress={(ev) => {
        if (process.env.EXPO_OS === "ios") {
          // Give tab changes a light response while explicitly preserving navigation.
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPress?.(ev);
      }}
      onPressIn={(ev) => props.onPressIn?.(ev)}
    />
  );
}
