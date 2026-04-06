import crypto from 'crypto';

/**
 * Server-side message encryption using AES-256-GCM.
 * Each conversation gets its own randomly-generated key.
 * Conversation keys are stored encrypted with a server master key.
 */
export class MessageEncryption {
    private masterKey: Buffer;

    constructor() {
        const envKey = process.env.MESSAGE_ENCRYPTION_KEY;
        if (envKey && envKey.length === 64) {
            this.masterKey = Buffer.from(envKey, 'hex');
        } else {
            // Derive from SESSION_SECRET so it works out of the box
            const secret = process.env.SESSION_SECRET || process.env.JWT_SECRET || 'fuji-studio-default';
            this.masterKey = crypto.pbkdf2Sync(secret, 'fuji-msg-enc', 100_000, 32, 'sha256');
        }
    }

    /** Generate a new encrypted conversation key */
    generateConversationKey(): string {
        const key = crypto.randomBytes(32);
        return this.wrapKey(key);
    }

    /** Encrypt plaintext message content */
    encrypt(plaintext: string, encryptedConvKey: string): { ciphertext: string; iv: string } {
        const convKey = this.unwrapKey(encryptedConvKey);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', convKey, iv);
        const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
        const tag = cipher.getAuthTag();
        return {
            ciphertext: `${encrypted.toString('hex')}:${tag.toString('hex')}`,
            iv: iv.toString('hex'),
        };
    }

    /** Decrypt ciphertext back to plaintext */
    decrypt(ciphertext: string, iv: string, encryptedConvKey: string): string {
        const convKey = this.unwrapKey(encryptedConvKey);
        const [encHex, tagHex] = ciphertext.split(':');
        const decipher = crypto.createDecipheriv('aes-256-gcm', convKey, Buffer.from(iv, 'hex'));
        decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
        return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8');
    }

    // --- Internal helpers ---

    private wrapKey(key: Buffer): string {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);
        const encrypted = Buffer.concat([cipher.update(key), cipher.final()]);
        const tag = cipher.getAuthTag();
        return `${iv.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`;
    }

    private unwrapKey(wrapped: string): Buffer {
        const [ivHex, encHex, tagHex] = wrapped.split(':');
        const decipher = crypto.createDecipheriv('aes-256-gcm', this.masterKey, Buffer.from(ivHex, 'hex'));
        decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
        return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]);
    }
}
