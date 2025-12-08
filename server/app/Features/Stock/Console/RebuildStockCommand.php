<?php

namespace App\Features\Stock\Console;

use App\Features\Stock\Services\StockRebuilder;
use Illuminate\Console\Command;

// Repairs stock_batches by working every branch's stock out again from the records
class RebuildStockCommand extends Command
{
    protected $signature = 'stock:rebuild';

    protected $description = "Work out every branch's stock per batch again from received orders and transfers, transfers sent, sales and damaged items";

    public function handle(StockRebuilder $rebuilder): int
    {
        $result = $rebuilder->rebuild();
        $this->info("Stock rebuilt: {$result['batches']} batches.");

        foreach ($result['belowZero'] as $b) {
            $this->warn("{$b['branchId']} · {$b['product']} · batch {$b['batch']}: the records take out ".(-$b['stock'])." more units than arrived; saved as 0.");
        }

        return self::SUCCESS;
    }
}
