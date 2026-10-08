import React from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LayoutDashboard,
  Package,
  Heart,
  Users,
  MessageSquare,
  Settings,
  Megaphone,
} from 'lucide-react-native';
import { Colors, Spacing, useTheme } from '@/lib/theme';

const TAB_ITEMS = [
  { name: 'index', label: 'Dashboard', Icon: LayoutDashboard },
  { name: 'needs', label: 'Needs', Icon: Package },
  { name: 'pledges', label: 'Pledges', Icon: Heart },
  { name: 'members', label: 'Members', Icon: Users },
  { name: 'requests', label: 'Requests', Icon: MessageSquare },
  { name: 'settings', label: 'More', Icon: Settings },
] as const;

export default function MosqueTabsLayout() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.teal,
        tabBarInactiveTintColor: colors.stone400,
        tabBarStyle: {
          backgroundColor: colors.tabBarBg,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.tabBarBorder,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: Spacing.xs,
          ...Platform.select({
            ios: {
              shadowColor: Colors.black,
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
            },
            android: {
              elevation: 8,
            },
          }),
        },
        tabBarLabelStyle: {
          fontFamily: 'Inter-SemiBold',
          fontSize: 10,
          marginTop: 1,
        },
        tabBarIconStyle: {
          marginBottom: -2,
        },
      }}
    >
      {TAB_ITEMS.map(({ name, label, Icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: label,
            tabBarIcon: ({ color, focused }) => (
              <Icon
                size={20}
                color={color}
                strokeWidth={focused ? 2.5 : 2}
              />
            ),
          }}
        />
      ))}
      <Tabs.Screen name="polls" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="announcements" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="join-code" options={{ href: null, headerShown: false }} />
    </Tabs>
  );
}
