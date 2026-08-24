const BASE_URL = 'http://localhost:8000/api';

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('glassbox_token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `API Error: ${response.status}`);
  }

  return response.json();
}

export const api = {
  get: (endpoint: string) => fetchWithAuth(endpoint),
  post: (endpoint: string, data: any) => fetchWithAuth(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  patch: (endpoint: string, data: any) => fetchWithAuth(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
};
