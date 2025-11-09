<?php

namespace Database\Seeders;

use App\Features\Products\Models\Product;
use Illuminate\Database\Seeder;

// The starting product catalog: products in every category (database/seeders/data/products.json). Re-seeding adds
// missing products and never removes or renames existing ones.
class ProductSeeder extends Seeder
{
    public function run(): void
    {
        $products = json_decode(file_get_contents(database_path('seeders/data/products.json')), true);
        $added = 0;

        foreach ($products as $product) {
            if (! Product::whereKey($product['id'])->exists()) {
                Product::create($product);
                $added++;
            }
        }

        $this->command?->info("Product catalog: {$added} added, ".Product::count().' in total.');
    }
}
