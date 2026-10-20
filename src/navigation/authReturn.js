import AsyncStorage from "@react-native-async-storage/async-storage";
import { routes } from "./routes";

const KEY = "oneta.authReturnRoute";

export async function rememberAuthReturnRoute(destination) {
  if (destination === routes.deleteAccount) {
    await AsyncStorage.setItem(KEY, destination);
  } else {
    await AsyncStorage.removeItem(KEY);
  }
}

export async function consumeAuthReturnRoute() {
  const destination = await AsyncStorage.getItem(KEY);
  await AsyncStorage.removeItem(KEY);
  return destination === routes.deleteAccount ? destination : null;
}
