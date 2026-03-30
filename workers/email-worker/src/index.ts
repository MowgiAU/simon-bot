/**
 * Cloudflare Email Worker
 *
 * Receives emails from Cloudflare Email Routing and forwards
 * the raw MIME to the Fuji Studio API webhook for processing.
 */

export interface Env {
	API_URL: string;        // e.g. "https://fujistudio.app"
	WEBHOOK_SECRET: string; // shared secret for x-auth-token header
}

export default {
	async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
		const apiUrl = env.API_URL || 'https://fujistudio.app';
		const secret = env.WEBHOOK_SECRET;

		if (!secret) {
			console.error('WEBHOOK_SECRET not configured — dropping email');
			message.setReject('Configuration error');
			return;
		}

		// Read the full raw MIME message
		const reader = message.raw.getReader();
		const chunks: Uint8Array[] = [];
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			if (value) chunks.push(value);
		}

		const rawEmail = new TextDecoder().decode(
			chunks.reduce((acc, chunk) => {
				const merged = new Uint8Array(acc.length + chunk.length);
				merged.set(acc);
				merged.set(chunk, acc.length);
				return merged;
			}, new Uint8Array(0))
		);

		console.log(`Received email from ${message.from} to ${message.to}, size: ${rawEmail.length} bytes`);

		// POST raw MIME to the API webhook
		const response = await fetch(`${apiUrl}/api/email/webhook`, {
			method: 'POST',
			headers: {
				'Content-Type': 'message/rfc822',
				'x-auth-token': secret,
			},
			body: rawEmail,
		});

		if (!response.ok) {
			const text = await response.text();
			console.error(`Webhook responded ${response.status}: ${text}`);
			message.setReject(`Webhook error: ${response.status}`);
			return;
		}

		console.log(`Email forwarded successfully: ${message.from} → ${message.to}`);
	},
};
