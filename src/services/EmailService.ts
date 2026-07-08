import fs from 'fs/promises';
import path from 'path';

export interface EmailMessage {
    threadId: string;
    from: string;
    fromEmail: string;
    toEmail: string;
    subject: string;
    body: string;
    date: string;
    category: 'inbox' | 'sent' | 'trash';
    read: boolean;
    notified?: boolean; // Internal flag for Discord alerts
    messageId?: string;
    inReplyTo?: string;
    references?: string[];
    attachments?: Array<{
        filename: string;
        path: string;
    }>;
}

export interface EmailSettings {
    webhookSecret?: string;
    channelId?: string;
    roleId?: string;
    resendApiKey?: string;
    fromName?: string;
    fromEmail?: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'email_db.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'email_settings.json');

// Writes via a temp file + rename so a crash/restart mid-write can never leave
// a truncated, unparseable file behind (rename is atomic on the same filesystem).
async function writeJsonAtomic(file: string, data: unknown) {
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2));
    await fs.rename(tmp, file);
}

export class EmailService {

    private async ensureFiles() {
        try {
            await fs.access(DB_FILE);
        } catch {
            await writeJsonAtomic(DB_FILE, []);
        }
        try {
            await fs.access(SETTINGS_FILE);
        } catch {
            await writeJsonAtomic(SETTINGS_FILE, {});
        }
    }

    async getEmails(category?: string): Promise<EmailMessage[]> {
        await this.ensureFiles();
        const data = await fs.readFile(DB_FILE, 'utf-8');
        let emails: EmailMessage[];
        try {
            emails = JSON.parse(data);
        } catch (e) {
            throw new Error(`email_db.json is corrupted (invalid JSON): ${(e as Error).message}`);
        }
        if (category) {
            return emails.filter(e => e.category === category).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }
        return emails.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    async getEmail(threadId: string): Promise<EmailMessage | undefined> {
        const emails = await this.getEmails();
        return emails.find(e => e.threadId === threadId);
    }

    async addEmail(email: EmailMessage): Promise<void> {
        const emails = await this.getEmails();
        emails.push(email);
        await writeJsonAtomic(DB_FILE, emails);
    }

    async updateEmail(threadId: string, updates: Partial<EmailMessage>): Promise<void> {
        const emails = await this.getEmails();
        const index = emails.findIndex(e => e.threadId === threadId);
        if (index !== -1) {
            emails[index] = { ...emails[index], ...updates };
            await writeJsonAtomic(DB_FILE, emails);
        }
    }

    async getSettings(): Promise<EmailSettings> {
        await this.ensureFiles();
        const data = await fs.readFile(SETTINGS_FILE, 'utf-8');
        try {
            return JSON.parse(data);
        } catch (e) {
            throw new Error(`email_settings.json is corrupted (invalid JSON): ${(e as Error).message}`);
        }
    }

    async updateSettings(settings: Partial<EmailSettings>): Promise<void> {
        const current = await this.getSettings();
        const updated = { ...current, ...settings };
        await writeJsonAtomic(SETTINGS_FILE, updated);
    }

    async getThread(subject: string): Promise<EmailMessage[]> {
        const emails = await this.getEmails();
        const normalize = (s: string) => s.replace(/^(Re|Fwd|FW):\s*/i, '').trim().toLowerCase();
        const target = normalize(subject);
        
        return emails.filter(e => 
            normalize(e.subject) === target && e.category !== 'trash'
        ).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }

    async getUnnotified(): Promise<EmailMessage[]> {
        const emails = await this.getEmails();
        return emails.filter(e => e.category === 'inbox' && !e.notified);
    }
}
