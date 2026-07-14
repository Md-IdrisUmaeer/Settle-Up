const request = require('supertest');
const app = require('../src/app');

describe('app wiring smoke test', () => {
  test('GET /api/health returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  test('unknown route returns 404', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
  });

  test('protected route without token returns 401', async () => {
    const res = await request(app).get('/api/groups');
    expect(res.status).toBe(401);
  });

  test('signup with missing fields returns 400 (no DB hit needed)', async () => {
    const res = await request(app).post('/api/auth/signup').send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
  });
});
