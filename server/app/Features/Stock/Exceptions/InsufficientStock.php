<?php

namespace App\Features\Stock\Exceptions;

use Symfony\Component\HttpKernel\Exception\HttpException;

// A batch doesn't hold the units asked for (someone else took them first, or the screen was out of date): 422
class InsufficientStock extends HttpException
{
    public function __construct(string $message)
    {
        parent::__construct(422, $message);
    }
}
