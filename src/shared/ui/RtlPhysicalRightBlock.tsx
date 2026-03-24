import React from 'react';
import { View } from 'react-native';

/** Pins Arabic lines to the physical right edge; avoids iOS mirroring of textAlign inside rtl parents. */
export function RtlPhysicalRightBlock({
  isRtl,
  children,
}: {
  isRtl: boolean;
  children: React.ReactNode;
}) {
  if (!isRtl) return <>{children}</>;
  return (
    <View style={{ alignSelf: 'stretch', direction: 'ltr', width: '100%' }}>{children}</View>
  );
}
