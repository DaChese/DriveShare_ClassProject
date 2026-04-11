import urllib.request, json, urllib.error

url = 'http://localhost:3000/api/auth/register'
data = {
    'displayName': 'Test User',
    'email': 'test@example.com',
    'password': 'password123',
    'questions': [
        {'question': 'What is your favorite color?', 'answer': 'blue'},
        {'question': 'What city were you born in?', 'answer': 'Detroit'},
        {'question': 'What is your mother\'s maiden name?', 'answer': 'Smith'}
    ]
}

try:
    req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as res:
        print('STATUS', res.status)
        print(res.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print('HTTPERROR', e.code)
    print(e.read().decode('utf-8'))
except Exception as e:
    print('ERROR', type(e).__name__, e)