import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { RectButton, Swipeable } from 'react-native-gesture-handler';
import { useBrandingTheme } from '../../theme/useBrandingTheme';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  children: React.ReactNode;
  onDelete?: () => void;
  deleteLabel?: string;
  isDeleting?: boolean;
  renderLeftActions?: (progress?: any, dragX?: any) => React.ReactNode;
  onOpen?: (ref: Swipeable | null) => void;
  onClose?: (ref: Swipeable | null) => void;
};

export function SwipeableRow({ children, onDelete, deleteLabel = 'Apagar', isDeleting = false, renderLeftActions, onOpen, onClose }: Props) {
  const { colors } = useBrandingTheme();
  const isDisabled = !onDelete || isDeleting;
  const swipeRef = React.useRef<Swipeable | null>(null);

  const renderRightActions = (_progress?: any, _dragX?: any) => (
    <View style={styles.actionContainer}>
      <RectButton
        style={[styles.iconButton, { backgroundColor: '#FEE2E2' }]}
        onPress={() => {
          if (isDisabled) return;
          onDelete?.();
        }}
        enabled={!isDisabled}
        accessibilityLabel={deleteLabel}
      >
        {isDeleting ? (
          <ActivityIndicator size="small" color={colors.danger} />
        ) : (
          <Ionicons name="trash" size={18} color={colors.danger} />
        )}
      </RectButton>
    </View>
  );

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      renderLeftActions={renderLeftActions}
      overshootRight={false}
      enabled={!isDeleting}
      containerStyle={styles.container}
      onSwipeableOpen={() => onOpen?.(swipeRef.current)}
      onSwipeableClose={() => onClose?.(swipeRef.current)}
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'visible',
  },
  actionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 20,
    justifyContent: 'center',
    height: '100%',
  },
  actionContainerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
    justifyContent: 'center',
    height: '100%',
  },
  iconButton: {
    width: 44,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 6,
    alignSelf: 'center',
  },
  iconText: {
    fontSize: 18,
    fontWeight: '700',
  },
});

export default SwipeableRow;
