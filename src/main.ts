import { createApp, watch } from "vue";
import { Capacitor } from "@capacitor/core";
import "@fontsource-variable/geist/wght.css";
import App from "./App.vue";
import "./styles/tokens.css";
import { useTheme } from "./composables/useTheme";

createApp(App).mount("#app");

// Native (iOS) only: the in-app theme toggle can diverge from the OS
// appearance, so drive the status bar text colour from the resolved theme —
// otherwise the clock/battery go low-contrast on the midnight background.
if (Capacitor.isNativePlatform()) {
  void import("@capacitor/status-bar").then(({ StatusBar, Style }) => {
    const { isDark } = useTheme();
    watch(
      isDark,
      (dark) => {
        // Style.Dark = light text (dark bg); Style.Light = dark text (light bg).
        StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
      },
      { immediate: true }
    );
  });
}
