import { useState } from 'react';
import { Linking, ScrollView, Share, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { can, joinLink, residentInviteMessage, whatsappShareUrl } from '@compences/core';
import { useAuth } from '../../src/lib/auth';
import { SITE_URL } from '../../src/lib/site';
import {
  Body,
  Button,
  Caption,
  Card,
  EmptyState,
  Heading,
  Screen,
  Title,
} from '../../src/components/ui';
import { spacing } from '../../src/lib/theme';
import { useTheme } from '../../src/lib/use-theme';

/**
 * Hand out the society code: to staff (who then get admitted as staff) or to
 * residents through the society's WhatsApp group.
 */
export default function ShareCode() {
  const router = useRouter();
  const { colors } = useTheme();
  const { for: audience } = useLocalSearchParams<{ for?: string }>();
  const { role, activeCommunity } = useAuth();
  const [copied, setCopied] = useState<string | null>(null);

  if (!can(role, 'joinrequests:review') || !activeCommunity) {
    return (
      <Screen>
        <EmptyState title="Staff and committee only" />
      </Screen>
    );
  }

  const forStaff = audience === 'staff';
  const code = activeCommunity.join_code;
  const link = joinLink(SITE_URL, code);
  const message = forStaff
    ? [
        `Join ${activeCommunity.name} on Compences as staff.`,
        '',
        `1. Open ${link}`,
        '2. Sign in with Google',
        `3. Society code: ${code}`,
        '4. Enter your details and choose “I work for the society”',
        '',
        'The committee will then admit you as staff.',
      ].join('\n')
    : residentInviteMessage({ societyName: activeCommunity.name, code, link });

  const copy = async (value: string, what: string) => {
    await Clipboard.setStringAsync(value);
    setCopied(what);
  };

  const openWhatsApp = async () => {
    const app = `whatsapp://send?text=${encodeURIComponent(message)}`;
    try {
      await Linking.openURL(app);
    } catch {
      // No WhatsApp on this phone: the web link still opens a chooser.
      await Linking.openURL(whatsappShareUrl(message));
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <View style={{ gap: 2 }}>
          <Title>{forStaff ? 'Bring in staff' : 'Invite residents'}</Title>
          <Caption>
            {forStaff
              ? 'Send this to your supervisor or facility manager. When their request arrives, admit them as staff.'
              : 'Post this in your society’s WhatsApp group. Everyone uses the same code, and staff approve each request.'}
          </Caption>
        </View>

        <Card style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl }}>
          <Caption>SOCIETY CODE</Caption>
          <Text
            selectable
            style={{ color: colors.ink, fontSize: 30, fontWeight: '700', letterSpacing: 4 }}
          >
            {code}
          </Text>
          <Caption>{link}</Caption>
        </Card>

        <Card style={{ gap: spacing.sm }}>
          <Heading>Message</Heading>
          <Body muted>{message}</Body>
        </Card>

        <Button label="Share on WhatsApp" onPress={() => void openWhatsApp()} />
        <Button
          label="Share another way"
          variant="secondary"
          onPress={() => void Share.share({ message })}
        />
        <Button
          label={copied === 'link' ? 'Link copied' : 'Copy join link'}
          variant="secondary"
          onPress={() => void copy(link, 'link')}
        />
        <Button
          label={copied === 'code' ? 'Code copied' : 'Copy society code'}
          variant="secondary"
          onPress={() => void copy(code, 'code')}
        />
        {forStaff ? (
          <Button
            label="Open join requests"
            variant="secondary"
            onPress={() => router.push('/admin/requests')}
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}
