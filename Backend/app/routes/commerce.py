"""Merchant fulfilment configuration and buyer delivery-address APIs."""
from uuid import uuid4
import json
from fastapi import APIRouter, Depends, HTTPException
from app.auth.deps import get_current_user, require_role
from app.db.database import get_addresses, get_db_connection, save_address
from app.schemas.commerce import AddressRequest, DeliveryZoneRequest, MerchantProfileRequest, WarehouseRequest, ProductCreateRequest, InventoryUpdateRequest

router = APIRouter(prefix="/commerce", tags=["Commerce"])

@router.get("/addresses")
def list_addresses(current_user: dict = Depends(get_current_user)):
    return {"addresses": get_addresses(current_user["user_id"])}

@router.post("/addresses")
def create_address(body: AddressRequest, current_user: dict = Depends(get_current_user)):
    return save_address(current_user["user_id"], body.model_dump())

@router.get("/merchant/setup")
def merchant_setup(current_user: dict = Depends(require_role(["merchant_admin", "platform_admin"]))):
    conn = get_db_connection()
    try:
        tenant = conn.execute("SELECT tenant_id, name, company_name, support_email, support_phone, razorpay_key_id, razorpay_key_secret FROM tenants WHERE tenant_id=?", (current_user["tenant_id"],)).fetchone()
        warehouses = [dict(r) for r in conn.execute("SELECT * FROM warehouses WHERE tenant_id=? ORDER BY name", (current_user["tenant_id"],))]
        zones = [dict(r) for r in conn.execute("SELECT * FROM delivery_zones WHERE tenant_id=? ORDER BY coverage_type, coverage_value", (current_user["tenant_id"],))]
        return {"merchant": dict(tenant) if tenant else {}, "warehouses": warehouses, "delivery_zones": zones}
    finally: conn.close()

@router.put("/merchant/profile")
def update_merchant_profile(body: MerchantProfileRequest, current_user: dict = Depends(require_role(["merchant_admin", "platform_admin"]))):
    conn = get_db_connection()
    try:
        with conn:
            conn.execute("""
                UPDATE tenants
                SET company_name=?, support_email=?, support_phone=?,
                    razorpay_key_id=COALESCE(?, razorpay_key_id),
                    razorpay_key_secret=COALESCE(?, razorpay_key_secret)
                WHERE tenant_id=?
            """, (body.company_name, body.support_email, body.support_phone, body.razorpay_key_id, body.razorpay_key_secret, current_user["tenant_id"]))
        return {"ok": True}
    finally: conn.close()

@router.post("/merchant/warehouses")
def add_warehouse(body: WarehouseRequest, current_user: dict = Depends(require_role(["merchant_admin", "platform_admin"]))):
    warehouse_id = str(uuid4()); conn = get_db_connection()
    try:
        with conn: conn.execute("INSERT INTO warehouses (warehouse_id, tenant_id, name, line1, city, state, pincode) VALUES (?, ?, ?, ?, ?, ?, ?)", (warehouse_id, current_user["tenant_id"], body.name, body.line1, body.city, body.state, body.pincode))
        return {"warehouse_id": warehouse_id}
    finally: conn.close()

@router.post("/merchant/delivery-zones")
def add_delivery_zone(body: DeliveryZoneRequest, current_user: dict = Depends(require_role(["merchant_admin", "platform_admin"]))):
    if body.coverage_type == "all_india": body.coverage_value = "all"
    zone_id = str(uuid4()); conn = get_db_connection()
    try:
        with conn: conn.execute("INSERT INTO delivery_zones (zone_id, tenant_id, coverage_type, coverage_value, shipping_fee, delivery_days) VALUES (?, ?, ?, ?, ?, ?)", (zone_id, current_user["tenant_id"], body.coverage_type, body.coverage_value, body.shipping_fee, body.delivery_days))
        return {"zone_id": zone_id}
    finally: conn.close()

