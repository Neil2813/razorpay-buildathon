"""
seed.py -- Complete database seeding utility.
Loads 25+ merchants and 350+ products across shoes, shirts, pants, tshirts, hats, and socks
for Men, Women, and Unisex with complete size availability, randomized ratings, warehouse stock,
and delivery zone coverage.

Usage:
    python app/db/seed.py
"""

from __future__ import annotations

import json
import random
from app.db.database import get_db_connection, get_supabase_client

MERCHANTS = [
    ("demo_tenant", "Apex Athletics & Apparel", 5000.0),
    ("tenant_01", "Urban Kicks Store", 5000.0),
    ("tenant_02", "Metro Threads", 4500.0),
    ("tenant_03", "Stride & Style Footwear", 6000.0),
    ("tenant_04", "Titan Sports Gear", 5500.0),
    ("tenant_05", "Luxe Attire House", 8000.0),
    ("tenant_06", "SoleCraft Footwear Studio", 5000.0),
    ("tenant_07", "VogueFit Activewear", 4000.0),
    ("tenant_08", "Velvet Thread Studio", 7000.0),
    ("tenant_09", "AlphaWear Outfitters", 5000.0),
    ("tenant_10", "Heritage Denim Co", 4500.0),
    ("tenant_11", "FootLounge India", 3500.0),
    ("tenant_12", "Zenith Athletic Co", 6000.0),
    ("tenant_13", "UrbanEdge Apparel", 5000.0),
    ("tenant_14", "Monarch Fashion House", 7500.0),
    ("tenant_15", "StreetStride Sneakers", 4500.0),
    ("tenant_16", "Royal Threads India", 6500.0),
    ("tenant_17", "Optima Footwear Studio", 4000.0),
    ("tenant_18", "Casual Cove Retail", 3500.0),
    ("tenant_19", "Prime Fits Clothing", 5000.0),
    ("tenant_20", "Elixir Activewear", 5500.0),
    ("tenant_21", "Iconic Denim Works", 4800.0),
    ("tenant_22", "Swift Runner Store", 5200.0),
    ("tenant_23", "Aura Fashion Hub", 4200.0),
    ("tenant_24", "Pinnacle Shoe Lab", 9000.0),
]

COLORS = ["Black", "White", "Blue", "Red", "Brown", "Grey", "Green", "Beige", "Navy"]

SHOE_SIZES_MEN = ["6", "7", "8", "9", "10", "11", "12"]
SHOE_SIZES_WOMEN = ["5", "6", "7", "8", "9", "10"]
SHOE_SIZES_UNISEX = ["5", "6", "7", "8", "9", "10", "11", "12"]

CLOTHING_SIZES_MEN = ["S", "M", "L", "XL", "XXL"]
CLOTHING_SIZES_WOMEN = ["XS", "S", "M", "L", "XL"]
CLOTHING_SIZES_UNISEX = ["XS", "S", "M", "L", "XL", "XXL"]

PANT_SIZES = ["28", "30", "32", "34", "36", "38"]

SHOE_TYPES = [
    ("Running Shoes", "High performance responsive mesh cushioned running shoes."),
    ("Sneakers", "Classic casual streetwear sneakers with flexible rubber outsole."),
    ("Formal Leather Shoes", "Handcrafted genuine leather formal oxford shoes."),
    ("Loafers", "Slip-on breathable loafers ideal for work and smart-casual outings."),
    ("Trail Runners", "Rugged multi-terrain trail running shoes with deep tread grip."),
    ("Training Shoes", "Cross-training shoes built for gym workouts and stability."),
    ("Walking Shoes", "Ultra-lightweight walking shoes with arch support Memory Foam."),
    ("Canvas Shoes", "Durable cotton canvas casual shoes for daily wear.")
]

SHIRT_TYPES = [
    ("Casual Cotton Shirt", "100% breathable pure cotton button-down casual shirt."),
    ("Formal Oxford Shirt", "Crisp tailored formal Oxford shirt with stiff collar."),
    ("Linen Summer Shirt", "Lightweight premium linen relaxed fit summer shirt."),
    ("Denim Slim Shirt", "Vintage washed stretch denim shirt with contrast buttons."),
    ("Flannel Plaid Shirt", "Soft brushed warm flannel check shirt for casual outings.")
]

