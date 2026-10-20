import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import {
  BUDGET_SERIES,
  budgetArcs,
  formatMoney,
  groupBudget,
  oklchToHex,
  type BudgetBar,
  type BudgetBill,
  type BudgetGroup,
  type BudgetItem,
  type BudgetView,
} from '@compences/core';
import { useTheme } from '../lib/use-theme';
import { fonts, minTapTarget, radius, spacing } from '../lib/theme';
import { Body, Caption } from './ui';

/**
 * The budget against what was spent, as the web draws it: a ring split by
 * vendor or by service, each share filled as far as it has been spent, then a
 * bar for each. Tapping a bar opens it into its line items and the bills paid
 * out of each. Only approved bills count.
 */
export function BudgetChart<B extends BudgetBill>({
  lines,
  bills,
  currency,
  renderBill,
}: {
  lines: BudgetItem[];
  bills: B[];
  currency: string;
  /** One approved bill, as the screen shows it elsewhere. */
  renderBill: (bill: B) => ReactNode;
}) {
  const { colors, isDark } = useTheme();
  const [view, setView] = useState<BudgetView>('vendor');
  const [open, setOpen] = useState<string[]>([]);
  const { groups, total, outside } = useMemo(
    () => groupBudget(lines, bills, view),
    [lines, bills, view],
  );
  const series = useMemo(
    () => BUDGET_SERIES[isDark ? 'dark' : 'light'].map((colour) => oklchToHex(colour)),
    [isDark],
  );
  const colourOf = (group: BudgetGroup<B>, index: number) =>
    group.kind === 'unplanned' ? colors.warning : series[index % series.length]!;
  const pending = lines.reduce((sum, line) => sum + (line.pending ?? 0), 0);
  const toggle = (key: string) =>
    setOpen((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
    );

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
        <Ring
          groups={groups}
          total={total}
          colourOf={colourOf}
          focus={open}
          view={view}
          currency={currency}
        />
        <View style={{ flex: 1, gap: spacing.sm }}>
          <Figure label="Spent" value={formatMoney(total.spent, currency)} strong />
          <Figure
            label="Budget"
            value={total.planned > 0 ? formatMoney(total.planned, currency) : 'Not set'}
          />
          {total.over > 0 ? (
            <Figure label="Over budget" value={formatMoney(total.over, currency)} tone="danger" />
          ) : total.planned > 0 ? (
            <Figure label="Left" value={formatMoney(total.planned - total.spent, currency)} />
          ) : null}
          {outside > 0 ? (
            <Figure
              label="Outside the budget"
              value={formatMoney(outside, currency)}
              tone="warning"
            />
          ) : pending > 0 ? (
            <Figure label="Waiting for approval" value={formatMoney(pending, currency)} />
          ) : null}
        </View>
      </View>

      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Show the budget by"
        style={{
          flexDirection: 'row',
          gap: 4,
          padding: 4,
          borderRadius: radius.sm,
          backgroundColor: colors.surfaceSunken,
        }}
      >
        {(['vendor', 'service'] as const).map((option) => (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ selected: view === option }}
            onPress={() => {
              setView(option);
              setOpen([]);
            }}
            style={{
              flex: 1,
              minHeight: 36,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.sm - 3,
              backgroundColor: view === option ? colors.surfaceRaised : 'transparent',
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: view === option ? colors.ink : colors.inkMuted,
              }}
            >
              {option === 'vendor' ? 'By vendor' : 'By service'}
            </Text>
          </Pressable>
        ))}
      </View>
      <Caption>Tap a bar to see its line items and bills.</Caption>

      <View style={{ gap: spacing.xs }}>
        {groups.map((group, index) => (
          <GroupRow
            key={group.key}
            group={group}
            colour={colourOf(group, index)}
            open={open.includes(group.key)}
            onToggle={() => toggle(group.key)}
            currency={currency}
            renderBill={renderBill}
          />
        ))}
      </View>
    </View>
  );
}

