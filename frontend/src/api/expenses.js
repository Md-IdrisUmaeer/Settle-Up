import client from './client';

export async function listExpenses(groupId) {
  const { data } = await client.get(`/groups/${groupId}/expenses`);
  return data.expenses;
}

export async function createExpense(groupId, payload) {
  const { data } = await client.post(`/groups/${groupId}/expenses`, payload);
  return data.expense;
}

export async function deleteExpense(groupId, expenseId) {
  await client.delete(`/groups/${groupId}/expenses/${expenseId}`);
}
