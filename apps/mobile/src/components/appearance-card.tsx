import { APPEARANCE_CHOICES } from '@compences/core';
import { useAppearance } from '../lib/appearance';
import { spacing } from '../lib/theme';
import { Card, Heading } from './ui';
import { Segmented } from './admin-ui';

/** System, Light or Dark for this phone. */
export function AppearanceCard() {
  const [choice, choose] = useAppearance();
  return (
    <Card style={{ gap: spacing.md }}>
      <Heading>Appearance</Heading>
      <Segmented options={APPEARANCE_CHOICES} value={choice} onChange={choose} />
    </Card>
  );
}
