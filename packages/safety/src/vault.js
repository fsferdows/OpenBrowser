import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'node:crypto';

export class EncryptedVault {
  constructor(masterPassword = 'default-in-memory-key') {
    // Derive 256-bit key using PBKDF2/scrypt
    const salt = Buffer.from('agentic-browser-vault-salt-2026');
    this.key = scryptSync(masterPassword, salt, 32);
    this.entries = new Map();
    this.knownSecretValues = new Set();
    this.auditLogs = [];
  }

  /**
   * Encrypts and stores a credential in the vault.
   */
  setSecret(key, plaintextValue) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);

    let encrypted = cipher.update(plaintextValue, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    this.entries.set(key, {
      iv: iv.toString('hex'),
      authTag,
      ciphertext: encrypted
    });

    this.knownSecretValues.add(plaintextValue);
    this.logAuditEvent('VAULT_SET', `Stored encrypted secret for key: ${key}`);
    return true;
  }

  /**
   * Retrieves and decrypts a credential in memory for direct CDP field dispatch.
   */
  getSecret(key) {
    const record = this.entries.get(key);
    if (!record) return null;

    const iv = Buffer.from(record.iv, 'hex');
    const authTag = Buffer.from(record.authTag, 'hex');
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(record.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    this.logAuditEvent('VAULT_ACCESS', `Accessed secret for key: ${key}`);
    return decrypted;
  }

  deleteSecret(key) {
    const existed = this.entries.delete(key);
    if (existed) {
      this.logAuditEvent('VAULT_DELETE', `Deleted secret for key: ${key}`);
    }
    return existed;
  }

  /**
   * Redacts known secrets and tokens from text before outputting to logs, traces, or telemetry.
   */
  scrubSecrets(text) {
    if (typeof text !== 'string') return text;
    let scrubbed = text;

    for (const secret of this.knownSecretValues) {
      if (secret && secret.length >= 4) {
        scrubbed = scrubbed.split(secret).join('[REDACTED_SECRET]');
      }
    }

    // Also scrub regex patterns for API keys
    scrubbed = scrubbed.replace(/\bsk-[a-zA-Z0-9_\-]{8,}\b/g, '[REDACTED_API_KEY]');
    scrubbed = scrubbed.replace(/\bAIzaSy[a-zA-Z0-9_\-]{33}\b/g, '[REDACTED_GOOGLE_KEY]');

    return scrubbed;
  }

  logAuditEvent(action, detail) {
    this.auditLogs.push({
      timestamp: new Date().toISOString(),
      action,
      detail: this.scrubSecrets(detail)
    });
  }

  getAuditLogs() {
    return [...this.auditLogs];
  }
}
