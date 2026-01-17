import api from './client';
import { Branding } from './branding';
import { Profile } from './profile';

export type SessionBootstrap = {
  profile: Profile;
  branding: Branding | null;
};

export async function getSessionBootstrap(accountId?: string | null): Promise<SessionBootstrap> {
  const headers = accountId ? { 'X-Account-Id': accountId } : undefined;
  const { data } = await api.get<SessionBootstrap>('/session/bootstrap', { headers });
  return data;
}