function Figure({
  label,
  value,
  strong = false,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: 'danger' | 'warning';
}) {
  const { colors } = useTheme();
  return (
    <View>
      <Caption>{label}</Caption>
      <Text
        style={{
          color: tone ? colors[tone] : colors.ink,
          fontSize: strong ? 20 : 15,
          fontWeight: '600',
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
    </View>
  );
}

const SIZE = 132;
const RADIUS = 50;
const STROKE = 15;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** The whole plan as a ring, one arc per group; the pale part is still to be spent. */
function Ring<B extends BudgetBill>({
  groups,
  total,
  colourOf,
  focus,
  view,
  currency,
}: {
  groups: BudgetGroup<B>[];
  total: BudgetBar;
  colourOf: (group: BudgetGroup<B>, index: number) => string;
  focus: string[];
  view: BudgetView;
  currency: string;
}) {
  const { colors } = useTheme();
  const arcs = budgetArcs(groups);
  const gap = arcs.length > 1 ? 1.4 : 0;
  const centre = SIZE / 2;
  const described = groups
    .filter((group) => group.planned > 0)
    .map(
      (group) =>
        `${group.label}: ${formatMoney(group.planned, currency)} planned, ${formatMoney(group.spent, currency)} spent`,
    )
    .join('; ');

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={
        total.planned > 0 ? `The budget by ${view}. ${described}.` : 'No budget has been set yet.'
      }
      style={{ width: SIZE, height: SIZE }}
    >
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <G rotation={-90} origin={`${centre}, ${centre}`}>
          <Circle
            cx={centre}
            cy={centre}
            r={RADIUS}
            fill="none"
            stroke={colors.surfaceSunken}
            strokeWidth={STROKE}
          />
          {arcs.map((arc) => {
            const index = groups.findIndex((group) => group.key === arc.key);
            const colour = colourOf(groups[index]!, index);
            const length = Math.max(0, arc.length * CIRCUMFERENCE - gap);
            const offset = -arc.start * CIRCUMFERENCE;
            const dimmed = focus.length > 0 && !focus.includes(arc.key);
            return (
              <G key={arc.key} opacity={dimmed ? 0.3 : 1}>
                <Circle
                  cx={centre}
                  cy={centre}
                  r={RADIUS}
                  fill="none"
                  stroke={colour}
                  strokeOpacity={0.28}
                  strokeWidth={STROKE}
                  strokeDasharray={`${length} ${CIRCUMFERENCE}`}
                  strokeDashoffset={offset}
                />
                <Circle
                  cx={centre}
                  cy={centre}
                  r={RADIUS}
                  fill="none"
                  stroke={colour}
                  strokeWidth={STROKE}
                  strokeDasharray={`${length * arc.filled} ${CIRCUMFERENCE}`}
                  strokeDashoffset={offset}
                />
              </G>
            );
          })}
        </G>
      </Svg>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {total.planned > 0 ? (
          <>
            <Text
              style={{
                fontFamily: fonts.serif,
                fontSize: 26,
                color: total.over > 0 ? colors.danger : colors.ink,
              }}
            >
              {Math.round((total.spent / total.planned) * 100)}%
            </Text>
            <Caption>spent</Caption>
          </>
        ) : (
          <Caption>No budget set</Caption>
        )}
      </View>
    </View>
  );
}

function GroupRow<B extends BudgetBill>({
  group,
  colour,
  open,
  onToggle,
  currency,
  renderBill,
}: {
  group: BudgetGroup<B>;
  colour: string;
  open: boolean;
  onToggle: () => void;
  currency: string;
  renderBill: (bill: B) => ReactNode;
}) {
  const { colors } = useTheme();
  const unplanned = group.kind === 'unplanned';
  const count = unplanned ? group.bills.length : group.items.length;
  const noun = unplanned
    ? count === 1
      ? 'bill'
      : 'bills'
    : group.kind === 'vendor'
      ? count === 1
        ? 'service'
        : 'services'
      : count === 1
        ? 'vendor'
        : 'vendors';

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: spacing.sm,
        gap: spacing.sm,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityHint={open ? 'Hides its line items' : 'Shows its line items and bills'}
        onPress={onToggle}
        style={({ pressed }) => ({ gap: 6, minHeight: minTapTarget, opacity: pressed ? 0.7 : 1 })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colour }} />
          <View style={{ flex: 1 }}>
            <Body>{group.label}</Body>
            <Caption>
              {count} {noun}
            </Caption>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Body>{formatMoney(group.spent, currency)}</Body>
            {unplanned ? null : <Caption>of {formatMoney(group.planned, currency)}</Caption>}
          </View>
          <Text style={{ color: colors.inkSubtle, fontSize: 14 }}>{open ? '▴' : '▾'}</Text>
        </View>
        <Bar bar={group.bar} colour={colour} height={10} />
        <Status bar={group.bar} currency={currency} />
      </Pressable>

      {open ? (
        <View
          style={{
            gap: spacing.md,
            borderLeftWidth: 2,
            borderLeftColor: colour,
            paddingLeft: spacing.md,
            marginBottom: spacing.sm,
          }}
        >
          {unplanned
            ? group.bills.map((bill) => (
                <View key={bill.id} style={{ gap: 2 }}>
                  <Caption tone="warning">
                    {[bill.category, bill.vendor].filter(Boolean).join(' · ') || 'No budget line'}
                  </Caption>
                  {renderBill(bill)}
                </View>
              ))
            : group.items.map((item) => (
                <View key={item.line.id} style={{ gap: spacing.xs }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      gap: spacing.md,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Body>{item.label}</Body>
                    </View>
                    <Body muted>
                      {formatMoney(item.line.approved, currency)} of{' '}
                      {formatMoney(item.line.planned, currency)}
                    </Body>
                  </View>
                  <Bar bar={item.bar} colour={colour} height={6} />
                  <Status bar={item.bar} currency={currency} />
                  {(item.line.pending ?? 0) > 0 ? (
                    <Caption>
                      {formatMoney(item.line.pending ?? 0, currency)} waiting for approval
                    </Caption>
                  ) : null}
                  {item.bills.length ? (
                    item.bills.map((bill) => <View key={bill.id}>{renderBill(bill)}</View>)
                  ) : (
                    <Caption>No bills approved against this yet.</Caption>
                  )}
                </View>
              ))}
        </View>
      ) : null}
    </View>
  );
}

