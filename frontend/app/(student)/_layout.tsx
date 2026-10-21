import { useQuery } from "@tanstack/react-query";
import { Tabs } from "expo-router";
import {
  ChartBar,
  ChatCircleText,
  House,
  NotePencil,
  User,
} from "phosphor-react-native";
import { Platform } from "react-native";

import { apiGet } from "@/src/api/client";
import { useTheme } from "@/src/theme";

export default function StudentLayout() {
  const { colors } = useTheme();

  const { data: unread } = useQuery({
    queryKey: ["unread-count"],
    queryFn: () => apiGet("/comments/unread-count"),
    refetchInterval: 20000,
  });
  const unreadCount = unread?.count ?? 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surfaceSecondary,
          borderTopColor: colors.border,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Ana Sayfa",
          tabBarIcon: ({ color, focused }) => (
            <House size={24} color={color} weight={focused ? "fill" : "regular"} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "Çalışmalarım",
          tabBarIcon: ({ color, focused }) => (
            <NotePencil size={24} color={color} weight={focused ? "fill" : "regular"} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: "İstatistik",
          tabBarIcon: ({ color, focused }) => (
            <ChartBar size={24} color={color} weight={focused ? "fill" : "regular"} />
          ),
        }}
      />
      <Tabs.Screen
        name="coach"
        options={{
          title: "Koçum",
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.error, color: colors.onError, fontSize: 10 },
          tabBarIcon: ({ color, focused }) => (
            <ChatCircleText size={24} color={color} weight={focused ? "fill" : "regular"} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, focused }) => (
            <User size={24} color={color} weight={focused ? "fill" : "regular"} />
          ),
        }}
      />
    </Tabs>
  );
}
