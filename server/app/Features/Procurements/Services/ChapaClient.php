<?php

namespace App\Features\Procurements\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/**
 * Chapa's hosted checkout (https://developer.chapa.co): initialize a transaction, send the person to its
 * checkout_url, then verify it by tx_ref. Never trust a callback or return URL alone; always verify.
 */
class ChapaClient
{
    /** Starts a checkout and returns the URL to send the person to. */
    public function initialize(array $payload): string
    {
        $response = $this->send(fn (PendingRequest $http) => $http->post('/transaction/initialize', $payload));

        $checkoutUrl = $response->json('data.checkout_url');
        if (! $response->successful() || $response->json('status') !== 'success' || ! $checkoutUrl) {
            abort(502, 'Chapa could not start the payment: '.$this->errorMessage($response));
        }

        return $checkoutUrl;
    }

    /** The transaction as Chapa sees it ("data" of the verify response), or null if Chapa doesn't know it yet. */
    public function verify(string $txRef): ?array
    {
        $response = $this->send(fn (PendingRequest $http) => $http->get('/transaction/verify/'.rawurlencode($txRef)));

        if ($response->status() === 404 || $response->status() === 400) {
            return null;
        }
        if (! $response->successful()) {
            abort(502, 'Chapa could not verify the payment: '.$this->errorMessage($response));
        }

        return $response->json('data');
    }

    private function send(callable $call): Response
    {
        $secret = config('services.chapa.secret_key');
        if (! $secret) {
            abort(503, 'Chapa payments are not configured. Set CHAPA_SECRET_KEY in the server .env file.');
        }

        try {
            return $call(Http::baseUrl(config('services.chapa.base_url'))->withToken($secret)->acceptJson()->timeout(20));
        } catch (ConnectionException) {
            abort(502, "Can't reach Chapa right now. Try again in a moment.");
        }
    }

    // Chapa sends either a sentence or a { field: [messages] } object in "message"
    private function errorMessage(Response $response): string
    {
        $message = $response->json('message');
        if (is_array($message)) {
            $message = collect($message)->flatten()->implode(' ');
        }

        return $message ?: "unexpected response ({$response->status()}).";
    }
}
