from pydantic import BaseModel, Field


class AddressRequest(BaseModel):
    label: str = "Home"
    recipient_name: str
    phone: str
    line1: str
    line2: str | None = None
    city: str
    state: str
    pincode: str = Field(pattern=r"^\d{6}$")
    is_default: bool = True


class MerchantProfileRequest(BaseModel):
    company_name: str
    support_email: str | None = None
    support_phone: str | None = None
    razorpay_key_id: str | None = None
    razorpay_key_secret: str | None = None


class WarehouseRequest(BaseModel):
    name: str
    line1: str
    city: str
    state: str
    pincode: str = Field(pattern=r"^\d{6}$")


class DeliveryZoneRequest(BaseModel):
    coverage_type: str = Field(pattern=r"^(all_india|state|city|pincode)$")
    coverage_value: str
    shipping_fee: float = Field(ge=0)
    delivery_days: int = Field(ge=1, le=30)


class ProductCreateRequest(BaseModel):
    product_id: str | None = None
    name: str
    description: str | None = None
    price: float = Field(ge=0)
    category: str
    color: str
    sizes: list[str] = []
    in_stock: bool = True
    return_policy: str | None = None
    delivery_time_days: int = Field(default=3, ge=1, le=30)
    rating: float | None = Field(default=None, ge=0, le=5)


class InventoryUpdateRequest(BaseModel):
    warehouse_id: str
    product_id: str
    quantity: int = Field(ge=0)

