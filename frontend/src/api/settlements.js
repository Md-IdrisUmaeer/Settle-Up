import client from './client';

export async function listSettlements(groupId) {
  const { data } = await client.get(`/groups/${groupId}/settlements`);
  return data.settlements;
}

export async function createSettlement(groupId, payload) {
  const { data } = await client.post(`/groups/${groupId}/settlements`, payload);
  return data.settlement;
}

export async function updateSettlementStatus(groupId, settlementId, status) {
  const { data } = await client.patch(`/groups/${groupId}/settlements/${settlementId}`, {
    status,
  });
  return data.settlement;
}

export async function deleteSettlement(groupId, settlementId) {
  await client.delete(`/groups/${groupId}/settlements/${settlementId}`);
}
