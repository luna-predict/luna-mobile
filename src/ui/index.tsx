import React, { useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ViewStyle, TextStyle, ActivityIndicator,
  AccessibilityInfo, Switch, StyleProp,
} from 'react-native';
import { ChevronLeft, ChevronRight, Info, AlertTriangle, Siren, X } from 'lucide-react-native';
import { useApp } from '../context/AppContext';
import { radius, space, type, TOUCH } from './theme';
import { HealthFlag } from '../types';

export * from './theme';
export { ToastProvider, useToast } from './Toast';
export { Sheet } from './Sheet';

export type IconType = React.ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;

/** True when the OS asks for reduced motion. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}

export const Card: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle>; accessibilityLabel?: string }> = ({ children, style, accessibilityLabel }) => {
  const { themeColors } = useApp();
  return (
    <View accessibilityLabel={accessibilityLabel} style={[ui.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }, style]}>
      {children}
    </View>
  );
};

export const SectionLabel: React.FC<{ children: React.ReactNode; style?: StyleProp<TextStyle> }> = ({ children, style }) => {
  const { themeColors } = useApp();
  return <Text accessibilityRole="header" style={[ui.sectionLabel, { color: themeColors.textMuted }, style]}>{children}</Text>;
};

export const ScreenHeader: React.FC<{
  title: string;
  accent?: string;
  subtitle?: string;
  right?: React.ReactNode;
  onBack?: () => void;
}> = ({ title, accent, subtitle, right, onBack }) => {
  const { themeColors } = useApp();
  return (
    <View style={[ui.header, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: space.xs }}>
        {onBack && <IconButton icon={ChevronLeft} label="Go back" onPress={onBack} />}
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={[ui.headerTitle, { color: themeColors.text }]} numberOfLines={1}>
            {title}{accent ? <Text style={{ color: themeColors.primaryStrong }}> {accent}</Text> : null}
          </Text>
          {subtitle ? <Text style={[ui.headerSubtitle, { color: themeColors.subtext }]} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
      </View>
      {right}
    </View>
  );
};

type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger' | 'tonal';

export const Button: React.FC<{
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: ButtonVariant;
  icon?: IconType;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  testID?: string;
  compact?: boolean;
}> = ({ label, onPress, disabled, loading, variant = 'primary', icon: Icon, style, accessibilityHint, testID, compact }) => {
  const t = useApp().themeColors;
  const palette: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: disabled ? t.border : t.primaryStrong, fg: disabled ? t.subtext : t.onPrimary },
    tonal: { bg: t.tint, fg: t.primaryStrong },
    outline: { bg: 'transparent', fg: disabled ? t.subtext : t.primaryStrong, border: disabled ? t.border : t.primaryStrong },
    ghost: { bg: 'transparent', fg: disabled ? t.subtext : t.primaryStrong },
    danger: { bg: t.dangerTint, fg: t.danger },
  };
  const p = palette[variant];
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      android_ripple={{ color: p.fg + '22', borderless: false }}
      style={({ pressed }) => [
        ui.button,
        compact && ui.buttonCompact,
        { backgroundColor: p.bg, opacity: pressed ? 0.85 : 1 },
        p.border ? { borderWidth: 1.5, borderColor: p.border } : null,
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={p.fg} size="small" /> : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          {Icon ? <Icon color={p.fg} size={18} strokeWidth={2.2} /> : null}
          <Text style={[ui.buttonText, { color: p.fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
};

/** Legacy name kept for screens that haven't migrated. */
export const PrimaryButton = Button;

export const IconButton: React.FC<{
  icon: IconType;
  label: string;
  onPress: () => void;
  color?: string;
  bg?: string;
  size?: number;
  disabled?: boolean;
  testID?: string;
}> = ({ icon: Icon, label, onPress, color, bg, size = 22, disabled, testID }) => {
  const t = useApp().themeColors;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={8}
      android_ripple={{ color: (color ?? t.text) + '22', borderless: true, radius: TOUCH / 2 }}
      style={({ pressed }) => [ui.iconButton, { backgroundColor: bg ?? 'transparent', opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }]}
    >
      <Icon color={color ?? t.text} size={size} strokeWidth={2} />
    </Pressable>
  );
};

export const Chip: React.FC<{
  label: string;
  emoji?: string;
  icon?: IconType;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}> = ({ label, emoji, icon: Icon, selected, onPress, color, style, testID }) => {
  const t = useApp().themeColors;
  const accent = color ?? t.primaryStrong;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: !!selected }}
      android_ripple={{ color: accent + '22' }}
      style={({ pressed }) => [
        ui.chip,
        { backgroundColor: t.surface, borderColor: 'transparent', opacity: pressed ? 0.85 : 1 },
        selected && { backgroundColor: accent + '14', borderColor: accent },
        style,
      ]}
    >
      {emoji ? <Text style={{ fontSize: 22 }} accessible={false}>{emoji}</Text> : null}
      {Icon ? <Icon color={selected ? accent : t.textMuted} size={20} /> : null}
      <Text style={[ui.chipLabel, { color: selected ? accent : t.textMuted }]} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
};

