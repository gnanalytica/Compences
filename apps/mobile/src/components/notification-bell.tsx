import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { useUnreadCount } from '../lib/notifications';
import { radius, spacing } from '../lib/theme';
import { useTheme } from '../lib/use-theme';

/**
 * The header bell on every tab, with the unread count. `compact` when it
 * sits beside the Me button, so the two read as a pair rather than as two
 * things a thumb's width apart.
 */
export function NotificationBell({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { colors } = useTheme();
  const unread = useUnreadCount();
  const label = unread > 99 ? '99+' : String(unread);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unread ? `Notifications, ${unread} unread` : 'Notifications'}
      onPress={() => router.push('/notifications')}
      hitSlop={8}
      style={({ pressed }) => ({
        paddingHorizontal: compact ? spacing.sm : spacing.lg,
        paddingVertical: spacing.xs,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Bell size={22} color={colors.ink} strokeWidth={1.8} />
      {unread > 0 ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            right: compact ? 0 : spacing.sm,
            minWidth: 18,
            height: 18,
            paddingHorizontal: 4,
            borderRadius: radius.pill,
            backgroundColor: colors.danger,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '700' }}>{label}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
