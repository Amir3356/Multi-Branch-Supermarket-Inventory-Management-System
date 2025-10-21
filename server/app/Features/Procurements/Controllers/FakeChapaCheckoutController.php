<?php

namespace App\Features\Procurements\Controllers;

use App\Features\Procurements\Services\FakeChapaClient;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

// The pretend Chapa checkout page used when CHAPA_MODE=fake (registered only in that mode)
class FakeChapaCheckoutController
{
    public function __construct(private FakeChapaClient $chapa) {}

    public function show(string $txRef): View
    {
        $checkout = $this->chapa->checkout($txRef) ?? abort(404, 'This checkout has expired or does not exist.');

        return view('procurements::fake-checkout', ['txRef' => $txRef] + $checkout);
    }

    // Pay or Decline, then back to the app exactly like Chapa's return_url; Cancel just goes back
    public function complete(Request $request, string $txRef): RedirectResponse
    {
        $checkout = $this->chapa->checkout($txRef) ?? abort(404, 'This checkout has expired or does not exist.');
        $outcome = $request->validate(['outcome' => ['required', 'in:pay,decline,cancel']])['outcome'];

        if ($outcome !== 'cancel') {
            $this->chapa->complete($txRef, $outcome === 'pay' ? 'success' : 'failed');
        }

        return redirect()->away($checkout['payload']['return_url']);
    }
}
