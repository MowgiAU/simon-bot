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

export class EmailService {
    
    private async ensureFiles() {
        try {
            await fs.access(DB_FILE);
        } catch {
            await fs.writeFile(DB_FILE, '[]');
        }
        try {
            await fs.access(SETTINGS_FILE);
        } catch {
            await fs.writeFile(SETTINGS_FILE, '{}');
        }
    }

    async getEmails(category?: string): Promise<EmailMessage[]> {
        await this.ensureFiles();
        const data = await fs.readFile(DB_FILE, 'utf-8');
        const emails: EmailMessage[] = JSON.parse(data);
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
        await fs.writeFile(DB_FILE, JSON.stringify(emails, null, 2));
    }

    async updateEmail(threadId: string, updates: Partial<EmailMessage>): Promise<void> {
        const emails = await this.getEmails();
        const index = emails.findIndex(e => e.threadId === threadId);
        if (index !== -1) {
            emails[index] = { ...emails[index], ...updates };
            await fs.writeFile(DB_FILE, JSON.stringify(emails, null, 2));
        }
    }

    async getSettings(): Promise<EmailSettings> {
        await this.ensureFiles();
        const data = await fs.readFile(SETTINGS_FILE, 'utf-8');
        return JSON.parse(data);
    }

    async updateSettings(settings: Partial<EmailSettings>): Promise<void> {
        const current = await this.getSettings();
        const updated = { ...current, ...settings };
        await fs.writeFile(SETTINGS_FILE, JSON.stringify(updated, null, 2));
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
