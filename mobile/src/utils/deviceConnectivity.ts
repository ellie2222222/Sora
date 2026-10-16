/**
 * Whether the device itself has internet, as NetInfo last reported it. A request that got no response
 * on a connected device means the server is unreachable, not that the user is offline.
 */
let deviceOnline = true;

export function isDeviceOnline(): boolean {
  return deviceOnline;
}

export function setDeviceOnline(value: boolean): void {
  deviceOnline = value;
}
