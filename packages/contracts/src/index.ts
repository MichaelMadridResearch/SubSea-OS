import createClient, { type Client } from "openapi-fetch";
import type { paths } from "./schema";

export type { components, paths } from "./schema";

export function createApi(baseUrl: string, token?: string): Client<paths> {
  return createClient<paths>({
    baseUrl,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}