export const SettingsRow: React.FC<{
  label: string;
  icon?: IconType;
  value?: string;
  onPress?: () => void;
  first?: boolean;
  danger?: boolean;
  toggle?: { value: boolean; onChange: (v: boolean) => void };
  testID?: string;
}> = ({ label, icon: Icon, value, onPress, first, danger, toggle, testID }) => {
  const t = useApp().themeColors;
  const color = danger ? t.danger : t.text;
  const content = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, flex: 1 }}>
        {Icon ? <Icon color={danger ? t.danger : t.textMuted} size={20} /> : null}
        <Text style={[ui.settingsText, { color }]}>{label}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, flexShrink: 1 }}>
        {value ? <Text style={[ui.settingsValue, { color: t.subtext }]} numberOfLines={1}>{value}</Text> : null}
        {toggle ? (
          <Switch
            value={toggle.value}
            onValueChange={toggle.onChange}
            trackColor={{ true: t.primaryStrong, false: t.border }}
            thumbColor="#FFFFFF"
            accessibilityLabel={label}
          />
        ) : onPress ? <ChevronRight color={t.subtext} size={18} /> : null}
      </View>
    </>
  );
  const style = [ui.settingsRow, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border }];
  if (toggle) return <View testID={testID} style={style}>{content}</View>;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      android_ripple={{ color: t.text + '11' }}
      style={({ pressed }) => [style, { opacity: pressed ? 0.7 : 1 }]}
    >
      {content}
    </Pressable>
  );
};

export const Badge: React.FC<{ label: string; color: string; bg: string; icon?: IconType }> = ({ label, color, bg, icon: Icon }) => (
  <View style={[ui.badge, { backgroundColor: bg }]} accessibilityLabel={label}>
    {Icon ? <Icon color={color} size={12} strokeWidth={2.5} /> : null}
    <Text style={{ fontSize: 12, fontWeight: '700', color }}>{label}</Text>
  </View>
);

export const ProgressBar: React.FC<{ progress: number; color?: string; height?: number; label?: string }> = ({ progress, color, height = 8, label }) => {
  const t = useApp().themeColors;
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: pct }}
      style={{ height, borderRadius: height / 2, backgroundColor: t.surface, overflow: 'hidden' }}
    >
      <View style={{ width: `${pct}%`, height: '100%', borderRadius: height / 2, backgroundColor: color ?? t.primaryStrong }} />
    </View>
  );
};

