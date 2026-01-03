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
};

export function SwipeableRow({ children, onDelete, deleteLabel = 'Apagar', isDeleting = false }: Props) {
  const { colors } = useBrandingTheme();
  const isDisabled = !onDelete || isDeleting;

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
      renderRightActions={renderRightActions}
      overshootRight={false}
      enabled={!isDeleting}
      containerStyle={styles.container}
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
