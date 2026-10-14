import { View } from 'react-native';
import { VIEW_MODE_LABEL, VIEW_MODE_PREVIEW_NOTE } from '@compences/core';
import { useAuth } from '../lib/auth';
import { spacing } from '../lib/theme';
import { Body, Button, Caption, Card, Heading } from './ui';
import { Chip, ChipRow } from './admin-ui';

/**
 * Committee members usually live in the society too. This lets them see the
 * app as residents do and switch back; nothing about their access changes.
 * Renders nothing for anyone who cannot switch.
 */
export function ViewSwitchCard() {
  const { viewMode, setViewMode } = useAuth();
  if (!viewMode) return null;
  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ gap: 2 }}>
        <Heading>What you see</Heading>
        <Caption>
          {VIEW_MODE_LABEL.resident} shows what residents see. Your committee permissions are
          unchanged.
        </Caption>
      </View>
      <ChipRow>
        <Chip
          label={VIEW_MODE_LABEL.committee}
          selected={viewMode === 'committee'}
          onPress={() => setViewMode('committee')}
        />
        <Chip
          label={VIEW_MODE_LABEL.resident}
          selected={viewMode === 'resident'}
          onPress={() => setViewMode('resident')}
        />
      </ChipRow>
    </Card>
  );
}

/** A reminder on Home while the committee is using the resident view. */
export function ResidentViewBanner() {
  const { viewMode, setViewMode } = useAuth();
  if (viewMode !== 'resident') return null;
  return (
    <Card style={{ gap: spacing.sm }}>
      <Body>
        {VIEW_MODE_LABEL.resident}. {VIEW_MODE_PREVIEW_NOTE}
      </Body>
      <Button
        label="Back to committee view"
        variant="secondary"
        onPress={() => setViewMode('committee')}
      />
    </Card>
  );
}
