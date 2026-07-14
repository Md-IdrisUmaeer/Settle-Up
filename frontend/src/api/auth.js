import client from './client';

export async function signup({ name, email, password }) {
  const { data } = await client.post('/auth/signup', { name, email, password });
  return data; // { user, token }
}

export async function login({ email, password }) {
  const { data } = await client.post('/auth/login', { email, password });
  return data; // { user, token }
}

export async function getMe() {
  const { data } = await client.get('/auth/me');
  return data.user;
}
