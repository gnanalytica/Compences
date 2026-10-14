'use client';

import { useId, useSyncExternalStore } from 'react';
import { SunMoon } from 'lucide-react';
import { APPEARANCE_CHOICES, parseAppearance, type AppearanceChoice } from '@compences/core';
import { APPEARANCE_KEY, CHOSEN_THEME_COLOR_ID, THEME_COLOR } from '@/lib/appearance';
import { cn } from '@/lib/utils';

// What the page is showing is the mark on <html>, so that is what the buttons
// read. Watching it also keeps the sidebar's menu and the phone header's menu,
// which are both on the page, in step with each other.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

const current = () => parseAppearance(document.documentElement.dataset.theme);

// The server cannot see what this browser saved.
const onServer = (): AppearanceChoice => 'system';

function choose(choice: AppearanceChoice) {
  const root = document.documentElement;
  if (choice === 'system') delete root.dataset.theme;
  else root.dataset.theme = choice;
  // The browser toolbar follows: a tag of its own for Light or Dark, first in
  // <head> so it wins, and none for System, which leaves the device's pair.
  let chosen = document.getElementById(CHOSEN_THEME_COLOR_ID) as HTMLMetaElement | null;
  if (choice === 'system') {
    chosen?.remove();
  } else {
    if (!chosen) {
      chosen = document.createElement('meta');
      chosen.name = 'theme-color';
      chosen.id = CHOSEN_THEME_COLOR_ID;
      document.head.prepend(chosen);
    }
    chosen.content = THEME_COLOR[choice];
  }
  try {
    if (choice === 'system') localStorage.removeItem(APPEARANCE_KEY);
    else localStorage.setItem(APPEARANCE_KEY, choice);
  } catch {
    // Storage can be blocked. This page still changes; the next one forgets.
  }
}

/** System, Light or Dark for this browser, in the profile menu. */
export function AppearanceSwitch() {
  const labelId = useId();
  const choice = useSyncExternalStore(subscribe, current, onServer);
  return (
    <div className="px-3 py-2">
      <p id={labelId} className="text-ink-muted flex items-center gap-2.5 text-sm">
        <SunMoon className="size-4" aria-hidden="true" />
        Appearance
      </p>
      <div
        role="group"
        aria-labelledby={labelId}
        className="bg-surface-sunken mt-2 flex gap-1 rounded-lg p-1"
      >
        {APPEARANCE_CHOICES.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={choice === option.id}
            onClick={() => choose(option.id)}
            className={cn(
              'flex-1 rounded-md px-1 py-1.5 text-xs font-medium transition-colors pointer-coarse:min-h-11',
              choice === option.id
                ? 'bg-surface-raised text-ink shadow-sm'
                : 'text-ink-muted hover:text-ink',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
