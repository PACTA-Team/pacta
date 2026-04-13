import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import i18n from '../i18n';

describe('i18n configuration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should initialize with English as fallback', () => {
    expect(i18n.options.fallbackLng).toBe('en');
    expect(i18n.options.supportedLngs).toContain('en');
    expect(i18n.options.supportedLngs).toContain('es');
  });

  it('should have Spanish translations loaded', () => {
    expect(i18n.exists('common:loading', { lng: 'es' })).toBe(true);
    expect(i18n.exists('landing:hero.title', { lng: 'es' })).toBe(true);
    expect(i18n.exists('contracts:title', { lng: 'es' })).toBe(true);
  });

  it('should have English translations loaded', () => {
    expect(i18n.exists('common:loading', { lng: 'en' })).toBe(true);
    expect(i18n.exists('landing:hero.title', { lng: 'en' })).toBe(true);
    expect(i18n.exists('contracts:title', { lng: 'en' })).toBe(true);
  });

  it('should have detection configured with localStorage priority', () => {
    expect(i18n.options.detection?.lookupLocalStorage).toBe('pacta-language');
    expect(i18n.options.detection?.order).toContain('localStorage');
    expect(i18n.options.detection?.order).toContain('navigator');
  });

  it('should change language and persist to localStorage', () => {
    i18n.changeLanguage('es');
    expect(localStorage.getItem('pacta-language')).toBe('es');
    expect(i18n.language).toBe('es');

    i18n.changeLanguage('en');
    expect(localStorage.getItem('pacta-language')).toBe('en');
    expect(i18n.language).toBe('en');
  });

  it('should have all 16 namespaces configured', () => {
    const expectedNs = [
      'common', 'landing', 'login', 'setup', 'contracts', 'clients',
      'suppliers', 'supplements', 'reports', 'settings', 'documents',
      'notifications', 'signers', 'companies', 'pending', 'dashboard'
    ];
    expectedNs.forEach(ns => {
      expect(i18n.options.ns).toContain(ns);
    });
  });

  it('should translate common keys correctly', () => {
    expect(i18n.t('common:loading', { lng: 'es' })).toBe('Cargando...');
    expect(i18n.t('common:cancel', { lng: 'es' })).toBe('Cancelar');
    expect(i18n.t('common:loading', { lng: 'en' })).toBe('Loading...');
    expect(i18n.t('common:cancel', { lng: 'en' })).toBe('Cancel');
  });

  it('should translate landing page keys correctly', () => {
    expect(i18n.t('landing:hero.title', { lng: 'es' })).toBe('Sistema de Gestión de Contratos');
    expect(i18n.t('landing:hero.startNow', { lng: 'es' })).toBe('Comenzar ahora');
    expect(i18n.t('landing:hero.title', { lng: 'en' })).toBe('Contract Management System');
    expect(i18n.t('landing:hero.startNow', { lng: 'en' })).toBe('Start Now');
  });

  it('should return key name for missing translations', () => {
    const result = i18n.t('common:nonexistent.key', { lng: 'en' });
    expect(result).toBe('nonexistent.key');
  });
});
