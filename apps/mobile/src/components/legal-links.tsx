import { Pressable, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { SITE_URL } from '../lib/site';
import { minTapTarget, spacing } from '../lib/theme';
import { useTheme } from '../lib/use-theme';

/**
 * The Privacy Policy and Terms, reachable from inside the app.
 *
 * Both stores require the privacy policy to be linked in the app itself, not
 * only from the listing. The documents live on the website so there is one
 * copy of each; they open in an in-app browser so the person can come back.
 */
export function LegalLinks({ intro }: { intro?: string }) {
  const { colors } = useTheme();

  const link = (label: string, path: string) => (
    <Pressable
      accessibilityRole="link"
      onPress={() => void WebBrowser.openBrowserAsync(`${SITE_URL}${path}`)}
      hitSlop={8}
      style={{ minHeight: minTapTarget, justifyContent: 'center' }}
    >
      <Text style={{ color: colors.accent, fontSize: 13, textDecorationLine: 'underline' }}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View style={{ alignItems: 'center', gap: spacing.xs }}>
      {intro ? (
        <Text style={{ color: colors.inkSubtle, fontSize: 12, textAlign: 'center' }}>{intro}</Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: spacing.lg }}>
        {link('Privacy Policy', '/privacy')}
        {link('Terms & Conditions', '/terms')}
      </View>
    </View>
  );
}
