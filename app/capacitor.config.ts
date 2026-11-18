import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.rashody.app",
  appName: "Мои Расходы",
  webDir: "dist",
  android: {
    allowMixedContent: false,
  },
};

export default config;
