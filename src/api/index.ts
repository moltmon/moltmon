import { MoltmonApi, MoltmonApiResult } from './moltmonApi.js';

export { MoltmonApi, MoltmonApiResult };

export function createMoltmonApi(): MoltmonApi {
  return new MoltmonApi();
}
