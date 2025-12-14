import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useBrandingTheme } from '../../theme/useBrandingTheme';

type DateTimePickerModalProps = {
  visible: boolean;
  onClose: () => void;
  showDatePicker: boolean;
  showTimePicker: boolean;
  parsedDate: Date;
  parsedTime: Date;
  onDateChange: (event: any, date?: Date) => void;
  onTimeChange: (event: any, date?: Date) => void;
  pickerTheme: 'light' | 'dark';
};

export function DateTimePickerModal({
  visible,
  onClose,
  showDatePicker,
  showTimePicker,
  parsedDate,
  parsedTime,
  onDateChange,
  onTimeChange,
  pickerTheme,
}: DateTimePickerModalProps) {
  const { colors } = useBrandingTheme();

  const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalCard: {
      backgroundColor: colors.surface,
      paddingBottom: 16,
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingTop: 12,
      width: '90%',
      maxWidth: 380,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
      paddingVertical: 8,
    },
    modalButton: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    modalButtonPrimary: {
      color: colors.primary,
    },
    modalPicker: {
      backgroundColor: colors.surface,
      alignSelf: 'center',
    },
    modalPickerContainer: {
      alignItems: 'center',
    },
  });

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.modalButton}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.modalButton, styles.modalButtonPrimary]}>Feito</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalPickerContainer}>
            {showDatePicker ? (
              <DateTimePicker
                value={parsedDate}
                mode="date"
                display="spinner"
                onChange={onDateChange}
                themeVariant={pickerTheme}
                textColor={colors.text}
                style={styles.modalPicker}
              />
            ) : null}
            {showTimePicker ? (
              <DateTimePicker
                value={parsedTime}
                mode="time"
                display="spinner"
                onChange={onTimeChange}
                is24Hour
                themeVariant={pickerTheme}
                textColor={colors.text}
                style={styles.modalPicker}
              />
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}
