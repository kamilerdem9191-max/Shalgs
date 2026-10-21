import "react-native-reanimated";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { LogBox, Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { StatusBar } from "expo-status-bar";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { LoadingView } from "@/src/components/ui";
import { WebFrame } from "@/src/components/web-frame";
import { AuthProvider, useAuth } from "@/src/context/auth";
import { ToastProvider } from "@/src/context/toast";
import { queryClient } from "@/src/query-client";
import { useTheme } from "@/src/theme";

LogBox.ignoreAllLogs(true);

function RootNavigator() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { colors, scheme } = useTheme();

  useEffect(() => {
    if (loading) return;
    const seg0 = segments[0];
    const inAuth = seg0 === "(auth)";

    if (!user) {
      if (!inAuth) router.replace("/(auth)/landing" as any);
      return;
    }
    if (!user.role) {
      if (segments[1] !== "complete-profile") router.replace("/(auth)/complete-profile" as any);
      return;
    }
    if (user.role === "student" && seg0 !== "(student)") {
      router.replace("/(student)" as any);
    } else if (user.role === "coach" && seg0 !== "(coach)") {
      router.replace("/(coach)/(tabs)" as any);
    } else if (user.role === "parent" && seg0 !== "(parent)") {
      router.replace("/(parent)/(tabs)" as any);
    }
  }, [user, loading, segments, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <LoadingView />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }} />
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.title = "Sha";
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
              <AuthProvider>
                <WebFrame>
                  <BottomSheetModalProvider>
                    <ToastProvider>
                      <RootNavigator />
                    </ToastProvider>
                  </BottomSheetModalProvider>
                </WebFrame>
              </AuthProvider>
            </QueryClientProvider>
          </ErrorBoundary>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
