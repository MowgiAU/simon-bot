import React, { useState, useEffect } from 'react';
import { colors, spacing, borderRadius } from '../theme/theme';
import { DiscoveryLayout } from '../layouts/DiscoveryLayout';
import { Shield } from 'lucide-react';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div style={{ marginBottom: spacing.xl }}>
        <h2 style={{ color: colors.textPrimary, fontSize: '18px', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px', marginBottom: '12px' }}>
            {title}
        </h2>
        {children}
    </div>
);

const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <p style={{ color: colors.textSecondary, lineHeight: 1.7, margin: '0 0 10px 0', fontSize: '14px' }}>{children}</p>
);

const Bullet: React.FC<{ label?: string; children: React.ReactNode }> = ({ label, children }) => (
    <li style={{ color: colors.textSecondary, lineHeight: 1.7, marginBottom: '6px', fontSize: '14px' }}>
        {label && <strong style={{ color: colors.textPrimary }}>{label}: </strong>}
        {children}
    </li>
);

export const TermsPage: React.FC = () => {
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    return (
        <DiscoveryLayout activeTab="discover">
            <div style={{ maxWidth: '800px', margin: '0 auto', padding: isMobile ? '24px 16px' : '40px 24px' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px' }}>
                    <div style={{ 
                        width: '56px', 
                        height: '56px', 
                        backgroundColor: colors.primary + '15', 
                        borderRadius: '16px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        marginRight: '16px',
                        flexShrink: 0
                    }}>
                        <Shield size={32} color={colors.primary} />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, color: colors.textPrimary }}>
                            Terms of Service & Privacy Policy
                        </h1>
                        <p style={{ margin: '4px 0 0', color: colors.textSecondary, fontSize: '14px' }}>
                            Fuji Studio — Last updated June 19, 2026
                        </p>
                    </div>
                </div>

                {/* Intro */}
                <div style={{ backgroundColor: colors.surface, borderLeft: `4px solid ${colors.primary}`, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.xl }}>
                    <P>
                        These terms are here to protect your art, maintain a high-quality environment, and keep the platform running smoothly.
                        By using our platform, you agree to the following Terms of Service, Privacy Policy, and Community Guidelines.
                        This agreement governs your use of <strong style={{ color: colors.textPrimary }}>fujistud.io</strong> and all associated services.
                    </P>
                </div>

                {/* Part 1 */}
                <div style={{ marginBottom: spacing.xl }}>
                    <h2 style={{ color: colors.primary, fontSize: '22px', fontWeight: 800, margin: '0 0 20px 0', letterSpacing: '-0.02em' }}>
                        Part 1: Terms of Service
                    </h2>

                    <Section title="1. Acceptance &amp; Eligibility">
                        <P>
                            By accessing Fuji Studio, you agree to be bound by these terms. You must be at least 13 years old
                            (or the minimum age required in your country to use Discord) to create an account. If you are under
                            the age of 18, you must have the permission of a parent or legal guardian to use the platform.
                        </P>
                    </Section>

                    <Section title="2. Accounts and Discord Integration">
                        <P>Fuji Studio uses Discord OAuth for authentication.</P>
                        <ul style={{ margin: '0 0 10px 0', paddingLeft: '20px' }}>
                            <Bullet>You are responsible for maintaining the security of your Discord account.</Bullet>
                            <Bullet>Any actions performed under your Fuji Studio profile are your sole responsibility.</Bullet>
                            <Bullet>We reserve the right to suspend accounts that violate these terms or Discord's Acceptable Use Policy.</Bullet>
                        </ul>
                    </Section>

                    <Section title="3. User Content &amp; Intellectual Property">
                        <ul style={{ margin: '0 0 10px 0', paddingLeft: '20px' }}>
                            <Bullet label="Ownership">
                                You retain all original rights to the music, artwork, and project files (FLPs) you upload.
                            </Bullet>
                            <Bullet label="Liability &amp; Sample Redistribution">
                                You are solely responsible for ensuring you have the necessary rights and clearances for all audio
                                (including individual samples) uploaded to the platform. If your project file contains third-party
                                audio samples that you do not have the legal right to redistribute, you are strictly required to
                                disable the download feature for that project.
                            </Bullet>
                            <Bullet label="License to Fuji Studio">
                                You grant Fuji Studio a non-exclusive, royalty-free, worldwide license to host, stream, and display
                                your content to facilitate site features (e.g., the Music Player, Artist Profiles, and Discovery feed).
                            </Bullet>
                            <Bullet label="Project Files">
                                Project files are shared for display and educational purposes. By making a project file public and
                                available for download, you grant other users a license to download and open the file for study.
                                However, downloading a project file does not grant users the right to commercialise or release the
                                original creator's melodies, compositions, or unique sound designs as their own without explicit
                                permission.
                            </Bullet>
                            <Bullet label="Asset Hosting">
                                While Fuji Studio hosts user-uploaded audio samples and project assets, we do not host or
                                distribute third-party VSTs or plugins.
                            </Bullet>
                        </ul>
                    </Section>

                    <Section title="4. Community Sample Library">
                        <P>
                            Audio samples submitted to the /library are provided for community use. Users must ensure they have
                            the right and legal authority to distribute any sounds uploaded to this section.
                        </P>
                    </Section>

                    <Section title="5. Prohibited Conduct">
                        <P>You may not upload content that:</P>
                        <ul style={{ margin: '0 0 10px 0', paddingLeft: '20px' }}>
                            <Bullet>Infringes on the intellectual property of others (e.g., stolen project files, redistributing uncleared commercial samples within downloadable project files).</Bullet>
                            <Bullet>Contains malicious code, viruses, or "zip bombs."</Bullet>
                            <Bullet>Is intended to harass, defame, or exploit other users.</Bullet>
                        </ul>
                    </Section>

                    <Section title="6. AI-Generated Music">
                        <div style={{ backgroundColor: 'rgba(255,71,87,0.08)', borderLeft: `4px solid ${colors.error}`, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: '12px' }}>
                            <P><strong style={{ color: colors.error }}>Uploading AI-generated music is strictly prohibited and will result in permanent account termination.</strong></P>
                        </div>
                        <P>
                            Fuji Studio is a platform exclusively for human-made music. Content generated in whole or in significant part
                            by AI music tools (including but not limited to Suno, Udio, or similar generative audio systems) is not permitted.
                        </P>
                        <ul style={{ margin: '0 0 10px 0', paddingLeft: '20px' }}>
                            <Bullet label="Zero Tolerance">
                                Any account found uploading AI-generated tracks will be permanently terminated without warning or appeal.
                                This applies regardless of whether the AI content is disclosed or disguised as original work.
                            </Bullet>
                            <Bullet label="AI-Assisted Production">
                                The use of AI tools for mixing assistance, mastering suggestions, or plugin recommendations is permitted,
                                provided the core composition, arrangement, and performance are entirely human-created.
                            </Bullet>
                            <Bullet label="Reporting">
                                If you suspect a track has been generated by AI, please report it via our official Discord server or by
                                contacting <a href="mailto:legal@fujistud.io" style={{ color: colors.primary }}>legal@fujistud.io</a>.
                            </Bullet>
                        </ul>
                    </Section>

                    <Section title="8. Copyright Policy (DMCA)">
                        <P>
                            If you believe your intellectual property is being used without permission, please contact our designated
                            Copyright Agent at: <a href="mailto:legal@fujistud.io" style={{ color: colors.primary }}>legal@fujistud.io</a>.
                        </P>
                    </Section>

                    <Section title="9. Indemnification">
                        <P>
                            By using the platform, you agree to indemnify and hold harmless Fuji Studio, its operators, and affiliates
                            from any claims, damages, liabilities, costs, or debt (including attorney's fees) arising from your use of
                            the platform, your violation of these terms, or your infringement of any third-party rights, including copyright.
                        </P>
                    </Section>

                    <Section title="10. Limitation of Liability">
                        <P>
                            Fuji Studio provides its services "as is." We are not liable for data loss, the unavailability of the site,
                            or the misuse of your publicly shared project files or samples by third parties.
                        </P>
                    </Section>

                    <Section title="11. Modifications to Terms">
                        <P>
                            We reserve the right to modify these terms at any time. We will notify users of significant changes via
                            an announcement on the website or through our official Discord server. Continued use of the platform after
                            changes are made constitutes your acceptance of the new terms.
                        </P>
                    </Section>

                    <Section title="12. Communication Tools (Comments &amp; Private Messaging)">
                        <P>
                            Fuji Studio provides community features, including public comment sections and a private messaging (DM)
                            system, to facilitate collaboration. By using these features, you agree to the following:
                        </P>
                        <ul style={{ margin: '0 0 10px 0', paddingLeft: '20px' }}>
                            <Bullet label="User Responsibility">
                                You are solely responsible for your interactions with other users. Fuji Studio is not liable for
                                any harm, harassment, or disputes resulting from private or public communications.
                            </Bullet>
                            <Bullet label="Prohibited Content">
                                You may not use communication tools to distribute:
                                <ul style={{ margin: '6px 0 0 0', paddingLeft: '20px', listStyle: 'disc' }}>
                                    <li style={{ color: colors.textSecondary, lineHeight: 1.7, marginBottom: '4px', fontSize: '14px' }}>Spam, phishing links, or malware.</li>
                                    <li style={{ color: colors.textSecondary, lineHeight: 1.7, marginBottom: '4px', fontSize: '14px' }}>Harassing, threatening, or defamatory language.</li>
                                    <li style={{ color: colors.textSecondary, lineHeight: 1.7, marginBottom: '4px', fontSize: '14px' }}>Sexually explicit or &quot;NSFW&quot; content.</li>
                                    <li style={{ color: colors.textSecondary, lineHeight: 1.7, marginBottom: '4px', fontSize: '14px' }}>Unsolicited commercial advertisements or &quot;leaked&quot; software links.</li>
                                </ul>
                            </Bullet>
                            <Bullet label="Moderation &amp; Monitoring">
                                To ensure platform safety and prevent abuse, Fuji Studio reserves the right (but does not assume
                                the obligation) to monitor public comments. While private messages are intended to be private, we
                                reserve the right to access and review DM logs in the event of a reported violation of these terms
                                or a formal legal request.
                            </Bullet>
                            <Bullet label="Reporting">
                                Users are encouraged to report any abusive behavior or scamming via our official support channels
                                or Discord server. We reserve the right to revoke communication privileges or terminate accounts
                                for misuse of these systems.
                            </Bullet>
                        </ul>
                    </Section>
                </div>

                {/* Part 2 */}
                <div>
                    <h2 id="privacy-policy" style={{ color: colors.primary, fontSize: '22px', fontWeight: 800, margin: '0 0 20px 0', letterSpacing: '-0.02em' }}>
                        Part 2: Privacy Policy
                    </h2>

                    <Section title="1. Who We Are">
                        <P>
                            Fuji Studio (<strong style={{ color: colors.textPrimary }}>fujistud.io</strong>) is a community platform
                            for FL Studio music producers, operated by <strong style={{ color: colors.textPrimary }}>Fuji Studio</strong>.
                            We operate both a website and a Discord bot serving a 50,000+ member Discord community.
                            This policy covers data collected by both the website and the Fuji Studio Discord bot.
                        </P>
                        <ul style={{ margin: '0 0 10px 0', paddingLeft: '20px' }}>
                            <Bullet label="Data Controller">Fuji Studio (fujistud.io)</Bullet>
                            <Bullet label="Contact">
                                <a href="mailto:legal@fujistud.io" style={{ color: colors.primary }}>legal@fujistud.io</a>
                            </Bullet>
                            <Bullet label="Data Storage Location">Our production database and application servers are hosted on DigitalOcean infrastructure located in San Francisco, California, USA.</Bullet>
                            <Bullet label="File Storage">User-uploaded files are stored on Cloudflare R2 (globally distributed CDN), served via cdn.fujistud.io.</Bullet>
                        </ul>
                    </Section>

                    <Section title="2. Data We Collect">
                        <P>We collect the following categories of data, only what is necessary to operate platform features:</P>

                        <div style={{ marginBottom: '16px' }}>
                            <p style={{ color: colors.textPrimary, fontWeight: 600, fontSize: '14px', margin: '0 0 6px 0' }}>Account &amp; Identity</p>
                            <ul style={{ margin: '0 0 10px 0', paddingLeft: '20px' }}>
                                <Bullet label="Discord ID &amp; Username">Collected when you connect your Discord account. Used to identify you across the platform.</Bullet>
                                <Bullet label="Email Address">Collected during registration or account completion. Used for login, verification, and important notifications. Optional if using Discord-only login.</Bullet>
                                <Bullet label="Display Name &amp; Avatar">Synced from your Discord account or set manually on your profile.</Bullet>
                                <Bullet label="Password">Stored as a one-way bcrypt hash. We never store your plaintext password.</Bullet>
                                <Bullet label="2FA / TOTP Secret">If you enable two-factor authentication, we store your encrypted TOTP secret and hashed backup codes.</Bullet>
                            </ul>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <p style={{ color: colors.textPrimary, fontWeight: 600, fontSize: '14px', margin: '0 0 6px 0' }}>Musician Profile &amp; Content</p>
                            <ul style={{ margin: '0 0 10px 0', paddingLeft: '20px' }}>
                                <Bullet label="Profile Data">Bio, location, contact email, social links, gear and DAW details — all voluntarily provided by you.</Bullet>
                                <Bullet label="Uploaded Content">Audio files (MP3/WAV), FL Studio project files (.flp), stems, artwork, and samples you upload. Stored on Cloudflare R2 (CDN: cdn.fujistud.io).</Bullet>
                                <Bullet label="Comments">Public comments you post on tracks or profiles, including the text, timestamp, and your user ID.</Bullet>
                                <Bullet label="Playlists &amp; Favourites">Track IDs you save to playlists or mark as favourites.</Bullet>
                            </ul>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <p style={{ color: colors.textPrimary, fontWeight: 600, fontSize: '14px', margin: '0 0 6px 0' }}>Private Messages</p>
                            <ul style={{ margin: '0 0 10px 0', paddingLeft: '20px' }}>
                                <Bullet label="Encrypted DMs">
                                    Messages sent via the private messaging feature are encrypted at rest using AES-256-GCM.
                                    Only the sender and recipient can read them under normal circumstances. Fuji Studio administrators
                                    may access messages in the event of a reported Terms violation or formal legal request.
                                </Bullet>
                            </ul>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <p style={{ color: colors.textPrimary, fontWeight: 600, fontSize: '14px', margin: '0 0 6px 0' }}>Discord Community Activity (Bot Data)</p>
                            <P>The Fuji Studio Discord bot collects the following data to operate community features within your Discord server:</P>
                            <ul style={{ margin: '0 0 10px 0', paddingLeft: '20px' }}>
                                <Bullet label="Community XP &amp; Leveling">Message send count, voice channel time, and reaction activity are recorded to calculate your XP level and rank. Message content is not stored — only the fact that a message was sent.</Bullet>
                                <Bullet label="Activity Streaks">Timestamps of your last message and daily activity to calculate engagement streaks and award bonuses.</Bullet>
                                <Bullet label="Economy Balance">Your in-server currency balance and transaction history for the economy system.</Bullet>
                                <Bullet label="Moderation Records">Warnings, bans, kicks, and timeouts issued to you by server moderators, including the reason and issuing moderator's ID.</Bullet>
                                <Bullet label="Voice Activity">Voice join/leave timestamps used for leveling XP and the Fuji Radio listener system.</Bullet>
                                <Bullet label="Head-to-Head &amp; Battle Records">Your battle history, votes cast, Elo ratings, and battle results.</Bullet>
                                <Bullet label="Welcome Verification">Answers provided during server entry verification are temporarily stored to process access approval. They are not permanently retained beyond the verification event.</Bullet>
                            </ul>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <p style={{ color: colors.textPrimary, fontWeight: 600, fontSize: '14px', margin: '0 0 6px 0' }}>Security &amp; Analytics Data</p>
                            <ul style={{ margin: '0 0 10px 0', paddingLeft: '20px' }}>
                                <Bullet label="IP Address">Collected on track plays, file downloads, login sessions, and support tickets for anti-fraud, anti-bot, and moderation purposes. Stored in hashed form where full precision is not required.</Bullet>
                                <Bullet label="User Agent &amp; Device">Browser/device type collected on plays and downloads to detect automation and abuse patterns.</Bullet>
                                <Bullet label="Session Data">Login session tokens stored server-side in our database and via a secure, HTTP-only session cookie. Sessions expire after inactivity.</Bullet>
                                <Bullet label="Activity Logs">An audit log of security-sensitive account actions (login, password change, 2FA changes) linked to your IP and timestamp. Used to detect unauthorized access.</Bullet>
                            </ul>
                        </div>
                    </Section>

                    <Section title="3. Discord-Specific Disclosures">
                        <div style={{ backgroundColor: colors.surface, borderLeft: `4px solid ${colors.primary}`, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: '16px' }}>
                            <P>
                                This section specifically addresses how the Fuji Studio Discord bot handles data received
                                through Discord's API, including data accessed via privileged Gateway Intents. It is
                                provided to satisfy Discord's Developer Policy transparency requirements.
                            </P>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <p style={{ color: colors.textPrimary, fontWeight: 600, fontSize: '14px', margin: '0 0 6px 0' }}>Message Content Intent</p>
                            <P>
                                The Fuji Studio bot reads the full content of messages in Discord servers where it is
                                installed. This is required for the following active features:
                            </P>
                            <ul style={{ margin: '0 0 10px 0', paddingLeft: '20px' }}>
                                <Bullet label="Word Filter">Message text is checked against a configurable list of banned words/phrases. Content is read in memory and immediately discarded — it is never written to our database.</Bullet>
                                <Bullet label="Spam Guard">Message content is analysed to detect floods, duplicate messages, and external server invite links. Content is processed in memory only and not stored.</Bullet>
                                <Bullet label="Anti-Piracy Detection">Messages are scanned for piracy-related keywords. Borderline cases may be sent to OpenAI's API for secondary analysis (see Section 4). Content is not stored by us.</Bullet>
                                <Bullet label="Channel Rules">Message content is checked against per-channel rules configured by server admins. Content is processed in memory only and not stored.</Bullet>
                                <Bullet label="Auto Responder">Messages are matched against regex patterns to trigger automated replies. Content is processed in memory only and not stored.</Bullet>
                                <Bullet label="Production Feedback Scoring">Feedback messages posted in designated channels are sent to OpenAI's API to score their quality. The text is transmitted transiently and not stored by us after the API call completes.</Bullet>
                                <Bullet label="Studio Guide (AI Assistant)">When a user explicitly invokes the bot, the message content is sent to OpenAI's API to generate a response. This is opt-in (user must invoke the command). Content is not stored by us after the API call.</Bullet>
                                <Bullet label="Leveling &amp; Economy">The bot detects that a message was sent (to award XP) but does not store the content of the message — only the timestamp and the user ID.</Bullet>
                            </ul>
                            <P>
                                <strong style={{ color: colors.textPrimary }}>Summary:</strong> For all moderation and safety features, message content is read in memory and immediately discarded. It is never written to our database. Content is only transmitted off-platform for the three AI features listed above (Studio Guide, Feedback Scoring, Anti-Piracy), and only transiently for the purpose of generating a real-time response.
                            </P>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <p style={{ color: colors.textPrimary, fontWeight: 600, fontSize: '14px', margin: '0 0 6px 0' }}>Guild Members Intent</p>
                            <P>
                                The bot receives member join, leave, and update events for servers where it is installed.
                                The following data from these events is stored in our database:
                            </P>
                            <ul style={{ margin: '0 0 10px 0', paddingLeft: '20px' }}>
                                <Bullet label="Member join events">Discord user ID and join timestamp — stored to initialise a leveling XP record and update server member count history.</Bullet>
                                <Bullet label="Member leave events">Discord user ID and timestamp — stored to update server member count statistics and to distinguish voluntary leaves from kicks/bans in moderation logs.</Bullet>
                                <Bullet label="Member update events">Discord user ID and role change details — stored only when a role change triggers a leveling rank-up or a server boost assignment. Generic role changes are not stored.</Bullet>
                            </ul>
                            <P>
                                This data is stored on our own servers (San Francisco, USA) and is not shared with any third party. It is used exclusively to power the leveling system, server statistics, welcome verification, and moderation logging features.
                            </P>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <p style={{ color: colors.textPrimary, fontWeight: 600, fontSize: '14px', margin: '0 0 6px 0' }}>Presence Intent</p>
                            <P>
                                The Fuji Studio bot does <strong style={{ color: colors.textPrimary }}>not</strong> use the
                                Guild Presences intent. We do not receive, read, or store any user's online status,
                                activity, or presence data. The bot does set its own visible status (e.g. "Listening to
                                Fuji FM") using Discord's standard bot presence API, but this is an outbound action only
                                and does not involve reading any user data.
                            </P>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <p style={{ color: colors.textPrimary, fontWeight: 600, fontSize: '14px', margin: '0 0 6px 0' }}>User Opt-Out</p>
                            <P>
                                Server-level safety features (word filter, spam guard, channel rules) apply to all
                                members in configured channels and cannot be individually opted out of, as they are
                                server-wide moderation tools. Individual users cannot opt out of passive message scanning
                                any more than they can opt out of a human moderator reading their public messages.
                            </P>
                            <P>
                                AI-powered features (Studio Guide, Feedback Scoring) are opt-in by design — content is
                                only processed when a user explicitly invokes the bot or submits content to a feedback
                                channel. Users who do not interact with these features have no content processed by AI.
                            </P>
                        </div>

                        <div>
                            <p style={{ color: colors.textPrimary, fontWeight: 600, fontSize: '14px', margin: '0 0 6px 0' }}>Discord's Own Privacy Policy</p>
                            <P>
                                Our bot operates within Discord's platform. Discord's collection and use of your data
                                (independent of our bot) is governed by{' '}
                                <a href="https://discord.com/privacy" style={{ color: colors.primary }} target="_blank" rel="noopener noreferrer">Discord's Privacy Policy</a>.
                            </P>
                        </div>
                    </Section>

                    <Section title="4. AI Processing">
                        <div style={{ backgroundColor: 'rgba(242, 120, 10, 0.08)', borderLeft: `4px solid ${colors.primary}`, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: '12px' }}>
                            <P>
                                Certain features of Fuji Studio use OpenAI's API (GPT-4o-mini) to process content.
                                By using these features, you consent to the relevant content being transmitted to OpenAI.
                            </P>
                        </div>
                        <ul style={{ margin: '0 0 10px 0', paddingLeft: '20px' }}>
                            <Bullet label="Studio Guide (AI Assistant)">
                                When you use the Studio Guide bot command or feature, your question and recent channel context
                                are sent to OpenAI to generate a response. This includes text you type as part of your query.
                            </Bullet>
                            <Bullet label="Production Feedback Scoring">
                                When feedback is submitted on tracks, the text of feedback messages may be sent to OpenAI
                                to determine whether feedback meets the quality threshold for reward points.
                            </Bullet>
                            <Bullet label="Anti-Piracy Detection">
                                In servers with the Anti-Piracy plugin enabled, message content flagged as potentially
                                containing piracy discussion may be analysed by OpenAI to determine if action is warranted.
                            </Bullet>
                        </ul>
                        <P>
                            OpenAI's data handling is governed by their own{' '}
                            <a href="https://openai.com/policies/privacy-policy" style={{ color: colors.primary }} target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
                            We do not send identifying user information (names, IDs) alongside AI requests unless required
                            for the feature to function.
                        </P>
                    </Section>

                    <Section title="5. Third-Party Services">
                        <P>We share data with the following trusted third parties only to the extent necessary to operate the platform:</P>
                        <ul style={{ margin: '0 0 10px 0', paddingLeft: '20px' }}>
                            <Bullet label="Cloudflare R2">
                                Audio files, project files, stems, artwork, and samples are stored on Cloudflare R2 object storage
                                and served via our CDN (cdn.fujistud.io). Cloudflare's privacy policy governs this storage.
                            </Bullet>
                            <Bullet label="Resend (Email)">
                                Transactional emails (account verification, password resets, notifications) are sent via Resend.
                                Your email address is transmitted to Resend solely to deliver these messages.
                            </Bullet>
                            <Bullet label="OpenAI">
                                Message content is sent to OpenAI for AI-powered features as described in Section 4.
                            </Bullet>
                            <Bullet label="Discord">
                                Authentication uses Discord OAuth2. When you log in with Discord, we receive your Discord ID,
                                username, and avatar from Discord's API. Our bot operates within Discord's platform and is
                                subject to Discord's Terms of Service and Privacy Policy.
                            </Bullet>
                        </ul>
                        <P>We do not sell your personal data to any third party, ever.</P>
                    </Section>

                    <Section title="6. Data Visibility">
                        <ul style={{ margin: '0 0 10px 0', paddingLeft: '20px' }}>
                            <Bullet label="Public Profiles &amp; Tracks">
                                Your musician profile and any tracks/files you mark as Public are visible to all visitors,
                                including unauthenticated users. You can set tracks to Private at any time from your dashboard.
                            </Bullet>
                            <Bullet label="Public Comments">
                                Comments posted on tracks or profiles are visible to all visitors.
                            </Bullet>
                            <Bullet label="Private Messages">
                                Visible only to the conversation participants and Fuji Studio staff during active moderation
                                investigations or in response to legal requests.
                            </Bullet>
                            <Bullet label="Discord Community Data">
                                Your XP level, rank, and economy balance may be displayed publicly within your Discord server
                                at the discretion of server administrators. Moderation records are visible only to server
                                moderators and Fuji Studio staff.
                            </Bullet>
                        </ul>
                    </Section>

                    <Section title="7. Cookies &amp; Session Storage">
                        <ul style={{ margin: '0 0 10px 0', paddingLeft: '20px' }}>
                            <Bullet label="Session Cookie">
                                A single HTTP-only session cookie is set on login to keep you authenticated. This cookie
                                contains no personal data — it is a reference to your server-side session.
                            </Bullet>
                            <Bullet label="Player State">
                                Volume and queue preferences are stored in browser localStorage. This data never leaves your device.
                            </Bullet>
                        </ul>
                        <P>We do not use advertising cookies, tracking pixels, or analytics cookies from third parties.</P>
                    </Section>

                    <Section title="8. Data Retention">
                        <ul style={{ margin: '0 0 10px 0', paddingLeft: '20px' }}>
                            <Bullet label="Active Accounts">Data is retained for as long as your account is active.</Bullet>
                            <Bullet label="Deleted Accounts">
                                Account deletion is soft-deleted initially (to allow appeal of accidental deletions) and
                                permanently purged within 30 days. Uploaded files on our CDN are removed within 14 days of account deletion.
                            </Bullet>
                            <Bullet label="Security Logs">
                                IP addresses and security audit logs are retained for up to 12 months to allow investigation
                                of abuse, fraud, or legal requests.
                            </Bullet>
                            <Bullet label="Moderation Records">
                                Discord server moderation records (warnings, bans) are retained at the discretion of the
                                server administrators who issued them.
                            </Bullet>
                        </ul>
                    </Section>

                    <Section title="9. Security">
                        <ul style={{ margin: '0 0 10px 0', paddingLeft: '20px' }}>
                            <Bullet label="Passwords">Hashed with bcrypt. Never stored in plaintext.</Bullet>
                            <Bullet label="Private Messages">Encrypted at rest with AES-256-GCM.</Bullet>
                            <Bullet label="2FA Secrets">Encrypted before storage in our database.</Bullet>
                            <Bullet label="Connections">All traffic is served over HTTPS/TLS.</Bullet>
                            <Bullet label="Sessions">Sessions are stored server-side and expire on logout or inactivity.</Bullet>
                        </ul>
                        <P>
                            Despite these measures, no system is 100% secure. We encourage you to use a strong, unique password
                            and enable 2FA on your account. Maintain local backups of any project files you upload.
                        </P>
                    </Section>

                    <Section title="10. Your Rights">
                        <P>You have the following rights over your personal data:</P>
                        <ul style={{ margin: '0 0 10px 0', paddingLeft: '20px' }}>
                            <Bullet label="Access">Request a copy of the personal data we hold about you.</Bullet>
                            <Bullet label="Correction">Request that inaccurate data be corrected.</Bullet>
                            <Bullet label="Deletion">Request deletion of your account and all associated personal data.</Bullet>
                            <Bullet label="Portability">Request an export of your uploaded content and profile data.</Bullet>
                            <Bullet label="Objection">Object to specific processing activities (e.g., AI-powered features).</Bullet>
                        </ul>
                        <P>
                            To exercise any of these rights, contact us at{' '}
                            <a href="mailto:legal@fujistud.io" style={{ color: colors.primary }}>legal@fujistud.io</a>.
                            We aim to respond within 30 days.
                        </P>
                    </Section>

                    <Section title="11. Children's Privacy">
                        <P>
                            Fuji Studio is not directed at children under 13. We do not knowingly collect personal data from
                            children under 13. If you believe a child under 13 has provided us with personal data, please
                            contact <a href="mailto:legal@fujistud.io" style={{ color: colors.primary }}>legal@fujistud.io</a> and
                            we will promptly remove it.
                        </P>
                    </Section>

                    <Section title="12. Changes to This Policy">
                        <P>
                            We may update this Privacy Policy from time to time. Material changes will be announced via our
                            website and official Discord server. The "Last updated" date at the top of this page reflects
                            when the most recent revision was published. Continued use of the platform after changes are
                            posted constitutes your acceptance of the updated policy.
                        </P>
                    </Section>
                </div>

                {/* Contact */}
                <div style={{ backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, marginTop: spacing.xl, textAlign: 'center' }}>
                    <P>Questions? Email us at <a href="mailto:legal@fujistud.io" style={{ color: colors.primary }}>legal@fujistud.io</a></P>
                </div>
            </div>
        </DiscoveryLayout>
    );
};
