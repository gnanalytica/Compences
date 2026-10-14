import { useCallback, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CalendarCog,
  CalendarDays,
  Check,
  ChevronsUpDown,
  ClipboardCheck,
  LayoutDashboard,
  Lightbulb,
  Plus,
  Scale,
  Settings2,
  UserRound,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { COPY, VIEW_MODE_LABEL, can, type Capability } from '@compences/core';
import { useAuth } from '../lib/auth';
import { useTodoItems } from '../lib/todo';
import { fonts, minTapTarget, radius, spacing } from '../lib/theme';
import { useTheme } from '../lib/use-theme';

type Item = {
  href: Href;
  label: string;
  icon: LucideIcon;
  capability?: Capability;
  badge?: 'todo';
};

/**
 * The same destinations as the web sidebar (components/nav-items.ts), pointed
 * at this app's screens. The tab bar carries the four a member opens daily;
 * this is the rest, reached from the society name in the header.
 */
const MAIN: Item[] = [
  { href: '/', label: 'Home', icon: LayoutDashboard },
  { href: '/events', label: 'Events', icon: CalendarDays },
  { href: '/people', label: 'People', icon: Users },
  { href: '/money', label: 'Money', icon: Wallet },
  { href: '/ideas', label: 'Ideas', icon: Lightbulb },
  { href: '/me', label: 'Me', icon: UserRound },
];

const MANAGE: Item[] = [
  {
    href: '/manage',
    label: COPY.todo,
    icon: ClipboardCheck,
    capability: 'events:manage',
    badge: 'todo',
  },
  { href: '/manage', label: 'Events', icon: CalendarCog, capability: 'events:manage' },
  { href: '/admin/reconcile', label: 'Reconcile', icon: Scale, capability: 'payments:record' },
  {
    href: '/admin/society-settings',
    label: COPY.societySettings,
    icon: Settings2,
    capability: 'roles:manage',
  },
];

/**
 * The society name in the tab header, which opens the whole navigation as a
 * drawer from the left: society switcher, the committee's resident-view
 * switch, Contribute, every destination, and the Manage group for staff.
 */
export function NavDrawerButton() {
  const { colors } = useTheme();
  const { activeCommunity } = useAuth();
  const [open, setOpen] = useState(false);
  const name = activeCommunity?.name ?? '';

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open navigation"
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          minHeight: minTapTarget,
          marginLeft: spacing.lg,
          maxWidth: 220,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Monogram name={name} />
        <Text
          numberOfLines={1}
          style={{ flexShrink: 1, color: colors.ink, fontSize: 15, fontWeight: '600' }}
        >
          {name}
        </Text>
        <ChevronsUpDown size={16} color={colors.inkSubtle} />
      </Pressable>
      {open ? <NavDrawer onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function Monogram({ name }: { name: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: 28,
        height: 28,
        borderRadius: radius.sm - 2,
        backgroundColor: colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: colors.accentInk, fontSize: 12, fontWeight: '700' }}>
        {name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

function NavDrawer({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { activeCommunity, memberships, viewRole, viewMode, setViewMode, setActiveCommunity } =
    useAuth();
  const { data: todo } = useTodoItems();
  const [switching, setSwitching] = useState(false);

  const panelWidth = Math.min(320, width * 0.88);
  const [slide] = useState(() => new Animated.Value(-panelWidth));
  const [fade] = useState(() => new Animated.Value(0));

  // Slides in on mount and out before the parent unmounts it, so every way of
  // closing goes through `close`. Reduce Motion makes both instant.
  const animate = useCallback(
    (open: boolean, done?: () => void) => {
      void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
        const duration = reduced ? 0 : 220;
        Animated.parallel([
          Animated.timing(slide, {
            toValue: open ? 0 : -panelWidth,
            duration,
            useNativeDriver: true,
          }),
          Animated.timing(fade, { toValue: open ? 1 : 0, duration, useNativeDriver: true }),
        ]).start(done ? () => done() : undefined);
      });
    },
    [slide, fade, panelWidth],
  );

  useEffect(() => animate(true), [animate]);

  const close = useCallback(() => animate(false, onClose), [animate, onClose]);

  const go = useCallback(
    (href: Href) => {
      onClose();
      router.navigate(href);
    },
    [onClose, router],
  );

  const staffView = can(viewRole, 'events:manage');
  const todoCount = staffView ? (todo?.length ?? 0) : 0;
  const manage = MANAGE.filter((item) => !item.capability || can(viewRole, item.capability));

  const row = (item: Item, key: string) => {
    const Icon = item.icon;
    const count = item.badge === 'todo' ? todoCount : 0;
    return (
      <Pressable
        key={key}
        accessibilityRole="link"
        onPress={() => go(item.href)}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          minHeight: minTapTarget,
          paddingHorizontal: spacing.md,
          borderRadius: radius.md,
          backgroundColor: pressed ? colors.surfaceSunken : 'transparent',
        })}
      >
        <Icon size={20} color={colors.inkMuted} strokeWidth={1.75} />
        <Text style={{ flex: 1, color: colors.ink, fontSize: 16 }}>{item.label}</Text>
        {count ? (
          <View
            style={{
              minWidth: 22,
              paddingHorizontal: 6,
              borderRadius: radius.pill,
              backgroundColor: `${colors.warning}33`,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: colors.warning, fontSize: 12, fontWeight: '700' }}>
              {count > 99 ? '99+' : count}
            </Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={close}
    >
      <View style={{ flex: 1 }}>
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: '#00000066',
            opacity: fade,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close navigation"
            onPress={close}
            style={{ flex: 1 }}
          />
        </Animated.View>

        <Animated.View
          accessibilityViewIsModal
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: panelWidth,
            paddingTop: insets.top,
            backgroundColor: colors.surfaceRaised,
            borderRightWidth: 1,
            borderRightColor: colors.border,
            transform: [{ translateX: slide }],
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingLeft: spacing.lg,
              paddingRight: spacing.sm,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                color: colors.inkSubtle,
                fontSize: 12,
                fontWeight: '500',
                letterSpacing: 0.8,
                textTransform: 'uppercase',
              }}
            >
              {activeCommunity?.name}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close navigation"
              onPress={close}
              style={{
                width: minTapTarget,
                height: minTapTarget,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={22} color={colors.inkMuted} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{
              padding: spacing.md,
              gap: spacing.lg,
              paddingBottom: insets.bottom + spacing.lg,
            }}
          >
            <View style={{ gap: spacing.xs }}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: switching }}
                disabled={memberships.length < 2}
                onPress={() => setSwitching((value) => !value)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  minHeight: minTapTarget + 8,
                  paddingHorizontal: spacing.sm,
                }}
              >
                <Monogram name={activeCommunity?.name ?? ''} />
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    color: colors.ink,
                    fontFamily: fonts.serif,
                    fontSize: 18,
                  }}
                >
                  {activeCommunity?.name}
                </Text>
                {memberships.length > 1 ? (
                  <ChevronsUpDown size={18} color={colors.inkSubtle} />
                ) : null}
              </Pressable>
              {switching
                ? memberships.map((membership) => {
                    const active = membership.community_id === activeCommunity?.id;
                    return (
                      <Pressable
                        key={membership.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        onPress={() => {
                          setActiveCommunity(membership.community_id);
                          setSwitching(false);
                          onClose();
                        }}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          minHeight: minTapTarget,
                          paddingHorizontal: spacing.md,
                          gap: spacing.sm,
                        }}
                      >
                        <Text style={{ flex: 1, color: colors.ink, fontSize: 15 }}>
                          {membership.communities?.name}
                        </Text>
                        {active ? <Check size={18} color={colors.ink} /> : null}
                      </Pressable>
                    );
                  })
                : null}
            </View>

            {viewMode ? (
              <View
                accessibilityRole="tablist"
                style={{
                  flexDirection: 'row',
                  padding: 3,
                  borderRadius: radius.md,
                  backgroundColor: colors.surfaceSunken,
                }}
              >
                {(['committee', 'resident'] as const).map((mode) => {
                  const selected = viewMode === mode;
                  return (
                    <Pressable
                      key={mode}
                      accessibilityRole="tab"
                      accessibilityState={{ selected }}
                      onPress={() => setViewMode(mode)}
                      style={{
                        flex: 1,
                        minHeight: minTapTarget - 6,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: radius.sm,
                        backgroundColor: selected ? colors.surfaceRaised : 'transparent',
                      }}
                    >
                      <Text
                        style={{
                          color: selected ? colors.ink : colors.inkMuted,
                          fontSize: 14,
                          fontWeight: selected ? '600' : '400',
                        }}
                      >
                        {VIEW_MODE_LABEL[mode]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {can(viewRole, 'contribute') ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => go('/contribute')}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.sm,
                  minHeight: minTapTarget + 4,
                  borderRadius: radius.md,
                  backgroundColor: colors.accent,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Plus size={18} color={colors.accentInk} strokeWidth={2.2} />
                <Text style={{ color: colors.accentInk, fontSize: 16, fontWeight: '600' }}>
                  Contribute
                </Text>
              </Pressable>
            ) : null}

            <View style={{ gap: 2 }}>{MAIN.map((item) => row(item, `main:${item.label}`))}</View>

            {manage.length ? (
              <View style={{ gap: 2 }}>
                <Text
                  style={{
                    color: colors.gold,
                    fontSize: 11,
                    fontWeight: '600',
                    letterSpacing: 1.4,
                    textTransform: 'uppercase',
                    paddingHorizontal: spacing.md,
                    paddingBottom: spacing.xs,
                  }}
                >
                  {COPY.manage}
                </Text>
                {manage.map((item) => row(item, `manage:${item.label}`))}
              </View>
            ) : null}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
