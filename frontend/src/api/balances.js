import client from './client';

export async function getBalances(groupId) {
  const { data } = await client.get(`/groups/${groupId}/balances`);
  return data.balances; // [{ userId, amount }]
}

export async function getSimplifiedDebts(groupId) {
  const { data } = await client.get(`/groups/${groupId}/balances/simplify`);
  return data.transactions; // [{ from, to, amount }]
}
