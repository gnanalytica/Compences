import type { Metadata } from 'next';
import Link from 'next/link';
import { ContactLink, LegalDocument, LegalList, LegalSection, Strong } from '@/components/legal';
import { LEGAL } from '@/lib/legal';

// Draft for legal review — see src/lib/legal.ts. Every statement here should
// stay true to what the code does; update this page when the data model,
// sign-in methods or service providers change.

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How Compences collects, uses, shares and protects personal data, and the rights you have under India’s Digital Personal Data Protection Act, 2023.',
};

const SECTIONS = [
  { id: 'who-we-are', title: 'Who we are' },
  { id: 'data-we-collect', title: 'Data we collect' },
  { id: 'how-we-use-data', title: 'How we use it' },
  { id: 'who-can-see-what', title: 'Who in your community sees what' },
  { id: 'sharing', title: 'Service providers and sharing' },
  { id: 'ai-assistants', title: 'API keys and AI assistants' },
  { id: 'retention', title: 'How long we keep data' },
  { id: 'security', title: 'Security' },
  { id: 'your-rights', title: 'Your rights' },
  { id: 'children', title: 'Children' },
  { id: 'cookies', title: 'Cookies and device storage' },
  { id: 'changes', title: 'Changes to this policy' },
  { id: 'contact', title: 'Contact and grievances' },
];

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      sections={SECTIONS}
      intro={
        <>
          <p>
            {LEGAL.product} helps residential communities plan events together — the people,
            activities, checklists, funds and a public ledger of what was spent. Doing that means
            handling some personal data about you and your neighbours. This policy explains what we
            collect, why, who can see it, and the choices you have.
          </p>
          <p>
            It applies to the {LEGAL.product} website, the Android and iOS apps, the WhatsApp bot
            and the {LEGAL.product} API. It is written with India’s Digital Personal Data Protection
            Act, 2023 (the <Strong>DPDP Act</Strong>) in mind. Using {LEGAL.product} is also subject
            to our{' '}
            <Link href="/terms" className="text-accent underline underline-offset-4">
              Terms &amp; Conditions
            </Link>
            .
          </p>
        </>
      }
    >
      <LegalSection id="who-we-are" title="Who we are">
        <p>
          {LEGAL.product} is operated by <Strong>{LEGAL.operator}</Strong> (“we”, “us”). For the
          personal data needed to run your account and the service, we are the Data Fiduciary under
          the DPDP Act.
        </p>
        <p>
          Each community on {LEGAL.product} is run by its own admins — usually the society’s
          committee. They decide which events, funds, notices and records their community keeps, and
          who may join. We store and process that community information so the service can work for
          them.
        </p>
      </LegalSection>

      <LegalSection id="data-we-collect" title="Data we collect">
        <p>
          <Strong>When you sign in.</Strong> You can sign in with Google or with a one-time link
          sent to your email address. With Google, we receive only your name, email address and
          profile photo — we do not ask for access to your Gmail, contacts, calendar or files. With
          an email link, we receive your email address.
        </p>
        <p>
          <Strong>Your profile.</Strong> Your name, email address, phone number (if you add one),
          profile photo and preferred language.
        </p>
        <p>
          <Strong>Your community membership.</Strong> The communities you ask to join or belong to,
          your role (for example resident or admin), the flat or unit you live in and who else is
          recorded as living there, your join requests and their approval, and invite codes you
          create, redeem or try.
        </p>
        <p>
          <Strong>What you do in your community.</Strong> Announcements you post or read, votes you
          cast in polls, event tasks assigned to you, activities you sign up to perform in,
          volunteer roles you take on, and activity ideas you suggest or show interest in. When you
          sign up for an activity, organisers may ask for details such as the type of performance,
          age group, experience and any special requirements — share only what they need.
        </p>
        <p>
          <Strong>Money records.</Strong> Contributions to an event fund — the amount, the payment
          method you used (such as UPI), a payment reference and a receipt number — and expenses
          filed by admins, with the vendor, amount, who requested and approved it, and a reference
          to the bill. {LEGAL.product} <Strong>records</Strong> payments; it does not currently
          process card, UPI or bank payments itself, and we never receive your card number, UPI PIN
          or bank login.
        </p>
        <p>
          <Strong>WhatsApp.</Strong> If you use the {LEGAL.product} WhatsApp bot, we store your
          WhatsApp phone number, the link between that number and your account, and the messages you
          send to and receive from the bot, including their delivery status.
        </p>
        <p>
          <Strong>Mobile app.</Strong> If you allow notifications, we store a push-notification
          token for your device, the platform (Android or iOS) and the app version, and the in-app
          notifications we create for you.
        </p>
        <p>
          <Strong>Activity records.</Strong> An audit trail of significant actions — for example who
          approved an expense or changed a fund — with the time and whether it came from the web,
          mobile, WhatsApp or the API. Our hosting and database providers also keep routine
          technical logs, such as IP addresses and request times, to operate and secure the service.
        </p>
        <p>
          <Strong>Crash reports.</Strong> When the app or the website hits an error, we send a
          report so we can fix it: what went wrong, where in our code, the app version and the kind
          of device. These reports are deliberately built to carry <Strong>no personal data</Strong>{' '}
          — we switch off the parts of our error-reporting tool that would attach your identity,
          your IP address or what you had typed, and we remove anything sensitive from the address
          of the page you were on. We do not record your screen and we do not trace what you do in
          the app.
        </p>
      </LegalSection>

      <LegalSection id="how-we-use-data" title="How we use it">
        <p>We use personal data only to provide {LEGAL.product}, specifically to:</p>
        <LegalList>
          <li>sign you in and keep your session secure;</li>
          <li>let you join a community and let its admins approve members;</li>
          <li>run events: tasks, activities, volunteer roles, polls, announcements and funds;</li>
          <li>keep an accurate, auditable record of contributions and spending;</li>
          <li>answer you over WhatsApp and send notifications you have allowed;</li>
          <li>prevent abuse, investigate problems and keep the service secure; and</li>
          <li>meet our legal obligations.</li>
        </LegalList>
        <p>
          We process this data on the basis of your consent, which you give by signing up and
          choosing to use these features, and for legitimate uses the DPDP Act allows, such as
          complying with law. We do not sell personal data, show advertising, or use your data to
          build advertising profiles.
        </p>
      </LegalSection>

      <LegalSection id="who-can-see-what" title="Who in your community sees what">
        <p>
          {LEGAL.product} is built so that a community can be transparent about money without
          exposing individuals more than necessary. Access rules are enforced in the database
          itself, not just in the app.
        </p>
        <LegalList>
          <li>
            Nothing is shared between communities. Members of one society cannot see another’s data.
          </li>
          <li>
            Members of your community can see event details, announcements, a fund’s total and its
            number of households that contributed, and approved expenses with the vendor and bill.
          </li>
          <li>
            The amount <Strong>you</Strong> contributed is visible to you and your community’s
            admins, not to other residents.
          </li>
          <li>Your ballot in a poll is readable only by you; others see the results.</li>
          <li>
            Admins can see member details, join requests, all contributions and expenses under
            review, and the audit trail for their community.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection id="sharing" title="Service providers and sharing">
        <p>
          We share personal data only with providers that help us run {LEGAL.product}, and only as
          much as they need:
        </p>
        <LegalList>
          <li>
            <Strong>Supabase</Strong> — database, authentication, sign-in emails and file storage.
            Our database is hosted in Mumbai, India.
          </li>
          <li>
            <Strong>Vercel</Strong> — hosting for the website and API.
          </li>
          <li>
            <Strong>Expo</Strong> — building the mobile apps and delivering push notifications,
            which also pass through Apple’s and Google’s notification services.
          </li>
          <li>
            <Strong>Meta (WhatsApp Business Platform)</Strong> — carrying messages between you and
            the WhatsApp bot.
          </li>
          <li>
            <Strong>Google</Strong> — if you choose to sign in with Google.
          </li>
          <li>
            <Strong>Sentry</Strong> — receiving the crash reports described above, which carry no
            personal data.
          </li>
        </LegalList>
        <p>
          Some of these providers may process data outside India. Where they do, we rely on their
          contractual and security commitments and follow any restrictions the Government of India
          places on transfers. We may also disclose data when required by law, to protect the rights
          and safety of our users or the public, or as part of a merger or transfer of the service,
          in which case this policy continues to apply.
        </p>
      </LegalSection>

      <LegalSection id="ai-assistants" title="API keys and AI assistants">
        <p>
          A community’s admins can create API keys that let other software — including an AI
          assistant connected through our MCP server — read or act on that community’s data. Each
          key is limited to the permissions the admin grants, acts as a named member of the
          community, and every action it takes is recorded in the audit trail.
        </p>
        <p>
          {LEGAL.product} does not itself send your data to AI providers. If an admin connects an AI
          assistant, the data it retrieves is handled by that assistant’s provider under its own
          terms, and the admin is responsible for that choice. Admins can revoke a key at any time.
        </p>
      </LegalSection>

      <LegalSection id="retention" title="How long we keep data">
        <p>
          We keep your account data for as long as you have an account. You can delete it yourself,
          at any time, from <Strong>Settings</Strong> on the web or <Strong>Me</Strong> in the
          mobile app — see{' '}
          <Link href="/delete-account" className="text-accent underline underline-offset-4">
            Delete your account
          </Link>{' '}
          — or ask us to do it by writing to <ContactLink />. When it is deleted:
        </p>
        <LegalList>
          <li>
            your profile, community memberships, flat assignments, join requests, votes, sign-ups,
            WhatsApp link, notification tokens and notifications are deleted;
          </li>
          <li>
            contributions, expenses and audit entries you were part of are{' '}
            <Strong>kept but no longer linked to your account</Strong>, because a community’s ledger
            has to keep adding up. A contribution can remain associated with the flat it was made
            for;
          </li>
          <li>
            messages exchanged with the WhatsApp bot are kept as operational records with your phone
            number but without the link to your account. We will delete them on request.
          </li>
        </LegalList>
        <p>
          If your community is removed from {LEGAL.product}, its records are deleted with it.
          Backups and technical logs kept by our providers are overwritten on their normal cycles.
          We may keep data longer where the law requires it.
        </p>
      </LegalSection>

      <LegalSection id="security" title="Security">
        <p>
          Data travels over encrypted connections (HTTPS/TLS). Access to every table is controlled
          by row-level security rules in the database, so a member can only read what their role
          allows, even if the app is bypassed. API keys are stored as hashes, and administrative
          access to production systems is limited.
        </p>
        <p>
          No system is perfectly secure. If a personal data breach affects you, we will notify you
          and the Data Protection Board of India as the DPDP Act requires.
        </p>
      </LegalSection>

      <LegalSection id="your-rights" title="Your rights">
        <p>Under the DPDP Act you can:</p>
        <LegalList>
          <li>
            <Strong>access</Strong> a summary of the personal data we hold about you and how we use
            it;
          </li>
          <li>
            <Strong>correct or update</Strong> it — much of it you can edit yourself in the app;
          </li>
          <li>
            <Strong>erase</Strong> it — from inside the app, at any time — subject to the ledger
            records described above;
          </li>
          <li>
            <Strong>withdraw consent</Strong> at any time, for example by turning off notifications,
            opting out of WhatsApp by messaging STOP, or deleting your account. Withdrawal does not
            affect processing that already happened;
          </li>
          <li>
            <Strong>nominate</Strong> someone to exercise these rights on your behalf if you die or
            become unable to; and
          </li>
          <li>
            <Strong>raise a grievance</Strong> with us, and if you are not satisfied with our
            response, complain to the Data Protection Board of India.
          </li>
        </LegalList>
        <p>
          To use any of these rights, email <ContactLink /> from the address on your account. We may
          need to confirm your identity first.
        </p>
      </LegalSection>

      <LegalSection id="children" title="Children">
        <p>
          {LEGAL.product} is meant for adults. You must be 18 or older to create an account. A child
          may appear in a community only through their parent or guardian — for example as a
          participant in an activity the guardian signs them up for. If you believe a child has
          created an account or that we hold a child’s data without a guardian’s consent, contact us
          and we will delete it.
        </p>
      </LegalSection>

      <LegalSection id="cookies" title="Cookies and device storage">
        <p>
          The website uses only essential cookies that keep you signed in. We do not use analytics,
          advertising or tracking cookies. The mobile apps store your sign-in session on your device
          so you stay signed in.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="Changes to this policy">
        <p>
          We will update this policy when the service or the law changes, and change the “Last
          updated” date above. If a change materially affects how we use your data, we will tell you
          in the app or by email before it takes effect.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="Contact and grievances">
        <p>
          Questions, requests and grievances about your personal data go to our grievance contact at{' '}
          {LEGAL.operator}: <ContactLink />. We aim to acknowledge requests promptly and resolve
          grievances within the time the DPDP Act and its rules require.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
