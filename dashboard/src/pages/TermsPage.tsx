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
                            Fuji Studio — Last updated May 26, 2026
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
                    <h2 style={{ color: colors.primary, fontSize: '22px', fontWeight: 800, margin: '0 0 20px 0', letterSpacing: '-0.02em' }}>
                        Part 2: Privacy Policy
                    </h2>

                    <Section title="1. Data Collection">
                        <P>We collect minimal data to provide a seamless production community:</P>
                        <ul style={{ margin: '0 0 10px 0', paddingLeft: '20px' }}>
                            <Bullet label="Authentication">Discord Username, Discord ID, and Email Address.</Bullet>
                            <Bullet label="Profile Data">Bio, display name, social links, and gear lists.</Bullet>
                            <Bullet label="Content">Hosted audio previews, user-uploaded audio samples, artwork, and .flp files.</Bullet>
                            <Bullet label="Communications">
                                We store the content of public comments you post and private messages you send/receive to ensure
                                delivery and allow for moderation. This includes timestamps and recipient IDs.
                            </Bullet>
                            <Bullet label="Analytics &amp; Security">
                                Basic play counts, download metrics to power "Trending" sections, and IP addresses strictly
                                for security, moderation, and anti-spam purposes.
                            </Bullet>
                        </ul>
                    </Section>

                    <Section title="2. Use of Data">
                        <P>
                            Your data is used to maintain your artist profile, attribute your uploads, and provide the global
                            streaming player. We do not sell your personal data to third parties. We only share necessary data
                            with trusted third-party service providers (such as hosting and database providers) essential to
                            operating the site.
                        </P>
                        <ul style={{ margin: '0 0 10px 0', paddingLeft: '20px' }}>
                            <Bullet label="Moderation">
                                We may use automated tools or manual review of communication data to detect and prevent spam,
                                fraud, or harassment.
                            </Bullet>
                        </ul>
                    </Section>

                    <Section title="3. Visibility">
                        <ul style={{ margin: '0 0 10px 0', paddingLeft: '20px' }}>
                            <Bullet label="Profiles &amp; Tracks">
                                Profiles and tracks/files marked "Public" are visible to all visitors. Users can manage the visibility
                                of their tracks (Public vs. Private) via their dashboard at any time.
                            </Bullet>
                            <Bullet label="Comments">
                                Anything posted in the public comments section of a project or profile is visible to all visitors.
                            </Bullet>
                            <Bullet label="Private Messages">
                                These are visible only to the participants of the conversation and authorized Fuji Studio
                                administrators during moderation investigations.
                            </Bullet>
                        </ul>
                    </Section>

                    <Section title="4. Cookies & Security">
                        <P>
                            We use essential cookies for session management (keeping you logged in) and player state (volume/queue).
                            While we use industry-standard encryption to protect your data, users are heavily encouraged to keep
                            local backups of all uploaded project files.
                        </P>
                    </Section>

                    <Section title="5. Data Rights & Deletion">
                        <P>
                            You have the right to access, correct, or delete your personal data. Users may request full account
                            and data deletion by contacting{' '}
                            <a href="mailto:legal@fujistud.io" style={{ color: colors.primary }}>legal@fujistud.io</a>.
                            We aim to process all deletion requests within 30 days.
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
