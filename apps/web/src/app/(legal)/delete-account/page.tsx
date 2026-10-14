import type { Metadata } from 'next';
import Link from 'next/link';
import { DELETE_ACCOUNT_EFFECTS, DELETE_ACCOUNT_KEPT } from '@compences/core';
import { ContactLink, LegalDocument, LegalList, LegalSection, Strong } from '@/components/legal';
import { LEGAL } from '@/lib/legal';

// The page Google Play requires: an app that lets people create an account has
// to publish a web address where account deletion can be requested, reachable
// by somebody who has already uninstalled the app and cannot sign in. It is
// listed in the Play Data Safety form and in the App Store listing, so its
// path must not change without updating both — see docs/store/README.md.

export const metadata: Metadata = {
  title: 'Delete your account',
  description:
    'How to delete your Compences account and the data attached to it, in the app or by email.',
};

const SECTIONS = [
  { id: 'in-the-app', title: 'In the app' },
  { id: 'by-email', title: 'By email' },
  { id: 'what-is-deleted', title: 'What is deleted' },
  { id: 'what-is-kept', title: 'What is kept, and why' },
  { id: 'committee', title: 'If you run a society' },
];

export default function DeleteAccountPage() {
  return (
    <LegalDocument
      title="Delete your account"
      sections={SECTIONS}
      intro={
        <>
          <p>
            You can delete your {LEGAL.product} account at any time, and you do not need to ask
            anybody&rsquo;s permission. It is immediate and it cannot be undone.
          </p>
          <p>
            This page explains how, and exactly what goes. What it describes is the same in the app,
            on the phone and by email — there is one deletion, not three. Our{' '}
            <Link href="/privacy" className="text-accent underline underline-offset-4">
              Privacy Policy
            </Link>{' '}
            covers the rest of your rights over your data.
          </p>
        </>
      }
    >
      <LegalSection id="in-the-app" title="In the app">
        <p>The quickest way, if you can still sign in:</p>
        <LegalList>
          <li>
            <Strong>On the web</Strong> — sign in, open <Strong>Settings</Strong>, and use{' '}
            <Strong>Delete your account</Strong> at the bottom of the page.
          </li>
          <li>
            <Strong>On Android or iOS</Strong> — open <Strong>Me</Strong>, then{' '}
            <Strong>Delete account</Strong>.
          </li>
        </LegalList>
        <p>
          Both ask you to type the word DELETE first. That is the only confirmation: once it goes
          through, your account is gone and you are signed out.
        </p>
      </LegalSection>

      <LegalSection id="by-email" title="By email">
        <p>
          If you have already uninstalled the app, lost access to the email address you signed in
          with, or would simply rather we did it, write to <ContactLink /> from the address on your
          account, or tell us which one it was.
        </p>
        <p>
          We may need to confirm your identity before we delete anything, because doing this on the
          say-so of whoever sent the email would be its own privacy problem. We aim to acknowledge
          the request promptly and complete it within the time India&rsquo;s Digital Personal Data
          Protection Act, 2023 and its rules require.
        </p>
      </LegalSection>

      <LegalSection id="what-is-deleted" title="What is deleted">
        <LegalList>
          {DELETE_ACCOUNT_EFFECTS.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </LegalList>
        <p>
          If you were the only member of a society, that society is deleted with you, along with its
          events, tasks and records. A society with no members cannot be opened by anybody again, so
          leaving it behind would only keep data nobody can ever reach.
        </p>
      </LegalSection>

      <LegalSection id="what-is-kept" title="What is kept, and why">
        <LegalList>
          {DELETE_ACCOUNT_KEPT.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </LegalList>
        <p>
          This is the one place we keep something after you ask us to delete your account, and it is
          the point of the product: a society&rsquo;s ledger is a shared record that its members
          rely on, and a total that changes when somebody leaves is not a record. What is kept is
          the money, not you — the rows no longer name you or link to your account.
        </p>
        <p>
          Messages you exchanged with the {LEGAL.product} WhatsApp bot are kept as operational
          records with your phone number but without the link to your account. We will delete those
          too on request.
        </p>
      </LegalSection>

      <LegalSection id="committee" title="If you run a society">
        <p>
          There is one case where the app will refuse, and it tells you which society: you are the
          last committee member of a society that still has other members. Nobody would be left who
          could approve a bill, admit a resident or close an event — and because appointing a
          committee member is itself a committee decision, nobody left could fix it either.
        </p>
        <p>
          Make somebody else a committee member first, from <Strong>People</Strong>, and then delete
          your account. If the society has no other members, this does not apply and you can delete
          straight away.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
