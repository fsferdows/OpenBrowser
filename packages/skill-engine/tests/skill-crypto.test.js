import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateSkillKeyPair,
  canonicalizeSkill,
  signSkill,
  verifySkillSignature,
  SkillKeyring,
  SkillCryptoEngine,
  SignatureVerificationError
} from '../src/skill-crypto.js';
import { SkillLibrary } from '../src/skill-library.js';

describe('Ed25519 Skill Cryptographic Signing & Verification Tests', () => {
  const baseSkill = {
    id: 'extract-financial-report',
    name: 'Extract Financial Report',
    description: 'Navigates to financial dashboard and extracts earnings summary tables.',
    version: '1.0.0',
    schema_version: '1.0.0',
    parameters: {
      quarter: { type: 'string', description: 'Fiscal quarter (e.g. Q3)', required: true }
    },
    triggers: ['extract earnings', 'download quarterly financials'],
    domains_allowed: ['finance.example.com'],
    steps: [
      {
        id: 's1',
        action: 'navigate',
        target: { role: 'page', name: 'Dashboard', selector: 'body' },
        value: 'https://finance.example.com/reports?q={{quarter}}',
        expect: { condition: 'element_visible:.earnings-table' },
        on_fail: { strategy: 'retry' }
      },
      {
        id: 's2',
        action: 'extract',
        target: { role: 'table', name: 'Earnings Table', selector: '.earnings-table' },
        expect: { condition: 'item_count_gt:0' },
        on_fail: { strategy: 'abort' }
      }
    ],
    risk_level: 'low',
    requires_confirmation: false,
    tests: [
      {
        test_id: 'test-q3',
        input_params: { quarter: 'Q3' },
        expected_terminal_state: 'extracted'
      }
    ],
    success_metrics: { max_duration_ms: 10000, max_steps: 2 },
    provenance: {
      author: 'alice@audit.local',
      created_at: '2026-10-19T12:00:00Z',
      source_type: 'human_authored'
    },
    signature: 'unsigned',
    changelog: [{ version: '1.0.0', date: '2026-10-19', notes: 'Initial audit release' }]
  };

  test('generateSkillKeyPair generates valid Ed25519 keypair in hex format', () => {
    const keyPair = generateSkillKeyPair();
    assert.ok(keyPair.publicKey);
    assert.ok(keyPair.privateKey);
    assert.equal(typeof keyPair.publicKey, 'string');
    assert.equal(typeof keyPair.privateKey, 'string');
    assert.ok(keyPair.publicKey.length > 20);
  });

  test('canonicalizeSkill produces identical output regardless of property order and excludes signature', () => {
    const skillA = {
      b: 2,
      id: 'test',
      a: 1,
      signature: 'signature_a'
    };
    const skillB = {
      signature: 'different_signature',
      a: 1,
      b: 2,
      id: 'test'
    };

    const canonA = canonicalizeSkill(skillA);
    const canonB = canonicalizeSkill(skillB);

    assert.equal(canonA, canonB);
    assert.ok(!canonA.includes('signature'));
  });

  test('signSkill produces valid ed25519 signature adhering to skill schema', () => {
    const keyPair = generateSkillKeyPair();
    const signedSkill = signSkill(baseSkill, keyPair.privateKey, keyPair.publicKey);

    assert.ok(signedSkill.signature.startsWith('ed25519:'));
    const parts = signedSkill.signature.split(':');
    assert.equal(parts.length, 3);
    assert.equal(parts[0], 'ed25519');
    assert.ok(parts[1].length > 30, 'Signature string exists');
    assert.equal(parts[2], keyPair.publicKey, 'Public key matches');
  });

  test('verifySkillSignature returns true for untampered signed skill', () => {
    const keyPair = generateSkillKeyPair();
    const signedSkill = signSkill(baseSkill, keyPair.privateKey, keyPair.publicKey);

    const result = verifySkillSignature(signedSkill);
    assert.equal(result.valid, true);
    assert.equal(result.signerPublicKey, keyPair.publicKey);
  });

  test('verifySkillSignature fails when skill payload is tampered', () => {
    const keyPair = generateSkillKeyPair();
    const signedSkill = signSkill(baseSkill, keyPair.privateKey, keyPair.publicKey);

    // Tamper with step action
    const tamperedSkill = JSON.parse(JSON.stringify(signedSkill));
    tamperedSkill.steps[0].value = 'https://malicious-exfiltrate.example.com/steal';

    const result = verifySkillSignature(tamperedSkill);
    assert.equal(result.valid, false);
    assert.ok(result.reason.includes('Cryptographic signature verification failed'));
  });

  test('verifySkillSignature fails when signature is corrupted', () => {
    const keyPair = generateSkillKeyPair();
    const signedSkill = signSkill(baseSkill, keyPair.privateKey, keyPair.publicKey);

    const corruptedSkill = JSON.parse(JSON.stringify(signedSkill));
    corruptedSkill.signature = `ed25519:badsignature:${keyPair.publicKey}`;

    const result = verifySkillSignature(corruptedSkill);
    assert.equal(result.valid, false);
  });

  test('SkillKeyring manages trusted public keys and verifies trust status', () => {
    const keyring = new SkillKeyring();
    const keyPairA = generateSkillKeyPair();
    const keyPairB = generateSkillKeyPair();

    keyring.addTrustedKey(keyPairA.publicKey, 'Alice (Auditor)');

    assert.equal(keyring.isTrusted(keyPairA.publicKey), true);
    assert.equal(keyring.isTrusted(keyPairB.publicKey), false);
    assert.equal(keyring.getKeyLabel(keyPairA.publicKey), 'Alice (Auditor)');

    keyring.removeTrustedKey(keyPairA.publicKey);
    assert.equal(keyring.isTrusted(keyPairA.publicKey), false);
  });

  test('SkillCryptoEngine imports trusted low-risk skill directly without review prompt', () => {
    const keyring = new SkillKeyring();
    const library = new SkillLibrary();
    const engine = new SkillCryptoEngine(keyring, library);

    const authorKeyPair = generateSkillKeyPair();
    keyring.addTrustedKey(authorKeyPair.publicKey, 'Verified Core Author');

    const signedSkill = signSkill(baseSkill, authorKeyPair.privateKey, authorKeyPair.publicKey);

    let reviewCalled = false;
    const imported = engine.importSkill(signedSkill, {
      onReviewRequired: () => {
        reviewCalled = true;
        return true;
      }
    });

    assert.equal(reviewCalled, false, 'Trusted low-risk skill should not require interactive review');
    assert.equal(imported.id, 'extract-financial-report');
    assert.ok(library.getSkill('extract-financial-report'));
  });

  test('SkillCryptoEngine enforces interactive review for untrusted signers', () => {
    const keyring = new SkillKeyring();
    const library = new SkillLibrary();
    const engine = new SkillCryptoEngine(keyring, library);

    const unknownAuthorKeyPair = generateSkillKeyPair();
    // Do not add to keyring -> untrusted
    const signedSkill = signSkill(baseSkill, unknownAuthorKeyPair.privateKey, unknownAuthorKeyPair.publicKey);

    let reviewTriggered = false;
    let reviewMetadata = null;

    const imported = engine.importSkill(signedSkill, {
      onReviewRequired: (meta) => {
        reviewTriggered = true;
        reviewMetadata = meta;
        return true; // User explicitly approves
      }
    });

    assert.equal(reviewTriggered, true, 'Untrusted signer must trigger review callback');
    assert.equal(reviewMetadata.isSignerTrusted, false);
    assert.equal(imported.id, 'extract-financial-report');
  });

  test('SkillCryptoEngine rejects import if interactive review is declined', () => {
    const keyring = new SkillKeyring();
    const library = new SkillLibrary();
    const engine = new SkillCryptoEngine(keyring, library);

    const unknownAuthorKeyPair = generateSkillKeyPair();
    const signedSkill = signSkill(baseSkill, unknownAuthorKeyPair.privateKey, unknownAuthorKeyPair.publicKey);

    assert.throws(
      () => {
        engine.importSkill(signedSkill, {
          onReviewRequired: () => false // User rejects
        });
      },
      /Import rejected during human review/
    );
  });

  test('SkillCryptoEngine rejects tampered skill before reaching review step', () => {
    const keyring = new SkillKeyring();
    const library = new SkillLibrary();
    const engine = new SkillCryptoEngine(keyring, library);

    const authorKeyPair = generateSkillKeyPair();
    const signedSkill = signSkill(baseSkill, authorKeyPair.privateKey, authorKeyPair.publicKey);

    const tampered = JSON.parse(JSON.stringify(signedSkill));
    tampered.name = 'Tampered Skill Name';

    assert.throws(
      () => {
        engine.importSkill(tampered, {
          onReviewRequired: () => true
        });
      },
      SignatureVerificationError
    );
  });

  test('SkillCryptoEngine exportSkill signs and packages skill with metadata', () => {
    const keyring = new SkillKeyring();
    const library = new SkillLibrary();
    library.registerSkill(baseSkill);

    const engine = new SkillCryptoEngine(keyring, library);
    const authorKeyPair = generateSkillKeyPair();

    const exportedPackage = engine.exportSkill('extract-financial-report', authorKeyPair.privateKey, authorKeyPair.publicKey);

    assert.ok(exportedPackage.skill);
    assert.ok(exportedPackage.skill.signature.startsWith('ed25519:'));
    assert.equal(exportedPackage.publicKey, authorKeyPair.publicKey);
    assert.equal(exportedPackage.algorithm, 'ed25519');
    assert.ok(exportedPackage.exportedAt);
  });
});
