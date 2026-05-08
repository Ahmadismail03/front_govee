import React from 'react';
import { View, StyleSheet, Text, Animated } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { TabsParamList } from './types';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeScreen } from '../features/home/screens/HomeScreen';
import { ServicesListScreen } from '../features/services/screens/ServicesListScreen';
import { AppointmentsListScreen } from '../features/appointments/screens/AppointmentsListScreen';
import { useThemeColors } from '../shared/theme/useTheme';
import { spacing, typography } from '../shared/theme/tokens';
import { RequireAuth } from './RequireAuth';
import { HeaderMenuButton } from '../shared/ui/HeaderMenu';
import { HeaderLogo } from '../shared/ui/HeaderLogo';
import { ProfileScreen } from '../features/profile/screens/ProfileScreen';
import { useVoiceStore } from '../features/voice/store/useVoiceStore';

const Tab = createBottomTabNavigator<TabsParamList>();

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function AnimatedTabIcon({ name, size, color, focused }: { name: IoniconName; size: number; color: string; focused: boolean }) {
  const scale = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (!focused) {
      scale.setValue(1);
      return;
    }
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.18, duration: 110, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 140, useNativeDriver: true }),
    ]).start();
  }, [focused, scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Ionicons name={name} size={size} color={color} />
    </Animated.View>
  );
}

function VoiceTabScreen() {
  const setIsOpen = useVoiceStore((s) => s.setIsOpen);

  useFocusEffect(
    React.useCallback(() => {
      setIsOpen(true);
      return undefined;
    }, [setIsOpen])
  );

  return null;
}

export function MainTabs() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const setVoiceOpen = useVoiceStore((s) => s.setIsOpen);
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={({ route }) => ({
        headerStyle: {
          backgroundColor: colors.primary,
          elevation: 0,
          shadowOpacity: 0,
          // No hardcoded height — React Navigation v7 calculates the correct
          // total height as (platform default + headerStatusBarHeight) automatically.
        },
        // Explicitly pass the top inset so the header content is always
        // positioned below the status bar on every device / OS version.
        // With edgeToEdgeEnabled:true this equals the real status-bar height.
        headerStatusBarHeight: insets.top,
        headerShadowVisible: false,
        headerLeftContainerStyle: {
          paddingStart: spacing.xs,
        },
        headerRightContainerStyle: {
          paddingEnd: spacing.xs,
        },
        headerTintColor: colors.headerText,
        headerTitleStyle: {
          fontWeight: '700',
        },
        // We render a custom title block on the right side for Arabic,
        // so the default centered title must be hidden.
        headerTitle: () => null,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          elevation: 0,
          shadowOpacity: 0,
          shadowRadius: 0,
          shadowOffset: { width: 0, height: 0 },
          height: 56 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(6, insets.bottom),
        },
        sceneStyle: {
          backgroundColor: colors.background,
        },
        tabBarIcon: ({ color, size, focused }) => {
          if (route.name === 'HomeTab') {
            const name: IoniconName = focused ? 'home' : 'home-outline';
            return <AnimatedTabIcon name={name} size={size} color={color} focused={focused} />;
          }

          let name: IoniconName;
          if (route.name === 'ServicesTab') {
            name = 'grid-outline';
          } else if (route.name === 'AppointmentsTab') {
            name = 'calendar-outline';
          } else if (route.name === 'InboxTab') {
            name = focused ? 'mic' : 'mic-outline';
          } else {
            name = 'person-outline';
          }
          return <AnimatedTabIcon name={name} size={size} color={color} focused={focused} />;
        },
        // Flipped as requested: title+menu on the left, logo on the right.
        headerLeft: () => (
          <View style={styles.headerRightCluster}>
            <HeaderMenuButton />
            {route.name !== 'AppointmentsTab' ? (
              <Text style={[styles.headerRightTitle, { color: colors.headerText }]}>
                {route.name === 'HomeTab'
                  ? t('tabs.home')
                  : route.name === 'ServicesTab'
                    ? t('tabs.services')
                    : route.name === 'InboxTab'
                      ? t('tabs.voice')
                      : t('tabs.profile')}
              </Text>
            ) : null}
          </View>
        ),
        headerRight: () => (
          <View style={styles.headerLogoSide}>
            <HeaderLogo />
          </View>
        ),
      })}
    >
      <Tab.Screen name="ServicesTab" component={ServicesListScreen} options={{ title: t('tabs.services') }} />

      <Tab.Screen name="AppointmentsTab" options={{ title: t('tabs.appointments') }}>
        {(props) => (
          <RequireAuth
            navigation={props.navigation}
            redirect={{ screen: 'MainTabs', params: { screen: 'AppointmentsTab' } }}
            authOpenMode="parentNavigate"
          >
            <AppointmentsListScreen {...props} />
          </RequireAuth>
        )}
      </Tab.Screen>

      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          title: t('tabs.home'),
        }}
      />

      <Tab.Screen
        name="InboxTab"
        options={{ title: t('tabs.voice') }}
        listeners={() => ({
          tabPress: (e) => {
            e.preventDefault();
            setVoiceOpen(true);
          },
        })}
      >
        {() => <VoiceTabScreen />}
      </Tab.Screen>

      <Tab.Screen name="ProfileTab" options={{ title: t('tabs.profile') }}>
        {(props) => (
          <RequireAuth
            navigation={props.navigation}
            redirect={{ screen: 'MainTabs', params: { screen: 'ProfileTab' } }}
            authOpenMode="parentNavigate"
          >
            <ProfileScreen {...props} />
          </RequireAuth>
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  headerLogoSide: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 0,
  },
  headerRightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginHorizontal: 0,
  },
  headerRightTitle: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
