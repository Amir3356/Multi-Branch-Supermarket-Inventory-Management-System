<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Fake Chapa Checkout</title>
    <style>
        body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f3f4f6; font-family: system-ui, sans-serif; color: #111827; }
        .card { width: min(420px, calc(100% - 32px)); background: #fff; border-radius: 12px; padding: 28px; box-shadow: 0 10px 30px rgba(0, 0, 0, .08); }
        .badge { display: inline-block; background: #fef3c7; color: #92400e; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 999px; }
        h1 { font-size: 20px; margin: 14px 0 4px; }
        p { color: #6b7280; font-size: 14px; margin: 0 0 20px; }
        .amount { font-size: 32px; font-weight: 700; margin-bottom: 20px; }
        dl { display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; font-size: 14px; margin: 0 0 24px; }
        dt { color: #6b7280; } dd { margin: 0; word-break: break-all; }
        button { width: 100%; padding: 12px; border: 0; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; margin-top: 8px; }
        .pay { background: #7dc400; color: #fff; } .decline { background: #fee2e2; color: #b91c1c; } .cancel { background: transparent; color: #6b7280; }
    </style>
</head>
<body>
    <form class="card" method="POST" action="{{ url('/api/procurements/fake-checkout/'.rawurlencode($txRef)) }}">
        <span class="badge">TEST ONLY · no real money</span>
        <h1>Fake Chapa Checkout</h1>
        <p>CHAPA_MODE=fake. Choose what the payment should do.</p>

        <div class="amount">{{ $payload['currency'] }} {{ number_format((float) $payload['amount'], 2) }}</div>
        <dl>
            <dt>For</dt><dd>{{ $payload['customization']['description'] ?? '' }}</dd>
            <dt>Payer</dt><dd>{{ trim(($payload['first_name'] ?? '').' '.($payload['last_name'] ?? '')) }} ({{ $payload['email'] ?? '' }})</dd>
            <dt>tx_ref</dt><dd>{{ $txRef }}</dd>
        </dl>

        @if ($status === 'pending')
            <button class="pay" name="outcome" value="pay">Pay</button>
            <button class="decline" name="outcome" value="decline">Decline payment</button>
        @else
            <p>This payment is already {{ $status === 'success' ? 'paid' : 'declined' }}.</p>
        @endif
        <button class="cancel" name="outcome" value="cancel">Back to the pharmacy app</button>
    </form>
</body>
</html>