@router.get("/merchant/products")
def list_products(current_user: dict = Depends(require_role(["merchant_admin", "platform_admin"]))):
    conn = get_db_connection()
    try:
        rows = [dict(r) for r in conn.execute("SELECT * FROM catalog WHERE tenant_id=? ORDER BY name", (current_user["tenant_id"],))]
        for r in rows:
            try: r["sizes"] = json.loads(r["sizes"])
            except: r["sizes"] = []
            r["in_stock"] = bool(r["in_stock"])
        return {"products": rows}
    finally: conn.close()

@router.post("/merchant/products")
def add_product(body: ProductCreateRequest, current_user: dict = Depends(require_role(["merchant_admin", "platform_admin"]))):
    product_id = body.product_id or f"prod_{uuid4().hex[:12]}"
    conn = get_db_connection()
    try:
        with conn:
            conn.execute("""
                INSERT INTO catalog (product_id, tenant_id, name, description, price, category, color, sizes, in_stock, return_policy, delivery_time_days, rating)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (product_id, current_user["tenant_id"], body.name, body.description, body.price, body.category, body.color, json.dumps(body.sizes), int(body.in_stock), body.return_policy, body.delivery_time_days, body.rating))
        return {"product_id": product_id}
    finally: conn.close()

@router.put("/merchant/products/{product_id}")
def update_product(product_id: str, body: ProductCreateRequest, current_user: dict = Depends(require_role(["merchant_admin", "platform_admin"]))):
    conn = get_db_connection()
    try:
        with conn:
            conn.execute("""
                UPDATE catalog
                SET name=?, description=?, price=?, category=?, color=?, sizes=?, in_stock=?, return_policy=?, delivery_time_days=?, rating=?
                WHERE product_id=? AND tenant_id=?
            """, (body.name, body.description, body.price, body.category, body.color, json.dumps(body.sizes), int(body.in_stock), body.return_policy, body.delivery_time_days, body.rating, product_id, current_user["tenant_id"]))
        return {"ok": True}
    finally: conn.close()

@router.delete("/merchant/products/{product_id}")
def delete_product(product_id: str, current_user: dict = Depends(require_role(["merchant_admin", "platform_admin"]))):
    conn = get_db_connection()
    try:
        with conn:
            conn.execute("DELETE FROM catalog WHERE product_id=? AND tenant_id=?", (product_id, current_user["tenant_id"]))
        return {"ok": True}
    finally: conn.close()

@router.get("/merchant/inventory")
def list_inventory(current_user: dict = Depends(require_role(["merchant_admin", "platform_admin"]))):
    conn = get_db_connection()
    try:
        rows = [dict(r) for r in conn.execute("""
            SELECT i.warehouse_id, i.product_id, i.quantity, w.name as warehouse_name, c.name as product_name
            FROM warehouse_inventory i
            JOIN warehouses w ON w.warehouse_id = i.warehouse_id
            JOIN catalog c ON c.product_id = i.product_id
            WHERE w.tenant_id = ? AND c.tenant_id = ?
            ORDER BY w.name, c.name
        """, (current_user["tenant_id"], current_user["tenant_id"]))]
        return {"inventory": rows}
    finally: conn.close()

@router.post("/merchant/inventory")
def update_inventory(body: InventoryUpdateRequest, current_user: dict = Depends(require_role(["merchant_admin", "platform_admin"]))):
    conn = get_db_connection()
    try:
        warehouse = conn.execute("SELECT 1 FROM warehouses WHERE warehouse_id=? AND tenant_id=?", (body.warehouse_id, current_user["tenant_id"])).fetchone()
        product = conn.execute("SELECT 1 FROM catalog WHERE product_id=? AND tenant_id=?", (body.product_id, current_user["tenant_id"])).fetchone()
        if not warehouse or not product:
            raise HTTPException(status_code=400, detail="Invalid warehouse_id or product_id for this merchant.")
        with conn:
            conn.execute("""
                INSERT INTO warehouse_inventory (warehouse_id, product_id, quantity)
                VALUES (?, ?, ?)
                ON CONFLICT(warehouse_id, product_id) DO UPDATE SET quantity=excluded.quantity
            """, (body.warehouse_id, body.product_id, body.quantity))
        return {"ok": True}
    finally: conn.close()
