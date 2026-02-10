import { getMockApiClient } from '../../../core/api/axiosClient';
import type { HomePayload } from '../../../core/domain/home';

export async function getHome(): Promise<HomePayload> {
  const res = await getMockApiClient().get<HomePayload>('/home');
  return res.data;
}
