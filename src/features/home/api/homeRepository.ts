import { getApiClient } from '../../../core/api/axiosClient';
import type { HomePayload } from '../../../core/domain/home';

export async function getHome(): Promise<HomePayload> {
  const res = await getApiClient().get<HomePayload>('/home');
  return res.data;
}
