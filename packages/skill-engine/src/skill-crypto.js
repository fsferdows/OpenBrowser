import {
  generateKeyPairSync,
  createPrivateKey,
  createPublicKey,
  sign,
  verify
} from 'node:crypto';

export class SignatureVerificationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'SignatureVerificationError';
    this.details = details;
  }
}

/**
 * Generates an Ed25519 keypair for skill signing and verification.
 * Returns { publicKey, privateKey } as hex strings (SPKI DER / PKCS#8 DER).
 */
export function generateSkillKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' }
  });
  return {
    publicKey: publicKey.toString('hex'),
    privateKey: privateKey.toString('hex')
  };
}

/**
 * Produces deterministic canonical JSON string representation of a skill,
 * sorting all object keys alphabetically and omitting the 'signature' field.
 */
export function canonicalizeSkill(obj) {
  function sortKeys(value) {
    if (value === null || typeof value !== 'object') {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map(sortKeys);
    }
    const sorted = {};
    for (const key of Object.keys(value).sort()) {
      if (key === 'signature') continue;
      sorted[key] = sortKeys(value[key]);
    }
    return sorted;
  }
  return JSON.stringify(sortKeys(obj));
}

/**
 * Signs a canonical skill object using an Ed25519 private key.
 * Appends signature formatted as: ed25519:<sigHex>:<pubHex>
 */
export function signSkill(skill, privateKeyHexOrPem, publicKeyHexOrPem = null) {
  const canonicalPayload = Buffer.from(canonicalizeSkill(skill), 'utf8');

  const privKeyObj = typeof privateKeyHexOrPem === 'string' && !privateKeyHexOrPem.includes('---')
    ? createPrivateKey({ key: Buffer.from(privateKeyHexOrPem, 'hex'), format: 'der', type: 'pkcs8' })
    : createPrivateKey(privateKeyHexOrPem);

  const sigBuffer = sign(null, canonicalPayload, privKeyObj);
  const sigHex = sigBuffer.toString('hex');

  let pubHex = null;
  if (publicKeyHexOrPem && typeof publicKeyHexOrPem === 'string' && !publicKeyHexOrPem.includes('---')) {
    pubHex = publicKeyHexOrPem;
  } else {
    pubHex = createPublicKey(privKeyObj).export({ type: 'spki', format: 'der' }).toString('hex');
  }

  const signed = JSON.parse(JSON.stringify(skill));
  signed.signature = `ed25519:${sigHex}:${pubHex}`;
  return signed;
}

/**
 * Verifies the Ed25519 cryptographic signature of a skill.
 */
export function verifySkillSignature(skill) {
  if (!skill || typeof skill.signature !== 'string') {
    return { valid: false, reason: 'Missing or invalid signature format' };
  }

  const parts = skill.signature.split(':');
  if (parts.length !== 3 || parts[0] !== 'ed25519') {
    return { valid: false, reason: 'Unsupported signature algorithm or format. Expected ed25519:<sig>:<pubkey>' };
  }

  const [, sigHex, pubHex] = parts;
  try {
    const pubKeyObj = createPublicKey({ key: Buffer.from(pubHex, 'hex'), format: 'der', type: 'spki' });
    const canonicalPayload = Buffer.from(canonicalizeSkill(skill), 'utf8');
    const sigBuffer = Buffer.from(sigHex, 'hex');

    const isValid = verify(null, canonicalPayload, pubKeyObj, sigBuffer);
    if (!isValid) {
      return {
        valid: false,
        signerPublicKey: pubHex,
        reason: 'Cryptographic signature verification failed: signature does not match canonical payload'
      };
    }

    return { valid: true, signerPublicKey: pubHex };
  } catch (err) {
    return { valid: false, reason: `Signature verification error: ${err.message}` };
  }
}

/**
 * SkillKeyring manages trusted public keys and their associated human labels.
 */
export class SkillKeyring {
  constructor() {
    this.trustedKeys = new Map();
  }

  addTrustedKey(pubKeyHex, label = 'Trusted Signer') {
    this.trustedKeys.set(pubKeyHex, { label, addedAt: new Date().toISOString() });
  }

  removeTrustedKey(pubKeyHex) {
    return this.trustedKeys.delete(pubKeyHex);
  }

  isTrusted(pubKeyHex) {
    return this.trustedKeys.has(pubKeyHex);
  }

  getKeyLabel(pubKeyHex) {
    return this.trustedKeys.get(pubKeyHex)?.label || null;
  }

  listTrustedKeys() {
    return Array.from(this.trustedKeys.entries()).map(([key, data]) => ({ key, ...data }));
  }
}

/**
 * SkillCryptoEngine combines cryptographic validation, keyring trust evaluation,
 * and mandatory human-in-the-loop interactive review for skill imports/exports.
 */
export class SkillCryptoEngine {
  constructor(keyring = new SkillKeyring(), library = null) {
    this.keyring = keyring;
    this.library = library;
  }

  importSkill(skill, options = {}) {
    const { onReviewRequired = null } = options;

    const verification = verifySkillSignature(skill);
    if (!verification.valid) {
      throw new SignatureVerificationError(
        `Failed to import skill '${skill?.id}': ${verification.reason}`,
        { skillId: skill?.id, verification }
      );
    }

    const signerPublicKey = verification.signerPublicKey;
    const isSignerTrusted = this.keyring.isTrusted(signerPublicKey);
    const isHighRisk = skill.risk_level === 'high' || skill.risk_level === 'critical';
    const requiresConfirmation = Boolean(skill.requires_confirmation);

    if (!isSignerTrusted || isHighRisk || requiresConfirmation) {
      const reviewContext = {
        skillId: skill.id,
        name: skill.name,
        description: skill.description,
        risk_level: skill.risk_level,
        domains_allowed: skill.domains_allowed,
        signerPublicKey,
        signerLabel: this.keyring.getKeyLabel(signerPublicKey),
        isSignerTrusted,
        requiresConfirmation
      };

      if (typeof onReviewRequired === 'function') {
        const approved = onReviewRequired(reviewContext);
        if (!approved) {
          throw new Error(`Import rejected during human review for skill '${skill.id}'`);
        }
      } else {
        throw new Error(
          `Import rejected: Skill '${skill.id}' requires interactive review (untrusted signer or high risk) but no onReviewRequired callback was provided.`
        );
      }
    }

    if (this.library) {
      this.library.registerSkill(skill);
    }

    return skill;
  }

  exportSkill(skillId, privateKey, publicKey) {
    let skill = null;
    if (this.library) {
      skill = this.library.getSkill(skillId);
    }
    if (!skill) {
      throw new Error(`Skill '${skillId}' not found in library`);
    }

    const signedSkill = signSkill(skill, privateKey, publicKey);
    return {
      skill: signedSkill,
      algorithm: 'ed25519',
      publicKey: publicKey,
      exportedAt: new Date().toISOString()
    };
  }
}
