import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  LISTING_CATEGORIES,
  LISTING_CATEGORY_LABEL,
  can,
  type ListingCategory,
} from '@compences/core';
import { useAuth } from '../src/lib/auth';
import { fetchBoard, matchesSearch, onTheBoard, sortBoard } from '../src/lib/market';
import { useCommunityData } from '../src/lib/use-community-data';
import {
  Body,
  Button,
  Caption,
  Card,
  EmptyState,
  Heading,
  Input,
  Loading,
  Screen,
  SectionLabel,
  Title,
} from '../src/components/ui';
import { Chip } from '../src/components/admin-ui';
import { ListingCard } from '../src/components/market-ui';
import { spacing } from '../src/lib/theme';

/**
 * The marketplace: what neighbours make, teach and offer — idly batter, Hindi
 * classes, Diwali crackers, a tailor two floors down.
 *
 * The best-reviewed first, weighed by how many reviews there are, then the
 * newest, so a listing posted this morning is not buried under ones from
 * last year that nobody has rated. A seasonal listing past its last day
 * leaves the board without its seller having to remember.
 *
 * The seller's own listings sit below the board in every state, paused and
 * taken down included, because "where did my listing go?" deserves an
 * answer on the screen where they look for it.
 */
export default function Market() {
  const router = useRouter();
  const { viewRole, membershipId } = useAuth();
  const [category, setCategory] = useState<ListingCategory | null>(null);
  const [search, setSearch] = useState('');

  const { data, loading, refreshing, refresh, error } = useCommunityData('market', (communityId) =>
    fetchBoard(communityId),
  );

  if (loading && !data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const all = data ?? [];
  const mayPost = can(viewRole, 'marketplace:post');
  const mayModerate = can(viewRole, 'marketplace:moderate');
  const board = sortBoard(all.filter(onTheBoard));
  const mine = all.filter((listing) => listing.membershipId === membershipId);
  const takenDown = mayModerate
    ? all.filter((listing) => listing.status === 'removed' && listing.membershipId !== membershipId)
    : [];
  // Only the categories something is in: a chip that leads to an empty list
  // teaches people to stop tapping chips.
  const present = LISTING_CATEGORIES.filter((option) =>
    board.some((listing) => listing.category === option),
  );
  const shown = board.filter(
    (listing) =>
      (category === null || listing.category === category) && matchesSearch(listing, search),
  );

  const open = (id: string) => router.push({ pathname: '/listing/[id]', params: { id } });
  const post = () => router.push('/listing/new');

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 2 }}>
          <Title>Marketplace</Title>
          <Caption>
            {board.length
              ? `${board.length} ${board.length === 1 ? 'thing' : 'things'} your neighbours make, teach and offer`
              : 'What your neighbours make, teach and offer'}
          </Caption>
        </View>

        {mayPost ? <Button label="Post a listing" onPress={post} /> : null}

        {error ? <Caption tone="danger">{error}</Caption> : null}

        {board.length ? (
          <>
            <Input
              value={search}
              onChangeText={setSearch}
              placeholder="Search batter, tuition, tailoring…"
              accessibilityLabel="Search the marketplace"
              returnKeyType="search"
              autoCorrect={false}
            />
            {present.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                // Edge to edge, so the row reads as something to swipe.
                style={{ marginHorizontal: -spacing.lg }}
                contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}
              >
                <Chip label="All" selected={category === null} onPress={() => setCategory(null)} />
                {present.map((option) => (
                  <Chip
                    key={option}
                    label={LISTING_CATEGORY_LABEL[option]}
                    selected={category === option}
                    onPress={() => setCategory(category === option ? null : option)}
                  />
                ))}
              </ScrollView>
            ) : null}

            {shown.length ? (
              <View style={{ gap: spacing.md }}>
                {shown.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    onPress={() => open(listing.id)}
                  />
                ))}
              </View>
            ) : (
              <Card>
                <EmptyState
                  title="Nothing matches"
                  description={
                    search.trim()
                      ? `Nobody is offering “${search.trim()}” yet. Try another word, or another category.`
                      : 'Nothing in this category right now.'
                  }
                />
              </Card>
            )}
          </>
        ) : (
          <Card style={{ gap: spacing.md }}>
            <Heading>The marketplace is open</Heading>
            <Body muted>
              Fresh idly batter, Hindi classes for kids, Diwali crackers, blouse stitching, a
              birthday cake — whatever you make, teach or sell, your neighbours would rather buy it
              from you.
            </Body>
            <Body muted>
              {mayPost
                ? 'Post it here, with a number to call. Neighbours can rate what they bought.'
                : 'Residents’ listings will show up here.'}
            </Body>
            {mayPost ? (
              <Button label="Post the first listing" variant="festive" onPress={post} />
            ) : null}
          </Card>
        )}

        {mine.length ? (
          <View style={{ gap: spacing.md }}>
            <SectionLabel>Your listings</SectionLabel>
            {mine.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                showStatus
                onPress={() => open(listing.id)}
              />
            ))}
          </View>
        ) : null}

        {/* For staff and the committee: what they took down, so putting one
            back is as easy as taking it down was. */}
        {takenDown.length ? (
          <View style={{ gap: spacing.md }}>
            <SectionLabel>Taken down</SectionLabel>
            {takenDown.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                showStatus
                onPress={() => open(listing.id)}
              />
            ))}
          </View>
        ) : null}

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </Screen>
  );
}
