import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { UserRound } from 'lucide-react-native';
import { useAuth } from '../lib/auth';
import { minTapTarget, spacing } from '../lib/theme';
import { useTheme } from '../lib/use-theme';
import { NotificationBell } from './notification-bell';

/**
 * The right of every tab's header: the bell, and a round button with your
 * initial that opens Me. Me left the tab bar when the marketplace took its
 * slot (1118.0100); a face in the corner is where most apps keep "you", so it
 * is where people look for their profile, their societies and signing out.
 */
export function HeaderActions() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: spacing.md }}>
      <NotificationBell compact />
      <MeButton />
    </View>
  );
}

/** The person's initial in a circle; opens Me. */
export function MeButton() {
  const router = useRouter();
  const { colors } = useTheme();
  const { profile } = useAuth();
  const initial = profile?.full_name?.trim().charAt(0).toUpperCase() || '';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Me"
      accessibilityHint="Your profile, societies, settings and sign out"
      onPress={() => router.push('/me')}
      hitSlop={6}
      style={({ pressed }) => ({
        minWidth: minTapTarget,
        minHeight: minTapTarget,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          borderWidth: 1.5,
          borderColor: colors.ink,
          backgroundColor: colors.surfaceRaised,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {initial ? (
          <Text
            allowFontScaling={false}
            style={{ color: colors.ink, fontSize: 13, fontWeight: '700' }}
          >
            {initial}
          </Text>
        ) : (
          <UserRound size={16} color={colors.ink} strokeWidth={2} />
        )}
      </View>
    </Pressable>
  );
}