PANT_TYPES = [
    ("Slim Fit Jeans", "Durable stretch denim jeans with 5-pocket styling."),
    ("Chino Trousers", "Comfortable cotton twill casual chino trousers."),
    ("Formal Trousers", "Wrinkle-resistant tailored formal dress pants."),
    ("Cargo Joggers", "Multi-pocket tactical utility cargo joggers with elastic cuffs.")
]

TSHIRT_TYPES = [
    ("Polo T-Shirt", "Classic pique cotton polo neck t-shirt with embroidered logo."),
    ("Graphic Crew Tee", "Soft combed cotton graphic printed crew neck t-shirt."),
    ("Dry-Fit Athletic Tee", "Moisture-wicking quick-dry athletic workout t-shirt."),
    ("Oversized Heavyweight Tee", "Streetwear oversized drop-shoulder heavyweight cotton t-shirt.")
]

ACCESSORY_TYPES = [
    ("Baseball Cap", "Adjustable 6-panel cotton twill baseball cap.", "hat", ["Free Size"], 499.0, 1299.0),
    ("Ankle Cushion Socks (Pack of 3)", "Sweat-absorbent combed cotton ankle socks.", "sock", ["Free Size", "M", "L"], 299.0, 799.0),
]


def generate_catalog():
    random.seed(2026)  # Stable reproducible generation
    products = []
    inv_items = []
    p_counter = 1

    departments = [
        ("Men's", "men", SHOE_SIZES_MEN, CLOTHING_SIZES_MEN),
        ("Women's", "women", SHOE_SIZES_WOMEN, CLOTHING_SIZES_WOMEN),
        ("Unisex", "unisex", SHOE_SIZES_UNISEX, CLOTHING_SIZES_UNISEX)
    ]

    primary_colors = ["Black", "White", "Blue", "Red", "Navy", "Grey", "Brown"]

    for tenant_id, tenant_name, _ in MERCHANTS:
        prefix = tenant_name.split()[0]

        # Generate Shoes (each color & style across departments)
        for dept_label, dept_code, shoe_sizes, _ in departments:
            for s_name, s_desc in SHOE_TYPES:
                # For demo_tenant, generate all colors; for others, pick 2 colors per style
                colors_to_seed = primary_colors if tenant_id == "demo_tenant" else random.sample(primary_colors, k=2)
                for color in colors_to_seed:
                    pid = f"prod_shoe_{p_counter:04d}"
                    price = round(random.uniform(799.0, 4999.0), -1)
                    rating = round(random.uniform(3.9, 4.9), 1)
                    full_name = f"{prefix} {dept_label} {color} {s_name}"
                    desc = f"{s_desc} Designed for {dept_label.lower()} ({dept_code}) comfort."
                    return_pol = "30-day hassle-free return policy." if random.random() > 0.1 else None
                    del_days = random.choice([2, 3, 4])

                    products.append((
                        pid, tenant_id, full_name, desc, price, "shoe", color,
                        json.dumps(shoe_sizes), 1, return_pol, del_days, rating
                    ))
                    inv_items.extend([
                        (f"wh_{tenant_id}_blr", pid, random.randint(10, 40)),
                        (f"wh_{tenant_id}_del", pid, random.randint(5, 30)),
                        (f"wh_{tenant_id}_mum", pid, random.randint(8, 35)),
                    ])
                    p_counter += 1

        # Generate Shirts
        for dept_label, dept_code, _, cloth_sizes in departments:
            for sh_name, sh_desc in SHIRT_TYPES:
                colors_to_seed = primary_colors if tenant_id == "demo_tenant" else random.sample(primary_colors, k=2)
                for color in colors_to_seed:
                    pid = f"prod_shirt_{p_counter:04d}"
                    price = round(random.uniform(599.0, 3499.0), -1)
                    rating = round(random.uniform(4.0, 4.9), 1)
                    full_name = f"{prefix} {dept_label} {color} {sh_name}"
                    desc = f"{sh_desc} Suitable for {dept_label.lower()} ({dept_code}) wear."
                    return_pol = "30-day return window in original condition."
                    del_days = random.choice([2, 3])

                    products.append((
                        pid, tenant_id, full_name, desc, price, "shirt", color,
                        json.dumps(cloth_sizes), 1, return_pol, del_days, rating
                    ))
                    inv_items.extend([
                        (f"wh_{tenant_id}_blr", pid, random.randint(15, 50)),
                        (f"wh_{tenant_id}_del", pid, random.randint(10, 40)),
                        (f"wh_{tenant_id}_mum", pid, random.randint(12, 45)),
                    ])
                    p_counter += 1

        # Generate Pants
        for dept_label, dept_code, _, _ in departments:
            for p_type_name, p_type_desc in PANT_TYPES:
                colors_to_seed = primary_colors if tenant_id == "demo_tenant" else random.sample(primary_colors, k=2)
                for color in colors_to_seed:
                    pid = f"prod_pant_{p_counter:04d}"
                    price = round(random.uniform(999.0, 3999.0), -1)
                    rating = round(random.uniform(4.1, 4.8), 1)
                    full_name = f"{prefix} {dept_label} {color} {p_type_name}"
                    desc = f"{p_type_desc} Tailored for {dept_label.lower()} ({dept_code}) styling."
                    return_pol = "30-day hassle-free exchange."
                    del_days = random.choice([2, 3, 4])

                    products.append((
                        pid, tenant_id, full_name, desc, price, "pant", color,
                        json.dumps(PANT_SIZES), 1, return_pol, del_days, rating
                    ))
                    inv_items.extend([
                        (f"wh_{tenant_id}_blr", pid, random.randint(10, 30)),
                        (f"wh_{tenant_id}_del", pid, random.randint(10, 30)),
                        (f"wh_{tenant_id}_mum", pid, random.randint(10, 30)),
                    ])
                    p_counter += 1

        # Generate T-Shirts
        for dept_label, dept_code, _, cloth_sizes in departments:
            for ts_name, ts_desc in TSHIRT_TYPES:
                colors_to_seed = primary_colors if tenant_id == "demo_tenant" else random.sample(primary_colors, k=2)
                for color in colors_to_seed:
                    pid = f"prod_tshirt_{p_counter:04d}"
                    price = round(random.uniform(499.0, 1999.0), -1)
                    rating = round(random.uniform(4.0, 4.9), 1)
                    full_name = f"{prefix} {dept_label} {color} {ts_name}"
                    desc = f"{ts_desc} Designed for daily {dept_label.lower()} ({dept_code}) fashion."
                    return_pol = "30-day return policy."
                    del_days = 2

                    products.append((
                        pid, tenant_id, full_name, desc, price, "tshirt", color,
                        json.dumps(cloth_sizes), 1, return_pol, del_days, rating
                    ))
                    inv_items.extend([
                        (f"wh_{tenant_id}_blr", pid, random.randint(20, 60)),
                        (f"wh_{tenant_id}_del", pid, random.randint(15, 50)),
                        (f"wh_{tenant_id}_mum", pid, random.randint(20, 60)),
                    ])
                    p_counter += 1

        # Generate Accessories (Hats, Socks)
        for acc_title, acc_desc, acc_cat, acc_sizes, min_p, max_p in ACCESSORY_TYPES:
            for color in ["Black", "White", "Blue", "Grey"]:
                pid = f"prod_acc_{p_counter:04d}"
                price = round(random.uniform(min_p, max_p), -1)
                rating = round(random.uniform(4.2, 4.9), 1)
                full_name = f"{prefix} {color} {acc_title}"
                return_pol = "14-day easy return policy."
                del_days = 2

                products.append((
                    pid, tenant_id, full_name, acc_desc, price, acc_cat, color,
                    json.dumps(acc_sizes), 1, return_pol, del_days, rating
                ))
                inv_items.extend([
                    (f"wh_{tenant_id}_blr", pid, random.randint(25, 80)),
                    (f"wh_{tenant_id}_del", pid, random.randint(20, 70)),
                    (f"wh_{tenant_id}_mum", pid, random.randint(25, 80)),
                ])
                p_counter += 1

    return products, inv_items


