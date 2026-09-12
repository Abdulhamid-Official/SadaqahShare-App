import { Dimensions, useWindowDimensions } from 'react-native';

export type DeviceSize = 'phone' | 'tablet' | 'largeTablet';

export function useDeviceSize(): DeviceSize {
  const { width } = useWindowDimensions();
  if (width >= 1024) return 'largeTablet';
  if (width >= 600) return 'tablet';
  return 'phone';
}

export function useColumns(base: number = 1): number {
  const device = useDeviceSize();
  if (device === 'largeTablet') return Math.min(base + 2, 4);
  if (device === 'tablet') return Math.min(base + 1, 3);
  return base;
}

export function useContentWidth(): { paddingHorizontal: number; maxWidth: number | undefined } {
  const { width } = useWindowDimensions();
  if (width >= 1024) return { paddingHorizontal: 32, maxWidth: 1100 };
  if (width >= 768) return { paddingHorizontal: 24, maxWidth: undefined };
  return { paddingHorizontal: 16, maxWidth: undefined };
}
