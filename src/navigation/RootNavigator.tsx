import React, { useCallback } from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from './types';
import { MainTabs } from './TabsNavigator';
import { ServiceDetailsScreen } from '../features/services/screens/ServiceDetailsScreen';
import { AuthStartScreen } from '../features/auth/screens/AuthStartScreen';
import { AuthOtpScreen } from '../features/auth/screens/AuthOtpScreen';
import { AuthRegisterScreen } from '../features/auth/screens/AuthRegisterScreen';
import { BookingSelectDateScreen } from '../features/booking/screens/BookingSelectDateScreen';
import { BookingSelectSlotScreen } from '../features/booking/screens/BookingSelectSlotScreen';
import { BookingConfirmScreen } from '../features/booking/screens/BookingConfirmScreen';
import { BookingSuccessScreen } from '../features/booking/screens/BookingSuccessScreen';
import { AppointmentDetailsScreen } from '../features/appointments/screens/AppointmentDetailsScreen';
import { AppointmentCancelConfirmScreen } from '../features/appointments/screens/AppointmentCancelConfirmScreen';
import { AppointmentRescheduleSelectDateScreen } from '../features/appointments/screens/AppointmentRescheduleSelectDateScreen';
import { AppointmentRescheduleSelectSlotScreen } from '../features/appointments/screens/AppointmentRescheduleSelectSlotScreen';
import { AppointmentRescheduleConfirmScreen } from '../features/appointments/screens/AppointmentRescheduleConfirmScreen';
import { HelpCenterScreen } from '../features/help/screens/HelpCenterScreen';
import { HelpTopicDetailsScreen } from '../features/help/screens/HelpTopicDetailsScreen';
import { RequireAuth } from './RequireAuth';
import { useThemeColors } from '../shared/theme/useTheme';
import { HeaderMenuButton } from '../shared/ui/HeaderMenu';
import { HeaderLogo } from '../shared/ui/HeaderLogo';
import { HeaderTitle } from '../shared/ui/HeaderTitle';
import { RtlStackHeaderRight } from '../shared/ui/RtlStackHeaderRight';
import { ContactUsScreen } from '../features/support/screens/ContactUsScreen';
import { TechnicalSupportScreen } from '../features/support/screens/TechnicalSupportScreen';
import { ReportProblemScreen } from '../features/support/screens/ReportProblemScreen';
import { SettingsScreen } from '../features/settings/screens/SettingsScreen';
import { ProfileEditScreen } from '../features/profile/screens/ProfileEditScreen';
import { VoiceAssistantSheet } from '../features/voice/components/VoiceAssistantSheet';
import { useVoiceStore } from '../features/voice/store/useVoiceStore';
import { useAuthStore } from '../features/auth/store/useAuthStore';
import { useRtl } from '../core/i18n/useRtl';
import { spacing } from '../shared/theme/tokens';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const colors = useThemeColors();
  const { isRtl: rtl } = useRtl();
  const insets = useSafeAreaInsets();

  // ── Reopen voice sheet after successful OTP auth ────────────────────────
  const authStatus = useAuthStore((s) => s.authStatus);
  const pendingReopenAfterAuth = useVoiceStore((s) => s.pendingReopenAfterAuth);
  const setPendingReopenAfterAuth = useVoiceStore((s) => s.setPendingReopenAfterAuth);
  const setVoiceIsOpen = useVoiceStore((s) => s.setIsOpen);

  React.useEffect(() => {
    if (authStatus === 'authenticated' && pendingReopenAfterAuth) {
      console.log('✅ Auth completed with voice pending — reopening voice sheet');
      setPendingReopenAfterAuth(false);
      // Small delay so navigation stack settles before the modal opens
      setTimeout(() => setVoiceIsOpen(true), 100);
    }
  }, [authStatus, pendingReopenAfterAuth]);

  // Debug navigation ref — intentionally empty dep array: ref.current is mutable
  // and must NOT be used as a useEffect dependency (causes infinite snapshot loop).
  React.useEffect(() => {
    console.log("🧭 Navigation ref ready:", !!navigationRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <NavigationContainer key={`root-nav-${rtl ? 'rtl' : 'ltr'}`} ref={navigationRef}>
      <View style={[styles.root, { direction: rtl ? 'rtl' : 'ltr' }]}>
        <Stack.Navigator
          screenOptions={({ route }) => {
            const isMainTabs = route.name === 'MainTabs';
            return {
              headerStyle: {
                backgroundColor: colors.primary,
                // No hardcoded height — React Navigation v7 owns the calculation.
              } as any,
              // Explicit top inset so every stack screen positions its header
              // content below the status bar / notch on all devices.
              headerStatusBarHeight: insets.top,
              headerTintColor: colors.headerText,
              headerTitleStyle: {
                fontWeight: '700',
                marginTop: 0,
              } as any,
              headerTitleAlign: rtl && !isMainTabs ? 'left' : 'center',
              headerBackTitleVisible: false,
              // RTL sub-screens: hide the native iOS back button (which always
              // points ← in iOS Expo Go because forceRTL doesn't persist there).
              // Title + RtlStackHeaderRight (chevron) live in headerRight so Arabic
              // stays visible on Android; LTR keeps centered HeaderTitle + native back.
              headerBackVisible: !(rtl && !isMainTabs),
              headerTitle:
                rtl && !isMainTabs
                  ? () => null
                  : ({ children }) => (
                      <HeaderTitle title={typeof children === 'string' ? children : undefined} />
                    ),
              headerRightContainerStyle:
                rtl && !isMainTabs
                  ? {
                      paddingEnd: spacing.xs,
                      maxWidth: '78%',
                    }
                  : undefined,
              // Main tabs: logo + menu on the left.
              // Sub-screens LTR: undefined → native default back arrow (left).
              // Sub-screens RTL: title + back chevron in headerRight (reading order).
              headerLeft: isMainTabs
                ? () => (
                    <View style={styles.headerRight}>
                      <HeaderLogo />
                      <HeaderMenuButton />
                    </View>
                  )
                : undefined,
              headerRight: isMainTabs
                ? () => null
                : rtl
                ? () => <RtlStackHeaderRight />
                : undefined,
            };
          }}
        >
          <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen name="ServiceDetails" component={ServiceDetailsScreen} />
          <Stack.Screen
            name="ProfileEdit"
            component={ProfileEditScreen}
            options={{
              presentation: 'modal',
              headerTitleStyle: { fontWeight: '700', marginTop: 0 } as any,
            }}
          />
          <Stack.Screen
            name="ContactUs"
            component={ContactUsScreen}
            options={{ headerTitleStyle: { fontWeight: '700', marginTop: 0 } as any }}
          />
          <Stack.Screen
            name="TechnicalSupport"
            component={TechnicalSupportScreen}
            options={{ headerTitleStyle: { fontWeight: '700', marginTop: 0 } as any }}
          />
          <Stack.Screen
            name="ReportProblem"
            component={ReportProblemScreen}
            options={{ headerTitleStyle: { fontWeight: '700', marginTop: 0 } as any }}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ headerTitleStyle: { fontWeight: '700', marginTop: 0 } as any }}
          />

          <Stack.Screen
            name="AuthStart"
            component={AuthStartScreen}
            options={{
              presentation: 'modal',
              headerTitle: () => null,
              // Auth start keeps logo at left and menu button at right.
              headerLeft: () => (
                <View style={styles.headerRight}>
                  <HeaderLogo />
                </View>
              ),
              headerRight: () => (
                <View style={styles.headerRight}>
                  <HeaderMenuButton dropdownEdge="trailing" modalStackHeader />
                </View>
              ),
            }}
          />
          <Stack.Screen
            name="AuthRegister"
            component={AuthRegisterScreen}
            options={{
              presentation: 'modal',
              headerTitle: () => null,
              headerLeft: () => (
                <View style={styles.headerRight}>
                  <HeaderLogo />
                </View>
              ),
              headerRight: () => (
                <View style={styles.headerRight}>
                  <HeaderMenuButton dropdownEdge="trailing" modalStackHeader />
                </View>
              ),
            }}
          />
          <Stack.Screen name="AuthOtp" component={AuthOtpScreen} options={{ presentation: 'modal' }} />

          <Stack.Screen name="BookingSelectDate">
            {(props) => (
              <RequireAuth
                navigation={props.navigation}
                redirect={{ screen: 'BookingSelectDate', params: props.route.params }}
              >
                <BookingSelectDateScreen {...props} />
              </RequireAuth>
            )}
          </Stack.Screen>
          <Stack.Screen name="BookingSelectSlot">
            {(props) => (
              <RequireAuth
                navigation={props.navigation}
                redirect={{ screen: 'BookingSelectSlot', params: props.route.params }}
              >
                <BookingSelectSlotScreen {...props} />
              </RequireAuth>
            )}
          </Stack.Screen>
          <Stack.Screen name="BookingConfirm">
            {(props) => (
              <RequireAuth
                navigation={props.navigation}
                redirect={{ screen: 'BookingConfirm', params: props.route.params }}
              >
                <BookingConfirmScreen {...props} />
              </RequireAuth>
            )}
          </Stack.Screen>
          <Stack.Screen
            name="BookingSuccess"
            component={BookingSuccessScreen}
            options={{
              title: '',
              headerBackVisible: false,
              gestureEnabled: false,
              headerLeft: () => null,
              headerRight: () => null,
            }}
          />

          <Stack.Screen name="AppointmentDetails">
            {(props) => (
              <RequireAuth
                navigation={props.navigation}
                redirect={{ screen: 'AppointmentDetails', params: props.route.params }}
              >
                <AppointmentDetailsScreen {...props} />
              </RequireAuth>
            )}
          </Stack.Screen>

          <Stack.Screen name="AppointmentCancelConfirm" options={{ presentation: 'modal' }}>
            {(props) => (
              <RequireAuth
                navigation={props.navigation}
                redirect={{ screen: 'AppointmentCancelConfirm', params: props.route.params }}
              >
                <AppointmentCancelConfirmScreen {...props} />
              </RequireAuth>
            )}
          </Stack.Screen>
          <Stack.Screen name="AppointmentRescheduleSelectDate">
            {(props) => (
              <RequireAuth
                navigation={props.navigation}
                redirect={{
                  screen: 'AppointmentRescheduleSelectDate',
                  params: props.route.params,
                }}
              >
                <AppointmentRescheduleSelectDateScreen {...props} />
              </RequireAuth>
            )}
          </Stack.Screen>
          <Stack.Screen name="AppointmentRescheduleSelectSlot">
            {(props) => (
              <RequireAuth
                navigation={props.navigation}
                redirect={{
                  screen: 'AppointmentRescheduleSelectSlot',
                  params: props.route.params,
                }}
              >
                <AppointmentRescheduleSelectSlotScreen {...props} />
              </RequireAuth>
            )}
          </Stack.Screen>
          <Stack.Screen name="AppointmentRescheduleConfirm">
            {(props) => (
              <RequireAuth
                navigation={props.navigation}
                redirect={{
                  screen: 'AppointmentRescheduleConfirm',
                  params: props.route.params,
                }}
              >
                <AppointmentRescheduleConfirmScreen {...props} />
              </RequireAuth>
            )}
          </Stack.Screen>

          <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
          <Stack.Screen name="HelpTopicDetails" component={HelpTopicDetailsScreen} />
        </Stack.Navigator>

        <VoiceAssistantSheet onNavigate={useCallback((screen: string, params?: any) => {
          if (navigationRef.current) {
            try {
              (navigationRef.current as any).navigate(screen, params);
            } catch (error) {
              console.warn("❌ Navigation failed:", error);
            }
          }
        }, [])} />
      </View>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // direction is set dynamically via inline style (rtl ? 'rtl' : 'ltr').
    // This is the Yoga-level RTL that works even in Expo Go where
    // I18nManager.forceRTL() doesn't persist across JS-only reloads.
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
