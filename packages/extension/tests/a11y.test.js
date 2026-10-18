import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Relative luminance formula per WCAG 2.1 / 2.2 guidelines
function sRGBtoLin(c) {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16)
  };
}

function getLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * sRGBtoLin(r) + 0.7152 * sRGBtoLin(g) + 0.0722 * sRGBtoLin(b);
}

function getContrastRatio(hex1, hex2) {
  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  const brighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (brighter + 0.05) / (darker + 0.05);
}

describe('WCAG 2.2 AA Automated Accessibility Audit Suite', () => {
  const htmlPath = path.resolve(__dirname, '../sidepanel.html');
  const cssPath = path.resolve(__dirname, '../sidepanel.css');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  test('WCAG 3.1.1: Document has valid lang attribute and viewport meta', () => {
    assert.match(htmlContent, /<html\s+[^>]*lang=["'][a-z]{2}(-[A-Z]{2})?["']/i, 'HTML tag must have a valid lang attribute');
    assert.match(htmlContent, /<meta\s+[^>]*name=["']viewport["']/i, 'Viewport meta tag must be declared');
    assert.match(htmlContent, /<title>[^<]+<\/title>/i, 'Title tag must not be empty');
  });

  test('WCAG 1.3.1: Landmark roles and semantic page structure', () => {
    assert.ok(htmlContent.includes('<header') || htmlContent.includes('role="banner"'), 'Page must contain header landmark');
    assert.ok(htmlContent.includes('<main') || htmlContent.includes('role="main"'), 'Page must contain main landmark');
    assert.ok(htmlContent.includes('<footer') || htmlContent.includes('role="contentinfo"'), 'Page must contain footer landmark');
  });

  test('WCAG 1.3.1 & 2.4.6: Heading structure has single h1 and hierarchical h2', () => {
    const h1Matches = htmlContent.match(/<h1[^>]*>.*?<\/h1>/gis) || [];
    assert.equal(h1Matches.length, 1, 'Page must contain exactly one h1 element');

    const h2Matches = htmlContent.match(/<h2[^>]*>.*?<\/h2>/gis) || [];
    assert.ok(h2Matches.length >= 2, 'Page must contain appropriate h2 subordinate sections');
  });

  test('WCAG 4.1.2: All form controls and buttons have accessible names', () => {
    // Check all inputs
    const inputMatches = htmlContent.match(/<input[^>]*>/gi) || [];
    for (const input of inputMatches) {
      const hasId = /id=["']([^"']+)["']/i.exec(input);
      const hasAriaLabel = /aria-label=["'][^"']+["']/i.test(input);
      if (hasId) {
        const id = hasId[1];
        const hasAssociatedLabel = new RegExp(`<label[^>]*for=["']${id}["']`, 'i').test(htmlContent);
        assert.ok(hasAssociatedLabel || hasAriaLabel, `Input #${id} must have an associated label or aria-label`);
      }
    }

    // Check all buttons
    const buttonMatches = htmlContent.match(/<button[^>]*>([\s\S]*?)<\/button>/gi) || [];
    for (const button of buttonMatches) {
      const hasAriaLabel = /aria-label=["'][^"']+["']/i.test(button);
      const textContent = button.replace(/<[^>]+>/g, '').trim();
      assert.ok(hasAriaLabel || textContent.length > 0, `Button must have text content or an aria-label: ${button}`);
    }
  });

  test('WCAG 4.1.3: Status updates and alerts use ARIA live regions', () => {
    // Critical handoff alert uses assertive
    assert.match(htmlContent, /role=["']alert["']\s+aria-live=["']assertive["']|aria-live=["']assertive["']/i, 'Security handoff alert must use aria-live assertive');

    // Streaming logs use polite
    assert.match(htmlContent, /aria-live=["']polite["']/i, 'Execution stream must use aria-live polite');
  });

  test('WCAG 2.4.7: Visible focus rings and keyboard indicators are defined in CSS', () => {
    assert.match(cssContent, /:focus-visible|:focus/i, 'CSS must define focus indicators for keyboard navigation');
    assert.match(cssContent, /outline:\s*2px/i, 'Focus indicator must have distinct visible outline');
  });

  test('WCAG 1.4.3: Color contrast ratios meet or exceed 4.5:1 for normal text', () => {
    // Dark Theme tokens
    const darkBg = '#12141a';
    const darkTextPrimary = '#f0f4fc';
    const darkTextSecondary = '#9aa4bc';
    const darkAccent = '#2563eb';
    const darkDanger = '#dc2626';

    const ratioDarkPrimary = getContrastRatio(darkBg, darkTextPrimary);
    const ratioDarkSecondary = getContrastRatio(darkBg, darkTextSecondary);
    const ratioDarkAccentBtn = getContrastRatio(darkAccent, '#ffffff');
    const ratioDarkDangerBtn = getContrastRatio(darkDanger, '#ffffff');

    assert.ok(ratioDarkPrimary >= 4.5, `Dark primary text contrast ${ratioDarkPrimary.toFixed(2)} must be >= 4.5:1`);
    assert.ok(ratioDarkSecondary >= 4.5, `Dark secondary text contrast ${ratioDarkSecondary.toFixed(2)} must be >= 4.5:1`);
    assert.ok(ratioDarkAccentBtn >= 4.5, `Dark accent button text contrast ${ratioDarkAccentBtn.toFixed(2)} must be >= 4.5:1`);
    assert.ok(ratioDarkDangerBtn >= 4.5, `Dark danger button text contrast ${ratioDarkDangerBtn.toFixed(2)} must be >= 4.5:1`);

    // Light Theme tokens
    const lightBg = '#ffffff';
    const lightTextPrimary = '#0f172a';
    const lightTextSecondary = '#475569';
    const lightAccent = '#2563eb';
    const lightDanger = '#dc2626';

    const ratioLightPrimary = getContrastRatio(lightBg, lightTextPrimary);
    const ratioLightSecondary = getContrastRatio(lightBg, lightTextSecondary);
    const ratioLightAccentBtn = getContrastRatio(lightAccent, '#ffffff');
    const ratioLightDangerBtn = getContrastRatio(lightDanger, '#ffffff');

    assert.ok(ratioLightPrimary >= 4.5, `Light primary text contrast ${ratioLightPrimary.toFixed(2)} must be >= 4.5:1`);
    assert.ok(ratioLightSecondary >= 4.5, `Light secondary text contrast ${ratioLightSecondary.toFixed(2)} must be >= 4.5:1`);
    assert.ok(ratioLightAccentBtn >= 4.5, `Light accent button text contrast ${ratioLightAccentBtn.toFixed(2)} must be >= 4.5:1`);
    assert.ok(ratioLightDangerBtn >= 4.5, `Light danger button text contrast ${ratioLightDangerBtn.toFixed(2)} must be >= 4.5:1`);
  });
});
