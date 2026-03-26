import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets, Edge } from 'react-native-safe-area-context';
import { spacing } from '../theme/tokens';
import { useThemeColors } from '../theme/useTheme';
import { useRtl } from '../../core/i18n/useRtl';

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  keyboardAvoiding?: boolean;
  edges?: readonly Edge[];
};

export function Screen({ children, scroll, keyboardAvoiding, edges = ['left', 'right', 'bottom'] }: Props) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { isRtl } = useRtl();

  const keyboardVerticalOffset = insets.top;
  // SafeAreaView handles the bottom inset via edges; remove extra spacing to sit flush.
  const bottomPad = 0;

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
          backgroundColor: colors.background,
        },
        watermark: {
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 450,
          height: 450,
          marginLeft: -225,
          marginTop: -225,
          opacity: 0.04,
          zIndex: 0,
        },
        content: {
          flex: 1,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: bottomPad,
          gap: spacing.lg,
          zIndex: 1,
        },
        scrollContent: {
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: bottomPad,
          gap: spacing.lg,
        },
      }),
    [colors, bottomPad]
  );

  // On iOS, createNativeStackNavigator wraps each screen in a native
  // UIViewController that blocks direction:rtl from propagating down from
  // the RootNavigator wrapper View. Apply it explicitly at EVERY level here
  // (SafeAreaView + inner content View / ScrollView) so Arabic layout is
  // correctly right-to-left on iOS — matching Android behaviour.
  const iosRtlStyle = Platform.OS === 'ios' ? { direction: isRtl ? 'rtl' : 'ltr' } as const : undefined;

  const shouldScroll = Boolean(scroll || keyboardAvoiding);

  const content = shouldScroll ? (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, { flexGrow: 1 }, iosRtlStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'on-drag' : 'none'}
      automaticallyAdjustKeyboardInsets={keyboardAvoiding ? false : undefined}
      contentInsetAdjustmentBehavior={Platform.OS === 'ios' ? 'automatic' : undefined}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, iosRtlStyle]}>{children}</View>
  );

  if (!keyboardAvoiding) {
    return (
      <SafeAreaView style={[styles.root, iosRtlStyle]} edges={edges}>
        <Image 
          source={require('../../../assets/logo.png')} 
          style={styles.watermark} 
          resizeMode="contain"
        />
        {content}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, iosRtlStyle]} edges={edges}>
      <Image 
        source={require('../../../assets/logo.png')} 
        style={styles.watermark} 
        resizeMode="contain"
      />
      <KeyboardAvoidingView
        style={styles.root}
        behavior="position"
        contentContainerStyle={styles.root}
        keyboardVerticalOffset={keyboardVerticalOffset - 5}
      >
        {content}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
