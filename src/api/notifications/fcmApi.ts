import { registerDeviceToken } from "./deviceTokens";

export function registerFcmToken({
  deviceToken,
  accessToken,
  signal,
}: {
  deviceToken: string;
  accessToken: string;
  signal?: AbortSignal;
}) {
  return registerDeviceToken({ deviceToken, accessToken, signal });
}
