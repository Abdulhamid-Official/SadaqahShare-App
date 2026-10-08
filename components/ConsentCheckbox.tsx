import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { Colors, Spacing, Radius, FontSize } from '@/lib/theme';
import { useTheme } from '@/lib/theme';

interface ConsentCheckboxProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
  linkText?: string;
  onLinkPress?: () => void;
}

export function ConsentCheckbox({ label, checked, onToggle, linkText, onLinkPress }: ConsentCheckboxProps) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked, { borderColor: checked ? Colors.teal : colors.inputBorder }]}>
        {checked && <Check size={16} color={Colors.white} strokeWidth={3} />}
      </View>
      <View style={styles.labelContainer}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {label}
          {linkText && onLinkPress ? ' ' : ''}
        </Text>
        {linkText && onLinkPress && (
          <Text style={styles.linkText} onPress={onLinkPress}>
            {linkText}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: Radius.sm,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: Colors.teal,
  },
  labelContainer: {
    flex: 1,
  },
  label: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  linkText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.sm,
    color: Colors.teal,
    textDecorationLine: 'underline',
  },
});
