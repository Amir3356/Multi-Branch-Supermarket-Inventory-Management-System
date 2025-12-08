<?php

namespace App\Shared\Services;

/**
 * Generated batch numbers (BT-00001, BT-00002, …), one sequence for all stock that enters a branch: paid procurements
 * and received transfers. Call inside the transaction that saves the number.
 */
class BatchNumbers
{
    public function __construct(private Sequences $sequences) {}

    public function next(): string
    {
        return sprintf('BT-%05d', $this->sequences->next('batches'));
    }
}
