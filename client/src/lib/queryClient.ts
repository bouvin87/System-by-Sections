import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    
    // Handle unauthorized responses - redirect to login
    if (res.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      localStorage.removeItem('auth_tenant');
      window.location.href = '/login';
    }
    
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  optionsOrMethod: { endpoint: string; method: string; data?: unknown } | string,
  url?: string,
  data?: unknown | undefined,
): Promise<Response> {
  let endpoint: string;
  let method: string;
  let requestData: unknown;

  if (typeof optionsOrMethod === 'string') {
    // Legacy format: apiRequest(method, url, data)
    method = optionsOrMethod;
    endpoint = url!;
    requestData = data;
  } else {
    // New format: apiRequest({ endpoint, method, data })
    endpoint = optionsOrMethod.endpoint;
    method = optionsOrMethod.method;
    requestData = optionsOrMethod.data;
  }

  const token = localStorage.getItem('authToken');
  const headers: Record<string, string> = requestData ? { "Content-Type": "application/json" } : {};
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(endpoint, {
    method,
    headers,
    body: requestData ? JSON.stringify(requestData) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const token = localStorage.getItem('authToken');
    const headers: Record<string, string> = {};
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(queryKey[0] as string, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const token = localStorage.getItem('authToken');
        const headers: Record<string, string> = {};
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(queryKey[0] as string, {
          headers,
          credentials: "include",
        });

        await throwIfResNotOk(res);
        return await res.json();
      },
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
