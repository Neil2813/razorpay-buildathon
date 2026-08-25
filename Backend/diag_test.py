import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.auth.security import create_access_token
import httpx, json

token = create_access_token({'sub': 'usr_35967d60bff1', 'tenant_id': 'demo_tenant', 'role': 'user'})
headers = {'Authorization': 'Bearer ' + token}

session_id = 'diag_test_fresh_002'

print("=== TURN 1 ===")
r1 = httpx.post('http://localhost:8000/api/transaction/run',
    json={
        'user_message': 'Buy me a shirt of 4000 rupees',
        'tenant_id': 'demo_tenant',
        'session_id': session_id,
        'autonomy_mode': 'autonomous'
    },
    headers=headers, timeout=30)
print('Turn 1 status:', r1.json().get('payment_status'))

print("\n=== TURN 2 ===")
r2 = httpx.post('http://localhost:8000/api/transaction/run',
    json={
        'user_message': 'I want: size XXL, red colour, minimum budget ₹2500, rating 4 stars.',
        'tenant_id': 'demo_tenant',
        'session_id': session_id,
        'autonomy_mode': 'autonomous'
    },
    headers=headers, timeout=30)

data = r2.json()
print('Turn 2 payment_status:', data.get('payment_status'))
print('Chosen product:', data.get('chosen_product', {}).get('name') if data.get('chosen_product') else None)

for e in data.get('audit_log', []):
    agent = e['agent']
    reason = e['decision_reason']
    out = e.get('output_summary', {})
    print()
    print(f'  AGENT: {agent}')
    print(f'  decision_reason: {reason}')
    if 'discovered_candidates' in out:
        print(f'  discovered_candidates count: {len(out["discovered_candidates"])}')
        for c in out["discovered_candidates"]:
            name = c.get("name")
            price = c.get("price")
            site = c.get("source_site")
            match_reason = c.get("match_reason", "").replace("★", " stars")
            print(f'    - {name} ({price}) [{site}] match_reason: {match_reason}')
    if 'selection_reason' in out:
        print(f'  selection_reason: {out["selection_reason"]}')

print()
print("Payment attempts:")
for attempt in data.get("payment_attempts", []):
    print(f"  - Attempt {attempt.get('attempt')}: Status={attempt.get('status')}, Reason={attempt.get('reason')}")
