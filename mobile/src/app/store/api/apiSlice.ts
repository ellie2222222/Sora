/**
 * `axiosBaseQuery` wraps the existing axios instance (`services/api/client.ts`)
 * rather than `fetchBaseQuery`, so the bearer-attach and single-flight
 * refresh-on-401 interceptors there stay the one implementation of both.
 */
import { createApi, retry, type BaseQueryApi, type BaseQueryFn } from '@reduxjs/toolkit/query/react';
import type { AxiosRequestConfig } from 'axios';

import {
  deleteVoid,
  getList,
  getOne,
  patchOne,
  postOne,
  postVoid,
  type ListResult,
} from '@/services/api';
import { isApiError, isNetworkError, serializeApiError, toApiError, type ApiErrorLike } from '@/utils';

interface GetArgs {
  method: 'get';
  path: string;
  params?: unknown;
}

interface GetListArgs {
  method: 'getList';
  path: string;
  params?: unknown;
}

interface PostArgs {
  method: 'post';
  path: string;
  body?: unknown;
  config?: AxiosRequestConfig;
}

interface PostVoidArgs {
  method: 'postVoid';
  path: string;
  body?: unknown;
}

interface PatchArgs {
  method: 'patch';
  path: string;
  body?: unknown;
}

interface DeleteArgs {
  method: 'delete';
  path: string;
  params?: unknown;
}

interface CustomArgs {
  method: 'custom';
  run: (api: BaseQueryApi) => Promise<unknown>;
}

export type AxiosBaseQueryArgs = GetArgs | GetListArgs | PostArgs | PostVoidArgs | PatchArgs | DeleteArgs | CustomArgs;

/** `ApiError` is an `Error` subclass; Redux's serializability check rejects that prototype chain. */
function toSerializedError(error: unknown): ApiErrorLike {
  if (isApiError(error)) return serializeApiError(error);
  return serializeApiError(toApiError(undefined, undefined, error instanceof Error ? error.message : undefined));
}

const rawAxiosBaseQuery: BaseQueryFn<AxiosBaseQueryArgs, unknown, ApiErrorLike> = async (args, api) => {
  try {
    switch (args.method) {
      case 'get':
        return { data: await getOne(args.path, args.params) };
      case 'getList':
        return { data: (await getList(args.path, args.params)) satisfies ListResult<unknown> };
      case 'post':
        return { data: await postOne(args.path, args.body, args.config) };
      case 'postVoid':
        await postVoid(args.path, args.body);
        return { data: undefined };
      case 'patch':
        return { data: await patchOne(args.path, args.body) };
      case 'delete':
        await deleteVoid(args.path, args.params);
        return { data: undefined };
      case 'custom':
        return { data: await args.run(api) };
    }
  } catch (error) {
    const serialized = toSerializedError(error);
    if (!isNetworkError(error)) {
      retry.fail(serialized);
    }
    return { error: serialized };
  }
};

const axiosBaseQuery = retry(rawAxiosBaseQuery, { maxRetries: 0 });

export async function toQueryFnResult<T>(
  run: () => Promise<T>,
): Promise<{ data: T } | { error: ApiErrorLike }> {
  try {
    return { data: await run() };
  } catch (error) {
    return { error: toSerializedError(error) };
  }
}

export const API_TAG_TYPES = [
  'Wallet',
  'WalletMember',
  'WalletInvitation',
  'AuditLog',
  'Account',
  'Category',
  'Transaction',
  'Budget',
  'Goal',
  'GoalContribution',
  'Dashboard',
  'AiConversation',
  'AiMessage',
] as const;

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: axiosBaseQuery,
  tagTypes: API_TAG_TYPES,
  refetchOnReconnect: true,
  refetchOnFocus: true,
  endpoints: () => ({}),
});
