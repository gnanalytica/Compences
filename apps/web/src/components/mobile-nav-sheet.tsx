'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { ChevronsUpDown, X } from 'lucide-react';

/**
 * Everything the desktop sidebar has, reachable from a phone.
 *
 * The bottom bar carries four tabs and that is the right number to fit. What
 * it could not carry went nowhere: on a phone
 * there was no route at all to Manage, To do, Reconcile, Society settings, or
 * to the society switcher and the join-and-create links inside it. A committee
 * member on their phone could not approve a bill or reconcile a statement, and
 * nobody on a phone could join a second society. The sidebar was not "desktop
 * first", it was the only navigation, and half the app sat behind it.
 *
 * So the society name in the header — which was a link to Home, a place the
 * bottom bar already goes — becomes the way in. Tapping it opens the sidebar
 * as a sheet, with exactly the same children the sidebar renders, because
 * parity by construction beats parity by remembering to update two lists.
 *
 * Two of those destinations have since come back out of it, because a drawer
 * you have to know about is the wrong home for work somebody does daily:
 * Manage took one of the four tabs from staff and the committee, and joining
 * or founding a society moved onto Me. The sheet still carries the rest —
 * Money, Ideas, the whole sidebar as the desktop lists it, and the switcher.
 *
 * A sheet rather than another `<details>` menu: this is tall, it wants the
 * page not to scroll underneath it, and it wants a back gesture and Escape to
 * close it. That is enough behaviour to be worth the client component.
 */
export function MobileNavSheet({
  societyName,
  children,
}: {
  societyName: string;
  /** Server-rendered: the switcher, the view switch and the nav itself. */
  children: ReactNode;
}) {
  const pathname = usePathname();
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  // Open is derived rather than stored: the sheet belongs to the page it was
  // opened on, so navigating closes it without an effect that sets state on
  // every route change. The links inside are the whole point of the sheet, so
  // that is the ordinary way out rather than an edge case.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;
  const setOpen = (next: boolean) => setOpenedOn(next ? pathname : null);

  useEffect(() => {
    if (!open) return;

    // The sheet covers the page; letting the page scroll behind it is how you
    // close it and find yourself somewhere else.
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    // setOpenedOn rather than the setOpen helper: a state setter is stable, so
    // the listener registers once per open rather than on every render.
    //
    // defaultPrevented because the society switcher lives inside the sheet:
    // when it is open it takes the Escape and marks it handled, and the sheet
    // is the next layer out rather than the same one. Escape should peel one
    // layer, not both.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) setOpenedOn(null);
    };
    document.addEventListener('keydown', onKeyDown);

    // Growing past `md` swaps the sheet for the real sidebar. Without this the
    // sheet would merely be hidden by its own `md:hidden` while the state, and
    // so the scroll lock, stayed on — and with the trigger hidden too there
    // would be nothing left to close it. A tablet rotating into landscape, or
    // a foldable opening, is enough to cross the line.
    const wide = window.matchMedia('(min-width: 48rem)');
    const onWiden = () => {
      if (wide.matches) setOpenedOn(null);
    };
    onWiden();
    wide.addEventListener('change', onWiden);

    // Focus moves into the sheet so the next Tab is a nav link rather than
    // whatever sits behind it.
    panel.current?.focus();

    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKeyDown);
      wide.removeEventListener('change', onWiden);
    };
  }, [open]);

  // Sending focus back to the button that opened it, but only after a real
  // close — not on the first render.
  const opened = useRef(false);
  useEffect(() => {
    if (open) opened.current = true;
    else if (opened.current) trigger.current?.focus();
  }, [open]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="hover:bg-surface-sunken -mx-1 flex min-w-0 items-center gap-2 rounded-lg px-1 py-1 pointer-coarse:min-h-11"
      >
        <span className="bg-accent text-accent-ink grid size-7 shrink-0 place-items-center rounded-lg text-xs font-bold">
          {societyName.charAt(0).toUpperCase()}
        </span>
        <span className="truncate text-sm font-semibold">{societyName}</span>
        <ChevronsUpDown className="text-ink-subtle size-4 shrink-0" aria-hidden="true" />
        <span className="sr-only">Open navigation</span>
      </button>

      {/* Portalled to <body> rather than left where it sits. The phone header
          is `sticky z-30`, which makes it a stacking context, and the bottom
          nav bar is `fixed z-40` outside it — so a sheet at z-50 *inside* the
          header still paints under the bottom bar. z-index is relative to the
          context you are in, not to the page. */}
      {open
        ? createPortal(
            <div className="fixed inset-x-0 top-0 z-50 h-dvh md:hidden">
              {/* The scrim is a button so a tap anywhere outside closes the sheet,
              which is the gesture everybody tries first. */}
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setOpen(false)}
                className="bg-ink/40 absolute inset-0 w-full"
              />
              <div
                ref={panel}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-label="Navigation"
                className="border-border-base bg-surface-raised absolute inset-y-0 left-0 flex h-full w-[min(20rem,88vw)] flex-col border-r shadow-xl outline-none"
              >
                <div
                  className="border-border-base flex items-center justify-between gap-2 border-b px-3 py-2"
                  style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
                >
                  <p className="text-ink-subtle truncate px-1 text-xs font-medium tracking-wide uppercase">
                    {societyName}
                  </p>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="hover:bg-surface-sunken text-ink-muted grid size-9 place-items-center rounded-lg pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                  >
                    <X className="size-5" aria-hidden="true" />
                    <span className="sr-only">Close navigation</span>
                  </button>
                </div>
                <div
                  className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-3 py-3"
                  style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
                >
                  {children}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
