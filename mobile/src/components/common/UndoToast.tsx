import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBrandingTheme } from '../../theme/useBrandingTheme';

type UndoToastProps = {
  visible: boolean;
  message: string;
  actionLabel: string;
  onAction: () => void;
  onTimeout: () => void;
  onDismiss?: () => void;
  durationMs?: number;
  bottomOffset?: number;
};

const DEFAULT_DURATION_MS = 4000;

export function UndoToast({
  visible,
  message,
  actionLabel,
  onAction,
  onTimeout,
  onDismiss,
  durationMs = DEFAULT_DURATION_MS,
  bottomOffset = 16,
}: UndoToastProps) {
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [mounted, setMounted] = useState(visible);
  const [remaining, setRemaining] = useState(Math.ceil(durationMs / 1000));
  const animation = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const onTimeoutRef = useRef(onTimeout);
  const onDismissRef = useRef(onDismiss || onTimeout);
  const actionHandledRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    onDismissRef.current = onDismiss || onTimeout;
  }, [onDismiss, onTimeout]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      dragY.setValue(0);
      setRemaining(Math.ceil(durationMs / 1000));
      actionHandledRef.current = false;
      clearTimers();
      timeoutRef.current = setTimeout(() => {
        if (actionHandledRef.current) return;
        onTimeoutRef.current();
      }, durationMs);
      intervalRef.current = setInterval(() => {
        setRemaining((prev) => Math.max(prev - 1, 0));
      }, 1000);
      Animated.timing(animation, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
      return;
    }

    if (mounted) {
      clearTimers();
      Animated.timing(animation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setMounted(false);
        }
      });
    }
  }, [animation, clearTimers, durationMs, mounted, visible]);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  const translateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 0],
  });

  const combinedTranslateY = Animated.add(translateY, dragY);

  const handleDismiss = useCallback(() => {
    if (actionHandledRef.current) return;
    actionHandledRef.current = true;
    clearTimers();
    onDismissRef.current?.();
  }, [clearTimers]);

  const handleAction = useCallback(() => {
    if (actionHandledRef.current) return;
    actionHandledRef.current = true;
    clearTimers();
    onAction();
  }, [clearTimers, onAction]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) =>
        gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy > 0) {
          dragY.setValue(gesture.dy);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 30) {
          handleDismiss();
          Animated.timing(dragY, {
            toValue: 0,
            duration: 120,
            useNativeDriver: true,
          }).start();
          return;
        }
        Animated.spring(dragY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 0,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(dragY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 0,
        }).start();
      },
    })
  ).current;

  if (!mounted) return null;

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.container,
        {
          bottom: bottomOffset,
          opacity: animation,
          transform: [{ translateY: combinedTranslateY }],
        },
      ]}
    >
      <View style={styles.messageWrap} {...panResponder.panHandlers}>
        <Text style={styles.message}>{message}</Text>
      </View>
      <View style={styles.actions}>
        {remaining > 0 ? (
          <View style={styles.countdown}>
            <Text style={styles.countdownText}>{remaining}</Text>
          </View>
        ) : null}
        <TouchableOpacity
          onPress={handleAction}
          style={styles.button}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDismiss} style={styles.closeButton} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Ionicons name="close" size={14} color={colors.muted} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

function createStyles(colors: ReturnType<typeof useBrandingTheme>['colors']) {
  return StyleSheet.create({
    container: {
      position: 'absolute',
      left: 16,
      right: 16,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      shadowColor: '#000000',
      shadowOpacity: 0.12,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    messageWrap: {
      flex: 1,
      marginRight: 12,
    },
    message: {
      color: colors.text,
      fontWeight: '600',
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    countdown: {
      minWidth: 24,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 10,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    countdownText: {
      color: colors.primary,
      fontWeight: '700',
      fontSize: 12,
    },
    button: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: colors.primarySoft,
    },
    buttonText: {
      color: colors.primary,
      fontWeight: '700',
    },
    closeButton: {
      paddingHorizontal: 6,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
