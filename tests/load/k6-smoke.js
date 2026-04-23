/**
 * TMJConnect — k6 load test script.
 *
 * Usage:
 *   k6 run tests/load/k6-smoke.js                    # smoke (1 VU)
 *   k6 run --vus 50 --duration 5m tests/load/k6-smoke.js  # load (50 VUs × 5 min)
 *
 * Requires a running API at BASE_URL with at least one seeded patient.
 * Set env vars: BASE_URL, TEST_EMAIL, TEST_PASSWORD
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'http://localhost:3000/api/v1';
const EMAIL = __ENV.TEST_EMAIL || 'loadtest@test.com';
const PASSWORD = __ENV.TEST_PASSWORD || 'Test@1234!';

const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration');

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    errors: ['rate<0.05'],
  },
};

function headers(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export function setup() {
  // Register + verify a test user if needed, then login to get tokens
  const login = http.post(`${BASE}/auth/patient/login`, JSON.stringify({ email: EMAIL, password: PASSWORD }), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (login.status === 200) {
    return { token: login.json('data.access_token'), refresh: login.json('data.refresh_token') };
  }

  // If login fails (user doesn't exist), register
  http.post(`${BASE}/auth/patient/register`, JSON.stringify({
    email: EMAIL, password: PASSWORD, first_name: 'Load', last_name: 'Test',
  }), { headers: { 'Content-Type': 'application/json' } });

  // Can't verify email in load test without email access — skip if user already exists
  console.warn('Load test user may need manual email verification before running.');
  return { token: null, refresh: null };
}

export default function (data) {
  if (!data.token) {
    sleep(1);
    return;
  }

  const h = headers(data.token);

  // 1. Dashboard (consolidated endpoint)
  const dashboard = http.get(`${BASE}/patients/dashboard`, { headers: h });
  check(dashboard, { 'dashboard 200': (r) => r.status === 200 });
  errorRate.add(dashboard.status !== 200);

  // 2. Symptom history
  const symptoms = http.get(`${BASE}/symptoms?limit=20`, { headers: h });
  check(symptoms, { 'symptoms 200': (r) => r.status === 200 });
  errorRate.add(symptoms.status !== 200);

  // 3. Log a symptom (upsert — idempotent per day)
  const logSymptom = http.post(`${BASE}/symptoms`, JSON.stringify({
    pain_level: Math.floor(Math.random() * 10) + 1,
    pain_types: ['aching'],
    triggers: ['stress'],
    body_areas: [{ area: 'jaw', side: 'left' }],
  }), { headers: h });
  check(logSymptom, { 'log symptom 2xx': (r) => r.status >= 200 && r.status < 300 });

  // 4. Exercises
  const exercises = http.get(`${BASE}/exercises/assignments`, { headers: h });
  check(exercises, { 'exercises 200': (r) => r.status === 200 });

  // 5. Notifications
  const notifs = http.get(`${BASE}/notifications?limit=10`, { headers: h });
  check(notifs, { 'notifications 200': (r) => r.status === 200 });

  // 6. Insights
  const insights = http.get(`${BASE}/symptoms/insights?days=30`, { headers: h });
  check(insights, { 'insights 200': (r) => r.status === 200 });

  // 7. Calendar
  const now = new Date();
  const calendar = http.get(`${BASE}/symptoms/calendar?year=${now.getFullYear()}&month=${now.getMonth() + 1}`, { headers: h });
  check(calendar, { 'calendar 200': (r) => r.status === 200 });

  // 8. Profile
  const profile = http.get(`${BASE}/patients/me`, { headers: h });
  check(profile, { 'profile 200': (r) => r.status === 200 });

  // 9. Tracking — mobility
  const mobility = http.post(`${BASE}/tracking/mobility`, JSON.stringify({
    measurement_mm: 30 + Math.floor(Math.random() * 15),
    method: 'fingers',
  }), { headers: h });
  check(mobility, { 'mobility 201': (r) => r.status === 201 });

  // 10. Tracking — sleep
  const sleepLog = http.post(`${BASE}/tracking/sleep`, JSON.stringify({
    quality: Math.floor(Math.random() * 5) + 1,
    hours_slept: 6 + Math.random() * 3,
    bruxism_aware: Math.random() > 0.5,
  }), { headers: h });
  check(sleepLog, { 'sleep 201': (r) => r.status === 201 });

  sleep(1);
}

export function teardown(data) {
  console.log('Load test complete.');
}
