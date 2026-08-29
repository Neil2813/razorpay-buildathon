"""
seed.py -- Optional database seeding utility.
Run this script to load initial demo-ready tenants and catalog data.

Usage:
    python app/db/seed.py
"""

from __future__ import annotations

import json
from app.db.database import get_db_connection, get_supabase_client


def seed_db():
    supabase = get_supabase_client()
    if supabase:
        print("[seed] Seeding to Supabase...")
        try:
            supabase.table("tenants").upsert({"tenant_id": "demo_tenant", "name": "Apex Athletics", "unattended_spend_ceiling": 4000.0}).execute()
            products = [
                {
                    "product_id": "prod_shoes_01",
                    "tenant_id": "demo_tenant",
                    "name": "Apex Alpha Running Shoes",
                    "description": "Premium lightweight mesh running shoes with standard response cushioning.",
                    "price": 3800.0,
                    "category": "shoe",
                    "color": "Black",
                    "sizes": ["8", "9", "10", "11"],
                    "in_stock": True,
                    "return_policy": "Return within 30 days in original packaging for a full refund.",
                    "delivery_time_days": 2,
                },
                {
                    "product_id": "prod_shoes_02",
                    "tenant_id": "demo_tenant",
                    "name": "Apex Trail Runner",
                    "description": "All-terrain rugged running shoe with high grip rubber sole.",
                    "price": 3500.0,
                    "category": "shoe",
                    "color": "Red",
                    "sizes": ["7", "8", "9"],
                    "in_stock": True,
                    "return_policy": None,
                    "delivery_time_days": 3,
                },
            ]
            supabase.table("catalog").upsert(products).execute()
            print("[seed] Supabase seeded successfully.")
        except Exception as e:
            print(f"[seed] Supabase seeding warning: {e}")

    conn = get_db_connection()
    cursor = conn.cursor()

    print("[seed] Seeding demo tenant 'demo_tenant'...")
    cursor.execute("SELECT 1 FROM tenants WHERE tenant_id = 'demo_tenant';")
    if not cursor.fetchone():
        cursor.execute("""
        INSERT INTO tenants (tenant_id, name, unattended_spend_ceiling)
        VALUES ('demo_tenant', 'Apex Athletics', 4000.0);
        """)
        print("[seed] Default tenant: demo_tenant seeded (Limit: Rs. 4,000).")

    print("[seed] Seeding catalog products for 'demo_tenant'...")
    cursor.execute("SELECT 1 FROM catalog WHERE tenant_id = 'demo_tenant';")
    if not cursor.fetchone():
        products = [
            (
                "prod_shoes_01",
                "demo_tenant",
                "Apex Alpha Running Shoes",
                "Premium lightweight mesh running shoes with standard response cushioning.",
                3800.0,
                "shoe",
                "Black",
                json.dumps(["8", "9", "10", "11"]),
                1,
                "Return within 30 days in original packaging for a full refund.",
                2,
            ),
            (
                "prod_shoes_02",
                "demo_tenant",
                "Apex Trail Runner",
                "All-terrain rugged running shoe with high grip rubber sole.",
                3500.0,
                "shoe",
                "Red",
                json.dumps(["7", "8", "9"]),
                1,
                None,  # Missing return policy
                3,
            ),
            (
                "prod_shoes_03",
                "demo_tenant",
                "Apex Pro Zoom",
                "Professional carbon-plated competition shoes for elite runners.",
                4500.0,  # Exceeds budget parameter Rs. 4000
                "shoe",
                "Blue",
                json.dumps(["8", "9", "10"]),
                1,
                "Return within 30 days in original packaging for a full refund.",
                2,
            ),
            (
                "prod_shirt_01",
                "demo_tenant",
                "Apex Breeze Training Tee",
                "Sweat-wicking synthetic t-shirt for daily exercise.",
                1800.0,
                "shirt",
                "Black",
                json.dumps(["S", "M", "L", "XL"]),
                1,
                "Return within 30 days in original packaging for a full refund.",
                2,
            ),
        ]

        cursor.executemany("""
        INSERT INTO catalog (
            product_id, tenant_id, name, description, price,
            category, color, sizes, in_stock, return_policy, delivery_time_days
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, products)
        print("[seed] Seeded 4 products into catalog.")

    # Ratings make the demo catalogue genuinely agent-readable for rating
    # constraints, including on databases created before the rating field.
    cursor.executemany(
        "UPDATE catalog SET rating = ? WHERE product_id = ? AND rating IS NULL;",
        [(4.5, "prod_shoes_01"), (4.2, "prod_shoes_02"), (4.8, "prod_shoes_03"), (4.4, "prod_shirt_01")],
    )

    # Seed Warehouses (Bengaluru, Delhi, Mumbai)
    cursor.execute("""INSERT OR IGNORE INTO warehouses (warehouse_id, tenant_id, name, line1, city, state, pincode)
        VALUES ('wh_apex_blr', 'demo_tenant', 'Apex Bengaluru Warehouse', '88 Commerce Park', 'Bengaluru', 'Karnataka', '560001');""")
    cursor.execute("""INSERT OR IGNORE INTO warehouses (warehouse_id, tenant_id, name, line1, city, state, pincode)
        VALUES ('wh_apex_del', 'demo_tenant', 'Apex Delhi Warehouse', '12 Ring Road', 'New Delhi', 'Delhi', '110001');""")
    cursor.execute("""INSERT OR IGNORE INTO warehouses (warehouse_id, tenant_id, name, line1, city, state, pincode)
        VALUES ('wh_apex_mum', 'demo_tenant', 'Apex Mumbai Warehouse', '45 Marine Drive', 'Mumbai', 'Maharashtra', '400001');""")

    # Seed Specificity Delivery Zones
    cursor.execute("""INSERT OR IGNORE INTO delivery_zones (zone_id, tenant_id, coverage_type, coverage_value, shipping_fee, delivery_days)
        VALUES ('zone_apex_all_india', 'demo_tenant', 'all_india', 'all', 150.0, 5);""")
    cursor.execute("""INSERT OR IGNORE INTO delivery_zones (zone_id, tenant_id, coverage_type, coverage_value, shipping_fee, delivery_days)
        VALUES ('zone_apex_karnataka', 'demo_tenant', 'state', 'Karnataka', 80.0, 3);""")
    cursor.execute("""INSERT OR IGNORE INTO delivery_zones (zone_id, tenant_id, coverage_type, coverage_value, shipping_fee, delivery_days)
        VALUES ('zone_apex_blr_city', 'demo_tenant', 'city', 'Bengaluru', 40.0, 1);""")
    cursor.execute("""INSERT OR IGNORE INTO delivery_zones (zone_id, tenant_id, coverage_type, coverage_value, shipping_fee, delivery_days)
        VALUES ('zone_apex_pincode_blr', 'demo_tenant', 'pincode', '560001', 20.0, 1);""")

    # Seed Inventory across warehouses
    inventory_items = [
        # Bengaluru inventory
        ("wh_apex_blr", "prod_shoes_01", 12),
        ("wh_apex_blr", "prod_shoes_02", 4),
        ("wh_apex_blr", "prod_shirt_01", 20),
        # Delhi inventory
        ("wh_apex_del", "prod_shoes_01", 5),
        ("wh_apex_del", "prod_shoes_02", 8),
        # Mumbai inventory
        ("wh_apex_mum", "prod_shoes_03", 6)
    ]
    cursor.executemany(
        "INSERT OR IGNORE INTO warehouse_inventory (warehouse_id, product_id, quantity) VALUES (?, ?, ?);",
        inventory_items,
    )

    conn.commit()
    conn.close()
    print("[seed] Seeding completed successfully.")


if __name__ == "__main__":
    seed_db()
