import type { Metadata } from 'next';
import Link from 'next/link';
import { ContactLink, LegalDocument, LegalList, LegalSection, Strong } from '@/components/legal';
import { LEGAL } from '@/lib/legal';

// Draft for legal review — see src/lib/legal.ts. Keep these terms consistent
// with the Privacy Policy and with what the product actually does.

export const metadata: Metadata = {
  title: 'Terms & Conditions',
  description:
    'The terms for using Compences to plan community events, run funds and keep a public ledger — on the web, mobile, WhatsApp and the API.',
};

const SECTIONS = [
  { id: 'agreement', title: 'About these terms' },
  { id: 'the-service', title: 'What Compences does' },
  { id: 'eligibility', title: 'Eligibility and accounts' },
  { id: 'communities', title: 'Communities and admins' },
  { id: 'money', title: 'Funds, contributions and expenses' },
  { id: 'acceptable-use', title: 'Acceptable use' },
  { id: 'your-content', title: 'Your content' },
  { id: 'third-parties', title: 'WhatsApp, API and other services' },
  { id: 'availability', title: 'Availability and changes' },
  { id: 'termination', title: 'Suspension and termination' },
  { id: 'disclaimers', title: 'Disclaimers' },
  { id: 'liability', title: 'Limitation of liability' },
  { id: 'indemnity', title: 'Indemnity' },
  { id: 'law', title: 'Governing law and disputes' },
  { id: 'general', title: 'General' },
  { id: 'grievances', title: 'Grievances and reporting content' },
  { id: 'contact', title: 'Contact' },
];

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms & Conditions"
      sections={SECTIONS}
      intro={
        <p>
          These terms explain the rules for using {LEGAL.product}. Please read them together with
          our{' '}
          <Link href="/privacy" className="text-accent underline underline-offset-4">
            Privacy Policy
          </Link>
          , which describes how we handle personal data.
        </p>
      }
    >
      <LegalSection id="agreement" title="About these terms">
        <p>
          {LEGAL.product} is operated by <Strong>{LEGAL.operator}</Strong> (“we”, “us”). These terms
          are an agreement between you and us. By creating an account, signing in, or using the
          website, mobile apps, WhatsApp bot or API, you accept them. If you do not agree, do not
          use {LEGAL.product}.
        </p>
        <p>
          {LEGAL.product} was previously called {LEGAL.formerName}. Only the name changed: these
          terms continue to apply to accounts and communities created under the old name.
        </p>
      </LegalSection>

      <LegalSection id="the-service" title="What Compences does">
        <p>
          {LEGAL.product} gives residential communities a shared place to plan events — with
          members, announcements, checklists, activities, volunteer roles, polls, event funds and a
          ledger of approved spending. It is available on the web, on Android and iOS, over
          WhatsApp, and through an API that other software, including AI assistants, can use.
        </p>
      </LegalSection>

      <LegalSection id="eligibility" title="Eligibility and accounts">
        <LegalList>
          <li>You must be at least 18 years old and able to enter a binding contract.</li>
          <li>
            Sign in with your own Google account or email address, keep access to it secure, and do
            not share your account. You are responsible for activity under your account.
          </li>
          <li>
            Give accurate information — including your name and the flat or unit you live in — and
            keep it up to date.
          </li>
          <li>
            Tell us promptly at <ContactLink /> if you think your account has been misused.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection id="communities" title="Communities and admins">
        <p>
          Each community decides who can join. Residents join with a society code or invite code,
          and the community’s admins approve them. Admins can remove members and change roles.
        </p>
        <p>If you set up or administer a community, you agree to:</p>
        <LegalList>
          <li>be authorised by your society, association or committee to do so;</li>
          <li>admit only people who genuinely belong to the community;</li>
          <li>
            keep the community’s records accurate, and handle residents’ personal data only for the
            community’s legitimate purposes and in line with applicable law;
          </li>
          <li>
            upload only bills, payment screenshots and bank statements that belong to the society,
            and remember that bills and proofs of society spending are shown to every member;
          </li>
          <li>
            manage API keys responsibly, granting only the access needed and revoking keys that are
            no longer used; and
          </li>
          <li>follow your community’s own bye-laws and decision-making rules.</li>
        </LegalList>
        <p>
          We are not a party to decisions made within a community and do not mediate disputes
          between residents, admins or committees.
        </p>
      </LegalSection>

      <LegalSection id="money" title="Funds, contributions and expenses">
        <p>
          {LEGAL.product} is a <Strong>record-keeping and transparency tool</Strong>. It records
          contributions and expenses that members and admins enter; it does not currently collect,
          hold, transfer or process money, and we are not a bank, payment service, escrow agent or
          trustee.
        </p>
        <LegalList>
          <li>
            Each community — not {LEGAL.operator} — is responsible for its funds, for how money is
            collected and spent, and for keeping proper accounts and complying with tax and other
            laws.
          </li>
          <li>
            Payments you make to a community, for example by UPI, are between you, the community and
            your payment provider.
          </li>
          <li>
            Totals, receipts and reports in {LEGAL.product} are informational. They reflect what was
            entered and are not audited statements. Check anything important with your community’s
            admins or treasurer.
          </li>
          <li>
            Rules a community sets in {LEGAL.product}, such as what happens to money left over when
            an event closes, help it act transparently but do not replace its legal obligations.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection id="acceptable-use" title="Acceptable use">
        <p>You agree not to:</p>
        <LegalList>
          <li>post false financial records, fake bills or misleading announcements;</li>
          <li>harass, threaten, defame or discriminate against anyone;</li>
          <li>
            share other people’s personal data without a legitimate reason, or collect data from
            {` ${LEGAL.product}`} for unrelated purposes;
          </li>
          <li>upload unlawful content, malware or anything that infringes others’ rights;</li>
          <li>
            try to access communities or data you are not authorised to see, or probe, disrupt or
            overload the service;
          </li>
          <li>send spam through the WhatsApp bot, notifications or the API; or</li>
          <li>use {LEGAL.product} in breach of any applicable law.</li>
        </LegalList>
      </LegalSection>

      <LegalSection id="your-content" title="Your content">
        <p>
          You and your community keep ownership of what you add to {LEGAL.product} — announcements,
          event details, records, bills and messages. You give {LEGAL.operator} a non-exclusive,
          royalty-free licence to host, store, copy, display and process that content only as needed
          to operate, secure and improve the service for you and your community.
        </p>
        <p>
          You are responsible for having the right to share what you post. We may remove content
          that breaks these terms or the law. {LEGAL.product}’s software, design and brand belong to{' '}
          {LEGAL.operator}.
        </p>
      </LegalSection>

      <LegalSection id="third-parties" title="WhatsApp, API and other services">
        <LegalList>
          <li>
            The WhatsApp bot runs on Meta’s WhatsApp Business Platform. Using it means you also
            follow WhatsApp’s terms. You can stop bot messages at any time by sending STOP.
          </li>
          <li>
            Signing in with Google is subject to Google’s terms. Push notifications are delivered
            through Expo, Apple Push Notification service and Google’s Firebase Cloud Messaging.
          </li>
          <li>
            If a community connects other software or an AI assistant using an API key, that
            software acts with the permissions the admin granted. We are not responsible for
            third-party software, its provider, or what it does with the data it retrieves.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection id="availability" title="Availability and changes">
        <p>
          We work to keep {LEGAL.product} available and secure, but it may sometimes be unavailable
          for maintenance, upgrades or reasons outside our control. We may add, change or remove
          features. If we make a change that significantly reduces what the service does for you, we
          will try to give reasonable notice.
        </p>
        <p>
          We may update these terms. We will change the “Last updated” date and, for material
          changes, tell you in the app or by email. Continuing to use {LEGAL.product} after a change
          takes effect means you accept the updated terms.
        </p>
      </LegalSection>

      <LegalSection id="termination" title="Suspension and termination">
        <p>
          You can stop using {LEGAL.product} and ask us to delete your account at any time. Your
          community’s admins can remove you from the community.
        </p>
        <p>
          We may suspend or close an account or community that breaks these terms, creates risk or
          legal exposure for us or other users, or where the law requires it. Where appropriate we
          will tell you why. Sections that by their nature should survive — including those on
          money, content, disclaimers, liability, indemnity and governing law — continue after
          termination. What happens to records after deletion is explained in the{' '}
          <Link href="/privacy#retention" className="text-accent underline underline-offset-4">
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection id="disclaimers" title="Disclaimers">
        <p>
          {LEGAL.product} is provided “as is” and “as available”. To the extent the law allows, we
          make no warranties that it will be uninterrupted, error-free or fit for a particular
          purpose, or that information entered by communities and members is accurate or complete.
        </p>
      </LegalSection>

      <LegalSection id="liability" title="Limitation of liability">
        <p>To the extent the law allows:</p>
        <LegalList>
          <li>
            we are not liable for indirect, incidental, special or consequential losses, or for loss
            of profits, data or goodwill;
          </li>
          <li>
            we are not liable for how a community collects, holds or spends money, for disputes
            within a community, or for content posted by users or connected software; and
          </li>
          <li>
            our total liability for any claim relating to {LEGAL.product} is limited to the amount
            you paid us for the service in the 12 months before the claim, or ₹5,000 if you paid
            nothing.
          </li>
        </LegalList>
        <p>Nothing in these terms limits liability that cannot be limited under Indian law.</p>
      </LegalSection>

      <LegalSection id="indemnity" title="Indemnity">
        <p>
          You agree to compensate {LEGAL.operator} for losses and reasonable costs arising from your
          breach of these terms, your misuse of {LEGAL.product}, or content you post — and, if you
          are an admin, from your management of your community or its funds.
        </p>
      </LegalSection>

      <LegalSection id="law" title="Governing law and disputes">
        <p>
          These terms are governed by the laws of India. Please contact us first so we can try to
          resolve any concern informally. If that does not work, the courts at {LEGAL.courts} have
          exclusive jurisdiction.
        </p>
      </LegalSection>

      <LegalSection id="general" title="General">
        <p>
          These terms and the Privacy Policy are the whole agreement between you and us about{' '}
          {LEGAL.product}. If a part is found unenforceable, the rest still applies. If we do not
          enforce a right straight away, we have not given it up. You may not transfer your rights
          under these terms; we may transfer ours as part of a reorganisation, merger or sale of the
          service.
        </p>
      </LegalSection>

      <LegalSection id="grievances" title="Grievances and reporting content">
        <p>
          If something on {LEGAL.product} breaks these terms or the law — for example content that
          is defamatory, harassing, impersonates someone or shares someone’s personal data without a
          reason — or you have any other complaint about the service, write to our{' '}
          {LEGAL.grievanceOfficer} at {LEGAL.operator}: <ContactLink />. Tell us what the content
          is, where it appears and why it is a problem.
        </p>
        <p>
          We acknowledge complaints within 24 hours and resolve them within 15 days, as the
          Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021
          require, and act faster where those rules ask us to. Complaints about your personal data
          are handled as described in the{' '}
          <Link href="/privacy#contact" className="text-accent underline underline-offset-4">
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection id="contact" title="Contact">
        <p>
          Questions about these terms: <ContactLink />.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