function Status({ bar, currency }: { bar: BudgetBar; currency: string }) {
  if (bar.unplanned) return <Caption>Paid without a budget line behind it</Caption>;
  if (bar.over > 0) return <Caption tone="danger">{formatMoney(bar.over, currency)} over</Caption>;
  return (
    <Caption>
      {formatMoney(bar.planned - bar.spent, currency)} left · {bar.percent}% spent
    </Caption>
  );
}

/**
 * Spent against plan in the group's colour. Past the plan the bar is full:
 * the plan in colour and the part beyond it in red.
 */
function Bar({ bar, colour, height }: { bar: BudgetBar; colour: string; height: number }) {
  const { colors } = useTheme();
  const within = bar.over > 0 ? (bar.planned / bar.spent) * 100 : bar.percent;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: bar.percent }}
      style={{
        height,
        borderRadius: height / 2,
        overflow: 'hidden',
        flexDirection: 'row',
        backgroundColor: colors.surfaceSunken,
      }}
    >
      <View
        style={{ width: `${within}%`, backgroundColor: bar.unplanned ? colors.warning : colour }}
      />
      {bar.over > 0 ? (
        <View
          style={{
            width: `${100 - within}%`,
            backgroundColor: colors.danger,
            borderLeftWidth: 2,
            borderLeftColor: colors.surfaceRaised,
          }}
        />
      ) : null}
    </View>
  );
}
