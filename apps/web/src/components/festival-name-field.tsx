'use client';

import { useId, useRef, useState, type ReactNode } from 'react';
import { CalendarClock } from 'lucide-react';
import {
  festivalById,
  festivalEventDraft,
  formatDate,
  nextFestivalDate,
  searchFestivals,
  type CalendarFestival,
} from '@compences/core';
import { Field, Input } from '@/components/ui/field';
import { FestivalTile } from '@/components/festival';

export type FestivalDraft = ReturnType<typeof festivalEventDraft>;

/**
 * The event's name, with the year's festivals offered as you type.
 *
 * Starting Ganesh Chaturthi meant knowing when Ganesh Chaturthi is, typing the
 * name and the year, and finding the date in another app. Three letters does
 * all of it now — and typing something that is not a festival at all is
 * unchanged, because the box suggests and never restricts. That matters more
 * than the suggestions: most of what a society runs is a summer camp or a
 * cleanliness drive, not a festival.
 *
 * Picking one fills the date in too, which is the part that has to be handled
 * carefully. Only the fixed days — Republic Day, Christmas, Sankranti — are
 * dates this app knows. The rest move, so the field says so underneath rather
 * than letting a filled-in box pass for a checked one.
 */
export function FestivalNameField({
  value,
  onChange,
  onPick,
  error,
  today,
}: {
  value: string;
  onChange: (name: string) => void;
  /** Fired with the whole draft: the caller fills the date and the emoji. */
  onPick: (draft: FestivalDraft, entry: CalendarFestival) => void;
  error?: string | undefined;
  /** The society's today, so December offers next January's Sankranti. */
  today: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const blurring = useRef<number | null>(null);

  const matches = open ? searchFestivals(value, today) : [];

  const choose = (entry: CalendarFestival) => {
    const draft = festivalEventDraft(entry, today);
    onChange(draft.name);
    onPick(draft, entry);
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!open || !matches.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => (index + 1) % matches.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => (index - 1 + matches.length) % matches.length);
    } else if (event.key === 'Enter') {
      // Only when a suggestion is highlighted: otherwise Enter belongs to the
      // form, and stealing it from somebody typing their own event name is
      // exactly the kind of help nobody asked for.
      const entry = matches[active];
      if (entry) {
        event.preventDefault();
        choose(entry);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <Field label="Name" htmlFor="ne-name" error={error} required>
        {(control) => (
          <Input
            {...control}
            name="name"
            placeholder="Diwali, Independence Day, summer camp…"
            required
            autoComplete="off"
            role="combobox"
            aria-expanded={open && matches.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              open && matches[active] ? `${listId}-${matches[active].id}` : undefined
            }
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
              setActive(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            // A click on a suggestion blurs the input before it lands, so the
            // close waits a tick for the click to happen.
            onBlur={() => {
              blurring.current = window.setTimeout(() => setOpen(false), 120);
            }}
            onKeyDown={onKeyDown}
          />
        )}
      </Field>

      {open && matches.length ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Festivals and holidays"
          className="border-border-base bg-surface-raised absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border shadow-lg"
          onMouseDown={() => {
            if (blurring.current) window.clearTimeout(blurring.current);
          }}
        >
          {matches.map((entry, index) => {
            const when = nextFestivalDate(entry, today);
            return (
              <li key={entry.id}>
                <button
                  id={`${listId}-${entry.id}`}
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(entry)}
                  className={
                    index === active
                      ? 'bg-surface-sunken flex w-full items-center gap-3 px-3 py-2 text-left pointer-coarse:min-h-11'
                      : 'hover:bg-surface-sunken flex w-full items-center gap-3 px-3 py-2 text-left pointer-coarse:min-h-11'
                  }
                >
                  <FestivalTile
                    festival={festivalById(entry.palette)}
                    className="size-8 rounded-[10px]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="text-ink block truncate text-sm font-medium">
                      {entry.name}
                    </span>
                    <span className="text-ink-subtle block truncate text-xs">
                      {formatDate(when.startsOn)}
                      {when.exact ? '' : ' · approximate'}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * What the app is willing to say about a date it filled in itself.
 *
 * Shown under the date whenever the festival moves. A society that puts the
 * wrong day on sixty notice boards because an app looked confident is worse
 * off than one that was never offered the help.
 *
 * A function rather than a component because Field takes a `hint` and decides
 * whether to render the paragraph that holds it. A component that returns null
 * is still a truthy element, so Field drew an empty <p> on every exact date
 * and pointed aria-describedby at it — a screen reader announcing a field as
 * described by nothing at all.
 */
export function approximateDateNote(draft: FestivalDraft | null): ReactNode {
  if (!draft || draft.exact) return undefined;
  return (
    <span className="text-warning flex items-start gap-1.5">
      <CalendarClock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span>
        {draft.name.replace(/\s+\d{4}$/, '')} falls in {draft.window} and moves from year to year.
        Check the date before you publish.
      </span>
    </span>
  );
}
