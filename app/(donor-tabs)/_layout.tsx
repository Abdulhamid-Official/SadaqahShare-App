import React, { useEffect, useRef } from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet, Platform, View, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { House, Landmark, Heart, User, MessageSquare, Bell } from 'lucide-react-native';
import { Colors, FontSize, Spacing, useTheme } from '@/lib/theme';
import { useAppContext } from '@/lib/context';
import { useNotifications } from '@/lib/notifications-context';

const TAB_ITEMS = [
  { name: 'index', label: 'Home', Icon: House },
  { name: 'mosques', label: 'Mosques', Icon: Landmark },
  { name: 'donations', label: 'Donations', Icon: Heart },
  { name: 'requests', label: 'Suggested', Icon: MessageSquare },
  { name: 'profile', label: 'Profile', Icon: User },
] as const;

export default function DonorTabsLayout() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();
  const { role, authLoading, session } = useAppContext();
  const { unreadCount } = useNotifications();
  const redirected = useRef(false);

  useEffect(() => {
    if (!authLoading && (!session?.user || role !== 'donor')) {
      if (!redirected.current) {
        redirected.current = true;
        router.replace('/');
      }
    } else if (session?.user && role === 'donor') {
      redirected.current = false;
      if (session.profile && (!session.profile.terms_accepted || !session.profile.privacy_accepted)) {
        router.replace('/consent' as any);
      }
    }
  }, [authLoading, session, role, router]);

  if (authLoading || !session?.user || role !== 'donor') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.stone400,
        tabBarStyle: {
          backgroundColor: colors.cardBg,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.cardBorder,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: Spacing.sm,
          ...Platform.select({
            ios: {
              shadowColor: Colors.black,
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
            },
            android: { elevation: 8 },
          }),
        },
        tabBarLabelStyle: {
          fontFamily: 'Inter-SemiBold',
          fontSize: 11,
          marginTop: 2,
        },
        tabBarIconStyle: { marginBottom: -2 },
      }}
    >
      {TAB_ITEMS.map(({ name, label, Icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: label,
            tabBarIcon: ({ color, focused }) => (
              <Icon size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
            ),
          }}
        />
      ))}
      {/* Hidden notification tab — navigated to via header bell icon */}
      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
          tabBarItemStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="impact"
        options={{
          href: null,
          tabBarItemStyle: { display: 'none' },
        }}
      />
    </Tabs>
  );
}
