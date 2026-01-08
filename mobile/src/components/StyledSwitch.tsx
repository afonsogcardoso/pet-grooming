import React from "react";
import { Switch as RNSwitch, SwitchProps } from "react-native";
import { useBrandingTheme } from "../theme/useBrandingTheme";

type Props = SwitchProps & { trackColor?: SwitchProps["trackColor"] };

export default function StyledSwitch(props: Props) {
  const { colors } = useBrandingTheme();
  const { trackColor, ...rest } = props;

  const defaultTrackColor = {
    false: colors.surfaceBorder,
    true: colors.switchTrack,
  };

  return <RNSwitch trackColor={trackColor ?? defaultTrackColor} {...rest} />;
}
