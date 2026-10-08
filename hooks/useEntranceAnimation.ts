import { useEffect } from 'react';
import { useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing, interpolate, withSpring } from 'react-native-reanimated';

const SPRING_CONFIG = { damping: 18, stiffness: 120, mass: 0.8 };

export function useFadeInUp(delay = 0, distance = 24) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withSpring(1, SPRING_CONFIG));
  }, [delay]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: interpolate(progress.value, [0, 1], [distance, 0]) }],
  }));

  return style;
}

export function useFadeIn(delay = 0) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration: 400, easing: Easing.out(Easing.ease) }));
  }, [delay]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  return style;
}

export function useScaleIn(delay = 0) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withSpring(1, { damping: 14, stiffness: 140, mass: 0.6 }));
  }, [delay]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.85, 1]) }],
  }));

  return style;
}

export function useStaggeredFadeInUp(count: number, baseDelay = 0, stagger = 60) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 1;
  }, []);

  const getStyle = (index: number) => {
    'worklet';
    return {
      opacity: withDelay(baseDelay + index * stagger, withSpring(1, SPRING_CONFIG)),
      transform: [{ translateY: withDelay(baseDelay + index * stagger, withSpring(0, SPRING_CONFIG)) }],
    };
  };

  return { progress, getStyle };
}
