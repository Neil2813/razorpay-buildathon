"""
seed.py -- Optional database seeding utility.
Run this script to load initial demo-ready tenants and catalog data.

Usage:
    python app/db/seed.py
"""

from __future__ import annotations

import json
from app.db.database import get_db_connection


def seed_db():
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

    conn.commit()
    conn.close()
    print("[seed] Seeding completed successfully.")


if __name__ == "__main__":
    seed_db()
