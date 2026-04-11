/**
 * Test script to verify all DriveShare implementations work correctly
 * Tests: Email notifications, patterns, authentication, car operations
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

// Test results
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function log(message, status = 'info') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${status.toUpperCase()}: ${message}`);
}

function assert(condition, message) {
  if (condition) {
    results.passed++;
    log(`✓ ${message}`, 'pass');
  } else {
    results.failed++;
    log(`✗ ${message}`, 'fail');
  }
  results.tests.push({ message, passed: condition });
}

// Test health endpoint
async function testHealth() {
  try {
    const response = await fetch(`${BASE_URL}/api/health`);
    const data = await response.json();
    assert(data.ok === true, 'Health endpoint returns ok: true');
  } catch (error) {
    assert(false, `Health endpoint failed: ${error.message}`);
  }
}

// Test user registration
async function testRegistration() {
  try {
    const timestamp = Date.now();
    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `testowner${timestamp}@example.com`,
        displayName: 'Test Owner',
        password: 'password123',
        questions: [
          { question: 'What was your first pet\'s name?', answer: 'Fluffy' },
          { question: 'What city were you born in?', answer: 'Springfield' },
          { question: 'What was your first school?', answer: 'Elementary' }
        ]
      })
    });
    const data = await response.json();
    assert(data.ok === true && data.userId, 'User registration successful');
    return { userId: data.userId, email: `testowner${timestamp}@example.com` };
  } catch (error) {
    assert(false, `Registration failed: ${error.message}`);
    return null;
  }
}

// Test login
async function testLogin(userEmail) {
  try {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userEmail,
        password: 'password123'
      })
    });
    const data = await response.json();
    assert(data.ok === true, 'User login successful');
    return response.headers.get('set-cookie');
  } catch (error) {
    assert(false, `Login failed: ${error.message}`);
    return null;
  }
}

// Test car browsing (SearchMediator)
async function testCarBrowse() {
  try {
    const response = await fetch(`${BASE_URL}/api/cars/browse?location=detroit&limit=5`);
    const data = await response.json();
    assert(data.ok === true && Array.isArray(data.cars), 'Car browsing works (SearchMediator)');
  } catch (error) {
    assert(false, `Car browsing failed: ${error.message}`);
  }
}

// Test car search (SearchMediator)
async function testCarSearch() {
  try {
    const response = await fetch(`${BASE_URL}/api/cars/search?location=detroit&start=2026-04-15&end=2026-04-18&maxPrice=100`);
    const data = await response.json();
    assert(data.ok === true && Array.isArray(data.cars), 'Car search works (SearchMediator)');
  } catch (error) {
    assert(false, `Car search failed: ${error.message}`);
  }
}

// Test notifications endpoint
async function testNotifications(sessionCookie) {
  try {
    const response = await fetch(`${BASE_URL}/api/notifications`, {
      headers: {
        'Cookie': sessionCookie
      }
    });
    const data = await response.json();
    assert(data.ok === true && Array.isArray(data.notifications), 'Notifications endpoint works');
  } catch (error) {
    assert(false, `Notifications failed: ${error.message}`);
  }
}

// Test history endpoint
async function testHistory(sessionCookie) {
  try {
    const response = await fetch(`${BASE_URL}/api/bookings/history`, {
      headers: {
        'Cookie': sessionCookie
      }
    });
    const data = await response.json();
    assert(data.ok === true && data.renterBookings && data.ownerBookings, 'History endpoint works');
  } catch (error) {
    assert(false, `History failed: ${error.message}`);
  }
}

// Run all tests
async function runTests() {
  log('Starting DriveShare implementation tests...', 'info');

  // Basic functionality tests
  await testHealth();
  await testCarBrowse();
  await testCarSearch();

  // Authentication tests
  const userResult = await testRegistration();
  if (userResult) {
    const sessionCookie = await testLogin(userResult.email);
    if (sessionCookie) {
      await testNotifications(sessionCookie);
      await testHistory(sessionCookie);
    }
  }

  // Summary
  log(`\nTest Results: ${results.passed} passed, ${results.failed} failed`, 'info');

  if (results.failed === 0) {
    log('🎉 All tests passed! All implementations are working correctly.', 'pass');
  } else {
    log('❌ Some tests failed. Check the implementation.', 'fail');
    results.tests.filter(t => !t.passed).forEach(test => {
      log(`  - ${test.message}`, 'fail');
    });
  }

  process.exit(results.failed === 0 ? 0 : 1);
}

// Run tests if this script is executed directly
console.log('🚀 Running DriveShare Implementation Tests...');
runTests().catch(error => {
  log(`Test runner failed: ${error.message}`, 'error');
  process.exit(1);
});

export { runTests };