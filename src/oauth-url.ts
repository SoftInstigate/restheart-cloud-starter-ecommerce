import { environment } from './environments/environment';

export function oauthUrl(provider: string): string {
  return `${environment.apiUrl}/auth/oauth/authorize/${provider}?noauthchallenge`;
}
