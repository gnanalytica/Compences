/**
 * System, Light or Dark, chosen per browser in the profile menu.
 *
 * The choice lives in localStorage rather than a cookie: the server would have
 * to read a cookie in the root layout, and that makes every page dynamic.
 * Instead APPEARANCE_SCRIPT reads it in <head> and marks <html> before the
 * first paint, and globals.css does the rest. No mark means System.
 */
export const APPEARANCE_KEY = 'compences-theme';

/**
 * The browser's own toolbar, matched to the app header in each appearance: the
 * page's ivory, which the see-through header shows. The root layout renders
 * one tag per device appearance for
 * System, as its own <meta> tags rather than through Next's viewport export,
 * which re-creates them on every client-side navigation.
 *
 * Light or Dark adds a third, first in <head>: a browser takes the first
 * theme-color whose media matches, so it wins without the layout's own tags
 * ever being edited, which React would otherwise put back as duplicates.
 */
export const THEME_COLOR = { light: '#f8f5f1', dark: '#100e0c' } as const;

/** The id of the tag Light or Dark adds; System removes it. */
export const CHOSEN_THEME_COLOR_ID = 'theme-color-chosen';

export const APPEARANCE_SCRIPT = `try{const t=localStorage.getItem('${APPEARANCE_KEY}');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t;const m=document.createElement('meta');m.name='theme-color';m.id='${CHOSEN_THEME_COLOR_ID}';m.content=${JSON.stringify(THEME_COLOR)}[t];document.head.prepend(m)}}catch{}`;
