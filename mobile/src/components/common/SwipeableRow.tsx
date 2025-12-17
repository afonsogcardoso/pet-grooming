import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { RectButton, Swipeable } from 'react-native-gesture-handler';
import { useBrandingTheme } from '../../theme/useBrandingTheme';

type Props = {
  children: React.ReactNode;
  onDelete?: () => void;
  deleteLabel?: string;
};

export function SwipeableRow({ children, onDelete, deleteLabel = 'Apagar' }: Props) {
  const { colors } = useBrandingTheme();

  const renderRightActions = (_progress?: any, _dragX?: any) => (
    <View style={styles.actionContainer}>
      <RectButton
        style={[styles.iconButton, { backgroundColor: '#FEE2E2' }]}
        onPress={() => onDelete && onDelete()}
      >
        <Text style={[styles.iconText, { color: '#ef4444' }]}>🗑</Text>
      </RectButton>
    </View>
  );

  return (
    <Swipeable renderRightActions={renderRightActions} overshootRight={false}>
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  actionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
    justifyContent: 'center',
    height: '100%',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    alignSelf: 'center',
  },
  iconText: {
    fontSize: 18,
    fontWeight: '700',
  },
});

export default SwipeableRow;
