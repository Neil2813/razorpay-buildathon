import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.auth.security import create_access_token
import httpx, json

token = create_access_token({'sub': 'usr_35967d60bff1', 'tenant_id': 'demo_tenant', 'role': 'user'})
headers = {'Authorization': 'Bearer ' + token}

# FRESH session, autonomy_mode=autonomous set upfront
session_id = 'diag_test_fresh_999'
r = httpx.post('http://localhost:8000/api/transaction/run',
    json={
        'user_message': 'Buy me a shirt of 4000 rupees',
        'tenant_id': 'demo_tenant',
        'session_id': session_id,
        'autonomy_mode': 'autonomous'
    },
    headers=headers, timeout=30)

print('HTTP status:', r.status_code)
if r.status_code != 200:
    print('Error body:', r.text[:500])
else:
    data = r.json()
    print('payment_status:', data.get('payment_status'))
    print('autonomy_mode returned:', data.get('autonomy_mode'))

    for e in data.get('audit_log', []):
        agent = e['agent']
        reason = e['decision_reason']
        missing = e.get('output_summary', {}).get('missing_parameters', [])
        print()
        print('  AGENT:', agent)
        print('  reason:', reason[:100] if reason else None)
        if missing:
            print('  MISSING PARAMS:', missing)
