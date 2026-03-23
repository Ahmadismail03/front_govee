import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { TabsParamList } from './types';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
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

  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={({ route }) => ({
        headerStyle: {
          backgroundColor: colors.primary,
          elevation: 0,
          shadowOpacity: 0,
          height: 96,
        },
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
          elevation: 8,
          shadowOpacity: 0.08,
          height: 62,
          paddingTop: 6,
          paddingBottom: 6,
        },
        sceneStyle: {
          backgroundColor: colors.background,
        },
        tabBarIcon: ({ color, size, focused }) => {
          if (route.name === 'HomeTab') {
            const name: IoniconName = focused ? 'home' : 'home-outline';
            return <Ionicons name={name} size={size} color={color} />;
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
          return <Ionicons name={name} size={size} color={color} />;
        },
        // Flipped as requested: title+menu on the left, logo on the right.
        headerLeft: () => (
          <View style={styles.headerRightCluster}>
            <HeaderMenuButton />
            <Text style={[styles.headerRightTitle, { color: colors.headerText }]}>
              {route.name === 'HomeTab'
                ? t('tabs.home')
                : route.name === 'ServicesTab'
                  ? t('tabs.services')
                  : route.name === 'AppointmentsTab'
                    ? t('tabs.appointments')
                    : route.name === 'InboxTab'
                      ? t('tabs.voice')
                      : t('tabs.profile')}
            </Text>
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
