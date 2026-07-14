import client from './client';

export async function listGroups() {
  const { data } = await client.get('/groups');
  return data.groups;
}

export async function createGroup({ name }) {
  const { data } = await client.post('/groups', { name });
  return data.group;
}

export async function getGroup(groupId) {
  const { data } = await client.get(`/groups/${groupId}`);
  return data.group;
}

export async function inviteByEmail(groupId, email) {
  const { data } = await client.post(`/groups/${groupId}/invite/email`, { email });
  return data.group;
}

/** Public, unauthenticated preview shown on the invite landing page. */
export async function previewInvite(inviteCode) {
  const { data } = await client.get(`/groups/invite/${inviteCode}/preview`);
  return data.group; // { name, memberCount }
}

export async function joinByInviteCode(inviteCode) {
  const { data } = await client.post(`/groups/join/${inviteCode}`);
  return data.group;
}

export async function regenerateInviteCode(groupId) {
  const { data } = await client.post(`/groups/${groupId}/invite/regenerate`);
  return data.group;
}
