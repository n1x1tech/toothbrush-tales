import styles from './PrivacyPage.module.css'

export default function PrivacyPage() {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Privacy Policy</h1>
      <p className={styles.effective}>Effective date: May 7, 2026</p>

      <p>
        Toothbrush Tales (the &ldquo;App&rdquo;) is operated by Nixi Technology
        (&ldquo;we&rdquo;, &ldquo;us&rdquo;). This policy explains what information the App handles,
        how it is used, and the choices you have. The App is designed for families and is
        appropriate for children. We follow the U.S. Children&rsquo;s Online Privacy
        Protection Act (COPPA) and Google Play&rsquo;s Families program requirements.
      </p>

      <h2>AI-generated content</h2>
      <p>
        The stories and narration in the App are produced by artificial-intelligence services
        (Google Vertex AI Gemini for the story text and Google Cloud Text-to-Speech for the
        spoken audio). The character name and theme you type are sent to those services so
        they can generate a unique story for that brushing session. Under our Google Cloud
        commercial agreement, these inputs are <strong>not</strong> used to train Google&rsquo;s
        AI models. Generated stories are fictional; any resemblance to real people or events
        is unintentional.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Anonymous user ID.</strong> When the App opens, Firebase Authentication
          generates a random, anonymous identifier so the App can talk to the backend. It is
          not linked to a name, email, or account.
        </li>
        <li>
          <strong>Story request inputs.</strong> When you tap &ldquo;Start Brushing!&rdquo;,
          the character name and theme you entered are sent to our backend so we can generate
          a story. These typed inputs are written to a database (Cloud Firestore) along with
          the resulting story text.
        </li>
        <li>
          <strong>Voice playback (text-to-speech).</strong> Story text is sent to Google
          Cloud Text-to-Speech, which returns audio data. The audio is delivered back
          through Firestore.
        </li>
        <li>
          <strong>Anonymous usage analytics.</strong> The App uses Google Analytics for
          Firebase to record basic events (e.g., app opened, settings changed, story
          generated). Advertising features are disabled &mdash; we do not allow advertising
          IDs, ad personalization, or ad measurement. No behavioral profile is built.
        </li>
        <li>
          <strong>On-device data.</strong> Your saved story history and settings are stored
          only on your device using browser storage. They are never uploaded to our servers.
          You can clear them at any time from the Voice &amp; Playback screen
          (&ldquo;Clear Story History&rdquo;).
        </li>
        <li>
          <strong>Technical request data.</strong> Like every internet service, our backend
          (Google Firebase) sees your device&rsquo;s IP address, basic User-Agent string, and
          timestamps each time the App talks to it. These technical logs are retained by
          Google for short periods for abuse-prevention and debugging and are governed by the
          Google Privacy Policy. We do not use them to identify, profile, or track users.
        </li>
      </ul>

      <p>
        We do <strong>not</strong> collect: real names, email addresses, phone numbers,
        addresses, location, contacts, photos, the device&rsquo;s microphone or camera,
        persistent advertising identifiers, or any social/login account information.
      </p>

      <h2>How we use it</h2>
      <p>
        We use the information above only to generate a story for the brushing session, play
        the audio narration, and understand how the App is used so we can improve it. We do
        not sell or share information for advertising or marketing.
      </p>

      <h2>Service providers</h2>
      <p>
        We rely on Google LLC for backend services as a data processor: Firebase
        Authentication, Cloud Firestore, Cloud Functions, Vertex AI (Gemini) for story
        generation, Google Cloud Text-to-Speech for narration, and Google Analytics for
        Firebase. Their handling of data is governed by the{' '}
        <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">
          Google Privacy Policy
        </a>
        . Data may be processed in Google data centers outside your country.
      </p>

      <h2>Children&rsquo;s privacy</h2>
      <p>
        The App is intended for use with children. We do not knowingly collect personal
        information from any child beyond the data minimization described above. The App has
        no chat, social, in-app purchase, or third-party advertising features. A character
        name typed by a child (e.g., a first name or nickname) is treated as part of the
        story request and is subject to the same retention and deletion controls as any
        other request data.
      </p>
      <p>
        Under COPPA, parents and legal guardians have the following rights regarding any
        information the App may have collected from their child:
      </p>
      <ul>
        <li>
          <strong>Review.</strong> Request a copy of the records associated with your
          child&rsquo;s use of the App.
        </li>
        <li>
          <strong>Delete.</strong> Request that we delete those records.
        </li>
        <li>
          <strong>Refuse further collection.</strong> Ask us to stop any further collection
          or use of your child&rsquo;s information. The App may not function fully after such
          a request, since story generation requires sending the typed inputs to our backend.
        </li>
        <li>
          <strong>Contact us.</strong> Reach the operator at the address and email in the
          Contact section below for any of the above requests.
        </li>
      </ul>
      <p>
        To exercise any of these rights, email{' '}
        <a href="mailto:info@nixitechnology.com">info@nixitechnology.com</a> and we will
        respond within 30 days. Because we do not collect identifying information by default,
        please include details that help us locate the relevant records (approximate dates of
        use, character names entered, device type).
      </p>

      <h2>Data retention</h2>
      <p>
        Story and voice request records in Firestore are automatically deleted within
        approximately 30 days using Firestore&rsquo;s built-in time-to-live policy. On-device
        history and settings persist until you clear them from the App. You can request
        earlier deletion at any time by emailing{' '}
        <a href="mailto:info@nixitechnology.com">info@nixitechnology.com</a>.
      </p>

      <h2>Security</h2>
      <p>
        All connections to our backend use HTTPS (TLS) for transport encryption. Firestore
        data is encrypted at rest by Google. Firestore Security Rules limit reads and writes
        to authenticated sessions and to records owned by that session.
      </p>

      <h2>Your rights</h2>
      <p>
        You can request deletion of any data associated with your device at any time by
        emailing{' '}
        <a href="mailto:info@nixitechnology.com">info@nixitechnology.com</a>. Because we do
        not collect identifying information, please include details that help us locate the
        relevant records (for example, the approximate dates of use and any character names
        entered).
      </p>

      <h2>Changes to this policy</h2>
      <p>
        We may update this policy from time to time. The &ldquo;Effective date&rdquo; at the
        top of this page will reflect when changes take effect. Material changes will be
        highlighted in the App.
      </p>

      <h2>Governing law</h2>
      <p>
        This policy is governed by the laws of the State of Tennessee, USA, without regard
        to its conflict-of-law principles.
      </p>

      <h2>Contact</h2>
      <p>
        Nixi Technology
        <br />
        1207 Southgate Rd.
        <br />
        Knoxville, TN 37919
        <br />
        USA
        <br />
        Email:{' '}
        <a href="mailto:info@nixitechnology.com">info@nixitechnology.com</a>
      </p>
    </div>
  )
}