/** Severity-coloured banner for health flags and status messages. */
export const Banner: React.FC<{
  severity: 'info' | 'warn' | 'urgent' | 'success';
  title: string;
  body?: string;
  actions?: { label: string; onPress: () => void; testID?: string }[];
  onDismiss?: () => void;
  testID?: string;
}> = ({ severity, title, body, actions, onDismiss, testID }) => {
  const t = useApp().themeColors;
  const map = {
    info: { fg: t.info, bg: t.infoTint, Icon: Info },
    success: { fg: t.success, bg: t.successTint, Icon: Info },
    warn: { fg: t.warning, bg: t.warningTint, Icon: AlertTriangle },
    urgent: { fg: '#FFFFFF', bg: t.danger, Icon: Siren },
  }[severity];
  return (
    <View testID={testID} accessibilityRole="alert" style={[ui.banner, { backgroundColor: map.bg }]}>
      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
        <map.Icon color={map.fg} size={20} />
        <View style={{ flex: 1 }}>
          <Text style={{ ...type.label, color: map.fg }}>{title}</Text>
          {body ? <Text style={{ fontSize: 14, lineHeight: 20, color: map.fg, marginTop: 2 }}>{body}</Text> : null}
        </View>
        {onDismiss ? <IconButton icon={X} label={`Dismiss ${title}`} onPress={onDismiss} color={map.fg} size={18} /> : null}
      </View>
      {actions?.length ? (
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md, flexWrap: 'wrap' }}>
          {actions.map(a => (
            <Pressable
              key={a.label}
              testID={a.testID}
              onPress={a.onPress}
              accessibilityRole="button"
              style={({ pressed }) => [ui.bannerAction, { borderColor: map.fg, opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={{ ...type.label, color: map.fg }}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
};

export const FlagBanner: React.FC<{ flag: HealthFlag; onDismiss?: () => void }> = ({ flag, onDismiss }) => (
  <Banner
    testID={`flag-${flag.id}`}
    severity={flag.severity}
    title={flag.title}
    body={flag.body}
    onDismiss={flag.severity === 'info' ? onDismiss : undefined}
  />
);

export const StatTile: React.FC<{ icon: IconType; value: string; label: string; sub?: string; color?: string; testID?: string }> = ({ icon: Icon, value, label, sub, color, testID }) => {
  const t = useApp().themeColors;
  return (
    <Card style={{ flex: 1, marginBottom: 0 }} accessibilityLabel={`${label}: ${value}${sub ? `, ${sub}` : ''}`}>
      <Icon color={color ?? t.primaryStrong} size={22} />
      <Text testID={testID} style={{ fontSize: 24, fontWeight: '800', color: color ?? t.primaryStrong, marginTop: space.sm }}>{value}</Text>
      <Text style={{ ...type.caption, color: t.textMuted, marginTop: 2 }}>{label}</Text>
      {sub ? <Text style={{ fontSize: 12, color: t.subtext, marginTop: 2 }}>{sub}</Text> : null}
    </Card>
  );
};

export const EmptyState: React.FC<{ icon: IconType; title: string; body?: string; action?: { label: string; onPress: () => void; testID?: string } }> = ({ icon: Icon, title, body, action }) => {
  const t = useApp().themeColors;
  return (
    <View style={{ alignItems: 'center', padding: space.xl, gap: space.sm }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: t.tint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon color={t.primaryStrong} size={28} />
      </View>
      <Text style={{ ...type.heading, color: t.text, textAlign: 'center' }}>{title}</Text>
      {body ? <Text style={{ fontSize: 14, lineHeight: 20, color: t.textMuted, textAlign: 'center' }}>{body}</Text> : null}
      {action ? <Button label={action.label} onPress={action.onPress} testID={action.testID} style={{ marginTop: space.sm, alignSelf: 'stretch' }} /> : null}
    </View>
  );
};

export const Segmented: React.FC<{
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}> = ({ options, value, onChange }) => {
  const t = useApp().themeColors;
  return (
    <View accessibilityRole="radiogroup" style={[ui.segmented, { backgroundColor: t.surface }]}>
      {options.map(o => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
            style={[ui.segment, on && { backgroundColor: t.card, elevation: 1 }]}
          >
            <Text style={{ ...type.label, color: on ? t.primaryStrong : t.textMuted }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

export const Stepper: React.FC<{ value: number; onChange: (v: number) => void; min: number; max: number; suffix: string; label: string }> = ({ value, onChange, min, max, suffix, label }) => {
  const t = useApp().themeColors;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xl, paddingVertical: space.sm }}>
      <Pressable
        onPress={() => onChange(Math.max(min, value - 1))}
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${label}`}
        style={[ui.stepperBtn, { borderColor: t.border, backgroundColor: t.card }]}
      >
        <Text style={{ fontSize: 26, color: t.primaryStrong, fontWeight: '600' }}>−</Text>
      </Pressable>
      <View
        style={{ alignItems: 'center', minWidth: 110 }}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ text: `${value} ${suffix}` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={e => onChange(e.nativeEvent.actionName === 'increment' ? Math.min(max, value + 1) : Math.max(min, value - 1))}
      >
        <Text style={{ fontSize: 36, fontWeight: '800', color: t.primaryStrong }}>{value}</Text>
        <Text style={{ ...type.caption, color: t.subtext }}>{suffix}</Text>
      </View>
      <Pressable
        onPress={() => onChange(Math.min(max, value + 1))}
        accessibilityRole="button"
        accessibilityLabel={`Increase ${label}`}
        style={[ui.stepperBtn, { borderColor: t.border, backgroundColor: t.card }]}
      >
        <Text style={{ fontSize: 26, color: t.primaryStrong, fontWeight: '600' }}>+</Text>
      </Pressable>
    </View>
  );
};

export const ui = StyleSheet.create({
  card: {
    borderRadius: radius.lg, padding: space.lg, marginBottom: space.md, borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 16, elevation: 1,
  },
  sectionLabel: { ...type.caption, textTransform: 'uppercase', letterSpacing: 1, marginBottom: space.md, marginLeft: space.xs },
  header: {
    paddingHorizontal: space.lg, minHeight: 60, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm,
  },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  headerSubtitle: { fontSize: 13, marginTop: 2 },
  button: { borderRadius: radius.pill, minHeight: 52, paddingHorizontal: space.xl, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  buttonCompact: { minHeight: TOUCH, paddingHorizontal: space.lg },
  buttonText: { fontWeight: '800', fontSize: 16 },
  iconButton: { width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, alignItems: 'center', justifyContent: 'center' },
  chip: {
    alignItems: 'center', justifyContent: 'center', minHeight: 64, paddingVertical: space.sm, paddingHorizontal: space.sm,
    borderRadius: radius.md, borderWidth: 2, gap: 4, overflow: 'hidden',
  },
  chipLabel: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  settingsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 56, gap: space.md },
  settingsText: { fontSize: 16, fontWeight: '600' },
  settingsValue: { fontSize: 14, maxWidth: 170 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  banner: { borderRadius: radius.md, padding: space.lg, marginBottom: space.md },
  bannerAction: { borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: space.lg, minHeight: 40, justifyContent: 'center' },
  segmented: { flexDirection: 'row', borderRadius: radius.pill, padding: 4, gap: 4 },
  segment: { flex: 1, minHeight: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.sm },
  stepperBtn: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
});
