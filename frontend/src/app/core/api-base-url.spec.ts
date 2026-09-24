import { apiUrl } from './api-base-url';

describe('apiUrl', () => {
  afterEach(() => {
    delete window.__JUNIPER_LANE_CONFIG__;
  });

  it('should use the local FastAPI origin when Angular runs on localhost', () => {
    delete window.__JUNIPER_LANE_CONFIG__;

    expect(apiUrl('/health')).toBe('http://localhost:8000/health');
  });

  it('should prefer the deployment-provided API origin and normalize slashes', () => {
    window.__JUNIPER_LANE_CONFIG__ = {
      apiBaseUrl: 'https://api.example.com/',
    };

    expect(apiUrl('/public/listings')).toBe(
      'https://api.example.com/public/listings',
    );
  });
});
