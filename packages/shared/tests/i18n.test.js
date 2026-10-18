import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { I18nManager, i18n } from '../src/index.js';

describe('Internationalization (i18n) Module Tests', () => {
  test('returns English strings by default', () => {
    const manager = new I18nManager('en');
    assert.equal(manager.t('app_title'), 'Agentic Browser');
    assert.equal(manager.t('btn_run'), 'Run Task');
    assert.equal(manager.getDirection(), 'ltr');
  });

  test('interpolates parameters correctly in English', () => {
    const manager = new I18nManager('en');
    const result = manager.t('token_count', { count: 350 });
    assert.equal(result, 'Tokens: 350');

    const latency = manager.t('latency_count', { ms: 42 });
    assert.equal(latency, 'Latency: 42ms');
  });

  test('switches to Bangla (bn) and translates strings with interpolation', () => {
    const manager = new I18nManager('en');
    manager.setLocale('bn');

    assert.equal(manager.getLocale(), 'bn');
    assert.equal(manager.t('app_title'), 'এজেন্টিক ব্রাউজার');
    assert.equal(manager.t('btn_run'), 'টাস্ক শুরু করুন');
    assert.equal(manager.t('token_count', { count: 500 }), 'টোকেন: 500');
    assert.equal(manager.t('latency_count', { ms: 85 }), 'লেটেন্সি: 85 মিলি সেকেন্ড');
  });

  test('falls back to English when translation key is absent in target locale', () => {
    const manager = new I18nManager('en');
    manager.registerLocale('fr', {
      locale: 'fr',
      direction: 'ltr',
      strings: {
        app_title: 'Navigateur Agentique'
      }
    });

    manager.setLocale('fr');
    assert.equal(manager.t('app_title'), 'Navigateur Agentique');
    // Missing 'btn_run' falls back to English
    assert.equal(manager.t('btn_run'), 'Run Task');
  });

  test('returns raw key if string does not exist in any locale', () => {
    const manager = new I18nManager('en');
    assert.equal(manager.t('non_existent_key'), 'non_existent_key');
  });

  test('supports RTL direction configuration for RTL-ready UI', () => {
    const manager = new I18nManager('en');
    manager.registerLocale('ar', {
      locale: 'ar',
      direction: 'rtl',
      strings: {
        app_title: 'المتصفح الوكيل'
      }
    });

    manager.setLocale('ar');
    assert.equal(manager.getDirection(), 'rtl');
  });

  test('throws when switching to an unregistered locale', () => {
    const manager = new I18nManager('en');
    assert.throws(() => {
      manager.setLocale('de');
    }, /Locale 'de' is not registered/);
  });
});
