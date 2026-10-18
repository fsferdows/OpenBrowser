import enLocale from './locales/en.json' with { type: 'json' };
import bnLocale from './locales/bn.json' with { type: 'json' };

export class I18nManager {
  constructor(defaultLocale = 'en') {
    this.locales = new Map();
    this.currentLocale = defaultLocale;

    // Register built-in locales
    this.registerLocale(enLocale.locale, enLocale);
    this.registerLocale(bnLocale.locale, bnLocale);
  }

  registerLocale(localeCode, data) {
    if (!localeCode || !data || !data.strings) {
      throw new Error(`Invalid locale registration for ${localeCode}`);
    }
    this.locales.set(localeCode, data);
  }

  setLocale(localeCode) {
    if (!this.locales.has(localeCode)) {
      throw new Error(`Locale '${localeCode}' is not registered`);
    }
    this.currentLocale = localeCode;
  }

  getLocale() {
    return this.currentLocale;
  }

  getDirection() {
    const localeData = this.locales.get(this.currentLocale);
    return localeData ? localeData.direction || 'ltr' : 'ltr';
  }

  /**
   * Translates a string key with optional parameter interpolation.
   * Example: t('token_count', { count: 125 }) -> "Tokens: 125"
   */
  t(key, params = {}) {
    const localeData = this.locales.get(this.currentLocale);
    let str = localeData?.strings?.[key];

    // Fallback to English if missing in current locale
    if (!str && this.currentLocale !== 'en') {
      str = this.locales.get('en')?.strings?.[key];
    }

    if (!str) {
      return key;
    }

    // Interpolate {paramName}
    return str.replace(/\{(\w+)\}/g, (_, paramName) => {
      return params[paramName] !== undefined ? String(params[paramName]) : `{${paramName}}`;
    });
  }
}

export const i18n = new I18nManager('en');