def seed_db():
    supabase = get_supabase_client()
    products_tuple_list, inventory_tuple_list = generate_catalog()

    conn = get_db_connection()
    cursor = conn.cursor()

    print(f"[seed] Seeding {len(MERCHANTS)} merchants...")
    for tenant_id, name, ceiling in MERCHANTS:
        cursor.execute("""
            INSERT INTO tenants (tenant_id, name, unattended_spend_ceiling)
            VALUES (?, ?, ?)
            ON CONFLICT(tenant_id) DO UPDATE SET name=excluded.name, unattended_spend_ceiling=excluded.unattended_spend_ceiling;
        """, (tenant_id, name, ceiling))

        # Seed 3 Warehouses per tenant
        cursor.execute("""INSERT OR IGNORE INTO warehouses (warehouse_id, tenant_id, name, line1, city, state, pincode)
            VALUES (?, ?, ?, '88 Commerce Park', 'Bengaluru', 'Karnataka', '560001');""", (f"wh_{tenant_id}_blr", tenant_id, f"{name} Bengaluru WH"))
        cursor.execute("""INSERT OR IGNORE INTO warehouses (warehouse_id, tenant_id, name, line1, city, state, pincode)
            VALUES (?, ?, ?, '12 Ring Road', 'New Delhi', 'Delhi', '110001');""", (f"wh_{tenant_id}_del", tenant_id, f"{name} Delhi WH"))
        cursor.execute("""INSERT OR IGNORE INTO warehouses (warehouse_id, tenant_id, name, line1, city, state, pincode)
            VALUES (?, ?, ?, '45 Marine Drive', 'Mumbai', 'Maharashtra', '400001');""", (f"wh_{tenant_id}_mum", tenant_id, f"{name} Mumbai WH"))

        # Seed Delivery Zones per tenant
        cursor.execute("""INSERT OR IGNORE INTO delivery_zones (zone_id, tenant_id, coverage_type, coverage_value, shipping_fee, delivery_days)
            VALUES (?, ?, 'all_india', 'all', 150.0, 5);""", (f"zone_{tenant_id}_all", tenant_id))
        cursor.execute("""INSERT OR IGNORE INTO delivery_zones (zone_id, tenant_id, coverage_type, coverage_value, shipping_fee, delivery_days)
            VALUES (?, ?, 'state', 'Karnataka', 80.0, 3);""", (f"zone_{tenant_id}_kar", tenant_id))
        cursor.execute("""INSERT OR IGNORE INTO delivery_zones (zone_id, tenant_id, coverage_type, coverage_value, shipping_fee, delivery_days)
            VALUES (?, ?, 'city', 'Bengaluru', 40.0, 1);""", (f"zone_{tenant_id}_blr", tenant_id))

    print(f"[seed] Seeding {len(products_tuple_list)} products into catalog...")
    cursor.executemany("""
        INSERT INTO catalog (
            product_id, tenant_id, name, description, price,
            category, color, sizes, in_stock, return_policy, delivery_time_days, rating
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(product_id) DO UPDATE SET
            name=excluded.name, description=excluded.description, price=excluded.price,
            category=excluded.category, color=excluded.color, sizes=excluded.sizes,
            in_stock=excluded.in_stock, return_policy=excluded.return_policy,
            delivery_time_days=excluded.delivery_time_days, rating=excluded.rating;
    """, products_tuple_list)

    print(f"[seed] Seeding inventory stock for {len(inventory_tuple_list)} warehouse product mappings...")
    cursor.executemany("""
        INSERT INTO warehouse_inventory (warehouse_id, product_id, quantity)
        VALUES (?, ?, ?)
        ON CONFLICT(warehouse_id, product_id) DO UPDATE SET quantity=excluded.quantity;
    """, inventory_tuple_list)

    # Supabase optional sync
    if supabase:
        print("[seed] Syncing tenants & catalog to Supabase...")
        try:
            supabase_tenants = [{"tenant_id": t[0], "name": t[1], "unattended_spend_ceiling": t[2]} for t in MERCHANTS]
            supabase.table("tenants").upsert(supabase_tenants).execute()

            supabase_prods = []
            for p in products_tuple_list:
                supabase_prods.append({
                    "product_id": p[0],
                    "tenant_id": p[1],
                    "name": p[2],
                    "description": p[3],
                    "price": p[4],
                    "category": p[5],
                    "color": p[6],
                    "sizes": json.loads(p[7]),
                    "in_stock": bool(p[8]),
                    "return_policy": p[9],
                    "delivery_time_days": p[10],
                    "rating": p[11]
                })
            # Upsert in batches of 100
            for i in range(0, len(supabase_prods), 100):
                supabase.table("catalog").upsert(supabase_prods[i:i+100]).execute()
            print("[seed] Supabase seeded successfully.")
        except Exception as e:
            print(f"[seed] Supabase seeding warning: {e}")

    conn.commit()
    conn.close()
    print(f"[seed] Seeding completed successfully! ({len(MERCHANTS)} merchants, {len(products_tuple_list)} products)")


if __name__ == "__main__":
    seed_db()
