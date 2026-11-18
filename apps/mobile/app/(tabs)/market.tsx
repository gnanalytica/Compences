import { useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  LISTING_CATEGORIES,
  LISTING_CATEGORY_LABEL,
  LISTING_KINDS,
  LISTING_KIND_PLURAL,
  can,
  type ListingCategory,
  type ListingKind,
} from '@compences/core';
import { useAuth } from '../../src/lib/auth';
import {
  fetchBoard,
  matchesSearch,
  onTheBoard,
  shopsBySeller,
  sortBoard,
} from '../../src/lib/market';
import { useCommunityData } from '../../src/lib/use-community-data';
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
} from '../../src/components/ui';
import { Chip } from '../../src/components/admin-ui';
import { ListingCard } from '../../src/components/market-ui';
import { spacing } from '../../src/lib/theme';

/**
 * The marketplace, on the tab bar: what neighbours make, teach and offer,
 * one-off things for sale, what somebody is looking for, residents' shops,
 * and the outside businesses the committee recommends.
 *
 * The best-reviewed first, weighed by how many reviews there are, then the
 * newest, so a listing posted this morning is not buried under ones from
 * last year that nobody has rated. A seasonal listing past its last day
 * leaves the board without its seller having to remember, and so does
 * anything marked sold or found.
 *
 * Filters by kind first, then by category within it — only the kinds and
 * categories something is in: a chip that leads to an empty list teaches
 * people to stop tapping chips.
 *
 * The seller's own listings sit below the board in every state, their shop
 * first, paused, sold and taken down included, because "where did my listing
 * go?" deserves an answer on the screen where they look for it.
 */
export default function Market() {
  const router = useRouter();
  const { viewRole, membershipId } = useAuth();
  const [kind, setKind] = useState<ListingKind | null>(null);
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
  const mayAddBusiness = can(viewRole, 'marketplace:business');
  const mayModerate = can(viewRole, 'marketplace:moderate');
  const board = sortBoard(all.filter(onTheBoard));
  const shops = shopsBySeller(all);
  const mine = all
    .filter((listing) => listing.membershipId === membershipId)
    .sort((a, b) => Number(b.kind === 'shop') - Number(a.kind === 'shop'));
  const takenDown = mayModerate
    ? all.filter((listing) => listing.status === 'removed' && listing.membershipId !== membershipId)
    : [];

  const kinds = LISTING_KINDS.filter((option) => board.some((listing) => listing.kind === option));
  const ofKind = kind === null ? board : board.filter((listing) => listing.kind === kind);
  const categories = LISTING_CATEGORIES.filter((option) =>
    ofKind.some((listing) => listing.category === option),
  );
  const shown = ofKind.filter(
    (listing) =>
      (category === null || listing.category === category) && matchesSearch(listing, search),
  );

  const open = (id: string) => router.push({ pathname: '/listing/[id]', params: { id } });
  const post = () => router.push('/listing/new');
  const pickKind = (next: ListingKind | null) => {
    setKind(next);
    // A category from another kind's list would leave nothing to show.
    setCategory(null);
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        keyboardShouldPersistTaps="handled"
      >
        <Caption>
          {board.length
            ? `${board.length} ${board.length === 1 ? 'thing' : 'things'} from your neighbours and the businesses the committee recommends`
            : 'What your neighbours sell, offer and are looking for'}
        </Caption>

        {mayPost || mayAddBusiness ? (
          <Button label={mayPost ? 'Post something' : 'Add a local business'} onPress={post} />
        ) : null}

        {error ? <Caption tone="danger">{error}</Caption> : null}

        {board.length ? (
          <>
            <Input
              value={search}
              onChangeText={setSearch}
              placeholder="Search cycles, batter, tuition…"
              accessibilityLabel="Search the marketplace"
              returnKeyType="search"
              autoCorrect={false}
            />
            {kinds.length > 1 ? (
              <ChipStrip>
                <Chip label="All" selected={kind === null} onPress={() => pickKind(null)} />
                {kinds.map((option) => (
                  <Chip
                    key={option}
                    label={LISTING_KIND_PLURAL[option]}
                    selected={kind === option}
                    onPress={() => pickKind(kind === option ? null : option)}
                  />
                ))}
              </ChipStrip>
            ) : null}
            {categories.length > 1 ? (
              <ChipStrip>
                <Chip
                  label="Any kind of thing"
                  selected={category === null}
                  onPress={() => setCategory(null)}
                />
                {categories.map((option) => (
                  <Chip
                    key={option}
                    label={LISTING_CATEGORY_LABEL[option]}
                    selected={category === option}
                    onPress={() => setCategory(category === option ? null : option)}
                  />
                ))}
              </ChipStrip>
            ) : null}

            {shown.length ? (
              <View style={{ gap: spacing.md }}>
                {shown.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    shops={shops}
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
                      ? `Nobody is offering “${search.trim()}” yet. Try another word, or ask for it with Post something.`
                      : 'Nothing here right now.'
                  }
                />
              </Card>
            )}
          </>
        ) : (
          <Card style={{ gap: spacing.md }}>
            <Heading>The marketplace is open</Heading>
            <Body muted>
              Fresh idly batter, Hindi classes for kids, an old cycle, a cooker to borrow, a tailor
              two floors down — whatever you make, sell or need, your neighbours would rather deal
              with you.
            </Body>
            <Body muted>
              {mayPost
                ? 'Post it here, with a number to call. Open a shop if you sell more than one thing.'
                : mayAddBusiness
                  ? 'Residents’ listings will show up here, with the local businesses you add.'
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

/** A row of chips that scrolls sideways, edge to edge so it reads as something to swipe. */
function ChipStrip({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -spacing.lg }}
      contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}
    >
      {children}
    </ScrollView>
  );
}
