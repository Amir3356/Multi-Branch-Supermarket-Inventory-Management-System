<?php

namespace App\Shared\Services;

use Illuminate\Support\Facades\DB;
use LogicException;

/**
 * Gapless counters for record ids (SL-00001, …) and batch numbers, one row per name in id_sequences.
 * Taking a number locks its counter row until the surrounding transaction ends, so two requests at the same moment
 * can't get the same number, and a save that rolls back gives its number back. Call inside DB::transaction.
 */
class Sequences
{
    public function next(string $name): int
    {
        if (DB::transactionLevel() === 0) {
            throw new LogicException("Take the next {$name} number inside the transaction that saves it.");
        }

        $row = DB::selectOne('update id_sequences set value = value + 1 where name = ? returning value', [$name]);
        if (! $row) {
            // A counter the migration didn't create: start it, then take its first number
            DB::table('id_sequences')->insertOrIgnore(['name' => $name, 'value' => 0]);
            $row = DB::selectOne('update id_sequences set value = value + 1 where name = ? returning value', [$name]);
        }

        return (int) $row->value;
    }
}
