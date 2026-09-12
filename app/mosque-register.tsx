import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Lock,
  Building2,
  Package,
  Eye,
  EyeOff,
  X,
  Plus,
  CheckCircle,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/lib/context';
import { MosqueAccount, Mosque } from '@/lib/types';
import { Colors, Spacing, Radius, FontSize, useTheme } from '@/lib/theme';
import { useDeviceSize } from '@/lib/responsive';

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Furnishings',
  'Appliances',
  'Food',
  'Educational',
  'Clothing',
  'Medical',
  'Supplies',
  'General',
] as const;

const PRIORITIES = ['Urgent', 'High', 'Medium', 'Low'] as const;

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  Urgent: { bg: Colors.redFaint, text: Colors.red },
  High: { bg: Colors.amberFaint, text: Colors.amber },
  Medium: { bg: Colors.blueFaint, text: Colors.blue },
  Low: { bg: Colors.stone200, text: Colors.stone600 },
};

const PRIORITY_TOKENS: Record<string, number> = {
  Urgent: 25,
  High: 15,
  Medium: 10,
  Low: 5,
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface NeedForm {
  id: string;
  name: string;
  category: string;
  quantity: string;
  priority: string;
  tokensPerUnit: string;
}

function createNeed(): NeedForm {
  return {
    id: Date.now().toString() + Math.random().toString(36).slice(2),
    name: '',
    category: 'General',
    quantity: '1',
    priority: 'Medium',
    tokensPerUnit: String(PRIORITY_TOKENS['Medium']),
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default function MosqueRegisterScreen() {
  const { setRole, setMosqueAccount, setMosqueName, setMosqueCity, setMosqueState, setIsPaid, setIsAdmin } = useAppContext();
  const deviceSize = useDeviceSize();
  const { colors } = useTheme();

  // Account fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Mosque profile fields
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [phone, setPhone] = useState('');
  const [publicEmail, setPublicEmail] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  // Needs
  const [needs, setNeeds] = useState<NeedForm[]>([createNeed()]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

  // Focus tracking
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const cardMaxWidth = deviceSize !== 'phone' ? 600 : undefined;

  // ── Need helpers ─────────────────────────────────────────────────────────

  const updateNeed = (id: string, updates: Partial<NeedForm>) => {
    setNeeds((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n;
        const updated = { ...n, ...updates };
        // Auto-update tokens when priority changes
        if (updates.priority && !updates.tokensPerUnit) {
          updated.tokensPerUnit = String(PRIORITY_TOKENS[updates.priority] ?? 10);
        }
        return updated;
      })
    );
  };

  const removeNeed = (id: string) => {
    if (needs.length <= 1) return;
    setNeeds((prev) => prev.filter((n) => n.id !== id));
  };

  const addNeed = () => {
    setNeeds((prev) => [...prev, createNeed()]);
  };

  // ── Validation ───────────────────────────────────────────────────────────

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!email.trim()) errors.email = 'Email is required.';
    else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) errors.email = 'Invalid email address.';
    }
    if (!password) errors.password = 'Password is required.';
    else if (password.length < 4) errors.password = 'Password must be at least 4 characters.';

    if (!name.trim()) errors.name = 'Mosque name is required.';
    if (!address.trim()) errors.address = 'Address is required.';
    if (!city.trim()) errors.city = 'City is required.';
    if (!state.trim()) errors.state = 'State is required.';

    // Validate needs
    let hasValidNeed = false;
    needs.forEach((need, i) => {
      if (need.name.trim()) {
        hasValidNeed = true;
      }
    });
    if (!hasValidNeed) {
      errors.needs = 'At least one need with a name is required.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Submit ───────────────────────────────────────────────────────────────

  const handleRegister = async () => {
    if (!validate()) return;

    setError(null);
    setLoading(true);

    try {
      // 1. Insert mosque
      const { data: mosqueData, error: mosqueError } = await supabase
        .from('mosques')
        .insert({
          name: name.trim(),
          address: address.trim(),
          city: city.trim(),
          state: state.trim(),
          phone: phone.trim() || null,
          email: publicEmail.trim() || null,
          description: description.trim() || null,
          image_url: imageUrl.trim() || null,
          join_code: generateJoinCode(),
        })
        .select('id')
        .single();

      if (mosqueError) {
        setError(mosqueError.message);
        setLoading(false);
        return;
      }

      const mosqueId = mosqueData.id;

      // 2. Insert mosque account
      const { error: accountError } = await supabase.from('mosque_accounts').insert({
        mosque_id: mosqueId,
        email: email.trim().toLowerCase(),
        password_hash: password, // prototype — store raw
        is_paid: false,
      });

      if (accountError) {
        // Clean up mosque if account creation fails
        await supabase.from('mosques').delete().eq('id', mosqueId);
        setError(accountError.message);
        setLoading(false);
        return;
      }

      // 3. Insert needs
      const validNeeds = needs.filter((n) => n.name.trim());
      if (validNeeds.length > 0) {
        const needRows = validNeeds.map((n) => ({
          mosque_id: mosqueId,
          name: n.name.trim(),
          category: n.category,
          quantity_needed: parseInt(n.quantity, 10) || 1,
          quantity_pledged: 0,
          priority: n.priority.toLowerCase(),
          tokens_per_unit: parseInt(n.tokensPerUnit, 10) || 10,
          type: 'item' as const,
        }));

        const { error: needsError } = await supabase.from('needs').insert(needRows);

        if (needsError) {
          // Non-fatal — mosque and account already created
          console.warn('Failed to insert needs:', needsError.message);
        }
      }

      // 4. Set context and go to payment
      const { data: createdAccount } = await supabase
        .from('mosque_accounts')
        .select('*')
        .eq('mosque_id', mosqueId)
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (createdAccount) {
        const typedAccount = createdAccount as MosqueAccount;
        setIsAdmin(false);
        setMosqueAccount(typedAccount);
        setMosqueName(name.trim());
        setMosqueCity(city.trim());
        setMosqueState(state.trim());
        setRole('mosque');
        setIsPaid(false);
      }

      setSuccess(true);
      setTimeout(() => {
        router.replace('/mosque-payment' as any);
      }, 1500);
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Success State ────────────────────────────────────────────────────────

  if (success) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <View style={styles.successContainer}>
          <View style={styles.successIconCircle}>
            <CheckCircle size={48} color={Colors.teal} strokeWidth={1.5} />
          </View>
          <Text style={[styles.successTitle, { color: colors.textPrimary }]}>Mosque Registered!</Text>
          <Text style={[styles.successSubtitle, { color: colors.textSecondary }]}>
            Your mosque has been created successfully. Setting up subscription...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            cardMaxWidth ? { alignItems: 'center' } : undefined,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={cardMaxWidth ? { maxWidth: cardMaxWidth, width: '100%' } : { width: '100%' }}>
            {/* Back Button */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ArrowLeft size={22} color={Colors.stone600} />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>

            {/* Page Header */}
            <View style={styles.pageHeader}>
              <View style={styles.headerIconCircle}>
                <Building2 size={28} color={Colors.white} />
              </View>
              <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>Register Your Mosque</Text>
              <Text style={[styles.pageSubtitle, { color: colors.textSecondary }]}>
                Create an account to manage your mosque's needs and connect with donors
              </Text>
            </View>

            {/* ─── Section 1: Account ─── */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconCircle}>
                  <Lock size={18} color={Colors.teal} />
                </View>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Account</Text>
              </View>

              <View style={[styles.sectionCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
                {/* Email */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    Email Address <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      focusedField === 'email' && styles.inputFocused,
                      fieldErrors.email ? styles.inputError : undefined,
                    ]}
                    placeholder="mosque@email.com"
                    placeholderTextColor={Colors.stone400}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={email}
                    onChangeText={(t) => {
                      setEmail(t);
                      setFieldErrors((prev) => ({ ...prev, email: '' }));
                    }}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    editable={!loading}
                  />
                  {fieldErrors.email ? (
                    <Text style={styles.fieldError}>{fieldErrors.email}</Text>
                  ) : null}
                </View>

                {/* Password */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    Password <Text style={styles.required}>*</Text>
                  </Text>
                  <View
                    style={[
                      styles.passwordContainer,
                      focusedField === 'password' && styles.inputFocused,
                      fieldErrors.password ? styles.inputError : undefined,
                    ]}
                  >
                    <TextInput
                      style={styles.passwordInput}
                      placeholder="Min 4 characters"
                      placeholderTextColor={Colors.stone400}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={password}
                      onChangeText={(t) => {
                        setPassword(t);
                        setFieldErrors((prev) => ({ ...prev, password: '' }));
                      }}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      editable={!loading}
                    />
                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() => setShowPassword(!showPassword)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      {showPassword ? (
                        <EyeOff size={20} color={Colors.stone400} />
                      ) : (
                        <Eye size={20} color={Colors.stone400} />
                      )}
                    </TouchableOpacity>
                  </View>
                  {fieldErrors.password ? (
                    <Text style={styles.fieldError}>{fieldErrors.password}</Text>
                  ) : null}
                </View>
              </View>
            </View>

            {/* ─── Section 2: Mosque Profile ─── */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconCircle}>
                  <Building2 size={18} color={Colors.teal} />
                </View>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Mosque Profile</Text>
              </View>

              <View style={[styles.sectionCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
                {/* Name */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    Mosque Name <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      focusedField === 'name' && styles.inputFocused,
                      fieldErrors.name ? styles.inputError : undefined,
                    ]}
                    placeholder="e.g. Masjid Al-Noor"
                    placeholderTextColor={Colors.stone400}
                    value={name}
                    onChangeText={(t) => {
                      setName(t);
                      setFieldErrors((prev) => ({ ...prev, name: '' }));
                    }}
                    onFocus={() => setFocusedField('name')}
                    onBlur={() => setFocusedField(null)}
                    editable={!loading}
                  />
                  {fieldErrors.name ? (
                    <Text style={styles.fieldError}>{fieldErrors.name}</Text>
                  ) : null}
                </View>

                {/* Address */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    Address <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      focusedField === 'address' && styles.inputFocused,
                      fieldErrors.address ? styles.inputError : undefined,
                    ]}
                    placeholder="123 Main Street"
                    placeholderTextColor={Colors.stone400}
                    value={address}
                    onChangeText={(t) => {
                      setAddress(t);
                      setFieldErrors((prev) => ({ ...prev, address: '' }));
                    }}
                    onFocus={() => setFocusedField('address')}
                    onBlur={() => setFocusedField(null)}
                    editable={!loading}
                  />
                  {fieldErrors.address ? (
                    <Text style={styles.fieldError}>{fieldErrors.address}</Text>
                  ) : null}
                </View>

                {/* City & State row */}
                <View style={styles.row}>
                  <View style={[styles.inputGroup, styles.rowHalf]}>
                    <Text style={styles.label}>
                      City <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        focusedField === 'city' && styles.inputFocused,
                        fieldErrors.city ? styles.inputError : undefined,
                      ]}
                      placeholder="City"
                      placeholderTextColor={Colors.stone400}
                      value={city}
                      onChangeText={(t) => {
                        setCity(t);
                        setFieldErrors((prev) => ({ ...prev, city: '' }));
                      }}
                      onFocus={() => setFocusedField('city')}
                      onBlur={() => setFocusedField(null)}
                      editable={!loading}
                    />
                    {fieldErrors.city ? (
                      <Text style={styles.fieldError}>{fieldErrors.city}</Text>
                    ) : null}
                  </View>

                  <View style={[styles.inputGroup, styles.rowHalf]}>
                    <Text style={styles.label}>
                      State <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        focusedField === 'state' && styles.inputFocused,
                        fieldErrors.state ? styles.inputError : undefined,
                      ]}
                      placeholder="State"
                      placeholderTextColor={Colors.stone400}
                      value={state}
                      onChangeText={(t) => {
                        setState(t);
                        setFieldErrors((prev) => ({ ...prev, state: '' }));
                      }}
                      onFocus={() => setFocusedField('state')}
                      onBlur={() => setFocusedField(null)}
                      editable={!loading}
                    />
                    {fieldErrors.state ? (
                      <Text style={styles.fieldError}>{fieldErrors.state}</Text>
                    ) : null}
                  </View>
                </View>

                {/* Phone */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Phone</Text>
                  <TextInput
                    style={[styles.input, focusedField === 'phone' && styles.inputFocused]}
                    placeholder="(555) 123-4567"
                    placeholderTextColor={Colors.stone400}
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                    onFocus={() => setFocusedField('phone')}
                    onBlur={() => setFocusedField(null)}
                    editable={!loading}
                  />
                </View>

                {/* Public Email */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Public Email</Text>
                  <TextInput
                    style={[styles.input, focusedField === 'publicEmail' && styles.inputFocused]}
                    placeholder="contact@mosque.org"
                    placeholderTextColor={Colors.stone400}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={publicEmail}
                    onChangeText={setPublicEmail}
                    onFocus={() => setFocusedField('publicEmail')}
                    onBlur={() => setFocusedField(null)}
                    editable={!loading}
                  />
                </View>

                {/* Description */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Description</Text>
                  <TextInput
                    style={[
                      styles.input,
                      styles.textArea,
                      focusedField === 'description' && styles.inputFocused,
                    ]}
                    placeholder="Tell donors about your mosque..."
                    placeholderTextColor={Colors.stone400}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    value={description}
                    onChangeText={setDescription}
                    onFocus={() => setFocusedField('description')}
                    onBlur={() => setFocusedField(null)}
                    editable={!loading}
                  />
                </View>

                {/* Image URL */}
                <View style={[styles.inputGroup, { marginBottom: 0 }]}>
                  <Text style={styles.label}>Image URL</Text>
                  <TextInput
                    style={[styles.input, focusedField === 'imageUrl' && styles.inputFocused]}
                    placeholder="https://example.com/mosque.jpg"
                    placeholderTextColor={Colors.stone400}
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={imageUrl}
                    onChangeText={setImageUrl}
                    onFocus={() => setFocusedField('imageUrl')}
                    onBlur={() => setFocusedField(null)}
                    editable={!loading}
                  />
                </View>
              </View>
            </View>

            {/* ─── Section 3: Initial Needs ─── */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconCircle}>
                  <Package size={18} color={Colors.teal} />
                </View>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Initial Needs</Text>
              </View>

              {fieldErrors.needs ? (
                <Text style={[styles.fieldError, { marginBottom: Spacing.md }]}>
                  {fieldErrors.needs}
                </Text>
              ) : null}

              {needs.map((need, index) => (
                <View key={need.id} style={[styles.needCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
                  {/* Need header with remove button */}
                  <View style={styles.needHeader}>
                    <Text style={styles.needNumber}>Need #{index + 1}</Text>
                    {needs.length > 1 && (
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => removeNeed(need.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <X size={18} color={Colors.red} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Need Name */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>
                      Item Name <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        focusedField === `need-name-${need.id}` && styles.inputFocused,
                      ]}
                      placeholder="e.g. Prayer Rugs"
                      placeholderTextColor={Colors.stone400}
                      value={need.name}
                      onChangeText={(t) => {
                        updateNeed(need.id, { name: t });
                        setFieldErrors((prev) => ({ ...prev, needs: '' }));
                      }}
                      onFocus={() => setFocusedField(`need-name-${need.id}`)}
                      onBlur={() => setFocusedField(null)}
                      editable={!loading}
                    />
                  </View>

                  {/* Category */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Category</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.pillRow}
                    >
                      {CATEGORIES.map((cat) => {
                        const isSelected = need.category === cat;
                        return (
                          <TouchableOpacity
                            key={cat}
                            style={[
                              styles.pill,
                              isSelected && styles.pillSelected,
                            ]}
                            onPress={() => updateNeed(need.id, { category: cat })}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={[
                                styles.pillText,
                                isSelected && styles.pillTextSelected,
                              ]}
                            >
                              {cat}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>

                  {/* Quantity */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Quantity</Text>
                    <TextInput
                      style={[
                        styles.input,
                        styles.smallInput,
                        focusedField === `need-qty-${need.id}` && styles.inputFocused,
                      ]}
                      placeholder="1"
                      placeholderTextColor={Colors.stone400}
                      keyboardType="numeric"
                      value={need.quantity}
                      onChangeText={(t) => updateNeed(need.id, { quantity: t.replace(/[^0-9]/g, '') })}
                      onFocus={() => setFocusedField(`need-qty-${need.id}`)}
                      onBlur={() => setFocusedField(null)}
                      editable={!loading}
                    />
                  </View>

                  {/* Priority */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Priority</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.pillRow}
                    >
                      {PRIORITIES.map((pri) => {
                        const isSelected = need.priority === pri;
                        const colors = PRIORITY_COLORS[pri];
                        return (
                          <TouchableOpacity
                            key={pri}
                            style={[
                              styles.priorityPill,
                              {
                                backgroundColor: isSelected ? colors.bg : Colors.stone100,
                                borderColor: isSelected ? colors.text : Colors.stone200,
                              },
                            ]}
                            onPress={() => updateNeed(need.id, { priority: pri })}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={[
                                styles.priorityPillText,
                                { color: isSelected ? colors.text : Colors.stone500 },
                              ]}
                            >
                              {pri}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>

                  {/* Tokens per unit */}
                  <View style={[styles.inputGroup, { marginBottom: 0 }]}>
                    <Text style={styles.label}>Tokens per Unit</Text>
                    <TextInput
                      style={[
                        styles.input,
                        styles.smallInput,
                        focusedField === `need-tokens-${need.id}` && styles.inputFocused,
                      ]}
                      placeholder="10"
                      placeholderTextColor={Colors.stone400}
                      keyboardType="numeric"
                      value={need.tokensPerUnit}
                      onChangeText={(t) =>
                        updateNeed(need.id, { tokensPerUnit: t.replace(/[^0-9]/g, '') })
                      }
                      onFocus={() => setFocusedField(`need-tokens-${need.id}`)}
                      onBlur={() => setFocusedField(null)}
                      editable={!loading}
                    />
                  </View>
                </View>
              ))}

              {/* Add Another Need */}
              <TouchableOpacity
                style={styles.addNeedButton}
                onPress={addNeed}
                activeOpacity={0.7}
              >
                <Plus size={18} color={Colors.teal} />
                <Text style={styles.addNeedText}>Add Another Need</Text>
              </TouchableOpacity>
            </View>

            {/* ─── Error ─── */}
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            )}

            {/* ─── Submit ─── */}
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.buttonDisabled]}
              onPress={handleRegister}
              activeOpacity={0.8}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <Text style={styles.submitButtonText}>Register Mosque</Text>
              )}
            </TouchableOpacity>

            <View style={{ height: Spacing.huge }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xxl,
  },

  /* ── Back ── */
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: Spacing.xl,
    minHeight: 44,
    paddingVertical: Spacing.sm,
  },
  backText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.md,
    color: Colors.stone600,
    marginLeft: Spacing.sm,
  },

  /* ── Page Header ── */
  pageHeader: {
    alignItems: 'center',
    marginBottom: Spacing.xxxl,
  },
  headerIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.teal,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    shadowColor: Colors.teal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  pageTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: FontSize.xxl,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  pageSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },

  /* ── Sections ── */
  section: {
    marginBottom: Spacing.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ccfbf1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  sectionTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
  },
  sectionCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },

  /* ── Inputs ── */
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  required: {
    color: Colors.red,
  },
  input: {
    width: '100%',
    height: 50,
    backgroundColor: Colors.stone50,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.stone200,
  },
  inputFocused: {
    borderColor: Colors.teal,
    borderWidth: 2,
  },
  inputError: {
    borderColor: Colors.red,
    borderWidth: 1.5,
  },
  smallInput: {
    width: 120,
  },
  textArea: {
    height: 90,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    textAlignVertical: 'top',
  },

  /* ── Password ── */
  passwordContainer: {
    width: '100%',
    height: 50,
    backgroundColor: Colors.stone50,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.stone200,
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: Spacing.lg,
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  eyeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* ── Row layout ── */
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  rowHalf: {
    flex: 1,
  },

  /* ── Field Error ── */
  fieldError: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.xs,
    color: Colors.red,
    marginTop: Spacing.xs,
  },

  /* ── Needs ── */
  needCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: Spacing.md,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  needHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  needNumber: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.sm,
    color: Colors.teal,
  },
  removeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radius.sm,
    backgroundColor: Colors.redFaint,
  },

  /* ── Pills ── */
  pillRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.stone100,
    borderWidth: 1,
    borderColor: Colors.stone200,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillSelected: {
    backgroundColor: Colors.teal,
    borderColor: Colors.teal,
  },
  pillText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.xs,
    color: Colors.stone600,
  },
  pillTextSelected: {
    color: Colors.white,
  },

  /* ── Priority Pills ── */
  priorityPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  priorityPillText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.xs,
  },

  /* ── Add Need ── */
  addNeedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.teal,
    borderStyle: 'dashed',
    minHeight: 48,
    gap: Spacing.sm,
  },
  addNeedText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.sm,
    color: Colors.teal,
  },

  /* ── Error Banner ── */
  errorBanner: {
    backgroundColor: Colors.redFaint,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.red,
  },
  errorBannerText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.sm,
    color: Colors.red,
    textAlign: 'center',
  },

  /* ── Submit ── */
  submitButton: {
    width: '100%',
    height: 56,
    backgroundColor: Colors.teal,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.teal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontFamily: 'Inter-Bold',
    fontSize: FontSize.lg,
    color: Colors.white,
  },

  /* ── Success ── */
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  successIconCircle: {
    marginBottom: Spacing.xl,
  },
  successTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: FontSize.xxl,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  successSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
