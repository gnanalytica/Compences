import type { Metadata } from 'next';
import Link from 'next/link';
import { ContactLink, LegalDocument, LegalList, LegalSection, Strong } from '@/components/legal';
import { LEGAL } from '@/lib/legal';

// The Support URL on the App Store listing. Apple wants it to lead somewhere a
// person can actually reach us, so its path must not change without updating
// the listing — see docs/store/listings.md.

export const metadata: Metadata = {
  title: 'Support',
  description: 'How to get help with Compences, report a problem, or reach the people who run it.',
};

const SECTIONS = [
  { id: 'contact', title: 'Contact us' },
  { id: 'common', title: 'Common questions' },
  { id: 'your-data', title: 'Your data' },
];

export default function SupportPage() {
  return (
    <LegalDocument
      title="Support"
      sections={SECTIONS}
      intro={
        <p>
          {LEGAL.product} is run by {LEGAL.operator}. If something is not working, or you are not
          sure how to do something, write to us — a person reads every message.
        </p>
      }
    >
      <LegalSection id="contact" title="Contact us">
        <LegalList>
          <li>
            <Strong>Email</Strong> — <ContactLink />. Tell us your society and, if it is about a
            payment or an event, which one.
          </li>
          <li>
            <Strong>Phone</Strong> — {LEGAL.grievancePhone}
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection id="common" title="Common questions">
        <LegalList>
          <li>
            <Strong>I am waiting to be let in.</Strong> A committee member of your society approves
            each new resident. Ask them, or use an invite code from them to skip the wait.
          </li>
          <li>
            <Strong>My payment does not show.</Strong> A contribution counts once somebody on the
            committee confirms it against the society&rsquo;s bank account. Until then it shows as
            reported, not confirmed.
          </li>
          <li>
            <Strong>I paid the wrong amount.</Strong> Report what actually left your account; the
            committee will see the difference when they reconcile.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection id="your-data" title="Your data">
        <p>
          You can{' '}
          <Link href="/delete-account" className="text-accent underline underline-offset-4">
            delete your account
          </Link>{' '}
          at any time. Our{' '}
          <Link href="/privacy" className="text-accent underline underline-offset-4">
            Privacy Policy
          </Link>{' '}
          explains what we keep and why, and how to raise a grievance.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
