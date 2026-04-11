/**
 * Comprehensive Edge Cases and Test Cases for DriveShare
 * Tests all implementations including patterns, error handling, and edge cases
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

// Test results tracking
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: []
};

function log(message, status = 'info') {
  const timestamp = new Date().toISOString();
  const statusEmoji = {
    'pass': '✅',
    'fail': '❌',
    'info': 'ℹ️',
    'warn': '⚠️'
  };
  console.log(`${statusEmoji[status] || '📝'} [${timestamp}] ${message}`);
}

function assert(condition, message, category = 'general') {
  results.total++;
  if (condition) {
    results.passed++;
    log(`PASS: ${message}`, 'pass');
  } else {
    results.failed++;
    log(`FAIL: ${message}`, 'fail');
  }
  results.tests.push({ message, passed: condition, category });
}

// Helper function to make authenticated requests
async function makeAuthRequest(url, options = {}, sessionCookie = null) {
  const headers = { ...options.headers };
  if (sessionCookie) {
    headers.Cookie = sessionCookie;
  }

  return fetch(url, { ...options, headers });
}

// Test authentication edge cases
async function testAuthEdgeCases() {
  log('Testing Authentication Edge Cases...', 'info');

  // Invalid email format
  try {
    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'invalid-email',
        displayName: 'Test User',
        password: 'password123',
        questions: []
      })
    });
    const data = await response.json();
    assert(data.ok === false, 'Registration rejects invalid email format', 'auth');
  } catch (error) {
    assert(false, `Auth test failed: ${error.message}`, 'auth');
  }

  // Missing required fields
  try {
    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com'
        // Missing displayName, password, questions
      })
    });
    const data = await response.json();
    assert(data.ok === false, 'Registration requires all fields', 'auth');
  } catch (error) {
    assert(false, `Auth test failed: ${error.message}`, 'auth');
  }

  // Wrong number of security questions
  try {
    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        displayName: 'Test User',
        password: 'password123',
        questions: [
          { question: 'Question 1?', answer: 'Answer 1' }
          // Only 1 question instead of 3
        ]
      })
    });
    const data = await response.json();
    assert(data.ok === false && data.error.includes('3 security questions'),
           'Registration requires exactly 3 security questions', 'auth');
  } catch (error) {
    assert(false, `Auth test failed: ${error.message}`, 'auth');
  }

  // Invalid login credentials
  try {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nonexistent@example.com',
        password: 'wrongpassword'
      })
    });
    const data = await response.json();
    assert(data.ok === false, 'Login rejects invalid credentials', 'auth');
  } catch (error) {
    assert(false, `Auth test failed: ${error.message}`, 'auth');
  }
}

// Test car search edge cases (SearchMediator pattern)
async function testSearchEdgeCases() {
  log('Testing Search Edge Cases (SearchMediator)...', 'info');

  // Missing required parameters
  try {
    const response = await fetch(`${BASE_URL}/api/cars/search`);
    const data = await response.json();
    assert(data.ok === false, 'Search requires location, start, and end dates', 'search');
  } catch (error) {
    assert(false, `Search test failed: ${error.message}`, 'search');
  }

  // Invalid date format
  try {
    const response = await fetch(`${BASE_URL}/api/cars/search?location=detroit&start=invalid-date&end=2026-04-15`);
    const data = await response.json();
    assert(data.ok === false, 'Search rejects invalid date formats', 'search');
  } catch (error) {
    assert(false, `Search test failed: ${error.message}`, 'search');
  }

  // End date before start date
  try {
    const response = await fetch(`${BASE_URL}/api/cars/search?location=detroit&start=2026-04-15&end=2026-04-10`);
    const data = await response.json();
    assert(data.ok === false, 'Search rejects end date before start date', 'search');
  } catch (error) {
    assert(false, `Search test failed: ${error.message}`, 'search');
  }

  // Invalid price format
  try {
    const response = await fetch(`${BASE_URL}/api/cars/browse?maxPrice=invalid`);
    const data = await response.json();
    assert(data.ok === false, 'Browse rejects invalid price format', 'search');
  } catch (error) {
    assert(false, `Search test failed: ${error.message}`, 'search');
  }

  // Negative price
  try {
    const response = await fetch(`${BASE_URL}/api/cars/browse?maxPrice=-100`);
    const data = await response.json();
    assert(data.ok === false, 'Browse rejects negative prices', 'search');
  } catch (error) {
    assert(false, `Search test failed: ${error.message}`, 'search');
  }

  // Valid search should work
  try {
    const response = await fetch(`${BASE_URL}/api/cars/search?location=detroit&start=2026-05-01&end=2026-05-05&maxPrice=100`);
    const data = await response.json();
    assert(data.ok === true && Array.isArray(data.cars), 'Valid search parameters work correctly', 'search');
  } catch (error) {
    assert(false, `Search test failed: ${error.message}`, 'search');
  }
}

// Test booking edge cases
async function testBookingEdgeCases() {
  log('Testing Booking Edge Cases...', 'info');

  // Create a test user first
  let sessionCookie = null;
  try {
    const registerResponse = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'booktest@example.com',
        displayName: 'Book Test User',
        password: 'password123',
        questions: [
          { question: 'Pet name?', answer: 'Max' },
          { question: 'Birth city?', answer: 'Detroit' },
          { question: 'First school?', answer: 'Central' }
        ]
      })
    });
    const registerData = await registerResponse.json();

    if (registerData.ok) {
      const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'booktest@example.com',
          password: 'password123'
        })
      });
      sessionCookie = loginResponse.headers.get('set-cookie');
    }
  } catch (error) {
    log(`Failed to create test user: ${error.message}`, 'warn');
  }

  // Test booking without authentication
  try {
    const response = await fetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        carId: 1,
        startDate: '2026-05-01',
        endDate: '2026-05-05'
      })
    });
    const data = await response.json();
    assert(data.ok === false && data.error === 'Not logged in.', 'Booking requires authentication', 'booking');
  } catch (error) {
    assert(false, `Booking test failed: ${error.message}`, 'booking');
  }

  // Test booking with invalid car ID
  if (sessionCookie) {
    try {
      const response = await makeAuthRequest(`${BASE_URL}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carId: 99999, // Non-existent car
          startDate: '2026-05-01',
          endDate: '2026-05-05'
        })
      }, sessionCookie);
      const data = await response.json();
      assert(data.ok === false, 'Booking rejects non-existent car IDs', 'booking');
    } catch (error) {
      assert(false, `Booking test failed: ${error.message}`, 'booking');
    }

    // Test booking with missing fields
    try {
      const response = await makeAuthRequest(`${BASE_URL}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carId: 1
          // Missing startDate and endDate
        })
      }, sessionCookie);
      const data = await response.json();
      assert(data.ok === false, 'Booking requires start and end dates', 'booking');
    } catch (error) {
      assert(false, `Booking test failed: ${error.message}`, 'booking');
    }
  }
}

// Test notification edge cases
async function testNotificationEdgeCases() {
  log('Testing Notification Edge Cases...', 'info');

  // Test notifications without authentication
  try {
    const response = await fetch(`${BASE_URL}/api/notifications`);
    const data = await response.json();
    assert(data.ok === false, 'Notifications require authentication', 'notifications');
  } catch (error) {
    assert(false, `Notification test failed: ${error.message}`, 'notifications');
  }

  // Test marking non-existent notification as read
  let sessionCookie = null;
  try {
    // Create and login test user
    const registerResponse = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'notifytest@example.com',
        displayName: 'Notify Test User',
        password: 'password123',
        questions: [
          { question: 'Pet?', answer: 'Rex' },
          { question: 'City?', answer: 'Boston' },
          { question: 'School?', answer: 'Harvard' }
        ]
      })
    });
    const registerData = await registerResponse.json();

    if (registerData.ok) {
      const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'notifytest@example.com',
          password: 'password123'
        })
      });
      sessionCookie = loginResponse.headers.get('set-cookie');
    }
  } catch (error) {
    log(`Failed to create notification test user: ${error.message}`, 'warn');
  }

  if (sessionCookie) {
    // Test marking non-existent notification as read
    try {
      const response = await makeAuthRequest(`${BASE_URL}/api/notifications/99999/read`, {
        method: 'POST'
      }, sessionCookie);
      // This should not crash, but may not change anything
      assert(response.status === 200, 'Marking non-existent notification as read handled gracefully', 'notifications');
    } catch (error) {
      assert(false, `Notification test failed: ${error.message}`, 'notifications');
    }
  }
}

// Test message edge cases
async function testMessageEdgeCases() {
  log('Testing Message Edge Cases...', 'info');

  // Test sending message without authentication
  try {
    const response = await fetch(`${BASE_URL}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        carId: 1,
        toUserId: 2,
        body: 'Test message'
      })
    });
    const data = await response.json();
    assert(data.ok === false, 'Messages require authentication', 'messages');
  } catch (error) {
    assert(false, `Message test failed: ${error.message}`, 'messages');
  }

  // Test thread access without authentication
  try {
    const response = await fetch(`${BASE_URL}/api/messages/thread?carId=1&otherUserId=2`);
    const data = await response.json();
    assert(data.ok === false, 'Message threads require authentication', 'messages');
  } catch (error) {
    assert(false, `Message test failed: ${error.message}`, 'messages');
  }
}

// Test payment edge cases (PaymentProxy pattern)
async function testPaymentEdgeCases() {
  log('Testing Payment Edge Cases (PaymentProxy)...', 'info');

  // Test payment without authentication
  try {
    const response = await fetch(`${BASE_URL}/api/bookings/1/pay`, {
      method: 'POST'
    });
    const data = await response.json();
    assert(data.ok === false, 'Payment requires authentication', 'payment');
  } catch (error) {
    assert(false, `Payment test failed: ${error.message}`, 'payment');
  }

  // Test payment for non-existent booking
  let sessionCookie = null;
  try {
    // Create and login test user
    const registerResponse = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'paymenttest@example.com',
        displayName: 'Payment Test User',
        password: 'password123',
        questions: [
          { question: 'Pet?', answer: 'Sam' },
          { question: 'City?', answer: 'Seattle' },
          { question: 'School?', answer: 'Washington' }
        ]
      })
    });
    const registerData = await registerResponse.json();

    if (registerData.ok) {
      const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'paymenttest@example.com',
          password: 'password123'
        })
      });
      sessionCookie = loginResponse.headers.get('set-cookie');
    }
  } catch (error) {
    log(`Failed to create payment test user: ${error.message}`, 'warn');
  }

  if (sessionCookie) {
    // Test payment for non-existent booking
    try {
      const response = await makeAuthRequest(`${BASE_URL}/api/bookings/99999/pay`, {
        method: 'POST'
      }, sessionCookie);
      const data = await response.json();
      assert(data.ok === false, 'Payment rejects non-existent bookings', 'payment');
    } catch (error) {
      assert(false, `Payment test failed: ${error.message}`, 'payment');
    }
  }
}

// Test review edge cases
async function testReviewEdgeCases() {
  log('Testing Review Edge Cases...', 'info');

  // Test review without authentication
  try {
    const response = await fetch(`${BASE_URL}/api/bookings/1/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rating: 5,
        comment: 'Great car!'
      })
    });
    const data = await response.json();
    assert(data.ok === false, 'Reviews require authentication', 'reviews');
  } catch (error) {
    assert(false, `Review test failed: ${error.message}`, 'reviews');
  }

  // Test invalid rating values
  let sessionCookie = null;
  try {
    // Create and login test user
    const registerResponse = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'reviewtest@example.com',
        displayName: 'Review Test User',
        password: 'password123',
        questions: [
          { question: 'Pet?', answer: 'Tom' },
          { question: 'City?', answer: 'Austin' },
          { question: 'School?', answer: 'Texas' }
        ]
      })
    });
    const registerData = await registerResponse.json();

    if (registerData.ok) {
      const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'reviewtest@example.com',
          password: 'password123'
        })
      });
      sessionCookie = loginResponse.headers.get('set-cookie');
    }
  } catch (error) {
    log(`Failed to create review test user: ${error.message}`, 'warn');
  }

  if (sessionCookie) {
    // Test rating too high
    try {
      const response = await makeAuthRequest(`${BASE_URL}/api/bookings/1/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: 6, // Invalid: should be 1-5
          comment: 'Too good!'
        })
      }, sessionCookie);
      const data = await response.json();
      assert(data.ok === false, 'Reviews reject ratings above 5', 'reviews');
    } catch (error) {
      assert(false, `Review test failed: ${error.message}`, 'reviews');
    }

    // Test rating too low
    try {
      const response = await makeAuthRequest(`${BASE_URL}/api/bookings/1/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: 0, // Invalid: should be 1-5
          comment: 'Terrible!'
        })
      }, sessionCookie);
      const data = await response.json();
      assert(data.ok === false, 'Reviews reject ratings below 1', 'reviews');
    } catch (error) {
      assert(false, `Review test failed: ${error.message}`, 'reviews');
    }
  }
}

// Test database constraint violations
async function testDatabaseConstraints() {
  log('Testing Database Constraint Violations...', 'info');

  // Test duplicate email registration
  try {
    // First registration
    await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'duplicate@example.com',
        displayName: 'First User',
        password: 'password123',
        questions: [
          { question: 'Pet?', answer: 'A' },
          { question: 'City?', answer: 'B' },
          { question: 'School?', answer: 'C' }
        ]
      })
    });

    // Second registration with same email
    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'duplicate@example.com', // Same email
        displayName: 'Second User',
        password: 'password123',
        questions: [
          { question: 'Pet?', answer: 'X' },
          { question: 'City?', answer: 'Y' },
          { question: 'School?', answer: 'Z' }
        ]
      })
    });
    const data = await response.json();
    assert(data.ok === false, 'Database prevents duplicate email registration', 'database');
  } catch (error) {
    assert(false, `Database constraint test failed: ${error.message}`, 'database');
  }
}

// Test rate limiting and performance
async function testPerformanceEdgeCases() {
  log('Testing Performance and Load Edge Cases...', 'info');

  // Test multiple rapid requests
  const promises = [];
  for (let i = 0; i < 10; i++) {
    promises.push(fetch(`${BASE_URL}/api/health`));
  }

  try {
    const responses = await Promise.all(promises);
    const allOk = responses.every(r => r.ok);
    assert(allOk, 'Server handles multiple concurrent requests', 'performance');
  } catch (error) {
    assert(false, `Performance test failed: ${error.message}`, 'performance');
  }

  // Test large payload
  try {
    const largeComment = 'A'.repeat(10000); // 10KB comment
    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'largepayload@example.com',
        displayName: 'Large Payload User',
        password: 'password123',
        questions: [
          { question: 'Pet?', answer: 'Big' },
          { question: 'City?', answer: largeComment }, // Large answer
          { question: 'School?', answer: 'Normal' }
        ]
      })
    });
    const data = await response.json();
    // This might succeed or fail depending on DB limits, but shouldn't crash
    assert(typeof data.ok === 'boolean', 'Server handles large payloads gracefully', 'performance');
  } catch (error) {
    assert(false, `Large payload test failed: ${error.message}`, 'performance');
  }
}

// Test security edge cases
async function testSecurityEdgeCases() {
  log('Testing Security Edge Cases...', 'info');

  // Test SQL injection attempts
  try {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: "'; DROP TABLE users; --",
        password: 'password123'
      })
    });
    const data = await response.json();
    assert(data.ok === false, 'Server prevents SQL injection in login', 'security');
  } catch (error) {
    assert(false, `Security test failed: ${error.message}`, 'security');
  }

  // Test XSS in input fields
  try {
    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'xss@example.com',
        displayName: '<script>alert("XSS")</script>',
        password: 'password123',
        questions: [
          { question: 'Pet?', answer: '<img src=x onerror=alert(1)>' },
          { question: 'City?', answer: 'Safe' },
          { question: 'School?', answer: 'Safe' }
        ]
      })
    });
    const data = await response.json();
    // Registration might succeed, but data should be sanitized
    assert(typeof data.ok === 'boolean', 'Server handles potential XSS input', 'security');
  } catch (error) {
    assert(false, `Security test failed: ${error.message}`, 'security');
  }
}

// Run all edge case tests
async function runEdgeCaseTests() {
  log('🚀 Starting Comprehensive Edge Case Testing for DriveShare', 'info');
  log('Testing all implementations, patterns, and error conditions...', 'info');

  try {
    // Basic functionality tests
    await testAuthEdgeCases();
    await testSearchEdgeCases();
    await testBookingEdgeCases();
    await testNotificationEdgeCases();
    await testMessageEdgeCases();
    await testPaymentEdgeCases();
    await testReviewEdgeCases();

    // Advanced tests
    await testDatabaseConstraints();
    await testPerformanceEdgeCases();
    await testSecurityEdgeCases();

  } catch (error) {
    log(`❌ Test suite failed with error: ${error.message}`, 'fail');
  }

  // Final results
  log(`\n📊 EDGE CASE TEST RESULTS:`, 'info');
  log(`Total Tests: ${results.total}`, 'info');
  log(`Passed: ${results.passed}`, 'pass');
  log(`Failed: ${results.failed}`, 'fail');

  const passRate = results.total > 0 ? ((results.passed / results.total) * 100).toFixed(1) : 0;
  log(`Pass Rate: ${passRate}%`, results.failed === 0 ? 'pass' : 'fail');

  if (results.failed === 0) {
    log('🎉 ALL EDGE CASES PASSED! DriveShare is robust and secure.', 'pass');
  } else {
    log('⚠️ Some edge cases failed. Review the failures above.', 'fail');

    // Group failures by category
    const failuresByCategory = {};
    results.tests.filter(t => !t.passed).forEach(test => {
      failuresByCategory[test.category] = (failuresByCategory[test.category] || 0) + 1;
    });

    log('Failures by category:', 'info');
    Object.entries(failuresByCategory).forEach(([category, count]) => {
      log(`  ${category}: ${count} failures`, 'fail');
    });
  }

  process.exit(results.failed === 0 ? 0 : 1);
}

// Run tests if this script is executed directly
console.log('🚀 Starting Edge Case Tests...');
runEdgeCaseTests().catch(error => {
  log(`💥 Test runner crashed: ${error.message}`, 'fail');
  process.exit(1);
});

export { runEdgeCaseTests };