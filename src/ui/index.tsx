import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';
import { useApp } from '../context/AppContext';

/** Shared UI primitives — the app's single source of visual truth. */

export const Card: React.FC<{ children: React.ReactNode; style?: ViewStyle | ViewStyle[] }> = ({ children, style }) => {
  const { themeColors } = useApp();
  return <View style={[uiStyles.card, { backgroundColor: themeColors.card }, style]}>{children}</View>;
};

export const SectionLabel: React.FC<{ children: React.ReactNode; style?: TextStyle }> = ({ children, style }) => (
  <Text style={[uiStyles.sectionLabel, style]}>{children}</Text>
);

export const ScreenHeader: React.FC<{ title: string; accent?: string; subtitle?: string; right?: React.ReactNode }> = ({ title, accent, subtitle, right }) => {
  const { themeColors } = useApp();
  return (
    <View style={[uiStyles.header, { backgroundColor: themeColors.card }]}>
      <View>
        <Text style={uiStyles.headerTitle}>
          {title}{accent ? <Text style={{ color: themeColors.primary }}> {accent}</Text> : null}
        </Text>
        {subtitle ? <Text style={uiStyles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
};

export const PrimaryButton: React.FC<{
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'outline' | 'ghost' | 'danger';
  style?: ViewStyle | ViewStyle[];
}> = ({ label, onPress, disabled, loading, variant = 'primary', style }) => {
  const { themeColors } = useApp();
  const bg = variant === 'primary' ? (disabled ? '#cbd5e1' : themeColors.primary)
    : variant === 'danger' ? '#FEF2F2'
    : 'transparent';
  const border = variant === 'outline' ? { borderWidth: 1.5, borderColor: disabled ? '#e2e8f0' : themeColors.primary } : null;
  const color = variant === 'primary' ? '#fff'
    : variant === 'danger' ? '#DC2626'
    : disabled ? '#94a3b8' : themeColors.primary;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[uiStyles.button, { backgroundColor: bg }, border, style]}
    >
      {loading
        ? <ActivityIndicator color={color} size="small" />
        : <Text style={[uiStyles.buttonText, { color }]}>{label}</Text>}
    </TouchableOpacity>
  );
};

export const Chip: React.FC<{
  label: string;
  emoji?: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
  style?: ViewStyle | ViewStyle[];
}> = ({ label, emoji, selected, onPress, color, style }) => {
  const { themeColors } = useApp();
  const accent = color ?? themeColors.primary;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        uiStyles.chip,
        selected && { backgroundColor: accent + '15', borderColor: accent, borderWidth: 2 },
        style,
      ]}
    >
      {emoji ? <Text style={{ fontSize: 22 }}>{emoji}</Text> : null}
      <Text style={[uiStyles.chipLabel, selected && { color: accent }]}>{label}</Text>
    </TouchableOpacity>
  );
};

export const SettingsRow: React.FC<{
  label: string;
  emoji?: string;
  value?: string;
  onPress?: () => void;
  first?: boolean;
  danger?: boolean;
}> = ({ label, emoji, value, onPress, first, danger }) => (
  <TouchableOpacity onPress={onPress} disabled={!onPress} style={[uiStyles.settingsRow, !first && uiStyles.settingsBorder]}>
    <Text style={[uiStyles.settingsText, danger && { color: '#DC2626' }]}>
      {emoji ? `${emoji}  ` : ''}{label}
    </Text>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {value ? <Text style={uiStyles.settingsValue}>{value}</Text> : null}
      {onPress ? <Text style={uiStyles.settingsArrow}>›</Text> : null}
    </View>
  </TouchableOpacity>
);

export const Badge: React.FC<{ label: string; color: string; bg: string }> = ({ label, color, bg }) => (
  <View style={[uiStyles.badge, { backgroundColor: bg }]}>
    <Text style={{ fontSize: 10, fontWeight: '800', color }}>{label}</Text>
  </View>
);

export const ProgressBar: React.FC<{ progress: number; color?: string; height?: number }> = ({ progress, color, height = 6 }) => {
  const { themeColors } = useApp();
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: '#f1f5f9', overflow: 'hidden' }}>
      <View style={{
        width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`,
        height: '100%',
        borderRadius: height / 2,
        backgroundColor: color ?? themeColors.primary,
      }} />
    </View>
  );
};

export const uiStyles = StyleSheet.create({
  card: {
    borderRadius: 20, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 16,
    elevation: 2,
  },
  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: 12, marginLeft: 4,
  },
  header: {
    paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1e293b' },
  headerSubtitle: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  button: {
    borderRadius: 100, paddingVertical: 16, paddingHorizontal: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  buttonText: { fontWeight: '800', fontSize: 15 },
  chip: {
    alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 8,
    borderRadius: 16, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: 'transparent', gap: 4,
  },
  chipLabel: { fontSize: 11, color: '#64748b', fontWeight: '600', textAlign: 'center' },
  settingsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
  settingsBorder: { borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)' },
  settingsText: { fontSize: 15, fontWeight: '600', color: '#334155' },
  settingsValue: { fontSize: 13, color: '#94a3b8' },
  settingsArrow: { fontSize: 20, color: '#94a3b8' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
});
