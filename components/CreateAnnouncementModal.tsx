import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, Pin } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, Radius, FontSize, useTheme } from '@/lib/theme';
import { useDeviceSize } from '@/lib/responsive';
import { Announcement } from '@/lib/types';

interface CreateAnnouncementModalProps {
  visible: boolean;
  onClose: () => void;
  mosqueId: string;
  onCreated: () => void;
  editAnnouncement?: Announcement | null;
}

export default function CreateAnnouncementModal({
  visible,
  onClose,
  mosqueId,
  onCreated,
  editAnnouncement,
}: CreateAnnouncementModalProps) {
  const deviceSize = useDeviceSize();
  const isTablet = deviceSize !== 'phone';
  const { colors } = useTheme();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!editAnnouncement;

  useEffect(() => {
    if (visible) {
      if (editAnnouncement) {
        setTitle(editAnnouncement.title);
        setBody(editAnnouncement.body ?? '');
        setPinned(editAnnouncement.pinned);
      } else {
        setTitle('');
        setBody('');
        setPinned(false);
      }
      setError(null);
      setSubmitting(false);
    }
  }, [visible, editAnnouncement]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Please enter a title.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        title: title.trim(),
        body: body.trim() || null,
        pinned,
        updated_at: new Date().toISOString(),
      };

      let opErr;
      if (isEditing && editAnnouncement) {
        const { error } = await supabase
          .from('announcements')
          .update(payload)
          .eq('id', editAnnouncement.id);
        opErr = error;
      } else {
        const { error } = await supabase
          .from('announcements')
          .insert({ ...payload, mosque_id: mosqueId });
        opErr = error;
      }

      if (opErr) throw opErr;

      onCreated();
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={[styles.backdrop, { backgroundColor: colors.modalOverlay }]} activeOpacity={1} onPress={onClose} />
        <View style={[styles.card, isTablet && styles.cardTablet, { backgroundColor: colors.cardBg }]}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {isEditing ? 'Edit Announcement' : 'New Announcement'}
              </Text>
              <TouchableOpacity style={[styles.closeBtn, { backgroundColor: colors.stone100 }]} onPress={onClose} activeOpacity={0.7}>
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>
              Title<Text style={styles.required}> *</Text>
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
              value={title}
              onChangeText={(t) => { setTitle(t); setError(null); }}
              placeholder="e.g. Eid Prayer Schedule"
              placeholderTextColor={Colors.stone400}
              autoCapitalize="sentences"
            />

            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Body</Text>
            <TextInput
              style={[styles.input, styles.inputMulti, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
              value={body}
              onChangeText={setBody}
              placeholder="Write your announcement here…"
              placeholderTextColor={Colors.stone400}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.pinToggle, { backgroundColor: colors.stone100, borderColor: pinned ? Colors.teal : 'transparent' }]}
              activeOpacity={0.7}
              onPress={() => setPinned(!pinned)}
            >
              <Pin size={16} color={pinned ? Colors.teal : colors.textMuted} />
              <Text style={[styles.pinToggleText, { color: pinned ? Colors.teal : colors.textMuted }]}>
                {pinned ? 'Pinned to top' : 'Pin to top'}
              </Text>
            </TouchableOpacity>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.cancelBtn, { backgroundColor: colors.cardBg, borderColor: colors.inputBorder }]}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                activeOpacity={0.7}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {isEditing ? 'Save' : 'Post'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)' },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    width: '92%',
    maxWidth: 480,
    maxHeight: '90%',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } },
      android: { elevation: 14 },
      default: { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } },
    }),
  },
  cardTablet: { maxWidth: 500 },
  scrollContent: { padding: Spacing.xxl, paddingBottom: Spacing.xxxl },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.xl },
  modalTitle: { fontFamily: 'Inter-Bold', fontSize: FontSize.xl, color: Colors.textPrimary, flex: 1, marginRight: Spacing.sm },
  closeBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: Radius.full, marginTop: -Spacing.xs, marginRight: -Spacing.xs },
  fieldLabel: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.sm, marginBottom: Spacing.xs, marginTop: Spacing.lg },
  required: { color: Colors.red, fontFamily: 'Inter-Regular' },
  input: {
    backgroundColor: Colors.stone50, borderWidth: 1, borderColor: Colors.stone200,
    borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    fontFamily: 'Inter-Regular', fontSize: FontSize.md, color: Colors.textPrimary, minHeight: 48,
  },
  inputMulti: { minHeight: 120, paddingTop: Spacing.md },
  pinToggle: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderRadius: Radius.md, borderWidth: 1.5, marginTop: Spacing.lg, minHeight: 48,
  },
  pinToggleText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.sm },
  errorText: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, color: Colors.red, marginTop: Spacing.lg, textAlign: 'center' },
  buttonRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xxl },
  cancelBtn: {
    flex: 1, borderRadius: Radius.md, paddingVertical: Spacing.lg,
    alignItems: 'center', justifyContent: 'center', minHeight: 52, borderWidth: 1.5,
  },
  cancelBtnText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.md },
  submitBtn: {
    flex: 2, backgroundColor: Colors.teal, borderRadius: Radius.md, paddingVertical: Spacing.lg,
    alignItems: 'center', justifyContent: 'center', minHeight: 52,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { fontFamily: 'Inter-Bold', fontSize: FontSize.md, color: Colors.white },
});
